# Backend

Rust, Axum, sqlx (see ADR 0003, 0004, 0007). `src/lib.rs` builds the router; `src/main.rs` runs migrations from `db/migrations` and serves on :3000. Requires `DATABASE_URL` (see `.env.example`).

- Unit tests: in-source in `src/` (`moon run backend:test`), no database.
- Integration tests: `tests/integration`, Testcontainers Postgres, needs Docker (`moon run backend:integration`).
- OpenAPI spec: `GET /openapi.json`.
