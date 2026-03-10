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
      .select('name')
      .eq('id', otherUserId)
      .single();
    
    return {
      id: friend.id,
      userId: friend.user_id,
      friendId: friend.friend_id,
      status: friend.status,
      friendName: profile?.name || 'Friend',
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
      .select('name')
      .eq('id', friend.user_id)
      .single();
    
    return {
      id: friend.id,
      userId: friend.user_id,
      friendId: friend.friend_id,
      status: friend.status,
      friendName: profile?.name || 'Friend',
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

export async function getProfileByShortId(shortId: string): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('short_id', shortId.toUpperCase())
    .single();

  if (error) return null;
  return data;
}
