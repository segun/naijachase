// Original synthesised menu music for the pre-game screens: "Night Pursuit", a brooding cinematic thriller
// (E minor, 126 BPM). It is pure data so it can be unit-tested; music-engine.ts turns the events into sound
// with the Web Audio API.
export type Voice = "kick" | "snare" | "clap" | "hat" | "tick" | "bass" | "stab" | "pad" | "lead" | "hit" | "riser";

/** One sound at one step. `n` is a MIDI note (or chord), `len` is in steps, `vel` is 0-1. */
export type Hit = { v: Voice; n?: number | readonly number[]; len?: number; vel?: number };

export const BPM = 126;
export const BARS = 8;
export const STEPS_PER_BAR = 16;
export const LOOP_STEPS = BARS * STEPS_PER_BAR;
export const STEP_SECONDS = 60 / BPM / 4;
export const midiToFreq = (note: number): number => 440 * 2 ** ((note - 69) / 12);

const has = (steps: readonly number[], at: number) => steps.includes(at);
type Melody = readonly (readonly [step: number, note: number, len: number])[];
const melodyAt = (melody: Melody, at: number): Hit[] =>
  melody.filter(([s]) => s === at).map(([, n, len]) => ({ v: "lead", n, len }));

// Em - C - Am - B7, two bars each.
const CHORDS = [
  { root: 40, chord: [59, 64, 67, 71], lead: [[0, 76, 5], [6, 74, 2], [8, 71, 6]] as Melody },
  { root: 36, chord: [60, 64, 67, 71], lead: [[0, 72, 5], [6, 74, 2], [8, 76, 6]] as Melody },
  { root: 33, chord: [57, 60, 64, 67], lead: [[0, 69, 5], [6, 72, 2], [8, 76, 6]] as Melody },
  { root: 35, chord: [59, 63, 66, 69], lead: [[0, 75, 5], [6, 74, 2], [8, 71, 4], [12, 66, 4]] as Melody }
] as const;

export function stepEvents(bar: number, s: number): Hit[] {
  const c = CHORDS[Math.floor(bar / 2)]!;
  const out: Hit[] = [];
  const last = bar === BARS - 1;
  if (bar === 0 && s === 0) out.push({ v: "hit" });
  if (last && s === 0) out.push({ v: "riser", len: 16 });
  if (has([0, 3, 8, 10], s) && !(last && s >= 8)) out.push({ v: "kick", vel: s === 0 ? 1 : 0.8 });
  if (has([4, 12], s)) out.push({ v: "snare", vel: s === 12 ? 1 : 0.55 });
  if (s === 12) out.push({ v: "clap", vel: 0.6 });
  if (last && s >= 12 && s % 2 === 0) out.push({ v: "snare", vel: 0.7 });
  if (has([2, 6, 10, 14], s)) out.push({ v: "hat", vel: 0.45 });
  else if (bar >= 2) out.push({ v: "hat", vel: 0.18 });
  if (s % 2 === 0) out.push({ v: "bass", n: s === 10 ? c.root + 12 : c.root, len: 1.6, vel: s === 0 ? 1 : 0.8 });
  if (bar < 4 && s % 4 === 0) out.push({ v: "tick", vel: 0.35 });
  if (s === 0 && bar % 2 === 0) out.push({ v: "pad", n: c.chord.map(n => n - 12), len: 30, vel: 0.9 });
  if (bar >= 4 && has([6, 10], s)) out.push({ v: "stab", n: c.chord, len: 1.5, vel: 0.9 });
  if (bar >= 4) out.push(...melodyAt(c.lead, s));
  return out;
}

/** Events for any step index; the track loops forever. */
export function trackStep(index: number): Hit[] {
  const step = ((index % LOOP_STEPS) + LOOP_STEPS) % LOOP_STEPS;
  return stepEvents(Math.floor(step / STEPS_PER_BAR), step % STEPS_PER_BAR);
}
