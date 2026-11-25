//! Old King's Crown: each player takes one house and ends with a score.
//! See docs/business-rules/old-kings-crown-results.md.
use bgt_games::{Details, Game, Line};
use serde::Deserialize;
use std::collections::{BTreeMap, HashSet};
use std::sync::OnceLock;

/// The Game's option lists, edited in `data.json` (see backend/docs/README.md).
const DATA_JSON: &str = include_str!("../data.json");

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Entry {
    pub id: String,
    pub label: String,
    /// Which box it comes from; stored for later use.
    pub expansion: String,
    /// Hidden from new Sessions but still understood in old ones.
    #[serde(default)]
    pub retired: bool,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OkcData {
    pub houses: Vec<Entry>,
    pub form: bgt_games::Form,
}

fn data() -> &'static OkcData {
    static DATA: OnceLock<OkcData> = OnceLock::new();
    DATA.get_or_init(|| serde_json::from_str(DATA_JSON).expect("games/old-kings-crown/data.json is invalid"))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OkcPlayer {
    pub house: String,
    pub score: i32,
    pub winner: bool,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OkcResult {
    /// Keyed by player name; must match the session's players.
    pub players: BTreeMap<String, OkcPlayer>,
}

pub struct OldKingsCrown;

/// What the app registers: `build.rs` finds every crate in `games/` and uses this.
pub type Plugin = OldKingsCrown;

impl Game for OldKingsCrown {
    const ID: &'static str = "old-kings-crown";
    const NAME: &'static str = "Old King's Crown";
    const DATA: &'static str = DATA_JSON;
    type Result = OkcResult;

    fn check(players: &[String], r: &OkcResult) -> Result<(), String> {
        if !(1..=4).contains(&players.len()) {
            return Err("Old King's Crown is played by 1 to 4 players".into());
        }
        let names: HashSet<&String> = players.iter().collect();
        if r.players.len() != names.len() || r.players.keys().any(|k| !names.contains(k)) {
            return Err("result must have exactly one entry for each player".into());
        }
        let mut houses = HashSet::new();
        for p in r.players.values() {
            if p.score < 0 {
                return Err("score must not be negative".into());
            }
            if !data().houses.iter().any(|h| h.id == p.house && !h.retired) {
                return Err(format!("unknown house: {}", p.house));
            }
            if !houses.insert(&p.house) {
                return Err(format!("only one player can play the house {}", p.house));
            }
        }
        let winners: Vec<&OkcPlayer> = r.players.values().filter(|p| p.winner).collect();
        if winners.len() != 1 {
            return Err("exactly one player must win".into());
        }
        if r.players.values().any(|p| p.score > winners[0].score) {
            return Err("the winner cannot have a lower score than another player".into());
        }
        Ok(())
    }

    fn winners(r: &OkcResult) -> Vec<String> {
        r.players.iter().filter(|(_, p)| p.winner).map(|(n, _)| n.clone()).collect()
    }

    fn details(r: &OkcResult) -> Details {
        let players = r
            .players
            .iter()
            .map(|(name, p)| {
                let house = data().houses.iter().find(|h| h.id == p.house).map_or(p.house.as_str(), |h| &h.label);
                Line::new(name, format!("{house} · {} points", p.score))
            })
            .collect();
        Details { setup: vec![], players }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bgt_games::check_session;
    use serde_json::{json, Value};

    fn check(players: &[&str], result: Value) -> Result<(), String> {
        let players: Vec<String> = players.iter().map(|s| s.to_string()).collect();
        check_session::<OldKingsCrown>(&players, &result)
    }

    fn p(house: &str, score: i32, winner: bool) -> Value {
        json!({ "house": house, "score": score, "winner": winner })
    }

    fn res(players: Value) -> Value {
        json!({ "players": players })
    }

    #[test]
    fn form_is_well_formed() {
        bgt_games::check_form::<OldKingsCrown>();
    }

    #[test]
    fn describes_a_session() {
        let r: OkcResult = serde_json::from_value(res(json!({ "a": p("clans", 12, true), "b": p("nobility", 9, false) }))).unwrap();
        assert_eq!(OldKingsCrown::winners(&r), ["a"]);
        assert_eq!(
            serde_json::to_value(OldKingsCrown::details(&r)).unwrap(),
            json!({ "setup": [], "players": [{ "name": "a", "summary": "The Clans · 12 points" }, { "name": "b", "summary": "The Nobility · 9 points" }] })
        );
    }

    #[test]
    fn data_file_is_well_formed() {
        let ids: HashSet<&String> = data().houses.iter().map(|e| &e.id).collect();
        assert_eq!(ids.len(), data().houses.len(), "ids must be unique");
        assert!(data().houses.iter().filter(|h| !h.retired).count() >= 4, "four houses to choose from");
        for e in &data().houses {
            assert!(!e.id.is_empty() && e.id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_'), "bad id {}", e.id);
            assert!(!e.label.trim().is_empty() && !e.expansion.is_empty(), "{} needs a label and expansion", e.id);
        }
    }

    #[test]
    fn a_plain_session_passes() {
        assert!(check(&["a", "b"], res(json!({ "a": p("clans", 12, true), "b": p("nobility", 9, false) }))).is_ok());
    }

    #[test]
    fn needs_one_to_four_players() {
        assert!(check(&["a"], res(json!({ "a": p("clans", 1, true) }))).is_ok());
        assert!(check(&[], res(json!({}))).is_err());
        let five = res(json!({ "a": p("clans", 1, true), "b": p("nobility", 1, false), "c": p("uprising", 1, false), "d": p("gathering", 1, false), "e": p("clans", 1, false) }));
        assert!(check(&["a", "b", "c", "d", "e"], five).is_err());
    }

    #[test]
    fn houses_must_exist_and_be_unique() {
        assert!(check(&["a", "b"], res(json!({ "a": p("clans", 12, true), "b": p("clans", 9, false) }))).is_err());
        assert!(check(&["a", "b"], res(json!({ "a": p("clans", 12, true), "b": p("the_moon", 9, false) }))).is_err());
    }

    #[test]
    fn needs_exactly_one_winner_with_the_top_score() {
        let with = |a: Value, b: Value| res(json!({ "a": a, "b": b }));
        assert!(check(&["a", "b"], with(p("clans", 12, true), p("nobility", 9, true))).is_err());
        assert!(check(&["a", "b"], with(p("clans", 12, false), p("nobility", 9, false))).is_err());
        assert!(check(&["a", "b"], with(p("clans", 8, true), p("nobility", 9, false))).is_err());
        assert!(check(&["a", "b"], with(p("clans", 9, true), p("nobility", 9, false))).is_ok());
    }

    #[test]
    fn score_is_not_negative_and_players_must_match() {
        assert!(check(&["a", "b"], res(json!({ "a": p("clans", 12, true), "b": p("nobility", -1, false) }))).is_err());
        assert!(check(&["a", "z"], res(json!({ "a": p("clans", 12, true), "b": p("nobility", 9, false) }))).is_err());
        assert!(check(&["a", "b"], res(json!({ "a": p("clans", 12, true) }))).is_err());
    }
}
