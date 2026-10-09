// 2D sets for the buildings: religious, civic, cultural, learning and hospitality venues (see docs/agents/Agent2.md). All four families are
// drawn from the same layout data as the 3D sets (layout-buildings-venues.ts), which picks the venue from the recipe's variant.
import type { Set2D } from "./witness-2d-sets.ts";
import { buildLayout2d } from "./witness-2d-buildings-kit.ts";

const set: Set2D = ({ g, options, palette }) => buildLayout2d(g, options, palette);

export const BUILDING_SETS_2D: Readonly<Record<string, Set2D>> = {
  worship: set,
  civic: set,
  culture_learning: set,
  hospitality: set
};
