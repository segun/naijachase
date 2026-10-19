import { biomeWeights, blendPalette, distanceAt, progressAt, SPEED, type Palette } from "./chase-biomes.ts";
import { cycleAt, gapOffset, runPose, type Pose } from "./chase-motion.ts";
import { fitShotToAspect } from "../shared/scene-core.ts";

export const OFFICERS = [
  { name: "cop-a", x: -0.2, z: -0.9, phase: 0.4, period: 4.2, drift: 0.9, baton: true },
  { name: "cop-b", x: -1.9, z: 0.8, phase: 2.2, period: 4.8, drift: 0.7, baton: true },
  { name: "cop-c", x: -3.4, z: -0.4, phase: 4.0, period: 6.0, drift: 1.0, baton: false }
] as const;

export type ChaseRunner = {
  name: string; x: number; z: number; baton: boolean; pose: Pose; cycle: number;
  /** Turn about the vertical axis in radians; 0 faces the way the chase runs (+x), π faces back. */
  heading?: number;
  /** 0 running to 1 standing: model figures straighten their legs. */
  stand?: number;
  /** Hands up (thief giving up) and arms out to take hold (officer), 0 to 1. */
  raise?: number; reach?: number;
};
export type ChaseFrame = {
  seconds: number; gait: number; worldTime: number; weights: number[]; palette: Palette;
  camera: readonly [number, number, number]; target: readonly [number, number, number]; runners: ChaseRunner[];
};

/** Shared camera, running cadence and city progression for both chase renderers. */
export function chaseFrame(seconds: number): ChaseFrame {
  const distance = distanceAt(seconds);
  const gait = 0.5 * seconds + 0.5 * distance / SPEED;
  const weights = biomeWeights(progressAt(seconds));
  return {
    seconds, gait, worldTime: distance / SPEED, weights, palette: blendPalette(weights),
    camera: [2.2 + Math.sin(seconds * 0.28) * 1.6, 2.5 + Math.sin(seconds * 0.5) * 0.12, -8.2 + Math.cos(seconds * 0.2) * 0.6] as const,
    target: [0.2, 1.05, 0] as const,
    runners: [
      { name: "thief", x: 3.2, z: 0.1, baton: false, pose: runPose(gait, 0.3, 0.64), cycle: cycleAt(gait, 0.3, 0.64) },
      ...OFFICERS.map(o => ({ name: o.name, x: o.x + gapOffset(seconds, o.period, o.drift, o.phase), z: o.z,
        baton: o.baton, pose: runPose(gait, o.phase, 0.72), cycle: cycleAt(gait, o.phase, 0.72) }))
    ]
  };
}

/** Keep the thief and all three officers inside narrow raid and opening-chase frames. */
export function fitChaseFrame(frame: ChaseFrame, aspect: number): ChaseFrame {
  const shot = fitShotToAspect({ position: frame.camera, target: frame.target }, aspect);
  return { ...frame, camera: shot.position, target: shot.target };
}
