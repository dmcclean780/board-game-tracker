use axum::{body::Body, http::{Request, StatusCode}};
use http_body_util::BodyExt;
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::time::Duration;
use testcontainers_modules::{postgres::Postgres, testcontainers::{runners::AsyncRunner, ContainerAsync, ImageExt}};
use tower::ServiceExt;

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

async fn get_health(pool: PgPool) -> (StatusCode, String) {
    let res = bgt_backend::app(pool).oneshot(Request::get("/health").body(Body::empty()).unwrap()).await.unwrap();
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
