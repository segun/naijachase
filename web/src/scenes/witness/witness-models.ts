import type { AvatarPreset } from "../../avatar/avatar-model.ts";
import type { Pose, Vec } from "../shared/scene-core.ts";

export const standingPose = (gait = 0, stride = 0): Pose => ({ x: 0, y: 0, z: 0, heading: 0, sit: 0, gait, stride, type: 0, visible: true });

export function sceneryFit(targetMin: Vec, targetMax: Vec, modelMin: Vec, modelMax: Vec, front = -Infinity, height?: number) {
  const target = targetMax.map((v, i) => v - targetMin[i]!);
  const size = modelMax.map((v, i) => v - modelMin[i]!);
  const scale = height === undefined ? Math.min(...target.map((v, i) => v / size[i]!)) : height / size[1]!;
  if (!Number.isFinite(scale) || scale <= 0) throw new Error("Witness scenery has invalid bounds");
  return {
    scale,
    position: [
      (targetMin[0] + targetMax[0]) / 2 - (modelMin[0] + modelMax[0]) * scale / 2,
      targetMin[1] - modelMin[1] * scale,
      Math.max(front, targetMin[2]) - modelMin[2] * scale
    ] as const
  };
}

export type ModelGroup = { id: string; yaw?: number; height?: number };
export const modelParts = <T extends object>(parts: T[], id: string, yaw = 0, height?: number): (T & { modelGroup: ModelGroup })[] => {
  const modelGroup = { id, yaw, ...(height === undefined ? {} : { height }) };
  return parts.map(p => ({ ...p, modelGroup }));
};

/** Select the supplied character by role, without changing the recipe's voice or account selection. */
export function witnessModelId(witness: AvatarPreset): string {
  const role = witness.label.toLowerCase();
  const woman = witness.presentation === "feminine";
  if (/elder|historian/.test(role)) return woman ? "witness_woman_elder" : "witness_man_elder";
  if (/guard|officer|bouncer|lifeguard/.test(role)) return woman ? "witness_woman_uniform" : "witness_man_security";
  if (/pastor|imam|custodian|priest|devotee/.test(role)) return woman ? "witness_woman_elder" : "witness_man_cleric";
  if (/herder|farmer|farm hand/.test(role)) return woman ? "witness_woman_trader" : "witness_man_farmer";
  if (/loader|porter|handler|mechanic|worker|welder|engineer|hand|fisher|operator|mender|carver|caster|dyer|groom|cook/.test(role))
    return woman ? "witness_woman_uniform" : "witness_man_worker";
  if (/trader|seller|vendor|weaver|maker|conductor|agbero/.test(role)) return woman ? "witness_woman_trader" : "witness_man_trader";
  if (/student|youth|dancer|performer/.test(role)) return woman ? "witness_woman_young" : "witness_man_young";
  if (/chief|leader/.test(role)) return woman ? "witness_woman_elder" : "witness_man_agbada";
  return woman ? "witness_woman_professional" : "witness_man_professional";
}

const CROWDS: Readonly<Record<string, readonly string[]>> = {
  market: ["trader_woman", "trader_man"], cattle_market: ["farmer", "trader_man"], craft_market: ["trader_woman", "trader_man"],
  festival_ground: ["dancer_festival", "drummer"], motor_park: ["commuter_man", "commuter_woman", "mechanic"],
  railway_station: ["commuter_man", "commuter_woman"], airport: ["pilot", "commuter_woman"],
  beach: ["fisherman", "trader_woman"], fishing_jetty: ["fisherman", "trader_man"], jetty: ["commuter_man", "commuter_woman"],
  waterfront: ["trader_woman", "fisherman"], seaport: ["sailor_docker", "commuter_man"],
  farm: ["farmer", "trader_woman"], mining_site: ["miner", "commuter_man"], refinery: ["mechanic", "commuter_man"],
  factory_gate: ["mechanic", "commuter_woman"], conservation_office: ["ranger", "commuter_man"],
  church: ["priest", "commuter_woman"], mosque: ["imam", "commuter_man"], sacred_grove: ["chief", "commuter_woman"],
  police_station: ["police", "commuter_woman"], hospital: ["doctor", "nurse"],
  community_hall: ["chief", "commuter_woman"], traditional_council: ["chief", "commuter_woman"],
  emir_palace: ["chief", "commuter_man"], palace: ["chief", "drummer"],
  museum: ["receptionist", "commuter_man"], library: ["student", "commuter_woman"], university: ["student", "commuter_man"],
  monument: ["commuter_man", "commuter_woman"], radio_station: ["receptionist", "commuter_man"],
  carnival_workshop: ["dancer_festival", "drummer"], hotel: ["receptionist", "commuter_man"],
  restaurant: ["chef", "waiter"], nightclub: ["bouncer", "waiter"]
};
export function crowdModelId(venue: string, index: number): string {
  const kinds = CROWDS[venue];
  if (!kinds) throw new Error(`No witness crowd models for "${venue}"`);
  return `crowd_${kinds[index % kinds.length]}`;
}
