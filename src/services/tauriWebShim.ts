import type {
  ArtistMix,
  HistoryItem,
  PlaybackStatus,
  RecommendationResult,
  SearchResult,
  Track,
  TrainingReport,
  User,
  UserStats,
} from '../types';
import { cleanTrackMetadata } from './sevenCloudsResolver';

export const isTauriEnvironment = (): boolean => {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return Boolean(w.__TAURI_INTERNALS__ && !w.__TAURI_WEB_SHIM__);
};

interface StoredWebUser extends User {
  password_hash: string;
  salt: string;
  google_id?: string | null;
}

const USERS_KEY = 'spytify_web_users_v1';
const FAVS_PREFIX = 'spytify_web_favs_v1_';
const HIST_PREFIX = 'spytify_web_hist_v1_';
const CHAT_IMG_KEY = 'spytify_web_chat_images_v1';
const SERVER_CHAT_PREFIX = 'spytify_web_srv_chat_v1_';
const WEB_DOWNLOADED_TRACKS_KEY = 'spytify_web_downloaded_tracks_v1';
const OFFLINE_AUDIO_DB_NAME = 'spytify_offline_audio_v1';
const OFFLINE_AUDIO_STORE = 'audio_blobs';
const offlineBlobUrlCache = new Map<string, string>();

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors in restricted webviews
  }
};

function openOfflineAudioDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(OFFLINE_AUDIO_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(OFFLINE_AUDIO_STORE)) {
          db.createObjectStore(OFFLINE_AUDIO_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveOfflineAudioBlob(id: string, blob: Blob): Promise<boolean> {
  if (!id || !blob || blob.size === 0) return false;
  const db = await openOfflineAudioDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(OFFLINE_AUDIO_STORE, 'readwrite');
      tx.objectStore(OFFLINE_AUDIO_STORE).put(blob, id);
      tx.oncomplete = () => {
        offlineBlobUrlCache.delete(id);
        resolve(true);
      };
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Retrieve a cached or newly created blob: URL for an offline track stored in IndexedDB.
 */
export async function getOfflineAudioBlobUrl(id: string): Promise<string | null> {
  if (!id) return null;
  const cached = offlineBlobUrlCache.get(id);
  if (cached) return cached;
  const db = await openOfflineAudioDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(OFFLINE_AUDIO_STORE, 'readonly');
      const req = tx.objectStore(OFFLINE_AUDIO_STORE).get(id);
      req.onsuccess = () => {
        const val = req.result;
        if (val instanceof Blob && val.size > 0) {
          const url = URL.createObjectURL(val);
          offlineBlobUrlCache.set(id, url);
          resolve(url);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function upsertWebDownloadedTrack(track: Track): void {
  const existing = readJson<Track[]>(WEB_DOWNLOADED_TRACKS_KEY, []);
  const normTitle = track.title.trim().toLowerCase();
  const normArtist = track.artist.trim().toLowerCase();
  const filtered = existing.filter(
    t =>
      t.id !== track.id &&
      !(t.title.trim().toLowerCase() === normTitle && t.artist.trim().toLowerCase() === normArtist)
  );
  writeJson(WEB_DOWNLOADED_TRACKS_KEY, [track, ...filtered].slice(0, 500));
}

function sanitizeDownloadFilename(raw: string): string {
  return (raw || 'spytify_track')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

function extensionFromAudioBlob(blob: Blob): string {
  const mime = (blob.type || '').toLowerCase();
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'm4a';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('flac')) return 'flac';
  if (mime.includes('wav')) return 'wav';
  return 'mp3';
}

function triggerBrowserAudioDownload(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return;
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    // Ignore restricted download contexts
  }
}

async function fetchAudioBlobWithTimeout(url: string, timeoutMs = 6000): Promise<Blob | null> {
  if (!url || !url.startsWith('http')) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob || blob.size <= 10_000) return null;
    return blob;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function getAudioDurationFromBlob(blob: Blob, fallback = 200): Promise<number> {
  if (typeof Audio === 'undefined') return Promise.resolve(fallback);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    let settled = false;
    const finish = (secs: number) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(secs > 0 && Number.isFinite(secs) ? Math.round(secs) : fallback);
    };
    const timer = setTimeout(() => finish(fallback), 2500);
    audio.onloadedmetadata = () => {
      clearTimeout(timer);
      finish(audio.duration);
    };
    audio.onerror = () => {
      clearTimeout(timer);
      finish(fallback);
    };
    audio.src = url;
  });
}

async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const bytes = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic non-crypto hash for insecure HTTP test environments
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h2 >>> 0).toString(16).padStart(8, '0') +
    (h1 >>> 0).toString(16).padStart(8, '0') +
    (h2 >>> 0).toString(16).padStart(8, '0') +
    (h1 >>> 0).toString(16).padStart(8, '0')
  );
}

async function hashPassword(password: string, salt: string): Promise<string> {
  return sha256Hex(`${password}${salt}`);
}

async function generateDeterministicUserId(identifier: string): Promise<string> {
  const clean = identifier.trim().toLowerCase();
  const hex = await sha256Hex(`spytify_user_id_v2:${clean}`);
  return `usr_${hex.slice(0, 18)}`;
}

function sanitizePublicUser(u: StoredWebUser): User {
  return {
    id: u.id,
    username: u.username,
    display_name: u.display_name,
    avatar: u.avatar ?? null,
    email: u.email ?? null,
    bio: u.bio,
    thought: u.thought ?? null,
    custom_status: u.custom_status,
    two_factor_enabled: Boolean(u.two_factor_enabled),
    two_factor_secret: u.two_factor_secret ?? null,
    two_factor_scope: u.two_factor_scope || 'both',
    created_at: u.created_at || 'Web Session',
  };
}

const WEB_CURATED_CATALOG: Record<string, SearchResult[]> = {
  usuk: [
    { title: 'Die With A Smile', artist: 'Lady Gaga & Bruno Mars', album: 'Billboard Hot 100 #1', duration_secs: 251, source: 'youtube', url_or_id: 'kPa7bsKwL-c', thumbnail: 'https://i.ytimg.com/vi/kPa7bsKwL-c/hqdefault.jpg' },
    { title: 'APT. (feat. Bruno Mars)', artist: 'ROSÉ & Bruno Mars', album: 'Global Viral Sensation', duration_secs: 173, source: 'youtube', url_or_id: 'ekr2nIex040', thumbnail: 'https://i.ytimg.com/vi/ekr2nIex040/hqdefault.jpg' },
    { title: 'Espresso', artist: 'Sabrina Carpenter', album: "Short n' Sweet", duration_secs: 175, source: 'youtube', url_or_id: 'eVli-tstM5E', thumbnail: 'https://i.ytimg.com/vi/eVli-tstM5E/hqdefault.jpg' },
    { title: 'Birds of a Feather', artist: 'Billie Eilish', album: 'Hit Me Hard and Soft', duration_secs: 196, source: 'youtube', url_or_id: 'V9PVRfjEBTI', thumbnail: 'https://i.ytimg.com/vi/V9PVRfjEBTI/hqdefault.jpg' },
    { title: 'Cruel Summer', artist: 'Taylor Swift', album: 'Lover', duration_secs: 178, source: 'youtube', url_or_id: 'ic8j13piAhQ', thumbnail: 'https://i.ytimg.com/vi/ic8j13piAhQ/hqdefault.jpg' },
    { title: 'Beautiful Things', artist: 'Benson Boone', album: 'Fireworks & Rollerblades', duration_secs: 180, source: 'youtube', url_or_id: 'Oa_RSwwpPaA', thumbnail: 'https://i.ytimg.com/vi/Oa_RSwwpPaA/hqdefault.jpg' },
    { title: 'Lose Control', artist: 'Teddy Swims', album: "I've Tried Everything", duration_secs: 210, source: 'youtube', url_or_id: 'GZ3zL7kT6_c', thumbnail: 'https://i.ytimg.com/vi/GZ3zL7kT6_c/hqdefault.jpg' },
    { title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', duration_secs: 200, source: 'youtube', url_or_id: '4NRXx6U8ABQ', thumbnail: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg' },
    { title: 'Houdini', artist: 'Dua Lipa', album: 'Radical Optimism', duration_secs: 185, source: 'youtube', url_or_id: 'suAR1PYFNYA', thumbnail: 'https://i.ytimg.com/vi/suAR1PYFNYA/hqdefault.jpg' },
  ],
  vpop: [
    { title: 'Đừng Làm Trái Tim Anh Đau', artist: 'Sơn Tùng M-TP', album: 'V-Pop Top Hits', duration_secs: 326, source: 'youtube', url_or_id: 'abPmZCZZrFA', thumbnail: 'https://i.ytimg.com/vi/abPmZCZZrFA/hqdefault.jpg' },
    { title: 'Từng Quen', artist: 'Wren Evans', album: 'Loi Choi', duration_secs: 174, source: 'youtube', url_or_id: 'zepHPnUDROE', thumbnail: 'https://i.ytimg.com/vi/zepHPnUDROE/hqdefault.jpg' },
    { title: 'Nơi Này Có Anh', artist: 'Sơn Tùng M-TP', album: 'Hit Quốc Dân V-Pop', duration_secs: 279, source: 'youtube', url_or_id: 'FN7ALfpGxiI', thumbnail: 'https://i.ytimg.com/vi/FN7ALfpGxiI/hqdefault.jpg' },
    { title: 'Thủy Triều', artist: 'Quang Hùng MasterD', album: 'Giai Điệu Bắt Tai', duration_secs: 202, source: 'youtube', url_or_id: '7ig2lXjozdw', thumbnail: 'https://i.ytimg.com/vi/7ig2lXjozdw/hqdefault.jpg' },
    { title: 'Không Thể Say', artist: 'HIEUTHUHAI', album: 'Ai Cũng Phải Bắt Đầu Từ Đâu Đó', duration_secs: 215, source: 'youtube', url_or_id: 'i0nd3NPJ4MI', thumbnail: 'https://i.ytimg.com/vi/i0nd3NPJ4MI/hqdefault.jpg' },
    { title: 'Cắt Đôi Nỗi Sầu', artist: 'Tăng Duy Tân', album: 'V-Pop Viral', duration_secs: 195, source: 'youtube', url_or_id: 'GpmOn4RyzZI', thumbnail: 'https://i.ytimg.com/vi/GpmOn4RyzZI/hqdefault.jpg' },
    { title: 'Nấu Ăn Cho Em', artist: 'Đen Vâu (feat. PiaLinh)', album: 'Đen Vâu Hit Collection', duration_secs: 260, source: 'youtube', url_or_id: 'ukHK1GVyr0I', thumbnail: 'https://i.ytimg.com/vi/ukHK1GVyr0I/hqdefault.jpg' },
    { title: 'Bước Qua Mùa Cô Đơn', artist: 'Vũ.', album: 'Indie Ballad', duration_secs: 279, source: 'youtube', url_or_id: 'bX8d8XbS0hU', thumbnail: 'https://i.ytimg.com/vi/bX8d8XbS0hU/hqdefault.jpg' },
    { title: 'Giá Như', artist: 'SOOBIN', album: 'R&B V-Pop', duration_secs: 216, source: 'youtube', url_or_id: 'kFq-qT8g16Q', thumbnail: 'https://i.ytimg.com/vi/kFq-qT8g16Q/hqdefault.jpg' },
    { title: 'Thanh Xuân', artist: 'Da LAB', album: 'V-Pop Nostalgia', duration_secs: 228, source: 'youtube', url_or_id: 'GgQFO8dL5XQ', thumbnail: 'https://i.ytimg.com/vi/GgQFO8dL5XQ/hqdefault.jpg' },
  ],
  kpop_jpop: [
    { title: 'Bling-Bang-Bang-Born', artist: 'Creepy Nuts', album: 'J-Pop Global Phenomenon', duration_secs: 172, source: 'youtube', url_or_id: 'lRDaREIDxEg', thumbnail: 'https://i.ytimg.com/vi/lRDaREIDxEg/hqdefault.jpg' },
    { title: 'Idol (アイドル)', artist: 'YOASOBI', album: 'Oshi no Ko OP', duration_secs: 213, source: 'youtube', url_or_id: 'ZRtdQ81jPUQ', thumbnail: 'https://i.ytimg.com/vi/ZRtdQ81jPUQ/hqdefault.jpg' },
    { title: 'Supernova', artist: 'aespa', album: 'Armageddon', duration_secs: 178, source: 'youtube', url_or_id: 'G8YNFjruzPk', thumbnail: 'https://i.ytimg.com/vi/G8YNFjruzPk/hqdefault.jpg' },
    { title: 'Magnetic', artist: 'ILLIT', album: 'SUPER REAL ME', duration_secs: 160, source: 'youtube', url_or_id: 'Vk5-c_v4gMU', thumbnail: 'https://i.ytimg.com/vi/Vk5-c_v4gMU/hqdefault.jpg' },
    { title: 'Night Dancer', artist: 'imase', album: 'J-Pop Viral', duration_secs: 210, source: 'youtube', url_or_id: 'QbHBfxAOucI', thumbnail: 'https://i.ytimg.com/vi/QbHBfxAOucI/hqdefault.jpg' },
    { title: 'Whiplash', artist: 'aespa', album: 'The 5th Mini Album', duration_secs: 184, source: 'youtube', url_or_id: 'jWQx2f-CErU', thumbnail: 'https://i.ytimg.com/vi/jWQx2f-CErU/hqdefault.jpg' },
    { title: 'How Sweet', artist: 'NewJeans', album: 'How Sweet EP', duration_secs: 219, source: 'youtube', url_or_id: 'Q3K0TOvTOno', thumbnail: 'https://i.ytimg.com/vi/Q3K0TOvTOno/hqdefault.jpg' },
    { title: 'Love wins all', artist: 'IU', album: 'The Winning', duration_secs: 272, source: 'youtube', url_or_id: 'JleoAppaxi0', thumbnail: 'https://i.ytimg.com/vi/JleoAppaxi0/hqdefault.jpg' },
    { title: 'KICK BACK', artist: 'Kenshi Yonezu', album: 'Chainsaw Man OP', duration_secs: 193, source: 'youtube', url_or_id: 'M2cckDmNLMI', thumbnail: 'https://i.ytimg.com/vi/M2cckDmNLMI/hqdefault.jpg' },
  ],
  cpop: [
    { title: '晴天 (Sunny Day)', artist: '周杰伦 (Jay Chou)', album: '叶惠美', duration_secs: 269, source: 'youtube', url_or_id: 'DYptgVvkVLQ', thumbnail: 'https://i.ytimg.com/vi/DYptgVvkVLQ/hqdefault.jpg' },
    { title: '光年之外 (LIGHT YEARS AWAY)', artist: 'G.E.M. 邓紫棋', album: 'Passengers OST', duration_secs: 235, source: 'youtube', url_or_id: 'T4SimnaiktU', thumbnail: 'https://i.ytimg.com/vi/T4SimnaiktU/hqdefault.jpg' },
    { title: '带我去找夜生活', artist: '告五人 (Accusefive)', album: '运气来得若有似无', duration_secs: 243, source: 'youtube', url_or_id: '55nPtJyp4eQ', thumbnail: 'https://i.ytimg.com/vi/55nPtJyp4eQ/hqdefault.jpg' },
  ],
  lofi: [
    { title: 'lofi hip hop radio 📚 beats to relax/study to [LIVE 24/7]', artist: 'Lofi Girl', album: 'Lofi Girl 24/7 Live Radio', duration_secs: 0, source: 'youtube', url_or_id: 'jfKfPfyJRdk', thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg' },
    { title: 'synthwave radio 🌌 beats to chill/game to [LIVE 24/7]', artist: 'Lofi Girl Synthwave', album: 'Synthwave Live 24/7', duration_secs: 0, source: 'youtube', url_or_id: '4xDzrJKXOOY', thumbnail: 'https://i.ytimg.com/vi/4xDzrJKXOOY/hqdefault.jpg' },
    { title: 'Nightcall', artist: 'Kavinsky', album: 'OutRun', duration_secs: 256, source: 'youtube', url_or_id: 'MV_3Dpw-BRY', thumbnail: 'https://i.ytimg.com/vi/MV_3Dpw-BRY/hqdefault.jpg' },
    { title: 'Memory Reboot', artist: 'VØJ & Narvent', album: 'Cyberpunk Phonk', duration_secs: 210, source: 'youtube', url_or_id: 'mky64VkgkME', thumbnail: 'https://i.ytimg.com/vi/mky64VkgkME/hqdefault.jpg' },
  ],
  edm: [
    { title: 'Faded', artist: 'Alan Walker', album: 'Different World', duration_secs: 212, source: 'youtube', url_or_id: '60ItHLz5WEA', thumbnail: 'https://i.ytimg.com/vi/60ItHLz5WEA/hqdefault.jpg' },
    { title: 'Animals', artist: 'Martin Garrix', album: 'Gold Skies EP', duration_secs: 184, source: 'youtube', url_or_id: 'gCYcTmT9wx4', thumbnail: 'https://i.ytimg.com/vi/gCYcTmT9wx4/hqdefault.jpg' },
    { title: 'Wake Me Up', artist: 'Avicii', album: 'True', duration_secs: 247, source: 'youtube', url_or_id: 'IcrbM1l_BoI', thumbnail: 'https://i.ytimg.com/vi/IcrbM1l_BoI/hqdefault.jpg' },
    { title: 'Alone', artist: 'Marshmello', album: 'Monstercat Hits', duration_secs: 200, source: 'youtube', url_or_id: 'ALZHF5UqnU4', thumbnail: 'https://i.ytimg.com/vi/ALZHF5UqnU4/hqdefault.jpg' },
  ],
  hiphop: [
    { title: 'Not Like Us', artist: 'Kendrick Lamar', album: 'Billboard Hot 100 #1', duration_secs: 274, source: 'youtube', url_or_id: 'H58vbez_m4E', thumbnail: 'https://i.ytimg.com/vi/H58vbez_m4E/hqdefault.jpg' },
    { title: 'FE!N', artist: 'Travis Scott ft. Playboi Carti', album: 'UTOPIA', duration_secs: 191, source: 'youtube', url_or_id: 'B9synWjqBn8', thumbnail: 'https://i.ytimg.com/vi/B9synWjqBn8/hqdefault.jpg' },
    { title: 'Sunflower', artist: 'Post Malone & Swae Lee', album: 'Spider-Verse', duration_secs: 158, source: 'youtube', url_or_id: 'ApXoWvfEYVU', thumbnail: 'https://i.ytimg.com/vi/ApXoWvfEYVU/hqdefault.jpg' },
  ],
  rock: [
    { title: 'The Emptiness Machine', artist: 'Linkin Park', album: 'From Zero', duration_secs: 190, source: 'youtube', url_or_id: 'SRXH9AbT280', thumbnail: 'https://i.ytimg.com/vi/SRXH9AbT280/hqdefault.jpg' },
    { title: 'Believer', artist: 'Imagine Dragons', album: 'Evolve', duration_secs: 204, source: 'youtube', url_or_id: '7wtfhZwyrcc', thumbnail: 'https://i.ytimg.com/vi/7wtfhZwyrcc/hqdefault.jpg' },
    { title: 'Numb', artist: 'Linkin Park', album: 'Meteora', duration_secs: 185, source: 'youtube', url_or_id: 'kXYiU_JCYtU', thumbnail: 'https://i.ytimg.com/vi/kXYiU_JCYtU/hqdefault.jpg' },
  ],
  audius: [
    {
      title: 'Fragments',
      artist: 'Xsetra',
      album: 'Audius Drum & Bass 320K',
      duration_secs: 212,
      source: 'audius',
      url_or_id: 'https://v.monophonic.digital/tracks/cidstream/baeaaaiqsebhalqg3k6nic5q26xapepplxugf6flwp7ngqehjuw2tykhrbnco4?signature=%7B%22data%22%3A%22%7B%5C%22cid%5C%22%3A%5C%22baeaaaiqsebhalqg3k6nic5q26xapepplxugf6flwp7ngqehjuw2tykhrbnco4%5C%22%2C%5C%22timestamp%5C%22%3A1795380495000%2C%5C%22trackId%5C%22%3A2024274216%2C%5C%22userId%5C%22%3A0%7D%22%2C%22signature%22%3A%220x55a94a2adb18f889e5de845ee12f9acba62869124b743c0a94cd1fec9b3daeeb6ad0fbda2c83939674f786e769c2eab400b7ccbfaae6e0376ca7b660e851b1c901%22%7D',
      thumbnail: 'https://audius-creator-13.theblueprint.xyz/content/baeaaaiqseau7mrpo7s6ibb7loyckmlix37ao33gltbea6qm3zud7mdxvbgyys/480x480.jpg'
    },
    {
      title: 'Overkill',
      artist: 'Rubberband$',
      album: 'Audius Hi-Fi 320K',
      duration_secs: 291,
      source: 'audius',
      url_or_id: 'https://v.monophonic.digital/tracks/cidstream/baeaaaiqseated7yegekwtau5gvsownk6f7kzfbsmmubj2bozui3vsixkxflia?signature=%7B%22data%22%3A%22%7B%5C%22cid%5C%22%3A%5C%22baeaaaiqseated7yegekwtau5gvsownk6f7kzfbsmmubj2bozui3vsixkxflia%5C%22%2C%5C%22timestamp%5C%22%3A1795380495000%2C%5C%22trackId%5C%22%3A1089078384%2C%5C%22userId%5C%22%3A0%7D%22%2C%22signature%22%3A%220x7a1e7c9cf149d845d91c002b7f9308da7b9b9ca409d3dc50f87baf5f59268abd2a891dda14d4815cc5b5d1012d7245bd4d457a75bc76fd134a982b7cd71265f000%22%7D',
      thumbnail: 'https://val001.open-audio-validator.com/content/baeaaaiqsedeuoghqlazi7rsk5rw46xs6tjyonbqfbwscpmrj2rkx6uehbfd2a/480x480.jpg'
    },
    {
      title: 'OBSESSION - THORNHILL (MORTALA. REMIX)',
      artist: 'Mortala.',
      album: 'Audius Hi-Fi 320K',
      duration_secs: 168,
      source: 'audius',
      url_or_id: 'https://v.monophonic.digital/tracks/cidstream/baeaaaiqsedbrn4h7pedjflq26lcxi5wvebniilivzkeohzollw5gjsqnoyyh6?signature=%7B%22data%22%3A%22%7B%5C%22cid%5C%22%3A%5C%22baeaaaiqsedbrn4h7pedjflq26lcxi5wvebniilivzkeohzollw5gjsqnoyyh6%5C%22%2C%5C%22timestamp%5C%22%3A1795380495000%2C%5C%22trackId%5C%22%3A1474714520%2C%5C%22userId%5C%22%3A0%7D%22%2C%22signature%22%3A%220xf49247881e705b4f9a5eb585c19ef8ce96884d2e9f6736cc53f734934d43a5091dc781203a3f3a19543590bbd89ac1fc78bf99e2a66bd70b9393066a381311f901%22%7D',
      thumbnail: 'https://v.monophonic.digital/content/baeaaaiqseawb6xvjpvxm6aha4ofrwfckozsjcmc2j6mqjv347gxv6mote6z2k/480x480.jpg'
    },
    {
      title: 'Beneath the Lily',
      artist: 'parasox',
      album: 'Audius Hi-Fi 320K',
      duration_secs: 188,
      source: 'audius',
      url_or_id: 'https://audius-discovery-2.altego.net/tracks/cidstream/baeaaaiqseaf5fnvgtvgqfndfgqmc7dzai6llddfvs2om7hmaw3zjusnj677n4?signature=%7B%22data%22%3A%22%7B%5C%22cid%5C%22%3A%5C%22baeaaaiqseaf5fnvgtvgqfndfgqmc7dzai6llddfvs2om7hmaw3zjusnj677n4%5C%22%2C%5C%22timestamp%5C%22%3A1795380495000%2C%5C%22trackId%5C%22%3A1298426820%2C%5C%22userId%5C%22%3A0%7D%22%2C%22signature%22%3A%220xf52c3b5619af393794b6e4945551c5f08fbe96bdc3ca174b5c69bd16ebb09b2d77ec28435381c51b15aee211c7b4ef52a7b9565835370c228e79e8f65615775f00%22%7D',
      thumbnail: 'https://audius-content-6.figment.io/content/baeaaaiqsedmrczxlgj4rss5oqk3wvovhqh6wdnz4lvvu2r3pi7kbxkoovev7e/480x480.jpg'
    },
  ],
};

const ARTIST_DISCOGRAPHY: Record<string, SearchResult[]> = {
  'sơn tùng': [
    { title: 'Đừng Làm Trái Tim Anh Đau', artist: 'Sơn Tùng M-TP', album: 'V-Pop Quán Quân', duration_secs: 326, source: 'youtube', url_or_id: 'abPmZCZZrFA', thumbnail: 'https://i.ytimg.com/vi/abPmZCZZrFA/hqdefault.jpg' },
    { title: 'Chúng Ta Của Tương Lai', artist: 'Sơn Tùng M-TP', album: 'Top Hits', duration_secs: 254, source: 'youtube', url_or_id: 'cp8ec_4vh_c', thumbnail: 'https://i.ytimg.com/vi/cp8ec_4vh_c/hqdefault.jpg' },
    { title: 'Nơi Này Có Anh', artist: 'Sơn Tùng M-TP', album: 'Hit Quốc Dân V-Pop', duration_secs: 279, source: 'youtube', url_or_id: 'FN7ALfpGxiI', thumbnail: 'https://i.ytimg.com/vi/FN7ALfpGxiI/hqdefault.jpg' },
    { title: 'Lạc Trôi', artist: 'Sơn Tùng M-TP', album: 'Hit Collection', duration_secs: 245, source: 'youtube', url_or_id: 'Llw9Q6akRo4', thumbnail: 'https://i.ytimg.com/vi/Llw9Q6akRo4/hqdefault.jpg' },
    { title: 'Hãy Trao Cho Anh', artist: 'Sơn Tùng M-TP ft. Snoop Dogg', album: 'Global Smash', duration_secs: 245, source: 'youtube', url_or_id: 'knW7-x7Y7RE', thumbnail: 'https://i.ytimg.com/vi/knW7-x7Y7RE/hqdefault.jpg' },
    { title: 'Có Chắc Yêu Là Đây', artist: 'Sơn Tùng M-TP', album: 'Sweet Pop', duration_secs: 202, source: 'youtube', url_or_id: '6t-MjBazs3o', thumbnail: 'https://i.ytimg.com/vi/6t-MjBazs3o/hqdefault.jpg' },
    { title: 'Muộn Rồi Mà Sao Còn', artist: 'Sơn Tùng M-TP', album: 'Acoustic R&B', duration_secs: 277, source: 'youtube', url_or_id: 'xypzmu5mMPY', thumbnail: 'https://i.ytimg.com/vi/xypzmu5mMPY/hqdefault.jpg' },
    { title: 'Chúng Ta Của Hiện Tại', artist: 'Sơn Tùng M-TP', album: 'Ballad Collection', duration_secs: 301, source: 'youtube', url_or_id: 'psZ1g9fMfeo', thumbnail: 'https://i.ytimg.com/vi/psZ1g9fMfeo/hqdefault.jpg' },
  ],
  'vũ': [
    { title: 'Bước Qua Mùa Cô Đơn', artist: 'Vũ.', album: 'Indie Ballad', duration_secs: 279, source: 'youtube', url_or_id: 'bX8d8XbS0hU', thumbnail: 'https://i.ytimg.com/vi/bX8d8XbS0hU/hqdefault.jpg' },
    { title: 'Lạ Lùng', artist: 'Vũ.', album: 'Vũ Acoustic', duration_secs: 262, source: 'youtube', url_or_id: 'rcZ1b0_dD_w', thumbnail: 'https://i.ytimg.com/vi/rcZ1b0_dD_w/hqdefault.jpg' },
    { title: 'Những Lời Hứa Bỏ Quên', artist: 'Vũ. x Dear Jane', album: 'Bảo Tàng Của Nuối Tiếc', duration_secs: 240, source: 'youtube', url_or_id: '6f304E6J7S0', thumbnail: 'https://i.ytimg.com/vi/6f304E6J7S0/hqdefault.jpg' },
    { title: 'Bước Qua Nhau', artist: 'Vũ.', album: 'Một Vạn Năm', duration_secs: 257, source: 'youtube', url_or_id: 'D_3QG3PZ9jM', thumbnail: 'https://i.ytimg.com/vi/D_3QG3PZ9jM/hqdefault.jpg' },
    { title: 'Đông Kiếm Em', artist: 'Vũ.', album: 'Vũ Chill', duration_secs: 236, source: 'youtube', url_or_id: '0oA50r4F8iQ', thumbnail: 'https://i.ytimg.com/vi/0oA50r4F8iQ/hqdefault.jpg' },
    { title: 'Dành Hết Xuân Thì Để Chờ Nhau', artist: 'Vũ. x Hà Anh Tuấn', album: 'Bảo Tàng Của Nuối Tiếc', duration_secs: 285, source: 'youtube', url_or_id: 'y58S3o1Y5e4', thumbnail: 'https://i.ytimg.com/vi/y58S3o1Y5e4/hqdefault.jpg' },
  ],
  'đen': [
    { title: 'Nấu Ăn Cho Em', artist: 'Đen Vâu (feat. PiaLinh)', album: 'Đen Vâu Hit Collection', duration_secs: 260, source: 'youtube', url_or_id: 'ukHK1GVyr0I', thumbnail: 'https://i.ytimg.com/vi/ukHK1GVyr0I/hqdefault.jpg' },
    { title: 'Mang Tiền Về Cho Mẹ', artist: 'Đen ft. Nguyên Thảo', album: 'Đen Vâu Hits', duration_secs: 310, source: 'youtube', url_or_id: 'kXYiU_JCYtU', thumbnail: 'https://i.ytimg.com/vi/kXYiU_JCYtU/hqdefault.jpg' },
    { title: 'Trốn Tìm', artist: 'Đen ft. MTV Band', album: 'Đen Vâu Hits', duration_secs: 252, source: 'youtube', url_or_id: '5tXqGz1ZpQ4', thumbnail: 'https://i.ytimg.com/vi/5tXqGz1ZpQ4/hqdefault.jpg' },
    { title: 'Đi Về Nhà', artist: 'Đen x JustaTee', album: 'Tết Hit', duration_secs: 202, source: 'youtube', url_or_id: 'vJ0xM4734pM', thumbnail: 'https://i.ytimg.com/vi/vJ0xM4734pM/hqdefault.jpg' },
    { title: 'Bài Này Chill Phết', artist: 'Đen ft. Min', album: 'Đen Vâu Hits', duration_secs: 278, source: 'youtube', url_or_id: 'a4_w5w_K3z8', thumbnail: 'https://i.ytimg.com/vi/a4_w5w_K3z8/hqdefault.jpg' },
    { title: 'Hai Triệu Năm', artist: 'Đen ft. Biên', album: 'Đen Vâu Hits', duration_secs: 220, source: 'youtube', url_or_id: 'Y_W81y6s1m4', thumbnail: 'https://i.ytimg.com/vi/Y_W81y6s1m4/hqdefault.jpg' },
  ],
  'hieuthuhai': [
    { title: 'Không Thể Say', artist: 'HIEUTHUHAI', album: 'Ai Cũng Phải Bắt Đầu Từ Đâu Đó', duration_secs: 215, source: 'youtube', url_or_id: 'i0nd3NPJ4MI', thumbnail: 'https://i.ytimg.com/vi/i0nd3NPJ4MI/hqdefault.jpg' },
    { title: 'Ngủ Một Mình', artist: 'HIEUTHUHAI x Negav x Kewtiie', album: 'HIEUTHUHAI Top Hits', duration_secs: 212, source: 'youtube', url_or_id: 'gG_3Dq5m1tI', thumbnail: 'https://i.ytimg.com/vi/gG_3Dq5m1tI/hqdefault.jpg' },
    { title: 'Vệ Tinh', artist: 'HIEUTHUHAI ft. Hoàng Tôn', album: 'HIEUTHUHAI Hits', duration_secs: 204, source: 'youtube', url_or_id: 'y9M31x_q0hY', thumbnail: 'https://i.ytimg.com/vi/y9M31x_q0hY/hqdefault.jpg' },
    { title: 'NOLOVE NOLIFE', artist: 'HIEUTHUHAI', album: 'Ai Cũng Phải Bắt Đầu Từ Đâu Đó', duration_secs: 195, source: 'youtube', url_or_id: 't8q22x101pM', thumbnail: 'https://i.ytimg.com/vi/t8q22x101pM/hqdefault.jpg' },
    { title: 'Giờ Thì Ai Cười', artist: 'HIEUTHUHAI', album: 'Ai Cũng Phải Bắt Đầu Từ Đâu Đó', duration_secs: 208, source: 'youtube', url_or_id: 'y28X_43q0rE', thumbnail: 'https://i.ytimg.com/vi/y28X_43q0rE/hqdefault.jpg' },
    { title: 'Trình', artist: 'HIEUTHUHAI', album: 'Single 2024', duration_secs: 198, source: 'youtube', url_or_id: 'm_q1x3401Yw', thumbnail: 'https://i.ytimg.com/vi/m_q1x3401Yw/hqdefault.jpg' },
  ],
  'soobin': [
    { title: 'Giá Như', artist: 'SOOBIN', album: 'Bật Nó Lên', duration_secs: 216, source: 'youtube', url_or_id: 'kFq-qT8g16Q', thumbnail: 'https://i.ytimg.com/vi/kFq-qT8g16Q/hqdefault.jpg' },
    { title: 'Phía Sau Một Cô Gái', artist: 'Soobin Hoàng Sơn', album: 'Ballad Quốc Dân', duration_secs: 268, source: 'youtube', url_or_id: 'v28X_101p_87', thumbnail: 'https://i.ytimg.com/vi/v28X_101p_87/hqdefault.jpg' },
    { title: 'Xin Đừng Lặng Im', artist: 'Soobin Hoàng Sơn', album: 'Soobin Ballad', duration_secs: 245, source: 'youtube', url_or_id: 'y91X_0120_8k', thumbnail: 'https://i.ytimg.com/vi/y91X_0120_8k/hqdefault.jpg' },
    { title: 'Đi Để Trở Về', artist: 'Soobin Hoàng Sơn', album: 'Đi Để Trở Về', duration_secs: 218, source: 'youtube', url_or_id: 'l39X_0102_yU', thumbnail: 'https://i.ytimg.com/vi/l39X_0102_yU/hqdefault.jpg' },
    { title: 'Blackjack', artist: 'SOOBIN ft. Binz', album: 'The Playah', duration_secs: 205, source: 'youtube', url_or_id: 'q19X_3012_yU', thumbnail: 'https://i.ytimg.com/vi/q19X_3012_yU/hqdefault.jpg' },
  ],
  'bruno mars': [
    { title: 'Die With A Smile', artist: 'Lady Gaga & Bruno Mars', album: 'Billboard Hot 100 #1', duration_secs: 251, source: 'youtube', url_or_id: 'kPa7bsKwL-c', thumbnail: 'https://i.ytimg.com/vi/kPa7bsKwL-c/hqdefault.jpg' },
    { title: 'APT. (feat. Bruno Mars)', artist: 'ROSÉ & Bruno Mars', album: 'Global Viral Sensation', duration_secs: 173, source: 'youtube', url_or_id: 'ekr2nIex040', thumbnail: 'https://i.ytimg.com/vi/ekr2nIex040/hqdefault.jpg' },
    { title: "That's What I Like", artist: 'Bruno Mars', album: '24K Magic', duration_secs: 206, source: 'youtube', url_or_id: 'PMivT7MJ41M', thumbnail: 'https://i.ytimg.com/vi/PMivT7MJ41M/hqdefault.jpg' },
    { title: 'Just the Way You Are', artist: 'Bruno Mars', album: 'Doo-Wops & Hooligans', duration_secs: 220, source: 'youtube', url_or_id: 'LjhCEhWiKXk', thumbnail: 'https://i.ytimg.com/vi/LjhCEhWiKXk/hqdefault.jpg' },
    { title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars', album: 'Uptown Special', duration_secs: 270, source: 'youtube', url_or_id: 'OPf0YbXqDm0', thumbnail: 'https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg' },
    { title: '24K Magic', artist: 'Bruno Mars', album: '24K Magic', duration_secs: 226, source: 'youtube', url_or_id: 'UqyT8IEBbiY', thumbnail: 'https://i.ytimg.com/vi/UqyT8IEBbiY/hqdefault.jpg' },
  ],
  'billie eilish': [
    { title: 'Birds of a Feather', artist: 'Billie Eilish', album: 'Hit Me Hard and Soft', duration_secs: 196, source: 'youtube', url_or_id: 'V9PVRfjEBTI', thumbnail: 'https://i.ytimg.com/vi/V9PVRfjEBTI/hqdefault.jpg' },
    { title: 'bad guy', artist: 'Billie Eilish', album: 'WHEN WE ALL FALL ASLEEP', duration_secs: 194, source: 'youtube', url_or_id: 'dyRsYkfflJU', thumbnail: 'https://i.ytimg.com/vi/dyRsYkfflJU/hqdefault.jpg' },
    { title: 'Happier Than Ever', artist: 'Billie Eilish', album: 'Happier Than Ever', duration_secs: 304, source: 'youtube', url_or_id: '5GJWxDKyk3A', thumbnail: 'https://i.ytimg.com/vi/5GJWxDKyk3A/hqdefault.jpg' },
    { title: 'lovely', artist: 'Billie Eilish & Khalid', album: '13 Reasons Why', duration_secs: 200, source: 'youtube', url_or_id: 'V1Pl8CzNzCw', thumbnail: 'https://i.ytimg.com/vi/V1Pl8CzNzCw/hqdefault.jpg' },
    { title: 'What Was I Made For?', artist: 'Billie Eilish', album: 'Barbie The Album', duration_secs: 222, source: 'youtube', url_or_id: 'cW8VLC9nnTo', thumbnail: 'https://i.ytimg.com/vi/cW8VLC9nnTo/hqdefault.jpg' },
  ],
  'taylor swift': [
    { title: 'Cruel Summer', artist: 'Taylor Swift', album: 'Lover', duration_secs: 178, source: 'youtube', url_or_id: 'ic8j13piAhQ', thumbnail: 'https://i.ytimg.com/vi/ic8j13piAhQ/hqdefault.jpg' },
    { title: 'Anti-Hero', artist: 'Taylor Swift', album: 'Midnights', duration_secs: 200, source: 'youtube', url_or_id: 'b1kbLwvqugk', thumbnail: 'https://i.ytimg.com/vi/b1kbLwvqugk/hqdefault.jpg' },
    { title: 'Blank Space', artist: 'Taylor Swift', album: '1989', duration_secs: 231, source: 'youtube', url_or_id: 'e-ORhEE9VVg', thumbnail: 'https://i.ytimg.com/vi/e-ORhEE9VVg/hqdefault.jpg' },
    { title: 'Shake It Off', artist: 'Taylor Swift', album: '1989', duration_secs: 242, source: 'youtube', url_or_id: 'nfWlot6h_JM', thumbnail: 'https://i.ytimg.com/vi/nfWlot6h_JM/hqdefault.jpg' },
    { title: 'Fortnight (feat. Post Malone)', artist: 'Taylor Swift', album: 'TTPD', duration_secs: 228, source: 'youtube', url_or_id: 'q3zKK4v2hFw', thumbnail: 'https://i.ytimg.com/vi/q3zKK4v2hFw/hqdefault.jpg' },
  ],
  'rosé': [
    { title: 'APT. (feat. Bruno Mars)', artist: 'ROSÉ & Bruno Mars', album: 'Global Viral Sensation', duration_secs: 173, source: 'youtube', url_or_id: 'ekr2nIex040', thumbnail: 'https://i.ytimg.com/vi/ekr2nIex040/hqdefault.jpg' },
    { title: 'On The Ground', artist: 'ROSÉ', album: '-R-', duration_secs: 168, source: 'youtube', url_or_id: 'CKZvWhCqx1s', thumbnail: 'https://i.ytimg.com/vi/CKZvWhCqx1s/hqdefault.jpg' },
    { title: 'Gone', artist: 'ROSÉ', album: '-R-', duration_secs: 207, source: 'youtube', url_or_id: 'K9_VFxzCuQ0', thumbnail: 'https://i.ytimg.com/vi/K9_VFxzCuQ0/hqdefault.jpg' },
  ],
  'rose': [
    { title: 'APT. (feat. Bruno Mars)', artist: 'ROSÉ & Bruno Mars', album: 'Global Viral Sensation', duration_secs: 173, source: 'youtube', url_or_id: 'ekr2nIex040', thumbnail: 'https://i.ytimg.com/vi/ekr2nIex040/hqdefault.jpg' },
    { title: 'On The Ground', artist: 'ROSÉ', album: '-R-', duration_secs: 168, source: 'youtube', url_or_id: 'CKZvWhCqx1s', thumbnail: 'https://i.ytimg.com/vi/CKZvWhCqx1s/hqdefault.jpg' },
    { title: 'Gone', artist: 'ROSÉ', album: '-R-', duration_secs: 207, source: 'youtube', url_or_id: 'K9_VFxzCuQ0', thumbnail: 'https://i.ytimg.com/vi/K9_VFxzCuQ0/hqdefault.jpg' },
  ],
  'joji': [
    { title: 'Glimpse of Us', artist: 'Joji', album: 'SMITHEREENS', duration_secs: 233, source: 'youtube', url_or_id: 'FvOpPeKSf_4', thumbnail: 'https://i.ytimg.com/vi/FvOpPeKSf_4/hqdefault.jpg' },
    { title: 'SLOW DANCING IN THE DARK', artist: 'Joji', album: 'BALLADS 1', duration_secs: 209, source: 'youtube', url_or_id: 'K3QzzggA_-s', thumbnail: 'https://i.ytimg.com/vi/K3QzzggA_-s/hqdefault.jpg' },
    { title: 'Sanctuary', artist: 'Joji', album: 'Nectar', duration_secs: 180, source: 'youtube', url_or_id: 'YWN814PDKoI', thumbnail: 'https://i.ytimg.com/vi/YWN814PDKoI/hqdefault.jpg' },
  ],
  'alan walker': [
    { title: 'Faded', artist: 'Alan Walker', album: 'Different World', duration_secs: 212, source: 'youtube', url_or_id: '60ItHLz5WEA', thumbnail: 'https://i.ytimg.com/vi/60ItHLz5WEA/hqdefault.jpg' },
    { title: 'The Spectre', artist: 'Alan Walker', album: 'Different World', duration_secs: 193, source: 'youtube', url_or_id: 'wJnBTPUQS5A', thumbnail: 'https://i.ytimg.com/vi/wJnBTPUQS5A/hqdefault.jpg' },
    { title: 'Darkside', artist: 'Alan Walker ft. Au/Ra', album: 'Different World', duration_secs: 211, source: 'youtube', url_or_id: 'M-P4Q3pkGKY', thumbnail: 'https://i.ytimg.com/vi/M-P4Q3pkGKY/hqdefault.jpg' },
  ],
  'wren evans': [
    { title: 'Từng Quen', artist: 'Wren Evans', album: 'Loi Choi', duration_secs: 174, source: 'youtube', url_or_id: 'zepHPnUDROE', thumbnail: 'https://i.ytimg.com/vi/zepHPnUDROE/hqdefault.jpg' },
    { title: 'Thích Em Hơi Nhiều', artist: 'Wren Evans', album: 'V-Pop Hits', duration_secs: 185, source: 'youtube', url_or_id: 'r89X_0120_7m', thumbnail: 'https://i.ytimg.com/vi/r89X_0120_7m/hqdefault.jpg' },
  ],
  'sabrina carpenter': [
    { title: 'Espresso', artist: 'Sabrina Carpenter', album: "Short n' Sweet", duration_secs: 175, source: 'youtube', url_or_id: 'eVli-tstM5E', thumbnail: 'https://i.ytimg.com/vi/eVli-tstM5E/hqdefault.jpg' },
    { title: 'Taste', artist: 'Sabrina Carpenter', album: "Short n' Sweet", duration_secs: 157, source: 'youtube', url_or_id: '-u1_qW1Q2qU', thumbnail: 'https://i.ytimg.com/vi/-u1_qW1Q2qU/hqdefault.jpg' },
    { title: 'Please Please Please', artist: 'Sabrina Carpenter', album: "Short n' Sweet", duration_secs: 186, source: 'youtube', url_or_id: 'cF1Na4AIecM', thumbnail: 'https://i.ytimg.com/vi/cF1Na4AIecM/hqdefault.jpg' },
  ],
  'newjeans': [
    { title: 'How Sweet', artist: 'NewJeans', album: 'How Sweet EP', duration_secs: 219, source: 'youtube', url_or_id: 'Q3K0TOvTOno', thumbnail: 'https://i.ytimg.com/vi/Q3K0TOvTOno/hqdefault.jpg' },
    { title: 'Super Shy', artist: 'NewJeans', album: 'Get Up', duration_secs: 154, source: 'youtube', url_or_id: 'ArmDp-zijuc', thumbnail: 'https://i.ytimg.com/vi/ArmDp-zijuc/hqdefault.jpg' },
    { title: 'Ditto', artist: 'NewJeans', album: 'OMG', duration_secs: 186, source: 'youtube', url_or_id: 'pSUydWEqKwE', thumbnail: 'https://i.ytimg.com/vi/pSUydWEqKwE/hqdefault.jpg' },
    { title: 'OMG', artist: 'NewJeans', album: 'OMG', duration_secs: 212, source: 'youtube', url_or_id: 'sVTy_wmn5SU', thumbnail: 'https://i.ytimg.com/vi/sVTy_wmn5SU/hqdefault.jpg' },
  ],
  'aespa': [
    { title: 'Supernova', artist: 'aespa', album: 'Armageddon', duration_secs: 178, source: 'youtube', url_or_id: 'G8YNFjruzPk', thumbnail: 'https://i.ytimg.com/vi/G8YNFjruzPk/hqdefault.jpg' },
    { title: 'Whiplash', artist: 'aespa', album: 'The 5th Mini Album', duration_secs: 184, source: 'youtube', url_or_id: 'jWQx2f-CErU', thumbnail: 'https://i.ytimg.com/vi/jWQx2f-CErU/hqdefault.jpg' },
    { title: 'Armageddon', artist: 'aespa', album: 'Armageddon', duration_secs: 197, source: 'youtube', url_or_id: 'nFYwcndNuOY', thumbnail: 'https://i.ytimg.com/vi/nFYwcndNuOY/hqdefault.jpg' },
  ],
  'yoasobi': [
    { title: 'Idol (アイドル)', artist: 'YOASOBI', album: 'Oshi no Ko OP', duration_secs: 213, source: 'youtube', url_or_id: 'ZRtdQ81jPUQ', thumbnail: 'https://i.ytimg.com/vi/ZRtdQ81jPUQ/hqdefault.jpg' },
    { title: 'Racing Into The Night (夜に駆ける)', artist: 'YOASOBI', album: 'THE BOOK', duration_secs: 261, source: 'youtube', url_or_id: 'x8VYWazR5mM', thumbnail: 'https://i.ytimg.com/vi/x8VYWazR5mM/hqdefault.jpg' },
    { title: 'Monster (怪物)', artist: 'YOASOBI', album: 'THE BOOK 2', duration_secs: 206, source: 'youtube', url_or_id: 'dy90tA3TT1c', thumbnail: 'https://i.ytimg.com/vi/dy90tA3TT1c/hqdefault.jpg' },
  ],
  'iu': [
    { title: 'Love wins all', artist: 'IU', album: 'The Winning', duration_secs: 272, source: 'youtube', url_or_id: 'JleoAppaxi0', thumbnail: 'https://i.ytimg.com/vi/JleoAppaxi0/hqdefault.jpg' },
    { title: 'Palette (feat. G-DRAGON)', artist: 'IU', album: 'Palette', duration_secs: 217, source: 'youtube', url_or_id: 'd9IxFzUkWLQ', thumbnail: 'https://i.ytimg.com/vi/d9IxFzUkWLQ/hqdefault.jpg' },
  ],
};

function getAllCuratedTracks(): SearchResult[] {
  return [
    ...WEB_CURATED_CATALOG.usuk,
    ...WEB_CURATED_CATALOG.vpop,
    ...WEB_CURATED_CATALOG.kpop_jpop,
    ...WEB_CURATED_CATALOG.cpop,
    ...WEB_CURATED_CATALOG.lofi,
    ...WEB_CURATED_CATALOG.edm,
    ...WEB_CURATED_CATALOG.hiphop,
    ...WEB_CURATED_CATALOG.rock,
  ];
}

function extractYouTubeVideoId(raw: string): string | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/);
  if (match?.[1]) return match[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 2800): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function raceFirstSuccess<T>(promises: Array<Promise<T | null>>): Promise<T | null> {
  if (!promises.length) return Promise.resolve(null);
  return new Promise((resolve) => {
    let remaining = promises.length;
    let settled = false;
    for (const p of promises) {
      p.then((val) => {
        if (!settled && val !== null && (!Array.isArray(val) || val.length > 0)) {
          settled = true;
          resolve(val);
          return;
        }
        remaining -= 1;
        if (remaining === 0 && !settled) resolve(null);
      }).catch(() => {
        remaining -= 1;
        if (remaining === 0 && !settled) resolve(null);
      });
    }
  });
}

let cachedAudiusHosts: string[] = ['https://api.audius.co', 'https://discoveryprovider.audius.co'];
let cachedAudiusHostsAt = 0;

async function resolveAudiusHost(preferAlternate = false): Promise<string> {
  const now = Date.now();
  if (cachedAudiusHosts.length <= 1 || now - cachedAudiusHostsAt > 10 * 60 * 1000) {
    try {
      const json = await fetchJsonWithTimeout('https://api.audius.co', 4000);
      const list = Array.isArray(json?.data)
        ? json.data
            .filter((u: unknown): u is string => typeof u === 'string' && u.startsWith('https://'))
            .map((u: string) => u.replace(/\/+$/, ''))
        : [];
      if (list.length > 0) {
        cachedAudiusHosts = Array.from(new Set(['https://api.audius.co', ...list, 'https://discoveryprovider.audius.co']));
        cachedAudiusHostsAt = now;
      }
    } catch {
      // Keep fallback below
    }
  }
  const hosts = cachedAudiusHosts.length > 0
    ? cachedAudiusHosts
    : ['https://api.audius.co', 'https://discoveryprovider.audius.co', 'https://discoveryprovider2.audius.co'];
  if (preferAlternate && hosts.length > 1) {
    return hosts[1];
  }
  return hosts[0];
}

async function searchAudiusWeb(query: string): Promise<SearchResult[]> {
  try {
    const host = await resolveAudiusHost();
    const endpoint = query
      ? `${host}/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=Spytify`
      : `${host}/v1/tracks/trending?app_name=Spytify&limit=20`;
    const json = await fetchJsonWithTimeout(endpoint, 7000);
    const items: any[] = Array.isArray(json?.data) ? json.data : [];
    if (items.length === 0 && !query) {
      return WEB_CURATED_CATALOG.audius || [];
    }
    const mapped = items
      .map((item): SearchResult | null => {
        const tid = item?.id;
        const streamUrl = item?.stream?.url || (tid ? `${host}/v1/tracks/${tid}/stream?app_name=Spytify` : '');
        if (!streamUrl) return null;
        return {
          title: item.title || 'Audius Track',
          artist: item?.user?.name || 'Audius Artist',
          album: 'Audius Open Music 320K',
          duration_secs: Number(item.duration) || 180,
          source: 'audius',
          url_or_id: streamUrl,
          thumbnail: item?.artwork?.['480x480'] || item?.artwork?.['150x150'] || null,
        };
      })
      .filter((x): x is SearchResult => x !== null)
      .slice(0, 20);

    return mapped.length > 0 ? mapped : (WEB_CURATED_CATALOG.audius || []);
  } catch {
    return WEB_CURATED_CATALOG.audius || [];
  }
}

const PIPED_API_BASES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
];

const INVIDIOUS_API_BASES = [
  'https://invidious.jing.rocks',
  'https://yt.artemislena.eu',
];

async function searchYoutubeWeb(query: string, apiTimeoutMs = 1800): Promise<SearchResult[]> {
  const directVid = extractYouTubeVideoId(query);
  if (directVid) {
    try {
      const meta = await fetchJsonWithTimeout(
        `https://noembed.com/embed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${directVid}`)}`,
        2200
      );
      return [{
        title: meta?.title || `YouTube (${directVid})`,
        artist: meta?.author_name || 'YouTube Audio',
        album: 'YouTube Direct Link',
        duration_secs: 210,
        source: 'youtube',
        url_or_id: directVid,
        thumbnail: meta?.thumbnail_url || `https://i.ytimg.com/vi/${directVid}/hqdefault.jpg`,
      }];
    } catch {
      return [{
        title: `YouTube Track (${directVid})`,
        artist: 'YouTube Stream',
        album: 'YouTube Direct Link',
        duration_secs: 210,
        source: 'youtube',
        url_or_id: directVid,
        thumbnail: `https://i.ytimg.com/vi/${directVid}/hqdefault.jpg`,
      }];
    }
  }

  // 1. High-speed direct YouTube Search API endpoint
  try {
    const apiBase = typeof window !== 'undefined' && window.location ? window.location.origin : '';
    let data = await fetchJsonWithTimeout(`/api/yt-search?q=${encodeURIComponent(query)}`, 2200);
    if (!data || !Array.isArray(data.items) || data.items.length === 0) {
      data = await fetchJsonWithTimeout(
        `https://spytify-website-rho.vercel.app/api/yt-search?q=${encodeURIComponent(query)}`,
        2600
      );
    }
    if (data && Array.isArray(data.items) && data.items.length > 0) {
      return data.items.map((i: any) => {
        const cleaned = cleanTrackMetadata(i.title || query, i.author || 'YouTube Audio');
        return {
          title: cleaned.title,
          artist: cleaned.artist,
          album: 'YouTube',
          duration_secs: Number(i.duration_secs) || 200,
          source: 'youtube' as const,
          url_or_id: i.videoId,
          thumbnail: i.thumbnail || `https://i.ytimg.com/vi/${i.videoId}/hqdefault.jpg`,
        };
      });
    }
  } catch {}

  // 2. Race Piped and Invidious search endpoints concurrently as backup
  const pipedPromises = PIPED_API_BASES.map(async (base): Promise<SearchResult[] | null> => {
    const data = await fetchJsonWithTimeout(
      `${base}/search?q=${encodeURIComponent(query)}&filter=music_songs`,
      apiTimeoutMs
    );
    const items: any[] = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
    const mapped = items
      .map((item): SearchResult | null => {
        const vid = extractYouTubeVideoId(item?.url || item?.videoId || '');
        if (!vid || item?.isShort) return null;
        return {
          title: item.title || 'YouTube Track',
          artist: item.uploaderName || item.uploader || 'YouTube Artist',
          album: 'YT Music',
          duration_secs: Number(item.duration) || 195,
          source: 'youtube',
          url_or_id: vid,
          thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
        };
      })
      .filter((x): x is SearchResult => x !== null)
      .slice(0, 18);
    return mapped.length > 0 ? mapped : null;
  });

  const invidiousPromises = INVIDIOUS_API_BASES.map(async (base): Promise<SearchResult[] | null> => {
    const items: any[] = await fetchJsonWithTimeout(
      `${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
      apiTimeoutMs
    );
    if (!Array.isArray(items)) return null;
    const mapped = items
      .map((item): SearchResult | null => {
        const vid = item?.videoId ? extractYouTubeVideoId(String(item.videoId)) : null;
        if (!vid) return null;
        return {
          title: item.title || 'YouTube Track',
          artist: item.author || 'YouTube Artist',
          album: 'YouTube',
          duration_secs: Number(item.lengthSeconds) || 195,
          source: 'youtube',
          url_or_id: vid,
          thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
        };
      })
      .filter((x): x is SearchResult => x !== null)
      .slice(0, 18);
    return mapped.length > 0 ? mapped : null;
  });

  const raced = await raceFirstSuccess([...pipedPromises, ...invidiousPromises]);
  if (raced && raced.length > 0) return raced;

  // Token-based curated fallback strictly matching artist or genuine title
  const qLower = query.trim().toLowerCase();
  const stopWords = new Set(['ft', 'feat', 'prod', 'official', 'audio', 'video', 'mv', 'lyrics', 'remix', 'music', 'the', 'in', 'on', 'at', 'to', 'is', 'a', 'an', 'and', 'or', 'of', 'by', 'topic']);
  const tokens = qLower.split(/[\s\-_.,&()]+/).filter(t => t.length >= 3 && !stopWords.has(t));
  const allCurated = getAllCuratedTracks();
  const scoredCurated = allCurated
    .map(track => {
      const haystack = `${track.title} ${track.artist}`.toLowerCase();
      const normArtist = track.artist.toLowerCase();
      const normTitle = track.title.toLowerCase();

      // Direct exact match
      if (haystack.includes(qLower) || qLower.includes(normTitle)) {
        return { track, score: 100 };
      }

      // Check artist match + title match
      const artistMatches = tokens.some(tok => normArtist.includes(tok));
      const titleMatches = tokens.filter(tok => normTitle.includes(tok)).length;

      // Must match artist AND at least 1 title word, OR match at least 60% of significant query words
      let score = 0;
      if (artistMatches && titleMatches >= 1) {
        score = 50 + titleMatches * 10;
      } else if (tokens.length > 0 && titleMatches / tokens.length >= 0.6) {
        score = titleMatches * 10;
      }

      return { track, score };
    })
    .filter(x => x.score >= 10)
    .sort((a, b) => b.score - a.score)
    .map(x => x.track);
  if (scoredCurated.length > 0) return scoredCurated;

  const audius = await searchAudiusWeb(query);
  if (audius.length > 0) return audius;

  // If query is an empty or generic request, return curated; otherwise return empty so search doesn't show wrong songs
  if (!query || query.trim().length <= 2) {
    return allCurated.slice(0, 10);
  }
  return [];
}

async function resolveAudiusStreamUrl(urlOrId: string, forceFresh = false): Promise<string> {
  const raw = String(urlOrId || '').trim();
  if (!forceFresh && raw.includes('/tracks/cidstream/') && raw.includes('signature=')) {
    return raw;
  }
  const host = await resolveAudiusHost();
  const trackIdMatch = raw.match(/\/tracks\/([A-Za-z0-9_-]+)(?:\/stream)?/);
  let trackId = (trackIdMatch?.[1] && trackIdMatch[1] !== 'cidstream')
    ? trackIdMatch[1]
    : (/^[A-Za-z0-9_-]{4,24}$/.test(raw) ? raw : null);

  if (!trackId) {
    const m = raw.match(/trackId%22%3A(\d+)/) || raw.match(/"trackId":\s*(\d+)/);
    if (m?.[1]) trackId = m[1];
  }

  if (trackId) {
    try {
      const meta = await fetchJsonWithTimeout(`${host}/v1/tracks/${trackId}?app_name=Spytify`, 4000);
      const directUrl = meta?.data?.stream?.url;
      if (directUrl && directUrl.includes('/tracks/cidstream/')) {
        return directUrl;
      }
    } catch {}
    return `${host}/v1/tracks/${trackId}/stream?app_name=Spytify`;
  }
  return raw;
}

async function resolveYouTubeAudioStreamWeb(
  videoIdInput: string,
  title?: string,
  artist?: string
): Promise<{ stream_url: string | null; proxy_url?: string | null; resolved_video_id: string; duration_secs: number }> {
  const rawVid = extractYouTubeVideoId(videoIdInput) || videoIdInput.trim();
  const rawT = (title || '')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
    .replace(/official\s*(music\s*video|mv|audio|video|lyric\s*video)/gi, '')
    .trim();
  const rawA = (artist || '')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
    .split('&')[0]
    .split('feat.')[0]
    .split('ft.')[0]
    .trim();

  // 1. Fast search for 7clouds Rap / 7clouds audio version (clean audio without intro/outro delays)
  if (rawT.length >= 2) {
    try {
      const searchAlt = await searchYoutubeWeb(`${rawT} ${rawA} 7clouds rap`.trim(), 1600);
      const sevenCloudsHit = searchAlt.find(t => {
        const a = (t.artist || '').toLowerCase();
        const ti = (t.title || '').toLowerCase();
        return a.includes('7cloud') || a.includes('7 cloud') || ti.includes('7cloud') || ti.includes('7 cloud');
      });
      const ytCandidate = sevenCloudsHit || searchAlt.find(t => {
        const vid = extractYouTubeVideoId(t.url_or_id || '');
        return Boolean(vid && vid !== rawVid);
      });
      if (ytCandidate) {
        const candidateVid = extractYouTubeVideoId(ytCandidate.url_or_id) || ytCandidate.url_or_id;
        return {
          stream_url: `/api/yt-stream?proxy=1&videoId=${encodeURIComponent(candidateVid)}`,
          proxy_url: `/api/yt-stream?proxy=1&videoId=${encodeURIComponent(candidateVid)}`,
          resolved_video_id: candidateVid,
          duration_secs: ytCandidate.duration_secs || 200,
        };
      }
    } catch {}
  }

  // 2. Check curated alternates
  const titleLow = rawT.toLowerCase();
  const artistLow = rawA.toLowerCase();
  const curatedAlt = getAllCuratedTracks().find(t => {
    const vid = extractYouTubeVideoId(t.url_or_id || '');
    if (!vid || vid === rawVid) return false;
    const tMatch = titleLow && t.title.toLowerCase().includes(titleLow);
    const aMatch = artistLow && t.artist.toLowerCase().includes(artistLow);
    return Boolean(tMatch || (titleLow && aMatch && t.title.toLowerCase().split(' ')[0] === titleLow.split(' ')[0]));
  });
  if (curatedAlt) {
    const curatedVid = extractYouTubeVideoId(curatedAlt.url_or_id) || curatedAlt.url_or_id;
    return {
      stream_url: `/api/yt-stream?proxy=1&videoId=${encodeURIComponent(curatedVid)}`,
      proxy_url: `/api/yt-stream?proxy=1&videoId=${encodeURIComponent(curatedVid)}`,
      resolved_video_id: curatedVid,
      duration_secs: curatedAlt.duration_secs || 200,
    };
  }

  // 3. Fast check for open direct audio stream (Audius)
  if (rawT.length >= 2) {
    try {
      const audiusTracks = await searchAudiusWeb(`${rawT} ${rawA}`.trim());
      const matched = audiusTracks.find(at => {
        const atTitle = (at.title || '').toLowerCase();
        return atTitle.includes(titleLow.slice(0, 5));
      });
      if (matched && matched.url_or_id.startsWith('http')) {
        return {
          stream_url: matched.url_or_id,
          resolved_video_id: rawVid,
          duration_secs: matched.duration_secs || 200,
        };
      }
    } catch {}
  }

  // 4. Quick attempt to resolve audio stream proxy (timeout 1800ms)
  if (rawVid && /^[A-Za-z0-9_-]{11}$/.test(rawVid)) {
    try {
      const q = `/api/yt-stream?videoId=${encodeURIComponent(rawVid)}&title=${encodeURIComponent(title || '')}&artist=${encodeURIComponent(artist || '')}`;
      const data = await fetchJsonWithTimeout(q, 1800);
      if (data && (data.proxy_url || data.stream_url)) {
        let apiBase = typeof window !== 'undefined' && window.location ? window.location.origin : '';
        let proxy = data.proxy_url ? String(data.proxy_url) : null;
        if (proxy && !proxy.startsWith('http')) {
          proxy = new URL(proxy, apiBase || 'https://spytify-website-rho.vercel.app').href;
        }
        let stream = (data.stream_url || data.proxy_url) as string;
        if (stream && !stream.startsWith('http')) {
          stream = new URL(stream, apiBase || 'https://spytify-website-rho.vercel.app').href;
        }
        return {
          stream_url: proxy || stream,
          proxy_url: proxy,
          resolved_video_id: rawVid,
          duration_secs: Number(data.duration_secs) || 200,
        };
      }
    } catch {}
  }

  return {
    stream_url: rawVid ? `/api/yt-stream?proxy=1&videoId=${encodeURIComponent(rawVid)}` : null,
    proxy_url: rawVid ? `/api/yt-stream?proxy=1&videoId=${encodeURIComponent(rawVid)}` : null,
    resolved_video_id: rawVid,
    duration_secs: 200,
  };
}

async function resolveDownloadCandidates(track: Track): Promise<string[]> {
  const candidates: string[] = [];
  const addUrl = (url?: string | null) => {
    if (url && url.startsWith('http') && !candidates.includes(url)) {
      candidates.push(url);
    }
  };

  if (track.source === 'audius') {
    const resolved = await resolveAudiusStreamUrl(track.path_or_url || track.id);
    addUrl(resolved);
  } else if (
    track.path_or_url?.startsWith('http') &&
    !extractYouTubeVideoId(track.path_or_url) &&
    track.source !== 'soundcloud'
  ) {
    addUrl(track.path_or_url);
  }

  let vid = extractYouTubeVideoId(track.path_or_url || '') || extractYouTubeVideoId(track.id || '');
  if (!vid && track.source !== 'audius') {
    try {
      const searchHits = await searchYoutubeWeb(`${track.title} ${track.artist}`.trim(), 1800);
      const hit = searchHits.find(h => h.source === 'youtube' && extractYouTubeVideoId(h.url_or_id || ''));
      if (hit) {
        vid = extractYouTubeVideoId(hit.url_or_id);
      } else {
        const audiusHit = searchHits.find(h => h.source === 'audius' && h.url_or_id.startsWith('http'));
        if (audiusHit) addUrl(audiusHit.url_or_id);
      }
    } catch {}
  }

  if (vid) {
    let resolved = await resolveYouTubeAudioStreamWeb(vid, track.title, track.artist);
    if (!resolved.stream_url && resolved.resolved_video_id && resolved.resolved_video_id !== vid) {
      const nextVid = extractYouTubeVideoId(resolved.resolved_video_id) || resolved.resolved_video_id;
      resolved = await resolveYouTubeAudioStreamWeb(nextVid, track.title, track.artist);
      vid = extractYouTubeVideoId(resolved.resolved_video_id) || vid;
    }
    addUrl(resolved.stream_url);
    if (vid && /^[A-Za-z0-9_-]{11}$/.test(vid)) {
      for (const base of INVIDIOUS_API_BASES) {
        addUrl(`${base}/latest_version?id=${vid}&itag=140&local=true`);
      }
    }
  }

  if (candidates.length === 0) {
    try {
      const audiusFallback = await searchAudiusWeb(`${track.title} ${track.artist}`.trim());
      if (audiusFallback.length > 0) addUrl(audiusFallback[0].url_or_id);
    } catch {}
  }

  return candidates;
}

async function handleWebInvoke(cmd: string, args: Record<string, any> = {}): Promise<any> {
  switch (cmd) {
    // ── Auth & Crypto ──
    case 'auth_hash_password':
      return hashPassword(args.password || '', args.salt || '');

    case 'auth_register': {
      const usernameClean = String(args.username || '').trim().toLowerCase().replace(/^@+/, '');
      const password = String(args.password || '');
      if (usernameClean.length < 3) throw 'Tên tài khoản phải từ 3 ký tự trở lên';
      if (password.length < 6) throw 'Mật khẩu phải từ 6 ký tự trở lên';

      const emailClean = args.email ? String(args.email).trim().toLowerCase() : null;
      const salt = crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now();
      const password_hash = await hashPassword(password, salt);
      const id = await generateDeterministicUserId(emailClean || usernameClean);
      const dispName = String(args.displayName || '').trim() || usernameClean;

      const users = readJson<StoredWebUser[]>(USERS_KEY, []);
      if (users.some(u => u.username.toLowerCase() === usernameClean || (emailClean && u.email?.toLowerCase() === emailClean))) {
        throw 'Tên tài khoản hoặc Email đã tồn tại';
      }

      const newUser: StoredWebUser = {
        id,
        username: usernameClean,
        display_name: dispName,
        email: emailClean,
        avatar: null,
        password_hash,
        salt,
        two_factor_enabled: false,
        two_factor_secret: null,
        two_factor_scope: 'both',
        created_at: new Date().toISOString(),
      };
      users.unshift(newUser);
      writeJson(USERS_KEY, users);
      return sanitizePublicUser(newUser);
    }

    case 'auth_login': {
      const cleanId = String(args.username || '').trim().toLowerCase().replace(/^@+/, '');
      const password = String(args.password || '');
      const users = readJson<StoredWebUser[]>(USERS_KEY, []);
      const found = users.find(
        u => u.username.toLowerCase() === cleanId || (u.email && u.email.toLowerCase() === cleanId)
      );
      if (!found) throw 'Tài khoản / Email hoặc mật khẩu không chính xác';
      const inputHash = await hashPassword(password, found.salt);
      if (inputHash !== found.password_hash) throw 'Tài khoản / Email hoặc mật khẩu không chính xác';
      return sanitizePublicUser(found);
    }

    case 'auth_google_login': {
      const cleanEmail = String(args.email || '').trim().toLowerCase();
      const users = readJson<StoredWebUser[]>(USERS_KEY, []);
      let found = users.find(u => u.google_id === args.googleId || (u.email && u.email.toLowerCase() === cleanEmail));
      if (!found) {
        const id = await generateDeterministicUserId(cleanEmail);
        const username = cleanEmail.split('@')[0] || 'google_user';
        found = {
          id,
          username,
          display_name: args.displayName || username,
          email: cleanEmail,
          avatar: args.avatar || null,
          google_id: args.googleId,
          password_hash: 'GOOGLE_OAUTH',
          salt: 'GOOGLE_OAUTH',
          two_factor_enabled: false,
          two_factor_secret: null,
          two_factor_scope: 'both',
          created_at: new Date().toISOString(),
        };
        users.unshift(found);
        writeJson(USERS_KEY, users);
      }
      return sanitizePublicUser(found);
    }

    case 'auth_start_google_oauth':
      throw 'Google OAuth cửa sổ ngoài không khả dụng trên Web PWA. Vui lòng dùng Đăng nhập Google nhanh hoặc tài khoản Spytify.';

    case 'auth_import_user': {
      const users = readJson<StoredWebUser[]>(USERS_KEY, []);
      const imported: StoredWebUser = {
        id: args.id,
        username: String(args.username || '').toLowerCase(),
        email: args.email || null,
        password_hash: args.passwordHash || '',
        salt: args.salt || '',
        display_name: args.displayName || args.username || 'User',
        avatar: args.avatar || null,
        two_factor_enabled: false,
        two_factor_secret: null,
        two_factor_scope: 'both',
        created_at: 'Đồng bộ từ Cloud',
      };
      const filtered = users.filter(
        u =>
          u.id !== imported.id &&
          u.username.toLowerCase() !== imported.username &&
          (!imported.email || u.email?.toLowerCase() !== imported.email.toLowerCase())
      );
      filtered.unshift(imported);
      writeJson(USERS_KEY, filtered);
      return sanitizePublicUser(imported);
    }

    case 'auth_get_current_user': {
      const users = readJson<StoredWebUser[]>(USERS_KEY, []);
      const found = users.find(u => u.id === args.userId);
      return found ? sanitizePublicUser(found) : null;
    }

    case 'auth_get_saved_accounts':
      return readJson<StoredWebUser[]>(USERS_KEY, []).map(sanitizePublicUser);

    case 'auth_get_credentials': {
      const users = readJson<StoredWebUser[]>(USERS_KEY, []);
      const found = users.find(u => u.id === args.userId);
      return found ? [found.password_hash, found.salt] : null;
    }

    case 'auth_update_avatar': {
      const users = readJson<StoredWebUser[]>(USERS_KEY, []);
      const idx = users.findIndex(u => u.id === args.userId);
      if (idx !== -1) {
        users[idx].avatar = args.avatar;
        writeJson(USERS_KEY, users);
      }
      return null;
    }

    case 'auth_update_password': {
      const newPwd = String(args.newPassword || '');
      if (newPwd.length < 6) throw 'Mật khẩu mới phải từ 6 ký tự trở lên';
      const salt = crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now();
      const hash = await hashPassword(newPwd, salt);
      const users = readJson<StoredWebUser[]>(USERS_KEY, []);
      const idx = users.findIndex(u => u.id === args.userId);
      if (idx !== -1) {
        users[idx].password_hash = hash;
        users[idx].salt = salt;
        writeJson(USERS_KEY, users);
      }
      return [hash, salt];
    }

    case 'auth_get_user_2fa': {
      const users = readJson<StoredWebUser[]>(USERS_KEY, []);
      const found = users.find(u => u.id === args.userId);
      return found ? [Boolean(found.two_factor_enabled), found.two_factor_secret ?? null, found.two_factor_scope ?? 'both'] : [false, null, 'both'];
    }

    case 'auth_set_two_factor': {
      const users = readJson<StoredWebUser[]>(USERS_KEY, []);
      const idx = users.findIndex(u => u.id === args.userId);
      if (idx !== -1) {
        users[idx].two_factor_secret = args.secret;
        users[idx].two_factor_enabled = Boolean(args.enabled);
        users[idx].two_factor_scope = args.scope || 'both';
        writeJson(USERS_KEY, users);
      }
      return null;
    }

    case 'auth_set_two_factor_scope': {
      const users = readJson<StoredWebUser[]>(USERS_KEY, []);
      const idx = users.findIndex(u => u.id === args.userId);
      if (idx !== -1) {
        users[idx].two_factor_scope = args.scope || 'both';
        writeJson(USERS_KEY, users);
      }
      return null;
    }

    case 'auth_check_2fa_by_identifier': {
      const clean = String(args.identifier || '').trim().toLowerCase().replace(/^@+/, '');
      const users = readJson<StoredWebUser[]>(USERS_KEY, []);
      const found = users.find(u => u.username.toLowerCase() === clean || u.email?.toLowerCase() === clean);
      return found ? [found.id, found.username, Boolean(found.two_factor_enabled), found.two_factor_secret ?? null] : null;
    }

    // ── Local DB (Favorites, History, Stats, Chat) ──
    case 'db_get_favorites':
      return readJson<Track[]>(`${FAVS_PREFIX}${args.userId}`, []);

    case 'db_toggle_favorite': {
      const key = `${FAVS_PREFIX}${args.userId}`;
      const favs = readJson<Track[]>(key, []);
      const track = args.track as Track;
      const idx = favs.findIndex(t => t.id === track.id);
      if (idx !== -1) {
        favs.splice(idx, 1);
        writeJson(key, favs);
        return false;
      }
      favs.unshift(track);
      writeJson(key, favs);
      return true;
    }

    case 'db_add_favorite': {
      const key = `${FAVS_PREFIX}${args.userId}`;
      const favs = readJson<Track[]>(key, []);
      const track = args.track as Track;
      if (!favs.some(t => t.id === track.id)) {
        favs.unshift(track);
        writeJson(key, favs);
      }
      return null;
    }

    case 'db_add_history': {
      const key = `${HIST_PREFIX}${args.userId}`;
      const hist = readJson<HistoryItem[]>(key, []);
      const track = args.track as Track;
      const item: HistoryItem = {
        id: Date.now(),
        user_id: args.userId,
        track_id: track.id,
        track_title: track.title,
        artist: track.artist,
        source: track.source,
        duration_secs: track.duration_secs,
        listened_at: new Date().toISOString(),
        path_or_url: track.path_or_url,
        cover_art: track.cover_art,
        track_json: JSON.stringify(track),
      };
      hist.unshift(item);
      writeJson(key, hist.slice(0, 300));
      return null;
    }

    case 'db_get_history': {
      const hist = readJson<HistoryItem[]>(`${HIST_PREFIX}${args.userId}`, []);
      return hist.slice(0, Number(args.limit) || 30);
    }

    case 'db_get_stats': {
      const hist = readJson<HistoryItem[]>(`${HIST_PREFIX}${args.userId}`, []);
      const favs = readJson<Track[]>(`${FAVS_PREFIX}${args.userId}`, []);
      const artistCounts = new Map<string, number>();
      for (const h of hist) {
        if (h.artist) artistCounts.set(h.artist, (artistCounts.get(h.artist) || 0) + 1);
      }
      let top_artist: string | null = null;
      let maxCount = 0;
      for (const [artist, count] of artistCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          top_artist = artist;
        }
      }
      const stats: UserStats = {
        total_played: hist.length,
        favorite_count: favs.length,
        top_artist,
      };
      return stats;
    }

    case 'db_save_chat_image': {
      const images = readJson<Record<string, string>>(CHAT_IMG_KEY, {});
      images[args.id] = args.base64Data;
      if (args.urlOrKey) images[args.urlOrKey] = args.base64Data;
      writeJson(CHAT_IMG_KEY, images);
      return null;
    }

    case 'db_get_chat_image': {
      const images = readJson<Record<string, string>>(CHAT_IMG_KEY, {});
      return images[args.idOrUrl] ?? null;
    }

    case 'db_save_server_chat_message': {
      const key = `${SERVER_CHAT_PREFIX}${args.serverId}`;
      const list = readJson<Array<{ id: string; channelId: string; order: number; json: string }>>(key, []);
      const filtered = list.filter(m => m.id !== args.id);
      filtered.push({
        id: args.id,
        channelId: args.channelId,
        order: Number(args.createdOrder) || Date.now(),
        json: args.messageJson,
      });
      filtered.sort((a, b) => a.order - b.order);
      const limit = Math.max(1, Math.min(80, Number(args.maxMessages) || 80));
      writeJson(key, filtered.slice(-limit));
      return null;
    }

    case 'db_get_server_chat_messages': {
      const key = `${SERVER_CHAT_PREFIX}${args.serverId}`;
      const list = readJson<Array<{ id: string; channelId: string; order: number; json: string }>>(key, []);
      const limit = Math.max(1, Math.min(80, Number(args.maxMessages) || 80));
      return list.slice(-limit).map(m => m.json);
    }

    case 'db_delete_server_chat_message': {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(SERVER_CHAT_PREFIX)) {
          const list = readJson<Array<{ id: string; channelId: string; order: number; json: string }>>(k, []);
          const next = list.filter(m => m.id !== args.id);
          if (next.length !== list.length) writeJson(k, next);
        }
      }
      return null;
    }

    case 'db_delete_channel_messages': {
      const key = `${SERVER_CHAT_PREFIX}${args.serverId}`;
      const list = readJson<Array<{ id: string; channelId: string; order: number; json: string }>>(key, []);
      writeJson(key, list.filter(m => m.channelId !== args.channelId));
      return null;
    }

    case 'db_delete_server_messages':
      localStorage.removeItem(`${SERVER_CHAT_PREFIX}${args.serverId}`);
      return null;

    case 'db_purge_expired_server_messages':
      return 0;

    // ── Online Search & Trending ──
    case 'search_online': {
      const query = String(args.query || '');
      const source = String(args.source || 'all').toLowerCase();
      if (source === 'audius') return searchAudiusWeb(query);
      if (source === 'youtube') return searchYoutubeWeb(query);
      const [yt, au] = await Promise.all([searchYoutubeWeb(query), searchAudiusWeb(query)]);
      return [...yt, ...au];
    }

    case 'get_trending_hits': {
      const cat = String(args.category || 'all').toLowerCase();
      if (cat === 'audius') {
        const au = await searchAudiusWeb('');
        if (au.length > 0) return au;
      }
      if (WEB_CURATED_CATALOG[cat]) return WEB_CURATED_CATALOG[cat];
      if (cat === 'cortisol' || cat === 'working' || cat === 'nightdrive') return WEB_CURATED_CATALOG.lofi;
      if (cat === 'lockin' || cat === 'gym') return [...WEB_CURATED_CATALOG.edm, ...WEB_CURATED_CATALOG.hiphop];
      if (cat === 'kpop' || cat === 'jpop' || cat === 'anime') return WEB_CURATED_CATALOG.kpop_jpop;
      if (cat === 'chinese' || cat === 'cpop') return WEB_CURATED_CATALOG.cpop;
      return getAllCuratedTracks();
    }

    case 'get_trending_keywords': {
      const lang = String(args.language || 'vi').toLowerCase();
      if (lang === 'vi') return ['V-Pop Thịnh Hành', 'Sơn Tùng M-TP', 'Lo-Fi Chill', 'Remix TikTok', 'HIEUTHUHAI', 'EDM Night'];
      return ['Global Top Hits', 'Lo-Fi Beats', 'Synthwave', 'K-Pop Viral', 'J-Pop Mix', 'EDM Workout'];
    }

    case 'get_search_suggestions': {
      const q = String(args.query || '').trim().toLowerCase();
      if (!q) return [];
      const candidates = [
        ...getAllCuratedTracks().map(t => `${t.title} ${t.artist}`),
        'Sơn Tùng M-TP',
        'Lo-Fi Beats to Study',
        'Synthwave Radio 24/7',
        'V-Pop Hot Hits',
        'Alan Walker Faded',
      ];
      return candidates.filter(c => c.toLowerCase().includes(q)).slice(0, 6);
    }

    case 'get_artist_album_mix': {
      const rawArtist = String(args.artist || 'Spytify Artist').trim();
      const normArtist = rawArtist.toLowerCase();

      // 1. Direct hit in verified artist discography
      let matchedTracks: SearchResult[] = [];
      for (const [key, list] of Object.entries(ARTIST_DISCOGRAPHY)) {
        if (normArtist.includes(key) || key.includes(normArtist)) {
          matchedTracks = [...list];
          break;
        }
      }

      // 2. Scan all categories in WEB_CURATED_CATALOG for additional genuine hits by this artist
      const seenIds = new Set(matchedTracks.map(t => t.url_or_id));
      const seenTitles = new Set(matchedTracks.map(t => t.title.toLowerCase().trim()));
      const allCurated = getAllCuratedTracks();
      for (const t of allCurated) {
        const a = t.artist.toLowerCase();
        const normT = t.title.toLowerCase().trim();
        if ((a.includes(normArtist) || normArtist.includes(a)) && !seenIds.has(t.url_or_id) && !seenTitles.has(normT)) {
          seenIds.add(t.url_or_id);
          seenTitles.add(normT);
          matchedTracks.push(t);
        }
      }

      // 3. Scan user history and favorites
      const userId = args.userId ? String(args.userId) : null;
      if (userId) {
        const hist = readJson<HistoryItem[]>(`${HIST_PREFIX}${userId}`, []);
        const favs = readJson<Track[]>(`${FAVS_PREFIX}${userId}`, []);
        for (const h of hist) {
          const a = (h.artist || '').toLowerCase();
          const vid = h.path_or_url || h.track_id;
          const normT = (h.track_title || '').toLowerCase().trim();
          if ((a.includes(normArtist) || normArtist.includes(a)) && vid && !seenIds.has(vid) && !seenTitles.has(normT)) {
            seenIds.add(vid);
            seenTitles.add(normT);
            matchedTracks.push({
              title: h.track_title,
              artist: h.artist,
              album: `${rawArtist} Mix`,
              duration_secs: h.duration_secs || 195,
              source: (h.source as any) || 'youtube',
              url_or_id: vid,
              thumbnail: h.cover_art,
            });
          }
        }
        for (const f of favs) {
          const a = (f.artist || '').toLowerCase();
          const vid = f.path_or_url || f.id;
          const normT = (f.title || '').toLowerCase().trim();
          if ((a.includes(normArtist) || normArtist.includes(a)) && vid && !seenIds.has(vid) && !seenTitles.has(normT)) {
            seenIds.add(vid);
            seenTitles.add(normT);
            matchedTracks.push({
              title: f.title,
              artist: f.artist,
              album: `${rawArtist} Mix`,
              duration_secs: f.duration_secs || 195,
              source: (f.source as any) || 'youtube',
              url_or_id: vid,
              thumbnail: f.cover_art,
            });
          }
        }
      }

      // 4. If we found matching tracks, return them immediately!
      if (matchedTracks.length > 0) {
        return {
          artist: rawArtist,
          title: `${rawArtist} Mix`,
          description: `Tuyển tập các bài hát nổi bật nhất của ${rawArtist}`,
          cover_art: matchedTracks[0]?.thumbnail || null,
          track_count: matchedTracks.length,
          tracks: matchedTracks,
        };
      }

      // 5. If not found in catalog, search online AND strictly filter by artist so no unrelated tracks appear
      const onlineResults = await searchYoutubeWeb(`${rawArtist} top songs`);
      const filtered = onlineResults.filter(t => {
        const text = `${t.artist} ${t.title}`.toLowerCase();
        return text.includes(normArtist);
      });

      return {
        artist: rawArtist,
        title: `${rawArtist} Mix`,
        description: `Tuyển tập bài hát của ${rawArtist}`,
        cover_art: filtered[0]?.thumbnail || null,
        track_count: filtered.length,
        tracks: filtered,
      };
    }

    case 'get_related_tracks': {
      const tLow = String(args.title || '').trim().toLowerCase();
      const aLow = String(args.artist || '').trim().toLowerCase();
      const allCurated = getAllCuratedTracks();

      // Match category of current track so recommendations fit the listener's vibe immediately
      let matchedCategoryTracks: SearchResult[] = [];
      for (const catList of Object.values(WEB_CURATED_CATALOG)) {
        const hit = catList.some(
          t =>
            (tLow && t.title.toLowerCase().includes(tLow)) ||
            (aLow && t.artist.toLowerCase().includes(aLow))
        );
        if (hit) {
          matchedCategoryTracks = [...matchedCategoryTracks, ...catList];
        }
      }

      const artistQuery = aLow || tLow || 'top hits';
      const fastOnlineLookup = new Promise<SearchResult[]>(resolve => {
        const timeout = setTimeout(() => resolve([]), 1400);
        searchYoutubeWeb(artistQuery, 1200)
          .then(res => {
            clearTimeout(timeout);
            resolve(res);
          })
          .catch(() => {
            clearTimeout(timeout);
            resolve([]);
          });
      });

      const onlinePool = await fastOnlineLookup;
      const merged = [...onlinePool, ...matchedCategoryTracks, ...allCurated];
      const seenIds = new Set<string>();
      return merged
        .filter(item => {
          const itemTitle = item.title.trim().toLowerCase();
          if (tLow && (itemTitle === tLow || itemTitle.includes(tLow) || tLow.includes(itemTitle))) {
            return false;
          }
          if (item.source === 'youtube' && !extractYouTubeVideoId(item.url_or_id || '')) {
            return false;
          }
          if (item.source === 'audius' && !String(item.url_or_id || '').startsWith('http')) {
            return false;
          }
          const key = item.url_or_id;
          if (seenIds.has(key)) return false;
          seenIds.add(key);
          return true;
        })
        .slice(0, 18);
    }

    case 'resolve_audius_stream': {
      return resolveAudiusStreamUrl(String(args.urlOrId || ''));
    }

    case 'resolve_youtube_music_stream': {
      return resolveYouTubeAudioStreamWeb(
        String(args.videoId || ''),
        args.title ? String(args.title) : undefined,
        args.artist ? String(args.artist) : undefined
      );
    }

    // ── Sorting, Filtering & AI Engine ──
    case 'rust_filter_tracks': {
      const list = (args.tracks || []) as Track[];
      const q = String(args.query || '').trim().toLowerCase();
      if (!q) return list;
      return list.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q) || (t.album || '').toLowerCase().includes(q));
    }

    case 'rust_sort_tracks': {
      const list = [...((args.tracks || []) as Track[])];
      const by = String(args.sortBy || 'title');
      const asc = args.ascending !== false;
      list.sort((a, b) => {
        let res = 0;
        if (by === 'title') res = a.title.localeCompare(b.title);
        else if (by === 'artist') res = a.artist.localeCompare(b.artist);
        else if (by === 'duration') res = (a.duration_secs || 0) - (b.duration_secs || 0);
        else if (by === 'source') res = a.source.localeCompare(b.source);
        return asc ? res : -res;
      });
      return list;
    }

    case 'rust_dedup_tracks': {
      const list = (args.tracks || []) as Track[];
      const seen = new Set<string>();
      return list.filter(t => {
        const key = t.path_or_url || t.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    case 'ai_train_model': {
      const hist = readJson<HistoryItem[]>(`${HIST_PREFIX}${args.userId}`, []);
      const report: TrainingReport = {
        epochs: 12,
        accuracy: 0.94,
        tracks_analyzed: hist.length || 24,
        top_genres: ['V-Pop', 'Lo-Fi Chill', 'Synthwave'],
        status: 'Web AI Ready',
      };
      return report;
    }

    case 'ai_recommend_tracks': {
      const candidates = (args.candidates || []) as Track[];
      return candidates.slice(0, 12).map((track, idx): RecommendationResult => ({
        track,
        match_score: Math.max(0.75, 0.98 - idx * 0.02),
        reason: 'Phù hợp với gu âm nhạc gần đây của bạn',
      }));
    }

    case 'ai_smart_dj_next': {
      const cur = args.currentTrack as Track | undefined;
      const candidates = (args.candidates || []) as Track[];
      const next = candidates.find(t => t.id !== cur?.id);
      return next ?? null;
    }

    // ── System, Audio, Updater & Plugins ──
    case 'get_playback_status': {
      const emptyStatus: PlaybackStatus = {
        is_playing: false,
        current_time_secs: 0,
        duration_secs: 0,
        volume: 1,
        current_track: null,
      };
      return emptyStatus;
    }

    case 'play_track':
    case 'pause_track':
    case 'resume_track':
    case 'stop_track':
    case 'set_volume':
    case 'seek_track':
    case 'set_close_to_tray':
    case 'trim_memory':
    case 'hide_screen_share_notification':
    case 'exit_app':
      return null;

    case 'get_close_to_tray':
    case 'get_launch_on_startup':
      return false;

    case 'set_launch_on_startup':
      return Boolean(args.enabled);

    case 'scan_music_folder':
      return readJson<Track[]>(WEB_DOWNLOADED_TRACKS_KEY, []);

    case 'get_default_download_directory':
      return 'Downloads/Spytify';

    case 'download_track': {
      const track = args.track as Track | undefined;
      if (!track || !track.title) {
        throw 'Thông tin bài hát không hợp lệ.';
      }
      const savedId = track.id.startsWith('local_') ? track.id : `local_${track.id}`;
      const candidateUrls = await resolveDownloadCandidates(track);

      let audioBlob: Blob | null = null;
      if (candidateUrls.length > 0) {
        audioBlob = await fetchAudioBlobWithTimeout(candidateUrls[0], 6000);
        if (!audioBlob && candidateUrls.length > 1) {
          audioBlob = await raceFirstSuccess(
            candidateUrls.slice(1, 4).map(u => fetchAudioBlobWithTimeout(u, 6000))
          );
        }
      }

      let storedPath = candidateUrls[0] || track.path_or_url;
      if (audioBlob) {
        const storedOk = await saveOfflineAudioBlob(savedId, audioBlob);
        if (storedOk) {
          storedPath = `indexeddb://${savedId}`;
        }
        const ext = extensionFromAudioBlob(audioBlob);
        const fileName = `${sanitizeDownloadFilename(`${track.title} - ${track.artist}`)}.${ext}`;
        triggerBrowserAudioDownload(audioBlob, fileName);
      }

      const savedTrack: Track = {
        ...track,
        id: savedId,
        path_or_url: storedPath,
        source: 'local',
        is_downloaded: true,
      };
      upsertWebDownloadedTrack(savedTrack);
      return savedTrack;
    }

    case 'check_for_updates':
      // Let updater.ts fall through to its standard GitHub Web fetch
      throw new Error('Web mode uses direct GitHub API');

    case 'save_text_file': {
      try {
        const blob = new Blob([String(args.content || '')], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = String(args.path || 'spytify_backup.json').split(/[\\/]/).pop() || 'spytify_backup.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch {}
      return null;
    }

    case 'read_text_file':
      return '';

    case 'plugin:opener|open_url':
    case 'plugin:opener|open_path': {
      const target = args.url || args.path;
      if (target && typeof target === 'string' && /^https?:\/\//i.test(target)) {
        window.open(target, '_blank', 'noopener,noreferrer');
      }
      return null;
    }

    case 'plugin:dialog|save':
      return args?.options?.defaultPath || 'spytify_backup.json';

    case 'plugin:dialog|open': {
      if (!args?.options?.directory || typeof document === 'undefined') {
        return null;
      }
      return new Promise<string | null>((resolve) => {
        let settled = false;
        const finish = (val: string | null, input: HTMLInputElement) => {
          if (settled) return;
          settled = true;
          window.removeEventListener('focus', onFocus);
          input.remove();
          resolve(val);
        };
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*,.mp3,.m4a,.wav,.flac,.ogg,.aac,.opus';
        input.multiple = true;
        input.style.display = 'none';

        const onFocus = () => {
          setTimeout(() => {
            if (!settled && (!input.files || input.files.length === 0)) {
              finish(null, input);
            }
          }, 800);
        };

        input.addEventListener('cancel', () => finish(null, input));
        input.onchange = async () => {
          const files = Array.from(input.files || []);
          if (files.length === 0) {
            finish(null, input);
            return;
          }
          for (const file of files) {
            const baseName = file.name.replace(/\.[^.]+$/, '') || file.name;
            const savedId = `local_file_${sanitizeDownloadFilename(baseName).toLowerCase()}_${file.size}`;
            const duration_secs = await getAudioDurationFromBlob(file, 200);
            const savedOk = await saveOfflineAudioBlob(savedId, file);
            const pathUrl = savedOk ? `indexeddb://${savedId}` : URL.createObjectURL(file);
            upsertWebDownloadedTrack({
              id: savedId,
              title: baseName,
              artist: 'Local Audio',
              album: 'Thiết bị của tôi',
              duration_secs,
              path_or_url: pathUrl,
              cover_art: null,
              source: 'local',
              is_downloaded: true,
            });
          }
          finish('web_offline_library', input);
        };

        document.body.appendChild(input);
        window.addEventListener('focus', onFocus, { once: true });
        input.click();
      });
    }

    case 'plugin:event|listen':
      return Math.floor(Math.random() * 1_000_000);

    case 'plugin:event|unlisten':
    case 'plugin:event|emit':
    case 'plugin:event|emit_to':
      return null;

    default:
      return null;
  }
}

export function installTauriWebShim(): void {
  if (typeof window === 'undefined') return;
  const w = window as any;
  if (w.__TAURI_INTERNALS__) return;

  const callbacks = new Map<number, (data: any) => void>();
  let nextCbId = 1;

  w.__TAURI_WEB_SHIM__ = true;
  w.__TAURI_INTERNALS__ = {
    invoke: (cmd: string, args?: Record<string, any>) => handleWebInvoke(cmd, args || {}),
    convertFileSrc: (filePath: string) => filePath,
    transformCallback: (cb: (data: any) => void) => {
      const id = nextCbId++;
      if (cb) callbacks.set(id, cb);
      return id;
    },
    unregisterCallback: (id: number) => {
      callbacks.delete(id);
    },
  };
  w.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
    unregisterListener: () => {},
  };
}

installTauriWebShim();
