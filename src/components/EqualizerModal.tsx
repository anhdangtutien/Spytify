import React, { useState, useEffect, useRef } from 'react';
import { 
  X, RotateCcw, Power, Sliders, Volume2, Sparkles, 
  Headphones, Flame, Check, AlertCircle, CheckCircle2, Music, Activity,
  BookmarkPlus, Trash2, Bookmark, ChevronLeft, ChevronRight
} from 'lucide-react';
import { 
  EQ_FREQUENCIES, EQ_LABELS, EQ_PRESETS, EqualizerState, CustomEqualizerPreset,
  loadEqualizerState, saveEqualizerState, applyEqualizerStateToGraph,
  loadCustomPresets, saveCustomPreset, deleteCustomPreset
} from '../services/equalizer';
import { LanguageCode } from '../locales/i18n';
import { Track } from '../types';

const getContrastTextColor = (hexColor: string): string => {
  if (!hexColor) return '#ffffff';
  const hex = hexColor.replace('#', '');
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 140 ? '#0b0b12' : '#ffffff';
  }
  return '#ffffff';
};

interface EqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack?: Track | null;
  accentColor?: string;
  themeMode?: 'dark' | 'light';
  language?: LanguageCode;
  crossfadeDuration?: number;
  onUpdateCrossfadeDuration?: (durationSecs: number) => void;
  showVisualizer?: boolean;
  onToggleVisualizer?: () => void;
}

export const EqualizerModal: React.FC<EqualizerModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  accentColor = '#ff2a55',
  themeMode = 'dark',
  language = 'vi',
  crossfadeDuration = 0,
  onUpdateCrossfadeDuration,
  showVisualizer = false,
  onToggleVisualizer,
}) => {
  const isLight = themeMode === 'light';
  const [eqState, setEqState] = useState<EqualizerState>(() => loadEqualizerState());
  const [customPresets, setCustomPresets] = useState<CustomEqualizerPreset[]>(() => loadCustomPresets());
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const draggingBandRef = useRef<number | null>(null);

  // Horizontal Presets Scroll & Drag-to-Browse
  const presetsScrollRef = useRef<HTMLDivElement | null>(null);
  const isMouseDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const scrollPresets = (direction: 'left' | 'right') => {
    if (presetsScrollRef.current) {
      presetsScrollRef.current.scrollBy({
        left: direction === 'left' ? -160 : 160,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      const current = loadEqualizerState();
      setEqState(current);
      setCustomPresets(loadCustomPresets());
      applyEqualizerStateToGraph(current);
    }
  }, [isOpen]);

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Redraw frequency response curve whenever gains or enabled state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    // Center 0dB line
    const zeroY = height / 2;
    ctx.beginPath();
    ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.15)';
    ctx.setLineDash([4, 4]);
    ctx.moveTo(0, zeroY);
    ctx.lineTo(width, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Curve points
    const points: { x: number; y: number }[] = [];
    const numBands = EQ_FREQUENCIES.length;
    const paddingX = 25;
    const availableWidth = width - paddingX * 2;
    const stepX = availableWidth / (numBands - 1);

    for (let i = 0; i < numBands; i++) {
      const gain = eqState.enabled ? eqState.gains[i] : 0;
      // map gain (-15dB .. +15dB) to (height - 12 .. 12)
      const normalized = -gain / 15;
      const y = zeroY + normalized * (zeroY - 12);
      const x = paddingX + i * stepX;
      points.push({ x, y });
    }

    if (points.length === 0) return;

    // Gradient fill under curve
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `${accentColor}40`);
    gradient.addColorStop(0.5, `${accentColor}15`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpx = (p0.x + p1.x) / 2;
      ctx.bezierCurveTo(cpx, p0.y, cpx, p1.y, p1.x, p1.y);
    }

    // Fill to bottom
    ctx.lineTo(points[points.length - 1].x, height);
    ctx.lineTo(points[0].x, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw main glowing stroke
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpx = (p0.x + p1.x) / 2;
      ctx.bezierCurveTo(cpx, p0.y, cpx, p1.y, p1.x, p1.y);
    }
    ctx.strokeStyle = eqState.enabled ? accentColor : (isLight ? '#94a3b8' : '#475569');
    ctx.lineWidth = 2.5;
    ctx.shadowColor = eqState.enabled ? accentColor : 'transparent';
    ctx.shadowBlur = eqState.enabled ? 10 : 0;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw dots at control points
    points.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isLight ? '#ffffff' : '#0e0e17';
      ctx.fill();
      ctx.strokeStyle = eqState.enabled ? accentColor : (isLight ? '#94a3b8' : '#475569');
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [eqState, accentColor, isLight]);

  if (!isOpen) return null;

  const debouncedSave = (state: EqualizerState) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      saveEqualizerState(state);
    }, 250);
  };

  const handleToggleEnable = () => {
    const next: EqualizerState = { ...eqState, enabled: !eqState.enabled };
    setEqState(next);
    applyEqualizerStateToGraph(next);
    saveEqualizerState(next);
  };

  const handleSelectPreset = (presetId: string) => {
    const matched = EQ_PRESETS.find(p => p.id === presetId);
    if (!matched) return;
    const next: EqualizerState = {
      ...eqState,
      presetId,
      gains: [...matched.gains],
      preamp: matched.preamp ?? 0,
      bassBoost: matched.bassBoost ?? 0,
    };
    setEqState(next);
    applyEqualizerStateToGraph(next);
    saveEqualizerState(next);
  };

  const handleSelectCustomPreset = (preset: CustomEqualizerPreset) => {
    const next: EqualizerState = {
      ...eqState,
      presetId: preset.id,
      gains: [...preset.gains],
      preamp: preset.preamp,
      bassBoost: preset.bassBoost,
      spatial3D: preset.spatial3D ?? eqState.spatial3D,
    };
    setEqState(next);
    applyEqualizerStateToGraph(next);
    saveEqualizerState(next);
  };

  const handleSaveCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newPresetName.trim();
    if (!name) return;
    const created = saveCustomPreset(name, eqState);
    const updated = loadCustomPresets();
    setCustomPresets(updated);
    setNewPresetName('');
    setIsSavingPreset(false);
    const next: EqualizerState = { ...eqState, presetId: created.id };
    setEqState(next);
    saveEqualizerState(next);
  };

  const handleDeleteCustom = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deleteCustomPreset(id);
    setCustomPresets(updated);
    if (eqState.presetId === id) {
      handleSelectPreset('flat');
    }
  };

  const handleBandGainChange = (index: number, value: number) => {
    const nextGains = [...eqState.gains];
    nextGains[index] = value;
    const next: EqualizerState = {
      ...eqState,
      enabled: true,
      gains: nextGains,
      presetId: 'custom',
    };
    setEqState(next);
    applyEqualizerStateToGraph(next);
    debouncedSave(next);
  };

  const handlePreampChange = (value: number) => {
    const next: EqualizerState = { ...eqState, enabled: true, preamp: value, presetId: 'custom' };
    setEqState(next);
    applyEqualizerStateToGraph(next);
    debouncedSave(next);
  };

  const handleBassBoostChange = (value: number) => {
    const next: EqualizerState = { ...eqState, enabled: true, bassBoost: value, presetId: 'custom' };
    setEqState(next);
    applyEqualizerStateToGraph(next);
    debouncedSave(next);
  };

  const handleToggleSpatial = () => {
    const next: EqualizerState = { ...eqState, spatial3D: !eqState.spatial3D };
    setEqState(next);
    applyEqualizerStateToGraph(next);
    saveEqualizerState(next);
  };

  const handleResetToFlat = () => {
    handleSelectPreset('flat');
  };

  const updateBandFromPointer = (index: number, clientY: number, rect: DOMRect) => {
    const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height)));
    const snapped = Math.round((15 - ratio * 30) * 2) / 2;
    handleBandGainChange(index, Math.max(-15, Math.min(15, snapped)));
  };

  const isDirectAudioSource = currentTrack?.source === 'local' || currentTrack?.source === 'audius';
  const isYoutubeSource = currentTrack?.source === 'youtube';

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-2.5 sm:p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className={`relative w-full max-w-4xl max-h-[88dvh] sm:max-h-[92vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-all duration-300 ${
          isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#0b0b12] border-[#222232] text-white'
        }`}
        onClick={e => e.stopPropagation()}
        style={{
          boxShadow: eqState.enabled ? `0 10px 40px ${accentColor}25, 0 0 1px ${accentColor}50` : undefined,
        }}
      >
        {/* Top Header — Solid opaque background to prevent any background bleed */}
        <div className={`flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5 border-b shrink-0 ${isLight ? 'border-slate-200 bg-slate-100' : 'border-[#1a1a26] bg-[#101018]'}`}>
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div 
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform shadow-inner shrink-0"
              style={{ 
                backgroundColor: eqState.enabled ? `${accentColor}20` : (isLight ? '#f1f5f9' : '#1e1e2d'),
                color: eqState.enabled ? accentColor : (isLight ? '#64748b' : '#71717a'),
              }}
            >
              <Sliders className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h2 className={`text-xs sm:text-sm font-bold font-mono tracking-tight truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  <span className="sm:hidden">{language === 'vi' ? 'ÂM THANH & EQ' : 'AUDIO & EQ'}</span>
                  <span className="hidden sm:inline">{language === 'vi' ? 'CÀI ĐẶT ÂM THANH & EQ (STUDIO MIXER)' : 'AUDIO SETTINGS & EQ (STUDIO MIXER)'}</span>
                </h2>
                <span 
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase transition-colors shrink-0"
                  style={{
                    backgroundColor: eqState.enabled ? `${accentColor}25` : (isLight ? '#e2e8f0' : '#27273a'),
                    color: eqState.enabled ? accentColor : (isLight ? '#64748b' : '#94a3b8'),
                  }}
                >
                  <span className="hidden sm:inline">{eqState.enabled ? 'Hi-Fi 10-Band Active' : 'EQ Bypassed'}</span>
                  <span className="sm:hidden">{eqState.enabled ? '10-Band' : 'Off'}</span>
                </span>
              </div>
              <p className="hidden sm:block text-[10px] text-slate-400 font-sans leading-none mt-0.5">
                {language === 'vi' ? 'Bộ cân bằng tần số ngang 10-Band, Chuyển tiếp mượt & DSP' : '10-Band Studio Mixer Console, Realtime DSP & Visualizer'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Master Bypass Toggle */}
            <button
              type="button"
              onClick={handleToggleEnable}
              title={eqState.enabled ? 'Tắt bộ lọc EQ (Bypass)' : 'Bật bộ lọc EQ'}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-mono font-bold transition-all cursor-pointer border shadow-sm ${
                eqState.enabled 
                  ? 'border-transparent shadow-md'
                  : (isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-[#181824] border-[#2c2c3c] text-slate-400')
              }`}
              style={eqState.enabled ? { 
                backgroundColor: accentColor,
                color: getContrastTextColor(accentColor),
              } : undefined}
            >
              <Power className="w-3.5 h-3.5 shrink-0" />
              <span className="font-bold tracking-wider">{eqState.enabled ? 'ON' : 'OFF'}</span>
            </button>

            {/* Reset to Flat */}
            <button
              type="button"
              onClick={handleResetToFlat}
              title={language === 'vi' ? 'Đặt lại về Flat (0 dB)' : 'Reset to Flat (0 dB)'}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer border ${
                isLight ? 'border-slate-200 hover:bg-slate-100 text-slate-600' : 'border-[#22222e] hover:bg-[#1a1a26] text-slate-400 hover:text-white'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer border ${
                isLight ? 'border-slate-200 hover:bg-slate-100 text-slate-600' : 'border-[#22222e] hover:bg-[#1a1a26] text-slate-400 hover:text-white'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Responsive Console Body: 1-Column stacked on Mobile/Tablet, 2-Column on Desktop (lg+) */}
        <div className="p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch flex-1 min-h-0 overflow-y-auto overscroll-contain">
          
          {/* ─── LEFT COLUMN (5/12 on lg): Settings, Presets & Audio Enhancements ─── */}
          <div className="col-span-1 lg:col-span-5 flex flex-col justify-between space-y-2.5">
            {/* Audio Source Status Notice */}
            <div>
              {isYoutubeSource ? (
                <div className="flex items-start sm:items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[10px] font-sans">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                  <span className="line-clamp-2 sm:truncate">
                    {language === 'vi' 
                      ? 'YouTube Iframe: Sandbox không hỗ trợ EQ. Phát Audius hoặc nhạc máy trên Desktop để nghe EQ trọn vẹn!' 
                      : 'YouTube iframe sandbox cannot route to Web Audio. Play Audius or local songs to use live EQ!'}
                  </span>
                </div>
              ) : isDirectAudioSource ? (
                <div className="flex items-start sm:items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px] font-sans">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                  <span className="font-medium line-clamp-2 sm:truncate">
                    {language === 'vi' 
                      ? `Đang áp dụng EQ thời gian thực: "${currentTrack?.title}" (Hi-Fi Direct Audio)` 
                      : `Realtime EQ processing: "${currentTrack?.title}"`}
                  </span>
                </div>
              ) : (
                <div className="flex items-start sm:items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-500/20 bg-slate-500/5 text-slate-400 text-[10px] font-sans">
                  <Music className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5 sm:mt-0" />
                  <span className="line-clamp-2 sm:truncate">
                    {language === 'vi'
                      ? 'Phát nhạc từ Thư viện máy (Local) hoặc bài tải về để cảm nhận rõ nhất EQ!'
                      : 'Play local or downloaded songs to experience live audio filtering!'}
                  </span>
                </div>
              )}
            </div>

            {/* Presets Panel — Completely Wheel-Isolated & Drag-to-Scroll */}
            <div 
              onWheel={(e) => {
                // Completely stop wheel from scrolling parent modal down!
                e.stopPropagation();
              }}
              className={`p-2.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#12121a] border-[#20202e]'}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono text-slate-300 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" style={{ color: accentColor }} />
                  {language === 'vi' ? 'Cấu hình âm thanh (Presets)' : 'Sound Presets'}
                </span>
                <div className="flex items-center gap-1">
                  {/* Left / Right arrow navigation buttons */}
                  <div className="flex items-center gap-0.5 bg-black/30 rounded-md p-0.5 border border-white/5">
                    <button
                      type="button"
                      onClick={() => scrollPresets('left')}
                      title="Cuộn sang trái"
                      className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollPresets('right')}
                      title="Cuộn sang phải"
                      className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsSavingPreset(p => !p)}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9.5px] font-mono font-medium transition-all cursor-pointer border ${
                      isSavingPreset 
                        ? 'border-transparent text-white shadow-sm'
                        : isLight 
                        ? 'bg-slate-200 border-slate-300 text-slate-700 hover:bg-slate-300' 
                        : 'bg-[#1a1a28] border-[#2e2e42] text-slate-300 hover:text-white hover:bg-[#252538]'
                    }`}
                    style={isSavingPreset ? { backgroundColor: accentColor } : undefined}
                  >
                    <BookmarkPlus className="w-2.5 h-2.5" />
                    <span>{language === 'vi' ? '+ Lưu cấu hình' : '+ Save'}</span>
                  </button>
                </div>
              </div>

              {/* Inline Save Preset Form */}
              {isSavingPreset && (
                <form 
                  onSubmit={handleSaveCustom}
                  className={`flex items-center gap-1.5 p-1 rounded-lg mb-1.5 border animate-in fade-in duration-150 ${
                    isLight ? 'bg-white border-slate-300' : 'bg-[#181826] border-[#2c2c40]'
                  }`}
                >
                  <Bookmark className="w-3 h-3 ml-1 shrink-0" style={{ color: accentColor }} />
                  <input
                    type="text"
                    autoFocus
                    value={newPresetName}
                    onChange={e => setNewPresetName(e.target.value)}
                    placeholder={language === 'vi' ? 'Tên cấu hình...' : 'Preset name...'}
                    className={`flex-1 text-[10.5px] px-2 py-0.5 rounded outline-none border transition-colors ${
                      isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#0f0f18] border-[#2f2f45] text-white'
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={!newPresetName.trim()}
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-bold text-white transition-opacity disabled:opacity-40 cursor-pointer"
                    style={{ backgroundColor: accentColor }}
                  >
                    {language === 'vi' ? 'Lưu' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsSavingPreset(false); setNewPresetName(''); }}
                    className="px-1 py-0.5 text-[10px] text-slate-400 hover:text-white cursor-pointer"
                  >
                    {language === 'vi' ? 'Hủy' : 'Cancel'}
                  </button>
                </form>
              )}

              {/* Presets horizontal row — Drag-to-scroll & Wheel-isolated */}
              <div 
                ref={presetsScrollRef}
                className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 scroll-smooth cursor-grab active:cursor-grabbing select-none"
                style={{ 
                  scrollbarWidth: 'none', 
                  msOverflowStyle: 'none',
                  overscrollBehavior: 'contain',
                }}
                onWheel={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (presetsScrollRef.current) {
                    presetsScrollRef.current.scrollLeft += (e.deltaY * 1.5 || e.deltaX);
                  }
                }}
                onMouseDown={(e) => {
                  if (!presetsScrollRef.current) return;
                  isMouseDownRef.current = true;
                  startXRef.current = e.pageX - presetsScrollRef.current.offsetLeft;
                  scrollLeftRef.current = presetsScrollRef.current.scrollLeft;
                }}
                onMouseLeave={() => { isMouseDownRef.current = false; }}
                onMouseUp={() => { isMouseDownRef.current = false; }}
                onMouseMove={(e) => {
                  if (!isMouseDownRef.current || !presetsScrollRef.current) return;
                  e.preventDefault();
                  const x = e.pageX - presetsScrollRef.current.offsetLeft;
                  const walk = (x - startXRef.current) * 1.5;
                  presetsScrollRef.current.scrollLeft = scrollLeftRef.current - walk;
                }}
              >
                {/* User Custom Saved Presets */}
                {customPresets.map(preset => {
                  const isSelected = eqState.presetId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handleSelectCustomPreset(preset)}
                      className={`group px-2 py-0.5 rounded-lg text-[10.5px] font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer border flex items-center gap-1.5 ${
                        isSelected
                          ? 'border-transparent font-bold shadow-md'
                          : isLight
                          ? 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
                          : 'bg-[#181712] border-amber-500/30 text-amber-300 hover:bg-[#201e16]'
                      }`}
                      style={isSelected ? {
                        backgroundColor: `${accentColor}25`,
                        borderColor: accentColor,
                        color: accentColor,
                        boxShadow: `0 0 10px ${accentColor}30`,
                      } : undefined}
                    >
                      <Bookmark className="w-2.5 h-2.5 shrink-0 text-amber-400" />
                      <span>{preset.name}</span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteCustom(preset.id, e)}
                        title={language === 'vi' ? 'Xóa cấu hình này' : 'Delete preset'}
                        className="p-0.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 opacity-60 hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}

                {/* Default Presets */}
                {EQ_PRESETS.map(preset => {
                  const isSelected = eqState.presetId === preset.id;
                  const label = preset.name[language] || preset.name['en-US'] || preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.id)}
                      className={`px-2 py-0.5 rounded-lg text-[10.5px] font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer border flex items-center gap-1 ${
                        isSelected
                          ? 'border-transparent font-bold shadow-md'
                          : isLight
                          ? 'bg-slate-100/80 border-slate-200/60 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                          : 'bg-[#151520] border-[#242434] text-slate-400 hover:text-white hover:bg-[#1a1a28]'
                      }`}
                      style={isSelected ? {
                        backgroundColor: `${accentColor}25`,
                        borderColor: accentColor,
                        color: accentColor,
                        boxShadow: `0 0 10px ${accentColor}30`,
                      } : undefined}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 shrink-0" />}
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Playback Settings (Crossfade & Visualizer) */}
            <div className={`p-2.5 rounded-xl border grid grid-cols-1 sm:grid-cols-2 gap-2.5 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#12121a] border-[#20202e]'
            }`}>
              {/* Crossfade Transition */}
              <div className="flex flex-col justify-between gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-semibold text-slate-300 flex items-center gap-1">
                    <Sliders className="w-2.5 h-2.5" style={{ color: accentColor }} />
                    {language === 'vi' ? 'Chuyển bài mượt' : 'Crossfade'}
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1 rounded bg-white/10" style={{ color: accentColor }}>
                    {crossfadeDuration > 0 ? `${crossfadeDuration}s` : (language === 'vi' ? 'Tắt' : 'Off')}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1 w-full">
                  {[
                    { sec: 0, label: language === 'vi' ? 'Tắt' : 'Off' },
                    { sec: 3, label: '3s' },
                    { sec: 5, label: '5s ★' },
                    { sec: 8, label: '8s' },
                    { sec: 12, label: '12s' },
                  ].map(opt => {
                    const isSelected = crossfadeDuration === opt.sec;
                    return (
                      <button
                        key={opt.sec}
                        type="button"
                        onClick={() => onUpdateCrossfadeDuration?.(opt.sec)}
                        className={`py-1 sm:py-0.5 rounded text-[9.5px] font-mono transition-all cursor-pointer border text-center w-full ${
                          isSelected
                            ? 'border-transparent font-bold text-white shadow-sm'
                            : isLight
                            ? 'bg-slate-200/60 border-slate-300/60 text-slate-600 hover:bg-slate-200'
                            : 'bg-[#181824] border-[#272738] text-slate-400 hover:text-white hover:bg-[#202030]'
                        }`}
                        style={isSelected ? { 
                          backgroundColor: accentColor,
                          color: getContrastTextColor(accentColor),
                        } : undefined}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Visualizer Waveform Toggle */}
              <div className="flex items-center justify-between border-t pt-2 sm:border-t-0 sm:pt-0 sm:border-l border-white/10 sm:pl-2.5">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono font-semibold text-slate-300 flex items-center gap-1">
                    <Activity className="w-2.5 h-2.5" style={{ color: accentColor }} />
                    {language === 'vi' ? 'Sóng nhạc động' : 'Visualizer'}
                  </span>
                  <span className="text-[9px] text-slate-500 font-sans">
                    {language === 'vi' ? 'Hiệu ứng thanh phát' : 'Wave on player'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onToggleVisualizer}
                  className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ml-1.5 ${
                    showVisualizer ? '' : (isLight ? 'bg-slate-300' : 'bg-[#2b2b3a]')
                  }`}
                  style={showVisualizer ? { backgroundColor: accentColor } : undefined}
                >
                  <div 
                    className={`w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-transform ${
                      showVisualizer ? 'translate-x-4.5' : 'translate-x-1'
                    }`} 
                  />
                </button>
              </div>
            </div>

            {/* Auxiliary Sliders: Preamp, Bass Boost, 3D Spatial */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {/* Preamp */}
              <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#12121a] border-[#222230]'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9.5px] font-mono font-semibold text-slate-300 truncate">
                    Preamp
                  </span>
                  <span className="text-[9.5px] font-mono font-bold" style={{ color: accentColor }}>
                    {eqState.preamp > 0 ? `+${eqState.preamp}` : `${eqState.preamp}`}dB
                  </span>
                </div>
                <input
                  type="range"
                  min="-15"
                  max="15"
                  step="0.5"
                  value={eqState.preamp}
                  onChange={e => handlePreampChange(parseFloat(e.target.value))}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none transition-opacity touch-none"
                  style={{
                    accentColor: accentColor,
                    backgroundColor: isLight ? '#cbd5e1' : '#222232',
                    touchAction: 'none',
                  }}
                />
              </div>

              {/* Bass Boost */}
              <div className={`p-2.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#12121a] border-[#222230]'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9.5px] font-mono font-semibold text-slate-300 flex items-center gap-0.5">
                    <Flame className="w-2.5 h-2.5 text-amber-500" />
                    Bass
                  </span>
                  <span className="text-[9.5px] font-mono font-bold text-amber-500">
                    {eqState.bassBoost}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={eqState.bassBoost}
                  onChange={e => handleBassBoostChange(parseInt(e.target.value))}
                  onWheel={e => (e.target as HTMLElement).blur()}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none transition-opacity touch-none"
                  style={{
                    accentColor: '#f59e0b',
                    backgroundColor: isLight ? '#cbd5e1' : '#222232',
                    touchAction: 'none',
                  }}
                />
              </div>

              {/* 3D Spatial */}
              <div className={`col-span-2 sm:col-span-1 p-2.5 rounded-xl border flex flex-row sm:flex-col items-center sm:items-stretch justify-between ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#12121a] border-[#222230]'}`}>
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="text-[9.5px] font-mono font-semibold text-slate-300 flex items-center gap-1">
                    <Headphones className="w-3 h-3 text-cyan-400" />
                    <span>3D Audio</span>
                    <span className="sm:hidden text-[9px] text-slate-500 font-normal">
                      ({language === 'vi' ? 'Trường âm vòm' : 'Surround'})
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleSpatial}
                    className={`w-8 h-4.5 sm:w-6 sm:h-3.5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                      eqState.spatial3D ? 'bg-cyan-500' : (isLight ? 'bg-slate-300' : 'bg-[#2b2b3a]')
                    }`}
                  >
                    <div 
                      className={`w-3.5 h-3.5 sm:w-2.5 sm:h-2.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                        eqState.spatial3D ? 'translate-x-4 sm:translate-x-3' : 'translate-x-0.5'
                      }`} 
                    />
                  </button>
                </div>
                <span className="hidden sm:block text-[8.5px] text-slate-500 truncate mt-0.5">
                  {language === 'vi' ? 'Trường âm vòm' : 'Surround'}
                </span>
              </div>
            </div>
          </div>

          {/* ─── RIGHT COLUMN (7/12 on lg): 10-Band Studio Mixer Console ─── */}
          <div className="col-span-1 lg:col-span-7 flex flex-col justify-between space-y-2.5">
            {/* Real-time Frequency Response Canvas */}
            <div className={`relative rounded-xl border p-1.5 overflow-hidden ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#07070c] border-[#1c1c28]'}`}>
              <canvas 
                ref={canvasRef} 
                width={580} 
                height={55} 
                className="w-full h-[55px] sm:h-[64px] block"
              />
              <div className="absolute top-1 left-2.5 flex items-center gap-2 pointer-events-none text-[9px] font-mono text-slate-500">
                <span>+15 dB</span>
              </div>
              <div className="absolute bottom-1 left-2.5 flex items-center gap-2 pointer-events-none text-[9px] font-mono text-slate-500">
                <span>-15 dB</span>
              </div>
            </div>

            {/* 10 Touch-Friendly Vertical Faders */}
            <div className={`p-2 sm:p-2.5 rounded-xl border ${isLight ? 'bg-slate-50/60 border-slate-200' : 'bg-[#111119] border-[#1c1c28]'}`}>
              <div className="grid grid-cols-10 gap-0.5 sm:gap-1.5">
                {EQ_FREQUENCIES.map((freq, index) => {
                  const gain = eqState.gains[index] ?? 0;
                  const label = EQ_LABELS[index];
                  const topPercent = ((15 - gain) / 30) * 100;
                  const fillTop = gain >= 0 ? topPercent : 50;
                  const fillHeight = gain >= 0 ? 50 - topPercent : topPercent - 50;

                  return (
                    <div key={freq} className="flex flex-col items-center gap-1 touch-none select-none">
                      {/* Gain dB value indicator */}
                      <span 
                        className={`text-[8.5px] sm:text-[9.5px] font-mono font-bold px-0.5 rounded transition-colors ${
                          gain > 0 
                            ? 'text-emerald-400' 
                            : gain < 0 
                            ? 'text-amber-400' 
                            : 'text-slate-500'
                        }`}
                      >
                        {gain > 0 ? `+${gain}` : `${gain}`}
                      </span>

                      {/* Custom Pointer-Interactive Vertical Fader (smooth on iOS Safari, Android & Desktop) */}
                      <div
                        role="slider"
                        tabIndex={0}
                        aria-label={label}
                        aria-valuemin={-15}
                        aria-valuemax={15}
                        aria-valuenow={gain}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
                            e.preventDefault();
                            handleBandGainChange(index, Math.min(15, gain + 0.5));
                          } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
                            e.preventDefault();
                            handleBandGainChange(index, Math.max(-15, gain - 0.5));
                          }
                        }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          draggingBandRef.current = index;
                          try {
                            e.currentTarget.setPointerCapture(e.pointerId);
                          } catch {}
                          updateBandFromPointer(index, e.clientY, e.currentTarget.getBoundingClientRect());
                        }}
                        onPointerMove={(e) => {
                          if (draggingBandRef.current !== index) return;
                          e.stopPropagation();
                          updateBandFromPointer(index, e.clientY, e.currentTarget.getBoundingClientRect());
                        }}
                        onPointerUp={(e) => {
                          if (draggingBandRef.current === index) {
                            draggingBandRef.current = null;
                            try {
                              e.currentTarget.releasePointerCapture(e.pointerId);
                            } catch {}
                          }
                        }}
                        onPointerCancel={() => {
                          if (draggingBandRef.current === index) draggingBandRef.current = null;
                        }}
                        onWheel={(e) => {
                          e.stopPropagation();
                        }}
                        className="relative w-full h-24 sm:h-28 flex items-center justify-center touch-none select-none cursor-ns-resize py-1"
                        style={{ touchAction: 'none' }}
                      >
                        <div className={`relative w-1.5 sm:w-2 h-full rounded-full ${isLight ? 'bg-slate-200' : 'bg-[#1a1a28]'}`}>
                          {/* 0dB center line */}
                          <div className={`absolute left-[-3px] right-[-3px] top-1/2 -translate-y-1/2 h-[1px] ${isLight ? 'bg-slate-400/50' : 'bg-white/25'}`} />

                          {/* Active Gain Fill Bar from 0dB center */}
                          <div
                            className="absolute left-0 right-0 rounded-full transition-colors"
                            style={{
                              top: `${fillTop}%`,
                              height: `${fillHeight}%`,
                              backgroundColor: eqState.enabled ? accentColor : '#64748b',
                              opacity: eqState.enabled ? 0.85 : 0.4,
                            }}
                          />

                          {/* Glowing Fader Thumb */}
                          <div
                            className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 border-white shadow-md transition-colors"
                            style={{
                              top: `${topPercent}%`,
                              backgroundColor: eqState.enabled ? accentColor : '#64748b',
                              boxShadow: eqState.enabled ? `0 0 10px ${accentColor}90` : undefined,
                            }}
                          />
                        </div>
                      </div>

                      {/* Compact Frequency label on phones, full label on sm+ */}
                      <span className="text-[8px] sm:text-[9px] font-mono text-slate-400 font-semibold tracking-tighter">
                        <span className="sm:hidden">{label.replace('Hz', '')}</span>
                        <span className="hidden sm:inline">{label}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};