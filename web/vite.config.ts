/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/",
  plugins: [react()],
  server: {
    proxy: {
      // Host must stay the browser origin (localhost:5173). Do not set
      // changeOrigin: true — the Go API rejects a Host that does not match Origin.
      "/api": "http://127.0.0.1:1370",
    },
  },
  build: {
    outDir: "../internal/server/ui",
    emptyOutDir: true,
  },
  test: {
    environment: "node",
  },
});
