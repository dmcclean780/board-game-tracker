# Project docs

- [Architecture decisions](adr/README.md)
- [Business rules](business-rules/README.md)
- Component docs: [frontend](../frontend/docs/README.md), [backend](../backend/docs/README.md), [db](../db/docs/README.md)

## Running things

Local Postgres: `docker compose up -d db`, copy `.env.example` to `.env`. Install deps with `npm install` at the root. Tasks via [moon](https://moonrepo.dev): `moon run unit:test` runs all unit tests (`unit:backend`, `unit:frontend` individually). See [tests/README.md](../tests/README.md).