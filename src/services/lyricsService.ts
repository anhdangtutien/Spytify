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
    .trim();
}

/**
 * Extracts primary artist if multiple are separated by comma, ampersand, or slash.
 */
export function extractPrimaryArtist(artist: string): string {
  if (!artist) return '';
  return cleanArtistName(artist)
    .replace(/\s*[,&/]\s*.*$/, '')
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
  const primaryA = extractPrimaryArtist(artist);
  const targetDuration = durationSecs && durationSecs > 0 && durationSecs < 86400 ? Math.round(durationSecs) : undefined;
  const cacheKey = `${cleanT.toLowerCase()}__${cleanA.toLowerCase()}__${targetDuration || 0}`;

  if (lyricsCache.has(cacheKey)) {
    return lyricsCache.get(cacheKey) || null;
  }

  const userAgentHeaders = { 'User-Agent': 'SpytifyMusicPlayer/1.1 (https://github.com/anhdangtutien/Spytify)' };

  const tryGetExact = async (t: string, a: string, dur?: number): Promise<any | null> => {
    try {
      const params = new URLSearchParams({ track_name: t, artist_name: a });
      if (dur && dur > 0) params.append('duration', String(dur));
      const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, { headers: userAgentHeaders });
      if (res.ok) return await res.json();
    } catch {}
    return null;
  };

  try {
    // 1. Exact match attempt with duration
    let exactData = targetDuration ? await tryGetExact(cleanT, cleanA, targetDuration) : null;
    
    // 1b. If exact match with duration failed (often 404 due to slight YouTube duration mismatch), try exact match WITHOUT duration
    if (!exactData) {
      exactData = await tryGetExact(cleanT, cleanA);
    }

    // 1c. If still failed and multiple artists were given, try with primary artist alone
    if (!exactData && primaryA && primaryA.toLowerCase() !== cleanA.toLowerCase()) {
      exactData = await tryGetExact(cleanT, primaryA, targetDuration) || await tryGetExact(cleanT, primaryA);
    }

    if (exactData) {
      if (exactData.syncedLyrics) {
        const lines = parseLrc(exactData.syncedLyrics);
        const result: LyricsData = {
          synced: true,
          lines,
          plainText: exactData.plainLyrics,
          source: 'LRCLIB',
        };
        lyricsCache.set(cacheKey, result);
        return result;
      } else if (exactData.plainLyrics) {
        const result: LyricsData = {
          synced: false,
          lines: exactData.plainLyrics.split('\n').filter(Boolean).map((t: string) => ({ time: 0, text: t.trim() })),
          plainText: exactData.plainLyrics,
          source: 'LRCLIB',
        };
        lyricsCache.set(cacheKey, result);
        return result;
      }
    }

    // 2. Broad search fallback on LRCLIB
    const searchQueries = [
      `${cleanT} ${cleanA}`,
      primaryA && primaryA.toLowerCase() !== cleanA.toLowerCase() ? `${cleanT} ${primaryA}` : null,
      cleanT,
    ].filter(Boolean) as string[];

    for (const q of searchQueries) {
      const searchRes = await fetch(
        `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`,
        { headers: userAgentHeaders }
      );

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (Array.isArray(searchData) && searchData.length > 0) {
          // Filter candidates that have synced lyrics
          const syncedCandidates = searchData.filter((item: any) => Boolean(item.syncedLyrics));
          
          if (syncedCandidates.length > 0) {
            // If we know track duration, rank candidates by closest duration to eliminate radio/acoustic/live mismatches
            if (targetDuration) {
              syncedCandidates.sort(
                (a: any, b: any) => Math.abs((a.duration || 0) - targetDuration) - Math.abs((b.duration || 0) - targetDuration)
              );
            }
            const chosen = syncedCandidates[0];
            const lines = parseLrc(chosen.syncedLyrics);
            const result: LyricsData = {
              synced: true,
              lines,
              plainText: chosen.plainLyrics,
              source: 'LRCLIB',
            };
            lyricsCache.set(cacheKey, result);
            return result;
          }

          // If no synced lyrics, fallback to closest plainLyrics item
          const plainCandidates = searchData.filter((item: any) => Boolean(item.plainLyrics));
          if (plainCandidates.length > 0) {
            if (targetDuration) {
              plainCandidates.sort(
                (a: any, b: any) => Math.abs((a.duration || 0) - targetDuration) - Math.abs((b.duration || 0) - targetDuration)
              );
            }
            const chosen = plainCandidates[0];
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
    }

    // Cache negative lookup
    lyricsCache.set(cacheKey, null);
    return null;
  } catch (err) {
    console.warn('[Lyrics] Fetch failed:', err);
    return null;
  }
}
