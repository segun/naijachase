"""Build a 30-mission pilot that uses semantic knowledge for every route step."""
import csv
import random
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data/missions/pilot"

def read(path):
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

def write(path, rows, fields):
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator="\n")
        w.writeheader(); w.writerows(rows)

def replace_ci(text, old, new):
    return re.sub(re.escape(old), new, text, flags=re.IGNORECASE)

def route_clue(location, knowledge, level):
    name, state = location["name"], location["state_or_territory"]
    fact = knowledge["fact"].rstrip(".")
    if location["location_type"] == "state_capital":
        fact = replace_ci(fact, state + " State", "this state")
        fact = replace_ci(fact, state, "this state")
        fact = replace_ci(fact, name, "its capital")
        lead = f"The suspect booked passage to the capital of this state: {fact}."
    else:
        fact = replace_ci(fact, name, "__DEST__")
        if state.casefold() != name.casefold() and (knowledge["topic"] == "state_identity" or " State" in fact):
            fact = replace_ci(fact, state + " State", "the surrounding state")
            fact = replace_ci(fact, state, "the surrounding state")
        cleanups = {
            "The __DEST__-Ibadan standard-gauge railway links __DEST__ with Ibadan": "A standard-gauge railway links the destination with Ibadan",
            "The surrounding state-__DEST__": "The destination's",
            "the surrounding state-__DEST__": "the destination's",
            "The __DEST__ Caliphate": "The caliphate based at the destination",
            "the __DEST__ Caliphate": "the caliphate based at the destination",
            "The __DEST__ River": "The river named for the destination",
            "the __DEST__ River": "the river named for the destination",
            "The __DEST__ Fishing Festival": "The destination's fishing festival",
            "the __DEST__ festival": "the destination's festival",
            "Ancient __DEST__ City Walls": "the destination's ancient city walls",
            "Old __DEST__": "The old city",
            "__DEST__ State": "The destination's state",
            "the __DEST__": "the destination's",
            "The __DEST__": "The destination's",
            "__DEST__": "the destination",
        }
        for old, new in cleanups.items():
            fact = fact.replace(old, new)
        fact = fact.replace("the the ", "the ").replace("The the ", "The ")
        if level == "easy":
            lead = f"The next stop is described by this note: {fact}."
        elif level == "medium":
            lead = f"A torn itinerary gives one cultural or historical marker: {fact}. Name the destination."
        else:
            lead = f"The route cipher contains only this specialist detail: {fact}. Identify the destination."
    return lead

def main():
    locations = read(ROOT / "data/locations/locations.csv")
    knowledge = read(ROOT / "data/knowledge/knowledge.csv")
    relations = read(ROOT / "data/knowledge/location-knowledge-relations.csv")
    thieves = read(ROOT / "data/thieves/thieves.csv")
    loc = {x["location_id"]: x for x in locations}
    know = {x["knowledge_id"]: x for x in knowledge}

    candidates = []
    for rel in relations:
        kid, lid = rel["knowledge_id"], rel["location_id"]
        if not kid.startswith(("KN-SE-", "KN-S2-")):
            continue
        l, k = loc[lid], know[kid]
        fact = k["fact"].casefold()
        named = l["name"].casefold() in fact
        state_capital_fact = l["location_type"] == "state_capital" and l["state_or_territory"].casefold() in fact
        if named or state_capital_fact:
            candidates.append((lid, kid, int(k["difficulty"])))

    # Prefer geographic variety and never reuse the same fact in this pilot.
    rng = random.Random(20261005)
    by_diff = defaultdict(list)
    for item in candidates:
        by_diff[item[2]].append(item)
    for items in by_diff.values():
        rng.shuffle(items)

    used_facts = set()
    def take(count, allowed):
        result, used_locations = [], defaultdict(int)
        pool = [x for d in allowed for x in by_diff[d] if x[1] not in used_facts]
        pool.sort(key=lambda x: (used_locations[x[0]], rng.random()))
        while pool and len(result) < count:
            best_index = min(range(len(pool)), key=lambda i: (used_locations[pool[i][0]], i))
            item = pool.pop(best_index)
            if item[1] in used_facts:
                continue
            result.append(item); used_facts.add(item[1]); used_locations[item[0]] += 1
        if len(result) != count:
            raise ValueError(f"Only found {len(result)} of {count} requested clues for {allowed}")
        return result

    easy = take(30, [1])
    medium = take(30, [2, 1])
    hard = take(6, [3]) + take(24, [2, 1])
    rng.shuffle(hard)
    tiers = [("easy", 1, easy), ("medium", 3, medium), ("hard", 5, hard)]

    mission_rows, clue_rows, witness_rows = [], [], []
    starts = ["LOC-037", "LOC-038", "LOC-039", "LOC-040", "LOC-043", "LOC-047", "LOC-076"]
    witnesses = ["archivist", "market_trader", "railway_worker", "museum_guide", "park_ranger", "journalist", "fisher", "teacher"]
    premises = {
        "artifact_theft": "A catalogued cultural object vanished hours before a public exhibition.",
        "smuggling": "Customs intercepted an empty crate linked to a missing heritage object.",
        "fraud": "A forged provenance record was used to redirect a museum shipment.",
        "art_theft": "A ceremonial artwork disappeared during gallery preparations.",
        "heist": "A locked archive was opened and a unique historical record removed.",
        "espionage": "A protected research dossier was copied and carried onto a national route.",
    }
    title_nouns = ["Vanished Archive", "River Cipher", "Bronze Decoy", "Festival Ledger", "Savanna Signal", "Midnight Manifest"]

    global_index = 0
    for level, difficulty, selected in tiers:
        for local_index in range(10):
            mission_no = global_index + 1
            mid = f"NG-P{mission_no:03d}"
            thief = thieves[global_index % len(thieves)]
            legs = selected[local_index*3:(local_index+1)*3]
            # Rotate a conflicting duplicate destination out of its group.
            if len({x[0] for x in legs}) < 3:
                for swap in range((local_index+1)*3, len(selected)):
                    if selected[swap][0] not in {x[0] for x in legs[:2]}:
                        selected[local_index*3+2], selected[swap] = selected[swap], selected[local_index*3+2]
                        legs = selected[local_index*3:(local_index+1)*3]
                        break
            targets = [x[0] for x in legs]
            start = next(x for x in starts[global_index % len(starts):] + starts[:global_index % len(starts)] if x not in targets)
            false_routes = [x["location_id"] for x in locations if x["location_id"] not in {start, *targets}]
            rng.shuffle(false_routes)
            crime = thief["primary_crime"]
            mission_rows.append({
                "mission_id": mid,
                "title": f"The {title_nouns[global_index % len(title_nouns)]}: {level.title()} Case",
                "mission_type": "semantic_pilot_case",
                "crime_type": crime,
                "difficulty": str(difficulty),
                "thief_id": thief["thief_id"],
                "premise": premises.get(crime, "A protected cultural record disappeared, leaving a trail across Nigeria."),
                "start_location_id": start,
                "stop_2_location_id": targets[0],
                "stop_3_location_id": targets[1],
                "capture_location_id": targets[2],
                "false_route_location_id_1": false_routes[0],
                "false_route_location_id_2": false_routes[1],
                "knowledge_id_1": legs[0][1],
                "knowledge_id_2": legs[1][1],
                "signature_trait": thief["trait_1"],
                "time_limit_turns": str({"easy": 14, "medium": 12, "hard": 10}[level]),
                "reward_points": str({"easy": 200, "medium": 350, "hard": 500}[level]),
                "arrest_condition": "identify_thief_and_reach_capture_location",
                "failure_conditions": "wrong_warrant|wrong_destination|time_expired",
            })
            current_locations = [start, targets[0], targets[1]]
            for seq, (current, (target, kid, _)) in enumerate(zip(current_locations, legs), 1):
                cid = f"{mid}-C{seq}"
                clue_rows.append({
                    "clue_id": cid, "mission_id": mid, "sequence": str(seq), "location_id": current,
                    "clue_type": know[kid]["topic"], "knowledge_id": kid,
                    "clue_text": route_clue(loc[target], know[kid], level), "points_to_location_id": target,
                })
                witness_rows.append({
                    "witness_id": f"{mid}-W{seq}", "mission_id": mid, "sequence": str(seq),
                    "location_id": current, "witness_type": witnesses[(global_index+seq-1) % len(witnesses)],
                    "reliability": "high" if level == "easy" else "medium", "clue_id": cid,
                })
            cid = f"{mid}-C4"
            clue_rows.append({
                "clue_id": cid, "mission_id": mid, "sequence": "4", "location_id": targets[2],
                "clue_type": "warrant_trait", "knowledge_id": "",
                "clue_text": f"The final witness describes a suspect who is {thief['trait_1']} and uses the alias {thief['alias']}. Issue the warrant before making the arrest.",
                "points_to_location_id": targets[2],
            })
            witness_rows.append({
                "witness_id": f"{mid}-W4", "mission_id": mid, "sequence": "4", "location_id": targets[2],
                "witness_type": "investigator", "reliability": "high", "clue_id": cid,
            })
            global_index += 1

    OUT.mkdir(parents=True, exist_ok=True)
    write(OUT / "pilot-missions.csv", mission_rows, list(mission_rows[0]))
    write(OUT / "pilot-clues.csv", clue_rows, list(clue_rows[0]))
    write(OUT / "pilot-witnesses.csv", witness_rows, list(witness_rows[0]))
    print(f"Created {len(mission_rows)} missions, {len(clue_rows)} clues and {len(witness_rows)} witnesses")

if __name__ == "__main__":
    main()
