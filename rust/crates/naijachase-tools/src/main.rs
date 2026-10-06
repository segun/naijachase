use naijachase_content::{Catalogue, validate_repository};
use naijachase_contracts::{Command, GameState};
use naijachase_core::apply;
use std::{
    collections::{BTreeMap, BTreeSet},
    env, fs,
    path::{Path, PathBuf},
};
fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..")
}
fn validate(root: &Path) -> Catalogue {
    if let Err(errors) = validate_repository(root) {
        for e in errors {
            eprintln!("{e}")
        }
        std::process::exit(2)
    }
    let c = Catalogue::load(root).unwrap();
    println!(
        "Validated {} missions, {} locations, {} thieves, {} clue atoms across {} jurisdictions",
        c.missions.len(),
        c.locations.len(),
        c.thieves.len(),
        c.atoms.values().map(Vec::len).sum::<usize>(),
        c.hubs.len()
    );
    c
}
fn copy_tree(from: &Path, to: &Path) {
    fs::create_dir_all(to).unwrap();
    for entry in fs::read_dir(from).unwrap() {
        let entry = entry.unwrap();
        let source = entry.path();
        let target = to.join(entry.file_name());
        if source.is_dir() {
            copy_tree(&source, &target)
        } else {
            fs::copy(source, target).unwrap();
        }
    }
}
fn simulate(root: &Path, out: &Path) {
    let data = validate(root);
    let mut writer = csv::Writer::from_path(out).unwrap();
    writer
        .write_record([
            "mission_id",
            "difficulty",
            "dossier_fields_collected",
            "dossier_complete",
            "warrant_match",
            "total_case_minutes",
            "remaining_minutes",
            "deadline_pass",
            "estimated_case_award",
        ])
        .unwrap();
    for m in data.missions.values() {
        let route = data.route(m).unwrap();
        let p = &data.profiles[&m.thief_id];
        let mut s = GameState {
            version: 1,
            mission_id: m.mission_id.clone(),
            thief_id: m.thief_id.clone(),
            difficulty: m.difficulty,
            stage: 0,
            state: route[0].clone(),
            route: route.clone(),
            elapsed: 0,
            score: [0, 500, 650, 800, 1000, 1250][m.difficulty as usize],
            career_points: 0,
            dossier: BTreeMap::new(),
            observations: BTreeMap::new(),
            replay: vec![],
            outcome: None,
        };
        for (k, v) in p.traits() {
            s = apply(
                s,
                Command::VisitVenue {
                    trait_name: k.into(),
                    trait_value: v.into(),
                    minutes: 45,
                },
            )
            .unwrap()
            .0;
            s = apply(
                s,
                Command::RecordTrait {
                    trait_name: k.into(),
                    value: v.into(),
                },
            )
            .unwrap()
            .0;
        }
        for destination in &route[1..] {
            let minutes = if destination == &s.state {
                90
            } else {
                data.travel[&(s.state.clone(), destination.clone())].travel_minutes
            };
            s = apply(
                s,
                Command::Travel {
                    destination: destination.clone(),
                    minutes,
                },
            )
            .unwrap()
            .0;
        }
        s = apply(
            s,
            Command::RequestWarrant {
                suspect_id: Some(m.thief_id.clone()),
            },
        )
        .unwrap()
        .0;
        let before = s.elapsed;
        let (result, events) = apply(
            s,
            Command::Arrest {
                suspect_id: m.thief_id.clone(),
            },
        )
        .unwrap();
        let award = events[0].data.get("award").cloned().unwrap_or_default();
        writer
            .write_record([
                m.mission_id.clone(),
                m.difficulty.to_string(),
                result.dossier.len().to_string(),
                (result.dossier.len() == 8)
                    .then_some("yes")
                    .unwrap_or("no")
                    .into(),
                (result.outcome.as_deref() == Some("solved"))
                    .then_some("yes")
                    .unwrap_or("no")
                    .into(),
                result.elapsed.to_string(),
                10080u32.saturating_sub(result.elapsed).to_string(),
                (result.elapsed < 10080)
                    .then_some("yes")
                    .unwrap_or("no")
                    .into(),
                award,
            ])
            .unwrap();
        let _ = before;
    }
    writer.flush().unwrap();
    println!(
        "Simulated {} missions into {}",
        data.missions.len(),
        out.display()
    );
}
fn editorial(root: &Path) {
    let data = validate(root);
    let mut sensitive = 0;
    let mut sourced = 0;
    for atoms in data.atoms.values() {
        for a in atoms {
            if !a.dialogue.trim().is_empty() {
                sourced += 1
            }
            if a.dialogue.to_lowercase().contains("civil war") {
                sensitive += 1
            }
        }
    }
    println!(
        "Editorial catalogue: {sourced} populated clue accounts; {sensitive} text-sensitive accounts detected by the Rust guard. Human review remains required where CSV metadata says so."
    );
}
fn enrichment(root: &Path) {
    validate(root);
    let mut reader = csv::Reader::from_path(root.join("data/knowledge/knowledge.csv")).unwrap();
    let mut domains = BTreeMap::<String, usize>::new();
    let mut topics = BTreeSet::new();
    let mut unsourced = 0usize;
    for row in reader.records() {
        let row = row.unwrap();
        *domains.entry(row[1].to_owned()).or_default() += 1;
        topics.insert(row[2].to_owned());
        if row[7].trim().is_empty() {
            unsourced += 1;
        }
    }
    println!(
        "Knowledge coverage: {} domains, {} topics, {} records without source metadata",
        domains.len(),
        topics.len(),
        unsourced
    );
    for (domain, count) in domains {
        println!("  {domain}: {count}");
    }
}
fn main() {
    let root = root();
    let args = env::args().skip(1).collect::<Vec<_>>();
    match args.first().map(String::as_str).unwrap_or("validate") {
        "validate" => {
            validate(&root);
        }
        "simulate" => simulate(
            &root,
            &args
                .get(1)
                .map(PathBuf::from)
                .unwrap_or_else(|| root.join("data/gameplay/mission-balance-report-rust.csv")),
        ),
        "editorial" => editorial(&root),
        "enrichment" => enrichment(&root),
        "export" => {
            let target = args
                .get(1)
                .map(PathBuf::from)
                .unwrap_or_else(|| root.join("build/content-export"));
            validate(&root);
            copy_tree(&root.join("data"), &target);
            println!("Exported canonical catalogue to {}", target.display());
        }
        other => {
            eprintln!(
                "Unknown command {other}. Use validate, simulate, editorial, enrichment, or export."
            );
            std::process::exit(2)
        }
    }
}
