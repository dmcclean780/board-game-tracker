use crate::auth::{Auth, AppState, AuthUser};
use axum::{extract::State, http::StatusCode, Json};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use utoipa::ToSchema;
use uuid::Uuid;

/// How long a User who asked to delete their account can still restore it.
pub const GRACE_DAYS: i64 = 30;

#[derive(Serialize, ToSchema)]
pub struct Me {
    pub id: Uuid,
    pub email: String,
    pub display_name: String,
    /// When the account will be permanently deleted, if deletion was requested.
    pub deletion_scheduled_for: Option<DateTime<Utc>>,
    /// What others type to add this User as a Friend: 8 characters, no dash.
    pub friend_code: String,
}

#[derive(FromRow)]
struct Row {
    id: Uuid,
    email: String,
    display_name: String,
    deletion_requested_at: Option<DateTime<Utc>>,
    friend_code: String,
}

/// The signed-in User; created from the token on first call.
#[utoipa::path(get, path = "/me", responses((status = 200, body = Me), (status = 401)))]
pub async fn me(State(s): State<AppState>, u: AuthUser) -> Result<Json<Me>, StatusCode> {
    let r: Row = sqlx::query_as(
        "INSERT INTO users (id, email, display_name) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
         RETURNING id, email, display_name, deletion_requested_at, friend_code",
    )
    .bind(u.id)
    .bind(&u.email)
    .bind(&u.display_name)
    .fetch_one(&s.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(r.into()))
}

impl From<Row> for Me {
    fn from(r: Row) -> Me {
        Me {
            id: r.id,
            email: r.email,
            display_name: r.display_name,
            deletion_scheduled_for: r.deletion_requested_at.map(|t| t + Duration::days(GRACE_DAYS)),
            friend_code: r.friend_code,
        }
    }
}

#[derive(Deserialize, ToSchema)]
pub struct UpdateMe {
    pub display_name: String,
}

/// Change the signed-in User's display name.
#[utoipa::path(patch, path = "/me", request_body = UpdateMe, responses((status = 200, body = Me), (status = 401), (status = 404), (status = 422)))]
pub async fn update_me(State(s): State<AppState>, u: AuthUser, Json(b): Json<UpdateMe>) -> Result<Json<Me>, StatusCode> {
    let name = b.display_name.trim();
    if name.is_empty() {
        return Err(StatusCode::UNPROCESSABLE_ENTITY);
    }
    let r: Option<Row> = sqlx::query_as(
        "UPDATE users SET display_name = $2 WHERE id = $1 RETURNING id, email, display_name, deletion_requested_at, friend_code",
    )
    .bind(u.id)
    .bind(name)
    .fetch_optional(&s.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    r.map(|r| Json(r.into())).ok_or(StatusCode::NOT_FOUND)
}

/// Replace the signed-in User's friend code; the old one stops working and Friends stay.
#[utoipa::path(post, path = "/me/friend-code", responses((status = 200, body = Me), (status = 401), (status = 404)))]
pub async fn new_friend_code(State(s): State<AppState>, u: AuthUser) -> Result<Json<Me>, StatusCode> {
    let r: Option<Row> = sqlx::query_as(
        "UPDATE users SET friend_code = new_friend_code() WHERE id = $1 RETURNING id, email, display_name, deletion_requested_at, friend_code",
    )
    .bind(u.id)
    .fetch_optional(&s.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    r.map(|r| Json(r.into())).ok_or(StatusCode::NOT_FOUND)
}

async fn set_deletion(db: &PgPool, id: Uuid, sql: &str) -> StatusCode {
    match sqlx::query(sql).bind(id).execute(db).await {
        Ok(r) if r.rows_affected() == 1 => StatusCode::NO_CONTENT,
        Ok(_) => StatusCode::NOT_FOUND,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

/// Schedule the account for deletion after the grace period.
#[utoipa::path(delete, path = "/me", responses((status = 204), (status = 401), (status = 404)))]
pub async fn delete_me(State(s): State<AppState>, u: AuthUser) -> StatusCode {
    set_deletion(&s.db, u.id, "UPDATE users SET deletion_requested_at = COALESCE(deletion_requested_at, now()) WHERE id = $1").await
}

/// Cancel a scheduled deletion.
#[utoipa::path(post, path = "/me/restore", responses((status = 204), (status = 401), (status = 404)))]
pub async fn restore_me(State(s): State<AppState>, u: AuthUser) -> StatusCode {
    set_deletion(&s.db, u.id, "UPDATE users SET deletion_requested_at = NULL WHERE id = $1").await
}

/// Permanently delete Users whose grace period is over; returns how many were removed.
/// Safe to run repeatedly or from several instances: provider 404s count as done and the row delete is idempotent.
pub async fn purge_expired(db: &PgPool, auth: &Auth) -> Result<usize, sqlx::Error> {
    let ids: Vec<Uuid> = sqlx::query_scalar("SELECT id FROM users WHERE deletion_requested_at < now() - make_interval(days => $1::int)")
        .bind(GRACE_DAYS as i32)
        .fetch_all(db)
        .await?;
    let mut purged = 0;
    for id in ids {
        let res = auth.http.delete(format!("{}/admin/users/{id}", auth.url)).bearer_auth(&auth.service_key).send().await;
        // Keep the row (and retry tomorrow) unless the provider confirmed the account is gone.
        match res {
            Ok(r) if r.status().is_success() || r.status() == reqwest::StatusCode::NOT_FOUND => {
                sqlx::query("DELETE FROM users WHERE id = $1").bind(id).execute(db).await?;
                purged += 1;
            }
            Ok(r) => eprintln!("purge {id}: provider returned {}", r.status()),
            Err(e) => eprintln!("purge {id}: {e}"),
        }
    }
    Ok(purged)
}
