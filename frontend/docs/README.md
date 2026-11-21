# Frontend

Expo (React Native, TypeScript) for Android, iOS and web (ADR 0002). Read `../AGENTS.md` before touching Expo APIs. Install with `npm install` in this folder.

Tests live in `tests/`, beside `src/` (Jest + React Native Testing Library): `moon run frontend:test` or `npm test`. Playwright e2e is deferred (ADR 0011).

Code lives in `src/` (entry `src/index.ts`); `app.json`, `assets/` and config stay at the frontend root as Expo expects.
