import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Search, Loader2, Play, Music, Disc3, Sparkles, ArrowUpRight, X, History, FolderPlus } from 'lucide-react';
import { YoutubeIcon, SoundCloudIcon, AudiusIcon } from './Icons';
import { SearchResult, Track } from '../types';
import { getContrastTextColor, optimizeThumbnailUrl, handleImageError, sanitizeTrackTitle } from '../utils/trackUtils';
import { LanguageCode, getTranslation } from '../locales/i18n';

interface SearchViewProps {
  onPlaySearchResult: (result: SearchResult, allResults?: SearchResult[]) => void;
  onSearchOnline: (query: string, source: string) => Promise<SearchResult[]>;
  localTracks: Track[];
  onTrackSelect: (track: Track) => void;
  currentTrack?: Track | null;
  accentColor?: string;
  language?: LanguageCode;
  initialQuery?: string;
  onQueryChange?: (query: string) => void;
  onAddToAlbum?: (track: Track) => void;
}

const POPULAR = ['Die With A Smile', 'APT. ROSÉ', 'Sơn Tùng M-TP', 'Creepy Nuts', 'Alan Walker', 'V-Pop 2025', 'Lo-Fi Beats', 'Billie Eilish'];

const getInitialSearchHistory = (): string[] => {
  try {
    const raw = localStorage.getItem('spytify_search_history');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
      }
    }
  } catch {}
  return [];
};

const getInitialPlayedHistory = (): Array<{ title: string; artist: string }> => {
  try {
    const raw = localStorage.getItem('spytify_played_history');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(item => item && typeof item.title === 'string' && item.title.trim().length > 0);
      }
    }
  } catch {}
  return [];
};

type Filter = 'all' | 'youtube' | 'soundcloud' | 'audius' | 'local';

export const SearchView: React.FC<SearchViewProps> = ({ 
  onPlaySearchResult, onSearchOnline, localTracks, onTrackSelect,
  currentTrack,
  accentColor = '#00E5FF',
  language = 'vi',
  initialQuery = '',
  onQueryChange,
  onAddToAlbum,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isTyping, setIsTyping] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(getInitialSearchHistory);
  const [playedHistory, setPlayedHistory] = useState<Array<{ title: string; artist: string }>>(getInitialPlayedHistory);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with external query from top custom titlebar
  useEffect(() => {
    if (initialQuery !== undefined && initialQuery !== query) {
      setQuery(initialQuery);
      if (initialQuery.trim()) {
        doSearch(initialQuery, filter);
      }
    }
  }, [initialQuery]);

  const addToSearchHistory = (term?: string | null) => {
    if (!term) return;
    const clean = term.trim();
    if (!clean || clean.length < 2) return;
    setSearchHistory(prev => {
      const next = [clean, ...prev.filter(item => item.toLowerCase() !== clean.toLowerCase())].slice(0, 15);
      try {
        localStorage.setItem('spytify_search_history', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    setPlayedHistory([]);
    try {
      localStorage.removeItem('spytify_search_history');
      localStorage.removeItem('spytify_played_history');
    } catch {}
  };

  const recentArtists = React.useMemo(() => {
    const set = new Set<string>();
    if (currentTrack?.artist) {
      const a = currentTrack.artist.trim();
      if (a && a !== 'Unknown Artist' && a.length > 1) set.add(a);
    }
    for (const t of localTracks) {
      if (t.artist && t.artist.trim() && t.artist.trim() !== 'Unknown Artist') {
        set.add(t.artist.trim());
        if (set.size >= 5) break;
      }
    }
    return Array.from(set);
  }, [localTracks, currentTrack]);

  const dynamicSuggestions = React.useMemo(() => {
    const list: Array<{ text: string; type: 'search' | 'played_artist' | 'played_track' | 'trending' }> = [];
    const added = new Set<string>();

    const pushItem = (item?: string | null, type: 'search' | 'played_artist' | 'played_track' | 'trending' = 'trending') => {
      if (!item) return;
      const clean = item.trim();
      const lower = clean.toLowerCase();
      if (clean && !added.has(lower)) {
        added.add(lower);
        list.push({ text: clean, type });
      }
    };

    // 1. User's explicitly searched terms
    searchHistory.forEach(s => pushItem(s, 'search'));

    // 2. Artists from recently played songs (prioritize diverse artists user listens to)
    playedHistory.forEach(p => {
      if (p.artist && p.artist !== 'Unknown Artist' && p.artist.length > 1) {
        pushItem(p.artist, 'played_artist');
      }
    });

    // 3. Current playing artist & local track artists
    recentArtists.forEach(a => pushItem(a, 'played_artist'));

    // 4. Songs recently listened to by user
    playedHistory.forEach(p => {
      if (p.title && p.title.length > 1) {
        pushItem(p.title, 'played_track');
      }
    });

    if (currentTrack?.title) {
      pushItem(currentTrack.title, 'played_track');
    }

    // 5. Fallback trending
    POPULAR.forEach(p => pushItem(p, 'trending'));

    return list.slice(0, 12);
  }, [searchHistory, playedHistory, recentArtists, currentTrack]);

  // Close suggestions when clicking anywhere outside the search container
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setIsTyping(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Debounced auto-complete keyword suggestions only when actively typing
  useEffect(() => {
    if (!isTyping) {
      setShowSuggestions(false);
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedIndex(-1);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const remoteSug = await invoke<string[]>('get_search_suggestions', { query: q });
        const localMatches = localTracks
          .filter(t => t.title.toLowerCase().includes(q.toLowerCase()) || t.artist.toLowerCase().includes(q.toLowerCase()))
          .map(t => t.title)
          .slice(0, 3);
        const combined = Array.from(new Set([...localMatches, ...remoteSug])).slice(0, 7);
        setSuggestions(combined);
        if (combined.length > 0) {
          setShowSuggestions(true);
        }
      } catch (e) {
        console.error('Failed to get suggestions:', e);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, isTyping, localTracks]);

  const doSearch = async (q: string, f: Filter) => {
    if (!q.trim()) return;
    addToSearchHistory(q);
    setIsTyping(false);
    setShowSuggestions(false);
    setLoading(true);
    try {
      const res = await onSearchOnline(q.trim(), f === 'all' ? 'all' : f);
      // Keep memory low by capping DOM results to 24 items
      setResults(res ? res.slice(0, 24) : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => { 
    e.preventDefault(); 
    doSearch(query, filter); 
  };
  
  const handleFilterChange = (f: Filter) => { 
    setFilter(f); 
    if (query) doSearch(query, f); 
  };
  
  const handleQuick = (term: string) => { 
    setQuery(term); 
    addToSearchHistory(term);
    doSearch(term, filter); 
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      inputRef.current?.blur();
      return;
    }

    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        const chosen = suggestions[selectedIndex];
        setQuery(chosen);
        setShowSuggestions(false);
        doSearch(chosen, filter);
      }
    }
  };

  const filteredLocal = localTracks.filter(t =>
    t.title.toLowerCase().includes(query.toLowerCase()) ||
    t.artist.toLowerCase().includes(query.toLowerCase())
  );

  const sourceIcon = (source: string, sm = false) => {
    const cls = sm ? 'w-3 h-3' : 'w-3.5 h-3.5';
    if (source === 'youtube') return <YoutubeIcon className={`${cls} text-[#ff4e6b]`} />;
    if (source === 'soundcloud') return <SoundCloudIcon className={`${cls} text-orange-400`} />;
    if (source === 'audius') return <AudiusIcon className={`${cls}`} style={{ color: accentColor }} />;
    return <Disc3 className={`${cls} text-white`} />;
  };

  const filters: { id: Filter; label: string; icon?: React.ReactNode }[] = [
    { id: 'all', label: getTranslation(language, 'search.filterAll') },
    { id: 'youtube', label: getTranslation(language, 'search.filterYoutube'), icon: <YoutubeIcon className="w-3 h-3 text-[#ff4e6b]" /> },
    { id: 'soundcloud', label: getTranslation(language, 'search.filterSoundcloud'), icon: <SoundCloudIcon className="w-3 h-3 text-orange-400" /> },
    { id: 'audius', label: getTranslation(language, 'search.filterAudius'), icon: <AudiusIcon className="w-3 h-3 text-white" /> },
    { id: 'local', label: getTranslation(language, 'search.filterLocal') },
  ];

  return (
    <div className="flex-1 w-full pb-16">
      {/* Desktop Search Header: Trên desktop chỉ hiển thị tiêu đề và trạng thái, dùng ô search trên thanh window */}
      <div className="hidden md:flex items-center justify-between mb-4 pb-2 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <Search className="w-4 h-4 text-zinc-400" />
          <h2 className="text-base font-semibold text-white tracking-tight">
            {getTranslation(language, 'search.title')}
          </h2>
          {query.trim() && (
            <span className="text-xs text-zinc-400 font-normal">
              — {language === 'vi' ? 'Kết quả cho:' : 'Results for:'} <span className="text-zinc-200 font-medium font-mono">"{query}"</span>
            </span>
          )}
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{language === 'vi' ? 'Đang tìm kiếm...' : 'Searching...'}</span>
          </div>
        )}
      </div>

      {/* Mobile Search Bar: Giữ lại trên điện thoại (màn hình nhỏ) */}
      <div className="w-full max-w-4xl xl:max-w-5xl mb-4 md:hidden">
        <h2 className="text-lg font-bold tracking-tight text-white mb-3">
          {getTranslation(language, 'search.title')}
        </h2>
        <div className="relative z-10" ref={searchContainerRef}>
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setIsTyping(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder={getTranslation(language, 'search.placeholder')}
              className="w-full pl-10 pr-28 py-2.5 bg-zinc-900/80 hover:bg-zinc-900 focus:bg-zinc-900 text-white rounded-xl text-xs outline-none border border-white/10 transition-all"
              style={{ borderColor: query ? `${accentColor}80` : undefined }}
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setSuggestions([]);
                  setShowSuggestions(false);
                  setIsTyping(false);
                  inputRef.current?.focus();
                }}
                className="absolute right-16 p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title={getTranslation(language, 'search.clear')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: accentColor,
                color: getContrastTextColor(accentColor),
              }}
              className="absolute right-1.5 px-3.5 py-1.5 hover:opacity-90 active:scale-95 disabled:opacity-50 text-[11px] font-semibold rounded-lg cursor-pointer transition-all flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : getTranslation(language, 'search.btn')}
            </button>
          </form>

          {/* Keyword Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div 
              className="absolute top-full left-0 right-0 mt-2 py-1.5 rounded-xl bg-zinc-900 border border-white/10 shadow-2xl z-50 font-sans"
            >
              <div className="px-3.5 py-1.5 text-[10px] font-mono font-medium text-zinc-400 flex items-center justify-between border-b border-white/5 mb-1">
                <span className="flex items-center gap-1.5">
                  <Search className="w-3 h-3 text-zinc-400" />
                  {getTranslation(language, 'search.suggestions')}
                </span>
                <span className="text-[9px] text-zinc-500 font-normal">ESC</span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {suggestions.map((sug, idx) => (
                  <div
                    key={idx}
                    onMouseDown={() => {
                      setQuery(sug);
                      setShowSuggestions(false);
                      doSearch(sug, filter);
                    }}
                    className={`px-3.5 py-2 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                      selectedIndex === idx 
                        ? 'bg-white/10 text-white font-medium' 
                        : 'text-zinc-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <Search className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                      <span className="truncate">{sug}</span>
                    </div>
                    <ArrowUpRight className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter Pills — Unslop: clean minimal monochrome / subtle borders, no glow */}
      <div className="w-full max-w-4xl xl:max-w-5xl mb-5">
        <div className="flex gap-1.5 flex-wrap">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => handleFilterChange(f.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                filter === f.id
                  ? 'bg-white text-zinc-950 font-semibold border-white'
                  : 'bg-zinc-900/60 text-zinc-400 hover:text-white hover:bg-zinc-800/80 border-white/5'
              }`}
            >
              {f.icon}{f.label}
            </button>
          ))}
        </div>

        {/* Quick searches & Dynamic History Suggestions */}
        {!query && (
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[10px] text-[#888] uppercase font-mono flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" style={{ color: accentColor }} />
                {(searchHistory.length > 0 || playedHistory.length > 0)
                  ? (language === 'vi' ? 'GỢI Ý THEO BÀI HÁT & NGHỆ SĨ:' : 'SUGGESTIONS FROM YOUR MUSIC & SEARCHES:') 
                  : getTranslation(language, 'search.quick')}
              </span>
              {(searchHistory.length > 0 || playedHistory.length > 0) && (
                <button
                  type="button"
                  onClick={clearSearchHistory}
                  className="text-[10px] text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer font-mono"
                  title={language === 'vi' ? 'Xóa gợi ý & lịch sử tìm kiếm' : 'Clear suggestions and search history'}
                >
                  {language === 'vi' ? 'Xóa lịch sử' : 'Clear history'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {dynamicSuggestions.map((item, idx) => {
                const isFromSearch = item.type === 'search';
                const isFromPlayed = item.type === 'played_artist' || item.type === 'played_track';
                return (
                  <button
                    key={`${item.text}-${idx}`}
                    onClick={() => handleQuick(item.text)}
                    className={`px-2.5 py-1 rounded-full text-[11px] border transition-all cursor-pointer flex items-center gap-1.5 ${
                      isFromSearch
                        ? 'bg-[#14141e] hover:bg-[#1e1e2c] text-zinc-200 border-[#2a2a3a] hover:border-white/30 shadow-sm'
                        : isFromPlayed
                        ? 'bg-[#16121f] hover:bg-[#20182c] text-purple-200 border-purple-500/25 hover:border-purple-500/50 shadow-sm'
                        : 'bg-[#101014] hover:bg-[#181820] text-[#888] hover:text-white border-[#1a1a22]'
                    }`}
                  >
                    {isFromSearch && <History className="w-3 h-3 text-zinc-400 shrink-0" />}
                    {isFromPlayed && <Music className="w-3 h-3 text-purple-400 shrink-0" />}
                    {item.type === 'trending' && <Sparkles className="w-3 h-3 text-amber-400/80 shrink-0" />}
                    <span className="truncate max-w-[200px]">{item.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-[#888] py-8">
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: accentColor }} />
          <span>{getTranslation(language, 'search.loading')}</span>
        </div>
      )}

      {/* Local tracks matched */}
      {filter !== 'youtube' && filter !== 'soundcloud' && filter !== 'audius' && filteredLocal.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wider font-mono">
            {getTranslation(language, 'nav.localMusic')} ({filteredLocal.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5">
            {filteredLocal.map(t => {
              const isActive = currentTrack?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    if (t.artist) addToSearchHistory(t.artist);
                    if (t.title) addToSearchHistory(t.title);
                    onTrackSelect(t);
                  }}
                  style={isActive ? { borderColor: `${accentColor}`, backgroundColor: `${accentColor}14`, boxShadow: `0 0 14px ${accentColor}30` } : undefined}
                  className={`card-hover-accent flex items-center justify-between p-2.5 rounded-xl bg-[#0c0c10] hover:bg-[#14141a] border transition-all cursor-pointer group ${
                    isActive ? '' : 'border-[#161620]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#181820] flex-shrink-0 flex items-center justify-center text-[#555] border border-[#222]">
                      {t.cover_art ? (
                        <img
                          src={optimizeThumbnailUrl(t.cover_art, t.path_or_url || t.id)}
                          alt={t.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleImageError(e, t.path_or_url || t.id)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pr-1">
                      <p 
                        className="card-title-accent text-xs font-semibold text-white transition-colors truncate"
                        style={isActive ? { color: accentColor } : undefined}
                      >
                        {sanitizeTrackTitle(t.title)}
                      </p>
                      <p className="text-[11px] text-[#777] truncate">{t.artist}</p>
                    </div>
                  </div>
                  <Play className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Online results */}
      {results.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-white mb-3 uppercase tracking-wider font-mono">
            Online Results ({results.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
            {results.map((r, i) => {
              const isMatchCurrent = currentTrack && (
                r.url_or_id === currentTrack.path_or_url ||
                r.title.toLowerCase().trim() === currentTrack.title.toLowerCase().trim()
              );
              return (
                <div
                  key={i}
                  onClick={() => {
                    if (r.artist) addToSearchHistory(r.artist);
                    if (r.title) addToSearchHistory(r.title);
                    onPlaySearchResult(r, results);
                  }}
                  style={isMatchCurrent ? {
                    borderColor: `${accentColor}`,
                    boxShadow: `0 0 16px ${accentColor}40`,
                    backgroundColor: `${accentColor}12`
                  } : undefined}
                  className={`card-hover-accent p-3 rounded-xl bg-[#09090c] hover:bg-[#121218] border transition-all flex items-center gap-3 cursor-pointer group shadow-sm ${
                    isMatchCurrent ? '' : 'border-[#161620]'
                  }`}
                >
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-[#16161e]">
                    {r.thumbnail ? (
                      <img
                        src={optimizeThumbnailUrl(r.thumbnail, r.url_or_id)}
                        alt={r.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => handleImageError(e, r.url_or_id)}
                        loading="lazy"
                        decoding="async"
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

                  <div className="overflow-hidden flex-1">
                    <p 
                      className="card-title-accent text-xs font-semibold text-white truncate transition-colors" 
                      style={isMatchCurrent ? { color: accentColor } : undefined}
                    >
                      {sanitizeTrackTitle(r.title)}
                    </p>
                    <p className="text-[11px] text-[#8e8e9f] truncate mt-0.5">{r.artist}</p>
                    <div className="flex items-center justify-between gap-1.5 mt-1">
                      <div className="flex items-center gap-1.5">
                        {sourceIcon(r.source, true)}
                        <span className="text-[10px] text-[#666] font-mono uppercase">{r.source}</span>
                      </div>
                      {onAddToAlbum && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddToAlbum({
                              id: r.url_or_id,
                              title: r.title,
                              artist: r.artist,
                              album: r.album || 'Spytify Search',
                              duration_secs: r.duration_secs || 210,
                              path_or_url: r.url_or_id,
                              cover_art: r.thumbnail,
                              source: r.source || 'youtube',
                            });
                          }}
                          className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                          title={language === 'vi' ? 'Thêm vào Album' : 'Add to Album'}
                        >
                          <FolderPlus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
