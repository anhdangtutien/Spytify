import React, { useState } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat,
  Volume2, VolumeX, Heart, Music, Sparkles, FolderPlus, Radio,
  Download, Check, Loader2, Moon, Clock, Minus, Plus, Eye, EyeOff,
  ChevronDown, ChevronUp, Disc, Activity, Sliders, SlidersHorizontal, Headphones, Tv
} from 'lucide-react';
import { YoutubeIcon, SoundCloudIcon, AudiusIcon } from './Icons';
import { Track } from '../types';
import { getContrastTextColor, optimizeThumbnailUrl, handleImageError } from '../utils/trackUtils';
import { LanguageCode, getTranslation } from '../locales/i18n';
import { MarqueeText } from './MarqueeText';

interface PlayerBarProps {
  currentTrack: Track | null;
  upcomingTrack?: Track | null;
  previousTrack?: Track | null;
  upcomingModeLabel?: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isFavorite: boolean;
  repeatMode: 'all' | 'one' | 'off';
  isShuffle: boolean;
  onToggleRepeat: () => void;
  onToggleShuffle: () => void;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleFavorite: () => void;
  onAddToAlbum?: () => void;
  onDownload?: (track: Track) => void;
  isDownloading?: boolean;
  onToggleVisualizer: () => void;
  showVisualizer: boolean;
  accentColor?: string;
  themeMode?: 'dark' | 'light';
  recommendMode?: 'fresh' | 'mix' | 'off';
  onCycleRecommendMode?: () => void;
  autoRecommend?: boolean;
  onToggleAutoRecommend?: () => void;
  sleepTimerMinutes?: number | null;
  sleepTimerRemainingSecs?: number | null;
  onSetSleepTimer?: (minutes: number | null) => void;
  crossfadeDuration?: number;
  onUpdateCrossfadeDuration?: (durationSecs: number) => void;
  isCrossfading?: boolean;
  language?: LanguageCode;
  isNextTrackPopupEnabled?: boolean;
  onToggleNextTrackPopupEnabled?: () => void;
  isCompact?: boolean;
  isMinimized?: boolean;
  onMinimize?: () => void;
  onToggleMinimize?: () => void;
  onOpenEqualizer?: () => void;
  isEqualizerActive?: boolean;
  isBackgroundPlayEnabled?: boolean;
  onToggleBackgroundPlay?: () => void;
  onToggleMv?: () => void;
  showMv?: boolean;
  isMobilePlayerOpen?: boolean;
  onToggleMobilePlayer?: (isOpen: boolean) => void;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  currentTrack, upcomingTrack, previousTrack, upcomingModeLabel, isPlaying, currentTime, duration, volume, isFavorite,
  repeatMode, isShuffle, onToggleRepeat, onToggleShuffle,
  onTogglePlay, onPrev, onNext, onSeek, onVolumeChange,
  onToggleFavorite, onAddToAlbum, onDownload, isDownloading = false, onToggleVisualizer, showVisualizer,
  accentColor = '#ff2a55',
  themeMode = 'dark',
  recommendMode = 'fresh',
  onCycleRecommendMode,
  autoRecommend = true,
  onToggleAutoRecommend,
  sleepTimerMinutes = null,
  sleepTimerRemainingSecs = null,
  onSetSleepTimer,
  crossfadeDuration = 5,
  onUpdateCrossfadeDuration,
  isCrossfading = false,
  language = 'vi',
  isNextTrackPopupEnabled = true,
  onToggleNextTrackPopupEnabled,
  isCompact = false,
  isMinimized = false,
  onMinimize,
  onToggleMinimize = onMinimize,
  onOpenEqualizer,
  isEqualizerActive = true,
  isBackgroundPlayEnabled = true,
  onToggleBackgroundPlay,
  onToggleMv,
  showMv = false,
  isMobilePlayerOpen: externalIsMobilePlayerOpen,
  onToggleMobilePlayer,
}) => {
  const [prevVolume, setPrevVolume] = useState(volume || 0.8);
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [customMinutesInput, setCustomMinutesInput] = useState('');
  const [isPrevHovered, setIsPrevHovered] = useState(false);
  const [isNextHovered, setIsNextHovered] = useState(false);
  const [internalIsMobileSheetOpen, setInternalIsMobileSheetOpen] = useState(false);
  const isMobileSheetOpen = externalIsMobilePlayerOpen !== undefined ? externalIsMobilePlayerOpen : internalIsMobileSheetOpen;
  const setIsMobileSheetOpen = (val: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof val === 'function' ? val(isMobileSheetOpen) : val;
    setInternalIsMobileSheetOpen(nextVal);
    onToggleMobilePlayer?.(nextVal);
  };

  const formatTimerRemaining = () => {
    if (sleepTimerMinutes === 0) return getTranslation(language, 'timer.endOfTrack');
    if (sleepTimerRemainingSecs === null || sleepTimerRemainingSecs <= 0) return '';
    const m = Math.floor(sleepTimerRemainingSecs / 60);
    const s = sleepTimerRemainingSecs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleApplyCustomTimer = () => {
    const mins = parseInt(customMinutesInput.trim(), 10);
    if (!isNaN(mins) && mins > 0 && mins <= 720) {
      onSetSleepTimer?.(mins);
      setShowTimerMenu(false);
      setCustomMinutesInput('');
    }
  };

  // Time formatter with strict clamp against YouTube live unix timestamps (>86400s)
  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || secs < 0 || secs > 86400) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleMuteToggle = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      onVolumeChange(0);
    } else {
      onVolumeChange(prevVolume || 0.8);
    }
  };

  // Detect true live broadcast (never for local files or recorded sessions)
  const lowerTitle = currentTrack ? currentTrack.title.toLowerCase() : '';
  const isRecordedSession =
    lowerTitle.includes('live lounge') ||
    lowerTitle.includes('live session') ||
    lowerTitle.includes('live at') ||
    lowerTitle.includes('live in') ||
    lowerTitle.includes('live acoustic') ||
    lowerTitle.includes('live version') ||
    lowerTitle.includes('live performance') ||
    lowerTitle.includes('live cover');

  const isLive = Boolean(
    currentTrack &&
    currentTrack.source === 'youtube' &&
    !isRecordedSession &&
    (
      currentTime > 86400 ||
      (!currentTrack.duration_secs || currentTrack.duration_secs <= 0) ||
      lowerTitle.includes('24/7') ||
      lowerTitle.includes('trực tiếp') ||
      lowerTitle.includes('livestream') ||
      lowerTitle.includes('live stream') ||
      lowerTitle.includes('live radio') ||
      lowerTitle.includes('hip hop radio') ||
      lowerTitle.includes('lofi radio') ||
      lowerTitle.includes('chill radio') ||
      (lowerTitle.includes('radio') && (currentTrack.duration_secs <= 0 || currentTrack.duration_secs > 7200))
    )
  );

  // Effective duration: if duration is 0 or unset, fallback immediately to track metadata duration_secs!
  const effectiveDuration = (duration > 0 && duration < 86400)
    ? duration
    : (currentTrack?.duration_secs && currentTrack.duration_secs > 0 && currentTrack.duration_secs < 86400)
      ? currentTrack.duration_secs
      : 0;

  // Clamp display time: never display epoch timestamps (>86400)
  const safeCurrentTime = currentTime > 86400 ? 0 : currentTime;
  const displayTime = isDragging ? dragValue : safeCurrentTime;
  const isBuffering = !isLive && effectiveDuration <= 0 && isPlaying;
  const safeDuration = effectiveDuration > 0 ? effectiveDuration : 100;
  const progressPercent = (!isLive && effectiveDuration > 0)
    ? Math.min(100, Math.max(0, (displayTime / safeDuration) * 100))
    : 0;

  const handleSeekFromEvent = (
    e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement> | React.PointerEvent<HTMLElement>,
    commit: boolean
  ) => {
    if (safeDuration <= 0) return;
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0) return;

    let clientX = 0;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
    } else if ('changedTouches' in e && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
    } else if ('clientX' in e) {
      clientX = e.clientX;
    } else {
      return;
    }

    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = ratio * safeDuration;

    if (commit) {
      setIsDragging(false);
      setDragValue(targetTime);
      onSeek(targetTime);
    } else {
      setIsDragging(true);
      setDragValue(targetTime);
    }
  };

  const getSourceBadge = (source: string) => {
    if (isLive) {
      return (
        <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded bg-[var(--accent-color, #ff2a55)]/15 text-[var(--accent-color, #ff2a55)] border border-[var(--accent-color, #ff2a55)]/40 inline-flex items-center gap-1.5 font-mono whitespace-nowrap shrink-0">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-color, #ff2a55)] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--accent-color, #ff2a55)]"></span>
          </span>
          <span className="whitespace-nowrap">LIVE</span>
        </span>
      );
    }

    switch (source) {
      case 'youtube': {
        const isClickable = Boolean(onToggleMv);
        return (
          <button
            type="button"
            disabled={!isClickable}
            onClick={onToggleMv}
            title={
              language === 'vi'
                ? showMv
                  ? 'Đang phát Video MV • Nhấn để thu nhỏ'
                  : 'Nguồn YouTube • Nhấn để xem Video MV'
                : showMv
                ? 'Playing Music Video • Click to minimize'
                : 'YouTube Stream • Click to watch Music Video'
            }
            className={`text-[9px] font-bold tracking-wider px-2 py-0.5 rounded inline-flex items-center gap-1.5 font-mono whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              showMv
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.35)] ring-1 ring-rose-500/50 hover:bg-rose-500/30'
                : 'bg-[#16161c] hover:bg-[#202028] text-[#ff4e6b] hover:text-white border border-[#ff4e6b]/40 hover:border-[#ff4e6b] shadow-sm'
            }`}
          >
            {showMv ? (
              <Tv className="w-2.5 h-2.5 text-rose-400 shrink-0 animate-pulse" />
            ) : (
              <YoutubeIcon className="w-2.5 h-2.5 shrink-0" />
            )}
            <span className="whitespace-nowrap">YT STREAM</span>
            {showMv && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse shrink-0" />}
          </button>
        );
      }
      case 'soundcloud':
        return (
          <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded bg-[#16161c] text-orange-400 border border-orange-500/30 inline-flex items-center gap-1.5 font-mono whitespace-nowrap shrink-0">
            <SoundCloudIcon className="w-2.5 h-2.5 shrink-0" />
            <span className="whitespace-nowrap">SOUNDCLOUD</span>
          </span>
        );
      case 'audius':
        return (
          <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded bg-[#16161c] text-white border border-white/20 inline-flex items-center gap-1.5 font-mono whitespace-nowrap shrink-0">
            <AudiusIcon className="w-2.5 h-2.5 text-[var(--accent-color, #ff2a55)] shrink-0" />
            <span className="whitespace-nowrap">AUDIUS 320K</span>
          </span>
        );
      default:
        return (
          <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded bg-[#16161c] text-white border border-white/20 font-mono whitespace-nowrap shrink-0">
            LOSSLESS
          </span>
        );
    }
  };

  if (isMinimized) {
    return (
      <footer 
        onClick={onToggleMinimize}
        className="h-7 bg-[#060608] hover:bg-[#0c0c12] border-t border-[#14141a] px-4 flex items-center justify-between select-none cursor-pointer group/minibar transition-colors z-50 text-xs flex-shrink-0"
      >
        {/* Left: Mini Track Status */}
        <div className="flex items-center gap-2 truncate max-w-[75%]">
          <Disc 
            className={`w-3.5 h-3.5 flex-shrink-0 ${isPlaying ? 'animate-spin' : 'text-[#666]'}`} 
            style={{ color: isPlaying ? accentColor : undefined }} 
          />
          <span className="font-mono text-[11px] text-zinc-300 group-hover/minibar:text-white truncate">
            {currentTrack ? `${currentTrack.title} — ${currentTrack.artist}` : getTranslation(language, 'player.noTrack')}
          </span>
        </div>

        {/* Right: Expand Button */}
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#888899] group-hover/minibar:text-[var(--accent-color,#00E5FF)] transition-colors">
          <span className="hidden sm:inline">{getTranslation(language, 'player.openBar')}</span>
          <ChevronUp className="w-3.5 h-3.5" />
        </div>
      </footer>
    );
  }

  return (
    <>
    <footer className={`bg-[#060608] border-t border-[#14141a] select-none z-50 relative transition-all duration-300 ease-in-out flex-shrink-0 ${
      isCompact ? 'h-[52px] px-2 sm:px-4 flex items-center justify-between' : 'h-22 px-3 sm:px-6 flex items-center justify-between'
    }`}>
      {/* Sleek Top-Edge Progress Bar in Compact Mode */}
      {isCompact && (
        <div
          onClick={(e) => handleSeekFromEvent(e, true)}
          className="absolute top-0 left-0 right-0 h-[3px] hover:h-[6px] transition-all bg-[#181822] cursor-pointer group/compact-seek z-20"
        >
          <div 
            className="h-full transition-all pointer-events-none"
            style={{ 
              width: isLive ? '100%' : `${progressPercent}%`, 
              backgroundColor: accentColor,
              boxShadow: `0 0 8px ${accentColor}`
            }}
          />
          {!isLive && effectiveDuration > 0 && (
            <input
              type="range"
              min={0}
              max={safeDuration}
              step={0.25}
              value={displayTime}
              onMouseDown={() => setIsDragging(true)}
              onTouchStart={() => setIsDragging(true)}
              onChange={(e) => setDragValue(Number(e.target.value))}
              onMouseUp={(e) => {
                setIsDragging(false);
                onSeek(Number((e.target as HTMLInputElement).value));
              }}
              onTouchEnd={(e) => {
                setIsDragging(false);
                onSeek(Number((e.target as HTMLInputElement).value));
              }}
              onClick={(e) => handleSeekFromEvent(e, true)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          )}
        </div>
      )}

      {/* Left: Track Info — Spy Minimalist style */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 flex-1 min-w-0 sm:flex-none sm:max-w-[220px] md:max-w-[260px] xl:w-[26%] xl:max-w-[320px] z-10 overflow-hidden">
        {currentTrack ? (
          <>
            <div
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 640) {
                  setIsMobileSheetOpen(true);
                }
              }}
              className="flex items-center gap-1.5 sm:gap-2.5 flex-1 min-w-0 cursor-pointer sm:cursor-default"
            >
              <div className={`${isCompact ? 'w-8 h-8 rounded-md' : 'w-12 h-12 rounded-lg'} overflow-hidden bg-[#101014] flex-shrink-0 border border-[#202028] relative group shadow-sm transition-all`}>
                {currentTrack.cover_art ? (
                  <img
                    src={optimizeThumbnailUrl(currentTrack.cover_art, currentTrack.path_or_url || currentTrack.id)}
                    alt={currentTrack.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImageError(e, currentTrack.path_or_url || currentTrack.id)}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#101014] text-[#666]">
                    <Music className={`${isCompact ? 'w-3.5 h-3.5' : 'w-5 h-5'} text-[var(--accent-color, #ff2a55)]/70`} />
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-center overflow-hidden pr-1 flex-1 min-w-0">
                <MarqueeText
                  text={currentTrack.title}
                  wrapperClassName="leading-none"
                  className={`${isCompact ? 'text-[11px]' : 'text-xs'} font-bold tracking-tight leading-none block`}
                  style={{ color: themeMode === 'light' ? '#0f172a' : '#ffffff' }}
                />
                <MarqueeText
                  text={currentTrack.artist}
                  wrapperClassName="leading-none -mt-0.5"
                  className={`${isCompact ? 'text-[10px]' : 'text-[11px]'} leading-none block`}
                  style={{ color: themeMode === 'light' ? '#64748b' : '#8e8e9f' }}
                />
              </div>
            </div>
            <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
              <button
                onClick={onToggleFavorite}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  isFavorite ? 'text-[var(--accent-color, #ff2a55)] drop-shadow-[0_0_8px_var(--accent-color, #ff2a55)]' : 'text-[#555] hover:text-white'
                }`}
                title={isFavorite ? getTranslation(language, 'toast.favoriteRemoved') : getTranslation(language, 'toast.favoriteAdded')}
              >
                <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
              </button>

              {onAddToAlbum && (
                <button
                  onClick={onAddToAlbum}
                  title={getTranslation(language, 'player.addToAlbum')}
                  className="hidden sm:flex p-1.5 rounded-full text-[#555] hover:text-[var(--accent-color, #ff2a55)] hover:bg-[#161620] transition-colors cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4" />
                </button>
              )}

              {onDownload && (
                <button
                  onClick={() => onDownload(currentTrack)}
                  disabled={isDownloading || currentTrack.source === 'local' || Boolean(currentTrack.is_downloaded)}
                  title={
                    currentTrack.source === 'local' || currentTrack.is_downloaded
                      ? getTranslation(language, 'download.downloaded')
                      : isDownloading
                      ? getTranslation(language, 'download.downloading')
                      : getTranslation(language, 'download.downloadBtn')
                  }
                  className={`hidden sm:flex p-1.5 rounded-full transition-all cursor-pointer ${
                    currentTrack.source === 'local' || currentTrack.is_downloaded
                      ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                      : isDownloading
                      ? 'text-[var(--accent-color, #ff2a55)] animate-pulse'
                      : 'text-[#555] hover:text-[var(--accent-color, #ff2a55)] hover:bg-[#161620]'
                  }`}
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (currentTrack.source === 'local' || currentTrack.is_downloaded) ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2.5 text-xs text-[#555]">
            <div className={`${isCompact ? 'w-8 h-8 rounded-md' : 'w-12 h-12 rounded-lg'} bg-[#0e0e12] border border-[#181820] flex items-center justify-center flex-shrink-0`}>
              <Music className={`${isCompact ? 'w-3.5 h-3.5' : 'w-5 h-5'} text-[#333]`} />
            </div>
            <span className="text-[11px] truncate">{getTranslation(language, 'player.noTrack')}</span>
          </div>
        )}
      </div>

      {/* Center: Controls + Spy Seekbar — Left-aligned on small screens, Dead Center on xl+ */}
      <div className={`flex items-center justify-center shrink-0 z-20 pointer-events-auto transition-all ml-1 sm:ml-4 xl:ml-0 xl:absolute xl:left-1/2 xl:top-1/2 xl:-translate-x-1/2 xl:-translate-y-1/2 ${
        isCompact 
          ? 'gap-1.5 sm:gap-3.5 whitespace-nowrap' 
          : 'flex-col gap-1.5 w-full max-w-[580px] px-2'
      }`}>
        <div className={`flex items-center ${isCompact ? 'gap-2 sm:gap-3.5' : 'gap-6'}`}>
          <button
            onClick={onToggleShuffle}
            title={getTranslation(language, 'player.shuffle')}
            style={isShuffle ? { color: accentColor, filter: `drop-shadow(0 0 8px ${accentColor}80)` } : undefined}
            className={`hidden sm:inline-flex transition-colors cursor-pointer ${
              isShuffle ? '' : 'text-[#666] hover:text-white'
            }`}
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>

          {/* Prev Button with Previous Song Pop-up */}
          <div 
            className="hidden sm:flex relative group/prev items-center"
            onMouseEnter={() => setIsPrevHovered(true)}
            onMouseLeave={() => setIsPrevHovered(false)}
          >
            <button 
              onClick={onPrev} 
              className="text-[#888] hover:text-white transition-colors cursor-pointer p-1"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            {/* Previous Track Preview Pop-up */}
            <div 
              className={`absolute bottom-full mb-3 left-0 sm:left-1/2 sm:-translate-x-1/2 w-64 p-3 rounded-xl bg-[#0c0c12]/95 backdrop-blur-md border shadow-2xl transition-all duration-200 z-50 flex flex-col gap-2 ${
                isPrevHovered ? 'opacity-100 pointer-events-auto scale-100' : 'opacity-0 pointer-events-none scale-95'
              }`}
              style={{
                borderColor: `${accentColor}40`,
                boxShadow: `0 8px 30px rgba(0,0,0,0.8), 0 0 14px ${accentColor}25`
              }}
            >
              <div className="flex items-center justify-between border-b border-[#1c1c28] pb-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: accentColor }}>
                  <SkipBack className="w-3 h-3 fill-current" />
                  {language === 'vi' ? 'Bài trước đó' : 'Previous Track'}
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#161622] text-[#88889f]">
                  {language === 'vi' ? 'Lịch sử phát' : 'History'}
                </span>
              </div>

              {previousTrack ? (
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#161620] flex-shrink-0 border border-[#222]">
                    {previousTrack.cover_art ? (
                      <img
                        src={optimizeThumbnailUrl(previousTrack.cover_art, previousTrack.path_or_url || previousTrack.id)}
                        alt={previousTrack.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => handleImageError(e, previousTrack.path_or_url || previousTrack.id)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#555]">
                        <Music className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div className="overflow-hidden flex-1">
                    <p className="text-xs font-bold text-white truncate" title={previousTrack.title}>
                      {previousTrack.title}
                    </p>
                    <p className="text-[10px] text-[#8e8e9f] truncate">
                      {previousTrack.artist}
                    </p>
                  </div>
                  <button
                    onClick={onPrev}
                    style={{ backgroundColor: accentColor, color: getContrastTextColor(accentColor) }}
                    className="p-1.5 rounded-lg text-white hover:scale-105 transition-transform flex-shrink-0 cursor-pointer"
                    title={language === 'vi' ? 'Phát bài này' : 'Play this track'}
                  >
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-white">
                    {language === 'vi' ? 'Đầu danh sách phát' : 'Start of Playlist'}
                  </p>
                  <p className="text-[11px] text-[#8e8e9f]">
                    {language === 'vi' ? 'Bấm để phát lại từ đầu bài hiện tại' : 'Click to replay current track from start'}
                  </p>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onTogglePlay}
            disabled={!currentTrack}
            title={isPlaying ? getTranslation(language, 'player.pause') : getTranslation(language, 'player.play')}
            style={{
              backgroundColor: currentTrack ? accentColor : (themeMode === 'light' ? '#e2e8f0' : '#1c1c24'),
              color: currentTrack ? getContrastTextColor(accentColor) : (themeMode === 'light' ? '#64748b' : '#64748b'),
              boxShadow: currentTrack ? `0 0 16px ${accentColor}50` : (themeMode === 'light' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'),
              borderColor: currentTrack ? 'transparent' : (themeMode === 'light' ? '#cbd5e1' : '#2a2a38'),
            }}
            className={`${isCompact ? 'w-8 h-8' : 'w-10 h-10'} rounded-full flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:cursor-not-allowed border`}
          >
            {isPlaying ? (
              <Pause className={`${isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'} fill-current`} />
            ) : (
              <Play className={`${isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'} fill-current ml-0.5`} />
            )}
          </button>

          {/* Next Button with Upcoming Song Pop-up */}
          <div 
            className="relative group/next flex items-center"
            onMouseEnter={() => setIsNextHovered(true)}
            onMouseLeave={() => setIsNextHovered(false)}
          >
            <button 
              onClick={onNext} 
              className="text-[#888] hover:text-white transition-colors cursor-pointer p-1"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>

            {/* Next Track Preview Pop-up */}
            <div 
              className={`absolute bottom-full mb-3 left-0 sm:left-1/2 sm:-translate-x-1/2 w-64 p-3 rounded-xl bg-[#0c0c12]/95 backdrop-blur-md border shadow-2xl transition-all duration-200 z-50 flex flex-col gap-2 ${
                isNextHovered ? 'opacity-100 pointer-events-auto scale-100' : 'opacity-0 pointer-events-none scale-95'
              }`}
              style={{
                borderColor: `${accentColor}40`,
                boxShadow: `0 8px 30px rgba(0,0,0,0.8), 0 0 14px ${accentColor}25`
              }}
            >
              <div className="flex items-center justify-between border-b border-[#1c1c28] pb-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: accentColor }}>
                  <SkipForward className="w-3 h-3 fill-current" />
                  {getTranslation(language, 'popup.nextTrack')}
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#161622] text-[#88889f] truncate max-w-[120px]">
                  {upcomingModeLabel || (recommendMode === 'fresh' ? getTranslation(language, 'player.modeFresh') : recommendMode === 'mix' ? getTranslation(language, 'player.modeRecommend') : getTranslation(language, 'player.modeDefault'))}
                </span>
              </div>

              {upcomingTrack ? (
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#161620] flex-shrink-0 border border-[#222]">
                    {upcomingTrack.cover_art ? (
                      <img
                        src={optimizeThumbnailUrl(upcomingTrack.cover_art, upcomingTrack.path_or_url || upcomingTrack.id)}
                        alt={upcomingTrack.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => handleImageError(e, upcomingTrack.path_or_url || upcomingTrack.id)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#555]">
                        <Music className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div className="overflow-hidden flex-1">
                    <p className="text-xs font-bold text-white truncate" title={upcomingTrack.title}>
                      {upcomingTrack.title}
                    </p>
                    <p className="text-[10px] text-[#8e8e9f] truncate">
                      {upcomingTrack.artist}
                    </p>
                  </div>
                  <button
                    onClick={onNext}
                    style={{ backgroundColor: accentColor, color: getContrastTextColor(accentColor) }}
                    className="p-1.5 rounded-lg text-white hover:scale-105 transition-transform flex-shrink-0 cursor-pointer"
                    title={getTranslation(language, 'popup.playNow')}
                  >
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-white">{getTranslation(language, 'toast.newDiscovery')}</p>
                  <p className="text-[10px] text-[#8e8e9f] leading-snug">
                    {getTranslation(language, 'toast.findingNewTracks')}
                  </p>
                  <button
                    onClick={onNext}
                    style={{ backgroundColor: accentColor, color: getContrastTextColor(accentColor) }}
                    className="w-full mt-1 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-transform active:scale-95 cursor-pointer"
                  >
                    {getTranslation(language, 'player.next')}
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onToggleRepeat}
            title={repeatMode === 'all' ? getTranslation(language, 'player.repeatAll') : repeatMode === 'one' ? getTranslation(language, 'player.repeatOne') : getTranslation(language, 'player.repeatOff')}
            style={repeatMode !== 'off' ? { color: accentColor } : undefined}
            className={`hidden sm:flex transition-colors cursor-pointer relative items-center justify-center ${
              repeatMode !== 'off' ? '' : 'text-[#666] hover:text-white'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            {repeatMode === 'one' && (
              <span 
                className="absolute -top-1.5 -right-1.5 text-[8px] font-black font-mono rounded-full px-1 leading-tight"
                style={{ backgroundColor: accentColor, color: getContrastTextColor(accentColor) }}
              >
                1
              </span>
            )}
          </button>

          {/* AI Auto-Recommend Next Track (Endless Radio) */}
          {(onCycleRecommendMode || onToggleAutoRecommend) && (
            <button
              onClick={onCycleRecommendMode || onToggleAutoRecommend}
              title={
                recommendMode === 'fresh'
                  ? '🌟 ' + getTranslation(language, 'player.modeFresh')
                  : recommendMode === 'mix'
                  ? '🎵 ' + getTranslation(language, 'player.modeRecommend')
                  : '⏹ ' + getTranslation(language, 'player.repeatOff')
              }
              className={`hidden sm:flex px-2 py-1 rounded-lg transition-all cursor-pointer relative items-center gap-1.5 border font-mono text-[10px] font-bold ${
                recommendMode === 'fresh'
                  ? 'shadow-sm'
                  : recommendMode === 'mix'
                  ? 'shadow-sm'
                  : 'text-[#666] hover:text-white border-transparent'
              }`}
              style={{
                color: recommendMode !== 'off' ? accentColor : undefined,
                backgroundColor: recommendMode === 'fresh' ? `${accentColor}20` : recommendMode === 'mix' ? `${accentColor}10` : 'transparent',
                borderColor: recommendMode !== 'off' ? `${accentColor}40` : 'transparent',
              }}
            >
              {recommendMode === 'fresh' ? (
                <>
                  <Radio className="w-3.5 h-3.5" />
                  <span className="leading-none">{getTranslation(language, 'player.modeFresh').split(' ')[0]}</span>
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span 
                      className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                      style={{ backgroundColor: accentColor }}
                    />
                    <span 
                      className="relative inline-flex rounded-full h-2 w-2"
                      style={{ backgroundColor: accentColor }}
                    />
                  </span>
                </>
              ) : recommendMode === 'mix' ? (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="leading-none">MIX</span>
                </>
              ) : (
                <>
                  <Radio className="w-3.5 h-3.5 opacity-50" />
                </>
              )}
            </button>
          )}
        </div>

        {/* Compact Mode Inline Time Display */}
        {isCompact && (
          <div className="hidden lg:flex items-center gap-1 font-mono text-[10px] text-[#8e8e9f] select-none pl-1 shrink-0 whitespace-nowrap">
            <span className="font-semibold text-white/90">{formatTime(displayTime)}</span>
            <span className="text-[#555]">/</span>
            <span>{isLive ? 'LIVE' : formatTime(effectiveDuration)}</span>
          </div>
        )}

        {/* Seekbar Area — Adapts to Live Stream, Buffering, or Regular Track (standard mode) */}
        {!isCompact && (
          isLive ? (
            <div className="w-full flex items-center gap-3 text-xs font-mono">
              <span className="w-10 text-right font-semibold" style={{ color: accentColor }}>{formatTime(safeCurrentTime)}</span>
              <div 
                className="relative flex-1 h-[4px] rounded-full overflow-hidden flex items-center border border-black/5"
                style={{ backgroundColor: themeMode === 'light' ? '#cbd5e1' : '#1f1f28' }}
              >
                <div 
                  className="h-full w-full rounded-full animate-pulse opacity-90" 
                  style={{ background: `linear-gradient(to right, ${accentColor}, #ffffff, ${accentColor})` }}
                />
              </div>
              <div 
                className="flex items-center gap-1.5 px-2 py-0.5 rounded font-bold text-[9px] uppercase tracking-wider flex-shrink-0 border"
                style={{ 
                  backgroundColor: `${accentColor}20`, 
                  borderColor: `${accentColor}50`, 
                  color: accentColor 
                }}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: accentColor }}></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: accentColor }}></span>
                </span>
                <span>LIVE</span>
              </div>
            </div>
          ) : isBuffering ? (
            <div className="w-full flex items-center gap-3 text-[11px] font-mono">
              <span className="w-9 text-right font-bold" style={{ color: themeMode === 'light' ? '#0f172a' : '#ffffff' }}>
                {formatTime(safeCurrentTime)}
              </span>
              <div 
                className="relative flex-1 h-[4px] rounded-full overflow-hidden border border-black/5"
                style={{ backgroundColor: themeMode === 'light' ? '#cbd5e1' : '#1f1f28' }}
              >
                <div 
                  className="h-full rounded-full animate-pulse w-full opacity-75" 
                  style={{ background: `linear-gradient(to right, ${accentColor}, #ffffff)` }}
                />
              </div>
              <span className="w-12 text-[10px] truncate" style={{ color: themeMode === 'light' ? '#64748b' : '#888899' }}>{getTranslation(language, 'search.loading')}</span>
            </div>
          ) : (
            <div className="w-full flex items-center gap-3 text-[11px] font-mono">
              <span className="w-9 text-right font-bold text-xs" style={{ color: themeMode === 'light' ? '#0f172a' : '#ffffff' }}>
                {formatTime(displayTime)}
              </span>
              <div
                className="relative flex-1 flex items-center group h-4 cursor-pointer"
                onClick={(e) => handleSeekFromEvent(e, true)}
              >
                {/* Background track */}
                <div 
                  className="absolute w-full h-[4px] rounded-full group-hover:h-[6px] transition-all overflow-hidden border border-black/5"
                  style={{ backgroundColor: themeMode === 'light' ? '#cbd5e1' : '#1f1f28' }}
                >
                  {/* Progress fill */}
                  <div
                    className="h-full transition-all rounded-full"
                    style={{ width: `${progressPercent}%`, backgroundColor: accentColor }}
                  />
                </div>

                {/* Thumb handle on hover */}
                <div
                  className="absolute w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none -translate-x-1/2 shadow-md border-2 border-white"
                  style={{ left: `${progressPercent}%`, backgroundColor: accentColor, boxShadow: `0 0 10px ${accentColor}` }}
                />

                {/* Range input */}
                <input
                  type="range"
                  min={0}
                  max={safeDuration}
                  step={0.25}
                  value={displayTime}
                  onMouseDown={(e) => {
                    setIsDragging(true);
                    setDragValue(Number((e.target as HTMLInputElement).value));
                  }}
                  onTouchStart={(e) => {
                    setIsDragging(true);
                    setDragValue(Number((e.target as HTMLInputElement).value));
                  }}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setDragValue(v);
                  }}
                  onMouseUp={(e) => {
                    const v = Number((e.target as HTMLInputElement).value);
                    setIsDragging(false);
                    onSeek(v);
                  }}
                  onTouchEnd={(e) => {
                    const v = Number((e.target as HTMLInputElement).value);
                    setIsDragging(false);
                    onSeek(v);
                  }}
                  onPointerUp={(e) => {
                    const v = Number((e.target as HTMLInputElement).value);
                    if (isDragging) {
                      setIsDragging(false);
                      onSeek(v);
                    }
                  }}
                  onBlur={() => {
                    if (isDragging) {
                      setIsDragging(false);
                    }
                  }}
                  className="absolute w-full opacity-0 h-full cursor-pointer z-10"
                />
              </div>
              <span className="w-9 font-mono text-xs" style={{ color: themeMode === 'light' ? '#64748b' : '#8e8e9f' }}>
                {formatTime(effectiveDuration)}
              </span>
            </div>
          )
        )}
      </div>

      {/* Right: Volume + Utils */}
      <div className={`flex items-center justify-end shrink-0 ml-1 sm:ml-auto z-10 xl:w-[26%] xl:max-w-[360px] ${isCompact ? 'gap-1 sm:gap-2.5' : 'gap-2 sm:gap-3.5'}`}>
        {/* Mobile Expand Full-Screen Player Sheet Button */}
        <button
          type="button"
          onClick={() => setIsMobileSheetOpen(true)}
          title={getTranslation(language, 'player.openBar')}
          className="sm:hidden p-1.5 rounded-lg text-[#888] hover:text-white hover:bg-[#161622] transition-colors cursor-pointer flex items-center justify-center shrink-0"
        >
          <ChevronUp className="w-4 h-4" />
        </button>

        {/* Desktop Utils Group */}
        <div className={`hidden sm:flex items-center ${isCompact ? 'gap-1.5 sm:gap-2.5' : 'gap-2 sm:gap-3.5'}`}>
        {/* Next Track Preview / Auto Suggestion Toggle */}
        {onToggleNextTrackPopupEnabled && (
          <button
            onClick={onToggleNextTrackPopupEnabled}
            title={
              isNextTrackPopupEnabled
                ? getTranslation(language, 'popup.disableAuto')
                : getTranslation(language, 'popup.enableAuto')
            }
            style={isNextTrackPopupEnabled ? {
              color: accentColor,
              backgroundColor: `${accentColor}18`,
              borderColor: `${accentColor}50`,
              boxShadow: `0 0 10px ${accentColor}30`,
            } : undefined}
            className={`p-1.5 rounded-md transition-all cursor-pointer border flex items-center justify-center shrink-0 ${
              isNextTrackPopupEnabled
                ? ''
                : 'text-[#666] hover:text-white border-transparent'
            }`}
          >
            {isNextTrackPopupEnabled ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4 opacity-50" />
            )}
          </button>
        )}

        {/* Sleep Timer Toggle & Menu */}
        {onSetSleepTimer && (
          <div className="relative shrink-0">
            <button
              onClick={() => setShowTimerMenu(p => !p)}
              title={getTranslation(language, 'timer.title')}
              style={sleepTimerMinutes !== null ? {
                color: accentColor,
                backgroundColor: `${accentColor}18`,
                borderColor: `${accentColor}50`,
                boxShadow: `0 0 10px ${accentColor}30`,
              } : undefined}
              className={`p-1.5 rounded-md transition-all cursor-pointer border flex items-center gap-1.5 shrink-0 ${
                sleepTimerMinutes !== null
                  ? ''
                  : 'text-[#666] hover:text-white border-transparent'
              }`}
            >
              <Moon className="w-4 h-4" />
              {sleepTimerMinutes !== null && (
                <span className="text-[10px] font-mono font-bold">
                  {formatTimerRemaining()}
                </span>
              )}
            </button>

            {/* Popup Menu */}
            {showTimerMenu && (
              <div 
                className="absolute bottom-12 right-0 w-52 p-2.5 rounded-xl bg-[#0c0c12] border border-[#22222e] shadow-2xl z-50 select-none"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1c1c28]">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                    <Moon className="w-3.5 h-3.5" style={{ color: accentColor }} />
                    {getTranslation(language, 'timer.title')}
                  </span>
                  {sleepTimerMinutes !== null && (
                    <span className="text-[10px] font-mono font-bold" style={{ color: accentColor }}>
                      {formatTimerRemaining()}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {[15, 30, 45, 60].map((mins) => {
                    const isSelected = sleepTimerMinutes === mins;
                    return (
                      <button
                        key={mins}
                        onClick={() => {
                          onSetSleepTimer(mins);
                          setShowTimerMenu(false);
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-left flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected ? 'bg-white/10 text-white font-bold' : 'text-[#888] hover:text-white hover:bg-[#161622]'
                        }`}
                      >
                        <span>{getTranslation(language, `timer.${mins}m` as any)}</span>
                        {isSelected && <Check className="w-3.5 h-3.5" style={{ color: accentColor }} />}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => {
                      onSetSleepTimer(0);
                      setShowTimerMenu(false);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-left flex items-center justify-between transition-colors cursor-pointer ${
                      sleepTimerMinutes === 0 ? 'bg-white/10 text-white font-bold' : 'text-[#888] hover:text-white hover:bg-[#161622]'
                    }`}
                  >
                    <span>{getTranslation(language, 'timer.endOfTrack')}</span>
                    {sleepTimerMinutes === 0 && <Check className="w-3.5 h-3.5" style={{ color: accentColor }} />}
                  </button>

                  {/* Active Custom Option if not in presets */}
                  {sleepTimerMinutes !== null && ![0, 15, 30, 45, 60].includes(sleepTimerMinutes) && (
                    <div className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold text-left flex items-center justify-between bg-white/10 text-white">
                      <span>{getTranslation(language, 'timer.custom')}: {sleepTimerMinutes} {getTranslation(language, 'timer.minutes')}</span>
                      <Check className="w-3.5 h-3.5" style={{ color: accentColor }} />
                    </div>
                  )}

                  {/* Custom minutes input */}
                  <div className="pt-2 mt-1 border-t border-[#1c1c28]">
                    <div className="text-[11px] text-[#888] font-medium mb-1.5 px-0.5 flex items-center justify-between">
                      <span>{getTranslation(language, 'timer.custom')}</span>
                      <span className="text-[10px] text-[#666]">1 - 720 {getTranslation(language, 'timer.minutes')}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Stepper container */}
                      <div className="flex-1 flex items-center bg-[#151520] rounded-lg border border-[#2a2a3e] px-1 py-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            const cur = parseInt(customMinutesInput, 10) || 15;
                            const next = Math.max(1, cur > 5 ? cur - 5 : 1);
                            setCustomMinutesInput(next.toString());
                          }}
                          className="w-6 h-6 flex items-center justify-center text-[#888] hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                          title="-5 phút"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <div className="flex-1 flex items-center justify-center gap-0.5">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="30"
                            value={customMinutesInput}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setCustomMinutesInput(val);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleApplyCustomTimer();
                              }
                            }}
                            className="w-10 bg-transparent text-center text-white text-xs font-mono font-bold focus:outline-none"
                          />
                          <span className="text-[10px] text-[#777] font-mono select-none">
                            {getTranslation(language, 'timer.minutes')}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const cur = parseInt(customMinutesInput, 10) || 0;
                            const next = Math.min(720, cur + 5);
                            setCustomMinutesInput(next.toString());
                          }}
                          className="w-6 h-6 flex items-center justify-center text-[#888] hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                          title="+5 phút"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleApplyCustomTimer}
                        disabled={!customMinutesInput || parseInt(customMinutesInput, 10) <= 0}
                        style={{
                          backgroundColor: accentColor,
                          color: '#fff',
                        }}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-md"
                      >
                        {getTranslation(language, 'timer.set')}
                      </button>
                    </div>
                  </div>

                  {sleepTimerMinutes !== null && (
                    <div className="pt-1.5 mt-1 border-t border-[#1c1c28]">
                      <button
                        onClick={() => {
                          onSetSleepTimer(null);
                          setShowTimerMenu(false);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 text-left transition-colors cursor-pointer"
                      >
                        {getTranslation(language, 'timer.turnOff')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Unified Audio Settings (Equalizer, Crossfade & Visualizer) */}
        {onOpenEqualizer && (
          <button
            onClick={onOpenEqualizer}
            title={language === 'vi' ? 'Cài đặt âm thanh (EQ, Crossfade, Sóng nhạc)' : 'Audio Settings (EQ, Crossfade, Visualizer)'}
            style={(isEqualizerActive || crossfadeDuration > 0 || showVisualizer) ? {
              color: accentColor,
              backgroundColor: `${accentColor}18`,
              borderColor: `${accentColor}50`,
              boxShadow: `0 0 10px ${accentColor}30`,
            } : undefined}
            className={`p-1.5 rounded-md transition-all cursor-pointer border flex items-center gap-1.5 relative shrink-0 ${
              (isEqualizerActive || crossfadeDuration > 0 || showVisualizer)
                ? ''
                : 'text-[#666] hover:text-white border-transparent'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {crossfadeDuration > 0 && (
              <span className="text-[10px] font-mono font-bold leading-none">
                {crossfadeDuration}s
              </span>
            )}
            {showVisualizer && (
              <span 
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: accentColor }}
              />
            )}
          </button>
        )}

        {/* Source Badge (Clicking YT STREAM toggles Desktop MV) */}
        {currentTrack && (
          <div className="hidden md:inline-flex shrink-0">
            {getSourceBadge(currentTrack.source)}
          </div>
        )}

        {/* Volume Slider */}
        {(() => {
          const safeVolume = Math.max(0, Math.min(1, typeof volume === 'number' && !isNaN(volume) ? volume : 0.8));
          return (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleMuteToggle}
                title={safeVolume === 0 ? 'Bật âm lượng' : 'Tắt tiếng'}
                className="text-[#777] hover:text-white transition-colors cursor-pointer shrink-0"
              >
                {safeVolume === 0 ? <VolumeX className="w-4 h-4" style={{ color: accentColor }} /> : <Volume2 className="w-4 h-4" />}
              </button>
              <div
                title={`Âm lượng: ${Math.round(safeVolume * 100)}%`}
                onWheel={(e) => {
                  e.preventDefault();
                  const step = e.deltaY < 0 ? 0.05 : -0.05;
                  const next = Math.max(0, Math.min(1, Math.round((safeVolume + step) * 100) / 100));
                  onVolumeChange(next);
                }}
                className={`relative hidden sm:flex items-center ${isCompact ? 'w-14 sm:w-16' : 'w-20'} h-4 group cursor-pointer transition-all`}
              >
                <div 
                  className="absolute w-full h-[4px] rounded-full group-hover:h-[6px] transition-all overflow-hidden border border-black/5"
                  style={{ backgroundColor: themeMode === 'light' ? '#cbd5e1' : '#1f1f28' }}
                >
                  <div 
                    className="h-full transition-colors rounded-full" 
                    style={{ width: `${safeVolume * 100}%`, backgroundColor: accentColor }} 
                  />
                </div>
                {/* Thumb handle on hover */}
                <div
                  className="absolute w-2.5 h-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none -translate-x-1/2 shadow-md border border-white"
                  style={{ left: `${safeVolume * 100}%`, backgroundColor: accentColor, boxShadow: `0 0 6px ${accentColor}` }}
                />
                <input
                  type="range" min={0} max={1} step={0.01} value={safeVolume}
                  onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                  className="absolute w-full opacity-0 h-full cursor-pointer"
                />
              </div>
            </div>
          );
        })()}

        {/* Minimize Button in any view */}
        {(onToggleMinimize || onMinimize) && (
          <button
            onClick={onToggleMinimize || onMinimize}
            title={getTranslation(language, 'player.minimizeBar')}
            className="p-1.5 rounded-lg text-[#777] hover:text-white hover:bg-[#161622] transition-colors cursor-pointer flex items-center justify-center ml-1 shrink-0"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        )}
        </div>
      </div>
    </footer>

    {/* Mobile Full-Screen Now Playing Sheet */}
    {isMobileSheetOpen && (
      <div
        className={`sm:hidden fixed inset-0 z-[90] flex flex-col justify-between p-5 pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-[calc(env(safe-area-inset-bottom,0px)+20px)] overflow-y-auto ${
          themeMode === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-[#07080d] text-white'
        }`}
      >
        {/* Sheet Header */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsMobileSheetOpen(false)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 cursor-pointer"
            aria-label="Close"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest" style={{ color: accentColor }}>
              NOW PLAYING
            </span>
            <div className="mt-0.5">{currentTrack ? getSourceBadge(currentTrack.source) : null}</div>
          </div>
          {onOpenEqualizer ? (
            <button
              type="button"
              onClick={() => {
                setIsMobileSheetOpen(false);
                onOpenEqualizer();
              }}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 cursor-pointer"
              title="EQ"
            >
              <SlidersHorizontal className="w-4 h-4" style={isEqualizerActive ? { color: accentColor } : undefined} />
            </button>
          ) : (
            <div className="w-9" />
          )}
        </div>

        {/* Cover Art & Mobile MV Slot */}
        <div className="my-auto py-2 flex flex-col items-center justify-center gap-3">
          <div
            id="mobile-cover-art-slot"
            className={`${
              showMv && currentTrack?.source === 'youtube'
                ? 'w-full max-w-[92vw] aspect-video'
                : 'w-64 h-64 max-w-[72vw] max-h-[72vw]'
            } rounded-3xl overflow-hidden border border-white/15 shadow-2xl bg-black flex items-center justify-center transition-all duration-300 relative`}
            style={{ boxShadow: `0 20px 50px rgba(0,0,0,0.7), 0 0 30px ${accentColor}30` }}
          >
            {currentTrack?.cover_art ? (
              <img
                src={optimizeThumbnailUrl(currentTrack.cover_art, currentTrack.path_or_url || currentTrack.id)}
                alt={currentTrack.title}
                referrerPolicy="no-referrer"
                onError={(e) => handleImageError(e, currentTrack.path_or_url || currentTrack.id)}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  showMv && currentTrack?.source === 'youtube' ? 'opacity-0' : 'opacity-100'
                }`}
              />
            ) : (
              <Music className={`w-16 h-16 text-zinc-600 transition-opacity duration-300 ${
                showMv && currentTrack?.source === 'youtube' ? 'opacity-0' : 'opacity-100'
              }`} />
            )}
          </div>

          {/* Option: Toggle between Cover Art & YouTube MV */}
          {currentTrack?.source === 'youtube' && onToggleMv && (
            <div className="inline-flex items-center p-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-md z-10 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  if (showMv) onToggleMv();
                }}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  !showMv
                    ? 'bg-white text-zinc-900 shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                <span>{language === 'vi' ? 'Ảnh bìa' : 'Artwork'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!showMv) onToggleMv();
                }}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  showMv
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                <span>{language === 'vi' ? 'Video MV' : 'Music Video'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Title, Favorite & Actions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold truncate">
                {currentTrack ? currentTrack.title : getTranslation(language, 'player.noTrack')}
              </h2>
              <p className="text-xs text-zinc-400 truncate mt-0.5">
                {currentTrack ? currentTrack.artist : 'Spytify Hi-Fi'}
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleFavorite}
              className="p-2 rounded-full cursor-pointer flex-shrink-0"
              style={isFavorite ? { color: accentColor } : undefined}
            >
              <Heart className={`w-6 h-6 ${isFavorite ? 'fill-current' : 'text-zinc-400'}`} />
            </button>
          </div>

          {/* Seekbar */}
          <div className="space-y-1.5">
            {isLive ? (
              <div className="flex items-center justify-between text-xs font-mono">
                <span>{formatTime(safeCurrentTime)}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ color: accentColor, backgroundColor: `${accentColor}20` }}>
                  LIVE
                </span>
              </div>
            ) : (
              <>
                <div
                  className="relative flex items-center h-8 cursor-pointer touch-none select-none py-2"
                  onPointerDown={(e) => {
                    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch {}
                    handleSeekFromEvent(e, false);
                  }}
                  onPointerMove={(e) => {
                    if (isDragging || e.buttons === 1) {
                      handleSeekFromEvent(e, false);
                    }
                  }}
                  onPointerUp={(e) => {
                    handleSeekFromEvent(e, true);
                  }}
                  onPointerCancel={() => {
                    setIsDragging(false);
                  }}
                  onClick={(e) => {
                    handleSeekFromEvent(e, true);
                  }}
                >
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden pointer-events-none relative">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${progressPercent}%`, backgroundColor: accentColor }}
                    />
                  </div>
                  {/* Thumb handle */}
                  <div
                    className="absolute w-4 h-4 rounded-full bg-white shadow-lg pointer-events-none transition-transform -translate-x-1/2"
                    style={{
                      left: `${progressPercent}%`,
                      transform: `translateX(-50%) scale(${isDragging ? 1.3 : 1})`,
                      boxShadow: `0 0 12px ${accentColor}80`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                  <span>{formatTime(displayTime)}</span>
                  <span>{formatTime(effectiveDuration)}</span>
                </div>
              </>
            )}
          </div>

          {/* Main Transport Controls */}
          <div className="flex items-center justify-between px-2">
            <button
              type="button"
              onClick={onToggleShuffle}
              className={`p-2 cursor-pointer ${isShuffle ? '' : 'text-zinc-500'}`}
              style={isShuffle ? { color: accentColor } : undefined}
            >
              <Shuffle className="w-5 h-5" />
            </button>
            <button type="button" onClick={onPrev} className="p-2 text-white cursor-pointer">
              <SkipBack className="w-6 h-6 fill-current" />
            </button>
            <button
              type="button"
              onClick={onTogglePlay}
              disabled={!currentTrack}
              style={{
                backgroundColor: currentTrack ? accentColor : '#27272a',
                color: currentTrack ? getContrastTextColor(accentColor) : '#71717a',
                boxShadow: currentTrack ? `0 0 24px ${accentColor}60` : 'none',
              }}
              className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-transform cursor-pointer"
            >
              {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-0.5" />}
            </button>
            <button type="button" onClick={onNext} className="p-2 text-white cursor-pointer">
              <SkipForward className="w-6 h-6 fill-current" />
            </button>
            <button
              type="button"
              onClick={onToggleRepeat}
              className={`p-2 relative cursor-pointer ${repeatMode !== 'off' ? '' : 'text-zinc-500'}`}
              style={repeatMode !== 'off' ? { color: accentColor } : undefined}
            >
              <Repeat className="w-5 h-5" />
              {repeatMode === 'one' && (
                <span className="absolute top-1 right-1 text-[8px] font-black font-mono rounded-full px-1" style={{ backgroundColor: accentColor, color: getContrastTextColor(accentColor) }}>
                  1
                </span>
              )}
            </button>
          </div>

          {/* Volume Slider */}
          <div className="flex items-center gap-3 px-2">
            <button type="button" onClick={handleMuteToggle} className="text-zinc-400 cursor-pointer">
              {volume === 0 ? <VolumeX className="w-4 h-4" style={{ color: accentColor }} /> : <Volume2 className="w-4 h-4" />}
            </button>
            <div className="relative flex-1 h-4 flex items-center">
              <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, volume)) * 100}%`, backgroundColor: accentColor }} />
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={Math.max(0, Math.min(1, volume))}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>

          {/* Secondary Utility Row */}
          <div className="flex items-center justify-around pt-2 border-t border-white/10 text-xs">
            {(onCycleRecommendMode || onToggleAutoRecommend) && (
              <button
                type="button"
                onClick={onCycleRecommendMode || onToggleAutoRecommend}
                className="flex flex-col items-center gap-1 p-2 rounded-xl text-zinc-400 cursor-pointer"
                style={recommendMode !== 'off' ? { color: accentColor } : undefined}
              >
                <Radio className="w-4 h-4" />
                <span className="text-[10px] font-mono uppercase">{recommendMode}</span>
              </button>
            )}
            {onAddToAlbum && (
              <button
                type="button"
                onClick={() => {
                  setIsMobileSheetOpen(false);
                  onAddToAlbum();
                }}
                className="flex flex-col items-center gap-1 p-2 rounded-xl text-zinc-400 cursor-pointer"
              >
                <FolderPlus className="w-4 h-4" />
                <span className="text-[10px]">Album</span>
              </button>
            )}
            {onToggleBackgroundPlay && (
              <button
                type="button"
                onClick={onToggleBackgroundPlay}
                className="flex flex-col items-center gap-1 p-2 rounded-xl text-zinc-400 cursor-pointer"
                style={isBackgroundPlayEnabled ? { color: accentColor } : undefined}
              >
                <Headphones className="w-4 h-4" />
                <span className="text-[10px] font-mono">
                  {language === 'vi'
                    ? isBackgroundPlayEnabled
                      ? 'Nền: BẬT'
                      : 'Nền: TẮT'
                    : isBackgroundPlayEnabled
                    ? 'BG: ON'
                    : 'BG: OFF'}
                </span>
              </button>
            )}
            {onDownload && currentTrack && (
              <button
                type="button"
                onClick={() => onDownload(currentTrack)}
                disabled={isDownloading || currentTrack.source === 'local' || Boolean(currentTrack.is_downloaded)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl cursor-pointer ${
                  currentTrack.source === 'local' || currentTrack.is_downloaded
                    ? 'text-emerald-400'
                    : isDownloading
                    ? 'text-white animate-pulse'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: accentColor }} />
                ) : currentTrack.source === 'local' || currentTrack.is_downloaded ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span className="text-[10px]">
                  {language === 'vi'
                    ? currentTrack.source === 'local' || currentTrack.is_downloaded
                      ? 'Đã tải'
                      : isDownloading
                      ? 'Đang tải...'
                      : 'Tải về'
                    : currentTrack.source === 'local' || currentTrack.is_downloaded
                    ? 'Saved'
                    : isDownloading
                    ? 'Saving...'
                    : 'Download'}
                </span>
              </button>
            )}
            {onSetSleepTimer && (
              <button
                type="button"
                onClick={() => onSetSleepTimer(sleepTimerMinutes === null ? 30 : null)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl text-zinc-400 cursor-pointer"
                style={sleepTimerMinutes !== null ? { color: accentColor } : undefined}
              >
                <Moon className="w-4 h-4" />
                <span className="text-[10px]">{sleepTimerMinutes !== null ? formatTimerRemaining() || `${sleepTimerMinutes}m` : 'Timer'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
};
