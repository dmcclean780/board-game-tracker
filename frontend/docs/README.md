# Frontend

Expo (React Native, TypeScript) for Android, iOS and web (ADR 0002). Read `../AGENTS.md` before touching Expo APIs. Install with `npm install` in this folder.

Tests live in `tests/`, beside `src/` (Jest + React Native Testing Library): `moon run frontend:test` or `npm test`. Playwright e2e (ADR 0012): `moon run db:up`, then `moon run frontend:e2e`; it builds the web export and starts the backend itself.

Code lives in `src/`: Expo Router screens in `src/app/` (entry `expo-router/entry`), auth in `src/auth.tsx`; `app.json`, `assets/` and config stay at the frontend root as Expo expects.

Sign-in uses Supabase Auth (ADR 0014); the local auth server and mail catcher come from `moon run db:up`. Web only for now. Google sign-in needs a Google OAuth client configured on the auth server (`GOOGLE_ENABLED`, `GOOGLE_CLIENT_ID`, `GOOGLE_SECRET`) and is tested manually.
