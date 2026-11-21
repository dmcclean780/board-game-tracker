# Database

PostgreSQL. Migrations in `migrations/` (sqlx format `NNNN_name.sql`), applied by the backend at startup. `0001_players.sql` is a placeholder.

Tests: migration and constraint tests are deferred and will live in `db/tests/integration` (ADR 0011).
