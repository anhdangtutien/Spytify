import React, { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { User, UserStats, HistoryItem, Track, UserAlbum } from '../types';
import { 
  User as UserIcon, LogOut, Clock, Heart, Headphones, 
  Music, RefreshCw, Disc, Palette, Camera, Upload, Trash2, 
  Check, Sparkles, Shield, Sun, Moon, Download, Database, HardDriveDownload,
  Cloud, CloudLightning, Key, ChevronDown, ChevronUp, Globe, Languages,
  Folder, FolderOpen, FolderDown, Copy, CheckCheck, ExternalLink, Zap, Power, Monitor,
  Mic, Volume2, Sliders, RotateCcw, Volume1, Search, Edit3, ChevronRight,
  ShieldCheck, CheckCircle2, UserCheck, AlertCircle, Info, Lock,
  QrCode, Smartphone, KeyRound, ShieldAlert, AlertTriangle, ArrowUpRight
} from 'lucide-react';
import { getContrastTextColor } from '../utils/trackUtils';
import { 
  getStoredSupabaseConfig, getCustomSupabaseConfig, saveStoredSupabaseConfig, resetToDefaultSupabase,
  isSupabaseConfigured, cloudSyncPush, cloudSyncPull, SUPABASE_SCHEMA_SQL, testSupabaseConnection,
  cloudSetTwoFactor,
  cloudSetTwoFactorScope,
  cloudResetUserPassword
} from '../services/supabase';
import { generateTotpSecret, getOtpAuthUrl, getQrCodeImageUrl, verifyTotp } from '../services/totp';
import { checkStartupUpdatePolicy, CURRENT_VERSION, UpdateInfo } from '../services/updater';
import { openWebsite, getWebsiteUrl, setWebsiteUrl, DEFAULT_WEBSITE_URL } from '../services/website';
import { LanguageCode, SUPPORTED_LANGUAGES, getTranslation } from '../locales/i18n';

interface ProfileViewProps {
  currentUser: User | null;
  accentColor: string;
  themeMode: 'dark' | 'light';
  onUpdateAccentColor: (color: string) => void;
  onToggleThemeMode: () => void;
  onUpdateAvatar: (avatarBase64: string) => void;
  onUpdateBio: (bio: string) => void;
  onLogout: () => void;
  onOpenAuth: () => void;
  onPlayTrack: (track: Track) => void;
  language?: LanguageCode;
  onUpdateLanguage?: (lang: LanguageCode) => void;
  downloadFolder?: string;
  onChangeDownloadFolder?: () => void;
  onOpenDownloadFolder?: () => void;
  onOpenUpdateModal?: (info: UpdateInfo) => void;
  onUpdateAlbums: (albums: UserAlbum[]) => void;
  screenShareFps: 30 | 60 | 90;
  onScreenShareFpsChange: (fps: 30 | 60 | 90) => void;
  crossfadeDuration?: number;
  onUpdateCrossfadeDuration?: (durationSecs: number) => void;
  volume?: number;
  onVolumeChange?: (volume: number) => void;
  isBackgroundPlayEnabled?: boolean;
  onToggleBackgroundPlay?: () => void;
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
  onUpdateBio,
  onLogout,
  onOpenAuth,
  onPlayTrack,
  language = 'vi',
  onUpdateLanguage,
  downloadFolder = '',
  onChangeDownloadFolder,
  onOpenDownloadFolder,
  onOpenUpdateModal,
  onUpdateAlbums,
  screenShareFps,
  onScreenShareFpsChange,
  crossfadeDuration = 5,
  onUpdateCrossfadeDuration,
  volume,
  onVolumeChange,
  isBackgroundPlayEnabled = true,
  onToggleBackgroundPlay,
}) => {
  const isWebShim = typeof window !== 'undefined' && Boolean((window as any).__TAURI_WEB_SHIM__);
  const [currentCrossfade, setCurrentCrossfade] = useState<number>(() => {
    try {
      const v = localStorage.getItem('spytify_crossfade_duration');
      return v !== null ? parseInt(v, 10) : crossfadeDuration;
    } catch {
      return crossfadeDuration;
    }
  });

  useEffect(() => {
    setCurrentCrossfade(crossfadeDuration);
  }, [crossfadeDuration]);

  const handleUpdateCrossfade = (secs: number) => {
    setCurrentCrossfade(secs);
    try {
      localStorage.setItem('spytify_crossfade_duration', String(secs));
    } catch {}
    onUpdateCrossfadeDuration?.(secs);
  };
  const [stats, setStats] = useState<UserStats>({ total_played: 0, favorite_count: 0, top_artist: null });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const albumsStorageKey = currentUser
    ? `spytify_user_albums_${currentUser.id}`
    : 'spytify_user_albums_guest';

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
      return localStorage.getItem('spytify_user_bio') || getTranslation(language, 'settings.defaultBio');
    } catch {
      return getTranslation(language, 'settings.defaultBio');
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
        actual
          ? getTranslation(language, 'settings.launchEnabledToast')
          : getTranslation(language, 'settings.launchDisabledToast')
      );
    } catch (e: any) {
      setLaunchStartupMsg(
        typeof e === 'string' || e?.message
          ? String(typeof e === 'string' ? e : e.message)
          : getTranslation(language, 'settings.startupChangeError')
      );
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
      const res = await checkStartupUpdatePolicy(true);
      if (res && res.hasUpdate && res.info) {
        if (onOpenUpdateModal) {
          onOpenUpdateModal(res.info);
        }
      } else {
        setUpdateStatusMsg(getTranslation(language, 'settings.latestVersion', { version: `v${CURRENT_VERSION}` }));
        setTimeout(() => setUpdateStatusMsg(null), 4000);
      }
    } catch (e: any) {
      setUpdateStatusMsg(
        getTranslation(language, 'settings.updateCheckError', { error: e?.message || String(e) })
      );
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

  // Google Authenticator 2FA State
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(() => currentUser?.two_factor_enabled || false);
  const [twoFactorScope, setTwoFactorScope] = useState<'both' | 'login' | 'reset_password'>(
    () => (currentUser?.two_factor_scope as 'both' | 'login' | 'reset_password') || 'both'
  );
  const [show2FaModal, setShow2FaModal] = useState(false);
  const [secret2Fa, setSecret2Fa] = useState('');
  const [code2FaInput, setCode2FaInput] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);

  // Popup xác nhận hủy 2FA
  const [showDisable2FaConfirmModal, setShowDisable2FaConfirmModal] = useState(false);

  // Popup Đổi / Reset Mật Khẩu
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [changePasswordVerifyMode, setChangePasswordVerifyMode] = useState<'password' | 'authenticator'>('password');
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [changePasswordTotpInput, setChangePasswordTotpInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState('');
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [changePasswordSuccess, setChangePasswordSuccess] = useState<string | null>(null);

  // Sync 2FA state from SQLite on component mount
  useEffect(() => {
    if (currentUser?.id) {
      invoke<[boolean, string | null, string | null]>('auth_get_user_2fa', { userId: currentUser.id })
        .then(([enabled, secret, scope]) => {
          setTwoFactorEnabled(enabled);
          const currentScope = (scope as 'both' | 'login' | 'reset_password') || 'both';
          setTwoFactorScope(currentScope);
          if (currentUser) {
            currentUser.two_factor_enabled = enabled;
            if (secret) currentUser.two_factor_secret = secret;
            currentUser.two_factor_scope = currentScope;
          }
        })
        .catch(() => {});
    }
  }, [currentUser?.id]);

  const handleUpdate2FaScope = async (scope: 'both' | 'login' | 'reset_password') => {
    if (!currentUser?.id) return;
    setTwoFactorScope(scope);
    try {
      await invoke('auth_set_two_factor_scope', {
        userId: currentUser.id,
        scope,
      });
      if (isSupabaseConfigured()) {
        await cloudSetTwoFactorScope(currentUser.id, scope);
      }
      if (currentUser) {
        currentUser.two_factor_scope = scope;
        try {
          const stored = localStorage.getItem('soundify_user');
          if (stored) {
            const parsed = JSON.parse(stored);
            parsed.two_factor_scope = scope;
            localStorage.setItem('soundify_user', JSON.stringify(parsed));
          }
        } catch {}
      }
    } catch (err: any) {
      console.warn('Could not update 2FA scope:', err);
    }
  };

  const handleOpen2FaSetup = () => {
    const newSecret = generateTotpSecret(16);
    setSecret2Fa(newSecret);
    setCode2FaInput('');
    setTwoFactorError(null);
    setCopiedSecret(false);
    setShow2FaModal(true);
  };

  const handleCopySecret = () => {
    if (secret2Fa) {
      navigator.clipboard.writeText(secret2Fa);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2500);
    }
  };

  const handleConfirm2FaSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id || !secret2Fa) return;
    setTwoFactorError(null);
    setTwoFactorLoading(true);

    try {
      const isValid = await verifyTotp(code2FaInput, secret2Fa);
      if (!isValid) {
        setTwoFactorError(getTranslation(language, 'auth.invalidCode') || 'Mã xác nhận gồm 6 chữ số không đúng hoặc đã hết hạn!');
        setTwoFactorLoading(false);
        return;
      }

      // Save to SQLite
      await invoke('auth_set_two_factor', {
        userId: currentUser.id,
        secret: secret2Fa,
        enabled: true,
        scope: twoFactorScope,
      });

      // Save to Supabase Cloud if configured
      if (isSupabaseConfigured()) {
        await cloudSetTwoFactor(currentUser.id, secret2Fa, true, twoFactorScope);
      }

      setTwoFactorEnabled(true);
      if (currentUser) {
        currentUser.two_factor_enabled = true;
        currentUser.two_factor_secret = secret2Fa;
        currentUser.two_factor_scope = twoFactorScope;
        try {
          const stored = localStorage.getItem('soundify_user');
          if (stored) {
            const parsed = JSON.parse(stored);
            parsed.two_factor_enabled = true;
            parsed.two_factor_secret = secret2Fa;
            parsed.two_factor_scope = twoFactorScope;
            localStorage.setItem('soundify_user', JSON.stringify(parsed));
          }
        } catch {}
      }

      setShow2FaModal(false);
      alert('🎉 Đã kích hoạt Google Authenticator (2FA) thành công! Tài khoản của bạn được bảo mật tuyệt đối.');
    } catch (err: any) {
      setTwoFactorError(err?.message || 'Không thể kích hoạt 2FA lúc này.');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleConfirmDisable2Fa = async () => {
    if (!currentUser?.id) return;
    try {
      await invoke('auth_set_two_factor', {
        userId: currentUser.id,
        secret: '',
        enabled: false,
        scope: 'both',
      });
      if (isSupabaseConfigured()) {
        await cloudSetTwoFactor(currentUser.id, '', false, 'both');
      }
      setTwoFactorEnabled(false);
      setShowDisable2FaConfirmModal(false);
      if (currentUser) {
        currentUser.two_factor_enabled = false;
        currentUser.two_factor_secret = undefined;
        try {
          const stored = localStorage.getItem('soundify_user');
          if (stored) {
            const parsed = JSON.parse(stored);
            parsed.two_factor_enabled = false;
            delete parsed.two_factor_secret;
            localStorage.setItem('soundify_user', JSON.stringify(parsed));
          }
        } catch {}
      }
    } catch (err: any) {
      alert('Không thể tắt 2FA: ' + (err?.message || String(err)));
    }
  };

  const handleOpenChangePasswordModal = () => {
    setCurrentPasswordInput('');
    setChangePasswordTotpInput('');
    setNewPasswordInput('');
    setConfirmNewPasswordInput('');
    setChangePasswordError(null);
    setChangePasswordSuccess(null);
    setChangePasswordVerifyMode(twoFactorEnabled ? 'authenticator' : 'password');
    setShowChangePasswordModal(true);
  };

  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError(null);
    setChangePasswordSuccess(null);
    if (!currentUser?.id) return;

    if (newPasswordInput.length < 6) {
      setChangePasswordError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    if (newPasswordInput !== confirmNewPasswordInput) {
      setChangePasswordError('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setChangePasswordLoading(true);
    try {
      // 1. Xác thực danh tính
      if (changePasswordVerifyMode === 'authenticator') {
        // Xác thực qua Google Authenticator
        let secret = secret2Fa || currentUser.two_factor_secret;
        if (!secret) {
          try {
            const check = await invoke<[boolean, string | null, string | null]>('auth_get_user_2fa', { userId: currentUser.id });
            if (check && check[1]) secret = check[1];
          } catch {}
        }
        if (!secret) {
          throw new Error('Chưa tìm thấy khóa bí mật 2FA của tài khoản này.');
        }
        const isValid = await verifyTotp(changePasswordTotpInput.trim(), secret);
        if (!isValid) {
          throw new Error('Mã Google Authenticator (6 chữ số) không chính xác hoặc đã hết hạn.');
        }
      } else {
        // Xác thực qua mật khẩu hiện tại
        if (!currentPasswordInput) {
          throw new Error('Vui lòng nhập mật khẩu hiện tại của bạn.');
        }
        const creds = await invoke<[string, string] | null>('auth_get_credentials', { userId: currentUser.id });
        if (creds) {
          const [storedHash, salt] = creds;
          const inputHash = await invoke<string>('auth_hash_password', { password: currentPasswordInput, salt });
          if (inputHash !== storedHash) {
            throw new Error('Mật khẩu hiện tại không chính xác.');
          }
        }
      }

      // 2. Cập nhật mật khẩu mới vào SQLite
      const [newHash, newSalt] = await invoke<[string, string]>('auth_update_password', {
        userId: currentUser.id,
        newPassword: newPasswordInput,
      });

      // 3. Đồng bộ mật khẩu mới lên Supabase Cloud
      if (isSupabaseConfigured()) {
        await cloudResetUserPassword(currentUser.id, newHash, newSalt);
      }

      setChangePasswordSuccess('🎉 Đổi mật khẩu thành công!');
      setTimeout(() => {
        setShowChangePasswordModal(false);
        setCurrentPasswordInput('');
        setChangePasswordTotpInput('');
        setNewPasswordInput('');
        setConfirmNewPasswordInput('');
        setChangePasswordSuccess(null);
      }, 1500);
    } catch (err: any) {
      setChangePasswordError(err?.message || 'Không thể đổi mật khẩu lúc này.');
    } finally {
      setChangePasswordLoading(false);
    }
  };

  // Vercel Landing Page Website State
  const [siteUrl, setSiteUrl] = useState(() => getWebsiteUrl());
  const [isEditingSiteUrl, setIsEditingSiteUrl] = useState(false);
  const [tempSiteUrl, setTempSiteUrl] = useState(siteUrl);

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
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const minSide = Math.min(img.width, img.height);
          const startX = (img.width - minSide) / 2;
          const startY = (img.height - minSide) / 2;
          ctx.drawImage(img, startX, startY, minSide, minSide, 0, 0, 128, 128);
          const base64Jpeg = canvas.toDataURL('image/jpeg', 0.75);
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
    setCloudStatusMsg(getTranslation(language, 'settings.cloudSqlCopied'));
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
    setCloudStatusMsg(
      getTranslation(language, supabaseConfig.url ? 'settings.cloudConfigSaved' : 'settings.cloudDefaultRestored')
    );
    setTimeout(() => setCloudStatusMsg(null), 3000);
  };

  const handleResetToDefaultSupabase = () => {
    resetToDefaultSupabase();
    setSupabaseConfig(getCustomSupabaseConfig());
    setCloudStatusMsg(getTranslation(language, 'settings.cloudDefaultRestored'));
    setTimeout(() => setCloudStatusMsg(null), 3000);
  };

  const handleTriggerCloudSync = async () => {
    if (!currentUser) {
      alert(getTranslation(language, 'settings.cloudLoginRequired'));
      return;
    }
    if (!isSupabaseConfigured()) {
      setShowSupabaseSettings(true);
      alert(getTranslation(language, 'settings.cloudConfigRequired'));
      return;
    }

    setIsCloudSyncing(true);
    setCloudStatusMsg(getTranslation(language, 'settings.cloudSyncProgress'));

    try {
      // 1. Pull data from Cloud first
      const cloudData = await cloudSyncPull(currentUser.id);
      if (cloudData) {
        if (cloudData.albums && cloudData.albums.length > 0) {
          const storedAlbums = localStorage.getItem(albumsStorageKey);
          const localAlbums: UserAlbum[] = storedAlbums ? JSON.parse(storedAlbums) : [];
          const existingIds = new Set(localAlbums.map(album => album.id));
          const mergedAlbums = [
            ...localAlbums,
            ...cloudData.albums.filter(album => !existingIds.has(album.id)),
          ];
          localStorage.setItem(albumsStorageKey, JSON.stringify(mergedAlbums));
          onUpdateAlbums(mergedAlbums);
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
      const storedAlbums = localStorage.getItem(albumsStorageKey);
      const localAlbums = storedAlbums ? JSON.parse(storedAlbums) : [];
      await cloudSyncPush(currentUser.id, {
        albums: localAlbums,
        avatar: currentUser.avatar || '',
        accentColor: accentColor,
        themeMode: themeMode,
        language: language,
        history: history.slice(0, 30),
      });

      setCloudStatusMsg(getTranslation(language, 'settings.cloudSyncSuccess'));
      setTimeout(() => setCloudStatusMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setCloudStatusMsg(getTranslation(language, 'settings.cloudSyncError'));
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const applyBackupContent = (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.albums && Array.isArray(data.albums)) {
        localStorage.setItem(albumsStorageKey, JSON.stringify(data.albums));
        onUpdateAlbums(data.albums);
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
      alert(getTranslation(language, 'settings.backupImportSuccess'));
      window.location.reload();
    } catch (err) {
      alert(getTranslation(language, 'settings.backupImportInvalid', { error: String(err) }));
    }
  };

  // Cross-Device Backup: Export Vault to JSON using Native Windows Dialog
  const handleExportBackup = async () => {
    try {
      const storedAlbums = localStorage.getItem(albumsStorageKey);
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
          alert(getTranslation(language, 'settings.backupExportSuccess', { path: filePath }));
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
      alert(getTranslation(language, 'settings.backupExportError', { error: String(err) }));
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
    <div className={`flex-1 flex flex-col md:flex-row h-full overflow-y-auto md:overflow-hidden select-none ${themeMode === 'light' ? 'bg-[#f8fafc]' : 'bg-[#0a0a10]'}`}>
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

      {/* ──────── MOBILE SETTINGS VIEW (CLEAN, MINIMAL & STREAMLINED) ──────── */}
      <div className="md:hidden flex-1 overflow-y-auto p-4 space-y-4 pb-28">
        {/* Mobile Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div>
            <h1 className={`text-lg font-black tracking-tight ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
              {language === 'vi' ? 'Cài đặt' : 'Settings'}
            </h1>
            <p className="text-[11px] text-zinc-400 font-medium">
              {language === 'vi' ? 'Tùy chỉnh Spytify cho điện thoại' : 'Personalize Spytify for mobile'}
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 border border-white/10">
            v{CURRENT_VERSION}
          </span>
        </div>

        {/* 1. Account Card */}
        <div className={`p-4 rounded-2xl border ${themeMode === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#12121c] border-white/10'}`}>
          <div className="flex items-center gap-3">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/20 flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0 cursor-pointer"
              style={{ 
                background: currentUser?.avatar ? 'transparent' : `linear-gradient(135deg, ${accentColor} 0%, #000000 100%)`,
              }}
            >
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span>{currentUser ? currentUser.display_name.charAt(0).toUpperCase() : 'S'}</span>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 active:opacity-100 flex items-center justify-center transition-opacity">
                <Camera className="w-4 h-4 text-white" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className={`text-sm font-bold truncate ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                  {currentUser ? currentUser.display_name : (language === 'vi' ? 'Khách chưa đăng nhập' : 'Guest')}
                </h2>
                {currentUser && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                )}
              </div>
              <p className="text-xs text-zinc-400 truncate mt-0.5">
                {currentUser?.email || (language === 'vi' ? 'Chế độ ngoại tuyến / Offline' : 'Offline Mode')}
              </p>
            </div>

            {currentUser ? (
              <button
                type="button"
                onClick={onLogout}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 active:scale-95 transition-all cursor-pointer"
              >
                {language === 'vi' ? 'Đăng xuất' : 'Logout'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-black active:scale-95 transition-all shadow-md cursor-pointer"
                style={{ backgroundColor: accentColor, color: getContrastTextColor(accentColor) }}
              >
                {language === 'vi' ? 'Đăng nhập' : 'Sign in'}
              </button>
            )}
          </div>
        </div>

        {/* 2. Playback & Audio Card */}
        <div className={`p-4 rounded-2xl border space-y-3.5 ${themeMode === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#12121c] border-white/10'}`}>
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
            <Headphones className="w-4 h-4" style={{ color: accentColor }} />
            <span>{language === 'vi' ? 'Phát nhạc & Âm thanh' : 'Playback & Audio'}</span>
          </div>

          {/* Background Play Switch */}
          <div className="flex items-center justify-between pt-1">
            <div className="pr-2">
              <p className={`text-xs font-semibold ${themeMode === 'light' ? 'text-slate-800' : 'text-white'}`}>
                {language === 'vi' ? 'Phát nhạc khi tắt màn hình' : 'Background Playback'}
              </p>
              <p className="text-[11px] text-zinc-400 leading-tight mt-0.5">
                {language === 'vi' ? 'Giữ nhạc phát liên tục khi khoá màn hình iOS / Android' : 'Keep playing when screen is locked'}
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleBackgroundPlay}
              className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                isBackgroundPlayEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${
                  isBackgroundPlayEnabled ? 'transform translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          {/* Crossfade duration */}
          <div className="pt-2 border-t border-white/5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className={`font-semibold ${themeMode === 'light' ? 'text-slate-800' : 'text-white'}`}>
                {language === 'vi' ? 'Chuyển bài chéo (Crossfade)' : 'Crossfade'}
              </span>
              <span className="font-mono text-zinc-400">
                {(crossfadeDuration || 0) === 0 ? (language === 'vi' ? 'Tắt' : 'Off') : `${crossfadeDuration}s`}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 pt-1">
              {[0, 3, 6, 12].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => onUpdateCrossfadeDuration?.(sec)}
                  className={`py-1.5 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                    (crossfadeDuration || 0) === sec
                      ? 'border-transparent text-black'
                      : 'border-white/10 text-zinc-400 bg-white/5'
                  }`}
                  style={
                    (crossfadeDuration || 0) === sec
                      ? { backgroundColor: accentColor, color: getContrastTextColor(accentColor) }
                      : undefined
                  }
                >
                  {sec === 0 ? (language === 'vi' ? 'Tắt' : 'Off') : `${sec}s`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Appearance & Theme Card */}
        <div className={`p-4 rounded-2xl border space-y-3.5 ${themeMode === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#12121c] border-white/10'}`}>
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
            <Sparkles className="w-4 h-4" style={{ color: accentColor }} />
            <span>{language === 'vi' ? 'Giao diện & Màu chủ đạo' : 'Appearance & Theme'}</span>
          </div>

          {/* Dark / Light Toggle */}
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${themeMode === 'light' ? 'text-slate-800' : 'text-white'}`}>
              {language === 'vi' ? 'Chế độ hiển thị' : 'Theme Mode'}
            </span>
            <button
              type="button"
              onClick={onToggleThemeMode}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 text-zinc-300 flex items-center gap-1.5 cursor-pointer"
            >
              {themeMode === 'light' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-300" />}
              <span>{themeMode === 'light' ? (language === 'vi' ? 'Sáng' : 'Light') : (language === 'vi' ? 'Tối' : 'Dark')}</span>
            </button>
          </div>

          {/* Accent Color Swatches */}
          <div className="pt-2 border-t border-white/5 space-y-2">
            <p className={`text-xs font-semibold ${themeMode === 'light' ? 'text-slate-800' : 'text-white'}`}>
              {language === 'vi' ? 'Màu chủ đạo' : 'Accent Color'}
            </p>
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
              {THEME_PALETTE.map((pal) => (
                <button
                  key={pal.hex}
                  type="button"
                  onClick={() => onUpdateAccentColor(pal.hex)}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform cursor-pointer ${
                    accentColor.toLowerCase() === pal.hex.toLowerCase()
                      ? 'scale-110 border-white'
                      : 'border-transparent opacity-70'
                  }`}
                  style={{ backgroundColor: pal.hex }}
                >
                  {accentColor.toLowerCase() === pal.hex.toLowerCase() && (
                    <CheckCircle2 className="w-4 h-4 text-black drop-shadow" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4. Language Card */}
        <div className={`p-4 rounded-2xl border space-y-3 ${themeMode === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#12121c] border-white/10'}`}>
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
            <Globe className="w-4 h-4" style={{ color: accentColor }} />
            <span>{language === 'vi' ? 'Ngôn ngữ' : 'Language'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {SUPPORTED_LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => onUpdateLanguage?.(l.code)}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-between transition-all cursor-pointer ${
                  language === l.code
                    ? 'border-white/30 text-white font-bold bg-white/15'
                    : 'border-white/5 text-zinc-400 bg-white/5'
                }`}
              >
                <span>{l.nativeName}</span>
                <span className="text-[10px] font-mono opacity-60">{l.tag}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 5. Cloud Sync & About Card */}
        <div className={`p-4 rounded-2xl border space-y-3 ${themeMode === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#12121c] border-white/10'}`}>
          <div className="flex items-center justify-between">
            <div>
              <span className={`text-xs font-semibold ${themeMode === 'light' ? 'text-slate-800' : 'text-white'}`}>
                {language === 'vi' ? 'Đồng bộ Cloud' : 'Cloud Sync'}
              </span>
              {cloudStatusMsg && (
                <p className="text-[10px] text-zinc-400 truncate">{cloudStatusMsg}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleTriggerCloudSync}
              disabled={isCloudSyncing}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 text-zinc-200 hover:text-white flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-spin' : ''}`} />
              <span>{isCloudSyncing ? (language === 'vi' ? 'Đang đồng bộ...' : 'Syncing...') : (language === 'vi' ? 'Đồng bộ ngay' : 'Sync Now')}</span>
            </button>
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
            <span>Spytify Music</span>
            <button
              type="button"
              onClick={() => openWebsite()}
              className="text-zinc-300 hover:text-white hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>spytify.vercel.app</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ──────── 1. LEFT SIDEBAR (DESKTOP) ──────── */}
      <div className={`hidden md:flex md:w-64 border-r flex-col justify-between flex-shrink-0 ${themeMode === 'light' ? 'bg-[#f1f5f9] border-[#cbd5e1]' : 'bg-[#0b0b12] border-[#181824]'}`}>
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
                className="text-[10px] text-[#888] hover:text-white font-mono flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Edit3 className="w-2.5 h-2.5" />
                <span>{getTranslation(language, 'settings.editProfile')}</span>
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
              placeholder={getTranslation(language, 'settings.search')}
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
                {getTranslation(language, 'settings.userGroup')}
              </p>
              <div className="space-y-0.5">
                {[
                  { key: 'account', label: getTranslation(language, 'settings.navAccount'), icon: UserIcon },
                  { key: 'profile_appearance', label: getTranslation(language, 'settings.navAppearance'), icon: Palette },
                  { key: 'account_status', label: getTranslation(language, 'settings.navAccountStatus'), icon: ShieldCheck },
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
                {getTranslation(language, 'settings.appGroup')}
              </p>
              <div className="space-y-0.5">
                {[
                  { key: 'voice_audio', label: getTranslation(language, 'settings.navVoice'), icon: Mic },
                  { key: 'download_storage', label: getTranslation(language, 'settings.navDownloads'), icon: FolderDown },
                  { key: 'cloud_sync', label: getTranslation(language, 'settings.navCloud'), icon: Cloud },
                  { key: 'system', label: getTranslation(language, 'settings.navSystem'), icon: Zap },
                  { key: 'language', label: getTranslation(language, 'settings.navLanguage'), icon: Globe },
                  { key: 'activity_history', label: getTranslation(language, 'settings.navHistory'), icon: Clock },
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
              <span>{getTranslation(language, 'settings.logout')}</span>
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

      {/* ──────── 2. RIGHT CONTENT PANE (DISCORD SETTING CARDS - DESKTOP) ──────── */}
      <div className="hidden md:block flex-1 p-4 sm:p-6 md:p-8 md:overflow-y-auto w-full max-w-5xl 2xl:max-w-6xl">
        {activeTab === 'account' && (
          <div className="space-y-6">
            <div>
              <h2 className={`text-xl font-black ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                {getTranslation(language, 'settings.accountTitle')}
              </h2>
              <p className="text-xs text-[#777] font-mono mt-0.5">
                {getTranslation(language, 'settings.accountDescription')}
              </p>
            </div>

            {/* Discord Account Info Card */}
            <div className={`p-4 rounded-2xl border space-y-4 ${themeMode === 'light' ? 'bg-white border-[#e2e8f0]' : 'bg-[#101018] border-[#1e1e2c]'}`}>
              <div className="flex items-center justify-between pb-3 border-b border-[#1c1c28]">
                <div>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#777]">{getTranslation(language, 'settings.username')}</p>
                  <p className={`text-sm font-bold mt-0.5 ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                    @{currentUser ? currentUser.username : 'khach'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => alert(getTranslation(language, 'settings.usernameManaged'))}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono font-bold text-zinc-300 hover:text-white cursor-pointer transition-colors"
                >
                  {getTranslation(language, 'settings.edit')}
                </button>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-[#1c1c28]">
                <div>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#777]">{getTranslation(language, 'settings.displayName')}</p>
                  <p className={`text-sm font-bold mt-0.5 ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                    {currentUser ? currentUser.display_name : getTranslation(language, 'settings.guestNotSignedIn')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('profile_appearance')}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono font-bold text-zinc-300 hover:text-white cursor-pointer transition-colors"
                >
                  {getTranslation(language, 'settings.edit')}
                </button>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-[#1c1c28]">
                <div className="flex-1 pr-4">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#777]">{getTranslation(language, 'settings.bio')}</p>
                  {isEditingBio ? (
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={160}
                        value={userBio}
                        onChange={e => setUserBio(e.target.value)}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-sans border outline-none ${
                          themeMode === 'light' ? 'bg-slate-100 border-slate-300 text-slate-900' : 'bg-[#141420] border-[#252538] text-white focus:border-white/40'
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
                          onUpdateBio(userBio.trim());
                          setIsEditingBio(false);
                        }}
                        style={{
                          backgroundColor: accentColor,
                          color: getContrastTextColor(accentColor),
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors shadow"
                      >
                        {getTranslation(language, 'settings.save')}
                      </button>
                    </div>
                  ) : (
                    <p className={`text-xs mt-0.5 font-sans ${themeMode === 'light' ? 'text-slate-700' : 'text-zinc-300'}`}>
                      {userBio || getTranslation(language, 'settings.bioNotSet')}
                    </p>
                  )}
                </div>
                {!isEditingBio && (
                  <button
                    type="button"
                    onClick={() => setIsEditingBio(true)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono font-bold text-zinc-300 hover:text-white cursor-pointer transition-colors"
                  >
                    {getTranslation(language, 'settings.edit')}
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-[#1c1c28]">
                <div>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#777]">{getTranslation(language, 'settings.email')}</p>
                  <p className={`text-sm font-bold mt-0.5 ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                    {currentUser?.email ? currentUser.email : getTranslation(language, 'settings.emailNotLinked')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => alert(getTranslation(language, 'settings.emailSyncedCloud'))}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono font-bold text-zinc-300 hover:text-white cursor-pointer transition-colors"
                >
                  {getTranslation(language, 'settings.edit')}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#777]">{getTranslation(language, 'settings.phone')}</p>
                  <p className="text-xs text-[#666] font-mono mt-0.5">{getTranslation(language, 'settings.phoneNotAdded')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => alert(getTranslation(language, 'settings.phoneComingSoon'))}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono font-bold text-zinc-300 hover:text-white cursor-pointer transition-colors"
                >
                  {getTranslation(language, 'settings.add')}
                </button>
              </div>
            </div>

            {/* Mật Khẩu & Bảo Mật Card */}
            <div>
              <h3 className={`text-sm font-bold mb-2 ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                {getTranslation(language, 'settings.passwordSecurity')}
              </h3>
              <div className={`p-4 rounded-2xl border space-y-3 ${themeMode === 'light' ? 'bg-white border-[#e2e8f0]' : 'bg-[#101018] border-[#1e1e2c]'}`}>
                <div className="flex items-center justify-between pb-2 border-b border-[#1c1c28]">
                  <div>
                    <p className="text-xs font-bold text-white">{getTranslation(language, 'settings.password')}</p>
                    <p className="text-[11px] text-[#777] font-mono">••••••••••••</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenChangePasswordModal}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono font-bold text-zinc-300 hover:text-white cursor-pointer transition-colors"
                  >
                    Đổi mật khẩu
                  </button>
                </div>

                <div className="pb-3 border-b border-[#1c1c28]">
                  <div className="flex items-center justify-between">
                    <div className="pr-4">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-white">{getTranslation(language, 'settings.twoFactor')}</p>
                        <span 
                          className="text-[10px] px-2 py-0.5 rounded font-mono font-bold border"
                          style={{
                            backgroundColor: `${accentColor}18`,
                            borderColor: `${accentColor}40`,
                            color: accentColor,
                          }}
                        >
                          Google Authenticator
                        </span>
                      </div>
                      <p className="text-[11px] text-[#777] font-mono mt-0.5">
                        Bảo mật tài khoản bằng mã xác thực 6 số (RFC 6238 TOTP)
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {twoFactorEnabled ? (
                        <>
                          <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {getTranslation(language, 'settings.activated')}
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowDisable2FaConfirmModal(true)}
                            className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-mono transition-colors cursor-pointer border border-red-500/20"
                          >
                            Tắt 2FA
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={handleOpen2FaSetup}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm hover:scale-105 flex items-center gap-1.5"
                          style={{
                            backgroundColor: accentColor,
                            color: getContrastTextColor(accentColor),
                          }}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Kích hoạt 2FA</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Tùy chọn phạm vi 2FA: Đăng nhập / Reset Password / Cả hai */}
                  {twoFactorEnabled && (
                    <div className="mt-3.5 pt-3 border-t border-white/5 space-y-2 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5" style={{ color: accentColor }} />
                          <span>Áp dụng xác thực 2FA khi:</span>
                        </span>
                        <span className="text-[9px] font-mono text-zinc-500">
                          (Nhấn để đổi phạm vi bảo vệ)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {([
                          {
                            id: 'both' as const,
                            title: 'Cả hai (Khuyên dùng)',
                            desc: 'Đăng nhập & Đặt lại mật khẩu',
                          },
                          {
                            id: 'login' as const,
                            title: 'Chỉ khi đăng nhập',
                            desc: 'Reset pass dùng mã gửi về Email',
                          },
                          {
                            id: 'reset_password' as const,
                            title: 'Chỉ khi đặt lại mật khẩu',
                            desc: 'Đăng nhập bằng pass thường',
                          },
                        ]).map(item => {
                          const isSelected = twoFactorScope === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleUpdate2FaScope(item.id)}
                              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between group ${
                                isSelected
                                  ? 'text-white shadow-lg'
                                  : 'bg-[#12121c]/70 border-[#222234] text-zinc-400 hover:text-white hover:bg-white/5'
                              }`}
                              style={isSelected ? {
                                backgroundColor: `${accentColor}18`,
                                borderColor: `${accentColor}60`,
                                boxShadow: `0 0 14px ${accentColor}15`,
                              } : undefined}
                            >
                              <div className="flex items-center justify-between gap-1 mb-1.5">
                                <span 
                                  className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-zinc-300'}`}
                                  style={isSelected ? { color: accentColor } : undefined}
                                >
                                  {item.title}
                                </span>
                                {isSelected ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} />
                                ) : (
                                  <span className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0 group-hover:border-white/40" />
                                )}
                              </div>
                              <p className="text-[10px] text-zinc-400 leading-tight">
                                {item.desc}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-white">{getTranslation(language, 'settings.signedInDevices')}</p>
                    <p className="text-[11px] text-[#777] font-mono">{getTranslation(language, 'settings.signedInDeviceCount')}</p>
                  </div>
                  <span className="text-xs font-mono font-bold flex items-center gap-1.5 text-zinc-300">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
                    {getTranslation(language, 'settings.currentDevice')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile_appearance' && (
          <div className="space-y-6">
            <div>
              <h2 className={`text-xl font-black ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                {getTranslation(language, 'settings.navAppearance')}
              </h2>
              <p className="text-xs text-[#777] font-mono mt-0.5">
                {getTranslation(language, 'settings.appearanceDescription')}
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
                <p className="text-[11px] text-[#777] font-mono mb-2">{getTranslation(language, 'settings.avatarPresetPrompt')}</p>
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
                {getTranslation(language, 'settings.navAccountStatus')}
              </h2>
              <p className="text-xs text-[#777] font-mono mt-0.5">
                {getTranslation(language, 'settings.statusDescription')}
              </p>
            </div>

            {/* Neutral Glass Info Banner */}
            <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10 text-zinc-300 text-xs flex items-start gap-3 shadow-sm">
              <Info className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-0.5" style={{ color: accentColor }} />
              <p className="leading-relaxed">
                {getTranslation(language, 'settings.ageNotice')}
              </p>
            </div>

            <div className={`p-4 rounded-2xl border space-y-4 ${themeMode === 'light' ? 'bg-white border-[#e2e8f0]' : 'bg-[#101018] border-[#1e1e2c]'}`}>
              <div className="flex items-center justify-between pb-3 border-b border-[#1c1c28]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{getTranslation(language, 'settings.ageGroup')}</p>
                    <p className="text-[11px] text-[#777] font-mono">{getTranslation(language, 'settings.ageDescription')}</p>
                  </div>
                </div>
                <span className="text-xs font-bold font-mono text-zinc-300">{getTranslation(language, 'settings.adult')}</span>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-[#1c1c28]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{getTranslation(language, 'settings.accountStatus')}</p>
                    <p className="text-[11px] text-[#777] font-mono">{getTranslation(language, 'settings.accountStatusDescription')}</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400">{getTranslation(language, 'settings.healthy')}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center border"
                    style={{
                      backgroundColor: `${accentColor}18`,
                      borderColor: `${accentColor}40`,
                      color: accentColor,
                    }}
                  >
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{getTranslation(language, 'settings.sqliteTitle')}</p>
                    <p className="text-[11px] text-[#777] font-mono">{getTranslation(language, 'settings.sqliteDescription')}</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold" style={{ color: accentColor }}>{getTranslation(language, 'settings.active')}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'voice_audio' && (
          <div className="space-y-6">
            <div>
              <h2 className={`text-xl font-black ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                {getTranslation(language, 'settings.navVoice')}
              </h2>
              <p className="text-xs text-[#777] font-mono mt-0.5">
                {getTranslation(language, 'settings.voiceDescription')}
              </p>
            </div>

            <div className={`p-5 rounded-2xl border space-y-5 ${themeMode === 'light' ? 'bg-white border-[#e2e8f0]' : 'bg-[#101018] border-[#1e1e2c]'}`}>
              {/* Master Music Volume Slider */}
              {onVolumeChange !== undefined && (
                <div className="p-4 rounded-xl bg-[#0e0e14] border border-[#1e1e28] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-zinc-300" style={{ color: accentColor }} />
                        <span className="text-xs font-bold text-white">Âm lượng phát nhạc chính (Master)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span 
                          className="text-xs font-mono font-bold px-2 py-0.5 rounded border"
                          style={{
                            backgroundColor: `${accentColor}18`,
                            borderColor: `${accentColor}40`,
                            color: accentColor,
                          }}
                        >
                          {Math.round((volume ?? 0.8) * 100)}%
                        </span>
                        <button
                          type="button"
                          onClick={() => onVolumeChange(0.8)}
                          title={getTranslation(language, 'settings.resetVolume')}
                          className="p-1 rounded hover:bg-[#1a1a24] text-[#777] hover:text-white text-[10px] font-mono transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={volume ?? 0.8}
                      onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                      style={{ accentColor }}
                      className="w-full h-1.5 bg-[#1c1c2a] rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-1">
                    <span className="text-[10px] text-[#555] font-mono">0% - 100% • Đồng bộ trực tiếp với PlayerBar</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Mic Volume */}
                <div className="p-4 rounded-xl bg-[#0e0e14] border border-[#1e1e28] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Mic className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-white">{getTranslation(language, 'settings.microphoneVolume')}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded">
                          {voiceMicVolume}%
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateMicVolume(100)}
                          title={getTranslation(language, 'settings.resetVolume')}
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
                    {getTranslation(language, 'settings.microphoneDescription')}
                  </p>
                </div>

                {/* Speaker Volume */}
                <div className="p-4 rounded-xl bg-[#0e0e14] border border-[#1e1e28] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-zinc-300" style={{ color: accentColor }} />
                        <span className="text-xs font-bold text-white">{getTranslation(language, 'settings.speakerVolume')}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span 
                          className="text-xs font-mono font-bold px-2 py-0.5 rounded border"
                          style={{
                            backgroundColor: `${accentColor}18`,
                            borderColor: `${accentColor}40`,
                            color: accentColor,
                          }}
                        >
                          {voiceSpeakerVolume}%
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateSpeakerVolume(100)}
                          title={getTranslation(language, 'settings.resetVolume')}
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
                      style={{ accentColor }}
                      className="w-full h-1.5 bg-[#1c1c2a] rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-1">
                    <span className="text-[10px] text-[#555] font-mono">{getTranslation(language, 'settings.volumeRange')}</span>
                    <button
                      type="button"
                      onClick={playSpeakerTestChime}
                      style={{
                        backgroundColor: `${accentColor}18`,
                        borderColor: `${accentColor}40`,
                        color: accentColor,
                      }}
                      className="px-2.5 py-1 rounded-lg border font-mono text-[10px] flex items-center gap-1 transition-all cursor-pointer shadow-sm hover:scale-105"
                    >
                      <Volume1 className="w-3 h-3" />
                      <span>{getTranslation(language, 'settings.testSpeaker')}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0e0e14] border border-[#1e1e28] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Monitor className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-white">{getTranslation(language, 'settings.shareFps')}</p>
                    <p className="text-[10px] text-[#777] font-mono mt-0.5">
                      {getTranslation(language, 'settings.shareFpsDescription')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {([30, 60, 90] as const).map(fps => (
                    <button
                      key={fps}
                      type="button"
                      onClick={() => onScreenShareFpsChange(fps)}
                      aria-pressed={screenShareFps === fps}
                      className={`px-4 py-2 rounded-lg border text-xs font-mono font-bold transition-colors cursor-pointer ${
                        screenShareFps === fps
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                          : 'bg-[#14141c] border-[#22222e] text-[#999] hover:text-white hover:border-emerald-500/40'
                      }`}
                    >
                      {fps} FPS
                    </button>
                  ))}
                </div>
              </div>

              {/* Spotify-style Crossfade Songs */}
              <div className="p-4 rounded-xl bg-[#0e0e14] border border-[#1e1e28] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 text-emerald-400">
                      <Sliders className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-white">
                          {getTranslation(language, 'settings.crossfade')}
                        </p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                          {currentCrossfade > 0 ? `${currentCrossfade}s` : getTranslation(language, 'settings.crossfadeOff')}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#777] font-mono mt-0.5">
                        {getTranslation(language, 'settings.crossfadeDesc')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { sec: 0, label: getTranslation(language, 'settings.crossfadeOff') },
                      { sec: 3, label: '3s' },
                      { sec: 5, label: `5s (${getTranslation(language, 'settings.crossfadeRecommended')})` },
                      { sec: 8, label: '8s' },
                      { sec: 12, label: '12s' },
                    ].map(opt => (
                      <button
                        key={opt.sec}
                        type="button"
                        onClick={() => handleUpdateCrossfade(opt.sec)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
                          currentCrossfade === opt.sec
                            ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-sm'
                            : 'bg-[#14141c] border-[#22222e] text-[#888] hover:text-white hover:border-[#333344]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Range Slider for custom 0-12s precision */}
                <div className="pt-2 flex items-center gap-4">
                  <span className="text-[10px] font-mono text-[#555] w-14">0s (Tắt)</span>
                  <input
                    type="range"
                    min="0"
                    max="12"
                    step="1"
                    value={currentCrossfade}
                    onChange={(e) => handleUpdateCrossfade(parseInt(e.target.value, 10))}
                    className="flex-1 h-1.5 bg-[#1c1c2a] rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                  <span className="text-[10px] font-mono text-[#555] w-8 text-right">12s</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'download_storage' && (
          <div className="space-y-6">
            <div>
              <h2 className={`text-xl font-black ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                {getTranslation(language, 'settings.navDownloads')}
              </h2>
              <p className="text-xs text-[#777] font-mono mt-0.5">
                {getTranslation(language, 'settings.downloadsDescription')}
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
                {getTranslation(language, 'settings.navCloud')}
              </h2>
              <p className="text-xs text-[#777] font-mono mt-0.5">
                {getTranslation(language, 'settings.cloudDescription')}
              </p>
            </div>

            {/* Cloud Sync Container */}
            <div className={`p-5 rounded-2xl border space-y-4 ${themeMode === 'light' ? 'bg-white border-[#e2e8f0]' : 'bg-[#101018] border-[#1e1e2c]'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                    <Cloud className="w-3.5 h-3.5" style={{ color: accentColor }} />
                    {getTranslation(language, 'settings.cloudSyncLabel')}
                  </label>
                  <p className="text-[11px] text-[#777] mt-0.5">
                    {getTranslation(language, 'settings.cloudSyncDescription')}
                  </p>
                </div>
                <span className={`text-[10px] px-2.5 py-0.5 rounded font-mono border ${
                  isSupabaseConfigured() 
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' 
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}>
                  {isSupabaseConfigured()
                    ? getTranslation(language, 'settings.cloudReady')
                    : getTranslation(language, 'settings.cloudDisconnected')}
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
                  <span>
                    {isCloudSyncing
                      ? getTranslation(language, 'settings.syncing')
                      : getTranslation(language, 'settings.syncNow')}
                  </span>
                </button>

                <button
                  onClick={() => setShowSupabaseSettings(p => !p)}
                  className="py-2.5 px-3 rounded-xl bg-[#0c0c12] hover:bg-[#15151e] border border-[#222230] text-xs font-semibold text-[#aaa] hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>{getTranslation(language, 'settings.customSupabase')}</span>
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
                      {getTranslation(language, 'settings.selfHostedSupabase')}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopySql}
                      className="px-2.5 py-1 rounded bg-[#181824] hover:bg-[#222230] text-[11px] font-mono text-[#aaa] hover:text-white border border-[#2c2c3c] flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedSql ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>
                        {copiedSql
                          ? getTranslation(language, 'settings.copiedSql')
                          : getTranslation(language, 'settings.copySql')}
                      </span>
                    </button>
                  </div>

                  <form onSubmit={handleSaveSupabase} className="space-y-3">
                    <div>
                      <label className="text-[11px] font-mono text-[#888] block mb-1">
                        Supabase Project URL
                      </label>
                      <input
                        type="text"
                        placeholder={
                          supabaseConfig.isCustom
                            ? 'https://your-project.supabase.co'
                            : getTranslation(language, 'settings.defaultProjectPlaceholder')
                        }
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
                        placeholder={
                          supabaseConfig.isCustom
                            ? 'sb_publishable_...'
                            : getTranslation(language, 'settings.defaultKeyPlaceholder')
                        }
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
                        <span>
                          {isTestingConnection
                            ? getTranslation(language, 'settings.testing')
                            : getTranslation(language, 'settings.testConnection')}
                        </span>
                      </button>

                      <button
                        type="submit"
                        className="py-1.5 px-4 rounded-lg bg-white text-black font-bold text-xs hover:bg-[#ddd] transition-colors cursor-pointer"
                      >
                        {getTranslation(language, 'settings.saveConfig')}
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
                    <p className="text-[10px] text-[#777] font-mono">{getTranslation(language, 'settings.exportBackupHint')}</p>
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
                    <p className="text-[10px] text-[#777] font-mono">{getTranslation(language, 'settings.importBackupHint')}</p>
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
                {getTranslation(language, 'settings.navSystem')}
              </h2>
              <p className="text-xs text-[#777] font-mono mt-0.5">
                {getTranslation(language, 'settings.systemDescription')}
              </p>
            </div>

            <div className={`p-5 rounded-2xl border space-y-5 ${themeMode === 'light' ? 'bg-white border-[#e2e8f0]' : 'bg-[#101018] border-[#1e1e2c]'}`}>
              {/* Chế độ phát nền khi tắt màn hình điện thoại (Web / Mobile PWA) */}
              {onToggleBackgroundPlay && (
                <div className="flex items-center justify-between pb-4 border-b border-[#1c1c28]">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                    >
                      <Headphones className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">
                        {language === 'vi'
                          ? 'Phát nhạc nền khi tắt màn hình điện thoại'
                          : 'Background Audio on Screen Lock'}
                      </p>
                      <p className="text-[11px] text-[#777] mt-0.5">
                        {isBackgroundPlayEnabled
                          ? language === 'vi'
                            ? 'Đang bật: Giữ nhạc phát & tự chuyển bài khi khóa màn hình hoặc ẩn trình duyệt'
                            : 'Enabled: Keep music playing when screen locks or switching apps'
                          : language === 'vi'
                          ? 'Đang tắt: Trình duyệt có thể tạm dừng nhạc khi tắt màn hình'
                          : 'Disabled: Browser may pause audio when screen is locked'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleBackgroundPlay}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                      isBackgroundPlayEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isBackgroundPlayEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              )}

              {isWebShim ? (
                /* Web PWA: Đồng bộ tự động qua GitHub / Vercel — Không có bản cài hay bản vá thủ công */
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    >
                      <CloudLightning className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-bold text-white">
                          {language === 'vi' ? 'Phiên bản Web PWA' : 'Web PWA Version'}
                        </p>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          {language === 'vi' ? 'Tự động đồng bộ GitHub' : 'Auto-synced with GitHub'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#777] mt-0.5">
                        {language === 'vi'
                          ? 'Bản Web luôn cập nhật trực tiếp từ GitHub Cloud, không cần kiểm tra bản vá lỗi thủ công.'
                          : 'Web app updates automatically from GitHub/Vercel—no manual update or patch needed.'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
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
                        <p className="text-xs font-bold text-white">{getTranslation(language, 'settings.launchWithWindows')}</p>
                        <p className="text-[11px] text-[#777] mt-0.5">
                          {launchOnStartup
                            ? getTranslation(language, 'settings.launchEnabled')
                            : getTranslation(language, 'settings.launchDisabled')}
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
                        <p className="text-xs font-bold text-white">{getTranslation(language, 'settings.trayTitle')}</p>
                        <p className="text-[11px] text-[#777] mt-0.5">
                          {closeToTray 
                            ? getTranslation(language, 'settings.trayEnabled')
                            : getTranslation(language, 'settings.trayDisabled')}
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
                          <p className="text-xs font-bold text-white">{getTranslation(language, 'settings.updateApp')}</p>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#151520] text-zinc-300 border border-[#252535]">
                            {getTranslation(language, 'settings.version')} v{CURRENT_VERSION}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#777] mt-0.5">
                          {getTranslation(language, 'settings.updateDescription')}
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
                      <span>
                        {isCheckingUpdate
                          ? getTranslation(language, 'settings.checking')
                          : getTranslation(language, 'settings.checkUpdate')}
                      </span>
                    </button>
                  </div>
                </>
              )}

              {/* Spytify Vercel Website Card */}
              <div className="pt-4 border-t border-[#1c1c28] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/5 border border-white/10"
                    style={{ color: accentColor }}
                  >
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-white">{getTranslation(language, 'website.title')}</p>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-zinc-300 border border-white/10">
                        Vercel Live
                      </span>
                    </div>
                    <p className="text-[11px] text-[#777] mt-0.5">
                      Trang web giới thiệu ứng dụng, tính năng Spytify và tải trực tiếp file cài đặt.
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[280px]">
                        {siteUrl}
                      </span>
                      {siteUrl !== DEFAULT_WEBSITE_URL && (
                        <button
                          type="button"
                          onClick={() => {
                            setWebsiteUrl(DEFAULT_WEBSITE_URL);
                            setSiteUrl(DEFAULT_WEBSITE_URL);
                            setTempSiteUrl(DEFAULT_WEBSITE_URL);
                          }}
                          className="text-[9px] text-[#666] hover:text-[#aaa] underline cursor-pointer"
                        >
                          (Đặt lại mặc định)
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => openWebsite(siteUrl)}
                    style={{
                      backgroundColor: accentColor,
                      color: getContrastTextColor(accentColor),
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md hover:scale-105"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{getTranslation(language, 'website.btnOpen')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'language' && (
          <div className="space-y-6">
            <div>
              <h2 className={`text-xl font-black ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                {getTranslation(language, 'settings.navLanguage')}
              </h2>
              <p className="text-xs text-[#777] font-mono mt-0.5">
                {getTranslation(language, 'settings.languageDescription')}
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
                {getTranslation(language, 'settings.navHistory')}
              </h2>
              <p className="text-xs text-[#777] font-mono mt-0.5">
                {getTranslation(language, 'settings.historyDescription')}
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
                    <p className="text-[11px] text-[#777] font-mono uppercase">{getTranslation(language, 'settings.totalPlays')}</p>
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
                    <p className="text-[11px] text-[#777] font-mono uppercase">{getTranslation(language, 'settings.favoritesCount')}</p>
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
                    <p className="text-[11px] text-[#777] font-mono uppercase">{getTranslation(language, 'settings.topArtist')}</p>
                    <p className={`text-sm font-bold mt-0.5 truncate ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>{stats.top_artist || getTranslation(language, 'settings.unknown')}</p>
                  </div>
                </div>
              </div>
            )}

            {/* History List */}
            <div className={`p-5 rounded-2xl border space-y-3 ${themeMode === 'light' ? 'bg-white border-[#e2e8f0]' : 'bg-[#101018] border-[#1e1e2c]'}`}>
              <div className="flex items-center justify-between pb-2 border-b border-[#1c1c28]">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  {getTranslation(language, 'settings.recentTracks')}
                </h3>
                <span className="text-[10px] text-[#777] font-mono">{getTranslation(language, 'settings.replayHint')}</span>
              </div>

              {history.length === 0 ? (
                <div className="text-center py-8 text-[#555] text-xs">{getTranslation(language, 'settings.noHistory')}</div>
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

      {/* Google Authenticator (2FA) Setup Modal */}
      {show2FaModal && currentUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#0e0e14] border border-[#222230] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1c1c28] pb-3">
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center border"
                  style={{
                    backgroundColor: `${accentColor}18`,
                    borderColor: `${accentColor}40`,
                    color: accentColor,
                  }}
                >
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Thiết lập Google Authenticator (2FA)</h3>
                  <p className="text-[10px] text-zinc-400 font-mono">Bảo vệ tài khoản @{currentUser.username}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShow2FaModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-zinc-300">
              <div className="p-3 rounded-xl bg-black/50 border border-white/5 space-y-1">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  <span 
                    className="w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center"
                    style={{
                      backgroundColor: accentColor,
                      color: getContrastTextColor(accentColor),
                    }}
                  >
                    1
                  </span>
                  Tải app Authenticator
                </p>
                <p className="text-[11px] text-zinc-400 pl-5">
                  Tải <strong className="text-white">Google Authenticator</strong> hoặc <strong className="text-white">Microsoft Authenticator</strong> từ App Store / Google Play về điện thoại.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-black/50 border border-white/5 space-y-2">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  <span 
                    className="w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center"
                    style={{
                      backgroundColor: accentColor,
                      color: getContrastTextColor(accentColor),
                    }}
                  >
                    2
                  </span>
                  Quét mã QR hoặc nhập khóa thủ công
                </p>
                
                {/* QR Code */}
                <div className="flex justify-center py-2">
                  <div className="p-2.5 rounded-xl bg-white shadow-md flex items-center justify-center">
                    <img
                      src={getQrCodeImageUrl(getOtpAuthUrl(currentUser.username, secret2Fa, 'Spytify'), 180)}
                      alt="2FA QR Code"
                      className="w-[160px] h-[160px] object-contain"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-zinc-400">Khóa bí mật (Secret Key) để nhập thủ công:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={secret2Fa}
                      className="flex-1 py-1 px-2.5 rounded-lg bg-[#07070a] border border-[#262634] text-xs text-zinc-200 font-mono tracking-wider select-all"
                    />
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="px-2.5 py-1 rounded-lg bg-[#181824] hover:bg-[#222232] border border-[#303044] text-[11px] text-white flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedSecret ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSecret ? 'Đã sao chép' : 'Sao chép'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 3: Enter 6 digit code */}
              <form onSubmit={handleConfirm2FaSetup} className="space-y-3">
                <div className="p-3 rounded-xl bg-black/50 border border-white/5 space-y-1.5">
                  <label className="font-semibold text-white flex items-center gap-1.5">
                    <span 
                      className="w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center"
                      style={{
                        backgroundColor: accentColor,
                        color: getContrastTextColor(accentColor),
                      }}
                    >
                      3
                    </span>
                    Nhập mã 6 chữ số từ app để xác nhận:
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={code2FaInput}
                    onChange={(e) => setCode2FaInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full py-2 px-3 text-center text-lg font-mono tracking-[0.3em] font-bold rounded-lg bg-[#07070a] border border-white/20 text-white outline-none focus:border-white/50"
                    autoFocus
                  />
                </div>

                {twoFactorError && (
                  <p className="text-xs text-red-400 font-mono flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{twoFactorError}</span>
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1c1c28]">
                  <button
                    type="button"
                    onClick={() => setShow2FaModal(false)}
                    className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={code2FaInput.length !== 6 || twoFactorLoading}
                    style={{
                      backgroundColor: accentColor,
                      color: getContrastTextColor(accentColor),
                    }}
                    className="px-5 py-2 rounded-xl text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-lg"
                  >
                    {twoFactorLoading ? 'Đang kiểm tra...' : 'Xác nhận & Kích hoạt'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal xác nhận hủy 2FA */}
      {showDisable2FaConfirmModal && currentUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#0e0e14] border border-red-500/30 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Tắt xác thực 2 lớp (2FA)?</h3>
                <p className="text-[11px] text-zinc-400 font-mono">Tài khoản @{currentUser.username}</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed bg-black/40 p-3 rounded-xl border border-white/5">
              Khi tắt xác thực 2 lớp, tài khoản của bạn sẽ không còn được bảo vệ bởi mã từ ứng dụng <strong className="text-white">Google Authenticator</strong>. Bất kỳ ai có mật khẩu đều có thể đăng nhập hoặc đặt lại mật khẩu trực tiếp.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1c1c28]">
              <button
                type="button"
                onClick={() => setShowDisable2FaConfirmModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Giữ lại 2FA
              </button>
              <button
                type="button"
                onClick={handleConfirmDisable2Fa}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-all cursor-pointer shadow-lg shadow-red-500/20"
              >
                Xác nhận tắt 2FA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal Đổi / Reset Mật Khẩu trực tiếp */}
      {showChangePasswordModal && currentUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#0e0e14] border border-[#222230] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1c1c28] pb-3">
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center border"
                  style={{
                    backgroundColor: `${accentColor}18`,
                    borderColor: `${accentColor}40`,
                    color: accentColor,
                  }}
                >
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Đổi mật khẩu tài khoản</h3>
                  <p className="text-[10px] text-zinc-400 font-mono">@{currentUser.username}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePasswordModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {changePasswordError && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{changePasswordError}</span>
              </div>
            )}

            {changePasswordSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{changePasswordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveNewPassword} className="space-y-3.5">
              {/* Nếu tài khoản có 2FA, cho phép chọn cách xác minh */}
              {twoFactorEnabled && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                    Phương thức xác minh danh tính:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setChangePasswordVerifyMode('authenticator')}
                      className={`p-2.5 rounded-xl text-left border text-xs flex items-center gap-2 cursor-pointer transition-all ${
                        changePasswordVerifyMode === 'authenticator'
                          ? 'text-white font-bold shadow-md'
                          : 'bg-[#121218] border-white/10 text-zinc-400 hover:text-white'
                      }`}
                      style={changePasswordVerifyMode === 'authenticator' ? {
                        backgroundColor: `${accentColor}18`,
                        borderColor: `${accentColor}60`,
                        color: accentColor,
                      } : undefined}
                    >
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={changePasswordVerifyMode === 'authenticator' ? { color: accentColor } : undefined} />
                      <span>Google Authenticator</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setChangePasswordVerifyMode('password')}
                      className={`p-2.5 rounded-xl text-left border text-xs flex items-center gap-2 cursor-pointer transition-all ${
                        changePasswordVerifyMode === 'password'
                          ? 'text-white font-bold shadow-md'
                          : 'bg-[#121218] border-white/10 text-zinc-400 hover:text-white'
                      }`}
                      style={changePasswordVerifyMode === 'password' ? {
                        backgroundColor: `${accentColor}18`,
                        borderColor: `${accentColor}60`,
                        color: accentColor,
                      } : undefined}
                    >
                      <Lock className="w-3.5 h-3.5 shrink-0" style={changePasswordVerifyMode === 'password' ? { color: accentColor } : undefined} />
                      <span>Mật khẩu hiện tại</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Input xác minh */}
              {twoFactorEnabled && changePasswordVerifyMode === 'authenticator' ? (
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                    Mã xác thực Google Authenticator (6 chữ số):
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    placeholder="000000"
                    value={changePasswordTotpInput}
                    onChange={(e) => setChangePasswordTotpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full py-2 px-3 bg-[#07070a] text-white font-mono tracking-widest text-center font-bold text-base rounded-xl border border-white/20 focus:border-white/50 outline-none transition-colors"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                    Mật khẩu hiện tại:
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full py-2 px-3 bg-[#07070a] text-white text-xs rounded-xl border border-[#262634] focus:border-white/40 outline-none transition-colors"
                  />
                </div>
              )}

              {/* Mật khẩu mới */}
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Mật khẩu mới (tối thiểu 6 ký tự):
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Nhập mật khẩu mới..."
                  className="w-full py-2 px-3 bg-[#07070a] text-white text-xs rounded-xl border border-[#262634] focus:border-white/40 outline-none transition-colors"
                />
              </div>

              {/* Xác nhận mật khẩu mới */}
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Nhập lại mật khẩu mới:
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmNewPasswordInput}
                  onChange={(e) => setConfirmNewPasswordInput(e.target.value)}
                  placeholder="Xác nhận mật khẩu mới..."
                  className="w-full py-2 px-3 bg-[#07070a] text-white text-xs rounded-xl border border-[#262634] focus:border-white/40 outline-none transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1c1c28]">
                <button
                  type="button"
                  onClick={() => setShowChangePasswordModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={changePasswordLoading || newPasswordInput.length < 6 || !confirmNewPasswordInput}
                  style={{
                    backgroundColor: accentColor,
                    color: getContrastTextColor(accentColor),
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-lg"
                >
                  {changePasswordLoading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
