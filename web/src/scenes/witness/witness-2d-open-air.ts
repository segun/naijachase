// 2D sets for the open-air, transport, water and work venues (Agent1's venues; see docs/agents/Agent1.md). Register each set under the
// `set` id its recipe uses, the same id as in chase3d-open-air.ts. Each set is a layout (layout-open-air-*.ts) drawn by the shared open-air kit.
import type { Set2D } from "./witness-2d-sets.ts";
import { openAirSet2d } from "./witness-2d-open-air-kit.ts";
import { marketLayout } from "./layout-open-air-market.ts";
import { transportLayout } from "./layout-open-air-transport.ts";
import { waterLayout } from "./layout-open-air-water.ts";
import { workLayout } from "./layout-open-air-work.ts";

export const OPEN_AIR_SETS_2D: Readonly<Record<string, Set2D>> = {
  market_variants: openAirSet2d(marketLayout),
  transport_hub: openAirSet2d(transportLayout),
  water_edge: openAirSet2d(waterLayout),
  work_and_land: openAirSet2d(workLayout)
};
