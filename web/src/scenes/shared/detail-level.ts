// How much picture the player gets, decided in one place. Pure (no browser, no graphics library), so it is unit-tested.
//
//   full      3D scenes with the generated models (the most to download)
//   standard  3D scenes drawn with the shapes built in code: no model files are downloaded
//   simple    the 2D scenes: the lightest, for weak devices and slow networks
//
// The player picks one of these or leaves it on "auto", which chooses from the device (scene-capability.ts). The choice can change at any
// moment, so scenes ask `resolveDetail` again and carry on from where they had got to.
import { MIN_WIDTH, decideScene, type Device } from "./scene-capability.ts";

export type DetailChoice = "auto" | "full" | "standard" | "simple";
export type DetailLevel = "full" | "standard" | "simple";

export type Detail = {
  choice: DetailChoice;
  level: DetailLevel;
  /** Which renderer draws the scene. */
  renderer: "3d" | "2d";
  /** Whether the generated GLB models may be downloaded and used. False means nothing from public/assets/3d is fetched. */
  models: boolean;
  /** Scenery density and resolution for the 3D and 2D renderers. */
  quality: "high" | "light";
  /** The device asks for reduced motion: the scenes show their calm 2D version whatever was chosen. */
  reducedMotion: boolean;
  /** One plain sentence about why this level is in use (shown next to the setting). */
  why: string;
};

export const CHOICES: readonly DetailChoice[] = ["auto", "full", "standard", "simple"];
export const LEVELS: readonly DetailLevel[] = ["full", "standard", "simple"];

export const DETAIL_TEXT: Readonly<Record<DetailChoice, { label: string; summary: string }>> = {
  auto: { label: "Automatic", summary: "Chooses for your device and connection." },
  full: { label: "Full", summary: "3D scenes with detailed models. Downloads the most." },
  standard: { label: "Standard", summary: "Simpler 3D scenes. No model downloads." },
  simple: { label: "Simple", summary: "Light 2D scenes. Uses the least data and power." }
};

export const parseChoice = (value: unknown): DetailChoice => (CHOICES as readonly unknown[]).includes(value) ? value as DetailChoice : "auto";

const REASONS: Record<string, string> = {
  "reduced-motion": "Reduced motion is switched on.",
  "save-data": "Data Saver is switched on.",
  "slow-network": "Your connection looks slow.",
  "low-memory": "This device has little memory.",
  narrow: "The screen is narrow."
};

export function resolveDetail(choice: DetailChoice, device: Device): Detail {
  // The scenes are full-screen, so the "narrow viewport" rule that hides the sign-in panel does not apply to them.
  const decision = decideScene({ ...device, viewportWidth: MIN_WIDTH });
  const quality = decision.run ? decision.quality : "light";
  const reducedMotion = !decision.run && decision.reason === "reduced-motion";
  let level: DetailLevel, why: string;
  if (reducedMotion) { level = "simple"; why = REASONS["reduced-motion"]!; }
  else if (choice === "auto") {
    if (!decision.run) { level = "simple"; why = `${REASONS[decision.reason] ?? "This device is limited."} Using light 2D scenes.`; }
    else if (decision.quality === "light") { level = "standard"; why = "This device looks modest. Using simpler 3D without model downloads."; }
    else { level = "full"; why = "Your device can show the full scenes."; }
  } else { level = choice; why = `You chose ${DETAIL_TEXT[choice].label}.`; }
  return { choice, level, renderer: level === "simple" ? "2d" : "3d", models: level === "full", quality, reducedMotion, why };
}

/** Whether going from one resolved detail to another needs the scene to be rebuilt (a different renderer, models or quality). */
export const needsRebuild = (a: Detail, b: Detail) => a.renderer !== b.renderer || a.models !== b.models || a.quality !== b.quality;

/** A key that changes exactly when a scene needs rebuilding; a canvas can be keyed on it, since a canvas cannot switch between 2D and WebGL. */
export const detailKey = (d: Detail) => `${d.renderer}-${d.models ? "m" : "s"}-${d.quality}`;

/** True when two resolved details would draw the same thing and say the same words. */
export const sameDetail = (a: Detail, b: Detail) =>
  a.choice === b.choice && a.level === b.level && a.models === b.models && a.quality === b.quality && a.reducedMotion === b.reducedMotion && a.why === b.why;
