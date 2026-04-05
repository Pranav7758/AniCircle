import * as cheerio from "cheerio";
import puppeteer from "puppeteer-core";

// ── Config ────────────────────────────────────────────────────────────────────

const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH ||
  "/nix/store/5afrhwm7zqn1vb7p5z1mc2rkh2grsfgz-ungoogled-chromium-138.0.7204.100/bin/chromium";

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

// Check if a dub version exists for a show (convention: {id}-dub)
export async function checkDubExists(animeId: string): Promise<string | null> {
  const dubId = animeId.endsWith("-dub") ? animeId : `${animeId}-dub`;
  try {
    const range = await getGogoEpisodeList(dubId);
    return range ? dubId : null;
  } catch {
    return null;
  }
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

export async function extractFromIframe(iframeSrc: string, referer: string): Promise<StreamResult | null> {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
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
      ],
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
        } else if (url.includes(".mp4") && !url.includes("thumbnail") && !url.includes("poster")) {
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

    // Try clicking visible play buttons
    if (!streamUrl) {
      try {
        const clicked = await page.evaluate(() => {
          const selectors = [
            ".jw-icon-display", ".play-button", "[class*=play-btn]",
            "button[class*=play]", ".vjs-big-play-button", "#playButton",
            ".plyr__control--overlaid", "[data-plyr=play]",
          ];
          for (const sel of selectors) {
            const el = document.querySelector(sel) as HTMLElement | null;
            if (el) { el.click(); return true; }
          }
          return false;
        });
        if (clicked) await new Promise(r => setTimeout(r, 4000));
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
