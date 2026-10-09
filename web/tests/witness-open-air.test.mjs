import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { hashOf, recipeFor } from "../src/scenes/witness/venue-recipes.ts";
import { OPEN_AIR_RECIPES } from "../src/scenes/witness/recipes-open-air.ts";
import { marketLayout } from "../src/scenes/witness/layout-open-air-market.ts";
import { transportLayout } from "../src/scenes/witness/layout-open-air-transport.ts";
import { waterLayout } from "../src/scenes/witness/layout-open-air-water.ts";
import { workLayout } from "../src/scenes/witness/layout-open-air-work.ts";
import { CLEAR_BOXES, armAngle, armEnd, crowdLimit, moveAt, placeAt, sceneSeed } from "../src/scenes/witness/layout-open-air-kit.ts";
import { WITNESS } from "../src/scenes/witness/witness-scene.ts";

const read = p => fs.readFileSync(new URL(`../src/scenes/witness/${p}`, import.meta.url), "utf8");
const exported = JSON.parse(fs.readFileSync(new URL("../../data/exports/witness-location-scenes.json", import.meta.url), "utf8"));
const names = new Map(exported.venue_archetypes.map(v => [v.venue_id, v.venue_name]));

const SETS = {
  market_variants: { venues: ["cattle_market", "craft_market", "festival_ground"], layout: marketLayout },
  transport_hub: { venues: ["motor_park", "railway_station", "airport"], layout: transportLayout },
  water_edge: { venues: ["beach", "fishing_jetty", "jetty", "waterfront", "seaport"], layout: waterLayout },
  work_and_land: { venues: ["farm", "mining_site", "refinery", "factory_gate", "conservation_office"], layout: workLayout }
};
const MINE = Object.values(SETS).flatMap(s => s.venues);
const FILES = ["recipes-open-air.ts", "chase3d-open-air.ts", "witness-2d-open-air.ts", "chase3d-open-air-kit.ts", "witness-2d-open-air-kit.ts", "layout-open-air-kit.ts", "layout-open-air-market.ts", "layout-open-air-transport.ts", "layout-open-air-water.ts", "layout-open-air-work.ts"];
const NAMES = ["Aba Community Market", "", "A", "Ogbomoso Motor Park and Grand Central Passenger Terminal Authority Complex", "Ìbàdàn Oríta Mókọ́la"];

/** Every venue is checked with many scenery seeds, because each account's words arrange the place a little differently. */
const SEEDS = [0, ...Array.from({ length: 23 }, (_, i) => Math.imul(i + 1, 2654435761) >>> 0)];
const venues = MINE.flatMap(id => SEEDS.map(seed => ({ id, seed, recipe: recipeFor(id), build: (variant, name) => SETS[recipeFor(id)?.set]?.layout(variant, name, seed) })));
const colour = /^#[0-9a-fA-F]{6}$/;
const solid = p => p.k !== "glow" && p.k !== "sign" && !p.far;

/** The horizontal footprint of a prop at its widest, as [x0, x1, z0, z1, top]. */
function footprint(p) {
  const sway = p.m ? [p.m.ax ?? 0, p.m.az ?? 0] : [0, 0];
  const slide = p.m?.vx ? p.m.vx * (p.m.until ?? 0) : 0;
  let box;
  switch (p.k) {
    case "box": box = [p.x - p.w / 2, p.x + p.w / 2, p.z - p.d / 2, p.z + p.d / 2, p.y + p.h]; break;
    case "cyl": box = [p.x - p.w / 2, p.x + p.w / 2, p.z - p.w / 2, p.z + p.w / 2, p.y + p.h]; break;
    case "cylx": box = [p.x - p.w / 2, p.x + p.w / 2, p.z - p.h / 2, p.z + p.h / 2, p.y + p.h]; break;
    case "cylz": box = [p.x - p.w / 2, p.x + p.w / 2, p.z - p.d / 2, p.z + p.d / 2, p.y + p.w]; break;
    case "ball": box = [p.x - p.w / 2, p.x + p.w / 2, p.z - p.w / 2, p.z + p.w / 2, p.y + p.w * (p.sy ?? 1)]; break;
    case "arm": { const lo = armEnd(p, p.a - Math.abs(p.amp ?? 0)), hi = armEnd(p, p.a + Math.abs(p.amp ?? 0)), mid = armEnd(p, p.a); const xs = [p.x, lo[0], hi[0], mid[0]], zs = [p.z, lo[2], hi[2], mid[2]]; box = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs), Math.max(p.y, lo[1], hi[1], mid[1])]; break; }
    default: return null;
  }
  return [box[0] - sway[0] + Math.min(0, slide), box[1] + sway[0] + Math.max(0, slide), box[2] - sway[1], box[3] + sway[1], box[4]];
}
const overlaps = (a, b) => a[0] < b[1] && a[1] > b[0] && a[2] < b[3] && a[3] > b[2];

test("all sixteen venues have a recipe that names a set and a variant, and nothing else is in the file", () => {
  assert.equal(MINE.length, 16);
  assert.deepEqual(Object.keys(OPEN_AIR_RECIPES).sort(), [...MINE].sort());
  for (const { id, recipe, build } of venues) {
    assert.ok(recipe, `${id}: recipe`);
    assert.equal(recipe.variant, id, `${id}: the variant is the venue id`);
    assert.ok(build, `${id}: its set "${recipe?.set}" has a layout`);
    assert.ok(SETS[recipe.set].venues.includes(id), `${id}: in set ${recipe.set}`);
  }
});

test("the same words always give the same scenery, and different words give different arrangements of the same place", () => {
  for (const id of MINE) {
    const layout = SETS[recipeFor(id).set].layout;
    const looks = new Set(SEEDS.map(seed => JSON.stringify(layout(id, "Aba Community Market", seed))));
    assert.equal(layout(id, "X", 7).props.length, layout(id, "X", 7).props.length);
    assert.deepEqual(layout(id, "X", 12345), layout(id, "X", 12345), `${id}: same seed, same place`);
    assert.ok(looks.size >= 20, `${id}: only ${looks.size} different arrangements in ${SEEDS.length} seeds`);
    const shapes = new Set(SEEDS.map(seed => layout(id, "X", seed).props.length));
    assert.ok(shapes.size >= 3, `${id}: ${shapes.size} different prop counts (the arrangements should change what is there, not only its colour)`);
    const base = layout(id, "X", 0), other = SEEDS.slice(1).map(seed => layout(id, "X", seed));
    assert.ok(other.every(l => l.props.length > base.props.length * 0.6 && l.props.length < base.props.length * 1.5), `${id}: an arrangement strays too far from the venue`);
  }
});

test("scenery seeds come from the account's words, apart from the witness's pick", () => {
  assert.equal(sceneSeed("same words"), sceneSeed("same words"));
  assert.notEqual(sceneSeed("same words"), sceneSeed("other words"));
  assert.notEqual(sceneSeed("same words"), hashOf("same words"), "independent of the witness choice");
  assert.ok(Number.isInteger(sceneSeed("")) && sceneSeed("") >= 0);
});

test("every witness is a plausible fictional person with a role that suits the venue's data", () => {
  for (const { id, recipe } of venues) {
    const roles = String(exported.venue_archetypes.find(v => v.venue_id === id).witness_roles).split("|").map(r => r.trim().toLowerCase());
    const labels = recipe.witnesses.map(w => w.label.toLowerCase());
    assert.ok(roles.some(r => labels.includes(r)), `${id}: at least one witness has a role from the data (${roles.join(", ")})`);
    assert.ok(new Set(recipe.witnesses.map(w => w.presentation)).size >= 1);
    assert.ok(recipe.witnesses.some(w => w.presentation === "feminine") && recipe.witnesses.some(w => w.presentation === "masculine"), `${id}: a mix of witnesses`);
  }
});

test("layouts are pure data: finite, deterministic, with valid colours, for any venue name", () => {
  for (const { id, build, recipe } of venues) for (const name of NAMES) {
    const a = build(recipe.variant, name), b = build(recipe.variant, name);
    assert.deepEqual(a, b, `${id}: same layout twice`);
    assert.doesNotThrow(() => JSON.stringify(a));
    assert.match(a.ground, colour, `${id}: ground`);
    if (a.water) { assert.match(a.water.c, colour); assert.ok(Number.isFinite(a.water.z) && a.water.z > 4); }
    assert.ok(a.props.length > 40 && a.props.length < 400, `${id}: ${a.props.length} props`);
    for (const p of a.props) {
      for (const [k, v] of Object.entries(p)) if (typeof v === "number") assert.ok(Number.isFinite(v), `${id}: ${p.k}.${k} is ${v}`);
      if (p.k !== "sign") assert.match(p.c, colour, `${id}: ${p.k} colour ${p.c}`);
      else { assert.match(p.bg, colour); assert.match(p.fg, colour); assert.ok(p.text.length > 0); }
      for (const k of ["w", "h", "d", "len", "t", "r"]) if (k in p) assert.ok(p[k] > 0, `${id}: ${p.k}.${k} must be positive`);
    }
    for (const l of a.lamps) assert.match(l.c, colour);
  }
});

test("each venue shows its own name on a sign, long or empty names included", () => {
  for (const { id, build, recipe } of venues) {
    const signs = build(recipe.variant, "Aba Community Market").props.filter(p => p.k === "sign").map(p => p.text);
    assert.ok(signs.includes("ABA COMMUNITY MARKET"), `${id}: a sign reads the venue name`);
    const fallback = build(recipe.variant, "").props.filter(p => p.k === "sign").map(p => p.text);
    assert.ok(fallback.some(t => t.length > 3 && !t.includes("undefined")), `${id}: an empty name still gives a sign`);
  }
});

test("nothing stands where the camera or the player must see: the walk, the keep-out box and the line to the witness", () => {
  for (const { id, build, recipe } of venues) {
    const layout = build(recipe.variant, names.get(id) ?? id);
    for (const p of layout.props.filter(solid)) {
      const f = footprint(p);
      if (!f || f[4] < 0.15 || p.k === "arm" && !p.len) continue;
      if (p.k === "box" && p.h <= 0.05) continue; // flat markings on the ground
      for (const c of CLEAR_BOXES) assert.ok(!overlaps(f, c), `${id}: ${p.k} at (${p.x}, ${p.z}) blocks the walk or the camera`);
    }
    for (const p of layout.props.filter(p => p.k === "sign" && p.y < 2.2)) {
      assert.ok(!overlaps([p.x - p.w / 2, p.x + p.w / 2, p.z - 0.1, p.z + 0.1], CLEAR_BOXES[0]) && !overlaps([p.x - p.w / 2, p.x + p.w / 2, p.z - 0.1, p.z + 0.1], CLEAR_BOXES[1]), `${id}: sign "${p.text}" blocks the view`);
    }
    for (const person of layout.people) {
      assert.ok(Math.hypot(person.x - WITNESS.x, person.z - WITNESS.z) > 1.5 || person.walk, `${id}: a person stands on the witness`);
      if (person.walk) assert.ok(person.z >= 3.4, `${id}: a stroller walks through the keep-out area`);
      else assert.ok(!CLEAR_BOXES.some(c => person.x > c[0] && person.x < c[1] && person.z > c[2] && person.z < c[3]), `${id}: a person stands in the clear area`);
    }
  }
});

test("the crowd is small enough for a phone and every person is placed the same way every time", () => {
  for (const { id, build, recipe } of venues) {
    const layout = build(recipe.variant, id);
    assert.ok(layout.people.length >= crowdLimit(false) - 2 && layout.people.length <= 12, `${id}: ${layout.people.length} people`);
    const walkers = layout.people.slice(0, crowdLimit(true)).filter(p => p.walk).length;
    assert.ok(walkers >= 1 && walkers <= 2, `${id}: a light device still sees someone walking by`);
    for (const p of layout.people) for (const t of [0, 1.6, 3.1, 4.3, 8, 17.9]) {
      const a = placeAt(p, t), b = placeAt(p, t);
      assert.deepEqual(a, b);
      for (const v of Object.values(a)) assert.ok(Number.isFinite(v));
      if (p.walk) assert.ok(a.x >= Math.min(p.walk.x0, p.walk.x1) - 1e-9 && a.x <= Math.max(p.walk.x0, p.walk.x1) + 1e-9, `${id}: a stroller stays on its lane`);
    }
    assert.ok(layout.lamps.length >= 1 && layout.lamps.length <= 3, `${id}: lamps`);
  }
});

test("motion is a pure function of time and stays small", () => {
  const out = [0, 0, 0];
  for (const { id, build, recipe } of venues) for (const p of build(recipe.variant, id).props) {
    if (!p.m) continue;
    for (const t of [0, 0.7, 4.3, 12, 18]) {
      const a = [...moveAt(p.m, t, out)], b = [...moveAt(p.m, t, out)];
      assert.deepEqual(a, b);
      assert.ok(a.every(Number.isFinite) && Math.abs(a[0]) <= 12 && Math.abs(a[1]) < 1 && Math.abs(a[2]) < 1, `${id}: ${p.k} moves too far`);
      if (p.k === "arm") assert.ok(Number.isFinite(armAngle(p, t)));
    }
  }
});

test("high and light quality both draw the venue, and light keeps it recognisable", () => {
  for (const { id, build, recipe } of venues) {
    const props = build(recipe.variant, id).props;
    const light = props.filter(p => !p.hi);
    assert.ok(light.length >= props.length * 0.6, `${id}: a light device keeps most of the scene`);
    assert.ok(light.some(p => p.k === "sign"), `${id}: and the name`);
  }
});

test("sets are pure: no randomness, no clock, no logging, and the shared layout files never import a renderer", () => {
  for (const f of FILES) {
    const src = read(f);
    assert.doesNotMatch(src, /Math\.random|Date\.now|performance\.now|console\.(log|debug)/, `${f}: randomness, the clock or logging`);
    assert.doesNotMatch(src, /import\s+[^;]*from\s+"[^"]*(?:app\.svelte|\/ui\/|\/screens\/)/, `${f}: imports state or UI`);
    if (!/chase3d-open-air(-kit)?\.ts$/.test(f)) assert.doesNotMatch(src, /@babylonjs|from "\.\/chase3d-/, `${f}: only chase3d-open-air files may import Babylon.js or the 3D renderer`);
  }
  for (const f of ["layout-open-air-kit.ts", "layout-open-air-market.ts", "layout-open-air-transport.ts", "layout-open-air-water.ts", "layout-open-air-work.ts", "witness-2d-open-air-kit.ts", "witness-2d-open-air.ts", "recipes-open-air.ts"]) {
    assert.doesNotMatch(read(f), /@babylonjs|from "\.\/chase3d-/, `${f}: no 3D imports`);
  }
  assert.doesNotMatch(read("recipes-open-air.ts"), /^import .*(layout-open-air|witness-2d|chase3d)/m, "the recipes stay in the first download, so they import no scenery");
});

test("hash-derived indexes cannot be negative or fractional (the market's black-screen bug)", () => {
  for (const { id, build, recipe } of venues) for (const name of NAMES) {
    const layout = build(recipe.variant, name);
    for (const person of layout.people) assert.ok(Number.isInteger(person.seed) && person.seed >= 0, `${id}: seed ${person.seed}`);
  }
});
