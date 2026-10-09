import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { allRecipes, recipeFor } from "../src/scenes/witness/venue-recipes.ts";
import { OPEN_AIR_RECIPES } from "../src/scenes/witness/recipes-open-air.ts";
import { BUILDING_RECIPES } from "../src/scenes/witness/recipes-buildings.ts";
import { HAIR_STYLES } from "../src/avatar/avatar-model.ts";

// These tests apply to every recipe automatically, so each agent's venues are checked as soon as they are added.
const read = p => fs.readFileSync(new URL(`../src/scenes/witness/${p}`, import.meta.url), "utf8");
const exported = JSON.parse(fs.readFileSync(new URL("../../data/exports/witness-location-scenes.json", import.meta.url), "utf8"));
const venueIds = new Set(exported.venue_archetypes.map(v => v.venue_id));

/** Who owns which venues. The market is done; the other 34 are split in docs/agents/Agent1.md and docs/agents/Agent2.md. */
const AGENT1 = ["cattle_market", "craft_market", "festival_ground", "motor_park", "railway_station", "airport", "seaport", "beach", "fishing_jetty", "jetty", "waterfront", "farm", "mining_site", "refinery", "factory_gate", "conservation_office"];
const AGENT2 = ["church", "mosque", "sacred_grove", "police_station", "hospital", "community_hall", "traditional_council", "emir_palace", "palace", "museum", "library", "university", "monument", "radio_station", "carnival_workshop", "hotel", "restaurant", "nightclub"];

test("the 34 venues without a scene are split between the two agents with nothing left over and nothing shared", () => {
  assert.equal(new Set([...AGENT1, ...AGENT2]).size, 34);
  assert.deepEqual([...new Set([...AGENT1, ...AGENT2, "market"])].sort(), [...venueIds].sort(), "every archetype is the market, Agent1's or Agent2's");
});

test("each recipe file only holds its own agent's venues, keyed by the venue id", () => {
  for (const id of Object.keys(OPEN_AIR_RECIPES)) assert.ok(AGENT1.includes(id), `${id} is not Agent1's`);
  for (const id of Object.keys(BUILDING_RECIPES)) assert.ok(AGENT2.includes(id), `${id} is not Agent2's`);
  for (const [id, r] of [...Object.entries(OPEN_AIR_RECIPES), ...Object.entries(BUILDING_RECIPES)]) assert.equal(r.id, id, `${id}: the key and the recipe's id must match`);
});

test("every recipe is complete: a real venue, a registered set in both renderers, believable witnesses and a sound mix", () => {
  const sets3d = ["chase3d-market.ts", "chase3d-open-air.ts", "chase3d-buildings.ts"].map(read).join("\n") + read("chase3d-sets.ts");
  const sets2d = ["witness-2d-market.ts", "witness-2d-open-air.ts", "witness-2d-buildings.ts"].map(read).join("\n") + read("witness-2d-sets.ts");
  for (const r of allRecipes()) {
    assert.ok(venueIds.has(r.id), `${r.id} is not a venue in witness-location-scenes.json`);
    assert.equal(recipeFor(r.id), r);
    assert.match(r.set, /^[a-z][a-z0-9_]*$/, `${r.id}: set id`);
    assert.match(sets3d, new RegExp(`\\b${r.set}\\s*[:,]`), `${r.id}: no 3D set called "${r.set}" is registered (chase3d-sets.ts)`);
    assert.match(sets2d, new RegExp(`\\b${r.set}\\s*[:,]`), `${r.id}: no 2D set called "${r.set}" is registered (witness-2d-sets.ts)`);
    assert.ok(r.witnesses.length >= 4, `${r.id}: at least four witnesses so repeat visits meet different people`);
    assert.equal(new Set(r.witnesses.map(w => w.avatar_id)).size, r.witnesses.length, `${r.id}: witness ids are unique`);
    for (const w of r.witnesses) {
      for (const k of ["skin_color", "hair_color", "uniform_primary", "uniform_secondary", "uniform_accent"]) assert.match(w[k], /^#[0-9a-fA-F]{6}$/, `${r.id}/${w.avatar_id}: ${k}`);
      assert.ok(HAIR_STYLES.includes(w.hair_style), `${r.id}/${w.avatar_id}: unknown hair style ${w.hair_style}`);
      assert.ok(w.pitch >= 90 && w.pitch <= 260, `${r.id}/${w.avatar_id}: pitch ${w.pitch}`);
      assert.ok(w.label && w.label.length < 40);
    }
    for (const k of ["crowd", "calls", "hum", "clinks"]) assert.ok(r.sound[k] >= 0 && r.sound[k] <= 1, `${r.id}: sound.${k}`);
    for (const e of r.sound.extras ?? []) {
      assert.ok(["tone", "swell", "pulse", "chirps"].includes(e.kind), `${r.id}: extra kind ${e.kind}`);
      assert.ok(e.level > 0 && e.level <= 0.3, `${r.id}: extra level ${e.level} (keep it quiet)`);
      if (e.kind === "tone") assert.ok(e.freq >= 60 && e.freq <= 4000 && e.every >= 2 && e.length > 0.1 && e.length <= 6);
      if (e.kind === "swell") assert.ok(e.freq >= 40 && e.freq <= 6000 && e.rate > 0 && e.rate <= 2);
      if (e.kind === "pulse") assert.ok(e.bpm >= 40 && e.bpm <= 200 && e.freq >= 40 && e.freq <= 200);
      if (e.kind === "chirps") assert.ok(e.freq >= 800 && e.freq <= 6000 && e.rate > 0 && e.rate <= 4);
    }
  }
});

test("the shared files stay free of graphics-library imports where they must, and sets stay lazy", () => {
  for (const f of ["recipe-kit.ts", "venue-recipes.ts", "recipes-open-air.ts", "recipes-buildings.ts", "witness-2d-sets.ts", "witness-2d-kit.ts", "witness-2d-open-air.ts", "witness-2d-buildings.ts", "witness-2d-market.ts", "witness-driver.ts", "market-layout.ts"]) {
    assert.doesNotMatch(read(f), /@babylonjs|from "\.\/chase3d-/, `${f} must not import Babylon.js or the 3D renderer`);
  }
  const app = fs.readFileSync(new URL("../src/state/app.svelte.ts", import.meta.url), "utf8");
  assert.doesNotMatch(app, /chase3d|witness-2d/, "the main bundle imports only the recipes, never a renderer");
});
