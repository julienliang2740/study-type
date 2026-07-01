import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "frontend",
  plugins: [react()],
  build: {
    outDir: "../dist",
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: false,
    fs: {
      allow: [".."]
    },
    watch: {
      ignored: ["**/monkeytype/**"]
    }
  },
  optimizeDeps: {
    entries: ["index.html"],
    exclude: ["monkeytype"]
  }
});
