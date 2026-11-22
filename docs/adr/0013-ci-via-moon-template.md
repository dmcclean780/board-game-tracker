# 13. CI runs moon through one shared template

- Status: accepted
- Date: 2026-11-22
- Amends: [0006](0006-moon-github-actions-docker.md)

## Context and problem statement

CI ran raw commands in three jobs that each repeated toolchain setup, and drifted from the moon tasks developers run locally.

## Decision

- CI only runs `moon ci`, through the reusable workflow `.github/workflows/moon-ci.yml`. `ci.yml` calls it with variables only (`targets`, `rust-cache-workspaces`).
- moon (via proto, `.prototools` and `.moon/toolchain.yml`) installs Node and Rust, so the template has no language-specific steps.
- e2e Postgres comes from the `db:up` task, a dependency of `frontend:e2e`, not a GitHub service container.
- One job runs every affected target, instead of one job per project.

## Consequences

Local and CI runs use the same tasks. Backend integration and e2e share one runner, so wall-clock time is longer than parallel jobs. Splitting into per-project jobs later only means calling the template more than once.
