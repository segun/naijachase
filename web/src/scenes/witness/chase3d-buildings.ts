// 3D sets for the buildings: religious, civic, cultural, learning and hospitality venues (see docs/agents/Agent2.md). All four families are
// drawn from the same layout data (layout-buildings-venues.ts), which picks the venue from the recipe's variant; the set id groups them.
import type { Set3D } from "./chase3d-sets.ts";
import { buildLayout3d } from "./chase3d-buildings-kit.ts";

const set: Set3D = ({ stage, options }) => buildLayout3d(stage, options);

export const BUILDING_SETS_3D: Readonly<Record<string, Set3D>> = {
  worship: set,
  civic: set,
  culture_learning: set,
  hospitality: set
};
