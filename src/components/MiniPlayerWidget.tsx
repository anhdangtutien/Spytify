import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Maximize2, Pin, Volume2, Music } from 'lucide-react';
import { Track } from '../types';
import { MarqueeText } from './MarqueeText';

function formatTime(secs: number): string {
  if (isNaN(secs) || secs < 0) return '0:00';
  const mins = Math.floor(secs / 60);
  const remainingSecs = Math.floor(secs % 60);
  return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
}

interface MiniPlayerWidgetProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration?: number;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onRestoreFull: () => void;
  accentColor?: string;
  themeMode?: 'dark' | 'light';
  volume?: number;
  onVolumeChange?: (v: number) => void;
}

export const MiniPlayerWidget: React.FC<MiniPlayerWidgetProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onRestoreFull,
  accentColor = '#ff2a55',
  themeMode = 'dark',
}) => {
  const effectiveDuration = duration && duration > 0 ? duration : currentTrack?.duration_secs || 0;
  const progressPercent = effectiveDuration > 0 ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100)) : 0;

  return (
    <div 
      className="fixed inset-0 z-[999] flex flex-col justify-between p-2.5 bg-[#06060a]/95 text-white select-none backdrop-blur-2xl border border-white/10 overflow-hidden"
      data-tauri-drag-region="true"
    >
      {/* Top Drag & Status Bar */}
      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pb-1 shrink-0" data-tauri-drag-region="true">
        <div className="flex items-center gap-1.5 pointer-events-none" data-tauri-drag-region="true">
          <Pin className="w-3 h-3 text-emerald-400" />
          <span className="font-bold tracking-wider uppercase text-[9px] text-zinc-300">SPYTIFY MINI</span>
          {isPlaying && (
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          )}
        </div>

        <button
          type="button"
          onClick={onRestoreFull}
          className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          title="Mở rộng toàn màn hình"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Center Track Info & Controls Row */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1 my-auto">
        {/* Cover Art with Ambient Shadow */}
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0 shadow-lg relative group">
          {currentTrack?.cover_art ? (
            <img
              src={currentTrack.cover_art}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">
              <Music className="w-5 h-5" />
            </div>
          )}
        </div>

        {/* Title & Artist */}
        <div className="min-w-0 flex-1 overflow-hidden pr-1">
          <MarqueeText
            text={currentTrack?.title || 'Chưa chọn bài hát'}
            className="text-xs font-bold text-white leading-tight"
          />
          <p className="text-[10px] text-zinc-400 truncate mt-0.5 font-mono">
            {currentTrack?.artist || '—'}
          </p>
        </div>

        {/* Transport Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onPrev}
            className="p-1.5 text-zinc-400 hover:text-white cursor-pointer active:scale-90 transition-transform"
            title="Bài trước"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            disabled={!currentTrack}
            className="w-8 h-8 rounded-full flex items-center justify-center shadow-md cursor-pointer active:scale-95 transition-transform"
            style={{
              backgroundColor: accentColor,
              color: '#ffffff',
            }}
            title={isPlaying ? 'Tạm dừng' : 'Phát'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={onNext}
            className="p-1.5 text-zinc-400 hover:text-white cursor-pointer active:scale-90 transition-transform"
            title="Bài tiếp theo"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>
        </div>
      </div>

      {/* Bottom Mini Progress Track */}
      <div className="pt-1 shrink-0">
        <div
          className="relative w-full h-1.5 rounded-full bg-white/10 cursor-pointer overflow-hidden"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            if (rect.width > 0 && effectiveDuration > 0) {
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              onSeek(ratio * effectiveDuration);
            }
          }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${progressPercent}%`,
              backgroundColor: accentColor,
            }}
          />
        </div>
        <div className="flex justify-between items-center text-[9px] font-mono text-zinc-400 mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(effectiveDuration)}</span>
        </div>
      </div>
    </div>
  );
};
