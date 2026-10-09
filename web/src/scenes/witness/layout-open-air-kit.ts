// The shared language of the open-air, transport, water and work venues (Agent1's): a venue is a list of simple solid props, a few lights
// and some people, described once as pure data. The 3D renderer (chase3d-open-air-kit.ts) and the 2D renderer (witness-2d-open-air-kit.ts)
// both read the same list, so they always show the same place. Metres, same axes as witness-scene.ts: x right, y up, z away from the camera.
// No graphics library and no randomness here: everything is a pure function of its arguments and of `t`.
import { ROAD_Z } from "./witness-scene.ts";
import { hashOf } from "./venue-recipes.ts";

/** Movement of a prop, a pure function of `t`: a gentle sway (water, flags, nodding heads) and/or a slide that stops after `until` seconds. */
export type Motion = {
  /** Sway amplitude in metres along x, y and z. */
  ax?: number; ay?: number; az?: number;
  /** Sway cycles per second and phase in radians. */
  f?: number; ph?: number;
  /** Slides along x at `vx` metres a second from t = 0 and stops after `until` seconds. */
  vx?: number; until?: number;
};

type Flags = {
  /** Only built on a high-quality device. */
  hi?: boolean;
  /** Only exists after dark (lamp halos, floodlight beams). */
  night?: boolean;
  /** Shines (emissive) after dark. */
  glow?: boolean;
  /** Distant scenery: hazed towards the sky in 2D, left to the fog in 3D. */
  far?: boolean;
  /** Rounds the edges of a box by this many metres (a vehicle's body); the 2D renderer chamfers the corners of the face it shows. */
  soft?: number;
  m?: Motion;
};
type Base = Flags & { /** Centre of the footprint. */ x: number; /** Height of the bottom. */ y: number; z: number; c: string };

export type Prop =
  | (Base & { k: "box"; w: number; h: number; d: number })
  /** Upright cylinder or cone: `w` is the bottom diameter, `w2` the top one. */
  | (Base & { k: "cyl"; w: number; h: number; w2?: number })
  /** A cylinder lying along x: `w` is its length and `h` its diameter. */
  | (Base & { k: "cylx"; w: number; h: number })
  /** A cylinder lying along z (a wheel seen from the side): `w` is its diameter and `d` its thickness. */
  | (Base & { k: "cylz"; w: number; d: number })
  /** A ball squashed to `sy` of its height. */
  | (Base & { k: "ball"; w: number; sy?: number })
  /** A bar of thickness `t` hinged at (x, y, z) that swings by `amp` radians about z (up and down) or y (round) at `f` cycles a second. */
  | (Base & { k: "arm"; len: number; t: number; axis: "y" | "z"; a: number; amp?: number })
  /** A sign facing the camera, `text` painted on `bg`; "\n" starts a new line. */
  | { k: "sign"; x: number; y: number; z: number; w: number; h: number; text: string; bg: string; fg: string; hi?: boolean; night?: boolean; far?: boolean; m?: Motion }
  /** A soft halo of light at (x, y, z), after dark only. */
  | { k: "glow"; x: number; y: number; z: number; r: number; c: string; hi?: boolean; night?: boolean; far?: boolean; m?: Motion };

/** Someone standing or strolling. `walk` strolls between x0 and x1 at `v` metres a second (negative walks left) and wraps round. */
export type Person = { x: number; z: number; /** Heading: 0 faces the camera, PI faces away. */ face: number; seed: number; walk?: { x0: number; x1: number; v: number } };
export type PointLamp = { x: number; y: number; z: number; c: string };

export type Layout = {
  /** The colour of the ground behind the lane. */
  ground: string;
  /** Water that fills everything behind z, with its colour. */
  water?: { z: number; c: string };
  props: Prop[];
  /** Most important first: a light device keeps the first four, a full one the first eight. */
  people: Person[];
  /** Real lights after dark (a few; the rest of the glow is painted). */
  lamps: PointLamp[];
};

// ---- Where things may not stand (docs/agents/Agent1.md, section 3) ----

/** Boxes, as [x0, x1, z0, z1], that must stay clear: the walk from the lane, the line from the talk camera to the witness and the keep-out box. */
export const CLEAR_BOXES: readonly (readonly [number, number, number, number])[] = [[-3, 6.2, -3, 0.55], [-3, 3.6, -3, 3.4]];

// ---- Builders ----

type O = Flags;
export const box = (x: number, y: number, z: number, w: number, h: number, d: number, c: string, o: O = {}): Prop => ({ k: "box", x, y, z, w, h, d, c, ...o });
export const cyl = (x: number, y: number, z: number, w: number, h: number, c: string, o: O & { w2?: number } = {}): Prop => ({ k: "cyl", x, y, z, w, h, c, ...o });
export const cylx = (x: number, y: number, z: number, w: number, h: number, c: string, o: O = {}): Prop => ({ k: "cylx", x, y, z, w, h, c, ...o });
export const cylz = (x: number, y: number, z: number, w: number, d: number, c: string, o: O = {}): Prop => ({ k: "cylz", x, y, z, w, d, c, ...o });
export const ball = (x: number, y: number, z: number, w: number, c: string, o: O & { sy?: number } = {}): Prop => ({ k: "ball", x, y, z, w, c, ...o });
export const arm = (x: number, y: number, z: number, len: number, t: number, axis: "y" | "z", a: number, c: string, o: O & { amp?: number } = {}): Prop => ({ k: "arm", x, y, z, len, t, axis, a, c, ...o });
export const sign = (x: number, y: number, z: number, w: number, h: number, text: string, bg: string, fg: string, o: Pick<Flags, "hi" | "night" | "m"> = {}): Prop => ({ k: "sign", x, y, z, w, h, text, bg, fg, ...o });
export const glow = (x: number, y: number, z: number, r: number, c = "#ffe2a0", o: Pick<Flags, "hi" | "far" | "m"> = {}): Prop => ({ k: "glow", x, y, z, r, c, night: true, ...o });

/** A tall sign on two posts, like the market's banner. */
export const gantry = (x: number, z: number, w: number, h: number, top: number, text: string, bg: string, fg: string, post = "#5a3d22"): Prop[] => [
  cyl(x - w / 2 + 0.2, 0, z + 0.1, 0.16, top - h, post), cyl(x + w / 2 - 0.2, 0, z + 0.1, 0.16, top - h, post),
  sign(x, top - h, z, w, h, text, bg, fg)
];

/** A lamp on a pole that lights up after dark. */
export const lampPost = (x: number, z: number, h = 4.2, c = "#fff1c4"): Prop[] => [
  cyl(x, 0, z, 0.14, h, "#3a3d40"), box(x, h, z, 0.5, 0.14, 0.34, "#2b2e31"), box(x, h - 0.1, z, 0.36, 0.1, 0.24, c, { glow: true }), glow(x, h - 0.15, z, 1.6, c)
];

/** A floodlight mast: a pole with a bank of lamps. */
export const floodlight = (x: number, z: number, h = 9, c = "#fff7dc"): Prop[] => [
  cyl(x, 0, z, 0.3, h, "#4a4e52"), box(x, h, z, 1.6, 0.9, 0.3, "#2d3033"),
  ...[-0.55, 0, 0.55].map(dx => box(x + dx, h + 0.1, z - 0.18, 0.4, 0.65, 0.06, c, { glow: true })), glow(x, h + 0.4, z - 0.3, 3.4, c, { hi: true })
];

/** A row of posts and two rails along x. */
export const fenceX = (x0: number, x1: number, z: number, h = 1.1, c = "#7a5430", rails = 2): Prop[] => {
  const out: Prop[] = [];
  const n = Math.max(1, Math.round((x1 - x0) / 1.4));
  for (let i = 0; i <= n; i++) out.push(box(x0 + ((x1 - x0) * i) / n, 0, z, 0.1, h, 0.1, c));
  for (let r = 0; r < rails; r++) out.push(box((x0 + x1) / 2, h * (0.45 + (0.5 * r) / Math.max(1, rails - 1)), z, x1 - x0, 0.07, 0.06, c));
  return out;
};
/** The same along z. */
export const fenceZ = (x: number, z0: number, z1: number, h = 1.1, c = "#7a5430", rails = 2): Prop[] => {
  const out: Prop[] = [];
  const n = Math.max(1, Math.round((z1 - z0) / 1.4));
  for (let i = 0; i <= n; i++) out.push(box(x, 0, z0 + ((z1 - z0) * i) / n, 0.1, h, 0.1, c));
  for (let r = 0; r < rails; r++) out.push(box(x, h * (0.45 + (0.5 * r) / Math.max(1, rails - 1)), (z0 + z1) / 2, 0.06, 0.07, z1 - z0, c));
  return out;
};

/** Stacked crates: `n` along x, `rows` high. */
export const crates = (x: number, z: number, n: number, rows: number, c = "#8a6a3a", c2 = "#6e5230", s = 0.62): Prop[] => {
  const out: Prop[] = [];
  for (let r = 0; r < rows; r++) for (let i = 0; i < n - (r % 2 ? 1 : 0); i++) out.push(box(x + (i + (r % 2 ? 0.5 : 0)) * s, r * s * 0.8, z, s - 0.03, s * 0.8 - 0.03, s - 0.03, (i + r) % 2 ? c : c2));
  return out;
};

/** A tree: a trunk and a rounded crown, `flat` squashing the crown into an acacia's umbrella. */
export const tree = (x: number, z: number, h: number, crown = "#2f6b3a", flat = 0.55): Prop[] => [
  cyl(x, 0, z, h * 0.07, h * 0.62, "#6b4a2b", { w2: h * 0.05 }), ball(x, h * 0.4, z, h * 0.78, crown, { sy: flat }), ball(x + h * 0.18, h * 0.5, z - 0.2, h * 0.5, crown, { sy: flat, hi: true })
];

/** A palm: a leaning trunk and a star of fronds. */
export const palm = (x: number, z: number, h: number): Prop[] => [
  cyl(x, 0, z, 0.4, h, "#6b4a2b", { w2: 0.25 }),
  ...[0, 1, 2, 3, 4, 5].map(i => arm(x, h, z, 2.0, 0.12, "z", i % 2 ? -0.35 : Math.PI + 0.35, "#2f6b3a", { hi: i > 3 }))
];

/** A striped awning made of `n` slats along x on four poles, `h` high. */
export const awning = (x: number, z: number, w: number, d: number, h: number, c1: string, c2: string, n = 8, poles = true): Prop[] => {
  const out: Prop[] = [];
  for (let i = 0; i < n; i++) out.push(box(x - w / 2 + ((i + 0.5) * w) / n, h, z, w / n + 0.01, 0.07, d, i % 2 ? c2 : c1));
  if (poles) for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push(cyl(x + sx * (w / 2 - 0.08), 0, z + sz * (d / 2 - 0.08), 0.09, h, "#5a3d22"));
  return out;
};

/** A table with a top and four legs. */
export const table = (x: number, z: number, w: number, d: number, h = 0.8, top = "#7a5430", legs = "#5a3d22"): Prop[] => [
  box(x, h - 0.06, z, w, 0.06, d, top), ...[-1, 1].flatMap(sx => [-1, 1].map(sz => box(x + sx * (w / 2 - 0.07), 0, z + sz * (d / 2 - 0.07), 0.07, h - 0.06, 0.07, legs)))
];

/** A wooden fishing canoe lying along x with a raised prow, bobbing if `bob` is given. */
export const boat = (x: number, z: number, len: number, hull: string, stripe: string, bob?: Motion, y = 0.05): Prop[] => [
  box(x, y, z, len, 0.5, 1.1, hull, { m: bob }), box(x, y + 0.36, z - 0.56, len, 0.12, 0.06, stripe, { m: bob }), box(x, y + 0.36, z + 0.56, len, 0.12, 0.06, stripe, { m: bob }),
  box(x - len / 2, y + 0.3, z, 0.4, 0.55, 0.9, hull, { m: bob }), box(x + len / 2 + 0.1, y + 0.4, z, 0.5, 0.6, 0.85, hull, { m: bob }),
  box(x + len * 0.1, y + 0.5, z, 0.12, 0.1, 1.1, "#5a3d22", { m: bob }), box(x - len * 0.25, y + 0.5, z, 0.12, 0.1, 1.1, "#5a3d22", { m: bob })
];

/** A parked minibus on its side, front to the left (`dir` -1) or right (1): yellow with a dark stripe, windows, wheels and headlamps. */
export const minibus = (x: number, z: number, dir: 1 | -1, c = "#f2b705", lamp = true, rack = true): Prop[] => [
  box(x, 0.45, z, 5, 1.1, 2, c, { soft: 0.3 }), box(x - dir * 0.2, 1.55, z, 4.4, 0.95, 1.95, c, { soft: 0.32 }), box(x, 1.0, z - 1.005, 5, 0.18, 0.02, "#15191c"),
  box(x - dir * 0.2, 1.75, z - 0.985, 4.0, 0.5, 0.02, "#27414f"), box(x + dir * 2.3, 1.65, z - 0.995, 0.02, 0.5, 0.02, "#27414f"),
  box(x + dir * 2.52, 0.55, z, 0.1, 0.4, 2, "#15191c"), box(x - dir * 2.52, 0.55, z, 0.1, 0.4, 2, "#15191c"),
  ...(rack ? [box(x - dir * 0.2, 2.55, z, 4.0, 0.06, 1.7, "#2b2f33"), box(x - dir * 0.2, 2.62, z, 1.6, 0.4, 1.0, "#9a7a4a", { hi: true })] : []),
  ...[-1.6, 1.6].flatMap(wx => [cylz(x + wx, 0, z - 0.95, 0.78, 0.26, "#15191c"), cylz(x + wx, 0.17, z - 1.0, 0.44, 0.2, "#aeb6bc")]),
  box(x + dir * 2.52, 0.78, z - 0.5, 0.06, 0.2, 0.34, "#fff4cf", { glow: lamp }),
  glow(x + dir * 2.7, 0.88, z - 0.5, 1.5, "#fff4cf")
];

/** A small deterministic random generator for scenery, so a venue always draws the same. */
export const rng = (seed: number) => { let s = (Math.abs(Math.trunc(seed)) % 2147483646) + 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };
export const pick = <T>(r: () => number, items: readonly T[]): T => items[Math.min(items.length - 1, Math.floor(r() * items.length))]!;

/** The scenery seed for an account: the same words always give the same arrangement, and it is independent of which witness they pick. */
export const sceneSeed = (text: string) => hashOf(`${text}#scenery`);

/** Colours that are free to change from one visit to the next: cloth, paint, bags, boats, containers. Uniform ones (a minibus's yellow) are not in the list. */
const ACCENTS = ["#2e6f8f", "#b5483a", "#d9822b", "#2f8f5b", "#7a4aa0", "#c0392b", "#26336b", "#c0568a"] as const;

/**
 * Gives a layout its look for this visit: the accent colours are shuffled among themselves (so each stays distinct from the others), people are
 * different people standing a little differently, and strollers start elsewhere on their lane. Nothing is added or moved into the clear areas.
 */
export function variate(layout: Layout, seed: number): Layout {
  const r = rng(seed ^ 0x5bd1e995);
  const order = [...ACCENTS];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j]!, order[i]!]; }
  const map = new Map<string, string>(ACCENTS.map((c, i) => [c, order[i]!]));
  const props = layout.props.map(p => (p.k === "sign" || p.k === "glow" ? p : { ...p, c: map.get(p.c) ?? p.c }));
  const offset = Math.floor(r() * 5000) * 7;
  const people = layout.people.map((p, i): Person => ({
    ...p, seed: p.seed + offset + i,
    z: p.walk ? p.z : p.z + r() * 0.4,
    ...(p.walk ? { x: p.walk.x0 + r() * Math.abs(p.walk.x1 - p.walk.x0), walk: { ...p.walk, v: p.walk.v * (0.85 + r() * 0.3) } } : { face: p.face + (r() - 0.5) * 0.5 })
  }));
  return { ...layout, props, people };
}

/** A builder every set file exports: the venue's variant, its sign name and the account's scenery seed. */
export type LayoutBuilder = (variant: string, venueName: string, seed: number) => Layout;

/** A distant row of low buildings, hazed by the fog (or by the 2D renderer). */
export const skyline = (seed: number, tones: readonly string[] = ["#8c8579", "#a8a091", "#7a8a8f", "#b3a58a"], z = 40, n = 26, maxH = 11): Prop[] => {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => { const w = 3 + r() * 5, h = 3 + r() * (maxH - 3); return box(-48 + i * 3.8 + r() * 2, 0, z + r() * 6, w, h, 3, tones[Math.floor(r() * tones.length)]!, { far: true }); });
};

// ---- People ----

/** `count` people allowed on this device: eight on a full one, four on a light one. */
export const crowdLimit = (light: boolean) => (light ? 4 : 8);

/** A person's place at `t`: strollers keep to their lane and wrap round, so any frame can be drawn without the ones before it. */
export function placeAt(p: Person, t: number): { x: number; z: number; face: number; swing: number; bounce: number } {
  if (!p.walk) return { x: p.x, z: p.z, face: p.face, swing: 0, bounce: 0 };
  const { x0, x1, v } = p.walk;
  const span = Math.max(1, Math.abs(x1 - x0));
  const along = (((p.x - x0 + v * t) % span) + span) % span;
  const step = Math.sin(t * Math.abs(v) * 5 + p.seed);
  return { x: x0 + along, z: p.z, face: v >= 0 ? -Math.PI / 2 : Math.PI / 2, swing: step * 0.5, bounce: Math.abs(step) * 0.02 };
}

/** A stroller on a lane: starts at `x`, walks between x0 and x1. */
export const stroller = (x: number, z: number, seed: number, x0: number, x1: number, v: number): Person => ({ x, z, face: 0, seed, walk: { x0, x1, v } });
/** Someone standing and facing `face` (PI faces away from the camera, towards the venue). */
export const standing = (x: number, z: number, face: number, seed: number): Person => ({ x, z, face, seed });

// ---- Motion ----

/** Where a prop with `m` has moved to at `t`, as offsets from its place. Writes into `out` so a frame allocates nothing. */
export function moveAt(m: Motion | undefined, t: number, out: [number, number, number]): [number, number, number] {
  if (!m) { out[0] = 0; out[1] = 0; out[2] = 0; return out; }
  const s = Math.sin(t * (m.f ?? 0.4) * Math.PI * 2 + (m.ph ?? 0));
  out[0] = (m.ax ?? 0) * s + (m.vx ?? 0) * Math.min(t, m.until ?? t);
  out[1] = (m.ay ?? 0) * s;
  out[2] = (m.az ?? 0) * s;
  return out;
}
/** The angle an arm has at `t`. */
export const armAngle = (p: Extract<Prop, { k: "arm" }>, t: number) => p.a + (p.amp ?? 0) * Math.sin(t * (p.m?.f ?? 0.2) * Math.PI * 2 + (p.m?.ph ?? 0));
/** The far end of an arm: swinging about z lifts it, swinging about y turns it (Babylon's left-handed y rotation). */
export function armEnd(p: Extract<Prop, { k: "arm" }>, angle: number): [number, number, number] {
  return p.axis === "z" ? [p.x + p.len * Math.cos(angle), p.y + p.len * Math.sin(angle), p.z] : [p.x + p.len * Math.cos(angle), p.y, p.z - p.len * Math.sin(angle)];
}

/** Text of a sign: the venue's name in capitals. */
export const nameOf = (venueName: string) => venueName.toUpperCase();

/** The lane's z, repeated here so layouts can keep clear of it without importing the scene rules everywhere. */
export const LANE_Z = ROAD_Z;
