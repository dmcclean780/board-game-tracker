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
    AppState { db, hub: Default::default(), auth: Auth { url: auth_url.into(), jwt_secret: SECRET.into(), service_key: "svc".into(), http: reqwest::Client::new() } }
}

/// A token as the auth provider would issue it for `id`.
fn token(id: Uuid, email: &str, name: Option<&str>) -> String {
    token_exp(id, email, name, 4_102_444_800)
}

/// Like `token`, expiring at `exp` (seconds since the epoch).
fn token_exp(id: Uuid, email: &str, name: Option<&str>, exp: u64) -> String {
    let claims = serde_json::json!({
        "sub": id, "email": email, "aud": "authenticated", "exp": exp,
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

/// Like `call`, but sends a JSON body.
async fn send(pool: &PgPool, method: &str, path: &str, token: &str, body: serde_json::Value) -> (StatusCode, String) {
    let req = Request::builder().method(method).uri(path).header("authorization", format!("Bearer {token}")).header("content-type", "application/json");
    let res = bgt_backend::app(state(pool.clone(), "http://unused")).oneshot(req.body(Body::from(body.to_string())).unwrap()).await.unwrap();
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
async fn update_me_changes_display_name() {
    let (pool, _node) = db().await;
    let t = token(Uuid::new_v4(), "ada@x.com", Some("Ada"));
    let patch = |name: &str| send(&pool, "PATCH", "/me", &t, serde_json::json!({ "display_name": name }));
    assert_eq!(patch("Bo").await.0, StatusCode::NOT_FOUND); // no row yet
    call(&pool, "GET", "/me", Some(&t)).await;
    let (status, body) = patch("  Bo  ").await;
    assert_eq!(status, StatusCode::OK);
    assert!(body.contains(r#""display_name":"Bo""#), "{body}");
    assert_eq!(patch("   ").await.0, StatusCode::UNPROCESSABLE_ENTITY);
    let (_, body) = call(&pool, "GET", "/me", Some(&t)).await;
    assert!(body.contains(r#""display_name":"Bo""#), "{body}");
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

fn root_session() -> serde_json::Value {
    serde_json::json!({
        "game": "root", "played_on": "2026-11-20", "players": ["Ada", "Bo"],
        "result": { "map": "autumn", "deck": "standard", "landmarks": [], "victory": "points", "players": {
            "Ada": { "faction": "marquise_de_cat", "score": 30, "winner": true },
            "Bo": { "faction": "vagabond", "score": 12, "winner": false } } },
    })
}

#[tokio::test]
async fn games_lists_every_game() {
    let (pool, _node) = db().await;
    let t = token(Uuid::new_v4(), "ada@x.com", None);
    let (status, body) = call(&pool, "GET", "/games", Some(&t)).await;
    assert_eq!(status, StatusCode::OK);
    assert!(body.contains(r#""id":"root""#) && body.contains(r#""id":"arcs""#) && body.contains(r#""id":"old-kings-crown""#), "{body}");
    assert_eq!(call(&pool, "GET", "/games", None).await.0, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn a_games_data_is_served_to_signed_in_users() {
    let (pool, _node) = db().await;
    let t = token(Uuid::new_v4(), "ada@x.com", None);
    let (status, body) = call(&pool, "GET", "/games/root", Some(&t)).await;
    assert_eq!(status, StatusCode::OK);
    let v: serde_json::Value = serde_json::from_str(&body).unwrap();
    assert_eq!(v["rules"]["points_to_win"], 30);
    assert_eq!(v["form"]["max_players"], 6);
    assert!(v["factions"].as_array().unwrap().iter().any(|f| f["id"] == "vagabond" && f["coalition"] == true));
    let (status, body) = call(&pool, "GET", "/games/arcs", Some(&t)).await;
    assert_eq!(status, StatusCode::OK);
    let v: serde_json::Value = serde_json::from_str(&body).unwrap();
    assert!(v["setups"].as_array().unwrap().iter().any(|s| s["id"] == "2p_frontiers" && s["players"] == 2));
    assert_eq!(call(&pool, "GET", "/games/chess", Some(&t)).await.0, StatusCode::NOT_FOUND);
    assert_eq!(call(&pool, "GET", "/games/root", None).await.0, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn a_result_can_be_checked_without_storing_it() {
    let (pool, _node) = db().await;
    let t = token(Uuid::new_v4(), "ada@x.com", None);
    call(&pool, "GET", "/me", Some(&t)).await;
    let ok = serde_json::json!({ "players": root_session()["players"], "result": root_session()["result"] });
    assert_eq!(send(&pool, "POST", "/games/root/check", &t, ok.clone()).await.0, StatusCode::NO_CONTENT);
    let mut bad = ok;
    bad["result"]["players"]["Ada"]["score"] = 5.into();
    let (status, body) = send(&pool, "POST", "/games/root/check", &t, bad.clone()).await;
    assert_eq!((status, body.as_str()), (StatusCode::UNPROCESSABLE_ENTITY, "a points victory needs at least 30 points"));
    assert_eq!(send(&pool, "POST", "/games/chess/check", &t, bad).await.0, StatusCode::NOT_FOUND);
    let (_, list) = call(&pool, "GET", "/sessions", Some(&t)).await;
    assert_eq!(list, "[]");
}

#[tokio::test]
async fn record_list_view_and_delete_a_session() {
    let (pool, _node) = db().await;
    let t = token(Uuid::new_v4(), "ada@x.com", None);
    call(&pool, "GET", "/me", Some(&t)).await;
    let (status, body) = send(&pool, "POST", "/sessions", &t, root_session()).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    let id = serde_json::from_str::<serde_json::Value>(&body).unwrap()["id"].as_str().unwrap().to_owned();
    // A later play date sorts first.
    let mut later = root_session();
    later["played_on"] = "2026-11-21".into();
    send(&pool, "POST", "/sessions", &t, later).await;
    let (_, list) = call(&pool, "GET", "/sessions", Some(&t)).await;
    let list: serde_json::Value = serde_json::from_str(&list).unwrap();
    assert_eq!(list[0]["played_on"], "2026-11-21");
    assert_eq!(list.as_array().unwrap().len(), 2);
    let (status, body) = call(&pool, "GET", &format!("/sessions/{id}"), Some(&t)).await;
    assert_eq!(status, StatusCode::OK);
    assert!(body.contains(r#""played_on":"2026-11-20""#) && body.contains("marquise_de_cat"), "{body}");
    let v: serde_json::Value = serde_json::from_str(&body).unwrap();
    assert_eq!(v["game_name"], "Root");
    assert_eq!(v["winners"], serde_json::json!(["Ada"]));
    assert_eq!(v["details"]["setup"][0], serde_json::json!({ "title": "Map", "value": "Autumn" }));
    assert_eq!(v["details"]["players"][0]["name"], "Ada");
    assert_eq!(call(&pool, "DELETE", &format!("/sessions/{id}"), Some(&t)).await.0, StatusCode::NO_CONTENT);
    assert_eq!(call(&pool, "GET", &format!("/sessions/{id}"), Some(&t)).await.0, StatusCode::NOT_FOUND);
    assert_eq!(call(&pool, "DELETE", &format!("/sessions/{id}"), Some(&t)).await.0, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn an_arcs_session_is_recorded_and_checked() {
    let (pool, _node) = db().await;
    let t = token(Uuid::new_v4(), "ada@x.com", None);
    call(&pool, "GET", "/me", Some(&t)).await;
    let mut arcs = serde_json::json!({
        "game": "arcs", "players": ["Ada", "Bo"],
        "result": { "setup": "2p_frontiers", "leaders": true, "players": {
            "Ada": { "power": 12, "winner": true, "leader": "elder", "lore": ["tool_priests"] },
            "Bo": { "power": 9, "winner": false, "leader": "corsair" } } },
    });
    assert_eq!(send(&pool, "POST", "/sessions", &t, arcs.clone()).await.0, StatusCode::CREATED);
    arcs["result"]["setup"] = "3p_core_conflict".into();
    let (status, msg) = send(&pool, "POST", "/sessions", &t, arcs).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert!(msg.contains("is not for 2 players"), "{msg}");
}

#[tokio::test]
async fn an_old_kings_crown_session_is_recorded_and_checked() {
    let (pool, _node) = db().await;
    let t = token(Uuid::new_v4(), "ada@x.com", None);
    call(&pool, "GET", "/me", Some(&t)).await;
    let mut okc = serde_json::json!({
        "game": "old-kings-crown", "players": ["Ada", "Bo"],
        "result": { "players": {
            "Ada": { "house": "clans", "score": 12, "winner": true },
            "Bo": { "house": "nobility", "score": 9, "winner": false } } },
    });
    assert_eq!(send(&pool, "POST", "/sessions", &t, okc.clone()).await.0, StatusCode::CREATED);
    okc["result"]["players"]["Bo"]["house"] = "clans".into();
    let (status, msg) = send(&pool, "POST", "/sessions", &t, okc).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert!(msg.contains("only one player can play the house"), "{msg}");
}

#[tokio::test]
async fn played_on_defaults_to_today() {
    let (pool, _node) = db().await;
    let t = token(Uuid::new_v4(), "ada@x.com", None);
    call(&pool, "GET", "/me", Some(&t)).await;
    let mut s = root_session();
    s.as_object_mut().unwrap().remove("played_on");
    assert_eq!(send(&pool, "POST", "/sessions", &t, s).await.0, StatusCode::CREATED);
    let n: i64 = sqlx::query_scalar("SELECT count(*) FROM sessions WHERE played_on = CURRENT_DATE").fetch_one(&pool).await.unwrap();
    assert_eq!(n, 1);
}

#[tokio::test]
async fn sessions_are_private_to_their_recorder() {
    let (pool, _node) = db().await;
    let (ada, bo) = (token(Uuid::new_v4(), "ada@x.com", None), token(Uuid::new_v4(), "bo@x.com", None));
    call(&pool, "GET", "/me", Some(&ada)).await;
    call(&pool, "GET", "/me", Some(&bo)).await;
    let (_, body) = send(&pool, "POST", "/sessions", &ada, root_session()).await;
    let id = serde_json::from_str::<serde_json::Value>(&body).unwrap()["id"].as_str().unwrap().to_owned();
    assert_eq!(call(&pool, "GET", &format!("/sessions/{id}"), Some(&bo)).await.0, StatusCode::NOT_FOUND);
    assert_eq!(call(&pool, "DELETE", &format!("/sessions/{id}"), Some(&bo)).await.0, StatusCode::NOT_FOUND);
    assert_eq!(call(&pool, "GET", "/sessions", Some(&bo)).await.1, "[]");
    assert_eq!(call(&pool, "GET", &format!("/sessions/{id}"), Some(&ada)).await.0, StatusCode::OK);
    assert_eq!(call(&pool, "GET", "/sessions", None).await.0, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn invalid_sessions_are_rejected_with_a_message() {
    let (pool, _node) = db().await;
    let t = token(Uuid::new_v4(), "ada@x.com", None);
    call(&pool, "GET", "/me", Some(&t)).await;
    let mut under_30 = root_session();
    under_30["result"]["players"]["Ada"]["score"] = 29.into();
    let mut unknown = root_session();
    unknown["game"] = "chess".into();
    let mut zero = root_session();
    zero["duration_minutes"] = 0.into();
    for (body, expect) in [(under_30, "30 points"), (unknown, "unknown game"), (zero, "duration")] {
        let (status, msg) = send(&pool, "POST", "/sessions", &t, body).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
        assert!(msg.contains(expect), "{msg}");
    }
    let n: i64 = sqlx::query_scalar("SELECT count(*) FROM sessions").fetch_one(&pool).await.unwrap();
    assert_eq!(n, 0);
}

#[tokio::test]
async fn purging_a_user_removes_their_sessions() {
    let (pool, _node) = db().await;
    let id = Uuid::new_v4();
    let t = token(id, "ada@x.com", None);
    call(&pool, "GET", "/me", Some(&t)).await;
    send(&pool, "POST", "/sessions", &t, root_session()).await;
    sqlx::query("DELETE FROM users WHERE id = $1").bind(id).execute(&pool).await.unwrap();
    let n: i64 = sqlx::query_scalar("SELECT count(*) FROM sessions").fetch_one(&pool).await.unwrap();
    assert_eq!(n, 0);
}

/// Signs a User up (first `GET /me`) and returns their token, id and friend code.
async fn sign_up(pool: &PgPool, name: &str) -> (String, Uuid, String) {
    let id = Uuid::new_v4();
    let t = token(id, &format!("{name}@x.com"), Some(name));
    let (_, body) = call(pool, "GET", "/me", Some(&t)).await;
    let me: serde_json::Value = serde_json::from_str(&body).unwrap();
    (t, id, me["friend_code"].as_str().unwrap().to_owned())
}

async fn add_friend(pool: &PgPool, t: &str, code: &str) -> (StatusCode, String) {
    send(pool, "POST", "/friends", t, serde_json::json!({ "code": code })).await
}

async fn friend_names(pool: &PgPool, t: &str) -> Vec<String> {
    let (_, body) = call(pool, "GET", "/friends", Some(t)).await;
    let list: Vec<serde_json::Value> = serde_json::from_str(&body).unwrap();
    list.iter().map(|f| f["display_name"].as_str().unwrap().to_owned()).collect()
}

#[tokio::test]
async fn add_friend_by_code_is_shared_and_removable() {
    let (pool, _node) = db().await;
    let (ada, ada_id, ada_code) = sign_up(&pool, "Ada").await;
    let (bo, bo_id, bo_code) = sign_up(&pool, "bo").await;
    let (cy, _, cy_code) = sign_up(&pool, "Cy").await;
    assert_eq!(ada_code.len(), 8);
    assert!(ada_code.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()), "{ada_code}");
    assert_eq!(friend_names(&pool, &ada).await, Vec::<String>::new());
    // Lower case, a dash and spaces are all accepted.
    let typed = format!(" {}-{} ", &bo_code[..4].to_lowercase(), &bo_code[4..].to_lowercase());
    let (status, body) = add_friend(&pool, &ada, &typed).await;
    assert_eq!(status, StatusCode::CREATED, "{body}");
    assert!(body.contains(r#""display_name":"bo""#), "{body}");
    assert_eq!(add_friend(&pool, &ada, &cy_code).await.0, StatusCode::CREATED);
    // Both sides see each other; each list is sorted A to Z ignoring case.
    assert_eq!(friend_names(&pool, &ada).await, ["bo", "Cy"]);
    assert_eq!(friend_names(&pool, &bo).await, ["Ada"]);
    assert_eq!(friend_names(&pool, &cy).await, ["Ada"]);
    // Either side can end it, and it ends for both.
    assert_eq!(call(&pool, "DELETE", &format!("/friends/{ada_id}"), Some(&bo)).await.0, StatusCode::NO_CONTENT);
    assert_eq!(friend_names(&pool, &ada).await, ["Cy"]);
    assert!(friend_names(&pool, &bo).await.is_empty());
    assert_eq!(call(&pool, "DELETE", &format!("/friends/{ada_id}"), Some(&bo)).await.0, StatusCode::NOT_FOUND);
    assert_eq!(call(&pool, "DELETE", &format!("/friends/{bo_id}"), Some(&ada)).await.0, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn add_friend_rejects_bad_codes() {
    let (pool, _node) = db().await;
    let (ada, _, ada_code) = sign_up(&pool, "Ada").await;
    let (bo, _, bo_code) = sign_up(&pool, "Bo").await;
    let (_, _, cy_code) = sign_up(&pool, "Cy").await;
    let expect = |r: (StatusCode, String), msg: &str| assert_eq!(r, (StatusCode::UNPROCESSABLE_ENTITY, msg.to_owned()));
    expect(add_friend(&pool, &ada, "ZZZZ-ZZZZ").await, "No user has that friend code.");
    expect(add_friend(&pool, &ada, "").await, "No user has that friend code.");
    expect(add_friend(&pool, &ada, &ada_code).await, "That is your own friend code.");
    assert_eq!(add_friend(&pool, &ada, &bo_code).await.0, StatusCode::CREATED);
    expect(add_friend(&pool, &ada, &bo_code).await, "Bo is already your friend.");
    expect(add_friend(&pool, &bo, &ada_code).await, "Ada is already your friend.");
    // A User with a scheduled deletion cannot be added, but stays listed for existing Friends.
    sqlx::query("UPDATE users SET deletion_requested_at = now() WHERE friend_code = $1").bind(&cy_code).execute(&pool).await.unwrap();
    expect(add_friend(&pool, &ada, &cy_code).await, "No user has that friend code.");
    sqlx::query("UPDATE users SET deletion_requested_at = now() WHERE friend_code = $1").bind(&bo_code).execute(&pool).await.unwrap();
    assert_eq!(friend_names(&pool, &ada).await, ["Bo"]);
}

#[tokio::test]
async fn regenerating_friend_code_keeps_friends() {
    let (pool, _node) = db().await;
    let (ada, _, old) = sign_up(&pool, "Ada").await;
    let (bo, _, bo_code) = sign_up(&pool, "Bo").await;
    let (cy, _, _) = sign_up(&pool, "Cy").await;
    add_friend(&pool, &ada, &bo_code).await;
    let (status, body) = call(&pool, "POST", "/me/friend-code", Some(&ada)).await;
    assert_eq!(status, StatusCode::OK);
    let new = serde_json::from_str::<serde_json::Value>(&body).unwrap()["friend_code"].as_str().unwrap().to_owned();
    assert_ne!(new, old);
    assert_eq!(friend_names(&pool, &bo).await, ["Ada"]);
    assert_eq!(add_friend(&pool, &cy, &old).await, (StatusCode::UNPROCESSABLE_ENTITY, "No user has that friend code.".to_owned()));
    assert_eq!(add_friend(&pool, &cy, &new).await.0, StatusCode::CREATED);
    // No row yet: 404.
    let ghost = token(Uuid::new_v4(), "g@x.com", Some("G"));
    assert_eq!(call(&pool, "POST", "/me/friend-code", Some(&ghost)).await.0, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn purging_a_user_removes_their_friendships() {
    let (pool, _node) = db().await;
    let (ada, ada_id, _) = sign_up(&pool, "Ada").await;
    let (bo, _, bo_code) = sign_up(&pool, "Bo").await;
    add_friend(&pool, &ada, &bo_code).await;
    sqlx::query("DELETE FROM users WHERE id = $1").bind(ada_id).execute(&pool).await.unwrap();
    assert!(friend_names(&pool, &bo).await.is_empty());
    let n: i64 = sqlx::query_scalar("SELECT count(*) FROM friendships").fetch_one(&pool).await.unwrap();
    assert_eq!(n, 0);
}

// --- live updates over /ws ---

use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::{connect_async, tungstenite::Message, MaybeTlsStream, WebSocketStream};

type Ws = WebSocketStream<MaybeTlsStream<tokio::net::TcpStream>>;

/// Runs the real app, with its NOTIFY listener, on a free port and returns the address.
async fn serve(pool: &PgPool) -> String {
    let mut state = state(pool.clone(), "http://unused");
    state.hub = bgt_backend::live::Hub::start(pool).await.unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap().to_string();
    tokio::spawn(async move { axum::serve(listener, bgt_backend::app(state)).await.unwrap() });
    addr
}

async fn connect(addr: &str, first_message: Option<&str>) -> Ws {
    let (mut ws, _) = connect_async(format!("ws://{addr}/ws")).await.unwrap();
    if let Some(m) = first_message {
        ws.send(Message::text(m)).await.unwrap();
    }
    ws
}

async fn next_text(ws: &mut Ws, secs: u64) -> String {
    match tokio::time::timeout(Duration::from_secs(secs), ws.next()).await {
        Ok(Some(Ok(Message::Text(t)))) => t.to_string(),
        other => panic!("expected a text message, got {other:?}"),
    }
}

/// Connects with `token` and waits until the server says it is listening.
async fn listen_as(addr: &str, token: &str) -> Ws {
    let mut ws = connect(addr, Some(token)).await;
    assert_eq!(next_text(&mut ws, 3).await, r#"{"type":"ready"}"#);
    ws
}

async fn assert_closes_within(ws: &mut Ws, secs: u64) {
    let end = tokio::time::Instant::now() + Duration::from_secs(secs);
    loop {
        match tokio::time::timeout_at(end, ws.next()).await {
            Ok(None | Some(Err(_)) | Some(Ok(Message::Close(_)))) => return,
            Ok(Some(Ok(_))) => continue,
            Err(_) => panic!("the socket is still open"),
        }
    }
}

#[tokio::test]
async fn ws_pushes_friend_changes_to_both_users() {
    let (pool, _node) = db().await;
    let addr = serve(&pool).await;
    let (ada, ada_id, _) = sign_up(&pool, "Ada").await;
    let (bo, _, bo_code) = sign_up(&pool, "Bo").await;
    let (mut wa, mut wb) = (listen_as(&addr, &ada).await, listen_as(&addr, &bo).await);
    add_friend(&pool, &ada, &bo_code).await;
    assert_eq!(next_text(&mut wa, 3).await, r#"{"type":"friends"}"#);
    assert_eq!(next_text(&mut wb, 3).await, r#"{"type":"friends"}"#);
    call(&pool, "DELETE", &format!("/friends/{ada_id}"), Some(&bo)).await;
    assert_eq!(next_text(&mut wa, 3).await, r#"{"type":"friends"}"#);
    assert_eq!(next_text(&mut wb, 3).await, r#"{"type":"friends"}"#);
}

#[tokio::test]
async fn ws_closes_without_a_valid_token() {
    let (pool, _node) = db().await;
    let addr = serve(&pool).await;
    let mut bad = connect(&addr, Some("not a token")).await;
    assert_closes_within(&mut bad, 3).await;
    // Nothing sent: the server gives up after 5 s.
    let mut silent = connect(&addr, None).await;
    assert_closes_within(&mut silent, 8).await;
}

#[tokio::test]
async fn ws_pushes_renames_to_friends_and_me_to_the_user() {
    let (pool, _node) = db().await;
    let addr = serve(&pool).await;
    let (ada, _, _) = sign_up(&pool, "Ada").await;
    let (bo, _, bo_code) = sign_up(&pool, "Bo").await;
    add_friend(&pool, &ada, &bo_code).await;
    let (mut wa, mut wb) = (listen_as(&addr, &ada).await, listen_as(&addr, &bo).await);
    send(&pool, "PATCH", "/me", &ada, serde_json::json!({ "display_name": "Adele" })).await;
    assert_eq!(next_text(&mut wb, 3).await, r#"{"type":"friends"}"#);
    assert_eq!(next_text(&mut wa, 3).await, r#"{"type":"me"}"#);
    // A new friend code concerns only the owner.
    call(&pool, "POST", "/me/friend-code", Some(&ada)).await;
    assert_eq!(next_text(&mut wa, 3).await, r#"{"type":"me"}"#);
    assert!(tokio::time::timeout(Duration::from_millis(500), wb.next()).await.is_err(), "Bo should hear nothing");
}

#[tokio::test]
async fn ws_closes_when_the_token_expires() {
    let (pool, _node) = db().await;
    let addr = serve(&pool).await;
    let in_two_seconds = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() + 2;
    let t = token_exp(Uuid::new_v4(), "ada@x.com", Some("Ada"), in_two_seconds);
    let mut ws = listen_as(&addr, &t).await;
    assert_closes_within(&mut ws, 5).await;
}

#[tokio::test]
async fn purge_notifies_friends() {
    let (pool, _node) = db().await;
    let addr = serve(&pool).await;
    let (ada, ada_id, _) = sign_up(&pool, "Ada").await;
    let (bo, _, bo_code) = sign_up(&pool, "Bo").await;
    add_friend(&pool, &ada, &bo_code).await;
    let mut wb = listen_as(&addr, &bo).await;
    sqlx::query("DELETE FROM users WHERE id = $1").bind(ada_id).execute(&pool).await.unwrap();
    assert_eq!(next_text(&mut wb, 3).await, r#"{"type":"friends"}"#);
}
