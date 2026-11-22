# 0006. moon, GitHub Actions and Docker for tooling

- Status: accepted (amended by [0013](0013-ci-via-moon-template.md) and [0015](0015-tilt-for-local-dev.md))
- Date: 2026-11-21

## Context and problem statement

We need one way to run tasks locally and in CI.

## Decision

moon defines `test`/`dev` tasks per project; GitHub Actions runs them on PR; docker-compose provides local Postgres.

## Consequences

See the related component docs. Revisit by superseding this ADR with a new one.
