# Project docs

- [Architecture decisions](adr/README.md)
- [Business rules](business-rules/README.md)
- Component docs: [frontend](../frontend/docs/README.md), [backend](../backend/docs/README.md), [db](../db/docs/README.md)

## Running things

Local Postgres: `moon run db:up` (or `docker compose up -d db` in `db/`), copy `.env.example` to `.env`. Frontend: `cd frontend && npm install`. Tasks via [moon](https://moonrepo.dev): `moon run frontend:test`, `moon run backend:test`, or `moon run :test` for everything. See [ADR 0011](adr/0011-tests-beside-source.md).