import test from "node:test";
import assert from "node:assert/strict";
import * as model from "../src/model.ts";
import * as map from "../src/map.ts";

test("every jurisdiction belongs to exactly one geopolitical zone", () => {
  const seen = new Map();
  for (const [zone, members] of Object.entries(model.ZONES)) for (const s of members) seen.set(s, [...(seen.get(s) ?? []), zone]);
  assert.equal(seen.size, 37);
  for (const state of model.STATES) assert.equal(seen.get(state)?.length, 1, state);
  assert.equal(model.zoneOf("Lagos"), "South West");
  assert.equal(model.zoneOf("Atlantis"), null);
});

test("every jurisdiction projects inside the map canvas and stays distinguishable", () => {
  const points = model.STATES.map(s => [s, map.statePoint(s)]);
  for (const [s, p] of points) {
    assert.ok(p, s);
    assert.ok(p.x > 0 && p.x < map.MAP_W && p.y > 0 && p.y < map.MAP_H, `${s} off-canvas`);
  }
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    const d = Math.hypot(points[i][1].x - points[j][1].x, points[i][1].y - points[j][1].y);
    assert.ok(d > 25, `${points[i][0]} and ${points[j][0]} overlap`);
  }
  assert.match(map.outlinePath(), /^M[\d. ]+(L[\d. ]+)+Z$/);
});

test("case clock mirrors the seven day deadline", () => {
  assert.deepEqual(model.clockParts(0), { day: "Monday", time: "07:00", hour: 7 });
  assert.equal(model.clockParts(1440).day, "Tuesday");
  assert.equal(model.timeLeft(0).minutes, model.DEADLINE_MINUTES);
  assert.equal(model.timeLeft(0).label, "7d 0h left");
  assert.equal(model.timeLeft(model.DEADLINE_MINUTES + 50).minutes, 0);
  assert.equal(model.timeLeft(model.DEADLINE_MINUTES - 600).urgent, true);
  assert.equal(model.timeLeft(100).urgent, false);
  assert.equal(model.dayPart(7), "morning");
  assert.equal(model.dayPart(13), "afternoon");
  assert.equal(model.dayPart(18), "evening");
  assert.equal(model.dayPart(2), "night");
});

test("mission helpers pick unplayed cases without hard-coded lists", () => {
  assert.equal(model.missionId(7), "NG-M0007");
  assert.equal(model.missionNumber("NG-M0042"), 42);
  assert.equal(model.missionNumber("bogus"), null);
  assert.equal(model.unplayedMissions([]).length, model.MISSION_COUNT);
  assert.equal(model.nextMission([]), "NG-M0001");
  assert.equal(model.nextMission(["NG-M0001", "NG-M0002"]), "NG-M0003");
  assert.equal(model.randomMission(["NG-M0001"], () => 0), "NG-M0002");
  assert.equal(model.randomMission(["NG-M0001"], () => 0.999999), "NG-M1000");
  assert.equal(model.randomMission(model.unplayedMissions([]).map(String)), null);
});

test("durations and ratios are display-only helpers", () => {
  assert.equal(model.duration(45), "45m");
  assert.equal(model.duration(150), "2h 30m");
  assert.equal(model.duration(3000), "2d 2h");
  assert.equal(model.ratio(3, 1), "3 of 4");
});

test("HTTP statuses map to the documented client behaviour", () => {
  assert.equal(model.errorKind(401), "signed_out");
  assert.equal(model.errorKind(403), "denied");
  assert.equal(model.errorKind(409), "conflict");
  assert.equal(model.errorKind(422), "rejected");
  assert.equal(model.errorKind(429), "rate_limited");
  assert.equal(model.errorKind(500), "other");
});

test("questioned venues are scoped to the current stop", () => {
  const state = { stage: 2, current_state: "Kano", visited_venues: ["1|Lagos|market", "2|Kano|library", "2|Kano|market"] };
  assert.deepEqual(model.questionedHere(state).sort(), ["library", "market"]);
  assert.deepEqual(model.questionedHere({ ...state, stage: 3 }), []);
});

test("dossier completeness ignores blanks", () => {
  assert.equal(model.dossierCount({ sex: "female", hair: "  ", hobby: "chess" }), 2);
  assert.equal(Object.keys(model.FIELD_META).length, model.FIELDS.length);
});

test("stored notes migrate from the old string format and group by stop", () => {
  const notes = model.parseNotes(JSON.stringify(["old", { stop: "Kano", venue: "Market", message: "a" }, { stop: "Kano", venue: "Library", message: "b" }, 7]));
  assert.equal(notes.length, 3);
  assert.equal(notes[0].stop, "Earlier");
  const groups = model.groupNotes(notes);
  assert.deepEqual(groups.map(g => [g.stop, g.notes.length]), [["Earlier", 1], ["Kano", 2]]);
  assert.deepEqual(model.parseNotes("{broken"), []);
  assert.deepEqual(model.parseNotes(null), []);
});

test("initials are safe for any display name", () => {
  assert.equal(model.initials("ada.obi"), "AO");
  assert.equal(model.initials(""), "?");
});
