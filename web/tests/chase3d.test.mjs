import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as motion from "../src/scenes/chase/chase-motion.ts";
import { chaseFrame, OFFICERS } from "../src/scenes/chase/chase-frame.ts";
import { createChase2d } from "../src/scenes/chase/chase-2d.ts";

const read = p => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const samples = Array.from({ length: 200 }, (_, i) => motion.runPose(i * 0.013));

test("the run cycle is periodic and the legs alternate", () => {
  const a = motion.runPose(0.1), b = motion.runPose(0.1 + motion.CYCLE_SECONDS);
  for (const key of Object.keys(a)) assert.ok(Math.abs(a[key] - b[key]) < 1e-9, key);
  for (const p of samples) assert.ok(Math.abs(p.thighL + p.thighR) < 1e-9, "thighs are in antiphase");
  for (const p of samples) assert.ok(Math.abs(p.armL + p.armR) < 1e-9, "arms are in antiphase");
});

test("poses stay within human joint limits", () => {
  for (const p of samples) {
    assert.ok(Math.abs(p.thighL) <= 0.9 && Math.abs(p.thighR) <= 0.9);
    assert.ok(p.shinL <= 0 && p.shinL >= -1.5, "knees only bend backwards");
    assert.ok(p.shinR <= 0 && p.shinR >= -1.5);
    assert.ok(p.elbowL > 0.9 && p.elbowL < 1.4, "elbows stay bent while running");
    assert.ok(p.lean < 0 && p.lean > -0.3, "leaning forward");
    assert.ok(Math.abs(p.bodyY) < 0.06);
  }
});

test("phase offsets make the officers run out of step", () => {
  assert.notEqual(motion.runPose(1, 0).thighL, motion.runPose(1, 2).thighL);
});

test("the gap oscillates within its amplitude", () => {
  const values = Array.from({ length: 100 }, (_, i) => motion.gapOffset(i * 0.2, 4.2, 0.9, 0.4));
  assert.ok(Math.max(...values) <= 0.9 && Math.min(...values) >= -0.9);
  assert.ok(Math.max(...values) > 0.8 && Math.min(...values) < -0.8);
});

test("the scenery treadmill always wraps inside its span and moves toward -x", () => {
  const span = 80;
  for (let t = 0; t < 60; t += 0.37) for (const base of [-40, -13, 0, 22, 39]) {
    const x = motion.treadmillX(base, t, 9, span);
    assert.ok(x >= -span / 2 && x < span / 2, `x=${x}`);
  }
  assert.ok(Math.abs(motion.treadmillX(10, 0.1, 9, span) - (10 - 0.9)) < 1e-9);
  assert.ok(Math.abs(motion.treadmillX(0, 0, 9, span) - motion.treadmillX(0, span / 9, 9, span)) < 1e-9);
});

test("police lights alternate red then blue and never overlap", () => {
  let red = 0, blue = 0;
  for (let t = 0; t < 12; t += 0.05) {
    const s = motion.sirenLevels(t);
    assert.ok(!(s.red && s.blue));
    red += s.red; blue += s.blue;
  }
  assert.ok(red > 40 && blue > 40);
});

test("the 3D scene keeps the officers in black, three of them, and the thief masked with a sack", () => {
  const code = read("scenes/chase/chase3d.ts");
  assert.equal(OFFICERS.length, 3);
  assert.doesNotMatch(code, /#1d4fa3|#10285a|#0a1a3d/i, "no ceremonial blue uniforms");
  assert.match(code, /top: "#232a31"/);
  assert.match(code, /head: "mask", carry: "sack"/);
  assert.doesNotMatch(code, /Stop, thief|speech|bubble/i);
});

test("3D is an enhancement: skipped for reduced motion, falls back to 2D, and can be switched off", () => {
  const stage = read("scenes/chase/ChaseStage.svelte");
  assert.match(read("scenes/shared/scene-capability.ts"), /prefers-reduced-motion: reduce/);
  assert.match(read("scenes/shared/scene-capability.ts"), /dataset\.motion === "reduced"/);
  assert.match(stage, /console\.error\("The login chase could not start; using 2D\."/);
  assert.match(stage, /<DetailControl compact \/>/, "all three detail levels remain selectable");
  assert.match(stage, /aria-hidden="true"/);
  assert.match(stage, /handle\?\.dispose\(\)/, "WebGL resources are released when leaving the screen");
});

test("both chase renderers share deterministic city, camera and running progression", () => {
  for (const t of [0, 1, 15, 31, 47, 1000]) {
    const frame = chaseFrame(t);
    assert.deepEqual(frame, chaseFrame(t));
    assert.equal(frame.runners.length, 4);
    assert.ok(frame.camera.every(Number.isFinite));
    assert.ok(frame.runners.every(r => Number.isFinite(r.cycle) && Number.isFinite(r.x)));
    assert.ok(Math.abs(frame.weights.reduce((a, b) => a + b) - 1) < 1e-9);
  }
  for (const f of ["chase3d.ts", "chase-2d.ts"]) assert.match(read(`scenes/chase/${f}`), /chaseFrame\(/);
  assert.match(read("scenes/chase/ChaseStage.svelte"), /models, signal: controller\.signal, seconds/);
  assert.match(read("scenes/chase/chase3d.ts"), /webglcontextlost/);
});

test("chase models are gated and failed loads retain their procedural counterparts", () => {
  const scene = read("scenes/chase/chase3d.ts"), actors = read("scenes/chase/chase3d-model-actor.ts");
  assert.match(scene, /if \(options\.models\) await Promise\.all/);
  assert.match(scene, /"masked_thief", "run"/);
  assert.match(scene, /"crowd_police", "run"/);
  assert.match(actors, /if \(!model\) return/);
  assert.match(actors, /if \(!clip\)/);
  assert.match(actors, /hips\.position\.x = origin\.x; hips\.position\.z = origin\.z/);
  assert.match(read("scenes/chase/chase3d-world.ts"), /ready: models \? setup\(\) : Promise\.resolve\(\)/);
});

test("the Canvas 2D chase draws a full loop without invalid projection or ellipse radii", t => {
  const names = ["devicePixelRatio", "requestAnimationFrame", "cancelAnimationFrame", "ResizeObserver"];
  const saved = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
  t.after(() => names.forEach((name, i) => {
    if (saved[i]) Object.defineProperty(globalThis, name, saved[i]);
    else delete globalThis[name];
  }));
  let next, time = 0, draws = 0, disconnects = 0;
  Object.assign(globalThis, {
    devicePixelRatio: 1,
    requestAnimationFrame(cb) { next = cb; return 1; },
    cancelAnimationFrame() { next = undefined; },
    ResizeObserver: class { observe() {} disconnect() { disconnects++; } }
  });
  const g = new Proxy({}, {
    get(_, key) {
      if (key === "createLinearGradient") return () => ({ addColorStop() {} });
      return (...args) => {
        args.filter(v => typeof v === "number").forEach(v => assert.ok(Number.isFinite(v), `${String(key)}: finite coordinates`));
        if (key === "ellipse") assert.ok(args[2] >= 0 && args[3] >= 0, "ellipse radii cannot be negative");
        if (key === "fillRect") draws++;
      };
    },
    set() { return true; }
  });
  for (const [width, height] of [[1440, 1000], [390, 844]]) {
    const canvas = { clientWidth: width, clientHeight: height, width: 0, height: 0, getContext: () => g };
    const faults = [];
    const handle = createChase2d(canvas, () => time, false, error => faults.push(error));
    for (time = 0; time < 50; time += .2) next();
    assert.deepEqual(faults, []);
    assert.equal(canvas.width, width);
    assert.equal(canvas.height, height);
    handle.dispose();
    assert.equal(next, undefined);
  }
  const canvas = { clientWidth: 390, clientHeight: 844, width: 0, height: 0, getContext: () => g };
  const reduced = createChase2d(canvas, () => time, true, error => assert.fail(String(error)));
  assert.equal(next, undefined, "reduced motion does not animate");
  reduced.dispose();
  assert.equal(disconnects, 3);
  assert.ok(draws > 1000);
});
