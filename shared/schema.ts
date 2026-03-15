import { pgTable, text, integer, boolean, timestamp, uuid, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email"),
  username: text("username"),
  shortId: text("short_id").unique().notNull().default(sql`substr(gen_random_uuid()::text, 1, 5)`),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const anime = pgTable("anime", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  episodesWatched: integer("episodes_watched").default(0).notNull(),
  totalEpisodes: integer("total_episodes"),
  status: text("status").default("watching").notNull(),
  rating: integer("rating"),
  notes: text("notes"),
  coverImage: text("cover_image"),
  seasonNumber: integer("season_number").default(1),
  malId: integer("mal_id"),
  anilistId: integer("anilist_id"),
  migrationStatus: text("migration_status").default("pending"),
  latestEpisode: integer("latest_episode").default(0),
  nextAiringAt: integer("next_airing_at"),
  ranking: integer("ranking"),
  isHentai: boolean("is_hentai").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_anime_user_id").on(table.userId),
  index("idx_anime_status").on(table.status),
  index("idx_anime_mal_id").on(table.malId),
  index("idx_anime_anilist_id").on(table.anilistId),
  index("idx_anime_ranking").on(table.userId, table.ranking),
  index("idx_anime_is_hentai").on(table.userId, table.isHentai),
]);

export const friends = pgTable("friends", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  friendId: uuid("friend_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_friends_user_id").on(table.userId),
  index("idx_friends_friend_id").on(table.friendId),
  index("idx_friends_status").on(table.status),
]);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  animeId: uuid("anime_id").references(() => anime.id, { onDelete: "cascade" }),
  animeTitle: text("anime_title").notNull(),
  seasonNumber: integer("season_number"),
  episodeNumber: integer("episode_number"),
  notificationType: text("notification_type").notNull(),
  message: text("message").notNull(),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_notifications_user_id").on(table.userId),
  index("idx_notifications_read").on(table.userId, table.read),
]);

export const activityFeed = pgTable("activity_feed", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'added' | 'completed' | 'dropped' | 'rated' | 'started'
  animeTitle: text("anime_title").notNull(),
  coverImage: text("cover_image"),
  seasonNumber: integer("season_number"),
  rating: integer("rating"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_activity_feed_user_id").on(table.userId),
  index("idx_activity_feed_created_at").on(table.createdAt),
]);

export const profilesRelations = relations(profiles, ({ many }) => ({
  anime: many(anime),
  sentFriendRequests: many(friends, { relationName: "sentRequests" }),
  receivedFriendRequests: many(friends, { relationName: "receivedRequests" }),
  notifications: many(notifications),
}));

export const animeRelations = relations(anime, ({ one }) => ({
  user: one(profiles, {
    fields: [anime.userId],
    references: [profiles.id],
  }),
}));

export const friendsRelations = relations(friends, ({ one }) => ({
  user: one(profiles, {
    fields: [friends.userId],
    references: [profiles.id],
    relationName: "sentRequests",
  }),
  friend: one(profiles, {
    fields: [friends.friendId],
    references: [profiles.id],
    relationName: "receivedRequests",
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(profiles, {
    fields: [notifications.userId],
    references: [profiles.id],
  }),
  anime: one(anime, {
    fields: [notifications.animeId],
    references: [anime.id],
  }),
}));

export const insertProfileSchema = createInsertSchema(profiles).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertAnimeSchema = createInsertSchema(anime).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFriendSchema = createInsertSchema(friends).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Anime = typeof anime.$inferSelect;
export type InsertAnime = z.infer<typeof insertAnimeSchema>;
export type Friend = typeof friends.$inferSelect;
export type InsertFriend = z.infer<typeof insertFriendSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
