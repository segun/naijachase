import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BUILDING_RECIPES } from "../src/scenes/witness/recipes-buildings.ts";
import { BUILDING_IDS, crowdLimit, layoutFor } from "../src/scenes/witness/layout-buildings-venues.ts";
import { FRONT, beaconPhase, neonOn, puffAt, swingAt } from "../src/scenes/witness/layout-buildings-parts.ts";
import { poseAt } from "../src/scenes/witness/layout-buildings-people.ts";
import { EXIT_POINT, MEET, ROAD_Z, WITNESS } from "../src/scenes/witness/witness-scene.ts";

const IDS = [
  "church", "mosque", "sacred_grove", "police_station", "hospital", "community_hall",
  "traditional_council", "emir_palace", "palace", "museum", "library", "university",
  "monument", "radio_station", "carnival_workshop", "hotel", "restaurant", "nightclub"
];
const file = name => fs.readFileSync(new URL(`../src/scenes/witness/${name}`, import.meta.url), "utf8");
const NAME = "Test Venue Name";
const SEEDS = Array.from({ length: 24 }, (_, i) => i * 2654435761 % 4294967296);
const MODES = [{ night: false, light: false }, { night: true, light: false }, { night: false, light: true }, { night: true, light: true }];

/** The box a part occupies, or null for flat paving, which is walked on. */
function extent(p) {
  switch (p.k) {
    case "box": return { x0: p.x - p.w / 2, x1: p.x + p.w / 2, z0: p.z - p.d / 2, z1: p.z + p.d / 2, y0: p.y, y1: p.y + p.h };
    case "cyl": { const r = Math.max(p.r, p.rt ?? p.r); return { x0: p.x - r, x1: p.x + r, z0: p.z - r, z1: p.z + r, y0: p.y, y1: p.y + p.h }; }
    case "ball": return { x0: p.x - p.r, x1: p.x + p.r, z0: p.z - p.r, z1: p.z + p.r, y0: p.y - p.r * (p.sy ?? 1), y1: p.y + p.r * (p.sy ?? 1) };
    case "disc": return { x0: p.x - p.r, x1: p.x + p.r, z0: p.z - 0.05, z1: p.z + 0.05, y0: p.y - p.r, y1: p.y + p.r };
    case "prism": return { x0: p.x - p.w / 2, x1: p.x + p.w / 2, z0: p.z - p.d / 2, z1: p.z + p.d / 2, y0: p.y, y1: p.y + p.h };
    case "sign": return { x0: p.x - p.w / 2, x1: p.x + p.w / 2, z0: p.z - 0.1, z1: p.z + 0.1, y0: p.y - p.h / 2, y1: p.y + p.h / 2 };
    case "flag": return { x0: p.x, x1: p.x + p.w, z0: p.z - 0.05, z1: p.z + 0.05, y0: p.y, y1: p.y + p.h };
    case "beacon": return { x0: p.x - p.r, x1: p.x + p.r, z0: p.z - p.r, z1: p.z + p.r, y0: p.y - p.r, y1: p.y + p.r };
    case "puff": return { x0: p.x - 0.5, x1: p.x + 0.5, z0: p.z - 0.5, z1: p.z + 0.5, y0: p.y, y1: p.y + 2.5 };
    case "lamp": return { x0: p.x - 0.2, x1: p.x + 0.2, z0: p.z - 0.2, z1: p.z + 0.2, y0: 0, y1: p.h + 0.2 };
    default: return null;
  }
}
const overlaps = (e, box) => e.x1 > box.x0 && e.x0 < box.x1 && e.z1 > box.z0 && e.z0 < box.z1 && e.y0 < box.y1 && e.y1 > box.y0;

// The talk camera's keep-out box, the sight line to the witness, the walk from the vehicle, the lane and the witness herself
// (docs/agents/Agent2.md, section 3).
const KEEP_OUT = { x0: 1.5, x1: 6, z0: -3, z1: 0.5, y0: -1, y1: 99 };
const SIGHT = { x0: 0, x1: 3, z0: 0, z1: 2.3, y0: -1, y1: 2 };
const LANE = { x0: -99, x1: 99, z0: ROAD_Z - 1.75, z1: ROAD_Z + 1.75, y0: -1, y1: 99 };
const AT_WITNESS = { x0: WITNESS.x - 0.6, x1: WITNESS.x + 0.6, z0: WITNESS.z - 0.45, z1: WITNESS.z + 0.45, y0: -1, y1: 2.2 };
const FORBIDDEN = { keep_out: KEEP_OUT, sight_line: SIGHT, lane: LANE, witness: AT_WITNESS };

/** True if the box comes within `radius` metres of the player's walk from the vehicle to the witness (in either arrival), at walking height. */
function nearWalk(e, radius) {
  if (e.y0 >= 2.5) return false;
  for (const [fromX, fromZ] of Object.values(EXIT_POINT)) {
    for (let i = 0; i <= 40; i++) {
      const x = fromX + ((MEET.x - fromX) * i) / 40, z = fromZ + ((MEET.z - fromZ) * i) / 40;
      if (Math.hypot(x - Math.min(Math.max(x, e.x0), e.x1), z - Math.min(Math.max(z, e.z0), e.z1)) < radius) return true;
    }
  }
  return false;
}

test("Agent 2 supplies exactly the 18 building recipes, each with four distinct fictional witnesses", () => {
  assert.deepEqual(Object.keys(BUILDING_RECIPES).sort(), [...IDS].sort());
  for (const id of IDS) {
    const recipe = BUILDING_RECIPES[id];
    assert.equal(recipe.variant, id, `${id} selects its own visual variant`);
    assert.ok(["worship", "civic", "culture_learning", "hospitality"].includes(recipe.set));
    assert.equal(recipe.witnesses.length, 4);
    assert.ok(recipe.witnesses.every(w => w.avatar_id.startsWith(`w-${id}-`)));
    assert.equal(new Set(recipe.witnesses.map(w => w.label)).size, 4, `${id}: four different roles`);
    assert.ok(new Set(recipe.witnesses.map(w => w.skin_color + w.hair_style)).size >= 3, `${id}: the witnesses do not all look alike`);
  }
});

test("witnesses dress for their place: uniforms differ between venues", () => {
  const looks = new Set(Object.values(BUILDING_RECIPES).flatMap(r => r.witnesses.map(w => w.uniform_primary + w.uniform_secondary)));
  assert.ok(looks.size >= 60, `only ${looks.size} different uniforms across 72 witnesses`);
});

test("every building venue has a layout of its own, in every light and quality", () => {
  assert.deepEqual([...BUILDING_IDS].sort(), [...IDS].sort());
  const fingerprints = new Set();
  for (const id of IDS) {
    for (const mode of MODES) {
      const layout = layoutFor(id, { ...mode, name: NAME });
      assert.ok(layout.parts.length > 20, `${id}: a frontage, not a bare lane`);
      assert.ok(layout.people.length >= 2 && layout.people.length <= crowdLimit(mode.light), `${id}: ${layout.people.length} people`);
      assert.ok(layout.parts.some(p => p.k === "sign" && p.text === NAME), `${id}: the venue's name is painted on a sign`);
      for (const p of layout.parts) {
        for (const [k, v] of Object.entries(p)) if (typeof v === "number") assert.ok(Number.isFinite(v), `${id}: ${p.k}.${k}`);
        if (typeof p.c === "string") assert.match(p.c, /^#[0-9a-f]{6}$/i, `${id}: ${p.k} colour ${p.c}`);
        if (p.k === "box") assert.ok(p.w > 0 && p.h > 0 && p.d > 0, `${id}: box has a size`);
      }
      assert.deepEqual(layoutFor(id, { ...mode, name: NAME }), layout, `${id}: the same layout every time`);
    }
    fingerprints.add(JSON.stringify(layoutFor(id, { ...MODES[0], name: NAME }).parts));
  }
  assert.equal(fingerprints.size, IDS.length, "no two venues share a picture");
});

test("every venue shows what it is: the landmark parts that tell it apart", () => {
  const has = (id, test) => layoutFor(id, { ...MODES[0], name: NAME }).parts.some(test);
  assert.ok(has("church", p => p.k === "cyl" && p.swing), "a bell that swings");
  assert.ok(has("church", p => p.k === "prism"), "a gable");
  assert.ok(has("mosque", p => p.k === "ball" && p.r >= 1.5), "a dome");
  assert.ok(has("mosque", p => p.k === "cyl" && p.h > 6), "a minaret");
  assert.ok(has("sacred_grove", p => p.k === "ball" && p.y > 8), "tall trees");
  assert.ok(has("police_station", p => p.k === "beacon"), "a flashing light");
  assert.ok(has("hospital", p => p.k === "beacon") && has("hospital", p => p.k === "box" && p.c === "#1f9a58"), "an ambulance light and a plus sign");
  assert.ok(has("community_hall", p => p.k === "puff"), "a generator's exhaust");
  assert.ok(has("emir_palace", p => p.k === "cyl" && p.h > 5), "gate towers");
  assert.ok(has("palace", p => p.k === "flag"), "flags");
  assert.ok(has("museum", p => p.k === "prism") && has("museum", p => p.k === "cyl" && p.h > 3), "a pediment on columns");
  assert.ok(has("library", p => p.k === "box" && p.w < 0.6 && p.h < 0.7 && p.d > 0.15), "rows of books");
  assert.ok(has("university", p => p.k === "disc" && p.c === "#f4f4ee"), "a clock");
  assert.ok(has("monument", p => p.k === "cyl" && p.h > 5), "a tall monument");
  assert.ok(has("radio_station", p => p.k === "sign" && p.text === "ON AIR") && has("radio_station", p => p.k === "beacon"), "an ON AIR sign and a mast light");
  assert.ok(has("carnival_workshop", p => p.k === "box" && p.neon), "a welder's glow");
  assert.ok(has("hotel", p => p.k === "box" && p.lit), "lit windows");
  assert.ok(has("restaurant", p => p.k === "puff") && has("restaurant", p => p.k === "ball" && p.sy < 0.3), "kitchen steam and umbrellas");
  assert.ok(has("nightclub", p => p.k === "box" && p.neon), "neon");
});

test("scenery stays out of the camera's way: keep-out box, sight line, the walk, the lane and the witness", () => {
  for (const id of IDS) {
    for (const seed of SEEDS) {
      for (const mode of MODES.slice(0, 2)) for (const p of layoutFor(id, { ...mode, name: NAME, seed }).parts) {
        const e = extent(p);
        if (!e) continue;
        for (const [name, box] of Object.entries(FORBIDDEN)) assert.ok(!overlaps(e, box), `${id}: a ${p.k} at (${p.x}, ${p.z}) stands in the ${name}`);
        assert.ok(!nearWalk(e, 1.2), `${id}: a ${p.k} at (${p.x}, ${p.z}) is within 1.2 m of the walk to the witness`);
      }
    }
  }
});

test("people stay out of the way too, at every moment of the scene", () => {
  const margin = 0.4;
  for (const id of IDS) {
    for (const seed of SEEDS) for (const person of layoutFor(id, { ...MODES[0], name: NAME, seed }).people) {
      for (let t = 0; t <= 20; t += 0.5) {
        const w = poseAt(person, t);
        const e = { x0: w.x - margin, x1: w.x + margin, z0: w.z - margin, z1: w.z + margin, y0: 0, y1: 1.8 };
        for (const [name, box] of Object.entries(FORBIDDEN)) assert.ok(!overlaps(e, box), `${id}: someone at (${w.x.toFixed(1)}, ${w.z.toFixed(1)}) at ${t}s is in the ${name}`);
        assert.ok(!nearWalk(e, 1.0), `${id}: someone at (${w.x.toFixed(1)}, ${w.z.toFixed(1)}) at ${t}s is on the player's walk`);
        for (const v of [w.x, w.z, w.heading, w.swing, w.bounce, w.gesture]) assert.ok(Number.isFinite(v));
      }
    }
  }
});

test("the scenery varies with the account's text and is the same for the same text", () => {
  for (const id of IDS) {
    const a = layoutFor(id, { ...MODES[0], name: NAME, seed: 11 }), b = layoutFor(id, { ...MODES[0], name: NAME, seed: 11 });
    assert.deepEqual(a, b, `${id}: the same account gets the same scene`);
    const looks = new Set(SEEDS.map(seed => JSON.stringify(layoutFor(id, { ...MODES[0], name: NAME, seed }))));
    assert.ok(looks.size >= 20, `${id}: only ${looks.size} different scenes from 24 accounts`);
    const colours = new Set(SEEDS.flatMap(seed => layoutFor(id, { ...MODES[0], name: NAME, seed }).parts.map(p => p.c)));
    const base = new Set(layoutFor(id, { ...MODES[0], name: NAME, seed: 0 }).parts.map(p => p.c));
    assert.ok(colours.size > base.size + 4, `${id}: the colours change from account to account`);
    const clothes = new Set(SEEDS.map(seed => layoutFor(id, { ...MODES[0], name: NAME, seed }).people.map(p => p.top + p.skirt).join()));
    assert.ok(clothes.size >= 6, `${id}: people dress differently for different accounts`);
  }
  const kerb = id => new Set(SEEDS.map(seed => layoutFor(id, { ...MODES[0], name: NAME, seed }).parts.filter(p => p.z < 1.2 && p.k !== "pave").length));
  assert.ok(kerb("hotel").size > 1, "things are left by the kerb in different numbers");
});

test("the walk to the witness is in front of every venue's wall", () => {
  for (const [x, z] of [...Object.values(EXIT_POINT), [MEET.x, MEET.z]]) assert.ok(z < FRONT - 1, `(${x}, ${z}) is in front of the wall`);
  for (const id of IDS) {
    for (const p of layoutFor(id, { ...MODES[0], name: NAME }).parts) {
      if (p.k === "box" && p.w > 5 && p.h > 2) assert.ok(p.z - p.d / 2 >= FRONT - 1.01, `${id}: a wide wall comes out too far`);
    }
  }
});

test("animation is a pure function of time and stays small", () => {
  for (const t of [0, 1.234, 7.5, 18]) {
    assert.equal(swingAt(0.15, t), swingAt(0.15, t));
    assert.ok(Math.abs(swingAt(0.15, t)) <= 0.15);
    assert.equal(neonOn(t, 1), neonOn(t, 1));
    assert.equal(beaconPhase(t, 0.9), beaconPhase(t, 0.9));
    for (let i = 0; i < 3; i++) assert.ok(puffAt(i, t) >= 0 && puffAt(i, t) < 1);
  }
  const on = Array.from({ length: 200 }, (_, i) => neonOn(i * 0.1, 0.5)).filter(Boolean).length;
  assert.ok(on > 120 && on < 200, "neon is mostly on and does flicker");
  const person = layoutFor("church", { ...MODES[0], name: NAME }).people.find(p => p.to);
  assert.deepEqual(poseAt(person, 3.3), poseAt(person, 3.3));
  assert.notDeepEqual(poseAt(person, 0), poseAt(person, 3));
});

test("both renderers draw every kind of part and register all four families", () => {
  const three = file("chase3d-buildings.ts"), two = file("witness-2d-buildings.ts");
  for (const set of ["worship", "civic", "culture_learning", "hospitality"]) {
    assert.match(three, new RegExp(`\\b${set}:`), `${set}: 3D registration`);
    assert.match(two, new RegExp(`\\b${set}:`), `${set}: 2D registration`);
  }
  const kit3 = file("chase3d-buildings-kit.ts"), kit2 = file("witness-2d-buildings-kit.ts");
  for (const kind of ["box", "cyl", "ball", "disc", "prism", "pave", "sign", "flag", "beacon", "puff", "lamp"]) {
    assert.match(kit3, new RegExp(`case "${kind}"`), `3D draws ${kind}`);
    assert.match(kit2, new RegExp(`case "${kind}"`), `2D draws ${kind}`);
  }
  for (const source of [kit3, kit2]) {
    assert.match(source, /palette/, "night follows the shared palette");
    assert.match(source, /venueName/, "the venue name reaches the sign");
  }
});

test("building code is deterministic, lazy and free of debugging", () => {
  const files = ["layout-buildings-parts.ts", "layout-buildings-people.ts", "layout-buildings-venues.ts", "chase3d-buildings-kit.ts", "chase3d-buildings-people.ts", "witness-2d-buildings-kit.ts", "chase3d-buildings.ts", "witness-2d-buildings.ts", "recipes-buildings.ts"];
  for (const f of files) assert.doesNotMatch(file(f), /Math\.random|Date\.now|performance\.now|console\.log|debugger/, `${f}: no clock, randomness or debugging`);
  for (const f of ["layout-buildings-parts.ts", "layout-buildings-people.ts", "layout-buildings-venues.ts", "witness-2d-buildings-kit.ts", "witness-2d-buildings.ts", "recipes-buildings.ts"]) {
    assert.doesNotMatch(file(f), /@babylonjs|from "\.\/chase3d-/, `${f}: only chase3d-* files may import Babylon.js`);
  }
  assert.match(file("chase3d-buildings-kit.ts"), /from "\.\/layout-buildings-venues\.ts"/, "3D draws the shared layout");
  assert.match(file("witness-2d-buildings-kit.ts"), /from "\.\/layout-buildings-venues\.ts"/, "2D draws the shared layout");
});

test("building sound stays under the witness's voice", () => {
  for (const recipe of Object.values(BUILDING_RECIPES)) {
    for (const value of [recipe.sound.crowd, recipe.sound.calls, recipe.sound.hum, recipe.sound.clinks]) assert.ok(value <= 0.65);
    for (const extra of recipe.sound.extras ?? []) assert.ok(extra.level <= 0.2, `${recipe.id}: ${extra.kind} at ${extra.level}`);
  }
});

test("no flag looks like Nigeria's: green and white are never the two colours of a flag", () => {
  const isGreen = c => { const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); return g > r * 1.25 && g > b * 1.25; };
  const isWhite = c => [1, 3, 5].every(i => parseInt(c.slice(i, i + 2), 16) > 215);
  for (const id of Object.keys(BUILDING_RECIPES)) for (let seed = 0; seed < 40; seed++) {
    const layout = layoutFor(id, { night: false, light: false, name: "Aba " + id, seed });
    for (const p of layout.parts.filter(p => p.k === "flag")) assert.ok(!((isGreen(p.c) && isWhite(p.c2)) || (isGreen(p.c2) && isWhite(p.c))), `${id} seed ${seed}: flag ${p.c}/${p.c2}`);
  }
});
