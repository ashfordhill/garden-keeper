import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        // dev-only plant inspection gallery (src/plants/PlantGallery.tsx)
        gallery: fileURLToPath(new URL("./gallery.html", import.meta.url)),
      },
    },
  },
  server: {
    proxy: {
      // Backend inference sidecar (FastAPI). Same-origin in production via nginx.
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
