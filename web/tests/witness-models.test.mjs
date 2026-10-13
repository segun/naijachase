import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { allRecipes } from "../src/scenes/witness/venue-recipes.ts";
import { crowdModelId, modelParts, sceneryFit, witnessModelId } from "../src/scenes/witness/witness-models.ts";
import { MODELS } from "../src/scenes/shared/model-manifest.ts";
import { CATTLE_HEIGHT, marketLayout } from "../src/scenes/witness/layout-open-air-market.ts";
import { transportLayout } from "../src/scenes/witness/layout-open-air-transport.ts";
import { waterLayout } from "../src/scenes/witness/layout-open-air-water.ts";
import { workLayout } from "../src/scenes/witness/layout-open-air-work.ts";
import { layoutFor } from "../src/scenes/witness/layout-buildings-venues.ts";

const read = p => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const gltf = id => {
  assert.ok(MODELS[id], `${id} must be registered with real dimensions`);
  const bytes = fs.readFileSync(new URL(`../public/assets/3d/${MODELS[id].file}`, import.meta.url));
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
};

test("all 35 venues have supplied, sized models for their frontage, witnesses and crowd", () => {
  assert.equal(allRecipes().length, 35);
  const people = new Set();
  for (const recipe of allRecipes()) {
    gltf(`${recipe.id}_main`);
    for (const look of recipe.witnesses) {
      const id = witnessModelId(look);
      people.add(id);
      assert.equal(id.includes("_woman_"), look.presentation === "feminine", `${recipe.id}: ${look.label}`);
    }
    for (let i = 0; i < 8; i++) people.add(crowdModelId(recipe.id, i));
  }
  for (const id of people) {
    const data = gltf(id);
    assert.ok(data.skins?.length, `${id}: skinned humanoid`);
    assert.ok(data.animations?.some(a => a.name.toLowerCase() === "walk"), `${id}: Walk required`);
  }
  assert.throws(() => crowdModelId("not_a_venue", 0), /No witness crowd models/);
});

test("layout model groups survive scenery variation and every replacement has an asset", () => {
  const builders = { market_variants: marketLayout, transport_hub: transportLayout, water_edge: waterLayout, work_and_land: workLayout };
  const used = new Set();
  for (const recipe of allRecipes()) {
    if (recipe.id === "market") continue;
    for (const seed of [0, 12345]) {
      const layout = builders[recipe.set]?.(recipe.id, "Model test venue", seed) ??
        layoutFor(recipe.id, { night: false, light: false, name: "Model test venue", seed });
      for (const part of layout.props ?? layout.parts) if (part.modelGroup) {
        used.add(part.modelGroup.id);
        assert.ok(Number.isFinite(part.modelGroup.yaw ?? 0));
      }
    }
  }
  for (const id of used) gltf(id);
  assert.ok(used.has("cow_brown") && used.has("boat_canoe") && used.has("bus_danfo"));
  const parts = [{ k: "box" }, { k: "cyl" }];
  const tagged = modelParts(parts, "tent_shade");
  assert.equal(tagged[0].modelGroup, tagged[1].modelGroup, "all pieces of an object share one replacement");
  assert.equal(parts[0].modelGroup, undefined, "source data is not mutated");
});

test("scenery fitting is uniform, grounded and clears the player and conversation corridor", () => {
  const min = [-2, -0.1, -1], max = [2, 2.9, 1];
  for (const front of [3.1, 3.4]) {
    const fit = sceneryFit([-10, 0, 0.5], [10, 8, 9], min, max, front);
    assert.ok(fit.scale > 0);
    assert.ok(fit.scale * (max[0] - min[0]) <= 20);
    assert.ok(fit.scale * (max[1] - min[1]) <= 8);
    assert.ok(fit.scale * (max[2] - min[2]) <= 8.5);
    assert.ok(Math.abs(fit.position[1] + min[1] * fit.scale) < 1e-10);
    assert.ok(Math.abs(fit.position[2] + min[2] * fit.scale - front) < 1e-10);
    assert.deepEqual(fit, sceneryFit([-10, 0, 0.5], [10, 8, 9], min, max, front));
  }
  assert.throws(() => sceneryFit([0, 0, 0], [1, 1, 1], [0, 0, 0], [0, 0, 0]), /invalid bounds/);
});

test("Full uses the shared model loader; Standard and Simple never request witness models", () => {
  const scene = read("scenes/witness/chase3d-witness.ts"), view = read("scenes/witness/WitnessScene.svelte");
  assert.match(scene, /if \(options\.models\) \{\s*await Promise\.all/);
  assert.match(view, /if \(current === "flat"\) return/);
  assert.doesNotMatch(view, /import\("\.\/witness-2d\.ts"\)/);
  assert.match(view, /class="witness-account-text">\{visit\?\.message\}/);
  assert.match(view, /if \(finished\) return;\s*finished = true;\s*app\.leaveWitness\(\)/);
  assert.match(view, /controller\.abort\(\)/);
  assert.match(scene, /signal\?\.addEventListener\("abort", abort/);
  assert.match(scene, /removeEventListener\("webglcontextlost", contextLost\)/);
});

test("cattle are at least human height and are not shrunk to narrow procedural footprints", () => {
  const people = Object.values(MODELS).filter(m => m.kind === "person");
  assert.ok(CATTLE_HEIGHT >= Math.max(...people.map(m => m.size)));
  for (const seed of [0, 12345]) {
    const cows = marketLayout("cattle_market", "Cattle market", seed).props.filter(p => p.modelGroup?.id.startsWith("cow_"));
    assert.ok(cows.length > 0);
    assert.ok(cows.every(p => p.modelGroup.height === CATTLE_HEIGHT));
    const tops = cows.map(p => p.y + (p.k === "ball" ? p.w * (p.sy ?? 1) : p.k === "box" ? p.h : 0));
    assert.ok(Math.max(...tops) >= CATTLE_HEIGHT - 1e-6, "Standard cattle retain the requested height");
  }
  const fit = sceneryFit([-1, 0, 6], [1, 1.5, 6.6], [-2, -0.1, -1], [2, 1.3, 1], -Infinity, CATTLE_HEIGHT);
  assert.ok(Math.abs(fit.scale * 1.4 - CATTLE_HEIGHT) < 1e-10);
  assert.ok(Math.abs(fit.position[1] - 0.1 * fit.scale) < 1e-10, "feet stay grounded");
  assert.match(read("scenes/witness/chase3d-witness-models.ts"), /front, group\.height/);
});
