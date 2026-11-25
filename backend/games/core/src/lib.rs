//! The seam every Game plugs into: a Game names itself, says what its Result looks like and checks it.
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;

pub trait Game {
    const ID: &'static str;
    const NAME: &'static str;
    /// The Game's option lists and rule numbers as JSON (its `data.json`); served to the app as is.
    const DATA: &'static str;
    /// The Game's own Result format; deserializing into it is the first check.
    type Result: DeserializeOwned;
    /// The Game's rules. `players` are already known to be non-blank and unique.
    fn check(players: &[String], result: &Self::Result) -> Result<(), String>;
    /// The Players who won, for the Results list.
    fn winners(result: &Self::Result) -> Vec<String>;
    /// What the Session screen shows for the Result.
    fn details(result: &Self::Result) -> Details;
}

/// The Session screen's text: titled setup items, then one line per Player (the app marks the winners itself).
#[derive(Serialize, Default)]
pub struct Details {
    pub setup: Vec<Setup>,
    pub players: Vec<Line>,
}

#[derive(Serialize)]
pub struct Setup {
    pub title: String,
    pub value: String,
}

#[derive(Serialize)]
pub struct Line {
    pub name: String,
    pub summary: String,
}

impl Setup {
    pub fn new(title: impl Into<String>, value: impl Into<String>) -> Self {
        Self { title: title.into(), value: value.into() }
    }
}

impl Line {
    pub fn new(name: impl Into<String>, summary: impl Into<String>) -> Self {
        Self { name: name.into(), summary: summary.into() }
    }
}

/// How the app builds a Game's form (the `form` key of its data file). Setup fields become top-level keys of the Result;
/// player fields become keys of `players[name]`. See docs/adr/0018-server-driven-game-forms.md.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Form {
    pub min_players: usize,
    pub max_players: usize,
    pub default_players: usize,
    #[serde(default)]
    pub setup: Vec<Field>,
    pub player: Vec<Field>,
}

#[derive(Deserialize, PartialEq, Clone, Copy, Debug)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    /// One option of `options`; stored as its id.
    Select,
    /// Any number of options of `options`, as checkboxes; stored as ids.
    Multi,
    /// A growing list of selects over `options`; stored as ids.
    Repeat,
    Checkbox,
    Number,
    /// Ticking it clears every other player's; stored as a bool.
    Winner,
    /// Exactly one of `options`, shown as ticked boxes; stored as its id.
    Choice,
    /// Another player's name or null; only offered when the player's `via` option has the `when_flag` flag. Each player is the partner of at most one player, and partners cannot form a loop.
    Player,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Field {
    pub key: String,
    pub label: String,
    #[serde(rename = "type")]
    pub kind: Kind,
    /// The name of a list in the data file.
    pub options: Option<String>,
    /// Only options whose `players` equals the number of players.
    #[serde(default)]
    pub filter_by_players: bool,
    /// An option can be held by one player only (unless the option is `shareable`).
    #[serde(default)]
    pub unique: bool,
    /// Adds an empty first option with this label, so nothing is chosen until the user does.
    pub blank: Option<String>,
    /// Shown, and stored, only while this setup checkbox is ticked; otherwise stored as null.
    pub when: Option<String>,
    /// Player fields: the key of the select whose option must carry the flag `when_flag`.
    pub via: Option<String>,
    pub when_flag: Option<String>,
    /// Player fields: the key (e.g. `winner`) that follows the chosen player's value.
    pub shares: Option<String>,
}

/// Panics unless the Game's form is well formed and refers only to things that exist. For each Game's tests.
pub fn check_form<G: Game>() {
    let d = data::<G>();
    let form: Form = serde_json::from_value(d["form"].clone()).unwrap_or_else(|e| panic!("{} form is invalid: {e}", G::NAME));
    assert!(1 <= form.min_players && form.min_players <= form.default_players && form.default_players <= form.max_players, "player counts out of order");
    let keys = |f: &[Field]| f.iter().map(|f| f.key.clone()).collect::<Vec<_>>();
    let (setup, player) = (keys(&form.setup), keys(&form.player));
    for f in form.setup.iter().chain(&form.player) {
        if let Some(list) = &f.options {
            assert!(d[list].is_array(), "{}: no list {list}", f.key);
        } else {
            assert!(!matches!(f.kind, Kind::Select | Kind::Multi | Kind::Repeat | Kind::Choice), "{} needs options", f.key);
        }
        assert!(f.when.iter().all(|w| setup.contains(w)), "{}: `when` is not a setup field", f.key);
        assert!(f.via.iter().chain(&f.shares).all(|k| player.contains(k)), "{}: `via`/`shares` is not a player field", f.key);
        assert!((f.kind == Kind::Player) == f.via.is_some() && f.via.is_some() == f.when_flag.is_some(), "{}: `via` and `when_flag` belong to player fields", f.key);
    }
}

/// The Result's Results-list winners and Session-screen details; None when it is not this Game's Result.
pub fn describe<G: Game>(result: &Value) -> Option<(Vec<String>, Details)> {
    let r: G::Result = serde_json::from_value(result.clone()).ok()?;
    Some((G::winners(&r), G::details(&r)))
}

/// The Game's data file, parsed.
pub fn data<G: Game>() -> Value {
    serde_json::from_str(G::DATA).unwrap_or_else(|e| panic!("{} data is not valid JSON: {e}", G::NAME))
}

/// Checks that apply to every Game, then the Game's own rules.
pub fn check_session<G: Game>(players: &[String], result: &Value) -> Result<(), String> {
    if players.is_empty() {
        return Err("a session needs at least one player".into());
    }
    if players.iter().any(|p| p.trim().is_empty()) {
        return Err("player names must not be blank".into());
    }
    if players.iter().collect::<HashSet<_>>().len() != players.len() {
        return Err("player names must be unique".into());
    }
    let result: G::Result = serde_json::from_value(result.clone()).map_err(|e| format!("invalid {} result: {e}", G::NAME))?;
    G::check(players, &result)
}

/// A Game with its type erased, so the app can hold them all in one list.
pub struct GameEntry {
    pub id: &'static str,
    pub name: &'static str,
    pub data: fn() -> Value,
    pub check: fn(&[String], &Value) -> Result<(), String>,
    pub describe: fn(&Value) -> Option<(Vec<String>, Details)>,
}

pub fn entry<G: Game>() -> GameEntry {
    GameEntry { id: G::ID, name: G::NAME, data: data::<G>, check: check_session::<G>, describe: describe::<G> }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    struct Pass;
    impl Game for Pass {
        const ID: &'static str = "pass";
        const NAME: &'static str = "Pass";
        const DATA: &'static str = r#"{"x":1}"#;
        type Result = u32;
        fn check(_: &[String], _: &u32) -> Result<(), String> {
            Ok(())
        }
        fn winners(r: &u32) -> Vec<String> {
            vec![format!("n={r}")]
        }
        fn details(r: &u32) -> Details {
            Details { setup: vec![Setup { title: "N".into(), value: r.to_string() }], players: vec![Line { name: "a".into(), summary: "s".into() }] }
        }
    }

    fn names(n: &[&str]) -> Vec<String> {
        n.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn serves_the_games_data() {
        assert_eq!(data::<Pass>(), json!({ "x": 1 }));
    }

    #[test]
    fn describes_a_result() {
        let (winners, details) = describe::<Pass>(&json!(7)).unwrap();
        assert_eq!(winners, ["n=7"]);
        assert_eq!(serde_json::to_value(details).unwrap(), json!({ "setup": [{ "title": "N", "value": "7" }], "players": [{ "name": "a", "summary": "s" }] }));
        assert!(describe::<Pass>(&json!("x")).is_none());
    }

    #[test]
    fn rejects_bad_player_lists_and_results() {
        assert!(check_session::<Pass>(&names(&["a"]), &json!(1)).is_ok());
        assert!(check_session::<Pass>(&[], &json!(1)).is_err());
        assert!(check_session::<Pass>(&names(&[" "]), &json!(1)).is_err());
        assert!(check_session::<Pass>(&names(&["a", "a"]), &json!(1)).is_err());
        assert!(check_session::<Pass>(&names(&["a"]), &json!("x")).is_err());
    }
}
