// The timeline of the disciplinary panel scene: five judges sit in a row, the player stands before them, and each judge in turn
// raises a paper on a stick carrying their vote. When the last paper is up the scene cuts to the player accepting judgement.
// Pure (no graphics library) so it is unit-tested and shared by the 3D renderer; the 2D fallback is PanelPresentation.svelte.
// Every vote and the decision come from the server; nothing here chooses, reorders or changes one.
import { type Vec, clamp01, mix, smooth } from "../shared/scene-core.ts";

export type Vote = "punish" | "warning";
export type CameraShot = { position: Vec; target: Vec };

export const SEATS = 5;
export const SEAT_X = [-2.4, -1.2, 0, 1.2, 2.4] as const;
/** Metres: x right, y up, z away from the camera. The bench is the judges' side, the player stands on the other. */
export const LAYOUT = { benchZ: 3.6, daisY: 0.25, judgeZ: 4.45, playerZ: -0.2, paperHidden: 0.62, paperRaised: 1.95 } as const;

const INTRO = 2;
const GAP = 1.5;
const RAISE = 0.7;
const HOLD = 1.8;
const DIP = 0.3;
const SETTLE = 2;

export type PanelPlan = { votes: Vote[]; raiseAt: number[]; raiseFor: number; cutAt: number; end: number };

export function planPanel(votes: readonly Vote[]): PanelPlan {
  const raiseAt = votes.map((_, i) => INTRO + i * GAP);
  const last = raiseAt.length ? raiseAt[raiseAt.length - 1]! + RAISE : INTRO;
  const cutAt = last + HOLD;
  return { votes: [...votes], raiseAt, raiseFor: RAISE, cutAt, end: cutAt + SETTLE };
}

export type PanelFrame = {
  t: number;
  /** 0 black, 1 clear. */
  fade: number;
  /** How far each paper is up, 0 to 1. */
  raised: number[];
  /** The votes shown so far, in seat order, null while a paper is still down. */
  revealed: (Vote | null)[];
  /** True from the cut to the accept-judgement shot. */
  verdict: boolean;
  /** How far the player bows their head, 0 to 1. */
  bow: number;
  camera: CameraShot;
};

const BENCH_WIDE: CameraShot = { position: [0, 3.1, -5.6], target: [0, 1.15, 3.8] };
const BENCH_CLOSE: CameraShot = { position: [0, 2.8, -4.4], target: [0, 1.2, 3.9] };
const ACCEPT: CameraShot = { position: [0.55, 1.55, 1.7], target: [0, 1.5, -0.2] };

export function frameAt(plan: PanelPlan, time: number): PanelFrame {
  const t = Math.min(Math.max(time, 0), plan.end);
  const raised = plan.raiseAt.map(at => smooth((t - at) / plan.raiseFor));
  const verdict = t >= plan.cutAt;
  const intro = clamp01(t / 0.9);
  const toCut = plan.cutAt - t, afterCut = t - plan.cutAt;
  const dip = verdict ? clamp01(afterCut / DIP) : clamp01(toCut / DIP);
  const k = smooth(t / plan.cutAt);
  const from = BENCH_WIDE, to = BENCH_CLOSE;
  const camera: CameraShot = verdict ? ACCEPT : {
    position: [mix(from.position[0], to.position[0], k), mix(from.position[1], to.position[1], k), mix(from.position[2], to.position[2], k)],
    target: [mix(from.target[0], to.target[0], k), mix(from.target[1], to.target[1], k), mix(from.target[2], to.target[2], k)]
  };
  return {
    t,
    fade: Math.min(smooth(intro), smooth(dip)),
    raised,
    revealed: plan.votes.map((v, i) => (raised[i]! >= 0.999 ? v : null)),
    verdict,
    bow: verdict ? smooth(afterCut / 1.2) : 0,
    camera
  };
}

/** The scene time to resume from after a renderer change, given how many votes were already shown. */
export const resumeTime = (plan: PanelPlan, shown: number): number =>
  shown <= 0 ? 0 : shown >= plan.votes.length ? plan.cutAt : plan.raiseAt[shown - 1]! + plan.raiseFor;

export const announce = (seat: number, vote: Vote): string => `Judge ${seat + 1} raises a paper: ${vote === "punish" ? "punish" : "warning"}.`;

export type PanelOptions = {
  /** The player's avatar. Without one the player is simply not drawn. */
  preset?: import("../../avatar/avatar-model.ts").AvatarPreset | null;
  hour: number;
  quality?: "high" | "light";
  /** Whether the generated GLB models may be used (the Full detail level); the shapes built in code are used otherwise. */
  models?: boolean;
  votes: readonly Vote[];
  /** Called when the fade, a vote or the cut changes. */
  onFrame: (frame: { fade: number; revealed: (Vote | null)[]; verdict: boolean }) => void;
  onTick?: () => void;
  onSlow?: () => void;
  /** Called once if the renderer breaks, so the caller can carry on in the 2D panel instead of leaving a black screen. */
  onFault?: (why: string) => void;
};
export type PanelHandle = {
  /** Plays from `from` seconds; resolves when the scene ends or is skipped. */
  start(from?: number): Promise<void>;
  skip(): void;
  dispose(): void;
  duration: number;
  /** How far the scene has got, seconds. */
  now(): number;
  plan: PanelPlan;
  seek(seconds: number): void;
};
