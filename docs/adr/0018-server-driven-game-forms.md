# 0018. Game forms and Result text are described by the backend

- Status: accepted
- Date: 2026-11-25

## Context and problem statement

Each Game had a hand-written React form, a copy of its rule checks and its own Session-screen text in `frontend/src/games/`, so adding a Game meant writing Rust and React and keeping the two in step.

## Considered options

- A JSON Schema of the Result: standard, but labels, uniqueness and per-Player layout need custom extensions anyway.
- A fixed form (players, score, winner): no per-Game fields.
- A `form` block in the Game's `data.json`, plus server-written text and a dry-run check.

## Decision

The `form` key of each Game's `data.json` (typed as `bgt_games::Form`) lists the setup and per-Player fields with a few generic types (`select`, `multi`, `choice`, `checkbox`, `number`, `winner`, `repeat`, `player`) and flags (`unique`, `filter_by_players`, `blank`, `when`). One `GameForm` in the app renders it and builds the same Result JSON as before. The Game trait gains `summary` and `details`, and Sessions carry `game_name`, `summary` and `details`. `POST /games/{id}/check` runs the Game's rules without storing, so the form shows the server's message instead of copying the rules.

Update 2026-11-25: `summary` ("Won by …") was replaced by `winners` (the winning Players' names), so the Results card can lay out the winner beside a crown.

This extends [ADR 0017](0017-game-data-in-json-files.md); the stored Result is unchanged.

## Consequences

- Adding a Game is backend-only: a crate, a `data.json` with a `form`, and a line in `sessions.rs`.
- A rule the form needs but the schema lacks means a new field type or flag, in Rust and `GameForm.tsx`, not Game code.
- Every edit costs a (debounced) request; offline, the form cannot say whether a Session is valid.
- Root's Add/Remove player buttons became the same "Number of players" dropdown as the other Games.
