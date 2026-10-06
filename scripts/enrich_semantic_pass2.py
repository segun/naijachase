"""Second semantic pass: deeper history, living heritage, people, nature and states."""
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
K = ROOT / "data/knowledge/knowledge.csv"
C = ROOT / "data/clues/clue-formulations.csv"
R = ROOT / "data/knowledge/location-knowledge-relations.csv"
L = ROOT / "data/locations/locations.csv"

SRC = {
    "MFA": "https://foreignaffairs.gov.ng/nigeria/history-of-nigeria/",
    "LOC": "https://tile.loc.gov/storage-services/master/frd/frdcstdy/ni/nigeriacountryst00metz_0/nigeriacountryst00metz_0.pdf",
    "CIVIL": "https://nigeriareposit.nln.gov.ng/handle/20.500.14186/1349",
    "ICH": "https://ich.unesco.org/en/state/nigeria-NG?info=elements-on-the-lists",
    "NPS": "https://nigeriaparkservice.gov.ng/about-us/",
    "FAO": "https://www.fao.org/nigeria/fao-in-nigeria/nigeria-at-a-glance/en/",
    "NIPC": "https://nipc.gov.ng/nigeria-states/",
    "NLN": "https://nigeriareposit.nln.gov.ng/",
}

# domain<TAB>topic<TAB>location hint<TAB>source key or URL<TAB>fact<TAB>answer<TAB>difficulty
RAW = r"""
history	civil_war	Enugu	CIVIL	The Eastern Region proclaimed the independent Republic of Biafra on 30 May 1967.	30 May 1967	2
history	civil_war	Enugu	CIVIL	The Nigerian Civil War began in July 1967.	July 1967	1
history	civil_war	Enugu	CIVIL	The Nigerian Civil War ended in January 1970.	January 1970	1
history	civil_war	Enugu	CIVIL	Enugu served as Biafra's initial capital.	Enugu	1
history	civil_war	Umuahia	CIVIL	Umuahia became a major administrative centre for Biafra after Enugu fell.	Umuahia	2
history	civil_war	Owerri	CIVIL	Owerri was one of the principal cities contested during the Nigerian Civil War.	Owerri	2
history	civil_war	Port Harcourt	LOC	Federal forces captured Port Harcourt in 1968, cutting Biafra off from a major seaport.	1968	3
history	civil_war	Abuja	LOC	Yakubu Gowon led Nigeria's Federal Military Government during the civil war.	Yakubu Gowon	1
history	civil_war	Enugu	LOC	Chukwuemeka Odumegwu Ojukwu led the secessionist Republic of Biafra.	Chukwuemeka Odumegwu Ojukwu	1
history	civil_war	Abuja	LOC	Nigeria replaced its four regions with twelve states in 1967.	Twelve states	2
history	civil_war	Enugu	LOC	The civil war produced a major humanitarian crisis, including widespread hunger in Biafra.	Humanitarian crisis	2
history	civil_war	Abuja	LOC	After the war, the federal government promoted reconstruction, rehabilitation and reconciliation.	Three Rs	3
history	kingdoms_empires	Maiduguri	MFA	The Kanem-Borno state tradition developed around Lake Chad.	Lake Chad	1
history	kingdoms_empires	Maiduguri	MFA	The title Mai was used by rulers in the Kanem-Borno imperial tradition.	Mai	2
history	kingdoms_empires	Maiduguri	MFA	Borno became an important centre of trans-Saharan trade and Islamic learning.	Borno	2
history	kingdoms_empires	Kano	LOC	Kano was one of the Hausa Bakwai, the seven traditional Hausa states.	Hausa Bakwai	3
history	kingdoms_empires	Katsina	LOC	Katsina developed as a historic Hausa trading and learning centre.	Katsina	2
history	kingdoms_empires	Zaria	LOC	Zazzau is the historic Hausa kingdom centred on present-day Zaria.	Zazzau	2
history	kingdoms_empires	Zaria	LOC	Queen Amina is associated with the sixteenth-century history of Zazzau.	Queen Amina	2
history	kingdoms_empires	Sokoto	LOC	The Sokoto Caliphate was founded through the jihad led by Usman dan Fodio.	Usman dan Fodio	1
history	kingdoms_empires	Sokoto	LOC	The Sultan of Sokoto became the senior authority within the caliphate.	Sultan of Sokoto	2
history	kingdoms_empires	Ilorin	LOC	Ilorin became an emirate on the southern frontier of the Sokoto Caliphate.	Ilorin	3
history	kingdoms_empires	Ile-Ife	LOC	Yoruba traditions regard Ile-Ife as an ancestral centre of civilization.	Ile-Ife	1
history	kingdoms_empires	Ibadan	LOC	The ruler of the Oyo Empire bore the title Alaafin.	Alaafin	1
history	kingdoms_empires	Ibadan	LOC	Oyo-Ile was the historic capital of the Oyo Empire.	Oyo-Ile	1
history	kingdoms_empires	Benin City	LOC	The Kingdom of Benin was centred on Benin City, not the modern Republic of Benin.	Benin City	2
history	kingdoms_empires	Benin City	LOC	The walls and earthworks around Benin formed an extensive defensive landscape.	Earthworks	2
history	kingdoms_empires	Onitsha	MFA	Many communities east of the Niger historically organized political life through autonomous towns and villages.	Autonomous communities	3
history	kingdoms_empires	Calabar	MFA	Old Calabar developed around Efik trading communities near the Cross River estuary.	Efik	2
history	kingdoms_empires	Warri	MFA	The Olu is the traditional ruler of the Itsekiri Kingdom of Warri.	Olu	2
history	kingdoms_empires	Arochukwu LGA	MFA	Arochukwu became influential through trade and the Ibini Ukpabi oracle network.	Ibini Ukpabi	3
culture	intangible_heritage	Kano	ICH	UNESCO inscribed Durbar in Kano on the Representative List of Intangible Cultural Heritage in 2024.	2024	2
culture	intangible_heritage	Kano	ICH	Durbar in Kano features equestrian processions, music and allegiance to the emir.	Equestrian processions	2
culture	intangible_heritage	Ibadan	ICH	UNESCO inscribed the Sango Festival of Oyo on its Representative List in 2023.	2023	2
culture	intangible_heritage	Ibadan	ICH	The Sango Festival marks the Yoruba traditional New Year in August.	August	2
culture	intangible_heritage	Ibadan	ICH	The Sango Festival commemorates Tella-Oko, remembered as the third Alaafin of Oyo.	Tella-Oko	3
culture	intangible_heritage	Makurdi	ICH	UNESCO inscribed Kwagh-Hir theatrical performance on its Representative List in 2019.	2019	2
culture	intangible_heritage	Makurdi	ICH	Kwagh-Hir is a Tiv theatrical tradition combining puppetry, masquerade, music and dance.	Tiv	2
culture	intangible_heritage	Argungu	ICH	UNESCO inscribed the Argungu fishing and cultural festival on its Representative List in 2016.	2016	2
culture	intangible_heritage	Argungu	ICH	The Argungu festival culminates in a fishing competition in Kebbi State.	Fishing competition	1
culture	intangible_heritage	Onitsha	ICH	UNESCO inscribed the Ijele masquerade on its Representative List in 2009.	2009	2
culture	intangible_heritage	Onitsha	ICH	Ijele is a monumental masquerade tradition of communities in Anambra State.	Anambra	2
culture	intangible_heritage	Abeokuta	ICH	UNESCO inscribed the oral heritage of Gelede on its Representative List in 2008.	2008	2
culture	intangible_heritage	Abeokuta	ICH	Gelede performances honour the social and spiritual power of women in Yoruba communities.	Women	2
culture	intangible_heritage	Ile-Ife	ICH	UNESCO inscribed the Ifa divination system on its Representative List in 2008.	2008	2
culture	intangible_heritage	Ile-Ife	ICH	Ifa divination uses a large corpus of orally transmitted poetic texts called odu.	Odu	3
culture	festival	Onitsha	ICH	The Ofala festival celebrates the annual public emergence of an Igbo traditional ruler.	Ofala	2
culture	festival	Benin City	ICH	The Ugie festival cycle is associated with the court of the Oba of Benin.	Ugie	2
culture	festival	Lagos	ICH	The Eyo masquerade is a ceremonial tradition associated with Lagos Island.	Lagos Island	1
culture	festival	Uyo	ICH	Ekpe is a masquerade and society tradition found among Efik and Ibibio communities.	Ekpe	2
culture	festival	Owerri	ICH	New Yam festivals celebrate harvest, renewal and community in many southeastern communities.	Yam harvest	1
culture	textiles_crafts	Kano	ICH	Kano's historic dye pits are associated with indigo cloth production.	Indigo	1
culture	textiles_crafts	Abeokuta	ICH	Adire is a resist-dyed textile tradition strongly associated with Abeokuta.	Adire	1
culture	textiles_crafts	Aba	ICH	Akwete cloth is a woven textile tradition associated with southeastern Nigeria.	Akwete cloth	2
culture	textiles_crafts	Benin City	ICH	Benin court art is renowned for brass casting made by specialist guilds.	Brass casting	2
culture	literature	Enugu	https://www.britannica.com/biography/Chinua-Achebe	Chinua Achebe's Things Fall Apart centres on Igbo society during the colonial encounter.	Igbo society	2
culture	literature	Enugu	https://www.britannica.com/biography/Chinua-Achebe	Chinua Achebe also wrote Arrow of God and No Longer at Ease.	Chinua Achebe	2
culture	literature	Abeokuta	https://www.nobelprize.org/prizes/literature/1986/soyinka/facts/	Wole Soyinka received the 1986 Nobel Prize in Literature.	1986	1
culture	literature	Abeokuta	https://www.nobelprize.org/prizes/literature/1986/soyinka/facts/	Wole Soyinka wrote plays, poetry, essays and memoirs.	Wole Soyinka	1
culture	literature	Minna	https://www.britannica.com/biography/Ben-Okri	Ben Okri wrote the Booker Prize-winning novel The Famished Road.	The Famished Road	2
culture	literature	Lagos	https://www.britannica.com/biography/Buchi-Emecheta	Buchi Emecheta wrote The Joys of Motherhood.	Buchi Emecheta	2
culture	literature	Port Harcourt	NLN	Elechi Amadi wrote the novel The Concubine.	Elechi Amadi	2
culture	literature	Kano	https://www.britannica.com/biography/Abubakar-Imam	Abubakar Imam was an influential Hausa-language writer and editor.	Hausa	3
culture	music	Lagos	https://www.britannica.com/biography/Fela-Kuti	Fela Kuti's Afrobeat fused Nigerian musical traditions with jazz and funk.	Afrobeat	1
culture	music	Lagos	https://www.britannica.com/biography/Fela-Kuti	Fela Kuti performed with bands including Africa 70 and Egypt 80.	Fela Kuti	2
culture	music	Lagos	https://www.britannica.com/biography/King-Sunny-Ade	King Sunny Ade is a major figure in Yoruba juju music.	Juju music	1
culture	music	Lagos	https://www.britannica.com/biography/Wizkid	Wizkid is a Nigerian singer associated with the global rise of Afrobeats.	Afrobeats	1
culture	music	Lagos	https://www.grammy.com/artists/burna-boy/251682	Burna Boy won a Grammy for the album Twice as Tall.	Twice as Tall	2
culture	music	Onitsha	ICH	Highlife became an influential popular music style across southern Nigeria.	Highlife	1
culture	music	Kano	ICH	Praise singing and percussion are important parts of Hausa court music.	Court music	2
culture	music	Calabar	ICH	Ekombi is a dance tradition associated with Efik culture.	Efik	2
ecology	national_parks	Bauchi	NPS	Yankari was delisted as a national park in 2006 and is managed as a game reserve by Bauchi State.	2006	3
ecology	national_parks	Akure	NPS	Okomu National Park protects lowland rainforest in Edo State.	Lowland rainforest	2
ecology	national_parks	Kaduna	NPS	Kamuku National Park is in Kaduna State.	Kaduna	1
ecology	national_parks	Maiduguri	NPS	Chad Basin National Park protects Sahel and wetland habitats in northeastern Nigeria.	Sahel and wetlands	2
ecology	national_parks	Ibadan	NPS	Old Oyo National Park preserves both savanna ecosystems and remains linked to the Oyo Empire.	Nature and history	2
ecology	national_parks	Abuja	NPS	Nigeria's National Park Service began in 1991 with five national parks.	1991	2
ecology	rivers	Lokoja	FAO	The Niger and Benue rivers meet at Lokoja.	Lokoja	1
ecology	rivers	Yola	FAO	The Benue River enters Nigeria from Cameroon.	Cameroon	2
ecology	rivers	Sokoto	FAO	The Sokoto River is a tributary within the wider Niger basin.	Niger basin	2
ecology	rivers	Makurdi	FAO	Makurdi stands on the banks of the Benue River.	Benue River	1
ecology	rivers	Onitsha	FAO	Onitsha lies on the eastern bank of the River Niger.	Eastern bank	1
ecology	rivers	Calabar	FAO	The Cross River flows into the Gulf of Guinea near Calabar.	Gulf of Guinea	2
ecology	rivers	Port Harcourt	FAO	The Niger Delta is formed by distributaries of the River Niger.	Distributaries	2
ecology	mountains	Gashaka Gumti National Park	https://whc.unesco.org/en/tentativelists/6918/	Gangriwal rises to about 2,419 metres and is Nigeria's highest point.	2,419 metres	2
ecology	mountains	Jos	NIPC	The Jos Plateau is an elevated region in central Nigeria.	Jos Plateau	1
ecology	mountains	Obudu Mountain Resort	NIPC	The Obudu Plateau lies in the highlands of Cross River State.	Cross River	1
ecology	wetlands	Dutse	FAO	The Hadejia-Nguru wetlands span parts of Jigawa and Yobe states.	Jigawa and Yobe	2
ecology	wetlands	Yenagoa	FAO	Bayelsa lies within the freshwater swamps and mangroves of the Niger Delta.	Niger Delta	1
ecology	forest	Calabar	NPS	The Oban Hills division of Cross River National Park contains tropical rainforest.	Tropical rainforest	1
economy	industry	Enugu	NIPC	Enugu's growth was historically linked to coal mining.	Coal	1
economy	industry	Jos	NIPC	Jos and the Plateau region became major centres of tin mining.	Tin	1
economy	industry	Port Harcourt	NIPC	Port Harcourt developed as a major centre for Nigeria's petroleum industry.	Petroleum	1
economy	industry	Warri	NIPC	Warri is a major petroleum and port centre in Delta State.	Petroleum and ports	1
economy	industry	Lokoja	NIPC	Ajaokuta is the location of Nigeria's major integrated steel complex.	Steel	1
economy	industry	Aba	NIPC	Aba is known for manufacturing, markets and small-scale enterprise.	Manufacturing	1
economy	industry	Kano	NIPC	Kano has long been a centre for trade, leatherwork and textiles.	Leatherwork and textiles	2
economy	industry	Onitsha	NIPC	Onitsha is home to one of West Africa's major commercial markets.	Commerce	1
economy	agriculture	Akure	FAO	Ondo State is one of Nigeria's major cocoa-producing areas.	Cocoa	1
economy	agriculture	Makurdi	FAO	Benue State is strongly associated with yam, cassava and other food crops.	Food crops	1
economy	agriculture	Calabar	FAO	Oil palm is an important crop in Nigeria's humid southern zone.	Oil palm	1
economy	agriculture	Kano	FAO	Groundnuts, millet and sorghum are associated with northern Nigerian farming.	Northern Nigeria	1
geography	state_identity	Umuahia	NIPC	Abia State is associated with Aba's manufacturing and the heritage of Arochukwu.	Abia	2
geography	state_identity	Yola	NIPC	Adamawa State contains part of Gashaka Gumti National Park and the Sukur Cultural Landscape.	Adamawa	2
geography	state_identity	Uyo	NIPC	Akwa Ibom is a coastal state with petroleum, fishing and palm-produce industries.	Akwa Ibom	2
geography	state_identity	Awka	NIPC	Anambra links the commercial city of Onitsha with the Ogbunike Caves heritage landscape.	Anambra	2
geography	state_identity	Bauchi	NIPC	Bauchi State is home to Yankari Game Reserve.	Bauchi	1
geography	state_identity	Yenagoa	NIPC	Bayelsa lies in the riverine core of the Niger Delta.	Bayelsa	1
geography	state_identity	Makurdi	NIPC	Benue State is named after the Benue River.	Benue River	1
geography	state_identity	Maiduguri	NIPC	Borno State is closely associated with the history of Kanem-Borno and the Lake Chad basin.	Borno	2
geography	state_identity	Calabar	NIPC	Cross River State combines rainforest, the Cross River estuary and the city of Calabar.	Cross River	1
geography	state_identity	Asaba	NIPC	Delta State spans part of the Niger Delta and includes the petroleum centre of Warri.	Delta	2
geography	state_identity	Abakaliki	NIPC	Ebonyi State is associated with rice farming and mineral resources including salt and limestone.	Ebonyi	2
geography	state_identity	Benin City	NIPC	Edo State contains Benin City, historic centre of the Kingdom of Benin.	Edo	1
geography	state_identity	Ado-Ekiti	NIPC	Ekiti State is known for its many hills and the Ikogosi warm and cold springs.	Ekiti	2
geography	state_identity	Enugu	NIPC	Enugu State's capital grew around the coal industry.	Coal	1
geography	state_identity	Gombe	NIPC	Gombe State lies in northeastern Nigeria near the Gongola River basin.	Gombe	2
geography	state_identity	Owerri	NIPC	Imo State lies in southeastern Nigeria and forms part of the palm-producing belt.	Imo	2
geography	state_identity	Dutse	NIPC	Jigawa State includes part of the Hadejia-Nguru wetland system.	Jigawa	2
geography	state_identity	Kaduna	NIPC	Kaduna State includes Zaria and archaeological areas associated with Nok culture.	Kaduna	2
geography	state_identity	Kano	NIPC	Kano State is a major commercial centre with a long history of textile and leather crafts.	Kano	1
geography	state_identity	Katsina	NIPC	Katsina State includes historic Hausa centres such as Katsina and Daura.	Katsina	2
geography	state_identity	Birnin Kebbi	NIPC	Kebbi State is associated with the Argungu fishing festival.	Kebbi	1
geography	state_identity	Lokoja	NIPC	Kogi State contains the confluence of the Niger and Benue rivers.	Kogi	1
geography	state_identity	Ilorin	NIPC	Kwara State includes Ilorin, a historic emirate and commercial centre.	Kwara	2
geography	state_identity	Lagos	NIPC	Lagos State contains Nigeria's largest port and commercial metropolis.	Lagos	1
geography	state_identity	Lafia	NIPC	Nasarawa State borders the Federal Capital Territory and is known for varied solid minerals.	Nasarawa	2
geography	state_identity	Minna	NIPC	Niger State contains the Kainji, Shiroro and Zungeru hydroelectric projects.	Niger	2
geography	state_identity	Abeokuta	NIPC	Ogun State combines the historic city of Abeokuta with a major industrial corridor.	Ogun	2
geography	state_identity	Akure	NIPC	Ondo State combines cocoa production with the Idanre Hills landscape.	Ondo	2
geography	state_identity	Osogbo	NIPC	Osun State contains the Osun-Osogbo Sacred Grove and the historic city of Ile-Ife.	Osun	2
geography	state_identity	Ibadan	NIPC	Oyo State links Ibadan with the history of the Oyo Empire.	Oyo	1
geography	state_identity	Jos	NIPC	Plateau State is centred on the highland city of Jos and has a history of tin mining.	Plateau	2
geography	state_identity	Port Harcourt	NIPC	Rivers State is a petroleum-producing coastal state centred on Port Harcourt.	Rivers	1
geography	state_identity	Sokoto	NIPC	Sokoto State is the historic seat of the Sokoto Caliphate.	Sokoto	1
geography	state_identity	Jalingo	NIPC	Taraba State includes the Mambilla Plateau and much of Gashaka Gumti National Park.	Taraba	2
geography	state_identity	Damaturu	NIPC	Yobe State includes Sahel landscapes and part of the Hadejia-Nguru wetlands.	Yobe	2
geography	state_identity	Gusau	NIPC	Zamfara State lies in northwestern Nigeria and is associated with agriculture and solid minerals.	Zamfara	2
geography	state_identity	Abuja	NIPC	The Federal Capital Territory contains Abuja, Nigeria's federal capital.	Federal Capital Territory	1
""".strip()

def read(path):
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

def write(path, rows):
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]), lineterminator="\n")
        w.writeheader(); w.writerows(rows)

def clues(fact, answer):
    stem = fact.rstrip(".")
    return [
        ("question", f"Which answer fits this fact: {stem}?", answer),
        ("witness", f"A witness mentions that {stem}. What key detail identifies the lead?", answer),
        ("dispatch", f"Dispatch clue: {stem}. Record the relevant answer.", answer),
    ]

def main():
    knowledge = [x for x in read(K) if not x["knowledge_id"].startswith("KN-S2-")]
    clue_rows = [x for x in read(C) if not x["formulation_id"].startswith("CF-S2-")]
    relations = [x for x in read(R) if not x["knowledge_id"].startswith("KN-S2-")]
    locations = read(L)
    by_name = {x["name"].casefold(): x["location_id"] for x in locations}
    by_state = {x["state_or_territory"].casefold(): x["location_id"] for x in locations if x["location_type"] == "state_capital"}
    rows = [line.split("\t") for line in RAW.splitlines()]
    for i, (domain, topic, hint, source, fact, answer, difficulty) in enumerate(rows, 1):
        kid = f"KN-S2-{i:04d}"
        forms = clues(fact, answer)
        knowledge.append({"knowledge_id": kid, "domain": domain, "topic": topic, "fact": fact,
            "answer": answer, "difficulty": difficulty, "clue_forms": " | ".join(x[1] for x in forms),
            "source": SRC.get(source, source), "refresh_policy": "annual_source_review"})
        for j, (style, text, expected) in enumerate(forms, 1):
            clue_rows.append({"formulation_id": f"CF-S2-{(i-1)*3+j:05d}", "knowledge_id": kid,
                "clue_style": style, "difficulty": difficulty, "text": text,
                "expected_answer": expected, "topic": topic})
        loc = by_name.get(hint.casefold()) or by_state.get(hint.casefold())
        if not loc:
            raise ValueError(f"No location match for {hint!r}")
        relations.append({"location_id": loc, "knowledge_id": kid,
            "relation_type": "semantic_enrichment_pass2", "weight": "1.0"})
    write(K, knowledge); write(C, clue_rows); write(R, relations)
    print(f"Added {len(rows)} knowledge records, {len(rows)*3} clues and {len(rows)} relations")

if __name__ == "__main__":
    main()
