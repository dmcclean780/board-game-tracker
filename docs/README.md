# Project docs

- [Architecture decisions](adr/README.md)
- [Business rules](business-rules/README.md)
- Component docs: [frontend](../frontend/docs/README.md), [backend](../backend/docs/README.md), [db](../db/docs/README.md)

## Running things

Local Postgres: `docker compose up -d db`, copy `.env.example` to `.env`. Tasks via [moon](https://moonrepo.dev): `moon run backend:test` (unit), `moon run backend-integration:test`, `moon run db-integration:test`, `moon run frontend-unit:test`, `moon run frontend-e2e:test`. Backend and db integration tests need Docker running.
