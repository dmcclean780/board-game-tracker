# Database

PostgreSQL. Migrations in `migrations/` (sqlx format `NNNN_name.sql`), applied by the backend at startup. `0001_players.sql` is a placeholder.

Tests: migration and constraint tests are deferred and will live in `db/tests/integration` (ADR 0011).

Local dev: `moon run db:up` starts Postgres 17 from `docker-compose.yml` in this folder (credentials match `.env.example`).

`moon run db:up` also starts the local auth stack (ADR 0014): `auth` (Supabase's GoTrue, :9999, in its own `auth` schema, created by the idempotent `auth-init` service from `init-auth.sql`) and `mailpit` (:8025 web UI and API, :1025 SMTP) which catches verification and reset emails. `0002_users.sql` adds `users`.
