import React, { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { User, UserStats, HistoryItem, Track } from '../types';
import { 
  User as UserIcon, LogOut, Clock, Heart, Headphones, 
  Music, RefreshCw, Disc, Palette, Camera, Upload, Trash2, 
  Check, Sparkles, Shield, Sun, Moon, Download, Database, HardDriveDownload,
  Cloud, CloudLightning, Key, ChevronDown, ChevronUp, Globe, Languages,
  Folder, FolderOpen, FolderDown, Copy, CheckCheck, ExternalLink, Zap, Power,
  Mic, Volume2, Sliders, RotateCcw, Volume1, Search, Edit3, ChevronRight,
  ShieldCheck, CheckCircle2, UserCheck, AlertCircle, Info, Lock
} from 'lucide-react';
import { 
  getStoredSupabaseConfig, getCustomSupabaseConfig, saveStoredSupabaseConfig, resetToDefaultSupabase,
  isSupabaseConfigured, cloudSyncPush, cloudSyncPull, SUPABASE_SCHEMA_SQL, testSupabaseConnection
} from '../services/supabase';
import { checkGitHubUpdate, CURRENT_VERSION, UpdateInfo } from '../services/updater';
import { LanguageCode, SUPPORTED_LANGUAGES, getTranslation } from '../locales/i18n';

interface ProfileViewProps {
  currentUser: User | null;
  accentColor: string;
  themeMode: 'dark' | 'light';
  onUpdateAccentColor: (color: string) => void;
  onToggleThemeMode: () => void;
  onUpdateAvatar: (avatarBase64: string) => void;
  onLogout: () => void;
  onOpenAuth: () => void;
  onPlayTrack: (track: Track) => void;
  language?: LanguageCode;
  onUpdateLanguage?: (lang: LanguageCode) => void;
  downloadFolder?: string;
  onChangeDownloadFolder?: () => void;
  onOpenDownloadFolder?: () => void;
  onOpenUpdateModal?: (info: UpdateInfo) => void;
}

// 8 Curated Spy / Classified Theme Colors
export const THEME_PALETTE = [
  { key: 'crimson', name: 'Crimson Red', hex: '#FF2A55', desc: 'Báo động đỏ (Mặc định)' },
  { key: 'cyan', name: 'Cyber Cyan', hex: '#00E5FF', desc: 'Công nghệ Neon' },
  { key: 'gold', name: 'Solar Gold', hex: '#FFE600', desc: 'Đặc vụ Hoàng kim' },
  { key: 'green', name: 'Matrix Green', hex: '#10B981', desc: 'Mạng ngầm Terminal' },
  { key: 'violet', name: 'Phantom Violet', hex: '#A855F7', desc: 'Bóng ma Tàng hình' },
  { key: 'white', name: 'Titanium White', hex: '#FFFFFF', desc: 'Đơn sắc Tối giản' },
  { key: 'orange', name: 'Agent Orange', hex: '#FF6B00', desc: 'Tác chiến Sa mạc' },
  { key: 'blue', name: 'Cobalt Blue', hex: '#3B82F6', desc: 'Tình báo Biển sâu' },
];

// 6 Secret Agent SVG Preset Avatars
export const SPY_AVATARS = [
  {
    id: '007',
    name: 'Cyber Agent 007',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%230c0c10" rx="20"/><ellipse cx="50" cy="40" rx="35" ry="7" fill="%23ff2a55"/><path d="M28 40 C28 20 72 20 72 40 Z" fill="%23ffffff"/><path d="M28 36 C35 34 65 34 72 36" stroke="%23ff2a55" stroke-width="3" fill="none"/><rect x="30" y="47" width="17" height="10" rx="3" fill="%23111" stroke="%23fff" stroke-width="1.5"/><rect x="53" y="47" width="17" height="10" rx="3" fill="%23111" stroke="%23fff" stroke-width="1.5"/><line x1="47" y1="50" x2="53" y2="50" stroke="%23fff" stroke-width="2"/><polygon points="50,68 35,95 65,95" fill="%23ffffff"/><polygon points="50,75 42,95 58,95" fill="%23000000"/><circle cx="50" cy="74" r="3" fill="%23ff2a55"/></svg>`
  },
  {
    id: 'cyber',
    name: 'Cyber Hacker',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23050a0a" rx="20"/><circle cx="50" cy="45" r="24" fill="%230f1717" stroke="%2300e5ff" stroke-width="2"/><path d="M30 42 C35 39 65 39 70 42 L68 52 C60 55 40 55 32 52 Z" fill="%2300e5ff"/><line x1="20" y1="75" x2="80" y2="75" stroke="%2300e5ff" stroke-width="1" stroke-dasharray="3,3"/><path d="M25 90 C25 72 75 72 75 90 Z" fill="%230a1919" stroke="%2300e5ff" stroke-width="1.5"/><circle cx="50" cy="47" r="2" fill="%23fff"/></svg>`
  },
  {
    id: 'gold',
    name: 'Golden Eye',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23121006" rx="20"/><circle cx="50" cy="50" r="32" fill="none" stroke="%23ffe600" stroke-width="2" stroke-dasharray="6,4"/><circle cx="50" cy="50" r="20" fill="%231c1808" stroke="%23ffe600" stroke-width="3"/><circle cx="50" cy="50" r="10" fill="%23ffe600"/><circle cx="47" cy="47" r="3" fill="%23ffffff"/><line x1="12" y1="50" x2="88" y2="50" stroke="%23ffe600" stroke-width="1.5"/><line x1="50" y1="12" x2="50" y2="88" stroke="%23ffe600" stroke-width="1.5"/></svg>`
  },
  {
    id: 'ninja',
    name: 'Phantom Shadow',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%230e0a14" rx="20"/><path d="M22 90 C22 30 78 30 78 90 Z" fill="%23191224" stroke="%23a855f7" stroke-width="2"/><path d="M32 46 C35 43 65 43 68 46 L66 56 C60 58 40 58 34 56 Z" fill="%2307050a"/><polygon points="36,50 44,48 43,52" fill="%23a855f7"/><polygon points="64,50 56,48 57,52" fill="%23a855f7"/><circle cx="40" cy="50" r="1.5" fill="%23fff"/><circle cx="60" cy="50" r="1.5" fill="%23fff"/></svg>`
  },
  {
    id: 'dj',
    name: 'Covert DJ',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%230a120d" rx="20"/><path d="M25 45 A 25 25 0 0 1 75 45" fill="none" stroke="%2310b981" stroke-width="5" stroke-linecap="round"/><rect x="20" y="40" width="10" height="22" rx="5" fill="%2310b981"/><rect x="70" y="40" width="10" height="22" rx="5" fill="%2310b981"/><circle cx="50" cy="50" r="18" fill="%23122419"/><path d="M37 50 L42 46 L47 54 L52 45 L57 53 L63 50" fill="none" stroke="%2310b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  },
  {
    id: 'viper',
    name: 'Viper Spec-Ops',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23120c08" rx="20"/><polygon points="50,22 76,36 76,68 50,86 24,68 24,36" fill="%231f1610" stroke="%23ff6b00" stroke-width="2.5"/><line x1="32" y1="48" x2="68" y2="48" stroke="%23ff6b00" stroke-width="3"/><line x1="38" y1="56" x2="62" y2="56" stroke="%23ff6b00" stroke-width="2"/><circle cx="50" cy="48" r="4" fill="%23ffffff"/><circle cx="50" cy="48" r="8" fill="none" stroke="%23ff6b00" stroke-width="1.5" stroke-dasharray="2,2"/></svg>`
  }
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  accentColor,
  themeMode,
  onUpdateAccentColor,
  onToggleThemeMode,
  onUpdateAvatar,
  onLogout,
  onOpenAuth,
  onPlayTrack,
  language = 'vi',
  onUpdateLanguage,
  downloadFolder = '',
  onChangeDownloadFolder,
  onOpenDownloadFolder,
  onOpenUpdateModal,
}) => {
  const [stats, setStats] = useState<UserStats>({ total_played: 0, favorite_count: 0, top_artist: null });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  // Close to Tray, Launch on Startup & Updater state
  const [closeToTray, setCloseToTray] = useState<boolean>(() => {
    const saved = localStorage.getItem('spytify_close_to_tray');
    return saved !== 'false';
  });
  const [launchOnStartup, setLaunchOnStartup] = useState<boolean>(() => {
    try {
      return localStorage.getItem('spytify_launch_on_startup') === 'true';
    } catch {
      return false;
    }
  });
  const [isTogglingStartup, setIsTogglingStartup] = useState(false);
  const [launchStartupMsg, setLaunchStartupMsg] = useState<string | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStatusMsg, setUpdateStatusMsg] = useState<string | null>(null);
  const [userBio, setUserBio] = useState(() => {
    try {
      return localStorage.getItem('spytify_user_bio') || 'Đang khám phá âm nhạc trên Spytify.';
    } catch {
      return 'Đang khám phá âm nhạc trên Spytify.';
    }
  });
  const [isEditingBio, setIsEditingBio] = useState(false);

  useEffect(() => {
    invoke<boolean>('get_launch_on_startup')
      .then((enabled) => {
        const val = Boolean(enabled);
        setLaunchOnStartup(val);
        try {
          localStorage.setItem('spytify_launch_on_startup', val ? 'true' : 'false');
        } catch {}
      })
      .catch(() => {});
  }, []);

  const handleToggleLaunchOnStartup = async (enabled: boolean) => {
    setIsTogglingStartup(true);
    setLaunchStartupMsg(null);
    try {
      const actual = await invoke<boolean>('set_launch_on_startup', { enabled });
      setLaunchOnStartup(Boolean(actual));
      try {
        localStorage.setItem('spytify_launch_on_startup', actual ? 'true' : 'false');
      } catch {}
      setLaunchStartupMsg(
        actual ? 'Đã bật khởi động cùng Windows!' : 'Đã tắt khởi động cùng Windows.'
      );
    } catch (e: any) {
      setLaunchStartupMsg(typeof e === 'string' ? e : e?.message || 'Không thể thay đổi cài đặt khởi động Windows.');
    } finally {
      setIsTogglingStartup(false);
    }
  };

  const handleToggleCloseToTray = async (enabled: boolean) => {
    setCloseToTray(enabled);
    localStorage.setItem('spytify_close_to_tray', enabled ? 'true' : 'false');
    try {
      await invoke('set_close_to_tray', { enabled });
    } catch (e) {
      console.warn('Failed to set close to tray in backend:', e);
    }
  };

  const handleManualCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateStatusMsg(null);
    try {
      const res = await checkGitHubUpdate(true);
      if (res && res.hasUpdate && res.info) {
        if (onOpenUpdateModal) {
          onOpenUpdateModal(res.info);
        }
      } else if (res && res.error) {
        setUpdateStatusMsg('Lỗi kiểm tra: ' + res.error);
        setTimeout(() => setUpdateStatusMsg(null), 6000);
      } else {
        const ver = res?.info?.version || `v${CURRENT_VERSION}`;
        setUpdateStatusMsg(`Bạn đang dùng bản mới nhất (${ver})!`);
        setTimeout(() => setUpdateStatusMsg(null), 4000);
      }
    } catch (e: any) {
      setUpdateStatusMsg('Không thể kiểm tra cập nhật: ' + (e?.message || e));
      setTimeout(() => setUpdateStatusMsg(null), 5000);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  // Supabase Cloud State (Only custom settings are editable; system default keys are never exposed in input boxes)
  const [supabaseConfig, setSupabaseConfig] = useState(getCustomSupabaseConfig());
  const [showSupabaseSettings, setShowSupabaseSettings] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [cloudStatusMsg, setCloudStatusMsg] = useState<string | null>(null);

  // Voice & Audio Settings State (Mic & Speaker)
  const [voiceMicVolume, setVoiceMicVolume] = useState<number>(() => {
    try {
      const v = localStorage.getItem('spytify_mic_volume');
      return v ? parseInt(v, 10) : 100;
    } catch {
      return 100;
    }
  });

  const [voiceSpeakerVolume, setVoiceSpeakerVolume] = useState<number>(() => {
    try {
      const v = localStorage.getItem('spytify_speaker_volume');
      return v ? parseInt(v, 10) : 100;
    } catch {
      return 100;
    }
  });

  const handleUpdateMicVolume = (val: number) => {
    setVoiceMicVolume(val);
    localStorage.setItem('spytify_mic_volume', String(val));
  };

  const handleUpdateSpeakerVolume = (val: number) => {
    setVoiceSpeakerVolume(val);
    localStorage.setItem('spytify_speaker_volume', String(val));
  };

  const playSpeakerTestChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      const volumeLevel = Math.max(0, Math.min(2, voiceSpeakerVolume / 100)) * 0.25;
      gain.gain.setValueAtTime(volumeLevel, now);
      gain.connect(ctx.destination);

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(523.25, now);
      osc1.frequency.exponentialRampToValueAtTime(1046.5, now + 0.25);
      osc2.frequency.setValueAtTime(659.25, now);
      osc2.frequency.exponentialRampToValueAtTime(1318.5, now + 0.25);

      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain);
      osc2.connect(gain);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.5);
      osc2.stop(now + 0.5);
      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 600);
    } catch {}
  };

  const loadUserData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [s, h] = await Promise.all([
        invoke<UserStats>('db_get_stats', { userId: currentUser.id }),
        invoke<HistoryItem[]>('db_get_history', { userId: currentUser.id, limit: 30 }),
      ]);
      setStats(s);
      setHistory(h);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, [currentUser]);

  // Handle image upload from computer: resize to 256x256 Base64 JPEG
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const minSide = Math.min(img.width, img.height);
          const startX = (img.width - minSide) / 2;
          const startY = (img.height - minSide) / 2;
          ctx.drawImage(img, startX, startY, minSide, minSide, 0, 0, 256, 256);
          const base64Jpeg = canvas.toDataURL('image/jpeg', 0.85);
          onUpdateAvatar(base64Jpeg);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleClearAvatar = () => {
    onUpdateAvatar('');
  };

  // ──────────────── SUPABASE CLOUD SYNC ACTIONS ────────────────
  const [copiedSql, setCopiedSql] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    setCloudStatusMsg('✅ Đã sao chép toàn bộ mã SQL khởi tạo vào Clipboard!');
    setTimeout(() => {
      setCopiedSql(false);
      setCloudStatusMsg(null);
    }, 4000);
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    if (supabaseConfig.url && supabaseConfig.anonKey) {
      saveStoredSupabaseConfig(supabaseConfig.url, supabaseConfig.anonKey);
    }
    const res = await testSupabaseConnection();
    setCloudStatusMsg(res.message);
    setIsTestingConnection(false);
    setTimeout(() => setCloudStatusMsg(null), 6000);
  };

  const handleSaveSupabase = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoredSupabaseConfig(supabaseConfig.url, supabaseConfig.anonKey);
    setSupabaseConfig(getCustomSupabaseConfig());
    setCloudStatusMsg(supabaseConfig.url ? 'Đã lưu cấu hình cơ sở dữ liệu riêng!' : 'Đã chuyển về sử dụng Cloud mặc định!');
    setTimeout(() => setCloudStatusMsg(null), 3000);
  };

  const handleResetToDefaultSupabase = () => {
    resetToDefaultSupabase();
    setSupabaseConfig(getCustomSupabaseConfig());
    setCloudStatusMsg('Đã đặt lại về Cloud mặc định của Spytify!');
    setTimeout(() => setCloudStatusMsg(null), 3000);
  };

  const handleTriggerCloudSync = async () => {
    if (!currentUser) {
      alert('Vui lòng đăng nhập tài khoản trước khi đồng bộ Cloud.');
      return;
    }
    if (!isSupabaseConfigured()) {
      setShowSupabaseSettings(true);
      alert('Vui lòng nhập Supabase Project URL và Anon Key bên dưới để bắt đầu đồng bộ.');
      return;
    }

    setIsCloudSyncing(true);
    setCloudStatusMsg('Đang đồng bộ dữ liệu với Supabase Cloud...');

    try {
      // 1. Pull data from Cloud first
      const cloudData = await cloudSyncPull(currentUser.id);
      if (cloudData) {
        if (cloudData.albums && cloudData.albums.length > 0) {
          localStorage.setItem('spytify_user_albums', JSON.stringify(cloudData.albums));
        }
        if (cloudData.avatar && !currentUser.avatar) {
          onUpdateAvatar(cloudData.avatar);
        }
        if (cloudData.accentColor && cloudData.accentColor !== accentColor) {
          onUpdateAccentColor(cloudData.accentColor);
        }
      }

      if (cloudData && cloudData.history && cloudData.history.length > 0) {
        // Insert remote history into local SQLite if missing
        for (const h of cloudData.history) {
          let trk: any = h.track_json ? (typeof h.track_json === 'string' ? JSON.parse(h.track_json) : h.track_json) : null;
          if (!trk) {
            trk = {
              id: h.track_id,
              title: h.track_title,
              artist: h.artist,
              album: 'History Track',
              duration_secs: h.duration_secs,
              path_or_url: h.path_or_url || h.track_id,
              cover_art: h.cover_art,
              source: h.source || 'youtube',
            };
          }
          invoke('db_add_history', { userId: currentUser.id, track: trk }).catch(console.error);
        }
        setHistory(cloudData.history);
      }

      // 2. Push current local state to Cloud
      const storedAlbums = localStorage.getItem('spytify_user_albums');
      const localAlbums = storedAlbums ? JSON.parse(storedAlbums) : [];
      await cloudSyncPush(currentUser.id, {
        albums: localAlbums,
        avatar: currentUser.avatar || '',
        accentColor: accentColor,
        themeMode: themeMode,
        language: language,
        history: history.slice(0, 30),
      });

      setCloudStatusMsg('Đồng bộ Cloud thành công 100%!');
      setTimeout(() => setCloudStatusMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setCloudStatusMsg('Lỗi khi đồng bộ Cloud.');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const applyBackupContent = (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.albums && Array.isArray(data.albums)) {
        localStorage.setItem('spytify_user_albums', JSON.stringify(data.albums));
      }
      if (data.avatar) {
        onUpdateAvatar(data.avatar);
      }
      if (data.accentColor) {
        onUpdateAccentColor(data.accentColor);
      }
      if (data.themeMode && data.themeMode !== themeMode) {
        onToggleThemeMode();
      }
      if (data.history && Array.isArray(data.history) && currentUser) {
        for (const h of data.history) {
          let trk: any = h.track_json ? (typeof h.track_json === 'string' ? JSON.parse(h.track_json) : h.track_json) : null;
          if (!trk) {
            trk = {
              id: h.track_id,
              title: h.track_title,
              artist: h.artist,
              album: 'History Track',
              duration_secs: h.duration_secs,
              path_or_url: h.path_or_url || h.track_id,
              cover_art: h.cover_art,
              source: h.source || 'youtube',
            };
          }
          invoke('db_add_history', { userId: currentUser.id, track: trk }).catch(console.error);
        }
      }
      alert('Đã khôi phục hồ sơ, Lịch sử nghe và Album Spytify thành công từ tệp sao lưu!');
      window.location.reload();
    } catch (err) {
      alert('Tệp sao lưu không hợp lệ hoặc sai định dạng JSON: ' + err);
    }
  };

  // Cross-Device Backup: Export Vault to JSON using Native Windows Dialog
  const handleExportBackup = async () => {
    try {
      const storedAlbums = localStorage.getItem('spytify_user_albums');
      const albumsData = storedAlbums ? JSON.parse(storedAlbums) : [];
      const backupData = {
        app: 'Spytify',
        version: '1.0',
        exported_at: new Date().toISOString(),
        user: currentUser,
        avatar: currentUser?.avatar || localStorage.getItem('spytify_guest_avatar') || '',
        accentColor: accentColor,
        themeMode: themeMode,
        albums: albumsData,
        history: history.slice(0, 30),
      };

      const jsonStr = JSON.stringify(backupData, null, 2);

      // 1. Try Native Tauri save file dialog
      try {
        const filePath = await save({
          filters: [{ name: 'Spytify Backup Vault', extensions: ['json'] }],
          defaultPath: `spytify_vault_${currentUser?.username || 'agent'}_backup.json`,
        });
        if (filePath) {
          await invoke('save_text_file', { path: filePath, content: jsonStr });
          alert('Đã lưu tệp sao lưu thành công tại:\n' + filePath);
          return;
        }
      } catch (nativeErr) {
        console.warn('Native save dialog fallback:', nativeErr);
      }

      // 2. Browser DOM fallback
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `spytify_vault_${currentUser?.username || 'agent'}_backup.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export backup:', err);
      alert('Lỗi xuất tệp sao lưu: ' + err);
    }
  };

  // Cross-Device Backup: Import Vault from JSON using Native Windows Dialog
  const handleNativeImportBackup = async () => {
    try {
      let content = '';
      try {
        const selected = await open({
          multiple: false,
          filters: [{ name: 'Spytify Backup Vault', extensions: ['json'] }],
        });
        if (selected && typeof selected === 'string') {
          content = await invoke<string>('read_text_file', { path: selected });
        }
      } catch (nativeErr) {
        console.warn('Native open dialog fallback:', nativeErr);
      }

      if (content) {
        applyBackupContent(content);
        return;
      }

      // Fallback to HTML input
      backupInputRef.current?.click();
    } catch (err) {
      console.error('Failed to import backup:', err);
      backupInputRef.current?.click();
    }
  };

  const handleHtmlFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      applyBackupContent(event.target?.result as string);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const [activeTab, setActiveTab] = useState<
    | 'account' 
    | 'profile_appearance' 
    | 'account_status' 
    | 'voice_audio' 
    | 'download_storage' 
    | 'cloud_sync' 
    | 'system' 
    | 'language' 
    | 'activity_history'
  >('account');
  const [searchFilter, setSearchFilter] = useState('');

  return (
    <div className={`flex-1 flex h-full overflow-hidden select-none ${themeMode === 'light' ? 'bg-[#f8fafc]' : 'bg-[#0a0a10]'}`}>
      {/* Hidden File Inputs */}
      <input 
        ref={fileInputRef} 
        type="file" 
        accept="image/*" 
        onChange={handleImageFileChange} 
        className="hidden" 
      />
      <input 
        ref={backupInputRef} 
        type="file" 
        accept=".json" 
        onChange={handleHtmlFileChange} 
        className="hidden" 
      />

      {/* ──────── 1. LEFT SIDEBAR (DISCORD CATEGORIES & MINI PROFILE) ──────── */}
      <div className={`w-64 border-r flex flex-col justify-between flex-shrink-0 ${themeMode === 'light' ? 'bg-[#f1f5f9] border-[#cbd5e1]' : 'bg-[#0b0b12] border-[#181824]'}`}>
        <div className="p-4 space-y-3 flex-1 overflow-y-auto">
          {/* User Mini Card */}
          <div className={`p-3 rounded-xl border flex items-center gap-3 ${themeMode === 'light' ? 'bg-white border-[#e2e8f0]' : 'bg-[#12121c] border-[#1e1e2c]'}`}>
            <div className="relative group cursor-pointer" onClick={() => setActiveTab('profile_appearance')}>
              <div 
                className="w-10 h-10 rounded-xl overflow-hidden border border-white/20 flex items-center justify-center text-white font-bold text-sm shadow-md"
                style={{ 
                  background: currentUser?.avatar ? 'transparent' : `linear-gradient(135deg, ${accentColor} 0%, #000000 100%)`,
                }}
              >
                {currentUser?.avatar ? (
                  <img src={currentUser.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{currentUser ? currentUser.display_name.charAt(0).toUpperCase() : 'S'}</span>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-bold truncate ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                {currentUser ? currentUser.display_name : getTranslation(language, 'profile.guest')}
              </p>
              <button 
                type="button" 
                onClick={() => setActiveTab('profile_appearance')} 
                className="text-[10px] text-[#888] hover:text-cyan-400 font-mono flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Edit3 className="w-2.5 h-2.5" />
                <span>Sửa hồ sơ</span>
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#666]" />
            <input
              type="text"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Tìm kiếm cài đặt..."
              className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none border transition-colors ${
                themeMode === 'light' 
                  ? 'bg-white text-slate-900 border-[#cbd5e1] placeholder-slate-400' 
                  : 'bg-[#101018] text-white border-[#20202c] placeholder-[#666]'
              }`}
            />
          </div>

          {/* Nav Categories */}
          <div className="space-y-4 pt-1">
            {/* Group 1: Tài khoản */}
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#666] px-2 mb-1">
                Cài Đặt Người Dùng
              </p>
              <div className="space-y-0.5">
                {[
                  { key: 'account', label: 'Thông Tin Tài Khoản', icon: UserIcon },
                  { key: 'profile_appearance', label: 'Hồ Sơ & Giao Diện', icon: Palette },
                  { key: 'account_status', label: 'Trạng Thái Tài Khoản', icon: ShieldCheck },
                ]
                  .filter(item => !searchFilter || item.label.toLowerCase().includes(searchFilter.toLowerCase()))
                  .map(item => {
                    const isCur = activeTab === item.key;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setActiveTab(item.key as any)}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                          isCur
                            ? themeMode === 'light' ? 'bg-[#cbd5e1] text-slate-900' : 'bg-[#1e1e2c] text-white font-bold'
                            : themeMode === 'light' ? 'text-slate-600 hover:bg-[#e2e8f0]' : 'text-[#888] hover:text-white hover:bg-white/5'
                        }`}
                        style={isCur ? { borderLeft: `3px solid ${accentColor}` } : undefined}
                      >
                        <Icon className="w-4 h-4" style={{ color: isCur ? accentColor : '#888' }} />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Group 2: Trải nghiệm & Cài đặt ứng dụng */}
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#666] px-2 mb-1">
                Cài Đặt Ứng Dụng
              </p>
              <div className="space-y-0.5">
                {[
                  { key: 'voice_audio', label: 'Giọng nói và Video', icon: Mic },
                  { key: 'download_storage', label: 'Tải Xuống & Lưu Trữ', icon: FolderDown },
                  { key: 'cloud_sync', label: 'Đồng Bộ Đám Mây & Sao Lưu', icon: Cloud },
                  { key: 'system', label: 'Hệ Thống & Cập Nhật', icon: Zap },
                  { key: 'language', label: 'Ngôn Ngữ', icon: Globe },
                  { key: 'activity_history', label: 'Lịch Sử & Thống Kê', icon: Clock },
                ]
                  .filter(item => !searchFilter || item.label.toLowerCase().includes(searchFilter.toLowerCase()))
                  .map(item => {
                    const isCur = activeTab === item.key;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setActiveTab(item.key as any)}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                          isCur
                            ? themeMode === 'light' ? 'bg-[#cbd5e1] text-slate-900' : 'bg-[#1e1e2c] text-white font-bold'
                            : themeMode === 'light' ? 'text-slate-600 hover:bg-[#e2e8f0]' : 'text-[#888] hover:text-white hover:bg-white/5'
                        }`}
                        style={isCur ? { borderLeft: `3px solid ${accentColor}` } : undefined}
                      >
                        <Icon className="w-4 h-4" style={{ color: isCur ? accentColor : '#888' }} />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Logout */}
        <div className="p-3 border-t border-[#181824]">
          {currentUser ? (
            <button
              onClick={onLogout}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Đăng Xuất</span>
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              style={{ backgroundColor: accentColor, color: accentColor === '#FFFFFF' ? '#000' : '#fff' }}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow"
            >
              <span>{getTranslation(language, 'profile.loginBtn')}</span>
            </button>
          )}
        </div>
      </div>

      {/* ──────── 2. RIGHT CONTENT PANE (DISCORD SETTING CARDS) ──────── */}
      <div className="flex-1 p-8 overflow-y-auto max-w-3xl">
        {activeTab === 'account' && (
          <div className="space-y-6">
            <div>
              <h2 className={`text-xl font-black ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                Thông Tin Tài Khoản
              </h2>
              <p className="text-xs text-[#777] font-mono mt-0.5">
                Quản lý tên người dùng, thông tin liên hệ và trạng thái xác thực tài khoản Spytify.
              </p>
            </div>

            {/* Discord Account Info Card */}
            <div className={`p-4 rounded-2xl border space-y-4 ${themeMode === 'light' ? 'bg-white border-[#e2e8f0]' : 'bg-[#101018] border-[#1e1e2c]'}`}>
              <div className="flex items-center justify-between pb-3 border-b border-[#1c1c28]">
                <div>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#777]">Tên đăng nhập</p>
                  <p className={`text-sm font-bold mt-0.5 ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                    @{currentUser ? currentUser.username : 'khach'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => alert('Tên đăng nhập được quản lý bởi phiên xác thực SQLite cục bộ')}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono font-bold text-zinc-300 hover:text-white cursor-pointer transition-colors"
                >
                  Chỉnh sửa
                </button>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-[#1c1c28]">
                <div>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#777]">Tên hiển thị</p>
                  <p className={`text-sm font-bold mt-0.5 ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                    {currentUser ? currentUser.display_name : 'Khách Chưa Đăng Nhập'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('profile_appearance')}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono font-bold text-zinc-300 hover:text-white cursor-pointer transition-colors"
                >
                  Chỉnh sửa
                </button>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-[#1c1c28]">
                <div className="flex-1 pr-4">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#777]">Tiểu sử cá nhân (Bio)</p>
                  {isEditingBio ? (
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={160}
                        value={userBio}
                        onChange={e => setUserBio(e.target.value)}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-sans border outline-none ${
                          themeMode === 'light' ? 'bg-slate-100 border-slate-300 text-slate-900' : 'bg-[#141420] border-[#252538] text-white focus:border-cyan-400'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            localStorage.setItem('spytify_user_bio', userBio.trim());
                            if (currentUser?.id) {
                              localStorage.setItem(`spytify_user_bio_${currentUser.id}`, userBio.trim());
                            }
                          } catch {}
                          setIsEditingBio(false);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-mono font-bold cursor-pointer transition-colors"
                      >
                        Lưu
                      </button>
                    </div>
                  ) : (
                    <p className={`text-xs mt-0.5 font-sans ${themeMode === 'light' ? 'text-slate-700' : 'text-zinc-300'}`}>
                      {userBio || 'Chưa thiết lập tiểu sử.'}
                    </p>
                  )}
                </div>
                {!isEditingBio && (
                  <button
                    type="button"
                    onClick={() => setIsEditingBio(true)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono font-bold text-zinc-300 hover:text-white cursor-pointer transition-colors"
                  >
                    Chỉnh sửa
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-[#1c1c28]">
                <div>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#777]">Email</p>
                  <p className={`text-sm font-bold mt-0.5 ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                    {currentUser?.email ? currentUser.email : 'chưa liên kết email'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => alert('Email đăng nhập được đồng bộ qua Cloud')}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono font-bold text-zinc-300 hover:text-white cursor-pointer transition-colors"
                >
                  Chỉnh sửa
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#777]">Số Điện Thoại</p>
                  <p className="text-xs text-[#666] font-mono mt-0.5">Bạn chưa thêm số điện thoại nào vào Spytify.</p>
                </div>
                <button
                  type="button"
                  onClick={() => alert('Tính năng thêm số điện thoại bảo mật sẽ sớm được hỗ trợ')}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono font-bold text-zinc-300 hover:text-white cursor-pointer transition-colors"
                >
                  Thêm
                </button>
              </div>
            </div>

            {/* Mật Khẩu & Bảo Mật Card */}
            <div>
              <h3 className={`text-sm font-bold mb-2 ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                Mật Khẩu & Bảo Mật
              </h3>
              <div className={`p-4 rounded-2xl border space-y-3 ${themeMode === 'light' ? 'bg-white border-[#e2e8f0]' : 'bg-[#101018] border-[#1e1e2c]'}`}>
                <div className="flex items-center justify-between pb-2 border-b border-[#1c1c28]">
                  <div>
                    <p className="text-xs font-bold text-white">Mật khẩu</p>
                    <p className="text-[11px] text-[#777] font-mono">••••••••••••</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => alert('Để đổi mật khẩu, vui lòng đăng xuất và chọn Quên mật khẩu hoặc Thiết lập trong Auth.')}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono font-bold text-zinc-300 hover:text-white cursor-pointer transition-colors"
                  >
                    Chỉnh sửa
                  </button>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-[#1c1c28]">
                  <div>
                    <p className="text-xs font-bold text-white">Xác Thực Đa Nhân Tố (2FA)</p>
                    <p className="text-[11px] text-[#777] font-mono">Bảo mật mã hóa kép qua SQLite & Supabase Vault</p>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Đã kích hoạt
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-white">Thiết Bị Đã Đăng Nhập</p>
                    <p className="text-[11px] text-[#777] font-mono">1 thiết bị máy tính đang hoạt động</p>
                  </div>
                  <span className="text-xs font-mono text-cyan-400 font-bold">Máy hiện tại</span>
                </div>
              </div>
            </div>

            {/* Khởi Động & Ứng Dụng Windows Card */}
            <div>
              <h3 className={`text-sm font-bold mb-2 ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                Khởi Động &amp; Ứng Dụng Desktop
              </h3>
              <div className={`p-4 rounded-2xl border ${themeMode === 'light' ? 'bg-white border-[#e2e8f0]' : 'bg-[#101018] border-[#1e1e2c]'}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                    >
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                        Khởi động cùng Windows
                      </p>
                      <p className="text-[11px] text-[#777] mt-0.5">
                        {launchOnStartup
                          ? 'Bật: Spytify sẽ tự động mở khi bạn đăng nhập vào Windows.'
                          : 'Tắt: Chỉ mở Spytify thủ công khi bạn nhấn biểu tượng ứng dụng.'}
                      </p>
                      {launchStartupMsg && (
                        <p className="text-[10px] font-mono text-cyan-400 mt-1">{launchStartupMsg}</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isTogglingStartup}
                    onClick={() => handleToggleLaunchOnStartup(!launchOnStartup)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                      launchOnStartup ? 'bg-emerald-500' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        launchOnStartup ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile_appearance' && (
          <div className="space-y-6">
            <div>
              <h2 className={`text-xl font-black ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                Hồ Sơ & Giao Diện
              </h2>
              <p className="text-xs text-[#777] font-mono mt-0.5">
                Tùy biến hình đại diện (Avatar), màu sắc chủ đạo Neon Cyberpunk và chế độ Sáng / Tối.
              </p>
            </div>

            {/* Avatar Section */}
            <div className={`p-5 rounded-2xl border space-y-4 ${themeMode === 'light' ? 'bg-white border-[#e2e8f0]' : 'bg-[#101018] border-[#1e1e2c]'}`}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  {getTranslation(language, 'profile.avatar')}
                </label>
                {currentUser?.avatar && (
                  <button
                    onClick={handleClearAvatar}
                    className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>{getTranslation(language, 'profile.deleteAvatar')}</span>
                  </button>
                )}
              </div>

              {/* Upload Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 px-4 rounded-xl border border-dashed border-[#2b2b3a] hover:border-white/50 bg-[#0c0c10] hover:bg-[#121218] transition-all flex items-center justify-center gap-2.5 text-xs font-semibold text-white cursor-pointer group"
              >
                <Upload className="w-4 h-4 text-[#888] group-hover:text-white transition-colors" />
                <span>{getTranslation(language, 'profile.uploadAvatar')}</span>
              </button>

              {/* Presets */}
              <div>
                <p className="text-[11px] text-[#777] font-mono mb-2">Hoặc chọn nhanh từ bộ sưu tập Đặc nhiệm Spytify:</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {SPY_AVATARS.map((preset) => {
                    const isSelected = currentUser?.avatar === preset.svg;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => onUpdateAvatar(preset.svg)}
                        title={preset.name}
                        className={`p-2 rounded-xl border text-center flex flex-col items-center gap-2 transition-all cursor-pointer group ${
                          isSelected 
                            ? 'bg-[#181824] border-white shadow-[0_0_12px_rgba(255,255,255,0.2)] scale-105' 
                            : 'bg-[#0d0d12] border-[#1e1e28] hover:border-[#38384a] hover:bg-[#13131b]'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-[#252535] group-hover:border-white/40 transition-colors">
                          <img src={preset.svg} alt={preset.name} className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[10px] font-bold text-[#aaa] group-hover:text-white truncate w-full">
                          {preset.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Theme Mode & Neon Accent */}
            <div className={`p-5 rounded-2xl border space-y-5 ${themeMode === 'light' ? 'bg-white border-[#e2e8f0]' : 'bg-[#101018] border-[#1e1e2c]'}`}>
              {/* Light / Dark Mode Toggle */}
              <div>
                <label className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2 mb-3">
                  <Sun className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  {getTranslation(language, 'profile.themeMode')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => themeMode === 'light' && onToggleThemeMode()}
                    style={{
                      backgroundColor: '#0b0b12',
                      borderColor: themeMode === 'dark' ? accentColor : '#27273a',
                      boxShadow: themeMode === 'dark' ? `0 0 16px ${accentColor}40` : '0 2px 8px rgba(0,0,0,0.2)',
                    }}
                    className={`p-3.5 rounded-xl border-2 text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                      themeMode === 'dark' ? 'scale-[1.01]' : 'opacity-85 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 overflow-hidden">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border"
                        style={{ backgroundColor: '#161624', borderColor: '#2e2e42' }}
                      >
                        <Moon className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold truncate" style={{ color: '#f8fafc' }}>
                          {getTranslation(language, 'profile.darkStealth')}
                        </p>
                        <p className="text-[10px] font-mono truncate" style={{ color: '#94a3b8' }}>
                          {getTranslation(language, 'profile.darkStealthDesc')}
                        </p>
                      </div>
                    </div>
                    {themeMode === 'dark' && (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: accentColor, color: '#ffffff' }}
                      >
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </button>

                  <button
                    onClick={() => themeMode === 'dark' && onToggleThemeMode()}
                    style={{
                      backgroundColor: '#ffffff',
                      borderColor: themeMode === 'light' ? accentColor : '#cbd5e1',
                      boxShadow: themeMode === 'light' ? `0 0 16px ${accentColor}40` : '0 2px 8px rgba(15,23,42,0.08)',
                    }}
                    className={`p-3.5 rounded-xl border-2 text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                      themeMode === 'light' ? 'scale-[1.01]' : 'opacity-90 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 overflow-hidden">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border"
                        style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a' }}
                      >
                        <Sun className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold truncate" style={{ color: '#0f172a' }}>
                          {getTranslation(language, 'profile.lightDossier')}
                        </p>
                        <p className="text-[10px] font-mono truncate" style={{ color: '#475569' }}>
                          {getTranslation(language, 'profile.lightDossierDesc')}
                        </p>
                      </div>
                    </div>
                    {themeMode === 'light' && (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: accentColor, color: '#ffffff' }}
                      >
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* Accent Color Palette */}
              <div className="pt-4 border-t border-[#1c1c28]">
                <label className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2 mb-3">
                  <Sparkles className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  {getTranslation(language, 'profile.accentColor')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {THEME_PALETTE.map((theme) => {
                    const isSelected = accentColor.toUpperCase() === theme.hex.toUpperCase();
                    return (
                      <button
                        key={theme.hex}
                        onClick={() => onUpdateAccentColor(theme.hex)}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-[#15151e] border-white shadow-[0_0_12px_rgba(255,255,255,0.15)] scale-[1.02]' 
                            : 'bg-[#0d0d12] border-[#1e1e28] hover:border-[#333] hover:bg-[#121218]'
                        }`}
                      >
                        <div 
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: theme.hex }}
                        >
                          {isSelected && (
                            <Check className={`w-4 h-4 ${theme.hex === '#FFFFFF' ? 'text-black' : 'text-white'}`} />
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-white truncate">{theme.name}</p>
                          <p className="text-[10px] text-[#777] truncate font-mono">
                            {getTranslation(language, `palette.${theme.key}`) || theme.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Hex Picker */}
                <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-[#0c0c10] border border-[#1b1b24]">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => onUpdateAccentColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 outline-none"
                    title={getTranslation(language, 'profile.customHex')}
                  />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-white">{getTranslation(language, 'profile.customHex')}</p>
                    <p className="text-[10px] text-[#777] font-mono">{getTranslation(language, 'profile.customHexDesc')}</p>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-[#161620] border border-[#262634] text-white">
                    {accentColor.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'account_status' && (
          <div className="space-y-6">
            <div>
              <h2 className={`text-xl font-black ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                Trạng Thái Tài Khoản
              </h2>
              <p className="text-xs text-[#777] font-mono mt-0.5">
                Kiểm tra mức độ tuân thủ, độ tin cậy và trạng thái đồng bộ cơ sở dữ liệu.
              </p>
            </div>

            {/* Blue Info Banner matching Discord Image */}
            <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-200 text-xs flex items-start gap-3">
              <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Nhóm tuổi sẽ quyết định liệu bạn có thể truy cập nội dung và cài đặt dành cho người lớn hay không. Bạn thuộc nhóm tuổi người lớn (18+), nên sẽ không có gì thay đổi với bạn.
              </p>
            </div>

            <div className={`p-4 rounded-2xl border space-y-4 ${themeMode === 'light' ? 'bg-white border-[#e2e8f0]' : 'bg-[#101018] border-[#1e1e2c]'}`}>
              <div className="flex items-center justify-between pb-3 border-b border-[#1c1c28]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Nhóm Tuổi</p>
                    <p className="text-[11px] text-[#777] font-mono">Bạn thuộc nhóm tuổi người lớn (18+) và có quyền truy cập vào tất cả các tính năng.</p>
                  </div>
                </div>
                <span className="text-xs font-bold font-mono text-zinc-300">Người lớn</span>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-[#1c1c28]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Trạng thái tài khoản</p>
                    <p className="text-[11px] text-[#777] font-mono">Cảm ơn bạn đã sử dụng Spytify và tuân thủ nguyên tắc cộng đồng. Bạn không có bất kỳ vi phạm nào.</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400">Hoàn toàn ổn &gt;</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Cơ sở dữ liệu nội bộ SQLite</p>
                    <p className="text-[11px] text-[#777] font-mono">Lưu trữ siêu tốc trên máy tính, bảo mật tuyệt đối 100%.</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-cyan-400">Đang hoạt động</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'voice_audio' && (
          <div className="space-y-6">
            <div>
              <h2 className={`text-xl font-black ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                Giọng nói và Video
              </h2>
              <p className="text-xs text-[#777] font-mono mt-0.5">
                Cài đặt âm thanh đầu vào Micro, âm lượng loa đầu ra cho phòng đàm thoại (VoIP).
              </p>
            </div>

            <div className={`p-5 rounded-2xl border space-y-5 ${themeMode === 'light' ? 'bg-white border-[#e2e8f0]' : 'bg-[#101018] border-[#1e1e2c]'}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Mic Volume */}
                <div className="p-4 rounded-xl bg-[#0e0e14] border border-[#1e1e28] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Mic className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-white">Âm lượng Micro (Input)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded">
                          {voiceMicVolume}%
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateMicVolume(100)}
                          title="Đặt về 100%"
                          className="p-1 rounded hover:bg-[#1a1a24] text-[#777] hover:text-white text-[10px] font-mono transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      step="1"
                      value={voiceMicVolume}
                      onChange={(e) => handleUpdateMicVolume(parseInt(e.target.value, 10))}
                      className="w-full h-1.5 bg-[#1c1c2a] rounded-lg appearance-none cursor-pointer accent-emerald-400"
                    />
                  </div>
                  <p className="text-[10px] text-[#555] font-mono mt-3">
                    Hỗ trợ khuếch đại mic lên tới 200% cho micro có âm lượng nhỏ.
                  </p>
                </div>

                {/* Speaker Volume */}
                <div className="p-4 rounded-xl bg-[#0e0e14] border border-[#1e1e28] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-bold text-white">Âm lượng Loa (Output)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded">
                          {voiceSpeakerVolume}%
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateSpeakerVolume(100)}
                          title="Đặt về 100%"
                          className="p-1 rounded hover:bg-[#1a1a24] text-[#777] hover:text-white text-[10px] font-mono transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      step="1"
                      value={voiceSpeakerVolume}
                      onChange={(e) => handleUpdateSpeakerVolume(parseInt(e.target.value, 10))}
                      className="w-full h-1.5 bg-[#1c1c2a] rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-1">
                    <span className="text-[10px] text-[#555] font-mono">0% đến 200%</span>
                    <button
                      type="button"
                      onClick={playSpeakerTestChime}
                      className="px-2.5 py-1 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 font-mono text-[10px] flex items-center gap-1 transition-all cursor-pointer shadow-sm hover:scale-105"
                    >
                      <Volume1 className="w-3 h-3" />
                      <span>Thử âm thanh loa</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'download_storage' && (
          <div className="space-y-6">
            <div>
              <h2 className={`text-xl font-black ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                Tải Xuống & Lưu Trữ
              </h2>
              <p className="text-xs text-[#777] font-mono mt-0.5">
                Cấu hình thư mục lưu nhạc ngoại tuyến (MP3 / FLAC) khi tải về máy tính.
              </p>
            </div>

            <div className={`p-5 rounded-2xl border space-y-4 ${themeMode === 'light' ? 'bg-white border-[#e2e8f0]' : 'bg-[#101018] border-[#1e1e2c]'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                  >
                    <FolderDown className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">{getTranslation(language, 'download.folderSetting')}</p>
                    <p className="text-[11px] text-[#8e8e9f] font-mono truncate" title={downloadFolder}>
                      {downloadFolder || 'C:\\Users\\...\\Music\\Spytify'}
                    </p>
                    <p className="text-[10px] text-[#555] mt-0.5">{getTranslation(language, 'download.folderSettingDesc')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-auto">
                  {onChangeDownloadFolder && (
                    <button
                      onClick={onChangeDownloadFolder}
                      className="px-3 py-1.5 rounded-lg bg-[#14141c] hover:bg-[#1e1e28] text-white text-xs font-medium border border-[#22222e] transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Folder className="w-3.5 h-3.5 text-[#888]" />
                      <span>{getTranslation(language, 'download.changeFolder')}</span>
                    </button>
                  )}
                  {onOpenDownloadFolder && (
                    <button
                      onClick={onOpenDownloadFolder}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                      style={{
                        backgroundColor: `${accentColor}18`,
                        color: accentColor,
                        border: `1px solid ${accentColor}35`,
                      }}
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>{getTranslation(language, 'download.openFolder')}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cloud_sync' && (
          <div className="space-y-6">
            <div>
              <h2 className={`text-xl font-black ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                Đồng Bộ Đám Mây & Sao Lưu
              </h2>
              <p className="text-xs text-[#777] font-mono mt-0.5">
                Đồng bộ Album, Avatar và Lịch sử nghe nhạc sang các thiết bị khác hoặc xuất két sắt JSON.
              </p>
            </div>

            {/* Cloud Sync Container */}
            <div className={`p-5 rounded-2xl border space-y-4 ${themeMode === 'light' ? 'bg-white border-[#e2e8f0]' : 'bg-[#101018] border-[#1e1e2c]'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                    <Cloud className="w-3.5 h-3.5" style={{ color: accentColor }} />
                    Đồng bộ Đám mây (Cloud Sync)
                  </label>
                  <p className="text-[11px] text-[#777] mt-0.5">
                    Tự động đồng bộ Album, Bài hát yêu thích và Avatar qua các máy tính khác theo thời gian thực (100% Miễn phí)
                  </p>
                </div>
                <span className={`text-[10px] px-2.5 py-0.5 rounded font-mono border ${
                  isSupabaseConfigured() 
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' 
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}>
                  {isSupabaseConfigured() ? '🟢 Cloud Ready' : '⚪ Chưa kết nối'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={handleTriggerCloudSync}
                  disabled={isCloudSyncing}
                  className="py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-black flex items-center gap-2 cursor-pointer shadow-md transition-transform hover:scale-105 disabled:opacity-50"
                  style={{
                    backgroundColor: accentColor,
                    color: accentColor === '#FFFFFF' ? '#000000' : '#FFFFFF',
                  }}
                >
                  <CloudLightning className={`w-4 h-4 ${isCloudSyncing ? 'animate-spin' : ''}`} />
                  <span>{isCloudSyncing ? 'Đang đồng bộ...' : 'Đồng bộ Cloud ngay'}</span>
                </button>

                <button
                  onClick={() => setShowSupabaseSettings(p => !p)}
                  className="py-2.5 px-3 rounded-xl bg-[#0c0c12] hover:bg-[#15151e] border border-[#222230] text-xs font-semibold text-[#aaa] hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Cài đặt Supabase riêng (Dành cho IT)</span>
                  {showSupabaseSettings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {cloudStatusMsg && (
                <div className="p-2.5 rounded-lg bg-[#0e1610] border border-emerald-500/30 text-emerald-400 text-xs font-mono animate-in fade-in flex items-center justify-between">
                  <span>{cloudStatusMsg}</span>
                </div>
              )}

              {/* Collapsible Supabase Setup */}
              {showSupabaseSettings && (
                <div className="p-4 rounded-xl bg-[#0c0c12] border border-[#1e1e28] space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-[#181822] pb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                      <Zap className="w-3.5 h-3.5" style={{ color: accentColor }} />
                      Tự lưu trữ cơ sở dữ liệu Supabase riêng
                    </span>
                    <button
                      type="button"
                      onClick={handleCopySql}
                      className="px-2.5 py-1 rounded bg-[#181824] hover:bg-[#222230] text-[11px] font-mono text-[#aaa] hover:text-white border border-[#2c2c3c] flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedSql ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSql ? 'Đã sao chép SQL!' : 'Sao chép mã SQL 1-Click'}</span>
                    </button>
                  </div>

                  <form onSubmit={handleSaveSupabase} className="space-y-3">
                    <div>
                      <label className="text-[11px] font-mono text-[#888] block mb-1">
                        Supabase Project URL
                      </label>
                      <input
                        type="text"
                        placeholder={supabaseConfig.isCustom ? "https://your-project.supabase.co" : "Mặc định: Cloud chính thức của Spytify (Đang bảo mật)"}
                        value={supabaseConfig.url}
                        onChange={(e) => setSupabaseConfig(prev => ({ ...prev, url: e.target.value }))}
                        className="w-full py-2 px-3 rounded-lg bg-[#070709] border border-[#262634] text-xs text-white outline-none focus:border-white/50 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-mono text-[#888] block mb-1">
                        Supabase Anon Public API Key
                      </label>
                      <input
                        type="password"
                        placeholder={supabaseConfig.isCustom ? "sb_publishable_... hoặc eyJhbGciOi..." : "Mặc định: Key hệ thống ẩn an toàn"}
                        value={supabaseConfig.anonKey}
                        onChange={(e) => setSupabaseConfig(prev => ({ ...prev, anonKey: e.target.value }))}
                        className="w-full py-2 px-3 rounded-lg bg-[#070709] border border-[#262634] text-xs text-white outline-none focus:border-white/50 font-mono"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={isTestingConnection}
                        className="py-1.5 px-3 rounded-lg bg-[#181824] hover:bg-[#222234] border border-[#2c2c3c] text-white font-mono text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                      >
                        <RefreshCw className={`w-3 h-3 ${isTestingConnection ? 'animate-spin' : ''}`} />
                        <span>{isTestingConnection ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</span>
                      </button>

                      <button
                        type="submit"
                        className="py-1.5 px-4 rounded-lg bg-white text-black font-bold text-xs hover:bg-[#ddd] transition-colors cursor-pointer"
                      >
                        Lưu cấu hình riêng
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Cross-Device Backup */}
            <div className={`p-5 rounded-2xl border space-y-4 ${themeMode === 'light' ? 'bg-white border-[#e2e8f0]' : 'bg-[#101018] border-[#1e1e2c]'}`}>
              <div>
                <label className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <Database className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  {getTranslation(language, 'profile.backupTitle')}
                </label>
                <p className="text-[11px] text-[#777] mt-1 font-mono">
                  {getTranslation(language, 'profile.backupDesc')}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleExportBackup}
                  className="p-3.5 rounded-xl border border-[#222230] bg-[#0c0c12] hover:bg-[#14141c] hover:border-white/40 flex items-center gap-3 transition-all cursor-pointer group"
                >
                  <div 
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                  >
                    <Download className="w-4 h-4" />
                  </div>
                  <div className="text-left overflow-hidden">
                    <p className="text-xs font-bold text-white group-hover:text-white transition-colors">
                      {getTranslation(language, 'profile.exportBackup')}
                    </p>
                    <p className="text-[10px] text-[#777] font-mono">Tải về két sắt Album, Avatar, Yêu thích</p>
                  </div>
                </button>

                <button
                  onClick={handleNativeImportBackup}
                  className="p-3.5 rounded-xl border border-[#222230] bg-[#0c0c12] hover:bg-[#14141c] hover:border-white/40 flex items-center gap-3 transition-all cursor-pointer group"
                >
                  <div 
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                  >
                    <HardDriveDownload className="w-4 h-4" />
                  </div>
                  <div className="text-left overflow-hidden">
                    <p className="text-xs font-bold text-white group-hover:text-white transition-colors">
                      {getTranslation(language, 'profile.importBackup')}
                    </p>
                    <p className="text-[10px] text-[#777] font-mono">Khôi phục toàn bộ dữ liệu từ máy cũ</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="space-y-6">
            <div>
              <h2 className={`text-xl font-black ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                Hệ Thống & Cập Nhật
              </h2>
              <p className="text-xs text-[#777] font-mono mt-0.5">
                Thiết lập hành vi ứng dụng Windows, thu nhỏ khay hệ thống và cập nhật phiên bản.
              </p>
            </div>

            <div className={`p-5 rounded-2xl border space-y-5 ${themeMode === 'light' ? 'bg-white border-[#e2e8f0]' : 'bg-[#101018] border-[#1e1e2c]'}`}>
              {/* Launch on Windows startup */}
              <div className="flex items-center justify-between pb-4 border-b border-[#1c1c28]">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                  >
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Khởi động cùng Windows</p>
                    <p className="text-[11px] text-[#777] mt-0.5">
                      {launchOnStartup
                        ? 'Bật: Tự động khởi chạy Spytify mỗi khi mở máy Windows.'
                        : 'Tắt: Không tự khởi chạy khi bật máy tính.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isTogglingStartup}
                  onClick={() => handleToggleLaunchOnStartup(!launchOnStartup)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                    launchOnStartup ? 'bg-emerald-500' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      launchOnStartup ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Close to tray */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                  >
                    <Power className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Chạy ngầm ở khay hệ thống (System Tray)</p>
                    <p className="text-[11px] text-[#777] mt-0.5">
                      {closeToTray 
                        ? 'Bật: Nhấn nút [X] sẽ ẩn app xuống khay hệ thống để tiếp tục phát nhạc ngầm.' 
                        : 'Tắt: Nhấn nút [X] sẽ đóng và thoát hoàn toàn ứng dụng.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleCloseToTray(!closeToTray)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    closeToTray ? 'bg-emerald-500' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      closeToTray ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Version updater */}
              <div className="pt-4 border-t border-[#1c1c28] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                  >
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-white">Cập nhật ứng dụng Spytify</p>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#151520] text-zinc-300 border border-[#252535]">
                        Phiên bản: v{CURRENT_VERSION}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#777] mt-0.5">
                      Tự động kiểm tra bản build mới nhất trên GitHub.
                    </p>
                    {updateStatusMsg && (
                      <p className="text-[11px] text-emerald-400 font-mono mt-1">
                        {updateStatusMsg}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleManualCheckUpdate}
                  disabled={isCheckingUpdate}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border hover:scale-105 disabled:opacity-50 self-start sm:self-auto"
                  style={{
                    backgroundColor: `${accentColor}18`,
                    color: accentColor,
                    borderColor: `${accentColor}40`,
                  }}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                  <span>{isCheckingUpdate ? 'Đang kiểm tra...' : 'Kiểm tra bản mới'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'language' && (
          <div className="space-y-6">
            <div>
              <h2 className={`text-xl font-black ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                Ngôn Ngữ (Language)
              </h2>
              <p className="text-xs text-[#777] font-mono mt-0.5">
                Chọn ngôn ngữ hiển thị trên toàn bộ giao diện, menu và hệ thống thông báo.
              </p>
            </div>

            <div className={`p-5 rounded-2xl border space-y-4 ${themeMode === 'light' ? 'bg-white border-[#e2e8f0]' : 'bg-[#101018] border-[#1e1e2c]'}`}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {SUPPORTED_LANGUAGES.map((item) => {
                  const isSelected = language === item.code;
                  return (
                    <button
                      key={item.code}
                      onClick={() => onUpdateLanguage && onUpdateLanguage(item.code)}
                      className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#15151e] shadow-[0_0_12px_rgba(255,255,255,0.15)] scale-[1.02]'
                          : 'bg-[#0d0d12] border-[#1e1e28] hover:border-[#333] hover:bg-[#121218]'
                      }`}
                      style={isSelected ? { borderColor: accentColor } : undefined}
                    >
                      <div className="flex items-center justify-between w-full mb-2">
                        <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#181824] text-white border border-[#2a2a3a]">
                          {item.tag}
                        </span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }}></span>
                        )}
                      </div>
                      <div>
                        <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-[#ccc]'}`}>
                          {item.nativeName}
                        </p>
                        <p className="text-[10px] text-[#777] truncate font-mono mt-0.5">
                          {item.country}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'activity_history' && (
          <div className="space-y-6">
            <div>
              <h2 className={`text-xl font-black ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                Lịch Sử & Thống Kê
              </h2>
              <p className="text-xs text-[#777] font-mono mt-0.5">
                Tổng hợp hoạt động nghe nhạc, nghệ sĩ nghe nhiều nhất và danh sách các bài hát gần đây.
              </p>
            </div>

            {/* Quick Stats Grid */}
            {currentUser && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={`p-4 rounded-xl border flex items-center gap-3.5 ${themeMode === 'light' ? 'bg-white border-[#e2e8f0]' : 'bg-[#0a0a0d] border-[#161620]'}`}>
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center border border-[#222]"
                    style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                  >
                    <Headphones className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] text-[#777] font-mono uppercase">Tổng lượt nghe</p>
                    <p className={`text-lg font-bold mt-0.5 ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>{stats.total_played}</p>
                  </div>
                </div>

                <div className={`p-4 rounded-xl border flex items-center gap-3.5 ${themeMode === 'light' ? 'bg-white border-[#e2e8f0]' : 'bg-[#0a0a0d] border-[#161620]'}`}>
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center border border-[#222]"
                    style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                  >
                    <Heart className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] text-[#777] font-mono uppercase">Bài hát yêu thích</p>
                    <p className={`text-lg font-bold mt-0.5 ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>{stats.favorite_count}</p>
                  </div>
                </div>

                <div className={`p-4 rounded-xl border flex items-center gap-3.5 ${themeMode === 'light' ? 'bg-white border-[#e2e8f0]' : 'bg-[#0a0a0d] border-[#161620]'}`}>
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center border border-[#222]"
                    style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                  >
                    <Disc className="w-5 h-5" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[11px] text-[#777] font-mono uppercase">Nghệ sĩ nghe nhiều</p>
                    <p className={`text-sm font-bold mt-0.5 truncate ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>{stats.top_artist || 'Chưa xác định'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* History List */}
            <div className={`p-5 rounded-2xl border space-y-3 ${themeMode === 'light' ? 'bg-white border-[#e2e8f0]' : 'bg-[#101018] border-[#1e1e2c]'}`}>
              <div className="flex items-center justify-between pb-2 border-b border-[#1c1c28]">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  Bài hát phát gần đây (30 bài)
                </h3>
                <span className="text-[10px] text-[#777] font-mono">Bấm bài bất kỳ để nghe lại</span>
              </div>

              {history.length === 0 ? (
                <div className="text-center py-8 text-[#555] text-xs">Chưa có lịch sử phát nhạc.</div>
              ) : (
                <div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
                  {history
                    .filter((h, index, self) => 
                      index === self.findIndex(t => 
                        (t.track_id && t.track_id === h.track_id) || 
                        (t.track_title && t.track_title.trim().toLowerCase() === h.track_title.trim().toLowerCase())
                      )
                    )
                    .slice(0, 30)
                    .map((h, i) => {
                      let trackObj: any = null;
                      if (h.track_json) {
                        try { trackObj = typeof h.track_json === 'string' ? JSON.parse(h.track_json) : h.track_json; } catch {}
                      }
                      const coverArt = trackObj?.cover_art || (h as any).cover_art;
                      let pathOrUrl = trackObj?.path_or_url || h.path_or_url || h.track_id;
                      if (h.source === 'youtube' && pathOrUrl.startsWith('yt_')) {
                        pathOrUrl = pathOrUrl.replace('yt_', '');
                      }

                      return (
                        <div
                          key={i}
                          onClick={() => {
                            if (trackObj) {
                              onPlayTrack(trackObj);
                              return;
                            }
                            onPlayTrack({
                              id: h.track_id,
                              title: h.track_title,
                              artist: h.artist,
                              album: 'History Track',
                              duration_secs: h.duration_secs,
                              path_or_url: pathOrUrl,
                              cover_art: coverArt,
                              source: (h.source as any) || 'youtube',
                            });
                          }}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-[#09090c] hover:bg-[#121218] border border-[#161620] cursor-pointer group transition-all"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            {coverArt ? (
                              <img 
                                src={coverArt} 
                                alt={h.track_title} 
                                className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-white/10 shadow-sm"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-[#14141c] flex items-center justify-center text-[#555] overflow-hidden flex-shrink-0 border border-white/10">
                                <Music className="w-4 h-4" style={{ color: accentColor }} />
                              </div>
                            )}
                            <div className="overflow-hidden">
                              <p className="text-xs font-semibold text-white truncate group-hover:text-white transition-colors">
                                {h.track_title}
                              </p>
                              <p className="text-[11px] text-[#777] truncate font-mono mt-0.5">{h.artist} • <span className="uppercase text-[10px] text-zinc-400">{h.source}</span></p>
                            </div>
                          </div>
                          <span className="text-[10px] text-[#555] font-mono flex-shrink-0">
                            {h.listened_at ? new Date(h.listened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
