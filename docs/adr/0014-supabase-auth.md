# 14. Supabase Auth for sign-in

- Status: accepted
- Date: 2026-11-22
- Supersedes: [0008](0008-authentication.md)

## Context and problem statement

Users must sign in with email and password or Google. MFA or passkeys are wanted only if they do not complicate the system. All Users share one role for now.

## Decision

- Use a managed provider, **Supabase Auth** (GoTrue), for authentication only. The frontend signs in with `@supabase/auth-js`; the backend only verifies the bearer token (HS256, shared `AUTH_JWT_SECRET`) and keeps its own `users` table, created on the first `GET /me`.
- Open sign-up; email accounts must verify their email. The same email through password and Google is one User (the provider links them).
- **MFA and passkeys are deferred.** Even with the provider, they need our own enrol and challenge screens, so they fail the "no custom code" bar for now.
- Account deletion is soft: `DELETE /me` schedules it, signing in shows a restore prompt, and a daily task inside the backend permanently deletes accounts after 30 days.
- Dev and CI run GoTrue and Mailpit from `db/docker-compose.yml`, so tests never touch the hosted free tier. Google sign-in is tested manually only.
- Web only for now; native Google sign-in comes later.

## Consequences

- Token verification uses a shared secret. Switch to JWKS if the hosted project uses asymmetric signing keys.
- CORS is open to any origin until deployment (ADR 0009) is decided.
- The backend needs `AUTH_URL`, `AUTH_JWT_SECRET` and `AUTH_SERVICE_KEY`; the app reads `EXPO_PUBLIC_AUTH_URL`, `EXPO_PUBLIC_API_URL` and, for the hosted provider, `EXPO_PUBLIC_AUTH_ANON_KEY`.
- Roles and rights are not modelled yet.
