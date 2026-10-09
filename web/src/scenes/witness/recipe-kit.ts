// Types and helpers for writing venue recipes, kept apart from the recipe registry (venue-recipes.ts) so that recipe files can import them
// without importing each other.
import type { AvatarPreset } from "../../avatar/avatar-model.ts";

/** A repeating or continuous sound a venue can add on top of the four base layers (see witness-audio.ts for how each is made). */
export type SoundExtra =
  /** A tone now and then: a church bell, a train whistle, a ship's horn, a call to prayer's first note. `every` is the average seconds between sounds. */
  | { kind: "tone"; freq: number; every: number; length: number; level: number; shape?: OscillatorType; /** End pitch as a multiple of `freq`: 1.2 rises, 0.8 falls. */ slide?: number; vibrato?: boolean }
  /** Filtered noise that rises and falls: surf, wind, rushing water, machinery, traffic. `rate` is how many swells a second. */
  | { kind: "swell"; freq: number; rate: number; level: number; filter?: BiquadFilterType; q?: number }
  /** A steady beat: festival drums, a nightclub's bass, a hammer on metal. */
  | { kind: "pulse"; bpm: number; freq: number; level: number }
  /** Short high calls at random: birds, crickets, frogs. `rate` is roughly how many a second. */
  | { kind: "chirps"; freq: number; rate: number; level: number };

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
  /** Anything that makes this venue sound like itself and is not one of the four above. */
  extras?: readonly SoundExtra[];
};

export type Witness = AvatarPreset & { /** Voice pitch in Hz. */ pitch: number };

export type VenueRecipe = {
  /** The venue id from data/exports/witness-location-scenes.json (`venue_id`). */
  id: string;
  /** Which scenery set both renderers build (chase3d-sets.ts and witness-2d-sets.ts). Several venues can share one set. */
  set: string;
  /** Lets one set show several venues differently (for example "church" or "mosque" in one religious set). */
  variant?: string;
  sound: SoundMix;
  /** Fictional witnesses for this kind of venue; one is picked from the account so it is always the same person. */
  witnesses: readonly Witness[];
};

/** A witness look: colours and a hair style (avatar-model.ts has the styles) plus a voice pitch (about 100-130 for a low voice, 200-230 for a high one). */
export const look = (id: string, label: string, presentation: AvatarPreset["presentation"], skin: string, hair: string, hairColor: string, primary: string, secondary: string, accent: string, pitch: number): Witness =>
  ({ avatar_id: id, label, presentation, skin_tone: "brown", skin_color: skin, hair_style: hair, hair_color: hairColor, uniform_primary: primary, uniform_secondary: secondary, uniform_accent: accent, pitch });
