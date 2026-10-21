import definitions from "../../../shared/ad-placements.json" with { type: "json" };
export type Placement = { id: string; scene: string; label: string; position: number[]; size: number[]; yaw: number; surface: string; segment: string; width: number; height: number; fallback: string };
export type Ad = { placement_id: string; creative_id: number; alt_text: string; destination: string; starts_at: number; ends_at: number; image_url: string };
export const placements: readonly Placement[] = definitions;
export function activeAd(ads: readonly Ad[], id: string, now: number): Ad | undefined {
  return ads.find(a => a.placement_id === id && a.starts_at <= now && now < a.ends_at);
}
/** Whole-wall and split inventory must never draw on top of each other. */
export function scenePlacements(scene: string, ads: readonly Ad[], now: number): readonly Placement[] {
  const all = placements.filter(p => p.scene === scene);
  const split = new Set(all.filter(p => p.segment !== "whole" && activeAd(ads,p.id,now)).map(p => p.surface));
  return all.filter(p => split.has(p.surface) ? p.segment !== "whole" : p.segment === "whole");
}
export function validAd(value: unknown): value is Ad {
  if (!value || typeof value !== "object") return false;
  const a = value as Ad;
  if (!placements.some(p=>p.id===a.placement_id) || !Number.isSafeInteger(a.creative_id) || a.creative_id < 1 || typeof a.alt_text !== "string" || !Number.isFinite(a.starts_at) || !Number.isFinite(a.ends_at) || a.ends_at<=a.starts_at || a.image_url !== `/ads-api/v1/images/${a.creative_id}`) return false;
  try {const u=new URL(a.destination);return u.protocol==="https:" && !u.username && !u.password;}catch{return false;}
}
