# Frontend

Expo (React Native, TypeScript) for Android, iOS and web (ADR 0002). Read `../AGENTS.md` before touching Expo APIs.

- Unit tests: `__tests__/`, Jest + React Native Testing Library (`npm test`).
- Web integration tests: `e2e/`, Playwright against `expo start --web` (`npm run test:e2e`).
- Deferred: Maestro native E2E once real screens exist.
