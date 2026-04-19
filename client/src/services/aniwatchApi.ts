/**
 * Client for an unofficial Aniwatch JSON API (same contract as the Python scraper in
 * beyondbday69/aniwatch-scraper-api). Calls go directly from the browser.
 *
 * Base URL resolution (first non-empty wins):
 * 1. `__ANIWATCH_SCRAPER_URL__` — set at **build** time from `ANIWATCH_SCRAPER_URL` or
 *    `VITE_ANIWATCH_API_BASE` in `vite.config.ts` (use this on Vercel with ANIWATCH_SCRAPER_URL).
 * 2. `import.meta.env.VITE_ANIWATCH_API_BASE` — Vite client env (local dev).
 * 3. Public default host.
 */

declare const __ANIWATCH_SCRAPER_URL__: string;

const DEFAULT_BASE = "https://aniwatch-scraper-kappa.vercel.app";

export function getAniwatchApiBase(): string {
  const fromBuild =
    typeof __ANIWATCH_SCRAPER_URL__ === "string" ? __ANIWATCH_SCRAPER_URL__.trim() : "";
  const fromVite =
    typeof import.meta.env.VITE_ANIWATCH_API_BASE === "string"
      ? import.meta.env.VITE_ANIWATCH_API_BASE.trim()
      : "";
  const base = (fromBuild || fromVite).replace(/\/$/, "");
  return base || DEFAULT_BASE;
}

export interface AniwatchSearchItem {
  title: string;
  japanese_title?: string;
  anime_id: string;
  image: string;
  type?: string;
  duration?: string;
  release_date?: string;
  sub?: string | null;
  dub?: string | null;
  episodes?: string | null;
  description?: string;
}

export interface AniwatchSeason {
  title: string;
  anime_id: string;
}

/** GET /anime/{id} — title, poster, synopsis, season switcher list */
export interface AniwatchAnimeDetails {
  anime_id: string;
  title: string;
  description: string;
  image: string;
  details: Record<string, string>;
  seasons: AniwatchSeason[];
}

export interface AniwatchEpisode {
  ep_id: string;
  number: string;
  title: string;
}

export interface MegaplayResponse {
  episode_id: string;
  sub: string | null;
  dub: string | null;
  raw: string | null;
}

export async function fetchAniwatchSearch(query: string): Promise<{ results: AniwatchSearchItem[] }> {
  const base = getAniwatchApiBase();
  const url = `${base}/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Aniwatch search failed: ${response.status}`);
  }
  return response.json();
}

export async function fetchAniwatchAnimeDetails(animeId: string): Promise<AniwatchAnimeDetails> {
  const base = getAniwatchApiBase();
  const url = `${base}/anime/${encodeURIComponent(animeId)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Anime details failed: ${response.status}`);
  }
  return response.json();
}

export async function fetchAniwatchEpisodes(animeId: string): Promise<{ episodes: AniwatchEpisode[] }> {
  const base = getAniwatchApiBase();
  const url = `${base}/episodes/${encodeURIComponent(animeId)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Aniwatch episodes failed: ${response.status}`);
  }
  return response.json();
}

export async function fetchAniwatchMegaplay(epId: string): Promise<MegaplayResponse> {
  const base = getAniwatchApiBase();
  const url = `${base}/megaplay/${encodeURIComponent(epId)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Aniwatch megaplay failed: ${response.status}`);
  }
  return response.json();
}
