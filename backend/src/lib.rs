use axum::{extract::State, http::StatusCode, routing::{get, post}, Json, Router};
use serde::Serialize;
use tower_http::cors::CorsLayer;
use utoipa::{OpenApi, ToSchema};

pub mod auth;
pub mod sessions;
pub mod users;

pub use auth::{AppState, Auth};

#[derive(Serialize, ToSchema)]
pub struct Health {
    pub status: &'static str,
}

#[derive(OpenApi)]
#[openapi(paths(health, users::me, users::delete_me, users::update_me, users::restore_me, sessions::list_games, sessions::get_game, sessions::create_session, sessions::list_sessions, sessions::get_session, sessions::delete_session), components(schemas(Health, users::Me, users::UpdateMe, sessions::GameInfo, sessions::Session, sessions::NewSession)))]
pub struct ApiDoc;

/// Liveness plus database connectivity check.
#[utoipa::path(get, path = "/health", responses((status = 200, body = Health), (status = 503)))]
async fn health(State(s): State<AppState>) -> Result<Json<Health>, StatusCode> {
    sqlx::query("SELECT 1").execute(&s.db).await.map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    Ok(Json(Health { status: "ok" }))
}

async fn openapi() -> Json<utoipa::openapi::OpenApi> {
    Json(ApiDoc::openapi())
}

pub fn app(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/openapi.json", get(openapi))
        .route("/me", get(users::me).delete(users::delete_me).patch(users::update_me))
        .route("/me/restore", post(users::restore_me))
        .route("/games", get(sessions::list_games))
        .route("/games/{id}", get(sessions::get_game))
        .route("/sessions", get(sessions::list_sessions).post(sessions::create_session))
        .route("/sessions/{id}", get(sessions::get_session).delete(sessions::delete_session))
        // shortcut: any origin is fine for bearer-token auth; restrict to the app's origin once deployment (ADR 0009) is decided.
        .layer(CorsLayer::permissive())
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request};
    use sqlx::PgPool;
    use tower::ServiceExt;

    #[tokio::test]
    async fn openapi_lists_health() {
        // Lazy pool never connects, so no database is needed for unit tests.
        let db = PgPool::connect_lazy("postgres://unused@localhost/unused").unwrap();
        let auth = Auth { url: String::new(), jwt_secret: "s".into(), service_key: String::new(), http: reqwest::Client::new() };
        let res = app(AppState { db, auth }).oneshot(Request::get("/openapi.json").body(Body::empty()).unwrap()).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let body = http_body_util::BodyExt::collect(res.into_body()).await.unwrap().to_bytes();
        let body = String::from_utf8_lossy(&body);
        assert!(body.contains("/health") && body.contains("/me"));
    }
}
