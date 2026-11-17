-- Spytify schema for a complete Supabase instance, including self-hosted Supabase.
-- This does not work on standalone PostgreSQL: the Supabase Storage schema and
-- anon/authenticated roles must already exist.
-- Run as a database admin after initializing the Supabase stack.
-- Configure Spytify with the instance URL and anon/publishable key. Never put the
-- service_role key in the desktop app.
--
-- WARNING: The app's current RLS policies allow public read/write access. Use only
-- on an instance you control and review the policies before exposing user data.

CREATE TABLE IF NOT EXISTS public.spytify_profiles (
    id TEXT PRIMARY KEY,
    username TEXT,
    display_name TEXT,
    email TEXT,
    password_hash TEXT,
    salt TEXT,
    google_id TEXT,
    avatar TEXT,
    accent_color TEXT DEFAULT '#FF2A55',
    theme_mode TEXT DEFAULT 'dark',
    language TEXT DEFAULT 'vi',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.spytify_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.spytify_profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.spytify_profiles ADD COLUMN IF NOT EXISTS salt TEXT;
ALTER TABLE public.spytify_profiles ADD COLUMN IF NOT EXISTS google_id TEXT;

CREATE TABLE IF NOT EXISTS public.spytify_albums (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    tracks JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_spytify_albums_user_id ON public.spytify_albums(user_id);

CREATE TABLE IF NOT EXISTS public.spytify_favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    track_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_spytify_favs_user_id ON public.spytify_favorites(user_id);

CREATE TABLE IF NOT EXISTS public.spytify_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    track_title TEXT NOT NULL,
    artist TEXT NOT NULL,
    source TEXT NOT NULL,
    duration_secs INTEGER NOT NULL,
    path_or_url TEXT,
    cover_art TEXT,
    track_json JSONB,
    listened_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_spytify_history_user_id ON public.spytify_history(user_id);

CREATE TABLE IF NOT EXISTS public.spytify_direct_messages (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    sender_username TEXT,
    sender_display_name TEXT,
    sender_avatar TEXT,
    content TEXT NOT NULL,
    track_embed JSONB,
    image_url TEXT,
    created_at TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.spytify_direct_messages ADD COLUMN IF NOT EXISTS image_url TEXT;
CREATE INDEX IF NOT EXISTS idx_spytify_dm_room_sent
    ON public.spytify_direct_messages(room_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_spytify_dm_receiver_sent
    ON public.spytify_direct_messages(receiver_id, sent_at DESC);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spytify_profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spytify_albums TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spytify_favorites TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spytify_history TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spytify_direct_messages TO anon, authenticated;

ALTER TABLE public.spytify_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spytify_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spytify_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spytify_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spytify_direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read-write for spytify_profiles" ON public.spytify_profiles;
CREATE POLICY "Allow public read-write for spytify_profiles"
    ON public.spytify_profiles FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public read-write for spytify_albums" ON public.spytify_albums;
CREATE POLICY "Allow public read-write for spytify_albums"
    ON public.spytify_albums FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public read-write for spytify_favorites" ON public.spytify_favorites;
CREATE POLICY "Allow public read-write for spytify_favorites"
    ON public.spytify_favorites FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public read-write for spytify_history" ON public.spytify_history;
CREATE POLICY "Allow public read-write for spytify_history"
    ON public.spytify_history FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public read-write for spytify_direct_messages" ON public.spytify_direct_messages;
CREATE POLICY "Allow public read-write for spytify_direct_messages"
    ON public.spytify_direct_messages FOR ALL USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('spytify-chat-files', 'spytify-chat-files', false, 1048576)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 1048576;

GRANT USAGE ON SCHEMA storage TO anon, authenticated;
GRANT SELECT, INSERT ON storage.objects TO anon, authenticated;
DROP POLICY IF EXISTS "Spytify chat files read" ON storage.objects;
CREATE POLICY "Spytify chat files read" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'spytify-chat-files');
DROP POLICY IF EXISTS "Spytify chat files upload" ON storage.objects;
CREATE POLICY "Spytify chat files upload" ON storage.objects
    FOR INSERT TO anon, authenticated
    WITH CHECK (bucket_id = 'spytify-chat-files');
