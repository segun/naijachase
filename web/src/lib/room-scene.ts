// Pure logic for the opening room scene: the time-of-day greeting and lighting, the walk-in timeline and the camera
// zoom onto the monitor. No Babylon.js here, so it is unit-tested; lib/chase3d-room.ts turns these numbers into pixels.

export type DayPart = "morning" | "afternoon" | "evening";
export type Light = "morning" | "afternoon" | "dusk" | "night";

export const dayPart = (hour: number): DayPart => (hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 17 ? "afternoon" : "evening");
export const lightAt = (hour: number): Light => (hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 17 ? "afternoon" : hour >= 17 && hour < 20 ? "dusk" : "night");
export const greeting = (date: Date): string => `Good ${dayPart(date.getHours())}`;

export type Palette = { skyTop: string; skyBottom: string; sun: string; sunIntensity: number; ambient: string; ambientIntensity: number; lamp: number; stars: boolean; orb: "sun" | "moon"; orbColor: string };
export const PALETTES: Record<Light, Palette> = {
  morning: { skyTop: "#6ab7ff", skyBottom: "#ffe2b0", sun: "#ffe6bd", sunIntensity: 0.95, ambient: "#d8e8ff", ambientIntensity: 0.62, lamp: 0.1, stars: false, orb: "sun", orbColor: "#fff3c4" },
  afternoon: { skyTop: "#2f8ee8", skyBottom: "#bfe3ff", sun: "#fff6e0", sunIntensity: 1.05, ambient: "#e6f0ff", ambientIntensity: 0.7, lamp: 0, stars: false, orb: "sun", orbColor: "#fffbe0" },
  dusk: { skyTop: "#3b2f6b", skyBottom: "#ff9a52", sun: "#ffb07a", sunIntensity: 0.85, ambient: "#c7b4e6", ambientIntensity: 0.58, lamp: 0.75, stars: false, orb: "sun", orbColor: "#ffd08a" },
  night: { skyTop: "#050b1f", skyBottom: "#1d2f5c", sun: "#a9c0ff", sunIntensity: 0.6, ambient: "#8497d6", ambientIntensity: 0.5, lamp: 1, stars: true, orb: "moon", orbColor: "#eef2ff" }
};

// ---- Layout (metres). x is right, y is up and z is away from the camera. The back wall is at z = 4. ----

export const ROOM = { minX: -4.4, maxX: 4.4, minZ: -1.6, maxZ: 4 } as const;
export const DOOR = { x: -3, z: ROOM.maxZ } as const;
export const DESK = { x: 0.9, z: 3.4, top: 0.75 } as const;
/** The glass of the monitor, facing the camera. 4:3 like the terminal drawn over it. */
export const SCREEN = { x: DESK.x, y: 1.09, z: 3.238, w: 0.5, h: 0.375 } as const;
export const SEAT = { x: DESK.x, z: 2.35, hipY: 0.48 } as const;
/** How far the hips drop when sitting: the standing hip is 0.84 m high. */
export const SIT_DROP = 0.84 - SEAT.hipY;
export const FOV = 0.8;

const WALK_SPEED = 1.15;
const PATH: readonly (readonly [number, number])[] = [[DOOR.x, DOOR.z - 0.12], [DOOR.x, SEAT.z], [SEAT.x - 0.8, SEAT.z]];
const TURN = 0.3;
export const T_DOOR = 0.9;
const T_STEP = 0.6;
const T_SIT = 1.5;
const T_TYPE = 0.5;
export const T_ZOOM = 2.3;

const segments = PATH.slice(1).map((to, i) => {
  const from = PATH[i]!;
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return { from, to, length, duration: length / WALK_SPEED, heading: headingOf(to[0] - from[0], to[1] - from[1]) };
});
const WALK = segments.reduce((sum, s) => sum + s.duration, 0);
export const T_WALK_START = T_STEP;
export const T_SIT_START = T_WALK_START + WALK + 0.2;
export const T_ZOOM_START = T_SIT_START + T_SIT + T_TYPE;
export const T_END = T_ZOOM_START + T_ZOOM;

/** Babylon rotation.y for a figure whose face looks towards -z at 0. */
export function headingOf(dx: number, dz: number): number { return Math.atan2(-dx, -dz); }
export const wrap = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
export const turnTo = (from: number, to: number, k: number) => from + wrap(to - from) * k;
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smooth = (v: number) => { const k = clamp01(v); return k * k * (3 - 2 * k); };
export const mix = (a: number, b: number, k: number) => a + (b - a) * k;

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

/** The camera becomes the player's eyes, so the figure fades out as the zoom passes through them. */
export const avatarAlpha = (t: number) => Math.min(smooth((t - T_WALK_START) / 0.25), 1 - smooth((t - T_ZOOM_START - T_ZOOM * 0.1) / (T_ZOOM * 0.3)));

/** 0 closed, 1 fully open. */
export const doorAt = (t: number) => smooth(t / T_DOOR);

/** Chair slides in as the player sits: 0 pulled out, 1 under the desk. */
export const chairAt = (t: number) => smooth((t - T_SIT_START) / T_SIT);

export function poseAt(t: number): Pose {
  const start = PATH[0]!;
  const rest: Pose = { x: start[0], y: 0, z: start[1], heading: segments[0]!.heading, sit: 0, gait: 0, stride: 0, type: 0, visible: t >= T_WALK_START };
  if (t < T_WALK_START) return rest;

  const seatHeading = headingOf(0, 1);
  const last = segments[segments.length - 1]!;
  if (t >= T_SIT_START) {
    const k = smooth((t - T_SIT_START) / T_SIT);
    const typing = smooth((t - T_SIT_START - T_SIT * 0.6) / (T_SIT * 0.4 + T_TYPE));
    return {
      x: mix(last.to[0], SEAT.x, k), y: -SIT_DROP * k, z: mix(last.to[1], SEAT.z, k),
      heading: turnTo(last.heading, seatHeading, k), sit: k, gait: 0, stride: 0, type: typing,
      visible: true
    };
  }

  let walked = t - T_WALK_START;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]!;
    if (walked <= s.duration || i === segments.length - 1) {
      const k = clamp01(walked / s.duration);
      const prev = segments[i - 1];
      const heading = prev && walked < TURN ? turnTo(prev.heading, s.heading, smooth(walked / TURN)) : s.heading;
      const stride = smooth((t - T_WALK_START) / 0.25) * (1 - smooth((t - (T_SIT_START - 0.3)) / 0.3));
      return { ...rest, x: mix(s.from[0], s.to[0], k), z: mix(s.from[1], s.to[1], k), heading, gait: (t - T_WALK_START) * WALK_SPEED * 2.2, stride };
    }
    walked -= s.duration;
  }
  return rest;
}

// ---- Camera ----

export type Vec = readonly [number, number, number];
export type CameraShot = { position: Vec; target: Vec };

/** The wide establishing shot, drifting slowly and following the walker a little. */
export function wideShot(t: number, pose: Pose): CameraShot {
  const drift = clamp01(t / T_ZOOM_START);
  return {
    position: [mix(-2.6, -1.3, drift), mix(2.55, 2.2, drift), mix(-4.9, -4.2, drift)],
    target: [mix(0.1, 0.6, drift) + (pose.x - 0.2) * 0.12, 1.25, 2.3]
  };
}

export const isPortrait = (vw: number, vh: number) => vw <= vh || vw < 640;
/** The width the terminal glass has on screen. Mirrors the `.glass` rule in styles/terminal.css. */
export const glassWidth = (vw: number, vh: number) => (isPortrait(vw, vh) ? vw : Math.min(vw * 0.88, vh * 0.88 * (4 / 3)));

/** Camera distance from the screen plane at which the 3D glass fills exactly the width the terminal glass will have. */
export function zoomDistance(vw: number, vh: number, fov = FOV, width: number = SCREEN.w): number {
  const focal = vh / 2 / Math.tan(fov / 2);
  return (width * focal) / glassWidth(vw, vh);
}

export function finalShot(vw: number, vh: number): CameraShot {
  return { position: [SCREEN.x, SCREEN.y, SCREEN.z - zoomDistance(vw, vh)], target: [SCREEN.x, SCREEN.y, SCREEN.z] };
}

export const lerp3 = (a: Vec, b: Vec, k: number): Vec => [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];

const zoomPhase = (t: number) => smooth((t - T_ZOOM_START) / T_ZOOM);

/** The camera between the wide shot (phase 0) and the monitor filling the glass (phase 1). */
function zoomShot(wide: CameraShot, phase: number, vw: number, vh: number): CameraShot {
  const end = finalShot(vw, vh);
  // The distance to the screen shrinks exponentially, so the monitor grows at a steady rate rather than lunging at the end.
  const from = Math.hypot(wide.position[0] - SCREEN.x, wide.position[1] - SCREEN.y, wide.position[2] - SCREEN.z);
  const to = zoomDistance(vw, vh);
  const u = (from - from * Math.pow(to / from, phase)) / (from - to);
  return { position: lerp3(wide.position, end.position, u), target: lerp3(wide.target, end.target, u) };
}

export function shotAt(t: number, vw: number, vh: number): CameraShot {
  const wide = wideShot(Math.min(t, T_ZOOM_START), poseAt(Math.min(t, T_ZOOM_START)));
  return t < T_ZOOM_START ? wide : zoomShot(wide, zoomPhase(t), vw, vh);
}

/** How opaque the terminal glass should be: it fades in over the last stretch of the zoom. */
export const glassAt = (t: number) => smooth((zoomPhase(t) - 0.86) / 0.14);

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

// ---- Outro: once a lead is chosen the camera pulls back from the monitor, the player stands up and walks out of the door ----

const OUT_STAND_AT = 0.45;
const OUT_STAND = 0.5;
export const T_OUT_ZOOM = 1.0;
export const T_OUT_WALK_START = 0.95;
const OUT_SPEED = 2.6;
const OUT_PATH: readonly (readonly [number, number])[] = [[SEAT.x, SEAT.z], [DOOR.x, SEAT.z], [DOOR.x, DOOR.z - 0.12]];
const outSegments = OUT_PATH.slice(1).map((to, i) => {
  const from = OUT_PATH[i]!;
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return { from, to, duration: length / OUT_SPEED, heading: headingOf(to[0] - from[0], to[1] - from[1]) };
});
const OUT_WALK = outSegments.reduce((sum, s) => sum + s.duration, 0);
export const T_OUT_END = T_OUT_WALK_START + OUT_WALK + 0.1;

/** The player rising from the chair, then walking to the door. */
export function outroPoseAt(t: number): Pose {
  const stand = smooth((t - OUT_STAND_AT) / OUT_STAND);
  const first = outSegments[0]!;
  const seated = headingOf(0, 1);
  const base: Pose = { x: SEAT.x, y: -SIT_DROP * (1 - stand), z: SEAT.z, heading: seated, sit: 1 - stand, gait: 0, stride: 0, type: 1 - smooth((t - 0.3) / 0.3), visible: true };
  if (t < T_OUT_WALK_START) return { ...base, heading: turnTo(seated, first.heading, smooth((t - OUT_STAND_AT - 0.1) / 0.4)) };
  let walked = t - T_OUT_WALK_START;
  for (let i = 0; i < outSegments.length; i++) {
    const s = outSegments[i]!;
    if (walked <= s.duration || i === outSegments.length - 1) {
      const k = clamp01(walked / s.duration);
      const prev = outSegments[i - 1];
      const heading = prev && walked < TURN ? turnTo(prev.heading, s.heading, smooth(walked / TURN)) : s.heading;
      return { ...base, y: 0, sit: 0, type: 0, x: mix(s.from[0], s.to[0], k), z: mix(s.from[1], s.to[1], k), heading, gait: (t - T_OUT_WALK_START) * WALK_SPEED * 2.2, stride: smooth((t - T_OUT_WALK_START) / 0.25) * (1 - smooth((t - (T_OUT_END - 0.3)) / 0.2)) };
    }
    walked -= s.duration;
  }
  return base;
}

/** The chair is pushed back as the player stands. */
export const outroChairAt = (t: number) => 1 - smooth((t - OUT_STAND_AT) / OUT_STAND);
/** The figure appears as the camera leaves the player's eyes and disappears through the doorway. */
export const outroAlphaAt = (t: number) => Math.min(smooth(t / 0.5), 1 - smooth((t - (T_OUT_END - 0.45)) / 0.3));
/** The terminal glass fades out as the camera pulls back. */
export const outroGlassAt = (t: number) => 1 - smooth(t / 0.35);

export function outroShotAt(t: number, pose: Pose, vw: number, vh: number): CameraShot {
  const wide = wideShot(T_ZOOM_START, poseAt(T_ZOOM_START));
  const shot = zoomShot(wide, 1 - smooth(t / T_OUT_ZOOM), vw, vh);
  const follow = smooth((t - T_OUT_ZOOM) / 1.2);
  return { position: shot.position, target: [shot.target[0] + (pose.x - SEAT.x) * 0.15 * follow, shot.target[1], shot.target[2]] };
}
