import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawn } from "node:child_process";
import * as av from "../src/lib/avatar-model.ts";

const root = new URL("../", import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), "utf8");

// The ten presets the backend ships (rust/crates/naijachase-api), as the UI receives them.
const rows = [
  ["avatar-01", "Emerald Braids", "feminine", "deep", "#4A2B20", "braided_bun", "#18120F", "#176B4D", "#F4E8C1", "#E5B94B"],
  ["avatar-02", "Midnight Low Cut", "masculine", "rich_deep", "#5A3325", "low_cut", "#17120F", "#172B4D", "#E8EDF2", "#D8A83D"],
  ["avatar-03", "Burgundy Wrap", "feminine", "medium_deep", "#704735", "head_wrap", "#241815", "#762A45", "#F4E6D4", "#DCA94A"],
  ["avatar-04", "Forest Coils", "masculine", "deep", "#3E251D", "short_coils", "#15110F", "#244B36", "#E8DFC9", "#CB8E3B"],
  ["avatar-05", "Cobalt Bob", "feminine", "medium", "#8B5A43", "bob", "#211714", "#2457A6", "#F2E9D8", "#F0B84B"],
  ["avatar-06", "Copper Fade", "masculine", "medium_light", "#A96F50", "fade", "#2A1D18", "#A64B2A", "#F3E7D1", "#243B53"],
  ["avatar-07", "Teal Twists", "feminine", "rich_deep", "#593426", "shoulder_twists", "#191310", "#167A7A", "#E9F1E8", "#D7A83E"],
  ["avatar-08", "Gold Crop", "masculine", "light", "#C88968", "close_crop", "#33231D", "#A87916", "#FFF1CE", "#283B62"],
  ["avatar-09", "Plum Locs", "feminine", "medium_deep", "#704632", "short_locs", "#1D1512", "#65345F", "#F1E5EC", "#D7A33F"],
  ["avatar-10", "Slate Waves", "masculine", "medium", "#8C5B43", "short_waves", "#211713", "#465568", "#E8EDF0", "#B88A35"]
];
const options = rows.map(([avatar_id, label, presentation, skin_tone, skin_color, hair_style, hair_color, uniform_primary, uniform_secondary, uniform_accent]) =>
  ({ avatar_id, label, presentation, skin_tone, skin_color, hair_style, hair_color, uniform_primary, uniform_secondary, uniform_accent }));
const catalogue = { catalogue_version: 1, renderer: "babylon_procedural_v1", options };

test("the real ten-preset catalogue is accepted and variations are rejected", () => {
  assert.equal(av.catalogueProblem(catalogue), null);
  assert.match(av.catalogueProblem({ ...catalogue, catalogue_version: 2 }), /newer version/);
  assert.match(av.catalogueProblem({ ...catalogue, renderer: "gltf" }), /newer version/);
  assert.match(av.catalogueProblem({ ...catalogue, options: options.slice(1) }), /incomplete/);
  assert.match(av.catalogueProblem({ ...catalogue, options: [...options.slice(1), options[1]] }), /incomplete/);
  assert.match(av.catalogueProblem({ ...catalogue, options: options.map((o, i) => (i ? o : { ...o, skin_color: "red" })) }), /incomplete/);
  assert.ok(av.catalogueProblem(null));
});

test("every preset hairstyle maps to primitives and to silhouette shapes; unknown styles degrade", () => {
  assert.deepEqual(new Set(options.map(o => o.hair_style)), new Set(av.HAIR_STYLES));
  for (const o of options) {
    const parts = av.hairParts(o.hair_style);
    assert.ok(parts.length >= 1, o.hair_style);
    for (const p of parts) {
      assert.ok(["sphere", "capsule", "box", "cylinder"].includes(p.shape));
      assert.ok(p.size.every(v => v > 0), `${o.hair_style} has a degenerate part`);
    }
    const flat = av.hairShapes(o.hair_style);
    assert.ok(flat.front.length >= 1);
  }
  assert.deepEqual(av.hairParts("future_style"), av.hairParts("close_crop"));
  assert.deepEqual(av.hairShapes("future_style"), av.hairShapes("close_crop"));
});

test("the silhouette is drawn from the server colours only, and bad colours cannot reach the markup", () => {
  const o = options[2];
  const tints = ["hair", "skin", "primary", "secondary", "accent"];
  assert.deepEqual(tints.map(t => av.tintColor(o, t)), [o.hair_color, o.skin_color, o.uniform_primary, o.uniform_secondary, o.uniform_accent]);
  assert.equal(av.tintColor({ ...o, skin_color: '"><script>' }, "skin"), "#808080");
  const used = new Set([...av.bodyShapes(o).before, ...av.hairShapes(o.hair_style).front].map(s => s.tint));
  for (const t of ["primary", "secondary", "accent", "skin", "hair"]) assert.ok(used.has(t), `${t} unused`);
});

test("presentation only nudges proportions", () => {
  const f = av.build(options[0]), m = av.build(options[1]);
  assert.ok(f.shoulder < m.shoulder && f.shoulder > m.shoulder * 0.7);
  assert.deepEqual(Object.keys(f), Object.keys(m));
});

test("skin tone and hair are always available as text", () => {
  assert.equal(av.skinToneLabel(options[2]), "Medium deep");
  assert.equal(av.hairLabel(options[2]), "Head wrap");
});

test("weak, metered or data-saving devices get the silhouette; reduced motion still gets still previews", () => {
  const base = { viewportWidth: 390, reducedMotion: false, saveData: false, coarsePointer: true };
  assert.equal(av.avatarRenderer(base), "webgl");
  assert.equal(av.avatarRenderer({ ...base, reducedMotion: true }), "webgl");
  assert.equal(av.avatarRenderer({ ...base, saveData: true }), "silhouette");
  assert.equal(av.avatarRenderer({ ...base, connection: "2g" }), "silhouette");
  assert.equal(av.avatarRenderer({ ...base, memoryGb: 1 }), "silhouette");
});

test("the picker follows the P3.7.4 handoff: no models, no appearance fields, server IDs only", () => {
  const picker = read("src/components/AvatarPicker.svelte");
  const renderer = read("src/lib/avatar3d.ts");
  assert.doesNotMatch(picker + renderer, /\.(glb|gltf)|SceneLoader|ImportMesh|AppendAsync|LoadAssetContainer/i);
  assert.match(picker, /import\("\.\.\/lib\/avatar3d\.ts"\)/);
  assert.doesNotMatch(picker, /^\s*import\s+[^\n]*avatar3d/m);
  assert.match(read("src/api.ts"), /\{ avatar_id: avatarId \} satisfies AvatarSelectionRequest/);
  assert.match(picker, /type="radio"/);
  assert.match(picker, /role="alert"/);
  // The generic profile endpoint rejects avatar fields, so Settings must not echo them back.
  assert.doesNotMatch(read("src/components/Settings.svelte"), /avatar_id|uniform_id/);
  // Only a server-confirmed setup lets the player past the picker.
  assert.match(read("src/lib/app.svelte.ts"), /!out\.setup_complete/);
  assert.match(read("src/App.svelte"), /app\.signedIn && app\.needsAvatar/);
});

test("the mock API serves the avatar contract and gates the first login", async () => {
  const port = 19000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ["dev/mock-api.mjs"], { cwd: new URL(".", root).pathname, env: { ...process.env, PORT: String(port) } });
  try {
    await new Promise((resolve, reject) => { child.stdout.once("data", resolve); child.once("error", reject); });
    let cookie = "";
    const call = async (path, method = "GET", body) => {
      const res = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers: { "Content-Type": "application/json", cookie }, body: body && JSON.stringify(body) });
      const set = res.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0];
      return { status: res.status, data: await res.json() };
    };
    const login = await call("/v1/auth/login", "POST", { email: "a@x.com", password: "right" });
    assert.equal(login.data.player.avatar_setup_complete, false);
    const opts = await call("/v1/avatar/options");
    assert.deepEqual(opts.data, catalogue);
    assert.equal((await call("/v1/profile/avatar")).data.setup_complete, false);
    assert.equal((await call("/v1/profile/avatar", "PUT", { avatar_id: "client-invented" })).status, 400);
    assert.equal((await call("/v1/profile", "PUT", { home_base: "Lagos", avatar_id: "avatar-01" })).status, 400);
    const put = await call("/v1/profile/avatar", "PUT", { avatar_id: "avatar-03" });
    assert.deepEqual([put.data.setup_complete, put.data.selected_avatar_id, put.data.selected.label], [true, "avatar-03", "Burgundy Wrap"]);
    assert.equal((await call("/v1/auth/me")).data.player.avatar_setup_complete, true);
    assert.deepEqual((await call("/v1/profile/avatar", "PUT", { avatar_id: "avatar-03" })).data, put.data, "PUT is idempotent");
  } finally { child.kill(); }
});
