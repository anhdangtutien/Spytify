import { LanguageCode } from '../locales/i18n';

export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
export const EQ_LABELS = ['32Hz', '64Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz'] as const;

export interface EqualizerPreset {
  id: string;
  name: Record<LanguageCode, string>;
  gains: number[]; // 10 values in dB (-12 to +12)
  preamp?: number;
  bassBoost?: number; // 0 to 100
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
let spatialPannerNode: StereoPannerNode | null = null;
let masterGainNode: GainNode | null = null;
let analyserNode: AnalyserNode | null = null;
const connectedSources = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();

function getOrCreateAudioContext(): AudioContext | null {
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

function initAudioGraph(): boolean {
  const ctx = getOrCreateAudioContext();
  if (!ctx) return false;
  if (filterNodes.length === EQ_FREQUENCIES.length && preampNode && masterGainNode) {
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

    // Bass booster peaking node at 75Hz
    bassBoostNode = ctx.createBiquadFilter();
    bassBoostNode.type = 'lowshelf';
    bassBoostNode.frequency.value = 80;
    bassBoostNode.gain.value = 0;

    // Stereo spatial node if supported
    if (ctx.createStereoPanner) {
      spatialPannerNode = ctx.createStereoPanner();
      spatialPannerNode.pan.value = 0;
    }

    // Analyser node for real-time visual response
    analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.8;

    masterGainNode = ctx.createGain();
    masterGainNode.gain.value = 1.0;

    // Connect chain: preamp -> filters[0..N] -> bassBoost -> spatialPanner -> masterGain -> analyser -> destination
    let previousNode: AudioNode = preampNode;
    for (const filter of filterNodes) {
      previousNode.connect(filter);
      previousNode = filter;
    }

    previousNode.connect(bassBoostNode);
    previousNode = bassBoostNode;

    if (spatialPannerNode) {
      previousNode.connect(spatialPannerNode);
      previousNode = spatialPannerNode;
    }

    previousNode.connect(masterGainNode);
    masterGainNode.connect(analyserNode);
    analyserNode.connect(ctx.destination);

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
          ? parsed.gains.map((g: unknown) => (typeof g === 'number' && !isNaN(g) ? Math.max(-12, Math.min(12, g)) : 0))
          : [...DEFAULT_EQ_STATE.gains];

        return {
          enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_EQ_STATE.enabled,
          presetId: typeof parsed.presetId === 'string' ? parsed.presetId : DEFAULT_EQ_STATE.presetId,
          gains,
          preamp: typeof parsed.preamp === 'number' ? Math.max(-12, Math.min(12, parsed.preamp)) : 0,
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

  const { enabled, gains, preamp, bassBoost } = state;

  // 1. Preamp Gain
  if (preampNode) {
    const targetDb = enabled ? preamp : 0;
    const linearGain = Math.pow(10, targetDb / 20);
    preampNode.gain.setTargetAtTime(linearGain, ctx.currentTime, 0.05);
  }

  // 2. 10 Bands
  filterNodes.forEach((node, i) => {
    const targetGain = enabled ? (gains[i] ?? 0) : 0;
    node.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.05);
  });

  // 3. Bass Booster (0 to +8dB at 80Hz)
  if (bassBoostNode) {
    const extraBassDb = enabled ? (bassBoost / 100) * 8 : 0;
    bassBoostNode.gain.setTargetAtTime(extraBassDb, ctx.currentTime, 0.05);
  }
}

export function getEqualizerAnalyser(): AnalyserNode | null {
  initAudioGraph();
  return analyserNode;
}
