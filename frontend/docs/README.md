# Frontend

Expo (React Native, TypeScript) for Android, iOS and web (ADR 0002). Read `../AGENTS.md` before touching Expo APIs. Install with `npm install` at the repo root (npm workspaces).

Tests live in `../tests/` (ADR 0010): unit now (`moon run unit:frontend`), Playwright e2e deferred.

Code lives in `src/` (entry `src/index.ts`); `app.json`, `assets/` and config stay at the frontend root as Expo expects.
