use axum::{extract::FromRequestParts, http::{header::AUTHORIZATION, request::Parts, StatusCode}};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub auth: Auth,
}

/// Connection to the auth provider (Supabase Auth / GoTrue).
#[derive(Clone)]
pub struct Auth {
    pub url: String,
    // shortcut: HS256 shared secret only, because local GoTrue has no JWKS; add JWKS verification if the cloud project uses asymmetric signing keys.
    pub jwt_secret: String,
    pub service_key: String,
    pub http: reqwest::Client,
}

/// The signed-in caller, taken from a verified bearer token.
pub struct AuthUser {
    pub id: Uuid,
    pub email: String,
    pub display_name: String,
}

#[derive(Deserialize)]
struct Claims {
    sub: Uuid,
    email: Option<String>,
    #[serde(default)]
    user_metadata: Meta,
}

#[derive(Deserialize, Default)]
struct Meta {
    display_name: Option<String>,
    full_name: Option<String>,
    name: Option<String>,
}

/// Email sign-ups send `display_name`; Google sends `full_name`/`name`; fall back to the email's local part.
fn display_name(meta: Meta, email: &str) -> String {
    [meta.display_name, meta.full_name, meta.name]
        .into_iter()
        .flatten()
        .map(|n| n.trim().to_owned())
        .find(|n| !n.is_empty())
        .unwrap_or_else(|| email.split('@').next().unwrap_or(email).to_owned())
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = StatusCode;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, StatusCode> {
        let token = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .ok_or(StatusCode::UNAUTHORIZED)?;
        let mut validation = Validation::new(Algorithm::HS256);
        validation.set_audience(&["authenticated"]);
        let claims = decode::<Claims>(token, &DecodingKey::from_secret(state.auth.jwt_secret.as_bytes()), &validation)
            .map_err(|_| StatusCode::UNAUTHORIZED)?
            .claims;
        let email = claims.email.filter(|e| !e.is_empty()).ok_or(StatusCode::UNAUTHORIZED)?;
        Ok(AuthUser { id: claims.sub, display_name: display_name(claims.user_metadata, &email), email })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn meta(d: Option<&str>, f: Option<&str>, n: Option<&str>) -> Meta {
        Meta { display_name: d.map(Into::into), full_name: f.map(Into::into), name: n.map(Into::into) }
    }

    #[test]
    fn display_name_prefers_explicit_then_google_then_email() {
        assert_eq!(display_name(meta(Some("Ada"), Some("Ada L"), None), "a@x.com"), "Ada");
        assert_eq!(display_name(meta(None, Some("Ada L"), Some("x")), "a@x.com"), "Ada L");
        assert_eq!(display_name(meta(Some("  "), None, Some("Ada")), "a@x.com"), "Ada");
        assert_eq!(display_name(meta(None, None, None), "ada@x.com"), "ada");
    }
}
