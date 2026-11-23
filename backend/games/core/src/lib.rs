//! The seam every Game plugs into: a Game names itself, says what its Result looks like and checks it.
use serde::de::DeserializeOwned;
use serde_json::Value;
use std::collections::HashSet;

pub trait Game {
    const ID: &'static str;
    const NAME: &'static str;
    /// The Game's own Result format; deserializing into it is the first check.
    type Result: DeserializeOwned;
    /// The Game's rules. `players` are already known to be non-blank and unique.
    fn check(players: &[String], result: &Self::Result) -> Result<(), String>;
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    struct Pass;
    impl Game for Pass {
        const ID: &'static str = "pass";
        const NAME: &'static str = "Pass";
        type Result = u32;
        fn check(_: &[String], _: &u32) -> Result<(), String> {
            Ok(())
        }
    }

    fn names(n: &[&str]) -> Vec<String> {
        n.iter().map(|s| s.to_string()).collect()
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
