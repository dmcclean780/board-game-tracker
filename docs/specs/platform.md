# Platform: health, API description, configuration

Status: implemented.

## Purpose

Operational endpoints and the configuration the backend needs to start.

## Behaviour

- **PLAT-1** `GET /health` returns `200` `{"status":"ok"}` when the database answers, and `503` when it does not.
  Tests: integration `health_ok_with_db`, `health_503_when_db_down`
- **PLAT-2** `GET /openapi.json` returns the OpenAPI description, listing `/health` and the `/me` routes.
  Tests: unit `tests::openapi_lists_health`
- **PLAT-3** The backend applies the migrations in `db/migrations` at startup, then serves on port 3000.
  Tests: integration (every test applies the real migrations)
- **PLAT-4** The backend refuses to start if `DATABASE_URL`, `AUTH_URL`, `AUTH_JWT_SECRET` or `AUTH_SERVICE_KEY` is missing.
  Tests: none
- **PLAT-5** Cross-origin requests from any origin are allowed (bearer tokens, no cookies).
  Tests: none (covered indirectly by the e2e run, which calls the API from another origin)
- **PLAT-6** `players` rejects a blank name. It is a placeholder table with no routes.
  Tests: integration `players_rejects_blank_name`

## Interfaces

`GET /health`, `GET /openapi.json`. Environment: see `.env.example`.

## Not yet

Restricting CORS to the app's origin (waits for deployment, [ADR 0009](../adr/0009-deployment.md)); metrics and structured logging.

## Code

`backend/src/lib.rs`, `backend/src/main.rs`, `db/migrations/`.
