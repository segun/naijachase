// What both witness renderers (3D in chase3d-witness.ts, 2D in witness-2d.ts) share, and which needs no graphics library: the options and
// handle they are given and return, the subtitles, the sound and the per-frame bookkeeping. A renderer only draws a frame for `t`
// seconds and calls `step(t)`; the rules (timing, poses, words) live in witness-scene.ts, so the two never disagree about what happens.
import type { AvatarPreset } from "../../avatar/avatar-model.ts";
import type { CameraShot, Pose } from "../shared/scene-core.ts";
import { createWitnessAudio } from "./witness-audio.ts";
import { hashOf, type VenueRecipe } from "./venue-recipes.ts";
import {
  type Arrival, type Page, type SubtitleState, fadeAt, planScene, stepsTaken, subtitleAt, subtitlePages, vehicleSpeedAt, wordTimings, wordsOf
} from "./witness-scene.ts";

export type WitnessFrame = { /** 0 black, 1 fully visible. */ fade: number; subtitle: SubtitleState | null };
export type WitnessOptions = {
  /** The player's avatar. Without one the player is simply not drawn. */
  preset?: AvatarPreset | null;
  hour: number;
  quality?: "high" | "light";
  /** Whether the generated GLB models may be used (the Full detail level); the shapes built in code are used otherwise. */
  models?: boolean;
  signal?: AbortSignal;
  recipe: VenueRecipe;
  arrival: Arrival;
  /** What the witness says. */
  text: string;
  /** The venue's name, painted on the banner over the market. */
  venueName: string;
  sound: boolean;
  /** Skip the arrival and the walk and begin at the conversation (the 2D renderer honours it). */
  reducedMotion?: boolean;
  /** Called when the fade or the subtitle changes. */
  onFrame: (frame: WitnessFrame) => void;
  /** Called after every frame is drawn, so the caller can tell the scene is still running. */
  onTick?: () => void;
  /** Called when the frame rate stays too low for this renderer. */
  onSlow?: () => void;
  /** Called once if the renderer breaks (an error while drawing, a lost WebGL context), so the caller can switch renderer instead of leaving a black screen. */
  onFault?: (why: string) => void;
};
export type WitnessHandle = {
  /** Plays the scene from `from` seconds; resolves when it ends or is skipped. */
  start(from?: number): Promise<void>;
  /** Jumps to the end, which resolves `start`. */
  skip(): void;
  dispose(): void;
  words: string[];
  pages: Page[];
  duration: number;
  /** How far the scene has got, seconds, so another renderer can carry on from here. */
  now(): number;
  /** Freezes the scene at `seconds` and draws that one frame (previews and tests). */
  seek(seconds: number): void;
};

export function createDriver(options: WitnessOptions) {
  const words = wordsOf(options.text);
  const plan = planScene(options.arrival, words.length, !options.reducedMotion);
  const timings = wordTimings(words, plan.speech);
  const pages = subtitlePages(words);
  const witness = options.recipe.witnesses[hashOf(options.text) % options.recipe.witnesses.length]!;
  let audio = options.sound ? createWitnessAudio(options.recipe.sound, options.arrival === "drive" ? "car" : "bus", hashOf(options.text)) : null;
  let spoken = false, lastStep = -1, doorSounded = false, boardSounded = false, lastPage = -2, lastSpoken = -2, lastFade = -1, lastT = 0;

  return {
    words, plan, timings, pages, witness,
    now: () => lastT,
    /** Call once per drawn frame with the time and the player's pose (for footsteps). */
    step(t: number, player: Pose) {
      lastT = t;
      // Sound is a nicety: if it ever throws, the scene carries on without it rather than stopping the picture.
      try {
        if (audio) {
          audio.engine(vehicleSpeedAt(plan, t));
          if (!spoken) { spoken = true; audio.speak(timings, Math.max(0, plan.speechStart - t), witness.pitch, hashOf(options.text) ^ 0x5bd1e995); }
          if (!doorSounded && t >= plan.stopped + (options.arrival === "hitch" ? 0.1 : 0.35)) { doorSounded = true; if (t < plan.walkStart) audio.door(); }
          if (!boardSounded && plan.leave && t >= plan.backAt + 0.25) { boardSounded = true; audio.door(); }
          const step = stepsTaken(player);
          if (step >= 0 && step !== lastStep) audio.step();
          lastStep = step;
        }
      } catch (e) { console.warn("The witness scene's sound failed; continuing without it.", e); audio?.dispose(); audio = null; }
      options.onTick?.();
      const fade = Math.round(fadeAt(plan, t) * 100) / 100;
      // The caption goes a moment after the last word, so it is not left over the walk back to the vehicle.
      const state = t >= plan.speechStart && t <= plan.speechEnd + 0.35 ? subtitleAt(timings, pages, t - plan.speechStart) : null;
      const page = state ? state.page : -1, count = state ? state.spoken : -1;
      if (fade !== lastFade || page !== lastPage || count !== lastSpoken) {
        lastFade = fade; lastPage = page; lastSpoken = count;
        options.onFrame({ fade, subtitle: state && state.spoken > 0 ? state : null });
      }
    },
    dispose() { audio?.dispose(); }
  };
}
export type Driver = ReturnType<typeof createDriver>;

/** A portrait window shows less to the sides, so stand further back to keep the people in the picture. */
export function fitShot(shot: CameraShot, aspect: number): CameraShot {
  const back = aspect < 1.3 ? Math.min(2, 1.3 / Math.max(0.5, aspect)) : 1;
  const [tx, ty, tz] = shot.target;
  return { position: [tx + (shot.position[0] - tx) * back, ty + (shot.position[1] - ty) * back + (back - 1) * 0.4, tz + (shot.position[2] - tz) * back], target: shot.target };
}
