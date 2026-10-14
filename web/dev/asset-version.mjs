// @ts-nocheck -- build-time Node utility; the browser TypeScript project intentionally has no Node types.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Returns one stable content version for the complete deployed 3D catalogue.
 * Changing a path or any GLB byte changes the version, so immutable browser and
 * CDN caches cannot serve models from an older release.
 */
export function assetVersion(root = path.resolve("public/assets/3d")) {
  const digest = crypto.createHash("sha256");
  const walk = directory => {
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const full = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(full) : entry.name.endsWith(".glb") ? [full] : [];
    });
  };
  const files = walk(root).sort((left, right) => left.localeCompare(right));
  if (files.length === 0) throw new Error(`No 3D models found under ${root}`);
  for (const file of files) {
    digest.update(path.relative(root, file).split(path.sep).join("/"));
    digest.update("\0");
    digest.update(fs.readFileSync(file));
    digest.update("\0");
  }
  return digest.digest("hex").slice(0, 20);
}
