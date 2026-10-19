import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

test("model decode work is priority queued and capped at four", () => {
  const loader = read("scenes/shared/chase3d-models.ts");
  assert.match(loader, /MAX_MODEL_WORK = 4/);
  assert.match(loader, /MAX_BACKGROUND_WORK = 2/);
  assert.match(loader, /modelQueue\.sort/);
  assert.match(loader, /priority === "critical"/);
});

test("critical actors and transport gate the scene but decoration does not gate first frame", () => {
  const witness = read("scenes/witness/chase3d-witness.ts");
  assert.match(witness, /replacePerson\([^\n]+"critical"/);
  assert.match(witness, /loadModel\([^\n]+priority: "critical"/);
  assert.doesNotMatch(witness, /await Promise\.all\(\[\s*dressing\.ready/);
  assert.match(witness, /void dressing\.ready/);

  const office = read("scenes/office/chase3d-room.ts");
  assert.match(office, /const glb = await wait\(stage\.addModelFigure/);
  assert.match(office, /afterBrowserIdle/);

  const journey = read("scenes/journey/chase3d-journey.ts");
  assert.match(journey, /"critical"/);
  assert.match(journey, /afterBrowserIdle/);
});

test("preloading is bounded, explicit, and starts only after a confirmed API command", () => {
  const preload = read("scenes/shared/model-preload.ts");
  const app = read("state/app.svelte.ts");
  assert.match(preload, /MAX_PER_SCENE = 4/);
  assert.doesNotMatch(preload, /Object\.(keys|values|entries)\s*\(\s*MODELS/);
  assert.doesNotMatch(preload, /\bMODELS\b/);
  assert.ok(app.indexOf("this.game = next;") < app.indexOf("this.preloadSceneCritical("));
  assert.match(app, /payload\.type === "visit_venue"/);
  assert.match(app, /payload\.type === "travel"/);
  assert.match(app, /payload\.type === "search_hideout"/);
});
