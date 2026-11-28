import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Maximize2, X, Music, Volume2, Volume1, VolumeX } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Track } from '../types';
import { optimizeThumbnailUrl, handleImageError } from '../utils/trackUtils';

function formatTime(secs: number): string {
  if (isNaN(secs) || secs < 0) return '0:00';
  const mins = Math.floor(secs / 60);
  const remainingSecs = Math.floor(secs % 60);
  return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
}

const HoverMarqueeText: React.FC<{
  text: string;
  className?: string;
  title?: string;
}> = ({ text, className = '', title }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [offset, setOffset] = useState(0);

  const checkOverflow = useCallback(() => {
    if (containerRef.current && textRef.current) {
      const containerW = containerRef.current.clientWidth;
      const textW = textRef.current.scrollWidth;
      const diff = textW - containerW;
      const newOffset = diff > 2 ? Math.ceil(diff + 20) : 0;
      setOffset(newOffset);
    }
  }, []);

  useEffect(() => {
    checkOverflow();
    const t1 = setTimeout(checkOverflow, 80);
    const t2 = setTimeout(checkOverflow, 250);
    const t3 = setTimeout(checkOverflow, 600);

    if (typeof document !== 'undefined' && (document as any).fonts) {
      (document as any).fonts.ready.then(checkOverflow);
    }

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(() => checkOverflow());
      ro.observe(containerRef.current);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      ro?.disconnect();
    };
  }, [text, checkOverflow]);

  const animDuration = Math.max(3.2, (offset / 30) * 1.6);

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => {
        checkOverflow();
        setIsHovered(true);
      }}
      onMouseLeave={() => setIsHovered(false)}
      className={`spytify-marquee-container ${offset > 0 ? 'is-overflowing' : ''} overflow-hidden whitespace-nowrap max-w-full relative group/marquee cursor-pointer no-drag`}
      style={{
        WebkitAppRegion: 'no-drag',
        '--marquee-offset': `-${offset}px`,
        '--marquee-duration': `${animDuration.toFixed(2)}s`,
      } as any}
      title={title || text}
    >
      <span
        ref={textRef}
        className={`spytify-marquee-content inline-block whitespace-nowrap ${offset > 0 ? '' : 'truncate max-w-full'} ${className}`}
        style={
          isHovered && offset > 0
            ? ({
                animation: `marquee-ping-pong ${animDuration.toFixed(2)}s cubic-bezier(0.4, 0, 0.2, 1) infinite`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {text}
      </span>
    </div>
  );
};

interface DesktopMiniBarProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration?: number;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek?: (time: number) => void;
  onRestoreFull: () => void;
  onClose?: () => void;
  accentColor?: string;
  volume?: number;
  onVolumeChange?: (v: number) => void;
}

export const DesktopMiniBar: React.FC<DesktopMiniBarProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onRestoreFull,
  onClose,
  accentColor = '#ff2a55',
  volume = 0.8,
  onVolumeChange,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(440);

  useEffect(() => {
    if (!rootRef.current) return;
    const updateSize = () => {
      if (rootRef.current) {
        setContainerWidth(rootRef.current.clientWidth);
      }
    };
    updateSize();
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, []);

  const isNarrow = containerWidth < 380;
  const isSuperNarrow = containerWidth < 320;

  const effectiveDuration = duration && duration > 0 ? duration : currentTrack?.duration_secs || 0;
  const progressPercent = effectiveDuration > 0 ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100)) : 0;
  const lastVolRef = useRef(0.8);
  const safeVolume = Math.max(0, Math.min(1, typeof volume === 'number' && !isNaN(volume) ? volume : 0.8));

  const handleMuteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onVolumeChange) return;
    if (safeVolume > 0) {
      lastVolRef.current = safeVolume;
      onVolumeChange(0);
    } else {
      onVolumeChange(lastVolRef.current > 0 ? lastVolRef.current : 0.8);
    }
  };

  const handleVolumeSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!onVolumeChange) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onVolumeChange(Math.round(ratio * 100) / 100);
  };

  const handleStartDragging = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, [role="button"], a, .no-drag')) return;
    try {
      getCurrentWindow().startDragging();
    } catch {}
  };

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || effectiveDuration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * effectiveDuration);
  };

  return (
    <div
      ref={rootRef}
      className="w-full h-full min-w-[360px] min-h-[72px] bg-[#07070a] border border-white/15 text-white select-none flex flex-col justify-between overflow-hidden relative shadow-2xl cursor-move"
      data-tauri-drag-region="true"
      onMouseDown={handleStartDragging}
      onDoubleClick={onRestoreFull}
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Top Edge Progress Seekbar */}
      <div
        className="w-full h-[3px] hover:h-[5px] bg-white/10 cursor-pointer transition-all relative no-drag z-30 group"
        onClick={handleSeekClick}
        style={{ WebkitAppRegion: 'no-drag' } as any}
        title={`Tua nhạc: ${formatTime(currentTime)} / ${formatTime(effectiveDuration)}`}
      >
        <div
          className="h-full transition-all"
          style={{ width: `${progressPercent}%`, backgroundColor: accentColor }}
        />
      </div>

      {/* Main Bar Content Row */}
      <div 
        className="flex items-center justify-between px-3 py-1.5 flex-1 min-w-0 gap-2 cursor-move relative"
        data-tauri-drag-region="true"
        style={{ WebkitAppRegion: 'drag' } as any}
        onMouseDown={handleStartDragging}
      >
        {/* Left: Thumbnail + Track Details */}
        <div 
          className={`flex items-center gap-2 min-w-0 overflow-hidden ${
            !isNarrow 
              ? 'max-w-[calc(50%-55px)] flex-1' 
              : isSuperNarrow 
                ? 'shrink min-w-0 max-w-[100px]' 
                : 'shrink min-w-0 max-w-[140px]'
          }`}
          data-tauri-drag-region="true"
          style={{ WebkitAppRegion: 'drag' } as any}
        >
          {/* Cover Thumbnail */}
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/60 border border-white/10 shrink-0 shadow relative">
            {currentTrack?.cover_art ? (
              <img
                src={optimizeThumbnailUrl(currentTrack.cover_art, currentTrack.path_or_url || currentTrack.id)}
                alt={currentTrack.title}
                referrerPolicy="no-referrer"
                onError={(e) => handleImageError(e, currentTrack.path_or_url || currentTrack.id)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                <Music className="w-5 h-5" />
              </div>
            )}
          </div>

          {/* Title & Artist with Smooth Hover-Only Marquee */}
          <div 
            className="flex flex-col justify-center overflow-hidden min-w-0 flex-1 leading-tight no-drag cursor-pointer"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            <HoverMarqueeText
              text={currentTrack?.title || 'Chưa chọn bài hát'}
              className="text-xs font-bold text-white tracking-tight"
            />
            <div className="flex items-center text-[10px] text-zinc-400 mt-0.5 min-w-0 font-mono">
              <span className="truncate min-w-0 flex-1" title={currentTrack?.artist || 'Spytify'}>
                {currentTrack?.artist || 'Spytify'}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Playback Controls (Dead Center at >= 380px, shifted left at < 380px) */}
        <div 
          className={`flex items-center gap-1 shrink-0 no-drag z-10 ${
            !isNarrow ? 'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2' : 'shrink-0 ml-1'
          }`}
          style={{ WebkitAppRegion: 'no-drag' } as any}
        >
          {/* Previous Track */}
          <button
            type="button"
            onClick={onPrev}
            className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Bài trước đó"
          >
            <SkipBack className="w-3.5 h-3.5 fill-current" />
          </button>

          {/* Play / Pause */}
          <button
            type="button"
            onClick={onTogglePlay}
            className="w-8 h-8 rounded-full flex items-center justify-center text-black bg-white hover:scale-105 active:scale-95 transition-transform shadow-md cursor-pointer mx-0.5"
            title={isPlaying ? 'Tạm dừng' : 'Phát tiếp'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current text-black" />
            ) : (
              <Play className="w-4 h-4 fill-current text-black ml-0.5" />
            )}
          </button>

          {/* Next Track */}
          <button
            type="button"
            onClick={onNext}
            className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Bài tiếp theo"
          >
            <SkipForward className="w-3.5 h-3.5 fill-current" />
          </button>
        </div>

        {/* Right Section: Volume & Window Action Buttons */}
        <div 
          className="flex items-center gap-1.5 shrink-0 ml-auto z-10 no-drag"
          style={{ WebkitAppRegion: 'no-drag' } as any}
        >
          {/* Volume Control & Interactive Slider */}
          {onVolumeChange && (
            <div 
              className="flex items-center gap-1 shrink-0 no-drag pr-0.5"
              style={{ WebkitAppRegion: 'no-drag' } as any}
            >
              <button
                type="button"
                onClick={handleMuteToggle}
                onWheel={(e) => {
                  e.stopPropagation();
                  const step = e.deltaY < 0 ? 0.05 : -0.05;
                  const next = Math.max(0, Math.min(1, Math.round((safeVolume + step) * 100) / 100));
                  onVolumeChange(next);
                }}
                title={safeVolume === 0 ? 'Bật âm lượng (Cuộn chuột để tăng/giảm)' : `Âm lượng: ${Math.round(safeVolume * 100)}% (Cuộn chuột để tăng/giảm)`}
                className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                {safeVolume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                ) : safeVolume < 0.5 ? (
                  <Volume1 className="w-3.5 h-3.5" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>

              {/* Volume Slider Bar — always visible for quick mouse adjusting */}
              {!isSuperNarrow && (
                <div
                  onClick={handleVolumeSeek}
                  onWheel={(e) => {
                    e.stopPropagation();
                    const step = e.deltaY < 0 ? 0.05 : -0.05;
                    const next = Math.max(0, Math.min(1, Math.round((safeVolume + step) * 100) / 100));
                    onVolumeChange(next);
                  }}
                  title={`Âm lượng: ${Math.round(safeVolume * 100)}% (Kéo hoặc cuộn chuột)`}
                  className="w-14 sm:w-16 h-3 flex items-center cursor-pointer group/vol relative"
                >
                  <div className="w-full h-[3px] group-hover/vol:h-[5px] bg-white/20 rounded-full overflow-hidden transition-all">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${safeVolume * 100}%`, backgroundColor: accentColor }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Window Action Buttons */}
          <div 
            className="flex items-center gap-1 shrink-0 pl-1 border-l border-white/10 no-drag"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            {/* Restore to full desktop view */}
            <button
              type="button"
              onClick={onRestoreFull}
              className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Mở rộng cửa sổ Spytify"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            {/* Close / Hide to Tray */}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-rose-500/20 hover:text-rose-400 transition-colors cursor-pointer"
                title="Đóng cửa sổ"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
