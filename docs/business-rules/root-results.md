# Root results

Terms: Session, Result, Points victory, Dominance victory, Coalition ([glossary](../../GLOSSARY.md)).

## BR-ROOT-001 — Faction per Player

- Status: active
- Rule: Each Player has one faction, and no faction appears twice in a Session unless it is marked `shareable` in the data file (only Vagabond).
- Rationale: Every faction exists once in a box; two Vagabonds are possible with an expansion.
- Enforced in: `backend/games/root/src/lib.rs`, flags in `backend/games/root/data.json`
- Tests: `duplicate_factions_only_for_vagabonds`

## BR-ROOT-002 — One winner plus coalition Vagabonds

- Status: active
- Rule: Exactly one Player wins in their own right, and any Vagabond in a Coalition with that Player (BR-ROOT-004) wins too, so either victory has one winner plus any Coalition Vagabonds.
- Rationale: Root has a single victor, and a Coalition lets Vagabonds share it.
- Enforced in: `backend/games/root/src/lib.rs`
- Tests: `needs_exactly_one_winner`, `two_vagabonds_may_share_a_coalition_partner`

## BR-ROOT-003 — Points victory needs 30

- Status: active
- Rule: In a Points victory the Player who wins in their own right has at least `rules.points_to_win` points (30 in `data.json`). A Dominance victory has no score condition. The points condition applies to that Player, not to their Coalition Vagabonds.
- Rationale: A dominance card ends the game at any score.
- Enforced in: `backend/games/root/src/lib.rs`
- Tests: `points_victory_needs_30`, `dominance_victory_ignores_score`

## BR-ROOT-004 — Coalition partners

- Status: active
- Rule: A Coalition may form in a Points or a Dominance victory. Only a faction marked `coalition` in the data file (Vagabond) has a Coalition partner. The partner is another Player in the Session whose faction is not marked `coalition`, and the Vagabond wins exactly when the partner wins. Two Vagabonds may choose the same partner.
- Rationale: A Vagabond cannot win alone by Coalition and shares the partner's victory.
- Enforced in: `backend/games/root/src/lib.rs`
- Tests: `bad_coalitions`, `coalition_in_points_victory`, `two_vagabonds_may_share_a_coalition_partner`

## BR-ROOT-005 — Scores and player list

- Status: active
- Rule: Scores are not negative, and the Result has exactly one entry for each Player on the Session.
- Rationale: Keeps the Result consistent with the Session it belongs to.
- Enforced in: `backend/games/root/src/lib.rs`
- Tests: `result_must_match_players`

## BR-ROOT-006 — Map, deck and landmarks

- Status: active
- Rule: Every Root Result names one Map, one Deck and one Victory type, and lists any number of different Landmarks, and each must be an entry in `backend/games/root/data.json` that is not `retired`. That file is the list of Maps, Decks, Landmarks and Factions; edit it there.
- Rationale: These are the setup choices that change how a game plays; a Landmark is either in play or not, and cannot be in play twice.
- Enforced in: `backend/games/root/src/lib.rs`, `backend/games/root/data.json`
- Tests: `map_deck_and_landmarks`, `homeland_factions`, `data_file_is_well_formed`, `retired_entries_are_rejected_for_new_sessions`
