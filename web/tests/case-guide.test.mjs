import test from "node:test";
import assert from "node:assert/strict";
import { caseGuide } from "../src/domain/case-guide.ts";

const initial = { stage: 0, current_state: "Lagos", trail_status: "hot", dossier: {}, visited_venues: [], warrant_suspect: null };
const complete = { sex: "female", height: "tall", skin_tone: "dark-skinned", hair: "braids", hobby: "chess", vehicle: "motorcycle", accessory: "watch", feature: "limp" };
const interviews = (stage = 0, location = "Lagos") => ["market", "station", "hotel"].map(venue => `${stage}|${location}|${venue}`);

test("all three interviews lead to travel from investigation, clues and profile", () => {
  for (const screen of ["investigate", "notebook", "dossier"]) {
    for (const dossier of [{}, complete]) {
      const guide = caseGuide({ ...initial, dossier, visited_venues: interviews() }, screen);
      assert.equal(guide.action.screen, "travel");
      assert.equal(guide.action.label, "Choose next destination");
    }
  }
});

test("only distinct witnesses at the current stop count toward travel guidance", () => {
  for (const visited_venues of [interviews().slice(0, 2), Array(3).fill("0|Lagos|market"), interviews(1), interviews(0, "Oyo")]) {
    assert.notEqual(caseGuide({ ...initial, visited_venues }, "investigate").action?.screen, "travel");
  }
});

test("three interviews preserve final-stop, cold-trail and transit guidance", () => {
  const heard = { ...initial, visited_venues: interviews() };
  assert.equal(caseGuide({ ...heard, trail_status: "cold" }, "investigate").title, "You’ve lost the trail");
  assert.equal(caseGuide(heard, "investigate", true).title, "Your journey is underway");
  const final = { ...heard, stage: 7, visited_venues: interviews(7) };
  assert.equal(caseGuide(final, "investigate").action.screen, "dossier");
  assert.equal(caseGuide({ ...final, dossier: complete }, "investigate").action.screen, "warrant");
  assert.equal(caseGuide({ ...final, warrant_suspect: "suspect-1" }, "investigate").action.label, "Find the hideout");
});

test("new and returning players are guided from witnesses to their saved clues", () => {
  assert.equal(caseGuide(initial, "investigate").title, "Question a witness");
  assert.equal(caseGuide({ ...initial, visited_venues: ["0|Lagos|market"] }, "investigate").action.screen, "notebook");
  assert.equal(caseGuide({ ...initial, stage: 1, current_state: "Oyo", visited_venues: ["0|Lagos|market"] }, "investigate").title, "Question a witness");
});

test("a complete profile does not prompt a premature warrant", () => {
  for (let stage = 0; stage < 7; stage++) {
    const guide = caseGuide({ ...initial, stage, dossier: complete, visited_venues: [`${stage}|Lagos|market`] }, "investigate");
    assert.notEqual(guide.action?.screen, "warrant");
  }
});

test("the final stop leads through questioning, profile, warrant, and hideout", () => {
  const final = { ...initial, stage: 7 };
  assert.equal(caseGuide(final, "investigate").title, "Question a witness");
  const heard = { ...final, visited_venues: ["7|Lagos|market"] };
  assert.equal(caseGuide(heard, "investigate").action.screen, "dossier");
  assert.equal(caseGuide({ ...heard, dossier: complete }, "investigate").action.screen, "warrant");
  assert.equal(caseGuide({ ...heard, dossier: complete, warrant_suspect: "suspect-1" }, "investigate").action.label, "Find the hideout");
});

test("a cold trail recovers through clues and travel, even at stage seven", () => {
  const cold = { ...initial, stage: 7, trail_status: "cold", dossier: complete };
  assert.equal(caseGuide(cold, "investigate").action.screen, "notebook");
  assert.equal(caseGuide(cold, "notebook").action.screen, "travel");
});

test("weekly transit only offers reading; guidance never mutates the case", () => {
  const state = structuredClone(initial);
  assert.equal(caseGuide(state, "investigate", true).action.screen, "notebook");
  for (const screen of ["investigate", "notebook", "dossier", "travel", "warrant"]) caseGuide(state, screen);
  assert.deepEqual(state, initial);
});
