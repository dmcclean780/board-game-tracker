# 0016. Session Results as JSONB, checked by one Rust crate per Game

- Status: accepted
- Date: 2026-11-23

## Context and problem statement

Each Game records a different Result: Root has factions, scores and coalition wins, Ticket to Ride only scores, Pandemic roles and one shared outcome. Adding or changing a Game's format should need little code.

## Considered options

- Tables per Game: strong queries, but every Game needs a migration, endpoints and mapping code.
- Generic per-player rows plus per-Game configuration: little Rust, but rules such as coalition wins do not fit.
- One `sessions` table with the Result as JSONB, checked in Rust by a crate per Game.

## Decision

`sessions.result` is JSONB. Each Game is a crate under `backend/games/` (a Cargo workspace member) that implements the `bgt_games::Game` trait: a serde type for the Result and a `check` function for its rules. The backend lists Games in `backend/src/sessions.rs`. A new Game is a new crate plus one line there and one frontend form. Players are free-text names on the Session, and the Result refers to them by name.

## Consequences

- No migration or new endpoint to add a Game.
- Statistics across Sessions need JSON queries, and old Results must stay readable when a format changes (add fields as optional).
- The database does not enforce Result rules; the Rust crate is the only guard, so all writes go through the API.
- Reversing this means migrating every stored Result into tables.
