import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/** Base URL for the Aniwatch scraper API (no trailing slash). */
function resolveAniwatchScraperBase(mode: string): string {
  const root = path.resolve(__dirname);
  const fileEnv = loadEnv(mode, root, "");
  const raw =
    process.env.ANIWATCH_SCRAPER_URL?.trim() ||
    process.env.VITE_ANIWATCH_API_BASE?.trim() ||
    fileEnv.ANIWATCH_SCRAPER_URL?.trim() ||
    fileEnv.VITE_ANIWATCH_API_BASE?.trim() ||
    "";
  return raw.replace(/\/$/, "");
}

export default defineConfig(({ mode }) => ({
  define: {
    // Injected into the client bundle so Vercel's ANIWATCH_SCRAPER_URL works without VITE_ prefix.
    __ANIWATCH_SCRAPER_URL__: JSON.stringify(resolveAniwatchScraperBase(mode)),
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@shared": path.resolve(__dirname, "./shared"),
      "@assets": path.resolve(__dirname, "./attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    allowedHosts: true,
    host: "0.0.0.0",
    port: 5000,
  },
}));
