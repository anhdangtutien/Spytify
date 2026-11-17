import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { invoke } from '@tauri-apps/api/core';
import { UserAlbum, Track, HistoryItem, User, CommunityFileAttachment } from '../types';

const DEFAULT_URL = import.meta.env.VITE_SUPABASE_URL || '';
const DEFAULT_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function cleanSupabaseUrl(raw: string): string {
  if (!raw) return '';
  let clean = raw.trim();
  clean = clean.replace(/\/+$/, '');
  clean = clean.replace(/\/rest\/v1\/?$/, '');
  return clean.replace(/\/+$/, '');
}

/**
 * Returns active config: uses custom user-provided database if configured,
 * otherwise transparently falls back to system default.
 */
export function getStoredSupabaseConfig(): SupabaseConfig {
  const customUrl = localStorage.getItem('spytify_supabase_url');
  const customKey = localStorage.getItem('spytify_supabase_anon_key');

  if (customUrl && customKey && !customUrl.includes('example-spytify')) {
    return {
      url: cleanSupabaseUrl(customUrl),
      anonKey: customKey.trim(),
    };
  }

  return {
    url: DEFAULT_URL,
    anonKey: DEFAULT_ANON_KEY,
  };
}

/**
 * Returns ONLY custom user-provided database settings.
 * If user hasn't set custom database, returns empty strings so system default
 * keys are NEVER leaked or visible in the UI form fields!
 */
export function getCustomSupabaseConfig(): { url: string; anonKey: string; isCustom: boolean } {
  const customUrl = localStorage.getItem('spytify_supabase_url') || '';
  const customKey = localStorage.getItem('spytify_supabase_anon_key') || '';
  const isCustom = Boolean(customUrl && customKey && !customUrl.includes('example-spytify'));
  return {
    url: isCustom ? customUrl : '',
    anonKey: isCustom ? customKey : '',
    isCustom,
  };
}

export function saveStoredSupabaseConfig(url: string, anonKey: string): void {
  const cleanedUrl = cleanSupabaseUrl(url);
  if (cleanedUrl && anonKey.trim()) {
    localStorage.setItem('spytify_supabase_url', cleanedUrl);
    localStorage.setItem('spytify_supabase_anon_key', anonKey.trim());
  } else {
    localStorage.removeItem('spytify_supabase_url');
    localStorage.removeItem('spytify_supabase_anon_key');
  }
  cachedClient = null; // Reset client
}

export function resetToDefaultSupabase(): void {
  localStorage.removeItem('spytify_supabase_url');
  localStorage.removeItem('spytify_supabase_anon_key');
  cachedClient = null;
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const config = getStoredSupabaseConfig();
  if (!config.url || !config.anonKey || config.url.includes('example-spytify')) {
    return null;
  }

  try {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseClient() !== null;
}

export const SUPABASE_SCHEMA_SQL = `-- 🕵️‍♂️ SPYTIFY SPEC-OPS // SUPABASE CLOUD DATABASE SCHEMA
CREATE TABLE IF NOT EXISTS public.spytify_profiles (
    id TEXT PRIMARY KEY,
    username TEXT,
    display_name TEXT,
    email TEXT,
    password_hash TEXT,
    salt TEXT,
    google_id TEXT,
    avatar TEXT,
    bio TEXT,
    accent_color TEXT DEFAULT '#FF2A55',
    theme_mode TEXT DEFAULT 'dark',
    language TEXT DEFAULT 'vi',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Backward-compatibility migrations for existing tables
ALTER TABLE public.spytify_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.spytify_profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.spytify_profiles ADD COLUMN IF NOT EXISTS salt TEXT;
ALTER TABLE public.spytify_profiles ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE public.spytify_profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.spytify_profiles ADD COLUMN IF NOT EXISTS thought TEXT;

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

ALTER TABLE public.spytify_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spytify_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spytify_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spytify_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read-write for spytify_profiles" ON public.spytify_profiles;
CREATE POLICY "Allow public read-write for spytify_profiles" ON public.spytify_profiles FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public read-write for spytify_albums" ON public.spytify_albums;
CREATE POLICY "Allow public read-write for spytify_albums" ON public.spytify_albums FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public read-write for spytify_favorites" ON public.spytify_favorites;
CREATE POLICY "Allow public read-write for spytify_favorites" ON public.spytify_favorites FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public read-write for spytify_history" ON public.spytify_history;
CREATE POLICY "Allow public read-write for spytify_history" ON public.spytify_history FOR ALL USING (true) WITH CHECK (true);

-- Bảng lưu tin nhắn riêng (Direct Messages 1-1), tự động giới hạn tối đa 80 tin nhắn gần nhất mỗi phòng
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
CREATE INDEX IF NOT EXISTS idx_spytify_dm_room_sent ON public.spytify_direct_messages(room_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_spytify_dm_receiver_sent ON public.spytify_direct_messages(receiver_id, sent_at DESC);
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spytify_profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spytify_albums TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spytify_favorites TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spytify_history TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spytify_direct_messages TO anon, authenticated;
ALTER TABLE public.spytify_direct_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write for spytify_direct_messages" ON public.spytify_direct_messages;
CREATE POLICY "Allow public read-write for spytify_direct_messages" ON public.spytify_direct_messages FOR ALL USING (true) WITH CHECK (true);

-- Private storage for files shared in server chat (maximum 1 MiB per file)
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
`;

export const MAX_CHAT_FILE_SIZE = 1024 * 1024;
const CHAT_FILES_BUCKET = 'spytify-chat-files';
const FILE_ATTACHMENT_CONTENT_PREFIX = '\u001fspytify-file-v1:';

export async function uploadChatFile(
  serverId: string,
  channelId: string,
  file: File
): Promise<CommunityFileAttachment> {
  if (file.size > MAX_CHAT_FILE_SIZE) {
    throw new Error('Tệp vượt quá giới hạn 1 MiB.');
  }
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Chưa kết nối được Supabase để tải tệp lên.');
  }

  const safeName = file.name.replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 180) || 'file';
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const storagePath = `${encodeURIComponent(serverId)}/${encodeURIComponent(channelId)}/${id}-${safeName}`;
  const { error } = await client.storage.from(CHAT_FILES_BUCKET).upload(storagePath, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) {
    const setupHint = /bucket not found/i.test(error.message)
      ? ' Hãy chạy lại SQL cài đặt Supabase trong phần Cài đặt.'
      : '';
    throw new Error(`Không tải được tệp lên: ${error.message}.${setupHint}`);
  }

  return {
    name: file.name,
    mime_type: file.type || 'application/octet-stream',
    size: file.size,
    storage_path: storagePath,
  };
}

export async function downloadChatFile(storagePath: string): Promise<Blob> {
  if (!storagePath || storagePath.startsWith('/') || storagePath.split('/').includes('..')) {
    throw new Error('Đường dẫn tệp không hợp lệ.');
  }
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Chưa kết nối được Supabase để tải tệp xuống.');
  }
  const { data, error } = await client.storage.from(CHAT_FILES_BUCKET).download(storagePath);
  if (error || !data) {
    throw new Error(`Không tải được tệp: ${error?.message || 'Không tìm thấy tệp.'}`);
  }
  return data;
}

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Chưa cấu hình URL hoặc Anon Key hợp lệ.' };
  }
  try {
    const { error } = await client.from('spytify_profiles').select('id, password_hash').limit(1);
    if (error) {
      if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
        return {
          success: false,
          message: 'Kết nối được nhưng các bảng chưa được tạo. Hãy bấm "Sao chép mã SQL" và chạy trong Supabase SQL Editor.',
        };
      }
      if (error.message.includes('password_hash') || error.code === 'PGRST204') {
        return {
          success: false,
          message: 'Bảng spytify_profiles đang thiếu cột đồng bộ tài khoản (password_hash). Hãy chạy câu lệnh ALTER TABLE trong Supabase SQL Editor.',
        };
      }
      return { success: false, message: `Lỗi kết nối Supabase: ${error.message}` };
    }
    return { success: true, message: '🟢 Kết nối đám mây Supabase thành công và các bảng đã sẵn sàng!' };
  } catch (err: any) {
    return { success: false, message: `Không thể kết nối máy chủ: ${err?.message || err}` };
  }
}

// ──────────────── CLOUD DATA SYNC OPERATIONS ────────────────

export interface CloudUserData {
  albums: UserAlbum[];
  favorites: Track[];
  history?: HistoryItem[];
  username?: string;
  displayName?: string;
  email?: string;
  avatar?: string;
  bio?: string;
  thought?: string;
  accentColor?: string;
  themeMode?: 'dark' | 'light';
  language?: string;
}

/**
 * Registers / Syncs user account credentials to Supabase Cloud
 */
export async function cloudRegisterUser(
  user: User,
  email: string | null,
  passwordHash: string,
  salt: string
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !user) return false;

  try {
    const { data: existingProfile, error: existingProfileError } = await client
      .from('spytify_profiles')
      .select('avatar, bio, thought')
      .eq('id', user.id)
      .maybeSingle();
    if (existingProfileError) throw existingProfileError;

    const { error } = await client.from('spytify_profiles').upsert({
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      email: email || null,
      password_hash: passwordHash,
      salt: salt,
      avatar: existingProfile ? existingProfile.avatar : user.avatar || null,
      ...(existingProfile
        ? { bio: existingProfile.bio, thought: existingProfile.thought }
        : user.bio !== undefined
          ? { bio: user.bio, thought: user.thought ?? user.custom_status ?? null }
          : {}),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase cloudRegisterUser warning:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase cloudRegisterUser error:', err);
    return false;
  }
}

/**
 * Authenticates user against Supabase Cloud when local device SQLite does not have the account
 */
export async function cloudLoginUser(identifier: string, passwordPlain: string): Promise<User | null> {
  const client = getSupabaseClient();
  if (!client || !identifier) return null;

  try {
    const cleanId = identifier.trim().toLowerCase();
    const { data: profile, error } = await client
      .from('spytify_profiles')
      .select('*')
      .or(`username.ilike.${cleanId},email.ilike.${cleanId}`)
      .maybeSingle();

    if (error || !profile) {
      return null;
    }

    if (!profile.password_hash || !profile.salt) {
      return null;
    }

    // Verify password hash
    const computedHash = await invoke<string>('auth_hash_password', {
      password: passwordPlain,
      salt: profile.salt,
    });

    if (computedHash !== profile.password_hash) {
      return null;
    }

    // Password matches! Import into local SQLite so it works offline
    const importedUser = await invoke<User>('auth_import_user', {
      id: profile.id,
      username: profile.username || cleanId,
      email: profile.email || null,
      passwordHash: profile.password_hash,
      salt: profile.salt,
      displayName: profile.display_name || profile.username || cleanId,
      avatar: profile.avatar || null,
    });

    return importedUser;
  } catch (err) {
    console.error('Supabase cloudLoginUser error:', err);
    return null;
  }
}

/**
 * Pushes local data (albums, favorites, history, avatar, settings) to Supabase Cloud
 */
export async function cloudSyncPush(userId: string, data: Partial<CloudUserData>): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !userId) return false;

  try {
    // 1. Sync User Profile / Settings
    const profilePayload: Record<string, any> = {
      id: userId,
      updated_at: new Date().toISOString(),
    };
    if (data.username) profilePayload.username = data.username;
    if (data.displayName) profilePayload.display_name = data.displayName;
    if (data.email) profilePayload.email = data.email;
    if (data.avatar !== undefined) profilePayload.avatar = data.avatar;
    if (data.bio !== undefined) profilePayload.bio = data.bio;
    if (data.thought !== undefined) profilePayload.thought = data.thought;
    if (data.accentColor) profilePayload.accent_color = data.accentColor;
    if (data.themeMode) profilePayload.theme_mode = data.themeMode;

    if (Object.keys(profilePayload).length > 2) {
      const { error } = await client.from('spytify_profiles').upsert(profilePayload, { onConflict: 'id' });
      if (error) throw error;
    }

    // 2. Sync Albums
    if (data.albums) {
      const albumRows = data.albums.map(a => ({
        id: a.id,
        user_id: userId,
        title: a.title,
        description: a.description || '',
        tracks: a.tracks,
        updated_at: new Date().toISOString(),
      }));

      if (albumRows.length > 0) {
        await client.from('spytify_albums').upsert(albumRows, { onConflict: 'id' });
      }
    }

    // 3. Sync Favorites
    if (data.favorites) {
      const favRows = data.favorites.map(t => ({
        id: `${userId}_${t.id}`,
        user_id: userId,
        track_id: t.id,
        track_json: t,
        updated_at: new Date().toISOString(),
      }));

      if (favRows.length > 0) {
        await client.from('spytify_favorites').upsert(favRows, { onConflict: 'id' });
      }
    }

    // 4. Sync History (Top 30 most recent tracks with cover_art & path_or_url)
    if (data.history && data.history.length > 0) {
      const histRows = data.history.slice(0, 30).map((h, i) => {
        let coverArt = (h as any).cover_art || null;
        let pathOrUrl = h.path_or_url || h.track_id;
        let fullTrack: any = null;

        if (h.track_json) {
          try {
            fullTrack = typeof h.track_json === 'string' ? JSON.parse(h.track_json) : h.track_json;
            coverArt = coverArt || fullTrack.cover_art;
            pathOrUrl = pathOrUrl || fullTrack.path_or_url;
          } catch {}
        }

        return {
          id: `${userId}_hist_${h.track_id}_${i}`,
          user_id: userId,
          track_id: h.track_id,
          track_title: h.track_title,
          artist: h.artist,
          source: h.source,
          duration_secs: h.duration_secs,
          path_or_url: pathOrUrl,
          cover_art: coverArt,
          track_json: fullTrack || h.track_json,
          listened_at: h.listened_at || new Date().toISOString(),
        };
      });

      if (histRows.length > 0) {
        await client.from('spytify_history').upsert(histRows, { onConflict: 'id' });
      }
    }

    return true;
  } catch (err) {
    console.error('Supabase cloud push failed:', err);
    return false;
  }
}

/**
 * Pulls all user data (albums, favorites, history, avatar, settings) from Supabase Cloud
 */
export async function cloudSyncPull(userId: string): Promise<CloudUserData | null> {
  const client = getSupabaseClient();
  if (!client || !userId) return null;

  try {
    const [profileRes, albumsRes, favsRes, histRes] = await Promise.all([
      client.from('spytify_profiles').select('*').eq('id', userId).maybeSingle(),
      client.from('spytify_albums').select('*').eq('user_id', userId),
      client.from('spytify_favorites').select('*').eq('user_id', userId),
      client.from('spytify_history').select('*').eq('user_id', userId).order('listened_at', { ascending: false }).limit(30),
    ]);

    const result: CloudUserData = {
      albums: [],
      favorites: [],
      history: [],
    };

    if (profileRes.data) {
      result.avatar = profileRes.data.avatar || undefined;
      result.bio = profileRes.data.bio ?? undefined;
      result.thought = profileRes.data.thought ?? undefined;
      result.accentColor = profileRes.data.accent_color || undefined;
      result.themeMode = profileRes.data.theme_mode || undefined;
      result.language = profileRes.data.language || undefined;
    }

    if (albumsRes.data) {
      result.albums = albumsRes.data.map((row: any) => ({
        id: row.id,
        title: row.title,
        description: row.description || '',
        tracks: row.tracks || [],
        created_at: row.created_at || new Date().toISOString(),
      }));
    }

    if (favsRes.data) {
      result.favorites = favsRes.data.map((row: any) => row.track_json as Track).filter(Boolean);
    }

    if (histRes.data) {
      result.history = histRes.data.map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        track_id: row.track_id,
        track_title: row.track_title,
        artist: row.artist,
        source: row.source,
        duration_secs: row.duration_secs,
        path_or_url: row.path_or_url,
        cover_art: row.cover_art,
        track_json: row.track_json ? (typeof row.track_json === 'string' ? row.track_json : JSON.stringify(row.track_json)) : undefined,
        listened_at: row.listened_at,
      }));
    }

    return result;
  } catch (err) {
    console.error('Supabase cloud pull failed:', err);
    return null;
  }
}

export const MAX_CHAT_MESSAGES_LIMIT = 80;

export interface CloudDirectMessageRow {
  id: string;
  room_id: string;
  sender_id: string;
  receiver_id: string;
  sender_username: string;
  sender_display_name: string;
  sender_avatar?: string | null;
  content: string;
  track_embed?: Track | null;
  image_url?: string | null;
  file_attachment?: CommunityFileAttachment | null;
  created_at: string;
  sent_at?: string;
}

function encodeCloudMessageContent(msg: CloudDirectMessageRow): string {
  if (!msg.file_attachment) return msg.content;
  return `${FILE_ATTACHMENT_CONTENT_PREFIX}${JSON.stringify({
    content: msg.content,
    file_attachment: msg.file_attachment,
  })}`;
}

function decodeCloudMessage(row: CloudDirectMessageRow): CloudDirectMessageRow {
  if (!row.content.startsWith(FILE_ATTACHMENT_CONTENT_PREFIX)) return row;
  try {
    const payload = JSON.parse(row.content.slice(FILE_ATTACHMENT_CONTENT_PREFIX.length));
    if (
      typeof payload.content !== 'string' ||
      typeof payload.file_attachment?.name !== 'string' ||
      typeof payload.file_attachment?.mime_type !== 'string' ||
      typeof payload.file_attachment?.storage_path !== 'string' ||
      typeof payload.file_attachment?.size !== 'number' ||
      payload.file_attachment.size < 0 ||
      payload.file_attachment.size > MAX_CHAT_FILE_SIZE
    ) {
      return row;
    }
    return {
      ...row,
      content: payload.content,
      file_attachment: payload.file_attachment as CommunityFileAttachment,
    };
  } catch {
    return row;
  }
}

/**
 * Fetches up to the latest 80 direct messages for a 1-on-1 room from Supabase Cloud (if table exists)
 */
export async function fetchCloudDirectMessages(roomId: string): Promise<CloudDirectMessageRow[]> {
  const client = getSupabaseClient();
  if (!client || !roomId) return [];
  try {
    const { data, error } = await client
      .from('spytify_direct_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('sent_at', { ascending: false })
      .limit(MAX_CHAT_MESSAGES_LIMIT);
    if (error || !data) return [];
    return (data as CloudDirectMessageRow[]).reverse().map(decodeCloudMessage);
  } catch {
    return [];
  }
}

/**
 * Fetches recent incoming 1-on-1 direct messages sent to receiverId so we can detect unread messages
 */
export async function fetchIncomingCloudDirectMessages(
  receiverId: string,
  since?: string
): Promise<CloudDirectMessageRow[]> {
  const client = getSupabaseClient();
  if (!client || !receiverId) return [];
  try {
    let query = client
      .from('spytify_direct_messages')
      .select('id, room_id, sender_id, receiver_id, sender_username, sender_display_name, content, track_embed, created_at, sent_at')
      .eq('receiver_id', receiverId)
      .like('room_id', 'dm_%')
      .neq('sender_id', receiverId);
    if (since) {
      query = query.gt('sent_at', since).order('sent_at', { ascending: true });
    } else {
      query = query.order('sent_at', { ascending: false });
    }
    const { data, error } = await query.limit(MAX_CHAT_MESSAGES_LIMIT);
    if (error || !data) return [];
    const rows = data as CloudDirectMessageRow[];
    return (since ? rows : rows.reverse()).map(decodeCloudMessage);
  } catch {
    return [];
  }
}

/**
 * Saves a direct message to Supabase Cloud and prunes older messages beyond the latest 80 for that room
 */
export async function pushCloudDirectMessage(msg: CloudDirectMessageRow): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Chưa kết nối được Supabase.');
  if (!msg.room_id) throw new Error('Phòng chat không hợp lệ.');
  try {
    const row = { ...msg };
    delete row.file_attachment;
    let { error } = await client.from('spytify_direct_messages').upsert(
      {
        ...row,
        content: encodeCloudMessageContent(msg),
        sent_at: msg.sent_at || new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error && Object.prototype.hasOwnProperty.call(msg, 'image_url')) {
      const withoutOptionalFields = { ...msg };
      delete withoutOptionalFields.image_url;
      delete withoutOptionalFields.file_attachment;
      const res = await client.from('spytify_direct_messages').upsert(
        {
          ...withoutOptionalFields,
          content: encodeCloudMessageContent(msg),
          sent_at: msg.sent_at || new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
      error = res.error;
    }
    if (error) throw new Error(error.message);

    // Giữ tối đa 80 tin nhắn gần nhất cho mỗi room_id để tránh quá tải database
    const { data: oldRows } = await client
      .from('spytify_direct_messages')
      .select('id')
      .eq('room_id', msg.room_id)
      .order('sent_at', { ascending: false })
      .range(MAX_CHAT_MESSAGES_LIMIT, MAX_CHAT_MESSAGES_LIMIT + 100);

    if (oldRows && oldRows.length > 0) {
      const idsToDelete = oldRows.map((r: any) => r.id);
      await client.from('spytify_direct_messages').delete().in('id', idsToDelete);
    }
  } catch (error) {
    throw error instanceof Error ? error : new Error('Không lưu được tin nhắn lên Supabase.');
  }
}

// ──────────────── CLOUD PROFILES & FOLLOW / FRIEND REQUEST SYNC ────────────────

export interface CloudPublicProfile {
  id: string;
  username: string;
  display_name: string;
  avatar: string | null;
  bio: string | null;
  thought?: string | null;
}

export interface CloudProfileUpdate extends CloudPublicProfile {
  updated_at: string;
}

/**
 * Fetches profile metadata without avatar blobs to keep periodic cloud sync egress small.
 */
export async function fetchAllCloudProfiles(): Promise<CloudPublicProfile[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from('spytify_profiles')
      .select('id, username, display_name, bio, thought')
      .limit(200);
    if (error || !data) return [];
    return data.map((row: any) => ({
      id: row.id,
      username: row.username || 'operative',
      display_name: row.display_name || row.username || 'Operative',
      avatar: null,
      bio: row.bio || null,
      thought: row.thought || null,
    }));
  } catch {
    return [];
  }
}

export async function fetchCloudProfilesByIds(userIds: string[]): Promise<CloudPublicProfile[]> {
  const client = getSupabaseClient();
  const ids = Array.from(new Set(userIds.filter(id => id && !id.startsWith('usr_custom_') && id !== 'usr_me')));
  if (!client || ids.length === 0) return [];

  const { data, error } = await client
    .from('spytify_profiles')
    .select('id, username, display_name, avatar, bio, thought')
    .in('id', ids);
  if (error) throw new Error(`Không thể tải hồ sơ thành viên: ${error.message}`);
  return (data || []).map((row: any) => ({
    id: row.id,
    username: row.username || 'operative',
    display_name: row.display_name || row.username || 'Operative',
    avatar: row.avatar || null,
    bio: row.bio ?? null,
    thought: row.thought ?? null,
  }));
}

export async function fetchCloudProfileUpdatesSince(since: string): Promise<CloudProfileUpdate[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from('spytify_profiles')
    .select('id, username, display_name, avatar, bio, thought, updated_at')
    .gt('updated_at', since)
    .order('updated_at', { ascending: true })
    .limit(1000);
  if (error) throw new Error(`Không thể đồng bộ cập nhật hồ sơ: ${error.message}`);
  return (data || []).map((row: any) => ({
    id: row.id,
    username: row.username || 'operative',
    display_name: row.display_name || row.username || 'Operative',
    avatar: row.avatar || null,
    bio: row.bio ?? null,
    thought: row.thought ?? null,
    updated_at: row.updated_at,
  }));
}

export interface CloudFollowEdge {
  followerId: string;
  targetId: string;
  followerUsername: string;
  followerDisplayName: string;
  followerAvatar: string | null;
  createdAt: string;
}

const FOLLOW_GRAPH_ROOM_ID = 'spytify_follow_graph';

/**
 * Fetches all follow / friend request edges involving `userId` (either as follower or target)
 */
export async function fetchCloudFollowGraph(userId: string): Promise<{
  myFollowingIds: string[];
  followersOfMe: CloudFollowEdge[];
}> {
  const client = getSupabaseClient();
  if (!client || !userId) return { myFollowingIds: [], followersOfMe: [] };
  try {
    const { data, error } = await client
      .from('spytify_direct_messages')
      .select('sender_id, receiver_id, sender_username, sender_display_name, created_at')
      .eq('room_id', FOLLOW_GRAPH_ROOM_ID)
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    if (error || !data) return { myFollowingIds: [], followersOfMe: [] };

    const myFollowingIds: string[] = [];
    const followersOfMe: CloudFollowEdge[] = [];

    for (const row of data as any[]) {
      if (row.sender_id === userId && row.receiver_id) {
        myFollowingIds.push(row.receiver_id);
      } else if (row.receiver_id === userId && row.sender_id) {
        followersOfMe.push({
          followerId: row.sender_id,
          targetId: row.receiver_id,
          followerUsername: row.sender_username || 'operative',
          followerDisplayName: row.sender_display_name || row.sender_username || 'Operative',
          followerAvatar: null,
          createdAt: row.created_at || '',
        });
      }
    }

    return { myFollowingIds, followersOfMe };
  } catch {
    return { myFollowingIds: [], followersOfMe: [] };
  }
}

/**
 * Records a follow / friend request from `follower` to `targetId` in Supabase Cloud
 */
export async function pushCloudFollow(
  follower: { id: string; username: string; display_name: string; avatar?: string | null },
  targetId: string
): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !follower?.id || !targetId || follower.id === targetId) return;
  try {
    await client.from('spytify_direct_messages').upsert(
      {
        id: `follow_${follower.id}_${targetId}`,
        room_id: FOLLOW_GRAPH_ROOM_ID,
        sender_id: follower.id,
        receiver_id: targetId,
        sender_username: follower.username,
        sender_display_name: follower.display_name,
        sender_avatar: follower.avatar || null,
        content: 'FOLLOW',
        created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sent_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
  } catch {}
}

/**
 * Removes a follow / friend request edge from `followerId` to `targetId` in Supabase Cloud
 */
export async function removeCloudFollow(followerId: string, targetId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !followerId || !targetId) return;
  try {
    await client
      .from('spytify_direct_messages')
      .delete()
      .eq('id', `follow_${followerId}_${targetId}`);
  } catch {}
}

// ============================================================================
// CLOUD SERVER REGISTRY & SERVER INVITE SYSTEM
// ============================================================================

const SERVERS_REGISTRY_ROOM_ID = 'spytify_servers_registry';
const SERVER_INVITES_ROOM_ID = 'spytify_server_invites';

export interface CloudServerInvite {
  id: string;
  serverId: string;
  serverName: string;
  serverIcon: string;
  serverColor: string;
  inviterId: string;
  inviterUsername: string;
  inviterDisplayName: string;
  inviterAvatar?: string | null;
  targetUserId: string;
  createdAt: string;
}

/**
 * Syncs a custom CommunityServer definition to Supabase Cloud so invite links
 * (`spytify://station/join/...`) and invited members can load and join the server across accounts.
 */
export async function pushCloudServer(server: any): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !server?.id || server.id === 'srv_none') return false;
  try {
    const { error } = await client.from('spytify_direct_messages').upsert(
      {
        id: `srv_reg_${server.id}`,
        room_id: SERVERS_REGISTRY_ROOM_ID,
        sender_id: server.owner_id || 'usr_me',
        receiver_id: server.id,
        sender_username: server.name || 'Server',
        sender_display_name: server.name || 'Server',
        sender_avatar: server.icon || '🎧',
        content: JSON.stringify(server),
        created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sent_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('Supabase cloud server sync failed:', error);
    return false;
  }
}

export async function deleteCloudServer(serverId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !serverId) return;
  try {
    await client
      .from('spytify_direct_messages')
      .delete()
      .eq('id', `srv_reg_${serverId}`);
  } catch {}
}

export async function fetchCloudServerById(serverId: string): Promise<any | null> {
  const client = getSupabaseClient();
  if (!client || !serverId) return null;
  try {
    const cleanId = serverId.trim().replace(/^spytify:\/\/station\/join\//i, '').trim();
    const { data, error } = await client
      .from('spytify_direct_messages')
      .select('content')
      .eq('id', `srv_reg_${cleanId}`)
      .maybeSingle();
    if (error || !data?.content) return null;
    return JSON.parse(data.content);
  } catch {
    return null;
  }
}

export interface CloudServerMembershipAudit {
  activeServers: any[];
  removedServerIds: string[];
  syncCursor?: string;
}

export async function fetchCloudServerMembershipAudit(
  userId: string,
  since?: string
): Promise<CloudServerMembershipAudit> {
  const client = getSupabaseClient();
  if (!client || !userId) return { activeServers: [], removedServerIds: [] };
  try {
    let query = client
      .from('spytify_direct_messages')
      .select('content, sent_at')
      .eq('room_id', SERVERS_REGISTRY_ROOM_ID);
    if (since) query = query.gt('sent_at', since);
    const { data, error } = await query.order('sent_at', { ascending: true });
    if (error || !data) {
      console.warn('Supabase server registry sync failed:', error);
      return { activeServers: [], removedServerIds: [] };
    }
    const activeServers: any[] = [];
    const removedServerIds: string[] = [];
    let syncCursor: string | undefined;
    for (const row of data) {
      if (row?.sent_at && (!syncCursor || row.sent_at > syncCursor)) syncCursor = row.sent_at;
      if (!row?.content) continue;
      try {
        const srv = JSON.parse(row.content);
        if (!srv?.id || srv.id === 'srv_none') continue;
        const isOwner = srv.owner_id === userId;
        const isKicked = Array.isArray(srv.kicked_ids) && srv.kicked_ids.includes(userId);
        const isMember = Array.isArray(srv.member_ids) && srv.member_ids.includes(userId);
        const isMod = Array.isArray(srv.moderator_ids) && srv.moderator_ids.includes(userId);
        if (!isOwner && isKicked) {
          removedServerIds.push(srv.id);
          continue;
        }
        if (isOwner || isMember || isMod) {
          activeServers.push(srv);
        } else {
          removedServerIds.push(srv.id);
        }
      } catch {}
    }
    return { activeServers, removedServerIds, syncCursor };
  } catch (error) {
    console.warn('Supabase server registry sync failed:', error);
    return { activeServers: [], removedServerIds: [] };
  }
}

export async function fetchCloudServersForUser(userId: string): Promise<any[]> {
  const { activeServers } = await fetchCloudServerMembershipAudit(userId);
  return activeServers;
}

export async function pushCloudServerInvite(invite: CloudServerInvite): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !invite?.serverId || !invite?.targetUserId) return;
  try {
    const rowId = `srv_inv_${invite.serverId}_${invite.targetUserId}`;
    await client.from('spytify_direct_messages').upsert(
      {
        id: rowId,
        room_id: SERVER_INVITES_ROOM_ID,
        sender_id: invite.inviterId,
        receiver_id: invite.targetUserId,
        sender_username: invite.inviterUsername,
        sender_display_name: invite.inviterDisplayName,
        sender_avatar: invite.inviterAvatar || null,
        content: JSON.stringify({ ...invite, id: rowId }),
        created_at: invite.createdAt,
        sent_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
  } catch {}
}

export async function removeCloudServerInvite(serverId: string, targetUserId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !serverId || !targetUserId) return;
  try {
    await client
      .from('spytify_direct_messages')
      .delete()
      .eq('id', `srv_inv_${serverId}_${targetUserId}`);
  } catch {}
}

export async function fetchCloudServerInvites(
  userId: string
): Promise<{ incoming: CloudServerInvite[]; outgoing: CloudServerInvite[] }> {
  const client = getSupabaseClient();
  if (!client || !userId) return { incoming: [], outgoing: [] };
  try {
    const { data, error } = await client
      .from('spytify_direct_messages')
      .select('sender_id, receiver_id, content')
      .eq('room_id', SERVER_INVITES_ROOM_ID)
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
    if (error || !data) return { incoming: [], outgoing: [] };
    const incoming: CloudServerInvite[] = [];
    const outgoing: CloudServerInvite[] = [];
    for (const row of data as any[]) {
      if (!row?.content) continue;
      try {
        const parsed: CloudServerInvite = JSON.parse(row.content);
        if (row.receiver_id === userId) {
          incoming.push(parsed);
        } else if (row.sender_id === userId) {
          outgoing.push(parsed);
        }
      } catch {}
    }
    return { incoming, outgoing };
  } catch {
    return { incoming: [], outgoing: [] };
  }
}



