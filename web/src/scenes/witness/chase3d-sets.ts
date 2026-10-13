// The 3D scenery sets for the witness scene. A set builds everything that makes one kind of venue look like itself (its buildings, props,
// crowd, lights) and returns anything that has to move each frame. The common parts (sky, ground, the lane, the vehicle, the player, the
// witness, the camera, the sound) are built by chase3d-witness.ts and are the same for every venue, so a set only adds scenery.
//
// To add a set: write a `Set3D` in its own file, register it below under the `set` id used by the venue's recipe (venue-recipes.ts and
// the recipe files) and add it to the 2D registry too (witness-2d-sets.ts); both renderers must exist for every set.
import type { Stage } from "../shared/chase3d-stage.ts";
import type { WitnessOptions } from "./witness-driver.ts";
import { buildMarket3d } from "./chase3d-market.ts";
import { OPEN_AIR_SETS_3D } from "./chase3d-open-air.ts";
import { BUILDING_SETS_3D } from "./chase3d-buildings.ts";

export type SetContext3D = {
  stage: Stage;
  options: WitnessOptions;
};
export type SetResult3D = {
  ready?: Promise<unknown>;
  /** Moves things (a crowd, a flag, water) to their place for `t` seconds into the scene. Must be a pure function of `t`. */
  update?: (t: number) => void;
};
export type Set3D = (context: SetContext3D) => SetResult3D;

export const SETS_3D: Readonly<Record<string, Set3D>> = {
  market: buildMarket3d,
  ...OPEN_AIR_SETS_3D,
  ...BUILDING_SETS_3D
};

/** The set for a recipe's `set` id. An unregistered id falls back to the market, loudly, rather than showing nothing. */
export function setFor(id: string): Set3D {
  const set = SETS_3D[id];
  if (set) return set;
  console.warn(`No 3D witness set called "${id}"; showing the market instead.`);
  return buildMarket3d;
}
