// Pure description of the procedural avatars (P3.7.4). The server owns the ten presets; this module only turns a preset
// into drawable primitives, shared by the Babylon.js renderer and the SVG fallback, so it is unit-tested without WebGL.
import type { AvatarCatalogue, AvatarPreset } from "../../../contracts/typescript/api-v1.ts";
import type { Device } from "../scenes/shared/scene-capability.ts";

export type { AvatarCatalogue, AvatarPreset };

export const CATALOGUE_VERSION = 1;
export const RENDERER = "babylon_procedural_v1";
export const OPTION_COUNT = 10;

const HEX = /^#[0-9A-Fa-f]{6}$/;
export const safeColor = (value: unknown, fallback = "#808080"): string => (typeof value === "string" && HEX.test(value) ? value : fallback);

/** Returns a user-safe reason when the catalogue cannot be rendered, or null when it is usable. */
export function catalogueProblem(c: AvatarCatalogue | null | undefined): string | null {
  if (!c || !Array.isArray(c.options)) return "The avatar list could not be read.";
  if (c.catalogue_version !== CATALOGUE_VERSION || c.renderer !== RENDERER) return "This avatar list needs a newer version of the game. Reload the page and try again.";
  const ids = new Set(c.options.map(o => o?.avatar_id));
  if (c.options.length !== OPTION_COUNT || ids.size !== OPTION_COUNT) return "The avatar list is incomplete. Please try again in a moment.";
  const colours: (keyof AvatarPreset)[] = ["skin_color", "hair_color", "uniform_primary", "uniform_secondary", "uniform_accent"];
  for (const o of c.options) {
    if (!o.avatar_id || !o.label || colours.some(k => !HEX.test(String(o[k])))) return "The avatar list is incomplete. Please try again in a moment.";
  }
  return null;
}

const humanize = (value: string) => {
  const text = value.replace(/_/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};
/** Skin tone and hair are always written out, so colour is never the only carrier of meaning. */
export const skinToneLabel = (preset: AvatarPreset) => humanize(preset.skin_tone);
export const hairLabel = (preset: AvatarPreset) => humanize(preset.hair_style);

/** Browser-only presets are never invented; weak or metered devices simply draw the same fields as an SVG silhouette. */
export function avatarRenderer(d: Device): "webgl" | "silhouette" {
  if (d.saveData) return "silhouette";
  if (d.connection && /^(slow-2g|2g|3g)$/.test(d.connection)) return "silhouette";
  if (d.memoryGb !== undefined && d.memoryGb < 2) return "silhouette";
  return "webgl";
}

export type Tint = "hair" | "skin" | "primary" | "secondary" | "accent";
export type Part = { shape: "sphere" | "capsule" | "box" | "cylinder"; at: [number, number, number]; size: [number, number, number]; tint: Tint };

/** Presentation only nudges the silhouette; it never changes anything else about the character. */
export function build(preset: AvatarPreset) {
  const feminine = preset.presentation === "feminine";
  return { shoulder: feminine ? 0.5 : 0.6, waist: feminine ? 0.38 : 0.46, hip: feminine ? 0.46 : 0.4, arm: feminine ? 0.125 : 0.15 };
}

// ---- 3D hair, in head units: the head is a unit sphere at the origin, the face looks towards -z. ----

const cap = (height = 1, y = 0.12, tint: Tint = "hair"): Part => ({ shape: "sphere", at: [0, y, 0.07], size: [1.08, height, 1.08], tint });
const ring = (count: number, from: number, to: number, make: (angle: number) => Part): Part[] =>
  Array.from({ length: count }, (_, i) => make(from + ((to - from) * i) / Math.max(1, count - 1)));

const HAIR: Record<string, () => Part[]> = {
  close_crop: () => [cap(1)],
  low_cut: () => [cap(0.96, 0.11)],
  fade: () => [cap(0.92, 0.1), { shape: "box", at: [0, 0.5, 0.06], size: [0.5, 0.1, 0.55], tint: "hair" }],
  short_coils: () => [
    cap(0.9, 0.08),
    { shape: "sphere", at: [0, 0.54, 0.08], size: [0.24, 0.24, 0.24], tint: "hair" },
    ...ring(7, 0, Math.PI * 2 * (6 / 7), a => ({ shape: "sphere", at: [Math.cos(a) * 0.3, 0.44, 0.08 + Math.sin(a) * 0.3], size: [0.2, 0.2, 0.2], tint: "hair" }))
  ],
  short_waves: () => [
    cap(0.98),
    ...[-0.12, 0.04, 0.2].map((z): Part => ({ shape: "sphere", at: [0, 0.52, z], size: [0.78, 0.1, 0.17], tint: "hair" }))
  ],
  short_locs: () => [
    cap(0.92, 0.08),
    ...ring(11, Math.PI * 0.12, Math.PI * 0.88, a => ({ shape: "capsule", at: [Math.cos(a) * 0.44, 0.22, 0.1 + Math.sin(a) * 0.44], size: [0.12, 0.36, 0.12], tint: "hair" })),
    ...ring(5, Math.PI * 1.08, Math.PI * 1.92, a => ({ shape: "capsule", at: [Math.cos(a) * 0.3, 0.4, 0.1 + Math.sin(a) * 0.3], size: [0.12, 0.3, 0.12], tint: "hair" }))
  ],
  bob: () => [
    cap(1),
    { shape: "box", at: [0, -0.14, 0.32], size: [1.1, 0.62, 0.4], tint: "hair" },
    { shape: "box", at: [-0.53, -0.1, 0.16], size: [0.14, 0.52, 0.56], tint: "hair" },
    { shape: "box", at: [0.53, -0.1, 0.16], size: [0.14, 0.52, 0.56], tint: "hair" }
  ],
  shoulder_twists: () => [
    cap(0.98),
    ...ring(8, Math.PI * 0.05, Math.PI * 0.95, a => ({ shape: "capsule", at: [Math.cos(a) * 0.5, -0.3, 0.2 + Math.sin(a) * 0.4], size: [0.13, 1.0, 0.13], tint: "hair" }))
  ],
  braided_bun: () => [
    cap(0.98),
    { shape: "sphere", at: [0, 0.6, 0.16], size: [0.42, 0.42, 0.42], tint: "hair" },
    ...[-0.16, 0, 0.16].map((x): Part => ({ shape: "capsule", at: [x, -0.22, 0.5], size: [0.1, 0.62, 0.1], tint: "hair" }))
  ],
  head_wrap: () => [
    { shape: "sphere", at: [0, -0.02, 0.4], size: [0.56, 0.44, 0.34], tint: "hair" },
    cap(1.02, 0.14, "primary"),
    { shape: "cylinder", at: [0, 0.22, 0.08], size: [1.13, 0.1, 1.13], tint: "accent" },
    { shape: "sphere", at: [0, 0.62, 0.02], size: [0.38, 0.3, 0.38], tint: "primary" }
  ]
};

/** An unknown hairstyle (a future catalogue version) degrades to a plain cap instead of breaking the picker. */
export const hairParts = (style: string): Part[] => (HAIR[style] ?? HAIR["close_crop"]!)();
export const HAIR_STYLES = Object.keys(HAIR);

// ---- 2D silhouette: the same fields drawn as SVG shapes in a 120x200 box. ----

export type Shape =
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number; tint: Tint }
  | { kind: "rect"; x: number; y: number; w: number; h: number; r: number; tint: Tint };

const HEAD = { cx: 60, cy: 42, rx: 21, ry: 23 };
const dome = (ry = 15, cy = 33, tint: Tint = "hair"): Shape => ({ kind: "ellipse", cx: 60, cy, rx: 23, ry, tint });
const dot = (cx: number, cy: number, r: number, tint: Tint = "hair"): Shape => ({ kind: "ellipse", cx, cy, rx: r, ry: r, tint });

const HAIR_2D: Record<string, () => { back: Shape[]; front: Shape[] }> = {
  close_crop: () => ({ back: [], front: [dome(14)] }),
  low_cut: () => ({ back: [], front: [dome(13)] }),
  fade: () => ({ back: [], front: [dome(12), { kind: "rect", x: 46, y: 17, w: 28, h: 6, r: 3, tint: "hair" }] }),
  short_coils: () => ({ back: [], front: [dome(12, 34), ...[40, 49, 60, 71, 80].map((x, i) => dot(x, 20 + (i % 2 === 0 ? 4 : 0), 6))] }),
  short_waves: () => ({ back: [], front: [dome(14), { kind: "ellipse", cx: 60, cy: 22, rx: 18, ry: 3, tint: "hair" }, { kind: "ellipse", cx: 64, cy: 17, rx: 14, ry: 3, tint: "hair" }] }),
  short_locs: () => ({ back: [], front: [dome(12, 34), ...[37, 44, 76, 83].map(x => ({ kind: "rect", x: x - 3, y: 30, w: 6, h: 20, r: 3, tint: "hair" }) as Shape)] }),
  bob: () => ({ back: [{ kind: "rect", x: 35, y: 28, w: 50, h: 40, r: 14, tint: "hair" }], front: [dome(14)] }),
  shoulder_twists: () => ({ back: [{ kind: "rect", x: 34, y: 28, w: 52, h: 62, r: 10, tint: "hair" }], front: [dome(14)] }),
  braided_bun: () => ({ back: [dot(60, 14, 10)], front: [dome(14)] }),
  head_wrap: () => ({ back: [], front: [dome(16, 31, "primary"), { kind: "rect", x: 38, y: 29, w: 44, h: 6, r: 3, tint: "accent" }, dot(60, 14, 8, "primary")] })
};

export const hairShapes = (style: string) => (HAIR_2D[style] ?? HAIR_2D["close_crop"]!)();

export function bodyShapes(preset: AvatarPreset): { before: Shape[]; after: Shape[]; head: Shape } {
  const sw = build(preset).shoulder * 100;
  const half = sw / 2;
  const before: Shape[] = [
    { kind: "rect", x: 43, y: 118, w: 15, h: 64, r: 7, tint: "primary" },
    { kind: "rect", x: 62, y: 118, w: 15, h: 64, r: 7, tint: "primary" },
    { kind: "rect", x: 41, y: 176, w: 19, h: 14, r: 6, tint: "hair" },
    { kind: "rect", x: 60, y: 176, w: 19, h: 14, r: 6, tint: "hair" },
    { kind: "rect", x: 60 - half - 12, y: 72, w: 13, h: 52, r: 6, tint: "primary" },
    { kind: "rect", x: 60 + half - 1, y: 72, w: 13, h: 52, r: 6, tint: "primary" },
    { kind: "ellipse", cx: 60 - half - 5.5, cy: 128, rx: 6.5, ry: 6.5, tint: "skin" },
    { kind: "ellipse", cx: 60 + half + 5.5, cy: 128, rx: 6.5, ry: 6.5, tint: "skin" },
    { kind: "rect", x: 60 - half, y: 68, w: sw, h: 58, r: 13, tint: "primary" },
    { kind: "rect", x: 56, y: 78, w: 8, h: 42, r: 2, tint: "secondary" },
    { kind: "rect", x: 60 - half, y: 118, w: sw, h: 6, r: 3, tint: "accent" },
    { kind: "ellipse", cx: 71, cy: 88, rx: 4, ry: 4, tint: "accent" },
    { kind: "rect", x: 54, y: 58, w: 12, h: 16, r: 4, tint: "skin" },
    { kind: "rect", x: 49, y: 66, w: 22, h: 9, r: 4, tint: "secondary" }
  ];
  const eyes: Shape[] = [dot(52, 44, 2), dot(68, 44, 2)];
  return { before, after: eyes, head: { kind: "ellipse", ...HEAD, tint: "skin" } };
}

export const tintColor = (preset: AvatarPreset, tint: Tint): string => {
  switch (tint) {
    case "hair": return safeColor(preset.hair_color);
    case "skin": return safeColor(preset.skin_color);
    case "primary": return safeColor(preset.uniform_primary);
    case "secondary": return safeColor(preset.uniform_secondary);
    case "accent": return safeColor(preset.uniform_accent);
  }
};
