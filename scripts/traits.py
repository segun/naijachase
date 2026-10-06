import pandas as pd, json, re

from pathlib import Path

# 100 thieves: Nigerian-inspired names/aliases, deliberately fictional.

thieves = [

("NG-T001","Babatunde Adeyemi","The Professor","Ibadan","Oyo","artifact_theft",["meticulous","arrogant","historian","superstitious","impatient"]),

("NG-T002","Amaka Nwosu","Red Viper","Enugu","Enugu","smuggling",["calculating","charismatic","paranoid","resourceful","vengeful"]),

("NG-T003","Sani Bello","The Cartographer","Kano","Kano","fraud",["observant","quiet","geography_nerd","cautious","competitive"]),

("NG-T004","Ifeoma Okeke","Madam Midnight","Onitsha","Anambra","art_theft",["elegant","patient","secretive","perfectionist","risk_taker"]),

("NG-T005","Kunle Balogun","The Locksmith","Lagos","Lagos","heist",["technical","methodical","introverted","curious","stubborn"]),

("NG-T006","Zainab Musa","The Falcon","Kaduna","Kaduna","espionage",["disciplined","alert","patriotic","deceptive","adaptable"]),

("NG-T007","Chinedu Eze","Doctor Eze","Aba","Abia","fraud",["persuasive","educated","vain","improviser","empathetic"]),

("NG-T008","Halima Yusuf","The Broker","Abuja","FCT","political_intrigue",["connected","calculating","patient","discreet","ambitious"]),

("NG-T009","Tunde Akinwale","Blue Suit","Lagos","Lagos","cybercrime",["polished","tech_savvy","cocky","restless","opportunistic"]),

("NG-T010","Ngozi Ibekwe","The Collector","Benin City","Edo","antiquities",["cultured","obsessive","wealthy","secretive","superstitious"]),

("NG-T011","Musa Abdullahi","The Drifter","Sokoto","Sokoto","smuggling",["nomadic","resourceful","calm","unpredictable","streetwise"]),

("NG-T012","Yetunde Ajayi","The Curator","Lagos","Lagos","artifact_theft",["refined","knowledgeable","deceptive","patient","controlling"]),

("NG-T013","Emeka Umeh","Red Cap","Owerri","Imo","kidnapping",["commanding","loyal","volatile","strategic","proud"]),

("NG-T014","Aisha Garba","The Whisper","Katsina","Katsina","espionage",["soft_spoken","observant","patient","manipulative","fearless"]),

("NG-T015","Femi Oladipo","The Magician","Osogbo","Osun","con_art",["showman","quick_witted","charming","superstitious","improviser"]),

("NG-T016","Maryam Ibrahim","The Archivist","Zaria","Kaduna","historical_theft",["bookish","meticulous","reserved","nostalgic","possessive"]),

("NG-T017","Kelechi Obi","Switch","Port Harcourt","Rivers","identity_fraud",["adaptable","tech_savvy","deceptive","restless","playful"]),

("NG-T018","Yemi Lawal","The Undertaker","Ilorin","Kwara","murder",["grim","patient","methodical","cold","observant"]),

("NG-T019","Fatima Sule","Silver Fox","Jos","Plateau","heist",["clever","patient","elegant","skeptical","risk_taker"]),

("NG-T020","Chukwudi Nnamdi","The Mechanic","Nnewi","Anambra","vehicle_theft",["hands_on","inventive","loyal","impatient","pragmatic"]),

("NG-T021","Bisi Adebayo","The Diplomat","Abeokuta","Ogun","political_intrigue",["diplomatic","calculated","charming","ambitious","secretive"]),

("NG-T022","Haruna Yakubu","The Shepherd","Maiduguri","Borno","smuggling",["resilient","cautious","quiet","resourceful","protective"]),

("NG-T023","Adaeze Chukwu","Black Orchid","Calabar","Cross River","art_theft",["stylish","patient","romantic","deceptive","perfectionist"]),

("NG-T024","Taiwo Fasina","The Gambler","Lagos","Lagos","fraud",["risk_taker","mathematical","charming","impulsive","competitive"]),

("NG-T025","Abdulrahman Lawan","The Strategist","Bauchi","Bauchi","heist",["strategic","disciplined","patient","analytical","proud"]),

("NG-T026","Ronke Afolabi","The Journalist","Akure","Ondo","blackmail",["inquisitive","persistent","sociable","cynical","resourceful"]),

("NG-T027","Ikenna Maduka","The Surgeon","Enugu","Enugu","murder",["precise","cold","educated","perfectionist","detached"]),

("NG-T028","Safiya Danjuma","The Diplomat's Daughter","Abuja","FCT","espionage",["privileged","cultured","manipulative","restless","fearless"]),

("NG-T029","Segun Martins","The DJ","Lagos","Lagos","smuggling",["social","musical","restless","observant","opportunistic"]),

("NG-T030","Rashida Ahmed","The Botanist","Kano","Kano","poisoning",["scientific","patient","quiet","curious","vengeful"]),

("NG-T031","Obinna Eze","The Architect","Awka","Anambra","heist",["spatial","meticulous","creative","introverted","stubborn"]),

("NG-T032","Folake Shittu","The Socialite","Lagos","Lagos","fraud",["glamorous","connected","persuasive","vain","calculating"]),

("NG-T033","Usman Ibrahim","The Nomad","Gusau","Zamfara","smuggling",["adaptable","resilient","cautious","independent","streetwise"]),

("NG-T034","Nneka Ekwueme","The Historian","Nsukka","Enugu","artifact_theft",["academic","idealistic","obsessive","patient","proud"]),

("NG-T035","Jide Alabi","The Locksmith II","Ibadan","Oyo","burglary",["technical","quiet","patient","inventive","cautious"]),

("NG-T036","Amina Bello","The Negotiator","Sokoto","Sokoto","kidnapping",["calm","persuasive","strategic","empathetic","controlling"]),

("NG-T037","Deji Ogunleye","The Runner","Lagos","Lagos","courier",["fast","restless","streetwise","loyal","impulsive"]),

("NG-T038","Chioma Okoro","The Actress","Port Harcourt","Rivers","identity_fraud",["dramatic","charismatic","adaptable","vain","observant"]),

("NG-T039","Kabiru Umar","The Falconer","Kano","Kano","poaching",["patient","traditionalist","observant","resilient","secretive"]),

("NG-T040","Tosin Bamgbose","The Banker","Lagos","Lagos","financial_fraud",["numerate","polished","ambitious","paranoid","greedy"]),

("NG-T041","Blessing Eze","The Nurse","Benin City","Edo","poisoning",["empathetic","precise","secretive","patient","resentful"]),

("NG-T042","Ibrahim Danladi","The Fixer","Abuja","FCT","political_intrigue",["connected","pragmatic","discreet","resourceful","cynical"]),

("NG-T043","Temitope Akin","The Photographer","Lagos","Lagos","blackmail",["observant","artistic","patient","curious","opportunistic"]),

("NG-T044","Ogechi Nwankwo","The Seamstress","Aba","Abia","smuggling",["precise","creative","patient","frugal","secretive"]),

("NG-T045","Suleiman Abba","The Professor","Zaria","Kaduna","academic_theft",["intellectual","arrogant","meticulous","competitive","absent_minded"]),

("NG-T046","Kemi Fashola","The Banker’s Widow","Lagos","Lagos","financial_fraud",["elegant","calculating","patient","resentful","persuasive"]),

("NG-T047","Victor Nwachukwu","The Pilot","Owerri","Imo","smuggling",["adventurous","calm","technical","confident","restless"]),

("NG-T048","Sarah Bassey","The Diver","Calabar","Cross River","salvage_theft",["fearless","patient","physical","curious","secretive"]),

("NG-T049","Dare Akintola","The Comedian","Ibadan","Oyo","con_art",["funny","charming","improviser","observant","reckless"]),

("NG-T050","Hauwa Mohammed","The Librarian","Kano","Kano","information_theft",["quiet","bookish","meticulous","patient","suspicious"]),

("NG-T051","Nnamdi Okafor","The Prince","Benin City","Edo","antiquities",["proud","cultured","entitled","strategic","superstitious"]),

("NG-T052","Shade Akinyemi","The Florist","Abeokuta","Ogun","poisoning",["gentle","scientific","secretive","patient","vengeful"]),

("NG-T053","Mubarak Isah","The Trader","Kano","Kano","smuggling",["commercial","calculating","sociable","risk_taker","resourceful"]),

("NG-T054","Ejiro Okoro","The Fisherman","Warri","Delta","smuggling",["patient","practical","quiet","resilient","superstitious"]),

("NG-T055","Lola Martins","The Stylist","Lagos","Lagos","identity_fraud",["fashionable","social","observant","manipulative","perfectionist"]),

("NG-T056","Yakubu Saleh","The Tracker","Jos","Plateau","kidnapping",["observant","patient","physical","quiet","methodical"]),

("NG-T057","Chisom Nwafor","The Hacker","Enugu","Enugu","cybercrime",["technical","introverted","curious","cocky","restless"]),

("NG-T058","Adewale Oni","The Priest","Ile-Ife","Osun","artifact_theft",["mysterious","cultured","patient","superstitious","persuasive"]),

("NG-T059","Mariam Shehu","The Mathematician","Maiduguri","Borno","financial_fraud",["analytical","patient","precise","quiet","competitive"]),

("NG-T060","Rotimi Bamidele","The Broker II","Lagos","Lagos","blackmail",["connected","charming","calculating","paranoid","ambitious"]),

("NG-T061","Esther Ekanem","The Historian II","Calabar","Cross River","artifact_theft",["academic","curious","patient","idealistic","secretive"]),

("NG-T062","Garba Sani","The Courier","Kaduna","Kaduna","smuggling",["fast","disciplined","loyal","cautious","restless"]),

("NG-T063","Nkiru Obi","The Chess Player","Owerri","Imo","heist",["strategic","patient","competitive","logical","proud"]),

("NG-T064","Samuel Adekunle","The Preacher","Ilorin","Kwara","con_art",["charismatic","persuasive","dramatic","observant","manipulative"]),

("NG-T065","Rukayat Bello","The Collector II","Katsina","Katsina","antiquities",["obsessive","cultured","patient","wealthy","secretive"]),

("NG-T066","Femi Aro","The Carpenter","Osogbo","Osun","burglary",["hands_on","patient","inventive","quiet","practical"]),

("NG-T067","Juliet Nwosu","The Banker","Enugu","Enugu","financial_fraud",["numerate","polished","ambitious","cautious","deceptive"]),

("NG-T068","Yahaya Musa","The Guide","Jos","Plateau","smuggling",["knowledgeable","friendly","observant","resourceful","cautious"]),

("NG-T069","Morenike Adeola","The Heiress","Lagos","Lagos","fraud",["privileged","vain","intelligent","reckless","persuasive"]),

("NG-T070","Emmanuel Etim","The Diver II","Calabar","Cross River","salvage_theft",["fearless","patient","physical","quiet","curious"]),

("NG-T071","Aisha Sule","The Tailor","Kano","Kano","identity_fraud",["precise","creative","secretive","patient","observant"]),

("NG-T072","Kunle Ajibade","The Historian III","Ibadan","Oyo","artifact_theft",["bookish","arrogant","nostalgic","meticulous","competitive"]),

("NG-T073","Ngozi Nkem","The Negotiator II","Aba","Abia","kidnapping",["persuasive","calm","strategic","empathetic","controlling"]),

("NG-T074","Sadiq Umar","The Smuggler","Sokoto","Sokoto","smuggling",["streetwise","cautious","resourceful","patient","greedy"]),

("NG-T075","Damilola Femi","The Influencer","Lagos","Lagos","fraud",["social","vain","persuasive","restless","opportunistic"]),

("NG-T076","Chukwuemeka Ibe","The Engineer","Enugu","Enugu","heist",["technical","logical","meticulous","introverted","stubborn"]),

("NG-T077","Hadiza Garba","The Archivist II","Zaria","Kaduna","information_theft",["bookish","patient","secretive","nostalgic","possessive"]),

("NG-T078","Tajudeen Yusuf","The Falcon II","Kano","Kano","espionage",["alert","disciplined","quiet","deceptive","fearless"]),

("NG-T079","Abisola Kuti","The Singer","Abeokuta","Ogun","blackmail",["musical","charismatic","observant","social","vengeful"]),

("NG-T080","Bassey Duke","The Governor","Calabar","Cross River","political_intrigue",["commanding","ambitious","connected","calculating","proud"]),

("NG-T081","Oluwaseun Taiwo","The Driver","Lagos","Lagos","courier",["streetwise","observant","calm","loyal","impatient"]),

("NG-T082","Fatima Aliyu","The Scientist","Abuja","FCT","poisoning",["analytical","precise","curious","secretive","perfectionist"]),

("NG-T083","Uche Madu","The Collector III","Onitsha","Anambra","antiquities",["obsessive","commercial","cultured","greedy","patient"]),

("NG-T084","Bolanle Seyi","The Actress II","Lagos","Lagos","identity_fraud",["dramatic","adaptable","charming","observant","deceptive"]),

("NG-T085","Murtala Abdullahi","The Veteran","Kano","Kano","heist",["disciplined","strategic","patient","resilient","proud"]),

("NG-T086","Adaobi Eze","The Botanist II","Nsukka","Enugu","poisoning",["scientific","quiet","curious","patient","resentful"]),

("NG-T087","Yusuf Ibrahim","The Trader II","Katsina","Katsina","smuggling",["commercial","calculating","social","risk_taker","resourceful"]),

("NG-T088","Tolu Adebisi","The Magician II","Ibadan","Oyo","con_art",["showman","quick_witted","charming","reckless","improviser"]),

("NG-T089","Grace Okon","The Journalist II","Uyo","Akwa Ibom","blackmail",["inquisitive","persistent","sociable","cynical","brave"]),

("NG-T090","Ishaq Bello","The Locksmith III","Kaduna","Kaduna","burglary",["technical","methodical","quiet","patient","cautious"]),

("NG-T091","Chiamaka Obi","The Socialite II","Port Harcourt","Rivers","fraud",["glamorous","connected","persuasive","competitive","calculating"]),

("NG-T092","Fatai Lawal","The Undertaker II","Ilorin","Kwara","murder",["grim","cold","methodical","patient","observant"]),

("NG-T093","Amina Yusuf","The Tracker II","Jos","Plateau","kidnapping",["observant","patient","physical","quiet","protective"]),

("NG-T094","Daniel Okoro","The Mechanic II","Nnewi","Anambra","vehicle_theft",["inventive","hands_on","pragmatic","impatient","loyal"]),

("NG-T095","Seyi Balogun","The Hacker II","Lagos","Lagos","cybercrime",["technical","curious","cocky","restless","competitive"]),

("NG-T096","Maryam Suleiman","The Librarian II","Sokoto","Sokoto","information_theft",["quiet","bookish","meticulous","patient","suspicious"]),

("NG-T097","Kola Akin","The Gambler II","Lagos","Lagos","fraud",["risk_taker","mathematical","charming","impulsive","competitive"]),

("NG-T098","Rahila Danjuma","The Whisper II","Katsina","Katsina","espionage",["soft_spoken","observant","patient","manipulative","fearless"]),

("NG-T099","Chinedu Nwankwo","The Architect II","Awka","Anambra","heist",["spatial","creative","meticulous","introverted","stubborn"]),

("NG-T100","Titi Afolayan","The Fox","Lagos","Lagos","master_thief",["clever","patient","charismatic","paranoid","adaptable"]),

]

# Trait catalog: 100 distinct traits, 5 assigned per thief = 500 trait occurrences.

trait_defs = {

"meticulous":"Checks details repeatedly and rarely leaves careless evidence.",

"arrogant":"Believes they are intellectually superior to investigators.",

"historian":"Knows historical facts and enjoys using them as clues.",

"superstitious":"Avoids actions or places associated with personal omens.",

"impatient":"Makes mistakes when forced to wait or improvise slowly.",

"calculating":"Considers several outcomes before making a move.",

"charismatic":"Naturally wins trust and attention from strangers.",

"paranoid":"Assumes others are watching and constantly changes plans.",

"resourceful":"Can improvise useful solutions from limited resources.",

"vengeful":"Remembers perceived slights and seeks payback.",

"observant":"Notices small environmental and behavioral details.",

"quiet":"Speaks little and reveals very little voluntarily.",

"geography_nerd":"Has unusually strong knowledge of Nigerian geography.",

"cautious":"Avoids unnecessary exposure and prefers safer routes.",

"competitive":"Treats the investigation as a contest to win.",

"elegant":"Maintains a polished appearance even while committing crimes.",

"patient":"Will wait as long as necessary for the right opportunity.",

"secretive":"Reveals information only when absolutely necessary.",

"perfectionist":"Will delay an operation rather than accept imperfect execution.",

"risk_taker":"Accepts substantial danger when the reward is attractive.",

"technical":"Comfortable with locks, electronics, machinery, or systems.",

"methodical":"Follows repeatable procedures and checklists.",

"introverted":"Prefers working alone and avoids unnecessary social contact.",

"curious":"Investigates interesting objects, people, and places even when risky.",

"stubborn":"Refuses to abandon a plan once committed to it.",

"disciplined":"Maintains strict routines and self-control.",

"alert":"Constantly monitors surroundings for threats.",

"patriotic":"Has a strong attachment to Nigeria that influences choices.",

"deceptive":"Comfortable lying convincingly when necessary.",

"adaptable":"Changes tactics quickly when circumstances shift.",

"persuasive":"Can influence people through argument or emotional appeal.",

"educated":"Has broad formal knowledge and uses it strategically.",

"vain":"Cares deeply about appearance, reputation, or recognition.",

"improviser":"Performs well without a prepared plan.",

"empathetic":"Reads emotions well and can exploit or respond to them.",

"connected":"Has a wide network of useful contacts.",

"discreet":"Avoids drawing attention and keeps transactions quiet.",

"ambitious":"Wants increasing wealth, influence, or status.",

"polished":"Presents a credible professional image.",

"tech_savvy":"Comfortable using modern digital tools.",

"cocky":"Underestimates opponents because of overconfidence.",

"restless":"Struggles to stay in one place for long.",

"opportunistic":"Quickly exploits unexpected openings.",

"cultured":"Knows art, heritage, etiquette, and cultural history.",

"obsessive":"Becomes intensely focused on a particular goal or object.",

"wealthy":"Has legitimate resources that make unusual movements less suspicious.",

"nomadic":"Comfortable moving frequently between locations.",

"unpredictable":"Does not consistently follow recognizable patterns.",

"streetwise":"Understands informal networks, local habits, and urban survival.",

"refined":"Has sophisticated tastes and social manners.",

"controlling":"Wants other people and circumstances to follow their plan.",

"commanding":"Naturally assumes leadership in groups.",

"volatile":"Can react suddenly and intensely under pressure.",

"strategic":"Plans several moves ahead rather than acting impulsively.",

"proud":"Strongly protects personal reputation and dignity.",

"soft_spoken":"Uses a calm, quiet voice that encourages people to listen.",

"manipulative":"Steers people toward decisions that benefit them.",

"fearless":"Shows little hesitation in dangerous situations.",

"showman":"Enjoys spectacle, performance, and theatrical reveals.",

"quick_witted":"Generates clever responses rapidly under pressure.",

"bookish":"Spends substantial time reading and researching.",

"reserved":"Keeps emotional reactions private.",

"nostalgic":"Has a strong attachment to the past.",

"possessive":"Treats selected objects, places, or people as personal property.",

"dramatic":"Uses emotion and theatrical behavior to influence others.",

"playful":"Treats serious situations like games.",

"grim":"Has a bleak outlook and little concern for appearances.",

"cold":"Keeps emotional distance, especially during stressful events.",

"detached":"Separates personal feelings from decisions.",

"clever":"Finds unconventional solutions to difficult problems.",

"skeptical":"Questions claims until evidence supports them.",

"hands_on":"Prefers physical tools and practical work.",

"inventive":"Creates new methods rather than relying on standard ones.",

"loyal":"Protects trusted associates even when costly.",

"pragmatic":"Chooses what works rather than what sounds ideal.",

"social":"Comfortable meeting and talking to strangers.",

"musical":"Uses music and performance as part of identity or cover.",

"traditionalist":"Values customs and established practices.",

"numerate":"Highly comfortable with numbers and financial calculations.",

"greedy":"Will accept additional risk for more money.",

"empathetic":"Reads emotional states unusually well.",

"idealistic":"Believes strongly in a personal cause or principle.",

"academic":"Approaches problems like research questions.",

"reckless":"Acts quickly without fully considering consequences.",

"mathematical":"Uses probability, numbers, and patterns naturally.",

"frugal":"Avoids unnecessary spending and wastes little.",

"spatial":"Strong at understanding buildings, routes, layouts, and distances.",

"privileged":"Has social or financial advantages that open doors.",

"independent":"Dislikes relying on others and prefers self-sufficiency.",

"physical":"Relies on stamina, strength, or athletic ability.",

"commercial":"Thinks naturally in terms of markets, prices, and trade.",

"scientific":"Prefers evidence, experiments, and measurable explanations.",

"gentle":"Appears harmless and non-threatening to strangers.",

"mysterious":"Cultivates ambiguity around identity and motives.",

"knowledgeable":"Has broad factual knowledge beyond a single specialty.",

"friendly":"Builds rapport quickly and appears approachable.",

"mathematical":"Naturally spots numerical relationships and patterns.",

"professional":"Maintains a credible workplace persona under scrutiny.",

"socially_connected":"Uses broad social networks to obtain information.",

"brave":"Willing to face danger rather than retreat.",

"fast":"Moves quickly and dislikes slow plans.",

"traditional":"Prefers familiar customs and established routines.",

"scientific_minded":"Tests assumptions rather than accepting folklore.",

"commercial_minded":"Constantly evaluates opportunities in terms of value.",

"book_collector":"Collects rare books and documents.",

"artifact_obsessed":"Has an unusually strong fixation on historical objects.",

"identity_shifter":"Comfortable maintaining multiple believable identities.",

"route_planner":"Naturally maps journeys and contingency routes.",

"alibi_builder":"Plans explanations for their whereabouts in advance.",

"memory_expert":"Remembers names, faces, dates, and conversations unusually well.",

"accent_mimic":"Can imitate regional speech patterns convincingly.",

"foodie":"Uses restaurants and food culture as social cover.",

"night_owl":"Prefers operating late at night.",

"early_riser":"Often begins activities before most people are awake.",

"collector":"Acquires unusual objects and dislikes giving them up.",

"museum_lover":"Knows museums, galleries, and heritage sites well.",

"codebreaker":"Enjoys solving codes, patterns, and puzzles.",

"lockpick_fan":"Treats locks as puzzles rather than barriers.",

"map_reader":"Comfortable navigating without digital directions.",

"local_guide":"Knows practical details of places beyond tourist facts.",

"linguist":"Learns and switches between languages or dialects easily.",

"photographic_memory":"Recalls visual layouts and faces with unusual accuracy.",

"status_seeker":"Wants recognition and social elevation.",

"secret_hoarder":"Collects information that could be useful later.",

"deal_maker":"Prefers negotiation over confrontation.",

"bluffer":"Can maintain a false story under pressure.",

"risk_manager":"Takes risks only after estimating likely outcomes.",

"escape_artist":"Specializes in disappearing when a plan collapses.",

"patient_stalker":"Can quietly monitor a target for extended periods.",

"false_lead_specialist":"Enjoys planting believable but misleading evidence.",

"clue_collector":"Keeps notes about clues, routes, and investigators.",

"investigator_aware":"Studies how investigators think and react.",

}

# Deduplicate accidental duplicate definitions and build ordered catalog.

trait_defs = {k:v for k,v in trait_defs.items()}

trait_rows = []

for tid, (name, alias, city, state, crime, traits) in enumerate(

    [(x[1],x[2],x[3],x[4],x[5],x[6]) for x in thieves], start=1

):

    for slot, trait in enumerate(traits, start=1):

        trait_rows.append({

            "trait_instance_id": f"TR-{tid:03d}-{slot}",

            "thief_id": thieves[tid-1][0],

            "trait_slot": slot,

            "trait_key": trait,

            "trait_description": trait_defs.get(trait, "Behavioral trait used by the game engine.")

        })

thief_rows = []

for tid, name, alias, city, state, crime, traits in thieves:

    thief_rows.append({

        "thief_id": tid,

        "name": name,

        "alias": alias,

        "origin_city": city,

        "origin_state": state,

        "primary_crime": crime,

        "traits": ", ".join(traits),

        "trait_1": traits[0],

        "trait_2": traits[1],

        "trait_3": traits[2],

        "trait_4": traits[3],

        "trait_5": traits[4],

        "difficulty": 1 + (int(tid[-3:]) % 5)

    })

catalog_rows = [{"trait_key":k, "description":v} for k,v in trait_defs.items()]

df_thieves = pd.DataFrame(thief_rows)

df_instances = pd.DataFrame(trait_rows)

df_catalog = pd.DataFrame(catalog_rows)

# Save files in the project's active dataset structure.

project_root = Path(__file__).resolve().parent.parent
thieves_out = project_root / "data" / "thieves"
bundles_out = project_root / "data" / "bundles"
thieves_out.mkdir(parents=True, exist_ok=True)
bundles_out.mkdir(parents=True, exist_ok=True)

df_thieves.to_csv(thieves_out / "thieves.csv", index=False)

df_instances.to_csv(thieves_out / "trait-assignments.csv", index=False)

df_catalog.to_csv(thieves_out / "trait-catalog.csv", index=False)

payload = {

    "version": "0.1",

    "description": "Fictional Nigerian mystery-game thieves and behavioral traits.",

    "thieves": [

        {

            "thief_id": r["thief_id"],

            "name": r["name"],

            "alias": r["alias"],

            "origin_city": r["origin_city"],

            "origin_state": r["origin_state"],

            "primary_crime": r["primary_crime"],

            "traits": [r[f"trait_{i}"] for i in range(1,6)],

            "difficulty": int(r["difficulty"])

        } for _,r in df_thieves.iterrows()

    ],

    "trait_catalog": trait_defs

}

(bundles_out / "thieves-content-pack.json").write_text(
    json.dumps(payload, indent=2, ensure_ascii=False)
)

# Validation

assert len(df_thieves) == 100

assert len(df_instances) == 500

assert all(df_thieves[[f"trait_{i}" for i in range(1,6)]].notna().all())

assert all(df_thieves[[f"trait_{i}" for i in range(1,6)]].nunique(axis=1) == 5)

print(f"Created: {len(df_thieves)} thieves, {len(df_instances)} trait assignments, {len(df_catalog)} unique trait definitions.")

print("\nSample:")

print(df_thieves.head(10).to_string(index=False))

print("\nFiles:")

print(thieves_out / "thieves.csv")

print(thieves_out / "trait-assignments.csv")

print(thieves_out / "trait-catalog.csv")

print(bundles_out / "thieves-content-pack.json")
