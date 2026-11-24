import React, { useState } from 'react';
import { X, ListMusic, Trash2, GripVertical, Play, Pause, ChevronUp, ChevronDown, Music, Disc } from 'lucide-react';
import { Track } from '../types';

function formatTime(secs: number): string {
  if (isNaN(secs) || secs < 0) return '0:00';
  const mins = Math.floor(secs / 60);
  const remainingSecs = Math.floor(secs % 60);
  return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
}

interface QueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  queue: Track[];
  onPlayTrack: (track: Track) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove: (trackId: string) => void;
  onClearQueue?: () => void;
  accentColor?: string;
  language?: string;
  isRemoteDesktop?: boolean;
}

export const QueueModal: React.FC<QueueModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  isPlaying,
  queue,
  onPlayTrack,
  onReorder,
  onRemove,
  onClearQueue,
  accentColor = '#ff2a55',
  language = 'vi',
  isRemoteDesktop = false,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  // Filter out the current track if it's already in the queue list so "Up Next" only has upcoming tracks
  const upcomingTracks = queue.filter(
    (t, idx) => !(currentTrack && idx === 0 && (t.id === currentTrack.id || t.path_or_url === currentTrack.path_or_url))
  );

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      onReorder(draggedIndex, targetIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      onReorder(index, index - 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < upcomingTracks.length - 1) {
      onReorder(index, index + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md select-none animate-fadeIn">
      {/* Backdrop tap to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-xl bg-[#0e0e14] border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[82vh] z-10">
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0 bg-[#13131c]/70 backdrop-blur-lg">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center border"
              style={{
                backgroundColor: `${accentColor}18`,
                borderColor: `${accentColor}40`,
                color: accentColor,
              }}
            >
              <ListMusic className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                {language === 'vi' ? 'Danh sách chờ phát' : 'Playing Queue'}
                {isRemoteDesktop && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                    PC Remote
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-zinc-400">
                {upcomingTracks.length} {language === 'vi' ? 'bài hát tiếp theo' : 'upcoming tracks'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onClearQueue && upcomingTracks.length > 0 && (
              <button
                type="button"
                onClick={onClearQueue}
                className="text-xs text-zinc-400 hover:text-red-400 px-2.5 py-1 rounded-lg border border-white/10 hover:border-red-400/30 transition-colors cursor-pointer"
              >
                {language === 'vi' ? 'Xoá hết' : 'Clear'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
          {/* NOW PLAYING SECTION */}
          {currentTrack && (
            <div>
              <div className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase mb-2 px-1 flex items-center justify-between">
                <span>{language === 'vi' ? 'Đang phát' : 'Now Playing'}</span>
                {isPlaying && (
                  <span className="flex items-center gap-1 font-mono text-[10px]" style={{ color: accentColor }}>
                    <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: accentColor }} />
                    {language === 'vi' ? 'Đang phát' : 'Playing'}
                  </span>
                )}
              </div>

              <div
                className="flex items-center gap-3 p-3 rounded-xl border bg-white/5 transition-all shadow-sm"
                style={{ borderColor: `${accentColor}40` }}
              >
                <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-white/10">
                  {currentTrack.cover_art ? (
                    <img src={currentTrack.cover_art} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-white/10 flex items-center justify-center">
                      <Music className="w-5 h-5 text-zinc-400" />
                    </div>
                  )}
                  {isPlaying && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Disc className="w-6 h-6 animate-spin text-white drop-shadow" style={{ color: accentColor }} />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 pr-2">
                  <h3 className="text-xs sm:text-sm font-bold text-white truncate" style={{ color: accentColor }}>
                    {currentTrack.title}
                  </h3>
                  <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                    {currentTrack.artist || '—'}
                  </p>
                </div>

                {currentTrack.duration_secs ? (
                  <span className="text-[11px] font-mono text-zinc-400 shrink-0">
                    {formatTime(currentTrack.duration_secs)}
                  </span>
                ) : null}
              </div>
            </div>
          )}

          {/* UP NEXT SECTION */}
          <div>
            <div className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase mb-2 px-1 flex items-center justify-between">
              <span>{language === 'vi' ? 'Bài tiếp theo' : 'Up Next'}</span>
              <span className="text-[10px] text-zinc-400">
                {language === 'vi' ? 'Kéo hoặc bấm nút mũi tên để xếp lại' : 'Drag or use arrows to reorder'}
              </span>
            </div>

            {upcomingTracks.length === 0 ? (
              <div className="py-8 text-center text-zinc-400 flex flex-col items-center gap-2 border border-dashed border-white/10 rounded-xl">
                <ListMusic className="w-8 h-8 opacity-40" />
                <p className="text-xs">
                  {language === 'vi' ? 'Hàng đợi đang trống. Chọn thêm bài hát từ thư viện để nghe tiếp.' : 'Queue is empty.'}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {upcomingTracks.map((track, idx) => {
                  const isBeingDragged = draggedIndex === idx;
                  const isOver = dragOverIndex === idx;

                  return (
                    <div
                      key={`${track.id}_${idx}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`group flex items-center gap-2 p-2 rounded-xl transition-all border ${
                        isBeingDragged
                          ? 'opacity-40 border-dashed border-sky-400 bg-sky-400/10'
                          : isOver
                          ? 'border-sky-400/70 bg-white/10'
                          : 'border-white/5 bg-[#14141c]/60 hover:bg-[#1a1a24] hover:border-white/10'
                      }`}
                    >
                      {/* Drag Handle & Mobile Reorder Controls */}
                      <div className="flex items-center gap-0.5 shrink-0 text-zinc-400">
                        <div
                          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-white/10"
                          title="Kéo thả để đổi thứ tự"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>

                        {/* Quick Up/Down buttons for mobile */}
                        <div className="flex flex-col -space-y-1">
                          <button
                            type="button"
                            onClick={() => handleMoveUp(idx)}
                            disabled={idx === 0}
                            className={`p-0.5 rounded hover:text-white ${idx === 0 ? 'opacity-20 cursor-not-allowed' : 'hover:bg-white/10'}`}
                            title="Lên trên"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(idx)}
                            disabled={idx === upcomingTracks.length - 1}
                            className={`p-0.5 rounded hover:text-white ${
                              idx === upcomingTracks.length - 1 ? 'opacity-20 cursor-not-allowed' : 'hover:bg-white/10'
                            }`}
                            title="Xuống dưới"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Number Index */}
                      <span className="text-[10px] font-mono text-zinc-400 w-4 text-center shrink-0">
                        {idx + 1}
                      </span>

                      {/* Thumbnail & Title (Click to play immediately) */}
                      <div
                        onClick={() => onPlayTrack(track)}
                        className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer pr-1"
                      >
                        <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-white/10 bg-white/5">
                          {track.cover_art ? (
                            <img src={track.cover_art} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Music className="w-3.5 h-3.5 text-zinc-400" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-semibold text-zinc-200 group-hover:text-white truncate">
                            {track.title}
                          </h4>
                          <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                            {track.artist || '—'}
                          </p>
                        </div>
                      </div>

                      {/* Duration */}
                      {track.duration_secs ? (
                        <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                          {formatTime(track.duration_secs)}
                        </span>
                      ) : null}

                      {/* Remove from queue button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(track.id);
                        }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer shrink-0"
                        title={language === 'vi' ? 'Xoá khỏi hàng đợi' : 'Remove from queue'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
