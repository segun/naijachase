import { createChaseScene, type ChaseHandle } from "../src/scenes/chase/chase3d.ts";
import { createChase2d } from "../src/scenes/chase/chase-2d.ts";

const select = document.getElementById("detail") as HTMLSelectElement;
const time = document.getElementById("time") as HTMLInputElement;
const note = document.getElementById("note")!;
let handle: { dispose(): void } | undefined;
let scene: ChaseHandle["scene"] | undefined;
let controller: AbortController | undefined;
let generation = 0, at = 0, began = performance.now(), paused = false;
const seconds = () => at + (paused ? 0 : (performance.now() - began) / 1000);
declare global {
  interface Window { chasePreview: { scene: () => ChaseHandle["scene"] | undefined; seconds: () => number } }
}
window.chasePreview = { scene: () => scene, seconds };

async function start() {
  const token = ++generation;
  controller?.abort(); handle?.dispose(); handle = undefined; scene = undefined;
  const pending = new AbortController(); controller = pending;
  note.textContent = "Loading...";
  const canvas = document.createElement("canvas"); canvas.id = "c";
  document.getElementById("c")!.replaceWith(canvas);
  try {
    if (select.value === "simple") handle = createChase2d(canvas, seconds, false, error => { note.textContent = String(error); });
    else {
      const next = await createChaseScene(canvas, { models: select.value === "full", signal: pending.signal, seconds, quality: "high",
        onFault: error => { note.textContent = String(error); } });
      if (token !== generation) { next.dispose(); return; }
      handle = next; scene = next.scene;
    }
    note.textContent = paused ? "Paused for inspection" : "Playing";
  } catch (error) {
    if (pending.signal.aborted) return;
    console.error("Chase preview failed.", error); note.textContent = String(error);
  }
}
select.onchange = () => { void start(); };
document.getElementById("inspect")!.onclick = () => {
  at = Number(time.value); paused = true;
  if (!handle) void start(); else note.textContent = "Paused for inspection";
};
document.getElementById("play")!.onclick = () => {
  at = Number(time.value); began = performance.now(); paused = false; note.textContent = "Playing";
};
void start();
