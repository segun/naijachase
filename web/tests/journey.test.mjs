import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  AIR, LANDSCAPES, MAX_LANDSCAPES, MIN_LANDSCAPES, blendAt, coloursAt, frameAt, groundX, journeyModeOf, pickLandscapes, planJourney, weightAt
} from "../src/scenes/journey/journey-scene.ts";

const plan = (mode, seed = 1) => planJourney({ mode, from: "Lagos", to: "Kano", seed });
const steps = p => Array.from({ length: Math.ceil(p.end * 20) + 1 }, (_, i) => Math.min(p.end, i / 20));

test("every journey mode the server offers has a scene, and nothing else does", () => {
  assert.equal(journeyModeOf("fly"), "fly");
  assert.equal(journeyModeOf("drive"), "drive");
  assert.equal(journeyModeOf("hitch_ride"), "hitch");
  assert.equal(journeyModeOf("walk"), null);
});

test("there are at least ten landscapes, each with its own look", () => {
  assert.ok(LANDSCAPES.length >= 10);
  assert.equal(new Set(LANDSCAPES.map(l => l.id)).size, LANDSCAPES.length);
  for (const id of ["waterfront", "forest", "desert", "market", "farm"]) assert.ok(LANDSCAPES.some(l => l.id === id), id);
});

test("a ground journey passes through 3 to 5 different landscapes in a random order", () => {
  const seen = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const p = plan(seed % 2 ? "drive" : "hitch", seed);
    assert.ok(p.spans.length >= MIN_LANDSCAPES && p.spans.length <= MAX_LANDSCAPES, `seed ${seed}`);
    assert.equal(new Set(p.spans.map(s => s.land.id)).size, p.spans.length, "no landscape repeats");
    seen.add(p.spans.map(s => s.land.id).join());
  }
  assert.ok(seen.size > 20, "different seeds give different routes");
  assert.deepEqual(pickLandscapes(5, 4).map(l => l.id), pickLandscapes(5, 4).map(l => l.id), "the same seed gives the same route (3D and 2D must agree)");
});

test("the landscapes blend into each other instead of cutting", () => {
  const p = plan("drive", 3);
  const edge = p.spans[0].to;
  const colour = x => blendAt(p, x);
  assert.equal(colour(edge - p.blend - 1).k, 0);
  const mid = colour(edge);
  assert.ok(mid.k > 0.4 && mid.k < 0.6, "half way at the boundary");
  assert.equal(colour(edge + p.blend + 1).k, 0);
  assert.notEqual(mid.a.id, mid.b.id);
  assert.ok(weightAt(p, 0, edge) > 0.4 && weightAt(p, 0, edge) < 0.6);
  assert.equal(weightAt(p, 0, edge - p.blend * 2), 1);
  let last = coloursAt(p, edge - p.blend * 2).ground;
  const step = (a, b) => [1, 3, 5].reduce((s, i) => s + Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)), 0);
  for (let x = edge - p.blend * 2; x <= edge + p.blend * 2; x += 0.5) { const c = coloursAt(p, x).ground; assert.ok(step(c, last) < 40, `the ground colour jumps at ${x}`); last = c; }
});

test("a ground journey starts at the vehicle's home, drives through every landscape and stops at the billboard", () => {
  for (const mode of ["drive", "hitch"]) {
    const p = plan(mode, 9);
    assert.equal(groundX(p, 0), 0);
    assert.equal(groundX(p, p.go), 0, "still while the player boards");
    assert.ok(Math.abs(groundX(p, p.end) - p.distance) < 1e-6);
    let prev = 0;
    for (const t of steps(p)) { const x = groundX(p, t); assert.ok(x >= prev - 1e-9, "never reverses"); prev = x; }
    const stages = new Set(steps(p).map(t => frameAt(p, t).stage));
    assert.deepEqual([...stages], ["depart", "travel", "arrive"]);
    assert.equal(p.props.filter(x => x.kind === "billboard").length, 1);
    assert.equal(p.props.find(x => x.kind === "billboard").text, "Welcome to Kano");
    assert.equal(p.props.some(x => x.kind === (mode === "drive" ? "garage" : "busstop")), true);
    const last = frameAt(p, p.end);
    assert.equal(last.caption, "Welcome to Kano.");
  }
});

test("driving shows the car, hitching the minibus, and the player is seen getting in", () => {
  const car = plan("drive"), bus = plan("hitch");
  assert.equal(frameAt(car, 1).vehicle.kind, "car");
  assert.equal(frameAt(bus, 1).vehicle.kind, "bus");
  assert.ok(frameAt(car, 1).player.x < -1, "walking in from the left");
  const seated = frameAt(car, car.go + 5);
  assert.equal(seated.player.sit, 1, "the driver stays seated in the open car");
  assert.ok(Math.abs(seated.player.x - (seated.vehicle.x - 0.25)) < 1e-6, "and moves with it");
  assert.equal(frameAt(bus, bus.go + 5).player.visible, false, "inside the minibus");
  assert.ok(frameAt(bus, 2.8).vehicle.door > 0.9, "the door opens for the player");
});

test("flying: the airport is named after the source state, then boarding, taxi, take-off, landing and the destination airport", () => {
  const p = plan("fly");
  const order = [];
  for (const t of steps(p)) { const s = frameAt(p, t).stage; if (order.at(-1) !== s) order.push(s); }
  assert.deepEqual(order, ["airport", "boarding", "taxi", "takeoff", "landing", "deplane", "welcome"]);
  const sign = p.props.filter(x => x.kind === "terminal").map(x => x.text);
  assert.deepEqual(sign, ["Lagos Airport", "Welcome to Kano Airport"]);
  assert.match(frameAt(p, 1).caption, /^Lagos Airport/);
  assert.equal(frameAt(p, p.end).caption, "Welcome to Kano Airport.");
});

test("flying: the boarding pass is shown to the cabin crew before the player climbs in", () => {
  const p = plan("fly");
  const frames = steps(p).map(t => frameAt(p, t)).filter(f => f.stage === "boarding");
  const shown = frames.findIndex(f => f.player.pass > 0.9);
  const climbing = frames.findIndex(f => f.player.y > 0.3);
  assert.ok(shown >= 0 && climbing > shown, "pass first, then the stairs");
  assert.ok(frames.every(f => f.hostess && f.hostess.alpha === 1), "the crew member waits at the top");
  const top = frames.find(f => f.player.y >= AIR.sill - 0.01);
  assert.ok(top, "the player reaches the door");
  assert.ok(frames.at(-1).player.alpha < 0.1, "and goes inside");
  assert.ok(frames.some(f => f.caption === "Showing the boarding pass to the cabin crew."));
});

test("flying: the plane taxis, speeds up, lifts off and later lands and stops at the gate", () => {
  const p = plan("fly");
  const planeAt = t => frameAt(p, t).vehicle;
  const taxi = steps(p).filter(t => frameAt(p, t).stage === "taxi");
  assert.ok(planeAt(taxi.at(-1)).x > planeAt(taxi[0]).x + 8);
  assert.ok(taxi.every(t => planeAt(t).y === 0), "wheels on the ground while taxiing");
  const takeoff = steps(p).filter(t => frameAt(p, t).stage === "takeoff");
  assert.ok(planeAt(takeoff.at(-1)).y > 8, "airborne at the end of take-off");
  assert.ok(planeAt(takeoff.at(-1)).pitch > 0.15, "nose up");
  assert.equal(planeAt(takeoff.at(-1)).gearDown < 0.1, true, "wheels up");
  const landing = steps(p).filter(t => frameAt(p, t).stage === "landing");
  assert.ok(planeAt(landing[0]).y > 10, "arrives from the air");
  assert.ok(Math.abs(planeAt(landing.at(-1)).x - AIR.landingStop) < 0.5 && planeAt(landing.at(-1)).y === 0, "stops on the ground at the gate");
  const xs = landing.map(t => planeAt(t).x);
  assert.ok(xs.every((x, i) => i === 0 || x >= xs[i - 1] - 1e-9), "never rolls backwards");
});

test("flying: the player steps down and walks towards the terminal that welcomes them", () => {
  const p = plan("fly");
  const frames = steps(p).map(t => frameAt(p, t)).filter(f => f.stage === "deplane" || f.stage === "welcome");
  const seen = frames.filter(f => f.player);
  assert.ok(seen[0].player.y > 1, "appears at the door");
  assert.ok(seen.some(f => f.player.y > 0.3 && f.player.y < 1.2), "on the stairs");
  const end = seen.at(-1).player;
  assert.equal(end.y, 0);
  assert.ok(end.x < AIR.landingStop, "towards the terminal");
  const terminal = p.props.find(x => x.text === "Welcome to Kano Airport");
  assert.ok(Math.abs(end.x - terminal.x) < 12, "the sign is where they end up");
});

test("every scene fades in, never ends on black, and dips only at its cuts", () => {
  for (const mode of ["drive", "hitch", "fly"]) {
    const p = plan(mode);
    assert.equal(frameAt(p, 0).fade, 0);
    const bright = steps(p).filter(t => frameAt(p, t).fade >= 0.99);
    assert.ok(bright.length > steps(p).length * 0.7, "mostly fully visible");
    assert.ok(frameAt(p, p.end).fade <= 0.01, "fades out at the end");
    for (const c of p.cuts) assert.equal(frameAt(p, c).fade, 0, "dips fully at the cut");
    assert.ok(p.settle < p.end, "reduced motion starts at the arrival shot");
  }
});

test("the camera and the vehicle never jump except across a dip to black", () => {
  for (const mode of ["drive", "hitch", "fly"]) {
    const p = plan(mode);
    let prev = frameAt(p, 0);
    for (const t of steps(p).slice(1)) {
      const f = frameAt(p, t);
      const dark = p.cuts.some(c => Math.abs(t - c) < 0.6);
      if (!dark) {
        assert.ok(Math.abs(f.cam.x - prev.cam.x) < 4, `${mode}: camera jumped at ${t}`);
        assert.ok(Math.abs(f.vehicle.x - prev.vehicle.x) < 4, `${mode}: vehicle jumped at ${t}`);
      }
      prev = f;
    }
  }
});

test("the renderers read the same frames, so the 3D and 2D files stay in step", () => {
  for (const file of ["chase3d-journey.ts", "journey-2d.ts"]) {
    const src = fs.readFileSync(new URL(`../src/scenes/journey/${file}`, import.meta.url), "utf8");
    assert.match(src, /frameAt/, file);
    assert.doesNotMatch(src, /Math\.random/, `${file} must not decide anything itself`);
  }
  const scene = fs.readFileSync(new URL("../src/scenes/journey/journey-scene.ts", import.meta.url), "utf8");
  assert.doesNotMatch(scene, /babylon/i, "the rules import no graphics library");
});

test("no prop sits in the way of the garage, the bus park or the billboard", () => {
  const p = plan("hitch", 4);
  for (const set of p.props.filter(x => ["busstop", "billboard"].includes(x.kind))) {
    const clutter = p.props.filter(x => x !== set && x.span >= 0 && x.z <= 12 && Math.abs(x.x - set.x) < 6);
    assert.deepEqual(clutter, []);
  }
});

test("travelling plays the journey scene before the desk, and the desk gets the short return", async () => {
  const { controller, caseFile } = await import("./controller-runtime.mjs");
  const app = controller();
  app.game = caseFile();
  app.pendingLead = "market";
  for (const [mode, expected] of [["drive", "drive"], ["hitch_ride", "hitch"], ["fly", "fly"]]) {
    app.startJourney("Lagos", "Kano", mode);
    assert.equal(app.screen, "journey");
    assert.deepEqual({ ...app.journey, seed: 0 }, { from: "Lagos", to: "Kano", mode: expected, seed: 0 });
    assert.ok(Number.isInteger(app.journey.seed));
    app.leaveJourney();
    assert.equal(app.journey, null);
    assert.equal(app.screen, "investigate");
    assert.equal(app.returning, true);
    assert.equal(app.pendingLead, "");
  }
});

test("a journey with no scene, or to the same place, goes straight to the desk; a finished case goes to its results", async () => {
  const { controller, caseFile } = await import("./controller-runtime.mjs");
  const app = controller();
  app.game = caseFile();
  app.startJourney("Lagos", "Kano", "teleport");
  assert.equal(app.screen, "investigate"); assert.equal(app.journey, null);
  app.startJourney("Kano", "Kano", "fly");
  assert.equal(app.journey, null);
  app.game = { ...app.game, state: { ...app.game.state, outcome: "won" } };
  app.startJourney("Lagos", "Kano", "fly");
  app.leaveJourney();
  assert.equal(app.screen, "results"); assert.equal(app.returning, false);
});

test("the travel screen starts the journey with where the player was, not where they are now", () => {
  const read = p => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
  const travel = read("screens/case/Travel.svelte");
  assert.match(travel, /const destination = selected, origin = here;/);
  assert.match(travel, /app\.startJourney\(origin, destination, quote\.mode\)/);
  assert.doesNotMatch(travel, /app\.go\("investigate"\)/);
  assert.match(read("App.svelte"), /app\.screen === "journey" && app\.journey/);
});

// ---- The weekly "show travel route" loop ----
import { circ, propX } from "../src/scenes/journey/journey-scene.ts";
const loopPlan = (mode, seed = 2) => planJourney({ mode, from: "Lagos", to: "Kano", seed, loop: true });

test("the route view has no departure and no arrival and never ends", () => {
  for (const mode of ["drive", "hitch", "fly"]) {
    const p = loopPlan(mode);
    assert.equal(p.loop, true); assert.equal(p.end, Infinity);
    for (const t of [0.7, 5, 60, 1000, 123456]) {
      const f = frameAt(p, t);
      assert.equal(f.stage, "travel"); assert.equal(f.fade, 1); assert.equal(f.caption, "On the way to Kano.");
    }
    assert.equal(p.props.some(x => ["garage", "busstop", "parkedbus", "billboard", "terminal"].includes(x.kind)), false, "no set pieces");
  }
});

test("driving and hitching loop through many different landscapes, with the vehicle already moving", () => {
  for (const mode of ["drive", "hitch"]) {
    const p = loopPlan(mode);
    assert.ok(p.spans.length >= 6 && new Set(p.spans.map(s => s.land.id)).size === p.spans.length);
    assert.equal(frameAt(p, 0.7).vehicle.kind, mode === "drive" ? "car" : "bus");
    assert.ok(frameAt(p, 3).vehicle.x > frameAt(p, 2).vehicle.x || frameAt(p, 3).vehicle.x < frameAt(p, 2).vehicle.x - p.period / 2, "keeps moving");
    assert.equal(frameAt(p, 9).player.visible, mode === "drive", "the driver is seen, the minibus passenger is not");
    assert.equal(p.period % 8, 0, "road dashes line up across the seam");
  }
});

test("the loop is seamless: the picture just before the seam equals the picture just after it", () => {
  for (const mode of ["drive", "hitch", "fly"]) {
    const p = loopPlan(mode);
    const lap = p.period / p.speed;
    const before = frameAt(p, lap * 3 - 0.01), after = frameAt(p, lap * 3 + 0.01);
    assert.ok(Math.abs(circ(after.cam.x - before.cam.x, p.period)) < 1, "the camera moves on by a few centimetres");
    for (const dx of [-60, -20, 0, 20, 60]) assert.equal(coloursAt(p, before.cam.x + dx).ground, coloursAt(p, before.cam.x + p.period + dx).ground, "the ground repeats");
    for (const prop of p.props.slice(0, 40)) assert.ok(Math.abs(propX(p, prop, 1) - 1) <= p.period / 2 + 1e-9, "the nearest copy is drawn");
  }
});

test("landscape colours on the loop blend smoothly across the seam too", () => {
  const p = loopPlan("drive", 8);
  const step = (a, b) => [1, 3, 5].reduce((s, i) => s + Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)), 0);
  let last = coloursAt(p, -40).ground;
  for (let x = -40; x <= 40; x += 0.5) { const c = coloursAt(p, x).ground; assert.ok(step(c, last) < 40, `jump at ${x}`); last = c; }
  for (let i = 0; i < p.spans.length; i++) assert.ok(weightAt(p, i, p.spans[i].from + p.spans[i].to > 0 ? (p.spans[i].from + p.spans[i].to) / 2 : 0) > 0.99);
});

test("flying in the route view is a plane in the sky with clouds of different sizes at different heights and depths", () => {
  const p = loopPlan("fly");
  const clouds = p.props.filter(x => x.kind === "cloud");
  assert.equal(clouds.length, p.props.length, "nothing but clouds");
  assert.ok(clouds.length >= 100);
  const sizes = clouds.map(c => c.scale), heights = clouds.map(c => c.y), depths = clouds.map(c => c.z);
  assert.ok(Math.max(...sizes) / Math.min(...sizes) > 4, "very different sizes");
  assert.ok(Math.max(...heights) - Math.min(...heights) > 40 && Math.max(...depths) - Math.min(...depths) > 100);
  assert.notDeepEqual(loopPlan("fly", 3).props.map(c => c.x), loopPlan("fly", 4).props.map(c => c.x), "random positions");
  const f = frameAt(p, 8).vehicle;
  assert.equal(f.kind, "plane"); assert.equal(f.gearDown, 0); assert.equal(f.door, 0); assert.ok(Math.abs(f.y) < 0.5 && Math.abs(f.pitch) < 0.05);
  assert.equal(frameAt(p, 8).player, null);
});

test("the weekly play screen offers the route view, never changes the wait, and Esc returns to the text", () => {
  const read = p => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
  const weekly = read("screens/social/WeeklyPlay.svelte");
  assert.match(weekly, /Show travel route/);
  assert.match(weekly, /loop startHour=/);
  assert.match(weekly, /onclose=\{\(\) => \(route = null\)\}/);
  assert.match(weekly, /You have arrived in/);
  const scene = read("scenes/journey/JourneyScene.svelte");
  assert.match(scene, /if \(loop\) onclose\?\.\(\); else app\.leaveJourney\(\)/);
  assert.match(scene, /if \(loop \|\| failure \|\| !ready\) finish\(\); else skip\(\)/, "Esc closes instead of skipping");
});
