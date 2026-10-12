import { createRoomScene, type RoomHandle } from "../src/scenes/office/chase3d-room.ts";
import { T_RETURN_FROM, wideShot, poseAt } from "../src/scenes/office/room-scene.ts";
import { MODELS } from "../src/scenes/shared/model-manifest.ts";
import type { AvatarPreset } from "../src/avatar/avatar-model.ts";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import "@babylonjs/core/Culling/ray";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("c");
const select = $<HTMLSelectElement>("avatar");
const detail = $<HTMLSelectElement>("detail");
const presets: AvatarPreset[] = Object.keys(MODELS).filter(k => k.startsWith("avatar_")).map(k => {
  const n = k.slice(7, 9);
  return {
    avatar_id: `avatar-${n}`, label: k, presentation: Number(n) % 2 ? "feminine" : "masculine", skin_tone: "brown", skin_color: "#6e4630", hair_style: "close_crop",
    hair_color: "#1a1410", uniform_primary: "#176B4D", uniform_secondary: "#F4E8C1", uniform_accent: "#E5B94B"
  };
});
presets.forEach(p => select.add(new Option(p.label, p.avatar_id)));
const params = new URLSearchParams(location.search);
select.value = params.get("avatar") ?? "avatar-01";
detail.value = params.get("detail") ?? "full";
let handle: RoomHandle | undefined;
let generation = 0;
let controller: AbortController | undefined;
declare global {
  interface Window { officePreview: { scene: () => RoomHandle["scene"] | undefined } }
}
window.officePreview = { scene: () => handle?.scene };

async function start(startSeconds = 0, inspect = false) {
  const token = ++generation;
  controller?.abort();
  const pending = new AbortController(); controller = pending;
  handle?.dispose(); handle = undefined;
  $("note").textContent = "Loading...";
  try {
    const h = await createRoomScene(canvas, {
      signal: pending.signal,
      preset: presets.find(p => p.avatar_id === select.value), hour: 12, quality: "high",
      models: detail.value === "full", startSeconds, onGlass: () => undefined
    });
    if (token !== generation) { h.dispose(); return; }
    handle = h;
    if (inspect) {
      await new Promise<void>(resolve => h.scene.onAfterRenderObservable.addOnce(() => resolve()));
      await h.play({ end: startSeconds, update: () => undefined }, startSeconds);
      const camera = h.scene.activeCamera!;
      const shot = wideShot(0, poseAt(startSeconds));
      camera.position.set(...shot.position);
      if (camera instanceof FreeCamera) camera.setTarget(new Vector3(...shot.target));
      h.scene.render();
    }
    $("note").textContent = inspect ? "Paused for inspection" : "";
  } catch (error) {
    if (pending.signal.aborted) return;
    console.error("Office preview failed.", error);
    if (token === generation) $("note").textContent = String(error);
  }
}
$("intro").onclick = () => { void start(); };
$("return").onclick = () => { void start(T_RETURN_FROM); };
$("leave").onclick = async () => { await start(60); await handle?.leave?.(); };
$("inspect").onclick = () => { void start(Number($<HTMLInputElement>("time").value), true); };
select.onchange = () => { void start(Number($<HTMLInputElement>("time").value), true); };
detail.onchange = () => { void start(handle?.now() ?? 0); };
void start(params.has("time") ? Number(params.get("time")) : 0, params.has("time"));
