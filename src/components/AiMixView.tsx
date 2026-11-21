import React, { useState, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Cpu, Sparkles, Play, Music, RefreshCw, Loader2, CheckCircle2, Sliders, Zap, Compass, AudioLines,
  X, Shuffle, FolderCheck, FolderPlus, Library, Heart, Mic2, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Track, User, RecommendationResult, TrainingReport, SearchResult, ArtistMix } from '../types';
import { LanguageCode, getTranslation } from '../locales/i18n';
import { getContrastTextColor, optimizeThumbnailUrl, handleImageError } from '../utils/trackUtils';
import { 
  DEFAULT_FEATURED_ARTISTS, 
  POPULAR_ARTIST_AVATARS, 
  getOrResolveArtistAvatar, 
  fetchArtistPortraitOnline 
} from '../utils/artistAvatars';

interface AiMixViewProps {
  currentUser: User | null;
  allTracks: Track[];
  onPlayTrack: (track: Track) => void;
  onOpenAuth: () => void;
  smartDjEnabled: boolean;
  onToggleSmartDj: () => void;
  accentColor?: string;
  language?: LanguageCode;
  onPlaySearchResult?: (track: SearchResult, list?: SearchResult[]) => void;
  currentTrack?: Track | null;
  isPlaying?: boolean;
  favorites?: Set<string>;
  onToggleFavorite?: (trackId: string) => void;
  albums?: { id: string; title: string; tracks: any[] }[];
  onSaveArtistMixAsAlbum?: (mix: ArtistMix) => void;
  onNavigateToAlbums?: () => void;
  onPlayArtistMix?: (mix: ArtistMix, trackOrIndex: SearchResult | number) => void;
}

// Default featured artists are imported from ../utils/artistAvatars

const DEFAULT_GENRES = [
  // ─── MOOD & LIFESTYLE VIBE PLAYLISTS ───
  'Low Cortisol & Chill',
  'Deep Focus & Working',
  'Lock In & Grind Mode',
  'Gym & Beast Workout',
  'Late Night Drive',
  'Coffee Shop & Study',
  'Rainy Day Acoustic',
  'Gaming & Phonk Rush',
  'Peaceful Sleep & Ambient',
  'Morning Boost & Vibes',

  // ─── MUSIC GENRES & REGIONAL HITS ───
  'K-Pop & Idol',
  'V-Pop Trending',
  'US-UK Pop Hits',
  'EDM & Festival Dance',
  'Lo-Fi Chill & Study',
  'Phonk & Drift Beats',
  'Hip-Hop, Rap & Trap',
  'Acoustic & Indie Ballad',
  'R&B & Neo-Soul',
  'J-Pop & Anime OST',
  'C-Pop & Mandopop',
  'Synthwave & Cyberpunk 80s',
  'Deep House & Club Remix',
  'City Pop & Retro Groove',
  'Rock & Alternative',
  'Drill & UK Bass',
  'Hyperpop & Glitchcore',
  'Jazz & Coffee Lounge',
  'Cinematic & Epic Soundtracks',
  'Nightcore & Speed Up Remix',
];

const GENRE_SEARCH_QUERIES: Record<string, string> = {
  // Mood & Activity Playlists
  'Low Cortisol & Chill': 'low cortisol playlist peaceful chill study relax aesthetic',
  'Deep Focus & Working': 'deep focus music for working study coding lofi ambient chill',
  'Lock In & Grind Mode': 'lock in playlist study grind phonk focus aesthetic beats',
  'Gym & Beast Workout': 'gym workout motivation aggressive phonk edm beast mode bass',
  'Late Night Drive': 'late night drive synthwave phonk chill playlist aesthetic',
  'Coffee Shop & Study': 'coffee shop ambience cozy study lofi acoustic playlist',
  'Rainy Day Acoustic': 'rainy day acoustic guitar cozy aesthetic playlist songs',
  'Gaming & Phonk Rush': 'gaming phonk drift high energy combat aggressive bass',
  'Peaceful Sleep & Ambient': 'peaceful sleep ambient music delta waves healing relaxation',
  'Morning Boost & Vibes': 'morning boost positive energy upbeat feel good acoustic pop',

  // Regional & Music Genres
  'K-Pop & Idol': 'kpop melon top 100 trending viral hits official mv audio',
  'V-Pop Trending': 'vpop thinh hanh trending hits official music video audio',
  'US-UK Pop Hits': 'billboard hot 100 global pop viral hits official audio',
  'EDM & Festival Dance': 'festival edm electronic dance banger progressive house official',
  'Lo-Fi Chill & Study': 'lofi chill beats study relax sleep beats official audio',
  'Phonk & Drift Beats': 'drift phonk brazilian phonk aggressive cowbell trending audio',
  'Hip-Hop, Rap & Trap': 'top trending rap hip hop trap bass boosted official audio',
  'Acoustic & Indie Ballad': 'acoustic indie ballad gentle guitar emotional official audio',
  'R&B & Neo-Soul': 'chill rnb soul smooth vibes contemporary groove official audio',
  'J-Pop & Anime OST': 'jpop anime viral opening theme song official music video',
  'C-Pop & Mandopop': 'cpop mandopop trending hot songs official music video audio',
  'Synthwave & Cyberpunk 80s': 'retrowave synthwave 80s cyberpunk electronic neon night drive',
  'Deep House & Club Remix': 'deep house club remix selected ibiza vocal chillout audio',
  'City Pop & Retro Groove': 'japanese city pop 80s retro funk groove aesthetic',
  'Rock & Alternative': 'popular rock alternative hits modern indie rock official audio',
  'Drill & UK Bass': 'uk drill bass rap heavy 808 trending beats audio',
  'Hyperpop & Glitchcore': 'hyperpop glitchcore energetic futuristic pop audio',
  'Jazz & Coffee Lounge': 'smooth jazz coffee shop cozy lounge instrumental audio',
  'Cinematic & Epic Soundtracks': 'epic cinematic orchestral soundtrack hans zimmer style trailer',
  'Nightcore & Speed Up Remix': 'nightcore speed up viral tiktok remix official audio',
};

const getDefaultGenreForLang = (lang: LanguageCode): string => {
  switch (lang) {
    case 'ko': return 'K-Pop & Idol';
    case 'ja': return 'J-Pop & Anime OST';
    case 'zh-CN': return 'C-Pop & Mandopop';
    case 'en-US': return 'US-UK Pop Hits';
    case 'vi':
    default: return 'V-Pop Trending';
  }
};

interface TimeVibe {
  period: 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night';
  timeLabel: string;
  genres: string[];
}

const getTimeOfDayVibe = (lang: LanguageCode): TimeVibe => {
  const hour = new Date().getHours();
  const isVi = lang === 'vi';
  const isKo = lang === 'ko';

  if (hour >= 5 && hour < 11) {
    return {
      period: 'morning',
      timeLabel: isKo ? '🌅 아침 • 상쾌한 에너지' : isVi ? '🌅 Buổi Sáng • Năng Lượng Mới' : '🌅 Morning • Fresh Energy',
      genres: [
        'Morning Boost & Vibes',
        'Low Cortisol & Chill',
        'Coffee Shop & Study',
        'Acoustic & Indie Ballad',
      ],
    };
  } else if (hour >= 11 && hour < 17) {
    return {
      period: 'afternoon',
      timeLabel: isKo ? '☀️ 오후 • 집중 & 업무' : isVi ? '☀️ Buổi Chiều • Tập Trung Cao Độ' : '☀️ Afternoon • Deep Focus',
      genres: [
        'Deep Focus & Working',
        'Lock In & Grind Mode',
        'Lo-Fi Chill & Study',
        'Coffee Shop & Study',
      ],
    };
  } else if (hour >= 17 && hour < 20) {
    return {
      period: 'evening',
      timeLabel: isKo ? '🌆 저녁 • 운동 & 힐링' : isVi ? '🌆 Chiều Tối • Thư Giãn & Tập Luyện' : '🌆 Evening • Workout & Chill',
      genres: [
        'Gym & Beast Workout',
        'Low Cortisol & Chill',
        'R&B & Neo-Soul',
        'Late Night Drive',
      ],
    };
  } else if (hour >= 20 && hour < 24) {
    return {
      period: 'night',
      timeLabel: isKo ? '🌃 밤 • 드라이브 & 감성' : isVi ? '🌃 Buổi Tối • Lái Xe & Thư Giãn' : '🌃 Night • Drive & Vibes',
      genres: [
        'Late Night Drive',
        'Gaming & Phonk Rush',
        'Low Cortisol & Chill',
        'Deep House & Club Remix',
      ],
    };
  } else {
    return {
      period: 'late_night',
      timeLabel: isKo ? '🌙 심야 • 숙면 & 몰입' : isVi ? '🌙 Đêm Khuya • Tĩnh Lặng & Ngủ Ngon' : '🌙 Midnight • Sleep & Flow',
      genres: [
        'Peaceful Sleep & Ambient',
        'Lock In & Grind Mode',
        'Rainy Day Acoustic',
        'Low Cortisol & Chill',
      ],
    };
  }
};

export const AiMixView: React.FC<AiMixViewProps> = ({
  currentUser,
  allTracks,
  onPlayTrack,
  onOpenAuth,
  smartDjEnabled,
  onToggleSmartDj,
  accentColor = '#ff2a55',
  language = 'vi',
  onPlaySearchResult,
  currentTrack,
  isPlaying,
  favorites,
  onToggleFavorite,
  albums = [],
  onSaveArtistMixAsAlbum,
  onNavigateToAlbums,
  onPlayArtistMix,
}) => {
  const [training, setTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [report, setReport] = useState<TrainingReport | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  // Artist Album Mix Modal State (Giống 100% trang chủ Discover)
  const [activeArtistMix, setActiveArtistMix] = useState<ArtistMix | null>(null);
  const [loadingArtistMix, setLoadingArtistMix] = useState(false);
  const [loadingArtistName, setLoadingArtistName] = useState<string>('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeArtistMix) {
        setActiveArtistMix(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeArtistMix]);

  const handleOpenArtistMix = async (artist: string, cover?: string) => {
    setLoadingArtistName(artist);
    setLoadingArtistMix(true);
    try {
      const mix = await invoke<ArtistMix>('get_artist_album_mix', {
        artist,
        userId: currentUser?.id || null,
      });
      if (mix && mix.tracks && mix.tracks.length > 0) {
        if (!mix.cover_art && cover) {
          mix.cover_art = cover;
        }
        setActiveArtistMix(mix);
      } else {
        if (onPlaySearchResult) {
          const results = await invoke<SearchResult[]>('search_online', {
            query: `${artist} bài hát hay nhất official audio`,
            source: 'youtube',
          });
          if (results && results.length > 0) {
            onPlaySearchResult(results[0], results);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load artist mix from Rust backend:', err);
    } finally {
      setLoadingArtistMix(false);
      setLoadingArtistName('');
    }
  };

  const recentArtistsScrollRef = useRef<HTMLDivElement | null>(null);

  const scrollRecentArtists = (direction: 'left' | 'right') => {
    if (recentArtistsScrollRef.current) {
      const scrollAmount = 450;
      recentArtistsScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const [timeVibe, setTimeVibe] = useState<TimeVibe>(() => getTimeOfDayVibe(language));

  // Auto-update time-of-day vibe every 60 seconds
  useEffect(() => {
    setTimeVibe(getTimeOfDayVibe(language));
    const interval = setInterval(() => {
      setTimeVibe(getTimeOfDayVibe(language));
    }, 60000);
    return () => clearInterval(interval);
  }, [language]);

  // State for user-specific history artists (distinguishes recommendations per account)
  const [userHistoryArtists, setUserHistoryArtists] = useState<{ artist: string; count: number; cover?: string }[]>([]);

  useEffect(() => {
    const userId = currentUser?.id || 'guest_spy';
    Promise.all([
      invoke<any[]>('db_get_history', { userId, limit: 300 }).catch(() => []),
      invoke<Track[]>('db_get_favorites', { userId }).catch(() => [])
    ]).then(([historyList, favList]) => {
      const counts: Record<string, { count: number; sampleCover?: string }> = {};

      for (const t of favList) {
        if (t.artist && t.artist.trim().length > 1 && !t.artist.toLowerCase().includes('unknown')) {
          const clean = t.artist.split(',')[0].split('&')[0].split(/ x | ft\.?| feat\.?/i)[0].trim();
          if (!counts[clean]) counts[clean] = { count: 0, sampleCover: t.cover_art || (t as any).thumbnail };
          counts[clean].count += 3; // Favorites carry high weight
        }
      }

      for (const h of historyList) {
        if (h.artist && h.artist.trim().length > 1 && !h.artist.toLowerCase().includes('unknown')) {
          const clean = h.artist.split(',')[0].split('&')[0].split(/ x | ft\.?| feat\.?/i)[0].trim();
          let cover: string | undefined;
          if (h.track_json) {
            try {
              const parsed = typeof h.track_json === 'string' ? JSON.parse(h.track_json) : h.track_json;
              cover = parsed.thumbnail || parsed.album_art_url;
            } catch {}
          }
          if (!counts[clean]) counts[clean] = { count: 0, sampleCover: cover };
          counts[clean].count += 1;
          if (!counts[clean].sampleCover && cover) counts[clean].sampleCover = cover;
        }
      }

      const sorted = Object.entries(counts)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 20)
        .map(([artist, data]) => {
          const avatar = getOrResolveArtistAvatar(artist, data.sampleCover);
          return { artist, count: data.count, cover: avatar };
        });

      if (sorted.length > 0) {
        setUserHistoryArtists(sorted);
        // Dynamically fetch verified Deezer portraits for artists
        sorted.forEach(item => {
          fetchArtistPortraitOnline(item.artist).then(pic => {
            if (pic) {
              setUserHistoryArtists(prev => prev.map(a => a.artist === item.artist ? { ...a, cover: pic } : a));
            }
          });
        });
      } else {
        setUserHistoryArtists(DEFAULT_FEATURED_ARTISTS.map(a => ({ artist: a.artist, count: a.count, cover: a.avatar })));
      }
    });
  }, [currentUser?.id]);

  // Dynamically generate personalized artist mixes based on THIS account's history & favorites
  const userArtistGenres = useMemo(() => {
    if (userHistoryArtists.length > 0) {
      return userHistoryArtists.slice(0, 4).map(item => `Mix: ${item.artist}`);
    }
    // Fallback to local tracks if brand new account with zero history
    if (!allTracks || allTracks.length === 0) return [];
    const counts: Record<string, number> = {};
    for (const t of allTracks) {
      if (t.artist && t.artist.trim().length > 1 && !t.artist.toLowerCase().includes('unknown')) {
        const clean = t.artist.split(',')[0].split('&')[0].split('feat')[0].trim();
        counts[clean] = (counts[clean] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([artist]) => `Mix: ${artist}`);
  }, [userHistoryArtists, allTracks]);

  // Available genres: Time-of-day dynamic vibes -> Personal Artist Mixes -> AI Top Genres -> Regional Default -> Full Catalogue
  const availableGenres = useMemo(() => {
    const timeGenres = timeVibe.genres;
    const aiTop = report?.top_genres || [];
    const langDefault = getDefaultGenreForLang(language);

    const set = new Set([
      ...timeGenres,
      ...userArtistGenres,
      langDefault,
      ...aiTop,
      ...DEFAULT_GENRES,
    ]);
    return Array.from(set);
  }, [timeVibe, userArtistGenres, report?.top_genres, language]);

  // Genre recommendations state
  const [selectedGenre, setSelectedGenre] = useState<string>(() => timeVibe.genres[0] || getDefaultGenreForLang(language));
  const [genreTracks, setGenreTracks] = useState<Track[]>([]);
  const [loadingGenreTracks, setLoadingGenreTracks] = useState(false);

  const genreScrollRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const [hasMoved, setHasMoved] = useState(false);

  // Wheel horizontal scroll support for regular mice
  useEffect(() => {
    const el = genreScrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY * 1.2;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Ngăn chặn cuộn dọc trang khi lăn chuột trên danh sách nghệ sĩ (chỉ trượt ngang nội bộ)
  useEffect(() => {
    const el = recentArtistsScrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [userHistoryArtists]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const el = genreScrollRef.current;
    if (!el) return;
    isDraggingRef.current = true;
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;
    setHasMoved(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !genreScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - genreScrollRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    if (Math.abs(walk) > 5) {
      setHasMoved(true);
    }
    genreScrollRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  const scrollGenres = (offset: number) => {
    if (genreScrollRef.current) {
      genreScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    setSelectedGenre(timeVibe.genres[0] || getDefaultGenreForLang(language));
  }, [language, timeVibe.period]);

  const fetchRecommendations = async () => {
    if (!currentUser || allTracks.length === 0) return;
    setLoadingRecs(true);
    try {
      const recs = await invoke<RecommendationResult[]>('ai_recommend_tracks', {
        userId: currentUser.id,
        candidates: allTracks,
      });
      setRecommendations(recs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRecs(false);
    }
  };

  const loadGenreTracks = async (genre: string) => {
    setLoadingGenreTracks(true);
    try {
      // 1. Filter matching local/cached tracks from allTracks
      const gLower = genre.toLowerCase().split('/')[0].trim();
      const localMatches = allTracks.filter(t => {
        const text = `${t.title} ${t.artist} ${t.album || ''}`.toLowerCase();
        return text.includes(gLower) || (gLower === 'v-pop' && (text.includes('vpop') || text.includes('sơn tùng') || text.includes('vũ')));
      }).slice(0, 6);

      // 2. Fetch online tracks for that genre
      let query = GENRE_SEARCH_QUERIES[genre];
      if (!query) {
        if (genre.startsWith('Mix: ')) {
          const artist = genre.replace('Mix: ', '').trim();
          query = `${artist} best songs viral hits official audio`;
        } else {
          query = `${genre} popular hits official audio`;
        }
      }
      const searchResults = await invoke<SearchResult[]>('search_online', {
        query,
        source: 'youtube',
      });

      const onlineTracks: Track[] = (searchResults || []).slice(0, 24).map((res, idx) => ({
        id: `genre_${genre}_${idx}_${Date.now()}`,
        title: res.title,
        artist: res.artist,
        album: res.album || genre,
        duration_secs: res.duration_secs,
        path_or_url: res.url_or_id,
        cover_art: res.thumbnail,
        source: res.source,
      }));

      // Combine and deduplicate
      const combined = [...localMatches];
      for (const ot of onlineTracks) {
        if (!combined.some(t => t.title.toLowerCase() === ot.title.toLowerCase())) {
          combined.push(ot);
        }
      }
      setGenreTracks(combined);
    } catch (err) {
      console.error('Failed to load genre tracks:', err);
    } finally {
      setLoadingGenreTracks(false);
    }
  };

  const handleTrainAi = async () => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }

    setTraining(true);
    setTrainingProgress(10);

    const t1 = setTimeout(() => setTrainingProgress(35), 300);
    const t2 = setTimeout(() => setTrainingProgress(70), 700);

    try {
      const rep = await invoke<TrainingReport>('ai_train_model', { userId: currentUser.id });
      setTrainingProgress(100);
      setReport(rep);
      if (rep.top_genres && rep.top_genres.length > 0) {
        setSelectedGenre(rep.top_genres[0]);
      }
      await fetchRecommendations();
    } catch (e) {
      console.error(e);
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setTimeout(() => setTraining(false), 500);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchRecommendations();
    }
  }, [currentUser, allTracks.length]);

  useEffect(() => {
    loadGenreTracks(selectedGenre);
  }, [selectedGenre]);

  return (
    <div className="flex-1 w-full pb-16 select-none">
      {/* Header Banner — Spy AI Studio */}
      <div className="mb-6 p-5 rounded-2xl bg-[#0a0a0d] border border-[#161620] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span 
              className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded border font-mono flex items-center gap-1.5"
              style={{
                color: accentColor,
                backgroundColor: `${accentColor}15`,
                borderColor: `${accentColor}30`,
              }}
            >
              <AudioLines className="w-3.5 h-3.5" style={{ color: accentColor }} />
              {getTranslation(language, 'aimix.badge')}
            </span>
            <span className="text-[10px] text-[#777] font-mono">
              {getTranslation(language, 'aimix.badgeSub')}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {getTranslation(language, 'aimix.title')}
          </h2>
          <p className="text-xs text-[#8e8e9f] mt-1 max-w-2xl leading-relaxed">
            {getTranslation(language, 'aimix.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTrainAi}
            disabled={training}
            style={{
              backgroundColor: accentColor,
              color: getContrastTextColor(accentColor),
              boxShadow: `0 0 12px ${accentColor}40`,
            }}
            className="px-4 py-2 hover:opacity-90 active:scale-95 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {training ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{getTranslation(language, 'aimix.analyzing', { progress: trainingProgress })}</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>{getTranslation(language, 'aimix.trainBtn')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Smart DJ Toggle Card */}
      <div className="mb-6 p-4 rounded-xl bg-[#0d0d12] border border-[#1a1a24] flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#14141c] flex items-center justify-center text-white border border-[#222]">
            <Sliders className="w-4 h-4" style={{ color: accentColor }} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">
              {getTranslation(language, 'aimix.smartDjTitle')}
            </h3>
            <p className="text-[11px] text-[#777]">
              {getTranslation(language, 'aimix.smartDjDesc')}
            </p>
          </div>
        </div>
        <button
          onClick={onToggleSmartDj}
          className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
            smartDjEnabled ? '' : 'bg-[#22222a]'
          }`}
          style={smartDjEnabled ? { backgroundColor: accentColor } : undefined}
        >
          <div
            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
              smartDjEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Training Report */}
      {report && (
        <div className="mb-6 p-4 rounded-xl bg-[#0d0d12] border border-[#22222c] space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <CheckCircle2 className="w-4 h-4" style={{ color: accentColor }} />
            <span>{getTranslation(language, 'aimix.reportComplete', { status: report.status })}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-2.5 rounded-lg bg-[#101016] border border-[#1c1c24]">
              <span className="text-[10px] text-[#777] font-mono">{getTranslation(language, 'aimix.analyzedData')}</span>
              <p className="text-sm font-bold text-white mt-0.5">
                {getTranslation(language, 'aimix.tracksCount', { count: report.tracks_analyzed })}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-[#101016] border border-[#1c1c24]">
              <span className="text-[10px] text-[#777] font-mono">{getTranslation(language, 'aimix.accuracy')}</span>
              <p className="text-sm font-bold mt-0.5" style={{ color: accentColor }}>
                {(report.accuracy > 1 ? report.accuracy : report.accuracy * 100).toFixed(1)}%
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-[#101016] border border-[#1c1c24]">
              <span className="text-[10px] text-[#777] font-mono">{getTranslation(language, 'aimix.epochs')}</span>
              <p className="text-sm font-bold text-white mt-0.5">
                {getTranslation(language, 'aimix.epochsCount', { count: report.epochs })}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-[#101016] border border-[#1c1c24]">
              <span className="text-[10px] text-[#777] font-mono">{getTranslation(language, 'aimix.topGenres')}</span>
              <p className="text-sm font-bold text-white mt-0.5 truncate" title={report.top_genres?.join(', ')}>
                {report.top_genres?.join(', ') || getTranslation(language, 'aimix.diverse')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── NGHỆ SĨ HAY NGHE GẦN ĐÂY CỦA TÀI KHOẢN (Personalized Artist Mixes) ─── */}
      {userHistoryArtists.length > 0 && (
        <div className="mb-8 p-5 rounded-2xl bg-[#0a0a0e] border border-[#181822] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
              <h3 className="text-sm font-bold text-white tracking-wide">
                {language === 'vi' ? 'Nghệ sĩ bạn hay nghe gần đây' : 'Your Most Listened Artists'}
              </h3>
              {currentUser?.username && (
                <span className="text-[10px] text-zinc-400 font-mono bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                  @{currentUser.username}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-zinc-400 font-mono">
                {language === 'vi' ? 'Nhấn để mở Album Mix' : 'Click to open Album Mix'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => scrollRecentArtists('left')}
                  className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/5 active:scale-95"
                  title="Cuộn sang trái"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollRecentArtists('right')}
                  className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/5 active:scale-95"
                  title="Cuộn sang phải"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div
            ref={recentArtistsScrollRef}
            className="flex items-stretch gap-3 overflow-x-auto hover-scrollbar scroll-smooth py-1"
          >
            {userHistoryArtists.map((item, idx) => {
              const isLoadingThis = loadingArtistMix && loadingArtistName === item.artist;
              return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setSelectedGenre(`Mix: ${item.artist}`);
                  handleOpenArtistMix(item.artist, item.cover);
                }}
                className={`w-[124px] sm:w-[136px] md:w-[144px] lg:w-[152px] flex-shrink-0 p-3 rounded-2xl border transition-all text-center flex flex-col items-center group cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1 relative ${
                  selectedGenre === `Mix: ${item.artist}`
                    ? 'bg-white/10 border-white/50 shadow-lg'
                    : 'bg-[#09090d] hover:bg-[#14141c] border-[#181822] hover:border-cyan-500/40'
                }`}
              >
                {/* Artist Cover / Logo - Modern Rounded Square (Just like Home page) */}
                <div className="relative w-full aspect-square rounded-2xl overflow-hidden mb-2.5 bg-[#12121a] border border-white/10 group-hover:border-cyan-400/60 transition-all shadow-md">
                  {item.cover ? (
                    <img
                      src={optimizeThumbnailUrl(item.cover)}
                      alt={item.artist}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = getOrResolveArtistAvatar(item.artist);
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#181824] flex items-center justify-center text-white">
                      <Music className="w-8 h-8 text-zinc-400" />
                    </div>
                  )}

                  {/* Hover Play / Loading Overlay */}
                  {isLoadingThis ? (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-2">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform"
                        style={{
                          backgroundColor: accentColor,
                          color: getContrastTextColor(accentColor),
                        }}
                        title={`Album Mix: ${item.artist}`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </div>
                    </div>
                  )}

                  {/* Mix Badge */}
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-sm border border-white/10 text-[8.5px] font-mono font-bold text-cyan-300 uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                    Mix
                  </div>
                </div>

                <p className="w-full text-xs font-bold text-white truncate group-hover:text-cyan-300 transition-colors">
                  {item.artist}
                </p>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate w-full">
                  {item.count > 0
                    ? `${item.count} ${language === 'vi' ? 'lượt nghe' : 'plays'}`
                    : (language === 'vi' ? 'Đề xuất' : 'Suggested')}
                </p>
              </button>
            );
          })}
          </div>
        </div>
      )}

      {/* ─── GENRE-BASED RECOMMENDATIONS (Đề xuất theo thể loại hay nghe) ─── */}
      <div className="mb-8 p-5 rounded-2xl bg-[#0a0a0e] border border-[#181822] shadow-sm w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4" style={{ color: accentColor }} />
              <h3 className="text-sm font-bold text-white tracking-wide">
                {getTranslation(language, 'aimix.genreSectionTitle')}
              </h3>
              <span 
                className="text-[9px] font-mono uppercase px-2 py-0.5 rounded border flex items-center gap-1 font-semibold"
                style={{
                  color: accentColor,
                  backgroundColor: `${accentColor}12`,
                  borderColor: `${accentColor}25`,
                }}
              >
                {timeVibe.timeLabel}
              </span>
            </div>
            <p className="text-xs text-[#777] mt-1">
              {getTranslation(language, 'aimix.genreSectionSubtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Quick Genre Scroll Left / Right Buttons */}
            <div className="flex items-center gap-1 bg-[#14141c] p-0.5 rounded-lg border border-[#22222e]">
              <button
                type="button"
                onClick={() => scrollGenres(-220)}
                className="p-1 rounded text-[#888] hover:text-white hover:bg-[#20202e] transition-colors cursor-pointer"
                title={language === 'vi' ? 'Cuộn thể loại sang trái' : 'Scroll genres left'}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => scrollGenres(220)}
                className="p-1 rounded text-[#888] hover:text-white hover:bg-[#20202e] transition-colors cursor-pointer"
                title={language === 'vi' ? 'Cuộn thể loại sang phải' : 'Scroll genres right'}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {genreTracks.length > 0 && (
              <button
                onClick={() => onPlayTrack(genreTracks[0])}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all hover:opacity-90 active:scale-95 cursor-pointer"
                style={{
                  backgroundColor: `${accentColor}20`,
                  color: accentColor,
                  border: `1px solid ${accentColor}40`,
                }}
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{getTranslation(language, 'aimix.playGenreAll')}</span>
              </button>
            )}
            <button
              onClick={() => loadGenreTracks(selectedGenre)}
              disabled={loadingGenreTracks}
              className="p-1.5 rounded-lg bg-[#14141c] hover:bg-[#1c1c28] text-[#888] hover:text-white transition-all cursor-pointer border border-[#22222e]"
              title={getTranslation(language, 'aimix.refresh')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingGenreTracks ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Minimal Smooth Genre Slider */}
        <div
          ref={genreScrollRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className="flex items-center gap-2 overflow-x-auto pb-2.5 mb-4 hover-scrollbar select-none cursor-grab active:cursor-grabbing w-full"
        >
          {availableGenres.map((genre, idx) => {
            const isSelected = selectedGenre === genre;
            return (
              <button
                key={genre}
                onClick={() => {
                  if (!hasMoved) {
                    setSelectedGenre(genre);
                  }
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border ${
                  isSelected
                    ? ''
                    : 'bg-[#121218] text-[#9e9ea7] border-[#1e1e28] hover:text-white hover:bg-[#1a1a24]'
                }`}
                style={
                  isSelected
                    ? {
                        backgroundColor: accentColor,
                        color: getContrastTextColor(accentColor),
                        borderColor: accentColor,
                        boxShadow: `0 0 10px ${accentColor}35`,
                      }
                    : undefined
                }
              >
                {idx === 0 && <span className="text-[10px]">⭐</span>}
                <span>{genre}</span>
              </button>
            );
          })}
        </div>

        {/* Tracks List for Selected Genre */}
        {loadingGenreTracks ? (
          <div className="flex flex-col items-center justify-center py-10 text-[#666] gap-2">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: accentColor }} />
            <p className="text-xs">{getTranslation(language, 'aimix.loadingGenre')}</p>
          </div>
        ) : genreTracks.length === 0 ? (
          <div className="text-center py-8 text-[#666]">
            <p className="text-xs">{getTranslation(language, 'aimix.noGenreTracks')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 w-full">
            {genreTracks.map((track) => {
              const isLiveItem = track.source === 'youtube' && (!track.duration_secs || track.duration_secs <= 0);
              const mins = Math.floor(track.duration_secs / 60);
              const secs = (track.duration_secs % 60).toString().padStart(2, '0');
              const durStr = track.duration_secs > 0 ? `${mins}:${secs}` : '';

              return (
                <div
                  key={track.id}
                  onClick={() => onPlayTrack(track)}
                  className="p-3 rounded-xl bg-[#0e0e13] hover:bg-[#15151e] border border-[#1a1a24] hover:border-[#2a2a38] transition-all flex items-center justify-between gap-3 cursor-pointer group shadow-sm w-full min-w-0"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#161620] flex-shrink-0 relative">
                      {track.cover_art ? (
                        <img
                          src={optimizeThumbnailUrl(track.cover_art, track.path_or_url || track.id)}
                          alt={track.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleImageError(e, track.path_or_url || track.id)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#555]">
                          <Music className="w-4 h-4" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-4 h-4 fill-current text-white" />
                      </div>
                    </div>
                    <div className="overflow-hidden min-w-0">
                      <p className="text-xs font-semibold text-white truncate group-hover:text-cyan-300 transition-colors" title={track.title}>
                        {track.title}
                      </p>
                      <p className="text-[11px] text-[#8e8e9f] truncate">{track.artist}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isLiveItem ? (
                      <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                        LIVE
                      </span>
                    ) : (
                      <>
                        {durStr && <span className="text-[10px] text-[#555] font-mono">{durStr}</span>}
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#181822] text-[#888] border border-[#22222e]">
                          {track.source === 'youtube' ? 'YT Stream' : track.source === 'soundcloud' ? 'SoundCloud' : track.source === 'audius' ? 'Audius' : 'Local'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recommendations List (General AI Mix) */}
      <div>
        <div className="flex items-center justify-between mb-3 border-b border-[#161620] pb-2">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" style={{ color: accentColor }} />
            {getTranslation(language, 'aimix.forYou', { count: recommendations.length })}
          </h3>
          <button
            onClick={fetchRecommendations}
            disabled={loadingRecs}
            className="text-[11px] text-[#777] hover:text-white flex items-center gap-1 cursor-pointer font-mono"
          >
            <RefreshCw className={`w-3 h-3 ${loadingRecs ? 'animate-spin' : ''}`} />
            <span>{getTranslation(language, 'aimix.refresh')}</span>
          </button>
        </div>

        {recommendations.length === 0 ? (
          <div className="text-center py-12 text-[#666]">
            <p className="text-xs">{getTranslation(language, 'aimix.noRecs')}</p>
            <p className="text-[11px] text-[#555] mt-1">{getTranslation(language, 'aimix.noRecsHint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {recommendations.map((rec, i) => (
              <div
                key={i}
                onClick={() => onPlayTrack(rec.track)}
                className="p-3 rounded-xl bg-[#09090c] hover:bg-[#121218] border border-[#161620] transition-all flex items-center justify-between gap-3 cursor-pointer group shadow-sm min-w-0"
              >
                <div className="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#161620] flex-shrink-0 relative">
                    {rec.track.cover_art ? (
                      <img
                        src={optimizeThumbnailUrl(rec.track.cover_art, rec.track.path_or_url || rec.track.id)}
                        alt={rec.track.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => handleImageError(e, rec.track.path_or_url || rec.track.id)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#555]">
                        <Music className="w-4 h-4" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-4 h-4 fill-current text-white" />
                    </div>
                  </div>
                  <div className="overflow-hidden min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate transition-colors" title={rec.track.title}>
                      {rec.track.title}
                    </p>
                    <p className="text-[11px] text-[#8e8e9f] truncate">{rec.track.artist}</p>
                    {rec.reason && (
                      <p className="text-[10px] text-[#666] truncate mt-0.5">{rec.reason}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span 
                    className="text-[10px] font-mono px-2 py-0.5 rounded border"
                    style={{
                      color: accentColor,
                      backgroundColor: `${accentColor}15`,
                      borderColor: `${accentColor}30`,
                    }}
                  >
                    {Math.round(rec.match_score > 1 ? rec.match_score : rec.match_score * 100)}% Match
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── ARTIST ALBUM MIX MODAL (Tương tác chi tiết Album Mix giống 100% Trang chủ) ─── */}
      {activeArtistMix && (() => {
        const isArtistMixSaved = Boolean(
          albums && activeArtistMix && albums.some(a => 
            a.title.trim().toLowerCase() === (activeArtistMix.title || `${activeArtistMix.artist} Album Mix`).trim().toLowerCase() ||
            a.title.trim().toLowerCase() === `${activeArtistMix.artist} Mix`.toLowerCase()
          )
        );

        return (
        <div 
          onClick={() => setActiveArtistMix(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl sm:max-w-4xl max-h-[88vh] bg-[#0c0c14] border border-cyan-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col space-y-4 relative overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Ambient backlight */}
            <div 
              className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none"
              style={{ backgroundColor: accentColor }}
            />

            {/* Close Button */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveArtistMix(null);
              }}
              className="absolute top-4 right-4 sm:top-5 sm:right-5 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-all cursor-pointer z-50 shadow-md active:scale-90"
              title={getTranslation(language, 'home.close')}
            >
              <X className="w-5 h-5" />
            </button>

            {/* Album Mix Header */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 pt-1 relative z-10">
              <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-2xl overflow-hidden bg-[#181824] border-2 border-white/10 shadow-2xl flex-shrink-0 group relative">
                <img
                  src={activeArtistMix.cover_art || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80'}
                  alt={activeArtistMix.artist}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-cyan-500 text-black font-black text-[9px] uppercase tracking-wider font-mono">
                  ALBUM MIX
                </span>
              </div>

              <div className="flex-1 text-center sm:text-left min-w-0 space-y-2">
                <span className="text-[10px] font-mono uppercase font-bold text-cyan-400 tracking-widest px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30">
                  {getTranslation(language, 'home.artistMix', { artist: activeArtistMix.artist })}
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
                  {activeArtistMix.title}
                </h2>
                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                  {activeArtistMix.description}
                </p>
                <div className="flex items-center justify-center sm:justify-start gap-3 text-xs text-zinc-400 font-mono pt-1">
                  <span className="text-white font-bold">{activeArtistMix.artist}</span>
                  <span>•</span>
                  <span>{activeArtistMix.track_count} {getTranslation(language, 'home.tracks')}</span>
                  {isArtistMixSaved && (
                    <>
                      <span>•</span>
                      <span className="text-cyan-400 flex items-center gap-1 text-[11px] font-semibold">
                        <FolderCheck className="w-3.5 h-3.5" />
                        <span>{getTranslation(language, 'home.inAlbums')}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons: Play All, Shuffle, Add to Album */}
            <div className="flex items-center gap-2.5 pt-1 border-t border-white/5 relative z-10 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  if (onPlayArtistMix) {
                    onPlayArtistMix(activeArtistMix, 0);
                  } else if (onPlaySearchResult && activeArtistMix.tracks.length > 0) {
                    onPlaySearchResult(activeArtistMix.tracks[0], activeArtistMix.tracks);
                  }
                }}
                className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg transition-all hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: accentColor,
                  color: getContrastTextColor(accentColor),
                }}
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
                <span>{getTranslation(language, 'home.playAllMix')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (activeArtistMix.tracks.length > 0) {
                    const shuffledTracks = [...activeArtistMix.tracks].sort(() => Math.random() - 0.5);
                    const shuffledMix: ArtistMix = { ...activeArtistMix, tracks: shuffledTracks };
                    if (onPlayArtistMix) {
                      onPlayArtistMix(shuffledMix, 0);
                    } else if (onPlaySearchResult) {
                      onPlaySearchResult(shuffledTracks[0], shuffledTracks);
                    }
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold text-xs transition-colors cursor-pointer border border-white/10 flex items-center gap-2"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>{getTranslation(language, 'home.shuffle')}</span>
              </button>

              {/* Nút Thêm vào Album / Đã lưu vào Album */}
              {onSaveArtistMixAsAlbum && (
                <button
                  type="button"
                  onClick={() => {
                    if (onSaveArtistMixAsAlbum && activeArtistMix) {
                      onSaveArtistMixAsAlbum(activeArtistMix);
                    }
                  }}
                  className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all cursor-pointer border flex items-center gap-2 active:scale-95 shadow-md ${
                    isArtistMixSaved
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30'
                      : 'bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-cyan-500/30'
                  }`}
                  title={isArtistMixSaved ? getTranslation(language, 'home.inAlbums') : getTranslation(language, 'home.addToAlbums')}
                >
                  {isArtistMixSaved ? (
                    <>
                      <FolderCheck className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{getTranslation(language, 'home.inAlbums')}</span>
                    </>
                  ) : (
                    <>
                      <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{getTranslation(language, 'home.addToAlbums')}</span>
                    </>
                  )}
                </button>
              )}

              {/* Nút xem trong mục Album khi đã lưu */}
              {isArtistMixSaved && onNavigateToAlbums && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveArtistMix(null);
                    onNavigateToAlbums();
                  }}
                  className="px-3 py-2.5 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-400 border border-cyan-500/30 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Mở thư mục Album để nghe hoặc chỉnh sửa"
                >
                  <Library className="w-3.5 h-3.5" />
                  <span>{getTranslation(language, 'home.viewInAlbums')}</span>
                </button>
              )}
            </div>

            {/* Tracklist List View */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[52vh] no-scrollbar relative z-10">
              {activeArtistMix.tracks.map((track, idx) => {
                const isThisPlaying = currentTrack?.path_or_url === track.url_or_id || currentTrack?.title === track.title;
                const isFav = favorites?.has(track.url_or_id);
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (onPlayArtistMix) {
                        onPlayArtistMix(activeArtistMix, track);
                      } else if (onPlaySearchResult) {
                        onPlaySearchResult(track, activeArtistMix.tracks);
                      }
                    }}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 group transition-all cursor-pointer ${
                      isThisPlaying
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                        : 'bg-[#101018] hover:bg-[#181824] border-white/5 hover:border-white/15 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Track Index / Play status */}
                      <span className="w-6 text-center text-xs font-mono font-bold text-zinc-500 group-hover:text-cyan-400">
                        {isThisPlaying && isPlaying ? (
                          <div className="flex items-end justify-center gap-0.5 h-3.5">
                            <span className="w-0.5 h-full bg-cyan-400 animate-pulse" />
                            <span className="w-0.5 h-2/3 bg-cyan-400 animate-pulse delay-75" />
                            <span className="w-0.5 h-4/5 bg-cyan-400 animate-pulse delay-150" />
                          </div>
                        ) : (
                          <span>{(idx + 1).toString().padStart(2, '0')}</span>
                        )}
                      </span>

                      {/* Track Thumbnail */}
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0 border border-white/10 relative">
                        <img
                          src={track.thumbnail || activeArtistMix.cover_art || ''}
                          alt={track.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
                        </div>
                      </div>

                      {/* Title & Artist */}
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-bold truncate ${isThisPlaying ? 'text-cyan-300' : 'text-white group-hover:text-cyan-300'}`}>
                          {track.title}
                        </p>
                        <p className="text-[11px] text-zinc-500 truncate font-mono">
                          {track.artist}
                        </p>
                      </div>
                    </div>

                    {/* Duration & Actions */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {onToggleFavorite && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(track.url_or_id);
                          }}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            isFav ? 'text-rose-500 hover:text-rose-400' : 'text-zinc-500 hover:text-white'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                        </button>
                      )}

                      <span className="text-[11px] font-mono text-zinc-400 w-10 text-right">
                        {Math.floor(track.duration_secs / 60)}:{(track.duration_secs % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};
