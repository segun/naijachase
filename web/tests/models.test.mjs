import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { MODELS, ASSET_ROOT, ASSET_VERSION, avatarModelId, baseYaw, measureOf, modelSpec, modelUrl } from "../src/scenes/shared/model-manifest.ts";
import { assetVersion } from "../dev/asset-version.mjs";

const assetDir = new URL("../public/assets/3d/", import.meta.url);

test("every model has a sensible size, a unique file and a .glb path", () => {
  const files = new Set();
  for (const [id, spec] of Object.entries(MODELS)) {
    assert.match(spec.file, /^[a-z0-9_/]+\.glb$/, `${id}: file name is lower case with underscores`);
    assert.ok(spec.size > 0 && spec.size < 200, `${id}: size in metres`);
    assert.ok(!files.has(spec.file), `${id}: file used twice`);
    files.add(spec.file);
    assert.equal(spec.file.split("/").pop(), `${id}.glb`, `${id}: the id is the file name`);
  }
  assert.equal(modelUrl(MODELS.car_player_runabout), `${ASSET_ROOT}vehicles/car_player_runabout.glb?v=${ASSET_VERSION}`);
});

test("production model URLs use a stable content-derived cache version", () => {
  const version = assetVersion(new URL("../public/assets/3d", import.meta.url).pathname);
  assert.match(version, /^[a-f0-9]{20}$/);
  assert.match(modelUrl(MODELS.car_player_runabout), /\.glb\?v=[a-zA-Z0-9]+$/);
  const vite = fs.readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
  assert.match(vite, /__NAIJACHASE_3D_ASSET_VERSION__/);
  assert.match(vite, /assetVersion\(\)/);
});

test("the ten avatar picker ids map onto their model files", () => {
  for (let n = 1; n <= 10; n++) {
    const id = avatarModelId(`avatar-${String(n).padStart(2, "0")}`);
    assert.ok(id, `avatar ${n} has a model`);
    assert.equal(modelSpec(id).kind, "person");
  }
  assert.equal(avatarModelId("avatar-99"), null);
  assert.equal(avatarModelId("something-else"), null);
});

test("avatars are the heights the prompts asked for", () => {
  assert.equal(modelSpec(avatarModelId("avatar-01")).size, 1.65);
  assert.equal(modelSpec(avatarModelId("avatar-02")).size, 1.78);
});

test("the masked thief is registered at human scale with in-place walk and run exports", () => {
  const spec = modelSpec("masked_thief");
  assert.equal(spec.file, "characters/chase/masked_thief.glb");
  assert.equal(spec.kind, "person");
  assert.equal(spec.size, 1.78);
  const bytes = fs.readFileSync(new URL(spec.file, assetDir));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, "GLB header");
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8"));
  const names = gltf.animations.map(a => a.name.toLowerCase());
  assert.ok(names.includes("walk"));
  assert.ok(names.includes("run"));
  assert.ok(gltf.skins.length > 0, "humanoid skeleton included");
});

test("the chase police export includes both required movements and checked human sizing", () => {
  const spec = modelSpec("crowd_police");
  assert.equal(spec.size, 1.72);
  assert.equal(spec.checked, true);
  assert.equal(modelSpec("masked_thief").checked, true);
  const bytes = fs.readFileSync(new URL(spec.file, assetDir));
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
  assert.deepEqual(gltf.animations.map(a => a.name.toLowerCase()).sort(), ["run", "walk"]);
});

const onDisk = () => {
  const out = [];
  const walk = (dir, prefix) => fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    if (e.isDirectory()) walk(new URL(e.name + "/", dir), prefix + e.name + "/");
    else if (e.name.endsWith(".glb")) out.push(prefix + e.name);
  });
  walk(assetDir, "");
  return out.sort();
};

test("every GLB on disk has a manifest entry and every entry has its file (held items are not made yet)", t => {
  if (!fs.existsSync(assetDir)) return t.skip("no assets folder in this checkout");
  const listed = new Set(Object.values(MODELS).map(s => s.file));
  const files = onDisk();
  assert.deepEqual(files.filter(f => !listed.has(f)), [], "files with no manifest entry: add them to model-manifest.ts");
  const missing = [...listed].filter(f => !files.includes(f));
  assert.deepEqual(missing, [], "manifest entries with no file");
});

test("the folder tells the kind, and sizes are sensible for it", () => {
  const limits = { person: [1, 2.1], animal: [0.2, 3], item: [0.05, 0.5], room: [4, 20] };
  for (const [id, spec] of Object.entries(MODELS)) {
    if (spec.file.startsWith("characters/")) assert.equal(spec.kind, "person", id);
    if (spec.file.startsWith("animals/")) assert.equal(spec.kind, "animal", id);
    if (spec.file.startsWith("vehicles/")) assert.equal(spec.kind, "vehicle", id);
    if (spec.file.startsWith("interiors/items/")) assert.equal(spec.kind, "item", id);
    const [lo, hi] = limits[spec.kind] ?? [0.05, 200];
    assert.ok(spec.size >= lo && spec.size <= hi, `${id}: ${spec.size} m is outside ${lo}-${hi} for a ${spec.kind}`);
  }
});

test("how a model is measured and turned follows its kind", () => {
  assert.equal(measureOf(MODELS.car_player_runabout), "length");
  assert.equal(measureOf(MODELS.avatar_01_emerald_braids), "height");
  assert.equal(measureOf(MODELS.office_room), "length");
  assert.equal(measureOf(MODELS.lagos_bridge), "length", "a bridge is measured along its span");
  assert.equal(measureOf(MODELS.lagos_palm), "height");
  assert.equal(baseYaw(MODELS.car_player_runabout), 0);
  assert.equal(baseYaw(MODELS.church_main), Math.PI);
  assert.equal(MODELS.office_room.size, 8.8, "the cutaway rooms are the width of the scenes' shared room");
  assert.equal(MODELS.office_chair.yaw, -Math.PI / 2, "the generated chair needs a quarter-turn to put its backrest behind the seated avatar");
  assert.equal(baseYaw(MODELS.office_chair) + MODELS.office_chair.yaw, Math.PI / 2, "the chair's fitted facing includes the base prop turn");
});

test("model code reaches Babylon.js only from the scene modules", () => {
  const root = new URL("../src/", import.meta.url);
  const loader = fs.readFileSync(new URL("scenes/shared/chase3d-models.ts", root), "utf8");
  assert.match(loader, /import\("@babylonjs\/loaders\/glTF\/2\.0"\)/, "the glTF loader is imported lazily");
  assert.doesNotMatch(fs.readFileSync(new URL("scenes/shared/model-manifest.ts", root), "utf8"), /babylonjs/, "the manifest is pure data");
});

test("generated models are only requested at the Full detail level", () => {
  const src = new URL("../src/", import.meta.url);
  const read = p => fs.readFileSync(new URL(p, src), "utf8");
  assert.match(read("scenes/shared/chase3d-stage.ts"), /options\.models && preset \? avatarModelId/, "stage avatars");
  assert.match(read("scenes/garage/chase3d-garage.ts"), /options\.models \? await loadModel/, "the garage car");
  assert.match(read("scenes/office/chase3d-room.ts"), /options\.models \? await loadModel/, "office furniture");
  assert.match(read("avatar/avatar3d.ts"), /options\.models \? avatarModelId/, "picker previews");
  // loadModel may only be called from these guarded places
  const callers = [];
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => { const f = new URL(e.name + (e.isDirectory() ? "/" : ""), d); if (e.isDirectory()) walk(f); else if (/\.(ts|svelte)$/.test(e.name) && /\bloadModel\(/.test(fs.readFileSync(f, "utf8"))) callers.push(e.name); });
  walk(src);
  assert.match(read("scenes/chase/chase3d.ts"), /if \(options\.models\) await Promise\.all/);
  assert.match(read("scenes/chase/chase3d-world.ts"), /ready: models \? setup\(\) : Promise\.resolve\(\)/);
  assert.match(read("scenes/witness/chase3d-witness.ts"), /if \(options\.models\) \{\s*await Promise\.all/);
  assert.match(read("scenes/witness/chase3d-open-air-kit.ts"), /if \(options\.models && group\)/);
  assert.match(read("scenes/witness/chase3d-buildings-kit.ts"), /if \(options\.models && current/);
  assert.match(read("scenes/journey/chase3d-journey.ts"), /if \(options\.models\) \{\s*await Promise\.all/);
  assert.deepEqual(callers.sort(), ["avatar3d.ts", "chase3d-garage.ts", "chase3d-journey.ts", "chase3d-model-actor.ts", "chase3d-models.ts", "chase3d-panel.ts", "chase3d-room.ts", "chase3d-stage.ts", "chase3d-witness-models.ts", "chase3d-witness.ts", "chase3d-world.ts"], "add the models guard when a new scene loads a model");
});

test("scenes follow the picture-detail setting and can switch while playing", () => {
  const src = new URL("../src/", import.meta.url);
  const read = p => fs.readFileSync(new URL(p, src), "utf8");
  for (const f of ["scenes/witness/WitnessScene.svelte", "scenes/journey/JourneyScene.svelte", "scenes/panel/PanelScene.svelte"]) {
    const view = read(f);
    assert.match(view, /detail\.resolved/, f);
    assert.match(view, /const mode = \$derived/, `${f}: the renderer follows the setting`);
    assert.match(view, /data-key=\{canvasKey\}/, `${f}: a new canvas for a new renderer or detail`);
  }
  assert.match(read("scenes/shared/Stage.svelte"), /detailKey\(applied\)/);
  assert.match(read("App.svelte"), /<DetailQuick/, "the quick switch is available in the game");
  assert.match(read("screens/account/Settings.svelte"), /<DetailControl/, "and in Settings");
});

test("the office replaces nine separate furniture models without losing its terminal or procedural fallbacks", () => {
  const room = fs.readFileSync(new URL("../src/scenes/office/chase3d-room.ts", import.meta.url), "utf8");
  const ids = [...room.matchAll(/replace\("(office_[a-z_]+)"/g)].map(m => m[1]).sort();
  assert.deepEqual(ids, ["office_chair", "office_corkboard", "office_desk", "office_filing_cabinet", "office_lamp", "office_monitor", "office_papers", "office_plant", "office_window"]);
  ids.forEach(id => assert.equal(MODELS[id].checked, true, `${id}: fitted and checked in the office`));
  assert.notEqual(MODELS.office_room.checked, true, "the unused baked room is not marked scene-checked");
  assert.doesNotMatch(room, /loadModel\([^)]*"office_room"/, "the baked room would duplicate furniture and obstruct the door");
  assert.match(room, /try \{ replacement\.apply\(model\); replacement\.hide\(\); \}/, "hide a fallback only after its replacement is fitted");
  assert.match(room, /const figure = glb \? null : stage\.addFigure/, "a failed avatar still has a procedural figure");
  assert.match(room, /glb\.apply\(p, t, hands\)/, "typing uses the same timeline and keyboard targets");
  assert.match(room, /plane\("screenGlass"/, "the terminal glass stays at the tested camera anchor");
  assert.match(room, /options\.signal\?\.addEventListener\("abort", abort/, "cancel abandoned model-backed setup");
});
