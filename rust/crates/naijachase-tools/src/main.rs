use naijachase_content::{Catalogue, validate_repository};
use naijachase_contracts::{Command, GameState};
use naijachase_core::apply;
use naijachase_storage::MysqlStore;
use std::{
    collections::{BTreeMap, BTreeSet},
    env, fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
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
            visited_venues: vec![],
            warrant_suspect: None,
            hideout_venue: "market".into(),
            replay: vec![],
            outcome: None,
        };
        let traits = p.traits();
        for stage in 0..route.len() {
            let (k, v) = traits[stage];
            for witness in 0..3 {
                s = apply(
                    s,
                    Command::VisitVenue {
                        venue_id: format!("venue-{stage}-{witness}"),
                        trait_name: if witness == 0 {
                            k.into()
                        } else {
                            String::new()
                        },
                        trait_value: if witness == 0 {
                            v.into()
                        } else {
                            String::new()
                        },
                        minutes: 250,
                    },
                )
                .unwrap()
                .0;
            }
            s = apply(
                s,
                Command::RecordTrait {
                    trait_name: k.into(),
                    value: v.into(),
                },
            )
            .unwrap()
            .0;
            if stage + 1 < route.len() {
                let destination = &route[stage + 1];
                let minutes = data.travel[&(s.state.clone(), destination.clone())].travel_minutes;
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
        }
        s = apply(
            s,
            Command::RequestWarrant {
                suspect_id: Some(m.thief_id.clone()),
            },
        )
        .unwrap()
        .0;
        let (result, events) = apply(
            s,
            Command::SearchHideout {
                venue_id: "market".into(),
                minutes: 45,
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
fn mysql() -> MysqlStore {
    let store = MysqlStore::connect_from_env().unwrap_or_else(|error| {
        eprintln!("MySQL configuration or connection error: {error}");
        std::process::exit(2)
    });
    store.migrate().unwrap_or_else(|error| {
        eprintln!("MySQL migration error: {error}");
        std::process::exit(2)
    });
    store
}

fn verify_database_parity(root: &Path, store: &MysqlStore) {
    let summary = store.verify_content(root).unwrap_or_else(|error| {
        eprintln!("MySQL content verification failed: {error}");
        std::process::exit(2)
    });
    let suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let export_root = env::temp_dir().join(format!("naijachase-db-verify-{suffix}"));
    store.export_content(&export_root).unwrap();
    let canonical = Catalogue::load(root).unwrap();
    let database = Catalogue::load(&export_root).unwrap_or_else(|error| {
        eprintln!("Database-exported catalogue did not load: {error}");
        std::process::exit(2)
    });
    assert_eq!(canonical.missions.len(), database.missions.len());
    for (id, mission) in &canonical.missions {
        let restored = &database.missions[id];
        assert_eq!(
            canonical.route(mission).unwrap(),
            database.route(restored).unwrap(),
            "{id}"
        );
        assert_eq!(mission.thief_id, restored.thief_id, "{id}");
        assert_eq!(mission.difficulty, restored.difficulty, "{id}");
    }
    let solved = solved_outcomes(&database);
    let _ = fs::remove_dir_all(&export_root);
    println!(
        "MySQL parity verified: {} files, {} rows, {} identical mission outcomes",
        summary.files, summary.rows, solved
    );
}

fn solved_outcomes(data: &Catalogue) -> usize {
    let mut solved = 0;
    for mission in data.missions.values() {
        let route = data.route(mission).unwrap();
        let profile = &data.profiles[&mission.thief_id];
        let mut state = GameState {
            version: 1,
            mission_id: mission.mission_id.clone(),
            thief_id: mission.thief_id.clone(),
            difficulty: mission.difficulty,
            stage: 0,
            state: route[0].clone(),
            route: route.clone(),
            elapsed: 0,
            score: 1250,
            career_points: 0,
            dossier: BTreeMap::new(),
            observations: BTreeMap::new(),
            visited_venues: vec![],
            warrant_suspect: None,
            hideout_venue: "market".into(),
            replay: vec![],
            outcome: None,
        };
        let traits = profile.traits();
        for stage in 0..route.len() {
            let (field, value) = traits[stage];
            for witness in 0..3 {
                state = apply(
                    state,
                    Command::VisitVenue {
                        venue_id: format!("db-{stage}-{witness}"),
                        trait_name: if witness == 0 {
                            field.into()
                        } else {
                            String::new()
                        },
                        trait_value: if witness == 0 {
                            value.into()
                        } else {
                            String::new()
                        },
                        minutes: 200,
                    },
                )
                .unwrap()
                .0;
            }
            state = apply(
                state,
                Command::RecordTrait {
                    trait_name: field.into(),
                    value: value.into(),
                },
            )
            .unwrap()
            .0;
            if stage + 1 < route.len() {
                let destination = route[stage + 1].clone();
                let minutes =
                    data.travel[&(state.state.clone(), destination.clone())].travel_minutes;
                state = apply(
                    state,
                    Command::Travel {
                        destination,
                        minutes,
                    },
                )
                .unwrap()
                .0;
            }
        }
        state = apply(
            state,
            Command::RequestWarrant {
                suspect_id: Some(mission.thief_id.clone()),
            },
        )
        .unwrap()
        .0;
        state = apply(
            state,
            Command::SearchHideout {
                venue_id: "market".into(),
                minutes: 45,
            },
        )
        .unwrap()
        .0;
        if state.outcome.as_deref() == Some("solved") {
            solved += 1;
        }
    }
    assert_eq!(solved, data.missions.len());
    solved
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
        "migrate-mysql" => {
            let store = mysql();
            println!(
                "MySQL schema is at version {}",
                store.schema_version().unwrap()
            );
        }
        "import-mysql" => {
            validate(&root);
            let summary = mysql().import_content(&root).unwrap();
            println!(
                "Imported {} CSV files and {} rows into MySQL",
                summary.files, summary.rows
            );
        }
        "rebuild-mysql" => {
            validate(&root);
            let store = mysql();
            let summary = store.import_content(&root).unwrap();
            println!(
                "Rebuilt MySQL content from {} files and {} rows",
                summary.files, summary.rows
            );
            verify_database_parity(&root, &store);
        }
        "verify-mysql" => verify_database_parity(&root, &mysql()),
        "export-mysql" => {
            let target = args
                .get(1)
                .map(PathBuf::from)
                .unwrap_or_else(|| root.join("build/mysql-export"));
            let summary = mysql().export_content(&target).unwrap();
            println!(
                "Exported {} MySQL content files and {} rows to {}",
                summary.files,
                summary.rows,
                target.display()
            );
        }
        "backup-mysql" => {
            let target = args
                .get(1)
                .map(PathBuf::from)
                .unwrap_or_else(|| root.join("build/backups/operational.json"));
            mysql().backup_operational(&target).unwrap();
            println!("Backed up mutable MySQL data to {}", target.display());
        }
        "restore-mysql" => {
            let source = args
                .get(1)
                .map(PathBuf::from)
                .unwrap_or_else(|| root.join("build/backups/operational.json"));
            mysql().restore_operational(&source).unwrap();
            println!("Restored mutable MySQL data from {}", source.display());
        }
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
                "Unknown command {other}. Use validate, simulate, editorial, enrichment, migrate-mysql, import-mysql, rebuild-mysql, verify-mysql, export-mysql, backup-mysql, restore-mysql, or export."
            );
            std::process::exit(2)
        }
    }
}
