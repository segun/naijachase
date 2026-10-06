"""Add source-linked semantic knowledge without changing existing IDs."""
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
K = ROOT / "data/knowledge/knowledge.csv"
C = ROOT / "data/clues/clue-formulations.csv"
R = ROOT / "data/knowledge/location-knowledge-relations.csv"
L = ROOT / "data/locations/locations.csv"

UNESCO = "https://whc.unesco.org/en/statesparties/ng"
MFAH = "https://foreignaffairs.gov.ng/nigeria/history-of-nigeria/"
MFAC = "https://foreignaffairs.gov.ng/nigeria/culture/"
FAO = "https://www.fao.org/nigeria/fao-in-nigeria/nigeria-at-a-glance/en/"
NPS = "https://nigeriaparkservice.gov.ng/"

# domain|topic|location|source|fact|answer|difficulty
RAW = r"""
heritage|world_heritage|Osogbo|UNESCO|The Osun-Osogbo Sacred Grove was inscribed on the UNESCO World Heritage List in 2005.|2005|2
heritage|world_heritage|Osogbo|UNESCO|The Osun-Osogbo Sacred Grove is one of Nigeria's two inscribed World Heritage properties.|Osun-Osogbo Sacred Grove|1
heritage|world_heritage|Osogbo|UNESCO|UNESCO classifies the Osun-Osogbo Sacred Grove as a cultural property.|Cultural|2
heritage|world_heritage|Sukur Cultural Landscape|UNESCO|Sukur Cultural Landscape was inscribed on the UNESCO World Heritage List in 1999.|1999|2
heritage|world_heritage|Sukur Cultural Landscape|UNESCO|Sukur Cultural Landscape is one of Nigeria's two inscribed World Heritage properties.|Sukur Cultural Landscape|1
heritage|world_heritage|Sukur Cultural Landscape|UNESCO|UNESCO classifies Sukur Cultural Landscape as a cultural property.|Cultural|2
heritage|unesco_tentative|Gashaka Gumti National Park|UNESCO|Gashaka Gumti National Park joined Nigeria's UNESCO Tentative List in 2025.|2025|2
heritage|unesco_tentative|Gashaka Gumti National Park|UNESCO|Gashaka Gumti National Park straddles Taraba and Adamawa states.|Taraba and Adamawa|2
heritage|unesco_tentative|Gashaka Gumti National Park|UNESCO|Gangriwal, Nigeria's highest point, rises within Gashaka Gumti National Park.|Gangriwal|3
heritage|unesco_tentative|Cross River National Park|UNESCO|Cross River-Korup-Takamanda National Parks joined Nigeria's UNESCO Tentative List in 2020.|2020|2
heritage|unesco_tentative|Cross River National Park|UNESCO|The CRIKOT proposal links protected areas in Nigeria and Cameroon.|Nigeria and Cameroon|2
heritage|unesco_tentative|Maiduguri|UNESCO|The Lake Chad Cultural Landscape joined Nigeria's UNESCO Tentative List in 2018.|2018|2
heritage|unesco_tentative|Idanre Hills|UNESCO|Oke Idanre, also called Idanre Hill, joined Nigeria's UNESCO Tentative List in 2007.|2007|2
heritage|unesco_tentative|Idanre Hills|UNESCO|Oke Idanre is in Ondo State.|Ondo|1
heritage|unesco_tentative|Arochukwu LGA|UNESCO|The Arochukwu Long Juju Slave Route joined Nigeria's UNESCO Tentative List in 2007.|2007|2
heritage|unesco_tentative|Arochukwu LGA|UNESCO|The Arochukwu tentative property includes a cave-temple complex in Abia State.|Abia|2
heritage|unesco_tentative|Kano|UNESCO|The Ancient Kano City Walls and Associated Sites joined Nigeria's UNESCO Tentative List in 2007.|2007|2
heritage|unesco_tentative|Kano|UNESCO|Dala Hill, Kurmi Market and the Emir's Palace are associated with the Ancient Kano City Walls.|Ancient Kano City Walls|3
heritage|unesco_tentative|Sokoto|UNESCO|Surame Cultural Landscape joined Nigeria's UNESCO Tentative List in 2007.|2007|2
heritage|unesco_tentative|Calabar|UNESCO|The Alok Ikom Stone Monoliths joined Nigeria's UNESCO Tentative List in 2007.|2007|2
heritage|unesco_tentative|Ogbunike Caves|UNESCO|Ogbunike Caves joined Nigeria's UNESCO Tentative List in 2007.|2007|2
heritage|unesco_tentative|Benin City|UNESCO|Benin Iya and Sungbo's Eredo have been on Nigeria's UNESCO Tentative List since 1995.|1995|2
heritage|unesco_tentative|Ibadan|UNESCO|Old Oyo has been on Nigeria's UNESCO Tentative List since 1995.|1995|2
heritage|unesco_tentative|Ibadan|UNESCO|Old Oyo is the deserted capital site of the former Oyo Empire.|Oyo Empire|2
heritage|unesco_tentative|Port Harcourt|UNESCO|The Niger Delta Mangroves have been on Nigeria's UNESCO Tentative List since 1995.|1995|2
history|nationhood|Abuja|MFAH|The modern Nigerian nation-state was formed through amalgamation in 1914.|1914|1
history|nationhood|Abuja|MFAH|Nigeria became independent in 1960.|1960|1
history|nationhood|Abuja|MFAH|Nigeria became a republic in 1963.|1963|1
history|name_origin|Lokoja|MFAH|Nigeria's name was derived from the River Niger.|River Niger|1
history|name_origin|Lokoja|MFAH|Flora Shaw is commonly credited with coining the name Nigeria in the late nineteenth century.|Flora Shaw|2
history|kanem_borno|Maiduguri|MFAH|Kanem and Borno developed on opposite sides of Lake Chad.|Lake Chad|2
history|kanem_borno|Maiduguri|MFAH|The Kanuri are closely associated with the history of the Kanem-Borno Empire.|Kanuri|2
history|hausa_states|Kano|MFAH|Kano was one of the historic Hausa city-states.|Kano|1
history|hausa_states|Kano|MFAH|The Hausa city-states became important centres of long-distance trade and craft production.|Trade and crafts|2
history|sokoto_caliphate|Sokoto|MFAH|The Sokoto Caliphate emerged in the early nineteenth century.|Nineteenth century|2
history|sokoto_caliphate|Sokoto|MFAH|Usman dan Fodio is associated with the founding of the Sokoto Caliphate.|Usman dan Fodio|1
history|oyo_empire|Ibadan|MFAH|The Oyo Empire was a major Yoruba state in precolonial West Africa.|Oyo Empire|1
history|oyo_empire|Ibadan|MFAH|Old Oyo, also called Oyo-Ile, was the empire's capital site.|Oyo-Ile|2
history|benin_kingdom|Benin City|MFAH|Benin City was the capital of the historic Kingdom of Benin.|Benin City|1
history|benin_kingdom|Benin City|MFAH|The ruler of the Kingdom of Benin bears the title Oba.|Oba|1
history|ile_ife|Ile-Ife|MFAH|Ile-Ife is a historic centre of Yoruba civilization.|Ile-Ife|1
history|ile_ife|Ile-Ife|MFAH|The Ooni is the traditional ruler associated with Ile-Ife.|Ooni|2
history|nok_culture|Kaduna|MFAH|The Nok culture is renowned for ancient terracotta sculpture.|Terracotta|1
history|abeokuta|Abeokuta|MFAH|Abeokuta's name means under the rock in Yoruba.|Under the rock|1
history|abeokuta|Abeokuta|MFAH|Olumo Rock is closely associated with Abeokuta's settlement history.|Olumo Rock|1
history|lokoja|Lokoja|MFAH|Lokoja stands near the confluence of the Niger and Benue rivers.|Niger and Benue|1
history|lokoja|Lokoja|MFAH|The Niger-Benue confluence made Lokoja strategically important for river transport.|River transport|2
culture|festival|Argungu|MFAC|The Argungu Fishing Festival is associated with Kebbi State.|Kebbi|1
culture|festival|Argungu|MFAC|Competitive fishing is the signature event of the Argungu festival.|Fishing|1
culture|festival|Osogbo|MFAC|The Osun-Osogbo Festival honours Osun, the Yoruba river deity.|Osun|2
culture|festival|Calabar|MFAC|The Calabar Carnival combines costume, music and dance performances.|Costume, music and dance|2
culture|festival|Kano|MFAC|Durbar festivals feature decorated horses and ceremonial processions.|Horse processions|1
culture|festival|Kano|MFAC|Durbar displays are associated with emirate traditions in northern Nigeria.|Emirate traditions|2
culture|food|Lagos|MFAC|Jollof rice is a widely celebrated rice dish in Nigeria.|Jollof rice|1
culture|food|Lagos|MFAC|Suya is spiced grilled meat commonly sold by street vendors in Nigerian cities.|Suya|1
culture|food|Lagos|MFAC|Moi moi is a steamed savoury pudding made primarily from beans.|Beans|1
culture|food|Calabar|MFAC|Edikang ikong is a vegetable-rich soup associated with Cross River and Akwa Ibom cuisines.|Edikang ikong|2
culture|food|Calabar|MFAC|Afang soup is strongly associated with Efik and Ibibio culinary traditions.|Afang soup|2
culture|food|Abeokuta|MFAC|Ofada rice takes its popular name from Ofada in Ogun State.|Ofada|1
culture|music|Lagos|MFAC|Fela Anikulapo Kuti is closely associated with the development of Afrobeat.|Fela Anikulapo Kuti|1
culture|music|Lagos|MFAC|Afrobeat combines West African musical ideas with jazz and funk influences.|Jazz and funk|2
culture|music|Lagos|MFAC|Juju music is a Yoruba popular-music tradition.|Yoruba|2
culture|music|Lagos|MFAC|The talking drum is prominent in many Yoruba musical traditions.|Talking drum|1
culture|literature|Abeokuta|MFAC|Wole Soyinka was born in Abeokuta.|Abeokuta|1
culture|literature|Abeokuta|MFAC|Wole Soyinka became the first African laureate of the Nobel Prize in Literature.|Wole Soyinka|1
culture|literature|Enugu|MFAC|Chinua Achebe wrote the novel Things Fall Apart.|Chinua Achebe|1
culture|literature|Enugu|MFAC|Things Fall Apart was first published in 1958.|1958|2
culture|language|Kano|MFAC|Hausa is widely spoken across northern Nigeria.|Hausa|1
culture|language|Kano|MFAC|Hausa has a long written tradition using both Ajami and Roman scripts.|Ajami and Roman|3
culture|language|Lagos|MFAC|Yoruba is widely spoken in southwestern Nigeria.|Yoruba|1
culture|language|Lagos|MFAC|Yoruba is a tonal language.|Tonal|2
culture|language|Enugu|MFAC|Igbo is widely spoken in southeastern Nigeria.|Igbo|1
culture|language|Enugu|MFAC|Igbo comprises numerous regional varieties.|Regional varieties|2
ecology|national_park|Gashaka Gumti National Park|UNESCO|Gashaka Gumti National Park covers about 5,907 square kilometres.|5,907 square kilometres|2
ecology|national_park|Gashaka Gumti National Park|UNESCO|Gashaka Gumti contains savanna, lowland rainforest, montane grassland and cloud forest.|Four major habitat types|3
ecology|national_park|Gashaka Gumti National Park|UNESCO|The park protects an important population of the Nigeria-Cameroon chimpanzee.|Nigeria-Cameroon chimpanzee|2
ecology|national_park|Cross River National Park|NPS|Cross River National Park protects rainforest ecosystems in southeastern Nigeria.|Rainforest|1
ecology|national_park|Cross River National Park|NPS|The park has Oban and Okwangwo divisions.|Oban and Okwangwo|2
ecology|national_park|Kainji Lake National Park|NPS|Kainji Lake National Park includes the Borgu and Zugurma sectors.|Borgu and Zugurma|2
ecology|river_system|Lokoja|FAO|The River Benue joins the River Niger at Lokoja.|Lokoja|1
ecology|river_system|Lokoja|FAO|The River Niger flows southward through Nigeria to the Niger Delta.|Niger Delta|1
ecology|vegetation|Port Harcourt|FAO|Mangrove forests occur extensively in Nigeria's Niger Delta.|Niger Delta|1
ecology|vegetation|Port Harcourt|FAO|Nigeria's coastal wetlands support fisheries and shoreline protection.|Fisheries and shoreline protection|2
economy|currency|Abuja|https://www.cbn.gov.ng/currency/|Nigeria's currency is the naira.|Naira|1
economy|currency|Abuja|https://www.cbn.gov.ng/currency/|One naira is divided into 100 kobo.|100 kobo|1
economy|agriculture|Ibadan|FAO|Cocoa is an important tree crop in southwestern Nigeria.|Cocoa|1
economy|agriculture|Ibadan|FAO|Cassava is one of Nigeria's major food crops.|Cassava|1
economy|agriculture|Makurdi|FAO|Yam is a major staple crop in Nigeria's farming systems.|Yam|1
economy|agriculture|Kano|FAO|Groundnuts have a long commercial history in northern Nigeria.|Groundnuts|1
economy|agriculture|Kano|FAO|Sorghum and millet are important grains in Nigeria's drier northern zones.|Sorghum and millet|2
economy|industry|Port Harcourt|https://www.nuprc.gov.ng/|The Niger Delta is the centre of Nigeria's petroleum-producing region.|Niger Delta|1
economy|industry|Ajaokuta LGA|https://www.aisml.com.ng/|Ajaokuta is associated with Nigeria's major integrated steel project.|Steel|2
transport|rail|Lagos|https://nrc.gov.ng/|The Lagos-Ibadan standard-gauge railway links Lagos with Ibadan.|Ibadan|1
transport|rail|Lagos|https://nrc.gov.ng/|The Nigerian Railway Corporation is responsible for federal rail services.|Nigerian Railway Corporation|1
transport|ports|Lagos|https://nigerianports.gov.ng/|Lagos contains major port complexes at Apapa and Tin Can Island.|Apapa and Tin Can Island|1
transport|ports|Port Harcourt|https://nigerianports.gov.ng/|Port Harcourt is a major port city in Rivers State.|Rivers|1
institutions|higher_education|Ibadan|https://www.ui.edu.ng/|The University of Ibadan began as University College Ibadan in 1948.|1948|2
institutions|higher_education|Nsukka LGA|https://www.unn.edu.ng/|The University of Nigeria is located at Nsukka.|Nsukka|1
institutions|museum|Lagos|https://ncmm.gov.ng/|The National Museum Lagos preserves major collections of Nigerian art and archaeology.|National Museum Lagos|1
institutions|government|Abuja|https://nass.gov.ng/|Nigeria's National Assembly consists of the Senate and House of Representatives.|Two chambers|1
architecture|landmark|Ibadan|https://oyostate.gov.ng/|Cocoa House in Ibadan is associated with southwestern Nigeria's cocoa economy.|Cocoa|2
architecture|landmark|Ibadan|https://oyostate.gov.ng/|Mapo Hall is a prominent civic landmark in Ibadan.|Mapo Hall|1
architecture|landmark|Abuja|https://fcta.gov.ng/|Aso Rock is a large granitic outcrop in Abuja.|Granitic outcrop|1
architecture|landmark|Lagos|https://nationaltheatre.gov.ng/|Nigeria's National Theatre is located in Lagos.|Lagos|1
""".strip()

SOURCES = {"UNESCO": UNESCO, "MFAH": MFAH, "MFAC": MFAC, "FAO": FAO, "NPS": NPS}

def read(path):
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

def write(path, rows):
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]), lineterminator="\n")
        w.writeheader(); w.writerows(rows)

def main():
    knowledge = [x for x in read(K) if not x["knowledge_id"].startswith("KN-SE-")]
    clues = [x for x in read(C) if not x["formulation_id"].startswith("CF-SE-")]
    relations = [x for x in read(R) if not x["knowledge_id"].startswith("KN-SE-")]
    locations = read(L)
    by_name = {x["name"].casefold(): x["location_id"] for x in locations}
    state_capital = {x["state_or_territory"].casefold(): x["location_id"] for x in locations if x["location_type"] == "state_capital"}
    rows = [line.split("|") for line in RAW.splitlines()]
    for i, (domain, topic, hint, source, fact, answer, difficulty) in enumerate(rows, 1):
        kid = f"KN-SE-{i:04d}"
        forms = [
            ("direct", f"A witness recalled: {fact} What is the key answer?"),
            ("riddle", f"Follow this Nigerian knowledge trail: {fact} Identify the answer."),
            ("witness", f"The case note says, '{fact}' Which answer should be recorded?"),
        ]
        knowledge.append({"knowledge_id": kid, "domain": domain, "topic": topic, "fact": fact,
            "answer": answer, "difficulty": difficulty, "clue_forms": " | ".join(t for _, t in forms),
            "source": SOURCES.get(source, source), "refresh_policy": "annual_source_review"})
        for j, (style, text) in enumerate(forms, 1):
            clues.append({"formulation_id": f"CF-SE-{(i-1)*3+j:05d}", "knowledge_id": kid,
                "clue_style": style, "difficulty": difficulty, "text": text,
                "expected_answer": answer, "topic": topic})
        loc = by_name.get(hint.casefold()) or state_capital.get(hint.casefold())
        if loc:
            relations.append({"location_id": loc, "knowledge_id": kid,
                "relation_type": "semantic_enrichment", "weight": "1.0"})
    write(K, knowledge); write(C, clues); write(R, relations)
    print(f"Added {len(rows)} knowledge records and {len(rows)*3} clue formulations")

if __name__ == "__main__": main()
