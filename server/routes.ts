import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("Supabase environment variables not set. Server auth will not work.");
}

const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export async function registerRoutes(app: Express): Promise<Server> {
  const requireAuth = async (req: any, res: any, next: any) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!supabase) {
        return res.status(500).json({ error: "Server not configured for authentication" });
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return res.status(401).json({ error: "Invalid token" });
      }

      req.userId = user.id;
      req.userEmail = user.email;
      next();
    } catch (error) {
      console.error("Auth error:", error);
      return res.status(401).json({ error: "Unauthorized" });
    }
  };

  app.get("/api/profile", requireAuth, async (req: any, res) => {
    try {
      const profile = await storage.getProfile(req.userId);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error: any) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.get("/api/anime", requireAuth, async (req: any, res) => {
    try {
      const animeList = await storage.getAnimeByUserId(req.userId);
      res.json(animeList);
    } catch (error: any) {
      console.error("Error fetching anime:", error);
      res.status(500).json({ error: "Failed to fetch anime" });
    }
  });

  app.post("/api/anime", requireAuth, async (req: any, res) => {
    try {
      const animeData = Array.isArray(req.body) ? req.body : [req.body];
      const results = await storage.createManyAnime(
        animeData.map((a: any) => ({
          ...a,
          userId: req.userId,
        }))
      );
      res.json(results);
    } catch (error: any) {
      console.error("Error creating anime:", error);
      res.status(500).json({ error: "Failed to create anime" });
    }
  });

  app.patch("/api/anime/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getAnimeById(id);
      
      if (!existing) {
        return res.status(404).json({ error: "Anime not found" });
      }
      
      if (existing.userId !== req.userId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const updated = await storage.updateAnime(id, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating anime:", error);
      res.status(500).json({ error: "Failed to update anime" });
    }
  });

  app.delete("/api/anime/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getAnimeById(id);
      
      if (!existing) {
        return res.status(404).json({ error: "Anime not found" });
      }
      
      if (existing.userId !== req.userId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      await storage.deleteAnime(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting anime:", error);
      res.status(500).json({ error: "Failed to delete anime" });
    }
  });

  app.patch("/api/profile", requireAuth, async (req: any, res) => {
    try {
      const { username } = req.body;
      if (!username || typeof username !== "string") {
        return res.status(400).json({ error: "Username is required" });
      }
      const trimmed = username.trim();
      if (trimmed.length < 2 || trimmed.length > 30) {
        return res.status(400).json({ error: "Username must be 2–30 characters" });
      }

      if (!supabase) {
        return res.status(500).json({ error: "Server not configured" });
      }

      const { data: updated, error: upsertError } = await supabase
        .from("profiles")
        .upsert({ id: req.userId, email: req.userEmail || "", username: trimmed }, { onConflict: "id" })
        .select("username")
        .single();

      if (upsertError) {
        console.error("Error upserting profile:", upsertError);
        return res.status(500).json({ error: "Failed to update username" });
      }

      res.json({ username: updated?.username });
    } catch (error: any) {
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update username" });
    }
  });

  app.get("/api/friends", requireAuth, async (req: any, res) => {
    try {
      const friendsList = await storage.getFriends(req.userId);
      res.json(friendsList);
    } catch (error: any) {
      console.error("Error fetching friends:", error);
      res.status(500).json({ error: "Failed to fetch friends" });
    }
  });

  app.get("/api/friends/requests", requireAuth, async (req: any, res) => {
    try {
      const requests = await storage.getFriendRequests(req.userId);
      res.json(requests);
    } catch (error: any) {
      console.error("Error fetching friend requests:", error);
      res.status(500).json({ error: "Failed to fetch friend requests" });
    }
  });

  app.post("/api/friends", requireAuth, async (req: any, res) => {
    try {
      const { friendId } = req.body;
      
      if (!friendId) {
        return res.status(400).json({ error: "Friend ID is required" });
      }

      const friend = await storage.getProfile(friendId);
      if (!friend) {
        return res.status(404).json({ error: "User not found" });
      }

      if (friend.id === req.userId) {
        return res.status(400).json({ error: "Cannot add yourself as a friend" });
      }

      const request = await storage.createFriendRequest({
        userId: req.userId,
        friendId: friend.id,
        status: "pending",
      });

      res.json(request);
    } catch (error: any) {
      console.error("Error creating friend request:", error);
      res.status(500).json({ error: "Failed to send friend request" });
    }
  });

  app.patch("/api/friends/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const updated = await storage.updateFriendStatus(id, status);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating friend status:", error);
      res.status(500).json({ error: "Failed to update friend status" });
    }
  });

  app.get("/api/friends/:friendId/anime", requireAuth, async (req: any, res) => {
    try {
      const { friendId } = req.params;
      const animeList = await storage.getFriendAnimeList(req.userId, friendId);
      res.json(animeList);
    } catch (error: any) {
      console.error("Error fetching friend's anime:", error);
      res.status(500).json({ error: "Failed to fetch friend's anime" });
    }
  });

  app.get("/api/notifications", requireAuth, async (req: any, res) => {
    try {
      const notificationsList = await storage.getNotifications(req.userId);
      res.json(notificationsList);
    } catch (error: any) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.markNotificationRead(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking notification read:", error);
      res.status(500).json({ error: "Failed to mark notification read" });
    }
  });

  app.post("/api/notifications/read-all", requireAuth, async (req: any, res) => {
    try {
      await storage.markAllNotificationsRead(req.userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking all notifications read:", error);
      res.status(500).json({ error: "Failed to mark all notifications read" });
    }
  });

  app.get("/api/activity/friends", requireAuth, async (req: any, res) => {
    try {
      const friendIds = ((req.query.friendIds as string) || "")
        .split(",")
        .map((id: string) => id.trim())
        .filter(Boolean);
      const activity = await storage.getActivityFeed(friendIds);
      res.json(activity);
    } catch (error: any) {
      console.error("Error fetching activity feed:", error);
      res.status(500).json({ error: "Failed to fetch activity feed" });
    }
  });

  app.post("/api/activity", requireAuth, async (req: any, res) => {
    try {
      const { type, animeTitle, coverImage, seasonNumber, rating } = req.body;
      if (!type || !animeTitle) {
        return res.status(400).json({ error: "type and animeTitle are required" });
      }
      await storage.logActivity(req.userId, type, animeTitle, coverImage, seasonNumber, rating);
      res.json({ success: true });

      // Fire-and-forget: notify all friends about this activity
      (async () => {
        try {
          // Get this user's username
          let username = "A friend";
          if (supabase) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("username")
              .eq("id", req.userId)
              .single();
            if (profile?.username) username = profile.username;
          }

          // Build a readable message for the activity type
          const actionMap: Record<string, string> = {
            added: `added "${animeTitle}" to their list`,
            started: `started watching "${animeTitle}"`,
            completed: `completed "${animeTitle}"!`,
            dropped: `dropped "${animeTitle}"`,
            rated: `rated "${animeTitle}" ${rating ?? ""}${rating ? "/10" : ""}`.trim(),
            watching: `is watching "${animeTitle}"`,
            plan_to_watch: `plans to watch "${animeTitle}"`,
          };
          const action = actionMap[type] || `updated "${animeTitle}"`;
          const message = `${username} ${action}`;

          // Get all accepted friends of this user
          const friends = await storage.getFriends(req.userId);
          for (const friend of friends) {
            const recipientId = friend.userId === req.userId ? friend.friendId : friend.userId;
            await storage.createNotification({
              userId: recipientId,
              animeTitle,
              seasonNumber: seasonNumber ?? null,
              episodeNumber: null,
              notificationType: "friend_activity",
              message,
              read: false,
            });
          }
        } catch (err) {
          console.error("Error sending friend activity notifications:", err);
        }
      })();
    } catch (error: any) {
      console.error("Error logging activity:", error);
      res.status(500).json({ error: "Failed to log activity" });
    }
  });

  app.get("/api/profiles/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const profile = await storage.getProfile(id);
      
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      res.json({ id: profile.id, username: profile.username, avatarUrl: profile.avatarUrl });
    } catch (error: any) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // ── HLS / Stream Proxy ────────────────────────────────────────────────────
  // Proxies .m3u8 manifests and .ts segments to bypass CORS restrictions.
  // The browser fetches /api/proxy/stream?url=... which forwards to the CDN.

  app.get("/api/proxy/stream", async (req: any, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("url required");
    const target = String(url);

    // Validate it's a proper HTTPS URL (all proxied URLs are server-generated)
    try {
      const parsed = new URL(target);
      if (parsed.protocol !== "https:") return res.status(400).send("HTTPS only");
    } catch {
      return res.status(400).send("Invalid URL");
    }

    try {
      const upstream = await fetch(target, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          Referer: "https://anitaku.to/",
          Origin: "https://anitaku.to",
        },
        signal: AbortSignal.timeout(20000),
      });

      if (!upstream.ok) return res.status(upstream.status).send("Upstream error");

      const contentType = upstream.headers.get("content-type") || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=300");

      // For m3u8 manifests, rewrite segment URLs to go through proxy
      if (target.includes(".m3u8") || contentType.includes("mpegurl")) {
        const text = await upstream.text();
        const baseUrl = target.substring(0, target.lastIndexOf("/") + 1);
        const rewritten = text.split("\n").map(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) return line;
          // Absolute URLs
          if (trimmed.startsWith("http")) {
            return `/api/proxy/stream?url=${encodeURIComponent(trimmed)}`;
          }
          // Relative URLs — resolve against base
          const abs = new URL(trimmed, baseUrl).href;
          return `/api/proxy/stream?url=${encodeURIComponent(abs)}`;
        }).join("\n");
        return res.send(rewritten);
      }

      // Binary segments (.ts, .mp4 etc.) — pipe directly
      const buffer = await upstream.arrayBuffer();
      return res.send(Buffer.from(buffer));
    } catch (err: any) {
      console.error("Proxy error:", err?.message);
      res.status(500).send("Proxy failed");
    }
  });

  // ── Gogoanime Scraper Endpoints ──────────────────────────────────────────
  // Public endpoints — no auth needed.

  const { searchGogoanime, getGogoEpisodeList, extractStream, buildEpisodeUrl, checkDubExists, extractDubFromAniwaves, searchAniwaves } = await import("./extractor.js");

  // Search anime on Gogoanime by title
  app.get("/api/gogoanime/search", async (req: any, res) => {
    try {
      const { q } = req.query;
      if (!q) return res.status(400).json({ error: "q is required" });
      const results = await searchGogoanime(String(q));
      res.json({ results });
    } catch (err: any) {
      console.error("Gogoanime search error:", err?.message);
      res.status(500).json({ error: "Search failed", message: err?.message });
    }
  });

  // Get episode count + check for dub version
  app.get("/api/gogoanime/episodes", async (req: any, res) => {
    try {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "id is required" });
      const animeId = String(id);

      // Run sub episode count and dub check in parallel
      const [range, dubId] = await Promise.all([
        getGogoEpisodeList(animeId),
        checkDubExists(animeId),
      ]);

      if (!range) return res.status(404).json({ error: "No episodes found" });

      let dubRange = null;
      if (dubId) {
        try { dubRange = await getGogoEpisodeList(dubId); } catch {}
      }

      res.json({ ...range, dubId: dubId || null, dubEnd: dubRange?.end || null });
    } catch (err: any) {
      console.error("Gogoanime episodes error:", err?.message);
      res.status(500).json({ error: "Failed to fetch episodes", message: err?.message });
    }
  });

  // Extract direct stream URL from an episode page using Puppeteer
  app.get("/api/extract", async (req: any, res) => {
    try {
      const { url, id, episode } = req.query;
      let episodeUrl: string;

      if (url) {
        episodeUrl = String(url);
      } else if (id && episode) {
        episodeUrl = buildEpisodeUrl(String(id), parseInt(String(episode)));
      } else {
        return res.status(400).json({ error: "Provide url OR (id + episode)" });
      }

      console.log(`[extract] Starting extraction for: ${episodeUrl}`);
      const result = await extractStream(episodeUrl);
      res.json(result);
    } catch (err: any) {
      console.error("Stream extraction error:", err?.message);
      res.status(500).json({ error: "Extraction failed", message: err?.message });
    }
  });

  // ── Watch / Streaming Proxy (AllAnime fallback) ──────────────────────────
  // Public endpoint — no auth needed. Proxies AllAnime GraphQL to avoid CORS.

  const ALLANIME_API = "https://api.allanime.day/api";
  const ALLANIME_HEADERS = {
    "Content-Type": "application/json",
    "Referer": "https://allanime.to",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  };

  // Decode AllAnime's obfuscated "--HEXSTRING" URLs
  function decodeAllAnimeUrl(raw: string): string | null {
    try {
      if (!raw.startsWith("--")) return raw;
      const hex = raw.slice(2);
      const bytes = Buffer.from(hex, "hex");
      // XOR key used by AllAnime (0x38 repeating, first 8 chars are https:// )
      // Derived empirically from the Yt-mp4 source which encodes known YouTube URLs
      const KEY = 0x38;
      const decoded = Buffer.from(bytes.map(b => b ^ KEY)).toString("utf8");
      if (decoded.startsWith("http") || decoded.startsWith("//")) return decoded;
      return null;
    } catch {
      return null;
    }
  }

  // Search AllAnime shows by title, return edges with _id + malId + episode counts + thumbnail
  async function searchAllAnime(title: string): Promise<any[]> {
    const body = JSON.stringify({
      query: `query($search: SearchInput) {
        shows(search: $search, limit: 26, page: 1, translationType: sub, countryOrigin: JP) {
          edges { _id name malId availableEpisodes thumbnail }
        }
      }`,
      variables: { search: { allowAdult: true, allowUnknown: true, query: title } },
    });
    const res = await fetch(ALLANIME_API, { method: "POST", headers: ALLANIME_HEADERS, body });
    const json = await res.json() as any;
    return json?.data?.shows?.edges || [];
  }

  // Public AllAnime search endpoint — used by the Watch section
  app.get("/api/allanime/search", async (req: any, res) => {
    try {
      const { q } = req.query;
      if (!q) return res.status(400).json({ error: "q is required" });
      const edges = await searchAllAnime(String(q));
      const results = edges.map((s: any) => ({
        id: s._id,
        name: s.name,
        malId: s.malId || null,
        subEpisodes: s.availableEpisodes?.sub || 0,
        dubEpisodes: s.availableEpisodes?.dub || 0,
        thumbnail: s.thumbnail || null,
      }));
      res.json({ results });
    } catch (err: any) {
      console.error("AllAnime search error:", err?.message);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // Get episode source URLs from AllAnime
  async function getAllAnimeEpisodeSources(showId: string, episode: string, type: string): Promise<any[]> {
    const body = JSON.stringify({
      query: `query($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) {
        episode(showId: $showId, translationType: $translationType, episodeString: $episodeString) {
          episodeString sourceUrls
        }
      }`,
      variables: { showId, translationType: type, episodeString: episode },
    });
    const res = await fetch(ALLANIME_API, { method: "POST", headers: ALLANIME_HEADERS, body });
    const json = await res.json() as any;
    return json?.data?.episode?.sourceUrls || [];
  }

  // ── Aniwaves Dub Extraction ───────────────────────────────────────────────
  // Searches aniwaves.ru for the show, then uses Puppeteer to load the dub
  // page, grab the server iframe URL, and extract the HLS/MP4 stream.
  // GET /api/extract/dub?title=Attack+on+Titan&episode=1
  // GET /api/extract/dub?animeId=80015&slug=darling-in-the-franxx-80015&episode=1  (fast path)

  app.get("/api/extract/dub", async (req: any, res) => {
    const { title, episode = "1", animeId: rawAnimeId, slug: rawSlug } = req.query;
    if (!title && (!rawAnimeId || !rawSlug)) {
      return res.status(400).json({ error: "Provide title OR (animeId + slug)" });
    }

    try {
      let animeId = rawAnimeId ? String(rawAnimeId) : "";
      let slug = rawSlug ? String(rawSlug) : "";

      if (!animeId || !slug) {
        console.log(`[extract/dub] Searching aniwaves for: ${title}`);
        const found = await searchAniwaves(String(title));
        if (!found) {
          return res.status(404).json({ error: `"${title}" not found on aniwaves` });
        }
        animeId = found.animeId;
        slug = found.slug;
        console.log(`[extract/dub] Found: ${found.name} → ${slug}`);
      }

      const result = await extractDubFromAniwaves(animeId, parseInt(String(episode)), slug);
      res.json({ ...result, animeId, slug });
    } catch (err: any) {
      console.error("Dub extraction error:", err?.message);
      res.status(500).json({ error: "Dub extraction failed", message: err?.message });
    }
  });

  app.get("/api/watch/sources", async (req: any, res) => {
    try {
      const { malId, title, showId: rawShowId, episode = "1", type = "sub" } = req.query;

      let show: { _id: string; name: string } | null = null;

      if (rawShowId) {
        // Fast path: caller already has the AllAnime show ID
        show = { _id: String(rawShowId), name: String(title || "") };
      } else {
        if (!title) return res.status(400).json({ error: "title or showId is required" });
        const results = await searchAllAnime(String(title));
        show = malId
          ? results.find((s: any) => String(s.malId) === String(malId)) || null
          : null;
        if (!show && results.length > 0) show = results[0];
        if (!show) return res.status(404).json({ error: "Anime not found on AllAnime" });
      }

      const rawSources = await getAllAnimeEpisodeSources(show._id, String(episode), String(type));

      const SKIP_SOURCES = ["Yt-mp4"];
      const sources: { url: string; sourceName: string; priority: number; type: string }[] = [];

      for (const s of rawSources) {
        if (SKIP_SOURCES.includes(s.sourceName)) continue;

        let url: string = s.sourceUrl;
        if (url.startsWith("--")) {
          const decoded = decodeAllAnimeUrl(url);
          if (!decoded) continue;
          url = decoded;
        }
        if (url.startsWith("//")) url = "https:" + url;
        if (!url.startsWith("http")) continue;

        // Classify the source type
        const srcType = url.includes(".m3u8") ? "hls"
          : /\.mp4(\?|#|$)/.test(url) ? "mp4"
          : "iframe";

        sources.push({ url, sourceName: s.sourceName, priority: s.priority ?? 0, type: srcType });
      }

      // Sort by priority descending
      sources.sort((a, b) => b.priority - a.priority);

      res.json({ showId: show._id, showName: show.name, episode, sources });
    } catch (err: any) {
      console.error("Watch sources error:", err?.message);
      res.status(500).json({ error: "Failed to fetch sources" });
    }
  });

  // ── AniSkip Proxy ────────────────────────────────────────────────────────
  // Proxies AniSkip API server-side to avoid CORS issues from the browser.
  // GET /api/aniskip?malId=35849&episode=1

  app.get("/api/aniskip", async (req: any, res) => {
    const { malId, episode } = req.query;
    if (!malId || !episode) return res.status(400).json({ error: "malId and episode are required" });

    try {
      const url = `https://api.aniskip.com/v2/skip-times/${malId}/${episode}?types[]=op&types[]=ed&episodeLength=0`;
      const upstream = await fetch(url, {
        headers: { "User-Agent": "AniCircle/1.0" },
        signal: AbortSignal.timeout(8000),
      });

      if (!upstream.ok) {
        return res.status(upstream.status).json({ found: false, results: [] });
      }

      const json = await upstream.json();
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.json(json);
    } catch (err: any) {
      console.error("AniSkip proxy error:", err?.message);
      res.json({ found: false, results: [] });
    }
  });

  // ── AniList MAL ID lookup ─────────────────────────────────────────────────
  // Gets the MAL ID for an AniList ID (for skip times when malId is missing).
  // GET /api/anilist-mal?anilistId=101759

  app.get("/api/anilist-mal", async (req: any, res) => {
    const { anilistId } = req.query;
    if (!anilistId) return res.status(400).json({ error: "anilistId is required" });

    try {
      const body = JSON.stringify({
        query: `query($id: Int) { Media(id: $id, type: ANIME) { idMal } }`,
        variables: { id: parseInt(String(anilistId)) },
      });
      const upstream = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body,
        signal: AbortSignal.timeout(8000),
      });
      const json = await upstream.json() as any;
      const idMal = json?.data?.Media?.idMal ?? null;
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.json({ idMal });
    } catch (err: any) {
      console.error("AniList MAL lookup error:", err?.message);
      res.json({ idMal: null });
    }
  });

  // ── AniList GraphQL Proxy ─────────────────────────────────────────────────
  // Browser -> /api/anilist/graphql -> AniList (server-side) to avoid CORS issues.
  app.post("/api/anilist/graphql", async (req: any, res) => {
    try {
      const { query, variables } = req.body || {};
      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "query is required" });
      }

      const upstream = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "AniCircle/1.0",
        },
        body: JSON.stringify({ query, variables: variables || {} }),
        signal: AbortSignal.timeout(12000),
      });

      const text = await upstream.text();
      res.status(upstream.status);
      res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
      res.setHeader("Cache-Control", "public, max-age=60");
      return res.send(text);
    } catch (err: any) {
      console.error("AniList proxy error:", err?.message);
      return res.status(500).json({ error: "AniList proxy failed" });
    }
  });

  app.get("/api/admin/feedback", requireAuth, async (req: any, res) => {
    if (req.userEmail !== "borsepranav700@gmail.com") {
      return res.status(403).json({ error: "Forbidden" });
    }
    try {
      const all = await storage.getAllFeedback();
      res.json(all);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch feedback" });
    }
  });

  app.post("/api/feedback", async (req, res) => {
    const { type, name, email, message } = req.body || {};
    if (!message || !type) {
      return res.status(400).json({ error: "Message and type are required" });
    }

    const payload = {
      type: String(type),
      name: name ? String(name) : null,
      email: email ? String(email) : null,
      message: String(message),
    };

    // Primary write path: Drizzle/Postgres
    try {
      const saved = await storage.saveFeedback(payload);
      return res.json({ success: true, id: saved.id });
    } catch (err: any) {
      console.error("Feedback DB error (primary):", err?.message || err);
    }

    // Fallback write path: Supabase service-role REST insert
    try {
      if (!supabase) {
        return res.status(500).json({ error: "Failed to save feedback" });
      }
      const { data, error } = await supabase
        .from("feedback")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        console.error("Feedback DB error (fallback):", error.message);
        return res.status(500).json({ error: "Failed to save feedback" });
      }

      return res.json({ success: true, id: data?.id ?? null, via: "fallback" });
    } catch (err: any) {
      console.error("Feedback error:", err?.message || err);
      return res.status(500).json({ error: "Failed to save feedback" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
