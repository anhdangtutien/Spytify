import React, { useState, useEffect, useRef } from 'react';
import { 
  X, RotateCcw, Power, Sliders, Volume2, Sparkles, 
  Headphones, Flame, Check, AlertCircle, CheckCircle2, Music, Activity
} from 'lucide-react';
import { 
  EQ_FREQUENCIES, EQ_LABELS, EQ_PRESETS, EqualizerState,
  loadEqualizerState, saveEqualizerState 
} from '../services/equalizer';
import { LanguageCode } from '../locales/i18n';
import { Track } from '../types';

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const current = loadEqualizerState();
      setEqState(current);
      // Ensure Web Audio context is active on modal open
      saveEqualizerState(current);
    }
  }, [isOpen]);

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
      // map gain (-15dB .. +15dB) to (height - 15 .. 15)
      const normalized = -gain / 15;
      const y = zeroY + normalized * (zeroY - 15);
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
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = isLight ? '#ffffff' : '#0e0e17';
      ctx.fill();
      ctx.strokeStyle = eqState.enabled ? accentColor : (isLight ? '#94a3b8' : '#475569');
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [eqState, accentColor, isLight]);

  if (!isOpen) return null;

  const handleToggleEnable = () => {
    const next: EqualizerState = { ...eqState, enabled: !eqState.enabled };
    setEqState(next);
    saveEqualizerState(next);
  };

  const handleSelectPreset = (presetId: string) => {
    const matched = EQ_PRESETS.find(p => p.id === presetId);
    if (!matched) return;
    const next: EqualizerState = {
      ...eqState,
      presetId,
      gains: [...matched.gains],
      preamp: matched.preamp ?? eqState.preamp,
      bassBoost: matched.bassBoost ?? eqState.bassBoost,
    };
    setEqState(next);
    saveEqualizerState(next);
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
    saveEqualizerState(next);
  };

  const handlePreampChange = (value: number) => {
    const next: EqualizerState = { ...eqState, preamp: value, presetId: 'custom' };
    setEqState(next);
    saveEqualizerState(next);
  };

  const handleBassBoostChange = (value: number) => {
    const next: EqualizerState = { ...eqState, bassBoost: value, presetId: 'custom' };
    setEqState(next);
    saveEqualizerState(next);
  };

  const handleToggleSpatial = () => {
    const next: EqualizerState = { ...eqState, spatial3D: !eqState.spatial3D };
    setEqState(next);
    saveEqualizerState(next);
  };

  const handleResetToFlat = () => {
    handleSelectPreset('flat');
  };

  const isDirectAudioSource = currentTrack?.source === 'local' || currentTrack?.source === 'audius';
  const isYoutubeSource = currentTrack?.source === 'youtube';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
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
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isLight ? 'border-slate-100 bg-slate-50/70' : 'border-[#1a1a24] bg-[#12121c]/60'}`}>
          <div className="flex items-center gap-3">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform shadow-inner"
              style={{ 
                backgroundColor: eqState.enabled ? `${accentColor}20` : (isLight ? '#f1f5f9' : '#1e1e2d'),
                color: eqState.enabled ? accentColor : (isLight ? '#64748b' : '#71717a'),
              }}
            >
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold font-mono tracking-tight">
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
              <p className="text-xs text-slate-400 font-sans">
                {language === 'vi' ? 'Bộ cân bằng tần số 10-Band, Chuyển tiếp mượt & Sóng nhạc' : '10-Band Equalizer, Crossfade & Audio Visualizer'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Master Bypass Toggle */}
            <button
              onClick={handleToggleEnable}
              title={eqState.enabled ? 'Tắt bộ lọc EQ (Bypass)' : 'Bật bộ lọc EQ'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border ${
                eqState.enabled 
                  ? 'border-transparent shadow-md text-white'
                  : (isLight ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-[#181824] border-[#2c2c3c] text-slate-400')
              }`}
              style={eqState.enabled ? { backgroundColor: accentColor } : undefined}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{eqState.enabled ? 'ON' : 'OFF'}</span>
            </button>

            {/* Reset to Flat */}
            <button
              onClick={handleResetToFlat}
              title={language === 'vi' ? 'Đặt lại về Flat (0 dB)' : 'Reset to Flat (0 dB)'}
              className={`p-2 rounded-lg transition-colors cursor-pointer border ${
                isLight ? 'border-slate-200 hover:bg-slate-100 text-slate-600' : 'border-[#22222e] hover:bg-[#1a1a26] text-slate-400 hover:text-white'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors cursor-pointer border ${
                isLight ? 'border-slate-200 hover:bg-slate-100 text-slate-600' : 'border-[#22222e] hover:bg-[#1a1a26] text-slate-400 hover:text-white'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Audio Source Status Notice */}
        <div className="px-6 pt-3">
          {isYoutubeSource ? (
            <div className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-sans leading-relaxed">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">
                  {language === 'vi' ? 'Đang phát qua YouTube Web Iframe' : 'Playing via YouTube Web Iframe'}
                </span>
                <p className="text-amber-200/80 mt-0.5 text-[11px]">
                  {language === 'vi' 
                    ? 'Do cơ chế bảo mật Sandbox của trình duyệt, luồng YouTube nhúng phát trực tiếp ra loa máy và không cho phép can thiệp EQ. Để cảm nhận trọn vẹn sức mạnh EQ (Bass Boost, Vocal, 3D...), bạn hãy bấm nút TẢI XUỐNG bài hát hoặc phát Nhạc trên máy (Local Music) nhé!'
                    : 'Browser sandbox limits cross-origin YouTube iframe audio from Web Audio processing. Download the song or play from Local Music to experience full Hi-Fi EQ!'}
                </p>
              </div>
            </div>
          ) : isDirectAudioSource ? (
            <div className="flex items-center gap-2 p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-sans">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-medium">
                {language === 'vi' 
                  ? `Đang áp dụng EQ thời gian thực cho: "${currentTrack?.title}" (Hi-Fi Direct Audio)` 
                  : `Realtime EQ actively processing: "${currentTrack?.title}"`}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-500/20 bg-slate-500/5 text-slate-400 text-xs font-sans">
              <Music className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                {language === 'vi'
                  ? 'Gợi ý: Phát nhạc từ Thư viện máy (Local Music) hoặc bài đã tải về để cảm nhận rõ rệt độ biến đổi âm thanh!'
                  : 'Play local or downloaded songs to experience live audio filtering!'}
              </span>
            </div>
          )}
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Quick Playback Settings (Crossfade & Visualizer) */}
          <div className={`p-3.5 rounded-xl border grid grid-cols-1 sm:grid-cols-2 gap-4 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#12121a] border-[#20202e]'
          }`}>
            {/* Crossfade Transition */}
            <div className="flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  {language === 'vi' ? 'Chuyển bài mượt (Crossfade)' : 'Crossfade Transition'}
                </span>
                <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-white/10" style={{ color: accentColor }}>
                  {crossfadeDuration > 0 ? `${crossfadeDuration}s` : (language === 'vi' ? 'Tắt' : 'Off')}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { sec: 0, label: language === 'vi' ? 'Tắt' : 'Off' },
                  { sec: 3, label: '3s' },
                  { sec: 5, label: language === 'vi' ? '5s (Khuyên dùng)' : '5s (Rec)' },
                  { sec: 8, label: '8s' },
                  { sec: 12, label: '12s' },
                ].map(opt => {
                  const isSelected = crossfadeDuration === opt.sec;
                  return (
                    <button
                      key={opt.sec}
                      type="button"
                      onClick={() => onUpdateCrossfadeDuration?.(opt.sec)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer border ${
                        isSelected
                          ? 'border-transparent font-bold text-white shadow-sm'
                          : isLight
                          ? 'bg-slate-200/60 border-slate-300/60 text-slate-600 hover:bg-slate-200'
                          : 'bg-[#181824] border-[#272738] text-slate-400 hover:text-white hover:bg-[#202030]'
                      }`}
                      style={isSelected ? { backgroundColor: accentColor } : undefined}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Visualizer Waveform Toggle */}
            <div className="flex items-center justify-between sm:border-l sm:border-white/10 sm:pl-4">
              <div className="flex flex-col">
                <span className="text-xs font-mono font-semibold text-slate-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  {language === 'vi' ? 'Sóng nhạc động (Visualizer)' : 'Audio Visualizer'}
                </span>
                <span className="text-[11px] text-slate-500 font-sans mt-0.5">
                  {language === 'vi' ? 'Hiệu ứng sóng âm thanh trên thanh phát' : 'Real-time waveform on player bar'}
                </span>
              </div>
              <button
                type="button"
                onClick={onToggleVisualizer}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ml-2 ${
                  showVisualizer ? '' : (isLight ? 'bg-slate-300' : 'bg-[#2b2b3a]')
                }`}
                style={showVisualizer ? { backgroundColor: accentColor } : undefined}
              >
                <div 
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    showVisualizer ? 'translate-x-6' : 'translate-x-1'
                  }`} 
                />
              </button>
            </div>
          </div>

          {/* Preset Pills (Now with flex-wrap so ALL PRESETS ARE IMMEDIATELY VISIBLE & CLICKABLE) */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-mono text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" style={{ color: accentColor }} />
                {language === 'vi' ? 'Cấu hình âm thanh (Presets)' : 'Sound Presets'}
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {eqState.presetId === 'custom' ? (language === 'vi' ? 'Đang tùy chỉnh riêng' : 'Custom Mode') : ''}
              </span>
            </div>

            {/* Presets in responsive wrap grid so all 10 are visible without stuck scroll */}
            <div 
              className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1"
              onWheel={(e) => {
                e.stopPropagation();
              }}
            >
              {EQ_PRESETS.map(preset => {
                const isSelected = eqState.presetId === preset.id;
                const label = preset.name[language] || preset.name['en-US'] || preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border flex items-center gap-1.5 ${
                      isSelected
                        ? 'border-transparent font-bold shadow-md'
                        : isLight
                        ? 'bg-slate-100/80 border-slate-200/60 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                        : 'bg-[#151520] border-[#242434] text-slate-400 hover:text-white hover:bg-[#1a1a28]'
                    }`}
                    style={isSelected ? {
                      backgroundColor: `${accentColor}20`,
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
              height={85} 
              className="w-full h-[85px] block"
            />
            <div className="absolute top-2 left-3 flex items-center gap-2 pointer-events-none text-[10px] font-mono text-slate-500">
              <span>+15 dB</span>
            </div>
            <div className="absolute bottom-2 left-3 flex items-center gap-2 pointer-events-none text-[10px] font-mono text-slate-500">
              <span>-15 dB</span>
            </div>
          </div>

          {/* 10 Vertical Faders */}
          <div className={`p-4 rounded-xl border ${isLight ? 'bg-slate-50/60 border-slate-200' : 'bg-[#111119] border-[#1c1c28]'}`}>
            <div className="grid grid-cols-10 gap-1 sm:gap-2">
              {EQ_FREQUENCIES.map((freq, index) => {
                const gain = eqState.gains[index] ?? 0;
                const label = EQ_LABELS[index];

                return (
                  <div key={freq} className="flex flex-col items-center gap-2">
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

                    {/* Vertical Slider */}
                    <div className="relative h-36 flex items-center justify-center">
                      <input
                        type="range"
                        min="-15"
                        max="15"
                        step="0.5"
                        value={gain}
                        disabled={!eqState.enabled}
                        onChange={e => handleBandGainChange(index, parseFloat(e.target.value))}
                        className="h-32 w-2 appearance-none rounded-full cursor-pointer accent-current outline-none transition-opacity disabled:opacity-40"
                        style={{
                          WebkitAppearance: 'slider-vertical',
                          accentColor: accentColor,
                          backgroundColor: isLight ? '#cbd5e1' : '#222232',
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
            <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#12121a] border-[#222230]'}`}>
              <div className="flex items-center justify-between mb-2">
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
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none transition-opacity disabled:opacity-40"
                style={{
                  accentColor: accentColor,
                  backgroundColor: isLight ? '#cbd5e1' : '#222232',
                }}
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                {language === 'vi' ? 'Chống vỡ tiếng khi đẩy cao bass' : 'Gain headroom compensation'}
              </span>
            </div>

            {/* Bass Boost */}
            <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#12121a] border-[#222230]'}`}>
              <div className="flex items-center justify-between mb-2">
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
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none transition-opacity disabled:opacity-40"
                style={{
                  accentColor: '#f59e0b',
                  backgroundColor: isLight ? '#cbd5e1' : '#222232',
                }}
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                {language === 'vi' ? 'Lực đập siêu trầm 80Hz' : 'Subwoofer punch boost'}
              </span>
            </div>

            {/* 3D Spatial Audio Toggle */}
            <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#12121a] border-[#222230]'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-slate-300 flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5 text-cyan-400" />
                  3D Spatial Audio
                </span>
                <button
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
              <span className="text-[10px] text-slate-500 mt-2 block">
                {language === 'vi' ? 'Mở rộng trường âm thanh tai nghe' : 'Wide immersive stereo stage'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
