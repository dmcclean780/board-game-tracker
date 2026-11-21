# Database

PostgreSQL. Migrations in `migrations/` (sqlx format `NNNN_name.sql`), applied by the backend at startup. `0001_players.sql` is a placeholder.

Tests: `tests/migrations.rs` applies all migrations to a throwaway Postgres and checks constraints (`moon run db:test`, needs Docker). Add a constraint test with every schema rule that maps to a business rule.
