// The people of the building sets: a few figures standing, chatting or pacing, described as data and moved by one pure function of `t`,
// so 3D and 2D agree and a frame can be redrawn exactly. Positions keep clear of the camera's keep-out boxes (checked in the tests).
import { headingOf } from "../shared/scene-core.ts";

export type Headgear = { kind: "wrap" | "cap"; c: string };
export type Prop = { kind: "bag" | "drum" | "staff" | "tray"; c: string };

export type Person = {
  x: number; z: number;
  /** Where they look when standing still, as a heading (0 faces the camera). */
  face: number;
  /** If given, they pace between (x, z) and this point, once every `period` seconds. */
  to?: readonly [number, number];
  period?: number;
  phase?: number;
  skin: number;
  top: string;
  bottom: string;
  /** A long wrapper or skirt instead of trousers. */
  skirt?: string;
  head?: Headgear;
  prop?: Prop;
};

export type Pose = { x: number; z: number; heading: number; swing: number; bounce: number; gesture: number };

export const SKINS = ["#5a3a28", "#6e4630", "#8a5a3c", "#a06a45", "#3f2a1e"] as const;

/** Where a person is and what they are doing at `t` seconds. */
export function poseAt(p: Person, t: number): Pose {
  const gesture = Math.sin(t * 1.3 + (p.phase ?? 0) * 3) * 0.12;
  if (!p.to) return { x: p.x, z: p.z, heading: p.face + Math.sin(t * 0.5 + (p.phase ?? 0)) * 0.12, swing: 0, bounce: 0, gesture };
  const w = (Math.PI * 2) / (p.period ?? 12), a = t * w + (p.phase ?? 0);
  const k = (1 - Math.cos(a)) / 2, v = Math.sin(a);
  const dx = p.to[0] - p.x, dz = p.to[1] - p.z, length = Math.hypot(dx, dz) || 1;
  const sign = v >= 0 ? 1 : -1;
  const speed = (Math.abs(v) * w * length) / 2;
  const step = Math.sin(t * 6 + (p.phase ?? 0));
  const moving = Math.min(1, speed / 0.4);
  return {
    x: p.x + dx * k, z: p.z + dz * k,
    heading: headingOf(dx * sign, dz * sign),
    swing: step * 0.5 * moving, bounce: Math.abs(step) * 0.02 * moving, gesture: 0
  };
}

/** The heading that faces (tx, tz) from (x, z). */
export const toward = (x: number, z: number, tx: number, tz: number) => headingOf(tx - x, tz - z);

type Dress = { top: string; bottom?: string; skirt?: string; head?: Headgear; prop?: Prop };
/** A person standing at (x, z) looking at `face`. */
export const stand = (x: number, z: number, face: number, d: Dress): Person => ({ x, z, face, skin: 0, top: d.top, bottom: d.bottom ?? "#2b3038", skirt: d.skirt, head: d.head, prop: d.prop });
/** A person pacing between (x, z) and (tx, tz). */
export const pace = (x: number, z: number, tx: number, tz: number, period: number, d: Dress, phase = 0): Person => ({ ...stand(x, z, 0, d), to: [tx, tz], period, phase });
/** Gives a crowd a mix of skin tones, the same every time. */
export const crowd = (people: readonly Person[], offset = 0): Person[] => people.map((p, i) => ({ ...p, skin: (i * 3 + offset) % SKINS.length }));

/** Clothes, as the people of these places might wear them: modest, plain and a mix of colours. */
export const COLOURS = {
  white: "#f0ebde", cream: "#e8dcc0", navy: "#26385c", khaki: "#b4a27a", green: "#2f7a52", teal: "#26767a", maroon: "#7e2f3e", gold: "#d1a43a",
  blue: "#3b6aa6", orange: "#d3772c", purple: "#6b4a92", red: "#b8483b", grey: "#7c8087", black: "#23252a", brown: "#6b4a30", pink: "#c46a8d"
} as const;
