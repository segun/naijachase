// Pure logic for the witness scene that follows the journey: the player's vehicle pulls up at the venue, the player walks up to the
// witness, and the witness speaks while the words appear as subtitles. No Babylon.js here, so it is unit-tested; chase3d-witness.ts
// turns these numbers into pixels. The length of the scene follows the number of words the witness says, so a short answer is not
// padded and a long one is not rushed: about 10 to 15 seconds for a typical account, and never more than MAX_SECONDS.
import { type CameraShot, type Pose, clamp01, headingOf, lerp3, mix, smooth, turnTo } from "../shared/scene-core.ts";

/** How the player got here: the server's two local modes, as the garage names them. */
export type Arrival = "drive" | "hitch";

export const WALK_SPEED = 2.3;
/** Subtitles are read, not just heard: a brisk but comfortable pace for a reader, in words per second. */
export const WORDS_PER_SECOND = 3.3;
export const MIN_SPEECH = 3;
export const MAX_SPEECH = 11;
export const MAX_SECONDS = 18;

// ---- Layout (metres: x right, y up, z away from the camera; heading 0 faces the camera) ----

/** The lane the vehicle uses, along the front of the market. */
export const ROAD_Z = -3;
export const VEHICLE_FROM_X = 11;
export const VEHICLE_STOP_X = -2.6;
export const VEHICLE_GONE_X = -13;
/** Where the witness stands, behind her stall. */
export const WITNESS = { x: 1.15, z: 2.55 } as const;
/** Where the player stops to listen. */
export const MEET = { x: 0.35, z: 1.05 } as const;
/** The driver's seat in the car's own frame (the front is -z). Once the car faces -x its local (x, z) becomes (z, -x) in the world. */
export const CAR_SEAT = { x: -0.38, z: 0.25 } as const;
export const CAR_HEADING = headingOf(-1, 0);
export const CAR_SIT_DROP = 0.09;
export const SEAT_WORLD: readonly [number, number] = [VEHICLE_STOP_X + CAR_SEAT.z, ROAD_Z - CAR_SEAT.x];
/** The minibus has a rear door, so the player steps out where the camera can see them. It is 2.5 m behind the bus's centre. */
export const BUS_REAR = 2.55;
/** Where the player stands after stepping out, on the market side of the vehicle. */
export const EXIT_POINT: Record<Arrival, readonly [number, number]> = {
  drive: [SEAT_WORLD[0] + 0.1, ROAD_Z + 1.5],
  hitch: [VEHICLE_STOP_X + BUS_REAR + 0.9, ROAD_Z]
};

const FACE_MARKET = headingOf(0, 1);
const FACE_REAR = headingOf(1, 0);
const FACE_WITNESS = headingOf(WITNESS.x - MEET.x, WITNESS.z - MEET.z);
const WITNESS_FACES_PLAYER = headingOf(MEET.x - WITNESS.x, MEET.z - WITNESS.z);

// ---- What the witness says ----

export const wordsOf = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean);
export const speechSeconds = (wordCount: number) => Math.min(MAX_SPEECH, Math.max(MIN_SPEECH, wordCount / WORDS_PER_SECOND + 0.5));

/** A rough syllable count, enough to give each word a believable length and to open the mouth once per syllable. */
export const syllables = (word: string): number => Math.max(1, (word.toLowerCase().replace(/[^a-z]/g, "").match(/[aeiouy]+/g) ?? []).length);

export type WordTiming = { start: number; end: number; syllables: number };

const SENTENCE_END = /[.!?]["')]*$/;
const CLAUSE_END = /[,;:]["')]*$/;

/** Spreads the words over `seconds`: longer words take longer, and a pause follows a comma or a sentence end. */
export function wordTimings(words: readonly string[], seconds: number): WordTiming[] {
  const weights = words.map(w => syllables(w) + 0.6);
  const pauses: number[] = words.map((w, i) => (i === words.length - 1 ? 0 : SENTENCE_END.test(w) ? 1.4 : CLAUSE_END.test(w) ? 0.7 : 0));
  const total = weights.reduce((a, b) => a + b, 0) + pauses.reduce((a, b) => a + b, 0);
  const unit = total > 0 ? seconds / total : 0;
  let at = 0;
  return words.map((w, i) => {
    const start = at;
    at += weights[i]! * unit;
    const end = at;
    at += pauses[i]! * unit;
    return { start, end, syllables: syllables(w) };
  });
}

export type Page = { from: number; to: number };

/** Splits the words into screens of at most `max` words, preferring to break after a sentence. */
export function subtitlePages(words: readonly string[], max = 14): Page[] {
  const pages: Page[] = [];
  let from = 0;
  for (let i = 0; i < words.length; i++) {
    const count = i - from + 1;
    const sentence = SENTENCE_END.test(words[i]!);
    const clause = CLAUSE_END.test(words[i]!);
    if (count >= max || (sentence && count >= 6) || (clause && count >= Math.ceil(max * 0.75))) { pages.push({ from, to: i + 1 }); from = i + 1; }
  }
  if (from < words.length) pages.push({ from, to: words.length });
  const last = pages[pages.length - 1], before = pages[pages.length - 2];
  if (last && before && last.to - last.from < 4 && last.to - before.from <= max + 4) { before.to = last.to; pages.pop(); }
  return pages;
}

export type SubtitleState = { page: number; /** Words of the whole account already spoken. */ spoken: number };

/** Which screen to show and how many words have been said, `seconds` after the witness starts speaking. */
export function subtitleAt(timings: readonly WordTiming[], pages: readonly Page[], seconds: number): SubtitleState {
  let spoken = 0;
  while (spoken < timings.length && timings[spoken]!.start <= seconds) spoken++;
  const latest = Math.max(0, spoken - 1);
  return { page: Math.max(0, pages.findIndex(p => latest >= p.from && latest < p.to)), spoken };
}

/** How open the witness's mouth is (0 to 1), `seconds` after the witness starts speaking: once per syllable, closed in the pauses. */
export function mouthAt(timings: readonly WordTiming[], seconds: number): number {
  for (let i = 0; i < timings.length; i++) {
    const w = timings[i]!;
    if (seconds < w.start) return 0;
    if (seconds <= w.end) {
      const phase = (seconds - w.start) / Math.max(0.001, w.end - w.start);
      const stress = 0.72 + 0.28 * Math.sin(i * 2.399);
      return Math.pow(Math.abs(Math.sin(phase * w.syllables * Math.PI)), 0.7) * stress;
    }
  }
  return 0;
}

// ---- The plan: when each part of the scene happens ----

export type Plan = {
  arrival: Arrival;
  /** The market is on screen for this long before the vehicle starts to arrive. */
  lead: number;
  /** The vehicle has stopped. */
  stopped: number;
  /** The player is out of the vehicle and starts walking. */
  walkStart: number;
  walkEnd: number;
  speechStart: number;
  speechEnd: number;
  /** The picture has faded to black. */
  end: number;
  /** How long the witness speaks, seconds. */
  speech: number;
};

const LEAD = 0.5;
const ARRIVE = 2;
const STEP_OUT = 0.9;
const GREET = 0.5;
const OUTRO = 0.8;
export const walkDistance = (arrival: Arrival) => Math.hypot(MEET.x - EXIT_POINT[arrival][0], MEET.z - EXIT_POINT[arrival][1]);

export function planScene(arrival: Arrival, wordCount: number): Plan {
  const speech = speechSeconds(wordCount);
  const stopped = LEAD + ARRIVE;
  const walkStart = stopped + STEP_OUT;
  const walkEnd = walkStart + walkDistance(arrival) / WALK_SPEED;
  const speechStart = walkEnd + GREET;
  const speechEnd = speechStart + speech;
  return { arrival, lead: LEAD, stopped, walkStart, walkEnd, speechStart, speechEnd, end: Math.min(MAX_SECONDS, speechEnd + OUTRO), speech };
}

/** The picture is black at the start and the end: it fades in over half a second and out over the last 0.6. */
export const fadeAt = (plan: Plan, t: number) => Math.min(smooth(t / 0.5), 1 - smooth((t - (plan.end - 0.6)) / 0.6));

// ---- The vehicle ----

/** The vehicle comes in from the right, slowing to a stop; the minibus leaves again to the left once the player is clear. */
export function vehicleXAt(plan: Plan, t: number): number {
  const arriving = clamp01((t - plan.lead) / (plan.stopped - plan.lead));
  const x = mix(VEHICLE_FROM_X, VEHICLE_STOP_X, 1 - (1 - arriving) * (1 - arriving));
  if (plan.arrival === "drive") return x;
  const leaving = clamp01((t - (plan.walkStart + 0.2)) / 2.2);
  return x + (VEHICLE_GONE_X - VEHICLE_STOP_X) * leaving * leaving;
}
/** 0 to 1: how fast the vehicle is going, for the engine sound and the wheels. */
export function vehicleSpeedAt(plan: Plan, t: number): number {
  const dt = 0.05;
  return clamp01(Math.abs(vehicleXAt(plan, t + dt) - vehicleXAt(plan, t - dt)) / (2 * dt) / 7);
}
/** How far the minibus door is open (0 to 1). */
export const busDoorAt = (plan: Plan, t: number) => smooth((t - plan.stopped) / 0.25) * (1 - smooth((t - (plan.walkStart + 0.1)) / 0.25));

// ---- The player ----

export type WitnessPose = Pose & { alpha: number };
const pose = (over: Partial<WitnessPose>): WitnessPose => ({ x: 0, y: 0, z: 0, heading: 0, sit: 0, gait: 0, stride: 0, type: 0, visible: true, alpha: 1, ...over });

export function playerPoseAt(plan: Plan, t: number): WitnessPose {
  const exit = EXIT_POINT[plan.arrival];
  if (plan.arrival === "drive") {
    if (t < plan.stopped) return pose({ x: vehicleXAt(plan, t) + CAR_SEAT.z, y: -CAR_SIT_DROP, z: SEAT_WORLD[1], heading: CAR_HEADING, sit: 1, type: 1 });
    if (t < plan.walkStart) {
      const k = smooth((t - plan.stopped) / (plan.walkStart - plan.stopped));
      return pose({
        x: mix(SEAT_WORLD[0], exit[0], k), z: mix(SEAT_WORLD[1], exit[1], k),
        y: mix(-CAR_SIT_DROP, 0, k) + Math.sin(k * Math.PI) * 0.22,
        heading: turnTo(CAR_HEADING, FACE_MARKET, k), sit: 1 - k, type: 1 - k
      });
    }
  } else {
    // Hitching: the player is inside the minibus until its door opens, then steps down.
    const open = plan.stopped + 0.25;
    const inside = exit[0] - 1.3;
    if (t < open) return pose({ x: inside, z: exit[1], heading: FACE_REAR, visible: false, alpha: 0 });
    if (t < plan.walkStart) {
      const k = smooth((t - open) / (plan.walkStart - open));
      return pose({ x: mix(inside, exit[0], k), z: exit[1], heading: FACE_REAR, alpha: smooth((k - 0.35) / 0.2), gait: k * 5, stride: Math.sin(k * Math.PI) * 0.8 });
    }
  }
  const heading = headingOf(MEET.x - exit[0], MEET.z - exit[1]);
  const walked = (plan.walkEnd - plan.walkStart) * WALK_SPEED * 2.4;
  if (t < plan.walkEnd) {
    const k = clamp01((t - plan.walkStart) / (plan.walkEnd - plan.walkStart));
    return pose({
      x: mix(exit[0], MEET.x, k), z: mix(exit[1], MEET.z, k),
      heading: turnTo(plan.arrival === "drive" ? FACE_MARKET : FACE_REAR, heading, smooth((t - plan.walkStart) / 0.25)),
      gait: (t - plan.walkStart) * WALK_SPEED * 2.4,
      stride: smooth((t - plan.walkStart) / 0.2) * (1 - smooth((t - (plan.walkEnd - 0.25)) / 0.25))
    });
  }
  return pose({ x: MEET.x, z: MEET.z, heading: turnTo(heading, FACE_WITNESS, smooth((t - plan.walkEnd) / 0.35)), gait: walked });
}

/** A small nod of the shoulders while listening, in radians (forward lean). */
export const listenLean = (plan: Plan, t: number) =>
  t < plan.speechStart ? 0 : Math.max(0, Math.sin((t - plan.speechStart) * 1.7)) * 0.045 * smooth((t - plan.speechStart) / 0.5);

// ---- The witness ----

export type WitnessMotion = {
  /** Mouth openness, 0 to 1. */
  mouth: number;
  /** Shoulder swing for her left and right arms (positive reaches towards the camera). */
  arms: readonly [number, number];
  /** A sideways lift of the right arm: the greeting wave. */
  wave: number;
  /** Body turn towards the player, radians from facing the camera. */
  heading: number;
  lean: number;
  bob: number;
};

export function witnessAt(plan: Plan, timings: readonly WordTiming[], t: number): WitnessMotion {
  const talking = t >= plan.speechStart && t <= plan.speechEnd + 0.3;
  const idle = Math.sin(t * 1.3) * 0.03;
  // She notices the player as they come close, turns to them and lifts a hand in greeting before she speaks.
  const notice = smooth((t - (plan.walkEnd - 1.2)) / 0.8);
  const greet = smooth((t - plan.walkEnd) / 0.2) * (1 - smooth((t - (plan.speechStart + 0.1)) / 0.25));
  const beat = talking ? Math.sin((t - plan.speechStart) * 4.4) : 0;
  const emphasis = talking ? smooth((t - plan.speechStart) / 0.4) * (1 - smooth((t - plan.speechEnd) / 0.4)) : 0;
  return {
    mouth: talking ? mouthAt(timings, t - plan.speechStart) : 0,
    arms: [0.25 * emphasis + idle + 0.3 * greet, 0.7 * emphasis + 0.25 * emphasis * beat + 0.9 * greet] as const,
    wave: greet * (0.3 + 0.25 * Math.sin((t - plan.walkEnd) * 11)),
    heading: turnTo(0, WITNESS_FACES_PLAYER, notice * 0.6),
    lean: emphasis * (0.02 + 0.03 * Math.max(0, beat)),
    bob: emphasis * Math.abs(beat) * 0.015
  };
}

// ---- The camera ----

const ARRIVAL_SHOT: CameraShot = { position: [0.4, 1.8, -11.5], target: [0.4, 1.35, 0.5] };
const ARRIVAL_END: CameraShot = { position: [-0.4, 1.75, -10.6], target: [-0.4, 1.3, 0.5] };
const TALK_FROM: CameraShot = { position: [3.3, 1.55, -1.3], target: [0.75, 1.3, 1.9] };
const TALK_TO: CameraShot = { position: [3.0, 1.55, -0.9], target: [0.8, 1.35, 1.95] };

/** An establishing shot of the market and the arriving vehicle, a follow shot of the walk, then a two-shot that eases in on the witness. */
export function cameraAt(plan: Plan, t: number): CameraShot {
  const drift = smooth(t / plan.walkStart);
  const arrival: CameraShot = { position: lerp3(ARRIVAL_SHOT.position, ARRIVAL_END.position, drift), target: ARRIVAL_SHOT.target };
  const k = smooth((t - (plan.walkStart - 0.3)) / (plan.walkEnd - plan.walkStart + 0.3));
  if (k <= 0) return arrival;
  const at = playerPoseAt(plan, Math.min(t, plan.walkEnd));
  const follow: CameraShot = {
    position: lerp3(arrival.position, TALK_FROM.position, k),
    target: lerp3(arrival.target, [mix(at.x, TALK_FROM.target[0], k), TALK_FROM.target[1], mix(at.z + 1.2, TALK_FROM.target[2], k)], k)
  };
  if (t < plan.walkEnd) return follow;
  const push = smooth((t - plan.walkEnd) / Math.max(0.5, plan.speechEnd - plan.walkEnd));
  return { position: lerp3(TALK_FROM.position, TALK_TO.position, push), target: lerp3(TALK_FROM.target, TALK_TO.target, push) };
}

/** Footfalls: which step the player is on, so a sound can be made each time it changes. -1 when standing. */
export const stepsTaken = (p: Pose) => (p.stride > 0.35 ? Math.floor(p.gait / Math.PI) : -1);
