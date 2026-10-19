// Enforces the compressed release budgets. Keep these limits deliberate: raising
// one requires a reviewed change here and in docs/web-performance-budgets.md.
import fs from "node:fs";
import zlib from "node:zlib";

const TARGET = {
  initialJs: 60 * 1024,
  initialCss: 10 * 1024,
  lazyJsTotal: 950 * 1024,
  lazyJsChunk: 365 * 1024
};
const dist = new URL("../dist/", import.meta.url);
const html = fs.readFileSync(new URL("index.html", dist), "utf8");
const gz = file => zlib.gzipSync(fs.readFileSync(new URL(file.replace(/^\//, ""), dist))).length;

const initial = { js: 0, css: 0 };
for (const [, file] of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
  if (file.endsWith(".js")) initial.js += gz(file);
  else if (file.endsWith(".css")) initial.css += gz(file);
}
const lazyChunks = fs.readdirSync(new URL("assets/", dist))
  .filter(file => file.endsWith(".js") && !html.includes(file))
  .map(file => ({ file, bytes: gz(`assets/${file}`) }))
  .sort((a, b) => b.bytes - a.bytes);
const lazyJsTotal = lazyChunks.reduce((sum, chunk) => sum + chunk.bytes, 0);
const largestLazy = lazyChunks[0] ?? { file: "none", bytes: 0 };

const checks = [
  ["Initial JS", initial.js, TARGET.initialJs],
  ["Initial CSS", initial.css, TARGET.initialCss],
  ["Lazy JS total", lazyJsTotal, TARGET.lazyJsTotal],
  [`Largest lazy JS (${largestLazy.file})`, largestLazy.bytes, TARGET.lazyJsChunk]
];

let failed = false;
for (const [label, bytes, limit] of checks) {
  const pass = bytes <= limit;
  console.log(`${pass ? "PASS" : "FAIL"} ${label}: ${(bytes / 1024).toFixed(1)} KiB gzip (limit ${limit / 1024} KiB)`);
  failed ||= !pass;
}
console.log("Largest lazy chunks:");
for (const chunk of lazyChunks.slice(0, 10)) {
  console.log(`  ${(chunk.bytes / 1024).toFixed(1).padStart(7)} KiB  ${chunk.file}`);
}
if (failed) {
  console.error("Release bundle exceeds a web performance budget.");
  process.exitCode = 1;
}
