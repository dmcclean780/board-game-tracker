# 0005. Testing strategy

- Status: accepted
- Date: 2026-11-21

## Context and problem statement

Each component needs automated unit and integration tests.

## Decision

Each test type is its own project under `<component>/tests/<type>/` (own manifest and moon project). Backend: Rust unit tests stay in-source (`src/`); `tests/integration` runs against Testcontainers Postgres. DB: `tests/integration` applies migrations to a throwaway Postgres and checks constraints. Frontend: `tests/unit` (Jest + RNTL) and `tests/e2e` (Playwright on the web build). Docker is required for integration tests.

## Consequences

See the related component docs. Revisit by superseding this ADR with a new one.
