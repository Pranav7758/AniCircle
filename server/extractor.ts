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

// ── Aniwaves Dub Extractor ────────────────────────────────────────────────────
// Loads the aniwaves dub page in Puppeteer, intercepts the ajax/sources call
// to get the server iframe URL, then extracts the HLS/MP4 stream from it.

export async function extractDubFromAniwaves(
  animeId: string,  // numeric aniwaves anime ID e.g. "80015"
  episode: number,
  slug: string,     // url slug e.g. "darling-in-the-franxx-80015"
): Promise<StreamResult> {
  const ANIWAVES = "https://aniwaves.ru";
  const pageUrl = `${ANIWAVES}/watch/${slug}/ep-${episode}`;
  console.log(`[Aniwaves] Loading dub page: ${pageUrl}`);

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
        "--disable-gpu", "--no-first-run", "--no-zygote", "--single-process",
        "--disable-extensions", "--disable-blink-features=AutomationControlled",
        "--window-size=1280,720",
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    // Step 1: Load the page and wait for the server list to render
    try {
      await page.goto(pageUrl, { waitUntil: "networkidle2", timeout: 30000 });
    } catch {
      // may timeout — continue anyway
    }
    // Give the server list AJAX time to fire and render
    await new Promise(r => setTimeout(r, 4000));

    // Step 2: Pull the server list for this episode from the page context
    // The page fetches /ajax/server/list?servers={animeId}&eps={episode}
    const serverList = await page.evaluate(async (aid: string, ep: number) => {
      const res = await fetch(`/ajax/server/list?servers=${aid}&eps=${ep}`, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      const j = await res.json() as any;
      return j.result as string;
    }, animeId, episode);

    if (!serverList) throw new Error("No server list returned from aniwaves");

    // Step 3: Parse the server list HTML to find dub server link-ids
    const dubLinks: { name: string; linkId: string }[] = await page.evaluate((html: string) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const links: { name: string; linkId: string }[] = [];
      doc.querySelectorAll(".type").forEach(typeEl => {
        const type = typeEl.getAttribute("data-type");
        if (type !== "dub") return;
        typeEl.querySelectorAll("li[data-link-id]").forEach(li => {
          const linkId = li.getAttribute("data-link-id") || "";
          const name = li.textContent?.trim() || "";
          if (linkId) links.push({ name, linkId });
        });
      });
      return links;
    }, serverList);

    if (!dubLinks.length) throw new Error("No dub servers found for this episode on aniwaves");
    console.log(`[Aniwaves] Found ${dubLinks.length} dub server(s):`, dubLinks.map(l => l.name).join(", "));

    // Step 4: For each dub server, call ajax/sources to get the iframe URL
    for (const server of dubLinks) {
      try {
        console.log(`[Aniwaves] Trying dub server: ${server.name}`);
        const sourcesData = await page.evaluate(async (linkId: string) => {
          const res = await fetch(`/ajax/sources?id=${linkId}&asi=0&autoPlay=0`, {
            headers: { "X-Requested-With": "XMLHttpRequest" },
          });
          return res.json() as Promise<any>;
        }, server.linkId);

        if (!sourcesData || sourcesData.status !== 200 || !sourcesData.result?.url) {
          console.warn(`[Aniwaves] ${server.name}: sources returned status ${sourcesData?.status}`);
          continue;
        }

        const iframeUrl: string = sourcesData.result.url;
        console.log(`[Aniwaves] ${server.name} iframe: ${iframeUrl.substring(0, 80)}`);

        // Step 5: Extract stream from the iframe using the existing extractor
        const result = await extractFromIframe(iframeUrl, pageUrl);
        if (result) {
          console.log(`[Aniwaves] ✓ Got stream from ${server.name}`);
          return result;
        }
        console.warn(`[Aniwaves] ${server.name}: no stream captured`);
      } catch (err: any) {
        console.warn(`[Aniwaves] ${server.name} failed: ${err.message}`);
      }
    }

    throw new Error(`All ${dubLinks.length} aniwaves dub server(s) failed`);
  } finally {
    if (browser) { try { await browser.close(); } catch {} }
  }
}

// ── Aniwaves Search ──────────────────────────────────────────────────────────
// Searches aniwaves for an anime by title using Puppeteer (results are JS-rendered).
// Returns {animeId, slug} for dub extraction.

export async function searchAniwaves(title: string): Promise<{ animeId: string; slug: string; name: string } | null> {
  const ANIWAVES = "https://aniwaves.ru";
  const searchUrl = `${ANIWAVES}/search?keyword=${encodeURIComponent(title)}&type=1`;
  console.log(`[Aniwaves search] Searching for: ${title}`);

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
        "--disable-gpu", "--no-first-run", "--no-zygote", "--single-process",
        "--disable-extensions",
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    try {
      await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 20000 });
    } catch {
      // networkidle2 may timeout — continue anyway
    }

    // Wait a moment for results to render
    await new Promise(r => setTimeout(r, 2000));

    // Extract the first watch link from the rendered page
    const result = await page.evaluate(() => {
      const link = document.querySelector("a[href*='/watch/']") as HTMLAnchorElement | null;
      if (!link) return null;
      const href = link.href;
      const titleEl = link.querySelector("[data-jqplot-series-shadowCanvasContext], .film-name, .name, h3, h2, .title") as HTMLElement | null;
      const name = link.getAttribute("title") || titleEl?.textContent?.trim() || link.textContent?.trim() || "";
      return { href, name };
    });

    if (!result) {
      console.warn(`[Aniwaves search] No results found for: ${title}`);
      return null;
    }

    const slugMatch = result.href.match(/\/watch\/([^/?#]+)/);
    if (!slugMatch) return null;
    const slug = slugMatch[1];
    const idMatch = slug.match(/-(\d+)$/);
    if (!idMatch) return null;
    const animeId = idMatch[1];

    console.log(`[Aniwaves search] Found: ${result.name} → ${slug}`);
    return { animeId, slug, name: result.name || title };
  } catch (err: any) {
    console.warn(`[Aniwaves search] ${err.message}`);
    return null;
  } finally {
    if (browser) { try { await browser.close(); } catch {} }
  }
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
