// The game's original synthesised music: ten looping tunes, from the brooding "Night Pursuit" to a triumphant "Victory Lap".
// Everything here is pure data so it can be unit-tested; music-engine.ts turns the events into sound with the Web Audio API.
import { TRACK_INFO, type TrackInfo } from "./music-catalogue.ts";

export type Voice = "kick" | "snare" | "clap" | "hat" | "tick" | "bass" | "stab" | "pad" | "lead" | "pluck" | "bell" | "hit" | "riser";

/** One sound at one step. `n` is a MIDI note (or chord), `len` is in steps, `vel` is 0-1, `tone` is the oscillator shape. */
export type Hit = { v: Voice; n?: number | readonly number[]; len?: number; vel?: number; tone?: OscillatorType };

/** A looping tune. `events` returns what sounds at one step of one bar. */
export type Track = TrackInfo & {
  bpm: number;
  bars: number;
  loopSteps: number;
  /** Seconds per sixteenth note. */
  stepSeconds: number;
  events(bar: number, step: number): Hit[];
};

export const STEPS_PER_BAR = 16;
export const midiToFreq = (note: number): number => 440 * 2 ** ((note - 69) / 12);

const has = (steps: readonly number[], at: number) => steps.includes(at);
const BARS = 8;
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

function nightPursuit(bar: number, s: number): Hit[] {
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


// ---- The other tunes: described as a spec, then turned into events by `compose` ---------------------------------

type Chord = { root: number; notes: readonly number[]; lead?: Melody };
type Spec = {
  chords: readonly Chord[];
  /** Bars each chord lasts. */
  per: number;
  /** First bar with drums (default 0). */
  drumsFrom?: number;
  /** Opening impact hit, and a riser plus snare fill in the last bar. */
  hit?: boolean;
  fill?: boolean;
  /** Drum volume multiplier (default 1). */
  drumVel?: number;
  kick?: readonly number[];
  snare?: readonly number[];
  clap?: readonly number[];
  tick?: { steps: readonly number[]; vel: number };
  hat?: readonly number[];
  /** Quieter hats on every other sixteenth. */
  ghost?: number;
  bass?: { steps: readonly number[]; tone: OscillatorType; len: number; offsets?: readonly number[]; up?: readonly number[] };
  pad?: { tone: OscillatorType; vel: number; from?: number };
  stab?: { steps: readonly number[]; tone: OscillatorType; from: number; len?: number; vel?: number };
  /** An arpeggio: `order` indexes the chord notes, wrapping up an octave each time it passes the top. */
  arp?: { steps: readonly number[]; voice: "pluck" | "bell"; order: readonly number[]; tone?: OscillatorType; vel: number; len: number; from?: number };
  lead?: { voice: "lead" | "bell" | "pluck"; tone?: OscillatorType; from: number; vel?: number };
};

function compose(spec: Spec, bars: number): Track["events"] {
  return (bar, s) => {
    const c = spec.chords[Math.floor(bar / spec.per)]!;
    const last = bar === bars - 1;
    const dv = spec.drumVel ?? 1;
    const out: Hit[] = [];
    if (spec.hit && bar === 0 && s === 0) out.push({ v: "hit" });
    if (spec.fill && last && s === 0) out.push({ v: "riser", len: 16 });
    if (bar >= (spec.drumsFrom ?? 0)) {
      if (spec.kick && has(spec.kick, s) && !(spec.fill && last && s >= 8)) out.push({ v: "kick", vel: (s === 0 ? 1 : 0.8) * dv });
      if (spec.snare && has(spec.snare, s)) out.push({ v: "snare", vel: (s === 12 ? 1 : 0.6) * dv });
      if (spec.clap && has(spec.clap, s)) out.push({ v: "clap", vel: 0.55 * dv });
      if (spec.fill && last && s >= 12 && s % 2 === 0) out.push({ v: "snare", vel: 0.7 * dv });
      if (spec.hat && has(spec.hat, s)) out.push({ v: "hat", vel: 0.45 * dv });
      else if (spec.ghost && bar >= 2) out.push({ v: "hat", vel: spec.ghost * dv });
      if (spec.tick && has(spec.tick.steps, s)) out.push({ v: "tick", vel: spec.tick.vel });
    }
    const b = spec.bass;
    if (b) {
      const at = b.steps.indexOf(s);
      if (at >= 0) out.push({ v: "bass", n: c.root + (b.offsets?.[at] ?? 0) + (b.up && has(b.up, s) ? 12 : 0), len: b.len, vel: s === 0 ? 1 : 0.8, tone: b.tone });
    }
    if (spec.pad && s === 0 && bar % spec.per === 0 && bar >= (spec.pad.from ?? 0)) {
      out.push({ v: "pad", n: c.notes.map(n => n - 12), len: spec.per * STEPS_PER_BAR - 2, vel: spec.pad.vel, tone: spec.pad.tone });
    }
    const st = spec.stab;
    if (st && bar >= st.from && has(st.steps, s)) out.push({ v: "stab", n: c.notes, len: st.len ?? 1.5, vel: st.vel ?? 0.9, tone: st.tone });
    const a = spec.arp;
    if (a && bar >= (a.from ?? 0)) {
      const at = a.steps.indexOf(s);
      if (at >= 0) {
        const o = a.order[at % a.order.length]!;
        out.push({ v: a.voice, n: c.notes[o % c.notes.length]! + 12 * Math.floor(o / c.notes.length), len: a.len, vel: a.vel, tone: a.tone });
      }
    }
    const l = spec.lead;
    if (l && bar >= l.from && c.lead) {
      for (const [step, n, len] of c.lead) if (step === s) out.push({ v: l.voice, n, len, vel: l.vel, tone: l.tone });
    }
    return out;
  };
}

const info = (id: string): TrackInfo => TRACK_INFO.find(t => t.id === id)!;
const makeTrack = (id: string, bpm: number, bars: number, events: Track["events"]): Track =>
  ({ ...info(id), bpm, bars, loopSteps: bars * STEPS_PER_BAR, stepSeconds: 60 / bpm / 4, events });
const fromSpec = (id: string, bpm: number, spec: Spec): Track => {
  const bars = spec.chords.length * spec.per;
  return makeTrack(id, bpm, bars, compose(spec, bars));
};

const EVERY_8TH = [0, 2, 4, 6, 8, 10, 12, 14] as const;
const EVERY_16TH = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;

// Afrobeat: Am - F - C - G over a syncopated kick, shaker sixteenths and offbeat guitar plucks.
const lagosNights = fromSpec("lagos-nights", 104, {
  per: 2, drumsFrom: 0, fill: true, drumVel: 0.9,
  chords: [
    { root: 33, notes: [57, 60, 64, 67], lead: [[2, 69, 3], [6, 72, 2], [8, 76, 4], [12, 74, 3]] },
    { root: 29, notes: [57, 60, 65, 69], lead: [[2, 72, 3], [6, 69, 2], [8, 77, 4], [12, 76, 3]] },
    { root: 36, notes: [60, 64, 67, 71], lead: [[2, 67, 3], [6, 72, 2], [8, 76, 4], [12, 72, 3]] },
    { root: 31, notes: [59, 62, 67, 71], lead: [[2, 71, 3], [6, 74, 2], [8, 79, 4], [12, 74, 3]] }
  ],
  kick: [0, 7, 10], clap: [4, 12], hat: [0, 4, 8, 12], ghost: 0.16, tick: { steps: [3, 6, 11], vel: 0.28 },
  bass: { steps: [0, 3, 6, 10, 12], tone: "triangle", len: 2, up: [12] },
  pad: { tone: "sine", vel: 0.8 },
  arp: { steps: [2, 5, 8, 11, 14], voice: "pluck", order: [0, 1, 2, 1, 3], tone: "triangle", vel: 0.8, len: 2 },
  lead: { voice: "lead", tone: "triangle", from: 4 }
});

// Highlife: bright C major with interlocking guitar arpeggios and a bell melody.
const highlifeSunrise = fromSpec("highlife-sunrise", 96, {
  per: 2, drumVel: 0.8,
  chords: [
    { root: 36, notes: [60, 64, 67, 72], lead: [[0, 76, 3], [4, 79, 2], [6, 76, 2], [8, 72, 4], [12, 74, 3]] },
    { root: 29, notes: [60, 65, 69, 72], lead: [[0, 77, 3], [4, 81, 2], [6, 77, 2], [8, 72, 4], [12, 76, 3]] },
    { root: 31, notes: [59, 62, 67, 71], lead: [[0, 74, 3], [4, 79, 2], [6, 74, 2], [8, 71, 4], [12, 74, 3]] },
    { root: 36, notes: [60, 64, 67, 72], lead: [[0, 72, 3], [4, 76, 2], [6, 79, 4], [10, 76, 2], [12, 72, 4]] }
  ],
  kick: [0, 8], snare: [12], tick: { steps: [4, 12], vel: 0.3 }, hat: [2, 6, 10, 14],
  bass: { steps: [0, 6, 8, 14], tone: "sine", len: 2.5, up: [14] },
  pad: { tone: "triangle", vel: 0.6, from: 2 },
  arp: { steps: [0, 3, 6, 8, 11, 14], voice: "pluck", order: [0, 1, 2, 3, 2, 1], tone: "triangle", vel: 0.75, len: 2.5 },
  lead: { voice: "bell", from: 2, vel: 0.9 }
});

// Noir jazz: Dm9 - G7 - Cmaj7 - A7 with a walking bass, brushed hats and a mellow, wandering line.
const smokeAndMirrors = fromSpec("smoke-and-mirrors", 76, {
  per: 2, drumVel: 0.6, hit: false,
  chords: [
    { root: 38, notes: [57, 60, 64, 65], lead: [[0, 69, 6], [8, 72, 4], [12, 74, 3]] },
    { root: 31, notes: [59, 62, 65, 67], lead: [[0, 71, 6], [8, 74, 4], [12, 77, 3]] },
    { root: 36, notes: [60, 64, 67, 71], lead: [[0, 76, 8], [10, 72, 2], [12, 71, 4]] },
    { root: 33, notes: [55, 61, 64, 67], lead: [[0, 73, 4], [6, 72, 2], [8, 69, 6]] }
  ],
  kick: [0], hat: [0, 4, 6, 8, 12, 14], tick: { steps: [4, 12], vel: 0.22 },
  bass: { steps: [0, 4, 8, 12], tone: "triangle", len: 3, offsets: [0, 7, 12, 7] },
  pad: { tone: "triangle", vel: 0.8 },
  lead: { voice: "lead", tone: "triangle", from: 2 }
});

// Ambient: slow, drum-less washes under high bells.
const harmattanDawn = fromSpec("harmattan-dawn", 80, {
  per: 2, drumsFrom: 2, drumVel: 0.4,
  chords: [
    { root: 29, notes: [57, 60, 64, 65], lead: [[2, 81, 8], [12, 77, 4]] },
    { root: 26, notes: [57, 60, 62, 65], lead: [[2, 79, 8], [12, 81, 4]] },
    { root: 34, notes: [58, 62, 65, 69], lead: [[2, 77, 8], [12, 74, 4]] },
    { root: 36, notes: [60, 64, 67, 74], lead: [[2, 76, 8], [12, 79, 4]] }
  ],
  hat: [4, 12],
  bass: { steps: [0], tone: "sine", len: 14 },
  pad: { tone: "sawtooth", vel: 1 },
  arp: { steps: [0, 6, 10], voice: "bell", order: [4, 5, 6], vel: 0.5, len: 8 },
  lead: { voice: "bell", from: 2, vel: 0.8 }
});

// Chase: Am - F - G - E at a driving pace, four on the floor with a pulsing bass and urgent stabs.
const expressToKano = fromSpec("express-to-kano", 150, {
  per: 2, hit: true, fill: true,
  chords: [
    { root: 33, notes: [57, 60, 64, 69], lead: [[0, 81, 2], [2, 76, 2], [4, 81, 2], [6, 84, 2], [8, 81, 4], [12, 76, 4]] },
    { root: 29, notes: [57, 60, 65, 69], lead: [[0, 81, 2], [2, 77, 2], [4, 81, 2], [6, 84, 2], [8, 81, 4], [12, 77, 4]] },
    { root: 31, notes: [59, 62, 67, 71], lead: [[0, 79, 2], [2, 74, 2], [4, 79, 2], [6, 83, 2], [8, 79, 4], [12, 74, 4]] },
    { root: 28, notes: [56, 59, 64, 68], lead: [[0, 80, 2], [2, 76, 2], [4, 80, 2], [6, 83, 2], [8, 80, 4], [12, 83, 4]] }
  ],
  kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14], ghost: 0.18,
  bass: { steps: EVERY_8TH, tone: "sawtooth", len: 1.5 },
  pad: { tone: "sawtooth", vel: 0.7 },
  stab: { steps: [6, 10, 14], tone: "sawtooth", from: 2 },
  lead: { voice: "lead", from: 4 }
});

// Playful: G - Em - C - D with an oom-pah bass and staccato plucks.
const marketDay = fromSpec("market-day", 118, {
  per: 2, drumVel: 0.8,
  chords: [
    { root: 31, notes: [55, 59, 62, 67], lead: [[0, 79, 2], [2, 83, 2], [4, 86, 2], [6, 83, 2], [8, 79, 2], [12, 74, 2]] },
    { root: 28, notes: [55, 59, 64, 67], lead: [[0, 76, 2], [2, 79, 2], [4, 83, 2], [6, 79, 2], [8, 76, 2], [12, 71, 2]] },
    { root: 36, notes: [60, 64, 67, 72], lead: [[0, 76, 2], [2, 79, 2], [4, 84, 2], [6, 79, 2], [8, 76, 2], [12, 72, 2]] },
    { root: 38, notes: [57, 62, 66, 69], lead: [[0, 78, 2], [2, 81, 2], [4, 86, 2], [6, 81, 2], [8, 78, 2], [12, 74, 2]] }
  ],
  kick: [0, 8], clap: [4, 12], hat: [0, 4, 8, 12], tick: { steps: [6, 14], vel: 0.3 },
  bass: { steps: [0, 4, 8, 12], tone: "triangle", len: 2, offsets: [0, 7, 0, 7] },
  pad: { tone: "triangle", vel: 0.5, from: 2 },
  arp: { steps: [2, 6, 10, 14], voice: "pluck", order: [1, 2, 3, 2], tone: "triangle", vel: 0.8, len: 1 },
  lead: { voice: "pluck", tone: "triangle", from: 2 }
});

// Synthwave: Cm - Ab - Eb - Bb under constant sixteenth-note arpeggios.
const neonCircuit = fromSpec("neon-circuit", 112, {
  per: 2, hit: true, fill: true,
  chords: [
    { root: 36, notes: [60, 63, 67, 72], lead: [[0, 79, 6], [8, 75, 4], [12, 77, 3]] },
    { root: 32, notes: [60, 63, 68, 72], lead: [[0, 80, 6], [8, 77, 4], [12, 75, 3]] },
    { root: 39, notes: [63, 67, 70, 75], lead: [[0, 79, 6], [8, 82, 4], [12, 79, 3]] },
    { root: 34, notes: [62, 65, 70, 74], lead: [[0, 77, 6], [8, 74, 4], [12, 77, 3]] }
  ],
  kick: [0, 4, 8, 12], snare: [4, 12], clap: [4, 12], hat: [2, 6, 10, 14], ghost: 0.16,
  bass: { steps: EVERY_8TH, tone: "sawtooth", len: 1.6 },
  pad: { tone: "sawtooth", vel: 0.8 },
  arp: { steps: EVERY_16TH, voice: "pluck", order: [0, 1, 2, 3, 4, 3, 2, 1], tone: "sawtooth", vel: 0.5, len: 1.2 },
  lead: { voice: "lead", from: 4 }
});

// Tension: Dm - Bb - Gm - A with a ticking clock, sparse bass and cold bells.
const midnightHeist = fromSpec("midnight-heist", 100, {
  per: 2, hit: true, fill: true, drumsFrom: 2, drumVel: 0.8,
  chords: [
    { root: 38, notes: [57, 62, 65, 69], lead: [[8, 74, 6]] },
    { root: 34, notes: [58, 62, 65, 70], lead: [[8, 72, 6]] },
    { root: 31, notes: [58, 62, 67, 70], lead: [[8, 70, 6]] },
    { root: 33, notes: [57, 61, 64, 69], lead: [[8, 73, 4], [12, 76, 3]] }
  ],
  kick: [0, 10], snare: [12],
  tick: { steps: [0, 4, 8, 12], vel: 0.25 },
  bass: { steps: [0, 3, 10], tone: "sine", len: 3 },
  pad: { tone: "sawtooth", vel: 0.7 },
  stab: { steps: [7, 15], tone: "square", from: 4, len: 1, vel: 0.7 },
  arp: { steps: [6], voice: "bell", order: [4], vel: 0.5, len: 6, from: 2 },
  lead: { voice: "lead", tone: "triangle", from: 4 }
});

// Anthem: D - A - Bm - G with brass-like stabs and a soaring lead.
const victoryLap = fromSpec("victory-lap", 132, {
  per: 2, hit: true, fill: true,
  chords: [
    { root: 38, notes: [62, 66, 69, 74], lead: [[0, 81, 3], [4, 78, 2], [6, 81, 2], [8, 86, 6]] },
    { root: 33, notes: [61, 64, 69, 73], lead: [[0, 85, 3], [4, 81, 2], [6, 85, 2], [8, 88, 6]] },
    { root: 35, notes: [59, 62, 66, 71], lead: [[0, 83, 3], [4, 86, 2], [6, 83, 2], [8, 78, 6]] },
    { root: 31, notes: [59, 62, 67, 71], lead: [[0, 79, 3], [4, 83, 2], [6, 86, 2], [8, 83, 6]] }
  ],
  kick: [0, 4, 8, 12], snare: [4, 12], clap: [4, 12], hat: [2, 6, 10, 14], ghost: 0.18,
  bass: { steps: [0, 2, 6, 8, 10, 14], tone: "sawtooth", len: 1.6, up: [6, 14] },
  pad: { tone: "sawtooth", vel: 0.8 },
  stab: { steps: [0, 6, 10], tone: "sawtooth", from: 0, len: 2, vel: 0.8 },
  lead: { voice: "lead", from: 2 }
});

const nightPursuitTrack = makeTrack("night-pursuit", 126, BARS, nightPursuit);

const BUILT: readonly Track[] = [
  nightPursuitTrack, lagosNights, highlifeSunrise, smokeAndMirrors, harmattanDawn,
  expressToKano, marketDay, neonCircuit, midnightHeist, victoryLap
];

/** The tunes, in the same order as the catalogue the picker shows. */
export const TRACKS: readonly Track[] = TRACK_INFO.map(i => BUILT.find(t => t.id === i.id)!);
export const DEFAULT_TRACK: Track = TRACKS[0]!;
export const findTrack = (id: string | null | undefined): Track => TRACKS.find(t => t.id === id) ?? DEFAULT_TRACK;

/** Events for any step index; every tune loops forever. */
export function trackStep(track: Track, index: number): Hit[] {
  const step = ((index % track.loopSteps) + track.loopSteps) % track.loopSteps;
  return track.events(Math.floor(step / STEPS_PER_BAR), step % STEPS_PER_BAR);
}
