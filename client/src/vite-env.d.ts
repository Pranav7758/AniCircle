/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional; also set `ANIWATCH_SCRAPER_URL` for Vercel (wired in vite.config). */
  readonly VITE_ANIWATCH_API_BASE?: string;
}
