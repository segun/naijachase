export type RoomPhase = "intro" | "look" | "desk" | "outro";

/** Settled rooms render on demand; only an active intro or missing first frame can stall. */
export function roomRendererStalled(phase: RoomPhase, lastFrame: number, began: number, now: number, hidden: boolean): boolean {
  if (hidden || phase === "desk" || phase === "outro" || (phase === "look" && lastFrame > 0)) return false;
  return now - (lastFrame || began) > (lastFrame ? 3000 : 7000);
}
