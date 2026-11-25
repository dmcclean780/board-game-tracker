# Backend

Rust, Axum, sqlx (see ADR 0003, 0004, 0007). `src/lib.rs` builds the router; `src/main.rs` runs migrations from `db/migrations` and serves on :3000. Requires `DATABASE_URL` (see `.env.example`).

- Unit tests: in-source in `src/` (`moon run backend:test`), no database.
- Integration tests: `tests/integration`, Testcontainers Postgres, needs Docker (`moon run backend:integration`).
- Game data: each Game crate keeps its option lists and rule numbers in `games/<game>/data.json` (see ADR 0017). To add or rename a Root faction, map, deck or landmark, edit `games/root/data.json` and run `moon run backend:test`; the app picks it up from `GET /games/root`. Never change an `id` (old Sessions use it); set `"retired": true` to stop offering an entry. New rules need Rust in `games/root/src/lib.rs`. The app has no Game-specific code (ADR 0018): the `form` key of `data.json` says which fields the Setup and Players screens show (see `bgt_games::Form`; `check_form` in each crate's tests), and the crate's `summary` and `details` write the text the app displays. To add a Game: a crate with `data.json` and rules, then list it in `src/sessions.rs`.
- OpenAPI spec: `GET /openapi.json`.
- Auth (ADR 0014): also requires `AUTH_URL`, `AUTH_JWT_SECRET`, `AUTH_SERVICE_KEY`. `GET /me` (creates the User), `DELETE /me` and `POST /me/restore` need a bearer token. A daily task in `main.rs` purges Users 30 days after they requested deletion.
