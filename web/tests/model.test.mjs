import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const src = new URL("../src/", import.meta.url);
const read = file => fs.readFileSync(new URL(file, src), "utf8");
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const sourceFiles = walk(new URL(".", src).pathname);
const css = sourceFiles.filter(f => f.endsWith(".css")).map(f => fs.readFileSync(f, "utf8")).join("\n");

test("accessible shell and responsive safeguards are present", () => {
  assert.match(read("components/Shell.svelte"), /Skip to investigation/);
  assert.match(read("components/Shell.svelte"), /id="main"/);
  assert.match(read("components/Toasts.svelte"), /aria-live="polite"/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 960px\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /data-contrast="high"/);
});

test("browser never receives hidden engine fields through its public model", () => {
  const model = read("model.ts");
  for (const hidden of ["thief_id:", "route:", "observations:", "hideout_venue:"]) assert.doesNotMatch(model, new RegExp(hidden));
});

test("Svelte is the UI foundation without a premature 3d dependency", () => {
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.ok(pkg.dependencies.svelte);
  assert.ok(pkg.devDependencies["@sveltejs/vite-plugin-svelte"]);
  assert.match(read("components/Shell.svelte"), /class="app"/);
  assert.equal(pkg.dependencies["@babylonjs/core"], undefined);
  assert.equal(pkg.dependencies["pixi.js"], undefined);
});

test("every case screen is a component wired into the app", () => {
  const app = read("App.svelte");
  for (const name of ["Landing", "AuthPanel", "CaseDesk", "Investigate", "Notebook", "Dossier", "Travel", "Warrant", "Results", "Settings"]) {
    assert.ok(fs.existsSync(new URL(`components/${name}.svelte`, src)), `${name} component missing`);
    assert.match(app, new RegExp(`<${name} \\{app\\}`), `${name} is not rendered`);
  }
  assert.match(app, /svelte:boundary/);
});

test("components submit intent only: no engine truth is computed or stored in the browser", () => {
  // Only the closed-case archive may show a thief id; it is public once a case is finished.
  const code = sourceFiles.filter(f => /components|lib/.test(f) && !f.endsWith("Archive.svelte")).map(f => fs.readFileSync(f, "utf8")).join("\n");
  for (const hidden of ["thief_id", "hideout_venue", "observations", "route:"]) assert.doesNotMatch(code, new RegExp(hidden));
  assert.doesNotMatch(code, /localStorage\.setItem\("nc-(case|name|notes)/);
  assert.doesNotMatch(code, /innerHTML|\{@html/);
});

test("every icon used by a component exists in the icon set", () => {
  const icons = read("components/Icon.svelte");
  const defined = new Set([...icons.matchAll(/^\s+(\w+): "/gm)].map(m => m[1]));
  const used = new Set();
  for (const f of sourceFiles.filter(f => f.endsWith(".svelte") || f.endsWith(".ts"))) {
    const text = fs.readFileSync(f, "utf8");
    for (const m of text.matchAll(/<Icon name="(\w+)"/g)) used.add(m[1]);
    for (const m of text.matchAll(/icon: ?"(\w+)"/g)) used.add(m[1]);
  }
  for (const name of used) assert.ok(defined.has(name), `icon "${name}" is not defined`);
  assert.ok(used.size > 10);
});

test("password recovery is available without exposing account existence", () => {
  const panel = read("components/AuthPanel.svelte");
  const controller = read("lib/app.svelte.ts");
  assert.match(panel, /Forgot password\?/);
  assert.match(panel, /requestPasswordReset\(email\)/);
  assert.match(panel, /completePasswordReset\(resetToken,password,confirm\)/);
  assert.match(panel, /If an account exists/);
  assert.match(controller, /params\.get\("reset"\)/);
  assert.match(controller, /requestRecovery\(\{ email \}\)/);
  assert.match(controller, /completeRecovery\(\{ token/);
  assert.doesNotMatch(controller, /localStorage\.setItem\([^\n]*password/);
});
