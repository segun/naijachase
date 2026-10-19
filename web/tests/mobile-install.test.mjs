import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), "utf8");

test("the web manifest supports Android and iOS home-screen launches in either orientation", () => {
  const manifest = JSON.parse(read("public/manifest.webmanifest"));
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "fullscreen");
  assert.equal(manifest.orientation, "any");
  assert.deepEqual(manifest.display_override, ["fullscreen", "standalone", "minimal-ui"]);
  for (const size of ["192x192", "512x512"]) {
    const icon = manifest.icons.find(entry => entry.sizes === size);
    assert.ok(icon, `${size} install icon`);
    assert.match(icon.purpose, /maskable/);
    assert.ok(fs.existsSync(new URL(`public${icon.src}`, root)), `${icon.src} exists`);
  }
});

test("the document advertises install mode, iOS standalone mode and safe viewport coverage", () => {
  const html = read("index.html");
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /rel="apple-touch-icon" sizes="180x180"/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /interactive-widget=resizes-content/);
});

test("mobile controls offer fullscreen, native installation and platform instructions", () => {
  const component = read("src/ui/MobileAppControls.svelte");
  const prompt = read("src/ui/install-prompt.ts");
  const shell = read("src/ui/Shell.svelte");
  assert.match(component, /requestFullscreen\(\{ navigationUI: "hide" \}\)/);
  assert.match(component, /Add to Home Screen/);
  assert.match(component, /Install app/);
  assert.match(component, /display-mode: fullscreen/);
  assert.match(prompt, /beforeinstallprompt/);
  assert.match(prompt, /appinstalled/);
  assert.match(prompt, /navigatorWithStandalone\.standalone/);
  assert.match(shell, /import\("\.\/MobileAppControls\.svelte"\)/);
  assert.match(shell, /<MobileAppControls \/>/);
});
