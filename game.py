#!/usr/bin/env python3
"""Carmen Sandiego: Nigeria — terminal investigation game."""
from __future__ import annotations
import argparse,csv,json,random,sys,textwrap
from dataclasses import dataclass,field
from pathlib import Path
from clue_engine import ClueEngine
ROOT=Path(__file__).resolve().parent;DATA=ROOT/"data";SAVE=ROOT/"save/player.json"
FIELDS=["hair","hobby","vehicle","accessory","feature"]
RANKS=[(0,"Rookie"),(1000,"Investigator"),(2500,"Senior Investigator"),(5000,"Inspector"),(8500,"Senior Inspector"),(13000,"Chief Inspector"),(20000,"Master Detective")]
def rows(path):
 with path.open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f))
def rank_for(points):return next(name for threshold,name in reversed(RANKS) if points>=threshold)
def state_of(location):
 state=location["state_or_territory"].split("/")[0];return "Federal Capital Territory" if state=="FCT" else state
@dataclass
class GameData:
 missions:dict;clues:dict;locations:dict;thieves:dict;profiles:dict;hubs:dict;travel:dict;venues:list;clue_engine:ClueEngine
 @classmethod
 def load(cls,root=ROOT):
  d=root/"data";p=d/"missions";g=d/"gameplay"
  missions={x["mission_id"]:x for x in rows(p/"missions.csv")};clues={x:[] for x in missions}
  for narrative in rows(g/"mission-narratives.csv"):missions[narrative["mission_id"]].update(narrative)
  for x in rows(p/"mission-clues.csv"):clues[x["mission_id"]].append(x)
  for x in clues.values():x.sort(key=lambda q:int(q["sequence"]))
  locations={x["location_id"]:x for x in rows(d/"locations/locations.csv")};thieves={x["thief_id"]:x for x in rows(d/"thieves/thieves.csv")}
  profiles={x["thief_id"]:x for x in rows(g/"thief-profiles.csv")};hubs={x["state"]:x for x in rows(g/"state-hubs.csv")}
  travel={(x["origin_state"],x["destination_state"]):x for x in rows(g/"state-travel.csv")};venues=rows(g/"venues.csv")
  if len(missions)!=1000 or len(hubs)!=37 or len(profiles)!=100:raise ValueError("Gameplay data incomplete; run scripts/build_gameplay_data.py")
  engine=ClueEngine(g/"state-clue-atoms.csv",g/"state-venue-profiles.csv",g/"venues.csv",g/"clue-dialogue-variants.csv",g/"venue-experiences.csv",g/"location-venue-map.csv")
  return cls(missions,clues,locations,thieves,profiles,hubs,travel,venues,engine)
 def route(self,m):return [state_of(self.locations[m[x]]) for x in ("start_location_id","stop_2_location_id","stop_3_location_id","capture_location_id")]
 def engine_ready(self,m):
  return all(self.clue_engine.supported(state) for state in self.route(m)[1:])
@dataclass
class Career:
 name:str;points:int=0;solved:list=field(default_factory=list);active:dict|None=None;recent_atoms:list=field(default_factory=list);recent_variants:list=field(default_factory=list)
 @property
 def rank(self):return rank_for(self.points)
 def dump(self,path=SAVE):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(self.__dict__,indent=2))
 @classmethod
 def load(cls,path=SAVE):return cls(**json.loads(path.read_text())) if path.exists() else None
@dataclass
class Session:
 data:GameData;mission:dict;elapsed:int=0;stage:int=0;current_state:str="";current_location_id:str="";evidence:dict=field(default_factory=dict);visited:list=field(default_factory=list);case_score:int=0;candidate_sets:dict=field(default_factory=dict);avoid_atoms:list=field(default_factory=list);avoid_variants:list=field(default_factory=list)
 @classmethod
 def new(cls,data,m,recent_atoms=None,recent_variants=None):return cls(data,m,current_state=data.route(m)[0],current_location_id=m["start_location_id"],case_score=int(m["reward_points"]),avoid_atoms=list(recent_atoms or []),avoid_variants=list(recent_variants or []))
 @classmethod
 def restore(cls,data,s):return cls(data=data,mission=data.missions[s["mission_id"]],elapsed=s["elapsed"],stage=s["stage"],current_state=s["current_state"],current_location_id=s.get("current_location_id",data.missions[s["mission_id"]][("start_location_id","stop_2_location_id","stop_3_location_id","capture_location_id")[s["stage"]]]),evidence=s["evidence"],visited=s["visited"],case_score=s["case_score"],candidate_sets=s.get("candidate_sets",{}),avoid_atoms=s.get("avoid_atoms",[]),avoid_variants=s.get("avoid_variants",[]))
 def save_dict(self):return {"mission_id":self.mission["mission_id"],"elapsed":self.elapsed,"stage":self.stage,"current_state":self.current_state,"current_location_id":self.current_location_id,"evidence":self.evidence,"visited":self.visited,"case_score":self.case_score,"candidate_sets":self.candidate_sets,"avoid_atoms":self.avoid_atoms,"avoid_variants":self.avoid_variants}
 @property
 def expired(self):return self.elapsed>=10080
 @property
 def route(self):return self.data.route(self.mission)
 @property
 def at_capture(self):return self.stage==3 and self.current_state==self.route[3]
 @property
 def profile_complete(self):return len(self.evidence)==5
 def clock(self):
  days=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday","Next Monday"];total=420+self.elapsed;day=total//1440;minute=total%1440
  return f"{days[min(day,7)]} {minute//60:02d}:{minute%60:02d}"
 def venue_set(self):
  target=self.route[min(self.stage+1,3)]
  if self.data.clue_engine.supported(target):
   encounters=self.data.clue_engine.encounters(target,self.mission["mission_id"],self.stage,self.data.profiles[self.mission["thief_id"]],self.mission["difficulty"],self.avoid_atoms,self.avoid_variants,self.elapsed,self.current_state,self.mission.get("preferred_venues","").split("|"))
   return self.data.clue_engine.locate_encounters(encounters,self.current_state,self.mission["mission_id"],self.stage)
  seed=sum(map(ord,self.mission["mission_id"]))+self.stage*97+sum(map(ord,self.current_state));return random.Random(seed).sample(self.data.venues,3)
 def is_open(self,v):
  h=((420+self.elapsed)%1440)//60;o=int(v["opens_hour"]);c=int(v["closes_hour"])
  if c==24:return h>=o
  return o<=h<c if o<c else h>=o or h<c
 def wait_to_open(self,v):
  now=(420+self.elapsed)%1440;wait=(int(v["opens_hour"])*60-now)%1440 or 1440;self.elapsed+=wait;return wait
 def travel_to_venue(self,v):
  if not v.get('location_id') or self.current_location_id==v['location_id']:return 0
  minutes=max(15,min(150,abs(int(v.get('hub_travel_minutes',0))-self.location_offset())+15));self.elapsed+=minutes;self.current_location_id=v['location_id'];return minutes
 def interview(self,v,index):
  key=f"{self.stage}|{self.current_state}|{v['venue_id']}"
  if key in self.visited:return {"repeat":True}
  local_minutes=self.travel_to_venue(v);v=self.data.clue_engine.contextualize(v,self.current_state,self.mission["mission_id"],self.stage,self.elapsed)
  investigation_minutes=20+int(v["interview_minutes"])+int(v.get("event_minutes",0));spent=local_minutes+investigation_minutes;self.elapsed+=investigation_minutes;self.visited.append(key);role=v.get("role") or random.Random(key+self.mission["mission_id"]).choice(v["witness_roles"].split("|"))
  on_trail=self.current_state==self.route[self.stage];field_name=v.get("profile_field",FIELDS[(self.stage*3+index)%5]);profile=self.data.profiles[self.mission["thief_id"]];new=None
  if on_trail and field_name not in self.evidence:self.evidence[field_name]=profile[field_name];new=(field_name,profile[field_name])
  if not on_trail:route="I have not seen anyone matching that description. This is a false trail."
  elif self.stage<3 and "dialogue" in v:
   route=v["dialogue"]
   self.candidate_sets.setdefault(str(self.stage),[]).append(v["candidate_states"].split("|"))
  elif self.stage<3:route=self.data.clues[self.mission["mission_id"]][self.stage]["clue_text"]
  else:route="The suspect is still in this state. Complete the profile and obtain a warrant."
  possibilities=None
  if str(self.stage) in self.candidate_sets:
   possibilities=sorted(set.intersection(*(set(x) for x in self.candidate_sets[str(self.stage)])))
  first_at_stage=sum(x.startswith(f"{self.stage}|{self.current_state}|") for x in self.visited)==1
  story_detail=f"A small detail at the scene stands out: {self.mission['calling_card']}. {self.mission['thief_behaviour']}" if self.stage==0 and first_at_stage else ""
  return {"repeat":False,"role":role,"route":route,"profile":new,"minutes":spent,"local_minutes":local_minutes,"possibilities":possibilities,"atom_id":v.get("atom_id",""),"variant_id":v.get("variant_id",""),"arrival":v.get("arrival_description",""),"introduction":v.get("witness_introduction",""),"before":v.get("before_behaviour",""),"after":v.get("after_behaviour",""),"event":v.get("investigation_event",""),"location_context":v.get("location_context",""),"witness_context":v.get("witness_context",""),"story_detail":story_detail}
 def location_offset(self):
  row=self.data.clue_engine.locations_by_id.get(self.current_location_id);return int(row['hub_travel_minutes']) if row else 0
 def options(self,count,rng):
  target=self.route[min(self.stage+1,3)];options=[target];false=[];sets=self.candidate_sets.get(str(self.stage),[])
  if sets:
   scores={state:sum(state in choices for choices in sets) for state in self.data.hubs}
   false=[state for state in sorted(scores,key=lambda x:(-scores[x],x)) if state not in (target,self.current_state) and scores[state]>0]
  for key in ("false_route_location_id_1","false_route_location_id_2"):
   st=state_of(self.data.locations[self.mission[key]])
   if st not in options+false and st!=self.current_state:false.append(st)
  rest=[x for x in self.data.hubs if x not in options+false and x!=self.current_state];rng.shuffle(rest);options+=(false+rest)[:count-1];rng.shuffle(options);return options
 def travel_to(self,state):
  row={"travel_minutes":"90","travel_mode":"local road transfer","distance_km":"within state"} if state==self.current_state else self.data.travel[(self.current_state,state)]
  self.elapsed+=int(row["travel_minutes"]);self.current_state=state;correct=self.stage<3 and state==self.route[self.stage+1]
  if correct:
   self.stage+=1;self.case_score+=50;self.current_location_id=self.mission[("start_location_id","stop_2_location_id","stop_3_location_id","capture_location_id")[self.stage]]
  else:self.case_score=max(0,self.case_score-75);self.current_location_id=""
  return correct,row
 def warrant_match(self):
  if not self.profile_complete:return None
  matches=[tid for tid,p in self.data.profiles.items() if all(p[k]==v for k,v in self.evidence.items())];return matches[0] if len(matches)==1 else None
class Game:
 def __init__(self,data,career,rng=None,input_fn=input,out=sys.stdout):self.data=data;self.career=career;self.rng=rng or random.Random();self.input=input_fn;self.out=out
 def say(self,text=""):print(textwrap.fill(str(text),78) if text else "",file=self.out)
 def choose(self,prompt,options,quit=True):
  while True:
   self.say();[self.say(f"  {i}. {x}") for i,x in enumerate(options,1)];ans=self.input(f"\n{prompt}{' (Q to save and quit)' if quit else ''}: ").strip().lower()
   if quit and ans in {"q","quit"}:return None
   if ans.isdigit() and 1<=int(ans)<=len(options):return int(ans)-1
   self.say("Enter one of the listed numbers.")
 def persist(self,s=None):self.career.active=s.save_dict() if s else None;self.career.dump()
 def status(self,s):
  self.say(f"\n{s.clock()} | {s.current_state} ({self.data.hubs[s.current_state]['hub_city']}) | Case score {s.case_score}");self.say(f"Deadline: next Monday 07:00 | Profile evidence: {len(s.evidence)}/5")
 def profile(self,s):
  self.say("\nSUSPECT PROFILE");[self.say(f"  {k.title():10} {s.evidence.get(k,'Unknown')}") for k in FIELDS];match=s.warrant_match()
  if match:self.say(f"Profile match: {self.data.thieves[match]['alias']} — {self.data.thieves[match]['name']}")
 def play(self,s):
  m=s.mission;self.say(f"\n=== {m['title']} ===");self.say(m["premise"]);self.say(m["opening_briefing"]);self.say(f"Investigator {self.career.name}, the case begins Monday 07:00. You have seven days.")
  while not s.expired:
   self.persist(s);self.status(s);venues=s.venue_set();menu=[]
   for v in venues:
    key=f"{s.stage}|{s.current_state}|{v['venue_id']}";status="questioned" if key in s.visited else ("open" if s.is_open(v) else "closed")
    menu.append(f"Visit {v['venue_name']} [{status}]")
   menu+=["Review suspect profile","Request warrant" if s.at_capture else "Travel to another state","Save and quit"]
   pick=self.choose("Choose an action",menu,False)
   if pick<3:
    v=venues[pick]
    local_minutes=s.travel_to_venue(v)
    if local_minutes:self.say(f"Local transfer to {v['location_name']}: {local_minutes//60}h {local_minutes%60}m.")
    if not s.is_open(v):
     wait=(int(v["opens_hour"])*60-(420+s.elapsed)%1440)%1440 or 1440;yes=self.choose(f"Closed. Wait {wait//60}h {wait%60}m",["Wait","Cancel"],False)
     if yes==1:continue
     s.wait_to_open(v)
     if v.get("wait_event"):self.say(f"While you wait: {v['wait_event']}")
    result=s.interview(v,pick)
    if result["repeat"]:self.say("You already questioned this witness.")
    else:
     if result["location_context"]:self.say(result["location_context"])
     if result["arrival"]:self.say(result["arrival"])
     if result["event"]:self.say(result["event"])
     if result["introduction"]:self.say(result["introduction"])
     if result["before"]:self.say(result["before"])
     if result["witness_context"]:self.say(result["witness_context"])
     self.say(f"At the {v['venue_name'].lower()}, the {result['role']} says: “{result['route']}”")
     if result["story_detail"]:self.say(result["story_detail"])
     if result["after"]:self.say(result["after"])
     if result["profile"]:self.say(f"Notebook updated: {result['profile'][0].title()}.")
     if result["possibilities"]:self.say(f"Possible destinations: {', '.join(result['possibilities'])}.")
     if result["atom_id"]:
      self.career.recent_atoms=(self.career.recent_atoms+[result["atom_id"]])[-60:]
     if result["variant_id"]:
      self.career.recent_variants=(self.career.recent_variants+[result["variant_id"]])[-120:]
   elif pick==3:self.profile(s)
   elif pick==4 and s.at_capture:
    match=s.warrant_match()
    if not match:self.say("The profile is incomplete. Five unique attributes are required.");continue
    suspect=self.data.thieves[match];yes=self.choose(f"Issue warrant for {suspect['alias']} — {suspect['name']}",["Issue warrant","Cancel"],False)
    if yes:continue
    s.elapsed+=30
    if match==m["thief_id"]:
     award=s.case_score+max(0,(10080-s.elapsed)//60)*5;old=self.career.rank;self.career.points+=award
     if m["mission_id"] not in self.career.solved:self.career.solved.append(m["mission_id"])
     self.persist();self.say(m["success_conclusion"]);self.say(f"CASE CLOSED. Award: {award}. Total: {self.career.points}. Rank: {self.career.rank}.")
     if old!=self.career.rank:self.say(f"PROMOTION: {old} → {self.career.rank}")
     return True
    self.say("Wrong warrant. The thief escaped.");self.say(m["failure_conclusion"]);self.persist();return False
   elif pick==4:
    count={"1":3,"3":4,"5":5}[m["difficulty"]];opts=s.options(count,self.rng);labels=[]
    for st in opts:
     row={"travel_minutes":"90","travel_mode":"local road transfer","distance_km":"within state"} if st==s.current_state else self.data.travel[(s.current_state,st)];mins=int(row["travel_minutes"]);labels.append(f"{st} — {self.data.hubs[st]['hub_city']} ({row['travel_mode']}, {row['distance_km']}{'' if row['distance_km']=='within state' else ' km'}, {mins//60}h {mins%60}m)")
    choice=self.choose("Choose destination",labels)
    if choice is None:self.persist(s);return False
    correct,_=s.travel_to(opts[choice])
    if correct:
     self.say(m[f"transition_{s.stage}"]);self.say(m["capture_scene"] if s.at_capture else "The trail is warm.")
    else:self.say(m["false_lead_explanation"])
   else:self.persist(s);self.say("Game saved.");return False
  self.say(m["failure_conclusion"]);self.say("The deadline passed. The thief escaped.");self.persist();return False
def mission_menu(game,difficulty=None):
 pool=[m for m in game.data.missions.values() if game.data.engine_ready(m)]
 if difficulty:pool=[m for m in pool if m["difficulty"]=={"easy":"1","medium":"3","hard":"5"}[difficulty]]
 game.rng.shuffle(pool);pool=pool[:5];pick=game.choose("Choose a case",[f"{m['mission_id']} — {m['title']}" for m in pool]);return None if pick is None else pool[pick]
def main(argv=None):
 p=argparse.ArgumentParser();p.add_argument("--reset",action="store_true");p.add_argument("--mission");p.add_argument("--difficulty",choices=["easy","medium","hard"]);p.add_argument("--seed",type=int);a=p.parse_args(argv);data=GameData.load()
 if a.reset and SAVE.exists():SAVE.unlink()
 career=Career.load()
 if not career:career=Career(input("Identify yourself, investigator: ").strip() or "Detective");career.dump()
 game=Game(data,career,random.Random(a.seed));game.say(f"Welcome, {career.name}. Rank: {career.rank}. Points: {career.points}.")
 if career.active:
  if career.active.get("mission_id") not in data.missions:
   game.say("Your saved pilot case belongs to the retired test set, so it has been archived.");career.active=None;career.dump()
  else:
   pick=game.choose("A saved case is available",["Resume case","Abandon it and start a new case"],False)
   if pick==0:return 0 if game.play(Session.restore(data,career.active)) else 1
   career.active=None;career.dump()
 mission=data.missions.get((a.mission or "").upper()) if a.mission else mission_menu(game,a.difficulty)
 if mission and not data.engine_ready(mission):
  game.say("That case is not yet available in the curated witness prototype.");return 2
 return 0 if not mission or game.play(Session.new(data,mission,career.recent_atoms,career.recent_variants)) else 1
if __name__=="__main__":raise SystemExit(main())
