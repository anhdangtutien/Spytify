import { extractCleanYtId } from '../utils/trackUtils';

// In-memory cache for resolved 7clouds video IDs: key = `${title}___${artist}`.toLowerCase()
const sevenCloudsCache = new Map<string, string>();

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
 * Checks if author or title matches 7clouds or 7clouds rap
 */
function is7CloudsMatch(item: { author?: string; title?: string }): boolean {
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

  try {
    const apiBase =
      typeof window !== 'undefined' && window.location && window.location.origin
        ? window.location.origin
        : 'https://spytify-website-rho.vercel.app';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2600);

    let res: Response | null = null;
    try {
      res = await fetch(`/api/yt-search?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      });
    } catch {
      // Fallback to absolute production URL if relative fetch fails
      res = await fetch(
        `https://spytify-website-rho.vercel.app/api/yt-search?q=${encodeURIComponent(query)}`,
        { signal: controller.signal }
      );
    }
    clearTimeout(timeoutId);

    if (res && res.ok) {
      const data = await res.json();
      const items: Array<{ videoId: string; title: string; author: string }> = data?.items || [];

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
    }
  } catch (err) {
    console.debug('[7clouds Resolver] Search error, using fallback MV:', err);
  }

  // Not found: save fallback to cache so we avoid repeated queries
  sevenCloudsCache.set(cacheKey, cleanFallback);
  return cleanFallback;
}

/**
 * Cleans track metadata if the track came directly from a lyric/7clouds video.
 * E.g. "Ellie Goulding - Hate Me (Lyrics) ft. Juice Wrld" ->
 * Title: "Hate Me", Artist: "Ellie Goulding, Juice WRLD"
 */
export function cleanTrackMetadata(rawTitle: string, rawArtist?: string): { title: string; artist: string } {
  let t = (rawTitle || '').trim();
  let a = (rawArtist || '').trim();

  // If author is "7clouds Rap" or "7clouds", do not display "7clouds" as the artist name!
  if (is7CloudsMatch({ author: a })) {
    a = '';
  }

  // Often titles are formatted as "Artist - Title [Lyrics] ft. Someone"
  if (t.includes(' - ')) {
    const parts = t.split(' - ');
    if (!a && parts.length >= 2) {
      a = parts[0].trim();
      t = parts.slice(1).join(' - ').trim();
    }
  }

  // Remove lyric annotations
  t = t
    .replace(/\s*\((?:lyrics?|lyric|audio|official\s*audio|visualizer)\s*\)/gi, '')
    .replace(/\s*\[(?:lyrics?|lyric|audio|official\s*audio|visualizer)\s*\]/gi, '')
    .replace(/\s*\((?:cùng với|với|cùng)\s+([^)]+)\)/gi, ' (feat. $1)')
    .replace(/\s*\[(?:cùng với|với|cùng)\s+([^\]]+)\]/gi, ' (feat. $1)')
    .replace(/\s*\[(?:Official\s*(?:Music\s*)?Video|MV|HD|4K)\]/gi, '')
    .replace(/\s*\((?:Official\s*(?:Music\s*)?Video|MV|HD|4K)\)/gi, '')
    .trim();

  return {
    title: t || rawTitle,
    artist: a || rawArtist || 'YouTube Music',
  };
}
