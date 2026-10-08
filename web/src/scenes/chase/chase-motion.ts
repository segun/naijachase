// Pure animation maths for the 3D chase scene, kept free of Babylon.js so it can be unit-tested.
export const CYCLE_SECONDS = 0.72;

export type Pose = {
  bodyY: number; lean: number; headBob: number;
  thighL: number; thighR: number; shinL: number; shinR: number;
  armL: number; armR: number; elbowL: number; elbowR: number;
};

/** Blends between a brisk walk (amount 0) and a full sprint (amount 1). Angles are radians about the sideways axis; positive swings a limb forward (figures face +x). */
export function gaitPose(time: number, phase: number, cycle: number, amount: number): Pose {
  const a = (time / cycle) * Math.PI * 2 + phase;
  const k = Math.min(1, Math.max(0, amount));
  const mix = (walk: number, run: number) => walk + (run - walk) * k;
  const leg = (p: number) => mix(0.42, 0.85) * Math.sin(p);
  const knee = (p: number) => -mix(0.3, 0.5625) * (1 + Math.sin(p + 0.7));
  const arm = (p: number) => -mix(0.4, 0.75) * Math.sin(p);
  const elbow = (p: number) => mix(0.3, 1.15) + mix(0.06, 0.2) * Math.sin(p);
  return {
    bodyY: mix(0.02, 0.05) * Math.cos(2 * a),
    lean: mix(-0.04, -0.2) + mix(0.01, 0.03) * Math.sin(2 * a),
    headBob: mix(0.01, 0.03) * Math.sin(2 * a + 0.5),
    thighL: leg(a), thighR: leg(a + Math.PI),
    shinL: knee(a), shinR: knee(a + Math.PI),
    armL: arm(a), armR: arm(a + Math.PI),
    elbowL: elbow(a), elbowR: elbow(a + Math.PI)
  };
}

export const runPose = (time: number, phase = 0, cycle = CYCLE_SECONDS): Pose => gaitPose(time, phase, cycle, 1);
export const walkPose = (time: number, phase = 0, cycle = 1.1): Pose => gaitPose(time, phase, cycle, 0);

/** Standing still: a slow sway with relaxed arms, for vendors behind their stalls. */
export function idlePose(time: number, phase = 0): Pose {
  const a = time * 1.4 + phase;
  return {
    bodyY: 0.006 * Math.sin(a), lean: 0.01 * Math.sin(a * 0.7), headBob: 0.04 * Math.sin(a * 0.5),
    thighL: 0, thighR: 0, shinL: 0, shinR: 0,
    armL: 0.1 * Math.sin(a), armR: -0.1 * Math.sin(a), elbowL: 0.45 + 0.15 * Math.sin(a * 1.3), elbowR: 0.5
  };
}

/** Slow in-and-out drift (metres) so the officers close in and fall back. */
export function gapOffset(time: number, period: number, amplitude: number, phase = 0): number {
  return amplitude * Math.sin((time / period) * Math.PI * 2 + phase);
}

/** Position of a scenery item on a looping treadmill moving toward -x, wrapped to [-span / 2, span / 2). */
export function treadmillX(base: number, time: number, speed: number, span: number): number {
  const raw = base - time * speed;
  return ((((raw + span / 2) % span) + span) % span) - span / 2;
}

/** Alternating police-light flashes: red then blue, each on for a short burst per 1.2 s cycle. */
export function sirenLevels(time: number): { red: number; blue: number } {
  const t = ((time % 1.2) + 1.2) % 1.2;
  return { red: t < 0.4 ? 1 : 0, blue: t >= 0.6 && t < 1 ? 1 : 0 };
}
