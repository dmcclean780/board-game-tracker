# 0005. Testing strategy

- Status: accepted
- Date: 2026-11-21

## Context and problem statement

Each component needs automated unit and integration tests.

## Decision

Backend: `cargo test` with Testcontainers Postgres. DB: migration/constraint tests on a throwaway Postgres (`db/tests`). Frontend: Jest + RNTL, Playwright on the web build. Integration tests need Docker.

## Consequences

See the related component docs. Revisit by superseding this ADR with a new one.
