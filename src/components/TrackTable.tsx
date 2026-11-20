import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Play, Pause, Clock3, Heart, Music, HardDrive, FolderPlus, Download, Loader2, Check, ArrowUpDown, ArrowUp, ArrowDown, Search, Zap, GripVertical } from 'lucide-react';
import { YoutubeIcon, SoundCloudIcon, AudiusIcon } from './Icons';
import { Track } from '../types';
import { HoverMarquee } from './HoverMarquee';
import { optimizeThumbnailUrl, handleImageError } from '../utils/trackUtils';
import { LanguageCode, getTranslation } from '../locales/i18n';

interface TrackTableProps {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  favorites: Set<string>;
  onTrackSelect: (track: Track) => void;
  onTogglePlay: () => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToAlbum?: (track: Track) => void;
  onDownloadTrack?: (track: Track) => void;
  downloadingTrackIds?: Set<string>;
  accentColor?: string;
  language?: LanguageCode;
  onReorderTracks?: (newTracks: Track[]) => void;
}

const ROW_HEIGHT = 54;
const OVERSCAN = 6;

export const TrackTable: React.FC<TrackTableProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  favorites,
  onTrackSelect,
  onTogglePlay,
  onToggleFavorite,
  onAddToAlbum,
  onDownloadTrack,
  downloadingTrackIds,
  accentColor = '#ff2a55',
  language = 'vi',
  onReorderTracks,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(800);
  const [sortBy, setSortBy] = useState<string>('default');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [displayList, setDisplayList] = useState<Track[]>(tracks);

  // Drag and drop reordering state via Pointer Events (Rock-solid in Tauri / WebView2)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'above' | 'below' | null>(null);

  const dragRef = useRef<{
    startIndex: number;
    startX: number;
    startY: number;
    moved: boolean;
    overIndex: number | null;
    position: 'above' | 'below' | null;
  } | null>(null);
  const suppressClickIdxRef = useRef<number | null>(null);

  const canReorder = Boolean(onReorderTracks && !filterQuery.trim() && sortBy === 'default');

  useEffect(() => {
    if (!canReorder) return;

    const handlePointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const dx = Math.abs(e.clientX - drag.startX);
      const dy = Math.abs(e.clientY - drag.startY);
      if (!drag.moved && dx < 5 && dy < 5) return;

      if (!drag.moved) {
        drag.moved = true;
        setDraggedIdx(drag.startIndex);
      }

      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const rowSlot = el?.closest('[data-track-idx]') as HTMLElement | null;
      const targetIdxAttr = rowSlot?.getAttribute('data-track-idx');

      if (rowSlot && targetIdxAttr !== null && targetIdxAttr !== undefined) {
        const targetIdx = parseInt(targetIdxAttr, 10);
        if (!isNaN(targetIdx) && targetIdx !== drag.startIndex) {
          const rect = rowSlot.getBoundingClientRect();
          const pos: 'above' | 'below' = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
          drag.overIndex = targetIdx;
          drag.position = pos;
          setDragOverIdx(targetIdx);
          setDropPosition(pos);
          return;
        }
      }

      drag.overIndex = null;
      drag.position = null;
      setDragOverIdx(null);
      setDropPosition(null);
    };

    const handlePointerUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;

      if (drag.moved) {
        suppressClickIdxRef.current = drag.startIndex;
        setTimeout(() => {
          suppressClickIdxRef.current = null;
        }, 150);

        if (drag.overIndex !== null && drag.overIndex !== drag.startIndex && onReorderTracks) {
          const from = drag.startIndex;
          const to = drag.overIndex;
          const pos = drag.position || 'above';

          const currentList = displayList.length > 0 ? [...displayList] : [...tracks];
          if (from >= 0 && from < currentList.length && to >= 0 && to < currentList.length) {
            const [movedItem] = currentList.splice(from, 1);
            let insertIdx = to;
            if (from < to) {
              insertIdx = (pos === 'below') ? to : Math.max(0, to - 1);
            } else {
              insertIdx = (pos === 'below' && to < from - 1) ? to + 1 : to;
            }
            insertIdx = Math.max(0, Math.min(currentList.length, insertIdx));
            currentList.splice(insertIdx, 0, movedItem);

            setDisplayList(currentList);
            onReorderTracks(currentList);
          }
        }
      }

      setDraggedIdx(null);
      setDragOverIdx(null);
      setDropPosition(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [canReorder, displayList, tracks, onReorderTracks]);

  // Native Rust-powered fast filtering and sorting
  useEffect(() => {
    let isCancelled = false;

    const processTracks = async () => {
      let current = tracks;
      if (filterQuery.trim()) {
        try {
          current = await invoke<Track[]>('rust_filter_tracks', { tracks: current, query: filterQuery });
        } catch {
          const q = filterQuery.trim().toLowerCase();
          current = current.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
        }
      }

      if (sortBy !== 'default') {
        try {
          current = await invoke<Track[]>('rust_sort_tracks', { tracks: current, sortBy, ascending: sortAsc });
        } catch {
          current = [...current].sort((a, b) => {
            let res = 0;
            if (sortBy === 'title') res = a.title.localeCompare(b.title);
            else if (sortBy === 'artist') res = a.artist.localeCompare(b.artist);
            else if (sortBy === 'duration') res = a.duration_secs - b.duration_secs;
            else if (sortBy === 'source') res = a.source.localeCompare(b.source);
            return sortAsc ? res : -res;
          });
        }
      }

      if (!isCancelled) {
        setDisplayList(current);
      }
    };

    processTracks();
    return () => { isCancelled = true; };
  }, [tracks, sortBy, sortAsc, filterQuery]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      if (sortAsc) {
        setSortAsc(false);
      } else {
        setSortBy('default');
        setSortAsc(true);
      }
    } else {
      setSortBy(field);
      setSortAsc(true);
    }
  };

  const renderSortIcon = (field: string) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="w-2.5 h-2.5 opacity-0 group-hover/col:opacity-40 transition-opacity ml-1" />;
    }
    return sortAsc ? (
      <ArrowUp className="w-2.5 h-2.5 ml-1 flex-shrink-0" style={{ color: accentColor }} />
    ) : (
      <ArrowDown className="w-2.5 h-2.5 ml-1 flex-shrink-0" style={{ color: accentColor }} />
    );
  };

  // Virtual Scrolling scroll listener on parent container
  useEffect(() => {
    const scrollParent = containerRef.current?.closest('.overflow-y-auto') as HTMLElement;
    if (!scrollParent) return;

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrollTop(scrollParent.scrollTop);
          ticking = false;
        });
        ticking = true;
      }
    };

    const onResize = () => {
      setContainerHeight(scrollParent.clientHeight || 800);
    };

    onResize();
    scrollParent.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      scrollParent.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const totalCount = displayList.length;
  const isVirtual = totalCount > 25;

  let startIndex = 0;
  let endIndex = totalCount;

  if (isVirtual) {
    const tableTop = containerRef.current?.offsetTop || 0;
    const relativeScroll = Math.max(0, scrollTop - tableTop);
    startIndex = Math.max(0, Math.floor(relativeScroll / ROW_HEIGHT) - OVERSCAN);
    endIndex = Math.min(totalCount, Math.ceil((relativeScroll + containerHeight) / ROW_HEIGHT) + OVERSCAN);
  }

  const visibleTracks = isVirtual ? displayList.slice(startIndex, endIndex) : displayList;
  const topPadding = isVirtual ? startIndex * ROW_HEIGHT : 0;
  const bottomPadding = isVirtual ? (totalCount - endIndex) * ROW_HEIGHT : 0;
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs <= 0 || secs > 86400) return '--:--';
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'youtube':
        return (
          <div 
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#141414] border whitespace-nowrap shrink-0"
            style={{ color: accentColor, borderColor: `${accentColor}40` }}
          >
            <YoutubeIcon className="w-3 h-3 shrink-0" />
            <span className="whitespace-nowrap">YT</span>
          </div>
        );
      case 'soundcloud':
        return (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#141414] text-orange-400 border border-orange-500/20 whitespace-nowrap shrink-0">
            <SoundCloudIcon className="w-3 h-3 text-orange-400 shrink-0" />
            <span className="whitespace-nowrap">SC</span>
          </div>
        );
      case 'audius':
        return (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#141416] text-white border border-white/20 whitespace-nowrap shrink-0">
            <AudiusIcon className="w-3 h-3 shrink-0" style={{ color: accentColor }} />
            <span className="whitespace-nowrap">AUDIUS</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#141418] text-white border border-white/20 whitespace-nowrap shrink-0">
            <HardDrive className="w-3 h-3 text-white shrink-0" />
            <span className="whitespace-nowrap">LOSSLESS</span>
          </div>
        );
    }
  };

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-8">
        <div className="w-14 h-14 rounded-full bg-[#0d0d10] border border-[#1a1a24] flex items-center justify-center text-[#555] mb-3">
          <Music className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-white mb-1">
          {getTranslation(language, 'table.emptyTitle')}
        </h3>
        <p className="text-xs text-[#777] max-w-sm">
          {getTranslation(language, 'table.emptyDesc')}
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full text-xs select-none">
      {/* Top Fast Filter & Status Bar */}
      {tracks.length > 5 && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 mb-2 bg-[#09090c] rounded-xl border border-[#161620]">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#555]" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder={language === 'vi' ? 'Tìm kiếm bài hát...' : 'Search tracks...'}
              className="w-full bg-[#101016] text-xs text-white placeholder-[#555] pl-8 pr-6 py-1.5 rounded-lg border border-[#1c1c28] focus:border-white/30 focus:outline-none font-mono"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#666] hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex items-center gap-2.5 text-[10px] font-mono">
            {sortBy !== 'default' && (
              <button
                onClick={() => { setSortBy('default'); setSortAsc(true); }}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 cursor-pointer transition-colors"
                title={language === 'vi' ? 'Đặt lại thứ tự ban đầu' : 'Reset default sort'}
              >
                <Zap className="w-2.5 h-2.5 fill-current" />
                <span>Rust: {sortBy} ({sortAsc ? '▲' : '▼'})</span>
                <span className="ml-1 text-xs leading-none">✕</span>
              </button>
            )}
            <span className="text-[#666]">
              {displayList.length} / {tracks.length} {language === 'vi' ? 'bài hát' : 'tracks'}
            </span>
          </div>
        </div>
      )}

      {/* Header — Spy Minimalist with Rust native sorting */}
      <div className="grid grid-cols-[40px_1fr_1fr_90px_110px] px-3 py-2 border-b border-[#141418] text-[10px] font-bold text-[#666677] uppercase tracking-wider sticky top-0 bg-black/90 backdrop-blur z-10 font-mono">
        <span 
          onClick={() => { setSortBy('default'); setSortAsc(true); }}
          className="text-center cursor-pointer hover:text-white transition-colors"
          title={language === 'vi' ? 'Thứ tự ban đầu' : 'Default index'}
        >
          #
        </span>
        <span 
          onClick={() => handleSort('title')}
          className="group/col flex items-center cursor-pointer hover:text-white transition-colors"
        >
          <span>{getTranslation(language, 'table.title')}</span>
          {renderSortIcon('title')}
        </span>
        <span 
          onClick={() => handleSort('artist')}
          className="group/col flex items-center cursor-pointer hover:text-white transition-colors"
        >
          <span>{getTranslation(language, 'table.artistAlbum')}</span>
          {renderSortIcon('artist')}
        </span>
        <span 
          onClick={() => handleSort('source')}
          className="group/col flex items-center justify-center cursor-pointer hover:text-white transition-colors text-center"
        >
          <span>{getTranslation(language, 'table.source')}</span>
          {renderSortIcon('source')}
        </span>
        <span 
          onClick={() => handleSort('duration')}
          className="group/col flex items-center justify-end pr-2 cursor-pointer hover:text-white transition-colors"
        >
          <Clock3 className="w-3.5 h-3.5" />
          {renderSortIcon('duration')}
        </span>
      </div>

      {/* Rows with Top & Bottom Virtual Padding */}
      <div className="divide-y divide-[#101014]">
        {topPadding > 0 && <div style={{ height: `${topPadding}px` }} aria-hidden="true" />}
        {visibleTracks.map((track, i) => {
          const idx = isVirtual ? startIndex + i : i;
          const isSelected = Boolean(
            currentTrack && (
              currentTrack.id === track.id ||
              (currentTrack.path_or_url && currentTrack.path_or_url === track.path_or_url) ||
              (currentTrack.title.trim().toLowerCase() === track.title.trim().toLowerCase() &&
               currentTrack.artist.trim().toLowerCase() === track.artist.trim().toLowerCase())
            )
          );
          const isFav = favorites.has(track.id);

          return (
            <div
              key={track.id}
              data-track-idx={idx}
              onPointerDown={(e) => {
                if (!canReorder) return;
                const target = e.target as HTMLElement;
                if (target.closest('button, a, input')) return;
                dragRef.current = {
                  startIndex: idx,
                  startX: e.clientX,
                  startY: e.clientY,
                  moved: false,
                  overIndex: null,
                  position: null,
                };
              }}
              onClick={() => {
                if (suppressClickIdxRef.current === idx) return;
                if (isSelected) {
                  onTogglePlay();
                } else {
                  onTrackSelect(track);
                }
              }}
              onDoubleClick={() => onTrackSelect(track)}
              style={{
                height: `${ROW_HEIGHT}px`,
                borderLeftColor: isSelected ? accentColor : 'transparent',
                backgroundColor: isSelected ? `${accentColor}18` : undefined,
              }}
              className={`grid grid-cols-[40px_1fr_1fr_90px_110px] items-center px-3 rounded-md transition-all group select-none relative ${
                canReorder ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
              } ${
                draggedIdx === idx ? 'opacity-30 scale-[0.99] bg-white/5 pointer-events-none' : ''
              } ${
                dragOverIdx === idx && dropPosition === 'above' ? 'border-t-2 border-cyan-400 bg-cyan-500/10' : ''
              } ${
                dragOverIdx === idx && dropPosition === 'below' ? 'border-b-2 border-cyan-400 bg-cyan-500/10' : ''
              } ${
                isSelected
                  ? 'text-white border-l-2'
                  : 'hover:bg-[#0c0c10] text-[#888899] hover:text-white border-l-2 border-transparent'
              }`}
            >
              {/* Col 1: Play button / Number / Equalizer / Drag handle */}
              <div className="flex items-center justify-center relative">
                {canReorder && (
                  <div 
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      dragRef.current = {
                        startIndex: idx,
                        startX: e.clientX,
                        startY: e.clientY,
                        moved: false,
                        overIndex: null,
                        position: null,
                      };
                    }}
                    className="hidden group-hover:flex items-center justify-center text-slate-400 hover:text-white p-1 rounded hover:bg-white/10 absolute -left-1 z-20 cursor-grab active:cursor-grabbing touch-none"
                    title={language === 'vi' ? 'Kéo thả để đổi thứ tự bài hát' : 'Drag to reorder'}
                  >
                    <GripVertical className="w-3.5 h-3.5 pointer-events-none" />
                  </div>
                )}
                {isSelected && isPlaying ? (
                  <div className="flex items-end justify-center gap-[2.5px] h-3.5 group-hover:hidden">
                    <span 
                      className="w-[3px] rounded-full animate-[pulse_0.8s_ease-in-out_infinite] h-3.5"
                      style={{ backgroundColor: accentColor }} 
                    />
                    <span 
                      className="w-[3px] rounded-full animate-[pulse_1.2s_ease-in-out_infinite_200ms] h-2" 
                      style={{ backgroundColor: accentColor }} 
                    />
                    <span 
                      className="w-[3px] rounded-full animate-[pulse_0.9s_ease-in-out_infinite_400ms] h-3" 
                      style={{ backgroundColor: accentColor }} 
                    />
                  </div>
                ) : (
                  <span 
                    className={`text-[11px] font-mono ${isSelected ? 'font-bold' : 'group-hover:hidden text-[#444]'}`}
                    style={{ color: isSelected ? accentColor : undefined }}
                  >
                    {idx + 1}
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isSelected) {
                      onTogglePlay();
                    } else {
                      onTrackSelect(track);
                    }
                  }}
                  className={`hidden group-hover:flex items-center justify-center p-1 rounded-full text-white hover:scale-110 transition-transform ${
                    isSelected ? 'flex' : ''
                  }`}
                >
                  {isSelected && isPlaying ? (
                    <Pause className="w-3.5 h-3.5 fill-current" style={{ color: accentColor }} />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current text-white hover:opacity-80" />
                  )}
                </button>
              </div>

              {/* Col 2: Title & Artist & Cover */}
              <div className="flex items-center gap-3 overflow-hidden pr-3">
                <div className="w-9 h-9 rounded bg-[#111] border border-[#1e1e24] flex-shrink-0 overflow-hidden relative">
                  {track.cover_art ? (
                    <img
                      src={optimizeThumbnailUrl(track.cover_art, track.path_or_url || track.id)}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => handleImageError(e, track.path_or_url || track.id)}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#555]">
                      <Music className="w-4 h-4" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col overflow-hidden min-w-0">
                  <HoverMarquee
                    text={track.title}
                    className={`font-semibold text-xs ${
                      isSelected ? 'font-bold' : 'text-white'
                    }`}
                    style={{ color: isSelected ? accentColor : undefined }}
                  />
                  <HoverMarquee
                    text={track.artist}
                    className="text-[11px] text-[#8e8e9f] group-hover:text-white"
                  />
                </div>
              </div>

              {/* Col 3: Album */}
              <div className="truncate text-[11px] text-[#666677] pr-3 font-mono">
                {(() => {
                  const alb = track.album?.trim() || '';
                  if (!alb || alb === 'Unknown Album' || alb.startsWith('và •') || alb.startsWith('& •') || alb.startsWith('and •')) {
                    return 'Single • YT Music';
                  }
                  return alb;
                })()}
              </div>

              {/* Col 4: Source Badge */}
              <div className="flex items-center justify-center">
                {getSourceBadge(track.source)}
              </div>

              {/* Col 5: Duration & Like & Add to Album */}
              <div className="flex items-center justify-end gap-2 text-[11px] pr-1 font-mono text-[#666]">
                {track.source !== 'local' && !track.is_downloaded && onDownloadTrack ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownloadTrack(track);
                    }}
                    disabled={downloadingTrackIds?.has(track.id)}
                    title={
                      downloadingTrackIds?.has(track.id)
                        ? getTranslation(language, 'download.downloading')
                        : getTranslation(language, 'download.downloadBtn')
                    }
                    className={`p-1 transition-colors cursor-pointer ${
                      downloadingTrackIds?.has(track.id)
                        ? 'text-[var(--accent-color, #ff2a55)] animate-pulse'
                        : 'opacity-0 group-hover:opacity-100 text-[#666] hover:text-white'
                    }`}
                  >
                    {downloadingTrackIds?.has(track.id) ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                  </button>
                ) : (track.is_downloaded || track.source === 'local') ? (
                  <span
                    title={getTranslation(language, 'download.downloaded')}
                    className="p-1 text-emerald-400 flex items-center justify-center"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </span>
                ) : null}

                {onAddToAlbum && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToAlbum(track);
                    }}
                    title={language === 'vi' ? `Thêm "${track.title}" vào Album riêng` : getTranslation(language, 'player.addToAlbum')}
                    className="p-1 transition-all cursor-pointer opacity-70 group-hover:opacity-100 text-[#888] hover:text-white hover:scale-110 active:scale-95"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(track.id);
                  }}
                  className={`p-1 transition-colors cursor-pointer ${
                    isFav
                      ? 'drop-shadow-sm'
                      : 'opacity-0 group-hover:opacity-100 text-[#555] hover:text-white'
                  }`}
                  style={isFav ? { color: accentColor } : undefined}
                >
                  <Heart 
                    className="w-3.5 h-3.5" 
                    style={isFav ? { fill: accentColor, color: accentColor } : undefined} 
                  />
                </button>
                <span>{formatTime(track.duration_secs)}</span>
              </div>
            </div>
          );
        })}
        {bottomPadding > 0 && <div style={{ height: `${bottomPadding}px` }} aria-hidden="true" />}
      </div>
    </div>
  );
};
