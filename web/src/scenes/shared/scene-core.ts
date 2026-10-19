// What every room scene shares and that needs no Babylon.js, so it is unit-tested: the time-of-day lighting palettes, the room
// footprint and camera field of view, the easing and angle helpers, the walking figure's pose types and limb angles, and how far
// the camera must stand from a surface for it to fill exactly the glass the DOM overlay will have.

// ---- Time-of-day lighting ----

export type Light = "morning" | "afternoon" | "dusk" | "night";
export const lightAt = (hour: number): Light => (hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 17 ? "afternoon" : hour >= 17 && hour < 20 ? "dusk" : "night");
export type Palette = { skyTop: string; skyBottom: string; sun: string; sunIntensity: number; ambient: string; ambientIntensity: number; lamp: number; stars: boolean; orb: "sun" | "moon"; orbColor: string };
export const PALETTES: Record<Light, Palette> = {
  morning: { skyTop: "#6ab7ff", skyBottom: "#ffe2b0", sun: "#ffe6bd", sunIntensity: 0.95, ambient: "#d8e8ff", ambientIntensity: 0.62, lamp: 0.1, stars: false, orb: "sun", orbColor: "#fff3c4" },
  afternoon: { skyTop: "#2f8ee8", skyBottom: "#bfe3ff", sun: "#fff6e0", sunIntensity: 1.05, ambient: "#e6f0ff", ambientIntensity: 0.7, lamp: 0, stars: false, orb: "sun", orbColor: "#fffbe0" },
  dusk: { skyTop: "#3b2f6b", skyBottom: "#ff9a52", sun: "#ffb07a", sunIntensity: 0.85, ambient: "#c7b4e6", ambientIntensity: 0.58, lamp: 0.75, stars: false, orb: "sun", orbColor: "#ffd08a" },
  night: { skyTop: "#050b1f", skyBottom: "#1d2f5c", sun: "#a9c0ff", sunIntensity: 0.6, ambient: "#8497d6", ambientIntensity: 0.5, lamp: 1, stars: true, orb: "moon", orbColor: "#eef2ff" }
};
// ---- Room footprint (metres: x right, y up, z away from the camera) and the camera ----

export const ROOM = { minX: -4.4, maxX: 4.4, minZ: -1.6, maxZ: 4 } as const;
export const FOV = 0.8;
// ---- Easing and angles ----

export function headingOf(dx: number, dz: number): number { return Math.atan2(-dx, -dz); }
export const wrap = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
export const turnTo = (from: number, to: number, k: number) => from + wrap(to - from) * k;
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smooth = (v: number) => { const k = clamp01(v); return k * k * (3 - 2 * k); };
export const mix = (a: number, b: number, k: number) => a + (b - a) * k;
// ---- The walking figure ----

export type Pose = {
  x: number; y: number; z: number; heading: number;
  /** 0 standing, 1 seated. */
  sit: number;
  /** Radians of the walking cycle, advancing only while moving. */
  gait: number;
  /** 0 still, 1 striding. */
  stride: number;
  /** 0 arms down, 1 hands on the keyboard. */
  type: number;
  visible: boolean;
};
export type Vec = readonly [number, number, number];
export type CameraShot = { position: Vec; target: Vec };
export const isPortrait = (vw: number, vh: number) => vw <= vh || vw < 640;
export const lerp3 = (a: Vec, b: Vec, k: number): Vec => [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];
/** How much farther a wide cinematic camera must stand in a narrow viewport. */
export function portraitCameraScale(aspect: number, reference = 1.3, maximum = 3): number {
  if (!Number.isFinite(aspect) || aspect <= 0 || aspect >= reference) return 1;
  return Math.min(maximum, reference / Math.max(0.4, aspect));
}
/** Preserve a shot's aim while backing it away enough to retain its horizontal cast and scenery. */
export function fitShotToAspect(shot: CameraShot, aspect: number, maximum = 3): CameraShot {
  const scale = portraitCameraScale(aspect, 1.3, maximum);
  if (scale === 1) return shot;
  const [tx, ty, tz] = shot.target;
  return {
    position: [tx + (shot.position[0] - tx) * scale, ty + (shot.position[1] - ty) * scale, tz + (shot.position[2] - tz) * scale],
    target: shot.target
  };
}
export function legAngles(pose: Pose) {
  const swing = Math.sin(pose.gait) * 0.62 * pose.stride;
  const bend = (phase: number) => Math.max(0, Math.sin(pose.gait + phase)) * 0.7 * pose.stride;
  const seated = pose.sit * (Math.PI / 2 - 0.04);
  return {
    hips: [swing * (1 - pose.sit) + seated, -swing * (1 - pose.sit) + seated] as const,
    knees: [-bend(0.6) * (1 - pose.sit) - seated, -bend(0.6 + Math.PI) * (1 - pose.sit) - seated] as const
  };
}
export function armAngles(pose: Pose, t: number) {
  const swing = Math.sin(pose.gait) * 0.5 * pose.stride;
  const flutter = Math.sin(t * 17) * 0.025 * pose.type;
  const reach = pose.type * 1.08;
  return [-swing * (1 - pose.type) + reach + flutter, swing * (1 - pose.type) + reach - flutter] as const;
}
/** The width the terminal glass has on screen. Mirrors the `.glass` rule in styles/terminal.css. */
export const glassWidth = (vw: number, vh: number) => (isPortrait(vw, vh) ? vw : Math.min(vw * 0.88, vh * 0.88 * (4 / 3)));

/** Camera distance at which a surface `width` metres wide, facing the camera, fills exactly the width the overlay glass will have. */
export function distanceToFill(width: number, vw: number, vh: number, fov = FOV): number {
  const focal = vh / 2 / Math.tan(fov / 2);
  return (width * focal) / glassWidth(vw, vh);
}
