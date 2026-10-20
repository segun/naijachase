use super::*;
use naijachase_contracts::WitnessHistory;

impl MysqlStore {
    pub fn witness_history(&self, player: &str) -> Result<WitnessHistory, StorageError> {
        let mut connection = self.connection()?;
        load_witness_history(&mut connection.connection, player)
    }
}

/// Existing receipts are the source of truth: no history writes, extra schema,
/// or duplicate-command accounting. Return only grouped IDs and last exposure,
/// never the increasingly large saved command states.
pub(super) fn load_witness_history<Q: Queryable>(
    connection: &mut Q,
    player: &str,
) -> Result<WitnessHistory, StorageError> {
    type Exposure = (String, Option<String>, u64);
    let ordinary: Vec<Exposure> = connection.exec(
        "SELECT j.atom_id,j.variant_id,CAST(UNIX_TIMESTAMP(MAX(e.created_at)) AS UNSIGNED)
         FROM active_cases a JOIN case_events e ON e.case_id=a.case_id
         JOIN JSON_TABLE(e.event_json, '$.events[*]' COLUMNS (
             kind VARCHAR(32) PATH '$.event_type',
             trail_status VARCHAR(8) PATH '$.data.trail_status' NULL ON EMPTY,
             venue_id VARCHAR(64) PATH '$.data.venue_id' NULL ON EMPTY
         )) heard ON TRUE
         JOIN JSON_TABLE(JSON_EXTRACT(e.event_json,CONCAT('$.state.witness_plan[',
             JSON_UNQUOTE(JSON_EXTRACT(e.event_json,'$.state.stage')),']')), '$[*]' COLUMNS (
             atom_id VARCHAR(96) PATH '$.atom_id',
             variant_id VARCHAR(128) PATH '$.dialogue_variant_id' NULL ON EMPTY,
             venue_id VARCHAR(64) PATH '$.venue_id'
         )) j ON j.venue_id=heard.venue_id
         WHERE a.player_id=:player AND heard.kind='witness_account' AND heard.trail_status='hot' AND j.atom_id IS NOT NULL
         GROUP BY j.atom_id,j.variant_id",
        params! {"player"=>player},
    )?;
    let weekly: Vec<Exposure> = connection.exec(
        "SELECT j.atom_id,j.variant_id,CAST(UNIX_TIMESTAMP(MAX(t.completed_at)) AS UNSIGNED)
         FROM weekly_attempts a JOIN weekly_transits t ON t.attempt_id=a.attempt_id
         JOIN JSON_TABLE(t.event_json, '$' COLUMNS (
             kind VARCHAR(32) PATH '$.event_type',
             trail_status VARCHAR(8) PATH '$.data.trail_status' NULL ON EMPTY,
             venue_id VARCHAR(64) PATH '$.data.venue_id' NULL ON EMPTY
         )) heard ON TRUE
         JOIN JSON_TABLE(JSON_EXTRACT(t.arrival_state_json,CONCAT('$.witness_plan[',
             JSON_UNQUOTE(JSON_EXTRACT(t.arrival_state_json,'$.stage')),']')), '$[*]' COLUMNS (
             atom_id VARCHAR(96) PATH '$.atom_id',
             variant_id VARCHAR(128) PATH '$.dialogue_variant_id' NULL ON EMPTY,
             venue_id VARCHAR(64) PATH '$.venue_id'
         )) j ON j.venue_id=heard.venue_id
         WHERE a.player_id=:player AND t.completed_at IS NOT NULL
           AND heard.kind='witness_account' AND heard.trail_status='hot' AND j.atom_id IS NOT NULL
         GROUP BY j.atom_id,j.variant_id",
        params! {"player"=>player},
    )?;
    let mut history = WitnessHistory::default();
    for (atom, variant, seen_at) in ordinary.into_iter().chain(weekly) {
        history
            .atoms
            .entry(atom)
            .and_modify(|last| *last = (*last).max(seen_at))
            .or_insert(seen_at);
        if let Some(variant) = variant {
            history
                .dialogues
                .entry(variant)
                .and_modify(|last| *last = (*last).max(seen_at))
                .or_insert(seen_at);
        }
    }
    Ok(history)
}

#[cfg(test)]
mod tests {
    use super::*;
    use naijachase_contracts::{WitnessClue, migrate_legacy_state};

    #[test]
    fn live_mysql_history_counts_only_delivered_owned_interviews_and_completed_weekly_arrivals() {
        if env::var("NAIJACHASE_MYSQL_TEST").ok().as_deref() != Some("1") {
            return;
        }
        let _guard = crate::tests::MYSQL_TEST_LOCK.lock().unwrap();
        let store = MysqlStore::connect_from_env().unwrap();
        store.migrate().unwrap();
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        store.import_content(&root).unwrap();
        let player = format!("witness-{}", uuid::Uuid::new_v4());
        let case = format!("witness-{}", uuid::Uuid::new_v4());
        let mut state = migrate_legacy_state(
            &serde_json::json!({
                "mission_id":"NG-M0001", "current_state":"Kano"
            }),
            vec!["Kano".into(), "Lagos".into()],
            "NG-T001".into(),
            1,
            0,
        )
        .unwrap();
        let clue = |id: &str| WitnessClue {
            atom_id: id.into(),
            state: "Kano".into(),
            dimension: "craft".into(),
            candidate_states: "Kano|Katsina".into(),
            venue_id: "market".into(),
            venue_name: "Market".into(),
            witness_roles: "trader".into(),
            dialogue: "A saved private statement.".into(),
            dialogue_variant_id: Some(format!("{id}-variant")),
            supplemental_dialogue: None,
        };
        state.witness_plan = vec![
            vec![
                clue("heard"),
                WitnessClue {
                    venue_id: "museum".into(),
                    ..clue("offered-only")
                },
            ],
            vec![clue("next-stage")],
        ];
        store
            .create_case(&case, &player, "NG-M0001", &state)
            .unwrap();
        assert!(store.witness_history(&player).unwrap().atoms.is_empty());
        let event = |trail: &str| Event {
            event_type: "witness_account".into(),
            data: [
                ("venue_id".into(), "market".into()),
                ("trail_status".into(), trail.into()),
                ("message".into(), "A saved private statement.".into()),
            ]
            .into_iter()
            .collect(),
        };
        store
            .execute_case_command(&case, &player, "cold", 1, |s| Ok((s, vec![event("cold")])))
            .unwrap();
        assert!(store.witness_history(&player).unwrap().atoms.is_empty());
        store
            .execute_case_command(&case, &player, "heard", 2, |s| Ok((s, vec![event("hot")])))
            .unwrap();
        let history = store.witness_history(&player).unwrap();
        assert_eq!(history.atoms.keys().collect::<Vec<_>>(), vec!["heard"]);
        assert!(history.dialogues.contains_key("heard-variant"));
        assert!(
            store
                .witness_history("another-player")
                .unwrap()
                .atoms
                .is_empty()
        );
        store
            .execute_case_command(&case, &player, "heard", 2, |_| {
                panic!("duplicate must not execute")
            })
            .unwrap();
        assert_eq!(history.atoms, store.witness_history(&player).unwrap().atoms);
        store
            .execute_case_command(&case, &player, "next-stage", 3, |mut s| {
                s.stage = 1;
                Ok((s, vec![event("hot")]))
            })
            .unwrap();
        let history = store.witness_history(&player).unwrap();
        assert_eq!(history.atoms.len(), 2);
        assert!(history.atoms.contains_key("next-stage"));
        assert!(!history.atoms.contains_key("offered-only"));

        let group = uuid::Uuid::new_v4().to_string();
        let challenge = uuid::Uuid::new_v4().to_string();
        let attempt = uuid::Uuid::new_v4().to_string();
        let transit = uuid::Uuid::new_v4().to_string();
        state.witness_plan[0][0] = clue("weekly-heard");
        let saved = serde_json::to_string(&state).unwrap();
        let mut connection = store.connection().unwrap();
        connection.exec_drop("INSERT INTO player_groups(group_id,group_name,owner_id) VALUES(:group,:group,:player)", params!{"group"=>&group,"player"=>&player}).unwrap();
        connection.exec_drop("INSERT INTO weekly_challenges(challenge_id,group_id,week_key,rules_version,mission_id,content_version,seed,template_state_json,opens_at,starts_at,ends_at,status) VALUES(:challenge,:group,UTC_DATE(),1,'NG-M0001',1,1,:state,UTC_TIMESTAMP(),UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(),INTERVAL 7 DAY),'open')", params!{"challenge"=>&challenge,"group"=>&group,"state"=>&saved}).unwrap();
        connection.exec_drop("INSERT INTO weekly_attempts(attempt_id,challenge_id,player_id,state_json) VALUES(:attempt,:challenge,:player,:state)", params!{"attempt"=>&attempt,"challenge"=>&challenge,"player"=>&player,"state"=>&saved}).unwrap();
        connection.exec_drop("INSERT INTO weekly_transits(transit_id,attempt_id,command_id,origin,destination,mode,fare,duration_seconds,departed_at,arrives_at,arrival_state_json,event_json) VALUES(:transit,:attempt,'interview','Kano','Kano','drive',0,1,UTC_TIMESTAMP(),UTC_TIMESTAMP(),:state,:event)", params!{"transit"=>&transit,"attempt"=>&attempt,"state"=>&saved,"event"=>serde_json::to_string(&event("hot")).unwrap()}).unwrap();
        drop(connection);
        assert!(
            !store
                .witness_history(&player)
                .unwrap()
                .atoms
                .contains_key("weekly-heard")
        );
        store.complete_weekly_arrival(&player, &attempt).unwrap();
        let history = store.witness_history(&player).unwrap();
        assert!(history.atoms.contains_key("weekly-heard"));
        assert_eq!(history.atoms.len(), 3);
    }
}
