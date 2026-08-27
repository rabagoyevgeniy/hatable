import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "1" ? "/hatable/" : "/",
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
