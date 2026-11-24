import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Mic2, RefreshCw, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { Track } from '../types';
import { fetchLyrics, LyricsData, LyricLine } from '../services/lyricsService';

function formatTime(secs: number): string {
  if (isNaN(secs) || secs < 0) return '0:00';
  const mins = Math.floor(secs / 60);
  const remainingSecs = Math.floor(secs % 60);
  return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
}

interface KaraokeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: Track | null;
  isPlaying?: boolean;
  currentTime: number;
  duration?: number;
  onTogglePlay?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onSeek: (time: number) => void;
  accentColor?: string;
  language?: string;
}

export const KaraokeModal: React.FC<KaraokeModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  accentColor = '#ff2a55',
  language = 'vi',
}) => {
  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [syncOffset, setSyncOffset] = useState<number>(0);
  const scrollTimeoutRef = useRef<any>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const activeLineElRef = useRef<HTMLDivElement | null>(null);

  // Load saved offset for this track
  useEffect(() => {
    if (!currentTrack) {
      setSyncOffset(0);
      return;
    }
    const saved = localStorage.getItem(`spytify_lyrics_offset_${currentTrack.id}`);
    if (saved !== null) {
      const parsed = parseFloat(saved);
      setSyncOffset(isNaN(parsed) ? 0 : parsed);
    } else {
      setSyncOffset(0);
    }
  }, [currentTrack?.id]);

  const handleAdjustOffset = (delta: number) => {
    if (!currentTrack) return;
    const nextOffset = Math.round((syncOffset + delta) * 10) / 10;
    setSyncOffset(nextOffset);
    if (nextOffset === 0) {
      localStorage.removeItem(`spytify_lyrics_offset_${currentTrack.id}`);
    } else {
      localStorage.setItem(`spytify_lyrics_offset_${currentTrack.id}`, String(nextOffset));
    }
  };

  const handleResetOffset = () => {
    if (!currentTrack) return;
    setSyncOffset(0);
    localStorage.removeItem(`spytify_lyrics_offset_${currentTrack.id}`);
  };

  // Fetch lyrics whenever currentTrack changes
  useEffect(() => {
    if (!isOpen || !currentTrack) return;
    let isCancelled = false;
    setIsLoading(true);

    fetchLyrics(currentTrack.title, currentTrack.artist, currentTrack.duration_secs || duration)
      .then((data) => {
        if (!isCancelled) {
          setLyricsData(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setLyricsData(null);
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, currentTrack?.id, currentTrack?.title, currentTrack?.artist]);

  // Determine active lyric line index based on currentTime + syncOffset
  const activeIndex = useMemo(() => {
    if (!lyricsData || !lyricsData.synced || !lyricsData.lines.length) return -1;
    const lines = lyricsData.lines;
    // Current time with sync offset and a tiny 0.15s lead-in for human perception
    const leadTime = currentTime + syncOffset + 0.15;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (leadTime >= lines[i].time) {
        return i;
      }
    }
    // Return -1 if track is still in intro before first lyric
    return -1;
  }, [lyricsData, currentTime, syncOffset]);

  // Auto-scroll active lyric line to center of view when not manually scrolling
  useEffect(() => {
    if (isUserScrolling || activeIndex < 0 || !activeLineElRef.current) return;
    try {
      activeLineElRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    } catch {}
  }, [activeIndex, isUserScrolling]);

  const handleContainerScroll = () => {
    setIsUserScrolling(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    // Resume auto-scroll after 2.5 seconds of user inactivity
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 top-0 bottom-0 md:bottom-[52px] z-[100] flex flex-col bg-[#050508] text-white select-none animate-fadeIn">
      {/* Dynamic Ambient Background Blur */}
      {currentTrack?.cover_art && (
        <div
          className="absolute inset-0 pointer-events-none opacity-25 filter blur-[100px] scale-125 transition-all duration-1000 -z-10"
          style={{
            backgroundImage: `url(${currentTrack.cover_art})`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }}
        />
      )}

      {/* Top Header */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-3 sm:py-4 border-b border-white/10 z-10 shrink-0 bg-[#07070b] shadow-md">
        <div className="flex items-center gap-3 min-w-0 pr-2">
          {currentTrack?.cover_art && (
            <img
              src={currentTrack.cover_art}
              alt=""
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover shadow-lg border border-white/10 shrink-0"
            />
          )}
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-[220px] sm:max-w-[400px]">
              {currentTrack?.title || 'Chưa chọn bài hát'}
            </h2>
            <p className="text-xs text-zinc-400 truncate max-w-[200px] sm:max-w-[320px]">
              {currentTrack?.artist || '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Real-time Lyrics Sync Offset Calibration */}
          {lyricsData?.synced && (
            <div
              className="flex items-center gap-0.5 bg-[#12121a] border border-white/15 rounded-full px-2 py-0.5 text-xs shadow-inner"
              title={language === 'vi' ? 'Hiệu chỉnh độ lệch thời gian lời bài hát (Nhanh/Chậm)' : 'Adjust lyrics synchronization offset'}
            >
              <button
                type="button"
                onClick={() => handleAdjustOffset(-0.5)}
                className="px-1.5 py-0.5 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white font-mono text-[11px] cursor-pointer transition-colors"
                title={language === 'vi' ? 'Chạy sớm hơn 0.5 giây (-0.5s)' : 'Earlier by 0.5s'}
              >
                -0.5s
              </button>
              <button
                type="button"
                onClick={handleResetOffset}
                className="px-1.5 py-0.5 font-mono text-[11px] font-bold cursor-pointer transition-colors"
                style={{ color: syncOffset !== 0 ? accentColor : '#a1a1aa' }}
                title={language === 'vi' ? `Độ lệch: ${syncOffset > 0 ? `+${syncOffset.toFixed(1)}s` : `${syncOffset.toFixed(1)}s`} (Nhấn để đặt lại 0s)` : `Offset: ${syncOffset.toFixed(1)}s (Click to reset)`}
              >
                {syncOffset > 0 ? `+${syncOffset.toFixed(1)}s` : `${syncOffset.toFixed(1)}s`}
              </button>
              <button
                type="button"
                onClick={() => handleAdjustOffset(+0.5)}
                className="px-1.5 py-0.5 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white font-mono text-[11px] cursor-pointer transition-colors"
                title={language === 'vi' ? 'Chạy trễ hơn 0.5 giây (+0.5s)' : 'Later by 0.5s'}
              >
                +0.5s
              </button>
            </div>
          )}

          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold tracking-wider"
            style={{
              backgroundColor: `${accentColor}18`,
              borderColor: `${accentColor}40`,
              color: accentColor,
            }}
          >
            <Mic2 className="w-3.5 h-3.5 animate-pulse" />
            <span>KARAOKE</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Center Lyrics Canvas */}
      <main
        ref={listContainerRef}
        onScroll={handleContainerScroll}
        className="flex-1 overflow-y-auto px-4 sm:px-12 py-16 flex flex-col items-center scroll-smooth scrollbar-none"
        style={{ scrollbarWidth: 'none' }}
      >
        {isLoading ? (
          <div className="my-auto flex flex-col items-center gap-3 text-zinc-400 animate-pulse">
            <RefreshCw className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
            <p className="text-sm">Đang tải lời bài hát đồng bộ từ LRCLIB...</p>
          </div>
        ) : !lyricsData || (!lyricsData.synced && !lyricsData.plainText) ? (
          <div className="my-auto flex flex-col items-center text-center max-w-md gap-3 py-12 text-zinc-400">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center border"
              style={{
                backgroundColor: `${accentColor}15`,
                borderColor: `${accentColor}30`,
                color: accentColor,
              }}
            >
              <Mic2 className="w-7 h-7" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white">Chưa có lời đồng bộ</h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Bài hát này hiện chưa có dữ liệu thời gian khớp từng câu trên kho mã nguồn mở LRCLIB. Hãy tận hưởng giai điệu tuyệt vời nhé!
            </p>
          </div>
        ) : lyricsData.synced && lyricsData.lines.length > 0 ? (
          <div className="w-full max-w-3xl flex flex-col items-center text-center py-20 space-y-7 sm:space-y-9">
            {lyricsData.lines.map((line, idx) => {
              const isActive = idx === activeIndex;
              const isPast = idx < activeIndex;

              return (
                <div
                  key={`${line.time}_${idx}`}
                  ref={isActive ? (el) => { activeLineElRef.current = el; } : undefined}
                  onClick={() => onSeek(line.time)}
                  className={`group relative transition-all duration-300 cursor-pointer px-4 py-1.5 rounded-xl ${
                    isActive
                      ? 'scale-105 sm:scale-110 font-bold z-10'
                      : isPast
                      ? 'opacity-35 hover:opacity-80 scale-95'
                      : 'opacity-40 hover:opacity-80 scale-95'
                  }`}
                >
                  <p
                    className={`leading-relaxed tracking-tight transition-all duration-300 ${
                      isActive
                        ? 'text-2xl sm:text-4xl text-white'
                        : 'text-lg sm:text-2xl text-zinc-300'
                    }`}
                    style={
                      isActive
                        ? {
                            color: '#ffffff',
                            textShadow: `0 0 24px ${accentColor}, 0 0 45px ${accentColor}80`,
                          }
                        : undefined
                    }
                  >
                    {line.text}
                  </p>

                  {/* Hover seek indicator badge */}
                  <span className="hidden group-hover:inline-block absolute right-0 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-zinc-400">
                    {formatTime(line.time)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          /* Plain text fallback when synced timestamps are unavailable */
          <div className="w-full max-w-2xl whitespace-pre-wrap text-center py-10 text-base sm:text-lg text-zinc-300 leading-loose">
            {lyricsData.plainText}
          </div>
        )}
      </main>

      {/* Mobile-only Bottom Playback Controls Bar */}
      <div className="md:hidden shrink-0 z-20 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-2">
        <div className="flex items-center justify-between bg-[#0e0e16]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-2.5 shadow-2xl">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
            {currentTrack?.cover_art && (
              <img
                src={currentTrack.cover_art}
                alt=""
                className="w-9 h-9 rounded-lg object-cover shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">{currentTrack?.title || 'Spytify'}</p>
              <p className="text-[10px] text-zinc-400 font-mono">
                {formatTime(currentTime)} / {formatTime(duration || currentTrack?.duration_secs || 0)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onPrev && (
              <button
                type="button"
                onClick={onPrev}
                className="p-1.5 text-zinc-300 hover:text-white cursor-pointer"
                title="Bài trước"
              >
                <SkipBack className="w-5 h-5 fill-current" />
              </button>
            )}
            {onTogglePlay && (
              <button
                type="button"
                onClick={onTogglePlay}
                className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg cursor-pointer active:scale-95 transition-transform"
                style={{
                  backgroundColor: accentColor,
                  color: '#ffffff',
                }}
                title={isPlaying ? 'Tạm dừng' : 'Phát'}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>
            )}
            {onNext && (
              <button
                type="button"
                onClick={onNext}
                className="p-1.5 text-zinc-300 hover:text-white cursor-pointer"
                title="Bài tiếp theo"
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
