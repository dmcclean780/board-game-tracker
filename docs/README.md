# Project docs

- [Architecture decisions](adr/README.md)
- [Business rules](business-rules/README.md)
- Component docs: [frontend](../frontend/docs/README.md), [backend](../backend/docs/README.md), [db](../db/docs/README.md)

## Running things

Local Postgres: `docker compose up -d db`, copy `.env.example` to `.env`. Tasks via [moon](https://moonrepo.dev): `moon run backend:test`, `moon run db:test`, `moon run frontend:test`, `moon run frontend:e2e`. Backend and db integration tests need Docker running.
