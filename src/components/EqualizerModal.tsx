import React, { useState, useEffect, useRef } from 'react';
import { 
  X, RotateCcw, Power, Sliders, Volume2, Sparkles, 
  Headphones, Flame, Check, AlertCircle, CheckCircle2, Music, Activity,
  BookmarkPlus, Trash2, Bookmark
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

  useEffect(() => {
    if (isOpen) {
      const current = loadEqualizerState();
      setEqState(current);
      setCustomPresets(loadCustomPresets());
      // Ensure Web Audio graph reflects state immediately
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
    const paddingX = 30;
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
      gains: nextGains,
      presetId: 'custom',
    };
    setEqState(next);
    // Instant 0ms Web Audio update!
    applyEqualizerStateToGraph(next);
    debouncedSave(next);
  };

  const handlePreampChange = (value: number) => {
    const next: EqualizerState = { ...eqState, preamp: value, presetId: 'custom' };
    setEqState(next);
    applyEqualizerStateToGraph(next);
    debouncedSave(next);
  };

  const handleBassBoostChange = (value: number) => {
    const next: EqualizerState = { ...eqState, bassBoost: value, presetId: 'custom' };
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

  const isDirectAudioSource = currentTrack?.source === 'local' || currentTrack?.source === 'audius';
  const isYoutubeSource = currentTrack?.source === 'youtube';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className={`relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden transition-all duration-300 ${
          isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#0e0e14] border-[#22222e] text-white'
        }`}
        onClick={e => e.stopPropagation()}
        style={{
          boxShadow: eqState.enabled ? `0 10px 40px ${accentColor}18, 0 0 1px ${accentColor}40` : undefined,
        }}
      >
        {/* Top Header */}
        <div className={`flex items-center justify-between px-5 py-3 border-b ${isLight ? 'border-slate-100 bg-slate-50/70' : 'border-[#1a1a24] bg-[#12121c]/60'}`}>
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-transform shadow-inner"
              style={{ 
                backgroundColor: eqState.enabled ? `${accentColor}20` : (isLight ? '#f1f5f9' : '#1e1e2d'),
                color: eqState.enabled ? accentColor : (isLight ? '#64748b' : '#71717a'),
              }}
            >
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`text-sm sm:text-base font-bold font-mono tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {language === 'vi' ? 'CÀI ĐẶT ÂM THANH & EQ' : 'AUDIO SETTINGS & EQ'}
                </h2>
                <span 
                  className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase transition-colors"
                  style={{
                    backgroundColor: eqState.enabled ? `${accentColor}25` : (isLight ? '#e2e8f0' : '#27273a'),
                    color: eqState.enabled ? accentColor : (isLight ? '#64748b' : '#94a3b8'),
                  }}
                >
                  {eqState.enabled ? 'Hi-Fi 10-Band' : 'EQ Bypassed'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans">
                {language === 'vi' ? 'Bộ cân bằng tần số 10-Band, Chuyển tiếp mượt & Sóng nhạc' : '10-Band Equalizer, Crossfade & Audio Visualizer'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Master Bypass Toggle */}
            <button
              type="button"
              onClick={handleToggleEnable}
              title={eqState.enabled ? 'Tắt bộ lọc EQ (Bypass)' : 'Bật bộ lọc EQ'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border shadow-sm ${
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

        {/* Audio Source Status Notice */}
        <div className="px-5 pt-2.5">
          {isYoutubeSource ? (
            <div className="flex items-start gap-2 p-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-sans leading-relaxed">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-[11px]">
                <span className="font-bold">
                  {language === 'vi' ? 'Đang phát qua YouTube Web Iframe: ' : 'Playing via YouTube Web Iframe: '}
                </span>
                <span className="text-amber-200/80">
                  {language === 'vi' 
                    ? 'Do sandbox trình duyệt, luồng YouTube phát ra loa không cho can thiệp EQ. Bấm TẢI XUỐNG bài hát để cảm nhận trọn vẹn EQ!' 
                    : 'Browser sandbox prevents Web Audio interception on YouTube iframe. Download song to experience full EQ!'}
                </span>
              </div>
            </div>
          ) : isDirectAudioSource ? (
            <div className="flex items-center gap-2 p-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-sans">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-medium text-[11px]">
                {language === 'vi' 
                  ? `Đang áp dụng EQ thời gian thực cho: "${currentTrack?.title}" (Hi-Fi Direct Audio)` 
                  : `Realtime EQ actively processing: "${currentTrack?.title}"`}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2 rounded-xl border border-slate-500/20 bg-slate-500/5 text-slate-400 text-xs font-sans">
              <Music className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[11px]">
                {language === 'vi'
                  ? 'Gợi ý: Phát nhạc từ Thư viện máy (Local Music) hoặc bài đã tải về để cảm nhận rõ rệt độ biến đổi âm thanh!'
                  : 'Play local or downloaded songs to experience live audio filtering!'}
              </span>
            </div>
          )}
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Quick Playback Settings (Crossfade & Visualizer) */}
          <div className={`p-3 rounded-xl border grid grid-cols-1 sm:grid-cols-2 gap-3 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#12121a] border-[#20202e]'
          }`}>
            {/* Crossfade Transition */}
            <div className="flex flex-col justify-between gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3 h-3" style={{ color: accentColor }} />
                  {language === 'vi' ? 'Chuyển bài mượt (Crossfade)' : 'Crossfade Transition'}
                </span>
                <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-white/10" style={{ color: accentColor }}>
                  {crossfadeDuration > 0 ? `${crossfadeDuration}s` : (language === 'vi' ? 'Tắt' : 'Off')}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 w-full">
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
                      className={`py-1 rounded-lg text-xs font-mono transition-all cursor-pointer border text-center w-full ${
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
            <div className="flex items-center justify-between sm:border-l sm:border-white/10 sm:pl-3">
              <div className="flex flex-col">
                <span className="text-xs font-mono font-semibold text-slate-300 flex items-center gap-1.5">
                  <Activity className="w-3 h-3" style={{ color: accentColor }} />
                  {language === 'vi' ? 'Sóng nhạc động (Visualizer)' : 'Audio Visualizer'}
                </span>
                <span className="text-[11px] text-slate-500 font-sans mt-0.5">
                  {language === 'vi' ? 'Hiệu ứng sóng âm thanh trên thanh phát' : 'Real-time waveform on player bar'}
                </span>
              </div>
              <button
                type="button"
                onClick={onToggleVisualizer}
                className={`w-10 h-5.5 rounded-full transition-colors relative cursor-pointer shrink-0 ml-2 ${
                  showVisualizer ? '' : (isLight ? 'bg-slate-300' : 'bg-[#2b2b3a]')
                }`}
                style={showVisualizer ? { backgroundColor: accentColor } : undefined}
              >
                <div 
                  className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                    showVisualizer ? 'translate-x-5' : 'translate-x-0.5'
                  }`} 
                />
              </button>
            </div>
          </div>

          {/* Preset Pills (Now with Custom Presets Save, Name & Delete!) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" style={{ color: accentColor }} />
                {language === 'vi' ? 'Cấu hình âm thanh (Presets)' : 'Sound Presets'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSavingPreset(p => !p)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium transition-all cursor-pointer border ${
                    isSavingPreset 
                      ? 'border-transparent text-white shadow-sm'
                      : isLight 
                      ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' 
                      : 'bg-[#181824] border-[#2c2c3c] text-slate-300 hover:text-white hover:bg-[#222234]'
                  }`}
                  style={isSavingPreset ? { backgroundColor: accentColor } : undefined}
                >
                  <BookmarkPlus className="w-3 h-3" />
                  <span>{language === 'vi' ? 'Lưu cấu hình' : 'Save Preset'}</span>
                </button>
                <span className="text-[11px] font-mono text-slate-500">
                  {eqState.presetId === 'custom' 
                    ? (language === 'vi' ? 'Đang chỉnh riêng' : 'Custom') 
                    : customPresets.find(p => p.id === eqState.presetId)?.name || ''}
                </span>
              </div>
            </div>

            {/* Inline Save Preset Form */}
            {isSavingPreset && (
              <form 
                onSubmit={handleSaveCustom}
                className={`flex items-center gap-2 p-2 rounded-xl mb-2.5 border animate-in fade-in duration-150 ${
                  isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#181826] border-[#2c2c40]'
                }`}
              >
                <Bookmark className="w-4 h-4 ml-1 shrink-0" style={{ color: accentColor }} />
                <input
                  type="text"
                  autoFocus
                  value={newPresetName}
                  onChange={e => setNewPresetName(e.target.value)}
                  placeholder={language === 'vi' ? 'Nhập tên cấu hình (VD: Siêu Bass, Gaming, Chill...)' : 'Preset name (e.g. Bass Boost 2026, Chill...)'}
                  className={`flex-1 text-xs px-2.5 py-1.5 rounded-lg outline-none border transition-colors ${
                    isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#0f0f18] border-[#2f2f45] text-white'
                  }`}
                />
                <button
                  type="submit"
                  disabled={!newPresetName.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-white transition-opacity disabled:opacity-40 cursor-pointer"
                  style={{ backgroundColor: accentColor }}
                >
                  {language === 'vi' ? 'Lưu' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsSavingPreset(false); setNewPresetName(''); }}
                  className={`px-2 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                    isLight ? 'text-slate-600 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {language === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
              </form>
            )}

            {/* Presets in 1 clean horizontal line with smooth horizontal scrolling */}
            <div 
              className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
              onWheel={(e) => {
                if (e.deltaY !== 0) {
                  e.currentTarget.scrollLeft += e.deltaY;
                }
              }}
            >
              {/* User Saved Custom Presets */}
              {customPresets.map(preset => {
                const isSelected = eqState.presetId === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleSelectCustomPreset(preset)}
                    className={`group px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer border flex items-center gap-1.5 ${
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
                      boxShadow: `0 0 12px ${accentColor}30`,
                    } : undefined}
                  >
                    <Bookmark className="w-3 h-3 shrink-0 text-amber-400" />
                    <span>{preset.name}</span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteCustom(preset.id, e)}
                      title={language === 'vi' ? 'Xóa cấu hình này' : 'Delete preset'}
                      className="ml-0.5 p-0.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer border flex items-center gap-1.5 ${
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
                      boxShadow: `0 0 12px ${accentColor}30`,
                    } : undefined}
                  >
                    {isSelected && <Check className="w-3 h-3 shrink-0" />}
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Real-time Frequency Response Canvas */}
          <div className={`relative rounded-xl border p-2 overflow-hidden ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#07070c] border-[#1c1c28]'}`}>
            <canvas 
              ref={canvasRef} 
              width={560} 
              height={70} 
              className="w-full h-[70px] block"
            />
            <div className="absolute top-1.5 left-3 flex items-center gap-2 pointer-events-none text-[10px] font-mono text-slate-500">
              <span>+15 dB</span>
            </div>
            <div className="absolute bottom-1.5 left-3 flex items-center gap-2 pointer-events-none text-[10px] font-mono text-slate-500">
              <span>-15 dB</span>
            </div>
          </div>

          {/* 10 Vertical Faders — Rock-solid fixed sliders, touch-none & wheel protected */}
          <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50/60 border-slate-200' : 'bg-[#111119] border-[#1c1c28]'}`}>
            <div className="grid grid-cols-10 gap-1 sm:gap-2">
              {EQ_FREQUENCIES.map((freq, index) => {
                const gain = eqState.gains[index] ?? 0;
                const label = EQ_LABELS[index];

                return (
                  <div key={freq} className="flex flex-col items-center gap-1.5 touch-none select-none">
                    {/* Gain dB value indicator */}
                    <span 
                      className={`text-[10px] font-mono font-bold px-1 rounded transition-colors ${
                        gain > 0 
                          ? 'text-emerald-400' 
                          : gain < 0 
                          ? 'text-amber-400' 
                          : 'text-slate-500'
                      }`}
                    >
                      {gain > 0 ? `+${gain}` : `${gain}`}
                    </span>

                    {/* Vertical Slider — Guaranteed fixed, no unwanted drag-down on scroll */}
                    <div 
                      className="relative h-28 flex items-center justify-center touch-none select-none"
                      onWheel={(e) => {
                        // Prevent wheel on slider from changing value or dragging slider down
                        e.stopPropagation();
                      }}
                    >
                      <input
                        type="range"
                        min="-15"
                        max="15"
                        step="0.5"
                        value={gain}
                        disabled={!eqState.enabled}
                        onChange={e => handleBandGainChange(index, parseFloat(e.target.value))}
                        onWheel={e => (e.target as HTMLElement).blur()}
                        className="h-24 w-2.5 appearance-none rounded-full cursor-pointer outline-none transition-opacity disabled:opacity-40 touch-none select-none"
                        style={{
                          WebkitAppearance: 'slider-vertical',
                          accentColor: accentColor,
                          backgroundColor: isLight ? '#cbd5e1' : '#222232',
                          touchAction: 'none',
                        }}
                      />
                    </div>

                    {/* Frequency label */}
                    <span className="text-[10px] font-mono text-slate-400 font-semibold tracking-tighter">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Auxiliary Audio Enhancement Sliders (Preamp, Bass Boost, 3D Spatial) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Preamp */}
            <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#12121a] border-[#222230]'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono font-semibold text-slate-300 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  {language === 'vi' ? 'Tiền khuếch đại' : 'Preamp'}
                </span>
                <span className="text-xs font-mono font-bold" style={{ color: accentColor }}>
                  {eqState.preamp > 0 ? `+${eqState.preamp} dB` : `${eqState.preamp} dB`}
                </span>
              </div>
              <input
                type="range"
                min="-15"
                max="15"
                step="0.5"
                value={eqState.preamp}
                disabled={!eqState.enabled}
                onChange={e => handlePreampChange(parseFloat(e.target.value))}
                onWheel={e => (e.target as HTMLElement).blur()}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none transition-opacity disabled:opacity-40 touch-none"
                style={{
                  accentColor: accentColor,
                  backgroundColor: isLight ? '#cbd5e1' : '#222232',
                  touchAction: 'none',
                }}
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                {language === 'vi' ? 'Chống vỡ tiếng khi đẩy cao bass' : 'Gain headroom compensation'}
              </span>
            </div>

            {/* Bass Boost */}
            <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#12121a] border-[#222230]'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono font-semibold text-slate-300 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  Bass Boost
                </span>
                <span className="text-xs font-mono font-bold text-amber-500">
                  {eqState.bassBoost}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={eqState.bassBoost}
                disabled={!eqState.enabled}
                onChange={e => handleBassBoostChange(parseInt(e.target.value))}
                onWheel={e => (e.target as HTMLElement).blur()}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none transition-opacity disabled:opacity-40 touch-none"
                style={{
                  accentColor: '#f59e0b',
                  backgroundColor: isLight ? '#cbd5e1' : '#222232',
                  touchAction: 'none',
                }}
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                {language === 'vi' ? 'Lực đập siêu trầm 80Hz' : 'Subwoofer punch boost'}
              </span>
            </div>

            {/* 3D Spatial Audio Toggle */}
            <div className={`p-3 rounded-xl border flex flex-col justify-between ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#12121a] border-[#222230]'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-slate-300 flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5 text-cyan-400" />
                  3D Spatial Audio
                </span>
                <button
                  type="button"
                  onClick={handleToggleSpatial}
                  className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                    eqState.spatial3D ? 'bg-cyan-500' : (isLight ? 'bg-slate-300' : 'bg-[#2b2b3a]')
                  }`}
                >
                  <div 
                    className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                      eqState.spatial3D ? 'translate-x-4.5' : 'translate-x-1'
                    }`} 
                  />
                </button>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {language === 'vi' ? 'Mở rộng trường âm thanh tai nghe' : 'Wide immersive stereo stage'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};