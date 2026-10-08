// Where things stand in the market, shared by the 3D and the 2D renderers so both show the same place. Metres, same axes as
// witness-scene.ts. Pure data and a little arithmetic, so it needs no renderer and is unit-tested.
import { WITNESS } from "./witness-scene.ts";

export type Ware = "tomatoes" | "cloth" | "yams" | "fruit";
export type StallSpec = { x: number; z: number; w: number; stripes: readonly [string, string]; ware: Ware; tarp?: string; frontPoles: boolean };

/** The witness's own stall comes first; it has a tarp behind it and no front poles, so nothing stands between the camera and her. */
export const STALLS: readonly StallSpec[] = [
  { x: WITNESS.x, z: 1.95, w: 2.6, stripes: ["#2e6f8f", "#f4ecd8"], ware: "tomatoes", tarp: "#1f5f55", frontPoles: false },
  { x: -2.6, z: 2.3, w: 2.4, stripes: ["#b5483a", "#f2c14e"], ware: "cloth", frontPoles: true },
  { x: 4.4, z: 2.3, w: 2.6, stripes: ["#2f8f5b", "#f4ecd8"], ware: "yams", frontPoles: true },
  { x: 7.6, z: 2.5, w: 2.4, stripes: ["#d9822b", "#f4ecd8"], ware: "fruit", frontPoles: true },
  { x: -6.2, z: 2.6, w: 2.6, stripes: ["#7a4aa0", "#f4ecd8"], ware: "tomatoes", frontPoles: true },
  { x: -4, z: 6, w: 2.6, stripes: ["#c0392b", "#f4ecd8"], ware: "fruit", frontPoles: true },
  { x: 0.5, z: 6.4, w: 2.6, stripes: ["#2e6f8f", "#f2c14e"], ware: "cloth", frontPoles: true },
  { x: 5, z: 6.2, w: 2.6, stripes: ["#b5483a", "#f4ecd8"], ware: "yams", frontPoles: true },
  { x: 9, z: 6, w: 2.6, stripes: ["#2f8f5b", "#f2c14e"], ware: "tomatoes", frontPoles: true },
  { x: -8.5, z: 6.4, w: 2.6, stripes: ["#d9822b", "#f4ecd8"], ware: "cloth", frontPoles: true }
];

/** x, z and height of each palm. */
export const PALMS: readonly (readonly [number, number, number])[] = [[-9, 11, 7], [8.5, 12, 8], [-14, 9, 6.5], [15, 10, 7.5], [-4, 15, 8.5], [3, 16, 7]];

export const BANNER = { x: -0.2, y: 3.55, z: -0.6, w: 7.6, h: 1.1 } as const;
/** The shoppers browsing at the stalls: x, z and which way they lean. */
export const SHOPPERS: readonly (readonly [number, number, number])[] = [[-2.6, 1.3, 0], [4.4, 1.3, 0.2], [7.6, 1.5, -0.1]];

// ---- Passers-by ----

const WRAP = 20;
const LANES = [-1.5, 4.6, 4, 4.6, -1, 4.2, 4.6, 3.9] as const;

/** How many walkers there are: a lighter scene has fewer. */
export const crowdSize = (light: boolean) => (light ? 4 : 8);

export type Walker = { x: number; z: number; /** +1 walks towards +x. */ dir: 1 | -1; /** Leg swing, radians. */ swing: number; bounce: number };

/** Walker `i` of `count` at `t` seconds: they stroll along their lane and wrap round, so it is the same for any frame. */
export function walkerAt(i: number, count: number, t: number): Walker {
  const dir = i % 2 === 0 ? 1 : -1;
  const speed = 0.7 + (i % 4) * 0.2;
  const phase = i * 1.3;
  const along = -9 + (i * 18) / count + dir * speed * t;
  const step = Math.sin(t * speed * 5 + phase);
  return { x: ((((along + WRAP / 2) % WRAP) + WRAP) % WRAP) - WRAP / 2, z: LANES[i % 8]!, dir, swing: step * 0.5, bounce: Math.abs(step) * 0.02 };
}

export type Look = { woman: boolean; skin: string; top: string; bottom: string; tie: string; print: number; basket: string | null; goods: string };
const SKINS = ["#5a3a28", "#6e4630", "#8a5a3c", "#a06a45", "#3f2a1e"];
const COLOURS = ["#c0392b", "#2e6f8f", "#d9822b", "#2f8f5b", "#7a4aa0", "#e0b23a", "#f4ecd8", "#b5483a"];

/** A passer-by's clothes and skin, fixed by their seed (the same in both renderers). */
export function lookOf(seed: number): Look {
  let s = (Math.abs(Math.trunc(seed)) % 2147483646) + 1;
  const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const skin = SKINS[Math.floor(r() * 5)]!;
  const woman = r() < 0.6;
  const top = COLOURS[Math.floor(r() * COLOURS.length)]!;
  const print = Math.floor(r() * 4);
  const bottom = ["#2a3340", "#4a3f35", "#1f2a24"][Math.floor(r() * 3)]!;
  const tie = COLOURS[Math.floor(r() * COLOURS.length)]!;
  const carries = woman && r() < 0.45;
  return { woman, skin, top, bottom, tie, print, basket: carries ? "#b0803f" : null, goods: ["#c0392b", "#e0b23a", "#2f8f5b"][Math.floor(r() * 3)]! };
}
/** Ankara-style prints for market wrappers: base, accent, dot. */
export const PRINTS: readonly (readonly [string, string, string])[] = [["#2e6f8f", "#f4ecd8", "#d9822b"], ["#b5483a", "#f2c14e", "#1f3a2a"], ["#2f8f5b", "#f4ecd8", "#7a4aa0"], ["#d9822b", "#2a1a12", "#f4ecd8"]];
