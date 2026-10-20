//! Attempt-specific plans. Selection is pure; callers persist the complete plan
//! and record history only when an interview is actually delivered.
use crate::{Catalogue, ClueAtom};
use naijachase_contracts::{WitnessClue, WitnessHistory};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, Serialize)]
pub struct WitnessCoverage {
    pub atom_id: String,
    pub state: String,
    pub venue_id: String,
    pub eligible_stops: usize,
    pub legacy_uses: usize,
    pub sampled_uses: usize,
    pub exclusion_reason: String,
}

fn rank(seed: u64, stage: usize, purpose: &str, id: &str) -> u64 {
    let digest = Sha256::digest(format!("witness-v1|{seed}|{stage}|{purpose}|{id}"));
    u64::from_be_bytes(digest[..8].try_into().unwrap())
}

fn candidates(atom: &ClueAtom) -> BTreeSet<&str> {
    atom.candidate_states.split('|').collect()
}

impl Catalogue {
    /// All structurally valid combinations; the decisive landmark cannot be
    /// used again as an ambiguous witness. Each pair must reduce the options.
    fn witness_combinations<'a>(&'a self, origin: &str, target: &str) -> Vec<[&'a ClueAtom; 3]> {
        let Some(atoms) = self.atoms.get(target) else {
            return vec![];
        };
        let available = |atom: &&ClueAtom| {
            self.location_venues
                .contains_key(&(origin.to_owned(), atom.venue_id.clone()))
                && candidates(atom).contains(target)
        };
        let decisive = atoms
            .iter()
            .filter(|atom| atom.dimension == "landmark")
            .filter(available);
        let ambiguous = atoms
            .iter()
            .filter(|atom| atom.dimension != "landmark" && candidates(atom).len() > 1)
            .filter(available)
            .collect::<Vec<_>>();
        let mut combinations = vec![];
        for landmark in decisive {
            for (i, left) in ambiguous.iter().enumerate() {
                if left.venue_id == landmark.venue_id {
                    continue;
                }
                for right in ambiguous.iter().skip(i + 1) {
                    if right.venue_id == landmark.venue_id || right.venue_id == left.venue_id {
                        continue;
                    }
                    let l = candidates(left);
                    let r = candidates(right);
                    let intersection = l.intersection(&r).count();
                    if intersection < l.len() || intersection < r.len() {
                        combinations.push([*left, *right, landmark]);
                    }
                }
            }
        }
        combinations
    }

    pub fn plan_witnesses(
        &self,
        route: &[String],
        difficulty: u8,
        seed: u64,
        history: &WitnessHistory,
    ) -> Result<Vec<Vec<WitnessClue>>, String> {
        let difficulty = match difficulty {
            1 | 2 => "easy",
            3 => "medium",
            _ => "hard",
        };
        let mut reserved = BTreeSet::new();
        let mut reserved_dialogues = BTreeSet::new();
        let mut result = vec![];
        for (stage, origin) in route.iter().enumerate() {
            let target = route.get(stage + 1).unwrap_or(origin);
            let combinations = self.witness_combinations(origin, target);
            // Compute each atom's preference once rather than hashing it for
            // every possible pair. Unheard clues outrank different wordings.
            let scores = self
                .atoms
                .get(target)
                .into_iter()
                .flatten()
                .map(|atom| {
                    let last = history.atoms.get(&atom.atom_id);
                    (
                        atom.atom_id.as_str(),
                        (
                            usize::from(last.is_some()),
                            usize::from(reserved.contains(&atom.atom_id)),
                            u128::from(last.copied().unwrap_or(0)),
                            u128::from(rank(seed, stage, "atom", &atom.atom_id)),
                        ),
                    )
                })
                .collect::<BTreeMap<_, _>>();
            let selected = combinations
                .into_iter()
                .min_by_key(|triple| {
                    triple.iter().fold((0, 0, 0, 0), |sum, atom| {
                        let s = scores[atom.atom_id.as_str()];
                        (sum.0 + s.0, sum.1 + s.1, sum.2 + s.2, sum.3 + s.3)
                    })
                })
                .ok_or_else(|| format!("no valid witness plan for {origin} -> {target}"))?;
            let mut plan = vec![];
            for atom in selected {
                let variant = self
                    .dialogue_variants
                    .get(&atom.atom_id)
                    .into_iter()
                    .flatten()
                    .filter(|v| v.difficulty == difficulty && v.speech_register == "English")
                    .min_by_key(|v| {
                        (
                            usize::from(history.dialogues.contains_key(&v.variant_id)),
                            usize::from(reserved_dialogues.contains(&v.variant_id)),
                            history.dialogues.get(&v.variant_id).copied().unwrap_or(0),
                            rank(seed, stage, "dialogue", &v.variant_id),
                        )
                    });
                let supplemental = self.atoms[target]
                    .iter()
                    .filter(|a| a.atom_id != atom.atom_id && a.venue_id == atom.venue_id)
                    .min_by_key(|a| rank(seed, stage, "supplemental", &a.atom_id))
                    .map(|a| a.dialogue.clone());
                plan.push(WitnessClue {
                    atom_id: atom.atom_id.clone(),
                    state: atom.state.clone(),
                    dimension: atom.dimension.clone(),
                    candidate_states: atom.candidate_states.clone(),
                    venue_id: atom.venue_id.clone(),
                    venue_name: atom.venue_name.clone(),
                    witness_roles: atom.witness_roles.clone(),
                    dialogue: variant
                        .map(|v| v.dialogue.clone())
                        .unwrap_or_else(|| atom.dialogue.clone()),
                    dialogue_variant_id: variant.map(|v| v.variant_id.clone()),
                    supplemental_dialogue: supplemental,
                });
                reserved.insert(atom.atom_id.clone());
                if let Some(v) = variant {
                    reserved_dialogues.insert(v.variant_id.clone());
                }
            }
            plan.sort_by_key(|a| rank(seed, stage, "position", &a.atom_id));
            result.push(plan);
        }
        Ok(result)
    }

    /// Structural reachability is exhaustive over authored routes. Sampled
    /// exposure is diagnostic, never proof that an eligible clue is unreachable.
    pub fn witness_coverage(&self, samples: u64) -> Result<Vec<WitnessCoverage>, String> {
        let mut rows = self
            .atoms
            .values()
            .flatten()
            .map(|a| {
                (
                    a.atom_id.clone(),
                    WitnessCoverage {
                        atom_id: a.atom_id.clone(),
                        state: a.state.clone(),
                        venue_id: a.venue_id.clone(),
                        eligible_stops: 0,
                        legacy_uses: 0,
                        sampled_uses: 0,
                        exclusion_reason: String::new(),
                    },
                )
            })
            .collect::<BTreeMap<_, _>>();
        let mut eligible = BTreeMap::new();
        for mission in self.missions.values() {
            let route = self.route(mission).map_err(|e| e.to_string())?;
            for (stage, origin) in route.iter().enumerate() {
                let target = route.get(stage + 1).unwrap_or(origin);
                let ids = eligible
                    .entry((origin.clone(), target.clone()))
                    .or_insert_with(|| {
                        self.witness_combinations(origin, target)
                            .into_iter()
                            .flatten()
                            .map(|a| a.atom_id.clone())
                            .collect::<BTreeSet<_>>()
                    });
                for id in ids.iter() {
                    rows.get_mut(id).unwrap().eligible_stops += 1;
                }
                for atom in self.clue_plan(&route, &mission.mission_id, stage, origin) {
                    rows.get_mut(&atom.atom_id).unwrap().legacy_uses += 1;
                }
            }
            for sample in 0..samples {
                let seed = rank(sample, 0, "coverage", &mission.mission_id);
                for clue in self
                    .plan_witnesses(&route, mission.difficulty, seed, &WitnessHistory::default())?
                    .into_iter()
                    .flatten()
                {
                    rows.get_mut(&clue.atom_id).unwrap().sampled_uses += 1;
                }
            }
        }
        for row in rows.values_mut() {
            if row.eligible_stops == 0 {
                let origins = eligible
                    .keys()
                    .filter(|(_, target)| target == &row.state)
                    .map(|(origin, _)| origin)
                    .filter(|origin| {
                        self.location_venues
                            .contains_key(&((*origin).clone(), row.venue_id.clone()))
                    })
                    .collect::<Vec<_>>();
                let shares_decisive_venue = !origins.is_empty()
                    && origins.iter().all(|origin| {
                        self.atoms[&row.state]
                            .iter()
                            .filter(|a| a.dimension == "landmark")
                            .filter(|a| {
                                self.location_venues
                                    .contains_key(&((**origin).clone(), a.venue_id.clone()))
                            })
                            .all(|a| a.venue_id == row.venue_id)
                    });
                row.exclusion_reason = if origins.is_empty() {
                    "No suitable venue placement on an authored route"
                } else if shares_decisive_venue {
                    "Shares the decisive landmark witness's venue; three distinct venues are required"
                } else {
                    "No compatible ambiguous pair narrows the destination on an authored route"
                }.into();
            }
        }
        Ok(rows.into_values().collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn catalogue() -> Catalogue {
        Catalogue::load(&std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..")).unwrap()
    }

    #[test]
    fn seeded_attempts_are_repeatable_varied_and_valid_across_the_catalogue() {
        let c = catalogue();
        let mut changed = 0;
        for mission in c.missions.values() {
            let route = c.route(mission).unwrap();
            let history = WitnessHistory::default();
            let first = c
                .plan_witnesses(&route, mission.difficulty, 7, &history)
                .unwrap();
            assert_eq!(
                first,
                c.plan_witnesses(&route, mission.difficulty, 7, &history)
                    .unwrap()
            );
            let second = c
                .plan_witnesses(&route, mission.difficulty, 8, &history)
                .unwrap();
            changed += usize::from(first != second);
            for plan in [&first, &second] {
                assert_eq!(plan.len(), route.len());
                for (stage, clues) in plan.iter().enumerate() {
                    assert_eq!(clues.len(), 3);
                    assert_eq!(
                        clues
                            .iter()
                            .map(|c| &c.venue_id)
                            .collect::<BTreeSet<_>>()
                            .len(),
                        3
                    );
                    assert_eq!(
                        clues.iter().filter(|c| c.dimension == "landmark").count(),
                        1
                    );
                    let target = route.get(stage + 1).unwrap_or(&route[stage]);
                    let ambiguous = clues
                        .iter()
                        .filter(|c| c.dimension != "landmark")
                        .map(|c| c.candidate_states.split('|').collect::<BTreeSet<_>>())
                        .collect::<Vec<_>>();
                    let intersection = ambiguous[0]
                        .intersection(&ambiguous[1])
                        .copied()
                        .collect::<BTreeSet<_>>();
                    assert!(intersection.contains(target.as_str()));
                    assert!(
                        intersection.len() < ambiguous[0].len()
                            || intersection.len() < ambiguous[1].len()
                    );
                    for clue in clues {
                        assert!(
                            c.location_venues
                                .contains_key(&(route[stage].clone(), clue.venue_id.clone()))
                        );
                        let variant = c.dialogue_variants[&clue.atom_id]
                            .iter()
                            .find(|v| Some(&v.variant_id) == clue.dialogue_variant_id.as_ref())
                            .unwrap();
                        assert_eq!(variant.speech_register, "English");
                        assert_eq!(
                            variant.difficulty,
                            match mission.difficulty {
                                1 | 2 => "easy",
                                3 => "medium",
                                _ => "hard",
                            }
                        );
                        assert_eq!(variant.dialogue, clue.dialogue);
                    }
                }
            }
        }
        assert_eq!(changed, c.missions.len());
    }

    #[test]
    fn unheard_clues_then_oldest_clues_and_wordings_receive_priority() {
        let mut c = catalogue();
        let base = c.witness_combinations("Kano", "Kano")[0].map(Clone::clone);
        let mut alternative = base[0].clone();
        alternative.atom_id = "fresh-alternative".into();
        let original = base[0].atom_id.clone();
        let fresh = alternative.atom_id.clone();
        c.atoms.insert(
            "Kano".into(),
            base.into_iter().chain([alternative]).collect(),
        );
        let route = vec!["Kano".into()];
        let mut history = WitnessHistory::default();
        for a in &c.atoms["Kano"] {
            history.atoms.insert(a.atom_id.clone(), 100);
        }
        history.atoms.remove(&fresh);
        for seed in 0..20 {
            let plan = c.plan_witnesses(&route, 1, seed, &history).unwrap();
            assert!(plan[0].iter().any(|clue| clue.atom_id == fresh));
            assert!(!plan[0].iter().any(|clue| clue.atom_id == original));
        }
        history.atoms.insert(fresh.clone(), 200);
        history.atoms.insert(original.clone(), 1);
        let plan = c.plan_witnesses(&route, 1, 7, &history).unwrap();
        assert!(plan[0].iter().any(|clue| clue.atom_id == original));
        let clue = plan[0]
            .iter()
            .find(|clue| clue.atom_id == original)
            .unwrap();
        let variants = c.dialogue_variants[&original]
            .iter()
            .filter(|v| v.difficulty == "easy")
            .collect::<Vec<_>>();
        for v in &variants {
            history.dialogues.insert(v.variant_id.clone(), 100);
        }
        let unseen = variants
            .iter()
            .find(|v| Some(&v.variant_id) != clue.dialogue_variant_id.as_ref())
            .unwrap();
        history.dialogues.remove(&unseen.variant_id);
        let plan = c.plan_witnesses(&route, 1, 7, &history).unwrap();
        assert_eq!(
            plan[0]
                .iter()
                .find(|c| c.atom_id == original)
                .unwrap()
                .dialogue_variant_id
                .as_ref(),
            Some(&unseen.variant_id)
        );
        history.dialogues.insert(unseen.variant_id.clone(), 200);
        history.dialogues.insert(variants[0].variant_id.clone(), 1);
        let plan = c.plan_witnesses(&route, 1, 7, &history).unwrap();
        assert_eq!(
            plan[0]
                .iter()
                .find(|c| c.atom_id == original)
                .unwrap()
                .dialogue_variant_id
                .as_ref(),
            Some(&variants[0].variant_id)
        );
    }

    #[test]
    fn catalogue_accepts_new_clues_and_formulations_without_changing_count_limits() {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        let temp = std::env::temp_dir().join(format!(
            "witness-growth-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        for path in [
            "data/missions/missions.csv",
            "data/gameplay/thief-profiles.csv",
            "data/gameplay/state-hubs.csv",
            "data/gameplay/state-travel.csv",
            "data/locations/locations.csv",
            "data/gameplay/state-clue-atoms.csv",
            "data/gameplay/mission-narratives.csv",
            "data/thieves/thieves.csv",
            "data/gameplay/venues.csv",
            "data/gameplay/venue-experiences.csv",
            "data/gameplay/location-venue-map.csv",
            "data/gameplay/clue-dialogue-variants.csv",
        ] {
            let target = temp.join(path);
            std::fs::create_dir_all(target.parent().unwrap()).unwrap();
            std::fs::copy(root.join(path), target).unwrap();
        }
        let atom_path = temp.join("data/gameplay/state-clue-atoms.csv");
        let original = csv::Reader::from_path(&atom_path)
            .unwrap()
            .records()
            .next()
            .unwrap()
            .unwrap();
        let source_id = original[0].to_owned();
        let mut added = original.iter().map(str::to_owned).collect::<Vec<_>>();
        added[0] = "SCA-TEST-ADDED".into();
        let mut writer = csv::Writer::from_writer(
            std::fs::OpenOptions::new()
                .append(true)
                .open(&atom_path)
                .unwrap(),
        );
        writer.write_record(added).unwrap();
        writer.flush().unwrap();
        let variants_path = temp.join("data/gameplay/clue-dialogue-variants.csv");
        let records = csv::Reader::from_path(&variants_path)
            .unwrap()
            .records()
            .map(Result::unwrap)
            .filter(|r| r[1] == source_id)
            .collect::<Vec<_>>();
        let mut writer = csv::Writer::from_writer(
            std::fs::OpenOptions::new()
                .append(true)
                .open(&variants_path)
                .unwrap(),
        );
        for record in records {
            let mut fields = record.iter().map(str::to_owned).collect::<Vec<_>>();
            fields[0] = format!("added-{}", fields[0]);
            fields[1] = "SCA-TEST-ADDED".into();
            writer.write_record(fields).unwrap();
        }
        writer.flush().unwrap();
        let catalogue = Catalogue::load(&temp).unwrap();
        assert!(
            catalogue
                .atoms
                .values()
                .flatten()
                .any(|a| a.atom_id == "SCA-TEST-ADDED")
        );
        assert_eq!(catalogue.dialogue_variants["SCA-TEST-ADDED"].len(), 9);
        std::fs::remove_dir_all(temp).unwrap();
    }

    #[test]
    fn authored_clues_are_reachable_and_coverage_reports_invalid_venues() {
        let mut c = catalogue();
        let mut unreachable = c.atoms["Kano"][0].clone();
        unreachable.atom_id = "unavailable-venue".into();
        unreachable.venue_id = "unavailable-venue".into();
        c.atoms.get_mut("Kano").unwrap().push(unreachable);
        let mut collision = c.atoms["Kano"][0].clone();
        collision.atom_id = "landmark-venue-collision".into();
        collision.venue_id = c.atoms["Kano"]
            .iter()
            .find(|atom| atom.dimension == "landmark")
            .unwrap()
            .venue_id
            .clone();
        c.atoms.get_mut("Kano").unwrap().push(collision);
        let rows = c.witness_coverage(0).unwrap();
        let excluded = rows
            .iter()
            .find(|r| r.atom_id == "unavailable-venue")
            .unwrap();
        assert_eq!(excluded.eligible_stops, 0);
        assert!(!excluded.exclusion_reason.is_empty());
        let collision = rows
            .iter()
            .find(|r| r.atom_id == "landmark-venue-collision")
            .unwrap();
        assert_eq!(collision.eligible_stops, 0);
        assert!(
            collision
                .exclusion_reason
                .contains("landmark witness's venue")
        );
        let authored_exclusions = rows
            .iter()
            .filter(|r| {
                r.eligible_stops == 0
                    && r.atom_id != "unavailable-venue"
                    && r.atom_id != "landmark-venue-collision"
            })
            .collect::<Vec<_>>();
        assert!(
            authored_exclusions.is_empty(),
            "authored witness clues must have a valid combination on a case route: {authored_exclusions:?}"
        );
        assert!(
            rows.iter().any(|r| r.eligible_stops > 0
                && r.sampled_uses == 0
                && r.exclusion_reason.is_empty())
        );
    }
}
