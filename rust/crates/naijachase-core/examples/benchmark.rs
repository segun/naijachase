use naijachase_contracts::{Command, GameState};
use naijachase_core::{apply, key_witness_trait_index};
use std::{collections::BTreeMap, hint::black_box, time::Instant};

const PROFILE_FIELDS: [&str; 8] = [
    "sex",
    "height",
    "skin_tone",
    "hair",
    "hobby",
    "vehicle",
    "accessory",
    "feature",
];

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
        searched_hideouts: vec![],
        replay: vec![],
        outcome: None,
        economy: Default::default(),
    }
}

fn main() {
    // Exercise the normal hot path rather than an isolated, invalid travel:
    // question the current stop's key witness, then follow the correct trail.
    let iterations = 500_000;
    let started = Instant::now();
    for _ in 0..iterations {
        let initial = state();
        let trait_name = PROFILE_FIELDS[key_witness_trait_index(&initial)].to_owned();
        let (interviewed, interview_events) = apply(
            initial,
            Command::VisitVenue {
                venue_id: "market".into(),
                trait_name,
                trait_value: "benchmark evidence".into(),
                minutes: 25,
            },
        )
        .expect("benchmark interview must be valid");
        let (travelled, travel_events) = apply(
            interviewed,
            Command::Travel {
                destination: "Kano".into(),
                minutes: 90,
            },
        )
        .expect("benchmark travel must follow a key-witness interview");
        black_box((travelled, interview_events, travel_events));
    }
    let elapsed = started.elapsed();
    let commands = iterations * 2;
    let rate = commands as f64 / elapsed.as_secs_f64();
    println!(
        "{commands} representative commands in {:.3}s ({rate:.0} commands/s)",
        elapsed.as_secs_f64()
    );
    assert!(rate >= 10_000.0);
}
