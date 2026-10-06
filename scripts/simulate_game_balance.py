"""Run deterministic mission simulations and write the P2 balance report."""
import csv,random,statistics
from pathlib import Path
from sys import path
ROOT=Path(__file__).resolve().parent.parent;path.insert(0,str(ROOT))
from game import Career,GameData,GameEngine,Session,DIFFICULTY_RULES
OUT=ROOT/'data/gameplay/mission-balance-report.csv'
def main():
 data=GameData.load(ROOT);rows=[];engine=GameEngine(data,Career('Balance simulation'))
 for mission in data.missions.values():
  session=Session.new(data,mission);two_clue_probability=1.0;ambiguities=[];wait_minutes=0;local_minutes=0;false_quality=[];themed=0;preferred=set(mission['preferred_venues'].split('|'))
  for stage in range(4):
   session.stage=stage;session.current_state=session.route[stage];venues=session.venue_set();themed+=any(v['venue_id'] in preferred for v in venues)
   if stage<3:
    sets=[set(v['candidate_states'].split('|')) for v in venues];two_clue_probability*=1/max(1,len(sets[0]&sets[1]));ambiguities.append(statistics.mean(len(x) for x in sets))
   for index,venue in enumerate(venues):
    local=session.travel_to_venue(venue);local_minutes+=local
    if not session.is_open(venue):wait=session.wait_to_open(venue);wait_minutes+=wait
    session.interview(venue,index)
   if stage<3:
    target=session.route[stage+1];options=session.options(DIFFICULTY_RULES[mission['difficulty']]['options'],random.Random(mission['mission_id']+str(stage)))
    false=[x for x in options if x!=target];false_quality.append(sum(any(x in clue for clue in session.candidate_sets[str(stage)]) for x in false)/len(false))
    session.travel_to(target)
  for trait,value in session.observed_traits.items():engine.record_trait(session,trait,value)
  remaining=10080-session.elapsed;difficulty=int(mission['difficulty']);estimated_award=session.case_score+max(0,remaining//60)*(2+difficulty)
  rows.append({'mission_id':mission['mission_id'],'difficulty':difficulty,'difficulty_label':DIFFICULTY_RULES[mission['difficulty']]['label'],'average_clue_candidates':f"{statistics.mean(ambiguities):.2f}",'two_clue_route_solve_probability':f"{two_clue_probability:.4f}",'three_clue_route_solve_probability':'1.0000','travel_options':DIFFICULTY_RULES[mission['difficulty']]['options'],'evidence_sharing_false_lead_rate':f"{statistics.mean(false_quality):.4f}",'themed_venue_stages':themed,'dossier_fields_collected':len(session.evidence),'dossier_complete':'yes' if session.profile_complete else 'no','warrant_match':'yes' if session.warrant_match()==mission['thief_id'] else 'no','local_travel_minutes':local_minutes,'waiting_minutes':wait_minutes,'total_case_minutes':session.elapsed,'remaining_minutes':remaining,'deadline_pass':'yes' if remaining>0 else 'no','minimum_target_buffer_pass':'yes' if remaining>=2880 else 'no','estimated_case_award':estimated_award,'witness_truth_policy':'all clues truthful; indirect accounts corroborated'})
 with OUT.open('w',encoding='utf-8',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]),lineterminator='\n');w.writeheader();w.writerows(rows)
 print(f"Simulated {len(rows)} missions; deadline passes {sum(x['deadline_pass']=='yes' for x in rows)}; minimum buffer passes {sum(x['minimum_target_buffer_pass']=='yes' for x in rows)}")
 for difficulty in range(1,6):
  group=[x for x in rows if x['difficulty']==difficulty];print(difficulty,DIFFICULTY_RULES[str(difficulty)]['label'],f"ambiguity {statistics.mean(float(x['average_clue_candidates']) for x in group):.2f}",f"two-clue solve {statistics.mean(float(x['two_clue_route_solve_probability']) for x in group):.1%}",f"remaining {statistics.mean(int(x['remaining_minutes']) for x in group):.0f} min")
if __name__=='__main__':main()
