// Development-only page (web/dev-garage.html): runs the real garage scene with the generated models, without needing to play through
// the game to reach it.
import { createGarageScene, type GarageHandle } from "../src/scenes/garage/chase3d-garage.ts";
import { MODELS } from "../src/scenes/shared/model-manifest.ts";
import type { AvatarPreset } from "../src/avatar/avatar-model.ts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("c");
const presets: AvatarPreset[] = Object.keys(MODELS).filter(k => k.startsWith("avatar_")).map(k => {
  const n = k.slice(7, 9);
  return {
    avatar_id: `avatar-${n}`, label: k, presentation: Number(n) % 2 ? "feminine" : "masculine", skin_tone: "brown", skin_color: "#6e4630", hair_style: "close_crop",
    hair_color: "#1a1410", uniform_primary: "#176B4D", uniform_secondary: "#F4E8C1", uniform_accent: "#E5B94B"
  };
});
const select = $<HTMLSelectElement>("avatar");
presets.forEach(p => select.add(new Option(p.label, p.avatar_id)));
const params = new URLSearchParams(location.search);
if (params.get("avatar")) select.value = params.get("avatar")!;

let handle: GarageHandle | null = null;
async function start(startSeconds?: number) {
  handle?.dispose();
  $("note").textContent = "Loading…";
  const preset = presets.find(p => p.avatar_id === select.value)!;
  handle = await createGarageScene(canvas, { preset, hour: 12, quality: "high", models: true, onGlass: () => undefined, startSeconds });
  $("note").textContent = "";
}
$("intro").onclick = () => { void start(); };
$("settled").onclick = () => { void start(3); };
$("drive").onclick = async () => { await start(3); await handle!.leave?.("drive"); };
$("hitch").onclick = async () => { await start(3); await handle!.leave?.("hitch"); };
select.onchange = () => { void start(3); };
void start(params.has("settled") ? 3 : undefined);
