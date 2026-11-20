import React, { useState, useMemo } from 'react';
import { X, FolderPlus, Check, Search, Music, Sparkles, Clock3, Disc } from 'lucide-react';
import { Track } from '../types';
import { LanguageCode, getTranslation } from '../locales/i18n';
import { getContrastTextColor, optimizeThumbnailUrl, handleImageError, sanitizeTrackTitle } from '../utils/trackUtils';

interface CreateAlbumFromSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableTracks: Track[];
  onCreateAlbum: (title: string, description: string, selectedTracks: Track[]) => void;
  language?: LanguageCode;
  accentColor?: string;
}

export const CreateAlbumFromSelectionModal: React.FC<CreateAlbumFromSelectionModalProps> = ({
  isOpen,
  onClose,
  availableTracks,
  onCreateAlbum,
  language = 'vi',
  accentColor = '#ff2a55',
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Reset state when opened
  React.useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setSelectedTrackIds(new Set());
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return availableTracks;
    const q = searchQuery.toLowerCase().trim();
    return availableTracks.filter(t => 
      t.title.toLowerCase().includes(q) || 
      t.artist.toLowerCase().includes(q)
    );
  }, [availableTracks, searchQuery]);

  if (!isOpen) return null;

  const handleToggleTrack = (trackId: string) => {
    setSelectedTrackIds(prev => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedTrackIds(new Set(filteredTracks.map(t => t.id)));
  };

  const handleDeselectAll = () => {
    setSelectedTrackIds(new Set());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || selectedTrackIds.size === 0) return;

    const chosenTracks = availableTracks.filter(t => selectedTrackIds.has(t.id));
    onCreateAlbum(title.trim(), description.trim(), chosenTracks);
    onClose();
  };

  const formatDuration = (secs: number) => {
    if (!secs || secs <= 0) return '';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div 
      className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-5 select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl bg-[#0c0c14] border border-[#222232] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{
          boxShadow: `0 10px 40px ${accentColor}20, 0 0 1px ${accentColor}40`
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1c1c28] bg-[#111119] shrink-0">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-8 h-8 rounded-xl flex items-center justify-center shadow-inner"
              style={{ 
                backgroundColor: `${accentColor}20`,
                color: accentColor,
              }}
            >
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>{language === 'vi' ? 'Tạo Album từ nhạc tải xuống' : 'Create Custom Album'}</span>
                <span 
                  className="text-[9.5px] font-mono px-2 py-0.5 rounded-full font-bold uppercase"
                  style={{
                    backgroundColor: `${accentColor}25`,
                    color: accentColor,
                  }}
                >
                  {language === 'vi' ? 'Tùy chọn thể loại' : 'Curate Songs'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-sans">
                {language === 'vi' 
                  ? 'Đặt tên album riêng (EDM, Chill, Rap...) và tích chọn các bài hát tương ứng' 
                  : 'Name your album by genre and choose specific songs to include'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[#222230] text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form & Selection Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="p-4 space-y-3.5 overflow-y-auto overscroll-contain flex-1">
            {/* Title & Description Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {language === 'vi' ? 'Tên Album (Thể loại / Playlist)' : 'Album Name'} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={language === 'vi' ? 'VD: Nhạc EDM, Lo-Fi Chill, Rap Việt...' : 'e.g. EDM Party, Lo-Fi Chill...'}
                  className="w-full px-3 py-2 bg-[#14141e] border border-[#242436] rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400/70 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {language === 'vi' ? 'Mô tả ngắn (Tùy chọn)' : 'Description (Optional)'}
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={language === 'vi' ? 'VD: Tuyển tập những bài hát năng lượng cao...' : 'Brief mood or notes...'}
                  className="w-full px-3 py-2 bg-[#14141e] border border-[#242436] rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400/70 transition-colors"
                />
              </div>
            </div>

            {/* Song Selection Toolbar */}
            <div className="pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5" style={{ color: accentColor }} />
                    {language === 'vi' ? 'Chọn bài hát đưa vào Album' : 'Select Tracks to Add'}
                  </span>
                  <span 
                    className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: selectedTrackIds.size > 0 ? `${accentColor}25` : '#181824',
                      color: selectedTrackIds.size > 0 ? accentColor : '#888',
                    }}
                  >
                    {language === 'vi' 
                      ? `Đã chọn: ${selectedTrackIds.size} / ${availableTracks.length}` 
                      : `Selected: ${selectedTrackIds.size} / ${availableTracks.length}`}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="px-2 py-1 rounded-lg text-[10.5px] font-medium border border-[#222232] bg-[#14141e] hover:bg-[#1a1a28] text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    {language === 'vi' ? 'Chọn tất cả' : 'Select All'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="px-2 py-1 rounded-lg text-[10.5px] font-medium border border-[#222232] bg-[#14141e] hover:bg-[#1a1a28] text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {language === 'vi' ? 'Bỏ chọn' : 'Deselect All'}
                  </button>
                </div>
              </div>

              {/* Search filter if there are several songs */}
              {availableTracks.length > 3 && (
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={language === 'vi' ? 'Lọc nhanh tên bài hát hoặc nghệ sĩ...' : 'Filter song or artist...'}
                    className="w-full pl-8 pr-3 py-1.5 bg-[#12121c] border border-[#202030] rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-white/20 transition-colors"
                  />
                </div>
              )}

              {/* Tracks Checkbox List */}
              <div className="border border-[#1c1c28] rounded-xl bg-[#0a0a10] divide-y divide-[#151522] max-h-64 overflow-y-auto overscroll-contain">
                {filteredTracks.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs">
                    {language === 'vi' ? 'Không tìm thấy bài hát nào' : 'No tracks found'}
                  </div>
                ) : (
                  filteredTracks.map(track => {
                    const isSelected = selectedTrackIds.has(track.id);
                    return (
                      <div
                        key={track.id}
                        onClick={() => handleToggleTrack(track.id)}
                        className={`px-3 py-2 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isSelected ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex items-center gap-3 overflow-hidden flex-1">
                          {/* Checkbox */}
                          <div 
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              isSelected 
                                ? 'border-transparent shadow-sm' 
                                : 'border-[#333348] bg-[#14141e]'
                            }`}
                            style={isSelected ? { backgroundColor: accentColor } : undefined}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                          </div>

                          {/* Thumbnail */}
                          <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#161622] shrink-0 border border-white/5 flex items-center justify-center">
                            {track.cover_art ? (
                              <img 
                                src={optimizeThumbnailUrl(track.cover_art, track.path_or_url || track.id)} 
                                alt={track.title}
                                referrerPolicy="no-referrer"
                                onError={(e) => handleImageError(e, track.path_or_url || track.id)}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Disc className="w-4 h-4 text-slate-500" />
                            )}
                          </div>

                          {/* Title & Artist */}
                          <div className="overflow-hidden flex-1">
                            <p className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                              {sanitizeTrackTitle(track.title)}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              {track.artist || 'Unknown Artist'}
                            </p>
                          </div>
                        </div>

                        {/* Duration */}
                        <div className="text-[11px] font-mono text-slate-500 shrink-0">
                          {formatDuration(track.duration_secs)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Footer Submit */}
          <div className="px-5 py-3 border-t border-[#1c1c28] bg-[#0e0e16] flex items-center justify-between shrink-0">
            <span className="text-[11px] text-slate-400 font-sans">
              {selectedTrackIds.size === 0 
                ? (language === 'vi' ? 'Hãy chọn ít nhất 1 bài hát' : 'Select at least 1 track') 
                : (language === 'vi' ? `Sẵn sàng tạo album với ${selectedTrackIds.size} bài` : `Ready to create album with ${selectedTrackIds.size} tracks`)}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                {language === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={!title.trim() || selectedTrackIds.size === 0}
                style={{
                  backgroundColor: accentColor,
                  color: getContrastTextColor(accentColor),
                  boxShadow: `0 0 14px ${accentColor}40`,
                }}
                className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40 hover:opacity-90 shadow-md flex items-center gap-1.5"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>
                  {language === 'vi' 
                    ? `Tạo Album (${selectedTrackIds.size} bài)` 
                    : `Create Album (${selectedTrackIds.size})`}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
