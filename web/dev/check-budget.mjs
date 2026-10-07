// Reports the initial payload (what index.html loads) against a size target.
// The target is advisory: the game will keep growing, so exceeding it warns but never fails the build.
// Lazily loaded chunks, such as the menu-music synthesiser, are reported but not counted.
import fs from "node:fs";
import zlib from "node:zlib";

const TARGET = { js: 50 * 1024, css: 10 * 1024 };
const dist = new URL("../dist/", import.meta.url);
const html = fs.readFileSync(new URL("index.html", dist), "utf8");
const gz = file => zlib.gzipSync(fs.readFileSync(new URL(file.replace(/^\//, ""), dist))).length;

const initial = { js: 0, css: 0 };
for (const [, file] of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
  if (file.endsWith(".js")) initial.js += gz(file);
  else if (file.endsWith(".css")) initial.css += gz(file);
}
const lazy = fs.readdirSync(new URL("assets/", dist)).filter(f => f.endsWith(".js") && !html.includes(f))
  .reduce((sum, f) => sum + gz(`assets/${f}`), 0);

let over = false;
for (const [ext, limit] of Object.entries(TARGET)) {
  console.log(`${ext.toUpperCase()}: ${(initial[ext] / 1024).toFixed(1)} KiB gzip (target ${limit / 1024} KiB)`);
  if (initial[ext] > limit) over = true;
}
console.log(`Lazy JS: ${(lazy / 1024).toFixed(1)} KiB gzip`);
if (over) console.warn("Above the advisory size target. Review for avoidable weight, but this does not fail the build.");
