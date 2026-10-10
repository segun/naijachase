use super::*;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct WeeklyAttemptView {
    pub attempt_id: String,
    pub challenge_id: String,
    pub status: String,
    pub state_version: u64,
    pub state: GameState,
    pub starts_at: String,
    pub ends_at: String,
    pub winner: bool,
    pub transit: Option<serde_json::Value>,
}

impl MysqlStore {
    pub fn create_group(
        &self,
        owner: &str,
        name: &str,
        capacity: u16,
    ) -> Result<String, StorageError> {
        if !(3..=48).contains(&name.len())
            || !name
                .chars()
                .all(|c| c.is_alphanumeric() || matches!(c, ' ' | '-' | '_'))
            || !(2..=100).contains(&capacity)
        {
            return Err(StorageError::Command(
                "invalid group name or capacity".into(),
            ));
        }
        let id = uuid::Uuid::new_v4().to_string();
        let mut c = self.pool.get_conn()?;
        let mut tx = c.start_transaction(TxOpts::default())?;
        tx.exec_drop("INSERT INTO player_groups(group_id,group_name,owner_id,capacity) VALUES(:id,:name,:owner,:capacity)",params!{"id"=>&id,"name"=>name,"owner"=>owner,"capacity"=>capacity})?;
        tx.exec_drop(
            "INSERT INTO group_members(group_id,player_id,role) VALUES(:id,:owner,'owner')",
            params! {"id"=>&id,"owner"=>owner},
        )?;
        tx.exec_drop("INSERT INTO group_audit(group_id,actor_id,event_type,metadata_json) VALUES(:id,:owner,'group_created',JSON_OBJECT('name',:name))",params!{"id"=>&id,"owner"=>owner,"name"=>name})?;
        tx.commit()?;
        Ok(id)
    }
    fn group_role(
        tx: &mut mysql::Transaction<'_>,
        group: &str,
        player: &str,
    ) -> Result<Option<String>, StorageError> {
        Ok(tx.exec_first(
            "SELECT role FROM group_members WHERE group_id=:group AND player_id=:player",
            params! {"group"=>group,"player"=>player},
        )?)
    }
    pub fn invite_group_member(
        &self,
        actor: &str,
        group: &str,
        username: &str,
    ) -> Result<String, StorageError> {
        let mut c = self.pool.get_conn()?;
        let mut tx = c.start_transaction(TxOpts::default())?;
        if !matches!(
            Self::group_role(&mut tx, group, actor)?.as_deref(),
            Some("owner" | "admin")
        ) {
            return Err(StorageError::Forbidden);
        }
        let invitee: Option<String> = tx.exec_first(
            "SELECT player_id FROM players WHERE username=:name AND account_status='active'",
            params! {"name"=>username},
        )?;
        let invitee = invitee.ok_or(StorageError::Forbidden)?;
        let blocked:u64=tx.exec_first("SELECT COUNT(*) FROM cooperation_blocks WHERE (blocker_id=:a AND blocked_id=:b) OR (blocker_id=:b AND blocked_id=:a)",params!{"a"=>actor,"b"=>&invitee})?.unwrap_or(0);
        let recent:u64=tx.exec_first("SELECT COUNT(*) FROM group_invitations WHERE inviter_id=:actor AND created_at>=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 DAY)",params!{"actor"=>actor})?.unwrap_or(0);
        if blocked > 0 || recent >= 20 {
            return Err(StorageError::Command("invitation unavailable".into()));
        }
        let id = uuid::Uuid::new_v4().to_string();
        tx.exec_drop("INSERT INTO group_invitations(invitation_id,group_id,inviter_id,invitee_id,expires_at) VALUES(:id,:group,:actor,:invitee,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 7 DAY))",params!{"id"=>&id,"group"=>group,"actor"=>actor,"invitee"=>invitee})?;
        tx.exec_drop("INSERT INTO group_audit(group_id,actor_id,event_type,metadata_json) VALUES(:group,:actor,'invited',JSON_OBJECT('invitation_id',:id))",params!{"group"=>group,"actor"=>actor,"id"=>&id})?;
        tx.commit()?;
        Ok(id)
    }
    pub fn respond_group_invitation(
        &self,
        player: &str,
        id: &str,
        accept: bool,
    ) -> Result<(), StorageError> {
        let mut c = self.pool.get_conn()?;
        let mut tx = c.start_transaction(TxOpts::default())?;
        let row:Option<(String,String,u16,u64)>=tx.exec_first("SELECT i.group_id,i.invitee_id,g.capacity,(SELECT COUNT(*) FROM group_members WHERE group_id=i.group_id) FROM group_invitations i JOIN player_groups g ON g.group_id=i.group_id WHERE i.invitation_id=:id AND i.status='pending' AND i.expires_at>UTC_TIMESTAMP() FOR UPDATE",params!{"id"=>id})?;
        let (group, invitee, capacity, count) = row.ok_or(StorageError::Forbidden)?;
        if invitee != player {
            return Err(StorageError::Forbidden);
        }
        let status = if accept { "accepted" } else { "declined" };
        if accept {
            if count >= capacity as u64 {
                return Err(StorageError::Command("group is full".into()));
            }
            tx.exec_drop("INSERT INTO group_members(group_id,player_id,role) VALUES(:group,:player,'member')",params!{"group"=>&group,"player"=>player})?;
        }
        tx.exec_drop(
            "UPDATE group_invitations SET status=:status WHERE invitation_id=:id",
            params! {"status"=>status,"id"=>id},
        )?;
        tx.exec_drop("INSERT INTO group_audit(group_id,actor_id,event_type,metadata_json) VALUES(:group,:player,:event,JSON_OBJECT('invitation_id',:id))",params!{"group"=>group,"player"=>player,"event"=>status,"id"=>id})?;
        tx.commit()?;
        Ok(())
    }
    pub fn group_details(
        &self,
        player: &str,
        group: &str,
    ) -> Result<serde_json::Value, StorageError> {
        let mut c = self.pool.get_conn()?;
        let member: u64 = c
            .exec_first(
                "SELECT COUNT(*) FROM group_members WHERE group_id=:group AND player_id=:player",
                params! {"group"=>group,"player"=>player},
            )?
            .unwrap_or(0);
        if member != 1 {
            return Err(StorageError::Forbidden);
        }
        let (name, capacity, status): (String, u16, String) = c
            .exec_first(
                "SELECT group_name,capacity,status FROM player_groups WHERE group_id=:group",
                params! {"group"=>group},
            )?
            .ok_or(StorageError::Forbidden)?;
        let roster:Vec<(String,String,String)>=c.exec("SELECT p.player_id,p.username,m.role FROM group_members m JOIN players p ON p.player_id=m.player_id WHERE m.group_id=:group ORDER BY FIELD(m.role,'owner','admin','member'),p.username",params!{"group"=>group})?;
        Ok(
            serde_json::json!({"group_id":group,"name":name,"capacity":capacity,"status":status,"members":roster.into_iter().map(|(player_id,username,role)|serde_json::json!({"player_id":player_id,"username":username,"role":role})).collect::<Vec<_>>() }),
        )
    }
    pub fn leave_group(&self, player: &str, group: &str) -> Result<(), StorageError> {
        let mut c = self.pool.get_conn()?;
        let mut tx = c.start_transaction(TxOpts::default())?;
        let role = Self::group_role(&mut tx, group, player)?.ok_or(StorageError::Forbidden)?;
        if role == "owner" {
            return Err(StorageError::Command(
                "transfer ownership before leaving".into(),
            ));
        }
        tx.exec_drop(
            "DELETE FROM group_members WHERE group_id=:group AND player_id=:player",
            params! {"group"=>group,"player"=>player},
        )?;
        tx.exec_drop("INSERT INTO group_audit(group_id,actor_id,event_type,metadata_json) VALUES(:group,:player,'left',JSON_OBJECT())",params!{"group"=>group,"player"=>player})?;
        tx.commit()?;
        Ok(())
    }
    pub fn transfer_group_ownership(
        &self,
        owner: &str,
        group: &str,
        target: &str,
    ) -> Result<(), StorageError> {
        let mut c = self.pool.get_conn()?;
        let mut tx = c.start_transaction(TxOpts::default())?;
        if Self::group_role(&mut tx, group, owner)?.as_deref() != Some("owner")
            || Self::group_role(&mut tx, group, target)?.is_none()
        {
            return Err(StorageError::Forbidden);
        }
        tx.exec_drop("UPDATE group_members SET role=IF(player_id=:target,'owner','admin') WHERE group_id=:group AND player_id IN(:owner,:target)",params!{"group"=>group,"owner"=>owner,"target"=>target})?;
        tx.exec_drop(
            "UPDATE player_groups SET owner_id=:target WHERE group_id=:group",
            params! {"group"=>group,"target"=>target},
        )?;
        tx.exec_drop("INSERT INTO group_audit(group_id,actor_id,event_type,metadata_json) VALUES(:group,:owner,'ownership_transferred',JSON_OBJECT('new_owner',:target))",params!{"group"=>group,"owner"=>owner,"target"=>target})?;
        tx.commit()?;
        Ok(())
    }
    pub fn schedule_weekly_challenge(
        &self,
        group: &str,
        starts: u64,
        ends: u64,
        mission: &str,
        content_version: u32,
        seed: u64,
        template: &GameState,
    ) -> Result<String, StorageError> {
        let mut c = self.pool.get_conn()?;
        let mut tx = c.start_transaction(TxOpts::default())?;
        let existing:Option<String>=tx.exec_first("SELECT challenge_id FROM weekly_challenges WHERE group_id=:group AND week_key=DATE(FROM_UNIXTIME(:starts)) FOR UPDATE",params!{"group"=>group,"starts"=>starts})?;
        if let Some(id) = existing {
            return Ok(id);
        }
        let id = uuid::Uuid::new_v4().to_string();
        tx.exec_drop("INSERT INTO weekly_challenges(challenge_id,group_id,week_key,rules_version,mission_id,content_version,seed,template_state_json,opens_at,starts_at,ends_at,status) VALUES(:id,:group,DATE(FROM_UNIXTIME(:starts)),1,:mission,:version,:seed,:state,DATE_SUB(FROM_UNIXTIME(:starts),INTERVAL 7 DAY),FROM_UNIXTIME(:starts),FROM_UNIXTIME(:ends),IF(UNIX_TIMESTAMP()>=:starts,'open','registration'))",params!{"id"=>&id,"group"=>group,"mission"=>mission,"version"=>content_version,"seed"=>seed,"state"=>serde_json::to_string(template)?,"starts"=>starts,"ends"=>ends})?;
        tx.exec_drop("INSERT INTO weekly_entrants(challenge_id,player_id,eligible,ineligibility_reason,locked_at) SELECT :id,m.player_id,(p.account_status='active' AND (p.jailed_until IS NULL OR p.jailed_until<=FROM_UNIXTIME(:starts))),IF(p.account_status<>'active','account_restricted',IF(p.jailed_until>FROM_UNIXTIME(:starts),'jailed',NULL)),FROM_UNIXTIME(:starts) FROM group_members m JOIN players p ON p.player_id=m.player_id WHERE m.group_id=:group",params!{"id"=>&id,"group"=>group,"starts"=>starts})?;
        let eligible: u64 = tx
            .exec_first(
                "SELECT COUNT(*) FROM weekly_entrants WHERE challenge_id=:id AND eligible=TRUE",
                params! {"id"=>&id},
            )?
            .unwrap_or(0);
        if eligible < 2 {
            return Err(StorageError::Command(
                "weekly challenge requires at least two eligible members".into(),
            ));
        }
        tx.exec_drop("INSERT INTO weekly_events(challenge_id,event_type,event_json) VALUES(:id,'challenge_scheduled',JSON_OBJECT('starts_at',FROM_UNIXTIME(:starts),'ends_at',FROM_UNIXTIME(:ends)))",params!{"id"=>&id,"starts"=>starts,"ends"=>ends})?;
        tx.commit()?;
        Ok(id)
    }
    pub fn start_weekly_attempt(
        &self,
        player: &str,
        challenge: &str,
    ) -> Result<String, StorageError> {
        let mut c = self.pool.get_conn()?;
        let mut tx = c.start_transaction(TxOpts::default())?;
        let row:Option<(String,String)>=tx.exec_first("SELECT CAST(w.template_state_json AS CHAR),w.status FROM weekly_challenges w JOIN weekly_entrants e ON e.challenge_id=w.challenge_id AND e.player_id=:player AND e.eligible=TRUE WHERE w.challenge_id=:challenge AND UTC_TIMESTAMP()>=w.starts_at AND UTC_TIMESTAMP()<w.ends_at FOR UPDATE",params!{"player"=>player,"challenge"=>challenge})?;
        let (state, status) = row.ok_or(StorageError::Forbidden)?;
        if status != "open" {
            return Err(StorageError::Command("challenge is not open".into()));
        }
        let existing:Option<String>=tx.exec_first("SELECT attempt_id FROM weekly_attempts WHERE challenge_id=:challenge AND player_id=:player",params!{"challenge"=>challenge,"player"=>player})?;
        if let Some(id) = existing {
            return Ok(id);
        }
        let id = uuid::Uuid::new_v4().to_string();
        tx.exec_drop("INSERT INTO weekly_attempts(attempt_id,challenge_id,player_id,state_json) VALUES(:id,:challenge,:player,:state)",params!{"id"=>&id,"challenge"=>challenge,"player"=>player,"state"=>state})?;
        tx.exec_drop("UPDATE weekly_entrants SET enrolled_at=UTC_TIMESTAMP() WHERE challenge_id=:challenge AND player_id=:player",params!{"challenge"=>challenge,"player"=>player})?;
        tx.exec_drop("INSERT INTO weekly_events(challenge_id,attempt_id,player_id,event_type,event_json) VALUES(:challenge,:id,:player,'member_started',JSON_OBJECT())",params!{"challenge"=>challenge,"id"=>&id,"player"=>player})?;
        tx.commit()?;
        Ok(id)
    }
    pub fn weekly_attempt(
        &self,
        player: &str,
        attempt: &str,
    ) -> Result<WeeklyAttemptView, StorageError> {
        let mut c = self.pool.get_conn()?;
        let row:Option<(String,String,u64,String,String,String,Option<String>,Option<String>,Option<String>,Option<i64>,Option<u32>,u32)>=c.exec_first("SELECT a.challenge_id,a.status,a.state_version,CAST(a.state_json AS CHAR),DATE_FORMAT(w.starts_at,'%Y-%m-%dT%H:%i:%sZ'),DATE_FORMAT(w.ends_at,'%Y-%m-%dT%H:%i:%sZ'),w.winner_attempt_id,t.destination,t.mode,TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(),t.arrives_at),t.duration_seconds,GREATEST(0,TIMESTAMPDIFF(MINUTE,DATE_SUB(w.ends_at,INTERVAL 7 DAY),UTC_TIMESTAMP())) FROM weekly_attempts a JOIN weekly_challenges w ON w.challenge_id=a.challenge_id LEFT JOIN weekly_transits t ON t.attempt_id=a.attempt_id AND t.completed_at IS NULL WHERE a.attempt_id=:attempt AND a.player_id=:player",params!{"attempt"=>attempt,"player"=>player})?;
        let (
            challenge_id,
            status,
            state_version,
            state,
            starts_at,
            ends_at,
            winner,
            destination,
            mode,
            remaining,
            duration,
            real_minutes,
        ) = row.ok_or(StorageError::Forbidden)?;
        let mut state: GameState = serde_json::from_str(&state)?;
        // A weekly case runs on the real clock, counted back from the closing time: the case week is the seven days before it ends (Monday 07:00 to Monday 07:00).
        if matches!(status.as_str(), "active" | "in_transit") {
            state.elapsed = real_minutes;
        }
        Ok(WeeklyAttemptView{attempt_id:attempt.into(),challenge_id,status,state_version,state,starts_at,ends_at,winner:winner.as_deref()==Some(attempt),transit:destination.map(|destination|serde_json::json!({"destination":destination,"mode":mode,"remaining_seconds":remaining.unwrap_or(0),"duration_seconds":duration}))})
    }

    pub fn ongoing_weekly_attempts(
        &self,
        player: &str,
    ) -> Result<Vec<WeeklyAttemptView>, StorageError> {
        let attempt_ids: Vec<String> = self.pool.get_conn()?.exec(
            "SELECT a.attempt_id FROM weekly_attempts a JOIN weekly_challenges w ON w.challenge_id=a.challenge_id WHERE a.player_id=:player AND a.status IN('active','in_transit') AND w.status='open' AND UTC_TIMESTAMP()>=w.starts_at AND UTC_TIMESTAMP()<w.ends_at ORDER BY a.started_at DESC",
            params! { "player" => player },
        )?;
        let mut attempts = Vec::with_capacity(attempt_ids.len());
        for attempt_id in attempt_ids {
            self.complete_weekly_arrival(player, &attempt_id)?;
            attempts.push(self.weekly_attempt(player, &attempt_id)?);
        }
        Ok(attempts)
    }
    pub fn depart_weekly(
        &self,
        player: &str,
        attempt: &str,
        command_id: &str,
        destination: &str,
        mode: &str,
        fare: u32,
        duration_seconds: u32,
        arrival: &GameState,
        event: Option<&serde_json::Value>,
    ) -> Result<String, StorageError> {
        if !matches!(mode, "fly" | "drive" | "hitch_ride") || duration_seconds == 0 {
            return Err(StorageError::Command("invalid transit".into()));
        }
        let mut c = self.pool.get_conn()?;
        let mut tx = c.start_transaction(TxOpts::default())?;
        let row:Option<(String,String,String,String)>=tx.exec_first("SELECT a.challenge_id,a.status,CAST(a.state_json AS CHAR),w.status FROM weekly_attempts a JOIN weekly_challenges w ON w.challenge_id=a.challenge_id WHERE a.attempt_id=:attempt AND a.player_id=:player AND UTC_TIMESTAMP()<w.ends_at FOR UPDATE",params!{"attempt"=>attempt,"player"=>player})?;
        let (challenge, status, current_json, challenge_status) =
            row.ok_or(StorageError::Forbidden)?;
        if status != "active" || challenge_status != "open" {
            return Err(StorageError::Command(
                "weekly attempt is unavailable".into(),
            ));
        }
        let mut current: GameState = serde_json::from_str(&current_json)?;
        if current.economy.balance < fare
            || arrival.economy.balance != current.economy.balance - fare
        {
            return Err(StorageError::Command("invalid fare debit".into()));
        }
        current.economy.balance -= fare;
        let id = uuid::Uuid::new_v4().to_string();
        tx.exec_drop("INSERT INTO weekly_transits(transit_id,attempt_id,command_id,origin,destination,mode,fare,duration_seconds,departed_at,arrives_at,arrival_state_json,event_json) VALUES(:id,:attempt,:command,:origin,:destination,:mode,:fare,:duration,UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(),INTERVAL :duration SECOND),:arrival,:event)",params!{"id"=>&id,"attempt"=>attempt,"command"=>command_id,"origin"=>&current.state,"destination"=>destination,"mode"=>mode,"fare"=>fare,"duration"=>duration_seconds,"arrival"=>serde_json::to_string(arrival)?,"event"=>event.map(serde_json::to_string).transpose()?})?;
        tx.exec_drop("UPDATE weekly_attempts SET status='in_transit',state_json=:state,state_version=state_version+1 WHERE attempt_id=:attempt",params!{"attempt"=>attempt,"state"=>serde_json::to_string(&current)?})?;
        tx.exec_drop("INSERT INTO weekly_events(challenge_id,attempt_id,player_id,event_type,event_json) VALUES(:challenge,:attempt,:player,'departed',JSON_OBJECT('transit_id',:id,'destination',:destination,'mode',:mode,'fare',:fare,'duration_seconds',:duration))",params!{"challenge"=>challenge,"attempt"=>attempt,"player"=>player,"id"=>&id,"destination"=>destination,"mode"=>mode,"fare"=>fare,"duration"=>duration_seconds})?;
        tx.commit()?;
        Ok(id)
    }
    /// The witness accounts the player has already reached: events of completed journeys only, oldest first.
    pub fn weekly_accounts(
        &self,
        player: &str,
        attempt: &str,
    ) -> Result<Vec<serde_json::Value>, StorageError> {
        let rows: Vec<String> = self.pool.get_conn()?.exec(
            "SELECT CAST(t.event_json AS CHAR) FROM weekly_transits t JOIN weekly_attempts a ON a.attempt_id=t.attempt_id WHERE t.attempt_id=:attempt AND a.player_id=:player AND t.completed_at IS NOT NULL AND t.event_json IS NOT NULL ORDER BY t.departed_at,t.transit_id",
            params! {"attempt"=>attempt,"player"=>player},
        )?;
        rows.into_iter()
            .map(|json| Ok(serde_json::from_str(&json)?))
            .collect()
    }
    pub fn complete_weekly_arrival(
        &self,
        player: &str,
        attempt: &str,
    ) -> Result<bool, StorageError> {
        let mut c = self.pool.get_conn()?;
        let mut tx = c.start_transaction(TxOpts::default())?;
        let row:Option<(String,String,String)>=tx.exec_first("SELECT t.transit_id,CAST(t.arrival_state_json AS CHAR),a.challenge_id FROM weekly_transits t JOIN weekly_attempts a ON a.attempt_id=t.attempt_id WHERE t.attempt_id=:attempt AND a.player_id=:player AND t.completed_at IS NULL AND t.arrives_at<=UTC_TIMESTAMP() FOR UPDATE",params!{"attempt"=>attempt,"player"=>player})?;
        let Some((transit, state, challenge)) = row else {
            return Ok(false);
        };
        tx.exec_drop(
            "UPDATE weekly_transits SET completed_at=UTC_TIMESTAMP() WHERE transit_id=:transit",
            params! {"transit"=>&transit},
        )?;
        tx.exec_drop("UPDATE weekly_attempts SET status='active',state_json=:state,state_version=state_version+1 WHERE attempt_id=:attempt",params!{"attempt"=>attempt,"state"=>state})?;
        tx.exec_drop("INSERT INTO weekly_events(challenge_id,attempt_id,player_id,event_type,event_json) VALUES(:challenge,:attempt,:player,'arrived',JSON_OBJECT('transit_id',:transit))",params!{"challenge"=>challenge,"attempt"=>attempt,"player"=>player,"transit"=>transit})?;
        tx.commit()?;
        Ok(true)
    }
    pub fn execute_weekly<F>(
        &self,
        player: &str,
        attempt: &str,
        expected: u64,
        execute: F,
    ) -> Result<WeeklyAttemptView, StorageError>
    where
        F: FnOnce(GameState) -> Result<GameState, String>,
    {
        let mut c = self.pool.get_conn()?;
        let mut tx = c.start_transaction(TxOpts::default())?;
        let row:Option<(String,String,u64,String,String,u32)>=tx.exec_first("SELECT a.challenge_id,a.status,a.state_version,CAST(a.state_json AS CHAR),w.status,GREATEST(0,TIMESTAMPDIFF(MINUTE,DATE_SUB(w.ends_at,INTERVAL 7 DAY),UTC_TIMESTAMP())) FROM weekly_attempts a JOIN weekly_challenges w ON w.challenge_id=a.challenge_id WHERE a.attempt_id=:attempt AND a.player_id=:player AND UTC_TIMESTAMP()<w.ends_at FOR UPDATE",params!{"attempt"=>attempt,"player"=>player})?;
        let (challenge, status, version, state, challenge_status, real_minutes) =
            row.ok_or(StorageError::Forbidden)?;
        if version != expected {
            return Err(StorageError::VersionConflict(attempt.into()));
        }
        if status != "active" || challenge_status != "open" {
            return Err(StorageError::Command(
                "attempt is in transit or challenge closed".into(),
            ));
        }
        let mut current: GameState = serde_json::from_str(&state)?;
        current.elapsed = real_minutes;
        let next = execute(current).map_err(StorageError::Command)?;
        let solved = next.outcome.as_deref() == Some("solved");
        tx.exec_drop("UPDATE weekly_attempts SET state_json=:state,state_version=state_version+1,status=IF(:solved,'solved','active'),finished_at=IF(:solved,UTC_TIMESTAMP(),NULL) WHERE attempt_id=:attempt",params!{"state"=>serde_json::to_string(&next)?,"solved"=>solved,"attempt"=>attempt})?;
        tx.exec_drop("INSERT INTO weekly_events(challenge_id,attempt_id,player_id,event_type,event_json) VALUES(:challenge,:attempt,:player,:event,JSON_OBJECT())",params!{"challenge"=>&challenge,"attempt"=>attempt,"player"=>player,"event"=>if solved{"member_finished"}else{"command_applied"}})?;
        if solved {
            let event = tx.last_insert_id().unwrap_or(0);
            tx.exec_drop("UPDATE weekly_challenges SET winner_attempt_id=:attempt,winner_event_id=:event,status='closed' WHERE challenge_id=:challenge AND winner_attempt_id IS NULL",params!{"attempt"=>attempt,"event"=>event,"challenge"=>&challenge})?;
            if tx.affected_rows() == 1 {
                tx.exec_drop("UPDATE weekly_attempts SET status='closed' WHERE challenge_id=:challenge AND attempt_id<>:attempt AND status IN('active','in_transit')",params!{"challenge"=>&challenge,"attempt"=>attempt})?;
                tx.exec_drop("INSERT IGNORE INTO challenge_token_ledger(player_id,challenge_id,amount,reason) VALUES(:player,:challenge,5,'weekly_win')",params!{"player"=>player,"challenge"=>&challenge})?;
                tx.exec_drop("UPDATE players SET challenge_tokens=challenge_tokens+5 WHERE player_id=:player",params!{"player"=>player})?;
                tx.exec_drop("INSERT INTO weekly_events(challenge_id,attempt_id,player_id,event_type,event_json) VALUES(:challenge,:attempt,:player,'first_valid_capture',JSON_OBJECT('reward_tokens',5))",params!{"challenge"=>&challenge,"attempt"=>attempt,"player"=>player})?;
            }
        }
        tx.commit()?;
        self.weekly_attempt(player, attempt)
    }
    pub fn manage_group_member(
        &self,
        actor: &str,
        group: &str,
        target: &str,
        role: Option<&str>,
    ) -> Result<(), StorageError> {
        let mut c = self.pool.get_conn()?;
        let mut tx = c.start_transaction(TxOpts::default())?;
        let actor_role = Self::group_role(&mut tx, group, actor)?.ok_or(StorageError::Forbidden)?;
        let target_role =
            Self::group_role(&mut tx, group, target)?.ok_or(StorageError::Forbidden)?;
        if !matches!(actor_role.as_str(), "owner" | "admin")
            || target_role == "owner"
            || actor == target
            || actor_role == "admin" && target_role == "admin"
        {
            return Err(StorageError::Forbidden);
        }
        match role {
            Some(r @ ("admin" | "member")) if actor_role == "owner" => tx.exec_drop(
                "UPDATE group_members SET role=:role WHERE group_id=:group AND player_id=:target",
                params! {"role"=>r,"group"=>group,"target"=>target},
            )?,
            None => tx.exec_drop(
                "DELETE FROM group_members WHERE group_id=:group AND player_id=:target",
                params! {"group"=>group,"target"=>target},
            )?,
            _ => return Err(StorageError::Forbidden),
        }
        tx.exec_drop("INSERT INTO group_audit(group_id,actor_id,event_type,metadata_json) VALUES(:group,:actor,:event,JSON_OBJECT('player_id',:target))",params!{"group"=>group,"actor"=>actor,"event"=>if role.is_some(){"role_changed"}else{"member_removed"},"target"=>target})?;
        tx.commit()?;
        Ok(())
    }
    pub fn delete_group(&self, owner: &str, group: &str) -> Result<(), StorageError> {
        let mut c = self.pool.get_conn()?;
        let mut tx = c.start_transaction(TxOpts::default())?;
        if Self::group_role(&mut tx, group, owner)?.as_deref() != Some("owner") {
            return Err(StorageError::Forbidden);
        }
        tx.exec_drop("UPDATE player_groups SET status='deleted',deleted_at=UTC_TIMESTAMP() WHERE group_id=:group",params!{"group"=>group})?;
        tx.exec_drop("UPDATE weekly_challenges SET status='cancelled' WHERE group_id=:group AND status IN('registration','open')",params!{"group"=>group})?;
        tx.exec_drop("UPDATE weekly_attempts a JOIN weekly_challenges w ON w.challenge_id=a.challenge_id SET a.status='forfeited' WHERE w.group_id=:group AND a.status IN('active','in_transit')",params!{"group"=>group})?;
        tx.exec_drop("INSERT INTO group_audit(group_id,actor_id,event_type,metadata_json) VALUES(:group,:owner,'group_deleted',JSON_OBJECT())",params!{"group"=>group,"owner"=>owner})?;
        tx.commit()?;
        Ok(())
    }
    pub fn weekly_challenge_details(
        &self,
        player: &str,
        challenge: &str,
    ) -> Result<serde_json::Value, StorageError> {
        let mut c = self.pool.get_conn()?;
        let member:u64=c.exec_first("SELECT COUNT(*) FROM weekly_challenges w JOIN group_members m ON m.group_id=w.group_id WHERE w.challenge_id=:challenge AND m.player_id=:player",params!{"challenge"=>challenge,"player"=>player})?.unwrap_or(0);
        if member != 1 {
            return Err(StorageError::Forbidden);
        }
        let row:(String,String,String,String,Option<String>)=c.exec_first("SELECT status,timezone,DATE_FORMAT(starts_at,'%Y-%m-%dT%H:%i:%sZ'),DATE_FORMAT(ends_at,'%Y-%m-%dT%H:%i:%sZ'),winner_attempt_id FROM weekly_challenges WHERE challenge_id=:challenge",params!{"challenge"=>challenge})?.ok_or(StorageError::Forbidden)?;
        let standings:Vec<(String,String,String,Option<String>)>=c.exec("SELECT p.username,a.status,a.attempt_id,DATE_FORMAT(a.finished_at,'%Y-%m-%dT%H:%i:%sZ') FROM weekly_attempts a JOIN players p ON p.player_id=a.player_id WHERE a.challenge_id=:challenge ORDER BY a.finished_at IS NULL,a.finished_at,a.attempt_id",params!{"challenge"=>challenge})?;
        Ok(
            serde_json::json!({"challenge_id":challenge,"status":row.0,"timezone":row.1,"starts_at":row.2,"ends_at":row.3,"winner_attempt_id":row.4,"standings":standings.into_iter().map(|(username,status,attempt_id,finished_at)|serde_json::json!({"username":username,"status":status,"attempt_id":attempt_id,"finished_at":finished_at})).collect::<Vec<_>>() }),
        )
    }
    pub fn weekly_history(&self, player: &str) -> Result<Vec<serde_json::Value>, StorageError> {
        let rows:Vec<(String,String,String,String)>=self.pool.get_conn()?.exec("SELECT w.challenge_id,g.group_name,w.status,DATE_FORMAT(w.week_key,'%Y-%m-%d') FROM weekly_challenges w JOIN player_groups g ON g.group_id=w.group_id JOIN group_members m ON m.group_id=g.group_id WHERE m.player_id=:player ORDER BY w.week_key DESC LIMIT 52",params!{"player"=>player})?;
        Ok(rows.into_iter().map(|(challenge_id,group_name,status,week)|serde_json::json!({"challenge_id":challenge_id,"group_name":group_name,"status":status,"week":week})).collect())
    }
    pub fn set_weekly_notifications(
        &self,
        player: &str,
        web: bool,
        email: bool,
    ) -> Result<(), StorageError> {
        self.pool.get_conn()?.exec_drop("UPDATE players SET weekly_web_notifications=:web,weekly_email_notifications=:email WHERE player_id=:player",params!{"player"=>player,"web"=>web,"email"=>email})?;
        Ok(())
    }
    pub fn weekly_notifications(
        &self,
        player: &str,
    ) -> Result<Vec<serde_json::Value>, StorageError> {
        let rows:Vec<(u64,String,String,String,Option<String>)>=self.pool.get_conn()?.exec("SELECT notification_id,notification_type,channel,CAST(payload_json AS CHAR),DATE_FORMAT(read_at,'%Y-%m-%dT%H:%i:%sZ') FROM weekly_notifications WHERE player_id=:player ORDER BY created_at DESC LIMIT 100",params!{"player"=>player})?;
        rows.into_iter().map(|(id,kind,channel,payload,read_at)|Ok(serde_json::json!({"notification_id":id,"type":kind,"channel":channel,"payload":serde_json::from_str::<serde_json::Value>(&payload)?,"read_at":read_at}))).collect()
    }
    pub fn group_invitations(&self, player: &str) -> Result<Vec<serde_json::Value>, StorageError> {
        let rows:Vec<(String,String,String,String,String)>=self.pool.get_conn()?.exec("SELECT i.invitation_id,i.status,g.group_id,g.group_name,DATE_FORMAT(i.expires_at,'%Y-%m-%dT%H:%i:%sZ') FROM group_invitations i JOIN player_groups g ON g.group_id=i.group_id WHERE i.invitee_id=:player ORDER BY i.created_at DESC LIMIT 100",params!{"player"=>player})?;
        Ok(rows.into_iter().map(|(invitation_id,status,group_id,group_name,expires_at)|serde_json::json!({"invitation_id":invitation_id,"status":status,"group_id":group_id,"group_name":group_name,"expires_at":expires_at})).collect())
    }
    pub fn cancel_weekly_challenge(
        &self,
        actor: &str,
        challenge: &str,
        reason: &str,
    ) -> Result<(), StorageError> {
        if reason.trim().is_empty() || reason.len() > 500 {
            return Err(StorageError::Command("cancellation reason required".into()));
        }
        let mut c = self.pool.get_conn()?;
        let mut tx = c.start_transaction(TxOpts::default())?;
        let role:Option<String>=tx.exec_first("SELECT m.role FROM weekly_challenges w JOIN group_members m ON m.group_id=w.group_id WHERE w.challenge_id=:challenge AND m.player_id=:actor FOR UPDATE",params!{"challenge"=>challenge,"actor"=>actor})?;
        if !matches!(role.as_deref(), Some("owner" | "admin")) {
            return Err(StorageError::Forbidden);
        }
        tx.exec_drop("UPDATE weekly_challenges SET status='cancelled' WHERE challenge_id=:challenge AND status IN('registration','open')",params!{"challenge"=>challenge})?;
        if tx.affected_rows() != 1 {
            return Err(StorageError::Command(
                "challenge cannot be cancelled".into(),
            ));
        }
        tx.exec_drop("UPDATE weekly_attempts SET status='forfeited' WHERE challenge_id=:challenge AND status IN('active','in_transit')",params!{"challenge"=>challenge})?;
        tx.exec_drop("INSERT INTO weekly_events(challenge_id,player_id,event_type,event_json) VALUES(:challenge,:actor,'challenge_cancelled',JSON_OBJECT('reason',:reason))",params!{"challenge"=>challenge,"actor"=>actor,"reason"=>reason})?;
        tx.commit()?;
        Ok(())
    }
    pub fn expire_weekly_challenges(&self) -> Result<u64, StorageError> {
        let mut c = self.pool.get_conn()?;
        let mut tx = c.start_transaction(TxOpts::default())?;
        tx.exec_drop("UPDATE weekly_challenges SET status='expired' WHERE status IN('registration','open') AND ends_at<=UTC_TIMESTAMP() AND winner_attempt_id IS NULL",())?;
        let count = tx.affected_rows();
        tx.exec_drop("UPDATE weekly_attempts a JOIN weekly_challenges w ON w.challenge_id=a.challenge_id SET a.status='expired' WHERE w.status='expired' AND a.status IN('active','in_transit')",())?;
        tx.commit()?;
        Ok(count)
    }
    pub fn weekly_events(
        &self,
        player: &str,
        challenge: &str,
        after: u64,
    ) -> Result<Vec<serde_json::Value>, StorageError> {
        let mut c = self.pool.get_conn()?;
        let member:u64=c.exec_first("SELECT COUNT(*) FROM weekly_challenges w JOIN group_members m ON m.group_id=w.group_id WHERE w.challenge_id=:challenge AND m.player_id=:player",params!{"challenge"=>challenge,"player"=>player})?.unwrap_or(0);
        if member != 1 {
            return Err(StorageError::Forbidden);
        }
        let rows:Vec<(u64,String,String,String)>=c.exec("SELECT event_id,event_type,CAST(event_json AS CHAR),DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.%fZ') FROM weekly_events WHERE challenge_id=:challenge AND event_id>:after ORDER BY event_id LIMIT 200",params!{"challenge"=>challenge,"after"=>after})?;
        rows.into_iter().map(|(event_id,event_type,data,created_at)|Ok(serde_json::json!({"event_id":event_id,"event_type":event_type,"data":serde_json::from_str::<serde_json::Value>(&data)?,"created_at":created_at}))).collect()
    }
}
