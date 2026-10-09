// The 2D scenery sets for the witness scene, the counterparts of the 3D sets (chase3d-sets.ts). The common parts (sky, the lane, the
// vehicle, the player, the witness, the camera) are drawn by witness-2d.ts and are the same for every venue, so a set only adds scenery.
// Every set id used by a recipe must be registered here and in chase3d-sets.ts: both renderers must exist for every set.
//
// A set draws with billboards: flat pictures that always face the camera, sized in metres and placed in the world with `project` from
// witness-2d-kit.ts. Return them as `Item`s with their depth (`project(...).z`) and the core paints everything back to front.
import type { Palette } from "../shared/scene-core.ts";
import type { WitnessOptions } from "./witness-driver.ts";
import { type Cam, type Ctx, type Item } from "./witness-2d-kit.ts";
import { buildMarket2d } from "./witness-2d-market.ts";
import { OPEN_AIR_SETS_2D } from "./witness-2d-open-air.ts";
import { BUILDING_SETS_2D } from "./witness-2d-buildings.ts";

export type SetContext2D = { g: Ctx; options: WitnessOptions; palette: Palette };
export type SetResult2D = {
  /** The colour of the ground behind the lane (default red earth). */
  ground?: string;
  /** The tarred lane along the front: its road, kerb and dash colours. */
  lane?: { road: string; kerb: string; dash: string };
  /** Drawn over the ground at the horizon, before the haze: a skyline, hills, the sea. */
  backdrop?: (c: Cam, horizon: number, t: number) => void;
  /** The scenery and people to paint at `t` seconds. Must be a pure function of `t`. */
  items?: (c: Cam, t: number) => Item[];
};
export type Set2D = (context: SetContext2D) => SetResult2D;

export const SETS_2D: Readonly<Record<string, Set2D>> = {
  market: buildMarket2d,
  ...OPEN_AIR_SETS_2D,
  ...BUILDING_SETS_2D
};

/** The set for a recipe's `set` id. An unregistered id falls back to the market, loudly, rather than showing nothing. */
export function setFor(id: string): Set2D {
  const set = SETS_2D[id];
  if (set) return set;
  console.warn(`No 2D witness set called "${id}"; showing the market instead.`);
  return buildMarket2d;
}
