//! Arcs (base game and the Leaders & Lore pack): each player has Power, optionally a leader and lore cards.
//! See docs/business-rules/arcs-results.md.
use bgt_games::Game;
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
    /// Setup cards only: the number of players the card is for.
    #[serde(default)]
    pub players: usize,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ArcsData {
    pub setups: Vec<Entry>,
    pub leaders: Vec<Entry>,
    pub lore: Vec<Entry>,
    pub form: bgt_games::Form,
}

fn data() -> &'static ArcsData {
    static DATA: OnceLock<ArcsData> = OnceLock::new();
    DATA.get_or_init(|| serde_json::from_str(DATA_JSON).expect("games/arcs/data.json is invalid"))
}

/// The label for an id; an id no longer in the data shows as is.
fn label(list: &[Entry], id: &str) -> String {
    list.iter().find(|e| e.id == id).map_or(id, |e| &e.label).to_owned()
}

/// An id that exists in the list and is not retired.
fn find<'a>(list: &'a [Entry], kind: &str, id: &str) -> Result<&'a Entry, String> {
    list.iter().find(|e| e.id == id && !e.retired).ok_or_else(|| format!("unknown {kind}: {id}"))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ArcsPlayer {
    pub power: i32,
    pub winner: bool,
    pub leader: Option<String>,
    #[serde(default)]
    pub lore: Vec<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ArcsResult {
    pub setup: String,
    /// Whether the Session was played with leaders; if so every player has one.
    pub leaders: bool,
    /// Keyed by player name; must match the session's players.
    pub players: BTreeMap<String, ArcsPlayer>,
}

pub struct Arcs;

/// What the app registers: `build.rs` finds every crate in `games/` and uses this.
pub type Plugin = Arcs;

impl Game for Arcs {
    const ID: &'static str = "arcs";
    const NAME: &'static str = "Arcs";
    const DATA: &'static str = DATA_JSON;
    type Result = ArcsResult;

    fn check(players: &[String], r: &ArcsResult) -> Result<(), String> {
        let d = data();
        if !(2..=4).contains(&players.len()) {
            return Err("Arcs is played by 2 to 4 players".into());
        }
        if find(&d.setups, "setup", &r.setup)?.players != players.len() {
            return Err(format!("setup {} is not for {} players", r.setup, players.len()));
        }
        let names: HashSet<&String> = players.iter().collect();
        if r.players.len() != names.len() || r.players.keys().any(|k| !names.contains(k)) {
            return Err("result must have exactly one entry for each player".into());
        }
        let (mut leaders, mut lore) = (HashSet::new(), HashSet::new());
        for p in r.players.values() {
            if p.power < 0 {
                return Err("power must not be negative".into());
            }
            match (&p.leader, r.leaders) {
                (Some(l), true) => {
                    find(&d.leaders, "leader", l)?;
                    if !leaders.insert(l) {
                        return Err(format!("only one player can be the {l}"));
                    }
                }
                (None, true) => return Err("every player needs a leader when playing with leaders".into()),
                (Some(_), false) => return Err("leaders were not used in this session".into()),
                (None, false) => {}
            }
            for l in &p.lore {
                find(&d.lore, "lore", l)?;
                if !lore.insert(l) {
                    return Err(format!("only one player can hold the lore {l}"));
                }
            }
        }
        let winners: Vec<&ArcsPlayer> = r.players.values().filter(|p| p.winner).collect();
        if winners.len() != 1 {
            return Err("exactly one player must win".into());
        }
        if r.players.values().any(|p| p.power > winners[0].power) {
            return Err("the winner cannot have less power than another player".into());
        }
        Ok(())
    }

    fn winners(r: &ArcsResult) -> Vec<String> {
        r.players.iter().filter(|(_, p)| p.winner).map(|(n, _)| n.clone()).collect()
    }

    fn details(r: &ArcsResult) -> Vec<String> {
        let d = data();
        let with = if r.leaders { " · with leaders" } else { "" };
        let mut lines = vec![format!("{} setup · {} players{with}", label(&d.setups, &r.setup), r.players.len())];
        for (name, p) in &r.players {
            let leader = p.leader.as_ref().map(|l| format!(" · {}", label(&d.leaders, l))).unwrap_or_default();
            let lore = if p.lore.is_empty() { String::new() } else { format!(" · Lore: {}", p.lore.iter().map(|l| label(&d.lore, l)).collect::<Vec<_>>().join(", ")) };
            let won = if p.winner { " · winner" } else { "" };
            lines.push(format!("{name} · {} power{leader}{lore}{won}", p.power));
        }
        lines
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bgt_games::check_session;
    use serde_json::{json, Value};

    fn check(players: &[&str], result: Value) -> Result<(), String> {
        let players: Vec<String> = players.iter().map(|s| s.to_string()).collect();
        check_session::<Arcs>(&players, &result)
    }

    fn p(power: i32, winner: bool) -> Value {
        json!({ "power": power, "winner": winner, "leader": null })
    }

    fn two(extra: Value) -> Value {
        let mut r = json!({ "setup": "2p_frontiers", "leaders": false, "players": { "a": p(12, true), "b": p(9, false) } });
        r.as_object_mut().unwrap().extend(extra.as_object().unwrap().clone());
        r
    }

    #[test]
    fn form_is_well_formed() {
        bgt_games::check_form::<Arcs>();
    }

    #[test]
    fn describes_a_session() {
        let r: ArcsResult = serde_json::from_value(json!({
            "setup": "2p_frontiers", "leaders": true,
            "players": { "a": { "power": 12, "winner": true, "leader": "elder", "lore": ["tool_priests", "gate_ports"] }, "b": p(9, false) }
        }))
        .unwrap();
        assert_eq!(Arcs::winners(&r), ["a"]);
        assert_eq!(
            Arcs::details(&r),
            ["Frontiers setup · 2 players · with leaders", "a · 12 power · Elder · Lore: Tool-Priests, Gate Ports · winner", "b · 9 power"]
        );
    }

    #[test]
    fn data_file_is_well_formed() {
        let d = data();
        for (name, list) in [("setups", &d.setups), ("leaders", &d.leaders), ("lore", &d.lore)] {
            let ids: HashSet<&String> = list.iter().map(|e| &e.id).collect();
            assert_eq!(ids.len(), list.len(), "{name}: ids must be unique");
            for e in list {
                assert!(!e.id.is_empty() && e.id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_'), "{name}: bad id {}", e.id);
                assert!(!e.label.trim().is_empty() && !e.expansion.is_empty(), "{name}: {} needs a label and expansion", e.id);
                assert_eq!(name == "setups", (2..=4).contains(&e.players), "{name}: {} has a wrong player count", e.id);
            }
        }
        for n in 2..=4 {
            assert!(d.setups.iter().any(|s| s.players == n && !s.retired), "a setup for {n} players");
        }
    }

    #[test]
    fn a_plain_session_passes() {
        assert!(check(&["a", "b"], two(json!({}))).is_ok());
    }

    #[test]
    fn needs_two_to_four_players() {
        assert!(check(&["a"], json!({ "setup": "2p_frontiers", "leaders": false, "players": { "a": p(1, true) } })).is_err());
        let five = json!({ "setup": "4p_frontiers", "leaders": false, "players": { "a": p(1, true), "b": p(1, false), "c": p(1, false), "d": p(1, false), "e": p(1, false) } });
        assert!(check(&["a", "b", "c", "d", "e"], five).is_err());
    }

    #[test]
    fn setup_must_exist_and_match_the_player_count() {
        assert!(check(&["a", "b"], two(json!({ "setup": "3p_core_conflict" }))).is_err());
        assert!(check(&["a", "b"], two(json!({ "setup": "nope" }))).is_err());
        let three = json!({ "setup": "3p_core_conflict", "leaders": false, "players": { "a": p(5, true), "b": p(4, false), "c": p(1, false) } });
        assert!(check(&["a", "b", "c"], three).is_ok());
    }

    #[test]
    fn needs_exactly_one_winner_with_the_most_power() {
        let both = json!({ "players": { "a": p(12, true), "b": p(9, true) } });
        let none = json!({ "players": { "a": p(12, false), "b": p(9, false) } });
        let behind = json!({ "players": { "a": p(8, true), "b": p(9, false) } });
        let tied = json!({ "players": { "a": p(9, true), "b": p(9, false) } });
        assert!(check(&["a", "b"], two(both)).is_err());
        assert!(check(&["a", "b"], two(none)).is_err());
        assert!(check(&["a", "b"], two(behind)).is_err());
        assert!(check(&["a", "b"], two(tied)).is_ok());
    }

    #[test]
    fn power_is_not_negative_and_players_must_match() {
        assert!(check(&["a", "b"], two(json!({ "players": { "a": p(12, true), "b": p(-1, false) } }))).is_err());
        assert!(check(&["a", "z"], two(json!({}))).is_err());
        assert!(check(&["a", "b"], two(json!({ "players": { "a": p(12, true) } }))).is_err());
    }

    #[test]
    fn leaders_are_all_or_none_and_unique() {
        let with = |a: Value, b: Value, on: bool| two(json!({ "leaders": on, "players": { "a": { "power": 12, "winner": true, "leader": a }, "b": { "power": 9, "winner": false, "leader": b } } }));
        assert!(check(&["a", "b"], with(json!("elder"), json!("corsair"), true)).is_ok());
        assert!(check(&["a", "b"], with(json!("elder"), json!(null), true)).is_err()); // one is missing
        assert!(check(&["a", "b"], with(json!("elder"), json!("elder"), true)).is_err()); // repeated
        assert!(check(&["a", "b"], with(json!("nobody"), json!("elder"), true)).is_err()); // unknown
        assert!(check(&["a", "b"], with(json!("elder"), json!(null), false)).is_err()); // leaders are off
    }

    #[test]
    fn lore_is_optional_any_number_and_unique() {
        let with = |a: Value, b: Value| two(json!({ "players": { "a": { "power": 12, "winner": true, "leader": null, "lore": a }, "b": { "power": 9, "winner": false, "leader": null, "lore": b } } }));
        assert!(check(&["a", "b"], with(json!(["tool_priests", "gate_ports", "force_beams"]), json!(["cloud_cities"]))).is_ok());
        assert!(check(&["a", "b"], with(json!([]), json!([]))).is_ok());
        assert!(check(&["a", "b"], with(json!(["gate_ports"]), json!(["gate_ports"]))).is_err()); // held twice
        assert!(check(&["a", "b"], with(json!(["gate_ports", "gate_ports"]), json!([]))).is_err()); // repeated
        assert!(check(&["a", "b"], with(json!(["the_moon"]), json!([]))).is_err()); // unknown
    }
}
