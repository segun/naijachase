use naijachase_contracts::{Command, Event, GameState};
use std::collections::BTreeMap;
use thiserror::Error;
#[derive(Debug, Error, PartialEq)]
pub enum Error {
    #[error("invalid command: {0}")]
    Invalid(String),
    #[error("deadline expired")]
    Deadline,
}
pub fn rank(points: u32) -> &'static str {
    [
        (35000, "Master Detective"),
        (22000, "Chief Inspector"),
        (14000, "Senior Inspector"),
        (8000, "Inspector"),
        (4000, "Senior Investigator"),
        (1500, "Investigator"),
        (0, "Rookie"),
    ]
    .into_iter()
    .find(|(n, _)| points >= *n)
    .unwrap()
    .1
}
pub fn apply(mut state: GameState, command: Command) -> Result<(GameState, Vec<Event>), Error> {
    if state.elapsed >= 10080 || state.outcome.as_deref() == Some("deadline") {
        state.outcome = Some("deadline".into());
        return Err(Error::Deadline);
    }
    if state.outcome.is_some() {
        return Err(Error::Invalid("case already finished".into()));
    }
    let mut data = BTreeMap::new();
    let kind = match &command {
        Command::StartCase { .. } => return Err(Error::Invalid("case already started".into())),
        Command::VisitVenue {
            venue_id,
            trait_name,
            trait_value,
            minutes,
        } => {
            state.elapsed += minutes;
            let visit_key = format!("{}|{}|{}", state.stage, state.state, venue_id);
            if state.visited_venues.contains(&visit_key) {
                return Err(Error::Invalid("venue already questioned at this stop".into()));
            }
            state.visited_venues.push(visit_key);
            if !trait_name.is_empty() {
                state
                    .observations
                    .entry(trait_name.clone())
                    .or_insert(trait_value.clone());
            }
            "witness_interviewed"
        }
        Command::Wait { minutes } => {
            state.elapsed += minutes;
            "waited"
        }
        Command::RecordTrait { trait_name, value } => {
            if trait_name.is_empty() || value.is_empty() {
                return Err(Error::Invalid("empty trait".into()));
            }
            state.elapsed += 3 + state.difficulty as u32;
            if state
                .observations
                .get(trait_name)
                .is_some_and(|v| v != value)
            {
                state.score = state.score.saturating_sub(10 * state.difficulty as u32);
                data.insert("conflict".into(), "true".into());
            }
            state.dossier.insert(trait_name.clone(), value.clone());
            "trait_recorded"
        }
        Command::Travel {
            destination,
            minutes,
        } => {
            state.elapsed += minutes;
            state.state = destination.clone();
            let final_stage = state.route.len().saturating_sub(1);
            let correct = (state.stage as usize) < final_stage
                && state.route.get(state.stage as usize + 1) == Some(destination);
            if correct {
                state.stage += 1;
                state.score += 50 + 10 * state.difficulty as u32;
                "arrived_on_trail"
            } else {
                state.score = state
                    .score
                    .saturating_sub(75 + 25 * state.difficulty as u32);
                "false_destination"
            }
        }
        Command::RequestWarrant { suspect_id } => {
            if state.stage as usize != state.route.len().saturating_sub(1) {
                return Err(Error::Invalid("wrong jurisdiction".into()));
            }
            if state.dossier.len() != 8 {
                return Err(Error::Invalid("incomplete dossier".into()));
            }
            data.insert(
                "suspect_id".into(),
                suspect_id
                    .clone()
                    .ok_or_else(|| Error::Invalid("suspect required".into()))?,
            );
            state.warrant_suspect = suspect_id.clone();
            "warrant_ready"
        }
        Command::Arrest { suspect_id } => {
            state.elapsed += 30;
            data.insert("suspect_id".into(), suspect_id.clone());
            if suspect_id == &state.thief_id {
                let old = rank(state.career_points).to_string();
                let award = state.score
                    + (10080 - state.elapsed).saturating_div(60) * (2 + state.difficulty as u32);
                state.career_points += award;
                state.outcome = Some("solved".into());
                data.insert("award".into(), award.to_string());
                data.insert("old_rank".into(), old);
                data.insert("new_rank".into(), rank(state.career_points).into());
                "arrested"
            } else {
                state.outcome = Some("escaped".into());
                "suspect_escaped"
            }
        }
        Command::SearchHideout { venue_id, minutes } => {
            state.elapsed += minutes;
            data.insert("venue_id".into(), venue_id.clone());
            if venue_id != &state.hideout_venue {
                "hideout_empty"
            } else if state.warrant_suspect.is_none() {
                state.outcome = Some("escaped_no_warrant".into());
                "suspect_found_without_warrant"
            } else if state.warrant_suspect.as_deref() != Some(state.thief_id.as_str()) {
                state.outcome = Some("escaped".into());
                "wrong_warrant"
            } else {
                let old = rank(state.career_points).to_string();
                let award = state.score
                    + (10080 - state.elapsed).saturating_div(60) * (2 + state.difficulty as u32);
                state.career_points += award;
                state.outcome = Some("solved".into());
                data.insert("award".into(), award.to_string());
                data.insert("old_rank".into(), old);
                data.insert("new_rank".into(), rank(state.career_points).into());
                "arrested"
            }
        }
    };
    state.replay.push(command);
    Ok((
        state,
        vec![Event {
            event_type: kind.into(),
            data,
        }],
    ))
}
#[cfg(test)]
mod tests {
    use super::*;
    fn state() -> GameState {
        GameState {
            version: 1,
            mission_id: "M".into(),
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
            replay: vec![],
            outcome: None,
        }
    }
    #[test]
    fn deterministic() {
        let s = state();
        let c = Command::Travel {
            destination: "Kano".into(),
            minutes: 90,
        };
        assert_eq!(apply(s.clone(), c.clone()).unwrap(), apply(s, c).unwrap());
    }
    #[test]
    fn client_cannot_claim_false_route_is_correct() {
        let (s, e) = apply(
            state(),
            Command::Travel {
                destination: "Ogun".into(),
                minutes: 20,
            },
        )
        .unwrap();
        assert_eq!(s.stage, 0);
        assert_eq!(e[0].event_type, "false_destination");
    }
    #[test]
    fn deadline_blocks_commands() {
        let mut s = state();
        s.elapsed = 10080;
        assert_eq!(
            apply(
                s,
                Command::Travel {
                    destination: "Kano".into(),
                    minutes: 1
                }
            )
            .unwrap_err(),
            Error::Deadline
        );
    }
    #[test]
    fn property_random_travel_never_overflows_or_skips_stage() {
        let mut seed = 7u64;
        for _ in 0..10_000 {
            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
            let mut s = state();
            s.score = (seed >> 32) as u32;
            s.difficulty = (seed % 5 + 1) as u8;
            let destination = if seed & 1 == 0 { "Kano" } else { "Wrong" };
            let before = s.score;
            let (after, _) = apply(
                s,
                Command::Travel {
                    destination: destination.into(),
                    minutes: (seed % 300) as u32,
                },
            )
            .unwrap();
            assert!(after.stage <= 1);
            if destination == "Wrong" {
                assert!(after.score <= before)
            } else {
                assert!(after.score >= before)
            }
        }
    }
}
