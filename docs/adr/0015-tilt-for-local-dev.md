# 15. Tilt for local development

- Status: accepted
- Date: 2026-11-22
- Amends: [0006](0006-moon-github-actions-docker.md)

## Context and problem statement

Running the stack locally took three manual steps: `moon run db:up`, `cargo run` with the `.env` values exported, and `npx expo start`. We want one command that brings up everything for local development. CI, e2e and production are out of scope.

## Decision

- Use **Tilt** (`tilt up` at the repo root). It loads `db/docker-compose.yml` unchanged for Postgres, GoTrue and Mailpit, and runs the backend (`cargo run`) and the Expo dev server on the host as local resources.
- The Tiltfile reads the root `.env` (falling back to `.env.example`) and passes it to both processes, so the backend gains no dotenv code.
- The backend restarts when its source, `Cargo.*` or `db/migrations` change. The frontend waits for the backend's `/health`.
- Tilt is pinned in `.prototools` through an in-repo proto plugin (`.proto/plugins/tilt.toml`), because proto has no built-in Tilt support.
- The moon `db:up` and `dev` tasks stay; CI and e2e still use them.

## Alternatives considered

- Compose plus moon tasks only: no restart on change, no dependency ordering, three terminals.
- Containers for the backend and frontend: needs dev Dockerfiles and slows Rust builds on macOS.
- Local Kubernetes: needs images and manifests, and deployment is still undecided ([0009](0009-deployment.md)).

## Consequences

- Tilt is a new developer tool (installed by `proto install`).
- The Tiltfile is a third place that knows the dev ports, next to the compose file and `frontend/playwright.config.ts`.
- Tests are not part of Tilt for now.
