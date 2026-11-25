// Lists every crate in games/ (except core) so sessions.rs needs no edit per Game.
use std::{env, fs, path::Path};

fn main() {
    println!("cargo:rerun-if-changed=games");
    let mut dirs: Vec<String> = fs::read_dir("games")
        .unwrap()
        .filter_map(|e| e.ok().filter(|e| e.path().join("Cargo.toml").exists()))
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|d| d != "core")
        .collect();
    dirs.sort();
    let items: String = dirs
        .iter()
        .map(|d| {
            format!(
                "bgt_games::entry::<bgt_game_{}::Plugin>(),",
                d.replace('-', "_")
            )
        })
        .collect();
    let code = format!("fn entries() -> Vec<GameEntry> {{ vec![{items}] }}");
    fs::write(
        Path::new(&env::var("OUT_DIR").unwrap()).join("games.rs"),
        code,
    )
    .unwrap();
}
