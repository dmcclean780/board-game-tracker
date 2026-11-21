use testcontainers_modules::{postgres::Postgres, testcontainers::{runners::AsyncRunner, ImageExt}};

#[tokio::test]
async fn migrations_apply_and_constraints_hold() {
    let pg = Postgres::default().with_tag("17").start().await.unwrap();
    let url = format!("postgres://postgres:postgres@{}:{}/postgres", pg.get_host().await.unwrap(), pg.get_host_port_ipv4(5432).await.unwrap());
    let db = sqlx::PgPool::connect(&url).await.unwrap();
    sqlx::migrate!("./migrations").run(&db).await.unwrap();

    sqlx::query("INSERT INTO players (name) VALUES ('Ada')").execute(&db).await.unwrap();
    let blank = sqlx::query("INSERT INTO players (name) VALUES ('  ')").execute(&db).await;
    assert!(blank.is_err(), "blank names must be rejected");
}
