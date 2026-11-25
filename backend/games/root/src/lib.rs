//! Root: each player has a faction and a score. See docs/business-rules/root-results.md.
use bgt_games::Game;
use serde::Deserialize;
use std::collections::{BTreeMap, HashSet};
use std::sync::OnceLock;

/// The Game's option lists and rules, edited in `data.json` (see backend/docs/README.md).
const DATA_JSON: &str = include_str!("../data.json");

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Entry {
    pub id: String,
    pub label: String,
    /// Which box it comes from; stored for later use.
    #[serde(default)]
    pub expansion: String,
    /// Hidden from new Sessions but still understood in old ones.
    #[serde(default)]
    pub retired: bool,
    /// More than one Player may use it (Vagabond).
    #[serde(default)]
    pub shareable: bool,
    /// May form a coalition with any other Player.
    #[serde(default)]
    pub coalition: bool,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Rules {
    pub points_to_win: i32,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RootData {
    pub rules: Rules,
    pub victories: Vec<Entry>,
    pub factions: Vec<Entry>,
    pub maps: Vec<Entry>,
    pub decks: Vec<Entry>,
    pub landmarks: Vec<Entry>,
    pub form: bgt_games::Form,
}

fn data() -> &'static RootData {
    static DATA: OnceLock<RootData> = OnceLock::new();
    DATA.get_or_init(|| serde_json::from_str(DATA_JSON).expect("games/root/data.json is invalid"))
}

/// The victory ids the rules below depend on.
const POINTS: &str = "points";
#[cfg(test)]
const DOMINANCE: &str = "dominance";

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
pub struct RootPlayer {
    pub faction: String,
    pub score: i32,
    pub winner: bool,
    /// The coalition partner of a faction that can form one.
    pub partner: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RootResult {
    pub map: String,
    pub deck: String,
    #[serde(default)]
    pub landmarks: Vec<String>,
    pub victory: String,
    /// Keyed by player name; must match the session's players.
    pub players: BTreeMap<String, RootPlayer>,
}

pub struct Root;

/// What the app registers: `build.rs` finds every crate in `games/` and uses this.
pub type Plugin = Root;

impl Game for Root {
    const ID: &'static str = "root";
    const NAME: &'static str = "Root";
    const DATA: &'static str = DATA_JSON;
    type Result = RootResult;

    fn check(players: &[String], r: &RootResult) -> Result<(), String> {
        let d = data();
        find(&d.maps, "map", &r.map)?;
        find(&d.decks, "deck", &r.deck)?;
        let victory = &find(&d.victories, "victory", &r.victory)?.id;
        for l in &r.landmarks {
            find(&d.landmarks, "landmark", l)?;
        }
        if r.landmarks.iter().collect::<HashSet<_>>().len() != r.landmarks.len() {
            return Err("choose each landmark at most once".into());
        }
        let names: HashSet<&String> = players.iter().collect();
        if r.players.len() != names.len() || r.players.keys().any(|k| !names.contains(k)) {
            return Err("result must have exactly one entry for each player".into());
        }
        let mut seen = HashSet::new();
        for p in r.players.values() {
            if p.score < 0 {
                return Err("scores must not be negative".into());
            }
            let f = find(&d.factions, "faction", &p.faction)?;
            if !f.shareable && !seen.insert(&f.id) {
                return Err(format!("only one player can be the {}", f.label));
            }
        }
        // Every faction was found above, so a missing one here cannot happen.
        let can_coalition = |p: &RootPlayer| d.factions.iter().any(|f| f.id == p.faction && f.coalition);
        // A coalition faction with a partner wins or loses together with that partner.
        let mut partnered = HashSet::new();
        for (name, p) in &r.players {
            let Some(partner) = &p.partner else { continue };
            let q = r.players.get(partner).filter(|_| partner != name);
            match q {
                Some(q) if can_coalition(p) => {
                    if p.winner != q.winner {
                        return Err(format!("{name} and coalition partner {partner} must both win or both lose"));
                    }
                }
                _ => return Err(format!("{name}: a coalition needs a Vagabond and another player")),
            }
            if !partnered.insert(partner) {
                return Err(format!("{partner} is already in a coalition with another Vagabond"));
            }
        }
        // Each player has at most one partner, so a walk that outlasts the players is a loop.
        for name in r.players.keys() {
            let mut at = name;
            for _ in 0..r.players.len() {
                match &r.players[at].partner {
                    Some(next) => at = next,
                    None => break,
                }
                if at == name {
                    return Err("coalitions cannot form a loop".into());
                }
            }
        }
        let leaders: Vec<&RootPlayer> = r.players.values().filter(|p| p.winner && !(can_coalition(p) && p.partner.is_some())).collect();
        if leaders.len() != 1 {
            return Err("exactly one player must win, plus any Vagabonds in a coalition with them".into());
        }
        if victory == POINTS && leaders[0].score < d.rules.points_to_win {
            return Err(format!("a points victory needs at least {} points", d.rules.points_to_win));
        }
        Ok(())
    }

    fn winners(r: &RootResult) -> Vec<String> {
        r.players.iter().filter(|(_, p)| p.winner).map(|(n, _)| n.clone()).collect()
    }

    fn details(r: &RootResult) -> Vec<String> {
        let d = data();
        let mut lines = vec![format!("{} map · {} deck", label(&d.maps, &r.map), label(&d.decks, &r.deck))];
        if !r.landmarks.is_empty() {
            lines.push(format!("Landmarks: {}", r.landmarks.iter().map(|l| label(&d.landmarks, l)).collect::<Vec<_>>().join(", ")));
        }
        lines.push(format!("{} victory", label(&d.victories, &r.victory)));
        for (name, p) in &r.players {
            let partner = p.partner.as_ref().map(|x| format!(" · coalition with {x}")).unwrap_or_default();
            let won = if p.winner { " · winner" } else { "" };
            lines.push(format!("{name} · {} · {}{partner}{won}", label(&d.factions, &p.faction), p.score));
        }
        lines
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bgt_games::check_session;
    use serde_json::{json, Value};

    fn check(players: &[&str], mut result: Value) -> Result<(), String> {
        // Most tests are about players, so fill in the map and deck unless a test sets them.
        let o = result.as_object_mut().unwrap();
        o.entry("map").or_insert(json!("autumn"));
        o.entry("deck").or_insert(json!("standard"));
        let players: Vec<String> = players.iter().map(|s| s.to_string()).collect();
        check_session::<Root>(&players, &result)
    }

    fn p(faction: &str, score: i32, winner: bool) -> Value {
        json!({ "faction": faction, "score": score, "winner": winner })
    }

    #[test]
    fn form_is_well_formed() {
        bgt_games::check_form::<Root>();
    }

    #[test]
    fn describes_a_coalition_win() {
        let r: RootResult = serde_json::from_value(json!({
            "map": "autumn", "deck": "standard", "landmarks": ["lost_city"], "victory": "dominance",
            "players": { "Ada": { "faction": "vagabond", "score": 3, "winner": true, "partner": "Bo" }, "Bo": { "faction": "eyrie_dynasties", "score": 20, "winner": true, "partner": null } }
        }))
        .unwrap();
        assert_eq!(Root::winners(&r), ["Ada", "Bo"]);
        assert_eq!(
            Root::details(&r),
            ["Autumn map · Standard deck", "Landmarks: Lost City", "Dominance victory", "Ada · Vagabond · 3 · coalition with Bo · winner", "Bo · Eyrie Dynasties · 20 · winner"]
        );
    }

    #[test]
    fn data_file_is_well_formed() {
        let d = data();
        let lists = [("victories", &d.victories), ("factions", &d.factions), ("maps", &d.maps), ("decks", &d.decks), ("landmarks", &d.landmarks)];
        for (name, list) in lists {
            let ids: HashSet<&String> = list.iter().map(|e| &e.id).collect();
            assert_eq!(ids.len(), list.len(), "{name}: ids must be unique");
            for e in list {
                assert!(!e.id.is_empty() && e.id.chars().all(|c| c.is_ascii_lowercase() || c == '_'), "{name}: bad id {}", e.id);
                assert!(!e.label.trim().is_empty(), "{name}: {} needs a label", e.id);
                if name != "victories" {
                    assert!(!e.expansion.is_empty(), "{name}: {} needs an expansion", e.id);
                }
            }
        }
        assert!(d.maps.iter().any(|e| !e.retired) && d.decks.iter().any(|e| !e.retired));
        assert!(d.factions.iter().any(|f| f.coalition && f.shareable), "the Vagabond rules need a coalition faction");
        assert!(d.victories.iter().any(|v| v.id == POINTS) && d.victories.iter().any(|v| v.id == DOMINANCE));
        assert!(d.rules.points_to_win > 0);
    }

    #[test]
    fn retired_entries_are_rejected_for_new_sessions() {
        let list = vec![Entry { id: "old".into(), label: "Old".into(), expansion: "base".into(), retired: true, shareable: false, coalition: false }];
        assert_eq!(find(&list, "map", "old").err().unwrap(), "unknown map: old");
        assert!(find(&list, "map", "new").is_err());
    }

    #[test]
    fn homeland_factions() {
        let r = json!({ "victory": "dominance", "players": { "a": p("lilypad_diaspora", 1, true), "b": p("twilight_council", 1, false), "c": p("knaves_of_the_deepwood", 1, false) } });
        assert!(check(&["a", "b", "c"], r).is_ok());
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
    fn two_vagabonds_cannot_share_a_partner() {
        let vag = |partner: &str| json!({ "faction": "vagabond", "score": 3, "winner": true, "partner": partner });
        let r = json!({ "victory": "dominance", "players": { "a": p("lizard_cult", 9, true), "b": vag("a"), "c": vag("a") } });
        assert!(check(&["a", "b", "c"], r).is_err());
    }

    #[test]
    fn vagabond_chain_shares_the_win() {
        let vag = |partner: &str, winner: bool| json!({ "faction": "vagabond", "score": 3, "winner": winner, "partner": partner });
        let r = |c_wins| json!({ "victory": "dominance", "players": { "a": p("lizard_cult", 9, true), "b": vag("a", true), "c": vag("b", c_wins) } });
        assert!(check(&["a", "b", "c"], r(true)).is_ok());
        assert!(check(&["a", "b", "c"], r(false)).is_err());
    }

    #[test]
    fn vagabond_pair() {
        let vag = json!({ "faction": "vagabond", "score": 3, "winner": true, "partner": "b" });
        let r = json!({ "victory": "dominance", "players": { "a": vag, "b": p("vagabond", 5, true) } });
        assert!(check(&["a", "b"], r).is_ok());
    }

    #[test]
    fn coalition_loop_is_rejected() {
        let vag = |partner: &str| json!({ "faction": "vagabond", "score": 3, "winner": true, "partner": partner });
        let r = json!({ "victory": "dominance", "players": { "a": vag("b"), "b": vag("a"), "c": p("lizard_cult", 9, false) } });
        assert!(check(&["a", "b", "c"], r).is_err());
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
        assert!(check(&["a", "b", "c"], with(true, "c", "vagabond")).is_err()); // partner c lost, b won
        assert!(check(&["a", "b", "c"], with(false, "c", "vagabond")).is_ok()); // a Vagabond may partner a Vagabond
        assert!(check(&["a", "b", "c"], with(true, "zed", "vagabond")).is_err()); // partner not in session
        assert!(check(&["a", "b", "c"], with(true, "a", "eyrie_dynasties")).is_err()); // only Vagabonds partner
    }

    #[test]
    fn coalition_in_points_victory() {
        let vag = json!({ "faction": "vagabond", "score": 3, "winner": true, "partner": "a" });
        let r = |score| json!({ "victory": "points", "players": { "a": p("lizard_cult", score, true), "b": vag.clone() } });
        assert!(check(&["a", "b"], r(30)).is_ok());
        assert!(check(&["a", "b"], r(29)).is_err()); // the partner needs the points
    }

    #[test]
    fn map_deck_and_landmarks() {
        let base = |extra: Value| {
            let mut r = json!({ "victory": "dominance", "players": { "a": p("lizard_cult", 5, true) } });
            r.as_object_mut().unwrap().extend(extra.as_object().unwrap().clone());
            r
        };
        assert!(check(&["a"], base(json!({ "map": "mountain", "landmarks": ["black_market", "lost_city"] }))).is_ok());
        assert!(check(&["a"], base(json!({ "map": "gorge", "deck": "squires_and_disciples", "landmarks": ["mousehold", "rabbittown"] }))).is_ok());
        assert!(check(&["a"], base(json!({ "deck": "exiles_and_partisans" }))).is_ok());
        assert!(check(&["a"], base(json!({ "map": "volcano" }))).is_err()); // unknown map
        assert!(check(&["a"], base(json!({ "deck": "exiles" }))).is_err()); // unknown deck
        assert!(check(&["a"], base(json!({ "landmarks": ["black_market", "lost_city", "elder_treetop", "the_ferry", "the_tower"] }))).is_ok()); // any number
        assert!(check(&["a"], base(json!({ "landmarks": ["lost_city", "lost_city"] }))).is_err()); // repeated
        assert!(check(&["a"], base(json!({ "landmarks": ["the_moon"] }))).is_err()); // unknown landmark
        assert!(check_session::<Root>(&["a".to_string()], &base(json!({}))).is_err()); // map and deck are required
    }

    #[test]
    fn result_must_match_players() {
        let r = json!({ "victory": "dominance", "players": { "a": p("lizard_cult", 9, true) } });
        assert!(check(&["a", "b"], r.clone()).is_err());
        assert!(check(&["z"], r).is_err());
    }
}
