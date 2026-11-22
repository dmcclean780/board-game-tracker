# Runbook: auth provider and Google sign-in

Background: [ADR 0014](../adr/0014-supabase-auth.md). Two environments, kept apart on purpose:

| | Local / CI | Hosted |
|---|---|---|
| Auth server | GoTrue container (`db/docker-compose.yml`) | Supabase project |
| Email | Mailpit (http://localhost:8025) | Supabase mailer or your SMTP |
| Google | optional dev OAuth client (Part 3) | production OAuth client (Part 1 and 2) |
| Counts against Supabase free tier | **never** | yes |

Never point local dev or tests at the hosted project: that is what uses up its monthly sign-ins and email sends.

## Part 1: Create the Supabase project (hosted)

1. Create a project at https://supabase.com/dashboard. Note the project ref (`<ref>` below). You only use its **Authentication** features; ignore the database and storage.
2. **Authentication > Sign In / Providers > Email**: enable it and keep **Confirm email** on.
3. **Authentication > URL Configuration**:
   - Site URL: the app's public URL (for example `https://app.example.com`).
   - Redirect URLs: add `https://app.example.com/**`. The app sends users back to its own origin after email links and Google sign-in, and Supabase rejects anything not listed.
4. **Authentication > Emails > SMTP**: the built-in mailer is heavily rate-limited and meant for trying things out. Add your own SMTP provider before real users sign up.
5. Collect the values the app needs (**Project Settings > API Keys** and **JWT**):

   | Variable | Where it is read | Value |
   |---|---|---|
   | `AUTH_URL` | backend | `https://<ref>.supabase.co/auth/v1` |
   | `AUTH_JWT_SECRET` | backend | the project's JWT secret (HS256) |
   | `AUTH_SERVICE_KEY` | backend | the `service_role` key. **Secret**: server only, never in the app |
   | `EXPO_PUBLIC_AUTH_URL` | app (build time) | same as `AUTH_URL` |
   | `EXPO_PUBLIC_AUTH_ANON_KEY` | app (build time) | the `anon` / publishable key |
   | `EXPO_PUBLIC_API_URL` | app (build time) | the backend's public URL |

   `EXPO_PUBLIC_*` values are baked into the web build, so rebuild (`expo export -p web`) after changing them.

   **Check first:** the backend verifies tokens with the shared HS256 secret (ADR 0014). If the project only offers asymmetric JWT signing keys, there is no shared secret to copy. Either switch the project to the legacy secret or add JWKS verification in `backend/src/auth.rs` (see its `shortcut:` comment).

## Part 2: Google OAuth client

Used by the hosted project. Part 3 reuses the same steps for local.

1. https://console.cloud.google.com > create or pick a project.
2. **Google Auth Platform > Branding / Audience** (the OAuth consent screen): app name, support email, user type **External**. While the app is in **Testing**, only the test users you add can sign in, which is what you want until launch.
3. **Clients > Create client**, type **Web application**:
   - Authorized JavaScript origins: the app's origin (`https://app.example.com`).
   - Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`. This is Supabase's callback, not the app's.
4. Copy the **Client ID** and **Client secret**.
5. Supabase: **Authentication > Sign In / Providers > Google**: enable, paste both, save.
6. Default scopes (`openid`, `email`, `profile`) are enough. The backend takes the display name from the Google profile (`full_name` / `name`).

## Part 3: Test Google sign-in locally (no Supabase usage)

The local GoTrue container is the same open-source server that Supabase runs, so the Google flow runs entirely on your machine. Only Google itself is contacted.

1. Create a **separate dev OAuth client** (Part 2, steps 1 to 4) with:
   - Authorized JavaScript origins: `http://localhost:8081` and `http://localhost:9999`
   - Authorized redirect URI: `http://localhost:9999/callback`
   - Add your own Google account as a test user on the consent screen.
2. Put the credentials in `db/.env` (gitignored; Compose reads it from the `db/` folder):

   ```text
   GOOGLE_ENABLED=true
   GOOGLE_CLIENT_ID=<dev client id>
   GOOGLE_SECRET=<dev client secret>
   ```
3. Recreate the auth container so it picks them up:

   ```text
   cd db && docker compose up -d auth
   ```
4. Run the stack with `tilt up`. If Tilt is already running, `docker compose up -d auth` in `db/` is enough.
5. Open http://localhost:8081, click **Sign in with Google**, choose your test account.

Automated tests never use Google; CI has no credentials and the e2e suite covers email and password only.

### What to check by hand

1. **New Google user**: lands on Home with "Hi, <your Google name>".
2. **One User per email**: create an email and password account with the same address as your Google account (verify it via Mailpit), then sign in with Google. Both should end up as one user:

   ```text
   docker compose exec db psql -U bgt -d bgt -c "select email, raw_app_meta_data->'providers' from auth.users"
   docker compose exec db psql -U bgt -d bgt -c "select id, email, display_name from users"
   ```

   Expect one row in each, with providers `["email","google"]`. If you see two rows, linking is not working and ADR 0014's one-User rule is not met.
3. **Sign out then in again** with Google: same user, same name.
4. **Delete, then sign in with Google**: shows the restore prompt (Scheduled deletion).

### Troubleshooting

| Symptom | Likely cause |
|---|---|
| Google error `redirect_uri_mismatch` | The redirect URI in the Google client is not exactly `http://localhost:9999/callback` |
| Google error `access_denied` / "app not verified" | Your account is not a test user on the consent screen |
| Button does nothing, or "provider is not enabled" | `GOOGLE_ENABLED` not `true`, or the auth container was not recreated after editing `db/.env` |
| Back on the login screen after Google | `http://localhost:8081/**` missing from `GOTRUE_URI_ALLOW_LIST` (set in the compose file) |
| `/me` returns 401 | `AUTH_JWT_SECRET` for the backend differs from the auth server's secret |

## Keeping hosted usage low

- Develop and run all tests against the local stack. Only deploy builds and manual smoke tests should touch the hosted project.
- Check the current free-tier limits on Supabase's pricing page before launch; they change. Sign-ins by monthly active users and emails sent by the built-in mailer are the ones to watch.
- Delete test accounts in the hosted dashboard (**Authentication > Users**) after a smoke test.
