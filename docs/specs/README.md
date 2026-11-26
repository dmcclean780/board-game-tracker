# Specs

One file per feature area describing what the system **does today**: behaviour, interfaces, errors, and the tests that prove it. They are kept in step with the code (see `CLAUDE.md`).

| Spec | Covers |
|---|---|
| [authentication.md](authentication.md) | Sign-up, email verification, sign-in (email and Google), password reset, sign-out, token checks |
| [accounts.md](accounts.md) | The User record, `/me`, account deletion, restore, purge |
| [sessions.md](sessions.md) | Recording, listing, viewing and deleting Game Sessions and their Results (Root, Arcs) |
| [friends.md](friends.md) | Friend codes, adding and removing Friends, the Friends screen |
| [app-shell.md](app-shell.md) | Screen routing, auth gate, header, footer, sections |
| [platform.md](platform.md) | `/health`, OpenAPI, CORS, configuration |
| [local-dev.md](local-dev.md) | `tilt up`: the local development stack |

## How specs relate to other docs

- **ADRs** (`../adr`) record why a decision was made. Specs record what the result is.
- **Business rules** (`../business-rules`) hold domain rules with `BR-` IDs. A spec links to the rule instead of restating it.
- **Runbooks** (`../runbooks`) are operational steps.

## Format

Each spec has: **Purpose**, **Behaviour** (numbered requirements `<AREA>-<n>`, one testable sentence each, with their tests), **Interfaces**, **Not yet** (deferred or out of scope), and **Code**. Requirement IDs are never reused; delete a requirement by marking it `removed`. A requirement with no test says `Tests: none`, so gaps are visible.
