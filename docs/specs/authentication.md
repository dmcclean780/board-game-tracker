# Authentication

Status: implemented, web only. Decision: [ADR 0014](../adr/0014-supabase-auth.md). Setup: [runbook](../runbooks/auth-setup.md).

## Purpose

People identify themselves with an email and password or a Google account. Sign-in is handled by Supabase Auth (GoTrue); the backend only verifies the token it issues.

## Behaviour

- **AUTH-1** Anyone can create an account with a display name, email and password.
  Tests: e2e `sign up, verify email, sign out and sign back in`
- **AUTH-2** The display name is required; submitting without one shows "Enter a display name" and sends nothing.
  Tests: none
- **AUTH-3** After sign-up the screen says to check the email, and a verification link is sent.
  Tests: e2e `sign up, verify email, sign out and sign back in`
- **AUTH-4** An account whose email is not verified cannot sign in; the error "Email not confirmed" is shown.
  Tests: e2e `unverified email cannot sign in`
- **AUTH-5** Opening the verification link signs the user in and shows the Results screen.
  Tests: e2e `sign up, verify email, sign out and sign back in`
- **AUTH-6** Signing in with a wrong email or password shows the provider's error and stays on the login screen.
  Tests: e2e `wrong password is rejected`
- **AUTH-7** "Sign in with Google" sends the user to Google and back to the app's own origin, signed in. A first Google sign-in creates a User named after the Google profile.
  Tests: none (manual, see runbook Part 3)
- **AUTH-8** The same email used with a password and with Google is one User (the provider links them).
  Tests: none (manual, see runbook Part 3)
- **AUTH-9** "Forgot password?" asks for an email and, if the provider accepts the request, always shows "If that email has an account, a reset link is on its way." It does not reveal whether the email exists. Provider errors (for example a rate limit) are shown instead.
  Tests: e2e `reset a forgotten password`
- **AUTH-10** The reset link opens `/reset-password`, signs the user in, and lets them choose a new password; saving it goes to the Results screen. Afterwards the new password works and the old one does not.
  Tests: e2e `reset a forgotten password` (new password works); old password rejection: none
- **AUTH-11** Opening `/reset-password` without a session shows "This reset link is invalid or has expired."
  Tests: none
- **AUTH-12** Sign out ends the session and shows the login screen.
  Tests: e2e `sign up, verify email, sign out and sign back in`
- **AUTH-13** A session persists across page reloads and refreshes its token automatically (browser local storage).
  Tests: none
- **AUTH-14** The backend accepts a request only with `Authorization: Bearer <token>` where the token is signed with the shared secret (HS256), has audience `authenticated`, is not expired, and carries a `sub` (UUID) and a non-empty `email`. Anything else is `401`.
  Tests: integration `me_requires_a_valid_token` (missing, garbage and wrong-secret tokens); expiry, audience and missing email: none
- **AUTH-15** A User's display name is the first non-blank of the token's `display_name`, `full_name`, `name`; otherwise the part of the email before `@`.
  Tests: unit `auth::tests::display_name_prefers_explicit_then_google_then_email`
- **AUTH-16** All Users have the same role; no endpoint distinguishes between them.
  Tests: none

## Interfaces

Screens: `/login`, `/sign-up`, `/forgot-password`, `/reset-password` ([app-shell.md](app-shell.md)). Backend: bearer token on every `/me` route ([accounts.md](accounts.md)). Provider URLs and keys come from `AUTH_URL`, `AUTH_JWT_SECRET`, `AUTH_SERVICE_KEY`, `EXPO_PUBLIC_AUTH_URL`, `EXPO_PUBLIC_AUTH_ANON_KEY`.

## Not yet

MFA and passkeys; native iOS and Android sign-in; roles and rights; JWKS (asymmetric) token verification; password rules beyond the provider's defaults.

## Code

`frontend/src/auth.tsx`, `frontend/src/app/{login,sign-up,forgot-password,reset-password}.tsx`, `backend/src/auth.rs`, `db/docker-compose.yml` (local GoTrue and Mailpit).
