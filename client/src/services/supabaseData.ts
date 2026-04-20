import { supabase } from '@/lib/supabase';

export interface AnimeData {
  id: string;
  title: string;
  episodesWatched: number;
  totalEpisodes: number | null;
  status: string;
  rating: number | null;
  notes: string | null;
  coverImage: string | null;
  seasonNumber: number;
  malId: number | null;
  anilistId: number | null;
  ranking: number | null;
  isHentai: boolean | null;
}

export interface FriendData {
  id: string;
  userId: string;
  friendId: string;
  status: string;
  friendName?: string;
}

export interface NotificationData {
  id: string;
  animeTitle: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  notificationType: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface WatchPresenceData {
  userId: string;
  animeTitle: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  updatedAt: string;
}

export interface UserPresenceData {
  userId: string;
  updatedAt: string;
}

function snakeToCamel(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (typeof obj !== 'object') return obj;

  const result: any = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = snakeToCamel(obj[key]);
  }
  return result;
}

function camelToSnake(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  if (typeof obj !== 'object') return obj;

  const result: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    result[snakeKey] = camelToSnake(obj[key]);
  }
  return result;
}

export async function getAnimeList(): Promise<AnimeData[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('anime')
    .select('*')
    .eq('user_id', user.id)
    .order('ranking', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return snakeToCamel(data || []);
}

export async function createAnime(animeList: Partial<AnimeData>[]): Promise<AnimeData[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const insertData = animeList.map(anime => ({
    ...camelToSnake(anime),
    user_id: user.id,
  }));

  const { data, error } = await supabase
    .from('anime')
    .insert(insertData)
    .select();

  if (error) throw error;
  return snakeToCamel(data || []);
}

export async function updateAnime(id: string, updates: Partial<AnimeData>): Promise<AnimeData> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const updateData = camelToSnake(updates);
  updateData.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('anime')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;
  return snakeToCamel(data);
}

export async function deleteAnime(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('anime')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function getFriends(): Promise<FriendData[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('friends')
    .select('*')
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
    .eq('status', 'accepted');

  if (error) throw error;

  const friendsWithNames = await Promise.all((data || []).map(async (friend) => {
    const otherUserId = friend.user_id === user.id ? friend.friend_id : friend.user_id;
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', otherUserId)
      .single();

    return {
      id: friend.id,
      userId: friend.user_id,
      friendId: friend.friend_id,
      status: friend.status,
      friendName: profile?.username || 'User',
    };
  }));

  return friendsWithNames;
}

export async function getFriendRequests(): Promise<FriendData[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('friends')
    .select('*')
    .eq('friend_id', user.id)
    .eq('status', 'pending');

  if (error) throw error;

  const requestsWithNames = await Promise.all((data || []).map(async (friend) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', friend.user_id)
      .single();

    return {
      id: friend.id,
      userId: friend.user_id,
      friendId: friend.friend_id,
      status: friend.status,
      friendName: profile?.username || 'User',
    };
  }));

  return requestsWithNames;
}

export async function sendFriendRequest(friendId: string): Promise<FriendData> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('friends')
    .insert({
      user_id: user.id,
      friend_id: friendId,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return snakeToCamel(data);
}

export async function updateFriendStatus(id: string, status: string): Promise<FriendData> {
  const { data, error } = await supabase
    .from('friends')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return snakeToCamel(data);
}

export async function getFriendAnimeList(friendId: string): Promise<AnimeData[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: friendship, error: friendError } = await supabase
    .from('friends')
    .select('*')
    .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`)
    .eq('status', 'accepted')
    .limit(1);

  if (friendError) throw friendError;
  if (!friendship || friendship.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('anime')
    .select('*')
    .eq('user_id', friendId)
    .order('ranking', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return snakeToCamel(data || []);
}

export async function getNotifications(): Promise<NotificationData[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return snakeToCamel(data || []);
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);

  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function logActivity(type: string, animeTitle: string, coverImage?: string | null, seasonNumber?: number, rating?: number | null): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const { error } = await supabase.from('activity_feed').insert({
      user_id: user.id,
      type,
      anime_title: animeTitle,
      cover_image: coverImage ?? null,
      season_number: seasonNumber ?? null,
      rating: rating ?? null,
    });
    if (error) return;

    // Fire-and-forget: notify friends
    (async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();

        const username = profile?.username || 'A friend';
        const actionMap: Record<string, string> = {
          added: `added "${animeTitle}" to their list`,
          started: `started watching "${animeTitle}"`,
          completed: `completed "${animeTitle}"!`,
          dropped: `dropped "${animeTitle}"`,
          rated: `rated "${animeTitle}" ${rating ?? ''}${rating ? '/10' : ''}`.trim(),
          watching: `is watching "${animeTitle}"`,
          plan_to_watch: `plans to watch "${animeTitle}"`,
        };
        const message = `${username} ${actionMap[type] || `updated "${animeTitle}"`}`;

        const { data: friendRows } = await supabase
          .from('friends')
          .select('user_id, friend_id')
          .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
          .eq('status', 'accepted');

        for (const friend of friendRows || []) {
          const recipientId = friend.user_id === user.id ? friend.friend_id : friend.user_id;
          await supabase.from('notifications').insert({
            user_id: recipientId,
            anime_title: animeTitle,
            season_number: seasonNumber ?? null,
            episode_number: null,
            notification_type: 'friend_activity',
            message,
            read: false,
          });
        }
      } catch { /* ignore notification errors */ }
    })();
  } catch { /* fire-and-forget */ }
}

export async function getFriendsActivity(friendIds: string[]): Promise<any[]> {
  if (friendIds.length === 0) return [];
  try {
    const { data, error } = await supabase
      .from('activity_feed')
      .select('*, profiles(username)')
      .in('user_id', friendIds)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return [];

    return (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      username: row.profiles?.username || 'User',
      type: row.type,
      animeTitle: row.anime_title,
      coverImage: row.cover_image,
      seasonNumber: row.season_number,
      rating: row.rating,
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}

export async function upsertWatchPresence(data: {
  animeTitle: string;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const payload = {
    user_id: user.id,
    anime_title: data.animeTitle,
    season_number: data.seasonNumber ?? null,
    episode_number: data.episodeNumber ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("watch_presence")
    .upsert(payload, { onConflict: "user_id" });
  // Some projects keep strict RLS on presence tables. Treat auth/policy denial as non-fatal.
  if (error) {
    const status = (error as any).status;
    if (status === 401 || status === 403) return;
    throw error;
  }
}

export async function getFriendsWatchPresence(friendIds: string[]): Promise<WatchPresenceData[]> {
  if (friendIds.length === 0) return [];
  const { data, error } = await supabase
    .from("watch_presence")
    .select("*")
    .in("user_id", friendIds);
  if (error) throw error;
  return snakeToCamel(data || []);
}

export async function upsertUserPresence(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("user_presence")
    .upsert(
      { user_id: user.id, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  // Some projects keep strict RLS on presence tables. Treat auth/policy denial as non-fatal.
  if (error) {
    const status = (error as any).status;
    if (status === 401 || status === 403) return;
    throw error;
  }
}

export async function getFriendsUserPresence(friendIds: string[]): Promise<UserPresenceData[]> {
  if (friendIds.length === 0) return [];
  const { data, error } = await supabase
    .from("user_presence")
    .select("*")
    .in("user_id", friendIds);
  if (error) throw error;
  return snakeToCamel(data || []);
}

export async function getProfileByShortId(shortId: string): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('short_id', shortId.toLowerCase())
    .single();

  if (error) return null;
  return data ? { id: data.id, name: data.username || 'User' } : null;
}
