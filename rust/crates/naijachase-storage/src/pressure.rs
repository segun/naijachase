use super::{MysqlStore, StorageError, rank_name};
use mysql::{TxOpts, params, prelude::Queryable};
use naijachase_contracts::GameState;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

pub const DISCIPLINE_RULES_VERSION: u16 = 1;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct PressureResult {
    pub command_id: String,
    pub state_version: u64,
    pub method: String,
    pub extra_clue: Option<String>,
    pub offence: Option<String>,
    pub detected: bool,
    pub panel: Option<DisciplinaryCase>,
    pub token_balance: u32,
    pub events: Vec<PressureEvent>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct PressureEvent {
    pub event_type: String,
    pub data: serde_json::Value,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct DisciplinaryCase {
    pub disciplinary_case_id: String,
    pub offence: String,
    pub repeat_offender: bool,
    pub votes: Vec<String>,
    pub decision: String,
    pub punishment: String,
    pub points_before: u64,
    pub points_after: u64,
    pub old_rank: String,
    pub new_rank: String,
    pub jailed_until: Option<String>,
    pub acknowledged: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct TokenBalance {
    pub currency: &'static str,
    pub balance: u32,
    pub purchasable: bool,
    pub transferable: bool,
    pub cash_value: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct TokenLedgerEntry {
    pub amount: i32,
    pub balance_after: u32,
    pub reason: String,
    pub reference_id: String,
    pub created_at: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct TokenAward {
    pub reason: String,
    pub amount: u32,
    pub balance_after: u32,
    pub components: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct PressureAttemptRecord {
    pub stage: u8,
    pub venue_id: String,
    pub method: String,
    pub extra_clue: Option<String>,
    pub detected: bool,
    pub disciplinary_case_id: Option<String>,
    pub token_balance: u32,
}

fn deterministic(seed: &str, modulo: u8) -> u8 {
    let bytes = Sha256::digest(seed.as_bytes());
    (u64::from_be_bytes(bytes[0..8].try_into().unwrap()) % u64::from(modulo)) as u8
}

fn lower_rank_points(points: u64) -> u64 {
    let threshold: u64 = match rank_name(points) {
        "Master Detective" => 35_000,
        "Chief Inspector" => 22_000,
        "Senior Inspector" => 14_000,
        "Inspector" => 8_000,
        "Senior Investigator" => 4_000,
        "Investigator" => 1_500,
        _ => 0,
    };
    points.min(threshold.saturating_sub(1))
}

fn disciplinary_achievement_ids(jailed: bool, old_rank: &str, new_rank: &str) -> Vec<&'static str> {
    let mut achievements = Vec::with_capacity(2);
    if old_rank != new_rank {
        achievements.push("demoted");
    }
    if jailed {
        achievements.push("suspended");
    }
    achievements
}

fn panel_votes(seed: &str, repeat: bool) -> Vec<String> {
    let mut votes = (0..5)
        .map(|i| {
            if deterministic(&format!("{seed}|{i}"), 2) == 0 {
                "warning".to_owned()
            } else {
                "punish".to_owned()
            }
        })
        .collect::<Vec<_>>();
    if repeat && votes.iter().filter(|v| v.as_str() == "punish").count() < 3 {
        for vote in votes.iter_mut().take(3) {
            *vote = "punish".into();
        }
    }
    votes
}

impl MysqlStore {
    pub fn pressure_attempts(
        &self,
        player_id: &str,
        case_id: &str,
    ) -> Result<Vec<PressureAttemptRecord>, StorageError> {
        let mut connection = self.connection()?;
        let owner: Option<Option<String>> = connection.exec_first(
            "SELECT player_id FROM active_cases WHERE case_id=:case",
            params! {"case"=>case_id},
        )?;
        if owner.flatten().as_deref() != Some(player_id) {
            return Err(StorageError::Forbidden);
        }
        let rows: Vec<(u8, String, String, String)> = connection.exec(
            "SELECT stage,venue_id,method,CAST(result_json AS CHAR) FROM witness_pressure_attempts WHERE case_id=:case AND player_id=:player ORDER BY attempt_id",
            params! {"case"=>case_id,"player"=>player_id},
        )?;
        rows.into_iter()
            .map(|(stage, venue_id, method, json)| {
                let result: PressureResult = serde_json::from_str(&json)?;
                Ok(PressureAttemptRecord {
                    stage,
                    venue_id,
                    method,
                    extra_clue: result.extra_clue,
                    detected: result.detected,
                    disciplinary_case_id: result.panel.map(|panel| panel.disciplinary_case_id),
                    token_balance: result.token_balance,
                })
            })
            .collect()
    }

    pub fn bribe_token_balance(&self, player_id: &str) -> Result<TokenBalance, StorageError> {
        let balance = self
            .connection()?
            .exec_first(
                "SELECT bribe_tokens FROM players WHERE player_id=:player",
                params! {"player"=>player_id},
            )?
            .ok_or(StorageError::Forbidden)?;
        Ok(TokenBalance {
            currency: "earned_bribe_token",
            balance,
            purchasable: false,
            transferable: false,
            cash_value: false,
        })
    }

    pub fn bribe_token_history(
        &self,
        player_id: &str,
    ) -> Result<Vec<TokenLedgerEntry>, StorageError> {
        self.connection()?.exec_map("SELECT amount,balance_after,reason,reference_id,CAST(created_at AS CHAR) FROM bribe_token_ledger WHERE player_id=:player ORDER BY ledger_id DESC",params!{"player"=>player_id},|(amount,balance_after,reason,reference_id,created_at)|TokenLedgerEntry{amount,balance_after,reason,reference_id,created_at}).map_err(Into::into)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn pressure_witness(
        &self,
        player_id: &str,
        case_id: &str,
        command_id: &str,
        expected_version: u64,
        venue_id: &str,
        method: &str,
        has_extra_clue: bool,
        extra_clue: Option<&str>,
    ) -> Result<PressureResult, StorageError> {
        if !matches!(method, "bribe" | "intimidate") {
            return Err(StorageError::Command(
                "method must be bribe or intimidate".into(),
            ));
        }
        let mut connection = self.connection()?;
        let mut tx = connection.start_transaction(TxOpts::default())?;
        super::lock_case_player(&mut tx, player_id)?;
        let (owner, version, bytes):(Option<String>,u64,Vec<u8>)=tx.exec_first(
            "SELECT player_id,version,state_json FROM active_cases WHERE case_id=:case FOR UPDATE",
            params!{"case"=>case_id},
        )?.ok_or(StorageError::CaseNotFound)?;
        if owner.as_deref() != Some(player_id) {
            return Err(StorageError::Forbidden);
        }
        let mut state: GameState = serde_json::from_slice(&bytes)?;
        if state.outcome.as_deref() == Some("abandoned") {
            return Err(StorageError::Command("case already abandoned".into()));
        }
        if let Some(json) = tx.exec_first::<String,_,_>(
            "SELECT CAST(result_json AS CHAR) FROM witness_pressure_attempts WHERE player_id=:player AND command_id=:command FOR UPDATE",
            params!{"player"=>player_id,"command"=>command_id},
        )? {
            let result = serde_json::from_str(&json)?;
            tx.commit()?;
            return Ok(result);
        }
        if version != expected_version {
            return Err(StorageError::VersionConflict(case_id.into()));
        }
        if state.outcome.is_some() {
            return Err(StorageError::Command("case is no longer active".into()));
        }
        let visit_prefix = format!("{}|{}|{}", state.stage, state.state, venue_id);
        if !state
            .visited_venues
            .iter()
            .any(|v| v.starts_with(&visit_prefix))
        {
            return Err(StorageError::Command(
                "question this witness before applying pressure".into(),
            ));
        }
        let already:Option<u8>=tx.exec_first(
            "SELECT 1 FROM witness_pressure_attempts WHERE case_id=:case AND stage=:stage AND venue_id=:venue",
            params!{"case"=>case_id,"stage"=>state.stage,"venue"=>venue_id},
        )?;
        if already.is_some() {
            return Err(StorageError::Command(
                "this witness has already been pressured".into(),
            ));
        }

        let mut balance: u32 = tx
            .exec_first(
                "SELECT bribe_tokens FROM players WHERE player_id=:player FOR UPDATE",
                params! {"player"=>player_id},
            )?
            .ok_or(StorageError::Forbidden)?;
        if method == "bribe" {
            if balance == 0 {
                return Err(StorageError::Command(
                    "an earned bribe token is required".into(),
                ));
            }
            balance -= 1;
            tx.exec_drop(
                "UPDATE players SET bribe_tokens=:balance WHERE player_id=:player",
                params! {"balance"=>balance,"player"=>player_id},
            )?;
            tx.exec_drop("INSERT INTO bribe_token_ledger(player_id,amount,balance_after,reason,reference_id) VALUES (:player,-1,:balance,'witness_pressure',:reference)",params!{"player"=>player_id,"balance"=>balance,"reference"=>command_id})?;
        }
        let offence = if has_extra_clue {
            None
        } else if method == "bribe" {
            Some("witness_tampering")
        } else {
            Some("excessive_use_of_force")
        };
        let denominator = if method == "bribe" { 5 } else { 2 };
        let roll = deterministic(
            &format!("detect|{case_id}|{}|{venue_id}|{method}", state.stage),
            denominator,
        ) + 1;
        let detected = offence.is_some() && roll == 1;

        tx.exec_drop("INSERT INTO witness_pressure_attempts(player_id,case_id,command_id,stage,venue_id,method,had_extra_clue,offence_type,detection_numerator,detection_denominator,detection_roll,detected,result_json) VALUES (:player,:case,:command,:stage,:venue,:method,:extra,:offence,:numerator,:denominator,:roll,:detected,JSON_OBJECT())",params!{"player"=>player_id,"case"=>case_id,"command"=>command_id,"stage"=>state.stage,"venue"=>venue_id,"method"=>method,"extra"=>has_extra_clue,"offence"=>offence.unwrap_or("none"),"numerator"=>if offence.is_some(){Some(1u8)}else{None},"denominator"=>if offence.is_some(){Some(denominator)}else{None},"roll"=>if offence.is_some(){Some(roll)}else{None},"detected"=>detected})?;
        let attempt_id = tx.last_insert_id().unwrap_or(0);
        if let Some(kind) = offence {
            tx.exec_drop("INSERT INTO disciplinary_events(player_id,case_id,pressure_attempt_id,event_type,event_json) VALUES (:player,:case,:attempt,'offence_recorded',JSON_OBJECT('offence',:offence,'detected',:detected))",params!{"player"=>player_id,"case"=>case_id,"attempt"=>attempt_id,"offence"=>kind,"detected"=>detected})?;
        }

        let panel = if detected {
            let prior: u32 = tx
                .exec_first(
                    "SELECT COUNT(*) FROM disciplinary_cases WHERE player_id=:player",
                    params! {"player"=>player_id},
                )?
                .unwrap_or(0);
            let votes = panel_votes(&format!("panel|{case_id}|{command_id}"), prior > 0);
            let punish = prior > 0 || votes.iter().filter(|v| v.as_str() == "punish").count() >= 3;
            let points_before: u64 = tx
                .exec_first(
                    "SELECT points FROM careers WHERE player_id=:player FOR UPDATE",
                    params! {"player"=>player_id},
                )?
                .unwrap_or(state.career_points as u64);
            let old_rank = rank_name(points_before).to_owned();
            let (points_after, punishment, jail) = if !punish {
                (points_before, "none", false)
            } else if old_rank == "Rookie" {
                (points_before, "jailed", true)
            } else if method == "bribe" {
                (points_before.saturating_sub(1000), "points_deducted", false)
            } else {
                (lower_rank_points(points_before), "demoted", false)
            };
            let new_rank = rank_name(points_after).to_owned();
            tx.exec_drop("INSERT INTO careers(player_id,points,solved_missions_json,version) VALUES (:player,:points,JSON_ARRAY(),1) ON DUPLICATE KEY UPDATE points=:points,version=version+1",params!{"player"=>player_id,"points"=>points_after})?;
            state.career_points = points_after.min(u32::MAX as u64) as u32;
            if jail {
                tx.exec_drop("UPDATE players SET jailed_until=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 24 HOUR) WHERE player_id=:player",params!{"player"=>player_id})?;
                state.outcome = Some("forfeited".into());
                tx.exec_drop(
                    "DELETE FROM active_mission_assignments WHERE case_id=:case",
                    params! {"case"=>case_id},
                )?;
            }
            let panel_id = Uuid::new_v4().to_string();
            tx.exec_drop("INSERT INTO disciplinary_cases(disciplinary_case_id,player_id,pressure_attempt_id,offence_type,prior_offence_count,decision,punishment,points_before,points_after,old_rank,new_rank,jailed_until,rules_version) VALUES (:id,:player,:attempt,:offence,:prior,:decision,:punishment,:before,:after,:old,:new,IF(:jail,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 24 HOUR),NULL),:rules)",params!{"id"=>&panel_id,"player"=>player_id,"attempt"=>attempt_id,"offence"=>offence.unwrap(),"prior"=>prior,"decision"=>if punish{"punish"}else{"warning"},"punishment"=>punishment,"before"=>points_before,"after"=>points_after,"old"=>&old_rank,"new"=>&new_rank,"jail"=>jail,"rules"=>DISCIPLINE_RULES_VERSION})?;
            for (i, vote) in votes.iter().enumerate() {
                tx.exec_drop("INSERT INTO disciplinary_votes(disciplinary_case_id,panel_position,vote) VALUES (:id,:position,:vote)",params!{"id"=>&panel_id,"position"=>i+1,"vote"=>vote})?;
            }
            if old_rank != new_rank {
                tx.exec_drop("INSERT INTO rank_history(player_id,old_rank,new_rank,points,reason) VALUES (:player,:old,:new,:points,:reason)",params!{"player"=>player_id,"old"=>&old_rank,"new"=>&new_rank,"points"=>points_after,"reason"=>offence.unwrap()})?;
            }
            for achievement_id in disciplinary_achievement_ids(jail, &old_rank, &new_rank) {
                tx.exec_drop(
                    "INSERT IGNORE INTO player_achievements(player_id,achievement_id) VALUES (:player,:achievement)",
                    params! {"player"=>player_id,"achievement"=>achievement_id},
                )?;
            }
            Some(DisciplinaryCase {
                disciplinary_case_id: panel_id,
                offence: offence.unwrap().into(),
                repeat_offender: prior > 0,
                votes,
                decision: if punish { "punish" } else { "warning" }.into(),
                punishment: punishment.into(),
                points_before,
                points_after,
                old_rank,
                new_rank,
                jailed_until: if jail {
                    tx.exec_first(
                        "SELECT CAST(jailed_until AS CHAR) FROM players WHERE player_id=:player",
                        params! {"player"=>player_id},
                    )?
                } else {
                    None
                },
                acknowledged: false,
            })
        } else {
            None
        };
        let mut events = vec![PressureEvent {
            event_type: "witness_pressure_resolved".into(),
            data: serde_json::json!({"method":method,"extra_clue_received":has_extra_clue,"detected":detected}),
        }];
        if let Some(panel) = &panel {
            for (index, vote) in panel.votes.iter().enumerate() {
                events.push(PressureEvent {
                    event_type: "panel_member_arrived".into(),
                    data: serde_json::json!({"panel_position":index+1}),
                });
                events.push(PressureEvent {
                    event_type: "panel_vote".into(),
                    data: serde_json::json!({"panel_position":index+1,"vote":vote}),
                });
            }
            events.push(PressureEvent{event_type:"panel_decision".into(),data:serde_json::json!({"decision":panel.decision,"punishment":panel.punishment,"points_after":panel.points_after,"new_rank":panel.new_rank,"jailed_until":panel.jailed_until})});
        }
        let result = PressureResult {
            command_id: command_id.into(),
            state_version: expected_version + 1,
            method: method.into(),
            extra_clue: if has_extra_clue {
                extra_clue.map(str::to_owned)
            } else {
                None
            },
            offence: offence.map(str::to_owned),
            detected,
            panel,
            token_balance: balance,
            events,
        };
        tx.exec_drop(
            "UPDATE witness_pressure_attempts SET result_json=:result WHERE attempt_id=:attempt",
            params! {"result"=>serde_json::to_string(&result)?,"attempt"=>attempt_id},
        )?;
        tx.exec_drop(
            "UPDATE active_cases SET version=version+1,state_json=:state WHERE case_id=:case",
            params! {"state"=>serde_json::to_vec(&state)?,"case"=>case_id},
        )?;
        tx.commit()?;
        Ok(result)
    }

    pub fn disciplinary_history(
        &self,
        player_id: &str,
    ) -> Result<Vec<DisciplinaryCase>, StorageError> {
        type Row = (
            String,
            String,
            u32,
            String,
            String,
            u64,
            u64,
            String,
            String,
            Option<String>,
            Option<String>,
        );
        let mut conn = self.connection()?;
        let rows:Vec<Row>=conn.exec("SELECT disciplinary_case_id,offence_type,prior_offence_count,decision,punishment,points_before,points_after,old_rank,new_rank,CAST(jailed_until AS CHAR),CAST(acknowledged_at AS CHAR) FROM disciplinary_cases WHERE player_id=:player ORDER BY created_at DESC",params!{"player"=>player_id})?;
        rows.into_iter().map(|r|{let votes=conn.exec_map("SELECT vote FROM disciplinary_votes WHERE disciplinary_case_id=:id ORDER BY panel_position",params!{"id"=>&r.0},|v:String|v)?;Ok(DisciplinaryCase{disciplinary_case_id:r.0,offence:r.1,repeat_offender:r.2>0,votes,decision:r.3,punishment:r.4,points_before:r.5,points_after:r.6,old_rank:r.7,new_rank:r.8,jailed_until:r.9,acknowledged:r.10.is_some()})}).collect()
    }

    pub fn acknowledge_disciplinary_case(
        &self,
        player_id: &str,
        id: &str,
    ) -> Result<(), StorageError> {
        let mut conn = self.connection()?;
        conn.exec_drop("UPDATE disciplinary_cases SET acknowledged_at=COALESCE(acknowledged_at,UTC_TIMESTAMP()) WHERE disciplinary_case_id=:id AND player_id=:player",params!{"id"=>id,"player"=>player_id})?;
        if conn.affected_rows() == 0 {
            return Err(StorageError::Forbidden);
        }
        Ok(())
    }

    pub fn jail_status(&self, player_id: &str) -> Result<Option<String>, StorageError> {
        self.connection()?.exec_first("SELECT CAST(jailed_until AS CHAR) FROM players WHERE player_id=:player AND jailed_until>UTC_TIMESTAMP()",params!{"player"=>player_id}).map_err(Into::into)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn detection_rates_are_exact_over_stable_seed_space() {
        let bribes = (0..10_000)
            .filter(|i| deterministic(&format!("b{i}"), 5) == 0)
            .count();
        let force = (0..10_000)
            .filter(|i| deterministic(&format!("f{i}"), 2) == 0)
            .count();
        assert!((bribes as i32 - 2000).abs() < 150);
        assert!((force as i32 - 5000).abs() < 200);
    }
    #[test]
    fn demotion_boundaries_never_promote_or_underflow() {
        for (points, expected) in [
            (0, 0),
            (1499, 0),
            (1500, 1499),
            (4000, 3999),
            (8000, 7999),
            (14000, 13999),
            (22000, 21999),
            (35000, 34999),
            (u64::MAX, 34999),
        ] {
            assert_eq!(lower_rank_points(points), expected);
        }
    }
    #[test]
    fn panels_always_have_five_votes_and_repeat_offenders_are_punished() {
        for i in 0..10_000 {
            let first = panel_votes(&format!("first-{i}"), false);
            assert_eq!(first.len(), 5);
            let repeat = panel_votes(&format!("repeat-{i}"), true);
            assert_eq!(repeat.len(), 5);
            assert!(repeat.iter().filter(|v| v.as_str() == "punish").count() >= 3);
        }
    }
    #[test]
    fn witness_tampering_deduction_has_a_zero_floor() {
        for points in [0u64, 1, 999, 1000, 1001, u64::MAX] {
            assert!(points.saturating_sub(1000) <= points);
        }
        assert_eq!(0u64.saturating_sub(1000), 0);
    }

    #[test]
    fn disciplinary_outcomes_map_to_their_achievements() {
        assert_eq!(
            disciplinary_achievement_ids(false, "Inspector", "Senior Investigator"),
            vec!["demoted"]
        );
        assert_eq!(
            disciplinary_achievement_ids(true, "Rookie", "Rookie"),
            vec!["suspended"]
        );
        assert!(disciplinary_achievement_ids(false, "Inspector", "Inspector").is_empty());
    }
}
