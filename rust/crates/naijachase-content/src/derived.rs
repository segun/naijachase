//! Immutable gameplay data computed before a loaded catalogue is published.
//! Atom indices avoid cloning clue text or holding self-referential borrows.
//! Off-trail choices depend only on state and rotation, so share those lists
//! across missions and stages. Player visits and other mutable state stay in API.
use super::{Catalogue, ClueAtom, Mission};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Default)]
pub(super) struct Derived {
    pub routes: BTreeMap<String, Vec<String>>,
    plans: BTreeMap<(String, usize), Vec<usize>>,
    off_trail: BTreeMap<(String, usize), Vec<String>>,
    budgets: BTreeMap<u8, u32>,
    local_costs: BTreeMap<String, Vec<u32>>,
}

impl Catalogue {
    pub(super) fn precompute(&mut self) -> Result<(), String> {
        for mission in self.missions.values() {
            self.derived.routes.insert(
                mission.mission_id.clone(),
                self.compute_route(mission).map_err(|e| e.to_string())?,
            );
        }
        for state in self.hubs.keys() {
            self.derived
                .local_costs
                .insert(state.clone(), local_costs_for_state(self, state));
            if let Some(atoms) = self.atoms.get(state) {
                for rotation in 0..atoms.len() {
                    let mut ids = Vec::new();
                    for offset in 0..atoms.len() {
                        let venue = &atoms[(rotation + offset) % atoms.len()].venue_id;
                        if self
                            .location_venues
                            .contains_key(&(state.clone(), venue.clone()))
                            && !ids.contains(venue)
                        {
                            ids.push(venue.clone());
                            if ids.len() == 3 {
                                break;
                            }
                        }
                    }
                    self.derived
                        .off_trail
                        .insert((state.clone(), rotation), ids);
                }
            }
        }
        for mission in self.missions.values() {
            let route = &self.derived.routes[&mission.mission_id];
            for (stage, state) in route.iter().enumerate() {
                let target = route.get(stage + 1).unwrap_or(state);
                let plan = witness_clue_plan_for(self, route, &mission.mission_id, stage, state);
                let indices = plan
                    .iter()
                    .map(|atom| {
                        self.atoms[target]
                            .iter()
                            .position(|candidate| std::ptr::eq(candidate, *atom))
                            .unwrap()
                    })
                    .collect();
                self.derived
                    .plans
                    .insert((mission.mission_id.clone(), stage), indices);
            }
            let baseline = mission_budget_baseline(self, mission)?;
            let maximum = self.derived.budgets.entry(mission.difficulty).or_default();
            *maximum = (*maximum).max(baseline);
        }
        for (difficulty, maximum) in &mut self.derived.budgets {
            let reserve = maximum
                .saturating_mul(naijachase_core::case_budget_reserve_percent(*difficulty))
                .div_ceil(100);
            let reserved = maximum.saturating_add(reserve);
            *maximum = reserved.saturating_add(4_999) / 5_000 * 5_000;
        }
        Ok(())
    }

    pub fn opening_budget(&self, mission: &Mission) -> Option<u32> {
        self.derived.budgets.get(&mission.difficulty).copied()
    }

    pub fn budget_baseline(&self, mission: &Mission) -> Result<u32, String> {
        mission_budget_baseline(self, mission)
    }

    pub fn clue_plan<'a>(
        &'a self,
        route: &[String],
        mission_id: &str,
        stage: usize,
        actual_state: &str,
    ) -> Vec<&'a ClueAtom> {
        if self.derived.routes.get(mission_id).map(Vec::as_slice) != Some(route) {
            return witness_clue_plan_for(self, route, mission_id, stage, actual_state);
        }
        if route.get(stage).map(String::as_str) != Some(actual_state) {
            return vec![];
        }
        let target = route.get(stage + 1).unwrap_or(&route[stage]);
        self.derived
            .plans
            .get(&(mission_id.to_owned(), stage))
            .into_iter()
            .flatten()
            .map(|index| &self.atoms[target][*index])
            .collect()
    }

    pub fn available_venues(
        &self,
        route: &[String],
        mission_id: &str,
        stage: usize,
        actual_state: &str,
    ) -> Vec<String> {
        let Some(state) = route.get(stage) else {
            return vec![];
        };
        if state == actual_state {
            return self
                .clue_plan(route, mission_id, stage, actual_state)
                .iter()
                .map(|atom| atom.venue_id.clone())
                .collect();
        }
        let Some(atoms) = self
            .atoms
            .get(actual_state)
            .filter(|atoms| !atoms.is_empty())
        else {
            return vec![];
        };
        let rotation =
            (mission_id.bytes().map(usize::from).sum::<usize>() + stage * 7) % atoms.len();
        self.derived
            .off_trail
            .get(&(actual_state.to_owned(), rotation))
            .cloned()
            .unwrap_or_default()
    }
}

fn candidate_states(atom: &ClueAtom) -> BTreeSet<&str> {
    atom.candidate_states.split('|').collect()
}

fn witness_clue_plan_for<'a>(
    catalogue: &'a Catalogue,
    route: &[String],
    mission_id: &str,
    stage: usize,
    actual_state: &str,
) -> Vec<&'a ClueAtom> {
    let Some(route_state) = route.get(stage) else {
        return vec![];
    };
    if route_state != actual_state {
        return vec![];
    }
    let target = route.get(stage + 1).unwrap_or(route_state);
    let Some(atoms) = catalogue.atoms.get(target) else {
        return vec![];
    };
    let start = (mission_id.bytes().map(usize::from).sum::<usize>() + stage * 7) % atoms.len();
    let ordered = (0..atoms.len())
        .map(|offset| &atoms[(start + offset) % atoms.len()])
        .collect::<Vec<_>>();
    let available = |atom: &&ClueAtom| {
        catalogue
            .location_venues
            .contains_key(&(actual_state.to_owned(), atom.venue_id.clone()))
    };
    let decisive = ordered
        .iter()
        .copied()
        .filter(|atom| atom.dimension == "landmark")
        .find(available);
    let Some(decisive) = decisive else {
        return vec![];
    };

    let ambiguous = ordered
        .iter()
        .copied()
        .filter(|atom| atom.venue_id != decisive.venue_id)
        .filter(|atom| candidate_states(atom).len() > 1)
        .filter(available)
        .collect::<Vec<_>>();

    let mut fallback = None;
    let mut selected = None;
    'pairs: for (left_index, left) in ambiguous.iter().enumerate() {
        for right in ambiguous.iter().skip(left_index + 1) {
            if left.venue_id == right.venue_id {
                continue;
            }
            let left_candidates = candidate_states(left);
            let right_candidates = candidate_states(right);
            let intersection = left_candidates
                .intersection(&right_candidates)
                .copied()
                .collect::<BTreeSet<_>>();
            if !intersection.contains(target.as_str()) {
                continue;
            }
            let reduces_options = intersection.len() < left_candidates.len()
                || intersection.len() < right_candidates.len();
            fallback.get_or_insert((*left, *right));
            if reduces_options {
                selected = Some((*left, *right));
                break 'pairs;
            }
        }
    }
    let Some((left, right)) = selected.or(fallback) else {
        return vec![];
    };
    let mut plan = vec![left, right, decisive];
    plan.sort_by_key(|atom| {
        Sha256::digest(format!("clue-position|{mission_id}|{stage}|{}", atom.atom_id).as_bytes())
            .to_vec()
    });
    plan
}

#[cfg(test)]
fn available_venue_ids_for(
    catalogue: &Catalogue,
    route: &[String],
    mission_id: &str,
    stage: usize,
    actual_state: &str,
) -> Vec<String> {
    let Some(route_state) = route.get(stage) else {
        return vec![];
    };
    let on_trail = route_state == actual_state;
    if on_trail {
        return witness_clue_plan_for(catalogue, route, mission_id, stage, actual_state)
            .into_iter()
            .map(|atom| atom.venue_id.clone())
            .collect();
    }
    let atom_state = if on_trail {
        route.get(stage + 1).unwrap_or(route_state)
    } else {
        actual_state
    };
    let Some(atoms) = catalogue.atoms.get(atom_state) else {
        return vec![];
    };
    let start = (mission_id.bytes().map(usize::from).sum::<usize>() + stage * 7) % atoms.len();
    let mut ids = Vec::new();
    for offset in 0..atoms.len() {
        let venue = &atoms[(start + offset) % atoms.len()].venue_id;
        if catalogue
            .location_venues
            .contains_key(&(actual_state.to_owned(), venue.clone()))
            && !ids.contains(venue)
        {
            ids.push(venue.clone());
            if ids.len() == 3 {
                break;
            }
        }
    }
    ids
}

fn local_costs_for_state(catalogue: &Catalogue, state: &str) -> Vec<u32> {
    let mut venues = catalogue
        .location_venues
        .keys()
        .filter(|(candidate, _)| candidate == state)
        .map(|(_, venue)| venue.clone())
        .collect::<Vec<_>>();
    venues.sort();
    venues.dedup();
    venues
        .into_iter()
        .filter_map(|venue| {
            catalogue
                .location_venues
                .get(&(state.to_owned(), venue))
                .and_then(|placements| {
                    let pick = "budget".bytes().map(usize::from).sum::<usize>() % placements.len();
                    placements
                        .get(pick)
                        .map(|placement| placement.hub_travel_minutes.max(5))
                })
        })
        .filter_map(|minutes| {
            naijachase_core::local_quote(minutes, "drive")
                .ok()
                .map(|(_, cost)| cost)
        })
        .collect()
}

fn mission_budget_baseline(catalogue: &Catalogue, mission: &Mission) -> Result<u32, String> {
    let route = catalogue
        .route(mission)
        .map_err(|_| String::from("mission route unavailable"))?;
    let mut total = 0u32;
    for pair in route.windows(2) {
        let edge = catalogue
            .travel
            .get(&(pair[0].clone(), pair[1].clone()))
            .ok_or_else(|| String::from("mission travel edge unavailable"))?;
        total = total.saturating_add(
            naijachase_core::interstate_quote(edge.travel_minutes, "fly")
                .map_err(|e| e.to_string())?
                .1,
        )
    }
    for state in &route {
        // Budget against the three most expensive local drives in the state.
        // This is both faster and more conservative than coupling the money
        // calculation to a particular randomized clue plan.
        let mut costs = catalogue.derived.local_costs[state].clone();
        costs.sort_unstable_by(|left, right| right.cmp(left));
        total = total.saturating_add(costs.into_iter().take(3).sum::<u32>());
    }
    let mut final_costs = catalogue
        .derived
        .local_costs
        .get(
            route
                .last()
                .ok_or_else(|| String::from("mission route unavailable"))?,
        )
        .cloned()
        .unwrap_or_default();
    final_costs.sort_unstable();
    total = total.saturating_add(final_costs.last().copied().unwrap_or(0));
    Ok(total)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_1000_missions_match_uncached_plans_and_independent_loads() {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
        let catalogue = Catalogue::load(&root).unwrap();
        let reloaded = Catalogue::load(&root).unwrap();
        assert_eq!(catalogue.missions.len(), 1_000);
        let mut maxima = BTreeMap::<u8, u32>::new();
        for state in catalogue.hubs.keys() {
            assert_eq!(
                catalogue.derived.local_costs[state],
                local_costs_for_state(&catalogue, state)
            );
        }
        for mission in catalogue.missions.values() {
            let route = catalogue.route(mission).unwrap();
            assert_eq!(route, catalogue.compute_route(mission).unwrap());
            assert_eq!(route, reloaded.route(mission).unwrap());
            // Historical/custom routes retain the uncached planner's behaviour.
            let mut alternate_route = route.clone();
            alternate_route.swap(0, 1);
            let expected = witness_clue_plan_for(
                &catalogue,
                &alternate_route,
                &mission.mission_id,
                0,
                &alternate_route[0],
            );
            let actual = catalogue.clue_plan(
                &alternate_route,
                &mission.mission_id,
                0,
                &alternate_route[0],
            );
            assert_eq!(
                actual.iter().map(|atom| &atom.atom_id).collect::<Vec<_>>(),
                expected
                    .iter()
                    .map(|atom| &atom.atom_id)
                    .collect::<Vec<_>>()
            );
            let baseline = mission_budget_baseline(&catalogue, mission).unwrap();
            let maximum = maxima.entry(mission.difficulty).or_default();
            *maximum = (*maximum).max(baseline);
            for (stage, state) in route.iter().enumerate() {
                let ids = |plan: Vec<&ClueAtom>| {
                    plan.iter()
                        .map(|atom| atom.atom_id.clone())
                        .collect::<Vec<_>>()
                };
                let expected = ids(witness_clue_plan_for(
                    &catalogue,
                    &route,
                    &mission.mission_id,
                    stage,
                    state,
                ));
                assert_eq!(
                    ids(catalogue.clue_plan(&route, &mission.mission_id, stage, state)),
                    expected
                );
                assert_eq!(
                    ids(reloaded.clue_plan(&route, &mission.mission_id, stage, state)),
                    expected
                );
                for actual_state in catalogue.hubs.keys() {
                    let expected = available_venue_ids_for(
                        &catalogue,
                        &route,
                        &mission.mission_id,
                        stage,
                        actual_state,
                    );
                    assert_eq!(
                        catalogue.available_venues(
                            &route,
                            &mission.mission_id,
                            stage,
                            actual_state
                        ),
                        expected
                    );
                    assert_eq!(
                        reloaded.available_venues(&route, &mission.mission_id, stage, actual_state),
                        expected
                    );
                }
            }
            assert!(
                catalogue
                    .clue_plan(&route, &mission.mission_id, route.len(), &route[0])
                    .is_empty()
            );
            assert!(
                catalogue
                    .available_venues(&route, &mission.mission_id, route.len(), &route[0])
                    .is_empty()
            );
        }
        for mission in catalogue.missions.values() {
            let maximum = maxima[&mission.difficulty];
            let reserved = maximum.saturating_add(
                maximum
                    .saturating_mul(naijachase_core::case_budget_reserve_percent(
                        mission.difficulty,
                    ))
                    .div_ceil(100),
            );
            let expected = reserved.saturating_add(4_999) / 5_000 * 5_000;
            assert_eq!(catalogue.opening_budget(mission), Some(expected));
            assert_eq!(reloaded.opening_budget(mission), Some(expected));
        }
        let budgets = (1..=5)
            .map(|difficulty| {
                let mission = catalogue
                    .missions
                    .values()
                    .find(|m| m.difficulty == difficulty)
                    .unwrap();
                catalogue.opening_budget(mission).unwrap()
            })
            .collect::<Vec<_>>();
        assert!(
            budgets.windows(2).all(|pair| pair[0] > pair[1]),
            "easier catalogue tiers must receive more spare cash: {budgets:?}"
        );
        eprintln!("opening budgets, Easy through Hard: {budgets:?}");
    }
}
