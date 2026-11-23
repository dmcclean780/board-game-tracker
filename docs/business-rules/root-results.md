# Root results

Terms: Session, Result, Points victory, Dominance victory, Coalition ([glossary](../../GLOSSARY.md)).

## BR-ROOT-001 — Faction per Player

- Status: active
- Rule: Each Player has one faction, and no faction appears twice in a Session except Vagabond.
- Rationale: Every faction exists once in a box; two Vagabonds are possible with an expansion.
- Enforced in: `backend/games/root/src/lib.rs`
- Tests: `duplicate_factions_only_for_vagabonds`

## BR-ROOT-002 — One winner plus coalition Vagabonds

- Status: active
- Rule: Exactly one Player wins in their own right, and any Vagabond in a Coalition with that Player (Dominance victory only, BR-ROOT-004) wins too, so a Points victory has one winner and a Dominance victory has one winner plus Coalition Vagabonds.
- Rationale: Root has a single victor, and a Coalition lets Vagabonds share it.
- Enforced in: `backend/games/root/src/lib.rs`
- Tests: `needs_exactly_one_winner`, `two_vagabonds_may_share_a_coalition_partner`

## BR-ROOT-003 — Points victory needs 30

- Status: active
- Rule: In a Points victory the Player who wins in their own right has at least 30 points. A Dominance victory has no score condition.
- Rationale: A dominance card ends the game at any score.
- Enforced in: `backend/games/root/src/lib.rs`
- Tests: `points_victory_needs_30`, `dominance_victory_ignores_score`

## BR-ROOT-004 — Coalition partners

- Status: active
- Rule: A Coalition only exists in a Dominance victory. Only a Vagabond has a Coalition partner. The partner is another Player in the Session who is not a Vagabond, and the Vagabond wins exactly when the partner wins. Two Vagabonds may choose the same partner.
- Rationale: A Vagabond cannot win alone by Coalition and shares the partner's victory.
- Enforced in: `backend/games/root/src/lib.rs`
- Tests: `bad_coalitions`, `coalition_needs_dominance`, `two_vagabonds_may_share_a_coalition_partner`

## BR-ROOT-005 — Scores and player list

- Status: active
- Rule: Scores are not negative, and the Result has exactly one entry for each Player on the Session.
- Rationale: Keeps the Result consistent with the Session it belongs to.
- Enforced in: `backend/games/root/src/lib.rs`
- Tests: `result_must_match_players`

## BR-ROOT-006 — Map, deck and landmarks

- Status: active
- Rule: Every Root Result names one Map (Autumn, Winter, Lake, Mountain, Marsh or Gorge) and one Deck (Standard, Exiles and Partisans or Squires and Disciples), and lists any number of different Landmarks (Black Market, Elder Treetop, Legendary Forge, Lost City, Mousehold, Foxburrow, Rabbittown, The Ferry or The Tower). The Faction list includes the Homeland factions Lilypad Diaspora, Twilight Council and Knaves of the Deepwood.
- Rationale: These are the setup choices that change how a game plays; a Landmark is either in play or not, and cannot be in play twice.
- Enforced in: `backend/games/root/src/lib.rs`
- Tests: `map_deck_and_landmarks`, `homeland_factions`
