// The three chase locations and how they blend into each other. Pure data and maths (no Babylon.js) so it is unit-tested.
export type Rgb = readonly [number, number, number];

export type Palette = {
  skyTop: Rgb; skyHorizon: Rgb; fog: Rgb; fogDensity: number;
  road: Rgb; kerb: Rgb; ground: Rgb;
  hemi: Rgb; hemiGround: Rgb; hemiIntensity: number;
  sun: Rgb; sunIntensity: number; sunDir: Rgb;
  rim: Rgb; rimIntensity: number;
  disc: Rgb; discSize: number; discPos: Rgb;
  stars: number; glow: number;
};

export type Biome = { id: "lagos" | "anambra" | "kano"; name: string; zone: string; center: number; palette: Palette };

export const SEGMENT = 140; // metres of street per location
export const SPEED = 9; // average metres per second the world scrolls past the runners
/** 0 = constant speed. At 0.6 the world eases down to 40% while a city's sign passes, and speeds up between cities. */
export const EASE = 0.6;
export const RING = SEGMENT * 3;
export const CYCLE_SECONDS_TOTAL = RING / SPEED;

/** Metres travelled after `seconds`. Slowest at each city centre, so its sign is readable; averages SPEED over a segment. */
export function distanceAt(seconds: number): number {
  const s0 = seconds * SPEED;
  return s0 - EASE * (SEGMENT / (2 * Math.PI)) * Math.sin((2 * Math.PI * s0) / SEGMENT);
}
/** Current speed as a fraction of SPEED. */
export const speedFactorAt = (seconds: number): number => 1 - EASE * Math.cos((2 * Math.PI * seconds * SPEED) / SEGMENT);

const lagos: Palette = {
  skyTop: [0.004, 0.024, 0.031], skyHorizon: [0.04, 0.14, 0.15], fog: [0.012, 0.055, 0.05], fogDensity: 0.016,
  road: [0.05, 0.13, 0.1], kerb: [0.09, 0.25, 0.18], ground: [0.03, 0.09, 0.07],
  hemi: [0.5, 0.72, 0.66], hemiGround: [0.04, 0.12, 0.09], hemiIntensity: 0.32,
  sun: [0.72, 0.83, 1], sunIntensity: 0.9, sunDir: [-0.5, -1, 0.6],
  rim: [0.5, 0.72, 1], rimIntensity: 0.9,
  disc: [0.96, 0.93, 0.77], discSize: 7, discPos: [40, 38, 120],
  stars: 1, glow: 1
};
const anambra: Palette = {
  skyTop: [0.05, 0.035, 0.12], skyHorizon: [0.62, 0.25, 0.1], fog: [0.2, 0.1, 0.08], fogDensity: 0.015,
  road: [0.16, 0.1, 0.08], kerb: [0.3, 0.17, 0.1], ground: [0.12, 0.07, 0.05],
  hemi: [0.95, 0.58, 0.42], hemiGround: [0.14, 0.07, 0.05], hemiIntensity: 0.42,
  sun: [1, 0.62, 0.34], sunIntensity: 1.05, sunDir: [-0.9, -0.42, 0.3],
  rim: [1, 0.6, 0.3], rimIntensity: 0.8,
  disc: [1, 0.55, 0.22], discSize: 11, discPos: [-34, 30, 120],
  stars: 0.25, glow: 0.8
};
const kano: Palette = {
  skyTop: [0.12, 0.22, 0.42], skyHorizon: [0.98, 0.72, 0.42], fog: [0.66, 0.52, 0.37], fogDensity: 0.011,
  road: [0.52, 0.36, 0.22], kerb: [0.68, 0.48, 0.3], ground: [0.62, 0.4, 0.22],
  hemi: [1, 0.86, 0.66], hemiGround: [0.4, 0.28, 0.18], hemiIntensity: 0.38,
  sun: [1, 0.8, 0.52], sunIntensity: 0.95, sunDir: [-0.7, -0.5, 0.4],
  rim: [1, 0.8, 0.55], rimIntensity: 0.35,
  disc: [1, 0.92, 0.65], discSize: 13, discPos: [-22, 34, 120],
  stars: 0, glow: 0
};

export const BIOMES: readonly Biome[] = [
  { id: "lagos", name: "Lagos", zone: "South West", center: 0, palette: lagos },
  { id: "anambra", name: "Anambra", zone: "South East", center: SEGMENT, palette: anambra },
  { id: "kano", name: "Kano", zone: "North West", center: SEGMENT * 2, palette: kano }
];

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** Shortest signed distance from b to a on the ring. */
export const ringDelta = (a: number, b: number, ring = RING): number => ((((a - b + ring / 2) % ring) + ring) % ring) - ring / 2;

/** How far along the looping street the runners are, in metres. */
export const progressAt = (seconds: number): number => ((distanceAt(seconds) % RING) + RING) % RING;

/** Weight of each location at street position `p`. Weights always sum to 1: a hold, then a smooth hand-over. */
export function biomeWeights(p: number): number[] {
  const raw = BIOMES.map(b => 1 - smoothstep(SEGMENT * 0.3, SEGMENT * 0.7, Math.abs(ringDelta(p, b.center))));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(w => w / sum);
}

export const dominant = (weights: readonly number[]): number => weights.indexOf(Math.max(...weights));

const mixNumber = (key: (p: Palette) => number, w: readonly number[]) => BIOMES.reduce((sum, b, i) => sum + key(b.palette) * w[i]!, 0);
const mixRgb = (key: (p: Palette) => Rgb, w: readonly number[]): Rgb => [0, 1, 2].map(c => mixNumber(p => key(p)[c]!, w)) as unknown as Rgb;

export function blendPalette(w: readonly number[]): Palette {
  return {
    skyTop: mixRgb(p => p.skyTop, w), skyHorizon: mixRgb(p => p.skyHorizon, w), fog: mixRgb(p => p.fog, w), fogDensity: mixNumber(p => p.fogDensity, w),
    road: mixRgb(p => p.road, w), kerb: mixRgb(p => p.kerb, w), ground: mixRgb(p => p.ground, w),
    hemi: mixRgb(p => p.hemi, w), hemiGround: mixRgb(p => p.hemiGround, w), hemiIntensity: mixNumber(p => p.hemiIntensity, w),
    sun: mixRgb(p => p.sun, w), sunIntensity: mixNumber(p => p.sunIntensity, w), sunDir: mixRgb(p => p.sunDir, w),
    rim: mixRgb(p => p.rim, w), rimIntensity: mixNumber(p => p.rimIntensity, w),
    disc: mixRgb(p => p.disc, w), discSize: mixNumber(p => p.discSize, w), discPos: mixRgb(p => p.discPos, w),
    stars: mixNumber(p => p.stars, w), glow: mixNumber(p => p.glow, w)
  };
}
