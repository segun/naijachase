use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
pub const CONTRACT_VERSION: u16 = 1;
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Command {
    StartCase {
        mission_id: String,
        seed: u64,
    },
    VisitVenue {
        venue_id: String,
        trait_name: String,
        trait_value: String,
        minutes: u32,
    },
    Wait {
        minutes: u32,
    },
    RecordTrait {
        trait_name: String,
        value: String,
    },
    Travel {
        destination: String,
        minutes: u32,
    },
    RequestWarrant {
        suspect_id: Option<String>,
    },
    Arrest {
        suspect_id: String,
    },
    SearchHideout {
        venue_id: String,
        minutes: u32,
    },
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Event {
    pub event_type: String,
    pub data: BTreeMap<String, String>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct GameState {
    pub version: u16,
    pub mission_id: String,
    pub thief_id: String,
    pub difficulty: u8,
    pub stage: u8,
    pub state: String,
    pub route: Vec<String>,
    pub elapsed: u32,
    pub score: u32,
    pub career_points: u32,
    pub dossier: BTreeMap<String, String>,
    pub observations: BTreeMap<String, String>,
    #[serde(default)]
    pub visited_venues: Vec<String>,
    #[serde(default)]
    pub warrant_suspect: Option<String>,
    #[serde(default)]
    pub hideout_venue: String,
    pub replay: Vec<Command>,
    pub outcome: Option<String>,
}
pub fn migrate_legacy_state(
    value: &serde_json::Value,
    route: Vec<String>,
    thief_id: String,
    difficulty: u8,
    career_points: u32,
) -> Result<GameState, String> {
    let active = value.get("active").unwrap_or(value);
    let text = |k: &str| {
        active
            .get(k)
            .and_then(|v| v.as_str())
            .map(str::to_owned)
            .ok_or_else(|| format!("missing {k}"))
    };
    let map = |k: &str| -> BTreeMap<String, String> {
        active
            .get(k)
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default()
    };
    Ok(GameState {
        version: CONTRACT_VERSION,
        mission_id: text("mission_id")?,
        thief_id,
        difficulty,
        stage: active.get("stage").and_then(|v| v.as_u64()).unwrap_or(0) as u8,
        state: text("current_state")?,
        route,
        elapsed: active.get("elapsed").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
        score: active
            .get("case_score")
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as u32,
        career_points,
        dossier: map("evidence"),
        observations: map("observed_traits"),
        visited_venues: vec![],
        warrant_suspect: None,
        hideout_venue: String::new(),
        replay: vec![],
        outcome: None,
    })
}
