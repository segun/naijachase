// @ts-nocheck
// Dev only: lets /dev-assets.html list the GLB files in public/assets/3d so new uploads show up without a manifest.
import fs from "node:fs";
import path from "node:path";

export function assetList() {
  const root = path.resolve("public/assets/3d");
  const walk = dir =>
    !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return walk(full);
      return e.name.endsWith(".glb") ? [{ path: "/assets/3d/" + path.relative(root, full).split(path.sep).join("/"), bytes: fs.statSync(full).size }] : [];
    });
  return {
    name: "dev-asset-list",
    configureServer(server) {
      server.middlewares.use("/__assets-list", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify(walk(root).sort((a, b) => a.path.localeCompare(b.path))));
      });
    }
  };
}
