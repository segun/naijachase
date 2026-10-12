import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as motion from "../src/scenes/chase/chase-motion.ts";

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
  assert.equal([...code.matchAll(/name: "cop-[a-c]"/g)].length, 3);
  assert.doesNotMatch(code, /#1d4fa3|#10285a|#0a1a3d/i, "no ceremonial blue uniforms");
  assert.match(code, /top: "#232a31"/);
  assert.match(code, /head: "mask", carry: "sack"/);
  assert.doesNotMatch(code, /Stop, thief|speech|bubble/i);
});

test("3D is an enhancement: skipped for reduced motion, falls back to 2D, and can be switched off", () => {
  const stage = read("scenes/chase/ChaseStage.svelte");
  assert.match(read("scenes/shared/scene-capability.ts"), /prefers-reduced-motion: reduce/);
  assert.match(read("scenes/shared/scene-capability.ts"), /dataset\.motion === "reduced"/);
  assert.match(stage, /\.catch\(\(\) => \{ if \(!cancelled\) failed = true; \}\)/);
  assert.match(stage, /detail\.set\("simple"\)/, "the 2D button chooses the simple picture detail");
  assert.match(stage, /aria-pressed/);
  assert.match(stage, /aria-hidden="true"/);
  assert.match(stage, /handle\?\.dispose\(\)/, "WebGL resources are released when leaving the screen");
});
