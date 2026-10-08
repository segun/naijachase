use naijachase_contracts::{Command, Event, GameState, TransportLedgerEntry};
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

pub fn investigation_minutes(base_minutes: u32, is_home_base: bool) -> u32 {
    if is_home_base {
        base_minutes
            .saturating_sub((base_minutes / 5).max(5))
            .max(1)
    } else {
        base_minutes
    }
}
pub const TRANSPORT_RULES_VERSION: u16 = 1;
pub fn interstate_quote(base_minutes: u32, mode: &str) -> Result<(u32, u32), Error> {
    match mode {
        "fly" => Ok((
            base_minutes,
            (800u32).saturating_add(base_minutes.saturating_mul(8)),
        )),
        "drive" => Ok((
            base_minutes.saturating_mul(3),
            (250u32).saturating_add(base_minutes.saturating_mul(3)),
        )),
        "hitch_ride" => Ok((base_minutes.saturating_mul(5), 0)),
        _ => Err(Error::Invalid("invalid interstate transport mode".into())),
    }
}
pub fn local_quote(base_minutes: u32, mode: &str) -> Result<(u32, u32), Error> {
    match mode {
        "drive" => Ok((
            base_minutes.max(5),
            (100u32).saturating_add(base_minutes.saturating_mul(4)),
        )),
        "hitch_ride" => Ok((base_minutes.saturating_mul(2).saturating_add(20), 0)),
        _ => Err(Error::Invalid("invalid local transport mode".into())),
    }
}
fn charge_transport(
    state: &mut GameState,
    kind: &str,
    destination: &str,
    mode: &str,
    cost: u32,
    minutes: u32,
) -> Result<(), Error> {
    if cost > state.economy.balance {
        return Err(Error::Invalid(
            "insufficient case budget; hitch a ride instead".into(),
        ));
    }
    let origin = state.state.clone();
    state.economy.balance -= cost;
    state.economy.ledger.push(TransportLedgerEntry {
        sequence: state.economy.ledger.len() as u32 + 1,
        kind: kind.into(),
        origin,
        destination: destination.into(),
        mode: mode.into(),
        cost,
        minutes,
        balance_after: state.economy.balance,
    });
    Ok(())
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
                return Err(Error::Invalid(
                    "venue already questioned at this stop".into(),
                ));
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
        Command::VisitVenueBy {
            venue_id,
            trait_name,
            trait_value,
            mode,
            travel_minutes,
            wait_minutes,
            interview_minutes,
            cost,
        } => {
            let visit_key = format!("{}|{}|{}", state.stage, state.state, venue_id);
            if state.visited_venues.contains(&visit_key) {
                return Err(Error::Invalid(
                    "venue already questioned at this stop".into(),
                ));
            }
            let total = travel_minutes
                .saturating_add(*wait_minutes)
                .saturating_add(*interview_minutes);
            charge_transport(&mut state, "local_venue", venue_id, mode, *cost, total)?;
            state.elapsed = state.elapsed.saturating_add(total);
            state.visited_venues.push(visit_key);
            if !trait_name.is_empty() {
                state
                    .observations
                    .entry(trait_name.clone())
                    .or_insert(trait_value.clone());
            }
            data.insert("mode".into(), mode.clone());
            data.insert("cost".into(), cost.to_string());
            data.insert("travel_minutes".into(), travel_minutes.to_string());
            data.insert("wait_minutes".into(), wait_minutes.to_string());
            data.insert("balance".into(), state.economy.balance.to_string());
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
            let key_witness_found = PROFILE_FIELDS
                .get(state.stage as usize)
                .is_some_and(|field| state.observations.contains_key(*field));
            if !key_witness_found {
                return Err(Error::Invalid(
                    "find the key witness's dossier hint before travelling".into(),
                ));
            }
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
        Command::TravelBy {
            destination,
            mode,
            minutes,
            cost,
        } => {
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
            let key_witness_found = PROFILE_FIELDS
                .get(state.stage as usize)
                .is_some_and(|field| state.observations.contains_key(*field));
            if !key_witness_found {
                return Err(Error::Invalid(
                    "find the key witness's dossier hint before travelling".into(),
                ));
            }
            charge_transport(&mut state, "interstate", destination, mode, *cost, *minutes)?;
            state.elapsed = state.elapsed.saturating_add(*minutes);
            state.state = destination.clone();
            data.insert("mode".into(), mode.clone());
            data.insert("cost".into(), cost.to_string());
            data.insert("balance".into(), state.economy.balance.to_string());
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
            let visit_prefix = format!("{}|{}|", state.stage, state.state);
            if state
                .visited_venues
                .iter()
                .filter(|key| key.starts_with(&visit_prefix))
                .count()
                < 3
            {
                return Err(Error::Invalid(
                    "question all three local witnesses before requesting a warrant".into(),
                ));
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
        Command::Arrest { .. } => {
            return Err(Error::Invalid(
                "an arrest requires a successful hideout search".into(),
            ));
        }
        Command::SearchHideout { venue_id, minutes } => {
            if state.stage as usize != state.route.len().saturating_sub(1) {
                return Err(Error::Invalid(
                    "suspect search is only available at the final stop".into(),
                ));
            }
            let visit_prefix = format!("{}|{}|", state.stage, state.state);
            if state
                .visited_venues
                .iter()
                .filter(|key| key.starts_with(&visit_prefix))
                .count()
                < 3
            {
                return Err(Error::Invalid(
                    "question all three local witnesses before searching".into(),
                ));
            }
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
                    + 10080u32.saturating_sub(state.elapsed).saturating_div(60)
                        * (2 + state.difficulty as u32);
                state.career_points += award;
                state.outcome = Some("solved".into());
                data.insert("award".into(), award.to_string());
                data.insert("old_rank".into(), old);
                data.insert("new_rank".into(), rank(state.career_points).into());
                "arrested"
            }
        }
        Command::SearchHideoutBy {
            venue_id,
            mode,
            travel_minutes,
            search_minutes,
            cost,
        } => {
            if state.stage as usize != state.route.len().saturating_sub(1) {
                return Err(Error::Invalid(
                    "suspect search is only available at the final stop".into(),
                ));
            }
            let visit_prefix = format!("{}|{}|", state.stage, state.state);
            if state
                .visited_venues
                .iter()
                .filter(|key| key.starts_with(&visit_prefix))
                .count()
                < 3
            {
                return Err(Error::Invalid(
                    "question all three local witnesses before searching".into(),
                ));
            }
            let total = travel_minutes.saturating_add(*search_minutes);
            charge_transport(&mut state, "apprehension", venue_id, mode, *cost, total)?;
            state.elapsed = state.elapsed.saturating_add(total);
            data.insert("venue_id".into(), venue_id.clone());
            data.insert("mode".into(), mode.clone());
            data.insert("cost".into(), cost.to_string());
            data.insert("balance".into(), state.economy.balance.to_string());
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
                    + 10080u32.saturating_sub(state.elapsed).saturating_div(60)
                        * (2 + state.difficulty as u32);
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
        let mut observations = BTreeMap::new();
        observations.insert("sex".into(), "male".into());
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
            observations,
            visited_venues: vec![
                "0|Lagos|one".into(),
                "0|Lagos|two".into(),
                "0|Lagos|three".into(),
            ],
            warrant_suspect: None,
            hideout_venue: "market".into(),
            replay: vec![],
            outcome: None,
            economy: Default::default(),
        }
    }

    #[test]
    fn home_base_reduces_but_never_removes_investigation_time() {
        assert_eq!(investigation_minutes(60, false), 60);
        assert_eq!(investigation_minutes(60, true), 48);
        assert_eq!(investigation_minutes(5, true), 1);
    }

    #[test]
    fn transport_fares_and_durations_have_the_required_order() {
        for base in 1..=1_000 {
            let (fly_minutes, fly_cost) = interstate_quote(base, "fly").unwrap();
            let (drive_minutes, drive_cost) = interstate_quote(base, "drive").unwrap();
            let (hitch_minutes, hitch_cost) = interstate_quote(base, "hitch_ride").unwrap();
            assert!(fly_minutes < drive_minutes && drive_minutes < hitch_minutes);
            assert!(fly_cost > drive_cost && drive_cost > hitch_cost);
            assert_eq!(hitch_cost, 0);
            let (local_drive_minutes, local_drive_cost) = local_quote(base, "drive").unwrap();
            let (local_hitch_minutes, local_hitch_cost) = local_quote(base, "hitch_ride").unwrap();
            assert!(local_drive_minutes < local_hitch_minutes);
            assert!(local_drive_cost > local_hitch_cost);
            assert_eq!(local_hitch_cost, 0);
        }
    }

    #[test]
    fn zero_balance_rejects_paid_travel_but_preserves_free_hitching() {
        let mut s = state();
        s.economy.rules_version = TRANSPORT_RULES_VERSION;
        let paid = Command::TravelBy {
            destination: "Kano".into(),
            mode: "fly".into(),
            minutes: 90,
            cost: 1_520,
        };
        assert_eq!(
            apply(s.clone(), paid).unwrap_err(),
            Error::Invalid("insufficient case budget; hitch a ride instead".into())
        );
        let (after, events) = apply(
            s,
            Command::TravelBy {
                destination: "Kano".into(),
                mode: "hitch_ride".into(),
                minutes: 450,
                cost: 0,
            },
        )
        .unwrap();
        assert_eq!(after.state, "Kano");
        assert_eq!(after.economy.balance, 0);
        assert_eq!(after.economy.ledger.len(), 1);
        assert_eq!(events[0].data["mode"], "hitch_ride");
    }

    #[test]
    fn a_local_fare_is_debited_once_and_recorded() {
        let mut s = state();
        s.visited_venues.clear();
        s.economy.opening_budget = 1_000;
        s.economy.balance = 1_000;
        let command = Command::VisitVenueBy {
            venue_id: "market".into(),
            trait_name: "sex".into(),
            trait_value: "male".into(),
            mode: "drive".into(),
            travel_minutes: 10,
            wait_minutes: 0,
            interview_minutes: 20,
            cost: 140,
        };
        let (after, _) = apply(s, command).unwrap();
        assert_eq!(after.economy.balance, 860);
        assert_eq!(after.economy.ledger[0].cost, 140);
        assert_eq!(after.economy.ledger[0].balance_after, 860);
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

    #[test]
    fn travel_requires_the_key_witness_hint() {
        let mut s = state();
        s.observations.clear();
        let error = apply(
            s,
            Command::Travel {
                destination: "Kano".into(),
                minutes: 90,
            },
        )
        .unwrap_err();
        assert_eq!(
            error,
            Error::Invalid("find the key witness's dossier hint before travelling".into())
        );
    }

    #[test]
    fn warrant_requires_a_later_hideout_search() {
        let mut s = state();
        s.stage = 3;
        s.state = "Abuja".into();
        s.visited_venues = vec![
            "3|Abuja|market".into(),
            "3|Abuja|hotel".into(),
            "3|Abuja|museum".into(),
        ];
        s.hideout_venue = "market".into();
        for (index, key) in [
            "sex",
            "height",
            "skin_tone",
            "hair",
            "hobby",
            "vehicle",
            "accessory",
            "feature",
        ]
        .into_iter()
        .enumerate()
        {
            s.dossier.insert(key.into(), index.to_string());
        }
        s = apply(
            s,
            Command::RequestWarrant {
                suspect_id: Some("T".into()),
            },
        )
        .unwrap()
        .0;
        assert_eq!(s.outcome, None);
        assert_eq!(s.warrant_suspect.as_deref(), Some("T"));
        let (s, events) = apply(
            s,
            Command::SearchHideout {
                venue_id: "market".into(),
                minutes: 45,
            },
        )
        .unwrap();
        assert_eq!(events[0].event_type, "arrested");
        assert_eq!(s.outcome.as_deref(), Some("solved"));
    }
}
