# Old King's Crown results

Terms: Session, Result ([glossary](../../GLOSSARY.md)).

## BR-OKC-001 — Players and houses

- Status: active
- Rule: An Old King's Crown Session has 1 to 4 Players, and its Result has exactly one entry for each Player. Each Player has one house from `backend/games/old-kings-crown/data.json` that is not `retired`, and no house is held by two Players. Each Player has a score that is not negative.
- Rationale: There is one copy of each house in the box.
- Enforced in: `backend/games/old-kings-crown/src/lib.rs`, `backend/games/old-kings-crown/data.json`
- Tests: `needs_one_to_four_players`, `houses_must_exist_and_be_unique`, `score_is_not_negative_and_players_must_match`, `data_file_is_well_formed`

## BR-OKC-002 — One winner with the top score

- Status: active
- Rule: Exactly one Player wins, and no Player has a higher score than the winner (a tie is allowed).
- Rationale: The game ends in a single victor; ties are broken by rules the app does not model.
- Enforced in: `backend/games/old-kings-crown/src/lib.rs`
- Tests: `needs_exactly_one_winner_with_the_top_score`
