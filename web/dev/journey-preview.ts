import { createJourneyScene3D } from "../src/scenes/journey/chase3d-journey.ts";
import { HOSTESS, type JourneyMode } from "../src/scenes/journey/journey-scene.ts";

const mode = document.getElementById("mode") as HTMLSelectElement;
const detail = document.getElementById("detail") as HTMLSelectElement;
const avatar = document.getElementById("avatar") as HTMLSelectElement;
const loop = document.getElementById("loop") as HTMLInputElement;
const hour = document.getElementById("hour") as HTMLInputElement;
const time = document.getElementById("time") as HTMLInputElement;
const note = document.getElementById("note")!;
for (let i = 1; i <= 10; i++) avatar.add(new Option(`Avatar ${i}`, `avatar-${String(i).padStart(2, "0")}`));
type PreviewHandle = Awaited<ReturnType<typeof createJourneyScene3D>>;
let handle: PreviewHandle | undefined, controller: AbortController | undefined, generation = 0;

declare global {
  interface Window { journeyPreview: { ready: Promise<void>; handle: () => PreviewHandle | undefined } }
}
window.journeyPreview = { ready: Promise.resolve(), handle: () => handle };

async function start() {
  const token = ++generation;
  controller?.abort(); handle?.dispose(); handle = undefined;
  const pending = new AbortController(); controller = pending;
  const canvas = document.createElement("canvas"); canvas.id = "c";
  document.getElementById("c")!.replaceWith(canvas); note.textContent = "Loading...";
  try {
    const next = await createJourneyScene3D(canvas, {
      mode: mode.value as JourneyMode, from: "Lagos", to: "Kano", seed: 9, hour: Number(hour.value),
      quality: "high", models: detail.value === "full", loop: loop.checked, signal: pending.signal,
      preset: { ...HOSTESS, avatar_id: avatar.value },
      onFrame: () => {}, onFault: why => { note.textContent = why; }
    });
    if (token !== generation) { next.dispose(); return; }
    handle = next;
    next.seek(Number(time.value));
    await next.scene.whenReadyAsync();
    if (token !== generation) return;
    next.seek(Number(time.value)); note.textContent = "Ready";
  } catch (error) {
    if (pending.signal.aborted) return;
    console.error("Journey preview failed.", error); note.textContent = String(error);
  }
}
const rebuild = () => { window.journeyPreview.ready = start(); };
mode.onchange = detail.onchange = avatar.onchange = loop.onchange = hour.onchange = rebuild;
document.getElementById("inspect")!.onclick = () => handle?.seek(Number(time.value));
document.getElementById("play")!.onclick = () => { void handle?.start(Number(time.value)); };
rebuild();
