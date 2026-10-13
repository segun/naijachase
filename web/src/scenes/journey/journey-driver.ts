// What both journey renderers (3D in chase3d-journey.ts, 2D in journey-2d.ts) are given and return. No graphics library.
import type { AvatarPreset } from "../../avatar/avatar-model.ts";
import { frameAt, planJourney, type JourneyFrame, type JourneyMode, type JourneyPlan } from "./journey-scene.ts";

export type JourneyOptions = {
  /** The player's avatar. Without one the player is simply not drawn. */
  preset?: AvatarPreset | null;
  hour: number;
  quality?: "high" | "light";
  /** Whether the generated GLB models may be used (the Full detail level); the shapes built in code are used otherwise. */
  models?: boolean;
  signal?: AbortSignal;
  mode: JourneyMode;
  from: string;
  to: string;
  label?: string;
  /** Fixes which landscapes are picked (tests and previews); otherwise they are random. */
  seed?: number;
  /** The endless "show travel route" view: no departure, no arrival, it runs until it is closed. */
  loop?: boolean;
  /** Start at the arrival shot instead of the whole journey. */
  reducedMotion?: boolean;
  /** Called when the fade changes. */
  onFrame: (frame: { fade: number }) => void;
  /** Called after every frame is drawn, so the caller can tell the scene is still running. */
  onTick?: () => void;
  /** Called when the frame rate stays too low for this renderer. */
  onSlow?: () => void;
  /** Called once if the renderer breaks, so the caller can switch renderer instead of leaving a black screen. */
  onFault?: (why: string) => void;
};
export type JourneyHandle = {
  /** Plays the scene from `from` seconds; resolves when it ends or is skipped. */
  start(from?: number): Promise<void>;
  skip(): void;
  dispose(): void;
  duration: number;
  plan: JourneyPlan;
  /** How far the scene has got, seconds, so another renderer can carry on from here. */
  now(): number;
  /** Freezes the scene at `seconds` and draws that one frame (previews and tests). */
  seek(seconds: number): void;
};

export function createJourneyDriver(options: JourneyOptions) {
  const plan = planJourney({ mode: options.mode, from: options.from, to: options.to, label: options.label, hour: options.hour, seed: options.seed, loop: options.loop });
  let lastFade = -1, lastT = 0;
  return {
    plan,
    now: () => lastT,
    /** Call once per drawn frame when the fade changes. */
    step(frame: JourneyFrame) {
      lastT = frame.t;
      if (Math.abs(frame.fade - lastFade) > 0.004) {
        lastFade = frame.fade;
        options.onFrame({ fade: frame.fade });
      }
      options.onTick?.();
    },
    frame: (t: number) => frameAt(plan, t)
  };
}
