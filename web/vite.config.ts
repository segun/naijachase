import { defineConfig, loadEnv } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig(({ mode }) => {
  // API_TARGET lets the dev server use another API (for example `pnpm mock`) without touching the default.
  const target = loadEnv(mode, ".", "").API_TARGET ?? "http://127.0.0.1:8080";
  return {
    plugins: [svelte()],
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
