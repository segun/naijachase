import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const src = new URL("../src/", import.meta.url);
const read = file => fs.readFileSync(new URL(file, src), "utf8");
import { component, sourceFiles } from "./helpers.mjs";
const css = sourceFiles.filter(f => f.endsWith(".css")).map(f => fs.readFileSync(f, "utf8")).join("\n");

test("accessible shell and responsive safeguards are present", () => {
  assert.match(read("ui/Shell.svelte"), /Skip to investigation/);
  assert.match(read("ui/Shell.svelte"), /id="main"/);
  assert.match(read("ui/Toasts.svelte"), /aria-live="polite"/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 960px\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /data-contrast="high"/);
});

test("browser never receives hidden engine fields through its public model", () => {
  const model = read("domain/model.ts");
  for (const hidden of ["thief_id:", "route:", "observations:", "hideout_venue:"]) assert.doesNotMatch(model, new RegExp(hidden));
});

test("Svelte is the UI foundation and Babylon.js stays out of the initial bundle", () => {
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.ok(pkg.dependencies.svelte);
  assert.ok(pkg.devDependencies["@sveltejs/vite-plugin-svelte"]);
  assert.match(read("ui/Shell.svelte"), /class="app"/);
  assert.ok(pkg.dependencies["@babylonjs/core"], "Babylon.js is the 3D renderer");
  assert.equal(pkg.dependencies["pixi.js"], undefined);
});

test("Babylon.js is only reachable through a dynamic import", () => {
  const offenders = sourceFiles.filter(f => /\.(ts|svelte)$/.test(f) && !/[\\/]scenes[\\/].+\.ts$|[\\/]avatar[\\/]avatar3d\.ts$/.test(f))
    .filter(f => /(?:^|\n)\s*import[^\n]*@babylonjs/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(offenders, [], "only the TypeScript modules under scenes/ and avatar/avatar3d.ts may import @babylonjs");
  assert.match(read("scenes/chase/ChaseStage.svelte"), /import\("\.\/chase3d\.ts"\)/);
  assert.doesNotMatch(read("scenes/chase/ChaseStage.svelte"), /^\s*import\s+(?!type\b)[^\n]*chase3d/m);
  assert.doesNotMatch(read("scenes/chase/chase3d.ts"), /from "@babylonjs\/core"/, "use deep imports so unused features are tree-shaken");
});

test("every case screen is a component wired into the app", () => {
  const app = read("App.svelte");
  for (const name of ["Landing", "AuthPanel", "Room", "CaseTerminal", "Notebook", "Dossier", "Travel", "Warrant", "Results", "Settings"]) {
    assert.ok(component(name).length > 0, `${name} component missing`);
    const wired = ["CaseTerminal", "Notebook", "Dossier", "Travel", "Warrant"].includes(name) ? app + read("scenes/office/Room.svelte") + read("scenes/office/CaseTerminal.svelte") : app;
    assert.match(wired, new RegExp(`<${name} \\{app\\}|/${name}\\.svelte`), `${name} is not wired in`);
  }
  assert.match(app, /svelte:boundary/);
});

test("components submit intent only: no engine truth is computed or stored in the browser", () => {
  // Only the closed-case archive (public once a case is finished) and the restricted content dashboard may show a thief id.
  const code = sourceFiles.filter(f => !/[\\/]styles[\\/]|\.css$/.test(f) && !/Archive\.svelte$|ContentDashboard\.svelte$/.test(f)).map(f => fs.readFileSync(f, "utf8")).join("\n");
  for (const hidden of ["thief_id", "hideout_venue", "observations", "route:"]) assert.doesNotMatch(code, new RegExp(hidden));
  assert.doesNotMatch(code, /localStorage\.setItem\("nc-(case|name|notes)/);
  assert.doesNotMatch(code, /innerHTML|\{@html/);
});

test("every icon used by a component exists in the icon set", () => {
  const icons = read("ui/Icon.svelte");
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
  const panel = read("screens/entry/AuthPanel.svelte");
  const controller = read("state/app.svelte.ts");
  assert.match(panel, /Forgot password\?/);
  assert.match(panel, /requestPasswordReset\(email\)/);
  assert.match(panel, /completePasswordReset\(resetToken,password,confirm\)/);
  assert.match(panel, /If an account exists/);
  assert.match(controller, /params\.get\("reset"\)/);
  assert.match(controller, /requestRecovery\(\{ email \}\)/);
  assert.match(controller, /completeRecovery\(\{ token/);
  assert.doesNotMatch(controller, /localStorage\.setItem\([^\n]*password/);
});

test("email confirmation supports pending login, expired links, and safe resend", () => {
  const panel = read("screens/entry/AuthPanel.svelte");
  const controller = read("state/app.svelte.ts");
  const api = read("api/api.ts");
  assert.match(panel, /Resend confirmation email/);
  assert.match(panel, /app\.confirmationLinkInvalid/);
  assert.match(controller, /e\.code === "invalid_confirmation"/);
  assert.match(controller, /e\.code !== "email_unconfirmed"/);
  assert.match(controller, /resendConfirmation\(email\)/);
  assert.match(api, /\/v1\/auth\/confirmation\/resend/);
  assert.doesNotMatch(panel + controller, /localStorage[^\n]*(confirm|token)/i);
});
