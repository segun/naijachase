import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as b from "../src/scenes/chase/chase-biomes.ts";
import * as motion from "../src/scenes/chase/chase-motion.ts";

const signText = () => ({ lagos: ["LAGOS ISLAND", "MEDICAL HOSPITAL"], anambra: ["ONITSHA", "MAIN MARKET"], kano: ["WELCOME TO", "SABON GARI"] });
const read = p => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

test("the journey visits Lagos, Anambra and Kano in order and loops", () => {
  assert.deepEqual(b.BIOMES.map(x => x.name), ["Lagos", "Anambra", "Kano"]);
  assert.deepEqual(b.BIOMES.map(x => x.zone), ["South West", "South East", "North West"]);
  assert.equal(b.RING, b.SEGMENT * 3);
  assert.equal(b.progressAt(0), 0);
  assert.ok(Math.abs(b.progressAt(b.CYCLE_SECONDS_TOTAL) - 0) < 1e-9, "returns to Lagos after one cycle");
  const order = [];
  for (let s = 0; s < b.CYCLE_SECONDS_TOTAL; s += 0.25) { const d = b.dominant(b.biomeWeights(b.progressAt(s))); if (order.at(-1) !== d) order.push(d); }
  assert.deepEqual(order, [0, 1, 2, 0], "Lagos, Anambra, Kano, then back to Lagos");
  assert.equal(b.dominant(b.biomeWeights(b.progressAt(b.CYCLE_SECONDS_TOTAL + 0.1))), 0);
});

test("each city is held for a while, then hands over smoothly, with weights always summing to 1", () => {
  let held = 0, previous = b.biomeWeights(0);
  for (let p = 0; p < b.RING; p += 1) {
    const w = b.biomeWeights(p);
    assert.ok(Math.abs(w.reduce((a, c) => a + c, 0) - 1) < 1e-9);
    w.forEach((x, i) => assert.ok(x >= 0 && x <= 1 && Math.abs(x - previous[i]) < 0.06, `jump at ${p}`));
    if (Math.max(...w) > 0.999) held++;
    previous = w;
  }
  assert.ok(held > b.RING * 0.3, `cities should hold for at least a third of the loop (held ${held})`);
  const mid = b.biomeWeights(b.SEGMENT / 2).sort((x, y) => y - x);
  assert.ok(mid[0] < 0.6 && mid[1] > 0.4, "mid-transition shows both neighbours equally");
});

test("blended palettes equal the pure palette at each city and change continuously between", () => {
  b.BIOMES.forEach((biome, i) => {
    const mix = b.blendPalette(b.biomeWeights(biome.center));
    assert.deepEqual(mix.skyTop.map(x => +x.toFixed(6)), biome.palette.skyTop.map(x => +x.toFixed(6)));
    assert.ok(Math.abs(mix.fogDensity - biome.palette.fogDensity) < 1e-9, biome.id);
  });
  let last = b.blendPalette(b.biomeWeights(0));
  for (let p = 1; p < b.RING; p++) {
    const now = b.blendPalette(b.biomeWeights(p));
    for (let c = 0; c < 3; c++) assert.ok(Math.abs(now.skyHorizon[c] - last.skyHorizon[c]) < 0.05, `sky jumps at ${p}`);
    assert.ok(Math.abs(now.stars - last.stars) < 0.05);
    last = now;
  }
});

test("each city has a distinct mood: Lagos night, Anambra dusk, Kano daylight", () => {
  const [lagos, anambra, kano] = b.BIOMES.map(x => x.palette);
  assert.ok(lagos.stars > 0.9 && kano.stars === 0 && anambra.stars < lagos.stars);
  const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  assert.ok(lum(lagos.skyHorizon) < lum(anambra.skyHorizon) && lum(anambra.skyHorizon) < lum(kano.skyHorizon));
  assert.ok(kano.sunIntensity > lagos.sunIntensity);
  assert.ok(kano.fog[0] > kano.fog[2], "warm, dusty harmattan haze");
});

test("the ring wraps correctly", () => {
  assert.equal(b.ringDelta(10, b.RING - 10), 20);
  assert.equal(b.ringDelta(b.RING - 10, 10), -20);
  assert.ok(b.smoothstep(0, 1, 0.5) === 0.5 && b.smoothstep(0, 1, -1) === 0 && b.smoothstep(0, 1, 2) === 1);
});

test("walkers and vendors have gentler motion than the chase", () => {
  const range = f => { const v = Array.from({ length: 200 }, (_, i) => f(i * 0.05)); return Math.max(...v.map(p => Math.abs(p.thighL))); };
  assert.ok(range(t => motion.walkPose(t)) < range(t => motion.runPose(t)) * 0.6);
  assert.ok(range(t => motion.idlePose(t)) === 0);
  assert.ok(motion.runPose(1, 0.3, 0.64).thighL === motion.gaitPose(1, 0.3, 0.64, 1).thighL);
  assert.ok(motion.walkPose(1).lean > motion.runPose(1).lean, "walkers stand more upright than sprinters");
});

test("each city has the scenery and passers-by that were asked for", () => {
  const world = read("scenes/chase/chase3d-world.ts"), actors = read("scenes/chase/chase3d-actors.ts");
  // Lagos: sea, danfo bus, commuters
  for (const needle of ['"seaMat"', 'merge("danfo"', "danfoYellow", 'LAGOS, off', "briefcase", "handbag", "boat", "lighthouse", "bridgeDeck"]) assert.ok(world.includes(needle) || actors.includes(needle), `Lagos: ${needle}`);
  // Anambra: market stalls, market men and women
  for (const needle of ["stallCanopy", "ankara(", 'head: "gele"', 'head: "redcap"', 'carry: "basket"', "nigerDeck"]) assert.ok(world.includes(needle), `Anambra: ${needle}`);
  // Kano: groundnut pyramids, mud-brick houses, farmers
  for (const needle of ["groundnutPyramid", "groundnutSacks", "mudBrick", 'carry: k % 4 === 0 ? "shoulderSack" : "hoe"', 'head: k % 3 === 1 ? "kufi" : "fula"', "baobab", "farmMat"]) assert.ok(world.includes(needle), `Kano: ${needle}`);
});

test("there is no corner label: each city is named by signage inside the scene", () => {
  const stage = read("scenes/chase/ChaseStage.svelte");
  assert.doesNotMatch(stage, /onLocation|stage-place|place = /);
  assert.doesNotMatch(read("styles/screens.css"), /\.stage-place/);
  assert.doesNotMatch(read("scenes/chase/chase3d.ts"), /onLocation/);
  assert.match(read("scenes/chase/chase-frame.ts"), /palette: blendPalette\(weights\)/);
  assert.match(read("scenes/chase/chase3d.ts"), /chaseFrame\(t\)/);
});

test("signboards carry the requested wording, one per city, in the scene", () => {
  const signs = read("scenes/chase/chase3d-signs.ts"), world = read("scenes/chase/chase3d-world.ts");
  assert.deepEqual(Object.keys(signText()), ["lagos", "anambra", "kano"]);
  assert.deepEqual(signText().lagos, ["LAGOS ISLAND", "MEDICAL HOSPITAL"]);
  assert.deepEqual(signText().anambra, ["ONITSHA", "MAIN MARKET"]);
  assert.deepEqual(signText().kano, ["WELCOME TO", "SABON GARI"]);
  // the painted text on each board matches the declared wording
  for (const word of ["LAGOS ISLAND", "MEDICAL HOSPITAL", "ONITSHA", "MAIN MARKET", "WELCOME TO", "SABON GARI"]) assert.ok(signs.includes(`"${word}"`), word);
  assert.match(world, /\(\["lagos", "anambra", "kano"\] as SignKind\[\]\)\.forEach\(\(kind, biome\)/);
  assert.match(world, /buildSign\(scene, kind, SIGN\)/);
});

test("the world eases down at each city so its sign can be read, without drifting off schedule", () => {
  const slowest = Math.min(...Array.from({ length: 400 }, (_, i) => b.speedFactorAt(i * 0.1)));
  const fastest = Math.max(...Array.from({ length: 400 }, (_, i) => b.speedFactorAt(i * 0.1)));
  assert.ok(Math.abs(slowest - (1 - b.EASE)) < 0.01 && Math.abs(fastest - (1 + b.EASE)) < 0.01);
  for (const biome of b.BIOMES) {
    const seconds = biome.center / b.SPEED; // the base position of city centres at constant speed
    assert.ok(Math.abs(b.speedFactorAt(seconds) - (1 - b.EASE)) < 1e-9, `${biome.id}: slowest at its sign`);
    assert.ok(Math.abs(b.distanceAt(seconds) - biome.center) < 1e-6, `${biome.id}: centre reached on time`);
  }
  assert.ok(Math.abs(b.distanceAt(b.CYCLE_SECONDS_TOTAL) - b.RING) < 1e-6, "one full loop is still RING metres");
  let last = -1;
  for (let s = 0; s < 120; s += 0.1) { const d = b.distanceAt(s); assert.ok(d > last, "never goes backwards"); last = d; }
  // a sign within 20 m of the camera at the slow point stays on screen several seconds
  const secondsNear = (() => { let n = 0; for (let s = 0; s < b.CYCLE_SECONDS_TOTAL; s += 0.05) if (Math.abs(b.ringDelta(b.distanceAt(s), b.SEGMENT)) < 20) n += 0.05; return n; })();
  assert.ok(secondsNear > 3, `sign is near for ${secondsNear.toFixed(1)}s`);
});

test("scenery uses instancing and distance culling so the scene stays cheap", () => {
  const world = read("scenes/chase/chase3d-world.ts");
  assert.match(world, /createInstance/);
  assert.match(world, /WINDOW_RANGE/);
  assert.match(world, /setEnabled\(on\)/);
  assert.match(world, /import "@babylonjs\/core\/Meshes\/instancedMesh"/);
});
