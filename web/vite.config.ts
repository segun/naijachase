import { defineConfig, loadEnv } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { assetList } from "./dev/asset-list-plugin.mjs";
import { assetHygiene } from "./dev/asset-hygiene.mjs";
import { assetVersion } from "./dev/asset-version.mjs";

function babylonChunk(id: string) {
  if (!id.includes("@babylonjs/")) return;
  if (id.includes("@babylonjs/loaders/")) return "babylon-gltf";
  if (id.includes("/Shaders/")) return "babylon-shaders";
  if (id.includes("/Materials/")) return "babylon-materials";
  if (id.includes("/Engines/")) return "babylon-engines";
  if (id.includes("/Maths/")) return "babylon-maths";
  if (id.includes("/Lights/")) return "babylon-lights";
  if (id.includes("/Cameras/")) return "babylon-cameras";
  if (id.includes("/Loading/")) return "babylon-loading";
  if (id.includes("/Misc/")) return "babylon-misc";
  if (id.includes("/Meshes/") || id.includes("/Buffers/") || id.includes("/Culling/")) {
    return "babylon-meshes";
  }
  if (id.includes("/Animations/") || id.includes("/Bones/")) return "babylon-animation";
  return "babylon-core";
}

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
      sourcemap: "hidden",
      rollupOptions: {
        output: {
          manualChunks: babylonChunk,
          // Do not pull shared application dependencies into the explicitly
          // lazy Babylon chunks (Rollup otherwise module-preloads them at boot).
          onlyExplicitManualChunks: true
        }
      }
    },
    server: {
      host: "127.0.0.1",
      port: 4173,
      proxy: { "/api": { target, rewrite: path => path.replace(/^\/api/, "") } }
    },
    preview: { host: "127.0.0.1", port: 4173 }
  };
});
