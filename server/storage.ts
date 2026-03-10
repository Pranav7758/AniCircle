import { 
  profiles, anime, friends, notifications,
  type Profile, type InsertProfile, 
  type Anime, type InsertAnime,
  type Friend, type InsertFriend,
  type Notification, type InsertNotification
} from "../shared/schema";
import { db } from "./db";
import { eq, or, and, desc, asc } from "drizzle-orm";

export interface IStorage {
  getProfile(id: string): Promise<Profile | undefined>;
  getProfileByEmail(email: string): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  updateProfile(id: string, data: Partial<Profile>): Promise<Profile | undefined>;
  
  getAnimeByUserId(userId: string): Promise<Anime[]>;
  getAnimeById(id: string): Promise<Anime | undefined>;
  createAnime(anime: InsertAnime): Promise<Anime>;
  createManyAnime(animeList: InsertAnime[]): Promise<Anime[]>;
  updateAnime(id: string, data: Partial<Anime>): Promise<Anime | undefined>;
  deleteAnime(id: string): Promise<void>;
  
  getFriends(userId: string): Promise<Friend[]>;
  getFriendRequests(userId: string): Promise<Friend[]>;
  createFriendRequest(friend: InsertFriend): Promise<Friend>;
  updateFriendStatus(id: string, status: string): Promise<Friend | undefined>;
  getFriendAnimeList(userId: string, friendId: string): Promise<Anime[]>;
  
  getNotifications(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getProfile(id: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, id));
    return profile || undefined;
  }

  async getProfileByEmail(email: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.email, email));
    return profile || undefined;
  }

  async createProfile(insertProfile: InsertProfile): Promise<Profile> {
    const [profile] = await db
      .insert(profiles)
      .values(insertProfile)
      .returning();
    return profile;
  }

  async updateProfile(id: string, data: Partial<Profile>): Promise<Profile | undefined> {
    const [profile] = await db
      .update(profiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(profiles.id, id))
      .returning();
    return profile || undefined;
  }

  async getAnimeByUserId(userId: string): Promise<Anime[]> {
    return await db
      .select()
      .from(anime)
      .where(eq(anime.userId, userId))
      .orderBy(asc(anime.ranking), desc(anime.createdAt));
  }

  async getAnimeById(id: string): Promise<Anime | undefined> {
    const [result] = await db.select().from(anime).where(eq(anime.id, id));
    return result || undefined;
  }

  async createAnime(insertAnime: InsertAnime): Promise<Anime> {
    const [result] = await db
      .insert(anime)
      .values(insertAnime)
      .returning();
    return result;
  }

  async createManyAnime(animeList: InsertAnime[]): Promise<Anime[]> {
    if (animeList.length === 0) return [];
    return await db.insert(anime).values(animeList).returning();
  }

  async updateAnime(id: string, data: Partial<Anime>): Promise<Anime | undefined> {
    const [result] = await db
      .update(anime)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(anime.id, id))
      .returning();
    return result || undefined;
  }

  async deleteAnime(id: string): Promise<void> {
    await db.delete(anime).where(eq(anime.id, id));
  }

  async getFriends(userId: string): Promise<Friend[]> {
    return await db
      .select()
      .from(friends)
      .where(
        and(
          or(eq(friends.userId, userId), eq(friends.friendId, userId)),
          eq(friends.status, "accepted")
        )
      );
  }

  async getFriendRequests(userId: string): Promise<Friend[]> {
    return await db
      .select()
      .from(friends)
      .where(
        or(eq(friends.userId, userId), eq(friends.friendId, userId))
      );
  }

  async createFriendRequest(insertFriend: InsertFriend): Promise<Friend> {
    const [result] = await db
      .insert(friends)
      .values(insertFriend)
      .returning();
    return result;
  }

  async updateFriendStatus(id: string, status: string): Promise<Friend | undefined> {
    const [result] = await db
      .update(friends)
      .set({ status, updatedAt: new Date() })
      .where(eq(friends.id, id))
      .returning();
    return result || undefined;
  }

  async getFriendAnimeList(userId: string, friendId: string): Promise<Anime[]> {
    const friendship = await db
      .select()
      .from(friends)
      .where(
        and(
          or(
            and(eq(friends.userId, userId), eq(friends.friendId, friendId)),
            and(eq(friends.userId, friendId), eq(friends.friendId, userId))
          ),
          eq(friends.status, "accepted")
        )
      );
    
    if (friendship.length === 0) return [];
    
    return await db
      .select()
      .from(anime)
      .where(eq(anime.userId, friendId))
      .orderBy(asc(anime.ranking), desc(anime.createdAt));
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const [result] = await db
      .insert(notifications)
      .values(insertNotification)
      .returning();
    return result;
  }

  async markNotificationRead(id: string): Promise<void> {
    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id));
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, userId));
  }
}

export const storage = new DatabaseStorage();
