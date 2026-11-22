# 13. CI runs moon through one shared action

- Status: accepted
- Date: 2026-11-22
- Amends: [0006](0006-moon-github-actions-docker.md)

## Context and problem statement

CI ran raw commands in three jobs that each repeated toolchain setup, and drifted from the moon tasks developers run locally.

## Decision

- CI only runs `moon ci`, through the composite action `.github/actions/moon`. `ci.yml` uses it with variables only (`name`, `targets`, `cargo-tools`).
- moon (via proto, `.prototools` and `.moon/toolchain.yml`) installs Node and Rust, so the template has no language-specific steps.
- e2e Postgres comes from the `db:up` task, a dependency of `frontend:e2e`, not a GitHub service container.
- CI runs one matrix job per project (`backend`, `frontend`), each using the action with its own `name` and `targets`. The template runs each target as a separate `moon ci` in its own log group, so every suite runs and reports even if an earlier one fails. `moon ci` still skips targets with no affected files.
- Suites publish JUnit results and lcov coverage under `<project>/reports/<suite>/` through `*-ci` moon tasks (plain `test`/`integration`/`e2e` stay for local use). The template shows them in the job summary and uploads them as artifacts. e2e publishes results only; there is no e2e coverage.

## Consequences

Local and CI runs use the same tasks. Backend coverage needs `cargo-llvm-cov` and `cargo-nextest` in CI only.
