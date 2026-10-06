"""Build coherent story material for every mission without changing route IDs."""
import csv
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent;OUT=ROOT/'data/gameplay/mission-narratives.csv'
def read(path):
 with path.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
THEMES={
 'artifact_case':('cultural recovery',['a carved ceremonial staff','a bronze court plaque','a beaded royal crown','an ivory festival mask','a hand-forged talking drum'],['museum','traditional_council','palace','craft_market']),
 'archive_case':('archive recovery',['a colonial court ledger','a handwritten travel diary','a missing newspaper folio','a royal correspondence file','a map from an early survey'],['library','museum','university','radio_station']),
 'cultural_case':('living-heritage recovery',['a festival masquerade headpiece','a master drummer’s rhythm book','a ceremonial dance costume','a woven title-holder’s robe','a guild’s pattern register'],['festival_ground','craft_market','community_hall','palace']),
 'document_case':('document recovery',['a signed independence-era letter','a boundary commission map','a historic council minute book','a rare Ajami manuscript','a sealed public record'],['library','university','traditional_council','museum']),
 'financial_case':('financial investigation',['a cooperative’s coded account book','a forged commodity certificate','a diverted development bond','a missing customs ledger','a counterfeit warehouse receipt'],['market','seaport','factory_gate','hotel']),
 'heritage_case':('heritage protection',['a shrine custodian’s brass emblem','an archaeological field notebook','a restored palace door panel','a protected terracotta figure','a heritage-site inventory'],['monument','museum','sacred_grove','conservation_office']),
 'identity_case':('identity investigation',['a stolen voter enrolment kit','a forged diplomatic credential','a missing biometric register','a cloned civil-service identity file','a stolen examination record'],['police_station','airport','hotel','university']),
 'museum_case':('museum recovery',['a Nok-style study figure','a royal bronze commemorative head','a river-trade navigation instrument','a historic textile panel','a conserved photographic plate'],['museum','monument','library','craft_market']),
 'smuggling_case':('interdiction',['a crate of protected carvings','a shipment of illicit antiquities','a case of falsified mineral samples','a consignment of stolen manuscripts','a container of protected wildlife products'],['seaport','airport','motor_park','railway_station']),
 'technology_case':('technology investigation',['an encrypted research drive','a stolen broadcast archive','a prototype flood sensor','a compromised identity server','a missing satellite survey unit'],['university','radio_station','airport','factory_gate']),
}
ADJECTIVES=['Vanishing','Broken','Hidden','Silent','Midnight','Borrowed','False','Scarlet','Dusty','Unmarked','Last','Crooked','Restless','Missing','Secret','Shifting','Burnished','Paper','Hollow','Locked']
BEHAVIOUR={'meticulous':'checks every receipt and timetable twice','arrogant':'leaves corrections on signs and documents','historian':'asks witnesses unusually detailed questions about the past','superstitious':'avoids certain numbers and changes plans after bad omens','impatient':'pressures drivers and clerks to skip procedure','calculating':'tests several routes before choosing one','charismatic':'wins cooperation before anyone thinks to ask for identification','paranoid':'changes vehicles and watches every reflective surface','resourceful':'turns ordinary local services into improvised escape routes','vengeful':'leaves pointed messages for anyone who interferes','observant':'notices cameras, exits and uniforms before entering','quiet':'speaks softly and lets companions do most of the talking','geography_nerd':'collects road maps and corrects place-name spellings','cautious':'waits for crowds before moving between locations','competitive':'treats each police bulletin as a personal challenge'}
CALLING=['a neatly folded transport receipt','a red thread tied around a coin','a pencilled compass rose','a playing card marked with a tiny crown','a strip of indigo cloth','a brass button polished bright','a torn square from an old road map','a short proverb written in green ink','a stamped luggage label with no name','a small paper mask']
CALLING_MARKS=['triangle','crescent','spiral','fish','key','calabash','star','feather','drum','bridge']
def clean_object(item):return item.removeprefix('a ').removeprefix('an ')
def main():
 missions=read(ROOT/'data/missions/missions.csv');locations={x['location_id']:x for x in read(ROOT/'data/locations/locations.csv')};thieves={x['thief_id']:x for x in read(ROOT/'data/thieves/thieves.csv')};rows=[];used=set()
 for index,m in enumerate(missions):
  thief=thieves[m['thief_id']];theme,items,venues=THEMES[m['mission_type']];item=items[index%len(items)];route=[locations[m[k]] for k in ('start_location_id','stop_2_location_id','stop_3_location_id','capture_location_id')];false=[locations[m[k]] for k in ('false_route_location_id_1','false_route_location_id_2')]
  adjective=ADJECTIVES[index%len(ADJECTIVES)];title=f"The {adjective} {clean_object(item).title()}: {route[0]['name']} to {route[3]['name']}"
  if title in used:title=f"{title} via {route[1]['name']}"
  if title in used:title=f"{title} and {route[2]['name']}"
  if title in used:title=f"{title} ({m['mission_id'][-3:]})"
  used.add(title);signature=m['signature_trait'].replace('_',' ');behaviour=BEHAVIOUR.get(m['signature_trait'],f"keeps displaying a {signature} streak");thief_number=int(m['thief_id'][-3:])-1;calling=f"{CALLING[thief_number%len(CALLING)]} bearing a tiny {CALLING_MARKS[thief_number//len(CALLING)]} mark"
  crime=m['crime_type'].replace('_',' ');article='an' if crime[0].lower() in 'aeiou' else 'a'
  premise=f"Someone has taken {item} from {route[0]['name']}. The route suggests {article} {crime} operation, and the object may be moved again before the week is over."
  briefing=f"The local case officer seals the scene at {route[0]['name']}. Recover {item}, identify the thief from five profile details, and obtain a warrant before the trail reaches {route[3]['name']}."
  transitions=[f"A verified sighting carries the trail from {origin['name']} to {destination['name']}. Local officers in {destination['state_or_territory'].split('/')[0]} have been told to expect you, but not to alert the suspect." for origin,destination in zip(route,route[1:])]
  capture=f"At {route[3]['name']}, the exits begin to close as your warrant reaches the local team. The suspect notices the cordon and makes one last attempt to blend into the crowd."
  conclusion=f"The warrant holds. {thief['alias']} is taken into custody at {route[3]['name']}, and {item} is secured for return to its custodians."
  rows.append({'mission_id':m['mission_id'],'title':title,'case_theme':theme,'stolen_item':item,'premise':premise,'opening_briefing':briefing,'preferred_venues':'|'.join(venues),'calling_card':calling,'thief_behaviour':f"Witnesses repeatedly report that the suspect {behaviour}.",'transition_1':transitions[0],'transition_2':transitions[1],'transition_3':transitions[2],'false_destination_1':false[0]['state_or_territory'].split('/')[0],'false_destination_2':false[1]['state_or_territory'].split('/')[0],'false_lead_explanation':'That destination matched part of the evidence, but it did not satisfy the complete three-clue trail.','capture_scene':capture,'success_conclusion':conclusion,'failure_conclusion':f"The deadline passes before {item} can be recovered. The trail from {route[0]['name']} goes cold, and the case remains open."})
 OUT.parent.mkdir(parents=True,exist_ok=True)
 with OUT.open('w',encoding='utf-8',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]),lineterminator='\n');w.writeheader();w.writerows(rows)
 print(f"Created {len(rows)} mission narratives with {len({x['title'] for x in rows})} unique titles")
if __name__=='__main__':main()
