//! Native application boundary. HTTP remains outside the core crate.
use naijachase_contracts::{Command, Event, GameState};
use serde::{Deserialize, Serialize};
#[derive(Debug, Deserialize)]
pub struct ExecuteRequest {
    pub command_id: String,
    pub expected_version: u16,
    pub state: GameState,
    pub command: Command,
}
#[derive(Debug, Serialize)]
pub struct ExecuteResponse {
    pub command_id: String,
    pub state: GameState,
    pub events: Vec<Event>,
}
pub fn execute(request: ExecuteRequest) -> Result<ExecuteResponse, String> {
    if request.command_id.trim().is_empty() {
        return Err("command_id is required".into());
    }
    if request.state.version != request.expected_version {
        return Err("stale state version".into());
    }
    let (state, events) =
        naijachase_core::apply(request.state, request.command).map_err(|e| e.to_string())?;
    Ok(ExecuteResponse {
        command_id: request.command_id,
        state,
        events,
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;
    fn state() -> GameState {
        GameState {
            version: 1,
            mission_id: "M".into(),
            thief_id: "T".into(),
            difficulty: 1,
            stage: 0,
            state: "A".into(),
            route: vec!["A".into(), "B".into(), "C".into(), "D".into()],
            elapsed: 0,
            score: 500,
            career_points: 0,
            dossier: BTreeMap::new(),
            observations: BTreeMap::new(),
            replay: vec![],
            outcome: None,
        }
    }
    #[test]
    fn rejects_stale_and_duplicate_unsafe_inputs() {
        let request = ExecuteRequest {
            command_id: "x".into(),
            expected_version: 2,
            state: state(),
            command: Command::Travel {
                destination: "B".into(),
                minutes: 1,
            },
        };
        assert_eq!(execute(request).unwrap_err(), "stale state version");
    }
}
