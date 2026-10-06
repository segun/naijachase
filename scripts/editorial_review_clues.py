"""Attach editorial provenance and produce a publication review audit."""
import csv,re
from collections import defaultdict
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent;ATOMS=ROOT/'data/gameplay/state-clue-atoms.csv';REPORT=ROOT/'data/gameplay/clue-editorial-review.csv'
OFFICIAL={
 'history':'https://foreignaffairs.gov.ng/nigeria/history-of-nigeria/','culture':'https://foreignaffairs.gov.ng/nigeria/culture/','heritage':'https://whc.unesco.org/en/statesparties/ng','living_heritage':'https://ich.unesco.org/en/state/nigeria-NG?info=elements-on-the-lists','agriculture':'https://www.fao.org/nigeria/fao-in-nigeria/nigeria-at-a-glance/en/','economy':'https://nipc.gov.ng/nigeria-states/','ecology':'https://nigeriaparkservice.gov.ng/','rail':'https://nrc.gov.ng/','ports':'https://nigerianports.gov.ng/','institutions':'https://nigeriareposit.nln.gov.ng/','geography':'https://nipc.gov.ng/nigeria-states/'}
GROUPS={'history':{'history','colonial_history','political_history','civil_war','independence','empire','emirates','royalty','royal_tradition','government_history','state_creation'},'culture':{'culture','society','language','languages','food','music','literature','festival','craft'},'heritage':{'heritage','archaeology','architecture','fortification','earthworks','monument'},'agriculture':{'agriculture','irrigation'},'economy':{'industry','mining','commerce','economy'},'ecology':{'ecology','wildlife','wetlands','birdlife','landscape','rock_landscape'},'rail':{'railway','transport'},'ports':{'seaport','maritime'},'institutions':{'institutions','education','government','capital'},'geography':{'geography','borders','river','rivers'}}
STOP={'the','and','for','with','from','that','this','into','about','where','which','would','state','asked','wanted','mentioned','traveller','person','people','known','local','old'}
AMERICAN={'color':'colour','center':'centre','theater':'theatre','program':'programme','traveler':'traveller','catalog':'catalogue'}
def read(path):
 with path.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def tokens(text):return {x for x in re.findall(r"[a-zA-ZÀ-ž']+",text.lower()) if len(x)>3 and x not in STOP}
def state_name(value):
 state=value.split('/')[0];return 'Federal Capital Territory' if state=='FCT' else state
def source_group(dimension):
 for group,dimensions in GROUPS.items():
  if dimension in dimensions:return group
 return 'geography'
def temporal_scope(dimension):
 if any(x in dimension for x in ('history','war','independence','empire','archaeology','heritage','fortification','earthworks')):return 'historical'
 if dimension in {'institutions','government','industry','mining','transport','railway','seaport','commerce'}:return 'current_or_changeable'
 return 'stable_cultural_or_geographic'
def sensitivity(row):
 flags=[];dimension=row['dimension'];text=row['dialogue'].lower()
 if dimension=='civil_war' or 'civil war' in text:flags.append('conflict_history')
 if dimension in {'religion','political_history','government','independence'} or row['venue_id'] in {'church','mosque'}:flags.append('religion_or_politics')
 if dimension in {'culture','society','language','languages','royal_tradition'}:flags.append('identity_or_tradition')
 return '|'.join(flags) or 'none'
def main():
 atoms=read(ATOMS);knowledge={x['knowledge_id']:x for x in read(ROOT/'data/knowledge/knowledge.csv')};locations={x['location_id']:state_name(x['state_or_territory']) for x in read(ROOT/'data/locations/locations.csv')};by_state=defaultdict(set)
 for relation in read(ROOT/'data/knowledge/location-knowledge-relations.csv'):
  if relation['location_id'] in locations:by_state[locations[relation['location_id']]].add(relation['knowledge_id'])
 reviewed=[];audit=[]
 for row in atoms:
  query=tokens(row['dialogue']+' '+row['dimension']);candidates=[knowledge[k] for k in by_state[row['state']] if k in knowledge and (k.startswith(('KN-SE','KN-S2')) or knowledge[k]['domain'] not in {'travel','reasoning','civics'})]
  ranked=sorted(((len(query&tokens(x['fact']+' '+x['topic']+' '+x['answer'])),x) for x in candidates),key=lambda z:(-z[0],z[1]['knowledge_id']));score,match=ranked[0] if ranked else (0,None)
  direct=row['source'] if row['source'].startswith('http') else '';group=source_group(row['dimension']);knowledge_url=match['source'] if match and match['source'].startswith('http') else ''
  source_url=direct or knowledge_url or OFFICIAL[group];knowledge_id=match['knowledge_id'] if match and score>=1 else ''
  status='reference_cross_checked' if direct or score>=2 else 'source_attached_line_check_required'
  language_flags=[f"use {preferred} instead of {word}" for word,preferred in AMERICAN.items() if re.search(rf'\b{word}\b',row['dialogue'].lower())]
  broad_terms=[word for word in ('all','always','primitive','backward','warlike','tribe') if re.search(rf'\b{word}\b',row['dialogue'].lower())]
  sensitive=sensitivity(row);notes=[]
  if status.endswith('required'):notes.append('Verify the exact sentence against a specific page or passage before publication.')
  if temporal_scope(row['dimension'])=='current_or_changeable':notes.append('Recheck before each content release because the claim may change.')
  if sensitive!='none':notes.append('Human sensitivity review required before publication.')
  if broad_terms:notes.append('Review broad or potentially stereotyped terms: '+', '.join(broad_terms)+'.')
  enriched=dict(row);enriched.update({'original_source':row['source'],'knowledge_id':knowledge_id,'source_url':source_url,'source_authority':group,'verification_status':status,'reference_alignment_score':score,'temporal_scope':temporal_scope(row['dimension']),'sensitivity_flags':sensitive,'nigerian_english_review':'automated_pass' if not language_flags else 'revision_required','pidgin_native_review':'required','editorial_notes':' '.join(notes) or 'No automated editorial flags.'});enriched['source']=source_url;reviewed.append(enriched)
  audit.append({'atom_id':row['atom_id'],'state':row['state'],'dimension':row['dimension'],'knowledge_id':knowledge_id,'source_url':source_url,'source_attached':'yes','verification_status':status,'reference_alignment_score':score,'temporal_scope':enriched['temporal_scope'],'sensitivity_flags':sensitive,'nigerian_english_review':enriched['nigerian_english_review'],'pidgin_native_review':'required','broad_term_flags':'|'.join(broad_terms) or 'none','editorial_notes':enriched['editorial_notes']})
 with ATOMS.open('w',encoding='utf-8',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(reviewed[0]),lineterminator='\n');w.writeheader();w.writerows(reviewed)
 with REPORT.open('w',encoding='utf-8',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(audit[0]),lineterminator='\n');w.writeheader();w.writerows(audit)
 print(f"Reviewed {len(audit)} atoms: {sum(x['verification_status']=='reference_cross_checked' for x in audit)} cross-checked, {sum(x['verification_status'].endswith('required') for x in audit)} requiring exact source-line checks, {sum(x['sensitivity_flags']!='none' for x in audit)} sensitivity flags")
if __name__=='__main__':main()
