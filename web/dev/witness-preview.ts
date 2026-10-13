import { createWitnessScene } from "../src/scenes/witness/chase3d-witness.ts";
import { allRecipes, recipeFor } from "../src/scenes/witness/venue-recipes.ts";
import type { Arrival } from "../src/scenes/witness/witness-scene.ts";

const venue = document.getElementById("venue") as HTMLSelectElement;
const detail = document.getElementById("detail") as HTMLSelectElement;
const arrival = document.getElementById("arrival") as HTMLSelectElement;
const hour = document.getElementById("hour") as HTMLInputElement;
const time = document.getElementById("time") as HTMLInputElement;
const note = document.getElementById("note")!;
allRecipes().forEach(r => venue.add(new Option(r.id.replaceAll("_", " "), r.id)));
type PreviewHandle = Awaited<ReturnType<typeof createWitnessScene>>;
let handle: PreviewHandle | undefined, controller: AbortController | undefined, generation = 0;

declare global {
  interface Window { witnessPreview: { ready: Promise<void>; handle: () => PreviewHandle | undefined; start: () => Promise<void> } }
}
window.witnessPreview = { ready: Promise.resolve(), handle: () => handle, start };

async function start() {
  const token = ++generation;
  controller?.abort(); handle?.dispose(); handle = undefined;
  const pending = new AbortController(); controller = pending;
  const canvas = document.createElement("canvas"); canvas.id = "c";
  document.getElementById("c")!.replaceWith(canvas);
  note.textContent = "Loading...";
  try {
    const recipe = recipeFor(venue.value)!;
    const next = await createWitnessScene(canvas, {
      recipe, arrival: arrival.value as Arrival, hour: Number(hour.value), quality: "high", models: detail.value === "full",
      text: "The person you are looking for bought a ticket and left towards the north. They wore a red cap and carried a small leather bag.",
      venueName: venue.selectedOptions[0]!.text, preset: { ...recipe.witnesses[0]!, avatar_id: "avatar-01" }, sound: false, signal: pending.signal,
      onFrame: () => {}, onFault: why => { note.textContent = why; }
    });
    if (token !== generation) { next.dispose(); return; }
    handle = next;
    await next.scene.whenReadyAsync();
    if (token !== generation) return;
    next.seek(Number(time.value));
    note.textContent = "Ready";
  } catch (error) {
    if (pending.signal.aborted) return;
    console.error("Witness preview failed.", error); note.textContent = String(error);
  }
}
const rebuild = () => { window.witnessPreview.ready = start(); };
venue.onchange = detail.onchange = arrival.onchange = hour.onchange = rebuild;
document.getElementById("inspect")!.onclick = () => handle?.seek(Number(time.value));
document.getElementById("play")!.onclick = () => { void handle?.start(Number(time.value)); };
rebuild();
