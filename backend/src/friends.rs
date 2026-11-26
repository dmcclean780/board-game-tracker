use crate::auth::{AppState, AuthUser};
use axum::{extract::{Path, State}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Serialize, FromRow, ToSchema)]
pub struct Friend {
    pub id: Uuid,
    pub display_name: String,
}

#[derive(Deserialize, ToSchema)]
pub struct AddFriend {
    /// A friend code; case, dashes and spaces do not matter.
    pub code: String,
}

const NO_SUCH_CODE: &str = "No user has that friend code.";

/// The signed-in User's Friends, A to Z by display name.
#[utoipa::path(get, path = "/friends", responses((status = 200, body = Vec<Friend>), (status = 401)))]
pub async fn list_friends(State(s): State<AppState>, u: AuthUser) -> Result<Json<Vec<Friend>>, StatusCode> {
    sqlx::query_as(
        "SELECT o.id, o.display_name FROM friendships f
         JOIN users o ON o.id = CASE WHEN f.user_a = $1 THEN f.user_b ELSE f.user_a END
         WHERE $1 IN (f.user_a, f.user_b) ORDER BY lower(o.display_name), o.id",
    )
    .bind(u.id)
    .fetch_all(&s.db)
    .await
    .map(Json)
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

/// Become Friends, for both Users, with whoever owns the friend code.
#[utoipa::path(post, path = "/friends", request_body = AddFriend, responses((status = 201, body = Friend), (status = 401), (status = 422)))]
pub async fn add_friend(State(s): State<AppState>, u: AuthUser, Json(b): Json<AddFriend>) -> Result<(StatusCode, Json<Friend>), (StatusCode, String)> {
    let bad = |m: &str| (StatusCode::UNPROCESSABLE_ENTITY, m.to_owned());
    let fail = |_| (StatusCode::INTERNAL_SERVER_ERROR, String::new());
    let code: String = b.code.chars().filter(|c| c.is_alphanumeric()).flat_map(char::to_uppercase).collect();
    // A User who asked for deletion cannot be added; their existing Friends keep them until the purge.
    let friend: Friend = sqlx::query_as("SELECT id, display_name FROM users WHERE friend_code = $1 AND deletion_requested_at IS NULL")
        .bind(&code)
        .fetch_optional(&s.db)
        .await
        .map_err(fail)?
        .ok_or_else(|| bad(NO_SUCH_CODE))?;
    if friend.id == u.id {
        return Err(bad("That is your own friend code."));
    }
    let added = sqlx::query("INSERT INTO friendships (user_a, user_b) VALUES (LEAST($1::uuid, $2::uuid), GREATEST($1::uuid, $2::uuid)) ON CONFLICT DO NOTHING")
        .bind(u.id)
        .bind(friend.id)
        .execute(&s.db)
        .await
        .map_err(fail)?;
    if added.rows_affected() == 0 {
        return Err(bad(&format!("{} is already your friend.", friend.display_name)));
    }
    Ok((StatusCode::CREATED, Json(friend)))
}

/// End a friendship, for both Users.
#[utoipa::path(delete, path = "/friends/{id}", responses((status = 204), (status = 401), (status = 404)))]
pub async fn remove_friend(State(s): State<AppState>, u: AuthUser, Path(id): Path<Uuid>) -> StatusCode {
    match sqlx::query("DELETE FROM friendships WHERE user_a = LEAST($1::uuid, $2::uuid) AND user_b = GREATEST($1::uuid, $2::uuid)")
        .bind(u.id)
        .bind(id)
        .execute(&s.db)
        .await
    {
        Ok(r) if r.rows_affected() == 1 => StatusCode::NO_CONTENT,
        Ok(_) => StatusCode::NOT_FOUND,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}
