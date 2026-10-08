// Pure logic for the archive scene: the player walks into a records room, picks a case file off a shelf, turns round holding
// it and the camera zooms onto the file, where the DOM sheet (the archive list) takes over. No Babylon.js here, so it is
// unit-tested; chase3d-archive.ts turns these numbers into pixels. Room footprint, easing and framing come from ../shared/scene-core.ts.
import { type CameraShot, type Pose, ROOM, type Vec, clamp01, distanceToFill, headingOf, lerp3, mix, smooth, turnTo } from "../shared/scene-core.ts";

/** Total length of the intro, seconds. Animations stay at five seconds or less. */
export const MAX_SECONDS = 5;

export const DOOR = { x: -1.9, z: ROOM.maxZ } as const;
/** Where the player stands to reach the shelf, facing the back wall. */
export const STAND = { x: 0.9, z: 3.0 } as const;
/** The shelf slot the file is pulled from: the player's right hand is 0.35 m to the +x side of the body, which is -x in the world while facing +z. */
export const SLOT = { x: STAND.x - 0.35, y: 1.55, z: 3.62 } as const;
/** The file's front cover, 4:3 like the sheet drawn over it. */
export const FILE = { w: 0.36, h: 0.27, d: 0.025 } as const;
/** Where the file is carried, in the player's own frame (the front is -z). */
export const CARRY = { x: 0, y: 1.25, z: -0.62 } as const;

const WALK_SPEED = 2.1;
const PATH: readonly (readonly [number, number])[] = [[DOOR.x, DOOR.z - 0.12], [DOOR.x, STAND.z], [STAND.x, STAND.z]];
const TURN = 0.2;
const FACE_SHELF = 0.3;
const REACH = 0.35;
const GRAB = 0.35;
const TURN_BACK = 0.5;
export const T_DOOR = 0.5;
export const T_WALK_START = 0.2;

const segments = PATH.slice(1).map((to, i) => {
  const from = PATH[i]!;
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return { from, to, duration: length / WALK_SPEED, heading: headingOf(to[0] - from[0], to[1] - from[1]) };
});
const WALK = segments.reduce((sum, s) => sum + s.duration, 0);
export const T_WALK_END = T_WALK_START + WALK;
export const T_REACH = T_WALK_END + 0.1;
export const T_GRAB = T_REACH + REACH;
export const T_TURN_BACK = T_GRAB + GRAB;
export const T_ZOOM_START = T_TURN_BACK + TURN_BACK;
export const T_ZOOM = 1.2;
export const T_END = T_ZOOM_START + T_ZOOM;

export type ArchivePose = Pose & {
  /** 0 arm by the side, 1 right arm up at the shelf. */
  reach: number;
  /** 0 empty-handed, 1 holding the file at chest height. */
  carry: number;
};

export const doorAt = (t: number) => smooth(t / T_DOOR);
export const avatarAlpha = (t: number) => smooth((t - T_WALK_START) / 0.2);

const grabAt = (t: number) => smooth((t - T_GRAB) / GRAB);

export function poseAt(t: number): ArchivePose {
  const start = PATH[0]!;
  const last = segments[segments.length - 1]!;
  const base = { x: start[0], y: 0, z: start[1], heading: segments[0]!.heading, sit: 0, gait: 0, stride: 0, type: 0, visible: t >= T_WALK_START, reach: 0, carry: 0 };
  if (t < T_WALK_START) return base;

  if (t >= T_WALK_END) {
    const toShelf = turnTo(last.heading, headingOf(0, 1), smooth((t - T_WALK_END) / FACE_SHELF));
    const heading = t < T_TURN_BACK ? toShelf : turnTo(headingOf(0, 1), headingOf(0, -1), smooth((t - T_TURN_BACK) / TURN_BACK));
    const grab = grabAt(t);
    return {
      ...base, x: STAND.x, z: STAND.z, heading, visible: true,
      reach: smooth((t - T_REACH) / REACH) * (1 - grab), carry: grab
    };
  }

  let walked = t - T_WALK_START;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]!;
    if (walked <= s.duration || i === segments.length - 1) {
      const k = clamp01(walked / s.duration);
      const prev = segments[i - 1];
      const heading = prev && walked < TURN ? turnTo(prev.heading, s.heading, smooth(walked / TURN)) : s.heading;
      const stride = smooth((t - T_WALK_START) / 0.2) * (1 - smooth((t - (T_WALK_END - 0.25)) / 0.25));
      return { ...base, x: mix(s.from[0], s.to[0], k), z: mix(s.from[1], s.to[1], k), heading, gait: (t - T_WALK_START) * WALK_SPEED * 2.4, stride };
    }
    walked -= s.duration;
  }
  return base;
}

/** The file's position and heading: on the shelf, then into the player's hands, then carried round to face the camera. */
export function fileAt(t: number) {
  const pose = poseAt(t);
  const grab = grabAt(t);
  // Held in front of the player; the cover faces the way the player faces. On the shelf its back is to the room.
  const forward = { x: -Math.sin(pose.heading), z: -Math.cos(pose.heading) };
  const hold = { x: pose.x + forward.x * -CARRY.z, y: CARRY.y, z: pose.z + forward.z * -CARRY.z };
  return {
    x: mix(SLOT.x, hold.x, grab), y: mix(SLOT.y, hold.y, grab), z: mix(SLOT.z, hold.z, grab),
    heading: turnTo(headingOf(0, 1), pose.heading, grab),
    held: grab >= 1
  };
}

/** Where the file ends up: held in front of the player, who faces the camera. */
export const FILE_FINAL = { x: STAND.x, y: CARRY.y, z: STAND.z + CARRY.z } as const;

export function armAngles(pose: ArchivePose, t: number) {
  const swing = Math.sin(pose.gait) * 0.5 * pose.stride;
  const w = 1 - Math.max(pose.reach, pose.carry);
  const flutter = Math.sin(t * 9) * 0.02 * pose.reach;
  return [-swing * w + pose.carry * 1.15, swing * w + pose.reach * 1.68 + pose.carry * 1.15 + flutter] as const;
}

export function wideShot(t: number, pose: Pose): CameraShot {
  const drift = clamp01(t / T_ZOOM_START);
  return {
    position: [mix(-2.4, -1.0, drift), mix(2.5, 2.15, drift), mix(-4.7, -4.1, drift)],
    target: [mix(0.0, 0.7, drift) + (pose.x - 0.5) * 0.1, 1.3, 3.0]
  };
}

export function finalShot(vw: number, vh: number): CameraShot {
  const target: Vec = [FILE_FINAL.x, FILE_FINAL.y, FILE_FINAL.z];
  return { position: [target[0], target[1], target[2] - distanceToFill(FILE.w, vw, vh)], target };
}

const zoomPhase = (t: number) => smooth((t - T_ZOOM_START) / T_ZOOM);

export function shotAt(t: number, vw: number, vh: number): CameraShot {
  const wide = wideShot(Math.min(t, T_ZOOM_START), poseAt(Math.min(t, T_ZOOM_START)));
  if (t < T_ZOOM_START) return wide;
  const end = finalShot(vw, vh);
  // Steady growth in apparent size: the distance to the file shrinks exponentially.
  const from = Math.hypot(wide.position[0] - FILE_FINAL.x, wide.position[1] - FILE_FINAL.y, wide.position[2] - FILE_FINAL.z);
  const to = distanceToFill(FILE.w, vw, vh);
  const u = (from - from * Math.pow(to / from, zoomPhase(t))) / (from - to);
  return { position: lerp3(wide.position, end.position, u), target: lerp3(wide.target, end.target, u) };
}

/** How opaque the sheet should be: it fades in over the last stretch of the zoom. */
export const glassAt = (t: number) => smooth((zoomPhase(t) - 0.8) / 0.2);
