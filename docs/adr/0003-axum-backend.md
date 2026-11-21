# 0003. Rust backend on Axum

- Status: accepted
- Date: 2026-11-21

## Context and problem statement

The backend must be written in Rust.

## Decision

Axum on Tokio. Integration tests drive the router in-process with `tower::ServiceExt` against a real Postgres.

## Consequences

See the related component docs. Revisit by superseding this ADR with a new one.
