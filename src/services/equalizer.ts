import { LanguageCode } from '../locales/i18n';

export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
export const EQ_LABELS = ['32Hz', '64Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz'] as const;

export interface EqualizerPreset {
  id: string;
  name: Record<LanguageCode, string>;
  gains: number[]; // 10 values in dB (-15 to +15)
  preamp?: number;
  bassBoost?: number; // 0 to 100
}

export interface CustomEqualizerPreset {
  id: string;
  name: string;
  gains: number[];
  preamp: number;
  bassBoost: number;
  spatial3D?: boolean;
  createdAt: number;
}

export interface EqualizerState {
  enabled: boolean;
  presetId: string;
  gains: number[];
  preamp: number;
  bassBoost: number;
  spatial3D: boolean;
}

export const EQ_PRESETS: EqualizerPreset[] = [
  {
    id: 'flat',
    name: {
      vi: 'Cân bằng (Flat)',
      'en-US': 'Flat / Default',
      ja: 'フラット',
      'zh-CN': '均衡',
      ko: '플랫 (기본)',
    },
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    preamp: 0,
    bassBoost: 0,
  },
  {
    id: 'bass_boost',
    name: {
      vi: 'Siêu trầm (Bass Boost)',
      'en-US': 'Bass Booster',
      ja: '低音ブースト',
      'zh-CN': '低音增强',
      ko: '베이스 부스트',
    },
    gains: [7, 6, 5, 3, 1, 0, 0, 1, 2, 3],
    preamp: -1.5,
    bassBoost: 60,
  },
  {
    id: 'vocal_booster',
    name: {
      vi: 'Tôn giọng ca sĩ (Vocal)',
      'en-US': 'Vocal Booster',
      ja: 'ボーカルブースト',
      'zh-CN': '人声增强',
      ko: '보컬 부스트',
    },
    gains: [-2, -1, 0, 2, 4, 5, 3, 1, 0, -1],
    preamp: 0,
    bassBoost: 0,
  },
  {
    id: 'electronic',
    name: {
      vi: 'Nhạc điện tử (EDM / Dance)',
      'en-US': 'Electronic / Club',
      ja: 'エレクトロニック',
      'zh-CN': '电子舞曲',
      ko: '일렉트로닉',
    },
    gains: [6, 5, 2, 0, -2, 1, 2, 4, 5, 5],
    preamp: -1,
    bassBoost: 45,
  },
  {
    id: 'rock',
    name: {
      vi: 'Rock & Metal (V-Shape)',
      'en-US': 'Rock & Metal',
      ja: 'ロック / メタル',
      'zh-CN': '摇滚金属',
      ko: '록 / 메탈',
    },
    gains: [5, 4, 3, 1, -1, 0, 2, 4, 5, 5],
    preamp: -0.5,
    bassBoost: 30,
  },
  {
    id: 'hiphop',
    name: {
      vi: 'Hip-Hop & R&B',
      'en-US': 'Hip-Hop & Urban',
      ja: 'ヒップホップ',
      'zh-CN': '嘻哈',
      ko: '힙합 & R&B',
    },
    gains: [6, 5, 3, 1, -1, 0, 1, 2, 4, 4],
    preamp: -1,
    bassBoost: 50,
  },
  {
    id: 'treble_booster',
    name: {
      vi: 'Sáng tiếng (Treble Boost)',
      'en-US': 'Treble Booster',
      ja: '高音ブースト',
      'zh-CN': '高音增强',
      ko: '고음 부스트',
    },
    gains: [-1, 0, 0, 0, 1, 2, 4, 6, 8, 9],
    preamp: -0.5,
    bassBoost: 0,
  },
  {
    id: 'acoustic',
    name: {
      vi: 'Acoustic & Jazz',
      'en-US': 'Acoustic & Jazz',
      ja: 'アコースティック',
      'zh-CN': '原声与爵士',
      ko: '어쿠스틱',
    },
    gains: [3, 2, 1, 1, 2, 2, 3, 4, 4, 3],
    preamp: 0,
    bassBoost: 15,
  },
  {
    id: 'cyberpunk',
    name: {
      vi: '⚡ Cyberpunk 2077 Nightcore',
      'en-US': '⚡ Cyberpunk Nightcore',
      ja: '⚡ サイバーパンク',
      'zh-CN': '⚡ 赛博朋克',
      ko: '⚡ 사이버펑크 2077',
    },
    gains: [8, 7, 4, 1, -2, 1, 3, 6, 8, 9],
    preamp: -2,
    bassBoost: 75,
  },
  {
    id: 'custom',
    name: {
      vi: 'Tùy chỉnh riêng (Custom)',
      'en-US': 'Custom Profile',
      ja: 'カスタム',
      'zh-CN': '自定义',
      ko: '사용자 지정',
    },
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    preamp: 0,
    bassBoost: 0,
  },
];

const STORAGE_KEY = 'spytify_equalizer_settings_v1';
const CUSTOM_PRESETS_KEY = 'spytify_custom_eq_presets_v1';

export function loadCustomPresets(): CustomEqualizerPreset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.gains));
      }
    }
  } catch {}
  return [];
}

export function saveCustomPreset(name: string, state: EqualizerState): CustomEqualizerPreset {
  const customPresets = loadCustomPresets();
  const id = `custom_${Date.now()}`;
  const newPreset: CustomEqualizerPreset = {
    id,
    name: name.trim() || `Preset ${customPresets.length + 1}`,
    gains: [...state.gains],
    preamp: state.preamp,
    bassBoost: state.bassBoost,
    spatial3D: state.spatial3D,
    createdAt: Date.now(),
  };
  const updated = [newPreset, ...customPresets];
  try {
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(updated));
  } catch {}
  return newPreset;
}

export function deleteCustomPreset(id: string): CustomEqualizerPreset[] {
  const customPresets = loadCustomPresets().filter(p => p.id !== id);
  try {
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(customPresets));
  } catch {}
  return customPresets;
}

export const DEFAULT_EQ_STATE: EqualizerState = {
  enabled: true,
  presetId: 'flat',
  gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  preamp: 0,
  bassBoost: 0,
  spatial3D: false,
};

// Singleton Web Audio Nodes
let audioCtx: AudioContext | null = null;
let preampNode: GainNode | null = null;
let filterNodes: BiquadFilterNode[] = [];
let bassBoostNode: BiquadFilterNode | null = null;
let masterGainNode: GainNode | null = null;
let analyserNode: AnalyserNode | null = null;

// 3D Spatial Audio Engine Nodes (Binaural Haas Crossfeed + Diffuse Atmosphere)
let spatialDryGain: GainNode | null = null;
let spatialWetGain: GainNode | null = null;
let spatialSplitter: ChannelSplitterNode | null = null;
let spatialMerger: ChannelMergerNode | null = null;
let spatialDirectGainL: GainNode | null = null;
let spatialDirectGainR: GainNode | null = null;
let spatialDelayL: DelayNode | null = null;
let spatialDelayR: DelayNode | null = null;
let spatialFilterL: BiquadFilterNode | null = null;
let spatialFilterR: BiquadFilterNode | null = null;
let spatialCrossGainL: GainNode | null = null;
let spatialCrossGainR: GainNode | null = null;
let spatialRoomDelayL: DelayNode | null = null;
let spatialRoomDelayR: DelayNode | null = null;
let spatialRoomFilterL: BiquadFilterNode | null = null;
let spatialRoomFilterR: BiquadFilterNode | null = null;
let spatialRoomGain: GainNode | null = null;

const connectedSources = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();

export function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function ensureAudioContextRunning(): void {
  const ctx = getOrCreateAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

export function initAudioGraph(): boolean {
  const ctx = getOrCreateAudioContext();
  if (!ctx) return false;
  if (filterNodes.length === EQ_FREQUENCIES.length && preampNode && masterGainNode && spatialDryGain && spatialWetGain) {
    return true;
  }

  try {
    preampNode = ctx.createGain();
    preampNode.gain.value = 1.0;

    filterNodes = EQ_FREQUENCIES.map((freq, index) => {
      const filter = ctx.createBiquadFilter();
      filter.frequency.value = freq;
      if (index === 0) {
        filter.type = 'lowshelf';
      } else if (index === EQ_FREQUENCIES.length - 1) {
        filter.type = 'highshelf';
      } else {
        filter.type = 'peaking';
        filter.Q.value = 1.414;
      }
      filter.gain.value = 0;
      return filter;
    });

    // Bass booster peaking node at 80Hz
    bassBoostNode = ctx.createBiquadFilter();
    bassBoostNode.type = 'lowshelf';
    bassBoostNode.frequency.value = 80;
    bassBoostNode.gain.value = 0;

    // --- 3D Spatial Audio Engine (Binaural Haas Crossfeed + Diffuse Studio Ambience) ---
    spatialDryGain = ctx.createGain();
    spatialDryGain.gain.value = 1.0;

    spatialWetGain = ctx.createGain();
    spatialWetGain.gain.value = 0.0;

    spatialSplitter = ctx.createChannelSplitter(2);
    spatialMerger = ctx.createChannelMerger(2);

    // Direct binaural gains (L to L, R to R)
    spatialDirectGainL = ctx.createGain();
    spatialDirectGainL.gain.value = 0.95;
    spatialDirectGainR = ctx.createGain();
    spatialDirectGainR.gain.value = 0.95;

    // Haas Crossfeed (simulating head shadow and interaural time difference for headphone holographic stage)
    spatialDelayL = ctx.createDelay(0.1);
    spatialDelayL.delayTime.value = 0.016; // 16ms ITD
    spatialDelayR = ctx.createDelay(0.1);
    spatialDelayR.delayTime.value = 0.016;

    spatialFilterL = ctx.createBiquadFilter();
    spatialFilterL.type = 'lowpass';
    spatialFilterL.frequency.value = 2400; // head shadowing attenuates high frequencies

    spatialFilterR = ctx.createBiquadFilter();
    spatialFilterR.type = 'lowpass';
    spatialFilterR.frequency.value = 2400;

    spatialCrossGainL = ctx.createGain();
    spatialCrossGainL.gain.value = -0.38; // Haas out-of-phase crossfeed for dramatic soundstage expansion
    spatialCrossGainR = ctx.createGain();
    spatialCrossGainR.gain.value = -0.38;

    // Diffuse Room Reflection (early reflections providing open 3D room perception)
    spatialRoomDelayL = ctx.createDelay(0.1);
    spatialRoomDelayL.delayTime.value = 0.024; // 24ms
    spatialRoomDelayR = ctx.createDelay(0.1);
    spatialRoomDelayR.delayTime.value = 0.038; // 38ms asymmetric reflection

    spatialRoomFilterL = ctx.createBiquadFilter();
    spatialRoomFilterL.type = 'highshelf';
    spatialRoomFilterL.frequency.value = 3200;
    spatialRoomFilterL.gain.value = -3.5;

    spatialRoomFilterR = ctx.createBiquadFilter();
    spatialRoomFilterR.type = 'highshelf';
    spatialRoomFilterR.frequency.value = 3200;
    spatialRoomFilterR.gain.value = -3.5;

    spatialRoomGain = ctx.createGain();
    spatialRoomGain.gain.value = 0.22;

    // Analyser node for real-time visual response
    analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.8;

    masterGainNode = ctx.createGain();
    masterGainNode.gain.value = 1.0;

    // Connect chain: preamp -> filters[0..N] -> bassBoost
    let previousNode: AudioNode = preampNode;
    for (const filter of filterNodes) {
      previousNode.connect(filter);
      previousNode = filter;
    }

    previousNode.connect(bassBoostNode);

    // 1) Dry path: bassBoost -> spatialDryGain -> masterGainNode
    bassBoostNode.connect(spatialDryGain);
    spatialDryGain.connect(masterGainNode);

    // 2) 3D Wet path: bassBoost -> spatialSplitter -> [Binaural Matrix] -> spatialMerger -> spatialWetGain -> masterGainNode
    bassBoostNode.connect(spatialSplitter);

    // Direct L -> L, Direct R -> R
    spatialSplitter.connect(spatialDirectGainL, 0);
    spatialDirectGainL.connect(spatialMerger, 0, 0);

    spatialSplitter.connect(spatialDirectGainR, 1);
    spatialDirectGainR.connect(spatialMerger, 0, 1);

    // Crossfeed L -> lowpass L -> delay L -> crossGain L -> Right ear (Merger 1)
    spatialSplitter.connect(spatialFilterL, 0);
    spatialFilterL.connect(spatialDelayL);
    spatialDelayL.connect(spatialCrossGainL);
    spatialCrossGainL.connect(spatialMerger, 0, 1);

    // Crossfeed R -> lowpass R -> delay R -> crossGain R -> Left ear (Merger 0)
    spatialSplitter.connect(spatialFilterR, 1);
    spatialFilterR.connect(spatialDelayR);
    spatialDelayR.connect(spatialCrossGainR);
    spatialCrossGainR.connect(spatialMerger, 0, 0);

    // Room reflection L -> Left ear
    spatialSplitter.connect(spatialRoomFilterL, 0);
    spatialRoomFilterL.connect(spatialRoomDelayL);
    spatialRoomDelayL.connect(spatialRoomGain);
    spatialRoomGain.connect(spatialMerger, 0, 0);

    // Room reflection R -> Right ear
    spatialSplitter.connect(spatialRoomFilterR, 1);
    spatialRoomFilterR.connect(spatialRoomDelayR);
    spatialRoomDelayR.connect(spatialRoomGain);
    spatialRoomGain.connect(spatialMerger, 0, 1);

    // Wet output: merger -> spatialWetGain -> masterGainNode
    spatialMerger.connect(spatialWetGain);
    spatialWetGain.connect(masterGainNode);

    // Master -> Analyser -> Destination
    masterGainNode.connect(analyserNode);
    analyserNode.connect(ctx.destination);

    // Initialize with saved state
    const saved = loadEqualizerState();
    if (preampNode) {
      const targetDb = saved.enabled ? saved.preamp : 0;
      preampNode.gain.value = Math.pow(10, targetDb / 20);
    }
    filterNodes.forEach((node, i) => {
      node.gain.value = saved.enabled ? (saved.gains[i] ?? 0) : 0;
    });
    if (bassBoostNode) {
      bassBoostNode.gain.value = saved.enabled ? (saved.bassBoost / 100) * 15 : 0;
    }
    if (spatialDryGain && spatialWetGain) {
      const is3DActive = saved.enabled && Boolean(saved.spatial3D);
      spatialDryGain.gain.value = is3DActive ? 0.0 : 1.0;
      spatialWetGain.gain.value = is3DActive ? 1.0 : 0.0;
    }

    return true;
  } catch (err) {
    console.warn('[Equalizer] Failed to initialize Web Audio graph:', err);
    return false;
  }
}

export function loadEqualizerState(): EqualizerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const gains = Array.isArray(parsed.gains) && parsed.gains.length === EQ_FREQUENCIES.length
          ? parsed.gains.map((g: unknown) => (typeof g === 'number' && !isNaN(g) ? Math.max(-15, Math.min(15, g)) : 0))
          : [...DEFAULT_EQ_STATE.gains];

        return {
          enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_EQ_STATE.enabled,
          presetId: typeof parsed.presetId === 'string' ? parsed.presetId : DEFAULT_EQ_STATE.presetId,
          gains,
          preamp: typeof parsed.preamp === 'number' ? Math.max(-15, Math.min(15, parsed.preamp)) : 0,
          bassBoost: typeof parsed.bassBoost === 'number' ? Math.max(0, Math.min(100, parsed.bassBoost)) : 0,
          spatial3D: typeof parsed.spatial3D === 'boolean' ? parsed.spatial3D : false,
        };
      }
    }
  } catch {}
  return { ...DEFAULT_EQ_STATE };
}

export function saveEqualizerState(state: EqualizerState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
  applyEqualizerStateToGraph(state);
}

export function attachAudioElementToEqualizer(element: HTMLAudioElement | null | undefined): void {
  if (!element) return;
  const ctx = getOrCreateAudioContext();
  if (!ctx) return;

  if (!initAudioGraph() || !preampNode) return;

  if (connectedSources.has(element)) {
    return;
  }

  try {
    const sourceNode = ctx.createMediaElementSource(element);
    sourceNode.connect(preampNode);
    connectedSources.set(element, sourceNode);
  } catch (err) {
    // If element was already connected previously by browser, ignore
    console.warn('[Equalizer] attachAudioElementToEqualizer notification:', err);
  }
}

export function applyEqualizerStateToGraph(state: EqualizerState): void {
  const ctx = getOrCreateAudioContext();
  if (!ctx || !initAudioGraph()) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const { enabled, gains, preamp, bassBoost, spatial3D } = state;

  // 1. Preamp Gain (Instant 0ms real-time parameter update)
  if (preampNode) {
    const targetDb = enabled ? preamp : 0;
    const linearGain = Math.pow(10, targetDb / 20);
    preampNode.gain.cancelScheduledValues(ctx.currentTime);
    preampNode.gain.setValueAtTime(linearGain, ctx.currentTime);
    preampNode.gain.value = linearGain;
  }

  // 2. 10 Bands (Instant 0ms real-time parameter update)
  filterNodes.forEach((node, i) => {
    const targetGain = enabled ? (gains[i] ?? 0) : 0;
    node.gain.cancelScheduledValues(ctx.currentTime);
    node.gain.setValueAtTime(targetGain, ctx.currentTime);
    node.gain.value = targetGain;
  });

  // 3. Bass Booster (0 to +15dB at 80Hz, Instant 0ms real-time update)
  if (bassBoostNode) {
    const extraBassDb = enabled ? (bassBoost / 100) * 15 : 0;
    bassBoostNode.gain.cancelScheduledValues(ctx.currentTime);
    bassBoostNode.gain.setValueAtTime(extraBassDb, ctx.currentTime);
    bassBoostNode.gain.value = extraBassDb;
  }

  // 4. 3D Spatial Audio Engine (Smooth click-free transition)
  if (spatialDryGain && spatialWetGain) {
    const is3DActive = enabled && Boolean(spatial3D);
    const dryTarget = is3DActive ? 0.0 : 1.0;
    const wetTarget = is3DActive ? 1.0 : 0.0;
    spatialDryGain.gain.cancelScheduledValues(ctx.currentTime);
    spatialDryGain.gain.setTargetAtTime(dryTarget, ctx.currentTime, 0.02);
    spatialDryGain.gain.value = dryTarget;
    spatialWetGain.gain.cancelScheduledValues(ctx.currentTime);
    spatialWetGain.gain.setTargetAtTime(wetTarget, ctx.currentTime, 0.02);
    spatialWetGain.gain.value = wetTarget;
  }
}

export function getEqualizerAnalyser(): AnalyserNode | null {
  initAudioGraph();
  return analyserNode;
}
