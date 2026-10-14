import type { AvatarPreset } from "../src/avatar/avatar-model.ts";
import type { SceneHandle } from "../src/scenes/shared/chase3d-stage.ts";
import type { PanelHandle, Vote } from "../src/scenes/panel/panel-scene.ts";

const sceneChoice = document.querySelector<HTMLSelectElement>("#scene")!;
const detailChoice = document.querySelector<HTMLSelectElement>("#detail")!;
const avatarChoice = document.querySelector<HTMLSelectElement>("#avatar")!;
const hourInput = document.querySelector<HTMLInputElement>("#hour")!;
const timeInput = document.querySelector<HTMLInputElement>("#time")!;
const status = document.querySelector<HTMLElement>("#status")!;
let canvas = document.querySelector<HTMLCanvasElement>("#scene-canvas")!;
let handle: SceneHandle | PanelHandle | undefined;
let controller: AbortController | undefined;
let generation = 0;

for (let n = 1; n <= 10; n++) avatarChoice.add(new Option(`Avatar ${n}`, `avatar-${String(n).padStart(2, "0")}`));

function preset(): AvatarPreset {
  const feminine = Number(avatarChoice.value.slice(-2)) % 2 === 1;
  return {
    avatar_id: avatarChoice.value, label: "Preview investigator", presentation: feminine ? "feminine" : "masculine",
    skin_tone: "medium brown", hair_style: feminine ? "short_locs" : "low_cut",
    skin_color: "#7d5138", hair_color: "#191411", uniform_primary: "#176b4d", uniform_secondary: "#f2ebd8", uniform_accent: "#e8b94d"
  };
}

async function inspect() {
  const token = ++generation;
  controller?.abort();
  handle?.dispose();
  handle = undefined;
  controller = new AbortController();
  const signal = controller.signal;
  canvas = document.createElement("canvas");
  canvas.id = "scene-canvas";
  document.querySelector("#scene-canvas")!.replaceWith(canvas);
  status.textContent = "Loading…";
  const options = { preset: preset(), hour: Number(hourInput.value), quality: "high" as const, models: detailChoice.value === "full", signal };
  try {
    if (sceneChoice.value === "archive") {
      const { createArchiveScene } = await import("../src/scenes/archive/chase3d-archive.ts");
      const next = await createArchiveScene(canvas, { ...options, startSeconds: Number(timeInput.value), onGlass: () => {} });
      if (token !== generation) { next.scene.dispose(); return; }
      handle = next;
    } else {
      const { createPanelScene3D } = await import("../src/scenes/panel/chase3d-panel.ts");
      const votes: Vote[] = ["warning", "punish", "punish", "warning", "punish"];
      const next = await createPanelScene3D(canvas, { ...options, votes, onFrame: () => {}, onFault: why => { status.textContent = why; } });
      if (token !== generation) { next.dispose(); return; }
      handle = next;
      next.seek(Number(timeInput.value));
    }
    if ("scene" in handle) await handle.scene.whenReadyAsync();
    if (token === generation) status.textContent = "Ready";
  } catch (error) {
    if (signal.aborted) return;
    console.error("Model scene preview failed.", error);
    status.textContent = String(error);
  }
}

document.querySelector("#inspect")!.addEventListener("click", () => { void inspect(); });
for (const input of [sceneChoice, detailChoice, avatarChoice, hourInput]) input.addEventListener("change", () => { void inspect(); });
timeInput.addEventListener("change", () => { void inspect(); });
window.addEventListener("pagehide", () => { controller?.abort(); handle?.dispose(); }, { once: true });
void inspect();
