use naijachase_content::{Catalogue, ClueAtom, Profile};
use naijachase_contracts::{Command, GameState};
use naijachase_core::{apply, rank};
use naijachase_storage::MysqlStore;
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet},
    env,
    io::{self, Write},
    path::Path,
};

const FIELDS: [&str; 8] = [
    "sex",
    "height",
    "skin_tone",
    "hair",
    "hobby",
    "vehicle",
    "accessory",
    "feature",
];

#[derive(Default, Serialize, Deserialize)]
struct Career {
    name: String,
    points: u32,
    solved: Vec<String>,
    #[serde(default)]
    active: Option<GameState>,
    #[serde(skip)]
    storage_version: u64,
}

fn ask(prompt: &str) -> String {
    print!("{prompt}");
    io::stdout().flush().unwrap();
    let mut value = String::new();
    io::stdin().read_line(&mut value).unwrap();
    value.trim().to_string()
}
fn choose(prompt: &str, items: &[String]) -> usize {
    loop {
        println!();
        for (i, item) in items.iter().enumerate() {
            println!("  {}. {item}", i + 1);
        }
        if let Ok(n) = ask(&format!("{prompt}: ")).parse::<usize>() {
            if (1..=items.len()).contains(&n) {
                return n - 1;
            }
        }
        println!("Enter one of the listed numbers.");
    }
}
fn profile_value<'a>(p: &'a Profile, key: &str) -> &'a str {
    match key {
        "sex" => &p.sex,
        "height" => &p.height,
        "skin_tone" => &p.skin_tone,
        "hair" => &p.hair,
        "hobby" => &p.hobby,
        "vehicle" => &p.vehicle,
        "accessory" => &p.accessory,
        "feature" => &p.feature,
        _ => "",
    }
}
fn trait_sentence(key: &str, value: &str, sex: &str) -> String {
    match key {
        "sex" => format!(
            "The traveller was a {}.",
            if value == "male" { "man" } else { "woman" }
        ),
        "height" => format!("The person was {value}."),
        "skin_tone" => format!("The traveller was {value}."),
        "hair" => format!("The traveller had {value}."),
        "hobby" => format!("They mentioned an interest in {value}."),
        "vehicle" => format!(
            "I saw {} arrive in {value}.",
            if sex == "male" { "him" } else { "her" }
        ),
        "accessory" => format!("They wore {value}."),
        _ => format!("One detail stood out: {value}."),
    }
}
fn clock(minutes: u32) -> String {
    let total = 420 + minutes;
    let day = total / 1440;
    let minute = total % 1440;
    let days = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
        "Next Monday",
    ];
    format!(
        "{} {:02}:{:02}",
        days.get(day as usize).unwrap_or(&"After deadline"),
        minute / 60,
        minute % 60
    )
}
fn venues<'a>(
    data: &'a Catalogue,
    clue_state: &str,
    current_state: &str,
    mission: &str,
    stage: u8,
    seed: u64,
) -> Vec<&'a ClueAtom> {
    let atoms = &data.atoms[clue_state];
    let start = (mission.bytes().map(u32::from).sum::<u32>() + stage as u32 * 7 + seed as u32)
        as usize
        % atoms.len();
    let mut out = vec![];
    let mut used = BTreeSet::new();
    for n in 0..atoms.len() {
        let atom = &atoms[(start + n) % atoms.len()];
        if !data
            .location_venues
            .contains_key(&(current_state.to_owned(), atom.venue_id.clone()))
        {
            continue;
        }
        if used.insert(&atom.venue_id) {
            out.push(atom);
            if out.len() == 3 {
                break;
            }
        }
    }
    out
}
fn edit_dossier(data: &Catalogue, state: &mut GameState) {
    let labels = FIELDS
        .iter()
        .map(|k| {
            format!(
                "{}: {}",
                k.replace('_', " "),
                state
                    .dossier
                    .get(*k)
                    .map(String::as_str)
                    .unwrap_or("Unknown")
            )
        })
        .collect::<Vec<_>>();
    let key = FIELDS[choose("Choose dossier field", &labels)];
    let mut set = BTreeSet::new();
    for p in data.profiles.values() {
        set.insert(profile_value(p, key).to_string());
    }
    let values = set.into_iter().collect::<Vec<_>>();
    let value = values[choose("Choose value", &values)].clone();
    match apply(
        state.clone(),
        Command::RecordTrait {
            trait_name: key.into(),
            value,
        },
    ) {
        Ok((next, events)) => {
            *state = next;
            if events[0].data.contains_key("conflict") {
                println!("Warning: this entry conflicts with a witness account.")
            }
        }
        Err(e) => println!("Cannot update dossier: {e}"),
    }
}
fn persist(store: &MysqlStore, player_id: &str, career: &mut Career) {
    let next = career.storage_version + 1;
    let data = serde_json::to_vec(career).unwrap();
    store
        .save_terminal_career(player_id, next, &data)
        .unwrap_or_else(|error| panic!("Could not save career to MySQL: {error}"));
    career.storage_version = next;
}
fn arg_value<'a>(args: &'a [String], flag: &str) -> Option<&'a str> {
    args.iter()
        .position(|x| x == flag)
        .and_then(|i| args.get(i + 1))
        .map(String::as_str)
}
fn wait_until_open(elapsed: u32, opens: u32, closes: u32) -> u32 {
    let minute = (420 + elapsed) % 1440;
    let open = opens * 60;
    let close = closes * 60;
    let is_open = if open < close {
        minute >= open && minute < close
    } else {
        minute >= open || minute < close
    };
    if is_open {
        0
    } else if minute < open {
        open - minute
    } else {
        1440 - minute + open
    }
}
fn dialogue<'a>(data: &'a Catalogue, atom: &'a ClueAtom, difficulty: u8, seed: u64) -> &'a str {
    let level = match difficulty {
        1 | 2 => "easy",
        3 => "medium",
        _ => "hard",
    };
    let role = atom.witness_roles.split('|').next().unwrap_or("");
    let role_lower = role.to_lowercase();
    let informal = [
        "agbero",
        "conductor",
        "driver",
        "guard",
        "security",
        "loader",
        "seller",
        "trader",
        "boatman",
        "dockworker",
    ]
    .iter()
    .any(|word| role_lower.contains(word));
    let register = if informal { "Pidgin" } else { "English" };
    let choices = data
        .dialogue_variants
        .get(&atom.atom_id)
        .into_iter()
        .flatten()
        .filter(|v| v.difficulty == level && v.speech_register == register)
        .collect::<Vec<_>>();
    choices
        .get(seed as usize % choices.len().max(1))
        .map(|v| v.dialogue.as_str())
        .unwrap_or(&atom.dialogue)
}

fn main() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
    let data = Catalogue::load(&root).unwrap_or_else(|e| {
        eprintln!("Content error: {e}");
        std::process::exit(2)
    });
    let store = MysqlStore::connect_from_env().unwrap_or_else(|error| {
        eprintln!("MySQL configuration or connection error: {error}");
        std::process::exit(2)
    });
    store.migrate().unwrap_or_else(|error| {
        eprintln!("MySQL migration error: {error}");
        std::process::exit(2)
    });
    let player_id = env::var("NAIJACHASE_PLAYER_ID").unwrap_or_else(|_| "local-terminal".into());
    let args = env::args().skip(1).collect::<Vec<_>>();
    let seed = arg_value(&args, "--seed")
        .and_then(|x| x.parse::<u64>().ok())
        .unwrap_or(0);
    if args.iter().any(|x| x == "--reset") {
        store
            .delete_terminal_career(&player_id)
            .unwrap_or_else(|error| {
                eprintln!("Could not reset MySQL career: {error}");
                std::process::exit(2)
            });
    }
    let mut career: Career = store
        .load_terminal_career(&player_id)
        .unwrap_or_else(|error| panic!("Could not load career from MySQL: {error}"))
        .and_then(|(version, bytes)| {
            serde_json::from_slice::<Career>(&bytes)
                .ok()
                .map(|mut career| {
                    career.storage_version = version;
                    career
                })
        })
        .unwrap_or_default();
    if career.name.is_empty() {
        career.name = ask("Identify yourself, investigator: ");
        if career.name.is_empty() {
            career.name = "Detective".into()
        }
    }
    println!(
        "\n=== NAIJA CHASE ===\nWelcome, {}. Rank: {}. Points: {}.",
        career.name,
        rank(career.points),
        career.points
    );
    let requested = arg_value(&args, "--mission");
    let requested_difficulty = arg_value(&args, "--difficulty").and_then(|value| match value {
        "easy" => Some(1),
        "standard" => Some(2),
        "medium" => Some(3),
        "challenging" => Some(4),
        "hard" => Some(5),
        _ => None,
    });
    let resumed_id = career.active.as_ref().map(|s| s.mission_id.clone());
    let mission = requested
        .or(resumed_id.as_deref())
        .and_then(|id| data.missions.get(id))
        .or_else(|| {
            data.missions
                .values()
                .filter(|m| requested_difficulty.is_none_or(|d| m.difficulty == d))
                .min_by_key(|m| &m.mission_id)
        })
        .unwrap();
    let story = &data.narratives[&mission.mission_id];
    let route = data.route(mission).unwrap();
    let profile = &data.profiles[&mission.thief_id];
    let fresh = GameState {
        version: 1,
        mission_id: mission.mission_id.clone(),
        thief_id: mission.thief_id.clone(),
        difficulty: mission.difficulty,
        stage: 0,
        state: route[0].clone(),
        route: route.clone(),
        elapsed: 0,
        score: [0, 500, 650, 800, 1000, 1250][mission.difficulty as usize],
        career_points: career.points,
        dossier: BTreeMap::new(),
        observations: BTreeMap::new(),
        visited_venues: vec![],
        warrant_suspect: None,
        hideout_venue: String::new(),
        replay: vec![],
        outcome: None,
    };
    let mut state = career
        .active
        .take()
        .filter(|s| s.mission_id == mission.mission_id && s.route == route)
        .unwrap_or(fresh);
    println!(
        "\n=== CASE DOSSIER ===\n{} — {}\nStolen item: {}\n{}\n{}",
        mission.mission_id, story.title, story.stolen_item, story.premise, story.opening_briefing
    );
    loop {
        career.active = Some(state.clone());
        persist(&store, &player_id, &mut career);
        if state.elapsed >= 10080 {
            println!("\nDEADLINE EXPIRED\n{}", story.failure_conclusion);
            career.active = None;
            break;
        }
        println!(
            "\n{} | {} | Score {} | Dossier {}/8",
            clock(state.elapsed),
            state.state,
            state.score,
            state.dossier.len()
        );
        let final_stage = route.len() - 1;
        let target = if (state.stage as usize) < final_stage {
            &route[state.stage as usize + 1]
        } else {
            &route[final_stage]
        };
        let clues = venues(
            &data,
            target,
            &state.state,
            &mission.mission_id,
            state.stage,
            seed,
        );
        let mut menu = clues
            .iter()
            .map(|a| {
                let key = format!("{}|{}|{}", state.stage, state.state, a.venue_id);
                let venue = &data.venues[&a.venue_id];
                format!(
                    "Visit {} [{}]",
                    a.venue_name,
                    if state.visited_venues.contains(&key) {
                        "questioned"
                    } else if wait_until_open(state.elapsed, venue.opens_hour, venue.closes_hour,)
                        == 0
                    {
                        "open"
                    } else {
                        "closed"
                    }
                )
            })
            .collect::<Vec<_>>();
        menu.extend(["Review notebook".into(), "Update suspect dossier".into()]);
        if state.stage as usize == final_stage {
            menu.push(if state.warrant_suspect.is_some() {
                "Review issued warrant".into()
            } else {
                "Request warrant".into()
            });
            menu.push("Search for the suspect".into());
        } else {
            menu.push("Travel to another state".into());
        }
        menu.extend(["Help and rules".into(), "Save and quit".into()]);
        if state.stage as usize == final_stage && state.hideout_venue.is_empty() {
            state.hideout_venue = clues[(seed as usize + state.stage as usize) % 3]
                .venue_id
                .clone();
        }
        match choose("Choose an action", &menu) {
            i @ 0..=2 => {
                let atom = clues[i];
                let visit_key = format!("{}|{}|{}", state.stage, state.state, atom.venue_id);
                if state.visited_venues.contains(&visit_key) {
                    println!("You already questioned this witness.");
                    continue;
                }
                let evidence_witness = (seed as usize + state.stage as usize) % 3;
                let field = FIELDS[state.stage as usize];
                let gives_profile = i == evidence_witness;
                let venue = &data.venues[&atom.venue_id];
                let experience = &data.venue_experiences[&atom.venue_id];
                let wait = wait_until_open(state.elapsed, venue.opens_hour, venue.closes_hour);
                if wait > 0 {
                    println!("{}", experience.wait_event);
                    let answer = choose(
                        &format!("The venue is closed for another {wait} minutes"),
                        &["Wait until it opens".into(), "Cancel visit".into()],
                    );
                    if answer == 1 {
                        continue;
                    }
                    state = apply(state, Command::Wait { minutes: wait }).unwrap().0;
                }
                if let Some(placements) = data
                    .location_venues
                    .get(&(state.state.clone(), atom.venue_id.clone()))
                {
                    let pick = (mission.mission_id.bytes().map(usize::from).sum::<usize>()
                        + state.stage as usize
                        + i)
                        % placements.len();
                    let placement = &placements[pick];
                    println!("{}", placement.location_context);
                    if !placement.witness_context.trim().is_empty() {
                        println!("{}", placement.witness_context);
                    }
                    if placement.hub_travel_minutes > 0 {
                        state = apply(
                            state,
                            Command::Wait {
                                minutes: placement.hub_travel_minutes,
                            },
                        )
                        .unwrap()
                        .0;
                    }
                }
                let local_hour = ((420 + state.elapsed) % 1440) / 60;
                println!(
                    "{} {}",
                    if (6..18).contains(&local_hour) {
                        &experience.arrival_day
                    } else {
                        &experience.arrival_night
                    },
                    &experience.investigation_event
                );
                let (next, _) = apply(
                    state,
                    Command::VisitVenue {
                        venue_id: atom.venue_id.clone(),
                        trait_name: if gives_profile {
                            field.into()
                        } else {
                            String::new()
                        },
                        trait_value: if gives_profile {
                            profile_value(profile, field).into()
                        } else {
                            String::new()
                        },
                        minutes: venue.interview_minutes / 2 + experience.event_minutes,
                    },
                )
                .unwrap();
                state = next;
                println!(
                    "The {} says: “{}{}”",
                    atom.witness_roles.split('|').next().unwrap_or("witness"),
                    dialogue(&data, atom, mission.difficulty, seed + i as u64),
                    if gives_profile {
                        format!(
                            " {}",
                            trait_sentence(field, profile_value(profile, field), &profile.sex)
                        )
                    } else {
                        String::new()
                    }
                );
            }
            3 => {
                println!(
                    "\nTRAVEL: {}",
                    state.route[..=state.stage as usize].join(" -> ")
                );
                for k in FIELDS {
                    println!(
                        "  {:12} {}",
                        k.replace('_', " "),
                        state
                            .dossier
                            .get(k)
                            .map(String::as_str)
                            .unwrap_or("Unknown")
                    )
                }
            }
            4 => edit_dossier(&data, &mut state),
            5 if (state.stage as usize) < final_stage => {
                let field = FIELDS[state.stage as usize];
                if !state.observations.contains_key(field) {
                    println!(
                        "Find the witness with a suspect-description hint before following the trail."
                    );
                    continue;
                }
                let target = &route[state.stage as usize + 1];
                let mut options = vec![target.clone()];
                for h in data.hubs.keys() {
                    if h != &state.state && !options.contains(h) {
                        options.push(h.clone());
                        if options.len() == if mission.difficulty >= 3 { 4 } else { 3 } {
                            break;
                        }
                    }
                }
                options.sort();
                if !options.is_empty() {
                    let shift = (seed as usize + state.stage as usize) % options.len();
                    options.rotate_left(shift);
                }
                let destination = options[choose("Choose destination", &options)].clone();
                let minutes = if destination == state.state {
                    90
                } else {
                    data.travel
                        .get(&(state.state.clone(), destination.clone()))
                        .map(|x| x.travel_minutes)
                        .unwrap_or(180)
                };
                let (result, events) = apply(
                    state,
                    Command::Travel {
                        destination,
                        minutes,
                    },
                )
                .unwrap();
                state = result;
                if events[0].event_type == "arrived_on_trail" {
                    let minimum_elapsed = state.stage as u32 * 900;
                    if state.elapsed < minimum_elapsed {
                        let casework = minimum_elapsed - state.elapsed;
                        state = apply(state, Command::Wait { minutes: casework }).unwrap().0;
                        println!(
                            "Local officers spend {}h {}m checking statements and coordinating the next phase.",
                            casework / 60,
                            casework % 60
                        );
                    }
                    if state.stage == 1 {
                        println!("{}", story.transition_1);
                    } else if state.stage == 2 {
                        println!("{}", story.transition_2);
                    } else if state.stage as usize == final_stage {
                        println!("{}", story.transition_3);
                    } else {
                        println!(
                            "A verified sighting brings the investigation to {}.",
                            state.state
                        );
                    }
                } else {
                    println!("{}", story.false_lead_explanation)
                }
            }
            5 => {
                let visits = state
                    .visited_venues
                    .iter()
                    .filter(|key| key.starts_with(&format!("{}|{}|", state.stage, state.state)))
                    .count();
                if visits < 3 {
                    println!("Question all three local witnesses before requesting a warrant.");
                    continue;
                }
                if let Some(id) = state.warrant_suspect.as_ref() {
                    let t = &data.thieves[id];
                    println!("A warrant is already active for {} — {}.", t.alias, t.name);
                    continue;
                }
                if state.dossier.len() != 8 {
                    println!("Complete all eight dossier fields first.");
                    continue;
                }
                let mut ids = vec![mission.thief_id.clone()];
                for id in data.thieves.keys() {
                    if !ids.contains(id) {
                        ids.push(id.clone());
                        if ids.len() == 3 {
                            break;
                        }
                    }
                }
                ids.sort();
                let labels = ids
                    .iter()
                    .map(|id| {
                        let t = &data.thieves[id];
                        let p = &data.profiles[id];
                        let description = p
                            .traits()
                            .into_iter()
                            .map(|(key, value)| format!("{}: {}", key.replace('_', " "), value))
                            .collect::<Vec<_>>()
                            .join(", ");
                        format!("{} — {} | {}", t.alias, t.name, description)
                    })
                    .collect::<Vec<_>>();
                let suspect = ids[choose("Select warrant target", &labels)].clone();
                state = apply(
                    state,
                    Command::RequestWarrant {
                        suspect_id: Some(suspect.clone()),
                    },
                )
                .unwrap()
                .0;
                println!("Warrant issued. Now locate the suspect before the deadline.");
            }
            6 if state.stage as usize == final_stage => {
                let visits = state
                    .visited_venues
                    .iter()
                    .filter(|key| key.starts_with(&format!("{}|{}|", state.stage, state.state)))
                    .count();
                if visits < 3 {
                    println!(
                        "Question all three local witnesses before searching for the suspect."
                    );
                    continue;
                }
                let labels = clues
                    .iter()
                    .map(|a| format!("Search {}", a.venue_name))
                    .collect::<Vec<_>>();
                let selected = clues[choose("Choose a location to search", &labels)];
                let search_minutes = 45u32.max(7200u32.saturating_sub(state.elapsed));
                if search_minutes > 45 {
                    println!("Officers verify the warrant and quietly organise the search teams.");
                }
                let (result, events) = apply(
                    state,
                    Command::SearchHideout {
                        venue_id: selected.venue_id.clone(),
                        minutes: search_minutes,
                    },
                )
                .unwrap();
                state = result;
                match events[0].event_type.as_str() {
                    "hideout_empty" => println!("The search finds no sign of the suspect."),
                    "arrested" => {
                        println!(
                            "\nARREST\n{}\n{}",
                            story.capture_scene, story.success_conclusion
                        );
                        career.points = state.career_points;
                        if !career.solved.contains(&mission.mission_id) {
                            career.solved.push(mission.mission_id.clone())
                        }
                        println!("Rank: {}.", rank(career.points));
                        career.active = None;
                        break;
                    }
                    "suspect_found_without_warrant" => {
                        println!(
                            "\nESCAPE\nYou found the suspect, but without a warrant you could not make the arrest. {}",
                            story.failure_conclusion
                        );
                        career.active = None;
                        break;
                    }
                    _ => {
                        println!(
                            "\nESCAPE\nThe warrant named the wrong suspect. {}",
                            story.failure_conclusion
                        );
                        career.active = None;
                        break;
                    }
                }
            }
            i if i == menu.len() - 2 => {
                println!(
                    "\n=== HELP AND RULES ===\nSolve the case before next Monday at 07:00. Question all three witnesses at each of eight stops. Only one witness per stop remembers a suspect detail. Combine destination clues, enter all eight dossier traits, obtain the right warrant, then search the final city's venues for the hideout. Finding the suspect without a warrant lets them escape."
                );
            }
            _ => {
                career.active = Some(state.clone());
                persist(&store, &player_id, &mut career);
                println!("Career saved.");
                return;
            }
        }
    }
    if state.outcome.is_some() {
        career.active = None;
    }
    persist(&store, &player_id, &mut career);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_mission_stage_has_three_locally_available_venues() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        let data = Catalogue::load(&root).unwrap();
        for mission in data.missions.values() {
            let route = data.route(mission).unwrap();
            assert_eq!(route.len(), 8, "{} route length", mission.mission_id);
            for stage in 0..7 {
                let found = venues(
                    &data,
                    &route[stage + 1],
                    &route[stage],
                    &mission.mission_id,
                    stage as u8,
                    0,
                );
                assert_eq!(
                    found.len(),
                    3,
                    "{} stage {stage}: {} -> {}",
                    mission.mission_id,
                    route[stage],
                    route[stage + 1]
                );
            }
        }
    }

    #[test]
    fn correct_routes_take_between_five_and_six_days() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        let data = Catalogue::load(&root).unwrap();
        for mission in data.missions.values() {
            let route = data.route(mission).unwrap();
            let mut elapsed = 0u32;
            for stage in 0..route.len() {
                let clue_state = route.get(stage + 1).unwrap_or(&route[stage]);
                let found = venues(
                    &data,
                    clue_state,
                    &route[stage],
                    &mission.mission_id,
                    stage as u8,
                    0,
                );
                let mut best = u32::MAX;
                for order in [
                    [0, 1, 2],
                    [0, 2, 1],
                    [1, 0, 2],
                    [1, 2, 0],
                    [2, 0, 1],
                    [2, 1, 0],
                ] {
                    let mut candidate = elapsed;
                    for i in order {
                        let atom = found[i];
                        let venue = &data.venues[&atom.venue_id];
                        candidate +=
                            wait_until_open(candidate, venue.opens_hour, venue.closes_hour);
                        if let Some(placements) = data
                            .location_venues
                            .get(&(route[stage].clone(), atom.venue_id.clone()))
                        {
                            let pick = (mission.mission_id.bytes().map(usize::from).sum::<usize>()
                                + stage
                                + i)
                                % placements.len();
                            candidate += placements[pick].hub_travel_minutes;
                        }
                        candidate += venue.interview_minutes / 2
                            + data.venue_experiences[&atom.venue_id].event_minutes;
                    }
                    best = best.min(candidate);
                }
                elapsed = best;
                if stage + 1 < route.len() {
                    elapsed += data.travel[&(route[stage].clone(), route[stage + 1].clone())]
                        .travel_minutes;
                    elapsed = elapsed.max((stage as u32 + 1) * 900);
                }
            }
            let paced_elapsed = elapsed.max(7200);
            assert!(
                (7200..=8640).contains(&paced_elapsed),
                "{} correct route took {elapsed} minutes",
                mission.mission_id
            );
        }
    }
}
