-- Run this SQL in your Supabase Dashboard -> SQL Editor

-- Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  username TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create anime table if it doesn't exist
CREATE TABLE IF NOT EXISTS anime (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  episodes_watched INTEGER DEFAULT 0 NOT NULL,
  total_episodes INTEGER,
  status TEXT DEFAULT 'watching' NOT NULL,
  rating INTEGER,
  notes TEXT,
  cover_image TEXT,
  season_number INTEGER DEFAULT 1,
  mal_id INTEGER,
  anilist_id INTEGER,
  migration_status TEXT DEFAULT 'pending',
  latest_episode INTEGER DEFAULT 0,
  next_airing_at INTEGER,
  ranking INTEGER,
  is_hentai BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create friends table if it doesn't exist
CREATE TABLE IF NOT EXISTS friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  anime_id UUID REFERENCES anime(id) ON DELETE CASCADE,
  anime_title TEXT NOT NULL,
  season_number INTEGER,
  episode_number INTEGER,
  notification_type TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_anime_user_id ON anime(user_id);
CREATE INDEX IF NOT EXISTS idx_anime_status ON anime(status);
CREATE INDEX IF NOT EXISTS idx_anime_mal_id ON anime(mal_id);
CREATE INDEX IF NOT EXISTS idx_anime_anilist_id ON anime(anilist_id);
CREATE INDEX IF NOT EXISTS idx_anime_ranking ON anime(user_id, ranking);
CREATE INDEX IF NOT EXISTS idx_anime_is_hentai ON anime(user_id, is_hentai);
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friends_status ON friends(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE anime ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view public profiles" ON profiles;

DROP POLICY IF EXISTS "Users can view own anime" ON anime;
DROP POLICY IF EXISTS "Users can insert own anime" ON anime;
DROP POLICY IF EXISTS "Users can update own anime" ON anime;
DROP POLICY IF EXISTS "Users can delete own anime" ON anime;
DROP POLICY IF EXISTS "Users can view friend anime" ON anime;

DROP POLICY IF EXISTS "Users can view own friends" ON friends;
DROP POLICY IF EXISTS "Users can insert friend requests" ON friends;
DROP POLICY IF EXISTS "Users can update friend status" ON friends;
DROP POLICY IF EXISTS "Users can view received requests" ON friends;

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;

-- PROFILES policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view public profiles" ON profiles
  FOR SELECT USING (true);

-- ANIME policies
CREATE POLICY "Users can view own anime" ON anime
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own anime" ON anime
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own anime" ON anime
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own anime" ON anime
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view friend anime" ON anime
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM friends 
      WHERE friends.status = 'accepted' 
      AND ((friends.user_id = auth.uid() AND friends.friend_id = anime.user_id)
        OR (friends.friend_id = auth.uid() AND friends.user_id = anime.user_id))
    )
  );

-- FRIENDS policies
CREATE POLICY "Users can view own friends" ON friends
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can insert friend requests" ON friends
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update friend status" ON friends
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- NOTIFICATIONS policies
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert notifications" ON notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create a function to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
