import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as score from "../src/lib/music-score.ts";

const read = p => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const steps = Array.from({ length: score.LOOP_STEPS }, (_, i) => score.trackStep(i));
const notesOf = hit => (hit.n === undefined ? [] : typeof hit.n === "number" ? [hit.n] : [...hit.n]);

test("Night Pursuit is the only track and keeps its tempo and key", () => {
  assert.equal(score.BPM, 126);
  assert.equal(score.LOOP_STEPS, 128);
  assert.ok(Math.abs(score.STEP_SECONDS * 4 * score.BPM - 60) < 1e-9);
  for (const gone of ["TRACKS", "findTrack", "DEFAULT_TRACK", "swingOffset"]) assert.equal(score[gone], undefined, gone);
  const roots = [0, 2, 4, 6].map(bar => steps[bar * 16].find(h => h.v === "bass").n);
  assert.deepEqual(roots, [40, 36, 33, 35]); // Em - C - Am - B7
});

test("the track loops seamlessly and is deterministic", () => {
  assert.deepEqual(score.trackStep(5), score.trackStep(5 + score.LOOP_STEPS * 3));
  assert.deepEqual(score.trackStep(-1), score.trackStep(score.LOOP_STEPS - 1));
});

test("it has rhythm, bass, harmony, melody and a build into the loop point", () => {
  const voices = new Set(steps.flat().map(h => h.v));
  for (const v of ["kick", "snare", "clap", "hat", "bass", "pad", "stab", "lead", "tick", "hit", "riser"]) assert.ok(voices.has(v), v);
  assert.equal(steps[0].some(h => h.v === "hit"), true);
  assert.equal(steps[112].some(h => h.v === "riser"), true);
  assert.equal(steps[120].some(h => h.v === "kick"), false, "the last bar drops the kick for the build");
  assert.ok(steps.slice(112).filter(s => s.some(h => h.v === "snare")).length >= 3, "closing snare fill");
});

test("pitches, velocities and lengths stay in sensible ranges", () => {
  for (const hit of steps.flat()) {
    for (const n of notesOf(hit)) assert.ok(n >= 24 && n <= 100, `note ${n}`);
    assert.ok((hit.vel ?? 1) > 0 && (hit.vel ?? 1) <= 1);
    assert.ok((hit.len ?? 1) > 0 && (hit.len ?? 1) <= 32);
  }
  assert.equal(Math.round(score.midiToFreq(69)), 440);
});

test("menu music plays only before the game, needs a gesture, and is a simple on/off switch", () => {
  const app = read("App.svelte");
  assert.match(app, /music\.setActive\(!app\.booting && !app\.signedIn && \(app\.screen === "welcome" \|\| app\.screen === "cases"\)\)/);
  const music = read("lib/music.svelte.ts");
  assert.match(music, /userActivation/);
  assert.match(music, /"pointerdown"/);
  assert.match(music, /localStorage\.getItem\("nc-music"\) !== "off"/);
  assert.match(music, /toggle\(\)/);
  assert.doesNotMatch(music, /choose|trackId|nc-music-track/);
  for (const screen of ["Landing", "AuthPanel"]) assert.match(read(`components/${screen}.svelte`), /MusicToggle/);
  const toggle = read("components/MusicToggle.svelte");
  assert.match(toggle, /aria-pressed/);
  assert.match(toggle, /aria-label="Menu music"/);
  assert.doesNotMatch(toggle, /aria-expanded|music-menu|tracks/);
});

test("music is synthesised, so no audio files are shipped or downloaded", () => {
  const all = ["lib/music-engine.ts", "lib/music-score.ts", "lib/music.svelte.ts", "components/MusicToggle.svelte"].map(read).join("\n");
  assert.doesNotMatch(all, /\.(mp3|ogg|wav|m4a)/i);
  assert.doesNotMatch(all, /new Audio\(|<audio|fetch\(/);
});

test("sign-in screens fit the viewport on desktop and the chase scene is decorative", () => {
  const css = ["screens.css", "base.css"].map(f => read(`styles/${f}`)).join("\n");
  assert.match(css, /@media \(min-width: 961px\) and \(min-height: 620px\)[\s\S]*\.auth \{[^}]*overflow: hidden/);
  assert.match(css, /\.form-grid/);
  const scene = read("components/ChaseScene.svelte");
  assert.match(scene, /aria-hidden="true"/);
  assert.match(read("components/AuthPanel.svelte"), /<ChaseScene \/>/);
  assert.match(css, /prefers-reduced-motion/);
});

test("the chase scene shows a team of black-uniformed officers and no speech", () => {
  const scene = read("components/ChaseScene.svelte");
  const officers = [...scene.matchAll(/\{ cls: "c\d"/g)].length;
  assert.ok(officers >= 3 && officers <= 4, `expected 3-4 officers, found ${officers}`);
  assert.doesNotMatch(scene, /Stop|bubble|<text[^>]*>[A-Za-z]/);
  assert.doesNotMatch(scene, /#1d4fa3|#10285a|#0a1a3d/i, "blue (ceremonial) uniform colours");
  assert.match(scene, /#262c33/);
});
