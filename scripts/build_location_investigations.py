"""Map every playable location to locally suitable investigation venues."""
import ast,csv,hashlib,math
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent;LOCATIONS=ROOT/'data/locations/locations.csv';PROFILES=ROOT/'data/gameplay/state-venue-profiles.csv';OUT=ROOT/'data/gameplay/location-venue-map.csv'
TYPE_VENUES={
 'state_capital':['market','motor_park','hotel','library','radio_station','police_station'],'federal_capital':['monument','hotel','airport','library','museum','police_station'],'major_city':['market','motor_park','hotel','restaurant','radio_station','university'],'commercial_city':['market','motor_park','factory_gate','hotel','restaurant'],'historic_city':['museum','monument','craft_market','traditional_council','market'],'heritage_city':['museum','monument','craft_market','traditional_council'],'heritage_town':['museum','monument','craft_market','traditional_council'],'historic_town':['museum','monument','market','traditional_council'],'town':['market','motor_park','community_hall','police_station'],'local_government_area':['market','motor_park','community_hall','farm','traditional_council','police_station'],'district':['market','motor_park','community_hall','police_station'],'landmark':['monument','museum','craft_market','community_hall'],'unesco_heritage':['museum','monument','conservation_office','traditional_council'],'heritage_site':['museum','monument','community_hall'],'museum':['museum','library','monument'],'gallery':['museum','craft_market','university'],'government_site':['monument','library','police_station'],'national_park':['conservation_office','hotel','community_hall'],'game_reserve':['conservation_office','hotel','community_hall'],'nature_site':['conservation_office','hotel','community_hall'],'mountain_resort':['conservation_office','hotel','craft_market'],'waterfall':['conservation_office','waterfront','hotel'],'federal_district':['market','motor_park','community_hall','police_station']}
TAG_VENUES={'religion':['mosque','church'],'politics':['monument','library'],'government':['police_station','library'],'culture':['museum','craft_market','festival_ground'],'history':['museum','monument','library'],'architecture':['monument','museum'],'ecology':['conservation_office'],'wildlife':['conservation_office'],'water':['waterfront','fishing_jetty','jetty'],'coast':['beach','waterfront','seaport'],'agriculture':['farm','market'],'industry':['factory_gate'],'mining':['mining_site'],'education':['university','library'],'travel':['motor_park','hotel'],'commerce':['market','factory_gate']}
SUFFIX={'market':'Community Market','motor_park':'Motor Park','hotel':"Travellers' Lodge",'library':'Public Reading Room','radio_station':'Community Radio House','police_station':'Area Police Desk','monument':'Heritage Square','airport':'Airport Enquiry Desk','museum':'Local History Gallery','restaurant':'Food Court','university':'Study Centre','factory_gate':'Industrial Gate','craft_market':'Craft Arcade','traditional_council':'Traditional Council Hall','community_hall':'Civic Hall','farm':'Farm Produce Depot','conservation_office':'Conservation Post','waterfront':'Waterfront Landing','fishing_jetty':'Fishing Jetty','jetty':'Passenger Jetty','seaport':'Port Enquiry Shed','beach':'Beach Pavilion','festival_ground':'Festival Ground','mosque':'Mosque Visitors’ Court','church':'Church Visitors’ Hall','mining_site':'Mining Field Office','nightclub':'Nightlife Pavilion','emir_palace':'Emirate Visitors’ Court','palace':'Royal Visitors’ Court','railway_station':'Railway Enquiry Hall','refinery':'Industrial Safety Gate','sacred_grove':'Grove Visitors’ Post','cattle_market':'Livestock Market','carnival_workshop':'Carnival Workshop','hospital':'General Clinic'}
def read(path):
 with path.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def state_name(value):
 state=value.split('/')[0];return 'Federal Capital Territory' if state=='FCT' else state
def stable_number(text,low,high):return low+int(hashlib.sha256(text.encode()).hexdigest()[:8],16)%(high-low+1)
def local_minutes(row,coordinate,hubs):
 hub=hubs[state_name(row['state_or_territory'])];lat1,lon1=float(hub['latitude']),float(hub['longitude']);lat2,lon2=float(coordinate['latitude']),float(coordinate['longitude'])
 a=math.sin(math.radians(lat2-lat1)/2)**2+math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(math.radians(lon2-lon1)/2)**2;km=6371*2*math.asin(math.sqrt(a))*1.25
 return 0 if km<2 else min(240,max(15,round(km/45*60+15)))
def context(row):return f"This lead takes you into {row['name']}, recorded in the case directory as a {row['location_type'].replace('_',' ')}."
def witness_note(row):
 kind=row['location_type']
 if kind=='local_government_area':return f"The witness serves people travelling through communities in {row['name']}."
 if kind in ('landmark','heritage_site','unesco_heritage','museum','gallery'):return f"The witness is used to questions about the history and visitors of {row['name']}."
 if kind in ('national_park','game_reserve','nature_site','mountain_resort','waterfall'):return f"The witness knows the visitor routes and field activity around {row['name']}."
 return f"The witness works among the everyday movement of people through {row['name']}."
def main():
 locations=read(LOCATIONS);profiles=read(PROFILES);weights={(x['state'],x['venue_id']):int(x['suitability_weight']) for x in profiles};coordinates={x['location_id']:x for x in read(ROOT/'data/gameplay/location-coordinates.csv')};hubs={x['state']:x for x in read(ROOT/'data/gameplay/state-hubs.csv')};out=[]
 for loc in locations:
  state=state_name(loc['state_or_territory']);tags=ast.literal_eval(loc['game_tags'] or '[]');candidates=[]
  for venue in TYPE_VENUES.get(loc['location_type'],[]):
   if venue not in candidates:candidates.append(venue)
  for tag in tags:
   for venue in TAG_VENUES.get(tag,[]):
    if venue not in candidates:candidates.append(venue)
  available=[v for v in candidates if weights.get((state,v),0)>0]
  fallback=sorted((v for s,v in weights if s==state and weights[(s,v)]>0),key=lambda v:(-weights[(state,v)],v))
  for venue in fallback:
   if venue not in available:available.append(venue)
  for rank,venue in enumerate(available[:5],1):
   base=loc['name'].removesuffix(' LGA');coordinate=coordinates[loc['location_id']];out.append({'location_id':loc['location_id'],'location_name':loc['name'],'location_type':loc['location_type'],'state':state,'venue_id':venue,'venue_name':f"{base} {SUFFIX.get(venue,venue.replace('_',' ').title())}",'location_fit':max(1,6-rank),'hub_travel_minutes':local_minutes(loc,coordinate,hubs),'latitude':coordinate['latitude'],'longitude':coordinate['longitude'],'coordinate_kind':coordinate['coordinate_kind'],'location_context':context(loc),'witness_context':witness_note(loc)})
 # Guarantee that every state-approved venue can be placed somewhere suitable.
 by_state={}
 for loc in locations:by_state.setdefault(state_name(loc['state_or_territory']),[]).append(loc)
 existing={(x['state'],x['venue_id']) for x in out}
 for (state,venue),weight in sorted(weights.items()):
  if not weight or (state,venue) in existing:continue
  choices=by_state[state];fitted=[loc for loc in choices if venue in TYPE_VENUES.get(loc['location_type'],[]) or any(venue in TAG_VENUES.get(tag,[]) for tag in ast.literal_eval(loc['game_tags'] or '[]'))]
  loc=(fitted or choices)[stable_number(state+venue,0,len(fitted or choices)-1)];base=loc['name'].removesuffix(' LGA')
  coordinate=coordinates[loc['location_id']];out.append({'location_id':loc['location_id'],'location_name':loc['name'],'location_type':loc['location_type'],'state':state,'venue_id':venue,'venue_name':f"{base} {SUFFIX.get(venue,venue.replace('_',' ').title())}",'location_fit':3,'hub_travel_minutes':local_minutes(loc,coordinate,hubs),'latitude':coordinate['latitude'],'longitude':coordinate['longitude'],'coordinate_kind':coordinate['coordinate_kind'],'location_context':context(loc),'witness_context':witness_note(loc)})
 OUT.parent.mkdir(parents=True,exist_ok=True)
 with OUT.open('w',encoding='utf-8',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(out[0]),lineterminator='\n');w.writeheader();w.writerows(out)
 print(f"Created {len(out)} location-to-venue links covering {len({x['location_id'] for x in out})} locations")
if __name__=='__main__':main()
