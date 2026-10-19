// @ts-nocheck
import fs from "node:fs";
import path from "node:path";

export function stripFinderFiles(root) {
  if (!fs.existsSync(root)) return;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) stripFinderFiles(file);
    else if (entry.name === ".DS_Store") fs.unlinkSync(file);
  }
}

export function assetHygiene() {
  let output;
  return {
    name: "asset-hygiene",
    configResolved(config) { output = path.resolve(config.root, config.build.outDir); },
    closeBundle() { stripFinderFiles(output); }
  };
}
