// Pure logic for the garage scene that follows the briefing: the player comes through the office door into a garage, waits among
// the parked cars while the transport options are shown, then either climbs into the open-top car and drives off or sets off on foot
// to the roadside with a thumb out to hitch a ride. No Babylon.js here, so it is unit-tested; lib/chase3d-garage.ts turns these numbers into pixels. Every animation is five
// seconds or less.
import { ROOM, headingOf, clamp01, lerp3, mix, smooth, turnTo, type CameraShot, type Pose } from "./room-scene.ts";

/** Longest any single animation may run, seconds. */
export const MAX_SECONDS = 5;

export const DOOR = { x: -3.85, z: ROOM.maxZ } as const;
/** Where the player waits while choosing, facing the camera. */
export const STAND = { x: -3.5, z: 0.8 } as const;
/** The player's car: open-topped, nose to the camera, parked next to the strip the player walks down. */
export const CAR = { x: -1.95, z: 2.1, length: 3.6, width: 1.6 } as const;
/** The driver's seat in the car's own frame (the front is -z). */
export const SEAT = { x: -0.38, z: 0.25 } as const;
/** Hips are this much lower seated in the car than standing (a standing hip is 0.84 m up). */
export const CAR_SIT_DROP = 0.09;
/** Where the car is when it leaves the picture, well past the camera. */
export const CAR_GONE_Z = -9.5;
export const WHEEL_RADIUS = 0.31;

const WALK_SPEED = 2.3;
export const T_DOOR = 0.5;
export const T_WALK_START = 0.45;
const START: readonly [number, number] = [DOOR.x, DOOR.z - 0.12];
const INTRO_WALK = Math.hypot(STAND.x - START[0], STAND.z - START[1]) / WALK_SPEED;
export const T_ARRIVE = T_WALK_START + INTRO_WALK;
export const T_PAN = 2.4;
export const T_END = 3.0;

export const doorAt = (t: number) => smooth(t / T_DOOR);
export const introAlphaAt = (t: number) => smooth((t - T_WALK_START) / 0.2);
/** The transport options fade in over the last stretch of the intro. */
export const glassAt = (t: number) => smooth((t - (T_END - 0.55)) / 0.5);

// Aimed a little low so the cars and the player sit in the upper part of the picture, clear of the options docked along the bottom.
const wide: CameraShot = { position: [0.3, 2.7, -5.4], target: [-0.1, 0.45, 2.2] };
const pan: CameraShot = { position: [-3.4, 2.0, -3.4], target: [-3.9, 1.4, 3.9] };

/** The opening shot looks at the door the player is about to come through, then pans across the garage to the wide view. */
export function introShotAt(t: number): CameraShot {
  const k = smooth(t / T_PAN);
  return { position: lerp3(pan.position, wide.position, k), target: lerp3(pan.target, wide.target, k) };
}
export const wideShot = (): CameraShot => wide;

export type GaragePose = Pose & { alpha: number; /** 0 arm down, 1 right arm up with a thumb out. */ thumb: number };
const base = (over: Partial<GaragePose>): GaragePose => ({ x: STAND.x, y: 0, z: STAND.z, heading: 0, sit: 0, gait: 0, stride: 0, type: 0, visible: true, alpha: 1, thumb: 0, ...over });

export function introPoseAt(t: number): GaragePose {
  if (t < T_WALK_START) return base({ x: START[0], z: START[1], visible: false, alpha: 0 });
  const k = clamp01((t - T_WALK_START) / INTRO_WALK);
  const heading = headingOf(STAND.x - START[0], STAND.z - START[1]);
  const settle = smooth((t - T_ARRIVE) / 0.35);
  return base({
    x: mix(START[0], STAND.x, k), z: mix(START[1], STAND.z, k),
    heading: turnTo(heading, 0, settle),
    gait: (t - T_WALK_START) * WALK_SPEED * 2.4,
    stride: smooth((t - T_WALK_START) / 0.2) * (1 - smooth((t - (T_ARRIVE - 0.2)) / 0.25)),
    alpha: introAlphaAt(t)
  });
}

// ---- Drive: walk to the car, climb in, start up and leave ----

const BESIDE: readonly [number, number] = [-3.3, 1.95];
const T_BESIDE = Math.hypot(BESIDE[0] - STAND.x, BESIDE[1] - STAND.z) / WALK_SPEED;
const T_CLIMB_START = T_BESIDE + 0.1;
const T_CLIMB = 0.8;
const T_HANDS = 0.3;
export const T_DRIVE_START = T_CLIMB_START + T_CLIMB + T_HANDS;
const T_DRIVE = 2.1;
export const T_DRIVE_END = T_DRIVE_START + T_DRIVE;
const SEAT_WORLD = { x: CAR.x + SEAT.x, z: CAR.z + SEAT.z } as const;
const FACE_CAR = headingOf(1, 0);

/** The car's distance driven: it accelerates from rest and is gone by the end. */
export function carZAt(t: number) {
  const u = clamp01((t - T_DRIVE_START) / T_DRIVE);
  return CAR.z - (CAR.z - CAR_GONE_Z) * u * u;
}
export const carStartedAt = (t: number) => t >= T_DRIVE_START;
/** Wheel spin follows the distance driven. */
export const wheelAngleAt = (t: number) => (CAR.z - carZAt(t)) / WHEEL_RADIUS;
/** Slight body rock as the car pulls away. */
export const carPitchAt = (t: number) => {
  const u = clamp01((t - T_DRIVE_START) / T_DRIVE);
  return Math.sin(Math.min(1, u * 3) * Math.PI) * 0.025;
};

export function drivePoseAt(t: number): GaragePose {
  if (t < T_BESIDE) {
    const k = clamp01(t / T_BESIDE);
    return base({
      x: mix(STAND.x, BESIDE[0], k), z: mix(STAND.z, BESIDE[1], k),
      heading: turnTo(0, headingOf(BESIDE[0] - STAND.x, BESIDE[1] - STAND.z), smooth(t / 0.15)),
      gait: t * WALK_SPEED * 2.4, stride: smooth(t / 0.15) * (1 - smooth((t - (T_BESIDE - 0.2)) / 0.2))
    });
  }
  const climb = smooth((t - T_CLIMB_START) / T_CLIMB);
  const hop = Math.sin(clamp01((t - T_CLIMB_START) / T_CLIMB) * Math.PI) * 0.22;
  const seated = climb;
  const carDz = CAR.z - carZAt(t);
  // Once in, the player rides with the car.
  const x = mix(BESIDE[0], SEAT_WORLD.x, climb);
  const z = mix(BESIDE[1], SEAT_WORLD.z, climb) - carDz;
  return base({
    x, z, y: -CAR_SIT_DROP * climb + hop,
    heading: turnTo(turnTo(0, headingOf(BESIDE[0] - STAND.x, BESIDE[1] - STAND.z), 1), 0, smooth((t - T_CLIMB_START) / T_CLIMB)),
    sit: seated, type: smooth((t - (T_CLIMB_START + T_CLIMB * 0.7)) / (T_CLIMB * 0.3 + T_HANDS)),
    alpha: 1
  });
}

// ---- Hitch a ride: turn, head out to the roadside with a thumb out, and keep going ----

const WALK_PATH: readonly (readonly [number, number])[] = [[STAND.x, STAND.z], [-3.9, -1.0], [-5.6, -3.4]];
const walkSegments = WALK_PATH.slice(1).map((to, i) => {
  const from = WALK_PATH[i]!;
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return { from, to, duration: length / WALK_SPEED, heading: headingOf(to[0] - from[0], to[1] - from[1]) };
});
export const T_HITCH_AWAY = walkSegments.reduce((sum, s) => sum + s.duration, 0) + 0.2;
export const T_HITCH_END = T_HITCH_AWAY + 0.2;

export function hitchPoseAt(t: number): GaragePose {
  const t0 = 0.2;
  const tt = Math.max(0, t - t0);
  let walked = tt;
  for (let i = 0; i < walkSegments.length; i++) {
    const s = walkSegments[i]!;
    if (walked <= s.duration || i === walkSegments.length - 1) {
      const k = clamp01(walked / s.duration);
      const prev = walkSegments[i - 1];
      const heading = prev && walked < 0.25 ? turnTo(prev.heading, s.heading, smooth(walked / 0.25)) : i === 0 ? turnTo(0, s.heading, smooth(tt / 0.2)) : s.heading;
      return base({
        x: mix(s.from[0], s.to[0], k), z: mix(s.from[1], s.to[1], k), heading,
        gait: tt * WALK_SPEED * 2.4, stride: smooth(tt / 0.2),
        alpha: 1 - smooth((t - (T_HITCH_END - 0.45)) / 0.35),
        thumb: smooth((t - 0.7) / 0.3)
      });
    }
    walked -= s.duration;
  }
  return base({});
}

/** The transport panel fades quickly once a choice is made. */
export const outroGlassAt = (t: number) => 1 - smooth(t / 0.25);

/** How the player leaves: the server's two local modes. */
export type Exit = "drive" | "hitch";

/** Camera while leaving: steady for the drive; when hitching it swings left a little to follow the player out. */
export function outroShotAt(how: Exit, t: number): CameraShot {
  if (how === "drive") return wide;
  const k = smooth((t - 0.5) / 2);
  return { position: lerp3(wide.position, [-0.6, 2.2, -4.7], k), target: lerp3(wide.target, [-2.2, 1.0, 1.4], k) };
}

export const outroEnd = (how: Exit) => (how === "drive" ? T_DRIVE_END : T_HITCH_END);
/** The server's local transport mode for each exit. */
export const MODE_FOR: Record<Exit, "drive" | "hitch_ride"> = { drive: "drive", hitch: "hitch_ride" };
