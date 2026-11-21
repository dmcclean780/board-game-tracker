use axum::{body::Body, http::{Request, StatusCode}};
use testcontainers_modules::{postgres::Postgres, testcontainers::runners::AsyncRunner};
use tower::ServiceExt;

#[tokio::test]
async fn health_checks_real_postgres() {
    let pg = Postgres::default().start().await.unwrap();
    let url = format!("postgres://postgres:postgres@{}:{}/postgres", pg.get_host().await.unwrap(), pg.get_host_port_ipv4(5432).await.unwrap());
    let db = sqlx::PgPool::connect(&url).await.unwrap();
    sqlx::migrate!("../db/migrations").run(&db).await.unwrap();
    let res = bgt_backend::app(db).oneshot(Request::get("/health").body(Body::empty()).unwrap()).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
}
