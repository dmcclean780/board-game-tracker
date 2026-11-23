# Sessions

Status: implemented, web only. Decision: [ADR 0016](../adr/0016-session-results-jsonb-per-game-crates.md). Rules: [Root results](../business-rules/root-results.md). Terms: Game, Session, Player, Result ([glossary](../../GLOSSARY.md)).

## Purpose

A User records a Session of a Game with a play date, the Players and the Result, then views or deletes it later. Root is the only Game so far.

## Behaviour

All routes need a valid bearer token ([AUTH-14](authentication.md)); otherwise `401`. A User must have called `GET /me` once ([ACC-1](accounts.md)).

- **SES-1** `GET /games` returns the Games that can be recorded, as `[{ id, name }]`; today `[{ "id": "root", "name": "Root" }]`.
  Tests: integration `games_lists_root`
- **SES-2** `POST /sessions` with `{ game, played_on?, notes?, duration_minutes?, players, result }` stores the Session for the caller and returns `201` with it.
  Tests: integration `record_list_view_and_delete_a_session`
- **SES-3** `played_on` defaults to today when omitted.
  Tests: integration `played_on_defaults_to_today`
- **SES-4** `POST /sessions` returns `422` with a plain-text reason, and stores nothing, when the game is unknown, `duration_minutes` is not positive, a player name is blank or repeated, there are no players, or the Result does not pass the Game's rules.
  Tests: integration `invalid_sessions_are_rejected_with_a_message`; core checks: unit `rejects_bad_player_lists_and_results`
- **SES-5** A Root Result passes only if it meets BR-ROOT-001 to BR-ROOT-005.
  Tests: unit in `backend/games/root` (`points_victory`, `points_victory_needs_30`, `dominance_victory_ignores_score`, `needs_exactly_one_winner`, `duplicate_factions_only_for_vagabonds`, `two_vagabonds_may_share_a_coalition_partner`, `bad_coalitions`, `result_must_match_players`)
- **SES-6** `GET /sessions` returns the caller's Sessions, newest play date first.
  Tests: integration `record_list_view_and_delete_a_session`
- **SES-7** `GET /sessions/{id}` and `DELETE /sessions/{id}` return `404` for a Session that does not exist or belongs to another User; `DELETE` returns `204` otherwise.
  Tests: integration `sessions_are_private_to_their_recorder`, `record_list_view_and_delete_a_session`
- **SES-8** Deleting a User row (the purge, [ACC-8](accounts.md)) deletes their Sessions.
  Tests: integration `purging_a_user_removes_their_sessions`
- **SES-9** The home screen lists the User's Sessions as "<date> · <game> · Won by <winners>", or "No sessions yet.", and opens one when pressed.
  Tests: jest `lists recorded sessions with their winners`, `greets the user and shows the empty state`; e2e `record a Root session, view it and delete it`
- **SES-10** "Record session" opens a form for the play date, optional duration and notes, and the Game's own form; "Save session" sends it and returns home, and a `422` reason is shown as an error.
  Tests: e2e `record a Root session, view it and delete it`, `an invalid Root result shows the server's message`
- **SES-11** The Root form takes, per Player, a name, faction, score and winner flag, and a coalition partner only when the faction is Vagabond; the victory type is Points or Dominance.
  Tests: jest `reports players and Root result as they are typed`, `only a Vagabond can pick a coalition partner`
- **SES-12** A Session screen shows the date, Game, Result, duration and notes; "Delete session" asks for confirmation, then deletes and returns home.
  Tests: e2e `record a Root session, view it and delete it`

## Interfaces

| Route | Success | Other |
|---|---|---|
| `GET /games` | `200` `[GameInfo]` | `401` |
| `POST /sessions` | `201` `Session` | `401`, `422`, `500` |
| `GET /sessions` | `200` `[Session]` | `401`, `500` |
| `GET /sessions/{id}` | `200` `Session` | `401`, `404`, `500` |
| `DELETE /sessions/{id}` | `204` | `401`, `404`, `500` |

Table `sessions(id, owner_id, game, played_on, notes, duration_minutes, players, result, created_at)`, migration `0003_sessions.sql`. Root Result shape: `{ victory: "points"|"dominance", players: { <name>: { faction, score, winner, partner } } }`.

## Not yet

Editing a Session; linking Players to Users and sharing Sessions; other Games; recording a Session before the first `GET /me` (currently `500`); native apps.

## Code

`backend/src/sessions.rs`, `backend/games/core`, `backend/games/root`, `db/migrations/0003_sessions.sql`, `frontend/src/games/`, `frontend/src/app/index.tsx`, `frontend/src/app/sessions/`.
