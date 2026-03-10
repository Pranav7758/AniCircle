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

  const httpServer = createServer(app);
  return httpServer;
}
