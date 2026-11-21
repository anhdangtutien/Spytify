import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, Disc, Play, Trash2, Music, ArrowLeft, Clock3, FolderPlus, 
  Sparkles, Layers, Check, CheckCircle2, AlertTriangle, X, Pencil, Image as ImageIcon, GripVertical, Download, Loader2, Square
} from 'lucide-react';
import { Track, UserAlbum } from '../types';
import { TrackTable } from './TrackTable';
import { deduplicateTracks, getContrastTextColor, optimizeThumbnailUrl, handleImageError } from '../utils/trackUtils';
import { LanguageCode, getTranslation } from '../locales/i18n';

interface AlbumsViewProps {
  albums: UserAlbum[];
  onCreateAlbum: (title: string, description: string) => void;
  onDeleteAlbum: (albumId: string) => void;
  onUpdateAlbum?: (albumId: string, updates: Partial<UserAlbum>) => void;
  onRemoveTrackFromAlbum: (albumId: string, trackId: string) => void;
  onPlayTrack: (track: Track, albumTracks?: Track[]) => void;
  onPlayAlbum: (album: UserAlbum) => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  favorites: Set<string>;
  onToggleFavorite: (trackId: string) => void;
  onTogglePlay: () => void;
  accentColor?: string;
  language?: LanguageCode;
  availableTracks?: Track[];
  onDownloadAlbum?: (album: UserAlbum) => void;
  onCancelDownloadAlbum?: (albumId: string) => void;
  downloadingAlbumId?: string | null;
  onDownloadTrack?: (track: Track) => void;
  downloadingTrackIds?: Set<string>;
}

export const AlbumsView: React.FC<AlbumsViewProps> = ({
  albums,
  onCreateAlbum,
  onDeleteAlbum,
  onUpdateAlbum,
  onRemoveTrackFromAlbum,
  onPlayTrack,
  onPlayAlbum,
  currentTrack,
  isPlaying,
  favorites,
  onToggleFavorite,
  onTogglePlay,
  accentColor = '#ff2a55',
  language = 'vi',
  availableTracks = [],
  onDownloadAlbum,
  onCancelDownloadAlbum,
  downloadingAlbumId,
  onDownloadTrack,
  downloadingTrackIds,
}) => {
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Add Tracks to Current Album State
  const [isAddTracksModalOpen, setIsAddTracksModalOpen] = useState(false);
  const [selectedTracksToAdd, setSelectedTracksToAdd] = useState<Set<string>>(() => new Set());
  const [trackSearchQuery, setTrackSearchQuery] = useState('');

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCoverArt, setEditCoverArt] = useState('');

  // Delete Album Confirmation Pop-up State
  const [albumToDelete, setAlbumToDelete] = useState<UserAlbum | null>(null);
  const isWebShim = typeof window !== 'undefined' && Boolean((window as any).__TAURI_WEB_SHIM__);

  // Check if a track is downloaded locally (either flagged directly or matched in availableTracks pool)
  const downloadedLookup = useMemo(() => {
    const ids = new Set<string>();
    const paths = new Set<string>();
    const titleArtists = new Set<string>();
    const titles = new Set<string>();
    for (const t of availableTracks || []) {
      if (t.id) ids.add(t.id);
      if (t.path_or_url) paths.add(t.path_or_url);
      const nt = (t.title || '').trim().toLowerCase();
      const na = (t.artist || '').trim().toLowerCase();
      if (nt) {
        titles.add(nt);
        titleArtists.add(`${nt}|||${na}`);
      }
    }
    return { ids, paths, titleArtists, titles };
  }, [availableTracks]);

  const isTrackDownloaded = (track: Track): boolean => {
    if (isWebShim || !track) return false;
    if (track.source === 'local' || track.is_downloaded) return true;
    if (track.id && downloadedLookup.ids.has(track.id)) return true;
    if (track.path_or_url && downloadedLookup.paths.has(track.path_or_url)) return true;
    const nt = (track.title || '').trim().toLowerCase();
    const na = (track.artist || '').trim().toLowerCase();
    if (nt && downloadedLookup.titleArtists.has(`${nt}|||${na}`)) return true;
    if (nt && downloadedLookup.titles.has(nt)) return true;
    return false;
  };

  const selectedAlbum = albums.find(a => a.id === selectedAlbumId);
  const cleanAlbumTracks = useMemo(() => {
    return selectedAlbum ? deduplicateTracks(selectedAlbum.tracks || []) : [];
  }, [selectedAlbum]);

  const selectedAlbumDownloadedCount = useMemo(() => {
    return cleanAlbumTracks.filter(t => isTrackDownloaded(t)).length;
  }, [cleanAlbumTracks, downloadedLookup]);

  const isSelectedAlbumFullyDownloaded =
    cleanAlbumTracks.length > 0 && selectedAlbumDownloadedCount === cleanAlbumTracks.length;

  const candidateTracks = useMemo(() => {
    if (!selectedAlbum || !availableTracks) return [];
    const currentIds = new Set((selectedAlbum.tracks || []).map(t => t.id));
    const currentTitles = new Set((selectedAlbum.tracks || []).map(t => t.title.toLowerCase().trim()));
    return availableTracks.filter(t => !currentIds.has(t.id) && !currentTitles.has(t.title.toLowerCase().trim()));
  }, [selectedAlbum, availableTracks]);

  const filteredCandidates = useMemo(() => {
    if (!trackSearchQuery.trim()) return candidateTracks;
    const q = trackSearchQuery.toLowerCase().trim();
    return candidateTracks.filter(t => 
      t.title.toLowerCase().includes(q) || 
      t.artist.toLowerCase().includes(q)
    );
  }, [candidateTracks, trackSearchQuery]);

  const handleConfirmAddTracks = () => {
    if (!selectedAlbum || selectedTracksToAdd.size === 0) return;
    const toAdd = candidateTracks.filter(t => selectedTracksToAdd.has(t.id));
    onUpdateAlbum?.(selectedAlbum.id, {
      tracks: deduplicateTracks([...(selectedAlbum.tracks || []), ...toAdd])
    });
    setSelectedTracksToAdd(new Set());
    setIsAddTracksModalOpen(false);
  };

  // Drag-and-drop reordering state via Pointer Events (Tauri / WebView2 compatible)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [albumDropPosition, setAlbumDropPosition] = useState<'above' | 'below' | 'swap' | null>(null);

  const albumDragRef = useRef<{
    startIndex: number;
    startX: number;
    startY: number;
    moved: boolean;
    overIndex: number | null;
    position: 'above' | 'below' | 'swap' | null;
  } | null>(null);
  const suppressAlbumClickIdxRef = useRef<number | null>(null);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const drag = albumDragRef.current;
      if (!drag) return;

      const dx = Math.abs(e.clientX - drag.startX);
      const dy = Math.abs(e.clientY - drag.startY);
      if (!drag.moved && dx < 5 && dy < 5) return;

      if (!drag.moved) {
        drag.moved = true;
        setDraggedIndex(drag.startIndex);
      }

      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const rowSlot = el?.closest('[data-album-track-idx]') as HTMLElement | null;
      const targetIdxAttr = rowSlot?.getAttribute('data-album-track-idx');

      if (rowSlot && targetIdxAttr !== null && targetIdxAttr !== undefined) {
        const targetIdx = parseInt(targetIdxAttr, 10);
        if (!isNaN(targetIdx) && targetIdx !== drag.startIndex) {
          const rect = rowSlot.getBoundingClientRect();
          const ratio = (e.clientY - rect.top) / rect.height;
          let pos: 'above' | 'below' | 'swap';
          if (ratio < 0.28) {
            pos = 'above';
          } else if (ratio > 0.72) {
            pos = 'below';
          } else {
            pos = 'swap';
          }
          drag.overIndex = targetIdx;
          drag.position = pos;
          setDragOverIndex(targetIdx);
          setAlbumDropPosition(pos);
          return;
        }
      }

      drag.overIndex = null;
      drag.position = null;
      setDragOverIndex(null);
      setAlbumDropPosition(null);
    };

    const handlePointerUp = () => {
      const drag = albumDragRef.current;
      if (!drag) return;
      albumDragRef.current = null;

      if (drag.moved) {
        suppressAlbumClickIdxRef.current = drag.startIndex;
        setTimeout(() => {
          suppressAlbumClickIdxRef.current = null;
        }, 150);

        if (drag.overIndex !== null && drag.overIndex !== drag.startIndex && selectedAlbum) {
          const from = drag.startIndex;
          const to = drag.overIndex;
          const pos = drag.position || 'swap';

          const reordered = [...cleanAlbumTracks];
          if (from >= 0 && from < reordered.length && to >= 0 && to < reordered.length) {
            if (pos === 'swap') {
              const temp = reordered[from];
              reordered[from] = reordered[to];
              reordered[to] = temp;
            } else if (pos === 'above') {
              const [movedItem] = reordered.splice(from, 1);
              const insertIdx = from < to ? to - 1 : to;
              reordered.splice(Math.max(0, Math.min(reordered.length, insertIdx)), 0, movedItem);
            } else if (pos === 'below') {
              const [movedItem] = reordered.splice(from, 1);
              const insertIdx = from < to ? to : to + 1;
              reordered.splice(Math.max(0, Math.min(reordered.length, insertIdx)), 0, movedItem);
            }

            onUpdateAlbum?.(selectedAlbum.id, { tracks: reordered });
          }
        }
      }

      setDraggedIndex(null);
      setDragOverIndex(null);
      setAlbumDropPosition(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [cleanAlbumTracks, onUpdateAlbum, selectedAlbum]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onCreateAlbum(newTitle.trim(), newDesc.trim());
    setNewTitle('');
    setNewDesc('');
    setIsCreateModalOpen(false);
  };

  const handleOpenEditModal = (album: UserAlbum) => {
    setEditTitle(album.title);
    setEditDesc(album.description || '');
    setEditCoverArt(album.cover_art || '');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlbum || !editTitle.trim()) return;
    onUpdateAlbum?.(selectedAlbum.id, {
      title: editTitle.trim(),
      description: editDesc.trim(),
      cover_art: editCoverArt.trim() || null,
    });
    setIsEditModalOpen(false);
  };

  const formatTotalTime = (tracks: Track[]) => {
    const totalSecs = tracks.reduce((acc, t) => acc + (t.duration_secs || 0), 0);
    const mins = Math.floor(totalSecs / 60);
    return getTranslation(language, 'album.minutes', { mins });
  };

  return (
    <div className="flex-1 w-full pb-16 select-none space-y-6">
      {/* ─── MODAL TẠO ALBUM MỚI ────────────────────────────────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0a0a0d] border border-[#1e1e28] rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 text-[#777] hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div 
                className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
                style={{ 
                  backgroundColor: accentColor, 
                  color: getContrastTextColor(accentColor),
                  boxShadow: `0 0 12px ${accentColor}40`
                }}
              >
                <FolderPlus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  {getTranslation(language, 'album.modalTitle')}
                </h3>
                <p className="text-[11px] text-[#777] font-mono">
                  {getTranslation(language, 'album.modalSubtitle')}
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#aaa] mb-1.5">
                  {getTranslation(language, 'album.nameLabel')} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={getTranslation(language, 'album.namePlaceholder')}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#14141c] border border-[#22222e] text-white text-xs focus:outline-none focus:border-white/40 transition-colors"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#aaa] mb-1.5">
                  {getTranslation(language, 'album.descLabel')}
                </label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder={getTranslation(language, 'album.descPlaceholder')}
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#14141c] border border-[#22222e] text-white text-xs focus:outline-none focus:border-white/40 transition-colors resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#888] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  {getTranslation(language, 'album.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  style={{
                    backgroundColor: accentColor,
                    color: getContrastTextColor(accentColor),
                    boxShadow: `0 0 14px ${accentColor}40`,
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40 hover:opacity-90 shadow-md"
                >
                  {getTranslation(language, 'album.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL CHỈNH SỬA ALBUM (TITLE, DESCRIPTION, COVER ART) ──────── */}
      {isEditModalOpen && selectedAlbum && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0a0a0d] border border-[#1e1e28] rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 text-[#777] hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-5">
              <div 
                className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
                style={{ 
                  backgroundColor: accentColor, 
                  color: getContrastTextColor(accentColor),
                  boxShadow: `0 0 12px ${accentColor}40`
                }}
              >
                <Pencil className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  {getTranslation(language, 'album.editModalTitle')}
                </h3>
                <p className="text-[11px] text-[#777] font-mono">
                  {getTranslation(language, 'album.editModalSubtitle')}
                </p>
              </div>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              {/* Cover Art Preview & Input */}
              <div>
                <label className="block text-xs font-semibold text-[#aaa] mb-1.5 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  <span>{getTranslation(language, 'album.coverArtLabel')}</span>
                </label>

                <div className="flex items-center gap-3.5 mb-2.5">
                  <div className="w-16 h-16 rounded-xl bg-[#14141c] border border-[#222] overflow-hidden flex items-center justify-center flex-shrink-0">
                    {editCoverArt.trim() ? (
                      <img 
                        src={editCoverArt} 
                        alt="Preview" 
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500';
                        }}
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <Disc className="w-8 h-8 text-[#555]" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="url"
                      value={editCoverArt}
                      onChange={(e) => setEditCoverArt(e.target.value)}
                      placeholder={getTranslation(language, 'album.coverArtPlaceholder')}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#14141c] border border-[#22222e] text-white text-xs focus:outline-none focus:border-white/40 transition-colors"
                    />
                  </div>
                </div>

                {/* Quick Pick from tracks in this album */}
                {cleanAlbumTracks.some(t => t.cover_art) && (
                  <div>
                    <span className="text-[10px] text-[#777] font-mono block mb-1.5">
                      {getTranslation(language, 'album.chooseFromTracks')}
                    </span>
                    <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar">
                      {cleanAlbumTracks
                        .filter(t => t.cover_art)
                        .slice(0, 8)
                        .map((t, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setEditCoverArt(t.cover_art || '')}
                            className={`w-10 h-10 rounded-lg overflow-hidden border flex-shrink-0 cursor-pointer transition-transform hover:scale-105 ${
                              editCoverArt === t.cover_art ? 'border-2' : 'border-white/10 hover:border-white/40'
                            }`}
                            style={editCoverArt === t.cover_art ? { borderColor: accentColor } : undefined}
                          >
                            <img src={t.cover_art || ''} alt={t.title} className="w-full h-full object-cover" />
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#aaa] mb-1.5">
                  {getTranslation(language, 'album.nameLabel')} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#14141c] border border-[#22222e] text-white text-xs focus:outline-none focus:border-white/40 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#aaa] mb-1.5">
                  {getTranslation(language, 'album.descLabel')}
                </label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#14141c] border border-[#22222e] text-white text-xs focus:outline-none focus:border-white/40 transition-colors resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#888] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  {getTranslation(language, 'album.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!editTitle.trim()}
                  style={{
                    backgroundColor: accentColor,
                    color: getContrastTextColor(accentColor),
                    boxShadow: `0 0 14px ${accentColor}40`,
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40 hover:opacity-90 shadow-md"
                >
                  {getTranslation(language, 'album.saveChanges')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL THÊM BÀI HÁT TỪ MÁY VÀO ALBUM NÀY ───────────────── */}
      {isAddTracksModalOpen && selectedAlbum && (
        <div 
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 select-none animate-in fade-in duration-200"
          onClick={() => setIsAddTracksModalOpen(false)}
        >
          <div 
            className="w-full max-w-lg bg-[#0c0c14] border border-[#222232] rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
            style={{
              boxShadow: `0 10px 40px ${accentColor}20, 0 0 1px ${accentColor}40`
            }}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1c1c28] bg-[#111119] shrink-0">
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-8 h-8 rounded-xl flex items-center justify-center shadow-inner"
                  style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                >
                  <FolderPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    {language === 'vi' ? `Thêm bài hát vào: "${selectedAlbum.title}"` : `Add tracks to: "${selectedAlbum.title}"`}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-sans">
                    {language === 'vi' ? 'Chọn các bài hát bạn muốn đưa vào album này' : 'Select tracks from your library to add'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTracksModalOpen(false)}
                className="p-1.5 rounded-lg border border-[#222230] text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-300 font-mono font-bold">
                  {language === 'vi' 
                    ? `Đã chọn: ${selectedTracksToAdd.size} / ${candidateTracks.length}` 
                    : `Selected: ${selectedTracksToAdd.size} / ${candidateTracks.length}`}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedTracksToAdd(new Set(filteredCandidates.map(t => t.id)))}
                    className="px-2 py-0.5 rounded text-[10.5px] border border-[#222230] bg-[#14141e] text-slate-300 hover:text-white cursor-pointer"
                  >
                    {language === 'vi' ? 'Chọn tất cả' : 'Select all'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTracksToAdd(new Set())}
                    className="px-2 py-0.5 rounded text-[10.5px] border border-[#222230] bg-[#14141e] text-slate-400 hover:text-white cursor-pointer"
                  >
                    {language === 'vi' ? 'Bỏ chọn' : 'Deselect'}
                  </button>
                </div>
              </div>

              {candidateTracks.length > 3 && (
                <div className="relative">
                  <input
                    type="text"
                    value={trackSearchQuery}
                    onChange={e => setTrackSearchQuery(e.target.value)}
                    placeholder={language === 'vi' ? 'Tìm bài hát...' : 'Search tracks...'}
                    className="w-full px-3 py-1.5 bg-[#12121c] border border-[#202030] rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-white/20 transition-colors"
                  />
                </div>
              )}

              <div className="border border-[#1c1c28] rounded-xl bg-[#09090f] divide-y divide-[#141420] flex-1 overflow-y-auto">
                {candidateTracks.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    {language === 'vi' ? 'Tất cả bài hát tải xuống đã có sẵn trong album này!' : 'All downloaded tracks are already in this album!'}
                  </div>
                ) : filteredCandidates.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs">
                    {language === 'vi' ? 'Không tìm thấy bài hát phù hợp' : 'No matching tracks'}
                  </div>
                ) : (
                  filteredCandidates.map(track => {
                    const isSelected = selectedTracksToAdd.has(track.id);
                    return (
                      <div
                        key={track.id}
                        onClick={() => {
                          setSelectedTracksToAdd(prev => {
                            const next = new Set(prev);
                            if (next.has(track.id)) next.delete(track.id);
                            else next.add(track.id);
                            return next;
                          });
                        }}
                        className={`px-3 py-2 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isSelected ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                          <div 
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-transparent shadow-sm' : 'border-[#333348] bg-[#14141e]'
                            }`}
                            style={isSelected ? { backgroundColor: accentColor } : undefined}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                          </div>
                          <div className="overflow-hidden flex-1">
                            <p className="text-xs font-semibold text-white truncate">{track.title}</p>
                            <p className="text-[10px] text-slate-500 truncate">{track.artist}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="px-5 py-3 border-t border-[#1c1c28] bg-[#0e0e16] flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsAddTracksModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
              >
                {language === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={selectedTracksToAdd.size === 0}
                onClick={handleConfirmAddTracks}
                style={{
                  backgroundColor: accentColor,
                  color: getContrastTextColor(accentColor),
                  boxShadow: `0 0 14px ${accentColor}40`,
                }}
                className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40 hover:opacity-90 shadow-md flex items-center gap-1.5"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>{language === 'vi' ? `Thêm (${selectedTracksToAdd.size} bài)` : `Add (${selectedTracksToAdd.size})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── POP-UP XÁC NHẬN XÓA ALBUM ──────────────────────────────────── */}
      {albumToDelete && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 select-none animate-in fade-in duration-200"
          onClick={() => setAlbumToDelete(null)}
        >
          <div
            className="w-full max-w-md bg-[#0c0c14] border border-red-500/30 rounded-2xl p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
            style={{
              boxShadow: '0 10px 40px rgba(239, 68, 68, 0.2), 0 0 1px rgba(239, 68, 68, 0.4)',
            }}
          >
            <button
              type="button"
              onClick={() => setAlbumToDelete(null)}
              className="absolute top-4 right-4 text-[#777] hover:text-white p-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 shadow-inner">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  {language === 'vi' ? 'Xác nhận xóa Album' : 'Delete Album Confirmation'}
                </h3>
                <p className="text-[11px] text-[#888] font-mono">
                  {language === 'vi' ? 'Hành động này không thể hoàn tác' : 'This action cannot be undone'}
                </p>
              </div>
            </div>

            {/* Album Summary Card inside Pop-up */}
            <div className="p-3 rounded-xl bg-[#12121c] border border-[#222230] flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#181824] border border-white/10 shrink-0 flex items-center justify-center">
                {albumToDelete.cover_art || (albumToDelete.tracks.length > 0 && albumToDelete.tracks[0].cover_art) ? (
                  <img
                    src={optimizeThumbnailUrl(
                      albumToDelete.cover_art || albumToDelete.tracks[0].cover_art || '',
                      albumToDelete.id
                    )}
                    alt={albumToDelete.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImageError(e, albumToDelete.id)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Disc className="w-6 h-6" style={{ color: accentColor }} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{albumToDelete.title}</p>
                <p className="text-[11px] text-[#888] font-mono">
                  {getTranslation(language, 'album.trackCount', {
                    count: deduplicateTracks(albumToDelete.tracks || []).length,
                  })}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              {language === 'vi' ? (
                <>
                  Bạn có chắc chắn muốn xóa album <strong className="text-white">"{albumToDelete.title}"</strong> khỏi thư viện không?
                  <span className="block text-[11px] text-[#888] mt-1">
                    Lưu ý: Các bài hát đã được tải xuống máy của bạn sẽ vẫn được giữ nguyên.
                  </span>
                </>
              ) : (
                <>
                  Are you sure you want to delete the album <strong className="text-white">"{albumToDelete.title}"</strong>?
                  <span className="block text-[11px] text-[#888] mt-1">
                    Note: Songs already downloaded to your device will remain intact.
                  </span>
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setAlbumToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
              >
                {language === 'vi' ? 'Hủy bỏ' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const idToDelete = albumToDelete.id;
                  setAlbumToDelete(null);
                  onDeleteAlbum(idToDelete);
                  if (selectedAlbumId === idToDelete) {
                    setSelectedAlbumId(null);
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{language === 'vi' ? 'Xóa Album' : 'Delete Album'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CHI TIẾT ALBUM ĐANG CHỌN ────────────────────────────────────── */}
      {selectedAlbum ? (
        <div className="space-y-6">
          <button
            onClick={() => setSelectedAlbumId(null)}
            className="flex items-center gap-2 text-xs font-semibold text-[#888] hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{getTranslation(language, 'album.backToAll')}</span>
          </button>

          {/* Album Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0d0d12] via-[#09090c] to-black border border-[#1c1c24] flex flex-col sm:flex-row items-center gap-6 shadow-xl">
            <div className="w-36 h-36 rounded-2xl overflow-hidden bg-[#14141c] border border-[#262632] flex-shrink-0 flex items-center justify-center relative shadow-lg">
              {selectedAlbum.cover_art ? (
                <img
                  src={optimizeThumbnailUrl(selectedAlbum.cover_art, selectedAlbum.id)}
                  alt={selectedAlbum.title}
                  referrerPolicy="no-referrer"
                  onError={(e) => handleImageError(e, selectedAlbum.id)}
                  className="w-full h-full object-cover"
                />
              ) : selectedAlbum.tracks.length > 0 && selectedAlbum.tracks[0].cover_art ? (
                <img
                  src={optimizeThumbnailUrl(selectedAlbum.tracks[0].cover_art, selectedAlbum.tracks[0].path_or_url || selectedAlbum.tracks[0].id)}
                  alt={selectedAlbum.title}
                  referrerPolicy="no-referrer"
                  onError={(e) => handleImageError(e, selectedAlbum.tracks[0].path_or_url || selectedAlbum.tracks[0].id)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Disc className="w-16 h-16" style={{ color: accentColor }} />
              )}
            </div>

            <div className="flex-1 space-y-2 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <span 
                  className="text-[10px] font-mono uppercase tracking-wider font-bold px-2.5 py-0.5 rounded border"
                  style={{
                    color: accentColor,
                    backgroundColor: `${accentColor}15`,
                    borderColor: `${accentColor}30`,
                  }}
                >
                  {getTranslation(language, 'album.userBadge')}
                </span>
                {isSelectedAlbumFullyDownloaded ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider font-bold px-2.5 py-0.5 rounded border text-emerald-400 bg-emerald-500/15 border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{language === 'vi' ? `Đã tải xuống (${selectedAlbumDownloadedCount}/${cleanAlbumTracks.length})` : `Downloaded (${selectedAlbumDownloadedCount}/${cleanAlbumTracks.length})`}</span>
                  </span>
                ) : selectedAlbumDownloadedCount > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider font-bold px-2.5 py-0.5 rounded border text-cyan-400 bg-cyan-500/15 border-cyan-500/30">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{language === 'vi' ? `Đã tải ${selectedAlbumDownloadedCount}/${cleanAlbumTracks.length} bài` : `Downloaded ${selectedAlbumDownloadedCount}/${cleanAlbumTracks.length}`}</span>
                  </span>
                ) : null}
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">{selectedAlbum.title}</h1>
              {selectedAlbum.description && (
                <p className="text-xs text-[#8e8e9f] max-w-xl">{selectedAlbum.description}</p>
              )}
              <div className="text-xs text-[#666] font-mono flex items-center justify-center sm:justify-start gap-3 pt-1">
                <span>{getTranslation(language, 'album.trackCount', { count: cleanAlbumTracks.length })}</span>
                <span>•</span>
                <span>{formatTotalTime(cleanAlbumTracks)}</span>
                <span>•</span>
                <span>{getTranslation(language, 'album.createdAt')} {new Date(selectedAlbum.created_at).toLocaleDateString()}</span>
              </div>

              <div className="pt-3 flex items-center justify-center sm:justify-start gap-3 flex-wrap">
                <button
                  onClick={() => onPlayAlbum({ ...selectedAlbum, tracks: cleanAlbumTracks })}
                  disabled={cleanAlbumTracks.length === 0}
                  style={{
                    backgroundColor: accentColor,
                    color: getContrastTextColor(accentColor),
                    boxShadow: `0 0 16px ${accentColor}40`,
                  }}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-md disabled:opacity-40 hover:opacity-90"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                  <span>{getTranslation(language, 'album.playAll')}</span>
                </button>
                <button
                  onClick={() => handleOpenEditModal(selectedAlbum)}
                  className="px-4 py-2.5 rounded-xl bg-[#14141c] hover:bg-[#1f1f2c] text-white border border-[#22222e] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                  title={getTranslation(language, 'album.editAlbum')}
                >
                  <Pencil className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  <span>{getTranslation(language, 'album.editAlbum')}</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedTracksToAdd(new Set());
                    setTrackSearchQuery('');
                    setIsAddTracksModalOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#14141c] hover:bg-[#1f1f2c] text-white border border-[#22222e] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                  title={language === 'vi' ? 'Thêm bài hát từ máy vào album này' : 'Add downloaded tracks to this album'}
                >
                  <FolderPlus className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  <span>{language === 'vi' ? 'Thêm bài hát' : 'Add Tracks'}</span>
                </button>
                {!isWebShim && onDownloadAlbum && (
                  downloadingAlbumId === selectedAlbum.id ? (
                    <button
                      onClick={() => onCancelDownloadAlbum?.(selectedAlbum.id)}
                      className="px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-sm hover:shadow-rose-500/20 active:scale-95"
                      title={language === 'vi' ? 'Dừng tải album này ngay lập tức' : 'Stop downloading album'}
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>{language === 'vi' ? 'Dừng tải album' : 'Stop Download'}</span>
                    </button>
                  ) : isSelectedAlbumFullyDownloaded ? (
                    <div
                      className="px-4 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 text-xs font-semibold"
                      title={language === 'vi' ? 'Toàn bộ bài hát trong album đã được tải xuống máy' : 'All tracks in this album are downloaded'}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{language === 'vi' ? 'Đã tải xuống Album' : 'Album Downloaded'}</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => onDownloadAlbum({ ...selectedAlbum, tracks: cleanAlbumTracks })}
                      disabled={cleanAlbumTracks.length === 0 || (downloadingTrackIds && cleanAlbumTracks.some(t => downloadingTrackIds.has(t.id)))}
                      className="px-4 py-2.5 rounded-xl bg-[#14141c] hover:bg-[#1f1f2c] text-white border border-[#22222e] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold disabled:opacity-40"
                      title={language === 'vi' ? 'Tải xuống toàn bộ bài hát trong album về máy' : 'Download all tracks in this album to local disk'}
                    >
                      {downloadingTrackIds && cleanAlbumTracks.some(t => downloadingTrackIds.has(t.id)) ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: accentColor }} />
                      ) : (
                        <Download className="w-3.5 h-3.5" style={{ color: accentColor }} />
                      )}
                      <span>
                        {downloadingTrackIds && cleanAlbumTracks.some(t => downloadingTrackIds.has(t.id))
                          ? (language === 'vi' ? 'Đang tải album...' : 'Downloading...')
                          : selectedAlbumDownloadedCount > 0
                          ? (language === 'vi' ? `Tải nốt (${cleanAlbumTracks.length - selectedAlbumDownloadedCount} bài)` : `Download Remaining (${cleanAlbumTracks.length - selectedAlbumDownloadedCount})`)
                          : (language === 'vi' ? 'Tải xuống Album' : 'Download Album')}
                      </span>
                    </button>
                  )
                )}
                <button
                  onClick={() => setAlbumToDelete(selectedAlbum)}
                  className="p-2.5 rounded-xl bg-[#14141c] hover:bg-red-500/20 text-[#888] hover:text-red-400 border border-[#22222e] transition-colors cursor-pointer"
                  title={getTranslation(language, 'album.deleteTitle')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Track List */}
          <div>
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono mb-3 flex items-center gap-2">
              <Music className="w-3.5 h-3.5" style={{ color: accentColor }} />
              {getTranslation(language, 'album.trackList', { count: cleanAlbumTracks.length })}
            </h2>

            {cleanAlbumTracks.length === 0 ? (
              <div className="text-center py-12 bg-[#08080a] border border-[#161620] rounded-2xl p-6">
                <Disc className="w-10 h-10 text-[#444] mx-auto mb-2" />
                <p className="text-xs font-bold text-white">
                  {getTranslation(language, 'album.noTracks')}
                </p>
                <p className="text-[11px] text-[#666] mt-1 max-w-sm mx-auto">
                  {getTranslation(language, 'album.noTracksHint')}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {cleanAlbumTracks.map((track, idx) => {
                  const isCurrent = Boolean(
                    currentTrack && (
                      currentTrack.id === track.id ||
                      (currentTrack.path_or_url && currentTrack.path_or_url === track.path_or_url) ||
                      (currentTrack.title.trim().toLowerCase() === track.title.trim().toLowerCase() &&
                       currentTrack.artist.trim().toLowerCase() === track.artist.trim().toLowerCase())
                    )
                  );

                  return (
                    <div
                      key={track.id}
                      data-album-track-idx={idx}
                      onPointerDown={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('button, a, input')) return;
                        albumDragRef.current = {
                          startIndex: idx,
                          startX: e.clientX,
                          startY: e.clientY,
                          moved: false,
                          overIndex: null,
                          position: null,
                        };
                      }}
                      style={isCurrent ? {
                        borderColor: accentColor,
                        backgroundColor: `${accentColor}14`,
                        boxShadow: `0 0 14px ${accentColor}25`
                      } : undefined}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 group transition-all select-none relative cursor-grab active:cursor-grabbing ${
                        draggedIndex === idx ? 'opacity-30 scale-[0.98] pointer-events-none' : ''
                      } ${
                        dragOverIndex === idx && albumDropPosition === 'above'
                          ? '!border-t-2 !border-t-cyan-400 bg-cyan-500/15 shadow-[0_-3px_10px_rgba(34,211,238,0.4)]'
                          : ''
                      } ${
                        dragOverIndex === idx && albumDropPosition === 'below'
                          ? '!border-b-2 !border-b-cyan-400 bg-cyan-500/15 shadow-[0_3px_10px_rgba(34,211,238,0.4)]'
                          : ''
                      } ${
                        dragOverIndex === idx && albumDropPosition === 'swap'
                          ? '!border-2 !border-cyan-400 bg-cyan-500/20 shadow-[0_0_14px_rgba(34,211,238,0.4)] scale-[1.01]'
                          : ''
                      } ${
                        isCurrent
                          ? 'bg-[#12121c]'
                          : 'bg-[#09090c] hover:bg-[#121218] border-[#161620]'
                      }`}
                    >
                      {/* Liền trước indicator */}
                      {dragOverIndex === idx && albumDropPosition === 'above' && (
                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-cyan-400 shadow-[0_0_8px_#22d3ee] rounded-t-xl z-20 pointer-events-none" />
                      )}
                      {/* Liền sau indicator */}
                      {dragOverIndex === idx && albumDropPosition === 'below' && (
                        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-cyan-400 shadow-[0_0_8px_#22d3ee] rounded-b-xl z-20 pointer-events-none" />
                      )}
                      {/* Swap vị trí indicator */}
                      {dragOverIndex === idx && albumDropPosition === 'swap' && (
                        <div className="absolute top-2 right-2.5 px-2 py-0.5 rounded-md bg-cyan-500/30 border border-cyan-400 text-cyan-200 text-[10px] font-mono font-bold flex items-center gap-1 z-20 pointer-events-none animate-pulse shadow-md">
                          <span>⇄ Đổi vị trí (Swap)</span>
                        </div>
                      )}
                      {/* Drag Handle */}
                      <div 
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          albumDragRef.current = {
                            startIndex: idx,
                            startX: e.clientX,
                            startY: e.clientY,
                            moved: false,
                            overIndex: null,
                            position: null,
                          };
                        }}
                        className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-white px-0.5 transition-colors flex-shrink-0 touch-none"
                        title={language === 'vi' ? 'Kéo thả để đổi vị trí bài hát' : 'Drag to reorder'}
                      >
                        <GripVertical className="w-3.5 h-3.5 pointer-events-none" />
                      </div>

                      <div
                        onClick={() => {
                          if (suppressAlbumClickIdxRef.current === idx) return;
                          if (isCurrent) {
                            onTogglePlay();
                          } else {
                            onPlayTrack(track, cleanAlbumTracks);
                          }
                        }}
                        className="flex items-center gap-3 overflow-hidden flex-1 cursor-pointer"
                      >
                        {/* Col 1: Play state / Number / Equalizer Wave Animation */}
                        <div className="w-5 flex items-center justify-center flex-shrink-0">
                          {isCurrent && isPlaying ? (
                            <div className="flex items-end justify-center gap-[2.5px] h-3.5">
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
                              className={`text-xs font-mono ${isCurrent ? 'font-bold' : 'text-[#555] group-hover:text-white'}`}
                              style={{ color: isCurrent ? accentColor : undefined }}
                            >
                              {idx + 1}
                            </span>
                          )}
                        </div>

                        {/* Thumbnail */}
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-[#161620] flex-shrink-0 relative">
                          {track.cover_art ? (
                            <img
                              src={optimizeThumbnailUrl(track.cover_art, track.path_or_url || track.id)}
                              alt={track.title}
                              referrerPolicy="no-referrer"
                              onError={(e) => handleImageError(e, track.path_or_url || track.id)}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#555]">
                              <Music className="w-4 h-4" />
                            </div>
                          )}
                          <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                            isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}>
                            {isCurrent && isPlaying ? (
                              <div className="flex items-center gap-0.5">
                                <span className="w-1 h-3 bg-white rounded-xs" />
                                <span className="w-1 h-3 bg-white rounded-xs" />
                              </div>
                            ) : (
                              <Play className="w-3.5 h-3.5 fill-current text-white" />
                            )}
                          </div>
                        </div>

                        {/* Title & Artist */}
                        <div className="overflow-hidden min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p 
                              className="text-xs font-semibold truncate transition-colors"
                              style={{ color: isCurrent ? accentColor : 'white' }}
                            >
                              {track.title}
                            </p>
                            {isTrackDownloaded(track) && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[9px] font-mono font-bold text-emerald-400 px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 shrink-0"
                                title={language === 'vi' ? 'Bài hát này đã được tải xuống máy' : 'Downloaded to device'}
                              >
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>{language === 'vi' ? 'Đã tải' : 'Downloaded'}</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#8e8e9f] truncate">{track.artist}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!isWebShim && !isTrackDownloaded(track) && onDownloadTrack && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownloadTrack(track);
                            }}
                            disabled={downloadingTrackIds?.has(track.id)}
                            title={language === 'vi' ? 'Tải bài hát này về máy' : 'Download track'}
                            className="p-1.5 text-[#666] hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40"
                          >
                            {downloadingTrackIds?.has(track.id) ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: accentColor }} />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                        {isTrackDownloaded(track) && (
                          <span
                            className="flex items-center gap-1 text-[9px] font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25"
                            title={language === 'vi' ? 'Đã tải xuống máy (Offline Lossless)' : 'Downloaded Offline'}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{language === 'vi' ? 'ĐÃ TẢI • LOSSLESS' : 'DOWNLOADED'}</span>
                          </span>
                        )}
                        <span className="text-[10px] text-[#666] font-mono uppercase px-2 py-0.5 rounded bg-[#14141c]">
                          {track.source}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveTrackFromAlbum(selectedAlbum.id, track.id);
                          }}
                          className="p-1.5 text-[#555] hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                          title={getTranslation(language, 'album.removeTrack')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ─── DANH SÁCH TẤT CẢ ALBUM ────────────────────────────────────────── */
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#161620]">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <Layers className="w-5 h-5" style={{ color: accentColor }} />
                {getTranslation(language, 'album.title')}
              </h1>
              <p className="text-xs text-[#777] mt-0.5 font-mono">
                {getTranslation(language, 'album.subtitle')}
              </p>
            </div>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              style={{
                backgroundColor: accentColor,
                color: getContrastTextColor(accentColor),
                boxShadow: `0 0 12px ${accentColor}40`,
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 hover:opacity-90"
            >
              <Plus className="w-4 h-4" />
              <span>{getTranslation(language, 'album.createNew')}</span>
            </button>
          </div>

          {albums.length === 0 ? (
            <div className="text-center py-16 bg-[#08080a] border border-[#161620] rounded-2xl p-8 space-y-3">
              <div 
                className="w-14 h-14 rounded-2xl bg-[#14141c] border border-[#222] flex items-center justify-center mx-auto shadow-sm"
                style={{ color: accentColor }}
              >
                <FolderPlus className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">
                {getTranslation(language, 'album.empty')}
              </h3>
              <p className="text-xs text-[#777] max-w-sm mx-auto">
                {getTranslation(language, 'album.emptyDesc')}
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  style={{
                    backgroundColor: accentColor,
                    color: getContrastTextColor(accentColor),
                  }}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md inline-flex items-center gap-2 hover:opacity-90"
                >
                  <Plus className="w-4 h-4" />
                  <span>{getTranslation(language, 'album.createNow')}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
              {albums.map((album) => {
                const albumCleanTracks = deduplicateTracks(album.tracks || []);
                const coverArt = album.cover_art || (albumCleanTracks.length > 0 ? albumCleanTracks[0].cover_art : null);
                const albumDownloadedCount = albumCleanTracks.filter(t => isTrackDownloaded(t)).length;
                const isAlbumFullyDownloaded =
                  albumCleanTracks.length > 0 && albumDownloadedCount === albumCleanTracks.length;

                return (
                  <div
                    key={album.id}
                    onClick={() => setSelectedAlbumId(album.id)}
                    className="p-3 rounded-2xl bg-[#09090c] hover:bg-[#121218] border border-[#161620] hover:border-[#222230] transition-all flex flex-col group cursor-pointer shadow-sm"
                  >
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2.5 bg-[#14141c] border border-[#1e1e28]">
                      {coverArt ? (
                        <img
                          src={optimizeThumbnailUrl(coverArt, album.id)}
                          alt={album.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleImageError(e, album.id)}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#444] bg-gradient-to-br from-[#121218] to-[#0a0a0e]">
                          <Disc className="w-10 h-10" style={{ color: accentColor }} />
                        </div>
                      )}

                      {/* Top-left Downloaded Status Badge */}
                      {isAlbumFullyDownloaded ? (
                        <div
                          className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-500/90 text-black text-[10px] font-mono font-bold flex items-center gap-1 shadow-md z-10"
                          title={language === 'vi' ? 'Toàn bộ bài hát trong album đã được tải xuống' : 'All tracks downloaded'}
                        >
                          <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
                          <span>{language === 'vi' ? 'Đã tải' : 'Downloaded'}</span>
                        </div>
                      ) : albumDownloadedCount > 0 ? (
                        <div
                          className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/80 text-emerald-400 border border-emerald-500/40 text-[9.5px] font-mono font-bold flex items-center gap-1 shadow-md z-10"
                          title={language === 'vi' ? `Đã tải ${albumDownloadedCount}/${albumCleanTracks.length} bài hát` : `Downloaded ${albumDownloadedCount}/${albumCleanTracks.length}`}
                        >
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>{albumDownloadedCount}/{albumCleanTracks.length}</span>
                        </div>
                      ) : null}

                      {/* Top-right Delete Album Button (opens confirmation pop-up) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAlbumToDelete(album);
                        }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/75 hover:bg-red-500 text-slate-300 hover:text-white border border-white/10 hover:border-red-400 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer z-10"
                        title={language === 'vi' ? 'Xóa album này' : 'Delete this album'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (albumCleanTracks.length > 0) {
                            onPlayAlbum({ ...album, tracks: albumCleanTracks });
                          } else {
                            setSelectedAlbumId(album.id);
                          }
                        }}
                        className="absolute right-2 bottom-2 w-9 h-9 rounded-full flex items-center justify-center shadow-lg opacity-100 sm:opacity-0 sm:translate-y-2 sm:group-hover:opacity-100 sm:group-hover:translate-y-0 transition-all cursor-pointer"
                        style={{
                          backgroundColor: accentColor,
                          color: getContrastTextColor(accentColor),
                        }}
                      >
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </div>

                      {!isWebShim && (downloadingAlbumId === album.id ? (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            onCancelDownloadAlbum?.(album.id);
                          }}
                          className="absolute left-2 bottom-2 w-8 h-8 rounded-full bg-rose-600 hover:bg-rose-500 text-white border border-rose-400 flex items-center justify-center shadow-lg transition-all cursor-pointer animate-pulse z-10"
                          title={language === 'vi' ? 'Dừng tải album này' : 'Stop downloading this album'}
                        >
                          <Square className="w-3.5 h-3.5 fill-current" />
                        </div>
                      ) : isAlbumFullyDownloaded ? (
                        <div
                          className="absolute left-2 bottom-2 w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shadow-lg"
                          title={language === 'vi' ? 'Album đã được tải xuống máy' : 'Album downloaded'}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      ) : (
                        onDownloadAlbum && albumCleanTracks.some(t => !isTrackDownloaded(t)) && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownloadAlbum({ ...album, tracks: albumCleanTracks });
                            }}
                            className="absolute left-2 bottom-2 w-8 h-8 rounded-full bg-[#101018]/90 hover:bg-[#1a1a24] text-white border border-[#2a2a38] flex items-center justify-center shadow-lg opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all cursor-pointer"
                            title={language === 'vi' ? 'Tải xuống album này' : 'Download this album'}
                          >
                            <Download className="w-3.5 h-3.5" style={{ color: accentColor }} />
                          </div>
                        )
                      ))}
                    </div>

                    <p className="text-xs font-bold text-white truncate transition-colors">
                      {album.title}
                    </p>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <p className="text-[11px] text-[#777] font-mono">
                        {getTranslation(language, 'album.trackCount', { count: albumCleanTracks.length })}
                      </p>
                      {isAlbumFullyDownloaded && (
                        <span
                          className="text-emerald-400 flex items-center gap-0.5 text-[10px] font-mono font-bold"
                          title={language === 'vi' ? 'Đã tải xuống toàn bộ album' : 'Album downloaded'}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
