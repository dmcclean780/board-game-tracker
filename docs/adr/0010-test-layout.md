# 10. Root tests/ folder grouped by test type

- Status: superseded by [0011](0011-tests-beside-source.md)
- Date: 2026-11-21
- Amends: [0005](0005-testing-strategy.md)

## Context and problem statement

Test code scattered across components was hard to find and run by type.

## Decision

All test code lives under a root `tests/<type>/`, each type being its own moon project (`moon run unit:test`). npm workspaces (`frontend`, `tests/unit`) share one lockfile. Rust unit tests stay in-source in `backend/src` (the only `src` folder in the repo); the `unit` project runs them alongside the frontend Jest tests.

Only `tests/unit` exists for now. Integration and e2e tests (Testcontainers Postgres for backend and migrations, Playwright for web) were removed and will return as `tests/integration` and `tests/e2e`.

## Consequences

Docker is not needed to run the current tests. Nothing currently verifies the migrations or the `/health` database check until integration tests return.
