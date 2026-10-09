// The building sets as data: every venue of the buildings (worship, civic, culture, learning, hospitality) is a list of simple parts
// (boxes, cylinders, domes, signs, flags...) plus a few people. Both renderers (chase3d-buildings-kit.ts and witness-2d-buildings-kit.ts)
// draw this same list, so 3D and 2D always show the same place. Pure data and arithmetic: no Babylon.js, no clock, no randomness
// beyond `seeded`, so it is unit-tested (the camera keep-out boxes are checked there).
// Metres, same axes as witness-scene.ts: x right, y up, z away from the camera. Boxes and cylinders stand on `y`; balls and discs are
// centred on `y`.

/** Where the front wall of every building is: 0.55 m behind the witness, who stands at z = 2.55. */
export const FRONT = 3.1;

export type Part =
  | { k: "box"; x: number; y: number; z: number; w: number; h: number; d: number; c: string; lit?: string; neon?: string; ph?: number }
  | { k: "cyl"; x: number; y: number; z: number; r: number; rt?: number; h: number; c: string; swing?: number }
  | { k: "ball"; x: number; y: number; z: number; r: number; sy?: number; c: string }
  | { k: "disc"; x: number; y: number; z: number; r: number; c: string; lit?: string }
  | { k: "prism"; x: number; y: number; z: number; w: number; h: number; d: number; c: string }
  | { k: "pave"; x0: number; x1: number; z0: number; z1: number; c: string }
  | { k: "sign"; x: number; y: number; z: number; w: number; h: number; c: string; fg: string; text: string }
  | { k: "flag"; x: number; y: number; z: number; w: number; h: number; c: string; c2: string }
  | { k: "beacon"; x: number; y: number; z: number; r: number; c: string; c2: string; period: number }
  | { k: "puff"; x: number; y: number; z: number; r: number; c: string }
  | { k: "lamp"; x: number; y: number; z: number; h: number; c: string };

export type PartKind = Part["k"];

/** Window light at night. */
export const WARM = "#ffd98a";

/** Whether a neon tube is lit at `t`: mostly on, with a flicker. Pure. */
export const neonOn = (t: number, ph = 0) => Math.sin(t * 5 + ph) + Math.sin(t * 2.3 + ph * 2) > -1.1;

/** Which of two beacon colours shows at `t`. */
export const beaconPhase = (t: number, period: number) => (Math.floor((t / period) * 2) & 1) === 0;

/** How far a swinging part (a bell) has moved sideways at `t`. */
export const swingAt = (amount: number, t: number) => Math.sin(t * 1.9) * amount;

/** A puff of steam or smoke: how far through its rise (0 to 1) puff `i` of 3 is at `t`. */
export const puffAt = (i: number, t: number) => (((t * 0.35 + i / 3) % 1) + 1) % 1;

/** A flag's wave: the sideways ripple of a point `u` (0 at the pole, 1 at the tip) at `t`. */
export const waveAt = (u: number, t: number) => Math.sin(t * 3 - u * 4) * 0.12 * u;

// ---- Building blocks ----

export const box = (x: number, y: number, z: number, w: number, h: number, d: number, c: string, more: { lit?: string; neon?: string; ph?: number } = {}): Part => ({ k: "box", x, y, z, w, h, d, c, ...more });
export const cyl = (x: number, y: number, z: number, r: number, h: number, c: string, rt = r): Part => ({ k: "cyl", x, y, z, r, rt, h, c });
export const ball = (x: number, y: number, z: number, r: number, c: string, sy = 1): Part => ({ k: "ball", x, y, z, r, sy, c });
export const pave = (x0: number, x1: number, z0: number, z1: number, c: string): Part => ({ k: "pave", x0, x1, z0, z1, c });

/** A block of wall: front face at FRONT, `depth` metres thick. */
export const wall = (x0: number, x1: number, h: number, c: string, depth = 3, y = 0): Part => box((x0 + x1) / 2, y, FRONT + depth / 2, x1 - x0, h, depth, c);

/** A thin panel flat against the wall, standing `out` metres proud of it. */
export const panel = (x: number, y: number, w: number, h: number, c: string, out = 0.06, more: { lit?: string; neon?: string; ph?: number } = {}, front = FRONT): Part =>
  box(x, y, front - out / 2, w, h, out, c, more);

/** Windows with a frame: glass that lights up at night. */
export function windows(xs: readonly number[], y: number, w: number, h: number, glass = "#6f93a3", frame = "#ece4d2", lit = WARM, front = FRONT): Part[] {
  return xs.flatMap(x => [panel(x, y - 0.1, w + 0.24, h + 0.2, frame, 0.07, {}, front), panel(x, y, w, h, glass, 0.12, { lit }, front)]);
}

/** Windows with bars (a cell, a store room). */
export function barredWindows(xs: readonly number[], y: number, w: number, h: number, glass = "#53707c"): Part[] {
  return xs.flatMap(x => [
    ...windows([x], y, w, h, glass, "#d9d4c4"),
    ...[-0.3, -0.1, 0.1, 0.3].map(f => panel(x + f * w, y, 0.05, h, "#2f3438", 0.2))
  ]);
}

/** A door in a frame. */
export function door(x: number, w: number, h: number, leaf = "#4a3123", frame = "#e7dcc3", lit?: string, front = FRONT): Part[] {
  return [panel(x, 0, w + 0.4, h + 0.25, frame, 0.1, {}, front), panel(x, 0, w, h, leaf, 0.16, lit ? { lit } : {}, front)];
}

/** Low steps up to a door, widest at the bottom. */
export const steps = (x: number, w: number, c = "#b9ae96", n = 2, front = FRONT): Part[] =>
  Array.from({ length: n }, (_, i) => box(x, 0, front - 0.3 - (n - 1 - i) * 0.4, w + (n - 1 - i) * 0.5, 0.13 * (i + 1), 0.6 + (n - 1 - i) * 0.4, c));

export function columns(xs: readonly number[], z: number, h: number, c = "#f0e8d6", r = 0.28): Part[] {
  return xs.flatMap(x => [box(x, 0, z, r * 2.8, 0.2, r * 2.8, c), cyl(x, 0.2, z, r, h - 0.45, c, r * 0.9), box(x, h - 0.25, z, r * 2.8, 0.25, r * 2.8, c)]);
}

export const tree = (x: number, z: number, h: number, leaf = "#2f6b3a", trunk = "#5b3d25"): Part[] => [
  cyl(x, 0, z, h * 0.06, h * 0.55, trunk, h * 0.045),
  ball(x, h * 0.62, z, h * 0.3, leaf, 0.85), ball(x - h * 0.17, h * 0.52, z - 0.1, h * 0.2, leaf, 0.8), ball(x + h * 0.17, h * 0.55, z + 0.1, h * 0.22, leaf, 0.8)
];

export const palm = (x: number, z: number, h: number): Part[] => [
  cyl(x, 0, z, 0.2, h, "#7a5a38", 0.14),
  ...Array.from({ length: 6 }, (_, i) => ball(x + Math.cos(i * 1.05) * 1.0, h + 0.05 + (i % 2) * 0.15, z + Math.sin(i * 1.05) * 1.0, 0.75, "#2f6b3a", 0.2))
];

export const shrub = (x: number, z: number, r = 0.55, c = "#3b7a44"): Part => ball(x, r * 0.7, z, r, c, 0.75);

export const lamp = (x: number, z: number, h = 3.4, c = "#2f3438"): Part => ({ k: "lamp", x, y: 0, z, h, c });

export const bench = (x: number, z: number, c = "#7a5430"): Part[] => [
  box(x, 0.4, z, 1.6, 0.07, 0.5, c), box(x, 0.7, z + 0.22, 1.6, 0.35, 0.06, c),
  box(x - 0.7, 0, z, 0.08, 0.4, 0.45, "#3d3d3d"), box(x + 0.7, 0, z, 0.08, 0.4, 0.45, "#3d3d3d")
];

export const pole = (x: number, z: number, h: number, c = "#bdbdbd"): Part => cyl(x, 0, z, 0.06, h, c, 0.045);

/** A flagpole and its flag. */
export const flagpole = (x: number, z: number, h: number, c: string, c2: string, w = 1.5): Part[] => [pole(x, z, h), { k: "flag", x: x + 0.06, y: h - 1.0, z, w, h: 0.95, c, c2 }];

/** A sign: a board with the venue's name. */
export const sign = (text: string, x: number, y: number, w: number, c: string, fg = "#fff8df", z = FRONT - 0.06, h = 0.8): Part => ({ k: "sign", x, y, z, w, h, c, fg, text });

/** A van or ambulance seen side on, facing `dir` (1 towards +x): a low body, a cab at the front and a taller box behind it. */
export function vehicle(x: number, z: number, dir: 1 | -1, body: string, o: { cab?: string; stripe?: string; length?: number } = {}): Part[] {
  const length = o.length ?? 4.6, cab = o.cab ?? body;
  const wheel = (s: number): Part => ({ k: "disc", x: x + s * length * 0.3, y: 0.34, z: z - 0.97, r: 0.34, c: "#1b1d20" });
  return [
    box(x, 0.3, z, length, 0.75, 1.9, body),
    box(x - dir * length * 0.17, 1.05, z, length * 0.56, 0.85, 1.9, body),
    box(x + dir * length * 0.3, 1.05, z, length * 0.3, 0.5, 1.8, cab),
    box(x + dir * length * 0.3, 1.1, z - 0.9, length * 0.22, 0.38, 0.04, "#8fb3c2"),
    ...(o.stripe ? [box(x, 0.62, z - 0.96, length, 0.22, 0.03, o.stripe)] : []),
    wheel(-1), wheel(1)
  ];
}

/** A horse (a groom's charge), side on, facing `dir`. */
export function horse(x: number, z: number, dir: 1 | -1, c = "#7a4a2c"): Part[] {
  return [
    box(x, 0.85, z, 1.7, 0.7, 0.55, c),
    ...[-0.65, 0.65].flatMap(lx => [box(x + lx, 0, z - 0.17, 0.16, 0.9, 0.16, c), box(x + lx, 0, z + 0.17, 0.16, 0.9, 0.16, c)]),
    box(x + dir * 0.95, 1.2, z, 0.45, 0.85, 0.3, c),
    box(x + dir * 1.25, 1.85, z, 0.7, 0.32, 0.28, c),
    box(x - dir * 0.95, 1.2, z, 0.12, 0.7, 0.14, "#1f1612"),
    box(x + dir * 0.9, 1.7, z, 0.12, 0.5, 0.1, "#1f1612")
  ];
}

/** Bunting: small pennants along a string at height `y`. */
export const bunting = (x0: number, x1: number, y: number, z: number, colours: readonly string[]): Part[] => {
  const n = Math.max(2, Math.round((x1 - x0) / 0.7));
  return Array.from({ length: n }, (_, i): Part => ({ k: "flag", x: x0 + ((i + 0.5) * (x1 - x0)) / n - 0.2, y: y - 0.35, z, w: 0.4, h: 0.35, c: colours[i % colours.length]!, c2: colours[(i + 1) % colours.length]! }));
};

// ---- The scene ----

export type Scenery = {
  parts: Part[];
  /** Colour of the ground the building stands on, where the paving does not cover it. */
  ground?: string;
};

/** A deterministic random number generator for scenery. */
export function seededRandom(seed: number): () => number {
  let s = (Math.abs(Math.trunc(seed)) % 2147483646) + 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

/** Far trees behind the building, so the sky does not end in a flat line. */
export function farTrees(seed: number, light: boolean, z0 = 15): Part[] {
  const r = seededRandom(seed), out: Part[] = [];
  const count = light ? 8 : 16;
  for (let i = 0; i < count; i++) {
    const x = -34 + (i * 68) / count + r() * 3, h = 6 + r() * 6;
    out.push(...tree(x, z0 + r() * 8, h, ["#3a6b3c", "#2f5f3a", "#4a7a3a"][Math.floor(r() * 3)]!));
  }
  return out;
}
