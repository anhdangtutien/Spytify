export interface LyricLine {
  time: number; // in seconds
  text: string;
}

export interface LyricsData {
  synced: boolean;
  lines: LyricLine[];
  plainText?: string;
  source?: string;
}

const lyricsCache = new Map<string, LyricsData | null>();

/**
 * Sanitizes messy titles from YouTube/SoundCloud (e.g. "[Official MV]", "(Lyrics)", "ft. ...")
 * to improve search hit rates on LRCLIB.
 */
export function cleanTrackTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/\[(?:official\s*(?:video|audio|music\s*video|mv)?|mv|hd|4k|audio|lyrics?)\]/gi, '')
    .replace(/\((?:official\s*(?:video|audio|music\s*video|mv)?|mv|hd|4k|audio|lyrics?|remastered|explicit)\)/gi, '')
    .replace(/\|.*$/g, '')
    .replace(/ft\.?.*$/i, '')
    .replace(/feat\.?.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanArtistName(artist: string): string {
  if (!artist) return '';
  return artist
    .replace(/ - Topic$/i, '')
    .replace(/VEVO$/i, '')
    .replace(/Official$/i, '')
    .replace(/\s*[,&/]\s*.*$/, '') // take primary artist if multiple
    .trim();
}

/**
 * Parses raw LRC string into sorted array of timestamped lines.
 * Format: [mm:ss.xx] Lyric text
 */
export function parseLrc(lrcText: string): LyricLine[] {
  if (!lrcText) return [];
  const lines: LyricLine[] = [];
  const regex = /\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\](.*)/;

  const rawLines = lrcText.split('\n');
  for (const raw of rawLines) {
    const match = raw.trim().match(regex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseFloat(match[2]);
      const time = minutes * 60 + seconds;
      const text = match[3].trim();
      if (text) {
        lines.push({ time, text });
      }
    }
  }

  // Sort ascending by time
  lines.sort((a, b) => a.time - b.time);
  return lines;
}

/**
 * Fetches lyrics from LRCLIB open-source lyrics API.
 */
export async function fetchLyrics(
  title: string,
  artist: string,
  durationSecs?: number
): Promise<LyricsData | null> {
  const cleanT = cleanTrackTitle(title);
  const cleanA = cleanArtistName(artist);
  const cacheKey = `${cleanT.toLowerCase()}__${cleanA.toLowerCase()}`;

  if (lyricsCache.has(cacheKey)) {
    return lyricsCache.get(cacheKey) || null;
  }

  try {
    // 1. Try exact match on LRCLIB
    const params = new URLSearchParams({
      track_name: cleanT,
      artist_name: cleanA,
    });
    if (durationSecs && durationSecs > 0) {
      params.append('duration', String(Math.round(durationSecs)));
    }

    const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
      headers: { 'User-Agent': 'SpytifyMusicPlayer/1.1 (https://github.com/anhdangtutien/Spytify)' },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.syncedLyrics) {
        const lines = parseLrc(data.syncedLyrics);
        const result: LyricsData = {
          synced: true,
          lines,
          plainText: data.plainLyrics,
          source: 'LRCLIB',
        };
        lyricsCache.set(cacheKey, result);
        return result;
      } else if (data.plainLyrics) {
        const result: LyricsData = {
          synced: false,
          lines: data.plainLyrics.split('\n').filter(Boolean).map((t: string) => ({ time: 0, text: t.trim() })),
          plainText: data.plainLyrics,
          source: 'LRCLIB',
        };
        lyricsCache.set(cacheKey, result);
        return result;
      }
    }

    // 2. Fallback to broad search on LRCLIB
    const searchRes = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanT} ${cleanA}`)}`,
      {
        headers: { 'User-Agent': 'SpytifyMusicPlayer/1.1 (https://github.com/anhdangtutien/Spytify)' },
      }
    );

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (Array.isArray(searchData) && searchData.length > 0) {
        // Find best match with synced lyrics first
        const bestSynced = searchData.find((item: any) => Boolean(item.syncedLyrics));
        const chosen = bestSynced || searchData[0];
        if (chosen.syncedLyrics) {
          const lines = parseLrc(chosen.syncedLyrics);
          const result: LyricsData = {
            synced: true,
            lines,
            plainText: chosen.plainLyrics,
            source: 'LRCLIB',
          };
          lyricsCache.set(cacheKey, result);
          return result;
        } else if (chosen.plainLyrics) {
          const result: LyricsData = {
            synced: false,
            lines: chosen.plainLyrics.split('\n').filter(Boolean).map((t: string) => ({ time: 0, text: t.trim() })),
            plainText: chosen.plainLyrics,
            source: 'LRCLIB',
          };
          lyricsCache.set(cacheKey, result);
          return result;
        }
      }
    }

    // Cache negative lookup for 60s
    lyricsCache.set(cacheKey, null);
    return null;
  } catch (err) {
    console.warn('[Lyrics] Fetch failed:', err);
    return null;
  }
}
