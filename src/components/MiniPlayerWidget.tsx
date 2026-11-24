import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Maximize2, Pin, Music } from 'lucide-react';
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
}) => {
  const isTauriApp = typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__) && !Boolean((window as any).__TAURI_WEB_SHIM__);

  const [isWindowSmall, setIsWindowSmall] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth <= 420 && window.innerHeight <= 220;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsWindowSmall(window.innerWidth <= 420 && window.innerHeight <= 220);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleStartDragging = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, [role="button"], a, .no-drag')) return;
    try {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const appWindow = getCurrentWebviewWindow();
      await appWindow.startDragging();
    } catch {}
  };

  const effectiveDuration = duration && duration > 0 ? duration : currentTrack?.duration_secs || 0;
  const progressPercent = effectiveDuration > 0 ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100)) : 0;

  const content = (
    <div 
      className={`w-full h-full flex flex-col justify-between p-2.5 text-white select-none ${
        isTauriApp || isWindowSmall
          ? 'bg-[#06060a] border border-white/10'
          : 'bg-[#0a0a10]/95 backdrop-blur-2xl rounded-2xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.85)]'
      }`}
      data-tauri-drag-region="true"
      onMouseDown={handleStartDragging}
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Top Drag & Status Bar */}
      <div 
        className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pb-0.5 shrink-0 cursor-move" 
        data-tauri-drag-region="true"
        onMouseDown={handleStartDragging}
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className="flex items-center gap-1.5 pointer-events-none" data-tauri-drag-region="true">
          <Pin className="w-3 h-3 text-emerald-400" />
          <span className="font-bold tracking-wider uppercase text-[9px] text-zinc-300">SPYTIFY MINI</span>
          {isPlaying && (
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          )}
        </div>

        <div className="flex items-center gap-1 no-drag" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRestoreFull();
            }}
            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Mở rộng toàn màn hình"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Center Track Info & Controls Row */}
      <div 
        className="flex items-center gap-2.5 min-w-0 flex-1 my-auto cursor-move"
        data-tauri-drag-region="true"
        onMouseDown={handleStartDragging}
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        {/* Cover Art with Ambient Shadow */}
        <div className="w-11 h-11 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0 shadow-lg relative pointer-events-none">
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
        <div className="min-w-0 flex-1 overflow-hidden pr-1 pointer-events-none">
          <MarqueeText
            text={currentTrack?.title || 'Chưa chọn bài hát'}
            className="text-xs font-bold text-white leading-tight"
          />
          <p className="text-[10px] text-zinc-400 truncate mt-0.5 font-mono">
            {currentTrack?.artist || '—'}
          </p>
        </div>

        {/* Transport Buttons */}
        <div className="flex items-center gap-0.5 shrink-0 no-drag" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            className="p-1.5 text-zinc-400 hover:text-white cursor-pointer active:scale-90 transition-transform"
            title="Bài trước"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePlay();
            }}
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
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="p-1.5 text-zinc-400 hover:text-white cursor-pointer active:scale-90 transition-transform"
            title="Bài tiếp theo"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>
        </div>
      </div>

      {/* Bottom Mini Progress Track */}
      <div className="pt-0.5 shrink-0 no-drag" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <div
          className="relative w-full h-1 rounded-full bg-white/10 cursor-pointer overflow-hidden"
          onClick={(e) => {
            e.stopPropagation();
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
        <div className="flex justify-between items-center text-[9px] font-mono text-zinc-400 mt-1 pointer-events-none">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(effectiveDuration)}</span>
        </div>
      </div>
    </div>
  );

  // If on Desktop Tauri or small window, fill the whole window so the OS window IS the widget!
  if (isTauriApp || isWindowSmall) {
    return (
      <div className="fixed inset-0 z-[99999] overflow-hidden w-screen h-screen" data-tauri-drag-region="true">
        {content}
      </div>
    );
  }

  // If running in browser, render as sleek floating corner widget!
  return (
    <div className="fixed bottom-6 right-6 z-[999] w-[340px] h-[116px] animate-fadeIn">
      {content}
    </div>
  );
};
