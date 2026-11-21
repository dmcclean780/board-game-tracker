# Tests

All test code lives here, grouped by type. Each type is a moon project.

| Type | Location | Run |
|---|---|---|
| unit | `tests/unit` (frontend Jest) + in-source Rust tests in `backend/src` | `moon run unit:test` |
| integration | deferred (backend + migrations on Testcontainers Postgres) | — |
| e2e | deferred (Playwright on the web build) | — |

See [ADR 0010](../docs/adr/0010-test-layout.md).
