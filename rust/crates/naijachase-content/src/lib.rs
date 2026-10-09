use serde::Deserialize;
use std::{
    collections::{HashMap, HashSet},
    path::Path,
};
use thiserror::Error;
#[derive(Debug, PartialEq)]
pub struct CatalogueSummary {
    pub missions: usize,
    pub states: usize,
    pub thieves: usize,
}
#[derive(Debug, Error)]
pub enum Error {
    #[error("csv: {0}")]
    Csv(#[from] csv::Error),
    #[error("incomplete catalogue: {0:?}")]
    Incomplete(CatalogueSummary),
}
fn count(path: &Path) -> Result<usize, csv::Error> {
    Ok(csv::Reader::from_path(path)?.records().count())
}

fn contains_place_name(text: &str, name: &str) -> bool {
    let lower = text.to_lowercase();
    let needle = name.to_lowercase();
    lower.match_indices(&needle).any(|(index, value)| {
        let end = index + value.len();
        let before_ok = index == 0
            || !lower[..index]
                .chars()
                .next_back()
                .is_some_and(char::is_alphanumeric);
        let after_ok = end == lower.len()
            || !lower[end..]
                .chars()
                .next()
                .is_some_and(char::is_alphanumeric);
        before_ok && after_ok
    })
}

fn has_non_english_witness_pattern(text: &str) -> bool {
    let lower = format!(" {} ", text.to_lowercase());
    [
        " na wetin ",
        " wey ",
        " dey ",
        " e no ",
        " make you ",
        " i remember am ",
        " the person ask ",
        " the person say ",
        " the person price ",
        " the person carry ",
    ]
    .iter()
    .any(|pattern| lower.contains(pattern))
}
pub fn row_count(path: &Path) -> Result<usize, Error> {
    Ok(count(path)?)
}
pub fn validate_repository(root: &Path) -> Result<(), Vec<String>> {
    let checks = [
        ("locations", "data/locations/locations.csv", 500usize),
        ("knowledge", "data/knowledge/knowledge.csv", 5243),
        (
            "clue formulations",
            "data/clues/clue-formulations.csv",
            12729,
        ),
        ("missions", "data/missions/missions.csv", 1000),
        ("thieves", "data/thieves/thieves.csv", 100),
        ("state hubs", "data/gameplay/state-hubs.csv", 37),
        ("travel edges", "data/gameplay/state-travel.csv", 1332),
        ("clue atoms", "data/gameplay/state-clue-atoms.csv", 707),
        (
            "dialogue variants",
            "data/gameplay/clue-dialogue-variants.csv",
            6363,
        ),
        (
            "mission narratives",
            "data/gameplay/mission-narratives.csv",
            1000,
        ),
        (
            "balance rows",
            "data/gameplay/mission-balance-report.csv",
            1000,
        ),
    ];
    let mut errors = vec![];
    for (name, relative, want) in checks {
        match row_count(&root.join(relative)) {
            Ok(got)
                if (matches!(name, "missions" | "mission narratives" | "balance rows")
                    && got >= want)
                    || got == want => {}
            Ok(got) => errors.push(format!("{name}: expected at least {want}, found {got}")),
            Err(e) => errors.push(format!("{name}: {e}")),
        }
    }
    match Catalogue::load(root) {
        Ok(c) => {
            let mut titles = HashSet::new();
            for mission in c.missions.values() {
                let Some(narrative) = c.narratives.get(&mission.mission_id) else {
                    errors.push(format!("{}: missing narrative", mission.mission_id));
                    continue;
                };
                if !titles.insert(narrative.title.to_lowercase()) {
                    errors.push(format!("{}: duplicate case title", mission.mission_id));
                }
                if let Some(capture) = c.locations.get(&mission.capture_location_id) {
                    let destination = capture.name.to_lowercase();
                    if narrative.title.to_lowercase().contains(&destination)
                        || narrative
                            .opening_briefing
                            .to_lowercase()
                            .contains(&destination)
                    {
                        errors.push(format!(
                            "{}: title or opening briefing reveals capture location {}",
                            mission.mission_id, capture.name
                        ));
                    }
                }
            }
            for placements in c.location_venues.values() {
                for placement in placements {
                    if placement
                        .witness_context
                        .contains("everyday movement of people through")
                    {
                        errors.push(format!(
                            "{}: generic witness context remains",
                            placement.location_id
                        ));
                    }
                }
            }
            for (state, atoms) in &c.atoms {
                if atoms.len() < 14 {
                    errors.push(format!("{state}: only {} clue atoms", atoms.len()))
                }
                for atom in atoms {
                    if has_non_english_witness_pattern(&atom.dialogue) {
                        errors.push(format!(
                            "{}: non-English or malformed witness grammar remains",
                            atom.atom_id
                        ));
                    }
                    for variant in c.dialogue_variants.get(&atom.atom_id).into_iter().flatten() {
                        if variant.speech_register != "English" {
                            errors.push(format!(
                                "{}: non-English witness register remains",
                                variant.variant_id
                            ));
                        }
                        if has_non_english_witness_pattern(&variant.dialogue) {
                            errors.push(format!(
                                "{}: non-English or malformed witness grammar remains",
                                variant.variant_id
                            ));
                        }
                    }
                    if atom.candidate_states.split('|').all(|x| x != state) {
                        errors.push(format!(
                            "{}: destination absent from candidates",
                            atom.atom_id
                        ))
                    }
                    for hub in c.hubs.values() {
                        for forbidden in [&hub.state, &hub.hub_city] {
                            if contains_place_name(&atom.dialogue, forbidden) {
                                errors.push(format!(
                                    "{}: witness dialogue reveals place name {}",
                                    atom.atom_id, forbidden
                                ));
                            }
                            for variant in
                                c.dialogue_variants.get(&atom.atom_id).into_iter().flatten()
                            {
                                if contains_place_name(&variant.dialogue, forbidden) {
                                    errors.push(format!(
                                        "{}: dialogue variant reveals place name {}",
                                        variant.variant_id, forbidden
                                    ));
                                }
                            }
                        }
                    }
                    for location in c.locations.values().filter(|location| {
                        location.location_type.contains("city")
                            || location.location_type.contains("capital")
                    }) {
                        if contains_place_name(&atom.dialogue, &location.name) {
                            errors.push(format!(
                                "{}: witness dialogue reveals city name {}",
                                atom.atom_id, location.name
                            ));
                        }
                        for variant in c.dialogue_variants.get(&atom.atom_id).into_iter().flatten()
                        {
                            if contains_place_name(&variant.dialogue, &location.name) {
                                errors.push(format!(
                                    "{}: dialogue variant reveals city name {}",
                                    variant.variant_id, location.name
                                ));
                            }
                        }
                    }
                }
            }
        }
        Err(e) => errors.push(format!("catalogue: {e}")),
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}
impl CatalogueSummary {
    pub fn load(root: &Path) -> Result<Self, Error> {
        let value = Self {
            missions: count(&root.join("data/missions/missions.csv"))?,
            states: count(&root.join("data/gameplay/state-hubs.csv"))?,
            thieves: count(&root.join("data/thieves/thieves.csv"))?,
        };
        if value.is_complete() {
            Ok(value)
        } else {
            Err(Error::Incomplete(value))
        }
    }
    pub fn is_complete(&self) -> bool {
        self.missions >= 1000 && self.states == 37 && self.thieves == 100
    }
}
#[derive(Debug, Deserialize)]
pub struct Mission {
    pub mission_id: String,
    pub difficulty: u8,
    pub thief_id: String,
    pub start_location_id: String,
    pub stop_2_location_id: String,
    pub stop_3_location_id: String,
    pub capture_location_id: String,
}
#[derive(Debug, Deserialize)]
pub struct Profile {
    pub thief_id: String,
    pub sex: String,
    pub height: String,
    pub skin_tone: String,
    pub hair: String,
    pub hobby: String,
    pub vehicle: String,
    pub accessory: String,
    pub feature: String,
}
#[derive(Debug, Deserialize)]
pub struct Hub {
    pub state: String,
    pub hub_city: String,
}
#[derive(Debug, Deserialize)]
pub struct Travel {
    pub origin_state: String,
    pub destination_state: String,
    pub travel_minutes: u32,
}
#[derive(Debug, Deserialize)]
pub struct Location {
    pub location_id: String,
    pub name: String,
    pub location_type: String,
    pub state_or_territory: String,
}
#[derive(Debug, Deserialize, Clone)]
pub struct ClueAtom {
    pub atom_id: String,
    pub state: String,
    pub candidate_states: String,
    pub venue_id: String,
    pub venue_name: String,
    pub witness_roles: String,
    pub dialogue: String,
}
#[derive(Debug, Deserialize)]
pub struct Narrative {
    pub mission_id: String,
    pub title: String,
    pub stolen_item: String,
    pub premise: String,
    pub opening_briefing: String,
    pub transition_1: String,
    pub transition_2: String,
    pub transition_3: String,
    pub false_lead_explanation: String,
    pub capture_scene: String,
    pub success_conclusion: String,
    pub failure_conclusion: String,
}
#[derive(Debug, Deserialize)]
pub struct Thief {
    pub thief_id: String,
    pub name: String,
    pub alias: String,
}
#[derive(Debug, Deserialize)]
pub struct Venue {
    pub venue_id: String,
    pub venue_name: String,
    pub opens_hour: u32,
    pub closes_hour: u32,
    pub interview_minutes: u32,
    pub witness_roles: String,
}
#[derive(Debug, Deserialize)]
pub struct VenueExperience {
    pub venue_id: String,
    pub arrival_day: String,
    pub arrival_night: String,
    pub arrival_weekend: String,
    pub arrival_event_day: String,
    pub wait_event: String,
    pub investigation_event: String,
    pub event_minutes: u32,
}
#[derive(Debug, Deserialize)]
pub struct LocationVenue {
    pub location_id: String,
    pub location_name: String,
    pub location_type: String,
    pub state: String,
    pub venue_id: String,
    pub venue_name: String,
    pub location_fit: u8,
    pub hub_travel_minutes: u32,
    pub latitude: String,
    pub longitude: String,
    pub coordinate_kind: String,
    pub location_context: String,
    pub witness_context: String,
}
#[derive(Debug, Deserialize)]
pub struct DialogueVariant {
    pub variant_id: String,
    pub atom_id: String,
    pub difficulty: String,
    pub speech_register: String,
    pub variant_number: u8,
    pub dialogue: String,
}
pub struct Catalogue {
    pub missions: HashMap<String, Mission>,
    pub profiles: HashMap<String, Profile>,
    pub hubs: HashMap<String, Hub>,
    pub travel: HashMap<(String, String), Travel>,
    pub locations: HashMap<String, Location>,
    pub atoms: HashMap<String, Vec<ClueAtom>>,
    pub narratives: HashMap<String, Narrative>,
    pub thieves: HashMap<String, Thief>,
    pub venues: HashMap<String, Venue>,
    pub venue_experiences: HashMap<String, VenueExperience>,
    pub location_venues: HashMap<(String, String), Vec<LocationVenue>>,
    pub dialogue_variants: HashMap<String, Vec<DialogueVariant>>,
}
impl Profile {
    pub fn traits(&self) -> [(&'static str, &str); 8] {
        [
            ("sex", &self.sex),
            ("height", &self.height),
            ("skin_tone", &self.skin_tone),
            ("hair", &self.hair),
            ("hobby", &self.hobby),
            ("vehicle", &self.vehicle),
            ("accessory", &self.accessory),
            ("feature", &self.feature),
        ]
    }
}

pub fn natural_trait_clause(subject: &str, field: &str, value: &str) -> String {
    match field {
        "sex" | "height" | "skin_tone" => format!("{subject} was {value}"),
        "hair" => format!("{subject} had {value}"),
        "hobby" => format!("{subject} spoke enthusiastically about {value}"),
        "vehicle" => format!("{subject} arrived in {value}"),
        "accessory" => {
            let verb = match value {
                "a camera bag"
                | "a carved walking stick"
                | "a leather satchel"
                | "a silver briefcase" => "carried",
                _ => "wore",
            };
            format!("{subject} {verb} {value}")
        }
        // Features are predicates such as "quotes old proverbs" and
        // "walks with a limp", rather than noun phrases.
        "feature" => format!("{subject} {value}"),
        _ => format!("{subject} matched {value}"),
    }
}
impl Catalogue {
    pub fn route(&self, m: &Mission) -> Result<Vec<String>, Error> {
        let anchors = [
            &m.start_location_id,
            &m.stop_2_location_id,
            &m.stop_3_location_id,
            &m.capture_location_id,
        ]
        .into_iter()
        .map(|id| {
            self.locations
                .get(id)
                .map(|x| {
                    let s = x.state_or_territory.split('/').next().unwrap_or("");
                    if s == "FCT" {
                        "Federal Capital Territory".into()
                    } else {
                        s.into()
                    }
                })
                .ok_or_else(|| {
                    Error::Incomplete(CatalogueSummary {
                        missions: self.missions.len(),
                        states: self.hubs.len(),
                        thieves: self.profiles.len(),
                    })
                })
        })
        .collect::<Result<Vec<String>, Error>>()?;
        let start = anchors[0].clone();
        let capture = anchors[3].clone();
        let mut route = vec![start];
        for state in &anchors[1..3] {
            if state != &capture && !route.contains(state) {
                route.push(state.clone());
            }
        }
        let mut states = self.hubs.keys().cloned().collect::<Vec<_>>();
        states.sort();
        let offset = m.mission_id.bytes().map(usize::from).sum::<usize>() % states.len();
        states.rotate_left(offset);
        for state in states {
            if state != capture && !route.contains(&state) {
                route.push(state);
            }
            if route.len() == 7 {
                break;
            }
        }
        route.push(capture);
        Ok(route)
    }
}
fn read<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<Vec<T>, csv::Error> {
    csv::Reader::from_path(path)?.deserialize().collect()
}
impl Catalogue {
    pub fn load(root: &Path) -> Result<Self, Error> {
        let missions = read::<Mission>(&root.join("data/missions/missions.csv"))?
            .into_iter()
            .map(|x| (x.mission_id.clone(), x))
            .collect();
        let profiles = read::<Profile>(&root.join("data/gameplay/thief-profiles.csv"))?
            .into_iter()
            .map(|x| (x.thief_id.clone(), x))
            .collect();
        let hubs = read::<Hub>(&root.join("data/gameplay/state-hubs.csv"))?
            .into_iter()
            .map(|x| (x.state.clone(), x))
            .collect();
        let travel = read::<Travel>(&root.join("data/gameplay/state-travel.csv"))?
            .into_iter()
            .map(|x| ((x.origin_state.clone(), x.destination_state.clone()), x))
            .collect();
        let locations = read::<Location>(&root.join("data/locations/locations.csv"))?
            .into_iter()
            .map(|x| (x.location_id.clone(), x))
            .collect();
        let mut atoms: HashMap<String, Vec<ClueAtom>> = HashMap::new();
        for atom in read::<ClueAtom>(&root.join("data/gameplay/state-clue-atoms.csv"))? {
            atoms.entry(atom.state.clone()).or_default().push(atom)
        }
        let narratives = read::<Narrative>(&root.join("data/gameplay/mission-narratives.csv"))?
            .into_iter()
            .map(|x| (x.mission_id.clone(), x))
            .collect();
        let thieves = read::<Thief>(&root.join("data/thieves/thieves.csv"))?
            .into_iter()
            .map(|x| (x.thief_id.clone(), x))
            .collect();
        let venues = read::<Venue>(&root.join("data/gameplay/venues.csv"))?
            .into_iter()
            .map(|x| (x.venue_id.clone(), x))
            .collect();
        let venue_experiences =
            read::<VenueExperience>(&root.join("data/gameplay/venue-experiences.csv"))?
                .into_iter()
                .map(|x| (x.venue_id.clone(), x))
                .collect();
        let mut location_venues: HashMap<(String, String), Vec<LocationVenue>> = HashMap::new();
        for placement in read::<LocationVenue>(&root.join("data/gameplay/location-venue-map.csv"))?
        {
            location_venues
                .entry((placement.state.clone(), placement.venue_id.clone()))
                .or_default()
                .push(placement);
        }
        let mut dialogue_variants: HashMap<String, Vec<DialogueVariant>> = HashMap::new();
        for variant in
            read::<DialogueVariant>(&root.join("data/gameplay/clue-dialogue-variants.csv"))?
        {
            dialogue_variants
                .entry(variant.atom_id.clone())
                .or_default()
                .push(variant);
        }
        let value = Self {
            missions,
            profiles,
            hubs,
            travel,
            locations,
            atoms,
            narratives,
            thieves,
            venues,
            venue_experiences,
            location_venues,
            dialogue_variants,
        };
        if value.missions.len() < 1000
            || value.narratives.len() != value.missions.len()
            || value.profiles.len() != 100
            || value.hubs.len() != 37
            || value.travel.len() != 1332
            || value.locations.len() != 500
            || value.venues.len() != 35
            || value.location_venues.values().map(Vec::len).sum::<usize>() != 2946
            || value
                .dialogue_variants
                .values()
                .map(Vec::len)
                .sum::<usize>()
                != 6363
        {
            return Err(Error::Incomplete(CatalogueSummary {
                missions: value.missions.len(),
                states: value.hubs.len(),
                thieves: value.profiles.len(),
            }));
        }
        Ok(value)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parses_complete_live_catalogue() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        let c = Catalogue::load(&root).unwrap();
        assert_eq!(
            (
                c.missions.len(),
                c.profiles.len(),
                c.hubs.len(),
                c.travel.len(),
                c.locations.len()
            ),
            (1000, 100, 37, 1332, 500)
        );
        assert_eq!(c.atoms.values().map(Vec::len).sum::<usize>(), 707);
        assert!(c.dialogue_variants.values().all(|variants| {
            variants.len() == 9
                && variants
                    .iter()
                    .all(|variant| variant.speech_register == "English")
        }));
        for (state, atoms) in &c.atoms {
            let spotlight = ["Lagos", "Kano", "Niger", "Oyo", "Rivers"].contains(&state.as_str());
            assert_eq!(
                atoms.len(),
                if state == "Federal Capital Territory" {
                    18
                } else if spotlight {
                    20
                } else {
                    19
                },
                "{state}"
            );
            assert_eq!(
                atoms
                    .iter()
                    .filter(|atom| atom.atom_id.starts_with("SCA-ENRICH-"))
                    .count(),
                4,
                "{state}"
            );
            assert_eq!(
                atoms
                    .iter()
                    .filter(|atom| atom.atom_id.starts_with("SCA-DEEP-"))
                    .count(),
                if state == "Federal Capital Territory" {
                    0
                } else if spotlight {
                    2
                } else {
                    1
                },
                "{state}"
            );
        }
    }
    #[test]
    fn malformed_or_missing_content_is_rejected() {
        assert!(Catalogue::load(Path::new("/definitely/missing/naijachase")).is_err());
    }

    #[test]
    fn profile_traits_use_grammatical_predicates() {
        assert_eq!(
            natural_trait_clause("the suspect", "accessory", "a silver briefcase"),
            "the suspect carried a silver briefcase"
        );
        assert_eq!(
            natural_trait_clause("the suspect", "accessory", "round spectacles"),
            "the suspect wore round spectacles"
        );
        assert_eq!(
            natural_trait_clause("the suspect", "feature", "quotes old proverbs"),
            "the suspect quotes old proverbs"
        );
        assert_eq!(
            natural_trait_clause("the suspect", "feature", "walks with a limp"),
            "the suspect walks with a limp"
        );
    }
    #[test]
    fn repository_integrity_gate_passes() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        assert_eq!(validate_repository(&root), Ok(()));
    }
    #[test]
    fn active_repository_has_no_legacy_source_or_invocation() {
        fn scan(path: &Path, findings: &mut Vec<String>) {
            for entry in std::fs::read_dir(path).unwrap() {
                let entry = entry.unwrap();
                let p = entry.path();
                let name = p.file_name().unwrap().to_string_lossy();
                if p.is_dir() {
                    if ![".git", "target", "archive"].contains(&name.as_ref()) {
                        scan(&p, findings);
                    }
                } else {
                    if p.extension().is_some_and(|x| x == "py" || x == "pyc") {
                        findings.push(p.display().to_string());
                    }
                    let forbidden = ["python", "3 "].concat();
                    if matches!(
                        p.extension().and_then(|x| x.to_str()),
                        Some("md" | "sh" | "toml" | "rs")
                    ) && std::fs::read_to_string(&p)
                        .unwrap_or_default()
                        .contains(&forbidden)
                    {
                        findings.push(format!("Legacy runtime invocation: {}", p.display()));
                    }
                }
            }
        }
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        let mut findings = vec![];
        scan(&root, &mut findings);
        assert!(findings.is_empty(), "{findings:#?}");
    }

    #[test]
    fn gameplay_content_uses_no_audited_real_transport_brands() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        let brands = [
            "ibom air",
            "air peace",
            "arik air",
            "gigm",
            "guo transport",
            "abc transport",
            "bolt ride",
            "uber ride",
            "toyota",
            "mercedes-benz",
            "volkswagen",
            "peugeot",
            "hyundai",
            "honda civic",
            "kia motors",
        ];
        let mut findings = Vec::new();
        for relative in [
            "data/gameplay",
            "data/missions",
            "data/clues",
            "data/locations",
            "data/knowledge",
        ] {
            let path = root.join(relative);
            for entry in walk_csv(&path) {
                let text = std::fs::read_to_string(&entry)
                    .unwrap_or_default()
                    .to_lowercase();
                for brand in brands {
                    if text.contains(brand) {
                        findings.push(format!("{}: {brand}", entry.display()));
                    }
                }
            }
        }
        assert!(
            findings.is_empty(),
            "real transport brands require review: {findings:#?}"
        );
    }

    fn walk_csv(path: &Path) -> Vec<std::path::PathBuf> {
        let mut result = Vec::new();
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                let child = entry.path();
                if child.is_dir() {
                    result.extend(walk_csv(&child));
                } else if child.extension().is_some_and(|value| value == "csv") {
                    result.push(child);
                }
            }
        }
        result
    }
}
