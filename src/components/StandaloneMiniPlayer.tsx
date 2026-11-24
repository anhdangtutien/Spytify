import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, X, Music, Pin } from 'lucide-react';
import { Track } from '../types';
import { MarqueeText } from './MarqueeText';

function formatTime(secs: number): string {
  if (isNaN(secs) || secs < 0) return '0:00';
  const mins = Math.floor(secs / 60);
  const remainingSecs = Math.floor(secs % 60);
  return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
}

export const StandaloneMiniPlayer: React.FC = () => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(() => {
    try {
      const cached = localStorage.getItem('spytify_last_playback_sync');
      if (cached) return JSON.parse(cached).track || null;
    } catch {}
    return null;
  });
  const [isPlaying, setIsPlaying] = useState(() => {
    try {
      const cached = localStorage.getItem('spytify_last_playback_sync');
      if (cached) return Boolean(JSON.parse(cached).isPlaying);
    } catch {}
    return false;
  });
  const [currentTime, setCurrentTime] = useState(() => {
    try {
      const cached = localStorage.getItem('spytify_last_playback_sync');
      if (cached) return Number(JSON.parse(cached).currentTime) || 0;
    } catch {}
    return 0;
  });
  const [duration, setDuration] = useState(() => {
    try {
      const cached = localStorage.getItem('spytify_last_playback_sync');
      if (cached) return Number(JSON.parse(cached).duration) || 0;
    } catch {}
    return 0;
  });
  const [accentColor, setAccentColor] = useState(() => {
    try {
      const cached = localStorage.getItem('spytify_last_playback_sync');
      if (cached) return JSON.parse(cached).accentColor || '#ff2a55';
    } catch {}
    return '#ff2a55';
  });

  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    // 1. Set document title and dark background
    document.title = 'Spytify Mini Player';
    document.documentElement.classList.add('dark');
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.backgroundColor = '#06060a';

    // 2. Initialize BroadcastChannel for real-time sync with main window
    const bc = new BroadcastChannel('spytify_mini_sync');
    channelRef.current = bc;

    bc.onmessage = (event) => {
      const data = event.data;
      if (!data) return;
      if (data.type === 'SYNC') {
        if (data.track !== undefined) setCurrentTrack(data.track);
        if (data.isPlaying !== undefined) setIsPlaying(data.isPlaying);
        if (data.currentTime !== undefined) setCurrentTime(data.currentTime);
        if (data.duration !== undefined) setDuration(data.duration);
        if (data.accentColor !== undefined) setAccentColor(data.accentColor);
      }
    };

    // Request immediate state from main window
    bc.postMessage({ type: 'REQUEST_SYNC' });

    // Also check localStorage as instant bootstrap
    try {
      const cached = localStorage.getItem('spytify_last_playback_sync');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.track) setCurrentTrack(parsed.track);
        if (parsed.isPlaying !== undefined) setIsPlaying(parsed.isPlaying);
        if (parsed.currentTime !== undefined) setCurrentTime(parsed.currentTime);
        if (parsed.duration !== undefined) setDuration(parsed.duration);
        if (parsed.accentColor) setAccentColor(parsed.accentColor);
      }
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'spytify_last_playback_sync' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.track !== undefined) setCurrentTrack(parsed.track);
          if (parsed.isPlaying !== undefined) setIsPlaying(parsed.isPlaying);
          if (parsed.currentTime !== undefined) setCurrentTime(parsed.currentTime);
          if (parsed.duration !== undefined) setDuration(parsed.duration);
          if (parsed.accentColor) setAccentColor(parsed.accentColor);
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      bc.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const handleStartDragging = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, [role="button"], a, .no-drag')) return;
    try {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      await getCurrentWebviewWindow().startDragging();
    } catch {}
  };

  const handleClose = async () => {
    channelRef.current?.postMessage({ type: 'MINI_CLOSED' });
    try {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      await getCurrentWebviewWindow().hide();
      return;
    } catch {}
    window.close();
  };

  const handleTogglePlay = () => {
    channelRef.current?.postMessage({ type: 'TOGGLE_PLAY' });
    setIsPlaying(!isPlaying);
  };

  const handleNext = () => {
    channelRef.current?.postMessage({ type: 'NEXT' });
  };

  const handlePrev = () => {
    channelRef.current?.postMessage({ type: 'PREV' });
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    channelRef.current?.postMessage({ type: 'SEEK', time });
  };

  const effectiveDuration = duration > 0 ? duration : currentTrack?.duration_secs || 0;
  const progressPercent = effectiveDuration > 0 ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100)) : 0;

  return (
    <div
      className="w-screen h-screen bg-[#06060a] text-white select-none flex flex-col justify-between p-2.5 overflow-hidden border border-white/10"
      data-tauri-drag-region="true"
      onMouseDown={handleStartDragging}
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Top Header & Drag Bar */}
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
            onClick={handleClose}
            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Đóng Mini Player"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Center Track Info & Transport Row */}
      <div
        className="flex items-center gap-2.5 min-w-0 flex-1 my-auto cursor-move"
        data-tauri-drag-region="true"
        onMouseDown={handleStartDragging}
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        {/* Album Art */}
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
              handlePrev();
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
              handleTogglePlay();
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
              handleNext();
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
              handleSeek(ratio * effectiveDuration);
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
};
