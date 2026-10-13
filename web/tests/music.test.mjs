import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as score from "../src/music/music-score.ts";
import { DEFAULT_TRACK_ID, TRACK_INFO, isTrackId } from "../src/music/music-catalogue.ts";
import { component, components, allComponents } from "./helpers.mjs";

const read = p => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
const stepsOf = track => Array.from({ length: track.loopSteps }, (_, i) => score.trackStep(track, i));
const notesOf = hit => (hit.n === undefined ? [] : typeof hit.n === "number" ? [hit.n] : [...hit.n]);
const night = score.findTrack("night-pursuit");
const steps = stepsOf(night);

test("there are ten tunes, each with a unique id and name, and Night Pursuit stays the default", () => {
  assert.equal(score.TRACKS.length, 10);
  assert.equal(TRACK_INFO.length, 10);
  assert.equal(new Set(TRACK_INFO.map(t => t.id)).size, 10);
  assert.equal(new Set(TRACK_INFO.map(t => t.name)).size, 10);
  assert.deepEqual(score.TRACKS.map(({ id, name, mood }) => ({ id, name, mood })), TRACK_INFO.map(({ id, name, mood }) => ({ id, name, mood })));
  assert.equal(DEFAULT_TRACK_ID, "night-pursuit");
  assert.equal(score.DEFAULT_TRACK.id, DEFAULT_TRACK_ID);
  assert.equal(score.findTrack("nonsense").id, DEFAULT_TRACK_ID);
  assert.equal(score.findTrack(null).id, DEFAULT_TRACK_ID);
  assert.equal(isTrackId("market-day"), true);
  assert.equal(isTrackId("nonsense"), false);
});

test("the tunes differ in tempo and in what they play, so they really sound different", () => {
  assert.ok(new Set(score.TRACKS.map(t => t.bpm)).size >= 9, "distinct tempos");
  const fingerprints = score.TRACKS.map(t => JSON.stringify(stepsOf(t)));
  assert.equal(new Set(fingerprints).size, 10);
  for (const t of score.TRACKS) {
    assert.ok(t.bpm >= 70 && t.bpm <= 160, `${t.id} tempo`);
    assert.ok(Math.abs(t.stepSeconds * 4 * t.bpm - 60) < 1e-9);
    assert.equal(t.loopSteps, t.bars * score.STEPS_PER_BAR);
  }
});

test("Night Pursuit keeps its tempo and key", () => {
  assert.equal(night.bpm, 126);
  assert.equal(night.loopSteps, 128);
  const roots = [0, 2, 4, 6].map(bar => steps[bar * 16].find(h => h.v === "bass").n);
  assert.deepEqual(roots, [40, 36, 33, 35]); // Em - C - Am - B7
});

test("every tune loops seamlessly and is deterministic", () => {
  for (const t of score.TRACKS) {
    assert.deepEqual(score.trackStep(t, 5), score.trackStep(t, 5 + t.loopSteps * 3), t.id);
    assert.deepEqual(score.trackStep(t, -1), score.trackStep(t, t.loopSteps - 1), t.id);
  }
});

test("Night Pursuit has rhythm, bass, harmony, melody and a build into the loop point", () => {
  const voices = new Set(steps.flat().map(h => h.v));
  for (const v of ["kick", "snare", "clap", "hat", "bass", "pad", "stab", "lead", "tick", "hit", "riser"]) assert.ok(voices.has(v), v);
  assert.equal(steps[0].some(h => h.v === "hit"), true);
  assert.equal(steps[112].some(h => h.v === "riser"), true);
  assert.equal(steps[120].some(h => h.v === "kick"), false, "the last bar drops the kick for the build");
  assert.ok(steps.slice(112).filter(s => s.some(h => h.v === "snare")).length >= 3, "closing snare fill");
});

test("every tune has a bass line, harmony and a melody", () => {
  for (const t of score.TRACKS) {
    const voices = new Set(stepsOf(t).flat().map(h => h.v));
    assert.ok(voices.has("bass"), `${t.id} bass`);
    assert.ok(voices.has("pad") || voices.has("stab"), `${t.id} harmony`);
    assert.ok(voices.has("lead") || voices.has("bell") || voices.has("pluck"), `${t.id} melody`);
  }
});

test("pitches, velocities and lengths stay in sensible ranges in every tune", () => {
  for (const t of score.TRACKS) {
    for (const hit of stepsOf(t).flat()) {
      for (const n of notesOf(hit)) assert.ok(n >= 24 && n <= 100, `${t.id} note ${n}`);
      assert.ok((hit.vel ?? 1) > 0 && (hit.vel ?? 1) <= 1, `${t.id} velocity`);
      assert.ok((hit.len ?? 1) > 0 && (hit.len ?? 1) <= 32, `${t.id} length`);
    }
  }
  assert.equal(Math.round(score.midiToFreq(69)), 440);
});

test("music starts on the first screen and keeps playing after login", () => {
  const app = read("App.svelte");
  assert.match(app, /music\.setActive\(!app\.booting\)/);
  assert.doesNotMatch(app, /setActive\([^)]*signedIn/);
  const shell = read("ui/Shell.svelte");
  assert.match(shell, /\{#if app\.signedIn\}<div class="music-dock"[^>]*><MusicToggle music=\{app\.music\} \/><\/div>\{\/if\}/, "signed-in players keep the controls");
  assert.match(shell, /<div class="music-side"><MusicToggle/, "and so does the side rail");
});

test("music needs a gesture, is an on/off switch, and lets the player choose a tune", () => {
  const music = read("music/music.svelte.ts");
  assert.match(music, /userActivation/);
  assert.match(music, /"pointerdown"/);
  assert.match(music, /localStorage\.getItem\("nc-music"\) !== "off"/);
  assert.match(music, /toggle\(\)/);
  assert.match(music, /choose\(id: string\)/);
  assert.match(music, /nc-music-track/);
  for (const screen of ["Landing", "AuthPanel"]) assert.match(component(screen), /MusicToggle/);
  const toggle = read("music/MusicToggle.svelte");
  assert.match(toggle, /aria-pressed/);
  assert.match(toggle, /aria-label="Music"/);
  assert.match(toggle, /aria-expanded/);
  assert.match(toggle, /music\.tracks/);
  assert.match(toggle, /music\.choose/);
});

test("music is synthesised, so no audio files are shipped or downloaded", () => {
  const all = ["music/music-engine.ts", "music/music-score.ts", "music/music-catalogue.ts", "music/music.svelte.ts", "music/MusicToggle.svelte"].map(read).join("\n");
  assert.doesNotMatch(all, /\.(mp3|ogg|wav|m4a)/i);
  assert.doesNotMatch(all, /new Audio\(|<audio|fetch\(/);
});

test("sign-in screens fit the viewport on desktop and the chase scene is decorative", () => {
  const css = ["screens.css", "base.css"].map(f => read(`styles/${f}`)).join("\n");
  assert.match(css, /@media \(min-width: 961px\) and \(min-height: 620px\)[\s\S]*\.auth \{[^}]*overflow: hidden/);
  assert.match(css, /\.form-grid/);
  const scene = read("scenes/chase/ChaseScene.svelte");
  assert.match(scene, /aria-hidden="true"/);
  assert.match(read("screens/entry/AuthPanel.svelte"), /<ChaseStage \/>/);
  assert.match(read("scenes/chase/ChaseStage.svelte"), /<ChaseScene \{seconds\}/, "the 2D scene is always the base and the fallback");
  assert.match(css, /prefers-reduced-motion/);
});

test("the chase scene shows a team of black-uniformed officers and no speech", () => {
  const scene = read("scenes/chase/chase-2d.ts");
  const officers = [...read("scenes/chase/chase-frame.ts").matchAll(/name: "cop-[a-c]"/g)].length;
  assert.ok(officers >= 3 && officers <= 4, `expected 3-4 officers, found ${officers}`);
  assert.doesNotMatch(scene, /Stop, thief|bubble|<text[^>]*>[A-Za-z]/);
  assert.doesNotMatch(scene, /#1d4fa3|#10285a|#0a1a3d/i, "blue (ceremonial) uniform colours");
  assert.match(scene, /#232a31/);
});
