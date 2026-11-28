import React, { useState, useMemo } from 'react';
import {
  X,
  ListMusic,
  Trash2,
  GripVertical,
  Play,
  ChevronUp,
  ChevronDown,
  Music,
  Disc,
  Radio,
  Plus,
  Check,
  RotateCw,
  Sparkles,
  AudioLines,
} from 'lucide-react';
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
  activeContextTitle?: string;
  smartDjTrack?: Track | null;
  smartDjAlternatives?: Track[];
  onAddToQueue?: (track: Track) => void;
  recommendMode?: 'fresh' | 'mix' | 'off';
  onCycleRecommendMode?: () => void;
  isAiLoadingSmartDj?: boolean;
  onRefreshSmartDj?: () => void;
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
  accentColor = '#ffffff',
  language = 'vi',
  isRemoteDesktop = false,
  activeContextTitle,
  smartDjTrack,
  smartDjAlternatives = [],
  onAddToQueue,
  recommendMode = 'fresh',
  onCycleRecommendMode,
  isAiLoadingSmartDj = false,
  onRefreshSmartDj,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [addedTrackIds, setAddedTrackIds] = useState<Set<string>>(new Set());

  // Filter out the current track if it's already at index 0 of the queue
  const upcomingTracks = useMemo(() => {
    return queue.filter(
      (t, idx) => !(currentTrack && idx === 0 && (t.id === currentTrack.id || t.path_or_url === currentTrack.path_or_url))
    );
  }, [queue, currentTrack]);

  // Combine Smart DJ candidate tracks
  const allSmartDjCandidates = useMemo(() => {
    const list: Track[] = [];
    if (smartDjTrack) list.push(smartDjTrack);
    smartDjAlternatives.forEach(alt => {
      if (!list.some(t => t.id === alt.id || (t.path_or_url && t.path_or_url === alt.path_or_url))) {
        list.push(alt);
      }
    });
    return list;
  }, [smartDjTrack, smartDjAlternatives]);

  if (!isOpen) return null;

  // Map reorder from upcomingTracks indices to actual queue indices
  const handleReorderUpcoming = (fromUpcomingIdx: number, toUpcomingIdx: number) => {
    const fromTrack = upcomingTracks[fromUpcomingIdx];
    const toTrack = upcomingTracks[toUpcomingIdx];
    if (!fromTrack || !toTrack) return;
    const fromQueueIdx = queue.findIndex(t => t.id === fromTrack.id || (t.path_or_url && t.path_or_url === fromTrack.path_or_url));
    const toQueueIdx = queue.findIndex(t => t.id === toTrack.id || (t.path_or_url && t.path_or_url === toTrack.path_or_url));
    if (fromQueueIdx !== -1 && toQueueIdx !== -1 && fromQueueIdx !== toQueueIdx) {
      onReorder(fromQueueIdx, toQueueIdx);
    }
  };

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
      handleReorderUpcoming(draggedIndex, targetIndex);
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
      handleReorderUpcoming(index, index - 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < upcomingTracks.length - 1) {
      handleReorderUpcoming(index, index + 1);
    }
  };

  const handleAddTrackToQueue = (track: Track) => {
    if (onAddToQueue) {
      onAddToQueue(track);
      setAddedTrackIds(prev => new Set([...prev, track.id]));
    }
  };

  const handleAddAllSmartDj = () => {
    if (onAddToQueue) {
      allSmartDjCandidates.forEach(track => {
        onAddToQueue(track);
      });
      setAddedTrackIds(prev => new Set([...prev, ...allSmartDjCandidates.map(t => t.id)]));
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex justify-end select-none animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      {/* Right Drawer Container */}
      <div className="relative w-full sm:w-[450px] md:w-[480px] bg-zinc-950 border-l border-white/10 shadow-2xl flex flex-col h-full z-10">
        
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0 bg-zinc-950/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/10 bg-white/5 text-zinc-300">
              <ListMusic className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <span>{language === 'vi' ? 'Hàng đợi & Smart DJ' : 'Queue & Smart DJ'}</span>
                {isRemoteDesktop && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                    PC Remote
                  </span>
                )}
              </h2>
              <p className="text-[11px] font-mono text-zinc-400">
                {upcomingTracks.length > 0 
                  ? `${upcomingTracks.length} ${language === 'vi' ? 'bài hát trong danh sách' : 'tracks in queue'}`
                  : (language === 'vi' ? 'Smart DJ tự động nối tiếp' : 'Smart DJ auto-advancing')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Direct Smart DJ Mode Toggle Pill in Header */}
            {onCycleRecommendMode && (
              <button
                type="button"
                onClick={onCycleRecommendMode}
                className={`px-3 py-1 rounded-full text-[11px] font-mono font-medium uppercase transition-colors cursor-pointer flex items-center gap-1.5 border ${
                  recommendMode !== 'off'
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                }`}
                title={language === 'vi' ? 'Bấm để đổi chế độ Smart DJ (Fresh / Mix / Tắt)' : 'Click to cycle Smart DJ mode'}
              >
                <AudioLines className="w-3.5 h-3.5 text-zinc-300" />
                <span>{recommendMode === 'fresh' ? 'FRESH' : recommendMode === 'mix' ? 'MIX' : (language === 'vi' ? 'Tắt' : 'Off')}</span>
              </button>
            )}

            {/* Refresh Smart DJ Recommendations */}
            {onRefreshSmartDj && (
              <button
                type="button"
                onClick={onRefreshSmartDj}
                disabled={isAiLoadingSmartDj}
                className="p-1.5 rounded-lg border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title={language === 'vi' ? 'Làm mới gợi ý bài hát' : 'Refresh suggestions'}
              >
                <RotateCw className={`w-3.5 h-3.5 ${isAiLoadingSmartDj ? 'animate-spin' : ''}`} />
              </button>
            )}

            {/* Close Drawer Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer ml-1"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          
          {/* 1. NOW PLAYING */}
          {currentTrack && (
            <div>
              <div className="text-[11px] font-mono font-medium tracking-wider text-zinc-400 uppercase mb-2 px-1 flex items-center justify-between">
                <span>{language === 'vi' ? 'Đang phát' : 'Now Playing'}</span>
                {isPlaying && (
                  <span className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {language === 'vi' ? 'Đang phát' : 'Playing'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-zinc-900/40 shadow-sm">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-zinc-950">
                  {currentTrack.cover_art ? (
                    <img src={currentTrack.cover_art} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-white/5 flex items-center justify-center">
                      <Music className="w-5 h-5 text-zinc-400" />
                    </div>
                  )}
                  {isPlaying && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Disc className="w-6 h-6 animate-spin text-white/80" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 pr-2">
                  <h3 className="text-xs sm:text-sm font-semibold text-white truncate">
                    {currentTrack.title}
                  </h3>
                  <p className="text-[11px] text-zinc-400 truncate mt-0.5 font-mono">
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

          {/* 2. UP NEXT QUEUE */}
          <div>
            <div className="text-[11px] font-mono font-medium tracking-wider text-zinc-400 uppercase mb-2 px-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ListMusic className="w-3.5 h-3.5 text-zinc-400" />
                <span>
                  {activeContextTitle 
                    ? `${language === 'vi' ? 'Tiếp theo trong' : 'Next from'}: ${activeContextTitle}`
                    : (language === 'vi' ? 'Bài tiếp theo' : 'Up Next')}
                </span>
              </span>

              {upcomingTracks.length > 0 && onClearQueue && (
                <button
                  type="button"
                  onClick={onClearQueue}
                  className="text-[10px] text-zinc-400 hover:text-red-400 px-2 py-0.5 rounded border border-white/10 hover:border-red-400/30 transition-colors cursor-pointer"
                >
                  {language === 'vi' ? 'Xoá hết' : 'Clear'}
                </button>
              )}
            </div>

            {upcomingTracks.length > 0 ? (
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
                      data-tauri-drag-region="false"
                      style={{ WebkitUserDrag: 'element', userSelect: 'none' } as any}
                      className={`group flex items-center gap-2 p-2 rounded-xl transition-all border ${
                        isBeingDragged
                          ? 'opacity-40 border-dashed border-white/40 bg-white/5'
                          : isOver
                          ? 'border-white/30 bg-white/10 scale-[1.01]'
                          : 'border-white/5 bg-zinc-900/40 hover:bg-zinc-800/60 hover:border-white/10'
                      }`}
                    >
                      {/* Drag Handle & Reorder Controls */}
                      <div className="flex items-center gap-0.5 shrink-0 text-zinc-500">
                        <div
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            handleDragStart(e, idx);
                          }}
                          className="cursor-grab active:cursor-grabbing p-1.5 hover:text-zinc-300 transition-colors"
                          style={{ WebkitUserDrag: 'element' } as any}
                          title={language === 'vi' ? 'Kéo để xếp lại' : 'Drag to reorder'}
                        >
                          <GripVertical className="w-4 h-4 pointer-events-none" />
                        </div>
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveUp(idx);
                            }}
                            disabled={idx === 0}
                            className="p-0.5 hover:text-white disabled:opacity-20 cursor-pointer"
                            title="Lên trên"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveDown(idx);
                            }}
                            disabled={idx === upcomingTracks.length - 1}
                            className="p-0.5 hover:text-white disabled:opacity-20 cursor-pointer"
                            title="Xuống dưới"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Track Sequence Number */}
                      <span className="text-[10px] font-mono text-zinc-500 w-4 text-center shrink-0">
                        {idx + 1}
                      </span>

                      {/* Thumbnail with Click to Play */}
                      <div 
                        onClick={() => onPlayTrack(track)}
                        className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-white/10 bg-zinc-950 cursor-pointer group/thumb"
                      >
                        {track.cover_art ? (
                          <img src={track.cover_art} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music className="w-3.5 h-3.5 text-zinc-500" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                          <Play className="w-3.5 h-3.5 fill-current text-white" />
                        </div>
                      </div>

                      {/* Title & Artist */}
                      <div 
                        onClick={() => onPlayTrack(track)}
                        className="flex-1 min-w-0 pr-1 cursor-pointer"
                      >
                        <p className="text-xs font-semibold text-white truncate group-hover:text-zinc-200 transition-colors">
                          {track.title}
                        </p>
                        <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                          {track.artist || '—'}
                        </p>
                      </div>

                      {/* Duration */}
                      {track.duration_secs ? (
                        <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                          {formatTime(track.duration_secs)}
                        </span>
                      ) : null}

                      {/* Delete / Remove Action */}
                      <button
                        type="button"
                        onClick={() => onRemove(track.id)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                        title={language === 'vi' ? 'Xoá khỏi hàng đợi' : 'Remove'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-center text-[11px] text-zinc-400">
                {language === 'vi' 
                  ? 'Đã phát hết bài trong album này. Smart DJ sẽ phát tiếp bài gợi ý bên dưới.'
                  : 'End of current playlist. Smart DJ will autoplay recommendations below.'}
              </div>
            )}
          </div>

          {/* 3. SMART DJ STUDIO SECTION */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            {/* Smart DJ Section Banner */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-mono font-medium tracking-wider uppercase flex items-center gap-1.5 text-zinc-300">
                <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
                <span>
                  {upcomingTracks.length > 0 
                    ? (language === 'vi' ? 'Khi hết danh sách: Smart DJ sẽ phát' : 'When list ends: Smart DJ plays')
                    : (language === 'vi' ? 'Smart DJ gợi ý bài tiếp theo' : 'Smart DJ Next Autoplay')}
                </span>
              </span>

              {allSmartDjCandidates.length > 1 && (
                <button
                  type="button"
                  onClick={handleAddAllSmartDj}
                  className="text-[10px] font-mono text-zinc-300 hover:text-white px-2 py-0.5 rounded border border-white/10 hover:border-white/20 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>{language === 'vi' ? '+ Thêm tất cả' : '+ Add all'}</span>
                </button>
              )}
            </div>

            {/* Featured AI Top Pick */}
            {smartDjTrack && (
              <div className="p-3 rounded-2xl border border-white/10 bg-zinc-900/50 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-zinc-950 group">
                    {smartDjTrack.cover_art ? (
                      <img src={smartDjTrack.cover_art} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Radio className="w-5 h-5 text-zinc-400" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => onPlayTrack(smartDjTrack)}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current text-white" />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-white/5 text-zinc-300 border border-white/10">
                      Smart DJ Selection
                    </span>
                    <h4 className="text-xs sm:text-sm font-semibold text-white truncate mt-1">
                      {smartDjTrack.title}
                    </h4>
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5 font-mono">
                      {smartDjTrack.artist || '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                  {/* Play Now Button — Minimal & Modern White Button */}
                  <button
                    type="button"
                    onClick={() => onPlayTrack(smartDjTrack)}
                    className="flex-1 py-2 px-3 rounded-xl font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 bg-white hover:bg-zinc-200 text-zinc-950 active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5 fill-current text-zinc-950" />
                    <span>{language === 'vi' ? 'Phát ngay' : 'Play Now'}</span>
                  </button>

                  {/* Add to Queue Button */}
                  <button
                    type="button"
                    onClick={() => handleAddTrackToQueue(smartDjTrack)}
                    className="flex-1 py-2 px-3 rounded-xl font-medium text-xs bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-white/10 active:scale-95"
                  >
                    {addedTrackIds.has(smartDjTrack.id) ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">{language === 'vi' ? 'Đã thêm' : 'Added'}</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>{language === 'vi' ? 'Thêm vào hàng đợi' : 'Add to Queue'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* List of Similar AI Recommendations */}
            {allSmartDjCandidates.filter(t => t.id !== smartDjTrack?.id).length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] font-mono text-zinc-400 px-1 uppercase tracking-wider">
                  {language === 'vi' ? 'Gợi ý tương tự cho gu nhạc của bạn:' : 'More suggestions matching your taste:'}
                </div>

                {allSmartDjCandidates
                  .filter(t => t.id !== smartDjTrack?.id)
                  .slice(0, 8)
                  .map((recTrack) => {
                    const isAdded = addedTrackIds.has(recTrack.id);

                    return (
                      <div
                        key={recTrack.id}
                        className="flex items-center gap-2.5 p-2 rounded-xl bg-zinc-900/30 hover:bg-zinc-800/50 border border-white/5 transition-colors group"
                      >
                        <div 
                          onClick={() => onPlayTrack(recTrack)}
                          className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-white/10 bg-zinc-950 cursor-pointer group/rec"
                        >
                          {recTrack.cover_art ? (
                            <img src={recTrack.cover_art} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Music className="w-3 h-3 text-zinc-400" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/rec:opacity-100 flex items-center justify-center transition-opacity">
                            <Play className="w-3 h-3 fill-current text-white" />
                          </div>
                        </div>

                        <div 
                          onClick={() => onPlayTrack(recTrack)}
                          className="flex-1 min-w-0 cursor-pointer"
                        >
                          <p className="text-xs font-semibold text-white truncate group-hover:text-zinc-200 transition-colors">
                            {recTrack.title}
                          </p>
                          <p className="text-[10px] text-zinc-400 truncate mt-0.5 font-mono">
                            {recTrack.artist || '—'}
                          </p>
                        </div>

                        {recTrack.duration_secs ? (
                          <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                            {formatTime(recTrack.duration_secs)}
                          </span>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => handleAddTrackToQueue(recTrack)}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 flex items-center justify-center ${
                            isAdded
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                              : 'bg-white/5 border-white/10 text-zinc-300 hover:text-white hover:bg-white/10'
                          }`}
                          title={isAdded ? 'Đã thêm' : 'Thêm vào hàng đợi'}
                        >
                          {isAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
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
