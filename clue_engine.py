"""Ambiguity-aware Nigerian witness encounter selection."""
import csv,itertools,random
from pathlib import Path
SCHEDULES={
"market":(6,18,60),"library":(9,17,75),"motor_park":(5,23,45),"hotel":(0,24,60),"mosque":(5,21,60),"museum":(9,17,75),"radio_station":(8,22,60),"nightclub":(20,4,75),
"emir_palace":(8,18,75),"factory_gate":(6,18,60),"waterfront":(5,20,60),"jetty":(5,20,60),"community_hall":(8,21,60),"conservation_office":(8,17,75),"carnival_workshop":(9,20,75),"festival_ground":(7,20,60),"farm":(5,18,75),"seaport":(0,24,75),"refinery":(0,24,75)}
FIELDS=["sex","height","skin_tone","hair","hobby","vehicle","accessory","feature"]
DIFFICULTY_RULES={
 "1":{"label":"easy","ambiguity":(2.0,2.8),"register":"easy","options":3,"reliability":"verified first-hand account"},
 "2":{"label":"standard","ambiguity":(2.3,3.0),"register":"easy","options":3,"reliability":"clear first-hand account"},
 "3":{"label":"medium","ambiguity":(2.5,3.2),"register":"medium","options":4,"reliability":"credible first-hand account"},
 "4":{"label":"challenging","ambiguity":(2.8,3.15),"register":"hard","options":5,"reliability":"credible indirect account"},
 "5":{"label":"hard","ambiguity":(3.2,4.0),"register":"hard","options":5,"reliability":"corroborated indirect account"},
}
PIDGIN_ROLES={"agbero","baggage handler","bartender","boatman","bouncer","cattle trader","clearing agent","conductor","dockworker","driver","factory worker","farmer","fish seller","fisherman","food vendor","grain seller","loader","market woman","mechanic","miner","palm farmer","produce buyer","quarry worker","rice farmer","security guard","security man","shoe seller","stone dealer","tanker driver","ticket seller","trader","yam farmer"}
def pidginize(text):
 replacements=[("He kept asking ","That person dey ask "),("He was looking for ","That person dey find "),("He was travelling ","That person dey travel "),("He was reading ","That person dey read "),("He was tracing ","That person dey trace "),("He was asking ","That person dey ask "),("He wanted ","The person say e dey find "),("He asked ","The person ask "),("He enquired ","The person ask "),("He requested ","The person ask for "),("He bought ","The person buy "),("He mentioned ","The person talk about "),("He priced ","The person price "),("He examined ","The person check "),("He discussed ","The person talk about "),("He rejected ","The person no gree for "),("He stared ","The person look "),("His papers mentioned ","The paper wey e carry mention ")]
 for old,new in replacements:
  if text.startswith(old):return new+text[len(old):]
 return text.replace("The traveller ","That person ",1)
def profile_sentence(field,value,pidgin=False):
 if pidgin:
  feature={"walks with a limp":"dey waka with a limp","speaks very softly":"dey talk very low","whistles before answering":"dey whistle before e answer","writes left-handed":"dey write with left hand","taps a coin on tables":"dey tap coin for table","avoids eye contact":"no dey look person for eye","laughs at odd moments":"dey laugh at strange times","quotes old proverbs":"dey quote old proverbs","checks the time repeatedly":"dey always check time","wears strong citrus perfume":"wear strong citrus perfume"}.get(value,value)
  height={"tall":"tall","medium height":"get medium height","short":"short"}[value] if field=="height" else ""
  return {"sex":f"Na {'man' if value=='male' else 'woman'}.","height":f"The person {height}.","skin_tone":f"The person {value}.","hair":f"The person get {value}.","hobby":f"As we dey talk, e mention say e like {value}.","vehicle":f"E come with {value}.","accessory":f"I notice {value} with am.","feature":f"I notice say the person {feature}."}[field]
 return {"sex":f"The traveller was a {'man' if value=='male' else 'woman'}.","height":f"The traveller was {value if value!='medium height' else 'of medium height'}.","skin_tone":f"The traveller was {value}.","hair":f"The traveller had {value}.","hobby":f"While talking, they mentioned an interest in {value}.","vehicle":f"They arrived in {value}.","accessory":f"I noticed {value}.","feature":f"One thing stood out: the traveller {value}."}[field]
def role_behaviour(role):
 role=role.lower()
 if any(x in role for x in ("guard","security","officer")):return ("They scan the entrance before speaking.","They return to watching the crowd as soon as you close the notebook.")
 if any(x in role for x in ("seller","trader","vendor","buyer")):return ("They finish serving a customer before turning to you.","They call the next customer forward while you review the clue.")
 if any(x in role for x in ("driver","conductor","agbero","operator")):return ("They shout one last instruction across the loading area before answering.","They break off to help another vehicle or boat depart.")
 if any(x in role for x in ("librarian","archivist","historian","researcher","lecturer","teacher")):return ("They set aside a book or file and consider the question carefully.","They point you toward a reference before returning to their work.")
 if any(x in role for x in ("farmer","herder","fisher","miner","worker","artisan","weaver","carver")):return ("They wipe their hands and step away from the work before speaking.","They return to the unfinished job once the questions end.")
 if any(x in role for x in ("imam","mallam","priest","pastor","elder","chief","palace")):return ("They make sure the conversation will not disturb the gathering.","They offer a brief warning to use the information responsibly.")
 if any(x in role for x in ("presenter","producer","musician","dancer","drummer","dj")):return ("They wait for a break in the programme before leaning closer.","A cue calls them back before you can ask another question.")
 return ("They pause their work and listen to your question.","They nod once and return to what they were doing.")
class ClueEngine:
 def __init__(self,path,venue_profiles=None,venue_catalog=None,dialogue_variants=None,venue_experiences=None,location_venues=None):
  with Path(path).open(encoding="utf-8-sig",newline="") as f:rows=list(csv.DictReader(f))
  self.by_state={}
  for row in rows:self.by_state.setdefault(row["state"],[]).append(row)
  self.venue_weights={};self.venue_names={}
  if venue_profiles:
   with Path(venue_profiles).open(encoding="utf-8-sig",newline="") as f:
    for row in csv.DictReader(f):
     self.venue_weights[(row["state"],row["venue_id"])]=int(row["suitability_weight"])
     if row.get("display_name"):self.venue_names[(row["state"],row["venue_id"])]=row["display_name"]
  if venue_catalog:
   with Path(venue_catalog).open(encoding="utf-8-sig",newline="") as f:
    for row in csv.DictReader(f):SCHEDULES[row["venue_id"]]=(int(row["opens_hour"]),int(row["closes_hour"]),int(row["interview_minutes"]))
  self.dialogue_variants={}
  if dialogue_variants:
   with Path(dialogue_variants).open(encoding="utf-8-sig",newline="") as f:
    for row in csv.DictReader(f):self.dialogue_variants.setdefault((row["atom_id"],row["difficulty"],row["speech_register"]),[]).append(row)
  self.venue_experiences={}
  if venue_experiences:
   with Path(venue_experiences).open(encoding="utf-8-sig",newline="") as f:
    self.venue_experiences={row["venue_id"]:row for row in csv.DictReader(f)}
  self.location_venues={};self.locations_by_id={}
  if location_venues:
   with Path(location_venues).open(encoding="utf-8-sig",newline="") as f:
    for row in csv.DictReader(f):
     self.location_venues.setdefault((row["state"],row["venue_id"]),[]).append(row);self.locations_by_id[row['location_id']]=row
 def supported(self,state):return state in self.by_state
 def venue_weight(self,state,venue_id):return self.venue_weights.get((state,venue_id),1)
 def contextualize(self,encounter,state,mission_id,stage,elapsed):
  result=dict(encounter);experience=self.venue_experiences.get(result["venue_id"],{});total=420+elapsed;day=total//1440;hour=(total%1440)//60
  event_day=(sum(map(ord,mission_id+state))+stage+day)%5==0
  arrival_key="arrival_event_day" if event_day else "arrival_weekend" if day%7 in (5,6) else "arrival_night" if hour<6 or hour>=19 else "arrival_day"
  result["arrival_description"]=experience.get(arrival_key,"");result["context_type"]=arrival_key
  return result
 def locate_encounters(self,encounters,state,mission_id,stage):
  used=set();result=[]
  for encounter in encounters:
   choices=self.location_venues.get((state,encounter['venue_id']),[]);fresh=[x for x in choices if x['location_id'] not in used];pool=fresh or choices
   if not pool:result.append(encounter);continue
   location=random.Random(f"{mission_id}|{stage}|{state}|{encounter['venue_id']}").choice(pool);used.add(location['location_id']);item=dict(encounter)
   item.update({'location_id':location['location_id'],'location_name':location['location_name'],'location_type':location['location_type'],'venue_name':location['venue_name'],'hub_travel_minutes':location['hub_travel_minutes'],'location_context':location['location_context'],'witness_context':location['witness_context']});result.append(item)
   if item.get('dialogue'):
    lead=f"For {location['location_name']} here, " if item.get('speech_register')=='Nigerian Pidgin' else f"Here in {location['location_name']}, "
    item['dialogue']=lead+item['dialogue'][0].lower()+item['dialogue'][1:]
   result[-1]=item
  return result
 def combinations(self,state,investigation_state=None):
  venue_state=investigation_state or state
  valid=[]
  for combo in itertools.combinations(self.by_state.get(state,[]),3):
   if len({x["venue_id"] for x in combo})<3:continue
   if any(self.venue_weight(venue_state,x["venue_id"])<=0 for x in combo):continue
   sets=[set(x["candidate_states"].split("|")) for x in combo]
   if set.intersection(*sets)=={state}:valid.append(combo)
  return valid
 def encounters(self,state,mission_id,stage,profile,difficulty,recent_atoms=None,recent_variants=None,elapsed=0,investigation_state=None,preferred_venues=None):
  venue_state=investigation_state or state;combos=self.combinations(state,venue_state)
  if not combos:raise ValueError(f"No unique three-clue combination for {state}")
  recent_atoms=set(recent_atoms or []);recent_variants=set(recent_variants or [])
  rule=DIFFICULTY_RULES.get(difficulty,DIFFICULTY_RULES["3"])
  ambiguity=lambda c:sum(len(x["candidate_states"].split("|")) for x in c)/3
  overlap=lambda c:sum(len(set(a["candidate_states"].split("|"))&set(b["candidate_states"].split("|")))-1 for a,b in itertools.combinations(c,2))
  preferred=set(preferred_venues or []);suitability=lambda c:sum(self.venue_weight(venue_state,x["venue_id"])+(3 if x["venue_id"] in preferred else 0) for x in c)
  repetition=lambda c:sum(x["atom_id"] in recent_atoms for x in c)
  hour=(420+elapsed)%1440
  def wait_minutes(atom):
   opening,closing,_=SCHEDULES[atom['venue_id']];minute=hour;h=minute//60
   is_open=h>=opening if closing==24 else opening<=h<closing if opening<closing else h>=opening or h<closing
   return 0 if is_open else (opening*60-minute)%1440 or 1440
  waiting=lambda c:sum(wait_minutes(x) for x in c)
  low,high=rule['ambiguity'];distance=lambda c:0 if low<=ambiguity(c)<=high else min(abs(ambiguity(c)-low),abs(ambiguity(c)-high))
  combo=sorted(combos,key=lambda c:(repetition(c),distance(c),waiting(c),-overlap(c) if difficulty in ('4','5') else overlap(c),-suitability(c)))[0]
  def schedule_cost(order):
   minute=420+elapsed;cost=0
   for atom in order:
    opening,closing,interview=SCHEDULES[atom['venue_id']];clock=minute%1440;h=clock//60;is_open=h>=opening if closing==24 else opening<=h<closing if opening<closing else h>=opening or h<closing
    if not is_open:wait=(opening*60-clock)%1440 or 1440;cost+=wait;minute+=wait
    minute+=30+interview
   return cost
  ordered=min(itertools.permutations(combo),key=lambda order:(schedule_cost(order),-len(order[0]["candidate_states"].split("|"))))
  rng=random.Random(f"{mission_id}|{stage}|{state}");result=[]
  for i,atom in enumerate(ordered):
   field=FIELDS[(stage*3+i)%len(FIELDS)];role=rng.choice(atom["witness_roles"].split("|"));opening,closing,minutes=SCHEDULES[atom["venue_id"]]
   pidgin=role in PIDGIN_ROLES;register="Nigerian Pidgin" if pidgin else "English";level=rule['register']
   choices=self.dialogue_variants.get((atom["atom_id"],level,register),[])
   unused=[x for x in choices if x["variant_id"] not in recent_variants];pool=unused or choices
   variant=rng.choice(pool) if pool else None
   route=variant["dialogue"] if variant else pidginize(atom["dialogue"]) if pidgin else atom["dialogue"].replace("He ","The traveller ")
   dialogue=route+" "+profile_sentence(field,profile[field],pidgin)
   experience=self.venue_experiences.get(atom["venue_id"],{})
   before,after=role_behaviour(role);intros=[experience.get(f"intro_{n}","") for n in (1,2,3)];intros=[x for x in intros if x]
   encounter={**atom,"role":role,"speech_register":register,"variant_id":variant["variant_id"] if variant else "","venue_weight":str(self.venue_weight(venue_state,atom["venue_id"])),"venue_name":self.venue_names.get((venue_state,atom["venue_id"]),atom["venue_name"]),"witness_introduction":rng.choice(intros).format(role=role) if intros else "","before_behaviour":before,"after_behaviour":after,"wait_event":experience.get("wait_event",""),"investigation_event":experience.get("investigation_event",""),"event_minutes":experience.get("event_minutes","0"),"dialogue":dialogue,"profile_field":field,"profile_value":profile[field],"opens_hour":str(opening),"closes_hour":str(closing),"interview_minutes":str(minutes),"reliability":rule['reliability'],"difficulty_label":rule['label'],"ambiguity_score":f"{ambiguity(combo):.2f}"}
   result.append(self.contextualize(encounter,state,mission_id,stage,elapsed))
  return result
