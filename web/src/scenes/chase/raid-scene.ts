// The hideout raid: a short cut of the login chase that ends one of two ways. If the suspect is not at the hideout the thief
// outruns the officers; if the suspect is there the officers close in and the thief gives up. Pure, so it is unit-tested and
// both chase renderers draw exactly the same frame.
import { BIOMES, SEGMENT, SPEED, smoothstep } from "./chase-biomes.ts";
import { chaseFrame, OFFICERS, type ChaseFrame, type ChaseRunner } from "./chase-frame.ts";
import { cycleAt, gaitPose, type Pose } from "./chase-motion.ts";

export type RaidEnding = "escape" | "catch";

/** Seconds each ending lasts. Both stay within the five to ten seconds a raid should take. */
export const RAID_SECONDS: Record<RaidEnding, number> = { escape: 7.5, catch: 8.5 };

/** When the chase starts to slow (s), how long the slowdown takes (s) and how much of the pace is lost. */
const SLOW: Record<RaidEnding, { from: number; length: number; loss: number }> = {
  escape: { from: 3.2, length: 2.6, loss: 0.8 },
  catch: { from: 3.4, length: 3, loss: 1 }
};

/** Standing still, arms relaxed. */
const STAND: Pose = { bodyY: 0, lean: 0, headBob: 0, thighL: 0, thighR: 0, shinL: 0, shinR: 0, armL: 0.08, armR: -0.08, elbowL: 0.2, elbowR: 0.2 };

/** Arm angles for hands up (thief) and for reaching to hold someone (officer); figures face +x, π is straight up. */
const HANDS_UP = { armL: Math.PI * 0.95, armR: Math.PI * 0.95, elbowL: 0.25, elbowR: 0.25 };
const REACH = { armL: 1.35, armR: 1.2, elbowL: 0.3, elbowR: 0.4 };
const withArms = (pose: Pose, arms: typeof HANDS_UP, k: number): Pose => blendPose(pose, { ...pose, ...arms }, k);

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export function blendPose(a: Pose, b: Pose, k: number): Pose {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const out = { ...a };
  for (const key of Object.keys(a) as (keyof Pose)[]) out[key] = lerp(a[key], b[key], k);
  return out;
}

/** Street seconds at real second `s`: the pace eases down by `loss` from `from` over `length` (the integral of 1 - loss·smoothstep). */
export function streetSeconds(s: number, ending: RaidEnding): number {
  const { from, length, loss } = SLOW[ending];
  if (s <= from) return s;
  const u = Math.min(1, (s - from) / length);
  const eased = length * (u ** 3 - u ** 4 / 2) + Math.max(0, s - from - length);
  return s - loss * eased;
}

/** Where the raid starts on the chase's looping street: just before the sign of the state the hideout is in (Lagos otherwise). */
export function raidStart(state: string): number {
  const index = Math.max(0, BIOMES.findIndex(b => b.name.toLowerCase() === state.toLowerCase()));
  return (index * SEGMENT) / SPEED - 3;
}

/** The frame of the raid at real second `s`, in the same shape as the login chase's frame. */
export function raidFrame(s: number, ending: RaidEnding, start = 0): ChaseFrame {
  const t = Math.max(0, s);
  const { from, length, loss } = SLOW[ending];
  const slowing = smoothstep(from, from + length, t);
  const street = chaseFrame(start + streetSeconds(t, ending));
  const camera = chaseFrame(start + t).camera;
  const thief = street.runners[0]!;
  const runners: ChaseRunner[] = [];

  if (ending === "escape") {
    // The thief keeps his full pace and pulls clear while the officers slow to a walk and drop back.
    const fullGait = chaseFrame(start + t).gait;
    const away = 17 * smoothstep(from - 0.4, RAID_SECONDS.escape - 0.3, t) ** 1.6;
    runners.push({ ...thief, x: thief.x + away, pose: gaitPose(fullGait, 0.3, 0.64, 1), cycle: cycleAt(fullGait, 0.3, 0.64) });
    for (const [i, o] of OFFICERS.entries()) {
      const base = street.runners[i + 1]!;
      runners.push({ ...base, x: base.x - 1.2 * slowing, pose: gaitPose(street.gait, o.phase, 0.72, 1 - loss * slowing) });
    }
  } else {
    // The officers close in from behind, beside and in front; the thief stops, turns to the camera and raises his hands.
    const close = smoothstep(from - 0.4, from + length - 0.2, t);
    const stop = smoothstep(from + length - 0.8, from + length + 0.4, t);
    const giveUp = smoothstep(from + length - 0.2, from + length + 0.9, t);
    const running = gaitPose(street.gait, 0.3, 0.64, 1 - slowing);
    runners.push({ ...thief, pose: withArms(blendPose(running, STAND, stop), HANDS_UP, giveUp), heading: (Math.PI / 2) * giveUp, stand: stop, raise: giveUp });
    const spots = [
      { x: thief.x - 0.75, z: thief.z - 0.15, heading: 0 },
      { x: thief.x + 0.95, z: thief.z - 0.35, heading: Math.PI },
      { x: thief.x - 0.35, z: thief.z + 0.85, heading: 0.5 }
    ];
    for (const [i, o] of OFFICERS.entries()) {
      const base = street.runners[i + 1]!, spot = spots[i]!;
      const gait = blendPose(gaitPose(street.gait, o.phase, 0.72, 1 - slowing), STAND, stop);
      runners.push({
        ...base, x: lerp(base.x, spot.x, close), z: lerp(base.z, spot.z, close), heading: spot.heading * stop,
        pose: i === 0 ? withArms(gait, REACH, giveUp) : gait, stand: stop, reach: i === 0 ? giveUp : 0
      });
    }
  }
  // The arrest ends framed in the middle of the picture, a little closer than the chase.
  const pan = ending === "catch" ? smoothstep(from, from + length + 0.6, t) : 0;
  const [cx, cy, cz] = camera, [tx, ty, tz] = street.target;
  return {
    ...street, seconds: start + t, runners,
    camera: [cx + 2.4 * pan, cy - 0.3 * pan, cz + 2 * pan],
    target: [tx + 2.9 * pan, ty, tz]
  };
}

export type RaidLine = { from: number; to: number; text: string };

const OPENERS = [
  (name: string) => `You're closing in on ${name}.`,
  (name: string) => `You're hot on ${name}'s trail.`,
  (name: string) => `${name} can't be far now.`,
  (name: string) => `There! ${sentence(name)} is making a run for it.`,
  (name: string) => `The officers have spotted ${name}.`,
  (name: string) => `${name} is running out of places to hide.`,
  (name: string) => `Stay on ${name}! Don't lose sight of them.`,
  (name: string) => `${name} is just a few steps ahead.`,
  (name: string) => `The net is tightening around ${name}.`,
  (name: string) => `Every street in town is watching for ${name}.`,
  (name: string) => `${name} knows the game is nearly up.`,
  (name: string) => `Hold on, ${name} just bolted!`,
  (name: string) => `${name} is sweating now.`,
  (name: string) => `Keep the pressure on ${name}!`
];

/** How an escape ends: the suspect got away this time, never "they were not here". */
const ESCAPES = [
  (name: string) => `${name} escaped!`,
  (name: string) => `${name} slipped away.`,
  (name: string) => `${name} avoided arrest this time.`,
  (name: string) => `${name} used the cover of the crowd to get away.`,
  (name: string) => `${name} vanished down a side street.`,
  (name: string) => `${name} jumped on a passing okada and was gone.`,
  (name: string) => `${name} disappeared into the market crowd.`,
  (name: string) => `${name} ducked through an alley and lost the officers.`,
  (name: string) => `${name} hopped a moving danfo and got away.`,
  (name: string) => `${name} lost the officers in the traffic.`,
  (name: string) => `So close! ${sentence(name)} got away again.`,
  (name: string) => `${name} lives to run another day.`
];

/** Upper-cases the first letter, for a sentence that opens with the suspect ("the suspect" when the name is unknown). */
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The captions for a raid. `seed` picks the opening line, so a second empty hideout does not read the same as the first. */
export function raidLines(ending: RaidEnding, name: string, seed = 0, finale?: string): RaidLine[] {
  const who = name.trim() || "the suspect";
  const from = (list: readonly ((name: string) => string)[], n: number) => sentence(list[((n % list.length) + list.length) % list.length]!(who));
  const pick = (n: number) => from(OPENERS, n);
  const end = RAID_SECONDS[ending];
  return ending === "escape"
    ? [
      { from: 0.3, to: 3, text: pick(seed) },
      // A step that shares no factor with the list length, so the two openers always differ and walk the whole list.
      { from: 3, to: 5.2, text: pick(seed + 5) },
      { from: 5.2, to: end, text: finale ?? from(ESCAPES, seed) }
    ]
    : [
      { from: 0.3, to: 3, text: pick(seed) },
      { from: 3, to: 5.6, text: "Nowhere left to run!" },
      { from: 5.6, to: end, text: finale ?? `${sentence(who)} is under arrest.` }
    ];
}

/** The caption on screen at second `s`, if any. */
export const raidLineAt = (lines: readonly RaidLine[], s: number): RaidLine | undefined => lines.find(l => s >= l.from && s < l.to) ?? (s >= (lines.at(-1)?.to ?? Infinity) ? lines.at(-1) : undefined);

/** A small stable number from a string, for choosing caption variants. */
export const seedOf = (text: string): number => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
