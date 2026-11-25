# Sessions

Status: implemented, web only. Decisions: [ADR 0016](../adr/0016-session-results-jsonb-per-game-crates.md), [ADR 0017](../adr/0017-game-data-in-json-files.md), [ADR 0018](../adr/0018-server-driven-game-forms.md). Rules: [Root results](../business-rules/root-results.md), [Arcs results](../business-rules/arcs-results.md), [Old King's Crown results](../business-rules/old-kings-crown-results.md). Terms: Game, Session, Player, Result ([glossary](../../GLOSSARY.md)).

## Purpose

A User records a Session of a Game with a play date, the Players and the Result, then views or deletes it later. Root, Arcs and Old King's Crown are the Games so far.

## Behaviour

All routes need a valid bearer token ([AUTH-14](authentication.md)); otherwise `401`. A User must have called `GET /me` once ([ACC-1](accounts.md)).

- **SES-1** `GET /games` returns the Games that can be recorded, as `[{ id, name }]`; today Root, Arcs and Old King's Crown (`old-kings-crown`).
  Tests: integration `games_lists_every_game`
- **SES-17** `GET /games/{id}` returns the Game's data file as JSON (for Root: `rules`, `victories`, `factions`, `maps`, `decks`, `landmarks`; for Arcs: `setups`, `leaders`, `lore`; for Old King's Crown: `houses`; for every Game also `form`, which describes the Game's Setup and Players screens, see SES-18), `404` for an unknown Game.
  Tests: integration `a_games_data_is_served_to_signed_in_users`; unit `serves_the_games_data`, `data_file_is_well_formed`, `form_is_well_formed` (each Game)
- **SES-18** The app has no Game-specific code. The Setup and Players screens are built from the Game's `form`: a "Number of players" dropdown from `min_players` to `max_players` (starting at `default_players`), the Game's `setup` fields once, and for every Player a name and the `player` fields, each labelled "Player n <label>". Field types are `select` (dropdown over a data list, `retired` entries hidden, `filter_by_players` keeps entries whose `players` equals the player count and falls back to the first), `multi` (a checkbox per entry), `choice` (checkboxes of which exactly one is ticked), `checkbox`, `number`, `winner`, `repeat` and `player` (SES-29 to SES-31). A field with `when` is shown, and sent, only while that setup checkbox is ticked, and is sent as `null` otherwise. "Loading options…" shows until the data arrives. Lowering and raising the player count keeps what was typed.
  Tests: jest `GameForm.test.tsx` `builds the players and Result from the schema, and reports them once the server accepts`, `lists come from the data: boards follow the player count, retired entries are hidden`, `setup: multi boxes, one-of-many choice and a checkbox that reveals a player field`
- **SES-19** A new Session is rejected with `422` when its map, deck, victory, landmark or faction is not in the data file or is `retired`.
  Tests: unit `map_deck_and_landmarks`, `retired_entries_are_rejected_for_new_sessions`
- **SES-2** `POST /sessions` with `{ game, played_on?, notes?, duration_minutes?, players, result }` stores the Session for the caller and returns `201` with it.
  Tests: integration `record_list_view_and_delete_a_session`
- **SES-3** `played_on` defaults to today when omitted.
  Tests: integration `played_on_defaults_to_today`
- **SES-4** `POST /sessions` returns `422` with a plain-text reason, and stores nothing, when the game is unknown, `duration_minutes` is not positive, a player name is blank or repeated, there are no players, or the Result does not pass the Game's rules.
  Tests: integration `invalid_sessions_are_rejected_with_a_message`; core checks: unit `rejects_bad_player_lists_and_results`
- **SES-5** A Root Result passes only if it meets BR-ROOT-001 to BR-ROOT-006.
  Tests: unit in `backend/games/root` (`points_victory`, `points_victory_needs_30`, `dominance_victory_ignores_score`, `needs_exactly_one_winner`, `duplicate_factions_only_for_vagabonds`, `two_vagabonds_cannot_share_a_partner`, `vagabond_chain_shares_the_win`, `vagabond_pair`, `coalition_loop_is_rejected`, `bad_coalitions`, `coalition_in_points_victory`, `map_deck_and_landmarks`, `homeland_factions`, `result_must_match_players`)
- **SES-6** `GET /sessions` returns the caller's Sessions, newest play date first.
  Tests: integration `record_list_view_and_delete_a_session`
- **SES-7** `GET /sessions/{id}` and `DELETE /sessions/{id}` return `404` for a Session that does not exist or belongs to another User; `DELETE` returns `204` otherwise.
  Tests: integration `sessions_are_private_to_their_recorder`, `record_list_view_and_delete_a_session`
- **SES-8** Deleting a User row (the purge, [ACC-8](accounts.md)) deletes their Sessions.
  Tests: integration `purging_a_user_removes_their_sessions`
- **SES-9** The Results screen lists the User's Sessions as cards, or "No sessions yet.", and opens one when pressed. A card shows the game name and the play date on one row, and below it a gold crown and the winners' names joined with ", " (no crown row when `winners` is empty). The card's accessible name is "<game name>, <date>, won by <winners>". The game name and winners come from the server (SES-27).
  Tests: jest `lists recorded sessions with their winners`, `shows the empty state`; e2e `record a Root session, view it and delete it`
- **SES-10** "Record session" opens a four-screen flow, shown as "Step n of 4", with "Next" and "Back" buttons ("Cancel" on the first): Session, Setup, Players, Save. Session has a Game dropdown listing the Games from `GET /games` (always shown, even with one Game), the play date (the browser's date input on web) and optional duration. Setup and Players are built from the Game's form (SES-18). Save shows a summary, the optional notes and "Save session", which sends it and returns home; a `422` reason is shown as an error. Nothing typed is lost when moving between screens.
  Tests: e2e `record a Root session, view it and delete it`
- **SES-11** `removed`: now SES-18 (Root's Setup screen is its `form`: Map, Deck, Landmarks and the Win condition choice, "30 Points" the default).
  Tests: none
- **SES-15** Ticking one Player's `winner` box clears everyone else's, so only one Player wins in their own right.
  Tests: jest `GameForm.test.tsx` `only one player wins`; e2e `the form explains what is wrong and blocks going on until it is fixed`
- **SES-16** `removed`: now SES-32 (the server's rules are shown, not a copy of them).
  Tests: none
- **SES-13** A `select` or `repeat` field marked `unique` shows an entry another Player holds as "<label> (taken)" and cannot pick it, unless the entry is `shareable` (Vagabond); a new Player starts on the first free entry, and `repeat` (Arcs lore) adds the first free entry with an "Add <label> for player n" button and a "Remove" button on each.
  Tests: jest `GameForm.test.tsx` `a unique option held by another player is marked taken, but a shareable one is not`, `repeat adds the first free entry, never one another player holds, and removes`; e2e `a faction another player holds cannot be picked`
- **SES-14** A `player` field (Root's "coalition with") appears only for a Player whose option in its `via` field has the flag `when_flag`, lists "Nobody" and the other Players, except any already partnered by another Player and any that would make a loop, and is sent as the partner's name or `null`. With a partner, the Player's `shares` field (their `winner` box) is disabled, reads "won (with <partner>)" and follows the partner's (so a chain of partners wins together); the link survives renaming the partner and is dropped when it stops being valid.
  Tests: jest `GameForm.test.tsx` `a linked player shares the partner's win, and the link drops when it stops being valid`, `a partner may itself be linked, and the whole chain wins together`; e2e `a Vagabond coalition wins with its partner`
- **SES-12** A Session screen shows the game name with the date (and duration, when there is one) at the top, then each setup item the server wrote (SES-27) as its title and value, then a line per Player with the name and summary, then notes. A winning Player's line has a gold crown beside the name and a faint gold outline, and its accessible label says "winner". For Root the setup items are Map, Deck, Landmarks (only if any) and Victory, and a Player's summary is faction, score and coalition partner. "Delete session" asks for confirmation, then deletes and returns home.
  Tests: jest `SessionDetail.test.tsx` `shows the game and date, then titled setup, then a line per player`, `marks the winners, and only the winners`; integration `record_list_view_and_delete_a_session`; unit `describes_a_coalition_win` (Root); e2e `record a Root session, view it and delete it`

- **SES-20** `POST /sessions` for Arcs is accepted only when its Result meets BR-ARCS-001 to BR-ARCS-004, and is rejected with `422` otherwise, naming the broken rule.
  Tests: integration `an_arcs_session_is_recorded_and_checked`; unit in `backend/games/arcs` (`a_plain_session_passes`, `needs_two_to_four_players`, `setup_must_exist_and_match_the_player_count`, `needs_exactly_one_winner_with_the_most_power`, `power_is_not_negative_and_players_must_match`, `leaders_are_all_or_none_and_unique`, `lore_is_optional_any_number_and_unique`, `data_file_is_well_formed`)
- **SES-21** `removed`: now SES-18 (Arcs: setup cards by player count, "Play with leaders" checkbox).
  Tests: none
- **SES-22** `removed`: now SES-13, SES-15 and SES-18 (Arcs: power, leader when leaders are on, lore).
  Tests: none
- **SES-23** An Arcs Session screen shows the setup items Setup (the card) and Leaders (Yes or No), and each Player's power, leader and lore; the Results list shows the winner (SES-9).
  Tests: unit `describes_a_session` (Arcs)
- **SES-24** `POST /sessions` for Old King's Crown is accepted only when its Result meets BR-OKC-001 and BR-OKC-002, and is rejected with `422` otherwise, naming the broken rule.
  Tests: integration `an_old_kings_crown_session_is_recorded_and_checked`; unit in `backend/games/old-kings-crown` (`a_plain_session_passes`, `needs_one_to_four_players`, `houses_must_exist_and_be_unique`, `needs_exactly_one_winner_with_the_top_score`, `score_is_not_negative_and_players_must_match`, `data_file_is_well_formed`)
- **SES-25** `removed`: now SES-18 (Old King's Crown: 1 to 4 players, house and score).
  Tests: none
- **SES-26** An Old King's Crown Session screen shows no setup items, and each Player's house and score; the Results list shows the winner (SES-9).
  Tests: unit `describes_a_session` (Old King's Crown)
- **SES-27** `GET /sessions`, `GET /sessions/{id}` and `POST /sessions` return each Session with `game_name`, `winners` (the names of the winning Players) and `details` (`{ setup: [{ title, value }], players: [{ name, summary }] }`, what the Session screen shows; the winner mark comes from `winners`); unknown ids in an old Result show as is, and a Game the server no longer knows gives the id as `game_name` and empty `winners` and `details`.
  Tests: integration `record_list_view_and_delete_a_session`; unit `describes_a_result`
- **SES-28** `POST /games/{id}/check` with `{ players, result }` stores nothing and returns `204` when `POST /sessions` would accept the Result, `422` with the plain-text reason otherwise, `404` for an unknown Game.
  Tests: integration `a_result_can_be_checked_without_storing_it`
- **SES-29** A `number` field sends `0` when empty; a `winner` box is a plain checkbox until a `player` field shares it (SES-14).
  Tests: jest `GameForm.test.tsx` `builds the players and Result from the schema, and reports them once the server accepts`
- **SES-32** The Players screen shows the server's reason from `POST /games/{id}/check` (SES-28), asked about 250 ms after the last edit, and "Next" stays disabled (the Session cannot be saved) until the server accepts; "Could not check the session. Try again." is shown when it cannot be reached.
  Tests: jest `GameForm.test.tsx` `reports nothing and shows the server's reason while the server says no`; e2e `the form explains what is wrong and blocks going on until it is fixed`
- **SES-33** A Game's `form` refers only to lists, setup fields and player fields that exist in its data file; each Game's tests fail otherwise.
  Tests: unit `form_is_well_formed` (Root, Arcs, Old King's Crown)

## Interfaces

| Route | Success | Other |
|---|---|---|
| `GET /games` | `200` `[GameInfo]` | `401` |
| `GET /games/{id}` | `200` data file | `401`, `404` |
| `POST /games/{id}/check` | `204` | `401`, `404`, `422` |
| `POST /sessions` | `201` `Session` | `401`, `422`, `500` |
| `GET /sessions` | `200` `[Session]` | `401`, `500` |
| `GET /sessions/{id}` | `200` `Session` | `401`, `404`, `500` |
| `DELETE /sessions/{id}` | `204` | `401`, `404`, `500` |

Table `sessions(id, owner_id, game, played_on, notes, duration_minutes, players, result, created_at)`, migration `0003_sessions.sql`. Arcs Result shape: `{ setup, leaders: bool, players: { <name>: { power, winner, leader: id|null, lore: [id..] } } }`. Old King's Crown Result shape: `{ players: { <name>: { house: id, score, winner } } }`. Root Result shape: `{ map, deck, landmarks: [..], victory: "points"|"dominance", players: { <name>: { faction, score, winner, partner } } }`.

## Not yet

Editing a Session; linking Players to Users and sharing Sessions; other Games (Arcs is the base game and Leaders & Lore pack only, not The Blighted Reach, and does not model Arcs' tie-breaks; Old King's Crown does not model its tie-breaks or any setup choices); recording a Session before the first `GET /me` (currently `500`); native apps.

## Code

`backend/src/sessions.rs`, `backend/build.rs` (registers every crate in `backend/games/`), `backend/games/core`, `backend/games/root`, `backend/games/arcs` and `backend/games/old-kings-crown` (rules in `src/lib.rs`, options in `data.json`), `db/migrations/0003_sessions.sql`, `frontend/src/games/` (`GameForm.tsx` is the only form), `frontend/src/app/(app)/results.tsx`, `frontend/src/app/(app)/sessions/`.
