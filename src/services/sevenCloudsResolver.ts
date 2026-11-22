import { extractCleanYtId } from '../utils/trackUtils';

// In-memory cache for resolved 7clouds video IDs: key = `${title}___${artist}`.toLowerCase()
const sevenCloudsCache = new Map<string, string>();
// In-memory cache for unblocked alternative video IDs (Topic / 7clouds / Lyric channels)
const unblockedAudioCache = new Map<string, string>();

/**
 * Known high-quality lyric and audio channels on YouTube that do not block embedding
 * and do not include movie/MV intro/outro dialogues.
 */
const KNOWN_LYRIC_CHANNELS = [
  '7clouds',
  '7clouds rap',
  '7clouds country',
  '7clouds indie',
  '7clouds dance',
  'taz network',
  'shadow music',
  'cassiopeia',
  'lyrical lemonade',
  'vibe music',
  'unique vibes',
  'sensual musique',
  'chill nation',
  'trap nation',
  'rap nation',
  'house nation',
  'indie nation',
  'wavemusic',
  'proximity',
  'syrebralvibes',
  'superblyrics',
  'the vibe guide',
  'dan music',
  'mistletoe',
  'marvele',
];

/**
 * Normalizes title & artist by removing bracketed info, feat tags, etc.
 */
function cleanQueryTerm(text: string): string {
  if (!text) return '';
  return text
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\b(?:feat|ft|cùng với|với|official\s*music\s*video|official\s*video|mv|audio|lyrics?)\b/gi, ' ')
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if author matches an official YouTube Music Topic channel.
 * (e.g. "Juice WRLD - Topic", "The Weeknd - Topic")
 * Topic audio streams have clean studio sound and are embed-enabled worldwide.
 */
export function isTopicChannel(author?: string): boolean {
  if (!author) return false;
  const a = author.trim().toLowerCase();
  return a.endsWith('- topic') || a.endsWith(' topic') || a.includes(' - topic') || a === 'topic';
}

/**
 * Checks if author or title matches 7clouds or 7clouds rap
 */
export function is7CloudsMatch(item: { author?: string; title?: string }): boolean {
  const author = (item.author || '').toLowerCase();
  const title = (item.title || '').toLowerCase();
  return (
    author.includes('7cloud') ||
    author.includes('7 cloud') ||
    title.includes('7cloud') ||
    title.includes('7 cloud') ||
    author.includes('7clouds rap') ||
    title.includes('7clouds rap')
  );
}

/**
 * Checks if author or title matches any known lyric / audio channel
 */
export function isLyricChannelMatch(author?: string, title?: string): boolean {
  const a = (author || '').toLowerCase();
  const t = (title || '').toLowerCase();
  if (is7CloudsMatch({ author, title })) return true;
  if (isTopicChannel(author)) return true;
  if (KNOWN_LYRIC_CHANNELS.some(c => a.includes(c) || t.includes(c))) return true;
  if (t.includes('(lyrics)') || t.includes('[lyrics]') || t.includes('(lyric video)') || t.includes('[lyric video]')) return true;
  return false;
}

/**
 * Helper to query high-speed YouTube search API
 */
async function queryYtSearch(query: string): Promise<Array<{ videoId: string; title: string; author: string }>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2800);

    let res: Response | null = null;
    try {
      res = await fetch(`/api/yt-search?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      });
    } catch {
      res = await fetch(
        `https://spytify-website-rho.vercel.app/api/yt-search?q=${encodeURIComponent(query)}`,
        { signal: controller.signal }
      );
    }
    clearTimeout(timeoutId);

    if (res && res.ok) {
      const data = await res.json();
      return (data?.items || []) as Array<{ videoId: string; title: string; author: string }>;
    }
  } catch {}
  return [];
}

/**
 * Synchronously retrieves a cached 7clouds video ID if available in memory or sessionStorage.
 * This guarantees 0ms lookup without breaking user gesture / mobile autoplay.
 */
export function getCached7CloudsVideoId(title: string, artist: string): string | null {
  if (!title) return null;
  const cleanT = cleanQueryTerm(title);
  const cleanA = cleanQueryTerm(artist);
  if (!cleanT) return null;
  const cacheKey = `${cleanT.toLowerCase()}___${cleanA.toLowerCase()}`;
  if (sevenCloudsCache.has(cacheKey)) {
    return sevenCloudsCache.get(cacheKey)!;
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      const stored = sessionStorage.getItem(`spytify_7c_${cacheKey}`);
      if (stored) {
        sevenCloudsCache.set(cacheKey, stored);
        return stored;
      }
    }
  } catch {}
  return null;
}

/**
 * Resolves a YouTube track to its 7clouds / 7clouds rap version if available.
 * If found, returns the 7clouds video ID (providing clean playback without intro/outro pauses).
 * If not found, falls back to the original video ID.
 */
export async function resolve7CloudsVideoId(
  title: string,
  artist: string,
  fallbackVideoId: string
): Promise<string> {
  const cleanFallback = extractCleanYtId(fallbackVideoId) || fallbackVideoId.trim();
  if (!title || title.trim().length === 0) return cleanFallback;

  const cleanT = cleanQueryTerm(title);
  const cleanA = cleanQueryTerm(artist);
  if (!cleanT) return cleanFallback;

  const cacheKey = `${cleanT.toLowerCase()}___${cleanA.toLowerCase()}`;
  if (sevenCloudsCache.has(cacheKey)) {
    return sevenCloudsCache.get(cacheKey)!;
  }

  // Also check sessionStorage if available
  try {
    if (typeof sessionStorage !== 'undefined') {
      const stored = sessionStorage.getItem(`spytify_7c_${cacheKey}`);
      if (stored) {
        sevenCloudsCache.set(cacheKey, stored);
        return stored;
      }
    }
  } catch {}

  const query = `${cleanT} ${cleanA} 7clouds rap`.trim();
  const items = await queryYtSearch(query);

  // 1. First priority: exact 7clouds Rap or 7clouds channel
  const sevenCloudsItem = items.find(i => is7CloudsMatch(i) && i.videoId);

  if (sevenCloudsItem?.videoId) {
    const foundVid = extractCleanYtId(sevenCloudsItem.videoId) || sevenCloudsItem.videoId;
    sevenCloudsCache.set(cacheKey, foundVid);
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(`spytify_7c_${cacheKey}`, foundVid);
      }
    } catch {}
    return foundVid;
  }

  // Not found: save fallback to cache so we avoid repeated queries
  sevenCloudsCache.set(cacheKey, cleanFallback);
  return cleanFallback;
}

/**
 * Resolves an unblocked alternative video when a YouTube song is embed-restricted (code 101/150)
 * or unavailable. Searches in order of priority:
 * 1. Official YouTube Music Topic Channel ("Artist - Topic")
 * 2. 7clouds / 7clouds Rap
 * 3. Similar Lyric Channels (Taz Network, Shadow Music, Cassiopeia, Vibe Music, etc.)
 */
export async function resolveUnblockedAudioVideoId(
  title: string,
  artist: string,
  blockedVideoId?: string
): Promise<string | null> {
  const cleanBlocked = blockedVideoId ? (extractCleanYtId(blockedVideoId) || blockedVideoId.trim()) : '';
  if (!title || title.trim().length === 0) return null;

  const cleanT = cleanQueryTerm(title);
  const cleanA = cleanQueryTerm(artist);
  if (!cleanT) return null;

  const unblockKey = `${cleanT.toLowerCase()}___${cleanA.toLowerCase()}`;
  if (unblockedAudioCache.has(unblockKey)) {
    const hit = unblockedAudioCache.get(unblockKey)!;
    if (hit !== cleanBlocked) return hit;
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      const stored = sessionStorage.getItem(`spytify_unblocked_${unblockKey}`);
      if (stored && stored !== cleanBlocked) {
        unblockedAudioCache.set(unblockKey, stored);
        return stored;
      }
    }
  } catch {}

  // 1. First priority: YouTube Music Topic channel (Official unblocked studio audio, no intro/outro delays)
  const topicItems = await queryYtSearch(`${cleanT} ${cleanA} topic`);
  const topicHit = topicItems.find(i => {
    const vid = extractCleanYtId(i.videoId) || i.videoId;
    return vid && vid !== cleanBlocked && isTopicChannel(i.author);
  });
  if (topicHit?.videoId) {
    const found = extractCleanYtId(topicHit.videoId) || topicHit.videoId;
    unblockedAudioCache.set(unblockKey, found);
    try { sessionStorage.setItem(`spytify_unblocked_${unblockKey}`, found); } catch {}
    return found;
  }

  // 2. Second priority: 7clouds Rap or 7clouds channel
  const sevenCloudsItems = await queryYtSearch(`${cleanT} ${cleanA} 7clouds rap`);
  const sevenCloudsHit = sevenCloudsItems.find(i => {
    const vid = extractCleanYtId(i.videoId) || i.videoId;
    return vid && vid !== cleanBlocked && is7CloudsMatch(i);
  });
  if (sevenCloudsHit?.videoId) {
    const found = extractCleanYtId(sevenCloudsHit.videoId) || sevenCloudsHit.videoId;
    unblockedAudioCache.set(unblockKey, found);
    try { sessionStorage.setItem(`spytify_unblocked_${unblockKey}`, found); } catch {}
    return found;
  }

  // 3. Third priority: Known lyric channels (Taz Network, Shadow Music, Cassiopeia, Vibe Music, etc.)
  const lyricItems = await queryYtSearch(`${cleanT} ${cleanA} lyrics`);
  const recognizedLyricHit = lyricItems.find(i => {
    const vid = extractCleanYtId(i.videoId) || i.videoId;
    return vid && vid !== cleanBlocked && isLyricChannelMatch(i.author, i.title);
  });
  if (recognizedLyricHit?.videoId) {
    const found = extractCleanYtId(recognizedLyricHit.videoId) || recognizedLyricHit.videoId;
    unblockedAudioCache.set(unblockKey, found);
    try { sessionStorage.setItem(`spytify_unblocked_${unblockKey}`, found); } catch {}
    return found;
  }

  // 4. Any alternative video with "Lyrics" or "Audio" in the title that is not the blocked one
  const anyAudioHit = [...topicItems, ...sevenCloudsItems, ...lyricItems].find(i => {
    const vid = extractCleanYtId(i.videoId) || i.videoId;
    if (!vid || vid === cleanBlocked) return false;
    const t = (i.title || '').toLowerCase();
    return t.includes('lyric') || t.includes('audio') || t.includes('topic');
  });
  if (anyAudioHit?.videoId) {
    const found = extractCleanYtId(anyAudioHit.videoId) || anyAudioHit.videoId;
    unblockedAudioCache.set(unblockKey, found);
    try { sessionStorage.setItem(`spytify_unblocked_${unblockKey}`, found); } catch {}
    return found;
  }

  return null;
}

/**
 * Cleans track metadata if the track came directly from a lyric/7clouds/topic video.
 * E.g. "Ellie Goulding - Hate Me (Lyrics) ft. Juice Wrld" ->
 * Title: "Hate Me", Artist: "Ellie Goulding, Juice WRLD"
 */
export function cleanTrackMetadata(rawTitle: string, rawArtist?: string): { title: string; artist: string } {
  let t = (rawTitle || '').trim();
  let a = (rawArtist || '').trim();

  // If author is "7clouds Rap", "7clouds", or "Topic", do not display channel name as artist!
  if (is7CloudsMatch({ author: a })) {
    a = '';
  }
  if (isTopicChannel(a)) {
    a = a.replace(/\s*-\s*topic$/i, '').replace(/\s+topic$/i, '').trim();
  }

  // Often titles are formatted as "Artist - Title [Lyrics] ft. Someone"
  if (t.includes(' - ')) {
    const parts = t.split(' - ');
    const possibleArtist = parts[0].trim();
    const possibleTitle = parts.slice(1).join(' - ').trim();

    if (!a || a.toLowerCase() === 'youtube' || a.toLowerCase() === 'various artists') {
      a = possibleArtist;
    }
    t = possibleTitle;
  }

  // Strip lyric / 7clouds tags from title
  t = t
    .replace(/\s*\((?:lyrics?|lyric\s*video|audio|official\s*audio|official\s*lyric\s*video|7clouds(?:\s*rap)?)\)/gi, '')
    .replace(/\s*\[(?:lyrics?|lyric\s*video|audio|official\s*audio|official\s*lyric\s*video|7clouds(?:\s*rap)?)\]/gi, '')
    .trim();

  return {
    title: t || rawTitle,
    artist: a || rawArtist || 'YouTube',
  };
}
