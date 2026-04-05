import * as cheerio from "cheerio";
import puppeteer from "puppeteer-core";

// ── Config ────────────────────────────────────────────────────────────────────

const REPLIT_CHROMIUM =
  "/nix/store/5afrhwm7zqn1vb7p5z1mc2rkh2grsfgz-ungoogled-chromium-138.0.7204.100/bin/chromium";

async function getChromiumPath(): Promise<string> {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  // Vercel / AWS Lambda: use @sparticuz/chromium which downloads at runtime
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    try {
      const chromium = await import("@sparticuz/chromium");
      return await chromium.default.executablePath();
    } catch {
      throw new Error("Chromium not available in this serverless environment. Set CHROMIUM_PATH env var.");
    }
  }
  // Common Linux paths (Render, Ubuntu servers)
  const { existsSync } = await import("fs");
  const linuxPaths = [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ];
  for (const p of linuxPaths) {
    if (existsSync(p)) return p;
  }
  return REPLIT_CHROMIUM;
}

async function getChromiumArgs(): Promise<string[]> {
  const base = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--no-first-run",
    "--no-zygote",
    "--single-process",
    "--disable-extensions",
    "--disable-blink-features=AutomationControlled",
    "--window-size=1280,720",
    "--disable-web-security",
    "--allow-running-insecure-content",
  ];
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    try {
      const chromium = await import("@sparticuz/chromium");
      return [...chromium.default.args, ...base];
    } catch {}
  }
  return base;
}

const GOGO_BASE = "https://anitaku.to";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

// Simple in-memory cache for extracted streams (keyed by episodeUrl)
const streamCache = new Map<string, { result: StreamResult; at: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function fetchHtml(url: string, referer?: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": randomUA(),
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      Referer: referer || GOGO_BASE,
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// ── Gogoanime Search (via anitaku.to) ────────────────────────────────────────

export interface GogoSearchResult {
  id: string;       // e.g. "naruto"
  title: string;
  url: string;      // category page url
  image: string;
}

export async function searchGogoanime(query: string): Promise<GogoSearchResult[]> {
  const url = `${GOGO_BASE}/search.html?keyword=${encodeURIComponent(query)}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const results: GogoSearchResult[] = [];

  $("ul.items > li").each((_, el) => {
    const a = $(el).find("p.name a, .name a").first();
    const title = a.attr("title") || a.text().trim();
    const href = a.attr("href") || "";
    const image = $(el).find("img").attr("src") || "";
    if (!href.includes("/category/")) return;
    const id = href.replace("/category/", "").replace(/\/$/, "");
    if (title && id) results.push({ id, title, url: `${GOGO_BASE}${href}`, image });
  });

  return results;
}

// ── Episode Count ─────────────────────────────────────────────────────────────

export interface GogoEpisodeRange {
  start: number;
  end: number;
}

export async function getGogoEpisodeList(animeId: string): Promise<GogoEpisodeRange | null> {
  const url = `${GOGO_BASE}/category/${animeId}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  let maxEp = 0;
  let minEp = 999999;

  // Method 1: ep_start / ep_end attributes (older page format)
  $("#episode_page a").each((_, el) => {
    const start = parseInt($(el).attr("ep_start") || "0");
    const end = parseInt($(el).attr("ep_end") || "0");
    if (end > maxEp) maxEp = end;
    if (start < minEp && start > 0) minEp = start;
  });

  // Method 2: data-value="001-100" style links (newer page format)
  if (maxEp === 0) {
    $("[data-value]").each((_, el) => {
      const dv = $(el).attr("data-value") || "";
      const match = dv.match(/^(\d+)-(\d+)$/);
      if (match) {
        const start = parseInt(match[1]);
        const end = parseInt(match[2]);
        if (end > maxEp) maxEp = end;
        if (start < minEp && start > 0) minEp = start;
      }
    });
  }

  if (maxEp === 0) return null;
  return { start: minEp === 999999 ? 1 : minEp, end: maxEp };
}

// ── Stream Extraction ─────────────────────────────────────────────────────────

export interface StreamResult {
  stream: string;
  type: "hls" | "mp4";
  source: string;
}

export function buildEpisodeUrl(animeId: string, episode: number): string {
  return `${GOGO_BASE}/${animeId}-episode-${episode}`;
}

// Check if a dub version exists for a show.
// Strategy 1: try the simple "{id}-dub" convention.
// Strategy 2: search Gogoanime for "{title} dub" and match a result with "dub" in its ID.
export async function checkDubExists(animeId: string): Promise<string | null> {
  // Strategy 1: simple suffix
  const simpleDubId = animeId.endsWith("-dub") ? animeId : `${animeId}-dub`;
  try {
    const range = await getGogoEpisodeList(simpleDubId);
    if (range) return simpleDubId;
  } catch {}

  // Strategy 2: search "{title} dub" and find a matching dub result
  try {
    const title = animeId.replace(/-/g, " ");
    const results = await searchGogoanime(`${title} dub`);
    // Accept results whose ID ends with "-dub" or title contains "(Dub)"
    const dubResult = results.find(r =>
      r.id.endsWith("-dub") ||
      r.title.toLowerCase().includes("(dub)")
    );
    if (dubResult) {
      const range = await getGogoEpisodeList(dubResult.id);
      if (range) return dubResult.id;
    }
  } catch {}

  return null;
}

export async function extractStream(episodeUrl: string): Promise<StreamResult> {
  // Check cache first
  const cached = streamCache.get(episodeUrl);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    console.log(`[Extractor] Cache hit: ${episodeUrl}`);
    return cached.result;
  }

  // Step 1: fetch episode page and collect streaming server iframe URLs
  console.log(`[Extractor] Fetching episode page: ${episodeUrl}`);
  const html = await fetchHtml(episodeUrl);
  const $ = cheerio.load(html);

  const iframeUrls: string[] = [];

  // All server links are in data-video attributes
  $("ul.muti_link li, .muti_link li, .anime_muti_link ul li").each((_, el) => {
    const dv = $(el).find("a").attr("data-video") || "";
    if (dv && dv.startsWith("http")) iframeUrls.push(dv);
  });

  // Fallback: direct iframe src in play-video div
  const mainSrc = $(".play-video iframe").attr("src") || "";
  if (mainSrc && mainSrc.startsWith("http")) iframeUrls.unshift(mainSrc);

  if (iframeUrls.length === 0) {
    throw new Error("No streaming servers found on episode page. The site may have changed structure.");
  }

  console.log(`[Extractor] Found ${iframeUrls.length} server(s) for episode. Starting Puppeteer…`);

  // Step 2: Try each server with Puppeteer until we capture a stream URL
  for (let i = 0; i < Math.min(iframeUrls.length, 5); i++) {
    const iframeSrc = iframeUrls[i];
    console.log(`[Extractor] Trying server ${i + 1}: ${new URL(iframeSrc).hostname}`);
    try {
      const result = await extractFromIframe(iframeSrc, episodeUrl);
      if (result) {
        // Cache it
        streamCache.set(episodeUrl, { result, at: Date.now() });
        return result;
      }
    } catch (err: any) {
      console.warn(`[Extractor] Server ${i + 1} failed: ${err.message}`);
    }
  }

  throw new Error(`No valid stream URL captured from ${iframeUrls.length} server(s). All servers failed.`);
}

// Cache for dub streams (keyed by animeId+episode)
const dubStreamCache = new Map<string, { result: StreamResult; at: number }>();

// ── Aniwaves Dub Extractor ────────────────────────────────────────────────────
// Uses plain HTTP for all aniwaves API steps, then only launches Puppeteer
// for the final video-player iframe to intercept the HLS/MP4 stream.
// This is much faster than loading the full aniwaves page in a browser.

export async function extractDubFromAniwaves(
  animeId: string,  // numeric aniwaves anime ID e.g. "80015"
  episode: number,
  slug: string,     // url slug e.g. "darling-in-the-franxx-80015"
): Promise<StreamResult> {
  const ANIWAVES = "https://aniwaves.ru";
  const pageUrl = `${ANIWAVES}/watch/${slug}/ep-${episode}`;
  const cacheKey = `${animeId}:${episode}`;

  // Check dub cache first
  const cached = dubStreamCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    console.log(`[Aniwaves] Cache hit: ep ${episode}`);
    return cached.result;
  }

  console.log(`[Aniwaves] Fetching dub servers for ep ${episode} (animeId=${animeId})`);

  // Step 1: Get the server list via plain HTTP (no browser needed)
  const serverListRes = await fetch(
    `${ANIWAVES}/ajax/server/list?servers=${animeId}&eps=${episode}`,
    {
      headers: {
        "User-Agent": USER_AGENT,
        "X-Requested-With": "XMLHttpRequest",
        "Referer": pageUrl,
      },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!serverListRes.ok) throw new Error(`Server list HTTP ${serverListRes.status}`);
  const serverListJson = await serverListRes.json() as any;
  const serverListHtml: string = serverListJson?.result || "";
  if (!serverListHtml) throw new Error("Empty server list from aniwaves");

  // Step 2: Parse HTML to find dub server link-ids
  const $sl = cheerio.load(serverListHtml);
  const dubLinks: { name: string; linkId: string }[] = [];
  $sl(".type[data-type='dub'] li[data-link-id]").each((_, el) => {
    const linkId = $sl(el).attr("data-link-id") || "";
    const name = $sl(el).text().trim();
    if (linkId) dubLinks.push({ name, linkId });
  });

  if (!dubLinks.length) throw new Error("No dub servers found for this episode on aniwaves");
  console.log(`[Aniwaves] Found ${dubLinks.length} dub server(s):`, dubLinks.map(l => l.name).join(", "));

  // Step 3: For each dub server, get the iframe URL via plain HTTP, then extract stream
  for (const server of dubLinks) {
    try {
      console.log(`[Aniwaves] Trying dub server: ${server.name}`);

      // Get iframe URL via plain HTTP (no browser needed)
      const sourcesRes = await fetch(
        `${ANIWAVES}/ajax/sources?id=${encodeURIComponent(server.linkId)}&asi=0&autoPlay=0`,
        {
          headers: {
            "User-Agent": USER_AGENT,
            "X-Requested-With": "XMLHttpRequest",
            "Referer": pageUrl,
          },
          signal: AbortSignal.timeout(10000),
        }
      );
      if (!sourcesRes.ok) {
        console.warn(`[Aniwaves] ${server.name}: sources HTTP ${sourcesRes.status}`);
        continue;
      }
      const sourcesData = await sourcesRes.json() as any;
      if (!sourcesData || sourcesData.status !== 200 || !sourcesData.result?.url) {
        console.warn(`[Aniwaves] ${server.name}: sources status ${sourcesData?.status}`);
        continue;
      }

      const iframeUrl: string = sourcesData.result.url;
      console.log(`[Aniwaves] ${server.name} iframe: ${iframeUrl.substring(0, 80)}`);

      // Step 4: Only now launch Puppeteer — just for the video player iframe
      const result = await extractFromIframe(iframeUrl, pageUrl);
      if (result) {
        console.log(`[Aniwaves] ✓ Got stream from ${server.name}`);
        dubStreamCache.set(cacheKey, { result, at: Date.now() });
        return result;
      }
      console.warn(`[Aniwaves] ${server.name}: no stream captured from iframe`);
    } catch (err: any) {
      console.warn(`[Aniwaves] ${server.name} failed: ${err.message}`);
    }
  }

  throw new Error(`All ${dubLinks.length} aniwaves dub server(s) failed`);
}

// ── Aniwaves Search ──────────────────────────────────────────────────────────
// Uses aniwaves' AJAX search API (returns HTML fragment in JSON — no Puppeteer needed).
// Returns {animeId, slug} for dub extraction.

export async function searchAniwaves(title: string): Promise<{ animeId: string; slug: string; name: string } | null> {
  const ANIWAVES = "https://aniwaves.ru";
  console.log(`[Aniwaves search] Searching for: ${title}`);

  try {
    const url = `${ANIWAVES}/ajax/anime/search?keyword=${encodeURIComponent(title)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "X-Requested-With": "XMLHttpRequest",
        "Referer": ANIWAVES,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as any;
    const html: string = json?.result?.html || "";
    if (!html) return null;

    // Parse the HTML fragment for watch links
    const $ = cheerio.load(html);
    const link = $("a[href*='/watch/']").first();
    if (!link.length) return null;

    const href = link.attr("href") || "";
    const slugMatch = href.match(/\/watch\/([^/?#]+)/);
    if (!slugMatch) return null;
    const slug = slugMatch[1];
    const idMatch = slug.match(/-(\d+)$/);
    if (!idMatch) return null;
    const animeId = idMatch[1];
    const name = link.find("img").attr("alt") || link.text().trim() || title;

    console.log(`[Aniwaves search] Found: ${name} → ${slug}`);
    return { animeId, slug, name };
  } catch (err: any) {
    console.warn(`[Aniwaves search] ${err.message}`);
    return null;
  }
}

export async function extractFromIframe(iframeSrc: string, referer: string): Promise<StreamResult | null> {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    const [executablePath, args] = await Promise.all([
      getChromiumPath(),
      getChromiumArgs(),
    ]);
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args,
    });

    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setExtraHTTPHeaders({
      Referer: referer,
      Origin: new URL(referer).origin,
    });

    // Remove headless detection fingerprints
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    let streamUrl: string | null = null;
    let streamType: "hls" | "mp4" = "hls";

    await page.setRequestInterception(true);

    page.on("request", (req) => {
      const url = req.url();
      const rtype = req.resourceType();

      // Block heavy stuff we don't need for stream detection
      if (["font", "image", "stylesheet"].includes(rtype) && !url.includes(".m3u8")) {
        req.abort();
        return;
      }

      // Capture any HLS or MP4 stream URL
      if (!streamUrl) {
        if (url.includes(".m3u8") && !url.includes("thumbnail")) {
          streamUrl = url;
          streamType = "hls";
          console.log(`[Puppeteer] ✓ Captured HLS: ${url.substring(0, 100)}`);
        } else if (/\.mp4(\?|#|$)/.test(url) && !url.includes("thumbnail") && !url.includes("poster")) {
          streamUrl = url;
          streamType = "mp4";
          console.log(`[Puppeteer] ✓ Captured MP4: ${url.substring(0, 100)}`);
        }
      }

      req.continue();
    });

    page.on("response", async (resp) => {
      const url = resp.url();
      if (!streamUrl && url.includes(".m3u8")) {
        streamUrl = url;
        streamType = "hls";
      }
    });

    // Navigate to iframe
    try {
      await page.goto(iframeSrc, { waitUntil: "networkidle2", timeout: 18000 });
    } catch {
      // networkidle2 may timeout on streaming pages — continue anyway
    }

    // Give it a bit more time for async requests to fire
    if (!streamUrl) {
      await new Promise(r => setTimeout(r, 3000));
    }

    // Strategy 1: Extract from JWPlayer API (works for otakuhg.site, otakuvid.online etc.)
    if (!streamUrl) {
      try {
        const jwStream = await page.evaluate(() => {
          try {
            // @ts-ignore
            const jw = (window as any).jwplayer?.();
            if (!jw) return null;
            // Try getPlaylistItem first (most reliable)
            const item = jw.getPlaylistItem?.() ?? jw.getPlaylist?.()[0];
            if (item?.sources?.length) {
              const src = item.sources.find((s: any) => s.file?.includes(".m3u8"))
                ?? item.sources.find((s: any) => s.file?.includes(".mp4"))
                ?? item.sources[0];
              return src?.file ?? null;
            }
            // Fallback: read setup config from script tags
            const scripts = Array.from(document.querySelectorAll("script"));
            for (const s of scripts) {
              const m = s.textContent?.match(/["']file["']\s*:\s*["']([^"']+\.m3u8[^"']*)/);
              if (m) return m[1];
              const m2 = s.textContent?.match(/["']file["']\s*:\s*["']([^"']+\.mp4[^"']*)/);
              if (m2) return m2[1];
            }
            return null;
          } catch { return null; }
        });
        if (jwStream) {
          streamUrl = jwStream;
          streamType = jwStream.includes(".mp4") ? "mp4" : "hls";
          console.log(`[Puppeteer] ✓ JWPlayer API: ${streamUrl!.substring(0, 100)}`);
        }
      } catch {}
    }

    // Strategy 2: Click visible play buttons and wait for network request
    if (!streamUrl) {
      try {
        // Wait for JWPlayer display button to appear (up to 4s)
        await page.waitForSelector(".jw-icon-display, .vjs-big-play-button, .play-button, #playButton", { timeout: 4000 }).catch(() => {});
        const clicked = await page.evaluate(() => {
          const selectors = [
            ".jw-icon-display", ".jw-display-icon-container", ".jw-display",
            ".play-button", "[class*=play-btn]",
            "button[class*=play]", ".vjs-big-play-button", "#playButton",
            ".plyr__control--overlaid", "[data-plyr=play]",
          ];
          for (const sel of selectors) {
            const el = document.querySelector(sel) as HTMLElement | null;
            if (el) { el.click(); return sel; }
          }
          return null;
        });
        if (clicked) {
          console.log(`[Puppeteer] Clicked: ${clicked} — waiting for stream…`);
          await new Promise(r => setTimeout(r, 5000));
          // After click, try JWPlayer API again (player may now have loaded source)
          if (!streamUrl) {
            const jwStream2 = await page.evaluate(() => {
              try {
                // @ts-ignore
                const jw = (window as any).jwplayer?.();
                const item = jw?.getPlaylistItem?.() ?? jw?.getPlaylist?.()[0];
                if (item?.sources?.length) {
                  const src = item.sources.find((s: any) => s.file?.includes(".m3u8"))
                    ?? item.sources.find((s: any) => s.file?.includes(".mp4"))
                    ?? item.sources[0];
                  return src?.file ?? null;
                }
                return null;
              } catch { return null; }
            }).catch(() => null);
            if (jwStream2) {
              streamUrl = jwStream2;
              streamType = jwStream2.includes(".mp4") ? "mp4" : "hls";
              console.log(`[Puppeteer] ✓ JWPlayer API (post-click): ${streamUrl!.substring(0, 100)}`);
            }
          }
        }
      } catch {}
    }

    if (streamUrl) {
      return {
        stream: streamUrl,
        type: streamType,
        source: new URL(iframeSrc).hostname,
      };
    }

    return null;
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
}
