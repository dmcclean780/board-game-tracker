# 0017. Game data in a JSON file per Game crate, served by the API

- Status: accepted
- Date: 2026-11-24

## Context and problem statement

Root's factions, maps, decks and landmarks were written twice, as Rust enums (the Result checks) and as TypeScript lists (the form), so each new option or expansion meant two code edits, and Vagabond rules were hard-coded in both.

## Considered options

- Database tables: editable without a deploy, but needs migrations, seeding and an editing screen.
- A data file copied into the frontend at build time: no loading step, but a generated file that can drift.
- A data file in the Game's crate, served by the API.

## Decision

Each Game crate owns a `data.json` (option lists with `id`, `label`, `expansion`, optional `retired`; faction flags `shareable` and `coalition`; rule numbers such as `points_to_win`), embedded with `include_str!`. The crate checks Results against it, and `GET /games/{id}` serves it to the app, which builds its form from it. Ids never change; an entry with `retired: true` is hidden from new Sessions but still understood in old ones. Rule logic stays in Rust.

This replaces the typed enums described in [ADR 0016](0016-session-results-jsonb-per-game-crates.md); the rest of that decision (JSONB Result, one crate per Game) stands.

## Consequences

- Adding an option is one edit to `data.json`; a unit test guards the file's shape.
- Result checks are on string ids at run time instead of compile time, and a typo in `data.json` fails the data test or startup (unknown fields are rejected).
- The form needs a short loading step for the data.
- Changing the data needs a deploy, since the file is compiled into the backend.
