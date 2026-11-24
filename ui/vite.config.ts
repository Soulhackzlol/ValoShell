/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Tauri expects a fixed dev port and must not have its output cleared.
const DEV_PORT = 1420;
// The app version lives in tauri.conf.json, the same one the built executable reports.
const { version } = JSON.parse(readFileSync(new URL("../app/tauri.conf.json", import.meta.url), "utf8")) as { version: string };

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [solid()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  clearScreen: false,
  resolve: { alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { port: DEV_PORT, strictPort: true, watch: { ignored: ["**/app/**", "**/crates/**", "**/target/**"] } },
  build: {
    target: "chrome120",
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        overlay: fileURLToPath(new URL("./overlay.html", import.meta.url)),
      },
    },
  },
  // `css: true` so `?raw` stylesheet imports give their text (palettes.test.ts checks every
  // style colour role is painted by its style's stylesheet).
  test: { css: true, environment: "node", include: ["src/**/*.test.ts"] },
});
