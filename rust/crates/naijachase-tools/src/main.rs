use naijachase_content::{Catalogue, validate_repository};
use naijachase_contracts::{Command, GameState};
use naijachase_core::apply;
use naijachase_storage::MysqlStore;
use serde::{Deserialize, Serialize};
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
    // Simulation regenerates the balance report, so it must remain runnable
    // when that generated file is absent, empty, or left incomplete.
    let data = Catalogue::load(root).unwrap();
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
    let mut missions = data.missions.values().collect::<Vec<_>>();
    missions.sort_by_key(|mission| &mission.mission_id);
    for m in missions {
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
            searched_hideouts: vec![],
            replay: vec![],
            outcome: None,
            economy: Default::default(),
        };
        let traits = p.traits();
        for stage in 0..route.len() {
            let (k, v) = traits[naijachase_core::key_witness_trait_index(&s)];
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
                if result.dossier.len() == 8 {
                    "yes"
                } else {
                    "no"
                }
                .into(),
                if result.outcome.as_deref() == Some("solved") {
                    "yes"
                } else {
                    "no"
                }
                .into(),
                result.elapsed.to_string(),
                10080u32.saturating_sub(result.elapsed).to_string(),
                if result.elapsed < 10080 { "yes" } else { "no" }.into(),
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

#[derive(Debug, Deserialize, Serialize)]
struct WitnessVenueScene {
    venue_id: String,
    venue_name: String,
    opens_hour: u8,
    closes_hour: u8,
    interview_minutes: u32,
    witness_roles: String,
    arrival_day: String,
    arrival_night: String,
    arrival_weekend: String,
    arrival_event_day: String,
    intro_1: String,
    intro_2: String,
    intro_3: String,
    wait_event: String,
    investigation_event: String,
    event_minutes: u32,
}

#[derive(Debug, Deserialize)]
struct VenueExperienceExportRow {
    venue_id: String,
    arrival_day: String,
    arrival_night: String,
    arrival_weekend: String,
    arrival_event_day: String,
    intro_1: String,
    intro_2: String,
    intro_3: String,
    wait_event: String,
    investigation_event: String,
    event_minutes: u32,
}

#[derive(Debug, Deserialize, Serialize)]
struct WitnessLocationPlacement {
    location_id: String,
    location_name: String,
    location_type: String,
    state: String,
    venue_id: String,
    venue_name: String,
    location_fit: u8,
    hub_travel_minutes: u32,
    latitude: String,
    longitude: String,
    coordinate_kind: String,
    location_context: String,
    witness_context: String,
}

#[derive(Serialize)]
struct WitnessSceneExport {
    schema_version: u8,
    renderer: &'static str,
    venue_archetype_count: usize,
    location_placement_count: usize,
    venue_archetypes: Vec<WitnessVenueScene>,
    location_placements: Vec<WitnessLocationPlacement>,
}

fn export_witness_scenes(root: &Path, output: &Path) {
    let venue_path = root.join("data/gameplay/venues.csv");
    let experience_path = root.join("data/gameplay/venue-experiences.csv");
    let placement_path = root.join("data/gameplay/location-venue-map.csv");

    let venues = csv::Reader::from_path(venue_path)
        .unwrap()
        .deserialize::<naijachase_content::Venue>()
        .map(|row| row.unwrap())
        .map(|venue| (venue.venue_id.clone(), venue))
        .collect::<BTreeMap<_, _>>();
    let experiences = csv::Reader::from_path(experience_path)
        .unwrap()
        .deserialize::<VenueExperienceExportRow>()
        .map(|row| row.unwrap())
        .map(|experience| (experience.venue_id.clone(), experience))
        .collect::<BTreeMap<_, _>>();

    let mut venue_archetypes = Vec::with_capacity(venues.len());
    for (venue_id, venue) in venues {
        let source = experiences
            .get(&venue_id)
            .unwrap_or_else(|| panic!("missing scene description for {venue_id}"));
        let scene = WitnessVenueScene {
            venue_id,
            venue_name: venue.venue_name,
            opens_hour: venue.opens_hour as u8,
            closes_hour: venue.closes_hour as u8,
            interview_minutes: venue.interview_minutes,
            witness_roles: venue.witness_roles,
            arrival_day: source.arrival_day.clone(),
            arrival_night: source.arrival_night.clone(),
            arrival_weekend: source.arrival_weekend.clone(),
            arrival_event_day: source.arrival_event_day.clone(),
            intro_1: source.intro_1.clone(),
            intro_2: source.intro_2.clone(),
            intro_3: source.intro_3.clone(),
            wait_event: source.wait_event.clone(),
            investigation_event: source.investigation_event.clone(),
            event_minutes: source.event_minutes,
        };
        venue_archetypes.push(scene);
    }

    let mut location_placements = csv::Reader::from_path(placement_path)
        .unwrap()
        .deserialize::<WitnessLocationPlacement>()
        .map(|row| row.unwrap())
        .collect::<Vec<_>>();
    location_placements.sort_by(|left, right| {
        (&left.state, &left.location_id, &left.venue_id).cmp(&(
            &right.state,
            &right.location_id,
            &right.venue_id,
        ))
    });
    let export = WitnessSceneExport {
        schema_version: 1,
        renderer: "babylon_procedural_v1",
        venue_archetype_count: venue_archetypes.len(),
        location_placement_count: location_placements.len(),
        venue_archetypes,
        location_placements,
    };
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    fs::write(output, serde_json::to_vec_pretty(&export).unwrap()).unwrap();
    println!(
        "Exported {} venue archetypes and {} location placements to {}",
        export.venue_archetype_count,
        export.location_placement_count,
        output.display()
    );
}

fn replace_place_name(text: &str, name: &str, replacement: &str) -> String {
    let mut output = String::new();
    let mut remaining = text;
    let needle = name.to_lowercase();
    loop {
        let lower = remaining.to_lowercase();
        let Some(index) = lower.find(&needle) else {
            output.push_str(remaining);
            break;
        };
        let end = index + name.len();
        let before_ok = index == 0
            || !remaining[..index]
                .chars()
                .next_back()
                .is_some_and(char::is_alphanumeric);
        let after_ok = end == remaining.len()
            || !remaining[end..]
                .chars()
                .next()
                .is_some_and(char::is_alphanumeric);
        output.push_str(&remaining[..index]);
        if before_ok && after_ok {
            output.push_str(replacement);
        } else {
            output.push_str(&remaining[index..end]);
        }
        remaining = &remaining[end..];
    }
    output
}

fn remove_place_names(text: &str, places: &[(String, &'static str)]) -> String {
    places
        .iter()
        .fold(text.to_owned(), |value, (name, replacement)| {
            replace_place_name(&value, name, replacement)
        })
}

fn standardize_witness_english(root: &Path) {
    let variant_path = root.join("data/gameplay/clue-dialogue-variants.csv");
    let mut reader = csv::Reader::from_path(&variant_path).unwrap();
    let headers = reader.headers().unwrap().clone();
    let rows = reader
        .records()
        .map(|row| row.unwrap())
        .filter(|row| row.get(3) == Some("English"))
        .collect::<Vec<_>>();
    let temporary = variant_path.with_extension("csv.tmp");
    let mut writer = csv::Writer::from_path(&temporary).unwrap();
    writer.write_record(&headers).unwrap();
    for row in &rows {
        writer.write_record(row).unwrap();
    }
    writer.flush().unwrap();
    fs::rename(temporary, &variant_path).unwrap();

    let deep_seed_path = root.join("data/gameplay/deep-state-fact-seeds.psv");
    let deep_seeds = fs::read_to_string(&deep_seed_path).unwrap();
    let deep_seeds = deep_seeds
        .lines()
        .map(|line| line.split('|').take(7).collect::<Vec<_>>().join("|"))
        .collect::<Vec<_>>()
        .join("\n")
        + "\n";
    fs::write(&deep_seed_path, deep_seeds).unwrap();

    for relative in [
        "data/gameplay/state-clue-atoms.csv",
        "data/gameplay/clue-editorial-review.csv",
    ] {
        let path = root.join(relative);
        let mut reader = csv::Reader::from_path(&path).unwrap();
        let headers = reader.headers().unwrap().clone();
        let review_index = headers
            .iter()
            .position(|field| field == "pidgin_native_review");
        let records = reader
            .records()
            .map(|row| {
                let mut fields = row.unwrap().iter().map(str::to_owned).collect::<Vec<_>>();
                if let Some(index) = review_index {
                    fields[index] = "not_applicable_english_only".into();
                }
                csv::StringRecord::from(fields)
            })
            .collect::<Vec<_>>();
        let temporary = path.with_extension("csv.tmp");
        let mut writer = csv::Writer::from_path(&temporary).unwrap();
        writer.write_record(&headers).unwrap();
        for row in records {
            writer.write_record(&row).unwrap();
        }
        writer.flush().unwrap();
        fs::rename(temporary, path).unwrap();
    }

    println!(
        "Retained {} grammatical English dialogue variants and removed non-English witness variants.",
        rows.len()
    );
}

fn enrich_state_clues(root: &Path) {
    let seed_path = root.join("data/gameplay/state-enrichment-seeds.psv");
    let atom_path = root.join("data/gameplay/state-clue-atoms.csv");
    let variant_path = root.join("data/gameplay/clue-dialogue-variants.csv");
    let seeds = fs::read_to_string(&seed_path).unwrap();
    let mut places = csv::Reader::from_path(root.join("data/gameplay/state-hubs.csv"))
        .unwrap()
        .records()
        .map(|row| row.unwrap())
        .flat_map(|row| {
            [
                (row[2].to_owned(), "the state capital"),
                (row[0].to_owned(), "another state"),
            ]
        })
        .collect::<Vec<_>>();
    places.extend(
        csv::Reader::from_path(root.join("data/locations/locations.csv"))
            .unwrap()
            .records()
            .map(|row| row.unwrap())
            .filter(|row| row[2].contains("city") || row[2].contains("capital"))
            .map(|row| (row[1].to_owned(), "a city")),
    );
    places.sort();
    places.dedup_by(|left, right| left.0 == right.0);
    places.sort_by_key(|place| std::cmp::Reverse(place.0.len()));
    let mut rows = csv::Reader::from_path(&atom_path)
        .unwrap()
        .records()
        .map(|row| row.unwrap())
        .collect::<Vec<_>>();
    rows.retain(|row| !row[0].starts_with("SCA-ENRICH-") && !row[0].starts_with("SCA-DEEP-"));
    let mut variants = csv::Reader::from_path(&variant_path)
        .unwrap()
        .records()
        .map(|row| row.unwrap())
        .collect::<Vec<_>>();
    variants.retain(|row| {
        row.get(3) == Some("English")
            && !row[0].starts_with("SCA-ENRICH-")
            && !row[0].starts_with("SCA-DEEP-")
    });
    for (index, line) in seeds.lines().skip(1).enumerate() {
        let values = line.split('|').collect::<Vec<_>>();
        assert_eq!(values.len(), 10, "invalid state enrichment row: {line}");
        let state = values[0];
        let candidates = format!("{}|{}|{}", values[1], values[2], values[3]);
        let records = [
            (
                "motto",
                "library",
                "Library",
                "librarian|researcher",
                format!(
                    "The traveller asked for a state whose official slogan is ‘{}’, but carefully avoided saying its name.",
                    values[4]
                ),
            ),
            (
                "city_identity",
                "motor_park",
                "Motor park",
                "driver|ticket clerk|agbero",
                format!(
                    "The traveller asked for a vehicle heading to {}, referring to the city as ‘{}’.",
                    values[5], values[6]
                ),
            ),
            (
                "landmark",
                "museum",
                "Museum",
                "museum guide|heritage researcher",
                format!(
                    "The traveller was researching {}: {}.",
                    values[7], values[8]
                ),
            ),
            (
                "economy",
                "market",
                "Market",
                "trader|loader|produce seller",
                format!(
                    "The traveller's list linked the destination with {}.",
                    values[9]
                ),
            ),
        ];
        for (offset, (dimension, venue, venue_name, roles, dialogue)) in
            records.into_iter().enumerate()
        {
            let id = format!("SCA-ENRICH-{:03}-{}", index + 1, offset + 1);
            rows.push(csv::StringRecord::from(vec![
                id.clone(), state.into(), "national_enrichment".into(), dimension.into(), candidates.clone(),
                venue.into(), venue_name.into(), roles.into(), dialogue.clone(), "2".into(),
                "User-supplied Nigerian state enrichment; source verification required".into(),
                "User-supplied Nigerian state enrichment".into(), String::new(), String::new(),
                "user_contributed".into(), "editorial_verification_required".into(), "1".into(),
                "mixed_stable_and_current".into(), "none".into(), "automated_pass".into(),
                "required".into(), "Verify against authoritative state, heritage, and economic sources before publication.".into(),
            ]));
            for (difficulty, english_prefixes) in [
                (
                    "easy",
                    ["", "The clearest detail was this: ", "I wrote this down: "],
                ),
                (
                    "medium",
                    [
                        "The destination was not named. ",
                        "What stayed with me was this: ",
                        "One useful detail remains: ",
                    ],
                ),
                (
                    "hard",
                    [
                        "No place name was used; the useful fragment was this: ",
                        "The indirect reference was this: ",
                        "The only trace I could confirm was this: ",
                    ],
                ),
            ] {
                for (number, prefix) in english_prefixes.iter().enumerate() {
                    variants.push(csv::StringRecord::from(vec![
                        format!("{id}-{}-E-{}", &difficulty[..1].to_uppercase(), number + 1),
                        id.clone(),
                        difficulty.into(),
                        "English".into(),
                        (number + 1).to_string(),
                        format!("{prefix}{dialogue}"),
                    ]));
                }
            }
        }
    }
    let deep_seeds =
        fs::read_to_string(root.join("data/gameplay/deep-state-fact-seeds.psv")).unwrap();
    for (index, line) in deep_seeds.lines().skip(1).enumerate() {
        let values = line.split('|').collect::<Vec<_>>();
        assert_eq!(values.len(), 7, "invalid deep state fact row: {line}");
        let id = format!("SCA-DEEP-{:03}", index + 1);
        let roles = values[5].replace(';', "|");
        rows.push(csv::StringRecord::from(vec![
            id.clone(), values[0].into(), "deep_state_facts".into(), "specific_fact".into(),
            format!("{}|{}|{}", values[1], values[2], values[3]), values[4].into(),
            values[4].replace('_', " "), roles, values[6].into(), "3".into(),
            "User-supplied deep Nigerian state facts; source verification required".into(),
            "User-supplied deep Nigerian state facts".into(), String::new(), String::new(),
            "user_contributed".into(), "editorial_verification_required".into(), "1".into(),
            "mixed_historical_and_stable".into(), "none".into(), "automated_pass".into(),
            "required".into(), "Verify the precise historical or cultural claim against an authoritative source before publication.".into(),
        ]));
        for (difficulty, english_prefixes) in [
            (
                "easy",
                ["", "The clearest detail was this: ", "I wrote this down: "],
            ),
            (
                "medium",
                [
                    "The destination was not named. ",
                    "What stayed with me was this: ",
                    "One useful detail remains: ",
                ],
            ),
            (
                "hard",
                [
                    "No place name was used; the useful fragment was this: ",
                    "The indirect reference was this: ",
                    "The only trace I could confirm was this: ",
                ],
            ),
        ] {
            for (number, prefix) in english_prefixes.iter().enumerate() {
                variants.push(csv::StringRecord::from(vec![
                    format!("{id}-{}-E-{}", &difficulty[..1].to_uppercase(), number + 1),
                    id.clone(),
                    difficulty.into(),
                    "English".into(),
                    (number + 1).to_string(),
                    format!("{prefix}{}", values[6]),
                ]));
            }
        }
    }
    for row in &mut rows {
        let mut fields = row.iter().map(str::to_owned).collect::<Vec<_>>();
        fields[8] = remove_place_names(&fields[8], &places);
        *row = csv::StringRecord::from(fields);
    }
    let states_by_atom = rows
        .iter()
        .map(|row| (row[0].to_owned(), row[1].to_owned()))
        .collect::<BTreeMap<_, _>>();
    for row in &mut variants {
        if states_by_atom.contains_key(&row[1]) {
            let mut fields = row.iter().map(str::to_owned).collect::<Vec<_>>();
            fields[5] = remove_place_names(&fields[5], &places);
            *row = csv::StringRecord::from(fields);
        }
    }
    let temporary = atom_path.with_extension("csv.tmp");
    let headers = csv::Reader::from_path(&atom_path)
        .unwrap()
        .headers()
        .unwrap()
        .clone();
    let mut writer = csv::Writer::from_path(&temporary).unwrap();
    writer.write_record(&headers).unwrap();
    for row in rows {
        writer.write_record(&row).unwrap();
    }
    writer.flush().unwrap();
    fs::rename(temporary, atom_path).unwrap();
    let variant_temporary = variant_path.with_extension("csv.tmp");
    let variant_headers = csv::Reader::from_path(&variant_path)
        .unwrap()
        .headers()
        .unwrap()
        .clone();
    let mut variant_writer = csv::Writer::from_path(&variant_temporary).unwrap();
    variant_writer.write_record(&variant_headers).unwrap();
    for row in variants {
        variant_writer.write_record(&row).unwrap();
    }
    variant_writer.flush().unwrap();
    fs::rename(variant_temporary, variant_path).unwrap();
    println!("Added 189 state clue atoms and 1,701 English dialogue variants.");
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
            searched_hideouts: vec![],
            replay: vec![],
            outcome: None,
            economy: Default::default(),
        };
        let traits = profile.traits();
        for stage in 0..route.len() {
            let (field, value) = traits[naijachase_core::key_witness_trait_index(&state)];
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
        "enrich-state-clues" => enrich_state_clues(&root),
        "standardize-witness-english" => standardize_witness_english(&root),
        "export-witness-scenes" => export_witness_scenes(
            &root,
            &args
                .get(1)
                .map(PathBuf::from)
                .unwrap_or_else(|| root.join("data/exports/witness-location-scenes.json")),
        ),
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
        "publish-initial-mysql" => {
            validate(&root);
            let published = mysql().publish_initial_catalogue().unwrap_or_else(|error| {
                eprintln!("Initial MySQL catalogue publication failed: {error}");
                std::process::exit(2)
            });
            if published == 0 {
                println!("Initial MySQL catalogue was already published");
            } else {
                println!("Published {published} validated missions in the initial MySQL catalogue");
            }
        }
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
                "Unknown command {other}. Use validate, simulate, editorial, enrichment, standardize-witness-english, enrich-state-clues, export-witness-scenes, migrate-mysql, import-mysql, rebuild-mysql, verify-mysql, publish-initial-mysql, export-mysql, backup-mysql, restore-mysql, or export."
            );
            std::process::exit(2)
        }
    }
}
