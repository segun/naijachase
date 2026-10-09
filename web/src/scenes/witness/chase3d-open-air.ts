// 3D sets for the open-air, transport, water and work venues (Agent1's venues; see docs/agents/Agent1.md). Register each set under the
// `set` id its recipe uses. Each set is a layout (layout-open-air-*.ts) drawn by the shared open-air kit, so the 2D registry shows the same place.
import type { Set3D } from "./chase3d-sets.ts";
import { openAirSet3d } from "./chase3d-open-air-kit.ts";
import { marketLayout } from "./layout-open-air-market.ts";
import { transportLayout } from "./layout-open-air-transport.ts";
import { waterLayout } from "./layout-open-air-water.ts";
import { workLayout } from "./layout-open-air-work.ts";

export const OPEN_AIR_SETS_3D: Readonly<Record<string, Set3D>> = {
  market_variants: openAirSet3d(marketLayout),
  transport_hub: openAirSet3d(transportLayout),
  water_edge: openAirSet3d(waterLayout),
  work_and_land: openAirSet3d(workLayout)
};
