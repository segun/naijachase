import { defineConfig, loadEnv } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { assetList } from "./dev/asset-list-plugin.mjs";
import { assetVersion } from "./dev/asset-version.mjs";

export default defineConfig(({ mode }) => {
  // API_TARGET lets the dev server use another API (for example `pnpm mock`) without touching the default.
  const target = loadEnv(mode, ".", "").API_TARGET ?? "http://127.0.0.1:8080";
  // Nginx serves /assets with a one-year immutable cache. Vite hashes its own
  // bundles; this content hash gives public GLBs the same safe cache busting.
  const modelAssetVersion = assetVersion();
  return {
    plugins: [svelte(), assetList()],
    define: { __NAIJACHASE_3D_ASSET_VERSION__: JSON.stringify(modelAssetVersion) },
    // The Babylon.js scene is a lazily loaded chunk and is expected to be large.
    build: { chunkSizeWarningLimit: 1500 },
    server: {
      host: "127.0.0.1",
      port: 4173,
      proxy: { "/api": { target, rewrite: path => path.replace(/^\/api/, "") } }
    },
    preview: { host: "127.0.0.1", port: 4173 }
  };
});
