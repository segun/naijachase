// What makes each kind of venue look and sound like itself, as data. The witness scene is built from one of these, so a new venue
// is a new entry here (plus, for now, its dressing in chase3d-witness.ts) rather than a new scene. Only the market exists so far;
// every other venue goes straight to the investigation until it has a recipe.
import type { AvatarPreset } from "../../avatar/avatar-model.ts";

/** How loud each layer of the venue's ambience is, 0 to 1. */
export type SoundMix = {
  /** The murmur of many people. */
  crowd: number;
  /** Individual voices calling out across the space. */
  calls: number;
  /** A generator, engine or machinery hum. */
  hum: number;
  /** Small bright sounds: coins, bells, metal on metal. */
  clinks: number;
};

export type VenueRecipe = {
  id: string;
  /** Which set of scenery chase3d-witness.ts builds. */
  set: "market";
  sound: SoundMix;
  /** Fictional witnesses for this kind of venue; one is picked from the account so it is always the same person. */
  witnesses: readonly (AvatarPreset & { /** Voice pitch in Hz. */ pitch: number })[];
};

const look = (id: string, label: string, presentation: AvatarPreset["presentation"], skin: string, hair: string, hairColor: string, primary: string, secondary: string, accent: string, pitch: number) =>
  ({ avatar_id: id, label, presentation, skin_tone: "brown", skin_color: skin, hair_style: hair, hair_color: hairColor, uniform_primary: primary, uniform_secondary: secondary, uniform_accent: accent, pitch });

const MARKET: VenueRecipe = {
  id: "market",
  set: "market",
  sound: { crowd: 1, calls: 0.8, hum: 0.35, clinks: 0.5 },
  witnesses: [
    look("w-market-1", "Market woman", "feminine", "#6e4630", "head_wrap", "#2a1a12", "#b5483a", "#f2c14e", "#1f6f5c", 205),
    look("w-market-2", "Produce seller", "feminine", "#8a5a3c", "braided_bun", "#1c1410", "#2e6f8f", "#f4ecd8", "#d9822b", 215),
    look("w-market-3", "Textile trader", "masculine", "#5a3a28", "low_cut", "#15100d", "#7a4aa0", "#f4ecd8", "#e0b23a", 118),
    look("w-market-4", "Food vendor", "feminine", "#a06a45", "head_wrap", "#241812", "#2f8f5b", "#f6d365", "#b5483a", 220),
    look("w-market-5", "Loader", "masculine", "#4a3022", "fade", "#0e0a08", "#c78a2c", "#3b4a5a", "#e8e2cf", 105),
    look("w-market-6", "Customer", "feminine", "#7a4f35", "bob", "#1b130e", "#c0568a", "#f4ecd8", "#2a6f9f", 210)
  ]
};

const RECIPES: Record<string, VenueRecipe> = { market: MARKET };

/** The recipe for a venue, or undefined while that venue has no witness scene. */
export const recipeFor = (venueId: string): VenueRecipe | undefined => RECIPES[venueId];

/** A stable number from some text, so a given account always gets the same witness and the same voice. */
export function hashOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const witnessFor = (recipe: VenueRecipe, seed: string) => recipe.witnesses[hashOf(seed) % recipe.witnesses.length]!;
