"""Generate gameplay support data for the terminal investigation engine."""
import csv, math
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data/gameplay"
VENUES = [
 ("market","Market",6,18,60,"market woman|produce seller|textile trader|customer|loader|food vendor"),
 ("library","Library",9,17,75,"librarian|archivist|researcher|student|security guard"),
 ("nightclub","Nightclub",20,4,75,"bouncer|bartender|waiter|performer|clubgoer"),
 ("church","Church",7,19,60,"pastor|priest|usher|choir member|elder|deacon"),
 ("mosque","Mosque",5,21,60,"imam|muezzin|teacher|worshipper|attendant"),
 ("museum","Museum",9,17,75,"curator|guide|conservator|visitor|security guard"),
 ("motor_park","Motor park",5,23,45,"agbero|driver|conductor|ticket seller|mechanic|passenger"),
 ("hotel","Hotel",0,24,60,"receptionist|concierge|housekeeper|guest|security guard"),
 ("restaurant","Restaurant",7,23,60,"cook|server|cashier|customer|manager"),
 ("airport","Airport",4,24,75,"check-in agent|baggage handler|pilot|traveller|security officer"),
 ("radio_station","Radio station",8,22,60,"presenter|producer|reporter|engineer|caller"),
 ("hospital","Hospital",0,24,75,"doctor|nurse|porter|visitor|records clerk")]
VENUES += [
 ("beach","Beach",6,20,60,"lifeguard|fish seller|boat operator|food vendor"),
 ("carnival_workshop","Carnival workshop",9,20,75,"costume maker|dancer|welder|drummer"),
 ("cattle_market","Cattle market",5,17,60,"cattle trader|herder|veterinary worker|loader"),
 ("community_hall","Community hall",8,21,60,"community leader|elder|youth organiser|dance instructor"),
 ("conservation_office","Conservation office",8,17,75,"park ranger|wildlife officer|researcher|tour guide"),
 ("craft_market","Craft market",7,18,60,"weaver|dyer|carver|bronze caster|leather seller"),
 ("emir_palace","Emir's palace",8,18,75,"palace guard|horse groom|palace messenger|court historian"),
 ("factory_gate","Factory gate",6,18,60,"factory worker|security man|artisan|tanker driver"),
 ("farm","Farm",5,18,75,"farmer|produce buyer|farmhand|extension worker"),
 ("festival_ground","Festival ground",7,21,60,"drummer|dancer|food vendor|festival organiser"),
 ("fishing_jetty","Fishing jetty",5,20,60,"fisherman|boat operator|fish seller|ticket seller"),
 ("mining_site","Mining site",6,18,75,"miner|quarry worker|mineral trader|site engineer"),
 ("monument","Monument",8,18,60,"guide|photographer|caretaker|visitor"),
 ("palace","Royal palace",8,18,75,"palace guard|court historian|chief|drummer"),
 ("police_station","Police station",0,24,75,"desk officer|detective|security guard|complainant"),
 ("railway_station","Railway station",5,22,60,"ticket seller|railway worker|passenger|security guard"),
 ("refinery","Refinery",0,24,75,"engineer|security man|tanker driver|shift worker"),
 ("sacred_grove","Sacred grove",7,18,75,"custodian|priestess|guide|devotee"),
 ("seaport","Seaport",0,24,75,"dockworker|clearing agent|customs officer|sailor"),
 ("traditional_council","Traditional council",8,18,75,"chief|elder|court secretary|historian"),
 ("university","University",7,22,75,"lecturer|student|researcher|security guard"),
 ("waterfront","Waterfront",5,21,60,"boatman|fish seller|dockworker|food vendor"),
 ("jetty","Passenger jetty",5,20,60,"boat operator|ticket seller|passenger|fish seller"),
]
BASE_WEIGHTS={"market":4,"motor_park":4,"hotel":3,"restaurant":3,"hospital":2,"library":2,"radio_station":2,"police_station":2,"university":2,"community_hall":2,"traditional_council":2,"museum":2,"airport":2,"farm":2,"craft_market":2,"church":1,"mosque":1,"festival_ground":1,"monument":1}
STATE_BOOSTS={
 "Abia":{"market":5,"factory_gate":5,"church":4,"craft_market":4},"Adamawa":{"cattle_market":5,"conservation_office":5,"emir_palace":4,"mosque":4,"waterfront":3},"Akwa Ibom":{"waterfront":5,"fishing_jetty":5,"church":4,"market":4,"beach":4,"seaport":3,"conservation_office":3},
 "Anambra":{"market":5,"motor_park":5,"factory_gate":4,"church":4,"waterfront":3,"seaport":0},"Bauchi":{"conservation_office":5,"emir_palace":4,"mosque":4,"cattle_market":4},"Bayelsa":{"waterfront":5,"jetty":5,"fishing_jetty":5,"market":4,"seaport":2,"conservation_office":4},
 "Benue":{"farm":5,"market":5,"festival_ground":4,"waterfront":3},"Borno":{"emir_palace":5,"mosque":5,"cattle_market":4,"conservation_office":4},"Cross River":{"seaport":5,"conservation_office":5,"carnival_workshop":5,"market":4,"waterfront":4,"church":3},
 "Delta":{"refinery":5,"waterfront":5,"seaport":4,"market":4,"palace":3},"Ebonyi":{"farm":5,"market":5,"mining_site":4,"church":4},"Edo":{"palace":5,"museum":5,"craft_market":5,"festival_ground":4},
 "Ekiti":{"university":5,"farm":4,"library":4,"palace":3},"Enugu":{"museum":5,"radio_station":4,"university":4,"church":4},"Federal Capital Territory":{"monument":5,"hotel":5,"airport":5,"mosque":4,"church":4,"railway_station":4},
 "Gombe":{"cattle_market":4,"mosque":4,"motor_park":4,"radio_station":4,"conservation_office":3,"waterfront":3,"emir_palace":3},"Imo":{"farm":4,"community_hall":4,"church":4,"university":3},"Jigawa":{"conservation_office":5,"mosque":4,"cattle_market":4,"emir_palace":3,"waterfront":3,"monument":3},
 "Kaduna":{"factory_gate":5,"railway_station":5,"mosque":4,"church":3,"emir_palace":4,"refinery":4},"Kano":{"market":5,"emir_palace":5,"mosque":5,"craft_market":5,"railway_station":4},"Katsina":{"emir_palace":5,"mosque":5,"craft_market":4,"cattle_market":4,"conservation_office":3},
 "Kebbi":{"fishing_jetty":5,"festival_ground":5,"farm":4,"mosque":4,"waterfront":4,"emir_palace":4,"museum":4},"Kogi":{"waterfront":5,"monument":4,"motor_park":4,"traditional_council":4,"factory_gate":3},"Kwara":{"emir_palace":4,"mosque":4,"craft_market":4,"university":4,"waterfront":3},
 "Lagos":{"seaport":5,"nightclub":5,"market":5,"beach":5,"waterfront":5,"airport":5,"railway_station":4},"Nasarawa":{"mining_site":5,"farm":4,"motor_park":4,"traditional_council":3,"emir_palace":3},"Niger":{"waterfront":4,"fishing_jetty":4,"emir_palace":4,"craft_market":4,"conservation_office":3,"railway_station":3},
 "Ogun":{"factory_gate":5,"market":4,"craft_market":5,"railway_station":4,"palace":3},"Ondo":{"farm":5,"waterfront":4,"palace":4,"seaport":0,"conservation_office":3},"Osun":{"sacred_grove":5,"festival_ground":5,"palace":4,"farm":4},
 "Oyo":{"palace":5,"market":5,"university":5,"festival_ground":4,"railway_station":4},"Plateau":{"mining_site":5,"museum":4,"craft_market":4,"hotel":4,"conservation_office":3},"Rivers":{"refinery":5,"seaport":5,"waterfront":5,"nightclub":4,"market":4,"conservation_office":3},
 "Sokoto":{"mosque":5,"emir_palace":5,"craft_market":4,"market":4,"church":1,"waterfront":3,"museum":4,"university":3},"Taraba":{"conservation_office":5,"farm":4,"cattle_market":4,"hotel":4,"waterfront":3},"Yobe":{"cattle_market":5,"conservation_office":4,"mosque":4,"motor_park":4,"emir_palace":3},
 "Zamfara":{"mining_site":5,"mosque":4,"emir_palace":4,"cattle_market":4,"waterfront":3,"conservation_office":3,"monument":3},
}
SCENE_CUES={
 "market":("Traders call across crowded aisles while handcarts squeeze between stalls.","Most shutters are down, but food sellers and loaders still work under bare bulbs.","A delivery rush has packed the aisles with buyers, baskets and impatient porters.","Nearby food vendors are setting up while you wait for the main stalls to open."),
 "library":("Ceiling fans turn above readers, catalogues and carefully labelled shelves.","The reading rooms are dark and the returns box is the only sign of activity.","Students have taken most of the desks and the reference counter has a short queue.","A newspaper seller and early students gather outside the locked doors."),
 "nightclub":("Cleaners and sound technicians prepare the room for the evening crowd.","Bass carries through the doorway as staff manage a lively dance floor.","A headline performance has drawn a longer queue and extra security.","A food stand nearby stays open while the club staff prepare inside."),
 "church":("Ushers arrange seats while quiet conversations echo through the hall.","The compound is calm under security lights after the day's services.","Choir rehearsal and community meetings have brought more people than usual.","A caretaker sweeps the entrance while you wait for the doors to open."),
 "mosque":("Worshippers and attendants move quietly through the shaded compound.","The courtyard is cool and subdued between prayer times.","A lecture and community gathering have filled the outer courtyard.","Tea sellers nearby serve early arrivals while attendants prepare the compound."),
 "museum":("Guides lead small groups past cases, maps and carefully conserved objects.","The galleries are closed and a night guard watches the silent entrance.","A temporary exhibition has brought school groups and visiting researchers.","A postcard seller and guide wait near the gate before opening time."),
 "motor_park":("Conductors shout destinations as buses load beneath patched awnings.","Headlamps, generators and late departures keep the park restless.","A holiday travel rush has filled every loading bay and roadside stall.","Drivers drink tea beside parked buses while the first manifests are prepared."),
 "hotel":("Guests cross the lobby while reception staff juggle keys, calls and luggage.","Low lobby music and the night desk give the hotel a watchful calm.","A conference has filled the lobby with name tags, luggage and hurried calls.","The lobby remains open, so there is no need to wait outside."),
 "restaurant":("Steam and spice drift from the kitchen as servers move between tables.","Late diners linger while cooks clean down one side of the kitchen.","A family celebration has made the dining room louder and slower than usual.","A cook receives produce at the back door while the dining room is still closed."),
 "airport":("Announcements compete with trolley wheels, greetings and security checks.","Red-eye passengers doze beneath bright lights near the check-in desks.","Delayed flights have crowded the concourse with anxious travellers.","The terminal remains open, though several service counters are changing shifts."),
 "radio_station":("Presenters move between a live studio and a corridor lined with notices.","The night programme is on air and everyone speaks softly outside the studio.","A live audience programme has filled reception with callers and performers.","A producer reviews the morning rundown near the locked reception desk."),
 "hospital":("Nurses, relatives and orderlies move quickly through the reception area.","The emergency unit remains bright while the quieter corridors settle down.","A public-health clinic has created long queues around the records desk.","The hospital never fully closes; a shift change briefly slows the front desk."),
 "beach":("Fishing boats, food stands and wind off the water animate the shoreline.","The dark water is watched by security staff as vendors pack away their tables.","A holiday crowd has brought music, games and a row of temporary stalls.","Fishermen mend nets nearby while you wait for the public area to open."),
 "carnival_workshop":("Fabric, wire, paint and feathers cover every available worktable.","A small crew works late beneath harsh lamps to finish costumes on time.","Parade deadlines have turned the workshop into a controlled scramble.","A costume maker sorts deliveries outside while the main room is unlocked."),
 "cattle_market":("Herders negotiate over restless animals amid dust, ropes and feed sacks.","The pens are quiet except for watchmen and the occasional animal call.","A major market day has brought extra herds, veterinary checks and buyers.","Herders water their animals outside while the sales pens are prepared."),
 "community_hall":("Plastic chairs, noticeboards and a humming generator frame a local meeting.","The hall is locked, but conversations continue beneath the veranda lights.","A wedding, union meeting or youth programme has filled the compound.","An organiser writes the day's programme on a board outside."),
 "conservation_office":("Maps, field boots and wildlife posters crowd the practical office.","Only the duty ranger remains, monitoring calls from distant patrol posts.","A visiting research team has brought specimen boxes and muddy vehicles.","Rangers check radios and water containers before the public desk opens."),
 "craft_market":("Dyers, carvers and weavers work beside displays arranged by material.","Most workshops are shuttered, leaving only a few artisans finishing orders.","A craft fair has drawn demonstrators, school groups and wholesale buyers.","Artisans unload wood, cloth and clay while you wait for trading to begin."),
 "emir_palace":("Messengers and guards cross a formal courtyard shaped by long protocol.","The gates are quiet and the night watch keeps visitors at a respectful distance.","A Durbar or council day has filled the outer court with horses and delegations.","Palace staff record early visitors while the public office is prepared."),
 "factory_gate":("Shift workers pass the gatehouse as trucks queue for inspection.","Floodlights wash over the loading yard during a quieter night shift.","A large dispatch has backed trucks onto the approach road.","Drivers check manifests outside while the day gate team signs in."),
 "farm":("Workers move between rows, sheds and produce laid out for sorting.","The fields are dark and only the farmhouse and animal pens show light.","Harvest activity has brought extra hands, buyers and loaded pickup trucks.","Farmhands sharpen tools and share tea before work begins."),
 "festival_ground":("Vendors mark out spaces while drummers test rhythms near the stage.","Security lights reveal empty stands and decorations moving in the breeze.","A festival programme has filled the grounds with processions and food stalls.","Organisers check ropes, chairs and sound equipment before admitting visitors."),
 "fishing_jetty":("Boats knock against the landing while fish sellers sort the morning catch.","A few lamps reveal crews preparing nets for a pre-dawn departure.","A strong catch has crowded the jetty with buyers, baskets and smoking fires.","Crews mend nets beside moored boats while the ticket window remains closed."),
 "mining_site":("Dusty vehicles pass a checkpoint near heaps of rock and safety notices.","Machinery is mostly silent while the night watch patrols the fenced workings.","An inspection has gathered engineers, miners and local officials at the gate.","Workers collect helmets and lamps while the site office completes its checks."),
 "monument":("Visitors circle the structure while guides point out weathered details.","The floodlit monument stands almost empty behind a locked visitor gate.","A remembrance ceremony has brought wreaths, speeches and extra security.","A caretaker clears leaves and dust before opening the grounds."),
 "palace":("Chiefs, messengers and visitors wait beneath the shade of a formal courtyard.","The palace is quiet behind guarded gates after the public offices close.","A royal festival has filled the approach with drummers, families and titled guests.","Court staff receive written requests while the audience office is prepared."),
 "police_station":("Officers move between the report desk, radio room and crowded benches.","The duty team handles calls beneath fluorescent lights in the quiet station.","A major public event has brought extra patrol briefings and complainants.","The station remains open, though shift handover may delay the report desk."),
 "railway_station":("Passengers study the board while vendors and porters work the platform.","The platform echoes between late services under bright security lights.","A full train has brought families, luggage and a long ticket queue.","Track workers and tea sellers arrive before the first passenger service."),
 "refinery":("Pipes, warning signs and the distant hum of processing surround the gatehouse.","Orange safety lights mark a continuous shift behind the security fence.","A maintenance shutdown has brought contractors and extra tanker traffic.","Tanker drivers wait with paperwork while the visitor office changes shift."),
 "sacred_grove":("Filtered light, old trees and quiet paths give the grove a guarded stillness.","The gates are closed and the forest beyond them is left undisturbed.","A sacred festival has brought devotees, drummers and carefully managed crowds.","Custodians prepare the paths and offerings before visitors are admitted."),
 "seaport":("Cranes move above stacked cargo as customs agents and drivers trade paperwork.","Floodlights and ship horns keep the port active through the night.","A vessel arrival has congested the gates with containers and clearing agents.","Truck drivers queue outside while the relevant cargo office prepares to open."),
 "traditional_council":("Elders and petitioners wait around a chamber arranged for formal discussion.","The council office is locked after a day of meetings and mediation.","A community dispute or title ceremony has drawn a larger gathering.","A court secretary arranges files while early petitioners wait outside."),
 "university":("Students cross busy walkways between lecture halls, offices and food stalls.","Study groups and security patrols occupy the quieter evening campus.","Convocation or examinations have filled the campus with families and notices.","Cleaners and early lecturers arrive while administrative offices remain locked."),
 "waterfront":("Boats, fish sellers and waterside traffic crowd the muddy landing.","Reflections from a few lamps shake across the dark water.","A regatta or busy landing day has doubled the boats and shoreline vendors.","Boat crews check engines and ropes while the public landing wakes up."),
 "jetty":("Passengers balance bags as boat operators call routes from the landing.","A few late boats idle beneath lamps while the ticket table is packed away.","A holiday rush has filled the landing with families, goods and impatient crews.","Operators check fuel and lifejackets before ticket sales begin.")}
NAME_TEMPLATES={
 "market":"{hub} Travellers' Market","library":"{state} Reading House","nightclub":"Lagoon Lights Club","church":"{hub} Unity Church","mosque":"{hub} Unity Mosque","museum":"{state} Memory House","motor_park":"{hub} Main Motor Park","hotel":"Crossroads Hotel","restaurant":"The Travellers' Pot","airport":"{hub} Air Terminal","radio_station":"{state} Community Radio","hospital":"{hub} General Hospital","beach":"Blue Horizon Beach","carnival_workshop":"Unity Carnival Workshop","cattle_market":"{hub} Livestock Yard","community_hall":"{hub} Community Hall","conservation_office":"{state} Field Office","craft_market":"{hub} Makers' Market","emir_palace":"Emirate Visitor Court","factory_gate":"{hub} Industrial Gate","farm":"Green Acres Farm","festival_ground":"{hub} Festival Ground","fishing_jetty":"Riverbend Fishing Jetty","mining_site":"Red Earth Workings","monument":"{state} Heritage Monument","palace":"Royal Visitor Court","police_station":"{hub} Central Police Station","railway_station":"{hub} Railway Station","refinery":"Eastern Process Gate","sacred_grove":"Quiet River Grove","seaport":"Harbour Gate Terminal","traditional_council":"{hub} Traditional Council","university":"{state} Civic University","waterfront":"River Road Landing","jetty":"Crossing Point Jetty"}
HAIR=["closely cropped hair","long braided hair","a shaved head","short curly hair","shoulder-length hair","grey-streaked hair","a neat afro","dyed red hair","long dreadlocks","a distinctive centre part"]
SEX=["male","female"]
HEIGHT=["tall","medium height","short"]
SKIN_TONE=["dark-skinned","light-skinned"]
HOBBY=["tennis","chess","birdwatching","photography","horse riding","jazz records","football","antique maps","gardening","long-distance running"]
VEHICLE=["a red convertible","a black motorcycle","a silver saloon","a white pickup","a green sports car","a blue minibus","a vintage coupe","a yellow SUV","a grey hatchback","a dark luxury sedan"]
ACCESSORY=["a gold wristwatch","round spectacles","a red scarf","a carved walking stick","a silver briefcase","a wide-brimmed hat","a leather satchel","a camera bag","white gloves","a beaded bracelet"]
FEATURE=["walks with a limp","speaks very softly","whistles before answering","writes left-handed","taps a coin on tables","avoids eye contact","laughs at odd moments","quotes old proverbs","checks the time repeatedly","wears strong citrus perfume"]
COORDS={"Umuahia":(5.53,7.49),"Yola":(9.20,12.48),"Uyo":(5.04,7.91),"Awka":(6.21,7.07),"Bauchi":(10.31,9.84),"Yenagoa":(4.92,6.26),"Makurdi":(7.73,8.52),"Maiduguri":(11.83,13.15),"Calabar":(4.95,8.32),"Asaba":(6.20,6.73),"Abakaliki":(6.32,8.11),"Benin City":(6.34,5.63),"Ado-Ekiti":(7.62,5.22),"Enugu":(6.45,7.51),"Gombe":(10.29,11.17),"Owerri":(5.49,7.04),"Dutse":(11.76,9.34),"Kaduna":(10.52,7.44),"Kano":(12.00,8.52),"Katsina":(12.99,7.60),"Birnin Kebbi":(12.45,4.20),"Lokoja":(7.80,6.74),"Ilorin":(8.50,4.55),"Ikeja":(6.60,3.35),"Lafia":(8.49,8.52),"Minna":(9.62,6.55),"Abeokuta":(7.15,3.35),"Akure":(7.25,5.19),"Osogbo":(7.77,4.56),"Ibadan":(7.38,3.95),"Jos":(9.90,8.86),"Port Harcourt":(4.82,7.05),"Sokoto":(13.06,5.24),"Jalingo":(8.89,11.36),"Damaturu":(11.75,11.96),"Gusau":(12.17,6.66),"Abuja":(9.08,7.40)}
def read(path):
 with path.open(encoding="utf-8-sig",newline="") as f:return list(csv.DictReader(f))
def write(path,rows):
 with path.open("w",encoding="utf-8",newline="") as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]),lineterminator="\n");w.writeheader();w.writerows(rows)
def dist(a,b):
 lat1,lon1,lat2,lon2=map(math.radians,(*a,*b));dlat=lat2-lat1;dlon=lon2-lon1
 h=math.sin(dlat/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
 return 6371*2*math.asin(math.sqrt(h))
def main():
 OUT.mkdir(parents=True,exist_ok=True); locations=read(ROOT/"data/locations/locations.csv")
 hubs=[]
 for x in locations:
  if x["location_type"] in {"state_capital","federal_capital"}:
   state="Federal Capital Territory" if x["location_type"]=="federal_capital" else x["state_or_territory"]
   lat,lon=COORDS[x["name"]]
   hubs.append({"state":state,"hub_location_id":x["location_id"],"hub_city":x["name"],"latitude":lat,"longitude":lon})
 if len(hubs)!=37:raise ValueError(f"Expected 37 hubs, found {len(hubs)}")
 travel=[]
 for a in hubs:
  for b in hubs:
   if a["state"]==b["state"]:continue
   km=round(dist((float(a["latitude"]),float(a["longitude"])),(float(b["latitude"]),float(b["longitude"]))))
   mode="road" if km<=220 else "air"; minutes=round(((km/65*60+45) if mode=="road" else (km/650*60+150))/15)*15
   travel.append({"origin_state":a["state"],"destination_state":b["state"],"distance_km":km,"travel_mode":mode,"travel_minutes":int(minutes)})
 profiles=[]
 for i,t in enumerate(read(ROOT/"data/thieves/thieves.csv")):
  profiles.append({"thief_id":t["thief_id"],"sex":SEX[i%2],"height":HEIGHT[(i//2)%3],"skin_tone":SKIN_TONE[(i//6)%2],"hair":HAIR[i%10],"hobby":HOBBY[(i//10)%10],"vehicle":VEHICLE[(i*3)%10],"accessory":ACCESSORY[(i*7)%10],"feature":FEATURE[(i*9)%10]})
 assert len({tuple(x[k] for k in ("sex","height","skin_tone","hair","hobby","vehicle","accessory","feature")) for x in profiles})==len(profiles)
 venues=[{"venue_id":v[0],"venue_name":v[1],"opens_hour":v[2],"closes_hour":v[3],"interview_minutes":v[4],"witness_roles":v[5]} for v in VENUES]
 experiences=[]
 for venue in venues:
  vid=venue["venue_id"];day,night,event,waiting=SCENE_CUES[vid];label=venue["venue_name"].lower()
  experiences.append({"venue_id":vid,"arrival_day":day,"arrival_night":night,"arrival_weekend":f"Weekend activity changes the usual rhythm at the {label}. {day}","arrival_event_day":event,"intro_1":"The {role} finishes what they are doing and gives you a careful look.","intro_2":"After a brief explanation, the {role} agrees to answer a few questions.","intro_3":"The {role} lowers their voice before describing the traveller.","wait_event":waiting,"investigation_event":f"You spend a few minutes observing the {label} before choosing whom to approach.","event_minutes":"10"})
 venue_profiles=[]
 for hub in hubs:
  state=hub["state"];boosts=STATE_BOOSTS[state]
  for venue in venues:
   vid=venue["venue_id"];weight=boosts.get(vid,BASE_WEIGHTS.get(vid,0))
   reason="state-specific priority" if vid in boosts and weight else "general investigative venue" if weight else "not a normal clue venue for this state"
   display=NAME_TEMPLATES[vid].format(state=state,hub=hub["hub_city"])
   venue_profiles.append({"state":state,"venue_id":vid,"available":"yes" if weight else "no","suitability_weight":weight,"display_name":display if weight else "","review_status":"reviewed_2026-10-06","reason":reason})
 write(OUT/"state-hubs.csv",hubs);write(OUT/"state-travel.csv",travel);write(OUT/"venues.csv",venues);write(OUT/"venue-experiences.csv",experiences);write(OUT/"state-venue-profiles.csv",venue_profiles);write(OUT/"thief-profiles.csv",profiles)
 print(f"Created {len(hubs)} hubs, {len(travel)} routes, {len(venues)} venues, {len(experiences)} venue experiences, {len(venue_profiles)} state-venue rules and {len(profiles)} profiles")
if __name__=="__main__":main()
