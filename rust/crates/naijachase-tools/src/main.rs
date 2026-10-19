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

fn lowercase_first(text: &str) -> String {
    let mut characters = text.chars();
    let Some(first) = characters.next() else {
        return String::new();
    };
    first.to_lowercase().collect::<String>() + characters.as_str()
}

fn traveller_voice(text: &str) -> String {
    text.strip_prefix("He ")
        .map(|rest| format!("The traveller {rest}"))
        .unwrap_or_else(|| text.to_owned())
}

fn replace_variant_core(dialogue: &str, old: &str, new: &str) -> String {
    let candidates = [
        (old.to_owned(), new.to_owned()),
        (lowercase_first(old), lowercase_first(new)),
        (traveller_voice(old), traveller_voice(new)),
    ];
    for (old_form, new_form) in candidates {
        if dialogue.contains(&old_form) {
            return dialogue.replacen(&old_form, &new_form, 1);
        }
    }
    panic!("dialogue variant no longer contains its clue atom: {dialogue}");
}

fn repair_witness_dialogues(root: &Path) {
    let atom_path = root.join("data/gameplay/state-clue-atoms.csv");
    let variant_path = root.join("data/gameplay/clue-dialogue-variants.csv");
    let repairs = BTreeMap::from([
        (
            "SCA-P0-NORTH-WEST-KADUNA-10",
            "He compared the planned avenues of the state capital with the walls and gates of an older emirate city.",
        ),
        (
            "SCA-0016",
            "He wanted a vehicle heading far northwest, beyond the usual routes through two larger northern hubs.",
        ),
        (
            "SCA-P0-NORTH-EAST-BAUCHI-02",
            "He studied an emirate founded during the nineteenth-century jihad that reshaped the northern emirates.",
        ),
        (
            "SCA-P0-NORTH-EAST-BAUCHI-08",
            "He wanted a state capital lying between a highland city to the west and a savannah city to the east.",
        ),
        (
            "SCA-0024",
            "He requested music and stories from riverine communities in the eastern wetlands.",
        ),
        (
            "SCA-P0-SOUTH-SOUTH-RIVERS-01",
            "He asked about refinery complexes and petroleum services around a major riverine city.",
        ),
        (
            "SCA-P0-SOUTH-SOUTH-RIVERS-08",
            "He studied mangroves, tidal creeks and pollution pressures in the eastern wetlands.",
        ),
        (
            "SCA-P0-SOUTH-SOUTH-RIVERS-09",
            "He studied the capture of a major port city and the struggle over the eastern wetlands during the civil war.",
        ),
        (
            "SCA-P0-SOUTH-SOUTH-RIVERS-10",
            "He requested environmental writing and fiction rooted in Ogoni and the wider riverine experience.",
        ),
        (
            "SCA-0027",
            "He bought smoked fish and asked about Ijaw communities in the central wetlands.",
        ),
        (
            "SCA-P0-SOUTH-SOUTH-BAYELSA-04",
            "He bought smoked fish, plantain and ingredients common in riverine cooking.",
        ),
        (
            "SCA-P0-SOUTH-SOUTH-BAYELSA-05",
            "He studied mangroves, floodplains and habitats of the central wetlands.",
        ),
        (
            "SCA-P0-SOUTH-SOUTH-BAYELSA-09",
            "He asked for poetry and environmental writing rooted in Ijaw life and the riverine region.",
        ),
        (
            "SCA-0031",
            "He wanted the western side of the riverine region rather than the major eastern port axis.",
        ),
        (
            "SCA-0032",
            "He asked for material about a historic coastal kingdom and its Olu.",
        ),
        (
            "SCA-P0-SOUTH-SOUTH-DELTA-01",
            "He followed petroleum refining and shipping around a major western riverine city.",
        ),
        (
            "SCA-P0-SOUTH-SOUTH-DELTA-03",
            "He researched the Olu and a historic coastal kingdom.",
        ),
        (
            "SCA-P0-SOUTH-SOUTH-DELTA-04",
            "He wanted the western side of the riverine region rather than the major eastern port axis.",
        ),
        (
            "SCA-P0-SOUTH-SOUTH-DELTA-05",
            "He traced trade and diplomacy between a coastal kingdom and Atlantic visitors.",
        ),
        (
            "SCA-P0-SOUTH-SOUTH-DELTA-08",
            "He asked for a state containing both a riverbank capital and a commercial city nearer the coast.",
        ),
        (
            "SCA-P0-SOUTH-SOUTH-DELTA-10",
            "He requested highlife and riverine music associated with a western trading city in the wetlands.",
        ),
        (
            "SCA-P0-SOUTH-SOUTH-AKWA-IBOM-04",
            "He asked about Ekpe institutions shared with communities across a neighbouring coastal border.",
        ),
        (
            "SCA-0040",
            "He was looking for an old port city near the mouth of a major southeastern river.",
        ),
        (
            "SCA-P0-SOUTH-WEST-OSUN-06",
            "He looked for artists and workshops associated with a celebrated post-independence art movement.",
        ),
        (
            "SCA-0061",
            "He asked for the sprawling commercial market on the eastern bank of a major river.",
        ),
        (
            "SCA-0064",
            "He wanted the southeastern commercial state linked across a major river by a famous bridge.",
        ),
        (
            "SCA-P0-SOUTH-EAST-ANAMBRA-01",
            "He asked for an enormous market city on the eastern bank of a major river.",
        ),
        (
            "SCA-P0-SOUTH-EAST-ANAMBRA-06",
            "He watched traffic cross a major river between the southeast and a neighbouring riverbank capital.",
        ),
        (
            "SCA-P0-SOUTH-EAST-ABIA-09",
            "He asked about a city that became a wartime capital after an earlier regional capital fell.",
        ),
        (
            "SCA-P0-SOUTH-EAST-IMO-04",
            "He asked about the rolling countryside and waterways around the state capital.",
        ),
        (
            "SCA-0078",
            "He wanted the state whose northern edge reaches a neighbouring republic around a busy frontier market.",
        ),
        (
            "SCA-P0-NORTH-WEST-JIGAWA-06",
            "He asked for a market route near the northern frontier with a neighbouring republic.",
        ),
        (
            "SCA-0082",
            "He asked for the far northwestern state bordering two neighbouring countries.",
        ),
        (
            "SCA-0087",
            "He asked for a state capital on the road between two larger northwestern cities.",
        ),
        (
            "SCA-P0-NORTH-WEST-ZAMFARA-02",
            "He described a state touching a neighbouring republic to the north and a major northern state to the south.",
        ),
        (
            "SCA-P0-NORTH-WEST-ZAMFARA-03",
            "He asked for a capital on the corridor between two larger northwestern cities.",
        ),
        (
            "SCA-P0-NORTH-WEST-ZAMFARA-07",
            "He was following the artisanal gold trade rather than the tin fields of the central highlands.",
        ),
        (
            "SCA-0089",
            "He asked about a state stretching from an upper river valley toward the Cameroon border.",
        ),
        (
            "SCA-0092",
            "He wanted a vehicle to a state capital beside a major upper river.",
        ),
        (
            "SCA-P0-NORTH-EAST-ADAMAWA-01",
            "He asked about the former capital of an old emirate before a newer riverbank city became the main centre.",
        ),
        (
            "SCA-P0-NORTH-EAST-ADAMAWA-04",
            "He followed a major upper river through a capital built beside its banks.",
        ),
        (
            "SCA-P0-NORTH-EAST-ADAMAWA-09",
            "He compared Fulfulde with Bachama, Batta and other languages spoken along a major upper river.",
        ),
        (
            "SCA-P0-NORTH-EAST-ADAMAWA-10",
            "He asked for a federal university overlooking a major river valley in the state capital.",
        ),
        (
            "SCA-0093",
            "He asked about a long-lived Sahelian empire and the seat of its shehus.",
        ),
        (
            "SCA-P0-NORTH-EAST-BORNO-01",
            "He traced a long-lived Sahelian state across centuries of trade, scholarship and warfare.",
        ),
        (
            "SCA-P0-NORTH-EAST-BORNO-02",
            "He asked for the seat of the Shehu rather than a Fulani emirate established by a nineteenth-century jihad.",
        ),
        (
            "SCA-P0-NORTH-EAST-BORNO-07",
            "He wanted the Nigerian state touching three neighbouring countries near the Lake Chad basin.",
        ),
        (
            "SCA-P0-NORTH-EAST-BORNO-10",
            "He requested chronicles and scholarship concerning an old Sahelian empire and the Lake Chad world.",
        ),
        (
            "SCA-P0-NORTH-EAST-GOMBE-02",
            "He researched emirates and chiefdoms created where highland foothills meet the northeast.",
        ),
        (
            "SCA-P0-NORTH-EAST-GOMBE-05",
            "He described a small inland state enclosed by five neighbouring states.",
        ),
        (
            "SCA-0101",
            "He wanted high country with cool grassland, tea fields and winding mountain roads.",
        ),
        (
            "SCA-P0-NORTH-EAST-TARABA-01",
            "He wanted cool grasslands and tea fields on elevated tablelands.",
        ),
        (
            "SCA-P0-NORTH-EAST-TARABA-04",
            "He followed tributaries of a major river through a state named after one of those waterways.",
        ),
        (
            "SCA-P0-NORTH-EAST-TARABA-09",
            "He compared Mumuye, Jukun, Kuteb, Fulfulde and languages spoken from a major river valley to the highlands.",
        ),
        (
            "SCA-P0-NORTH-CENTRAL-BENUE-02",
            "He followed a major east-west river through the state capital on its way to a famous confluence.",
        ),
        (
            "SCA-P0-NORTH-CENTRAL-FEDERAL-CAPITAL-TERRITORY-06",
            "He wanted the federal territory enclosed by four neighbouring states.",
        ),
        (
            "SCA-0117",
            "He asked where Nigeria's two greatest waterways meet in a clearly visible confluence.",
        ),
        (
            "SCA-0120",
            "He asked about Igala traditions and communities east of a major river.",
        ),
        (
            "SCA-P0-NORTH-CENTRAL-KOGI-01",
            "He asked where two major waterways meet below a prominent hill.",
        ),
        (
            "SCA-P0-NORTH-CENTRAL-KOGI-09",
            "He compared Igala, Ebira and Okun Yoruba speech from different sides of a major river.",
        ),
        (
            "SCA-P0-NORTH-CENTRAL-KWARA-01",
            "He studied an emirate city with Yoruba foundations and strong links to a historic caliphate.",
        ),
        (
            "SCA-P0-NORTH-CENTRAL-KWARA-06",
            "He asked about sugarcane, rice and large farms around a major river valley.",
        ),
        (
            "SCA-P0-NORTH-CENTRAL-KWARA-08",
            "He followed a major river along the state's northern boundary near a historic crossing town.",
        ),
        (
            "SCA-P0-NORTH-CENTRAL-NASARAWA-06",
            "He researched an old emirate and trade routes toward a major river valley.",
        ),
        (
            "SCA-P0-NORTH-CENTRAL-NIGER-06",
            "He followed a major river past reservoirs, islands and fishing settlements.",
        ),
        (
            "SCA-0126",
            "He wanted a state capital east of the federal capital and north of a major river valley.",
        ),
        (
            "SCA-P0-NORTH-CENTRAL-NASARAWA-02",
            "He wanted a state capital east of the federal capital and north of a major river valley.",
        ),
        (
            "SCA-0136",
            "He wanted a highland state capital south of a tourism state and north of a mineral-rich state.",
        ),
        (
            "SCA-P0-NORTH-CENTRAL-PLATEAU-02",
            "He wanted cool weather, granite formations and views from broad tablelands.",
        ),
        (
            "SCA-P0-NORTH-CENTRAL-PLATEAU-08",
            "He wanted a highland state capital south of a tourism state and north of a mineral-rich state.",
        ),
        (
            "SCA-0140",
            "He wanted an ancient royal capital north of the oil-producing coast and west of a major river.",
        ),
        (
            "SCA-P0-SOUTH-SOUTH-EDO-08",
            "He wanted the state north of the oil-producing coast and west of a major river.",
        ),
        (
            "SCA-P0-SOUTH-EAST-EBONYI-07",
            "He researched old communities along a southeastern river hinterland.",
        ),
        (
            "SCA-P0-SOUTH-EAST-EBONYI-10",
            "He listened for speech varieties used around the state capital, an old cultural town and the southeastern borderlands.",
        ),
        (
            "SCA-ENRICH-008-3",
            "The traveller was researching a royal palace associated with Kanuri history and traditional architecture.",
        ),
        (
            "SCA-ENRICH-010-2",
            "The traveller asked about a city nicknamed ‘the Big Heart on the river’.",
        ),
        (
            "SCA-ENRICH-010-3",
            "The traveller was researching a colonial-era museum connected with exploration along a major river.",
        ),
        (
            "SCA-ENRICH-011-3",
            "The traveller was researching natural salt lakes central to the state's identity.",
        ),
        (
            "SCA-ENRICH-019-3",
            "The traveller was researching ancient city walls and gates around a historic Hausa city.",
        ),
        (
            "SCA-ENRICH-022-3",
            "The traveller was researching a confluence point where Nigeria's two greatest waterways meet.",
        ),
        (
            "SCA-ENRICH-026-2",
            "The traveller asked about a city promoted as both a power centre and a digital city.",
        ),
        (
            "SCA-ENRICH-029-3",
            "The traveller was researching a sacred grove of shrines and sculptures beside a river.",
        ),
        (
            "SCA-ENRICH-030-3",
            "The traveller was researching the administrative tower of Nigeria's oldest degree-awarding university.",
        ),
        (
            "SCA-ENRICH-031-2",
            "The traveller asked about a city known by a single-letter nickname and a playful entertainment-industry moniker.",
        ),
        (
            "SCA-ENRICH-033-3",
            "The traveller was researching the architectural seat of Nigeria's foremost Islamic traditional ruler.",
        ),
    ]);

    let mut atom_reader = csv::Reader::from_path(&atom_path).unwrap();
    let atom_headers = atom_reader.headers().unwrap().clone();
    let mut atoms = atom_reader
        .records()
        .map(|row| row.unwrap())
        .collect::<Vec<_>>();
    let mut old_by_atom = BTreeMap::new();
    for row in &mut atoms {
        let atom_id = row[0].to_owned();
        let old = row[8].to_owned();
        let mut new = repairs
            .get(atom_id.as_str())
            .map(|value| (*value).to_owned())
            .unwrap_or_else(|| old.clone());
        new = new.replace("another state", "a neighbouring state");
        if new != old {
            old_by_atom.insert(atom_id, (old, new.clone()));
            let mut fields = row.iter().map(str::to_owned).collect::<Vec<_>>();
            fields[8] = new;
            *row = csv::StringRecord::from(fields);
        }
    }
    assert_eq!(
        repairs.len(),
        repairs
            .keys()
            .filter(|id| atoms.iter().any(|row| row.get(0) == Some(id)))
            .count(),
        "repair table contains an unknown clue atom"
    );

    let mut variant_reader = csv::Reader::from_path(&variant_path).unwrap();
    let variant_headers = variant_reader.headers().unwrap().clone();
    let mut variants = variant_reader
        .records()
        .map(|row| row.unwrap())
        .collect::<Vec<_>>();
    for row in &mut variants {
        let Some((old, new)) = old_by_atom.get(&row[1]) else {
            continue;
        };
        let mut fields = row.iter().map(str::to_owned).collect::<Vec<_>>();
        fields[5] = replace_variant_core(&fields[5], old, new);
        *row = csv::StringRecord::from(fields);
    }

    let atom_temporary = atom_path.with_extension("csv.tmp");
    let mut atom_writer = csv::Writer::from_path(&atom_temporary).unwrap();
    atom_writer.write_record(&atom_headers).unwrap();
    for row in atoms {
        atom_writer.write_record(&row).unwrap();
    }
    atom_writer.flush().unwrap();
    fs::rename(atom_temporary, atom_path).unwrap();

    let variant_temporary = variant_path.with_extension("csv.tmp");
    let mut variant_writer = csv::Writer::from_path(&variant_temporary).unwrap();
    variant_writer.write_record(&variant_headers).unwrap();
    for row in variants {
        variant_writer.write_record(&row).unwrap();
    }
    variant_writer.flush().unwrap();
    fs::rename(variant_temporary, variant_path).unwrap();
    println!(
        "Repaired {} clue atoms and their dialogue variants.",
        old_by_atom.len()
    );
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
    repair_witness_dialogues(root);
}

fn append_english_variants(variants: &mut Vec<csv::StringRecord>, atom_id: &str, dialogue: &str) {
    for (difficulty, prefixes) in [
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
        for (number, prefix) in prefixes.iter().enumerate() {
            variants.push(csv::StringRecord::from(vec![
                format!(
                    "{atom_id}-{}-E-{}",
                    &difficulty[..1].to_uppercase(),
                    number + 1
                ),
                atom_id.to_owned(),
                difficulty.into(),
                "English".into(),
                (number + 1).to_string(),
                format!("{prefix}{dialogue}"),
            ]));
        }
    }
}

fn enrich_civic_history(root: &Path) {
    let civic_seed_path = root.join("data/gameplay/civic-history-seeds.psv");
    let event_seed_path = root.join("data/gameplay/national-event-clue-seeds.psv");
    let atom_path = root.join("data/gameplay/state-clue-atoms.csv");
    let variant_path = root.join("data/gameplay/clue-dialogue-variants.csv");

    let candidate_sets = fs::read_to_string(root.join("data/gameplay/state-enrichment-seeds.psv"))
        .unwrap()
        .lines()
        .skip(1)
        .map(|line| {
            let values = line.split('|').collect::<Vec<_>>();
            (
                values[0].to_owned(),
                [
                    values[1].to_owned(),
                    values[2].to_owned(),
                    values[3].to_owned(),
                ],
            )
        })
        .collect::<BTreeMap<_, _>>();

    let civic_lines = fs::read_to_string(&civic_seed_path).unwrap();
    let civic_seeds = civic_lines
        .lines()
        .skip(1)
        .map(|line| {
            let values = line.split('|').map(str::to_owned).collect::<Vec<_>>();
            assert_eq!(values.len(), 10, "invalid civic history row: {line}");
            values
        })
        .collect::<Vec<_>>();
    assert_eq!(
        civic_seeds.len(),
        37,
        "every jurisdiction needs civic-history seeds"
    );

    let mut creation_cohorts = BTreeMap::<String, Vec<String>>::new();
    for seed in &civic_seeds {
        creation_cohorts
            .entry(seed[2].clone())
            .or_default()
            .push(seed[0].clone());
    }

    let atom_headers = csv::Reader::from_path(&atom_path)
        .unwrap()
        .headers()
        .unwrap()
        .clone();
    let variant_headers = csv::Reader::from_path(&variant_path)
        .unwrap()
        .headers()
        .unwrap()
        .clone();
    let mut atoms = csv::Reader::from_path(&atom_path)
        .unwrap()
        .records()
        .map(|row| row.unwrap())
        .filter(|row| !row[0].starts_with("SCA-CIVIC-") && !row[0].starts_with("SCA-EVENT-"))
        .collect::<Vec<_>>();
    let mut variants = csv::Reader::from_path(&variant_path)
        .unwrap()
        .records()
        .map(|row| row.unwrap())
        .filter(|row| !row[0].starts_with("SCA-CIVIC-") && !row[0].starts_with("SCA-EVENT-"))
        .collect::<Vec<_>>();

    for (index, values) in civic_seeds.iter().enumerate() {
        let state = &values[0];
        let cohort = &creation_cohorts[&values[2]];
        let mut candidates = vec![state.clone()];
        candidates.extend(
            cohort
                .iter()
                .filter(|candidate| *candidate != state)
                .take(2)
                .cloned(),
        );
        if candidates.len() < 3 {
            let needed = 3 - candidates.len();
            let extras = candidate_sets[state]
                .iter()
                .filter(|candidate| !candidates.contains(candidate))
                .take(needed)
                .cloned()
                .collect::<Vec<_>>();
            candidates.extend(extras);
        }
        let cohort_candidates = candidates.join("|");
        let general_candidates = candidate_sets[state].join("|");
        let first_governor_dialogue = if values[5].is_empty() {
            "The traveller noted that this jurisdiction has no elected state governor and is administered by an appointed minister."
                .to_owned()
        } else {
            format!(
                "The traveller asked about the jurisdiction where {} became the first elected civilian governor in {}.",
                values[5], values[6]
            )
        };
        let records = [
            (
                "creation_year",
                "hotel",
                "Hotel",
                "receptionist|concierge",
                format!(
                    "The traveller compared a jurisdiction established in {} with others created during the same nationwide reorganisation.",
                    values[2]
                ),
                "1",
                cohort_candidates.as_str(),
            ),
            (
                "creation_date",
                "airport",
                "Airport",
                "traveller|check-in agent",
                format!(
                    "The traveller copied a founding date of {} but left the jurisdiction unnamed.",
                    values[1]
                ),
                "2",
                cohort_candidates.as_str(),
            ),
            (
                "state_formation",
                "police_station",
                "Police station",
                "detective|desk officer",
                format!(
                    "The traveller traced a jurisdiction that was {}.",
                    values[4]
                ),
                "2",
                general_candidates.as_str(),
            ),
            (
                "state_creation_regime",
                "hospital",
                "Hospital",
                "records clerk|security guard",
                format!(
                    "The traveller researched a jurisdiction created during {}'s national administration.",
                    values[3]
                ),
                "2",
                cohort_candidates.as_str(),
            ),
            (
                "first_civilian_governor",
                "hotel",
                "Hotel",
                "receptionist|concierge",
                first_governor_dialogue,
                "3",
                general_candidates.as_str(),
            ),
            (
                "constitutional_history",
                "airport",
                "Airport",
                "traveller|security officer",
                format!(
                    "The traveller linked the jurisdiction's political history to the fact that {}.",
                    values[7]
                ),
                "2",
                general_candidates.as_str(),
            ),
        ];
        for (offset, (dimension, venue_id, venue_name, roles, dialogue, difficulty, candidates)) in
            records.into_iter().enumerate()
        {
            let atom_id = format!("SCA-CIVIC-{:03}-{}", index + 1, offset + 1);
            atoms.push(csv::StringRecord::from(vec![
                atom_id.clone(),
                state.clone(),
                "civic_history".into(),
                dimension.into(),
                candidates.into(),
                venue_id.into(),
                venue_name.into(),
                roles.into(),
                dialogue.clone(),
                difficulty.into(),
                "Nigerian state creation and early-governance research".into(),
                "Civic history seed catalogue".into(),
                String::new(),
                if dimension == "first_civilian_governor" {
                    values[9].clone()
                } else {
                    values[8].clone()
                },
                "official_state_and_reference_sources".into(),
                "source_attached_line_check_required".into(),
                "2".into(),
                "historical".into(),
                "politics".into(),
                "automated_pass".into(),
                "not_applicable_english_only".into(),
                "Verify the precise historical claim against the attached source before publication.".into(),
            ]));
            append_english_variants(&mut variants, &atom_id, &dialogue);
        }
    }

    let event_lines = fs::read_to_string(&event_seed_path).unwrap();
    let event_seeds = event_lines.lines().skip(1).collect::<Vec<_>>();
    assert_eq!(
        event_seeds.len(),
        28,
        "expected fourteen presidential and fourteen sports clues"
    );
    for (index, line) in event_seeds.into_iter().enumerate() {
        let values = line.split('|').collect::<Vec<_>>();
        assert_eq!(values.len(), 10, "invalid national event row: {line}");
        let state = values[0];
        let atom_id = format!("SCA-EVENT-{:03}", index + 1);
        let (venue_id, venue_name, roles) = if values[2] == "stadium" {
            (
                "radio_station",
                "Radio station",
                "sports archivist|archive producer".to_owned(),
            )
        } else {
            (values[2], values[3], values[4].replace(';', "|"))
        };
        let dialogue = values[5].to_owned();
        atoms.push(csv::StringRecord::from(vec![
            atom_id.clone(),
            state.into(),
            "national_history".into(),
            values[1].into(),
            candidate_sets[state].join("|"),
            venue_id.into(),
            venue_name.into(),
            roles,
            dialogue.clone(),
            values[6].into(),
            "Source-linked Nigerian national and sports history".into(),
            "National event clue seed catalogue".into(),
            String::new(),
            values[7].into(),
            values[8].into(),
            "source_attached_line_check_required".into(),
            "2".into(),
            "historical".into(),
            "politics_or_sport".into(),
            "automated_pass".into(),
            "not_applicable_english_only".into(),
            values[9].into(),
        ]));
        append_english_variants(&mut variants, &atom_id, &dialogue);
    }

    let atom_temporary = atom_path.with_extension("csv.tmp");
    let mut atom_writer = csv::Writer::from_path(&atom_temporary).unwrap();
    atom_writer.write_record(&atom_headers).unwrap();
    for atom in atoms {
        atom_writer.write_record(&atom).unwrap();
    }
    atom_writer.flush().unwrap();
    fs::rename(atom_temporary, atom_path).unwrap();

    let variant_temporary = variant_path.with_extension("csv.tmp");
    let mut variant_writer = csv::Writer::from_path(&variant_temporary).unwrap();
    variant_writer.write_record(&variant_headers).unwrap();
    for variant in variants {
        variant_writer.write_record(&variant).unwrap();
    }
    variant_writer.flush().unwrap();
    fs::rename(variant_temporary, variant_path).unwrap();
    println!(
        "Added 250 civic, presidential, and sports-history clue atoms and 2,250 English dialogue variants."
    );
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
        "enrich-civic-history" => enrich_civic_history(&root),
        "repair-witness-dialogues" => repair_witness_dialogues(&root),
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
                "Unknown command {other}. Use validate, simulate, editorial, enrichment, standardize-witness-english, enrich-state-clues, enrich-civic-history, repair-witness-dialogues, export-witness-scenes, migrate-mysql, import-mysql, rebuild-mysql, verify-mysql, publish-initial-mysql, export-mysql, backup-mysql, restore-mysql, or export."
            );
            std::process::exit(2)
        }
    }
}
