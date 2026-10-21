import { defineConfig, loadEnv } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { assetList } from "./dev/asset-list-plugin.mjs";
import { assetHygiene } from "./dev/asset-hygiene.mjs";
import { assetVersion } from "./dev/asset-version.mjs";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, ".", "");
  // API_TARGET lets the dev server use another API (for example `pnpm mock`) without touching the default.
  const target = environment.API_TARGET ?? "http://127.0.0.1:8080";
  // Nginx serves /assets with a one-year immutable cache. Vite hashes its own
  // bundles; this content hash gives public GLBs the same safe cache busting.
  const modelAssetVersion = assetVersion();
  const release = environment.NAIJACHASE_RELEASE ?? "development";
  return {
    plugins: [svelte(), assetList(), assetHygiene()],
    define: {
      __NAIJACHASE_3D_ASSET_VERSION__: JSON.stringify(modelAssetVersion),
      __NAIJACHASE_RELEASE__: JSON.stringify(release)
    },
    build: {
      chunkSizeWarningLimit: 500,
      sourcemap: "hidden"
    },
    server: {
      host: "127.0.0.1",
      port: 4173,
      proxy: { "/ads-api": { target: environment.ADS_API_TARGET ?? "http://127.0.0.1:8081" }, "/api": { target, rewrite: path => path.replace(/^\/api/, "") } }
    },
    preview: { host: "127.0.0.1", port: 4173 }
  };
});
