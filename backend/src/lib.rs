use axum::{extract::State, http::StatusCode, routing::get, Json, Router};
use serde::Serialize;
use sqlx::PgPool;
use utoipa::{OpenApi, ToSchema};

#[derive(Serialize, ToSchema)]
pub struct Health {
    pub status: &'static str,
}

#[derive(OpenApi)]
#[openapi(paths(health), components(schemas(Health)))]
pub struct ApiDoc;

/// Liveness plus database connectivity check.
#[utoipa::path(get, path = "/health", responses((status = 200, body = Health), (status = 503)))]
async fn health(State(db): State<PgPool>) -> Result<Json<Health>, StatusCode> {
    sqlx::query("SELECT 1").execute(&db).await.map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    Ok(Json(Health { status: "ok" }))
}

async fn openapi() -> Json<utoipa::openapi::OpenApi> {
    Json(ApiDoc::openapi())
}

pub fn app(db: PgPool) -> Router {
    Router::new().route("/health", get(health)).route("/openapi.json", get(openapi)).with_state(db)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request};
    use tower::ServiceExt;

    #[tokio::test]
    async fn openapi_lists_health() {
        // Lazy pool never connects, so no database is needed for unit tests.
        let db = PgPool::connect_lazy("postgres://unused@localhost/unused").unwrap();
        let res = app(db).oneshot(Request::get("/openapi.json").body(Body::empty()).unwrap()).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let body = http_body_util::BodyExt::collect(res.into_body()).await.unwrap().to_bytes();
        assert!(String::from_utf8_lossy(&body).contains("/health"));
    }
}
