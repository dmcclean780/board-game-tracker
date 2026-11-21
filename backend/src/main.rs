#[tokio::main]
async fn main() {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let db = sqlx::PgPool::connect(&url).await.expect("database connection failed");
    sqlx::migrate!("../db/migrations").run(&db).await.expect("migrations failed");
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, bgt_backend::app(db)).await.unwrap();
}
