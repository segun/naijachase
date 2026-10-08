// Shared by the source-reading tests: the UI source is grouped by feature, so files are found by name rather than by folder.
import fs from "node:fs";
import path from "node:path";

export const srcDir = new URL("../src/", import.meta.url).pathname;
export const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
export const sourceFiles = walk(srcDir);

/** Source text of the single file with this base name, anywhere under src/ (for example `component("Investigate")` or `component("music.svelte.ts")`). */
export function component(name) {
  const file = name.includes(".") ? name : `${name}.svelte`;
  const hits = sourceFiles.filter(f => path.basename(f) === file);
  if (hits.length !== 1) throw new Error(`expected exactly one ${file} under src/, found ${hits.length}`);
  return fs.readFileSync(hits[0], "utf8");
}
export const components = names => names.map(component).join("\n");
/** Every .svelte file under src/ (the screens and components). */
export const allComponents = () => sourceFiles.filter(f => f.endsWith(".svelte")).map(f => fs.readFileSync(f, "utf8")).join("\n");
