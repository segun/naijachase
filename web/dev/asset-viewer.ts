// Development-only page (web/dev-assets.html, not part of the game bundle): loads the GLB files in public/assets/3d, plays their
// animations and checks them against what the game expects, so a bad file is caught before it is used in a scene.
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateDisc } from "@babylonjs/core/Meshes/Builders/discBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { MODELS, baseYaw, measureOf, type ModelSpec } from "../src/scenes/shared/model-manifest.ts";
import type { Vector3 as V3 } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/core/Animations/animatable";
import "@babylonjs/core/Materials/PBR/pbrMaterial";
import "@babylonjs/loaders/glTF/2.0";

type Entry = { path: string; bytes: number };
type Verdict = "ok" | "warn" | "bad";
type Check = { v: Verdict; title: string; detail?: string };
type Loaded = { label: string; container: AssetContainer; holder: TransformNode; groups: AnimationGroup[]; joints: string[]; rawHeight: number };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const GAME_HEIGHT = 1.75;
const AVATARS = [
  "avatar_01_emerald_braids", "avatar_02_midnight_low_cut", "avatar_03_burgundy_wrap", "avatar_04_forest_coils", "avatar_05_cobalt_bob",
  "avatar_06_copper_fade", "avatar_07_teal_twists", "avatar_08_gold_crop", "avatar_09_plum_locs", "avatar_10_slate_waves"
];

const canvas = $<HTMLCanvasElement>("c");
const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false });
const scene = new Scene(engine);
scene.clearColor = new Color4(0.08, 0.14, 0.12, 1);
const camera = new ArcRotateCamera("cam", -Math.PI / 2, Math.PI / 2.3, 4, new Vector3(0, 0.9, 0), scene);
camera.attachControl(canvas, true);
camera.lowerRadiusLimit = 0.5; camera.wheelPrecision = 60; camera.minZ = 0.05;
const hemi = new HemisphericLight("hemi", new Vector3(0, 1, -0.3), scene); hemi.intensity = 0.95;
const sun = new DirectionalLight("sun", new Vector3(-0.4, -1, 0.6), scene); sun.intensity = 0.7;

const grey = (name: string, c: string, alpha = 1) => { const m = new StandardMaterial(name, scene); m.diffuseColor = Color3.FromHexString(c); m.specularColor = Color3.Black(); m.alpha = alpha; return m; };
const floor = CreateDisc("floor", { radius: 6, tessellation: 64 }, scene); floor.rotation.x = Math.PI / 2; floor.material = grey("floorM", "#1c322c");
// A 1.75 m post and a nose-to-camera arrow so scale and facing can be judged by eye.
const post = CreateBox("post", { width: 0.04, height: GAME_HEIGHT, depth: 0.04 }, scene); post.position.set(-1.1, GAME_HEIGHT / 2, 0.3); post.material = grey("postM", "#d8b04a");
const arrow = CreateCylinder("arrow", { diameterTop: 0, diameterBottom: 0.16, height: 0.3, tessellation: 12 }, scene);
arrow.rotation.x = -Math.PI / 2; arrow.position.set(0, 0.01, -1.0); arrow.material = grey("arrowM", "#5fd19a");

let items: Loaded[] = [];
let refJoints: string[] | null = null;
let activeClip: string | null = null;
let spin = false;
let current: string | null = null;
let files: Entry[] = [];

const clear = () => { for (const i of items) { i.groups.forEach(g => g.stop()); i.container.dispose(); i.holder.dispose(); } items = []; };

async function loadOne(source: string | File, label: string, x: number): Promise<Loaded> {
  const spec: ModelSpec | undefined = MODELS[label.replace(/\.glb$/i, "")];
  const container = await LoadAssetContainerAsync(source, scene);
  container.addAllToScene();
  const holder = new TransformNode(`holder-${label}`, scene);
  container.rootNodes.forEach(n => { n.parent = holder; });
  const groups = [...container.animationGroups];
  groups.forEach(g => g.stop());
  const skeleton = container.skeletons[0];
  const joints = skeleton ? skeleton.bones.map(b => b.name) : [];
  const [min, max] = bounds(container);
  const raw = max.y - min.y;
  holder.metadata = { min, max, spec };
  // Shown the way the game will show it: its real size from the manifest (a file not yet listed is shown at person height) and turned to face the camera.
  const target = spec ? spec.size : GAME_HEIGHT;
  const measured = spec && measureOf(spec) === "length" ? Math.max(max.x - min.x, max.z - min.z) : raw;
  const k = measured > 0 ? target / measured : 1;
  holder.scaling.set(spec?.mirror ? -k : k, k, k);
  holder.rotation.y = spec ? baseYaw(spec) + (spec.yaw ?? 0) : kind(label) !== "prop" ? Math.PI : 0;
  holder.position.set(x, -min.y * k, 0);
  // The model's real extent, for framing the camera.
  holder.metadata = { ...holder.metadata, realHeight: raw * k, realSpan: Math.max(max.x - min.x, max.z - min.z) * k };
  return { label, container, holder, groups, joints, rawHeight: raw };
}

function bounds(container: AssetContainer): [V3, V3] {
  const min = new Vector3(1e9, 1e9, 1e9), max = new Vector3(-1e9, -1e9, -1e9);
  for (const m of container.meshes) {
    if (!m.getTotalVertices()) continue;
    m.computeWorldMatrix(true); m.refreshBoundingInfo({});
    const b = m.getBoundingInfo().boundingBox;
    min.minimizeInPlace(b.minimumWorld); max.maximizeInPlace(b.maximumWorld);
  }
  return [min, max];
}

const kind = (name: string) => /^(avatar|witness|judge|crowd)_/.test(name) ? name.split("_")[0]! : "prop";
const baseName = (path: string) => path.split("/").pop()!.replace(/\.glb$/i, "");

function check(l: Loaded, bytes: number | null): Check[] {
  const out: Check[] = [];
  const name = baseName(l.label), k = kind(name);
  const tris = l.container.meshes.reduce((n, m) => n + m.getTotalIndices() / 3, 0);
  out.push({ v: "ok", title: "The file loads" });
  if (bytes !== null) out.push(bytes > 4e6 ? { v: "bad", title: `File is big (${(bytes / 1e6).toFixed(1)} MB)`, detail: "Lower the texture to 2K and the polycount in the tool." } : bytes > 2.2e6 ? { v: "warn", title: `File is fairly big (${(bytes / 1e6).toFixed(1)} MB)` } : { v: "ok", title: `File size ${(bytes / 1e6).toFixed(2)} MB` });
  const budget = k === "prop" ? 15000 : 12000;
  out.push(tris > budget * 1.6 ? { v: "bad", title: `Too detailed: ${Math.round(tris).toLocaleString()} triangles`, detail: "Set a lower Polycount in the tool and export again." } : tris > budget ? { v: "warn", title: `${Math.round(tris).toLocaleString()} triangles (a bit high)` } : { v: "ok", title: `${Math.round(tris).toLocaleString()} triangles` });
  const sizes = l.container.textures.map(t => t.getSize());
  const biggest = Math.max(0, ...sizes.map(s => Math.max(s.width, s.height)));
  out.push(biggest > 2048 ? { v: "warn", title: `Texture is ${biggest}px`, detail: "Use 2K (2048) in the export window." } : { v: "ok", title: `${sizes.length} texture(s), largest ${biggest || "?"}px` });
  if (l.container.materials.length > 3) out.push({ v: "warn", title: `${l.container.materials.length} materials`, detail: "Fewer is faster; fine for scenes." });
  const [min, max] = [l.holder.metadata.min as V3, l.holder.metadata.max as V3];
  const w = Math.max(max.x - min.x, max.z - min.z), h = max.y - min.y;
  if (k !== "prop") {
    out.push(h > 0 && w / h > 0.7 ? { v: "warn", title: "Looks like a T-pose or wide stance", detail: "Arms very wide. Fine if it animates, but check the picture." } : { v: "ok", title: "Standing proportions look right" });
    if (!l.joints.length) out.push({ v: "bad", title: "No skeleton", detail: "Switch on “Export Skeleton” in the export window." });
    else {
      out.push({ v: "ok", title: `Skeleton with ${l.joints.length} bones` });
      if (!refJoints) refJoints = l.joints;
      const same = refJoints.length === l.joints.length && refJoints.every((j, i) => j === l.joints[i]);
      out.push(same ? { v: "ok", title: "Same skeleton as the others" } : { v: "bad", title: "Different skeleton from the first character", detail: "All characters must use the same rig so one set of movements fits them." });
    }
    const want = k === "avatar" ? ["walk", "run", "sit"] : k === "witness" || k === "crowd" ? ["walk"] : [];
    const have = l.groups.map(g => g.name.toLowerCase());
    for (const c of want) out.push(have.some(n => n.includes(c)) ? { v: "ok", title: `Has “${c}” movement` } : { v: "bad", title: `Missing “${c}” movement`, detail: "Tick it in the export window with all movements exported in one file." });
    for (const g of l.groups) {
      const hips = g.targetedAnimations.find(t => /hips$/i.test(t.target?.name ?? "") && t.animation.targetProperty === "position");
      if (!hips) continue;
      const keys = hips.animation.getKeys().map(key => key.value as V3);
      const span = Math.max(Math.max(...keys.map(v => v.x)) - Math.min(...keys.map(v => v.x)), Math.max(...keys.map(v => v.z)) - Math.min(...keys.map(v => v.z)));
      const ref = keys.reduce((s, v) => s + Math.abs(v.y), 0) / keys.length || 1;
      if (span / ref > 0.4) out.push({ v: "warn", title: `“${g.name}” travels forward`, detail: "Export with “Animation stay in Place” on, or the loop will jump." });
    }
  }
  const low = min.y, ground = Math.abs(low) / (h || 1);
  out.push(ground > 0.5 ? { v: "warn", title: "Model is not standing on the floor", detail: "The page lowers it to the floor; the game will do the same." } : { v: "ok", title: "Feet at floor level" });
  return out;
}

function showReport(l: Loaded, bytes: number | null) {
  const checks = check(l, bytes);
  const worst: Verdict = checks.some(c => c.v === "bad") ? "bad" : checks.some(c => c.v === "warn") ? "warn" : "ok";
  const verdict = { ok: "Looks good: ready to use.", warn: "Usable, with notes below.", bad: "Needs fixing before use." }[worst];
  const [min, max] = [l.holder.metadata.min as V3, l.holder.metadata.max as V3];
  $("report").innerHTML = `<h1>${l.label}</h1><div class="check ${worst}"><b>${verdict}</b></div>
    <h2>Checks</h2>${checks.map(c => `<div class="check ${c.v}">${c.title}${c.detail ? `<small>${c.detail}</small>` : ""}</div>`).join("")}
    <h2>Details</h2>
    <div class="row"><span>Raw size (units)</span><span>${(max.x - min.x).toFixed(2)} × ${(max.y - min.y).toFixed(2)} × ${(max.z - min.z).toFixed(2)}</span></div>
    <div class="row"><span>Shown at</span><span>${(l.holder.metadata.spec as ModelSpec | undefined) ? `${(l.holder.metadata.spec as ModelSpec).size} m (${measureOf(l.holder.metadata.spec as ModelSpec)}) from the manifest` : `${GAME_HEIGHT} m tall (not in the manifest yet)`}; post = 1.75 m</span></div>
    <div class="row"><span>Movements</span><span>${l.groups.map(g => g.name).join(", ") || "none"}</span></div>
    <div class="row"><span>Bones</span><span>${l.joints.length}</span></div>
    <p class="hint">The green arrow points away from the camera. A character should face the camera when you open it (arrow pointing away behind it); the game turns people round automatically.</p>`;
}

function buildBar(l: Loaded[]) {
  const bar = $("bar"); bar.innerHTML = "";
  const names = [...new Set(l.flatMap(i => i.groups.map(g => g.name)))];
  const mk = (text: string, on: boolean, fn: () => void) => { const b = document.createElement("button"); b.textContent = text; if (on) b.className = "on"; b.onclick = fn; bar.append(b); return b; };
  mk("Stand still", activeClip === null, () => play(null));
  for (const n of names) mk(n, activeClip === n, () => play(n));
  mk(spin ? "Stop turning" : "Turn around", spin, () => { spin = !spin; buildBar(items); });
  mk("Reset view", false, frame);
}

function play(clip: string | null) {
  activeClip = clip;
  for (const i of items) for (const g of i.groups) { if (clip && g.name === clip) g.start(true); else g.stop(); }
  buildBar(items);
}

function frame() {
  camera.alpha = -Math.PI / 2; camera.beta = Math.PI / 2.3;
  const n = Math.max(1, items.length);
  const height = items.reduce((m, i) => Math.max(m, i.holder.metadata.realHeight as number), GAME_HEIGHT);
  const span = items.reduce((m, i) => Math.max(m, i.holder.metadata.realSpan as number), 0) + (n - 1) * 0.9;
  const big = Math.max(height, span);
  camera.target.set(((n - 1) * 0.9) / 2, height / 2, 0);
  camera.radius = Math.max(3.6, n * 0.95 + 1.5, big * 1.7);
  camera.upperRadiusLimit = camera.radius * 6;
  camera.maxZ = Math.max(1000, big * 20);
}

async function show(source: string | File, label: string, bytes: number | null) {
  $("msg").textContent = "";
  try {
    clear();
    const l = await loadOne(source, label, 0);
    items = [l]; activeClip = null;
    showReport(l, bytes); buildBar(items); frame();
  } catch (e) {
    $("report").innerHTML = ""; $("msg").textContent = `Could not open ${label}.\n${e instanceof Error ? e.message : String(e)}\n\nTry exporting it again as GLB.`;
  }
}

async function showAvatars() {
  const found = AVATARS.map(n => files.find(f => baseName(f.path) === n)).filter((f): f is Entry => !!f);
  if (!found.length) return;
  $("msg").textContent = "Loading all avatars…";
  try {
    clear();
    for (let i = 0; i < found.length; i++) items.push(await loadOne(found[i]!.path, baseName(found[i]!.path), i * 0.9));
    activeClip = null; $("msg").textContent = "";
    const summary = items.map((l, i) => { const c = check(l, found[i]!.bytes); const worst = c.some(x => x.v === "bad") ? "bad" : c.some(x => x.v === "warn") ? "warn" : "ok"; return `<div class="check ${worst}">${l.label}</div>`; }).join("");
    $("report").innerHTML = `<h1>All avatars side by side</h1><p class="hint">Use the buttons to make everyone walk, run or sit together. Click a name in the list to inspect one.</p>${summary}`;
    buildBar(items); frame();
  } catch (e) { $("msg").textContent = `Could not load all avatars.\n${e instanceof Error ? e.message : String(e)}`; }
}

function renderList() {
  const list = $("list"); list.innerHTML = "";
  if (!files.length) list.innerHTML = `<p class="hint">No GLB files found yet.</p>`;
  const all = document.createElement("button"); all.className = "file"; all.textContent = "▶ All avatars side by side"; all.onclick = () => { current = null; renderList(); void showAvatars(); };
  if (files.some(f => baseName(f.path).startsWith("avatar_"))) list.append(all);
  let group = "";
  for (const f of files) {
    const g = f.path.replace("/assets/3d/", "").split("/").slice(0, -1).join("/");
    if (g !== group) { group = g; const h = document.createElement("h2"); h.textContent = g || "(root)"; list.append(h); }
    const b = document.createElement("button"); b.className = "file" + (f.path === current ? " sel" : "");
    b.innerHTML = `${baseName(f.path)} <small>${(f.bytes / 1e6).toFixed(1)} MB</small>`;
    b.onclick = () => { current = f.path; renderList(); void show(f.path, baseName(f.path), f.bytes); };
    list.append(b);
  }
  const have = new Set(files.map(f => baseName(f.path)));
  const todo = AVATARS.filter(n => !have.has(n));
  $("missing").innerHTML = todo.length ? todo.map(n => `<div class="missing">${n}.glb</div>`).join("") : `<div class="hint">All 10 avatars are here.</div>`;
}

async function refresh() {
  try { files = await (await fetch("/__assets-list", { cache: "no-store" })).json() as Entry[]; } catch { files = []; }
  renderList();
}

$("refresh").onclick = () => { void refresh(); };
$("pick").onclick = () => $<HTMLInputElement>("file").click();
$<HTMLInputElement>("file").onchange = e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) { current = null; renderList(); void show(f, f.name.replace(/\.glb$/i, ""), f.size); } };
addEventListener("dragover", e => { e.preventDefault(); document.body.classList.add("dragging"); });
addEventListener("dragleave", () => document.body.classList.remove("dragging"));
addEventListener("drop", e => { e.preventDefault(); document.body.classList.remove("dragging"); const f = e.dataTransfer?.files[0]; if (f && /\.glb$/i.test(f.name)) { current = null; renderList(); void show(f, f.name.replace(/\.glb$/i, ""), f.size); } });

scene.onBeforeRenderObservable.add(() => { if (spin) for (const i of items) i.holder.rotation.y += 0.012; });
engine.runRenderLoop(() => scene.render());
addEventListener("resize", () => engine.resize());
void refresh();
