# 0004. PostgreSQL with sqlx

- Status: accepted
- Date: 2026-11-21

## Context and problem statement

We need a SQL database and a Rust data-access approach.

## Decision

PostgreSQL, accessed with sqlx. Plain SQL migrations live in `db/migrations` and are embedded by the backend via `sqlx::migrate!`.

## Consequences

See the related component docs. Revisit by superseding this ADR with a new one.
