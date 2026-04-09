import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repoBase = process.env.VITE_BASE_PATH || (process.env.GITHUB_ACTIONS ? "/Nexa/" : "/");

export default defineConfig({
  base: repoBase,
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173
  },
  preview: {
    host: "0.0.0.0",
    port: 4173
  }
});
