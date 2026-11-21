# Frontend

Expo (React Native, TypeScript) for Android, iOS and web (ADR 0002). Read `../AGENTS.md` before touching Expo APIs.

- Unit tests: `tests/unit/`, Jest + React Native Testing Library (`npm run test:unit`).
- Web end-to-end tests: `tests/e2e/`, Playwright against `expo start --web` (`npm run test:e2e`).
- Deferred: Maestro native E2E once real screens exist.
