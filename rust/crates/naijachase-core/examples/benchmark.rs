use naijachase_contracts::{Command, GameState};
use naijachase_core::apply;
use std::{collections::BTreeMap, time::Instant};
fn state() -> GameState {
    GameState {
        version: 1,
        mission_id: "BENCH".into(),
        thief_id: "T".into(),
        difficulty: 3,
        stage: 0,
        state: "Lagos".into(),
        route: vec![
            "Lagos".into(),
            "Kano".into(),
            "Sokoto".into(),
            "Abuja".into(),
        ],
        elapsed: 0,
        score: 800,
        career_points: 0,
        dossier: BTreeMap::new(),
        observations: BTreeMap::new(),
        visited_venues: vec![],
        warrant_suspect: None,
        hideout_venue: "market".into(),
        replay: vec![],
        outcome: None,
    }
}
fn main() {
    let iterations = 1_000_000;
    let started = Instant::now();
    for _ in 0..iterations {
        let _ = apply(
            state(),
            Command::Travel {
                destination: "Kano".into(),
                minutes: 90,
            },
        )
        .unwrap();
    }
    let elapsed = started.elapsed();
    let rate = iterations as f64 / elapsed.as_secs_f64();
    println!(
        "{iterations} commands in {:.3}s ({rate:.0} commands/s)",
        elapsed.as_secs_f64()
    );
    assert!(rate >= 10_000.0);
}
