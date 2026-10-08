use naijachase_content::Catalogue;
use naijachase_contracts::{Command, GameState};
use naijachase_core::apply;
use std::{collections::BTreeMap, path::Path};
#[test]
fn all_missions_complete_in_rust() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
    let data = Catalogue::load(&root).unwrap();
    for m in data.missions.values() {
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
            replay: vec![],
            outcome: None,
            economy: Default::default(),
        };
        let traits = p.traits();
        for stage in 0..route.len() {
            let (k, v) = traits[stage];
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
        s.hideout_venue = "market".into();
        s = apply(
            s,
            Command::SearchHideout {
                venue_id: "market".into(),
                minutes: 45,
            },
        )
        .unwrap()
        .0;
        assert_eq!(s.outcome.as_deref(), Some("solved"), "{}", m.mission_id);
        assert!(
            (7200..8640).contains(&s.elapsed),
            "{} took {} minutes",
            m.mission_id,
            s.elapsed
        );
    }
}
