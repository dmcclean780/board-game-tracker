# Arcs results

Covers the base game and the Leaders & Lore pack; not The Blighted Reach. Terms: Session, Result ([glossary](../../GLOSSARY.md)).

## BR-ARCS-001 — Players and setup card

- Status: active
- Rule: An Arcs Session has 2 to 4 Players, and its Result names one setup card from `backend/games/arcs/data.json` that is not `retired` and is for exactly that number of players. The Result has exactly one entry for each Player.
- Rationale: Each setup card in the box is made for one player count.
- Enforced in: `backend/games/arcs/src/lib.rs`, `backend/games/arcs/data.json`
- Tests: `needs_two_to_four_players`, `setup_must_exist_and_match_the_player_count`, `power_is_not_negative_and_players_must_match`, `data_file_is_well_formed`

## BR-ARCS-002 — One winner with the most power

- Status: active
- Rule: Each Player has a Power that is not negative. Exactly one Player wins, and no Player has more Power than the winner (a tie is allowed).
- Rationale: Arcs ends in a single victor; ties are broken by rules the app does not model.
- Enforced in: `backend/games/arcs/src/lib.rs`
- Tests: `needs_exactly_one_winner_with_the_most_power`, `power_is_not_negative_and_players_must_match`

## BR-ARCS-003 — Leaders: all or none

- Status: active
- Rule: A Result says whether leaders were used. If so, every Player has a leader and no leader is held twice; if not, no Player has one.
- Rationale: Leaders are an optional mode, and there is one copy of each card.
- Enforced in: `backend/games/arcs/src/lib.rs`
- Tests: `leaders_are_all_or_none_and_unique`

## BR-ARCS-004 — Lore

- Status: active
- Rule: Each Player holds any number of lore cards, including none, and no lore card is held twice in a Session. Lore does not depend on leaders being used.
- Rationale: Lore cards can be gained during play, and there is one copy of each.
- Enforced in: `backend/games/arcs/src/lib.rs`
- Tests: `lore_is_optional_any_number_and_unique`
