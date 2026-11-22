use bgt_backend::{users::purge_expired, AppState, Auth};
use std::time::Duration;

fn env(name: &str) -> String {
    std::env::var(name).unwrap_or_else(|_| panic!("{name} must be set"))
}

#[tokio::main]
async fn main() {
    let db = sqlx::PgPool::connect(&env("DATABASE_URL")).await.expect("database connection failed");
    sqlx::migrate!("../db/migrations").run(&db).await.expect("migrations failed");
    let auth = Auth { url: env("AUTH_URL"), jwt_secret: env("AUTH_JWT_SECRET"), service_key: env("AUTH_SERVICE_KEY"), http: reqwest::Client::new() };

    let (purge_db, purge_auth) = (db.clone(), auth.clone());
    tokio::spawn(async move {
        let mut daily = tokio::time::interval(Duration::from_secs(24 * 60 * 60));
        loop {
            daily.tick().await;
            match purge_expired(&purge_db, &purge_auth).await {
                Ok(n) => println!("purged {n} expired accounts"),
                Err(e) => eprintln!("purge failed: {e}"),
            }
        }
    });

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, bgt_backend::app(AppState { db, auth })).await.unwrap();
}
