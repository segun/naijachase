import csv,random,tempfile,unittest
from pathlib import Path
from game import Career,GameData,Session,rank_for
ROOT=Path(__file__).resolve().parent.parent
class GameTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.data=GameData.load(ROOT);cls.ready=next(m for m in cls.data.missions.values() if cls.data.engine_ready(m))
 def test_supporting_data(self):
  self.assertEqual(len(self.data.hubs),37);self.assertEqual(len(self.data.travel),1332);self.assertEqual(len(self.data.venues),35);self.assertEqual(len(self.data.profiles),100)
  signatures={(p['hair'],p['hobby'],p['vehicle'],p['accessory'],p['feature']) for p in self.data.profiles.values()};self.assertEqual(len(signatures),100)
 def test_curated_states_have_unique_three_clue_solution(self):
  self.assertEqual(len(self.data.clue_engine.by_state),37)
  for state in self.data.clue_engine.by_state:self.assertTrue(self.data.clue_engine.combinations(state),state)
 def test_national_p0_clue_depth(self):
  for state in self.data.hubs:self.assertGreaterEqual(len(self.data.clue_engine.by_state[state]),14,state)
  self.assertEqual(sum(map(len,self.data.clue_engine.by_state.values())),518)
 def test_national_p0_thematic_coverage(self):
  atoms=[x for values in self.data.clue_engine.by_state.values() for x in values];dimensions={x['dimension'] for x in atoms}
  themes={
   'history':{'history','colonial_history','political_history'},'kingdoms':{'empire','emirates','royalty','royal_tradition'},
   'independence':{'independence'},'civil-war history':{'civil_war'},'languages':{'language','languages'},
   'traditions':{'culture','society','royal_tradition'},'food':{'food'},'festivals':{'festival'},
   'literature':{'literature'},'music':{'music'},'architecture':{'architecture'},'geography':{'geography'},
   'ecology':{'ecology','wildlife','wetlands','birdlife'},'agriculture':{'agriculture'},'industry':{'industry','mining'},
   'institutions':{'institutions','education','government'},'monuments':{'heritage','fortification','earthworks'},'heritage':{'heritage','archaeology'} }
  for theme,aliases in themes.items():self.assertTrue(dimensions&aliases,theme)
 def test_all_clue_venues_are_available_in_their_state(self):
  for state,atoms in self.data.clue_engine.by_state.items():
   for atom in atoms:self.assertGreater(self.data.clue_engine.venue_weight(state,atom['venue_id']),0,(state,atom['venue_id']))
 def test_state_venue_profiles_are_context_aware(self):
  weight=self.data.clue_engine.venue_weight
  self.assertGreater(weight('Sokoto','mosque'),weight('Sokoto','church'))
  self.assertGreater(weight('Anambra','market'),weight('Anambra','seaport'))
  self.assertEqual(weight('Anambra','seaport'),0)
  self.assertGreater(weight('Rivers','refinery'),weight('Rivers','library'))
  self.assertGreater(weight('Benue','farm'),weight('Benue','nightclub'))
 def test_all_venue_profiles_are_reviewed_and_named_when_available(self):
  with (ROOT/'data/gameplay/state-venue-profiles.csv').open(encoding='utf-8-sig',newline='') as f:rows=list(csv.DictReader(f))
  self.assertEqual(len(rows),37*35)
  self.assertTrue(all(x['review_status']=='reviewed_2026-10-06' for x in rows))
  for row in rows:
   weight=int(row['suitability_weight'])
   self.assertIn(weight,range(6))
   self.assertEqual(row['available']=='yes',weight>0)
   self.assertEqual(bool(row['display_name']),weight>0)
  available={(x['state'],x['venue_id']) for x in rows if x['available']=='yes'}
  self.assertEqual({s for s,v in available if v=='seaport'},{'Akwa Ibom','Bayelsa','Cross River','Delta','Lagos','Rivers'})
  self.assertEqual({s for s,v in available if v=='sacred_grove'},{'Osun'})
  self.assertEqual({s for s,v in available if v=='nightclub'},{'Lagos','Rivers'})
 def test_all_venues_have_complete_experience_profiles(self):
  experiences=self.data.clue_engine.venue_experiences
  self.assertEqual(set(experiences),{x['venue_id'] for x in self.data.venues})
  required={'arrival_day','arrival_night','arrival_weekend','arrival_event_day','intro_1','intro_2','intro_3','wait_event','investigation_event','event_minutes'}
  for venue,row in experiences.items():
   self.assertTrue(all(row[key].strip() for key in required),(venue,row))
   self.assertGreater(int(row['event_minutes']),0)
 def test_all_500_locations_have_suitable_venue_links(self):
  with (ROOT/'data/gameplay/location-venue-map.csv').open(encoding='utf-8-sig',newline='') as f:links=list(csv.DictReader(f))
  by_location={}
  for row in links:by_location.setdefault(row['location_id'],[]).append(row)
  self.assertEqual(set(by_location),set(self.data.locations));self.assertTrue(all(len(rows)>=5 for rows in by_location.values()))
  approved={(state,venue) for (state,venue),weight in self.data.clue_engine.venue_weights.items() if weight>0}
  self.assertEqual({(x['state'],x['venue_id']) for x in links},approved)
  for row in links:
   self.assertGreaterEqual(int(row['hub_travel_minutes']),0);self.assertTrue(row['location_context']);self.assertTrue(row['witness_context'])
 def test_encounters_include_context_names_and_role_behaviour(self):
  profile=self.data.profiles['NG-T001'];seen=set()
  for elapsed in (0,12*60,5*1440,6*1440+14*60):
   for n in range(10):
    encounters=self.data.clue_engine.encounters('Lagos',f'CONTEXT-{elapsed}-{n}',0,profile,'3',elapsed=elapsed)
    seen.update(x['context_type'] for x in encounters)
    for encounter in encounters:
     for key in ('venue_name','arrival_description','witness_introduction','before_behaviour','after_behaviour','wait_event','investigation_event'):
      self.assertTrue(encounter[key].strip(),(key,encounter['venue_id']))
     self.assertEqual(int(encounter['event_minutes']),10)
  self.assertTrue({'arrival_day','arrival_night','arrival_weekend','arrival_event_day'}<=seen)
 def test_curated_witnesses_are_natural_and_nigerian(self):
  atoms=[x for values in self.data.clue_engine.by_state.values() for x in values]
  dialogue=" ".join(x['dialogue'].lower() for x in atoms)
  for phrase in ('route cipher','identify the destination','specialist detail'):self.assertNotIn(phrase,dialogue)
  parks=[x for x in atoms if x['venue_id']=='motor_park']
  self.assertTrue(parks);self.assertTrue(all('agbero' in x['witness_roles'].split('|') for x in parks))
  self.assertTrue(all('porter' not in x['witness_roles'].lower() for x in parks))
 def test_three_witnesses_narrow_to_one_state(self):
  state='Kano';profile=self.data.profiles['NG-T001']
  encounters=self.data.clue_engine.encounters(state,'TEST',0,profile,'3');possible=None
  for encounter in encounters:
   candidates=set(encounter['candidate_states'].split('|'));possible=candidates if possible is None else possible&candidates
   self.assertIn(encounter['profile_value'],encounter['dialogue'])
  self.assertEqual(possible,{state});self.assertEqual(len({x['venue_id'] for x in encounters}),3)
 def test_only_fully_curated_cases_are_offered(self):
  ready=[m['mission_id'] for m in self.data.missions.values() if self.data.engine_ready(m)]
  self.assertEqual(len(ready),1000);self.assertEqual(len({self.data.missions[x]['thief_id'] for x in ready}),100)
 def test_every_mission_has_complete_unique_story_material(self):
  missions=list(self.data.missions.values());self.assertEqual(len({m['title'] for m in missions}),1000)
  required=('case_theme','stolen_item','premise','opening_briefing','preferred_venues','calling_card','thief_behaviour','transition_1','transition_2','transition_3','false_lead_explanation','capture_scene','success_conclusion','failure_conclusion')
  self.assertTrue(all(all(m.get(key,'').strip() for key in required) for m in missions))
  cards={}
  for mission in missions:cards.setdefault(mission['thief_id'],set()).add(mission['calling_card'])
  self.assertEqual(len(cards),100);self.assertTrue(all(len(values)==1 for values in cards.values()));self.assertEqual(len({next(iter(x)) for x in cards.values()}),100)
 def test_false_destinations_share_evidence_before_full_intersection(self):
  s=Session.new(self.data,self.ready)
  for i,v in enumerate(s.venue_set()):s.interview(v,i)
  target=s.route[1];options=s.options(5,random.Random(1));false=[x for x in options if x!=target]
  self.assertTrue(false);self.assertTrue(all(any(x in clue for clue in s.candidate_sets['0']) for x in false[:2]))
 def test_same_state_leg_uses_local_transfer(self):
  mission=next(m for m in self.data.missions.values() if any(a==b for a,b in zip(self.data.route(m),self.data.route(m)[1:])))
  s=Session.new(self.data,mission);target=s.route[1]
  if target!=s.current_state:s.stage=next(i for i,(a,b) in enumerate(zip(s.route,s.route[1:])) if a==b);s.current_state=s.route[s.stage];target=s.route[s.stage+1]
  correct,row=s.travel_to(target);self.assertTrue(correct);self.assertEqual(row['travel_mode'],'local road transfer');self.assertEqual(int(row['travel_minutes']),90)
 def test_informal_witness_can_speak_pidgin(self):
  profile=self.data.profiles['NG-T001'];found=None
  for n in range(100):
   for encounter in self.data.clue_engine.encounters('Benue',f'PIDGIN-{n}',0,profile,'3'):
    if encounter['speech_register']=='Nigerian Pidgin':found=encounter;break
   if found:break
  self.assertIsNotNone(found);self.assertTrue(any(x in found['dialogue'] for x in (' dey ',' e ',' am.',' get ')))
 def test_each_atom_has_dialogue_variants_for_all_levels_and_registers(self):
  variants=self.data.clue_engine.dialogue_variants
  for state,atoms in self.data.clue_engine.by_state.items():
   for atom in atoms:
    for level in ('easy','medium','hard'):
     for register in ('English','Nigerian Pidgin'):
      self.assertEqual(len(variants[(atom['atom_id'],level,register)]),3,(state,atom['atom_id'],level,register))
 def test_recent_dialogue_variant_is_avoided(self):
  profile=self.data.profiles['NG-T001'];first=self.data.clue_engine.encounters('Sokoto','REPEAT',0,profile,'3')
  recent=[x['variant_id'] for x in first];second=self.data.clue_engine.encounters('Sokoto','REPEAT',0,profile,'3',recent_variants=recent)
  self.assertTrue(all(x['variant_id'] not in recent for x in second))
 def test_state_only_route(self):
  s=Session.new(self.data,self.ready);self.assertEqual(len(s.route),4);self.assertTrue(all(x in self.data.hubs for x in s.route))
 def test_distance_changes_travel_time(self):
  near=self.data.travel[('Lagos','Ogun')];far=self.data.travel[('Lagos','Kano')]
  self.assertLess(int(near['distance_km']),int(far['distance_km']));self.assertLess(int(near['travel_minutes']),int(far['travel_minutes']))
 def test_venue_hours_and_waiting(self):
  s=Session.new(self.data,self.ready);night=next(x for x in self.data.venues if x['venue_id']=='nightclub')
  self.assertFalse(s.is_open(night));wait=s.wait_to_open(night);self.assertEqual(wait,13*60);self.assertTrue(s.is_open(night))
 def test_profile_and_warrant_require_five_fields(self):
  s=Session.new(self.data,self.ready);self.assertIsNone(s.warrant_match())
  for stage,count in [(0,3),(1,2)]:
   s.stage=stage;s.current_state=s.route[stage]
   for i,v in enumerate(s.venue_set()[:count]):s.interview(v,i)
  self.assertTrue(s.profile_complete);self.assertEqual(s.warrant_match(),s.mission['thief_id'])
 def test_correct_travel_advances_time_and_stage(self):
  s=Session.new(self.data,self.ready);target=s.route[1];before=s.elapsed
  correct,row=s.travel_to(target);self.assertTrue(correct);self.assertEqual(s.stage,1);self.assertEqual(s.elapsed-before,int(row['travel_minutes']))
 def test_engine_playthrough_reaches_capture_with_warrant(self):
  s=Session.new(self.data,self.ready)
  for stage in range(4):
   s.stage=stage;s.current_state=s.route[stage]
   for i,v in enumerate(s.venue_set()):s.interview(v,i)
   if stage<3:s.travel_to(s.route[stage+1])
  self.assertTrue(s.at_capture);self.assertEqual(s.warrant_match(),s.mission['thief_id']);self.assertFalse(s.expired)
 def test_all_missions_complete_an_engine_dry_run(self):
  for mission in self.data.missions.values():
   route=self.data.route(mission);profile=self.data.profiles[mission['thief_id']]
   for stage,target in enumerate(route[1:]):
    encounters=self.data.clue_engine.encounters(target,mission['mission_id'],stage,profile,mission['difficulty'],elapsed=stage*600,investigation_state=route[stage])
    encounters=self.data.clue_engine.locate_encounters(encounters,route[stage],mission['mission_id'],stage)
    self.assertEqual(len(encounters),3)
    self.assertEqual(len({x['venue_id'] for x in encounters}),3)
    possible=set.intersection(*(set(x['candidate_states'].split('|')) for x in encounters))
    self.assertEqual(possible,{target},(mission['mission_id'],stage,target))
    self.assertTrue(all(int(x['venue_weight'])>0 for x in encounters))
    self.assertTrue(all(x['location_id'] in self.data.locations for x in encounters))
    self.assertTrue(all(self.data.clue_engine.locations_by_id[x['location_id']]['state']==route[stage] for x in encounters))
 def test_local_investigation_travel_consumes_time_and_stays_in_state(self):
  s=Session.new(self.data,self.ready);venues=s.venue_set();before=s.elapsed;origin=s.current_state
  self.assertTrue(all(v['location_id'] and v['location_context'] and v['witness_context'] for v in venues))
  result=s.interview(venues[0],0)
  self.assertEqual(s.current_state,origin);self.assertEqual(s.current_location_id,venues[0]['location_id'])
  self.assertEqual(s.elapsed-before,result['minutes']);self.assertGreaterEqual(result['local_minutes'],0)
 def test_capture_state_investigations_are_location_aware(self):
  s=Session.new(self.data,self.ready);s.stage=3;s.current_state=s.route[3];s.current_location_id=s.mission['capture_location_id']
  venues=s.venue_set();self.assertEqual(len(venues),3)
  self.assertTrue(all(v.get('location_id') and self.data.clue_engine.locations_by_id[v['location_id']]['state']==s.current_state for v in venues))
 def test_save_and_restore_session(self):
  s=Session.new(self.data,self.ready);s.elapsed=315;s.evidence['hair']='test'
  restored=Session.restore(self.data,s.save_dict());self.assertEqual(restored.elapsed,315);self.assertEqual(restored.evidence,{'hair':'test'})
  legacy=s.save_dict();legacy.pop('current_location_id');restored=Session.restore(self.data,legacy);self.assertEqual(restored.current_location_id,s.mission['start_location_id'])
 def test_ranks(self):
  self.assertEqual(rank_for(0),'Rookie');self.assertEqual(rank_for(5000),'Inspector');self.assertEqual(rank_for(25000),'Master Detective')
if __name__=='__main__':unittest.main()
