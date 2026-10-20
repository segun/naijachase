import { defineConfig, loadEnv } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, ".", "");
  return {
    plugins: [svelte()],
    server: {
      host: "127.0.0.1", port: 4174, strictPort: true,
      proxy: { "/admin-api": { target: environment.ADMIN_API_TARGET ?? "http://127.0.0.1:8081" } }
    },
    preview: { host: "127.0.0.1", port: 4174, strictPort: true },
    build: { sourcemap: false }
  };
});
