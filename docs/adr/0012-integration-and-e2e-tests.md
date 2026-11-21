# 12. Integration and e2e tests return

- Status: accepted
- Date: 2026-11-21
- Amends: [0011](0011-tests-beside-source.md)

## Context and problem statement

Nothing verified the migrations or the `/health` database check since integration and e2e tests were removed.

## Decision

- Backend: `backend/tests/integration` uses Testcontainers Postgres (needs Docker). `moon run backend:test` runs unit tests only (`cargo test --lib`); `moon run backend:integration` runs the integration tests.
- Frontend: `frontend/tests/e2e` uses Playwright (Chromium) against the static web export (`expo export -p web`) and the real backend. Playwright's `webServer` starts both; Postgres comes from `db/docker-compose.yml` locally (`moon run db:up`) and a service container in CI. `moon run frontend:e2e`. Jest ignores `tests/e2e`.

## Consequences

E2E needs Postgres on :5432 and free ports 3000 and 8081. Mobile-native e2e stays deferred.
