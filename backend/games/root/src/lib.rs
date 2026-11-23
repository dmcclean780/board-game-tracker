//! Root: each player has a faction and a score. See docs/business-rules/root-results.md.
use bgt_games::Game;
use serde::Deserialize;
use std::collections::{BTreeMap, HashSet};

#[derive(Deserialize, Clone, Copy, PartialEq, Eq, Hash, Debug)]
#[serde(rename_all = "snake_case")]
pub enum Faction {
    MarquiseDeCat,
    EyrieDynasties,
    WoodlandAlliance,
    Vagabond,
    RiverfolkCompany,
    LizardCult,
    UndergroundDuchy,
    CorvidConspiracy,
    KeepersInIron,
    LordOfTheHundreds,
}

#[derive(Deserialize, PartialEq, Eq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum Victory {
    Points,
    Dominance,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RootPlayer {
    pub faction: Faction,
    pub score: i32,
    pub winner: bool,
    /// The Vagabond's coalition partner.
    pub partner: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RootResult {
    pub victory: Victory,
    /// Keyed by player name; must match the session's players.
    pub players: BTreeMap<String, RootPlayer>,
}

pub struct Root;

impl Game for Root {
    const ID: &'static str = "root";
    const NAME: &'static str = "Root";
    type Result = RootResult;

    fn check(players: &[String], r: &RootResult) -> Result<(), String> {
        let names: HashSet<&String> = players.iter().collect();
        if r.players.len() != names.len() || r.players.keys().any(|k| !names.contains(k)) {
            return Err("result must have exactly one entry for each player".into());
        }
        let mut seen = HashSet::new();
        for p in r.players.values() {
            if p.score < 0 {
                return Err("scores must not be negative".into());
            }
            if p.faction != Faction::Vagabond && !seen.insert(p.faction) {
                return Err("only Vagabonds may share a faction".into());
            }
        }
        // A Vagabond with a partner wins or loses together with that partner.
        for (name, p) in &r.players {
            let Some(partner) = &p.partner else { continue };
            if r.victory != Victory::Dominance {
                return Err(format!("{name}: a coalition needs a dominance victory"));
            }
            let q = r.players.get(partner).filter(|_| partner != name);
            match q {
                Some(q) if p.faction == Faction::Vagabond && q.faction != Faction::Vagabond => {
                    if p.winner != q.winner {
                        return Err(format!("{name} and coalition partner {partner} must both win or both lose"));
                    }
                }
                _ => return Err(format!("{name}: a coalition needs a Vagabond and another player who is not a Vagabond")),
            }
        }
        let leaders: Vec<&RootPlayer> = r.players.values().filter(|p| p.winner && !(p.faction == Faction::Vagabond && p.partner.is_some())).collect();
        if leaders.len() != 1 {
            return Err("exactly one player must win, plus any Vagabonds in a coalition with them".into());
        }
        if r.victory == Victory::Points && leaders[0].score < 30 {
            return Err("a points victory needs at least 30 points".into());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bgt_games::check_session;
    use serde_json::{json, Value};

    fn check(players: &[&str], result: Value) -> Result<(), String> {
        let players: Vec<String> = players.iter().map(|s| s.to_string()).collect();
        check_session::<Root>(&players, &result)
    }

    fn p(faction: &str, score: i32, winner: bool) -> Value {
        json!({ "faction": faction, "score": score, "winner": winner })
    }

    #[test]
    fn points_victory() {
        let r = json!({ "victory": "points", "players": { "a": p("marquise_de_cat", 30, true), "b": p("eyrie_dynasties", 12, false) } });
        assert!(check(&["a", "b"], r).is_ok());
    }

    #[test]
    fn points_victory_needs_30() {
        let r = json!({ "victory": "points", "players": { "a": p("marquise_de_cat", 29, true), "b": p("eyrie_dynasties", 12, false) } });
        assert!(check(&["a", "b"], r).is_err());
    }

    #[test]
    fn dominance_victory_ignores_score() {
        let r = json!({ "victory": "dominance", "players": { "a": p("marquise_de_cat", 5, true), "b": p("eyrie_dynasties", 12, false) } });
        assert!(check(&["a", "b"], r).is_ok());
    }

    #[test]
    fn needs_exactly_one_winner() {
        let none = json!({ "victory": "dominance", "players": { "a": p("marquise_de_cat", 5, false), "b": p("eyrie_dynasties", 12, false) } });
        let two = json!({ "victory": "dominance", "players": { "a": p("marquise_de_cat", 5, true), "b": p("eyrie_dynasties", 12, true) } });
        assert!(check(&["a", "b"], none).is_err());
        assert!(check(&["a", "b"], two).is_err());
    }

    #[test]
    fn duplicate_factions_only_for_vagabonds() {
        let dup = json!({ "victory": "dominance", "players": { "a": p("lizard_cult", 5, true), "b": p("lizard_cult", 1, false) } });
        let vagabonds = json!({ "victory": "dominance", "players": { "a": p("lizard_cult", 5, true), "b": p("vagabond", 1, false), "c": p("vagabond", 1, false) } });
        assert!(check(&["a", "b"], dup).is_err());
        assert!(check(&["a", "b", "c"], vagabonds).is_ok());
    }

    #[test]
    fn two_vagabonds_may_share_a_coalition_partner() {
        let vag = |partner: &str| json!({ "faction": "vagabond", "score": 3, "winner": true, "partner": partner });
        let r = json!({ "victory": "dominance", "players": { "a": p("lizard_cult", 9, true), "b": vag("a"), "c": vag("a") } });
        assert!(check(&["a", "b", "c"], r).is_ok());
    }

    #[test]
    fn bad_coalitions() {
        let with = |vag_wins: bool, partner: &str, faction: &str| json!({ "victory": "dominance", "players": {
            "a": p("lizard_cult", 9, true),
            "b": { "faction": faction, "score": 3, "winner": vag_wins, "partner": partner },
            "c": p("vagabond", 1, false) } });
        assert!(check(&["a", "b", "c"], with(true, "a", "vagabond")).is_ok());
        assert!(check(&["a", "b", "c"], with(false, "a", "vagabond")).is_err()); // partner won, Vagabond did not
        assert!(check(&["a", "b", "c"], with(true, "b", "vagabond")).is_err()); // partner is self
        assert!(check(&["a", "b", "c"], with(true, "c", "vagabond")).is_err()); // partner is a Vagabond
        assert!(check(&["a", "b", "c"], with(true, "zed", "vagabond")).is_err()); // partner not in session
        assert!(check(&["a", "b", "c"], with(true, "a", "eyrie_dynasties")).is_err()); // only Vagabonds partner
    }

    #[test]
    fn coalition_needs_dominance() {
        let vag = json!({ "faction": "vagabond", "score": 3, "winner": true, "partner": "a" });
        let r = json!({ "victory": "points", "players": { "a": p("lizard_cult", 30, true), "b": vag } });
        assert!(check(&["a", "b"], r).unwrap_err().contains("dominance"));
    }

    #[test]
    fn result_must_match_players() {
        let r = json!({ "victory": "dominance", "players": { "a": p("lizard_cult", 9, true) } });
        assert!(check(&["a", "b"], r.clone()).is_err());
        assert!(check(&["z"], r).is_err());
    }
}
