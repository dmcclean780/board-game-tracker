# Local development stack

Status: implemented.

## Purpose

One command that starts everything needed to use the app on a developer machine. Local development only; CI, e2e and production do not use it. Decision: [ADR 0015](../adr/0015-tilt-for-local-dev.md).

## Behaviour

- **DEV-1** `tilt up` at the repo root starts `db`, `auth-init`, `auth` and `mailpit` from `db/docker-compose.yml`, then `backend`, `frontend-install` and `frontend`.
  Tests: none
- **DEV-2** The app is served on http://localhost:8081, the API on http://localhost:3000 and Mailpit on http://localhost:8025.
  Tests: none
- **DEV-3** The backend and the frontend get the values from the root `.env`, or from `.env.example` when `.env` does not exist.
  Tests: none
- **DEV-4** The backend starts only after `auth` is healthy, and the frontend starts only after `frontend-install` has finished and the backend's `/health` answers.
  Tests: none
- **DEV-5** A change to `backend/src`, `backend/Cargo.toml`, `backend/Cargo.lock` or `db/migrations` restarts the backend.
  Tests: none
- **DEV-6** A change to `frontend/package-lock.json` runs `npm install` in `frontend/`.
  Tests: none
- **DEV-7** `tilt down` keeps the database volume, so accounts survive a restart.
  Tests: none

## Interfaces

`tilt up`, `tilt down`. Tilt is installed with `proto install`. Reset the database with `docker compose down -v` in `db/`.

## Not yet

Test runners as Tilt buttons; native device (non-web) workflow; Tilt in CI.

## Code

`Tiltfile`, `.proto/plugins/tilt.toml`, `.prototools`, `db/docker-compose.yml`.
