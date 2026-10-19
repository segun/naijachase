// The rules of the travelling scene, with no graphics library: what is on screen at second `t` of a journey. Both renderers
// (chase3d-journey.ts in 3D, journey-2d.ts in 2D) only draw what `frameAt` returns, so they always show the same thing.
//
// The picture is a side view. World x runs to the right, y is up and z is depth behind the road (the road and the vehicle are at z = 0).
// The camera looks straight along +z from `cam.d` metres in front of the road at height `cam.y`, so a thing at depth z is drawn
// at a scale of 1 / (z + cam.d) and the horizon is always the middle of the screen. 3D and 2D share this projection.
//
//  * Drive: out of the garage in a car, through 3 to 5 landscapes picked at random, to a "Welcome to <state>" billboard.
//  * Hitch: into a minibus at the bus park, the same landscapes, the same billboard.
//  * Fly:   into "<source state> Airport", up the air stairs showing a boarding pass to the cabin crew, taxi, take-off, landing,
//           down the stairs and "Welcome to <state> Airport".
import { clamp01, lightAt, mix, portraitCameraScale, smooth, type Light } from "../shared/scene-core.ts";
import type { AvatarPreset } from "../../avatar/avatar-model.ts";

export type JourneyMode = "drive" | "hitch" | "fly";
/** Maps the server's transport mode to the scene, or null for a mode that has no journey scene. */
export const journeyModeOf = (mode: string): JourneyMode | null => (mode === "fly" ? "fly" : mode === "drive" ? "drive" : mode === "hitch_ride" ? "hitch" : null);

export type PropKind =
  | "tree" | "palm" | "pine" | "baobab" | "cactus" | "rock" | "bush" | "reed" | "crop" | "hut" | "stall" | "building" | "boat" | "pole"
  | "water" | "hill" | "cloud"
  | "garage" | "busstop" | "parkedbus" | "billboard" | "terminal" | "tower" | "hangar";

export type Landscape = {
  id: string;
  name: string;
  skyTop: string; skyBottom: string; ground: string; road: string; far: string; leaf: string;
  /** Colours for roofs, awnings, walls and boats. */
  accents: readonly string[];
  /** A strip of water behind the road (sea, river). */
  water?: string;
  /** What lines the road, with how often (relative weights). */
  props: readonly (readonly [PropKind, number])[];
  /** Props per 10 metres. */
  density: number;
};

/** The landscapes a journey can pass through. Which ones, and in which order, is chosen at random (see `pickLandscapes`). */
export const LANDSCAPES: readonly Landscape[] = [
  { id: "waterfront", name: "Waterfront", skyTop: "#4f9fd6", skyBottom: "#cfe8f2", ground: "#d9c58f", road: "#4a4b50", far: "#6f9bb0", leaf: "#3f8f5c", accents: ["#e8e2cf", "#2e6f8f", "#d9822b", "#b5483a"], water: "#2f7fb0", props: [["palm", 3], ["boat", 3], ["bush", 1], ["pole", 1], ["rock", 1]], density: 3.4 },
  { id: "forest", name: "Forest", skyTop: "#5d9fc0", skyBottom: "#c9e2d0", ground: "#3f7a3a", road: "#5a4a3a", far: "#2f5f3f", leaf: "#2d6f35", accents: ["#6b4a2e", "#8a5a3c"], props: [["tree", 6], ["pine", 2], ["bush", 3], ["rock", 1]], density: 6 },
  { id: "desert", name: "Desert", skyTop: "#6aa8d8", skyBottom: "#f6e2b4", ground: "#e0b86b", road: "#8a6f4a", far: "#c98f4a", leaf: "#5f8f3f", accents: ["#c9893f", "#a8642c"], props: [["cactus", 4], ["rock", 3], ["bush", 2], ["baobab", 1]], density: 2.6 },
  { id: "market", name: "Roadside market", skyTop: "#62a6d4", skyBottom: "#e2eef0", ground: "#b98456", road: "#43444a", far: "#8a9a8a", leaf: "#3f8f4c", accents: ["#d63a2e", "#f2c14e", "#2e8f5c", "#2e6f8f", "#c0568a"], props: [["stall", 6], ["building", 2], ["tree", 1], ["pole", 2]], density: 4.2 },
  { id: "farm", name: "Farm road", skyTop: "#5aa4dc", skyBottom: "#dff0e4", ground: "#8fae4a", road: "#9a7b52", far: "#7a9f5a", leaf: "#4a9a3a", accents: ["#c9a227", "#8a5a3c", "#b5483a"], props: [["crop", 6], ["hut", 2], ["tree", 2], ["pole", 1], ["bush", 1]], density: 3.2 },
  { id: "savanna", name: "Savanna", skyTop: "#5ea3d6", skyBottom: "#f4e6bf", ground: "#c9b25a", road: "#7a6a4a", far: "#a58f4a", leaf: "#6f8f3a", accents: ["#a8642c", "#c9893f"], props: [["baobab", 3], ["tree", 3], ["bush", 3], ["rock", 1]], density: 2.4 },
  { id: "hills", name: "Rocky hills", skyTop: "#6ea0cc", skyBottom: "#dde6ea", ground: "#9a9a84", road: "#4e4f55", far: "#7a8a96", leaf: "#5f8a4a", accents: ["#8a8a8a", "#6e6e72"], props: [["rock", 6], ["bush", 2], ["pine", 2], ["pole", 1]], density: 3.4 },
  { id: "village", name: "Village", skyTop: "#62a6d6", skyBottom: "#e6f0e8", ground: "#b5894f", road: "#8a6a46", far: "#7f9a6a", leaf: "#3f8f4c", accents: ["#c9893f", "#8a5a3c", "#d9c58f", "#b5483a"], props: [["hut", 6], ["tree", 3], ["bush", 2], ["pole", 1]], density: 3.4 },
  { id: "city", name: "City outskirts", skyTop: "#7fa6c6", skyBottom: "#e3e6e6", ground: "#8a8f8a", road: "#3a3b40", far: "#8f9aa8", leaf: "#4a8a4a", accents: ["#d8d2c4", "#9aa8b5", "#c9a98a", "#7a8a9a"], props: [["building", 6], ["pole", 4], ["tree", 1]], density: 4.4 },
  { id: "rainforest", name: "Rainforest", skyTop: "#5a9fb4", skyBottom: "#bfe0cc", ground: "#2f6a35", road: "#6a4a32", far: "#1f5a3a", leaf: "#1f7a3a", accents: ["#6b4a2e", "#8f6a3a"], props: [["tree", 6], ["palm", 4], ["bush", 4], ["reed", 2]], density: 7 },
  { id: "plantation", name: "Palm plantation", skyTop: "#5ba2d8", skyBottom: "#dcefe0", ground: "#7a9f3f", road: "#8a6446", far: "#5f8a4a", leaf: "#2f8f3a", accents: ["#a8642c", "#c9a227"], props: [["palm", 8], ["bush", 2], ["hut", 1]], density: 4.6 },
  { id: "river", name: "River crossing", skyTop: "#5aa0d0", skyBottom: "#d6ecee", ground: "#a8b26a", road: "#55565a", far: "#6a9a9a", leaf: "#3f9a5a", accents: ["#b5483a", "#e8e2cf", "#2e6f8f"], water: "#3f8fa8", props: [["reed", 5], ["boat", 2], ["tree", 2], ["pole", 2]], density: 3.4 }
];
export const MIN_LANDSCAPES = 3, MAX_LANDSCAPES = 5;

/** Both airports and the runway between them. */
export const AIRFIELD: Landscape = {
  id: "airfield", name: "Airfield", skyTop: "#5aa4dc", skyBottom: "#e2f0f4", ground: "#8fae6a", road: "#4a4b50", far: "#7f9fb0", leaf: "#3f8f4c",
  accents: ["#d8d2c4", "#9aa8b5", "#e8e2cf"], props: [["bush", 3], ["tree", 2], ["pole", 3]], density: 1.2
};

export type Prop = {
  kind: PropKind;
  x: number;
  /** Metres behind the road. */
  z: number;
  /** Height above the ground (clouds). */
  y: number;
  scale: number;
  /** 0..1, picks the colours and small differences. */
  v: number;
  /** Which stretch of the journey the prop belongs to, so it can grow in and out where two landscapes blend (-1: always there). */
  span: number;
  text?: string;
};
export type Span = { land: Landscape; from: number; to: number };

export type Stage = "depart" | "travel" | "arrive" | "airport" | "boarding" | "taxi" | "takeoff" | "landing" | "deplane" | "welcome";
export type VehicleKind = "car" | "bus" | "plane";
export type JourneyPlayer = {
  x: number; y: number; z: number; heading: number;
  visible: boolean; alpha: number;
  /** The same fields the walking figure uses (scene-core.ts). */
  sit: number; gait: number; stride: number;
  /** 0 arms down, 1 hands out on the steering wheel. */
  type: number;
  /** 0 arms down, 1 holding the boarding pass up. */
  pass: number;
};
export type JourneyFrame = {
  t: number;
  stage: Stage;
  /** 0 black, 1 fully visible. */
  fade: number;
  cam: { x: number; y: number; d: number };
  vehicle: { kind: VehicleKind; x: number; y: number; pitch: number; spin: number; door: number; stairs: number; gearDown: number };
  player: JourneyPlayer | null;
  hostess: { x: number; y: number; heading: number; alpha: number } | null;
};

export type JourneyPlan = {
  mode: JourneyMode;
  from: string;
  to: string;
  /** Destination label for a route loop, such as "Museum" rather than the state it is in. */
  label: string;
  spans: Span[];
  props: Prop[];
  /** How wide (metres) the blend between two landscapes is, each side of the boundary. */
  blend: number;
  /** Darkening for the hour, 0 none to 1 black. */
  dim: number;
  end: number;
  /** Where a reduced-motion player starts: the arrival shot. */
  settle: number;
  /** Seconds when the scene changes with a dip to black. */
  cuts: number[];
  names: string[];
  airportFrom: string;
  airportTo: string;
  /** Ground journeys: when the vehicle moves off, how far it goes and how fast. */
  go: number;
  distance: number;
  speed: number;
  /** A looping plan (the weekly "show travel route" view): never ends, and the world repeats every `period` metres. 0 otherwise. */
  loop: boolean;
  period: number;
};

export type PlanOptions = { mode: JourneyMode; from: string; to: string; label?: string; hour?: number; seed?: number; /** An endless route with no departure and no arrival. */ loop?: boolean };

// ---- Small pure helpers ----
export function seededRandom(seed: number): () => number {
  let s = (Math.abs(Math.trunc(seed)) % 2147483646) + 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
const parse = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
const hex2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
/** A blend of two `#rrggbb` colours. */
export const mixColour = (a: string, b: string, k: number) => `#${[0, 1, 2].map(i => hex2(parse(a, i) + (parse(b, i) - parse(a, i)) * k)).join("")}`;
const DIM: Record<Light, number> = { morning: 0, afternoon: 0, dusk: 0.28, night: 0.55 };
/** The colour as the hour would light it. */
export const tone = (c: string, dim: number) => (dim <= 0 ? c : mixColour(c, "#0a1230", dim));

/** `count` different landscapes in a random order, never repeating one. */
export function pickLandscapes(seed: number, count: number): Landscape[] {
  const r = seededRandom(seed);
  const pool = [...LANDSCAPES];
  const out: Landscape[] = [];
  for (let i = 0; i < Math.min(count, pool.length); i++) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]!);
  return out;
}

// ---- Timings ----
const WALK = 2.4, BOARD = 1.1, LEAD_OUT = 0.5;
const ACCEL = 2.2, BRAKE = 2.6, PER_LANDSCAPE = 4.2, HOLD = 3.4, FADE_IN = 0.6, FADE_OUT = 0.5;
const SPEED = { car: 15, bus: 12 } as const;
const CAM_LEAD = 3.8;
const BILLBOARD_AT = 6.5;

// Flying: one continuous world, with the two airports and the boarding apron far apart so a dip to black joins them.
const A1 = 3.6, A2 = 7.0, A3 = 3.4, A4 = 5.0, A5 = 5.5, A6 = 3.6, A7 = 2.8;
const T_BOARD = A1, T_TAXI = T_BOARD + A2, T_TAKEOFF = T_TAXI + A3, T_LANDING = T_TAKEOFF + A4, T_DEPLANE = T_LANDING + A5, T_WELCOME = T_DEPLANE + A6, T_END = T_WELCOME + A7;
export const AIR = { terminalX: 0, apronX: 100, landingStop: 560, stairBottom: 0.8, stairTop: 4.4, sill: 1.5, doorX: 4.9 };
// The supplied airliner has a higher sill and wider wings than the procedural plane.
export const MODEL_AIR = { length: 27, stairBottom: 4.8, stairTop: 7.8, sill: 3.55, doorX: 8.22, bottomZ: -6.7, topZ: -2.9 };
export function modelBoardingPosition(x: number, y: number, origin: number) {
  const height = clamp01(y / AIR.sill);
  return {
    x: origin + MODEL_AIR.stairBottom + (x - origin - AIR.stairBottom) * (MODEL_AIR.stairTop - MODEL_AIR.stairBottom) / (AIR.stairTop - AIR.stairBottom),
    y: y * MODEL_AIR.sill / AIR.sill,
    z: mix(MODEL_AIR.bottomZ, MODEL_AIR.topZ, height)
  };
}
const CUT_FADE = 0.5;

export function planJourney(o: PlanOptions): JourneyPlan {
  const seed = o.seed ?? Math.floor(Math.random() * 2147483000);
  const r = seededRandom(seed);
  const dim = DIM[lightAt(o.hour ?? 12)];
  const common = { mode: o.mode, from: o.from, to: o.to, label: o.label ?? o.to, blend: 16, dim, airportFrom: `${o.from} Airport`, airportTo: `${o.to} Airport`, loop: false, period: 0 };
  if (o.loop) return planLoop(o, r, common);

  if (o.mode === "fly") {
    const spans: Span[] = [{ land: AIRFIELD, from: -60, to: 700 }];
    const props: Prop[] = scatter(spans, r, [[-60, 700]]);
    const put = (kind: PropKind, x: number, z: number, text?: string) => props.push({ kind, x, z, y: 0, scale: 1, v: r(), span: -1, text });
    put("terminal", AIR.terminalX, 7, `${o.from} Airport`); put("tower", -22, 14); put("hangar", 22, 16);
    put("hangar", AIR.apronX + 20, 14); put("tower", AIR.apronX - 24, 16);
    put("terminal", AIR.landingStop - 17, 9, `Welcome to ${o.to} Airport`); put("tower", AIR.landingStop + 26, 15); put("hangar", AIR.landingStop - 44, 17);
    addSky(props, r, -60, 700);
    return { ...common, spans, props, names: ["Airfield"], end: T_END, settle: T_WELCOME + 0.8, cuts: [T_BOARD, T_TAKEOFF + A4], go: 0, distance: 0, speed: 0 };
  }

  const count = MIN_LANDSCAPES + Math.floor(r() * (MAX_LANDSCAPES - MIN_LANDSCAPES + 1));
  const lands = pickLandscapes(Math.floor(r() * 2147483000), count);
  const speed = o.mode === "drive" ? SPEED.car : SPEED.bus;
  const distance = speed * (ACCEL / 2 + count * PER_LANDSCAPE + BRAKE / 2);
  const go = WALK + BOARD + LEAD_OUT;
  const length = distance / count;
  const spans: Span[] = lands.map((land, i) => ({ land, from: i * length, to: (i + 1) * length }));
  const props = scatter(spans, r, spans.map((s, i) => [i === 0 ? s.from - 60 : s.from - common.blend, i === count - 1 ? s.to + 80 : s.to + common.blend] as [number, number]));
  const put = (kind: PropKind, x: number, z: number, text?: string) => props.push({ kind, x, z, y: 0, scale: 1, v: r(), span: -1, text });
  const clear = (x: number, half: number) => { props.splice(0, props.length, ...props.filter(p => p.span < 0 || p.z > 12 || Math.abs(p.x - x) > half)); };
  clear(0, 9); clear(distance + BILLBOARD_AT, 7);
  if (o.mode === "drive") put("garage", 0, 5.5);
  else { put("busstop", -3.4, 3.8); put("parkedbus", -15, 8); put("parkedbus", 14, 11); }
  put("billboard", distance + BILLBOARD_AT, 3.2, `Welcome to ${o.to}`);
  addSky(props, r, -60, distance + 90);
  return { ...common, spans, props, names: lands.map(l => l.name), end: go + ACCEL + count * PER_LANDSCAPE + BRAKE + HOLD, settle: go + ACCEL + count * PER_LANDSCAPE + BRAKE, cuts: [], go, distance, speed };
}

// ---- The endless route (weekly play) ----
export const LOOP_LANDSCAPES = 8, LOOP_SPAN = 72, AIR_PERIOD = 1200, AIR_SPEED = 42;
/** A signed distance on the loop, in -period/2 .. period/2. */
export const circ = (v: number, period: number) => v - period * Math.round(v / period);
/** Where a prop is drawn for a camera at `camX`: on a looping route the nearest copy of it. */
export const propX = (plan: JourneyPlan, p: Prop, camX: number) => (plan.period ? camX + circ(p.x - camX, plan.period) : p.x);

function planLoop(o: PlanOptions, r: () => number, common: Pick<JourneyPlan, "mode" | "from" | "to" | "label" | "blend" | "dim" | "airportFrom" | "airportTo" | "loop" | "period">): JourneyPlan {
  const base = { ...common, loop: true, end: Infinity, settle: 0, cuts: [], go: 0 };
  if (o.mode === "fly") {
    const period = AIR_PERIOD;
    const props: Prop[] = [];
    // Clouds of every size, at every height and depth, so the nearer ones sweep past faster than the far ones.
    for (let i = 0; i < 150; i++) props.push({ kind: "cloud", x: r() * period, z: 5 + Math.pow(r(), 1.6) * 160, y: -14 + r() * 52, scale: 0.4 + Math.pow(r(), 1.8) * 3.2, v: r(), span: -1 });
    return { ...base, period, spans: [{ land: AIRFIELD, from: 0, to: period }], props, names: ["Sky"], distance: period, speed: AIR_SPEED };
  }
  const speed = o.mode === "drive" ? SPEED.car : SPEED.bus;
  const lands = pickLandscapes(Math.floor(r() * 2147483000), LOOP_LANDSCAPES);
  const period = LOOP_SPAN * lands.length;
  const spans: Span[] = lands.map((land, i) => ({ land, from: i * LOOP_SPAN, to: (i + 1) * LOOP_SPAN }));
  const props = scatter(spans, r, spans.map(s => [s.from - common.blend, s.to + common.blend] as [number, number]));
  // The canonical copy of every prop lies inside one lap; the renderers draw whichever copy is nearest the camera.
  for (const p of props) p.x = ((p.x % period) + period) % period;
  addSky(props, r, 0, period);
  return { ...base, period, spans, props, names: lands.map(l => l.name), distance: period, speed };
}

/** Props along the road for each span, over the given x ranges. Near ones sit just behind the road, others further back. */
function scatter(spans: Span[], r: () => number, ranges: [number, number][]): Prop[] {
  const out: Prop[] = [];
  spans.forEach((span, i) => {
    const [a, b] = ranges[i]!;
    const total = span.land.props.reduce((s, [, w]) => s + w, 0);
    for (let x = a; x < b; x += (10 / span.land.density) * (0.6 + r() * 0.8)) {
      let pick = r() * total, kind: PropKind = span.land.props[0]![0];
      for (const [k, w] of span.land.props) { pick -= w; if (pick <= 0) { kind = k; break; } }
      const big = kind === "building" || kind === "baobab";
      const depth = r();
      const z = depth < 0.55 ? 3.6 + r() * 5 : depth < 0.85 ? 10 + r() * 16 : 28 + r() * 30;
      out.push({ kind, x, z: big ? Math.max(z, 7) : z, y: 0, scale: (big ? 1 : 0.8) + r() * 0.5, v: r(), span: i });
    }
    for (let x = a; x < b; x += 26 + r() * 14) out.push({ kind: "hill", x, z: 95 + r() * 20, y: 0, scale: 0.8 + r() * 0.7, v: r(), span: i });
    if (span.land.water) for (let x = a; x < b; x += 44) out.push({ kind: "water", x: x + 22, z: 34, y: 0, scale: 1, v: 0, span: i });
  });
  return out;
}
function addSky(props: Prop[], r: () => number, a: number, b: number) {
  for (let x = a; x < b; x += 36 + r() * 30) props.push({ kind: "cloud", x, z: 130 + r() * 30, y: 20 + r() * 14, scale: 0.8 + r() * 0.9, v: r(), span: -1 });
}

// ---- Where the landscapes blend ----
/** How much of a prop's own landscape is present at world x: 1 inside, easing to 0 across the blend either side of the boundary. */
export function weightAt(plan: JourneyPlan, spanIndex: number, x: number): number {
  const s = plan.spans[spanIndex];
  if (!s) return 1;
  const b = plan.blend;
  if (plan.period) {
    const L = plan.period;
    return Math.min(smooth(circ(x - s.from, L) / (2 * b) + 0.5), smooth(circ(s.to - x, L) / (2 * b) + 0.5));
  }
  const enter = spanIndex === 0 ? 1 : smooth((x - s.from) / (2 * b) + 0.5);
  const leave = spanIndex === plan.spans.length - 1 ? 1 : smooth((s.to - x) / (2 * b) + 0.5);
  return Math.min(enter, leave);
}
/** The two landscapes mixed at x and how far (0..1) the second one has taken over. */
export function blendAt(plan: JourneyPlan, xIn: number): { a: Landscape; b: Landscape; k: number } {
  const spans = plan.spans;
  const x = plan.period ? ((xIn % plan.period) + plan.period) % plan.period : xIn;
  let i = spans.findIndex(s => x < s.to);
  if (i < 0) i = spans.length - 1;
  const n = spans.length;
  const here = spans[i]!;
  const next = plan.period ? spans[(i + 1) % n] : spans[i + 1];
  const prev = plan.period ? spans[(i + n - 1) % n] : spans[i - 1];
  const b = plan.blend;
  // On a loop the first span starts at 0 and the last ends at the period, so their neighbours are across the seam.
  const into = plan.period && i === 0 && x < b ? x + plan.period : x;
  const lead = plan.period && i === 0 && x < b ? here.from + plan.period : here.from;
  if (next && x > here.to - b) return { a: here.land, b: next.land, k: smooth((x - (here.to - b)) / (2 * b)) };
  if (prev && x < here.from + b) return { a: prev.land, b: here.land, k: smooth((into - (lead - b)) / (2 * b)) };
  return { a: here.land, b: here.land, k: 0 };
}
export type Colours = { skyTop: string; skyBottom: string; ground: string; road: string; far: string };
export function coloursAt(plan: JourneyPlan, x: number): Colours {
  const { a, b, k } = blendAt(plan, x);
  const m = (key: keyof Colours) => tone(mixColour(a[key], b[key], k), plan.dim);
  return { skyTop: m("skyTop"), skyBottom: m("skyBottom"), ground: m("ground"), road: m("road"), far: m("far") };
}
/** The landscape name for the screen reader: the one the vehicle is mostly in. */
export function placeAt(plan: JourneyPlan, x: number): string {
  const { a, b, k } = blendAt(plan, x);
  return k > 0.5 ? b.name : a.name;
}
/** The colours of one prop: its landscape's leaf colour and one accent chosen by `v`. */
export function propColours(plan: JourneyPlan, p: Prop) {
  const land = plan.spans[Math.max(0, p.span)]!.land;
  const accent = land.accents[Math.floor(p.v * land.accents.length) % land.accents.length]!;
  return { leaf: tone(mixColour(land.leaf, "#ffffff", p.v * 0.12), plan.dim), accent: tone(accent, plan.dim), trunk: tone("#6b4a2e", plan.dim), water: tone(land.water ?? "#2f7fb0", plan.dim), far: tone(land.far, plan.dim) };
}

// ---- The player and the hostess ----
const FACING_RIGHT = -Math.PI / 2, FACING_LEFT = Math.PI / 2;
const player = (x: number, y: number, extra: Partial<JourneyPlayer> = {}): JourneyPlayer =>
  ({ x, y, z: 0, heading: FACING_RIGHT, visible: true, alpha: 1, sit: 0, gait: 0, stride: 0, type: 0, pass: 0, ...extra });
const walking = (t: number, extra: Partial<JourneyPlayer> = {}) => ({ gait: t * 7.5, stride: 1, ...extra });
/** The vehicle's x along a ground journey: still while boarding, then ease up to speed, cruise, and brake to a stop at the billboard. */
export function groundX(plan: JourneyPlan, t: number): number {
  const tau = t - plan.go;
  if (tau <= 0) return 0;
  const v = plan.speed, cruise = plan.spans.length * PER_LANDSCAPE;
  if (tau < ACCEL) return (v * tau * tau) / (2 * ACCEL);
  if (tau < ACCEL + cruise) return (v * ACCEL) / 2 + v * (tau - ACCEL);
  const s = Math.min(BRAKE, tau - ACCEL - cruise);
  return plan.distance - (v * (BRAKE - s) * (BRAKE - s)) / (2 * BRAKE);
}
const WHEEL = { car: 0.31, bus: 0.38, plane: 0.45 } as const;
/** Where the driver sits in the open car and the bus's rear step, relative to the vehicle (it faces right). */
/** The driver's seat in the car's own frame, as in the witness scene (garage-scene.ts SEAT, CAR_SIT_DROP): hips sink a little, hands on the wheel. */
export const SEAT_X = -0.25, SEAT_Y = -0.09, SEAT_Z = -0.38, STEP_X = -2.5;
/** Where the player and other occupants sit in the danfo minibus. */
export const BUS_SEAT_X = 0.8, BUS_SEAT_Y = -0.07, BUS_SEAT_Z = -0.35;
export const BUS_DRIVER_X = 1.35, BUS_DRIVER_Y = -0.07, BUS_DRIVER_Z = 0.35;

// ---- The frame ----
const dip = (t: number, cut: number) => 1 - clamp01(1 - Math.abs(t - cut) / CUT_FADE);

export function frameAt(plan: JourneyPlan, tIn: number): JourneyFrame {
  const t = Math.min(plan.end, Math.max(0, tIn));
  const fade = Math.min(clamp01(t / FADE_IN), clamp01((plan.end - t) / FADE_OUT), ...plan.cuts.map(c => dip(t, c)));
  if (plan.loop) return loopFrame(plan, t);
  return plan.mode === "fly" ? airFrame(plan, t, fade) : groundFrame(plan, t, fade);
}

export function groundCameraX(frame: JourneyFrame, aspect: number) {
  const focus = frame.stage === "depart" && frame.player?.visible ? frame.player.x + 0.5 : frame.vehicle.x + 0.15;
  const portrait = clamp01((1 - aspect) / 0.4);
  if (portrait > 0) return mix(frame.cam.x, focus, portrait);
  return frame.cam.x;
}

/** Camera used by both renderers. Portrait keeps the traveller centred and the whole airliner in view. */
export function journeyCamera(frame: JourneyFrame, aspect: number) {
  if (frame.vehicle.kind !== "plane") return { ...frame.cam, x: groundCameraX(frame, aspect) };
  // Airliners are much wider than cars or people; retain a 1.6:1 horizontal composition.
  const scale = portraitCameraScale(aspect, 1.6, 4);
  if (scale === 1) return frame.cam;
  let left = frame.vehicle.x - MODEL_AIR.length / 2, right = frame.vehicle.x + MODEL_AIR.length / 2;
  if (frame.player?.visible) { left = Math.min(left, frame.player.x); right = Math.max(right, frame.player.x); }
  if (frame.hostess) { left = Math.min(left, frame.hostess.x); right = Math.max(right, frame.hostess.x); }
  const focus = (left + right) / 2;
  const required = ((right - left) / 2 + 0.8) / (Math.tan(FOV / 2) * Math.max(0.4, aspect));
  return { ...frame.cam, x: focus, d: Math.max(frame.cam.d * scale, required) };
}

/** The weekly "show travel route" view: already under way, nothing to board and nowhere to arrive. */
function loopFrame(plan: JourneyPlan, t: number): JourneyFrame {
  const fade = clamp01(t / FADE_IN);
  const run = plan.speed * t;
  const x = run % plan.period;
  if (plan.mode === "fly") {
    const bob = Math.sin(t * 0.9) * 0.22;
    return {
      t, stage: "travel", fade, cam: { x: x + 5, y: 2.8 + bob * 0.6, d: 24 },
      vehicle: { kind: "plane", x, y: bob, pitch: Math.sin(t * 0.55) * 0.025, spin: 0, door: 0, stairs: 0, gearDown: 0 },
      player: null, hostess: null
    };
  }
  const car = plan.mode === "drive";
  const kind: VehicleKind = car ? "car" : "bus";
  const bob = Math.sin(t * 9) * 0.012;
  const p = car ? player(x + SEAT_X, SEAT_Y + bob, { sit: 1, type: 1 }) : player(x + BUS_SEAT_X, BUS_SEAT_Y + bob, { sit: 1, type: 1, z: BUS_SEAT_Z, visible: true, alpha: 1 });
  return {
    t, stage: "travel", fade, cam: { x: x + CAM_LEAD, y: 2.3, d: 11 },
    vehicle: { kind, x, y: bob, pitch: 0, spin: run / WHEEL[kind], door: 0, stairs: 0, gearDown: 1 },
    player: p, hostess: null
  };
}

function groundFrame(plan: JourneyPlan, t: number, fade: number): JourneyFrame {
  const car = plan.mode === "drive";
  const kind: VehicleKind = car ? "car" : "bus";
  const x = groundX(plan, t);
  const stage: Stage = t < plan.go ? "depart" : t < plan.settle ? "travel" : "arrive";
  const bob = t >= plan.go ? Math.sin(t * 9) * 0.012 * Math.min(1, x / 4) : 0;
  const board = clamp01((t - WALK) / BOARD);
  const open = smooth((t - (WALK - 0.6)) / 0.5) * (1 - smooth((t - (WALK + BOARD - 0.2)) / 0.5));
  let p: JourneyPlayer;
  if (car) {
    if (t < WALK) p = player(-7 + (5.3 * t) / WALK, 0, walking(t));
    else {
      const k = smooth(board);
      p = player(board >= 1 ? x + SEAT_X : mix(-1.7, SEAT_X, k), SEAT_Y * k + 0.25 * Math.sin(Math.PI * k) + bob, { sit: k, type: k, gait: t * 7.5, stride: 1 - k });
    }
  } else if (t < WALK) {
    p = player(-5.2 + ((STEP_X - 0.4 + 5.2) * t) / WALK, 0, walking(t, { z: -1.4 }));
  } else {
    const k = smooth(board);
    if (board < 1) {
      const stepUp = 0.25 * Math.sin(Math.PI * k);
      const px = mix(STEP_X - 0.4, BUS_SEAT_X, k);
      const py = BUS_SEAT_Y * k + stepUp;
      const pz = mix(-1.4, BUS_SEAT_Z, k);
      p = player(px, py, { z: pz, sit: k, type: k, gait: t * 7.5, stride: 1 - k, visible: true, alpha: 1 });
    } else {
      p = player(x + BUS_SEAT_X, BUS_SEAT_Y + bob, { z: BUS_SEAT_Z, sit: 1, type: 1, gait: t * 7.5, stride: 0, visible: true, alpha: 1 });
    }
  }
  const lead = stage === "depart" && !car ? mix(0.5, CAM_LEAD, smooth(clamp01((t - (WALK + BOARD)) / LEAD_OUT))) : CAM_LEAD;
  return {
    t, stage, fade,
    cam: { x: x + lead, y: 2.3, d: 11 },
    vehicle: { kind, x, y: bob, pitch: 0, spin: x / WHEEL[kind], door: car ? 0 : open, stairs: 0, gearDown: 1 },
    player: p, hostess: null
  };
}

function airFrame(plan: JourneyPlan, t: number, fade: number): JourneyFrame {
  const PX = AIR.apronX, LP = AIR.landingStop;
  const stage: Stage = t < T_BOARD ? "airport" : t < T_TAXI ? "boarding" : t < T_TAKEOFF ? "taxi" : t < T_LANDING ? "takeoff" : t < T_DEPLANE ? "landing" : t < T_WELCOME ? "deplane" : "welcome";
  const plane = (x: number, y = 0, pitch = 0, door = 0, stairs = 0, gearDown = 1) => ({ kind: "plane" as const, x, y, pitch, spin: x / WHEEL.plane, door, stairs, gearDown });
  const climb = (x: number, foot: number) => AIR.sill * clamp01((x - foot) / (AIR.stairTop - AIR.stairBottom));

  if (stage === "airport") {
    const walkEnd = T_BOARD - 0.5;
    const alpha = 1 - smooth((t - (walkEnd - 0.6)) / 0.6);
    return { t, stage, fade, cam: { x: mix(-1.5, 1.5, t / T_BOARD), y: 2.5, d: 18 }, vehicle: plane(PX), player: player(mix(-9, 0.2, clamp01(t / walkEnd)), 0, { ...walking(t), alpha, visible: alpha > 0.01 }), hostess: null };
  }
  if (stage === "boarding") {
    const s = t - T_BOARD;
    const walkEnd = 2.6, passEnd = 4.2, climbEnd = 6.6;
    const foot = PX + AIR.stairBottom, top = PX + AIR.stairTop;
    let p: JourneyPlayer;
    if (s < walkEnd) p = player(mix(PX - 7, foot, smooth(s / walkEnd)), 0, walking(t));
    else if (s < passEnd) p = player(foot, 0, { pass: smooth((s - walkEnd) / 0.4) * (1 - smooth((s - passEnd + 0.4) / 0.4)) });
    else if (s < climbEnd) { const x = mix(foot, top, (s - passEnd) / (climbEnd - passEnd)); p = player(x, climb(x, foot), walking(t)); }
    else { const k = clamp01((s - climbEnd) / (A2 - climbEnd)); p = player(mix(top, PX + AIR.doorX, k), AIR.sill, { ...walking(t), alpha: 1 - smooth(k), visible: k < 1 }); }
    return { t, stage, fade, cam: { x: PX + 1.5, y: 2.8, d: 17 }, vehicle: plane(PX, 0, 0, smooth((s - passEnd) / 0.8), 1), player: p, hostess: { x: top + 0.3, y: AIR.sill, heading: FACING_LEFT, alpha: 1 } };
  }
  if (stage === "taxi" || stage === "takeoff") {
    const s = t - T_TAXI;
    // Taxi: ease up to 6 m/s and roll on; take-off: accelerate hard, lift off and climb.
    const taxi = Math.min(s, A3);
    const taxiX = taxi < 2.4 ? 0.5 * (6 / 2.4) * taxi * taxi : 7.2 + 6 * (taxi - 2.4);
    const u = Math.max(0, s - A3);
    const x = PX + taxiX + 6 * u + 5.5 * u * u;
    const lift = Math.max(0, u - 3.3);
    const y = 4.5 * lift * lift;
    return {
      t, stage, fade, cam: { x: x + 4 + u * 1.2, y: 2.8 + y * 0.55, d: 19 + 8 * clamp01(u / A4) },
      vehicle: plane(x, y, 0.24 * smooth((u - 3.0) / 1.2), 1 - smooth(s / 0.8), 1 - smooth(s / 1.0), 1 - smooth(lift / 0.8)),
      player: null, hostess: null
    };
  }
  if (stage === "landing") {
    const s = t - T_LANDING;
    const touch = 2.6, v0 = 44, roll = A5 - touch;
    const xt = LP - (v0 * roll) / 2;
    let x: number, y: number, pitch: number;
    if (s < touch) { const k = 1 - s / touch; x = xt - v0 * (touch - s); y = 26 * Math.pow(k, 1.5); pitch = -0.1 * k + 0.07 * (1 - k); }
    else { const q = s - touch; x = xt + v0 * q - (v0 * q * q) / (2 * roll); y = 0; pitch = 0.07 * (1 - smooth(q / 0.8)); }
    return { t, stage, fade, cam: { x: x + 4, y: 2.8 + y * 0.5, d: 27 - 6 * clamp01(s / A5) }, vehicle: plane(x, y, pitch, 0, 0, y > 3 ? 0 : 1), player: null, hostess: null };
  }
  // At the gate: the stairs come out, the door opens and the player steps down and walks to the terminal.
  const s = t - T_DEPLANE;
  const foot = LP + AIR.stairBottom;
  let p: JourneyPlayer | null = null;
  if (s >= 1.0) {
    const down = clamp01((s - 1.0) / 1.3);
    const alpha = clamp01((s - 1.0) / 0.4);
    if (down < 1) { const x = mix(LP + AIR.doorX, foot, down); p = player(x, climb(x, foot), { ...walking(t), heading: FACING_LEFT, alpha }); }
    else p = player(mix(foot, LP - 10, clamp01((s - 2.3) / 4.1)), 0, { ...walking(t), heading: FACING_LEFT });
  }
  return {
    t, stage, fade, cam: { x: LP + 4 - 13 * smooth(s / 5.5), y: 2.8, d: 21 - 2 * smooth(s / 1.5) },
    vehicle: plane(LP, 0, 0, smooth((s - 0.4) / 0.6), smooth(s / 0.8)), player: p,
    hostess: { x: LP + AIR.stairTop + 0.3, y: AIR.sill, heading: FACING_LEFT, alpha: smooth((s - 0.6) / 0.4) }
  };
}

/** The cabin crew member who checks the boarding pass; the same figure in 3D and 2D. */
export const HOSTESS = {
  avatar_id: "journey-crew", label: "Cabin crew", presentation: "feminine", skin_tone: "brown", skin_color: "#7a4f35", hair_style: "bob", hair_color: "#1b130e",
  uniform_primary: "#1f4f9f", uniform_secondary: "#f4ecd8", uniform_accent: "#c9a227"
} as AvatarPreset;

/** Minibus driver in 3D hitch journeys. */
export const BUS_DRIVER = {
  avatar_id: "journey-bus-driver", label: "Bus driver", presentation: "masculine", skin_tone: "warm_dark", skin_color: "#5c3826", hair_style: "short", hair_color: "#16100c",
  uniform_primary: "#2c3e50", uniform_secondary: "#ecf0f1", uniform_accent: "#e67e22"
} as AvatarPreset;

/** The one camera both renderers use, so a prop is always drawn at the same size and place. */
export const FOV = 0.8;
