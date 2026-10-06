"""Build coordinate coverage from Nigeria LGA centroids with an offline fallback."""
import argparse,csv,json,urllib.parse,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent;OUT=ROOT/'data/gameplay/location-coordinates.csv';CACHE=ROOT/'data/gameplay/nigeria-lga-centroids.json'
SERVICE='https://services3.arcgis.com/7J7WB6yJX0pYke9q/ArcGIS/rest/services/LGAs_Boundaries/FeatureServer/2/query'
SOURCE='https://services3.arcgis.com/7J7WB6yJX0pYke9q/ArcGIS/rest/services/LGAs_Boundaries/FeatureServer/2'
def read(path):
 with path.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def normal(text):return ''.join(x for x in text.lower() if x.isalnum())
def state_name(value):
 state=value.split('/')[0];return 'Federal Capital Territory' if state=='FCT' else state
def refresh():
 query=urllib.parse.urlencode({'where':'1=1','outFields':'ADM2_EN,ADM1_EN','returnGeometry':'false','returnCentroid':'true','f':'json'});data=urllib.request.urlopen(SERVICE+'?'+query,timeout=60).read();CACHE.write_bytes(data)
def main(argv=None):
 parser=argparse.ArgumentParser();parser.add_argument('--refresh',action='store_true');args=parser.parse_args(argv)
 if args.refresh or not CACHE.exists():refresh()
 features=json.loads(CACHE.read_text())['features'];centroids={(normal(x['attributes']['ADM1_EN']),normal(x['attributes']['ADM2_EN'])):x['centroid'] for x in features}
 hubs={x['state']:x for x in read(ROOT/'data/gameplay/state-hubs.csv')};rows=[]
 for loc in read(ROOT/'data/locations/locations.csv'):
  state=state_name(loc['state_or_territory']);name=loc['name'].removesuffix(' LGA');point=centroids.get((normal(state),normal(name)))
  if point:lat,lon,kind=point['y'],point['x'],'lga_boundary_centroid'
  else:
   hub=hubs[state];lat,lon,kind=float(hub['latitude']),float(hub['longitude']),'state_hub_coordinate' if loc['location_type'] in ('state_capital','federal_capital') else 'state_hub_fallback'
  rows.append({'location_id':loc['location_id'],'latitude':f'{lat:.6f}','longitude':f'{lon:.6f}','coordinate_kind':kind,'source':SOURCE if kind=='lga_boundary_centroid' else 'Curated state-hub coordinate; landmark-level verification still required'})
 with OUT.open('w',encoding='utf-8',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]),lineterminator='\n');w.writeheader();w.writerows(rows)
 print(f"Created {len(rows)} coordinates: {sum(x['coordinate_kind']=='lga_boundary_centroid' for x in rows)} LGA centroids, {sum(x['coordinate_kind']=='state_hub_coordinate' for x in rows)} state hubs, {sum(x['coordinate_kind']=='state_hub_fallback' for x in rows)} fallbacks")
if __name__=='__main__':main()
