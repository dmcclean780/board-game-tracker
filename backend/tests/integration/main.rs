use axum::{body::Body, http::{Request, StatusCode}};
use http_body_util::BodyExt;
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::time::Duration;
use testcontainers_modules::{postgres::Postgres, testcontainers::{runners::AsyncRunner, ContainerAsync, ImageExt}};
use tower::ServiceExt;
use bgt_backend::{users::purge_expired, AppState, Auth};
use std::sync::{Arc, Mutex};
use uuid::Uuid;

const SECRET: &str = "test-secret";

/// Starts a throwaway Postgres and applies the real migrations. Keep the guard alive for the test.
async fn db() -> (PgPool, ContainerAsync<Postgres>) {
    let node = Postgres::default().with_tag("17").start().await.unwrap();
    let port = node.get_host_port_ipv4(5432).await.unwrap();
    let pool = PgPoolOptions::new()
        .acquire_timeout(Duration::from_secs(2))
        .connect(&format!("postgres://postgres:postgres@127.0.0.1:{port}/postgres"))
        .await
        .unwrap();
    sqlx::migrate!("../db/migrations").run(&pool).await.unwrap();
    (pool, node)
}

fn state(db: PgPool, auth_url: &str) -> AppState {
    AppState { db, auth: Auth { url: auth_url.into(), jwt_secret: SECRET.into(), service_key: "svc".into(), http: reqwest::Client::new() } }
}

/// A token as the auth provider would issue it for `id`.
fn token(id: Uuid, email: &str, name: Option<&str>) -> String {
    let claims = serde_json::json!({
        "sub": id, "email": email, "aud": "authenticated", "exp": 4_102_444_800u64,
        "user_metadata": { "display_name": name },
    });
    jsonwebtoken::encode(&jsonwebtoken::Header::default(), &claims, &jsonwebtoken::EncodingKey::from_secret(SECRET.as_bytes())).unwrap()
}

async fn call(pool: &PgPool, method: &str, path: &str, token: Option<&str>) -> (StatusCode, String) {
    let mut req = Request::builder().method(method).uri(path);
    if let Some(t) = token {
        req = req.header("authorization", format!("Bearer {t}"));
    }
    let res = bgt_backend::app(state(pool.clone(), "http://unused")).oneshot(req.body(Body::empty()).unwrap()).await.unwrap();
    let status = res.status();
    (status, String::from_utf8_lossy(&res.into_body().collect().await.unwrap().to_bytes()).into_owned())
}

async fn get_health(pool: PgPool) -> (StatusCode, String) {
    let res = bgt_backend::app(state(pool, "http://unused")).oneshot(Request::get("/health").body(Body::empty()).unwrap()).await.unwrap();
    let status = res.status();
    let body = res.into_body().collect().await.unwrap().to_bytes();
    (status, String::from_utf8_lossy(&body).into_owned())
}

#[tokio::test]
async fn health_ok_with_db() {
    let (pool, _node) = db().await;
    let (status, body) = get_health(pool).await;
    assert_eq!(status, StatusCode::OK);
    assert!(body.contains(r#""status":"ok""#));
}

#[tokio::test]
async fn health_503_when_db_down() {
    let (pool, node) = db().await;
    node.stop().await.unwrap();
    let (status, _) = get_health(pool).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
}

#[tokio::test]
async fn players_rejects_blank_name() {
    let (pool, _node) = db().await;
    assert!(sqlx::query("INSERT INTO players (name) VALUES ('  ')").execute(&pool).await.is_err());
    assert!(sqlx::query("INSERT INTO players (name) VALUES ('Ada')").execute(&pool).await.is_ok());
}

#[tokio::test]
async fn me_requires_a_valid_token() {
    let (pool, _node) = db().await;
    assert_eq!(call(&pool, "GET", "/me", None).await.0, StatusCode::UNAUTHORIZED);
    assert_eq!(call(&pool, "GET", "/me", Some("garbage")).await.0, StatusCode::UNAUTHORIZED);
    let forged = jsonwebtoken::encode(
        &jsonwebtoken::Header::default(),
        &serde_json::json!({ "sub": Uuid::new_v4(), "email": "a@x.com", "aud": "authenticated", "exp": 4_102_444_800u64 }),
        &jsonwebtoken::EncodingKey::from_secret(b"wrong"),
    )
    .unwrap();
    assert_eq!(call(&pool, "GET", "/me", Some(&forged)).await.0, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn me_creates_user_on_first_call_and_keeps_it() {
    let (pool, _node) = db().await;
    let id = Uuid::new_v4();
    let (status, body) = call(&pool, "GET", "/me", Some(&token(id, "ada@x.com", Some("Ada")))).await;
    assert_eq!(status, StatusCode::OK);
    assert!(body.contains(r#""display_name":"Ada""#) && body.contains(r#""deletion_scheduled_for":null"#), "{body}");
    // A later call with different claims must not overwrite the stored display name.
    call(&pool, "GET", "/me", Some(&token(id, "ada@x.com", Some("Other")))).await;
    let n: i64 = sqlx::query_scalar("SELECT count(*) FROM users WHERE display_name = 'Ada'").fetch_one(&pool).await.unwrap();
    assert_eq!(n, 1);
}

#[tokio::test]
async fn delete_then_restore() {
    let (pool, _node) = db().await;
    let t = token(Uuid::new_v4(), "ada@x.com", Some("Ada"));
    assert_eq!(call(&pool, "DELETE", "/me", Some(&t)).await.0, StatusCode::NOT_FOUND); // no row yet
    call(&pool, "GET", "/me", Some(&t)).await;
    assert_eq!(call(&pool, "DELETE", "/me", Some(&t)).await.0, StatusCode::NO_CONTENT);
    let (_, body) = call(&pool, "GET", "/me", Some(&t)).await;
    assert!(!body.contains(r#""deletion_scheduled_for":null"#), "{body}");
    assert_eq!(call(&pool, "POST", "/me/restore", Some(&t)).await.0, StatusCode::NO_CONTENT);
    let (_, body) = call(&pool, "GET", "/me", Some(&t)).await;
    assert!(body.contains(r#""deletion_scheduled_for":null"#), "{body}");
}

#[tokio::test]
async fn purge_removes_only_users_past_grace_period() {
    let (pool, _node) = db().await;
    // Stand-in for the auth provider's admin API; records which accounts were deleted.
    let deleted: Arc<Mutex<Vec<String>>> = Default::default();
    let log = deleted.clone();
    let admin = axum::Router::new().route(
        "/admin/users/{id}",
        axum::routing::delete(move |axum::extract::Path(id): axum::extract::Path<String>| async move {
            log.lock().unwrap().push(id);
            StatusCode::OK
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, admin).await.unwrap() });

    let (old, recent, active) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
    for (id, days) in [(old, Some(31)), (recent, Some(29)), (active, None)] {
        sqlx::query("INSERT INTO users (id, email, display_name, deletion_requested_at) VALUES ($1, 'a@x.com', 'A', now() - make_interval(days => $2))")
            .bind(id)
            .bind(days)
            .execute(&pool)
            .await
            .unwrap();
    }
    let a = state(pool.clone(), &url).auth;
    assert_eq!(purge_expired(&pool, &a).await.unwrap(), 1);
    assert_eq!(*deleted.lock().unwrap(), vec![old.to_string()]);
    let left: i64 = sqlx::query_scalar("SELECT count(*) FROM users").fetch_one(&pool).await.unwrap();
    assert_eq!(left, 2);
    // Provider down: the row must stay so the purge retries later.
    sqlx::query("UPDATE users SET deletion_requested_at = now() - interval '40 days' WHERE id = $1").bind(recent).execute(&pool).await.unwrap();
    let down = state(pool.clone(), "http://127.0.0.1:1").auth;
    assert_eq!(purge_expired(&pool, &down).await.unwrap(), 0);
    let left: i64 = sqlx::query_scalar("SELECT count(*) FROM users").fetch_one(&pool).await.unwrap();
    assert_eq!(left, 2);
}
