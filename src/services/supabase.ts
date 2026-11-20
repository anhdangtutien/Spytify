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
  clean = clean.replace(/^["']|["']$/g, '').trim();
  clean = clean.replace(/\/+$/, '');
  clean = clean.replace(/\/rest\/v1\/?$/, '');
  return clean.replace(/\/+$/, '');
}

export function cleanSupabaseKey(raw: string): string {
  if (!raw) return '';
  let clean = raw.trim();
  clean = clean.replace(/^["']|["']$/g, '').trim();
  return clean;
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
      anonKey: cleanSupabaseKey(customKey),
    };
  }

  return {
    url: cleanSupabaseUrl(DEFAULT_URL),
    anonKey: cleanSupabaseKey(DEFAULT_ANON_KEY),
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
CREATE TABLE IF NOT EXISTS public.spytify_community_servers (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    server_data JSONB NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.spytify_community_servers ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_spytify_community_servers_owner ON public.spytify_community_servers(owner_id);

CREATE TABLE IF NOT EXISTS public.spytify_community_messages (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_username TEXT,
    sender_display_name TEXT,
    sender_avatar TEXT,
    content TEXT NOT NULL,
    track_embed JSONB,
    image_url TEXT,
    file_attachment JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_spytify_community_messages_room_sent ON public.spytify_community_messages(server_id, channel_id, sent_at DESC);

CREATE TABLE IF NOT EXISTS public.spytify_community_invites (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    invite_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_spytify_community_invites_receiver ON public.spytify_community_invites(receiver_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_spytify_community_invites_sender ON public.spytify_community_invites(sender_id, updated_at DESC);
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spytify_profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spytify_albums TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spytify_favorites TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spytify_history TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spytify_direct_messages TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spytify_community_servers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spytify_community_messages TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spytify_community_invites TO anon, authenticated;
ALTER TABLE public.spytify_direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spytify_community_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spytify_community_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spytify_community_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write for spytify_direct_messages" ON public.spytify_direct_messages;
CREATE POLICY "Allow public read-write for spytify_direct_messages" ON public.spytify_direct_messages FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public read-write for spytify_community_servers" ON public.spytify_community_servers;
CREATE POLICY "Allow public read-write for spytify_community_servers" ON public.spytify_community_servers FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public read-write for spytify_community_messages" ON public.spytify_community_messages;
CREATE POLICY "Allow public read-write for spytify_community_messages" ON public.spytify_community_messages FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public read-write for spytify_community_invites" ON public.spytify_community_invites;
CREATE POLICY "Allow public read-write for spytify_community_invites" ON public.spytify_community_invites FOR ALL USING (true) WITH CHECK (true);

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
      avatar: user.avatar || existingProfile?.avatar || null,
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
 * Searches for a user profile by email in Supabase Cloud
 */
export async function cloudFindUserByEmail(email: string): Promise<{ id: string; username: string; display_name: string; email: string } | null> {
  const client = getSupabaseClient();
  if (!client || !email) return null;
  try {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await client
      .from('spytify_profiles')
      .select('id, username, display_name, email')
      .ilike('email', cleanEmail)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      username: data.username || cleanEmail.split('@')[0],
      display_name: data.display_name || data.username || 'Operative',
      email: data.email || cleanEmail,
    };
  } catch {
    return null;
  }
}

/**
 * Searches for a user profile by username or email in Supabase Cloud
 */
export async function cloudFindUserByUsernameOrEmail(identifier: string): Promise<{
  id: string;
  username: string;
  display_name: string;
  email: string;
  two_factor_enabled?: boolean;
  two_factor_secret?: string | null;
  two_factor_scope?: 'both' | 'login' | 'reset_password' | null;
} | null> {
  const client = getSupabaseClient();
  if (!client || !identifier) return null;
  try {
    const clean = identifier.trim().toLowerCase();
    const isEmail = clean.includes('@');
    const query = client
      .from('spytify_profiles')
      .select('id, username, display_name, email, two_factor_enabled, two_factor_secret, two_factor_scope');
    const { data, error } = isEmail
      ? await query.ilike('email', clean).maybeSingle()
      : await query.ilike('username', clean).maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      username: data.username || clean,
      display_name: data.display_name || data.username || 'Operative',
      email: data.email || (isEmail ? clean : ''),
      two_factor_enabled: data.two_factor_enabled,
      two_factor_secret: data.two_factor_secret,
      two_factor_scope: data.two_factor_scope,
    };
  } catch {
    return null;
  }
}

/**
 * Updates password hash and salt for a user in Supabase Cloud
 */
export async function cloudResetUserPassword(userId: string, passwordHash: string, salt: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !userId) return false;
  try {
    const { error } = await client
      .from('spytify_profiles')
      .update({
        password_hash: passwordHash,
        salt: salt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    return !error;
  } catch (err) {
    console.error('Failed to reset cloud password:', err);
    return false;
  }
}

/**
 * Updates 2FA status in Supabase Cloud
 */
export async function cloudSetTwoFactor(
  userId: string,
  secret: string,
  enabled: boolean,
  scope: 'both' | 'login' | 'reset_password' = 'both'
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !userId) return false;
  try {
    const { error } = await client
      .from('spytify_profiles')
      .update({
        two_factor_secret: secret,
        two_factor_enabled: enabled,
        two_factor_scope: scope,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    return !error;
  } catch (err) {
    console.warn('Could not update 2FA in Supabase:', err);
    return false;
  }
}

/**
 * Updates 2FA scope in Supabase Cloud ('both' | 'login' | 'reset_password')
 */
export async function cloudSetTwoFactorScope(
  userId: string,
  scope: 'both' | 'login' | 'reset_password'
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !userId) return false;
  try {
    const { error } = await client
      .from('spytify_profiles')
      .update({
        two_factor_scope: scope,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    return !error;
  } catch (err) {
    console.warn('Could not update 2FA scope in Supabase:', err);
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
    const cleanUsername = cleanId.replace(/^@+/, '');
    const { data: profile, error } = await client
      .from('spytify_profiles')
      .select('*')
      .or(`username.ilike.${cleanUsername},email.ilike.${cleanId}`)
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

    if (profile.two_factor_enabled && profile.two_factor_secret) {
      const scope = profile.two_factor_scope || 'both';
      await invoke('auth_set_two_factor', {
        userId: profile.id,
        secret: profile.two_factor_secret,
        enabled: true,
        scope,
      }).catch(console.warn);
      importedUser.two_factor_enabled = true;
      importedUser.two_factor_secret = profile.two_factor_secret;
      importedUser.two_factor_scope = scope;
    }

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
      let upsertError = null;
      const { error } = await client.from('spytify_profiles').upsert(profilePayload, { onConflict: 'id' });
      if (error) {
        upsertError = error;
        if (data.username) {
          const { error: updateErr } = await client
            .from('spytify_profiles')
            .update(profilePayload)
            .ilike('username', data.username);
          if (!updateErr) upsertError = null;
        }
      }
      if (upsertError) throw upsertError;

      // Phát broadcast cập nhật profile/avatar ngay lập tức đến toàn bộ mạng lưới đang online
      if (data.avatar !== undefined || data.displayName || data.bio !== undefined || data.thought !== undefined) {
        try {
          const socialCh = client.channel('spytify_global_social');
          socialCh.send({
            type: 'broadcast',
            event: 'user_presence',
            payload: {
              id: userId,
              username: data.username,
              display_name: data.displayName,
              avatar: data.avatar,
              bio: data.bio,
              thought: data.thought,
            },
          });
        } catch {}
      }
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

const SERVER_CHAT_ROOM_PREFIX = 'spytify_srv_chat_';

function getServerIdFromChatRoom(roomId: string): string | null {
  if (!roomId.startsWith(SERVER_CHAT_ROOM_PREFIX)) return null;
  const serverId = roomId.slice(SERVER_CHAT_ROOM_PREFIX.length);
  return serverId || null;
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
    const { data: legacyData, error: legacyError } = await client
      .from('spytify_direct_messages')
      .select('id, room_id, sender_id, receiver_id, sender_username, sender_display_name, content, track_embed, image_url, created_at, sent_at')
      .eq('room_id', roomId)
      .order('sent_at', { ascending: false })
      .limit(MAX_CHAT_MESSAGES_LIMIT);
    if (legacyError) {
      console.warn('Legacy cloud chat history fetch failed:', legacyError);
    }

    const legacyRows = ((legacyData || []) as CloudDirectMessageRow[]).map(decodeCloudMessage);
    const serverId = getServerIdFromChatRoom(roomId);
    if (!serverId) return legacyRows.reverse();

    const { data: communityData, error: communityError } = await client
      .from('spytify_community_messages')
      .select('id, server_id, channel_id, sender_id, sender_username, sender_display_name, content, track_embed, image_url, file_attachment, created_at, sent_at')
      .eq('server_id', serverId)
      .order('sent_at', { ascending: false })
      .limit(MAX_CHAT_MESSAGES_LIMIT);
    if (communityError) {
      console.warn('Community cloud chat history fetch failed; using legacy messages:', communityError);
    }

    const mergedById = new Map<string, CloudDirectMessageRow>();
    legacyRows.forEach(row => mergedById.set(row.id, row));
    (communityData || []).forEach((row: any) => {
      mergedById.set(row.id, {
        id: row.id,
        room_id: roomId,
        sender_id: row.sender_id,
        receiver_id: row.channel_id,
        sender_username: row.sender_username || 'operative',
        sender_display_name: row.sender_display_name || row.sender_username || 'Operative',
        sender_avatar: row.sender_avatar || null,
        content: row.content,
        track_embed: row.track_embed || null,
        image_url: row.image_url || null,
        file_attachment: row.file_attachment || null,
        created_at: row.created_at || '',
        sent_at: row.sent_at || undefined,
      });
    });

    return Array.from(mergedById.values())
      .sort((a, b) => Date.parse(a.sent_at || a.created_at) - Date.parse(b.sent_at || b.created_at))
      .slice(-MAX_CHAT_MESSAGES_LIMIT);
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
    const sentAt = msg.sent_at || new Date().toISOString();
    const row = { ...msg };
    delete row.file_attachment;
    // TỐI ƯU HÓA EGRESS: Không lưu chuỗi Base64 avatar nặng vào từng tin nhắn.
    // Avatar luôn được lấy từ profile spytify_profiles theo sender_id.
    row.sender_avatar = null;

    let legacyResult = await client.from('spytify_direct_messages').upsert(
      {
        ...row,
        content: encodeCloudMessageContent(msg),
        sent_at: sentAt,
      },
      { onConflict: 'id' }
    );
    if (legacyResult.error && Object.prototype.hasOwnProperty.call(msg, 'image_url')) {
      const withoutOptionalFields = { ...row };
      delete withoutOptionalFields.image_url;
      legacyResult = await client.from('spytify_direct_messages').upsert(
        {
          ...withoutOptionalFields,
          content: encodeCloudMessageContent(msg),
          sent_at: sentAt,
        },
        { onConflict: 'id' }
      );
    }

    const serverId = getServerIdFromChatRoom(msg.room_id);
    let communityWriteSucceeded = false;
    let communityErrorMessage: string | null = null;
    if (serverId) {
      const { error } = await client.from('spytify_community_messages').upsert(
        {
          id: msg.id,
          server_id: serverId,
          channel_id: msg.receiver_id,
          sender_id: msg.sender_id,
          sender_username: msg.sender_username,
          sender_display_name: msg.sender_display_name,
          sender_avatar: null,
          content: msg.content,
          track_embed: msg.track_embed || null,
          image_url: msg.image_url || null,
          file_attachment: msg.file_attachment || null,
          created_at: msg.created_at,
          sent_at: sentAt,
        },
        { onConflict: 'id' }
      );
      communityWriteSucceeded = !error;
      communityErrorMessage = error?.message || null;
    }

    if (legacyResult.error) {
      console.warn('Legacy cloud chat save failed:', legacyResult.error);
    }
    if (communityErrorMessage) {
      console.warn('Community cloud chat save failed:', communityErrorMessage);
    }
    if (legacyResult.error && !communityWriteSucceeded) {
      throw new Error(legacyResult.error.message);
    }

    if (!legacyResult.error) {
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
    }

    if (serverId && communityWriteSucceeded) {
      const { data: oldCommunityRows } = await client
        .from('spytify_community_messages')
        .select('id')
        .eq('server_id', serverId)
        .order('sent_at', { ascending: false })
        .range(MAX_CHAT_MESSAGES_LIMIT, MAX_CHAT_MESSAGES_LIMIT + 100);
      if (oldCommunityRows && oldCommunityRows.length > 0) {
        const idsToDelete = oldCommunityRows.map((r: any) => r.id);
        await client.from('spytify_community_messages').delete().in('id', idsToDelete);
      }
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
      .select('id, username, display_name, avatar, bio, thought')
      .limit(500);
    if (error || !data) return [];
    return data.map((row: any) => ({
      id: row.id,
      username: row.username || 'operative',
      display_name: row.display_name || row.username || 'Operative',
      avatar: row.avatar || null,
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
const GLOBAL_DELETED_SERVERS_KEY = 'spytify_deleted_server_ids_global';

export function getDeletedServerIds(userId?: string | null): Set<string> {
  const ids = new Set<string>();
  try {
    const globalRaw = localStorage.getItem(GLOBAL_DELETED_SERVERS_KEY);
    if (globalRaw) {
      const parsed = JSON.parse(globalRaw);
      if (Array.isArray(parsed)) parsed.forEach(id => typeof id === 'string' && ids.add(id));
    }
    if (userId) {
      const userRaw = localStorage.getItem(`spytify_deleted_server_ids_${userId}`);
      if (userRaw) {
        const parsed = JSON.parse(userRaw);
        if (Array.isArray(parsed)) parsed.forEach(id => typeof id === 'string' && ids.add(id));
      }
    }
  } catch {}
  return ids;
}

export function recordDeletedServerId(serverId: string, userId?: string | null): void {
  if (!serverId || serverId === 'srv_none') return;
  try {
    const current = getDeletedServerIds(userId);
    current.add(serverId);
    const arr = Array.from(current);
    localStorage.setItem(GLOBAL_DELETED_SERVERS_KEY, JSON.stringify(arr));
    if (userId) {
      localStorage.setItem(`spytify_deleted_server_ids_${userId}`, JSON.stringify(arr));
    }
  } catch {}
}

export function isServerDeleted(serverId: string, userId?: string | null): boolean {
  if (!serverId || serverId === 'srv_none') return false;
  return getDeletedServerIds(userId).has(serverId);
}

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
  if (isServerDeleted(server.id, server.owner_id)) {
    console.warn(`[pushCloudServer] Blocked resurrecting deleted server: ${server.id}`);
    return false;
  }
  try {
    const sentAt = new Date().toISOString();
    const { error: communityError } = await client.from('spytify_community_servers').upsert(
      {
        id: server.id,
        owner_id: server.owner_id || 'usr_me',
        server_data: server,
        deleted: false,
        updated_at: sentAt,
      },
      { onConflict: 'id' }
    );
    if (communityError) {
      console.warn('Dedicated community server save failed:', communityError);
    }

    const { error: legacyError } = await client.from('spytify_direct_messages').upsert(
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
        sent_at: sentAt,
      },
      { onConflict: 'id' }
    );
    if (legacyError) {
      console.warn('Legacy cloud server save failed:', legacyError);
    }
    return !communityError || !legacyError;
  } catch (error) {
    console.warn('Supabase cloud server sync failed:', error);
    return false;
  }
}

export async function deleteCloudServer(serverId: string, userId?: string | null): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !serverId) return;
  recordDeletedServerId(serverId, userId);
  const updatedAt = new Date().toISOString();

  // 1. Xóa toàn bộ tin nhắn chat thuộc máy chủ này trong Supabase Cloud để giải phóng dung lượng
  try {
    await client
      .from('spytify_community_messages')
      .delete()
      .eq('server_id', serverId);
  } catch (err) {
    console.warn('Could not purge cloud messages for deleted server:', err);
  }
  try {
    await client
      .from('spytify_direct_messages')
      .delete()
      .like('room_id', `spytify_srv_chat_${serverId}%`);
  } catch (err) {
    console.warn('Could not purge legacy direct messages for deleted server:', err);
  }
  try {
    await client
      .from('spytify_direct_messages')
      .delete()
      .like('id', `srv_inv_${serverId}%`);
  } catch (err) {
    console.warn('Could not purge legacy server invites for deleted server:', err);
  }

  // 2. Đánh dấu xóa server để thông báo Realtime cho các client khác
  try {
    await client.from('spytify_community_servers').upsert(
      {
        id: serverId,
        owner_id: '',
        server_data: { id: serverId, deleted: true },
        deleted: true,
        updated_at: updatedAt,
      },
      { onConflict: 'id' }
    );
  } catch {}

  // 3. Đánh dấu bản ghi legacy registry là deleted vĩnh viễn để mọi client tự động gỡ bỏ
  const { error: legacyError } = await client
    .from('spytify_direct_messages')
    .upsert(
      {
        id: `srv_reg_${serverId}`,
        room_id: SERVERS_REGISTRY_ROOM_ID,
        sender_id: 'system',
        receiver_id: serverId,
        sender_username: 'System',
        sender_display_name: 'System',
        content: JSON.stringify({ id: serverId, deleted: true }),
        sent_at: updatedAt,
      },
      { onConflict: 'id' }
    );
  if (legacyError) console.warn('Legacy cloud server deletion failed:', legacyError);
}

export async function fetchCloudServerById(serverId: string): Promise<any | null> {
  const client = getSupabaseClient();
  if (!client || !serverId) return null;
  try {
    const cleanId = serverId.trim().replace(/^spytify:\/\/station\/join\//i, '').trim();
    if (isServerDeleted(cleanId)) return null;

    const { data: communityRow, error: communityError } = await client
      .from('spytify_community_servers')
      .select('server_data, deleted')
      .eq('id', cleanId)
      .maybeSingle();
    if (communityError) {
      console.warn('Dedicated community server fetch failed; trying legacy registry:', communityError);
    } else if (communityRow) {
      if (communityRow.deleted) {
        recordDeletedServerId(cleanId);
        return null;
      }
      const server =
        typeof communityRow.server_data === 'string'
          ? JSON.parse(communityRow.server_data)
          : communityRow.server_data;
      return server?.id ? server : null;
    }

    const { data, error } = await client
      .from('spytify_direct_messages')
      .select('content')
      .eq('id', `srv_reg_${cleanId}`)
      .maybeSingle();
    if (error || !data?.content) return null;
    const server = JSON.parse(data.content);
    if (server?.deleted) {
      recordDeletedServerId(cleanId);
      return null;
    }
    return server;
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
    let communityQuery = client
      .from('spytify_community_servers')
      .select('id, server_data, deleted, updated_at');
    let legacyQuery = client
      .from('spytify_direct_messages')
      .select('content, sent_at')
      .eq('room_id', SERVERS_REGISTRY_ROOM_ID);
    if (since) {
      communityQuery = communityQuery.gt('updated_at', since);
      legacyQuery = legacyQuery.gt('sent_at', since);
    }

    const [communityResult, legacyResult] = await Promise.all([
      communityQuery.order('updated_at', { ascending: true }),
      legacyQuery.order('sent_at', { ascending: true }),
    ]);
    if (communityResult.error) {
      console.warn('Dedicated community server registry fetch failed:', communityResult.error);
    }
    if (legacyResult.error) {
      console.warn('Legacy community server registry fetch failed:', legacyResult.error);
    }

    const serversById = new Map<string, { server: any; timestamp: string; deleted: boolean }>();
    const addServerRecord = (server: any, timestamp?: string, deleted = false) => {
      if (!server?.id || server.id === 'srv_none') return;
      const updatedAt = timestamp || '';
      const existing = serversById.get(server.id);
      if (!existing || updatedAt >= existing.timestamp) {
        serversById.set(server.id, { server, timestamp: updatedAt, deleted });
      }
    };

    (legacyResult.data || []).forEach(row => {
      if (!row?.content) return;
      try {
        const parsed = JSON.parse(row.content);
        const isDeleted = Boolean(parsed?.deleted);
        addServerRecord(parsed, row.sent_at || undefined, isDeleted);
      } catch (error) {
        console.warn('Could not parse a legacy community server record:', error);
      }
    });
    (communityResult.data || []).forEach(row => {
      const server =
        typeof row.server_data === 'string' ? JSON.parse(row.server_data) : row.server_data;
      addServerRecord(server, row.updated_at || undefined, Boolean(row.deleted));
    });

    const activeServers: any[] = [];
    const removedServerIds: string[] = [];
    let syncCursor: string | undefined;
    for (const [serverId, record] of serversById) {
      const { server, timestamp, deleted } = record;
      if (timestamp && (!syncCursor || timestamp > syncCursor)) syncCursor = timestamp;
      if (deleted || server.deleted || isServerDeleted(serverId, userId)) {
        recordDeletedServerId(serverId, userId);
        removedServerIds.push(serverId);
        continue;
      }
      const isOwner = server.owner_id === userId || (server.owner_id === 'usr_me' && Array.isArray(server.member_ids) && server.member_ids.includes(userId));
      const isKicked = Array.isArray(server.kicked_ids) && server.kicked_ids.includes(userId);
      const isMember = Array.isArray(server.member_ids) && (server.member_ids.includes(userId) || server.member_ids.includes('usr_me'));
      const isMod = Array.isArray(server.moderator_ids) && server.moderator_ids.includes(userId);
      if (!isOwner && isKicked) {
        removedServerIds.push(server.id);
      } else if (isOwner || isMember || isMod) {
        activeServers.push(server);
      } else {
        removedServerIds.push(server.id);
      }
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
    const updatedAt = new Date().toISOString();
    const { error: communityError } = await client.from('spytify_community_invites').upsert(
      {
        id: rowId,
        server_id: invite.serverId,
        sender_id: invite.inviterId,
        receiver_id: invite.targetUserId,
        invite_data: { ...invite, id: rowId },
        created_at: invite.createdAt,
        updated_at: updatedAt,
      },
      { onConflict: 'id' }
    );
    if (communityError) {
      console.warn('Dedicated community invite save failed:', communityError);
    }

    const { error: legacyError } = await client.from('spytify_direct_messages').upsert(
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
        sent_at: updatedAt,
      },
      { onConflict: 'id' }
    );
    if (legacyError) console.warn('Legacy community invite save failed:', legacyError);
    if (communityError && legacyError) throw new Error(communityError.message);
  } catch (error) {
    console.warn('Supabase community invite sync failed:', error);
    throw error;
  }
}

export async function removeCloudServerInvite(serverId: string, targetUserId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !serverId || !targetUserId) return;
  const rowId = `srv_inv_${serverId}_${targetUserId}`;
  const [communityResult, legacyResult] = await Promise.all([
    client.from('spytify_community_invites').delete().eq('id', rowId),
    client.from('spytify_direct_messages').delete().eq('id', rowId),
  ]);
  if (communityResult.error) {
    console.warn('Dedicated community invite removal failed:', communityResult.error);
  }
  if (legacyResult.error) {
    console.warn('Legacy community invite removal failed:', legacyResult.error);
  }
  if (communityResult.error && legacyResult.error) {
    throw new Error(communityResult.error.message);
  }
}

export async function fetchCloudServerInvites(
  userId: string
): Promise<{ incoming: CloudServerInvite[]; outgoing: CloudServerInvite[] }> {
  const client = getSupabaseClient();
  if (!client || !userId) return { incoming: [], outgoing: [] };
  try {
    const [communityResult, legacyResult] = await Promise.all([
      client
        .from('spytify_community_invites')
        .select('id, sender_id, receiver_id, invite_data')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
      client
        .from('spytify_direct_messages')
        .select('sender_id, receiver_id, content')
        .eq('room_id', SERVER_INVITES_ROOM_ID)
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
    ]);
    if (communityResult.error) {
      console.warn('Dedicated community invite fetch failed:', communityResult.error);
    }
    if (legacyResult.error) {
      console.warn('Legacy community invite fetch failed:', legacyResult.error);
    }

    const invitesById = new Map<string, CloudServerInvite>();
    (legacyResult.data || []).forEach(row => {
      if (!row?.content) return;
      try {
        const invite = JSON.parse(row.content) as CloudServerInvite;
        if (invite?.id) invitesById.set(invite.id, invite);
      } catch (error) {
        console.warn('Could not parse a legacy community invite:', error);
      }
    });
    (communityResult.data || []).forEach(row => {
      const invite =
        typeof row.invite_data === 'string'
          ? JSON.parse(row.invite_data)
          : row.invite_data;
      if (invite?.id) invitesById.set(invite.id, invite as CloudServerInvite);
    });

    const incoming: CloudServerInvite[] = [];
    const outgoing: CloudServerInvite[] = [];
    invitesById.forEach(invite => {
      if (invite.targetUserId === userId) incoming.push(invite);
      else if (invite.inviterId === userId) outgoing.push(invite);
    });
    return { incoming, outgoing };
  } catch (error) {
    console.warn('Supabase community invite fetch failed:', error);
    return { incoming: [], outgoing: [] };
  }
}

/**
 * Xóa toàn bộ tin nhắn thuộc một kênh khi kênh đó bị xóa
 */
export async function deleteCloudChannelMessages(serverId: string, channelId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client
      .from('spytify_community_messages')
      .delete()
      .eq('server_id', serverId)
      .eq('channel_id', channelId);
  } catch (err) {
    console.warn('Could not delete cloud channel messages:', err);
  }
}

/**
 * Tự động dọn dẹp các tin nhắn cũ hơn số giờ quy định trong Supabase Cloud (6h, 12h, 24h)
 */
export async function purgeCloudExpiredMessages(serverId: string, hours: number): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !serverId || hours <= 0) return;
  try {
    const thresholdIso = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    await client
      .from('spytify_community_messages')
      .delete()
      .eq('server_id', serverId)
      .lt('created_at', thresholdIso);
  } catch (err) {
    console.warn('Could not purge cloud expired messages:', err);
  }
}

/**
 * Tự động xóa các tin nhắn riêng 1-1 cũ hơn số giờ quy định trong Supabase Cloud (6h, 12h, 24h)
 */
export async function purgeCloudExpiredDirectMessages(roomId: string, hours: number): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !roomId || (!hours && hours !== -1)) return;
  try {
    const durationMs = hours === -1 ? 30 * 1000 : hours * 3600 * 1000;
    const thresholdIso = new Date(Date.now() - durationMs).toISOString();
    await client
      .from('spytify_direct_messages')
      .delete()
      .eq('room_id', roomId)
      .lt('sent_at', thresholdIso);
  } catch (err) {
    console.warn('Could not purge cloud expired direct messages:', err);
  }
}

/**
 * Cập nhật cấu hình tự động hủy tin nhắn riêng (0, 6h, 12h, 24h) lên Supabase Cloud
 */
export async function pushCloudDmAutoDelete(roomId: string, hours: number): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !roomId) return;
  try {
    await client.from('spytify_direct_messages').upsert({
      id: `dm_autodel_${roomId}`,
      room_id: `settings_${roomId}`,
      sender_id: 'system',
      receiver_id: roomId,
      content: JSON.stringify({ roomId, autoDeleteHours: hours }),
      sent_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('Could not push cloud DM auto-delete setting:', err);
  }
}

/**
 * Lấy cấu hình tự động hủy tin nhắn riêng từ Supabase Cloud
 */
export async function fetchCloudDmAutoDelete(roomId: string): Promise<number> {
  const client = getSupabaseClient();
  if (!client || !roomId) return 0;
  try {
    const { data, error } = await client
      .from('spytify_direct_messages')
      .select('content')
      .eq('id', `dm_autodel_${roomId}`)
      .maybeSingle();
    if (error || !data?.content) return 0;
    const parsed = JSON.parse(data.content);
    return Number(parsed.autoDeleteHours) || 0;
  } catch {
    return 0;
  }
}

/**
 * Xóa một tin nhắn riêng cụ thể trên Supabase Cloud
 */
export async function deleteCloudDirectMessage(messageId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !messageId) return;
  try {
    await client.from('spytify_direct_messages').delete().eq('id', messageId);
  } catch (err) {
    console.warn('Could not delete cloud direct message:', err);
  }
}

/**
 * Chỉnh sửa nội dung một tin nhắn riêng cụ thể trên Supabase Cloud
 */
export async function editCloudDirectMessage(messageId: string, content: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !messageId) return;
  try {
    await client.from('spytify_direct_messages').update({ content }).eq('id', messageId);
  } catch (err) {
    console.warn('Could not edit cloud direct message:', err);
  }
}

/**
 * Xóa toàn bộ tin nhắn trong một phòng chat riêng 1-1 trên Supabase Cloud
 */
export async function clearCloudDirectMessages(roomId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !roomId) return;
  try {
    await client.from('spytify_direct_messages').delete().eq('room_id', roomId);
  } catch (err) {
    console.warn('Could not clear cloud direct messages:', err);
  }
}






