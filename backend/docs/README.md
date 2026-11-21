# Backend

Rust, Axum, sqlx (see ADR 0003, 0004, 0007). `src/lib.rs` builds the router; `src/main.rs` runs migrations from `db/migrations` and serves on :3000.

- Unit tests: in `src/` (`cargo test -p bgt-backend --lib`), no database.
- Integration tests: `tests/`, real Postgres via Testcontainers (needs Docker).
- OpenAPI spec: `GET /openapi.json`.
