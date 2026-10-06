#!/usr/bin/env python3
"""Carmen Sandiego: Nigeria — terminal investigation game."""
from __future__ import annotations
import argparse,csv,json,math,random,sys,textwrap
from dataclasses import dataclass,field,fields
from pathlib import Path
from clue_engine import ClueEngine,DIFFICULTY_RULES
ROOT=Path(__file__).resolve().parent;DATA=ROOT/"data";SAVE=ROOT/"save/player.json"
SAVE_VERSION=2
FIELDS=["sex","height","skin_tone","hair","hobby","vehicle","accessory","feature"]
RANKS=[(0,"Rookie"),(1500,"Investigator"),(4000,"Senior Investigator"),(8000,"Inspector"),(14000,"Senior Inspector"),(22000,"Chief Inspector"),(35000,"Master Detective")]
CASE_BASE={"1":500,"2":650,"3":800,"4":1000,"5":1250}
DIFFICULTY_NAMES={"1":"Easy","2":"Standard","3":"Medium","4":"Challenging","5":"Hard"}
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
 def dump(self,path=SAVE):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps({"save_version":SAVE_VERSION,**self.__dict__},indent=2))
 @classmethod
 def load(cls,path=SAVE):
  if not path.exists():return None
  payload=json.loads(path.read_text());payload.pop("save_version",None)
  allowed={x.name for x in fields(cls)}
  return cls(**{k:v for k,v in payload.items() if k in allowed})
@dataclass
class Session:
 data:GameData;mission:dict;elapsed:int=0;stage:int=0;current_state:str="";current_location_id:str="";evidence:dict=field(default_factory=dict);observed_traits:dict=field(default_factory=dict);visited:list=field(default_factory=list);case_score:int=0;candidate_sets:dict=field(default_factory=dict);avoid_atoms:list=field(default_factory=list);avoid_variants:list=field(default_factory=list);travel_history:list=field(default_factory=list);seed:int=0;replay_log:list=field(default_factory=list)
 @classmethod
 def new(cls,data,m,recent_atoms=None,recent_variants=None,seed=0):
  start=data.route(m)[0];return cls(data,m,current_state=start,current_location_id=m["start_location_id"],case_score=CASE_BASE[m["difficulty"]],avoid_atoms=list(recent_atoms or []),avoid_variants=list(recent_variants or []),travel_history=[start],seed=seed,replay_log=[{"command":"start_case","mission_id":m["mission_id"],"seed":seed}])
 @classmethod
 def restore(cls,data,s):return cls(data=data,mission=data.missions[s["mission_id"]],elapsed=s["elapsed"],stage=s["stage"],current_state=s["current_state"],current_location_id=s.get("current_location_id",data.missions[s["mission_id"]][("start_location_id","stop_2_location_id","stop_3_location_id","capture_location_id")[s["stage"]]]),evidence=s["evidence"],observed_traits=s.get("observed_traits",{}),visited=s["visited"],case_score=s["case_score"],candidate_sets=s.get("candidate_sets",{}),avoid_atoms=s.get("avoid_atoms",[]),avoid_variants=s.get("avoid_variants",[]),travel_history=s.get("travel_history",[s["current_state"]]),seed=s.get("seed",0),replay_log=s.get("replay_log",[]))
 def save_dict(self):return {"state_version":SAVE_VERSION,"mission_id":self.mission["mission_id"],"elapsed":self.elapsed,"stage":self.stage,"current_state":self.current_state,"current_location_id":self.current_location_id,"evidence":self.evidence,"observed_traits":self.observed_traits,"visited":self.visited,"case_score":self.case_score,"candidate_sets":self.candidate_sets,"avoid_atoms":self.avoid_atoms,"avoid_variants":self.avoid_variants,"travel_history":self.travel_history,"seed":self.seed,"replay_log":self.replay_log}
 @property
 def expired(self):return self.elapsed>=10080
 @property
 def route(self):return self.data.route(self.mission)
 @property
 def at_capture(self):return self.stage==3 and self.current_state==self.route[3]
 @property
 def profile_complete(self):return all(field in self.evidence for field in FIELDS)
 def possible_destinations(self):
  sets=self.candidate_sets.get(str(self.stage),[])
  return sorted(set.intersection(*(set(x) for x in sets))) if sets else []
 def eliminated_destinations(self):
  possible=self.possible_destinations();return sorted(set(self.data.hubs)-set(possible)-{self.current_state}) if possible else []
 def suspect_matches(self):return [tid for tid,p in self.data.profiles.items() if all(p.get(k)==v for k,v in self.evidence.items())]
 def route_summary(self):return self.route[:self.stage+1]+["?"]*(3-self.stage)
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
  origin=self.data.clue_engine.locations_by_id.get(self.current_location_id);destination=self.data.clue_engine.locations_by_id.get(v['location_id'])
  if origin and destination:
   lat1,lon1,lat2,lon2=map(math.radians,(float(origin['latitude']),float(origin['longitude']),float(destination['latitude']),float(destination['longitude'])));a=math.sin((lat2-lat1)/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2;km=6371*2*math.asin(math.sqrt(a))*1.25;minutes=0 if km<2 else min(240,max(15,round(km/45*60+15)))
  else:minutes=max(15,min(240,abs(int(v.get('hub_travel_minutes',0))-self.location_offset())+15))
  self.elapsed+=minutes;self.current_location_id=v['location_id'];return minutes
 def interview(self,v,index):
  key=f"{self.stage}|{self.current_state}|{v['venue_id']}"
  if key in self.visited:return {"repeat":True}
  local_minutes=self.travel_to_venue(v);v=self.data.clue_engine.contextualize(v,self.current_state,self.mission["mission_id"],self.stage,self.elapsed)
  investigation_minutes=20+int(v["interview_minutes"])+int(v.get("event_minutes",0));spent=local_minutes+investigation_minutes;self.elapsed+=investigation_minutes;self.visited.append(key);role=v.get("role") or random.Random(key+self.mission["mission_id"]).choice(v["witness_roles"].split("|"))
  on_trail=self.current_state==self.route[self.stage];field_name=v.get("profile_field",FIELDS[(self.stage*3+index)%len(FIELDS)]);profile=self.data.profiles[self.mission["thief_id"]];new=None
  if on_trail and field_name not in self.observed_traits:self.observed_traits[field_name]=profile[field_name];new=(field_name,profile[field_name])
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
  return {"repeat":False,"role":role,"route":route,"profile":new,"minutes":spent,"local_minutes":local_minutes,"possibilities":possibilities,"atom_id":v.get("atom_id",""),"variant_id":v.get("variant_id",""),"arrival":v.get("arrival_description",""),"introduction":v.get("witness_introduction",""),"before":v.get("before_behaviour",""),"after":v.get("after_behaviour",""),"event":v.get("investigation_event",""),"location_context":v.get("location_context",""),"witness_context":v.get("witness_context",""),"story_detail":story_detail,"reliability":v.get("reliability","verified account")}
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
  self.elapsed+=int(row["travel_minutes"]);self.current_state=state;self.travel_history.append(state);correct=self.stage<3 and state==self.route[self.stage+1]
  difficulty=int(self.mission['difficulty'])
  if correct:
   self.stage+=1;self.case_score+=50+10*difficulty;self.current_location_id=self.mission[("start_location_id","stop_2_location_id","stop_3_location_id","capture_location_id")[self.stage]]
  else:self.case_score=max(0,self.case_score-(75+25*difficulty));self.current_location_id=""
  return correct,row
 def warrant_match(self):
  if not self.profile_complete:return None
  matches=self.suspect_matches();return matches[0] if len(matches)==1 else None
@dataclass(frozen=True)
class EngineEvent:
 type:str;data:dict=field(default_factory=dict)
 def as_dict(self):return {"type":self.type,"data":self.data}
@dataclass
class CommandResult:
 ok:bool;events:list=field(default_factory=list);data:dict=field(default_factory=dict)
 def event(self,event_type):return next((x for x in self.events if x.type==event_type),None)
class GameEngine:
 """UI-independent command boundary for all gameplay state changes."""
 def __init__(self,data,career,rng=None,seed=0):self.data=data;self.career=career;self.seed=seed;self.rng=rng or random.Random(seed)
 def start_case(self,mission):
  session=Session.new(self.data,mission,self.career.recent_atoms,self.career.recent_variants,self.seed)
  return CommandResult(True,[EngineEvent("case_started",{"mission_id":mission["mission_id"],"state":session.current_state,"seed":self.seed})],{"session":session})
 def venues(self,s):return s.venue_set()
 def venue_status(self,s,v):
  key=f"{s.stage}|{s.current_state}|{v['venue_id']}"
  return "questioned" if key in s.visited else ("open" if s.is_open(v) else "closed")
 def visit_venue(self,s,v,index,wait=False):
  events=[];key=f"{s.stage}|{s.current_state}|{v['venue_id']}"
  if key in s.visited:return CommandResult(False,[EngineEvent("already_questioned",{"venue_id":v["venue_id"]})])
  local=s.travel_to_venue(v)
  if local:events.append(EngineEvent("local_transfer",{"location":v.get("location_name",""),"minutes":local}))
  if not s.is_open(v):
   wait_minutes=(int(v["opens_hour"])*60-(420+s.elapsed)%1440)%1440 or 1440
   if not wait:return CommandResult(False,events+[EngineEvent("venue_closed",{"wait_minutes":wait_minutes,"venue_id":v["venue_id"]})])
   s.wait_to_open(v);events.append(EngineEvent("waited",{"minutes":wait_minutes,"description":v.get("wait_event","")}))
  result=s.interview(v,index);s.replay_log.append({"command":"visit_venue","stage":s.stage,"state":s.current_state,"venue_id":v["venue_id"],"wait":wait})
  events.append(EngineEvent("witness_interviewed",result))
  if result.get("atom_id"):self.career.recent_atoms=(self.career.recent_atoms+[result["atom_id"]])[-60:]
  if result.get("variant_id"):self.career.recent_variants=(self.career.recent_variants+[result["variant_id"]])[-120:]
  return CommandResult(True,events,{"interview":result})
 def travel_options(self,s):
  count=DIFFICULTY_RULES[s.mission["difficulty"]]["options"];states=s.options(count,self.rng);options=[]
  for state in states:
   row={"travel_minutes":"90","travel_mode":"local road transfer","distance_km":"within state"} if state==s.current_state else self.data.travel[(s.current_state,state)]
   options.append({"state":state,"hub_city":self.data.hubs[state]["hub_city"],**row})
  return options
 def travel(self,s,state):
  correct,row=s.travel_to(state);s.replay_log.append({"command":"travel","state":state})
  kind="arrived_on_trail" if correct else "false_destination"
  return CommandResult(correct,[EngineEvent(kind,{"state":state,"stage":s.stage,"travel":row,"at_capture":s.at_capture})],{"correct":correct,"travel":row})
 def trait_values(self,trait):return sorted({p[trait] for p in self.data.profiles.values()}) if trait in FIELDS else []
 def record_trait(self,s,trait,value):
  if trait not in FIELDS:return CommandResult(False,[EngineEvent("invalid_trait",{"trait":trait})])
  if value not in self.trait_values(trait):return CommandResult(False,[EngineEvent("invalid_trait_value",{"trait":trait,"value":value})])
  minutes=3+int(s.mission["difficulty"]);s.elapsed+=minutes;s.evidence[trait]=value;s.replay_log.append({"command":"record_trait","trait":trait,"value":value})
  conflict=trait in s.observed_traits and s.observed_traits[trait]!=value
  if conflict:s.case_score=max(0,s.case_score-10*int(s.mission["difficulty"]))
  events=[EngineEvent("trait_recorded",{"trait":trait,"value":value,"minutes":minutes})]
  if conflict:events.append(EngineEvent("dossier_conflict",{"trait":trait}))
  return CommandResult(True,events,{"conflict":conflict})
 def suspect_candidates(self,s):
  culprit=s.mission["thief_id"]
  def score(item):
   tid,profile=item;matches=sum(profile.get(k)==v for k,v in s.evidence.items())
   return (-matches,tid)
  others=[tid for tid,_ in sorted(((tid,p) for tid,p in self.data.profiles.items() if tid!=culprit),key=score)[:2]]
  candidates=[culprit]+others;random.Random(f"{s.mission['mission_id']}|{sorted(s.evidence.items())}").shuffle(candidates);return candidates
 def request_warrant(self,s,suspect_id=None):
  s.replay_log.append({"command":"request_warrant","suspect_id":suspect_id})
  if not s.at_capture:return CommandResult(False,[EngineEvent("warrant_wrong_jurisdiction",{})])
  if not s.profile_complete:return CommandResult(False,[EngineEvent("warrant_incomplete",{"missing":len(FIELDS)-len(s.evidence)})])
  candidates=self.suspect_candidates(s)
  if suspect_id is None:return CommandResult(False,[EngineEvent("suspect_selection_required",{"candidate_ids":candidates})],{"candidate_ids":candidates})
  if suspect_id not in candidates:return CommandResult(False,[EngineEvent("invalid_warrant_suspect",{"suspect_id":suspect_id})])
  return CommandResult(True,[EngineEvent("warrant_ready",{"suspect_id":suspect_id})],{"suspect_id":suspect_id})
 def arrest(self,s,suspect_id):
  s.elapsed+=30;s.replay_log.append({"command":"arrest","suspect_id":suspect_id})
  if suspect_id!=s.mission["thief_id"]:return CommandResult(False,[EngineEvent("suspect_escaped",{"suspect_id":suspect_id})])
  award=s.case_score+max(0,(10080-s.elapsed)//60)*(2+int(s.mission['difficulty']));old=self.career.rank;self.career.points+=award
  if s.mission["mission_id"] not in self.career.solved:self.career.solved.append(s.mission["mission_id"])
  return CommandResult(True,[EngineEvent("arrested",{"suspect_id":suspect_id,"award":award,"old_rank":old,"new_rank":self.career.rank})],{"award":award,"old_rank":old,"new_rank":self.career.rank})
class Game:
 def __init__(self,data,career,rng=None,input_fn=input,out=sys.stdout,width=78,plain=False,wrap=True,seed=0):self.data=data;self.career=career;self.rng=rng or random.Random(seed);self.engine=GameEngine(data,career,self.rng,seed);self.input=input_fn;self.out=out;self.width=max(50,min(120,width));self.plain=plain;self.wrap=wrap
 def say(self,text=""):
  value=str(text)
  if self.plain:
   for old,new in (("—","-"),("–","-"),("→","->"),("“",'"'),("”",'"'),("’","'"),("•","*")):value=value.replace(old,new)
  print(textwrap.fill(value,self.width,replace_whitespace=False) if value and self.wrap else value,file=self.out)
 def choose(self,prompt,options,quit=True):
  while True:
   self.say();[self.say(f"  {i}. {x}") for i,x in enumerate(options,1)];ans=self.input(f"\n{prompt}{' (Q to save and quit)' if quit else ''}: ").strip().lower()
   if quit and ans in {"q","quit"}:return None
   if ans.isdigit() and 1<=int(ans)<=len(options):return int(ans)-1
   self.say("Enter one of the listed numbers.")
 def persist(self,s=None):self.career.active=s.save_dict() if s else None;self.career.dump()
 def status(self,s):
  self.say(f"\n{s.clock()} | {s.current_state} ({self.data.hubs[s.current_state]['hub_city']}) | Case score {s.case_score}");self.say(f"Deadline: next Monday 07:00 | Dossier entries: {len(s.evidence)}/{len(FIELDS)}")
 def case_dossier(self,s):
  m=s.mission;start=self.data.locations[m['start_location_id']]
  self.say("\n=== CASE DOSSIER ===");self.say(f"Case: {m['mission_id']} — {m['title']}");self.say(f"Investigator: {self.career.name} | Rank: {self.career.rank}");self.say(f"Theme: {m['case_theme']} | Difficulty: {DIFFICULTY_NAMES[m['difficulty']]}");self.say(f"Stolen item: {m['stolen_item']}");self.say(f"Opening location: {start['name']}, {s.current_state}");self.say("Deadline: Next Monday at 07:00");self.say("Objective: follow the state-to-state trail, interpret witness descriptions, enter all eight suspect traits yourself, and select the correct warrant target at the capture state.");self.say(m['premise']);self.say(m['opening_briefing'])
 def notebook(self,s):
  possible=s.possible_destinations();eliminated=s.eliminated_destinations();matches=s.suspect_matches()
  self.say("\n=== DETECTIVE NOTEBOOK ===");self.say(f"Case: {s.mission['mission_id']} | Time: {s.clock()} | Score: {s.case_score}")
  self.say("TRAVEL MAP");self.say("  "+" -> ".join(s.route_summary()));self.say("  Journey so far: "+" -> ".join(s.travel_history))
  self.say("DESTINATION ANALYSIS")
  if possible:
   self.say(f"  Still possible ({len(possible)}): {', '.join(possible)}");self.say(f"  Eliminated ({len(eliminated)}): {', '.join(eliminated)}")
  else:self.say("  No route evidence collected at this stop yet.")
  self.say("SUSPECT DOSSIER");[self.say(f"  {k.replace('_',' ').title():18} {s.evidence.get(k,'Unknown')}") for k in FIELDS]
  self.say(f"  Matching suspects: {len(matches)}")
  if len(matches)<=5:
   for tid in matches:self.say(f"    {self.data.thieves[tid]['alias']} — {self.data.thieves[tid]['name']}")
  self.say("  Warrant status: "+("READY FOR SUSPECT COMPARISON" if s.profile_complete else f"LOCKED — {len(FIELDS)-len(s.evidence)} entries still required"))
 def edit_dossier(self,s):
  labels=[f"{key.replace('_',' ').title()}: {s.evidence.get(key,'Unknown')}" for key in FIELDS]+["Return to investigation"]
  pick=self.choose("Choose a dossier field",labels,False)
  if pick==len(FIELDS):return
  trait=FIELDS[pick];values=self.engine.trait_values(trait);choice=self.choose(f"Record {trait.replace('_',' ')}",values+["Cancel"],False)
  if choice==len(values):return
  result=self.engine.record_trait(s,trait,values[choice]);minutes=result.event("trait_recorded").data["minutes"];self.say(f"Dossier updated: {trait.replace('_',' ').title()} — {values[choice]}. Paperwork time: {minutes} minutes.")
  if result.event("dossier_conflict"):self.say("Warning: this entry appears to conflict with a witness account in your case notes. Review the wording before requesting a warrant.")
 def warrant_paperwork(self,s,match):
  suspect=self.data.thieves[match]
  self.say("\n=== WARRANT APPLICATION ===");self.say(f"Case number: {s.mission['mission_id']}");self.say(f"Applicant: Investigator {self.career.name}");self.say(f"Jurisdiction: {s.current_state}");self.say(f"Named suspect: {suspect['alias']} — {suspect['name']}")
  for key in FIELDS:self.say(f"  {key.replace('_',' ').title()}: {s.evidence[key]}")
  self.say("Identity comparison: PLAYER-SELECTED CANDIDATE");self.say("Application status: READY FOR SIGNATURE")
 def help(self):
  self.say("\n=== HELP AND RULES ===");self.say("Solve the case before next Monday at 07:00. Question witnesses at three local venues; each visit and journey costs time. Combine their accounts in the notebook to narrow the next state. Travel is between states or the FCT, while venue visits happen locally. Witnesses describe suspect traits in conversation; use Update suspect dossier to enter your own interpretation. You may revise any entry. At the final state, complete all eight fields, compare three plausible suspects, select one warrant target, and make the arrest. Closed venues may require a wait. Wrong journeys and wrong warrants have consequences. The game saves automatically; choose Save and quit for a clean exit.");self.say("Display options: --plain uses ASCII punctuation, --width N changes line width (50–120), and --no-wrap preserves each printed line.")
 def play(self,s):
  m=s.mission;self.case_dossier(s);self.say(f"\n=== ARRIVAL: {s.current_state.upper()} ===");self.say(f"You report to {self.data.hubs[s.current_state]['hub_city']} and open the investigation.")
  while not s.expired:
   self.persist(s);self.status(s);venues=self.engine.venues(s);menu=[]
   for v in venues:
    status=self.engine.venue_status(s,v)
    menu.append(f"Visit {v['venue_name']} [{status}]")
   menu+=["Open detective notebook","Update suspect dossier","Request warrant" if s.at_capture else "Travel to another state","Help and rules","Save and quit"]
   pick=self.choose("Choose an action",menu,False)
   if pick<3:
    v=venues[pick]
    command=self.engine.visit_venue(s,v,pick)
    transfer=command.event("local_transfer")
    if transfer:
     minutes=transfer.data["minutes"];self.say(f"Local transfer to {transfer.data['location']}: {minutes//60}h {minutes%60}m.")
    closed=command.event("venue_closed")
    if closed:
     wait=closed.data["wait_minutes"];yes=self.choose(f"Closed. Wait {wait//60}h {wait%60}m",["Wait","Cancel"],False)
     if yes==1:continue
     command=self.engine.visit_venue(s,v,pick,wait=True);waited=command.event("waited")
     if waited and waited.data["description"]:self.say(f"While you wait: {waited.data['description']}")
    interviewed=command.event("witness_interviewed");result=interviewed.data if interviewed else None
    if command.event("already_questioned"):self.say("You already questioned this witness.")
    else:
     if result["location_context"]:self.say(result["location_context"])
     if result["arrival"]:self.say(result["arrival"])
     if result["event"]:self.say(result["event"])
     if result["introduction"]:self.say(result["introduction"])
     if result["before"]:self.say(result["before"])
     if result["witness_context"]:self.say(result["witness_context"])
     self.say(f"At the {v['venue_name'].lower()}, the {result['role']} says: “{result['route']}”")
     self.say(f"Notebook reliability: {result['reliability']}.")
     if result["story_detail"]:self.say(result["story_detail"])
     if result["after"]:self.say(result["after"])
     if result["profile"]:self.say(f"Case notes updated with a witness detail about {result['profile'][0].replace('_',' ')}. Enter your interpretation in the suspect dossier.")
     if result["possibilities"]:self.say(f"Possible destinations: {', '.join(result['possibilities'])}.")
   elif pick==3:self.notebook(s)
   elif pick==4:self.edit_dossier(s)
   elif pick==5 and s.at_capture:
    warrant=self.engine.request_warrant(s)
    if warrant.event("warrant_incomplete"):self.say("The dossier is incomplete. Eight identifying attributes are required.");continue
    candidates=warrant.data["candidate_ids"];labels=[]
    for tid in candidates:
     thief=self.data.thieves[tid];profile=self.data.profiles[tid];traits=", ".join(f"{key.replace('_',' ')}: {profile[key]}" for key in FIELDS)
     labels.append(f"{thief['alias']} — {thief['name']} | {traits}")
    selected=self.choose("Compare the dossier and select the warrant target",labels+["Cancel"],False)
    if selected==len(candidates):continue
    match=candidates[selected];warrant=self.engine.request_warrant(s,match)
    suspect=self.data.thieves[match];self.warrant_paperwork(s,match);yes=self.choose(f"Issue warrant for {suspect['alias']} — {suspect['name']}",["Sign and issue warrant","Cancel"],False)
    if yes:continue
    arrest=self.engine.arrest(s,match)
    if arrest.ok:
     award=arrest.data["award"];old=arrest.data["old_rank"]
     self.persist();self.say("\n=== ARREST ===");self.say(m["capture_scene"]);self.say(f"The warrant is confirmed. {suspect['alias']} is taken into custody.");self.say(m["success_conclusion"]);self.say(f"CASE CLOSED. Award: {award}. Total: {self.career.points}. Rank: {self.career.rank}.")
     if old!=self.career.rank:self.say(f"\n=== PROMOTION NOTICE ===\nCongratulations, Investigator {self.career.name}. Headquarters promotes you from {old} to {self.career.rank}.")
     return True
    self.say("\n=== ESCAPE ===");self.say("The warrant names the wrong suspect. While officers correct the paperwork, the thief slips away.");self.say(m["failure_conclusion"]);self.persist();return False
   elif pick==5:
    options=self.engine.travel_options(s);labels=[]
    for row in options:
     mins=int(row["travel_minutes"]);labels.append(f"{row['state']} — {row['hub_city']} ({row['travel_mode']}, {row['distance_km']}{'' if row['distance_km']=='within state' else ' km'}, {mins//60}h {mins%60}m)")
    choice=self.choose("Choose destination",labels)
    if choice is None:self.persist(s);return False
    travel=self.engine.travel(s,options[choice]["state"])
    if travel.ok:
     self.say(m[f"transition_{s.stage}"]);self.say(f"\n=== ARRIVAL: {s.current_state.upper()} ===");self.say(f"You arrive through {self.data.hubs[s.current_state]['hub_city']}. "+("The suspect is close; finish the dossier and secure a warrant." if s.at_capture else "The trail is warm. Find three local witnesses."))
    else:self.say(m["false_lead_explanation"])
   elif pick==6:self.help()
   else:self.persist(s);self.say("Game saved.");return False
  self.say("\n=== DEADLINE EXPIRED ===");self.say("Next Monday, 07:00. Headquarters closes the active pursuit as the seven-day window ends.");self.say(m["failure_conclusion"]);self.say("The thief escaped.");self.persist();return False
def mission_menu(game,difficulty=None):
 pool=[m for m in game.data.missions.values() if game.data.engine_ready(m)]
 if difficulty:pool=[m for m in pool if m["difficulty"]=={"easy":"1","medium":"3","hard":"5"}[difficulty]]
 game.rng.shuffle(pool);pool=pool[:5];pick=game.choose("Choose a case",[f"{m['mission_id']} — {m['title']}" for m in pool]);return None if pick is None else pool[pick]
def main(argv=None):
 p=argparse.ArgumentParser();p.add_argument("--reset",action="store_true");p.add_argument("--mission");p.add_argument("--difficulty",choices=["easy","medium","hard"]);p.add_argument("--seed",type=int);p.add_argument("--plain",action="store_true",help="use ASCII punctuation");p.add_argument("--width",type=int,default=78,metavar="N",help="terminal text width, 50 to 120");p.add_argument("--no-wrap",action="store_true",help="do not wrap printed lines");a=p.parse_args(argv);data=GameData.load()
 if not 50<=a.width<=120:p.error("--width must be between 50 and 120")
 if a.reset and SAVE.exists():SAVE.unlink()
 career=Career.load()
 if not career:career=Career(input("Identify yourself, investigator: ").strip() or "Detective");career.dump()
 seed=a.seed if a.seed is not None else random.SystemRandom().randrange(2**32);game=Game(data,career,random.Random(seed),width=a.width,plain=a.plain,wrap=not a.no_wrap,seed=seed);game.say(f"Welcome, {career.name}. Rank: {career.rank}. Points: {career.points}.")
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
 return 0 if not mission or game.play(game.engine.start_case(mission).data["session"]) else 1
if __name__=="__main__":raise SystemExit(main())
