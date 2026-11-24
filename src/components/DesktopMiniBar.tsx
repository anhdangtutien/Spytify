import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Maximize2, X, Music } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Track } from '../types';
import { MarqueeText } from './MarqueeText';
import { optimizeThumbnailUrl, handleImageError } from '../utils/trackUtils';

function formatTime(secs: number): string {
  if (isNaN(secs) || secs < 0) return '0:00';
  const mins = Math.floor(secs / 60);
  const remainingSecs = Math.floor(secs % 60);
  return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
}

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
}) => {
  const effectiveDuration = duration && duration > 0 ? duration : currentTrack?.duration_secs || 0;
  const progressPercent = effectiveDuration > 0 ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100)) : 0;

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
      className="w-full h-full min-h-[72px] bg-[#07070a] border border-white/15 text-white select-none flex flex-col justify-between overflow-hidden relative shadow-2xl cursor-move"
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
        title="Tua nhạc"
      >
        <div
          className="h-full transition-all"
          style={{ width: `${progressPercent}%`, backgroundColor: accentColor }}
        />
      </div>

      {/* Main Bar Content Row */}
      <div 
        className="flex items-center justify-between px-3 py-1.5 flex-1 min-w-0 gap-2.5 cursor-move"
        data-tauri-drag-region="true"
        style={{ WebkitAppRegion: 'drag' } as any}
        onMouseDown={handleStartDragging}
      >
        {/* Left: Thumbnail + Track Details */}
        <div 
          className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden"
          data-tauri-drag-region="true"
          style={{ WebkitAppRegion: 'drag' } as any}
        >
          {/* Cover Thumbnail */}
          <div className="w-11 h-11 rounded-lg overflow-hidden bg-black/60 border border-white/10 shrink-0 shadow relative">
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

          {/* Title & Artist */}
          <div className="flex flex-col justify-center overflow-hidden min-w-0 flex-1 leading-tight">
            <MarqueeText
              text={currentTrack?.title || 'Chưa chọn bài hát'}
              className="text-xs font-bold text-white tracking-tight"
            />
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-0.5 truncate font-mono">
              <span className="truncate">{currentTrack?.artist || 'Spytify'}</span>
              {effectiveDuration > 0 && (
                <span className="text-zinc-500 shrink-0">
                  • {formatTime(currentTime)} / {formatTime(effectiveDuration)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Playback Controls */}
        <div 
          className="flex items-center gap-1 shrink-0 no-drag"
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

        {/* Right: Window Action Buttons */}
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
  );
};
