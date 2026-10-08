// Decides whether, and how richly, to run the optional 3D scene. Pure, so it is unit-tested.
export type Device = {
  viewportWidth: number;
  reducedMotion: boolean;
  saveData: boolean;
  /** navigator.connection.effectiveType, when the browser reports it. */
  connection?: string;
  /** navigator.deviceMemory in GB, when reported. */
  memoryGb?: number;
  cores?: number;
  coarsePointer: boolean;
};

export type SceneDecision =
  | { run: false; reason: "narrow" | "reduced-motion" | "save-data" | "slow-network" | "low-memory" }
  | { run: true; quality: "high" | "light" };

/** The scene panel is only shown at this width (see the .auth-side breakpoint in screens.css). */
export const MIN_WIDTH = 961;
export const MIN_FPS = 20;

export function decideScene(d: Device): SceneDecision {
  if (d.viewportWidth < MIN_WIDTH) return { run: false, reason: "narrow" };
  if (d.reducedMotion) return { run: false, reason: "reduced-motion" };
  if (d.saveData) return { run: false, reason: "save-data" };
  if (d.connection && /^(slow-2g|2g|3g)$/.test(d.connection)) return { run: false, reason: "slow-network" };
  if (d.memoryGb !== undefined && d.memoryGb < 2) return { run: false, reason: "low-memory" };
  const weak = (d.cores !== undefined && d.cores <= 4) || (d.memoryGb !== undefined && d.memoryGb <= 4) || d.coarsePointer;
  return { run: true, quality: weak ? "light" : "high" };
}

export function readDevice(): Device {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string }; deviceMemory?: number };
  return {
    viewportWidth: window.innerWidth,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced",
    saveData: nav.connection?.saveData === true,
    connection: nav.connection?.effectiveType,
    memoryGb: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
    coarsePointer: matchMedia("(pointer: coarse)").matches
  };
}

/** Frame-rate guard: true when a sustained average is below the floor, so the caller should fall back to 2D. */
export function tooSlow(fpsSamples: readonly number[], floor = MIN_FPS): boolean {
  if (fpsSamples.length < 3) return false;
  const recent = fpsSamples.slice(-3);
  return recent.reduce((a, b) => a + b, 0) / recent.length < floor;
}
