# 11. Tests live beside source in each component

- Status: accepted
- Date: 2026-11-21
- Supersedes: [0010](0010-test-layout.md)

## Context and problem statement

A root `tests/` folder separated tests from the code they cover. Frontend tests should sit beside `src`.

## Decision

Each component owns its tests. Frontend: `frontend/src` and `frontend/tests` (Jest + React Native Testing Library). Backend: Rust unit tests in-source in `backend/src`. Each component is a moon project with its own `test` task (`moon run frontend:test`, `moon run backend:test`). The root npm workspace is removed; `frontend` is a plain npm project.

Integration and e2e tests remain deferred; they will go in `<component>/tests/integration` and `<component>/tests/e2e` when re-added.

## Consequences

No single `unit` moon project; run tests per component, or `moon run :test` for all.
