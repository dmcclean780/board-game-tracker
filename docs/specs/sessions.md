# Sessions

Status: implemented, web only. Decisions: [ADR 0016](../adr/0016-session-results-jsonb-per-game-crates.md), [ADR 0017](../adr/0017-game-data-in-json-files.md). Rules: [Root results](../business-rules/root-results.md). Terms: Game, Session, Player, Result ([glossary](../../GLOSSARY.md)).

## Purpose

A User records a Session of a Game with a play date, the Players and the Result, then views or deletes it later. Root is the only Game so far.

## Behaviour

All routes need a valid bearer token ([AUTH-14](authentication.md)); otherwise `401`. A User must have called `GET /me` once ([ACC-1](accounts.md)).

- **SES-1** `GET /games` returns the Games that can be recorded, as `[{ id, name }]`; today `[{ "id": "root", "name": "Root" }]`.
  Tests: integration `games_lists_root`
- **SES-17** `GET /games/{id}` returns the Game's data file as JSON (for Root: `rules`, `victories`, `factions`, `maps`, `decks`, `landmarks`), `404` for an unknown Game.
  Tests: integration `a_games_data_is_served_to_signed_in_users`; unit `serves_the_games_data`, `data_file_is_well_formed`
- **SES-18** The Root form builds its Map, Deck, Landmark, Faction and win-condition options from that data, hides entries marked `retired`, uses the data's `shareable` and `coalition` flags and `points_to_win`, and shows "Loading Root options…" until the data arrives. The Session screen labels ids from the data and shows an id as is when it is no longer in the data.
  Tests: jest `options come from the data file: a new entry appears and a retired one does not`, `the points target and the faction flags come from the data`, `waits for the game's data before showing the form`
- **SES-19** A new Session is rejected with `422` when its map, deck, victory, landmark or faction is not in the data file or is `retired`.
  Tests: unit `map_deck_and_landmarks`, `retired_entries_are_rejected_for_new_sessions`
- **SES-2** `POST /sessions` with `{ game, played_on?, notes?, duration_minutes?, players, result }` stores the Session for the caller and returns `201` with it.
  Tests: integration `record_list_view_and_delete_a_session`
- **SES-3** `played_on` defaults to today when omitted.
  Tests: integration `played_on_defaults_to_today`
- **SES-4** `POST /sessions` returns `422` with a plain-text reason, and stores nothing, when the game is unknown, `duration_minutes` is not positive, a player name is blank or repeated, there are no players, or the Result does not pass the Game's rules.
  Tests: integration `invalid_sessions_are_rejected_with_a_message`; core checks: unit `rejects_bad_player_lists_and_results`
- **SES-5** A Root Result passes only if it meets BR-ROOT-001 to BR-ROOT-006.
  Tests: unit in `backend/games/root` (`points_victory`, `points_victory_needs_30`, `dominance_victory_ignores_score`, `needs_exactly_one_winner`, `duplicate_factions_only_for_vagabonds`, `two_vagabonds_may_share_a_coalition_partner`, `bad_coalitions`, `coalition_needs_dominance`, `map_deck_and_landmarks`, `homeland_factions`, `result_must_match_players`)
- **SES-6** `GET /sessions` returns the caller's Sessions, newest play date first.
  Tests: integration `record_list_view_and_delete_a_session`
- **SES-7** `GET /sessions/{id}` and `DELETE /sessions/{id}` return `404` for a Session that does not exist or belongs to another User; `DELETE` returns `204` otherwise.
  Tests: integration `sessions_are_private_to_their_recorder`, `record_list_view_and_delete_a_session`
- **SES-8** Deleting a User row (the purge, [ACC-8](accounts.md)) deletes their Sessions.
  Tests: integration `purging_a_user_removes_their_sessions`
- **SES-9** The home screen lists the User's Sessions as "<date> · <game> · Won by <winners>", or "No sessions yet.", and opens one when pressed.
  Tests: jest `lists recorded sessions with their winners`, `greets the user and shows the empty state`; e2e `record a Root session, view it and delete it`
- **SES-10** "Record session" opens a four-screen flow, shown as "Step n of 4", with "Next" and "Back" buttons ("Cancel" on the first): Session, Setup, Players, Save. Session has a Game dropdown (always shown, even with one Game), the play date (the browser's date input on web) and optional duration. Setup and Players belong to the Game. Save shows a summary, the optional notes and "Save session", which sends it and returns home; a `422` reason is shown as an error. Nothing typed is lost when moving between screens.
  Tests: e2e `record a Root session, view it and delete it`; jest `shows one step at a time and keeps what was typed between steps`
- **SES-11** For Root, the Setup screen has a "Setup" section with a Map dropdown, a Deck dropdown (defaults Autumn and Standard) and Landmark checkboxes (any number), and a "Win condition" section with "30 Points" and "Dominance" checkboxes: one is always ticked, ticking one unticks the other, and "30 Points" is the default. The Players screen has one card per Player with a name, a "won" checkbox, a faction dropdown and a score, and a "Remove player" button on each card. A new Player starts on a faction no other Player holds. The options come from the Game's data file (SES-18).
  Tests: jest `reports players and a points Result once the form is valid`, `a dominance victory needs no points`, `reports the map, deck and any number of landmarks`, `30 Points and Dominance exclude each other, and one is always chosen`, `offers the Exiles and Partisans deck and the Homeland options`; e2e `record a Root session, view it and delete it`
- **SES-15** Ticking one Player's "won" box clears everyone else's, so only one Player wins in their own right.
  Tests: jest `only one player can be marked as having won`; e2e `the form explains what is wrong and blocks going on until it is fixed`
- **SES-16** The Players screen shows the first rule the Session breaks and disables "Next" (so the Session cannot be saved) until none is broken: every Player has a different name, exactly one Player won, a Points victory has a winner with at least 30 points, and no score is negative.
  Tests: jest `explains what is wrong and reports nothing until it is fixed`; e2e `the form explains what is wrong and blocks going on until it is fixed`
- **SES-13** In the faction dropdown, a faction held by another Player is shown as "<faction> (taken)" and cannot be picked; Vagabond is never taken.
  Tests: jest `a faction held by another player cannot be picked, except Vagabond`; e2e `a faction another player holds cannot be picked`
- **SES-14** The "coalition with" dropdown appears only for a Vagabond Player in a Dominance victory, listing "Nobody" and the other non-Vagabond Players. With a partner, the Vagabond's won checkbox is disabled, reads "won (with <partner>)" and follows the partner's; the link survives renaming the partner, and is dropped if "Won by dominance" is unticked or either Player's faction changes so it is no longer valid.
  Tests: jest `coalitions exist only for a Vagabond in a dominance victory`, `a coalition Vagabond wins with their partner, and keeps them when renamed`, `leaving dominance or Vagabond drops the coalition`; e2e `a Vagabond coalition wins with its partner`
- **SES-12** A Session screen shows the date, Game, Result (for Root: map, deck, landmarks, victory and each Player), duration and notes; "Delete session" asks for confirmation, then deletes and returns home.
  Tests: e2e `record a Root session, view it and delete it`

## Interfaces

| Route | Success | Other |
|---|---|---|
| `GET /games` | `200` `[GameInfo]` | `401` |
| `POST /sessions` | `201` `Session` | `401`, `422`, `500` |
| `GET /sessions` | `200` `[Session]` | `401`, `500` |
| `GET /sessions/{id}` | `200` `Session` | `401`, `404`, `500` |
| `DELETE /sessions/{id}` | `204` | `401`, `404`, `500` |

Table `sessions(id, owner_id, game, played_on, notes, duration_minutes, players, result, created_at)`, migration `0003_sessions.sql`. Root Result shape: `{ map, deck, landmarks: [..], victory: "points"|"dominance", players: { <name>: { faction, score, winner, partner } } }`.

## Not yet

Editing a Session; linking Players to Users and sharing Sessions; other Games; recording a Session before the first `GET /me` (currently `500`); native apps.

## Code

`backend/src/sessions.rs`, `backend/games/core`, `backend/games/root` (rules in `src/lib.rs`, options in `data.json`), `db/migrations/0003_sessions.sql`, `frontend/src/games/`, `frontend/src/app/index.tsx`, `frontend/src/app/sessions/`.
