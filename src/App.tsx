import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
import { Sidebar } from './components/Sidebar';
import { PlayerBar } from './components/PlayerBar';
import { TrackTable } from './components/TrackTable';
import { SearchView } from './components/SearchView';
import { AudioVisualizer } from './components/AudioVisualizer';
import { AuthModal } from './components/AuthModal';
import { ProfileView } from './components/ProfileView';
import { AiMixView } from './components/AiMixView';
import { CommunityView } from './components/CommunityView';
import { HomeTrendingView } from './components/HomeTrendingView';
import { AlbumsView } from './components/AlbumsView';
import { AddToAlbumModal } from './components/AddToAlbumModal';
import { CreateAlbumFromSelectionModal } from './components/CreateAlbumFromSelectionModal';
import { EqualizerModal } from './components/EqualizerModal';
import { loadEqualizerState, attachAudioElementToEqualizer, ensureAudioContextRunning, applyEqualizerStateToGraph, getOrCreateMasterAudioStream } from './services/equalizer';
import { spytifyConnect, ConnectCommand, ConnectPlaybackState } from './services/spytifyConnect';
import { SplashScreen } from './components/SplashScreen';
import { UpdateModal } from './components/UpdateModal';
import { checkGitHubUpdate, checkStartupUpdatePolicy, UpdateInfo, CURRENT_VERSION, compareSemver, resolveDirectInstallerUrl } from './services/updater';
import { cloudSyncPull, cloudSyncPush, isSupabaseConfigured, cloudRegisterUser } from './services/supabase';
import { openWebsite } from './services/website';
import { deduplicateTracks, optimizeThumbnailUrl, handleImageError, sanitizeTrackTitle, getContrastTextColor } from './utils/trackUtils';
import { resolve7CloudsVideoId, cleanTrackMetadata, getCached7CloudsVideoId, getCachedUnblockedVideoId, resolveUnblockedAudioVideoId, cleanQueryTerm } from './services/sevenCloudsResolver';
import { Track, PlaybackStatus, SearchResult, ViewType, User, UserAlbum, RecommendationResult, ArtistMix } from './types';
import { FolderPlus, Disc, CheckCircle2, Tv, X, Radio, ArrowUpRight, LogIn, Sun, Moon, Music, Play, Pause, SkipBack, SkipForward, Globe, Languages, ChevronDown, ChevronUp, EyeOff, Sparkles, PanelLeftClose, PanelLeftOpen, Search, Layers, AudioLines, Menu, User as UserIcon, Headphones } from 'lucide-react';
import { YoutubeIcon, SoundCloudIcon, AudiusIcon, SpyJamIcon, ModernHomeIcon } from './components/Icons';
import { LanguageCode, SUPPORTED_LANGUAGES, getTranslation } from './locales/i18n';
import { initRemoteConfigSync, RemoteBroadcastNotification } from './services/remoteConfigListener';
import { getOfflineAudioBlobUrl } from './services/tauriWebShim';
import spytifyLogo from './assets/spytify-logo.png';

function createSilentKeepAliveWavUri(): string {
  const sampleRate = 8000;
  const numSamples = 8000;
  const buffer = new ArrayBuffer(44 + numSamples);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples, true);
  new Uint8Array(buffer, 44).fill(128);
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [screenShareFps, setScreenShareFps] = useState<30 | 60 | 90>(() => {
    try {
      const saved = localStorage.getItem('spytify_screenshare_fps');
      return saved === '30' || saved === '60' || saved === '90' ? Number(saved) as 30 | 60 | 90 : 60;
    } catch {
      return 60;
    }
  });
  const handleUpdateScreenShareFps = (fps: 30 | 60 | 90) => {
    setScreenShareFps(fps);
    try {
      localStorage.setItem('spytify_screenshare_fps', String(fps));
    } catch {}
  };
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('spytify_volume');
      return saved !== null ? parseFloat(saved) : 0.8;
    } catch {
      return 0.8;
    }
  });
  const volumeRef = useRef<number>(volume);
  useEffect(() => {
    volumeRef.current = volume;
    try {
      localStorage.setItem('spytify_volume', String(volume));
    } catch {}
  }, [volume]);
  const [currentView, setCurrentView] = useState<ViewType>('library');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [smartDjEnabled, setSmartDjEnabled] = useState(true);
  const [recommendMode, setRecommendMode] = useState<'fresh' | 'mix' | 'off'>(() => {
    return (localStorage.getItem('spytify_recommend_mode') as 'fresh' | 'mix' | 'off') || 'fresh';
  });
  const [repeatMode, setRepeatMode] = useState<'all' | 'one' | 'off'>('all'); // default: auto-play next
  const [isShuffle, setIsShuffle] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [isPlayerBarMinimized, setIsPlayerBarMinimized] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showIosInstallBanner, setShowIosInstallBanner] = useState<boolean>(() => {
    try {
      if (typeof window === 'undefined' || (window as any).__TAURI_INTERNALS__ && !(window as any).__TAURI_WEB_SHIM__) {
        return false;
      }
      const ua = navigator.userAgent || '';
      const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isStandalone = (window.navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
      return isIos && !isStandalone && !localStorage.getItem('spytify_ios_pwa_dismissed');
    } catch {
      return false;
    }
  });
  const userManuallyMinimizedRef = useRef(false);
  const previousViewRef = useRef(currentView);

  // Auto-collapse sidebar & minimize playerbar when entering Stations & Chat
  // Auto-restore playerbar when leaving Stations & Chat (unless user manually minimized)
  useEffect(() => {
    if (currentView === 'community') {
      setIsSidebarCollapsed(true);
      if (!userManuallyMinimizedRef.current) {
        setIsPlayerBarMinimized(true);
      }
    } else if (previousViewRef.current === 'community') {
      if (!userManuallyMinimizedRef.current) {
        setIsPlayerBarMinimized(false);
      }
    }
    previousViewRef.current = currentView;
  }, [currentView]);

  // Download & Offline Music Storage State
  const [downloadFolder, setDownloadFolder] = useState<string>(() => {
    return localStorage.getItem('spytify_download_folder') || '';
  });
  const [localFolder, setLocalFolder] = useState<string>(() => {
    return localStorage.getItem('spytify_local_folder') || '';
  });
  const [downloadingTrackIds, setDownloadingTrackIds] = useState<Set<string>>(new Set());
  const [downloadingAlbumId, setDownloadingAlbumId] = useState<string | null>(null);
  const cancelledAlbumIdsRef = useRef<Set<string>>(new Set());

  // Software Update & Close-to-Tray State
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isMandatoryUpdate, setIsMandatoryUpdate] = useState(false);

  // Audio Equalizer (EQ) State
  const [isEqualizerOpen, setIsEqualizerOpen] = useState(false);
  const [isEqualizerActive, setIsEqualizerActive] = useState(() => loadEqualizerState().enabled);

  // Mobile / Web Background Play Mode (giữ nhạc chạy khi tắt màn hình hoặc ẩn app)
  const [isBackgroundPlayEnabled, setIsBackgroundPlayEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('spytify_bg_play_enabled') !== 'false';
    } catch {
      return true;
    }
  });
  const isBackgroundPlayEnabledRef = useRef<boolean>(isBackgroundPlayEnabled);
  isBackgroundPlayEnabledRef.current = isBackgroundPlayEnabled;
  const userInitiatedPauseRef = useRef<boolean>(false);
  const lastHiddenAtRef = useRef<number>(0);
  const bgKeepAliveAudioRef = useRef<HTMLAudioElement | null>(null);
  // Mobile Full-screen Now Playing Sheet
  const [isMobilePlayerOpen, setIsMobilePlayerOpen] = useState(false);

  // Realtime Remote Config & Broadcast Banner
  const [remoteBroadcast, setRemoteBroadcast] = useState<RemoteBroadcastNotification | null>(null);
  const [isBroadcastDismissed, setIsBroadcastDismissed] = useState(false);

  // Initialize Close to Tray, Background Update Check & Remote Config Sync
  useEffect(() => {
    const isWebShim = typeof window !== 'undefined' && Boolean((window as any).__TAURI_WEB_SHIM__);

    const handleBroadcastEvent = (e: any) => {
      const b = e.detail;
      if (b && b.id) {
        const isDismissed = localStorage.getItem(`spytify_dismissed_broadcast_${b.id}`) === 'true';
        if (isDismissed) {
          setRemoteBroadcast(null);
          return;
        }
      }
      setRemoteBroadcast(b || null);
      setIsBroadcastDismissed(false);
    };
    window.addEventListener('spytify:remote-broadcast', handleBroadcastEvent);
    const savedCloseToTray = localStorage.getItem('spytify_close_to_tray');
    const enabled = savedCloseToTray !== 'false';
    invoke('set_close_to_tray', { enabled }).catch(err => {
      console.warn('Failed to initialize close to tray:', err);
    });

    // Web PWA đồng bộ tự động qua GitHub/Vercel -> không bật cảnh báo cập nhật hay vá lỗi thủ công
    let isCancelled = false;
    const performStartupUpdateCheck = async () => {
      try {
        const policy = await checkStartupUpdatePolicy(false);
        if (isCancelled || !policy) return;

        if (policy.isMandatory) {
          console.log('[Updater] Mandatory update detected:', policy.info.version);
          setIsMandatoryUpdate(true);
          setUpdateInfo(policy.info);
          setIsUpdateModalOpen(true);
        } else if (policy.hasUpdate) {
          setIsMandatoryUpdate(false);
          setUpdateInfo(policy.info);
          setIsUpdateModalOpen(true);
        }
      } catch (e) {
        console.warn('Startup update policy check failed:', e);
      }
    };

    // Listen to real-time remote config updates from Spytify Dashboard
    const handleRemoteConfigUpdated = (e: any) => {
      if (isWebShim) return;
      const config = e.detail;
      if (!config || !config.version) return;
      const semverDiff = compareSemver(config.version, CURRENT_VERSION);
      const isNewer = semverDiff > 0;

      // Check for hotfix patch pushed from Admin Dashboard
      const appliedPatchId = localStorage.getItem('spytify_applied_patch_id');
      const dismissedPatchId = localStorage.getItem('spytify_dismissed_patch_id');
      const dismissedVer = localStorage.getItem('spytify_dismissed_update_version');

      // If version is not strictly newer, ONLY notify if an unapplied hotfix patchId exists
      if (!isNewer) {
        if (!config.isHotfix || !config.patchId || config.patchId === appliedPatchId || config.patchId === dismissedPatchId) {
          return;
        }
      }

      if (dismissedVer && dismissedVer === config.version && (!config.patchId || dismissedPatchId === config.patchId)) {
        return;
      }

      if (config.patchId && (appliedPatchId === config.patchId || dismissedPatchId === config.patchId)) {
        return;
      }

      const isHotfix = Boolean(
        !isNewer &&
        config.isHotfix &&
        config.patchId &&
        config.patchId !== appliedPatchId &&
        config.patchId !== dismissedPatchId
      );

      const isBelowMin = config.minSupportedVersion
        ? compareSemver(CURRENT_VERSION, config.minSupportedVersion) < 0
        : false;
      const isForce = !!config.forceUpdate && (isNewer || isHotfix);

      if (isNewer || isHotfix || isBelowMin) {
        console.log('[Updater] Real-time release/hotfix update received from Dashboard:', config.version, isHotfix ? '(Hotfix)' : '');
        const info: UpdateInfo = {
          version: config.version.startsWith('v') ? config.version : `v${config.version}`,
          name: isHotfix
            ? `Spytify ${config.version} (Bản vá lỗi mới)`
            : `Spytify ${config.version}`,
          publishedAt: config.updatedAt || new Date().toISOString(),
          notes: config.releaseNotes || (isHotfix ? 'Bản vá sửa chữa các lỗi phát sinh cho phiên bản hiện tại.' : 'Bản cập nhật mới từ hệ thống Spytify.'),
          downloadUrl: resolveDirectInstallerUrl(config.downloadUrl, config.version),
          releaseUrl: config.releaseUrl || 'https://github.com/anhdangtutien/Spytify/releases',
          patchId: config.patchId,
          isHotfix,
        };
        setIsMandatoryUpdate(isBelowMin || isForce);
        setUpdateInfo(info);
        setIsUpdateModalOpen(true);
      }
    };

    if (!isWebShim) {
      window.addEventListener('spytify:remote-config-updated', handleRemoteConfigUpdated);
      performStartupUpdateCheck();
    }

    // Initialize remote config sync for announcements/broadcasts
    initRemoteConfigSync();

    return () => {
      isCancelled = true;
      window.removeEventListener('spytify:remote-broadcast', handleBroadcastEvent);
      window.removeEventListener('spytify:remote-config-updated', handleRemoteConfigUpdated);
    };
  }, []);

  // Automatically scan & load saved local music folder and download directory on startup
  useEffect(() => {
    const initLocalMusic = async () => {
      try {
        let dlFolder = downloadFolder;
        if (!dlFolder) {
          dlFolder = await invoke<string>('get_default_download_directory');
          if (dlFolder) {
            setDownloadFolder(dlFolder);
            localStorage.setItem('spytify_download_folder', dlFolder);
          }
        }

        const foldersToScan = new Set<string>();
        const savedLocal = localStorage.getItem('spytify_local_folder');
        if (savedLocal && savedLocal.trim()) {
          foldersToScan.add(savedLocal.trim());
        }
        if (dlFolder && dlFolder.trim()) {
          foldersToScan.add(dlFolder.trim());
        }

        const allScanned: Track[] = [];
        for (const f of foldersToScan) {
          try {
            const list = await invoke<Track[]>('scan_music_folder', { folderPath: f });
            if (list && list.length > 0) {
              allScanned.push(...list);
            }
          } catch (e) {
            console.warn(`Scan folder ${f} failed:`, e);
          }
        }

        if (allScanned.length > 0) {
          try {
            const rawOrder = localStorage.getItem('spytify_local_tracks_order');
            if (rawOrder) {
              const orderKeys: string[] = JSON.parse(rawOrder);
              if (Array.isArray(orderKeys) && orderKeys.length > 0) {
                allScanned.sort((a, b) => {
                  const keyA = a.path_or_url || a.id || a.title;
                  const keyB = b.path_or_url || b.id || b.title;
                  const idxA = orderKeys.indexOf(keyA);
                  const idxB = orderKeys.indexOf(keyB);
                  if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                  if (idxA !== -1) return -1;
                  if (idxB !== -1) return 1;
                  return 0;
                });
              }
            }
          } catch {}
          setTracks(prev => deduplicateTracks([...allScanned, ...prev]));
        }
      } catch (err) {
        console.error('Failed to init local music on startup:', err);
      }
    };

    initLocalMusic();
  }, []);

  const [accentColor, setAccentColor] = useState<string>(() => {
    return localStorage.getItem('spytify_accent_color') || '#ff2a55';
  });
  const [communityServerColor, setCommunityServerColor] = useState<string | null>(null);

  // In Station & Chat (Community), the entire app dynamically follows the active server's theme!
  // When leaving Station & Chat, it smoothly reverts back to the user's permanent saved accent color!
  const activeAccentColor = currentView === 'community' && communityServerColor ? communityServerColor : accentColor;

  useEffect(() => {
    document.documentElement.style.setProperty('--accent-color', activeAccentColor);
    const hex = activeAccentColor.replace('#', '');
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      document.documentElement.style.setProperty('--accent-color-rgb', `${r}, ${g}, ${b}`);
    }
  }, [activeAccentColor]);

  const handleUpdateAccentColor = (newColor: string) => {
    setAccentColor(newColor);
    localStorage.setItem('spytify_accent_color', newColor);
    if (currentUserRef.current?.id) {
      localStorage.setItem(`spytify_accent_color_${currentUserRef.current.id}`, newColor);
      if (isSupabaseConfigured()) {
        cloudSyncPush(currentUserRef.current.id, { accentColor: newColor }).catch(() => {});
      }
    }
    document.documentElement.style.setProperty('--accent-color', newColor);
    showNotification(`${getTranslation(language, 'toast.colorUpdated')} ${newColor}`);
  };

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('spytify_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('spytify_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('spytify_theme_mode') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    if (themeMode === 'light') {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
  }, [themeMode]);

  const handleToggleThemeMode = () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
    localStorage.setItem('spytify_theme_mode', next);
    if (currentUserRef.current?.id) {
      localStorage.setItem(`spytify_theme_mode_${currentUserRef.current.id}`, next);
      if (isSupabaseConfigured()) {
        cloudSyncPush(currentUserRef.current.id, { themeMode: next }).catch(() => {});
      }
    }
    showNotification(next === 'light' ? getTranslation(language, 'toast.themeLight') : getTranslation(language, 'toast.themeDark'));
  };

  const [language, setLanguage] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem('spytify_language') as LanguageCode;
    return SUPPORTED_LANGUAGES.some(l => l.code === saved) ? saved : 'vi';
  });

  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Trap browser history to avoid accidental WebView2 history back/forward navigations
    try {
      history.pushState(null, '', window.location.href);
    } catch {}

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      try {
        history.pushState(null, '', window.location.href);
      } catch {}
    };

    const handleMouseSideButtons = (e: MouseEvent) => {
      // button 3: Back (XButton1), button 4: Forward (XButton2)
      if (e.button === 3 || e.button === 4) {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'mouseup') {
          if (e.button === 3) {
            handleUserPrevRef.current();
          } else if (e.button === 4) {
            handleNextRef.current(true);
          }
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('mouseup', handleMouseSideButtons, true);
    window.addEventListener('mousedown', handleMouseSideButtons, true);
    window.addEventListener('auxclick', handleMouseSideButtons, true);

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) {
        setShowLanguageDropdown(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowLanguageDropdown(false);
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        toggleSidebarCollapse();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('mouseup', handleMouseSideButtons, true);
      window.removeEventListener('mousedown', handleMouseSideButtons, true);
      window.removeEventListener('auxclick', handleMouseSideButtons, true);
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    setShowLanguageDropdown(false);
  }, [currentView]);

  const handleUpdateLanguage = (newLang: LanguageCode) => {
    setLanguage(newLang);
    localStorage.setItem('spytify_language', newLang);
    setShowLanguageDropdown(false);
    const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === newLang);
    showNotification(`${getTranslation(newLang, 'toast.langChanged')} ${langInfo ? `${langInfo.flag} ${langInfo.nativeName}` : newLang}`);

    // Instantly update the floating AI Mix popup recommendations for the newly selected language
    if (!currentTrackRef.current) {
      const seeds = getLanguageAiSeeds(newLang);
      const label = getLanguageAiPopupLabel(newLang);
      preloadedNextTrackRef.current = seeds[0];
      setPreloadedNextTrack(seeds[0]);
      preloadedAlternativesRef.current = seeds.slice(1, 4);
      if (isNextTrackPopupEnabledRef.current && !isTrayModeRef.current) {
        setNextTrackPopup({
          title: seeds[0].title,
          artist: seeds[0].artist,
          thumbnail: seeds[0].cover_art || undefined,
          source: seeds[0].source,
          modeLabel: label,
          isCountdown: false,
          alternatives: seeds.slice(1, 4),
        });
      }
    }
  };

  // ─── SLEEP TIMER (HẸN GIỜ TẮT NHẠC) ───────────────────────────
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerRemainingSecs, setSleepTimerRemainingSecs] = useState<number | null>(null);
  const sleepTimerMinutesRef = useRef<number | null>(null);
  sleepTimerMinutesRef.current = sleepTimerMinutes;

  useEffect(() => {
    if (sleepTimerRemainingSecs === null) return;

    if (sleepTimerRemainingSecs <= 0) {
      setIsPlaying(false);
      sendYtCmd('stopVideo');
      sendScCmd('pause');
      onlineAudioRef.current?.pause();
      try { invoke('stop_track'); } catch {}

      setSleepTimerMinutes(null);
      setSleepTimerRemainingSecs(null);
      showNotification(getTranslation(language, 'timer.timeoutNotification'));
      return;
    }

    const interval = setInterval(() => {
      setSleepTimerRemainingSecs(prev => {
        if (prev === null) return null;
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerRemainingSecs, language]);

  const handleSetSleepTimer = (minutes: number | null) => {
    if (minutes === null) {
      setSleepTimerMinutes(null);
      setSleepTimerRemainingSecs(null);
      showNotification(getTranslation(language, 'timer.canceledNotification'));
      return;
    }

    if (minutes === 0) {
      setSleepTimerMinutes(0);
      setSleepTimerRemainingSecs(null);
      showNotification(getTranslation(language, 'timer.setEndNotification'));
      return;
    }

    setSleepTimerMinutes(minutes);
    setSleepTimerRemainingSecs(minutes * 60);
    showNotification(getTranslation(language, 'timer.setNotification', { time: `${minutes} ${getTranslation(language, 'timer.minutes')}` }));
  };

  const handleUpdateAvatar = async (newAvatar: string) => {
    if (currentUser) {
      try {
        localStorage.setItem(`spytify_user_avatar_${currentUser.id}`, newAvatar);
        if (currentUser.username) {
          localStorage.setItem(`spytify_user_avatar_${currentUser.username.toLowerCase()}`, newAvatar);
        }
        const cacheRaw = localStorage.getItem('spytify_avatar_cache');
        const cache = cacheRaw ? JSON.parse(cacheRaw) : {};
        cache[currentUser.id.toLowerCase()] = newAvatar;
        if (currentUser.username) {
          cache[currentUser.username.toLowerCase()] = newAvatar;
        }
        localStorage.setItem('spytify_avatar_cache', JSON.stringify(cache));
      } catch {}
      try {
        await invoke('auth_update_avatar', { userId: currentUser.id, avatar: newAvatar });
        setCurrentUser(prev => prev ? { ...prev, avatar: newAvatar } : null);
        showNotification(getTranslation(language, 'toast.avatarUpdated'));
      } catch (e) {
        console.error('Failed to update avatar in DB:', e);
        setCurrentUser(prev => prev ? { ...prev, avatar: newAvatar } : null);
      }
      if (isSupabaseConfigured()) {
        cloudSyncPush(currentUser.id, {
          username: currentUser.username,
          displayName: currentUser.display_name,
          email: currentUser.email || undefined,
          avatar: newAvatar,
        }).catch(() => {});
      }
      try {
        const raw = localStorage.getItem('spytify_registered_users');
        if (raw) {
          const list = JSON.parse(raw);
          const updated = list.map((u: any) =>
            u.id === currentUser.id || (currentUser.username && u.username?.toLowerCase() === currentUser.username.toLowerCase())
              ? { ...u, avatar: newAvatar }
              : u
          );
          localStorage.setItem('spytify_registered_users', JSON.stringify(updated));
        }
      } catch {}
    } else {
      localStorage.setItem('spytify_guest_avatar', newAvatar);
      showNotification(getTranslation(language, 'toast.avatarSaved'));
    }
  };

  const handleUpdateBio = (bio: string) => {
    setCurrentUser(prev => prev ? { ...prev, bio } : null);
    if (currentUser && isSupabaseConfigured()) {
      cloudSyncPush(currentUser.id, { bio })
        .then(synced => {
          if (!synced) console.warn('Failed to sync profile bio to Supabase.');
        })
        .catch(error => console.warn('Failed to sync profile bio to Supabase:', error));
    }
  };

  const handleUpdateThought = (thought: string) => {
    setCurrentUser(prev => prev ? { ...prev, thought } : null);
    if (currentUser && isSupabaseConfigured()) {
      cloudSyncPush(currentUser.id, { thought })
        .then(synced => {
          if (!synced) console.warn('Failed to sync profile thought to Supabase.');
        })
        .catch(error => console.warn('Failed to sync profile thought to Supabase:', error));
    }
  };

  const handleCloudProfileUpdate = (profile: {
    avatar?: string | null;
    bio?: string | null;
    thought?: string | null;
  }) => {
    const userId = currentUser?.id;
    if (!userId) return;

    if (profile.bio !== undefined) {
      localStorage.setItem(`spytify_user_bio_${userId}`, profile.bio ?? '');
      localStorage.setItem('spytify_user_bio', profile.bio ?? '');
    }
    if (profile.thought !== undefined) {
      localStorage.setItem(`spytify_user_thought_${userId}`, profile.thought ?? '');
      localStorage.setItem('spytify_user_thought', profile.thought ?? '');
    }
    if (profile.avatar !== undefined && profile.avatar && profile.avatar.trim() !== '') {
      try {
        localStorage.setItem(`spytify_user_avatar_${userId}`, profile.avatar);
        if (currentUser?.username) {
          localStorage.setItem(`spytify_user_avatar_${currentUser.username.toLowerCase()}`, profile.avatar);
        }
      } catch {}
      invoke('auth_update_avatar', { userId, avatar: profile.avatar })
        .catch(error => console.warn('Failed to update local avatar from cloud profile:', error));
    }

    setCurrentUser(prev => prev ? {
      ...prev,
      ...(profile.avatar !== undefined && profile.avatar && profile.avatar.trim() !== '' ? { avatar: profile.avatar } : {}),
      ...(profile.bio !== undefined ? { bio: profile.bio ?? '' } : {}),
      ...(profile.thought !== undefined ? { thought: profile.thought ?? '' } : {}),
    } : null);
  };

  const getAlbumsStorageKey = (userId?: string | null) =>
    userId ? `spytify_user_albums_${userId}` : 'spytify_user_albums_guest';
  const loadAlbumsForUser = (userId?: string | null): UserAlbum[] => {
    try {
      let stored = localStorage.getItem(getAlbumsStorageKey(userId));
      if (!stored && userId) {
        const legacyOwnerKey = 'spytify_user_albums_legacy_owner_id';
        const legacyOwnerId = localStorage.getItem(legacyOwnerKey);
        if (!legacyOwnerId || legacyOwnerId === userId) {
          stored = localStorage.getItem('spytify_user_albums');
          if (stored) {
            localStorage.setItem(getAlbumsStorageKey(userId), stored);
            if (!legacyOwnerId) localStorage.setItem(legacyOwnerKey, userId);
            localStorage.removeItem('spytify_user_albums');
          }
        }
      } else if (!stored && !userId) {
        if (!localStorage.getItem('spytify_user_albums_legacy_owner_id')) {
          stored = localStorage.getItem('spytify_user_albums');
        }
      }
      if (stored) {
        const parsed: UserAlbum[] = JSON.parse(stored);
        return parsed.map(alb => ({
          ...alb,
          tracks: deduplicateTracks(alb.tracks || [])
        }));
      }
      return [];
    } catch {
      return [];
    }
  };
  const persistAlbumsForUser = (userId: string | null | undefined, userAlbums: UserAlbum[]) => {
    try {
      localStorage.setItem(getAlbumsStorageKey(userId), JSON.stringify(userAlbums));
      if (userId && !localStorage.getItem('spytify_user_albums_legacy_owner_id') &&
          localStorage.getItem('spytify_user_albums')) {
        localStorage.setItem('spytify_user_albums_legacy_owner_id', userId);
        localStorage.removeItem('spytify_user_albums');
      }
    } catch (error) {
      console.error('Failed to persist user albums:', error);
    }
  };
  const [albums, setAlbums] = useState<UserAlbum[]>(() => loadAlbumsForUser());
  useEffect(() => {
    setAlbums(loadAlbumsForUser(currentUser?.id));
  }, [currentUser?.id]);
  const [trackToAddToAlbum, setTrackToAddToAlbum] = useState<Track | null>(null);
  const [isAddToAlbumModalOpen, setIsAddToAlbumModalOpen] = useState(false);
  const [isCreateAlbumFromSelectionOpen, setIsCreateAlbumFromSelectionOpen] = useState(false);

  const handleCreateAlbum = (title: string, description: string): UserAlbum => {
    const userId = currentUserRef.current?.id;
    const newAlbum: UserAlbum = {
      id: 'album_' + Date.now(),
      title,
      description,
      tracks: [],
      created_at: new Date().toISOString(),
    };
    setAlbums(prev => {
      const updated = [newAlbum, ...prev];
      persistAlbumsForUser(userId, updated);
      if (userId && isSupabaseConfigured()) {
        cloudSyncPush(userId, { albums: updated }).catch(console.error);
      }
      return updated;
    });
    showNotification(`${getTranslation(language, 'toast.albumCreated')}: ${title}`);
    return newAlbum;
  };

  const handleCreateAlbumFromDownloaded = () => {
    const downloaded = tracks.filter(t => t.source === 'local');
    if (downloaded.length === 0) {
      showNotification(language === 'vi' ? 'Chưa có bài hát nào được tải xuống máy!' : 'No downloaded songs found!');
      return;
    }
    setIsCreateAlbumFromSelectionOpen(true);
  };

  const handleCreateAlbumWithSelectedTracks = (title: string, description: string, selectedTracks: Track[]) => {
    const newAlbum = handleCreateAlbum(title, description || (language === 'vi' ? `Album gồm ${selectedTracks.length} bài hát đã tải về máy` : `${selectedTracks.length} offline downloaded songs`));
    
    // Add selected downloaded tracks into this new album
    const userId = currentUserRef.current?.id;
    setAlbums(prev => {
      const updated = prev.map(a => {
        if (a.id === newAlbum.id) {
          return { ...a, tracks: deduplicateTracks(selectedTracks) };
        }
        return a;
      });
      persistAlbumsForUser(userId, updated);
      if (userId && isSupabaseConfigured()) {
        cloudSyncPush(userId, { albums: updated }).catch(console.error);
      }
      return updated;
    });

    showNotification(language === 'vi' ? `Đã tạo Album "${title}" (${selectedTracks.length} bài hát)!` : `Created Album "${title}" (${selectedTracks.length} songs)!`);
    setCurrentView('albums');
  };

  const handleDeleteAlbum = (albumId: string) => {
    const userId = currentUserRef.current?.id;
    setAlbums(prev => {
      const updated = prev.filter(a => a.id !== albumId);
      persistAlbumsForUser(userId, updated);
      if (userId && isSupabaseConfigured()) {
        cloudSyncPush(userId, { albums: updated }).catch(console.error);
      }
      return updated;
    });
    showNotification(getTranslation(language, 'toast.albumDeleted'));
  };

  const handleUpdateAlbum = (albumId: string, updates: Partial<UserAlbum>) => {
    const userId = currentUserRef.current?.id;
    setAlbums(prev => {
      const updated = prev.map(a => a.id === albumId ? { ...a, ...updates } : a);
      persistAlbumsForUser(userId, updated);
      if (userId && isSupabaseConfigured()) {
        cloudSyncPush(userId, { albums: updated }).catch(console.error);
      }
      return updated;
    });
    showNotification(getTranslation(language, 'album.updated'));
  };

  const handleSaveArtistMixAsAlbum = (mix: ArtistMix) => {
    const userId = currentUserRef.current?.id;
    const albumTracks: Track[] = (mix.tracks || []).map(r => {
      const safeUrl = r.url_or_id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const deterministicId = `${r.source}_${safeUrl}`;
      const existing = tracks.find(
        t => t.id === deterministicId ||
             (t.path_or_url && t.path_or_url === r.url_or_id) ||
             (t.title.trim().toLowerCase() === r.title.trim().toLowerCase() &&
              t.artist.trim().toLowerCase() === r.artist.trim().toLowerCase())
      );
      return existing || {
        id: deterministicId,
        title: r.title,
        artist: r.artist,
        album: r.album || mix.title,
        duration_secs: r.duration_secs,
        path_or_url: r.url_or_id,
        cover_art: r.thumbnail || mix.cover_art,
        source: r.source,
      };
    });

    const albumTitle = mix.title || `${mix.artist} Album Mix`;
    const existingIndex = albums.findIndex(
      a => a.title.trim().toLowerCase() === albumTitle.trim().toLowerCase() ||
           a.title.trim().toLowerCase() === `${mix.artist} Mix`.toLowerCase()
    );

    if (existingIndex >= 0) {
      const existing = albums[existingIndex];
      const merged = deduplicateTracks([...existing.tracks, ...albumTracks]);
      const updated = [...albums];
      updated[existingIndex] = {
        ...existing,
        cover_art: existing.cover_art || mix.cover_art,
        tracks: merged,
      };
      setAlbums(updated);
      persistAlbumsForUser(userId, updated);
      if (userId && isSupabaseConfigured()) {
        cloudSyncPush(userId, { albums: updated }).catch(console.error);
      }
      showNotification(getTranslation(language, 'toast.artistAlbumAdded', { title: albumTitle }));
    } else {
      const newAlbum: UserAlbum = {
        id: 'album_artist_' + Date.now(),
        title: albumTitle,
        description: mix.description || `Tuyển tập những bài hát được nghe nhiều nhất của ${mix.artist}`,
        cover_art: mix.cover_art || null,
        tracks: deduplicateTracks(albumTracks),
        created_at: new Date().toISOString(),
      };
      const updated = [newAlbum, ...albums];
      setAlbums(updated);
      persistAlbumsForUser(userId, updated);
      if (userId && isSupabaseConfigured()) {
        cloudSyncPush(userId, { albums: updated }).catch(console.error);
      }
      showNotification(getTranslation(language, 'toast.artistAlbumAdded', { title: albumTitle }));
    }
  };

  const handleAddTrackToAlbum = (albumId: string, track: Track) => {
    const userId = currentUserRef.current?.id;
    let wasAlreadyPresent = false;
    setAlbums(prev => {
      const updated = prev.map(a => {
        if (a.id === albumId) {
          const normTitle = track.title.trim().toLowerCase();
          if (a.tracks.some(t => t.id === track.id || t.title.trim().toLowerCase() === normTitle)) {
            wasAlreadyPresent = true;
            return a;
          }
          return { ...a, tracks: deduplicateTracks([...a.tracks, track]) };
        }
        return a;
      });
      persistAlbumsForUser(userId, updated);
      if (!wasAlreadyPresent && userId && isSupabaseConfigured()) {
        cloudSyncPush(userId, { albums: updated }).catch(console.error);
      }
      return updated;
    });
    if (wasAlreadyPresent) {
      showNotification(getTranslation(language, 'toast.albumTrackExists'));
    } else {
      showNotification(getTranslation(language, 'toast.addedToAlbum'));
    }
  };

  const handleRemoveTrackFromAlbum = (albumId: string, trackId: string) => {
    const userId = currentUserRef.current?.id;
    setAlbums(prev => {
      const updated = prev.map(a => {
        if (a.id === albumId) {
          return { ...a, tracks: a.tracks.filter(t => t.id !== trackId) };
        }
        return a;
      });
      persistAlbumsForUser(userId, updated);
      if (userId && isSupabaseConfigured()) {
        cloudSyncPush(userId, { albums: updated }).catch(console.error);
      }
      return updated;
    });
    showNotification(getTranslation(language, 'toast.trackRemovedFromAlbum'));
  };

  const handlePlayAlbum = (album: UserAlbum) => {
    const clean = deduplicateTracks(album.tracks || []);
    if (clean.length > 0) {
      setTracks(prev => deduplicateTracks([...clean, ...prev]));
      activeQueueRef.current = clean;
      setActiveQueue(clean);
      activeQueueContextRef.current = 'albums';
      setActiveQueueContext('albums');
      playTrackInternal(clean[0]);
      showNotification(`${getTranslation(language, 'toast.playingAlbum')}: ${album.title}`);
    }
  };


  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('soundify_favorites') || '[]')); }
    catch { return new Set(); }
  });
  const favoritesRef = useRef<Set<string>>(favorites);
  useEffect(() => { favoritesRef.current = favorites; }, [favorites]);

  const albumsRef = useRef<UserAlbum[]>(albums);
  useEffect(() => { albumsRef.current = albums; }, [albums]);

  const [activeQueue, setActiveQueue] = useState<Track[]>([]);
  const activeQueueRef = useRef<Track[]>([]);
  useEffect(() => { activeQueueRef.current = activeQueue; }, [activeQueue]);

  const [activeQueueContext, setActiveQueueContext] = useState<string>('library');
  const activeQueueContextRef = useRef<string>('library');
  useEffect(() => { activeQueueContextRef.current = activeQueueContext; }, [activeQueueContext]);

  // Tracks whether the next song in 'mix' mode should be a brand-new discovery (true)
  // or the next song from the current playlist (false), strictly alternating 1-by-1.
  const mixNextIsNewRef = useRef<boolean>(true);
  const lastPlaylistIndexRef = useRef<number>(0);
  const lockedPlaylistNextRef = useRef<{
    forTrackId: string | null;
    isShuffle: boolean;
    ctx: string;
    track: Track | null;
  }>({ forTrackId: null, isShuffle: false, ctx: '', track: null });

  const isScopedPlaylistContext = (ctx: string): boolean => {
    return ctx === 'local' || ctx === 'favorites' || ctx === 'albums' || ctx === 'artist_mix';
  };

  // Checks if a candidate track is already in any user playlist (Active Queue, Favorites, User Albums, or Local Music)
  const isTrackInUserPlaylists = (title: string, urlOrId?: string): boolean => {
    const normTitle = title.trim().toLowerCase();
    const normId = (urlOrId || '').trim().toLowerCase();

    const matchesTrack = (t: Track) => {
      const tTitle = t.title.trim().toLowerCase();
      const tId = t.id.toLowerCase();
      const tPath = (t.path_or_url || '').toLowerCase();
      if (tTitle === normTitle || tTitle.includes(normTitle) || normTitle.includes(tTitle)) return true;
      if (normId && (tId === normId || tPath === normId || tId.includes(normId))) return true;
      return false;
    };

    if (activeQueueRef.current.some(matchesTrack)) return true;
    if (tracksRef.current.some(t => (t.source === 'local' || favoritesRef.current.has(t.id)) && matchesTrack(t))) return true;
    for (const alb of albumsRef.current) {
      if ((alb.tracks || []).some(matchesTrack)) return true;
    }
    return false;
  };

  const getEffectiveQueue = (): Track[] => {
    const ctx = activeQueueContextRef.current;
    if (ctx === 'local') {
      const locals = deduplicateTracks(tracksRef.current.filter(t => t.source === 'local'));
      return locals.length > 0 ? locals : activeQueueRef.current;
    }
    if (ctx === 'favorites') {
      const favs = deduplicateTracks(tracksRef.current.filter(t => favoritesRef.current.has(t.id)));
      return favs.length > 0 ? favs : activeQueueRef.current;
    }
    if (ctx === 'albums' || ctx === 'artist_mix') {
      return activeQueueRef.current.length > 0 ? activeQueueRef.current : tracksRef.current;
    }
    if (activeQueueRef.current.length > 0) {
      return activeQueueRef.current;
    }
    return displayedTracksRef.current.length > 0 ? displayedTracksRef.current : tracksRef.current;
  };

  const getNextPlaylistTrack = (cur: Track | null): Track | null => {
    const queue = getEffectiveQueue();
    if (!queue.length) return null;

    const curId = cur?.id || null;
    const curPath = cur?.path_or_url || null;
    const curTitle = cur?.title?.trim().toLowerCase() || null;
    const curArtist = cur?.artist?.trim().toLowerCase() || null;
    const shuf = isShuffleRef.current;
    const ctx = activeQueueContextRef.current;
    const cached = lockedPlaylistNextRef.current;

    if (
      cached.track &&
      cached.forTrackId === curId &&
      cached.isShuffle === shuf &&
      cached.ctx === ctx &&
      queue.some(t => t.id === cached.track!.id || (t.path_or_url && t.path_or_url === cached.track!.path_or_url)) &&
      (queue.length === 1 || cached.track.id !== curId)
    ) {
      return cached.track;
    }

    let picked: Track | null = null;
    if (shuf && queue.length > 1) {
      const remaining = queue.filter(t => t.id !== curId && (!curPath || t.path_or_url !== curPath));
      picked = (remaining.length > 0 ? remaining : queue)[Math.floor(Math.random() * (remaining.length > 0 ? remaining.length : queue.length))];
    } else {
      const idx = cur ? queue.findIndex(t => 
        t.id === cur.id ||
        (curPath && t.path_or_url && t.path_or_url === curPath) ||
        (curTitle && curArtist && t.title.trim().toLowerCase() === curTitle && t.artist.trim().toLowerCase() === curArtist)
      ) : -1;

      if (idx !== -1) {
        lastPlaylistIndexRef.current = idx;
        picked = queue[(idx + 1) % queue.length];
      } else {
        picked = queue[(lastPlaylistIndexRef.current + 1) % queue.length] || queue[0];
      }
    }

    lockedPlaylistNextRef.current = {
      forTrackId: curId,
      isShuffle: shuf,
      ctx,
      track: picked,
    };
    return picked;
  };

  const shouldNextBeNewDiscovery = (): boolean => {
    if (recommendModeRef.current === 'fresh') return true;
    if (recommendModeRef.current === 'mix') {
      const queue = getEffectiveQueue();
      if (!queue.length) return true;
      return mixNextIsNewRef.current;
    }
    return false;
  };

  const getPlaylistModeLabel = (ctx: string): string => {
    if (recommendModeRef.current === 'fresh') return getTranslation(language, 'mode.freshPopup');
    if (recommendModeRef.current === 'mix') {
      return mixNextIsNewRef.current
        ? `${getTranslation(language, 'mode.mixPopup')} • ${getTranslation(language, 'mode.newTrackTag')}`
        : `${getTranslation(language, 'mode.mixPopup')} • ${getTranslation(language, 'mode.playlistTag')}`;
    }
    if (ctx === 'local') return getTranslation(language, 'nav.localMusic');
    if (ctx === 'favorites') return getTranslation(language, 'nav.favorites');
    if (ctx === 'albums') return getTranslation(language, 'nav.myAlbums');
    return getTranslation(language, 'mode.queuePopup');
  };
  const [showVisualizer, setShowVisualizer] = useState(true);
  const [showYoutubeVideo, setShowYoutubeVideo] = useState(false);
  const [mobileMvRect, setMobileMvRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  // Spytify Connect state (WebRTC Live Stream to iPhone & Supabase Remote Control)
  // Host is ONLY available on Desktop Tauri App (Rust core backend)
  const isTauriApp = typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__) && !Boolean((window as any).__TAURI_WEB_SHIM__);
  const [isConnectHostActive, setIsConnectHostActive] = useState(() => {
    return isTauriApp && localStorage.getItem('spytify_connect_host_enabled') === 'true';
  });
  const [isConnectClientActive, setIsConnectClientActive] = useState(false);
  const [isHostOnline, setIsHostOnline] = useState(false);

  useEffect(() => {
    if (!isMobilePlayerOpen) {
      setMobileMvRect(null);
      return;
    }
    const updateRect = () => {
      const el = document.getElementById('mobile-cover-art-slot');
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          setMobileMvRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        }
      }
    };
    updateRect();

    // Smooth frame-by-frame synchronization during CSS transition (450ms)
    let animId: number | null = null;
    const animStart = performance.now();
    const tick = () => {
      updateRect();
      if (performance.now() - animStart < 450) {
        animId = requestAnimationFrame(tick);
      }
    };
    tick();

    const el = document.getElementById('mobile-cover-art-slot');
    let ro: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        updateRect();
      });
      ro.observe(el);
    }
    window.addEventListener('resize', updateRect);
    window.addEventListener('orientationchange', updateRect);
    return () => {
      if (animId) cancelAnimationFrame(animId);
      ro?.disconnect();
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('orientationchange', updateRect);
    };
  }, [isMobilePlayerOpen, showYoutubeVideo]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [ytVideoId1, setYtVideoId1] = useState<string | null>(null);
  const [ytVideoId2, setYtVideoId2] = useState<string | null>(null);
  const [ytIframeSrc1, setYtIframeSrc1] = useState<string | null>(null);
  const [ytIframeSrc2, setYtIframeSrc2] = useState<string | null>(null);
  // Dual-channel SoundCloud players for seamless Crossfade overlap
  const [scTrackUrl1, setScTrackUrl1] = useState<string | null>(null);
  const [scTrackUrl2, setScTrackUrl2] = useState<string | null>(null);
  const scIframe1Ref = useRef<HTMLIFrameElement | null>(null);
  const scIframe2Ref = useRef<HTMLIFrameElement | null>(null);
  const activeScChannelRef = useRef<1 | 2>(1);
  const scTrackUrl = activeScChannelRef.current === 1 ? scTrackUrl1 : scTrackUrl2;
  const setScTrackUrl = (url: string | null) => {
    if (activeScChannelRef.current === 1) setScTrackUrl1(url);
    else setScTrackUrl2(url);
  };

  // Spotify-style Equal-Power Crossfade State
  const [crossfadeDuration, setCrossfadeDuration] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('spytify_crossfade_duration');
      return saved !== null ? Number(saved) : 5; // Default 5s like Spotify!
    } catch {
      return 5;
    }
  });
  const crossfadeDurationRef = useRef<number>(crossfadeDuration);
  useEffect(() => {
    crossfadeDurationRef.current = crossfadeDuration;
    try {
      localStorage.setItem('spytify_crossfade_duration', String(crossfadeDuration));
    } catch {}
  }, [crossfadeDuration]);

  const [isCrossfading, setIsCrossfading] = useState<boolean>(false);
  const crossfadeActiveRef = useRef<boolean>(false);
  const crossfadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Dual-channel YouTube players
  const ytIframe1Ref = useRef<HTMLIFrameElement | null>(null);
  const ytIframe2Ref = useRef<HTMLIFrameElement | null>(null);
  const activeYtChannelRef = useRef<1 | 2>(1);
  const ytIframeRef = useRef<HTMLIFrameElement | null>(null);
  const ytIframeReady1Ref = useRef(false);
  const ytIframeReady2Ref = useRef(false);
  const ytIframeSrc1Ref = useRef<string | null>(null);
  const ytIframeSrc2Ref = useRef<string | null>(null);
  ytIframeSrc1Ref.current = ytIframeSrc1;
  ytIframeSrc2Ref.current = ytIframeSrc2;
  const latestYtVideoId1Ref = useRef<string | null>(null);
  const latestYtVideoId2Ref = useRef<string | null>(null);
  latestYtVideoId1Ref.current = ytVideoId1;
  latestYtVideoId2Ref.current = ytVideoId2;
  const ytLoadTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ytLastSwitchAtRef = useRef<number>(0);

  const ytVideoId = activeYtChannelRef.current === 1 ? ytVideoId1 : ytVideoId2;
  const setYtVideoId = (vid: string | null) => {
    if (activeYtChannelRef.current === 1) {
      latestYtVideoId1Ref.current = vid;
      setYtVideoId1(vid);
    } else {
      latestYtVideoId2Ref.current = vid;
      setYtVideoId2(vid);
    }
  };

  const ytUnavailableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ytUnavailableRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ytHasStartedPlayingRef = useRef(false);
  const ytMusicFallbackActiveRef = useRef(false);
  const ytMusicFallbackTriedRef = useRef(false);
  const consecutiveAutoSkipsRef = useRef(0);
  const lastAutoSkipTimestampRef = useRef(0);
  const handleYouTubeBlockedOrStalledRef = useRef<(track: Track) => void>(() => {});
  const lastSearchResultsRef = useRef<SearchResult[]>([]);

  // Dual-channel HTML5 audio elements
  const onlineAudio1Ref = useRef<HTMLAudioElement | null>(null);
  const onlineAudio2Ref = useRef<HTMLAudioElement | null>(null);
  const activeAudioChannelRef = useRef<1 | 2>(1);
  const onlineAudioRef = useRef<HTMLAudioElement | null>(null);
  const connectAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<Track | null>(null);
  const isPlayingRef = useRef(false);
  const tracksRef = useRef<Track[]>([]);
  const displayedTracksRef = useRef<Track[]>([]);
  const currentUserRef = useRef<User | null>(null);
  const repeatModeRef = useRef<'all' | 'one' | 'off'>('all');
  const recommendModeRef = useRef<'fresh' | 'mix' | 'off'>('fresh');
  const isShuffleRef = useRef(false);
  const playStartTimestampRef = useRef<number | null>(null);
  const accumulatedTimeRef = useRef<number>(0);

  // Set of all track titles & IDs already listened to (persisted from SQLite & session)
  const listenedHistoryTitlesRef = useRef<Set<string>>(new Set());

  // Next Track Floating Pop-up state & timer
  interface NextTrackPopupData {
    title: string;
    artist: string;
    thumbnail?: string;
    source: string;
    modeLabel: string;
    isCountdown?: boolean;
    remainingSecs?: number;
    alternatives?: Track[];
  }
  const [nextTrackPopup, setNextTrackPopup] = useState<NextTrackPopupData | null>(null);
  const [isAiLoadingNext, setIsAiLoadingNext] = useState<boolean>(false);
  const [isNextTrackPopupCollapsed, setIsNextTrackPopupCollapsed] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && window.innerWidth < 640;
    } catch {
      return false;
    }
  });
  const nextTrackPopupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endOfTrackPopupShownForRef = useRef<string | null>(null);
  const preloadedAlternativesRef = useRef<Track[]>([]);
  const preloadedNextTrackRef = useRef<Track | null>(null);
  const [preloadedNextTrack, setPreloadedNextTrack] = useState<Track | null>(null);
  const [isNextTrackPopupEnabled, setIsNextTrackPopupEnabled] = useState<boolean>(() => {
    return localStorage.getItem('spytify_next_popup_enabled') !== 'false';
  });
  const isNextTrackPopupEnabledRef = useRef(isNextTrackPopupEnabled);
  useEffect(() => {
    isNextTrackPopupEnabledRef.current = isNextTrackPopupEnabled;
  }, [isNextTrackPopupEnabled]);

  const isSkippingRef = useRef(false);
  const playbackHistoryStackRef = useRef<Track[]>([]);
  const playbackForwardStackRef = useRef<Track[]>([]);

  const checkIsLiveTrack = (t: Track | null): boolean => {
    if (!t || t.source !== 'youtube') return false;
    if (t.album === 'On-Demand Music Queue') return false;
    const title = t.title.toLowerCase();
    const isRecordedLive =
      title.includes('live lounge') ||
      title.includes('live session') ||
      title.includes('live at') ||
      title.includes('live in') ||
      title.includes('live acoustic') ||
      title.includes('live version') ||
      title.includes('live performance') ||
      title.includes('live cover');
    if (isRecordedLive) return false;
    return (
      !t.duration_secs ||
      t.duration_secs <= 0 ||
      title.includes('24/7') ||
      title.includes('trực tiếp') ||
      title.includes('livestream') ||
      title.includes('live stream') ||
      title.includes('live radio') ||
      title.includes('hip hop radio') ||
      title.includes('lofi radio') ||
      title.includes('chill radio') ||
      (title.includes('radio') && (t.duration_secs <= 0 || t.duration_secs > 7200)) ||
      (title.includes('live') && (t.duration_secs <= 0 || t.duration_secs > 7200))
    );
  };

  const buildImmediatePopupData = (): NextTrackPopupData | null => {
    const allList = getEffectiveQueue();
    const cur = currentTrackRef.current;
    const fallbackNext = getNextPlaylistTrack(cur);
    const useNewDiscovery = shouldNextBeNewDiscovery();

    // In new discovery (Fresh) mode, ONLY use genuine preloaded discovery track.
    // Do NOT pull random songs from allList/history to prevent showing unrelated songs.
    const nextToUse = useNewDiscovery
      ? preloadedNextTrackRef.current
      : (fallbackNext || preloadedNextTrackRef.current);
    if (!nextToUse || (cur && nextToUse.id === cur.id)) return null;

    const altList = (useNewDiscovery && preloadedAlternativesRef.current.length > 0)
      ? preloadedAlternativesRef.current.slice(0, 3)
      : (!useNewDiscovery
          ? allList.filter(t => t.id !== cur?.id && t.id !== nextToUse.id).slice(0, 3)
          : []);

    return {
      title: nextToUse.title,
      artist: nextToUse.artist,
      thumbnail: nextToUse.cover_art || undefined,
      source: nextToUse.source,
      modeLabel: getPlaylistModeLabel(activeQueueContextRef.current),
      isCountdown: false,
      alternatives: altList,
    };
  };

  const handleToggleNextTrackPopupEnabled = () => {
    const isCurrentlyVisible = Boolean(isNextTrackPopupEnabled && nextTrackPopup);
    if (isCurrentlyVisible) {
      setIsNextTrackPopupEnabled(false);
      isNextTrackPopupEnabledRef.current = false;
      localStorage.setItem('spytify_next_popup_enabled', 'false');
      setNextTrackPopup(null);
      showNotification(getTranslation(language, 'popup.disabledToast'));
    } else {
      setIsNextTrackPopupEnabled(true);
      isNextTrackPopupEnabledRef.current = true;
      localStorage.setItem('spytify_next_popup_enabled', 'true');
      setIsNextTrackPopupCollapsed(false);
      const immediateData = buildImmediatePopupData();
      if (immediateData) {
        setNextTrackPopup(immediateData);
      } else {
        if (currentTrackRef.current) {
          setIsAiLoadingNext(true);
          fetchUpcomingForTrack(currentTrackRef.current);
        } else {
          setNextTrackPopup({
            title: 'AI Smart DJ Ready',
            artist: 'Spytify Intelligence',
            source: 'youtube',
            modeLabel: getTranslation(language, 'mode.freshPopup'),
            isCountdown: false,
            alternatives: [],
          });
        }
      }
      showNotification(getTranslation(language, 'popup.enabledToast'));
    }
  };

  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  const triggerNextTrackPopup = (track: Track, modeLabel?: string) => {
    if (!isNextTrackPopupEnabledRef.current) return;
    setNextTrackPopup({
      title: track.title,
      artist: track.artist,
      thumbnail: track.cover_art || undefined,
      source: track.source,
      modeLabel: modeLabel || (
        recommendModeRef.current === 'fresh' ? getTranslation(language, 'mode.freshPopup') :
        recommendModeRef.current === 'mix' ? getTranslation(language, 'mode.mixPopup') :
        getTranslation(language, 'mode.queuePopup')
      ),
      isCountdown: false,
      alternatives: preloadedAlternativesRef.current.slice(0, 3),
    });
  };

  // Keep refs in sync synchronously during render so useMemo/useEffect always see latest state
  currentTrackRef.current = currentTrack;
  isPlayingRef.current = isPlaying;
  tracksRef.current = tracks;
  currentUserRef.current = currentUser;
  repeatModeRef.current = repeatMode;
  recommendModeRef.current = recommendMode;
  isShuffleRef.current = isShuffle;
  activeQueueRef.current = activeQueue;
  activeQueueContextRef.current = activeQueueContext;
  favoritesRef.current = favorites;
  albumsRef.current = albums;

  // Load history from SQLite to seed listenedHistoryTitlesRef
  useEffect(() => {
    const targetUserId = currentUser?.id || 'guest_spy';
    invoke<any[]>('db_get_history', { userId: targetUserId, limit: 300 })
      .then(hist => {
        if (hist && Array.isArray(hist)) {
          hist.forEach(h => {
            if (h.track_title) listenedHistoryTitlesRef.current.add(h.track_title.trim().toLowerCase());
            if (h.track_id) listenedHistoryTitlesRef.current.add(h.track_id.toLowerCase());
            if (h.path_or_url) listenedHistoryTitlesRef.current.add(h.path_or_url.toLowerCase());
          });
        }
      })
      .catch(() => {});
  }, [currentUser]);

const getLanguageAiSeeds = (lang: LanguageCode): Track[] => {
  let pool: Track[] = [];
  switch (lang) {
    case 'ko':
      pool = [
        {
          id: 'aimix_seed_ko_1',
          title: 'APT. (feat. Bruno Mars)',
          artist: 'ROSÉ & Bruno Mars',
          album: 'AI 믹스 • K-Pop Global',
          duration_secs: 173,
          path_or_url: 'ekr2nIex040',
          cover_art: 'https://i.ytimg.com/vi/ekr2nIex040/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_ko_2',
          title: 'Supernova',
          artist: 'aespa (에스파)',
          album: 'AI 믹스 • Viral Pick',
          duration_secs: 180,
          path_or_url: 'phuiAIQAxZ4',
          cover_art: 'https://i.ytimg.com/vi/phuiAIQAxZ4/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_ko_3',
          title: 'Magnetic',
          artist: 'ILLIT (아일릿)',
          album: 'AI 믹스 • Hot Trend',
          duration_secs: 161,
          path_or_url: 'Vk5-c_v4gMU',
          cover_art: 'https://i.ytimg.com/vi/Vk5-c_v4gMU/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_ko_4',
          title: 'Love wins all',
          artist: 'IU (아이유)',
          album: 'AI 믹스 • K-Ballad',
          duration_secs: 272,
          path_or_url: 'JleoAppaxi0',
          cover_art: 'https://i.ytimg.com/vi/JleoAppaxi0/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_ko_5',
          title: 'How Sweet',
          artist: 'NewJeans (뉴진스)',
          album: 'AI 믹스 • Groovy K-Pop',
          duration_secs: 219,
          path_or_url: 'Q3K0TOvTOno',
          cover_art: 'https://i.ytimg.com/vi/Q3K0TOvTOno/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_ko_6',
          title: 'Perfect Night',
          artist: 'LE SSERAFIM (르세라핌)',
          album: 'AI 믹스 • Night Drive',
          duration_secs: 160,
          path_or_url: 'hLvWy2b857I',
          cover_art: 'https://i.ytimg.com/vi/hLvWy2b857I/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_ko_7',
          title: 'Dynamite',
          artist: 'BTS (방탄소년단)',
          album: 'AI 믹스 • Billboard #1 Hit',
          duration_secs: 199,
          path_or_url: 'gdZLi9oWNZg',
          cover_art: 'https://i.ytimg.com/vi/gdZLi9oWNZg/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_ko_8',
          title: 'MAESTRO',
          artist: 'SEVENTEEN (세븐틴)',
          album: 'AI 믹스 • High Energy',
          duration_secs: 198,
          path_or_url: 'ilbT0854-C4',
          cover_art: 'https://i.ytimg.com/vi/ilbT0854-C4/hqdefault.jpg',
          source: 'youtube',
        },
      ];
      break;
    case 'ja':
      pool = [
        {
          id: 'aimix_seed_ja_1',
          title: 'Idol (アイドル)',
          artist: 'YOASOBI',
          album: 'AI Mix • J-Pop Top',
          duration_secs: 213,
          path_or_url: 'ZRtdQ81jPUQ',
          cover_art: 'https://i.ytimg.com/vi/ZRtdQ81jPUQ/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_ja_2',
          title: 'Bling-Bang-Bang-Born',
          artist: 'Creepy Nuts',
          album: 'AI Mix • Viral J-Pop',
          duration_secs: 178,
          path_or_url: 'mLW35YMz1eo',
          cover_art: 'https://i.ytimg.com/vi/mLW35YMz1eo/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_ja_3',
          title: 'Shinunoga E-Wa (死ぬのがいいわ)',
          artist: 'Fujii Kaze (藤井 風)',
          album: 'AI Mix • Chill Groove',
          duration_secs: 185,
          path_or_url: 'dFfvP9-A_P8',
          cover_art: 'https://i.ytimg.com/vi/dFfvP9-A_P8/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_ja_4',
          title: 'KICK BACK',
          artist: 'Kenshi Yonezu (米津玄師)',
          album: 'AI Mix • Anime Hit',
          duration_secs: 193,
          path_or_url: 'M2cckDmNLMI',
          cover_art: 'https://i.ytimg.com/vi/M2cckDmNLMI/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_ja_5',
          title: 'Show (唱)',
          artist: 'Ado',
          album: 'AI Mix • High Voltage',
          duration_secs: 191,
          path_or_url: 'pgXpM4l_MwI',
          cover_art: 'https://i.ytimg.com/vi/pgXpM4l_MwI/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_ja_6',
          title: 'Lilac (ライラック)',
          artist: 'Mrs. GREEN APPLE',
          album: 'AI Mix • J-Rock Sensation',
          duration_secs: 204,
          path_or_url: 'Q7PqG8K7fWw',
          cover_art: 'https://i.ytimg.com/vi/Q7PqG8K7fWw/hqdefault.jpg',
          source: 'youtube',
        },
      ];
      break;
    case 'zh-CN':
      pool = [
        {
          id: 'aimix_seed_zh_1',
          title: '晴天 (Sunny Day)',
          artist: '周杰伦 (Jay Chou)',
          album: 'AI Mix • 经典热歌',
          duration_secs: 269,
          path_or_url: 'DYptgVvkVLQ',
          cover_art: 'https://i.ytimg.com/vi/DYptgVvkVLQ/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_zh_2',
          title: '光年之外 (LIGHT YEARS AWAY)',
          artist: 'G.E.M. 邓紫棋',
          album: 'AI Mix • 华语流行',
          duration_secs: 235,
          path_or_url: 'T4SimnaiktU',
          cover_art: 'https://i.ytimg.com/vi/T4SimnaiktU/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_zh_3',
          title: '带我去找夜生活',
          artist: '告五人 (Accusefive)',
          album: 'AI Mix • 独立流行',
          duration_secs: 243,
          path_or_url: '55nPtJyp4eQ',
          cover_art: 'https://i.ytimg.com/vi/55nPtJyp4eQ/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_zh_4',
          title: '孤勇者 (Lonely Warrior)',
          artist: '陈奕迅 (Eason Chan)',
          album: 'AI Mix • 巅峰热榜',
          duration_secs: 256,
          path_or_url: 'H58vbez_m4E',
          cover_art: 'https://i.ytimg.com/vi/H58vbez_m4E/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_zh_5',
          title: '哪里都是你',
          artist: '队长 (Young Captain)',
          album: 'AI Mix • 潮流说唱',
          duration_secs: 208,
          path_or_url: '5dZ8vV8Y3fE',
          cover_art: 'https://i.ytimg.com/vi/5dZ8vV8Y3fE/hqdefault.jpg',
          source: 'youtube',
        },
      ];
      break;
    case 'en-US':
      pool = [
        {
          id: 'aimix_seed_en_1',
          title: 'Die With A Smile',
          artist: 'Lady Gaga & Bruno Mars',
          album: 'AI Mix • Top Match',
          duration_secs: 251,
          path_or_url: 'kPa7bsKwL-c',
          cover_art: 'https://i.ytimg.com/vi/kPa7bsKwL-c/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_en_2',
          title: 'Birds of a Feather',
          artist: 'Billie Eilish',
          album: 'AI Mix • Chill Pop',
          duration_secs: 196,
          path_or_url: 'V9PVRfjEBTI',
          cover_art: 'https://i.ytimg.com/vi/V9PVRfjEBTI/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_en_3',
          title: 'Espresso',
          artist: 'Sabrina Carpenter',
          album: 'AI Mix • Viral Summer',
          duration_secs: 175,
          path_or_url: 'eVli-tstM5E',
          cover_art: 'https://i.ytimg.com/vi/eVli-tstM5E/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_en_4',
          title: 'Blinding Lights',
          artist: 'The Weeknd',
          album: 'AI Mix • Synthwave',
          duration_secs: 200,
          path_or_url: '4NRXx6U8ABQ',
          cover_art: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_en_5',
          title: 'Cruel Summer',
          artist: 'Taylor Swift',
          album: 'AI Mix • Pop Sensation',
          duration_secs: 178,
          path_or_url: 'ic8j13piAhQ',
          cover_art: 'https://i.ytimg.com/vi/ic8j13piAhQ/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_en_6',
          title: 'Beautiful Things',
          artist: 'Benson Boone',
          album: 'AI Mix • Global Hit',
          duration_secs: 180,
          path_or_url: 'Oa_RSwwpPaA',
          cover_art: 'https://i.ytimg.com/vi/Oa_RSwwpPaA/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_en_7',
          title: 'Houdini',
          artist: 'Dua Lipa',
          album: 'AI Mix • Dance Pop',
          duration_secs: 185,
          path_or_url: 'suAR1PYFNYA',
          cover_art: 'https://i.ytimg.com/vi/suAR1PYFNYA/hqdefault.jpg',
          source: 'youtube',
        },
      ];
      break;
    case 'vi':
    default:
      pool = [
        {
          id: 'aimix_seed_vi_1',
          title: 'Đừng Làm Trái Tim Anh Đau',
          artist: 'Sơn Tùng M-TP',
          album: 'AI Mix • V-Pop Hot',
          duration_secs: 326,
          path_or_url: 'abPmZCZZrFA',
          cover_art: 'https://i.ytimg.com/vi/abPmZCZZrFA/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_vi_2',
          title: 'Không Thể Say',
          artist: 'HIEUTHUHAI',
          album: 'AI Mix • Trending Rap',
          duration_secs: 210,
          path_or_url: 'W_aX497N4cE',
          cover_art: 'https://i.ytimg.com/vi/W_aX497N4cE/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_vi_3',
          title: 'Bước Qua Mùa Cô Đơn',
          artist: 'Vũ.',
          album: 'AI Mix • Indie Ballad',
          duration_secs: 279,
          path_or_url: 'bX8d8XbS0hU',
          cover_art: 'https://i.ytimg.com/vi/bX8d8XbS0hU/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_vi_4',
          title: 'Từng Quen',
          artist: 'Wren Evans',
          album: 'AI Mix • New Wave',
          duration_secs: 174,
          path_or_url: 'zepHPnUDROE',
          cover_art: 'https://i.ytimg.com/vi/zepHPnUDROE/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_vi_5',
          title: 'Giá Như',
          artist: 'SOOBIN',
          album: 'AI Mix • R&B V-Pop',
          duration_secs: 216,
          path_or_url: 'kFq-qT8g16Q',
          cover_art: 'https://i.ytimg.com/vi/kFq-qT8g16Q/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_vi_6',
          title: 'Thủy Triều',
          artist: 'Quang Hùng MasterD',
          album: 'AI Mix • Viral V-Pop',
          duration_secs: 202,
          path_or_url: '7ig2lXjozdw',
          cover_art: 'https://i.ytimg.com/vi/7ig2lXjozdw/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_vi_7',
          title: 'Cắt Đôi Nỗi Sầu',
          artist: 'Tăng Duy Tân',
          album: 'AI Mix • Catchy Beat',
          duration_secs: 195,
          path_or_url: 'GpmOn4RyzZI',
          cover_art: 'https://i.ytimg.com/vi/GpmOn4RyzZI/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_vi_8',
          title: 'Thanh Xuân',
          artist: 'Da LAB',
          album: 'AI Mix • Nostalgia V-Pop',
          duration_secs: 228,
          path_or_url: 'GgQFO8dL5XQ',
          cover_art: 'https://i.ytimg.com/vi/GgQFO8dL5XQ/hqdefault.jpg',
          source: 'youtube',
        },
      ];
      break;
  }
  return pool;
};

const getLanguageAiPopupLabel = (lang: LanguageCode): string => {
  switch (lang) {
    case 'ko': return '✨ AI 믹스 • 당신을 위한 맞춤 추천';
    case 'ja': return '✨ AIミックス • あなたへのおすすめ';
    case 'zh-CN': return '✨ AI 混音 • 为你专属推荐';
    case 'en-US': return '✨ AI MIX • RECOMMENDED FOR YOU';
    case 'vi':
    default: return '✨ AI MIX • ĐỀ XUẤT CHO BẠN';
  }
};

  // Pre-fetch AI Mix recommendations on initial app startup (when !currentTrack)
  // or when language changes, and switch to normal Next Track pre-fetching once a track starts playing
  useEffect(() => {
    if (!currentTrack) {
      const initialAiMixSeeds: Track[] = getLanguageAiSeeds(language);
      const popupModeLabel = getLanguageAiPopupLabel(language);

      // Immediately show AI Mix popup tailored to selected language
      preloadedNextTrackRef.current = initialAiMixSeeds[0];
      setPreloadedNextTrack(initialAiMixSeeds[0]);
      preloadedAlternativesRef.current = initialAiMixSeeds.slice(1, 4);

      if (isNextTrackPopupEnabledRef.current && !isTrayModeRef.current) {
        const topPick = initialAiMixSeeds[0];
        const alts = initialAiMixSeeds.slice(1, 4);
        setNextTrackPopup({
          title: topPick.title,
          artist: topPick.artist,
          thumbnail: topPick.cover_art || undefined,
          source: topPick.source,
          modeLabel: popupModeLabel,
          isCountdown: false,
          alternatives: alts,
        });
      }

      return;
    }
    endOfTrackPopupShownForRef.current = null;
  }, [currentTrack, !currentTrack ? language : undefined]);

  const fetchUpcomingReqIdRef = useRef(0);

  const fetchUpcomingForTrack = async (targetTrack: Track) => {
    const reqId = ++fetchUpcomingReqIdRef.current;
    setIsAiLoadingNext(true);

    try {
      const related = await invoke<SearchResult[]>('get_related_tracks', {
        title: targetTrack.title,
        artist: targetTrack.artist,
      });

      if (reqId !== fetchUpcomingReqIdRef.current) return;

      if (related && related.length > 0) {
        const listened = listenedHistoryTitlesRef.current;
        const curTitleLower = targetTrack.title.toLowerCase();
        const curUrl = (targetTrack.path_or_url || '').toLowerCase();
        const curId = targetTrack.id.toLowerCase();

        // Filter out currently playing track, user playlists, and listened history
        const strictOutsideCandidates = related.filter(r => {
          const rTitle = r.title.toLowerCase();
          const rUrl = (r.url_or_id || '').toLowerCase();
          if (curUrl && rUrl === curUrl) return false;
          if (curId && (curId === rUrl || curId.includes(rUrl))) return false;
          if (rTitle.includes(curTitleLower) || curTitleLower.includes(rTitle)) return false;
          if (listened.has(rTitle) || listened.has(rUrl)) return false;
          if (isTrackInUserPlaylists(r.title, r.url_or_id)) return false;
          return true;
        });

        const rawPool = strictOutsideCandidates.length > 0
          ? strictOutsideCandidates
          : related.filter(r => {
              const rUrl = (r.url_or_id || '').toLowerCase();
              if (curUrl && rUrl === curUrl) return false;
              return !isTrackInUserPlaylists(r.title, r.url_or_id);
            });

        const candidates = (rawPool.length > 0 ? rawPool : related.filter(r => (r.url_or_id || '').toLowerCase() !== curUrl)).map((r): Track => ({
          id: `${r.source}_rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          title: r.title,
          artist: r.artist,
          album: r.album || 'Gợi ý ngoài Playlist',
          duration_secs: r.duration_secs || 210,
          path_or_url: r.url_or_id,
          cover_art: r.thumbnail,
          source: r.source,
        }));

        if (candidates.length > 0) {
          preloadedNextTrackRef.current = candidates[0];
          setPreloadedNextTrack(candidates[0]);
          preloadedAlternativesRef.current = candidates.slice(1, 6);
          if (isNextTrackPopupEnabledRef.current && !isTrayModeRef.current) {
            const popupLabel = recommendModeRef.current === 'fresh'
              ? getTranslation(language, 'mode.freshPopup')
              : recommendModeRef.current === 'mix'
                ? getTranslation(language, 'mode.mixPopup')
                : getTranslation(language, 'mode.queuePopup');

            setNextTrackPopup({
              title: candidates[0].title,
              artist: candidates[0].artist,
              thumbnail: candidates[0].cover_art || undefined,
              source: candidates[0].source,
              modeLabel: popupLabel,
              isCountdown: false,
              alternatives: candidates.slice(1, 4),
            });
          }
        }
      }
    } catch (err) {
      console.error('Error prefetching upcoming songs:', err);
    } finally {
      if (reqId === fetchUpcomingReqIdRef.current) {
        setIsAiLoadingNext(false);
      }
    }
  };

  const applyUserTheme = (userId: string, cloudThemeMode?: 'dark' | 'light', cloudAccentColor?: string) => {
    // 1. Theme Mode (Dark / Light)
    const userTheme = cloudThemeMode || (localStorage.getItem(`spytify_theme_mode_${userId}`) as 'dark' | 'light' | null);
    if (userTheme && (userTheme === 'dark' || userTheme === 'light')) {
      setThemeMode(userTheme);
      localStorage.setItem('spytify_theme_mode', userTheme);
      localStorage.setItem(`spytify_theme_mode_${userId}`, userTheme);
    }
    // 2. Accent Color
    const userColor = cloudAccentColor || localStorage.getItem(`spytify_accent_color_${userId}`);
    if (userColor && userColor.startsWith('#')) {
      setAccentColor(userColor);
      localStorage.setItem('spytify_accent_color', userColor);
      localStorage.setItem(`spytify_accent_color_${userId}`, userColor);
      document.documentElement.style.setProperty('--accent-color', userColor);
    }
  };

  // ─── RESTORE USER SESSION FROM SQLITE ──────────────────────────────────────
  useEffect(() => {
    const savedUserId = localStorage.getItem('spytify_active_user_id') || localStorage.getItem('soundify_active_user_id');
    if (savedUserId && savedUserId.trim() && savedUserId !== 'null' && savedUserId !== 'undefined') {
      invoke<User | null>('auth_get_current_user', { userId: savedUserId.trim() })
        .then(user => {
          if (user) {
            setCurrentUser(user);
            applyUserTheme(user.id);
            localStorage.setItem('spytify_active_user_id', user.id);
            localStorage.setItem('soundify_active_user_id', user.id);
            loadFavoritesFromDb(user.id);

            // Ensure Supabase Cloud has credentials & updated data
            if (isSupabaseConfigured()) {
              invoke<[string, string] | null>('auth_get_credentials', { userId: user.id })
                .then(creds => {
                  if (creds) {
                    cloudRegisterUser(user, user.email || null, creds[0], creds[1]);
                  }
                })
                .catch(() => {});

              invoke<Track[]>('db_get_favorites', { userId: user.id }).then(localFavs => {
                const localAlbums = loadAlbumsForUser(user.id);
                cloudSyncPush(user.id, {
                  favorites: localFavs,
                  albums: localAlbums,
                }).catch(() => {});
              }).catch(() => {});

              cloudSyncPull(user.id).then(cloudData => {
                if (typeof cloudData?.bio === 'string') {
                  localStorage.setItem(`spytify_user_bio_${user.id}`, cloudData.bio);
                  localStorage.setItem('spytify_user_bio', cloudData.bio);
                  if (currentUserRef.current?.id === user.id) {
                    setCurrentUser(prev => prev ? { ...prev, bio: cloudData.bio } : null);
                  }
                }
                if (typeof cloudData?.thought === 'string') {
                  localStorage.setItem(`spytify_user_thought_${user.id}`, cloudData.thought);
                  localStorage.setItem('spytify_user_thought', cloudData.thought);
                  if (currentUserRef.current?.id === user.id) {
                    setCurrentUser(prev => prev ? { ...prev, thought: cloudData.thought } : null);
                  }
                }
                if (cloudData?.albums?.length) {
                  const localAlbums = loadAlbumsForUser(user.id);
                  const existingIds = new Set(localAlbums.map(album => album.id));
                  const mergedAlbums = [
                    ...localAlbums,
                    ...cloudData.albums.filter(album => !existingIds.has(album.id)),
                  ];
                  persistAlbumsForUser(user.id, mergedAlbums);
                  if (currentUserRef.current?.id === user.id) setAlbums(mergedAlbums);
                }
                if (cloudData?.avatar && cloudData.avatar !== user.avatar) {
                  setCurrentUser(prev => prev ? { ...prev, avatar: cloudData.avatar } : null);
                  invoke('auth_update_avatar', { userId: user.id, avatar: cloudData.avatar }).catch(() => {});
                }
              }).catch(() => {});
            }
          } else {
            // Không tìm thấy phiên đăng nhập trên máy này -> Giữ giao diện chưa đăng nhập
            localStorage.removeItem('spytify_active_user_id');
            localStorage.removeItem('soundify_active_user_id');
            setCurrentUser(null);
          }
        })
        .catch(() => {
          localStorage.removeItem('spytify_active_user_id');
          localStorage.removeItem('soundify_active_user_id');
          setCurrentUser(null);
        });
    } else {
      // Người dùng mới hoặc chưa đăng nhập -> Khởi tạo ở giao diện Logout
      setCurrentUser(null);
    }
  }, []);

  const loadFavoritesFromDb = async (userId: string) => {
    try {
      const dbFavs = await invoke<Track[]>('db_get_favorites', { userId });
      setFavorites(new Set(dbFavs.map(t => t.id)));
      // Merge favorite tracks into current track list
      setTracks(prev => {
        return deduplicateTracks([...dbFavs, ...prev]);
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    applyUserTheme(user.id);
    localStorage.setItem('spytify_active_user_id', user.id);
    localStorage.setItem('soundify_active_user_id', user.id);
    loadFavoritesFromDb(user.id);
    showNotification(getTranslation(language, 'toast.welcomeUser', { name: user.display_name }));

    // Auto-sync with Supabase Cloud if configured
    if (isSupabaseConfigured()) {
      invoke<[string, string] | null>('auth_get_credentials', { userId: user.id })
        .then(creds => {
          if (creds) {
            cloudRegisterUser(user, user.email || null, creds[0], creds[1]);
          }
        })
        .catch(() => {});

      cloudSyncPull(user.id).then(cloudData => {
        if (cloudData) {
          if (typeof cloudData.bio === 'string') {
            localStorage.setItem(`spytify_user_bio_${user.id}`, cloudData.bio);
            localStorage.setItem('spytify_user_bio', cloudData.bio);
            if (currentUserRef.current?.id === user.id) {
              setCurrentUser(prev => prev ? { ...prev, bio: cloudData.bio } : null);
            }
          }
          if (typeof cloudData.thought === 'string') {
            localStorage.setItem(`spytify_user_thought_${user.id}`, cloudData.thought);
            localStorage.setItem('spytify_user_thought', cloudData.thought);
            if (currentUserRef.current?.id === user.id) {
              setCurrentUser(prev => prev ? { ...prev, thought: cloudData.thought } : null);
            }
          }
          if (cloudData.albums && cloudData.albums.length > 0) {
            const localAlbums = loadAlbumsForUser(user.id);
            const existingIds = new Set(localAlbums.map(album => album.id));
            const mergedAlbums = [
              ...localAlbums,
              ...cloudData.albums.filter(album => !existingIds.has(album.id)),
            ];
            persistAlbumsForUser(user.id, mergedAlbums);
            if (currentUserRef.current?.id === user.id) setAlbums(mergedAlbums);
          }
          if (cloudData.favorites && cloudData.favorites.length > 0) {
            for (const t of cloudData.favorites) {
              invoke('db_add_favorite', { userId: user.id, track: t }).catch(() => {});
            }
            setFavorites(prev => {
              const next = new Set(prev);
              cloudData.favorites.forEach(t => next.add(t.id));
              return next;
            });
            setTracks(prev => deduplicateTracks([...cloudData.favorites, ...prev]));
          }
          if (cloudData.avatar && cloudData.avatar !== user.avatar) {
            setCurrentUser(prev => prev ? { ...prev, avatar: cloudData.avatar } : null);
            invoke('auth_update_avatar', { userId: user.id, avatar: cloudData.avatar }).catch(() => {});
          }
          if (cloudData.accentColor) {
            handleUpdateAccentColor(cloudData.accentColor);
          }
          if (cloudData.themeMode && cloudData.themeMode !== themeMode) {
            setThemeMode(cloudData.themeMode);
            localStorage.setItem('spytify_theme_mode', cloudData.themeMode);
          }
          if (cloudData.language && cloudData.language !== language) {
            const l = cloudData.language as LanguageCode;
            setLanguage(l);
            localStorage.setItem('spytify_language', l);
          }
          showNotification(`🟢 ${getTranslation(language, 'toast.cloudSynced')} @${user.username}`);
        }
      }).catch(console.error);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCommunityServerColor(null);
    localStorage.removeItem('spytify_active_user_id');
    localStorage.removeItem('soundify_active_user_id');
    showNotification(getTranslation(language, 'toast.loggedOut'));
    setCurrentView('library');
  };

  const handleCycleRecommendMode = () => {
    setRecommendMode(prev => {
      let next: 'fresh' | 'mix' | 'off';
      if (prev === 'fresh') next = 'mix';
      else if (prev === 'mix') next = 'off';
      else next = 'fresh';
      recommendModeRef.current = next;
      localStorage.setItem('spytify_recommend_mode', next);
      if (next === 'fresh') {
        showNotification(getTranslation(language, 'toast.modeFresh'));
      } else if (next === 'mix') {
        showNotification(getTranslation(language, 'toast.modeMix'));
      } else {
        showNotification(getTranslation(language, 'toast.modeOff'));
      }
      if (isNextTrackPopupEnabledRef.current) {
        setTimeout(() => {
          const immediate = buildImmediatePopupData();
          if (immediate) setNextTrackPopup(immediate);
        }, 0);
      }
      return next;
    });
  };

  const displayedTracks = useMemo(() => {
    const filtered = tracks.filter(t => {
      switch (currentView) {
        case 'local': return t.source === 'local';
        case 'youtube': return t.source === 'youtube';
        case 'soundcloud': return t.source === 'soundcloud';
        case 'audius': return t.source === 'audius';
        case 'favorites': return favorites.has(t.id);
        default: return true;
      }
    });
    return deduplicateTracks(filtered);
  }, [tracks, currentView, favorites]);

  displayedTracksRef.current = displayedTracks;

  const upcomingTrack = useMemo(() => {
    return getNextPlaylistTrack(currentTrack);
  }, [currentTrack, displayedTracks, activeQueue, activeQueueContext, isShuffle]);

  const effectiveUpcomingTrack = useMemo(() => {
    const useNew = shouldNextBeNewDiscovery();
    if (useNew) {
      return preloadedNextTrack || upcomingTrack;
    }
    return upcomingTrack || preloadedNextTrack;
  }, [recommendMode, preloadedNextTrack, upcomingTrack, currentTrack, isShuffle, activeQueueContext]);

  const previousTrack = useMemo(() => {
    if (!isScopedPlaylistContext(activeQueueContext) && playbackHistoryStackRef.current.length > 0) {
      return playbackHistoryStackRef.current[playbackHistoryStackRef.current.length - 1];
    }

    const queue = getEffectiveQueue();
    if (!queue.length || !currentTrack) return null;

    const cur = currentTrack;
    const curPath = cur?.path_or_url || null;
    const curTitle = cur?.title?.trim().toLowerCase() || null;
    const curArtist = cur?.artist?.trim().toLowerCase() || null;

    const idx = queue.findIndex(t => 
      t.id === cur.id ||
      (curPath && t.path_or_url && t.path_or_url === curPath) ||
      (curTitle && curArtist && t.title.trim().toLowerCase() === curTitle && t.artist.trim().toLowerCase() === curArtist)
    );

    if (idx > 0) {
      return queue[idx - 1];
    } else if (idx === 0) {
      return queue.length > 1 ? queue[queue.length - 1] : queue[0];
    } else if (lastPlaylistIndexRef.current > 0) {
      return queue[lastPlaylistIndexRef.current - 1] || queue[0];
    }
    return queue[0];
  }, [currentTrack, displayedTracks, activeQueue, activeQueueContext, tracks, favorites]);

  // Keep Next Track Floating Popup 100% synchronized with effectiveUpcomingTrack once playback has started
  useEffect(() => {
    if (!isNextTrackPopupEnabledRef.current || !effectiveUpcomingTrack) return;
    if (!currentTrackRef.current) return;
    const useNew = shouldNextBeNewDiscovery();

    // When in discovery/fresh mode, NEVER fall back to favorites/library tracks while AI is analyzing/loading!
    if (useNew && !preloadedNextTrack) return;

    const allList = getEffectiveQueue();
    const cur = currentTrackRef.current;
    const altList = (useNew && preloadedAlternativesRef.current.length > 0)
      ? preloadedAlternativesRef.current.slice(0, 3)
      : (!useNew ? allList.filter(t => t.id !== cur?.id && t.id !== effectiveUpcomingTrack.id).slice(0, 3) : []);

    setNextTrackPopup(prev => ({
      title: effectiveUpcomingTrack.title,
      artist: effectiveUpcomingTrack.artist,
      thumbnail: effectiveUpcomingTrack.cover_art || undefined,
      source: effectiveUpcomingTrack.source,
      modeLabel: getPlaylistModeLabel(activeQueueContextRef.current),
      isCountdown: prev?.isCountdown || false,
      remainingSecs: prev?.remainingSecs,
      alternatives: altList,
    }));
  }, [effectiveUpcomingTrack, preloadedNextTrack, recommendMode, isShuffle, activeQueueContext, language]);

  // ─── AUTO-PLAY NEXT TRACK & AUTO-RECOMMEND ENGINE ──────────────────────────
  const handleNext = useCallback(async (isManualSkip = false, isCrossfade = false) => {
    if (ytUnavailableTimerRef.current) clearTimeout(ytUnavailableTimerRef.current);
    if (ytUnavailableRetryTimerRef.current) clearTimeout(ytUnavailableRetryTimerRef.current);

    const now = Date.now();
    if (!isManualSkip && !isCrossfade) {
      if (now - lastAutoSkipTimestampRef.current < 4500) {
        consecutiveAutoSkipsRef.current += 1;
      } else {
        consecutiveAutoSkipsRef.current = 1;
      }
      lastAutoSkipTimestampRef.current = now;

      if (consecutiveAutoSkipsRef.current >= 3) {
        console.warn('[Playback Guard] Detected rapid skip loop (>= 3 consecutive auto-skips in < 4.5s). Halting auto-advance.');
        consecutiveAutoSkipsRef.current = 0;
        isPlayingRef.current = false;
        setIsPlaying(false);
        showNotification('⚠️ Trình duyệt tạm dừng tự động chuyển bài. Bấm nút Phát để nghe tiếp.');
        return;
      }
    } else {
      consecutiveAutoSkipsRef.current = 0;
    }

    if (isSkippingRef.current) return;
    isSkippingRef.current = true;
    if (!isCrossfade) {
      if (crossfadeTimerRef.current) {
        clearInterval(crossfadeTimerRef.current);
        crossfadeTimerRef.current = null;
      }
      crossfadeActiveRef.current = false;
      setIsCrossfading(false);
      playStartTimestampRef.current = null;
      accumulatedTimeRef.current = 0;
    }

    try {
      const all = getEffectiveQueue();
      const cur = currentTrackRef.current;
      if (!all.length && !cur) return;

      // 0. Check if sleep timer is set to "End of current track"
      if (!isManualSkip && sleepTimerMinutesRef.current === 0) {
        setIsPlaying(false);
        sendYtCmd('stopVideo');
        sendScCmd('pause');
        onlineAudioRef.current?.pause();
        try { invoke('stop_track'); } catch {}
        setSleepTimerMinutes(null);
        setSleepTimerRemainingSecs(null);
        showNotification(getTranslation(language, 'timer.timeoutNotification'));
        return;
      }

      // 1. Repeat single track mode (only when track ends naturally, not on manual skip)
      if (!isManualSkip && repeatModeRef.current === 'one' && cur) {
        playTrackInternal(cur, false, false);
        return;
      }

      // 2. Repeat off and NOT in recommendation mode (stop only when reaching true end of playlist)
      if (!isManualSkip && repeatModeRef.current === 'off' && recommendModeRef.current === 'off') {
        const curPath = cur?.path_or_url;
        const curTitle = cur?.title?.trim().toLowerCase();
        const curArtist = cur?.artist?.trim().toLowerCase();
        const curIdx = cur ? all.findIndex(t => 
          t.id === cur.id ||
          (curPath && t.path_or_url && t.path_or_url === curPath) ||
          (curTitle && curArtist && t.title.trim().toLowerCase() === curTitle && t.artist.trim().toLowerCase() === curArtist)
        ) : -1;
        if (curIdx !== -1 && curIdx >= all.length - 1) {
          setIsPlaying(false);
          crossfadeActiveRef.current = false;
          setIsCrossfading(false);
          return;
        }
      }

      // 3. Shuffle mode within playlist when recommendMode === 'off'
      if (isShuffleRef.current && all.length > 1 && recommendModeRef.current === 'off') {
        const randomTrack = getNextPlaylistTrack(cur);
        if (randomTrack) {
          playTrackInternal(randomTrack, false, isCrossfade);
          return;
        }
      }

      // 4. CHẾ ĐỘ ĐỀ XUẤT NHẠC TIẾP THEO:
      // - 'fresh' (Mới): Bài tiếp theo luôn là bài MỚI hoàn toàn nằm ngoài mọi Playlist (Yêu thích, Album, Local)
      // - 'mix' (Mix): Xen kẽ 1 bài cũ (trong Playlist đang phát) ↔ 1 bài mới hoàn toàn (ngoài Playlist)
      // Lưu ý: Nếu người dùng đang nghe trong Scoped Playlist (Album nghệ sĩ, Album của tôi, Nhạc yêu thích), luôn ưu tiên phát tiếp trong Album/Playlist đó!
      const isScoped = isScopedPlaylistContext(activeQueueContextRef.current);
      if (recommendModeRef.current !== 'off' && !isScoped) {
        const mode = recommendModeRef.current;

        // 4A. Nếu ở chế độ 'mix' và tới lượt phát bài CŨ trong Playlist:
        if (mode === 'mix' && !mixNextIsNewRef.current && all.length > 0) {
          const nextPlaylistTrack = getNextPlaylistTrack(cur);
          if (nextPlaylistTrack) {
            mixNextIsNewRef.current = true;
            playTrackInternal(nextPlaylistTrack, false, isCrossfade);
            showNotification(`🎵 Mix [${getTranslation(language, 'mode.playlistTag')}]: ${nextPlaylistTrack.title} - ${nextPlaylistTrack.artist}`);
            return;
          }
        }

        // 4B. Lượt phát bài MỚI hoàn toàn ngoài Playlist (áp dụng cho 100% chế độ 'fresh', hoặc lượt bài mới của 'mix'):
        if (preloadedNextTrackRef.current && !isTrackInUserPlaylists(preloadedNextTrackRef.current.title, preloadedNextTrackRef.current.path_or_url)) {
          const next = preloadedNextTrackRef.current;
          preloadedNextTrackRef.current = null;
          mixNextIsNewRef.current = false;
          setTracks(prev => deduplicateTracks([...prev, next]));
          playTrackInternal(next, false, isCrossfade);
          const srcLabel = next.source === 'soundcloud' ? 'SoundCloud' : next.source === 'audius' ? 'Audius 320K' : 'YouTube';
          showNotification(`🌟 ${mode === 'fresh' ? getTranslation(language, 'toast.newDiscovery') : `Mix [${getTranslation(language, 'mode.newTrackTag')}]`} [${srcLabel}]: ${next.title} - ${next.artist}`);
          return;
        }

        if (cur) {
          try {
            showNotification(`🌟 ${getTranslation(language, 'toast.findingNewTracks')}`);
            const related = await invoke<SearchResult[]>('get_related_tracks', {
              title: cur.title,
              artist: cur.artist,
            });

            if (related && related.length > 0) {
              const listened = listenedHistoryTitlesRef.current;
              const curTitleNorm = cur.title.trim().toLowerCase();

              // Lọc nghiêm ngặt: bài mới phải nằm ngoài hoàn toàn Playlist (Yêu thích, Album, Local) và chưa nghe
              const outsideUnlistened = related.filter(r => {
                if (r.duration_secs && r.duration_secs > 600) return false;
                const rTitle = r.title.trim().toLowerCase();
                const rId = r.url_or_id.toLowerCase();
                if (rTitle === curTitleNorm || rTitle.includes(curTitleNorm) || curTitleNorm.includes(rTitle)) return false;
                if (listened.has(rTitle) || listened.has(rId)) return false;
                if (isTrackInUserPlaylists(r.title, r.url_or_id)) return false;
                return true;
              });

              const candidate = outsideUnlistened.length > 0 ? outsideUnlistened[0] : (
                related.find(r => !isTrackInUserPlaylists(r.title, r.url_or_id) && r.title.trim().toLowerCase() !== curTitleNorm && (!r.duration_secs || r.duration_secs <= 600)) || related[0]
              );

              if (candidate) {
                const newTrack: Track = {
                  id: `${candidate.source}_${mode}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  title: candidate.title,
                  artist: candidate.artist,
                  album: candidate.album || (mode === 'fresh' ? 'Multi-Source Discovery' : 'Smart Mix Discovery'),
                  duration_secs: candidate.duration_secs || 210,
                  path_or_url: candidate.url_or_id,
                  cover_art: candidate.thumbnail,
                  source: candidate.source,
                };

                mixNextIsNewRef.current = false;
                setTracks(prev => deduplicateTracks([...prev, newTrack]));
                playTrackInternal(newTrack, false, isCrossfade);
                const srcLabel = newTrack.source === 'soundcloud' ? 'SoundCloud' : newTrack.source === 'audius' ? 'Audius 320K' : 'YouTube';
                showNotification(`🌟 ${mode === 'fresh' ? getTranslation(language, 'toast.newDiscovery') : `Mix [${getTranslation(language, 'mode.newTrackTag')}]`} [${srcLabel}]: ${newTrack.title} - ${newTrack.artist}`);
                return;
              }
            }
          } catch (err) {
            console.error('Error discovering outside-playlist track:', err);
          }
        }
      }

      // 5. Default sequential next within active playlist (when recommendMode === 'off' or fallback)
      if (!cur) {
        if (all[0]) {
          playTrackInternal(all[0], false, isCrossfade);
        }
        return;
      }

      const nextTrack = getNextPlaylistTrack(cur);
      if (nextTrack) {
        playTrackInternal(nextTrack, false, isCrossfade);
      } else if (isCrossfade) {
        crossfadeActiveRef.current = false;
        setIsCrossfading(false);
      }
    } finally {
      setTimeout(() => {
        isSkippingRef.current = false;
      }, 300);
    }
  }, [language]);

  const handleNextRef = useRef(handleNext);
  handleNextRef.current = handleNext;

  const [isTrayMode, setIsTrayMode] = useState(false);
  const isTrayModeRef = useRef(false);

  const nextTrackPopupRef = useRef<HTMLDivElement | null>(null);
  const [nextTrackPopupHeight, setNextTrackPopupHeight] = useState<number>(() => {
    return isNextTrackPopupCollapsed ? 44 : 270;
  });

  const nextTrackPopupCallbackRef = useCallback((node: HTMLDivElement | null) => {
    nextTrackPopupRef.current = node;
    if (node) {
      setNextTrackPopupHeight(node.offsetHeight || (isNextTrackPopupCollapsed ? 44 : 270));
    }
  }, [isNextTrackPopupCollapsed]);

  const isNextTrackPopupVisible = Boolean(
    !isTrayMode &&
    (nextTrackPopup || (isAiLoadingNext && currentTrack)) &&
    isNextTrackPopupEnabled
  );

  useEffect(() => {
    if (!isNextTrackPopupVisible) {
      setNextTrackPopupHeight(0);
      return;
    }
    const el = nextTrackPopupRef.current;
    if (!el) {
      setNextTrackPopupHeight(isNextTrackPopupCollapsed ? 44 : 270);
      return;
    }
    setNextTrackPopupHeight(el.offsetHeight);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        if (h > 0) {
          setNextTrackPopupHeight(Math.round(h));
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [isNextTrackPopupVisible, isNextTrackPopupCollapsed, nextTrackPopup, isAiLoadingNext]);

  const desktopPlayerBottom = isPlayerBarMinimized ? 34 : 58;
  const desktopYtBottom = desktopPlayerBottom;

  // ─── WALL-CLOCK TIME TICKER (IMMUNE TO BACKGROUND TAB THROTTLING) ────────
  useEffect(() => {
    const interval = setInterval(() => {
      const track = currentTrackRef.current;
      if (!track || !isPlayingRef.current) return;

      let curTime = 0;
      const trueDur = Math.max(durationRef.current || 0, track.duration_secs || 0);

      const isAudioElement =
        track.source === 'local' ||
        track.source === 'audius' ||
        (track.source === 'youtube' && ytMusicFallbackActiveRef.current);

      if (isAudioElement) {
        const audio = activeAudioChannelRef.current === 1 ? onlineAudio1Ref.current : onlineAudio2Ref.current;
        if (audio && !audio.paused) {
          curTime = audio.currentTime;
          currentTimeRef.current = audio.currentTime;
          if (!isTrayModeRef.current) {
            setCurrentTime(audio.currentTime);
          }
          if (audio.duration > 0 && isFinite(audio.duration) && audio.duration !== durationRef.current) {
            durationRef.current = audio.duration;
            if (!isTrayModeRef.current) setDuration(audio.duration);
          }
        } else {
          curTime = currentTimeRef.current || 0;
        }
      } else if (track.source === 'youtube' || track.source === 'soundcloud') {
        if (!playStartTimestampRef.current && isPlayingRef.current) {
          playStartTimestampRef.current = Date.now();
        }
        if (playStartTimestampRef.current) {
          const elapsed = accumulatedTimeRef.current + (Date.now() - playStartTimestampRef.current) / 1000;
          curTime = elapsed;
          currentTimeRef.current = elapsed;
          if (!isTrayModeRef.current) {
            setCurrentTime(elapsed);
          }

          // Safety fallback: only auto-skip if elapsed well exceeds true duration (+8s grace period)
          if (trueDur > 0 && elapsed >= (trueDur + 8)) {
            playStartTimestampRef.current = null;
            accumulatedTimeRef.current = 0;
            handleNextRef.current?.();
            return;
          }
        }
      } else {
        curTime = currentTimeRef.current || 0;
      }

      if (isTrayModeRef.current) return;

      // ─── SPOTIFY-STYLE EQUAL-POWER CROSSFADE TRIGGER ───
      const cfSecs = crossfadeDurationRef.current;
      const isMobileWeb = typeof window !== 'undefined' && (
        Boolean((window as any).__TAURI_WEB_SHIM__) ||
        window.innerWidth < 768 ||
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      );
      const isPlayingViaIframe = currentTrack?.source === 'youtube' && !ytMusicFallbackActiveRef.current;
      
      // On mobile web when using a single YouTube iframe, you CANNOT overlap two audios in one iframe!
      // Triggering 12s early would abruptly cut off the last 12s of the song!
      // Only trigger early if we have true dual audio channels (desktop) or dual HTML5 audio elements.
      const canDoEarlyOverlap = !isMobileWeb || !isPlayingViaIframe;
      const effectiveCfSecs = canDoEarlyOverlap ? cfSecs : 1.2;

      if (
        cfSecs > 0 &&
        !crossfadeActiveRef.current &&
        !isSkippingRef.current &&
        trueDur > 10 &&
        curTime > 5 &&
        (trueDur - curTime) <= effectiveCfSecs &&
        (trueDur - curTime) >= 0.2
      ) {
        crossfadeActiveRef.current = true;
        handleNextRef.current?.(false, canDoEarlyOverlap);
      }

      // Update real-time countdown when 10s or less remains
      if (trueDur > 15 && curTime > 5) {
        const remaining = trueDur - curTime;
        if (remaining <= 10 && remaining >= 1) {
          if (isNextTrackPopupEnabledRef.current) {
            const useNew = shouldNextBeNewDiscovery();
            const nextOne = useNew
              ? (preloadedNextTrackRef.current || upcomingTrack)
              : (upcomingTrack || preloadedNextTrackRef.current);
            if (nextOne) {
              setNextTrackPopup(prev => ({
                title: nextOne.title,
                artist: nextOne.artist,
                thumbnail: nextOne.cover_art || undefined,
                source: nextOne.source,
                modeLabel: getPlaylistModeLabel(activeQueueContextRef.current),
                isCountdown: true,
                remainingSecs: Math.round(remaining),
                alternatives: prev?.alternatives || preloadedAlternativesRef.current.slice(0, 3),
              }));
            }
          }
        }
      }
    }, 250);
    return () => clearInterval(interval);
  }, [upcomingTrack]);

  // ─── INSTANT RESYNC WHEN SWITCHING BACK TO APP WINDOW ────────────────────
  const syncPlaybackStateNow = useCallback(async () => {
    const track = currentTrackRef.current;
    if (!track) return;

    if (track.source === 'local') {
      if (onlineAudioRef.current && onlineAudioRef.current.src) {
        const playing = !onlineAudioRef.current.paused;
        isPlayingRef.current = playing;
        setIsPlaying(playing);
        currentTimeRef.current = onlineAudioRef.current.currentTime;
        setCurrentTime(onlineAudioRef.current.currentTime);
        if (onlineAudioRef.current.duration > 0 && !isNaN(onlineAudioRef.current.duration)) {
          durationRef.current = onlineAudioRef.current.duration;
          setDuration(onlineAudioRef.current.duration);
        }
      } else {
        try {
          const status = await invoke<PlaybackStatus>('get_playback_status');
          isPlayingRef.current = status.is_playing;
          setIsPlaying(status.is_playing);
          currentTimeRef.current = status.current_time_secs;
          setCurrentTime(status.current_time_secs);
          if (status.duration_secs > 0) {
            durationRef.current = status.duration_secs;
            setDuration(status.duration_secs);
          }
        } catch {}
      }
    } else if (track.source === 'audius' || (track.source === 'youtube' && ytMusicFallbackActiveRef.current)) {
      if (onlineAudioRef.current) {
        const playing = !onlineAudioRef.current.paused;
        isPlayingRef.current = playing;
        setIsPlaying(playing);
        currentTimeRef.current = onlineAudioRef.current.currentTime;
        setCurrentTime(onlineAudioRef.current.currentTime);
        if (onlineAudioRef.current.duration > 0 && !isNaN(onlineAudioRef.current.duration)) {
          durationRef.current = onlineAudioRef.current.duration;
          setDuration(onlineAudioRef.current.duration);
        }
      }
    } else if (isPlayingRef.current && playStartTimestampRef.current) {
      // Instantly recalculate true elapsed time from real system clock!
      const elapsed = accumulatedTimeRef.current + (Date.now() - playStartTimestampRef.current) / 1000;
      currentTimeRef.current = elapsed;
      setCurrentTime(elapsed);
      // Ping YouTube to ensure state is fresh
      const activeYtTarget = activeYtChannelRef.current === 1 ? ytIframe1Ref.current : ytIframe2Ref.current;
      if (track.source === 'youtube' && activeYtTarget?.contentWindow) {
        activeYtTarget.contentWindow.postMessage(
          JSON.stringify({ event: 'listening', id: activeYtChannelRef.current, channel: 'widget' }), '*'
        );
      }
    } else {
      setCurrentTime(currentTimeRef.current || accumulatedTimeRef.current || 0);
      setIsPlaying(isPlayingRef.current);
      if (durationRef.current > 0) setDuration(durationRef.current);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('focus', syncPlaybackStateNow);
    return () => {
      window.removeEventListener('focus', syncPlaybackStateNow);
    };
  }, [syncPlaybackStateNow]);

  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      try {
        const isFrom1 = ytIframe1Ref.current && event.source === ytIframe1Ref.current.contentWindow;
        const isFrom2 = ytIframe2Ref.current && event.source === ytIframe2Ref.current.contentWindow;
        const isFromSc1 = scIframe1Ref.current && event.source === scIframe1Ref.current.contentWindow;
        const isFromSc2 = scIframe2Ref.current && event.source === scIframe2Ref.current.contentWindow;
        const isFromSc = isFromSc1 || isFromSc2;
        const scChannel: 1 | 2 = isFromSc1 ? 1 : 2;

        // Bỏ qua tin nhắn không phải từ iframe của Spytify
        if (!isFrom1 && !isFrom2 && !isFromSc) {
          return;
        }

        const ytChannel: 1 | 2 = isFrom1 ? 1 : 2;
        if (isFrom1) ytIframeReady1Ref.current = true;
        if (isFrom2) ytIframeReady2Ref.current = true;
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data) return;

        const tryRecoverBackgroundPause = () => {
          if (
            isBackgroundPlayEnabledRef.current &&
            !userInitiatedPauseRef.current &&
            !ytMusicFallbackActiveRef.current &&
            (document.hidden || Date.now() - lastHiddenAtRef.current < 3500)
          ) {
            sendYtCmd('playVideo', [], ytChannel);
            setTimeout(() => {
              if (isPlayingRef.current && !userInitiatedPauseRef.current && currentTrackRef.current?.source === 'youtube') {
                sendYtCmd('playVideo', [], ytChannel);
              }
            }, 150);
            setTimeout(() => {
              if (isPlayingRef.current && !userInitiatedPauseRef.current && currentTrackRef.current?.source === 'youtube') {
                sendYtCmd('playVideo', [], ytChannel);
              }
            }, 450);
            return true;
          }
          return false;
        };

        // YouTube events: onReady
        if (data.event === 'onReady') {
          if (ytChannel === activeYtChannelRef.current && currentTrackRef.current?.source === 'youtube') {
            const curVol = volumeRef.current;
            if (curVol > 0) {
              sendYtCmd('unMute', [], ytChannel);
            } else {
              sendYtCmd('mute', [], ytChannel);
            }
            if (!crossfadeActiveRef.current) {
              sendYtCmd('setVolume', [Math.round(curVol * 100)], ytChannel);
            }
            if (isPlayingRef.current) {
              sendYtCmd('playVideo', [], ytChannel);
            }
            // onReady simply confirms iframe widget initialization.
            // Do NOT mark ytHasStartedPlayingRef or cancel watchdog timer here,
            // as embed-blocked videos also fire onReady before showing error screen.
          }
        }

        // Tự động giải phóng khi video ở trạng thái CUED (info: 5) hoặc UNSTARTED (info: -1)
        if (data.event === 'onStateChange' && (data.info === 5 || data.info === -1)) {
          if (
            ytChannel === activeYtChannelRef.current &&
            currentTrackRef.current?.source === 'youtube' &&
            isPlayingRef.current &&
            !ytMusicFallbackActiveRef.current
          ) {
            const curVol = volumeRef.current;
            if (curVol > 0) {
              sendYtCmd('unMute', [], ytChannel);
            } else {
              sendYtCmd('mute', [], ytChannel);
            }
            if (!crossfadeActiveRef.current) {
              sendYtCmd('setVolume', [Math.round(curVol * 100)], ytChannel);
            }
            sendYtCmd('playVideo', [], ytChannel);
          }
        }

        if (data.event === 'onError') {
          if (ytChannel !== activeYtChannelRef.current || currentTrackRef.current?.source !== 'youtube') return;
          const erroredTrack = currentTrackRef.current;
          console.warn('[YouTube Player] Embed blocked or unavailable, code:', data.info);
          handleYouTubeBlockedOrStalledRef.current(erroredTrack);
        }

        if (data.event === 'onStateChange') {
          if (ytChannel === activeYtChannelRef.current && currentTrackRef.current?.source === 'youtube') {
            if (data.info === 1) {
              // State 1: PLAYING - genuine playback began
              isPlayingRef.current = true;
              setIsPlaying(true);
              if (!playStartTimestampRef.current) {
                playStartTimestampRef.current = Date.now();
              }
              ytHasStartedPlayingRef.current = true;
              if (ytUnavailableTimerRef.current) clearTimeout(ytUnavailableTimerRef.current);
              if (ytUnavailableRetryTimerRef.current) clearTimeout(ytUnavailableRetryTimerRef.current);
            } else if (data.info === 3) {
              // State 3: BUFFERING - keep waiting for playback, do NOT clear watchdog timer
            } else if (data.info === 2) {
              // State 2: PAUSED
              // Bỏ qua trạng thái pause thoáng qua ngay sau khi chuyển bài (YouTube phát tín hiệu cued/buffering)
              if (!userInitiatedPauseRef.current && (Date.now() - ytLastSwitchAtRef.current) < 1200) {
                return;
              }
              if (tryRecoverBackgroundPause()) return;

              // If YouTube self-paused right after mount without user action and video has not played:
              // this means YouTube halted due to embed-restriction (101/150) or playback failure!
              if (!userInitiatedPauseRef.current && (!ytHasStartedPlayingRef.current || currentTimeRef.current === 0)) {
                console.warn('[YouTube Player] Self-paused at 0:00 without user input. Triggering unblocked fallback...');
                handleYouTubeBlockedOrStalledRef.current(currentTrackRef.current);
                return;
              }

              isPlayingRef.current = false;
              setIsPlaying(false);
              if (playStartTimestampRef.current) {
                accumulatedTimeRef.current += (Date.now() - playStartTimestampRef.current) / 1000;
                playStartTimestampRef.current = null;
              }
            } else if (data.info === 0) {
              // Bỏ qua nếu crossfade đang chuyển bài chéo hoặc vừa mới chuyển bài qua loadVideoById
              if (!crossfadeActiveRef.current && (Date.now() - ytLastSwitchAtRef.current) > 1200) {
                const cur = currentTimeRef.current;
                const dur = durationRef.current;
                if (dur > 5 && dur - cur > 4) {
                  console.warn('[YouTube] info=0 fired prematurely before finish. Ignoring.');
                  return;
                }
                isPlayingRef.current = false;
                setIsPlaying(false);
                playStartTimestampRef.current = null;
                accumulatedTimeRef.current = 0;
                handleNext();
              }
            }
          }
        }
        if (data.event === 'infoDelivery' && data.info) {
          if (ytChannel === activeYtChannelRef.current && currentTrackRef.current?.source === 'youtube') {
            const expectedVid = ytChannel === 1 ? latestYtVideoId1Ref.current : latestYtVideoId2Ref.current;
            const infoVid = data.info?.videoData?.video_id;
            const recentlySwitched = (Date.now() - ytLastSwitchAtRef.current) < 900;
            if (infoVid && expectedVid && infoVid !== expectedVid) {
              return;
            }
            const isCurLive = checkIsLiveTrack(currentTrackRef.current);
            if (typeof data.info.currentTime === 'number') {
              const rawCur = data.info.currentTime;
              const isStalePrevTime = recentlySwitched && !infoVid && rawCur > 12;
              if (!isStalePrevTime) {
                if (rawCur > 0) {
                  ytHasStartedPlayingRef.current = true;
                  if (ytUnavailableTimerRef.current) clearTimeout(ytUnavailableTimerRef.current);
                  if (ytUnavailableRetryTimerRef.current) clearTimeout(ytUnavailableRetryTimerRef.current);
                }
                // Guard against YouTube Live streams sending DVR/epoch timestamps
                if (isCurLive || rawCur > 86400) {
                  durationRef.current = 0;
                  if (!isTrayModeRef.current) setDuration(0);
                } else if (rawCur >= 0) {
                  currentTimeRef.current = rawCur;
                  accumulatedTimeRef.current = rawCur;
                  if (isPlayingRef.current) playStartTimestampRef.current = Date.now();
                  if (!isTrayModeRef.current) setCurrentTime(rawCur);
                }
              }
            }
            if (typeof data.info.duration === 'number') {
              if (isCurLive) {
                durationRef.current = 0;
                if (!isTrayModeRef.current) setDuration(0);
              } else if (data.info.duration > 0 && data.info.duration < 86400) {
                durationRef.current = data.info.duration;
                if (!isTrayModeRef.current) setDuration(data.info.duration);
              } else if (data.info.duration === 0) {
                durationRef.current = 0;
                if (!isTrayModeRef.current) setDuration(0);
              }
            }
            if (data.info.muted === true && volumeRef.current > 0) {
              sendYtCmd('unMute', [], ytChannel);
              sendYtCmd('setVolume', [Math.round(volumeRef.current * 100)], ytChannel);
            }
            if (data.info.playerState === 1) {
              ytHasStartedPlayingRef.current = true;
              if (ytUnavailableTimerRef.current) clearTimeout(ytUnavailableTimerRef.current);
              if (ytUnavailableRetryTimerRef.current) clearTimeout(ytUnavailableRetryTimerRef.current);
              isPlayingRef.current = true;
              if (!playStartTimestampRef.current) playStartTimestampRef.current = Date.now();
              if (!isTrayModeRef.current) setIsPlaying(true);
              if (!crossfadeActiveRef.current) {
                const curVol = volumeRef.current;
                const volPct = Math.round(curVol * 100);
                sendYtCmd(curVol === 0 ? 'mute' : 'unMute', [], ytChannel);
                sendYtCmd('setVolume', [volPct], ytChannel);
              }
            }
            if (data.info.playerState === 2) {
              if (tryRecoverBackgroundPause()) return;
              isPlayingRef.current = false;
              if (playStartTimestampRef.current) {
                accumulatedTimeRef.current += (Date.now() - playStartTimestampRef.current) / 1000;
                playStartTimestampRef.current = null;
              }
              if (!isTrayModeRef.current) setIsPlaying(false);
            }
          }
        }

        // SoundCloud Widget events
        const scEvent = data.soundcloudEvent || (typeof data.method === 'string' && ['play', 'pause', 'finish', 'playProgress', 'seek'].includes(data.method) ? data.method : null);
        if (scEvent) {
          if (currentTrackRef.current?.source !== 'soundcloud') return;

          // Extract duration from SoundCloud widget events if provided
          const rawDur = data.data?.duration ?? data.value?.duration ?? data.duration;
          if (typeof rawDur === 'number' && rawDur > 0) {
            const durSecs = Math.round(rawDur / 1000);
            if (durSecs > 0 && durSecs < 86400) {
              durationRef.current = durSecs;
              if (!isTrayModeRef.current) setDuration(durSecs);
            }
          }
          if (scEvent === 'play') {
            if (scChannel === activeScChannelRef.current) {
              isPlayingRef.current = true;
              setIsPlaying(true);
              playStartTimestampRef.current = Date.now();
              if (!crossfadeActiveRef.current) {
                sendScCmd('setVolume', volumeRef.current * 100, scChannel);
              }
            }
          }
          if (scEvent === 'pause') {
            if (scChannel === activeScChannelRef.current) {
              isPlayingRef.current = false;
              setIsPlaying(false);
              if (playStartTimestampRef.current) {
                accumulatedTimeRef.current += (Date.now() - playStartTimestampRef.current) / 1000;
                playStartTimestampRef.current = null;
              }
            }
          }
          if (scEvent === 'finish') {
            if (scChannel === activeScChannelRef.current && !crossfadeActiveRef.current) {
              isPlayingRef.current = false;
              setIsPlaying(false);
              playStartTimestampRef.current = null;
              accumulatedTimeRef.current = 0;
              handleNext();
            }
          }
          if (scEvent === 'playProgress') {
            if (scChannel === activeScChannelRef.current) {
              const rawPos = data.data?.currentPosition ?? data.value?.currentPosition ?? 0;
              const posSecs = rawPos / 1000;
              if (posSecs > 0) {
                currentTimeRef.current = posSecs;
                accumulatedTimeRef.current = posSecs;
                if (isPlayingRef.current) playStartTimestampRef.current = Date.now();
                if (!isTrayModeRef.current) setCurrentTime(posSecs);
              }
            }
          }
        }
      } catch { /* ignore non-JSON messages */ }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [handleNext]);

  // Subscribe to YouTube iframe events and proactively sync volume & playback after video loads
  useEffect(() => {
    const ch = activeYtChannelRef.current;
    const vid = ch === 1 ? ytVideoId1 : ytVideoId2;
    if (!vid) return;
    const syncYt = () => {
      try {
        const targetIframe = ch === 1 ? ytIframe1Ref.current : ytIframe2Ref.current;
        targetIframe?.contentWindow?.postMessage(
          JSON.stringify({ event: 'listening', id: ch, channel: 'widget' }), '*'
        );
        if (!crossfadeActiveRef.current) {
          const curVol = volumeRef.current;
          if (curVol === 0) {
            sendYtCmd('mute', [], ch);
          } else {
            sendYtCmd('unMute', [], ch);
          }
          sendYtCmd('setVolume', [Math.round(curVol * 100)], ch);
        }
        if (
          isPlayingRef.current &&
          currentTrackRef.current?.source === 'youtube' &&
          !ytMusicFallbackActiveRef.current &&
          !ytHasStartedPlayingRef.current
        ) {
          sendYtCmd('playVideo', [], ch);
        }
      } catch {}
    };
    syncYt();
    const timer1 = setTimeout(syncYt, 250);
    const timer2 = setTimeout(syncYt, 600);
    const timer3 = setTimeout(syncYt, 1200);
    const timer4 = setTimeout(syncYt, 2200);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [ytVideoId1, ytVideoId2]);

  // ─── DUAL HTML5 AUDIO ELEMENTS (CHANNEL 1 & 2 FOR SEAMLESS EQUAL-POWER CROSSFADE) ───
  useEffect(() => {
    const audio1 = new Audio();
    const audio2 = new Audio();
    (audio1 as any).playsInline = true;
    (audio2 as any).playsInline = true;
    audio1.setAttribute('playsinline', 'true');
    audio2.setAttribute('playsinline', 'true');
    audio1.setAttribute('webkit-playsinline', 'true');
    audio2.setAttribute('webkit-playsinline', 'true');
    audio1.preload = 'auto';
    audio2.preload = 'auto';

    if (!(window as any).__TAURI_WEB_SHIM__) {
      audio1.crossOrigin = 'anonymous';
      audio2.crossOrigin = 'anonymous';
    }
    onlineAudio1Ref.current = audio1;
    onlineAudio2Ref.current = audio2;
    onlineAudioRef.current = audio1;

    // Mobile / Web WebKit Audio Session unlocker on first gesture
    const unlockAudioOnTouch = () => {
      ensureAudioContextRunning();
      if (bgKeepAliveAudioRef.current && isBackgroundPlayEnabledRef.current) {
        bgKeepAliveAudioRef.current.play().catch(() => {});
      }
      if (audio1 && audio1.paused && !audio1.src) {
        audio1.src = createSilentKeepAliveWavUri();
        audio1.play().catch(() => {});
      }
      window.removeEventListener('touchstart', unlockAudioOnTouch);
      window.removeEventListener('touchend', unlockAudioOnTouch);
      window.removeEventListener('click', unlockAudioOnTouch);
    };
    window.addEventListener('touchstart', unlockAudioOnTouch, { passive: true });
    window.addEventListener('touchend', unlockAudioOnTouch, { passive: true });
    window.addEventListener('click', unlockAudioOnTouch, { passive: true });

    try {
      attachAudioElementToEqualizer(audio1);
      attachAudioElementToEqualizer(audio2);
      applyEqualizerStateToGraph(loadEqualizerState());
    } catch (e) {
      console.warn('Equalizer audio graph attach notice:', e);
    }

    const setupAudioListeners = (audio: HTMLAudioElement, channel: 1 | 2) => {
      const onTimeUpdate = () => {
        if (activeAudioChannelRef.current !== channel) return;
        if (
          currentTrackRef.current?.source === 'audius' ||
          currentTrackRef.current?.source === 'local' ||
          (currentTrackRef.current?.source === 'youtube' && ytMusicFallbackActiveRef.current)
        ) {
          currentTimeRef.current = audio.currentTime;
          if (!isTrayModeRef.current) {
            setCurrentTime(audio.currentTime);
          }
          const validDur = (audio.duration > 0 && isFinite(audio.duration)) 
            ? audio.duration 
            : (currentTrackRef.current?.duration_secs || 0);
          if (validDur > 0) {
            durationRef.current = validDur;
            if (!isTrayModeRef.current) {
              setDuration(validDur);
            }
          }
        }
      };

      const onEnded = () => {
        if (activeAudioChannelRef.current !== channel) return;
        const cur = audio.currentTime;
        const dur = audio.duration;
        // Strict guard: only consider ended if audio actually played and reached near the end!
        const isActuallyFinished = cur > 3 && dur > 5 && (Math.abs(cur - dur) < 4 || cur >= dur - 1.5);
        if (!isActuallyFinished) {
          console.warn(`[Audio Ch${channel}] premature onEnded ignored: currentTime=${cur}, duration=${dur}`);
          return;
        }
        if (!crossfadeActiveRef.current) {
          isPlayingRef.current = false;
          setIsPlaying(false);
          playStartTimestampRef.current = null;
          accumulatedTimeRef.current = 0;
          handleNextRef.current?.();
        }
      };

      const onError = () => {
        if (activeAudioChannelRef.current !== channel) return;
        console.warn(`[Audio Ch${channel}] HTML5 Audio playback error:`, audio.error);
        const erroredTrack = currentTrackRef.current;
        if (erroredTrack && erroredTrack.source === 'youtube' && ytMusicFallbackActiveRef.current) {
          // If direct audio stream errored, switch back to YouTube iframe embed
          ytMusicFallbackActiveRef.current = false;
          ytMusicFallbackTriedRef.current = true;
          const vid = extractCleanYtId(erroredTrack.path_or_url || erroredTrack.id);
          if (vid) {
            loadOrMountYtChannel(vid, activeYtChannelRef.current, volumeRef.current * 100);
            return;
          }
        }
        isPlayingRef.current = false;
        setIsPlaying(false);
      };

      const onDuration = () => {
        if (activeAudioChannelRef.current !== channel) return;
        const validDur = (audio.duration > 0 && isFinite(audio.duration)) 
          ? audio.duration 
          : (currentTrackRef.current?.duration_secs || 0);
        if (validDur > 0) {
          durationRef.current = validDur;
          if (!isTrayModeRef.current) setDuration(validDur);
        }
      };

      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('loadedmetadata', onDuration);
      audio.addEventListener('durationchange', onDuration);
      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);
      return () => {
        audio.pause();
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('loadedmetadata', onDuration);
        audio.removeEventListener('durationchange', onDuration);
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
      };
    };

    const cleanup1 = setupAudioListeners(audio1, 1);
    const cleanup2 = setupAudioListeners(audio2, 2);

    return () => {
      cleanup1();
      cleanup2();
    };
  }, []);

  // ─── LOCAL playback polling ───────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      if (currentTrackRef.current?.source !== 'local') return;
      // If native browser HTML5 audio is currently playing, it manages its own timeupdate & isPlaying
      if (onlineAudioRef.current && onlineAudioRef.current.src) {
        return;
      }
      try {
        const status = await invoke<PlaybackStatus>('get_playback_status');
        isPlayingRef.current = status.is_playing;
        currentTimeRef.current = status.current_time_secs;
        if (status.duration_secs > 0) durationRef.current = status.duration_secs;
        if (!isTrayModeRef.current) {
          setIsPlaying(status.is_playing);
          setCurrentTime(status.current_time_secs);
          if (status.duration_secs > 0) setDuration(status.duration_secs);
        }

        // Auto-play next track when local audio finishes
        if (
          status.duration_secs > 0 &&
          status.current_time_secs >= (status.duration_secs - 0.5) &&
          !status.is_playing
        ) {
          playStartTimestampRef.current = null;
          accumulatedTimeRef.current = 0;
          handleNext();
        }
      } catch (e) { console.error(e); }
    }, 250);
    return () => clearInterval(interval);
  }, [handleNext]);

  const showNotification = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const clearYtLoadTimers = () => {
    if (ytLoadTimersRef.current.length > 0) {
      ytLoadTimersRef.current.forEach(t => clearTimeout(t));
      ytLoadTimersRef.current = [];
    }
    if (ytUnavailableRetryTimerRef.current) {
      clearTimeout(ytUnavailableRetryTimerRef.current);
      ytUnavailableRetryTimerRef.current = null;
    }
    if (ytUnavailableTimerRef.current) {
      clearTimeout(ytUnavailableTimerRef.current);
      ytUnavailableTimerRef.current = null;
    }
  };

  const extractCleanYtId = (raw: string): string => {
    let vid = (raw || '').trim();
    if (vid.startsWith('youtube_')) vid = vid.slice('youtube_'.length);
    if (vid.startsWith('yt_')) vid = vid.slice('yt_'.length);
    if (vid.includes('v=')) vid = vid.split('v=')[1].split('&')[0];
    if (vid.includes('youtu.be/')) vid = vid.split('youtu.be/')[1].split('?')[0];
    if (vid.includes('/embed/')) vid = vid.split('/embed/')[1].split('?')[0];
    if (vid.includes('/shorts/')) vid = vid.split('/shorts/')[1].split('?')[0];
    return vid.trim();
  };

  const sendYtCmd = (func: string, args: unknown[] = [], channel?: 1 | 2) => {
    const ch = channel ?? activeYtChannelRef.current;
    const target = ch === 1 ? ytIframe1Ref.current : ytIframe2Ref.current;
    if (target?.contentWindow) {
      target.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func, args }), '*'
      );
    }
  };

  const loadOrMountYtChannel = (videoId: string, channel: 1 | 2, volPct: number, forceRemount = false) => {
    clearYtLoadTimers();
    ytLastSwitchAtRef.current = Date.now();

    if (channel === 1) {
      latestYtVideoId1Ref.current = videoId;
      setYtVideoId1(videoId);
    } else {
      latestYtVideoId2Ref.current = videoId;
      setYtVideoId2(videoId);
    }

    const currentSrcId = channel === 1 ? ytIframeSrc1Ref.current : ytIframeSrc2Ref.current;
    const target = channel === 1 ? ytIframe1Ref.current : ytIframe2Ref.current;

    // Force iframe reload/navigation when:
    // 1) First time mounting
    // 2) forceRemount is true (e.g. recovering from a blocked/unavailable video error page)
    // 3) Video has not started playing (e.g. iframe is stuck on YouTube error screen)
    // 4) Video ID is different
    const shouldUpdateSrc = !currentSrcId || forceRemount || !ytHasStartedPlayingRef.current || currentSrcId !== videoId;

    if (shouldUpdateSrc) {
      if (channel === 1) {
        ytIframeSrc1Ref.current = videoId;
        setYtIframeSrc1(videoId);
      } else {
        ytIframeSrc2Ref.current = videoId;
        setYtIframeSrc2(videoId);
      }
      if (target) {
        const newSrc = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&playsinline=1&modestbranding=1&rel=0`;
        if (target.src !== newSrc) {
          target.src = newSrc;
        }
      }
    }

    // Always signal the target iframe if already mounted and listening
    if (target?.contentWindow) {
      target.contentWindow.postMessage(
        JSON.stringify({ event: 'listening', id: channel, channel: 'widget' }), '*'
      );
      sendYtCmd('loadVideoById', [videoId, 0], channel);
      if (volumeRef.current > 0) {
        sendYtCmd('unMute', [], channel);
      } else {
        sendYtCmd('mute', [], channel);
      }
      sendYtCmd('setVolume', [Math.max(0, Math.min(100, Math.round(volPct)))], channel);
      sendYtCmd('playVideo', [], channel);
    }

    [150, 450, 950].forEach((delay) => {
      const tid = setTimeout(() => {
        if (
          activeYtChannelRef.current !== channel ||
          currentTrackRef.current?.source !== 'youtube' ||
          !isPlayingRef.current ||
          ytMusicFallbackActiveRef.current
        ) {
          return;
        }
        const target = channel === 1 ? ytIframe1Ref.current : ytIframe2Ref.current;
        if (target?.contentWindow) {
          target.contentWindow.postMessage(
            JSON.stringify({ event: 'listening', id: channel, channel: 'widget' }), '*'
          );
        }
        if (!crossfadeActiveRef.current) {
          const curVol = volumeRef.current;
          sendYtCmd(curVol === 0 ? 'mute' : 'unMute', [], channel);
          sendYtCmd('setVolume', [Math.round(curVol * 100)], channel);
        }
        if (!ytHasStartedPlayingRef.current) {
          sendYtCmd('playVideo', [], channel);
        }
      }, delay);
      ytLoadTimersRef.current.push(tid);
    });
  };

  const handleYtIframeLoad = (channel: 1 | 2) => {
    try {
      const targetIframe = channel === 1 ? ytIframe1Ref.current : ytIframe2Ref.current;
      targetIframe?.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: channel, channel: 'widget' }), '*'
      );
      if (channel === 1) ytIframeReady1Ref.current = true;
      else ytIframeReady2Ref.current = true;

      const desiredVid = channel === 1 ? latestYtVideoId1Ref.current : latestYtVideoId2Ref.current;
      const mountedSrcVid = channel === 1 ? ytIframeSrc1Ref.current : ytIframeSrc2Ref.current;
      if (!desiredVid || currentTrackRef.current?.source !== 'youtube' || ytMusicFallbackActiveRef.current) {
        sendYtCmd('pauseVideo', [], channel);
        sendYtCmd('stopVideo', [], channel);
        return;
      }
      if (desiredVid !== mountedSrcVid) {
        sendYtCmd('loadVideoById', [desiredVid, 0], channel);
      }
      if (isPlayingRef.current) {
        sendYtCmd('playVideo', [], channel);
        if (!playStartTimestampRef.current) playStartTimestampRef.current = Date.now();
      }
      if (volumeRef.current > 0) {
        sendYtCmd('unMute', [], channel);
      } else {
        sendYtCmd('mute', [], channel);
      }
      if (crossfadeActiveRef.current && activeYtChannelRef.current === channel) {
        sendYtCmd('setVolume', [0], channel);
      } else {
        const curVol = volumeRef.current;
        sendYtCmd('setVolume', [Math.round(curVol * 100)], channel);
      }
    } catch {}
  };

  const handleToggleBackgroundPlay = () => {
    setIsBackgroundPlayEnabled(prev => {
      const next = !prev;
      isBackgroundPlayEnabledRef.current = next;
      try {
        localStorage.setItem('spytify_bg_play_enabled', String(next));
      } catch {}
      if (!next) {
        bgKeepAliveAudioRef.current?.pause();
        showNotification(language === 'vi' ? '🔕 Đã tắt chế độ phát nhạc nền khi tắt màn hình' : '🔕 Background playback disabled');
      } else {
        if (isPlayingRef.current) {
          bgKeepAliveAudioRef.current?.play().catch(() => {});
        }
        showNotification(language === 'vi' ? '🎧 Đã bật chế độ phát nhạc nền khi khóa màn hình' : '🎧 Background playback enabled');
      }
      return next;
    });
  };

  // ─── MOBILE/WEB BACKGROUND PLAY KEEP-ALIVE & SCREEN-LOCK RECOVERY ─────────
  useEffect(() => {
    const keepAlive = new Audio();
    keepAlive.src = createSilentKeepAliveWavUri();
    keepAlive.loop = true;
    keepAlive.volume = 0.01;
    (keepAlive as any).playsInline = true;
    keepAlive.preload = 'auto';
    bgKeepAliveAudioRef.current = keepAlive;

    const handleVisibilityState = () => {
      if (document.hidden) {
        if (userInitiatedPauseRef.current || !isPlayingRef.current) return;
        lastHiddenAtRef.current = Date.now();
        bgKeepAliveAudioRef.current?.play().catch(() => {});

        // On mobile web/iOS, YouTube iframes are killed by WebKit when screen locks.
        // Hand over to direct HTML5 audio stream so background playback continues on lock screen!
        const track = currentTrackRef.current;
        if (track?.source === 'youtube' && !ytMusicFallbackActiveRef.current && onlineAudioRef.current) {
          const rawVid = extractCleanYtId(track.path_or_url || track.id);
          if (rawVid) {
            const streamProxy = `/api/yt-stream?proxy=1&videoId=${encodeURIComponent(rawVid)}`;
            const cur = currentTimeRef.current || 0;
            onlineAudioRef.current.src = streamProxy;
            onlineAudioRef.current.currentTime = cur;
            onlineAudioRef.current.volume = volumeRef.current;
            (onlineAudioRef.current as any).playsInline = true;
            onlineAudioRef.current.setAttribute('playsinline', 'true');
            onlineAudioRef.current.play().then(() => {
              ytMusicFallbackActiveRef.current = true;
              sendYtCmd('pauseVideo', [], activeYtChannelRef.current);
            }).catch(() => {});
          }
        } else if (onlineAudioRef.current && !onlineAudioRef.current.paused) {
          onlineAudioRef.current.play().catch(() => {});
        }
      } else {
        if (onlineAudioRef.current && !onlineAudioRef.current.paused) {
          setCurrentTime(onlineAudioRef.current.currentTime);
          currentTimeRef.current = onlineAudioRef.current.currentTime;
          setIsPlaying(true);
          isPlayingRef.current = true;
        } else if (isPlayingRef.current && !userInitiatedPauseRef.current) {
          if (onlineAudioRef.current && onlineAudioRef.current.src) {
            onlineAudioRef.current.play().catch(() => {});
          } else if (currentTrackRef.current?.source === 'youtube') {
            sendYtCmd('playVideo', [], activeYtChannelRef.current);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityState);
    window.addEventListener('pagehide', handleVisibilityState);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityState);
      window.removeEventListener('pagehide', handleVisibilityState);
      keepAlive.pause();
      keepAlive.src = '';
      bgKeepAliveAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const keepAlive = bgKeepAliveAudioRef.current;
    if (!keepAlive) return;
    if (isPlaying && isBackgroundPlayEnabled) {
      keepAlive.play().catch(() => {});
    } else {
      keepAlive.pause();
    }
  }, [isPlaying, isBackgroundPlayEnabled]);

  // ─── SCREEN WAKE LOCK (Giữ sáng màn hình để iPhone không ngắt iframe YouTube) ──
  const wakeLockRef = useRef<any>(null);

  const requestWakeLock = useCallback(async () => {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        if (!wakeLockRef.current) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          wakeLockRef.current?.addEventListener('release', () => {
            wakeLockRef.current = null;
          });
        }
      } catch {
        wakeLockRef.current = null;
      }
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (isPlaying && isBackgroundPlayEnabled) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
  }, [isPlaying, isBackgroundPlayEnabled, requestWakeLock, releaseWakeLock]);

  useEffect(() => {
    const handleVis = () => {
      if (document.visibilityState === 'visible' && isPlayingRef.current && isBackgroundPlayEnabledRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVis);
    return () => {
      document.removeEventListener('visibilitychange', handleVis);
      releaseWakeLock();
    };
  }, [requestWakeLock, releaseWakeLock]);

  const sendScCmd = (method: string, value?: unknown, channel?: 1 | 2) => {
    const ch = channel ?? activeScChannelRef.current;
    const target = ch === 1 ? scIframe1Ref.current : scIframe2Ref.current;
    if (target?.contentWindow) {
      target.contentWindow.postMessage(
        JSON.stringify({ method, value }), '*'
      );
    }
  };

  // Auto-resolve blocked/unavailable YouTube videos via YouTube Music API (`WEB_REMIX` + `VISIONOS` direct audio stream)
  const fallbackToYoutubeMusicStream = async (track: Track): Promise<boolean> => {
    if (ytMusicFallbackTriedRef.current) return false;
    ytMusicFallbackTriedRef.current = true;

    const rawVid = extractCleanYtId(track.path_or_url || track.id);
    const isWebShim = typeof window !== 'undefined' && Boolean((window as any).__TAURI_WEB_SHIM__);

    try {
      const res = await invoke<{
        stream_url: string | null;
        proxy_url?: string | null;
        resolved_video_id: string;
        duration_secs: number;
      }>('resolve_youtube_music_stream', {
        videoId: rawVid,
        title: track.title,
        artist: track.artist,
      });

      // Ensure user hasn't switched to another track while resolving
      if (currentTrackRef.current?.id !== track.id) return true;

      const streamUrl = (isTauriApp && res.proxy_url) ? res.proxy_url : (res.stream_url || res.proxy_url);
      if (streamUrl && onlineAudioRef.current) {
        if (ytUnavailableTimerRef.current) clearTimeout(ytUnavailableTimerRef.current);
        clearYtLoadTimers();
        sendYtCmd('pauseVideo', [], 1);
        sendYtCmd('pauseVideo', [], 2);
        sendYtCmd('stopVideo', [], 1);
        sendYtCmd('stopVideo', [], 2);
        latestYtVideoId1Ref.current = null;
        latestYtVideoId2Ref.current = null;
        setYtVideoId1(null);
        setYtVideoId2(null);
        setShowYoutubeVideo(false);

        ytMusicFallbackActiveRef.current = true;
        onlineAudioRef.current.pause();
        if (isWebShim) {
          onlineAudioRef.current.removeAttribute('crossorigin');
        } else {
          onlineAudioRef.current.crossOrigin = 'anonymous';
        }
        (onlineAudioRef.current as any).playsInline = true;
        onlineAudioRef.current.setAttribute('playsinline', 'true');
        onlineAudioRef.current.setAttribute('webkit-playsinline', 'true');
        onlineAudioRef.current.src = streamUrl;
        onlineAudioRef.current.volume = volumeRef.current;
        attachAudioElementToEqualizer(onlineAudioRef.current);

        if (res.duration_secs > 0) {
          durationRef.current = res.duration_secs;
          if (!isTrayModeRef.current) setDuration(res.duration_secs);
        }

        try {
          await onlineAudioRef.current.play();
        } catch (playErr) {
          if (res.proxy_url && res.proxy_url !== streamUrl) {
            onlineAudioRef.current.src = res.proxy_url;
            await onlineAudioRef.current.play();
          } else {
            throw playErr;
          }
        }

        ytHasStartedPlayingRef.current = true;
        isPlayingRef.current = true;
        setIsPlaying(true);
        playStartTimestampRef.current = Date.now();
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
        }
        showNotification(`🎵 YouTube Music Hi-Fi: ${track.title}`);
        return true;
      }

      if (res.resolved_video_id && res.resolved_video_id !== rawVid) {
        ytHasStartedPlayingRef.current = false;
        isPlayingRef.current = true;
        setIsPlaying(true);
        loadOrMountYtChannel(res.resolved_video_id, activeYtChannelRef.current, volumeRef.current * 100);
        return true;
      }
    } catch (err) {
      console.warn('[YouTube Music Fallback] Error resolving stream:', err);
    }
    return false;
  };

  // Auto-resolve blocked/unavailable YouTube tracks via Topic/7clouds/Lyric channels or YouTube Music direct audio stream
  const handleYouTubeBlockedOrStalled = async (erroredTrack: Track) => {
    if (currentTrackRef.current?.id !== erroredTrack.id || currentTrackRef.current?.source !== 'youtube') return;
    if (ytUnavailableTimerRef.current) clearTimeout(ytUnavailableTimerRef.current);
    if (ytUnavailableRetryTimerRef.current) clearTimeout(ytUnavailableRetryTimerRef.current);

    console.warn('[YouTube Player] Video stalled or blocked:', erroredTrack.title, erroredTrack.artist);
    const cleanBlocked = extractCleanYtId(erroredTrack.path_or_url || erroredTrack.id);

    // 0. Extract immediate candidates from active search results pool (0ms instant resolution!)
    let candidateVideos: Array<{ videoId: string; title: string; author?: string }> = [];
    if (lastSearchResultsRef.current.length > 0) {
      const cleanT = cleanQueryTerm(erroredTrack.title).toLowerCase();
      candidateVideos = lastSearchResultsRef.current
        .filter(r => {
          const rClean = cleanQueryTerm(r.title).toLowerCase();
          return rClean === cleanT || rClean.includes(cleanT) || cleanT.includes(rClean);
        })
        .map(r => ({
          videoId: extractCleanYtId(r.url_or_id) || r.url_or_id,
          title: r.title,
          author: r.artist,
        }))
        .filter(i => i.videoId && i.videoId !== cleanBlocked);
    }

    // 1. Try finding unblocked video ID via candidate pool, Topic channel, 7clouds, or lyric alternative
    try {
      const unblockedVid = await resolveUnblockedAudioVideoId(
        erroredTrack.title,
        erroredTrack.artist,
        cleanBlocked,
        candidateVideos
      );

      if (currentTrackRef.current?.id !== erroredTrack.id) return;

      if (unblockedVid && unblockedVid !== cleanBlocked) {
        console.log('[YouTube Player] Switched to unblocked video:', unblockedVid);
        ytHasStartedPlayingRef.current = false;
        isPlayingRef.current = true;
        setIsPlaying(true);
        playStartTimestampRef.current = Date.now();
        if (currentTrackRef.current) {
          currentTrackRef.current.path_or_url = unblockedVid;
        }
        setCurrentTrack(prev => prev ? { ...prev, path_or_url: unblockedVid } : prev);
        loadOrMountYtChannel(unblockedVid, activeYtChannelRef.current, volumeRef.current * 100, true);
        showNotification(language === 'vi' ? `▶ Đã đổi sang nguồn phát không bị chặn: ${erroredTrack.title}` : `▶ Switched to unblocked audio stream`);
        return;
      }
    } catch (err) {
      console.warn('[YouTube Player] Error resolving unblocked video:', err);
    }

    // 2. Fallback to direct HTML5 audio stream via YouTube Music API
    try {
      const recovered = await fallbackToYoutubeMusicStream(erroredTrack);
      if (recovered) {
        showNotification(language === 'vi' ? `🎧 Đã chuyển sang luồng âm thanh trực tiếp: ${erroredTrack.title}` : `🎧 Switched to direct audio stream`);
        return;
      }
    } catch (err) {
      console.warn('[YouTube Player] Fallback stream error:', err);
    }

    // 3. If all sources failed and user is still on this track, skip to next track
    if (currentTrackRef.current?.id === erroredTrack.id && !ytHasStartedPlayingRef.current) {
      showNotification(language === 'vi' 
        ? '⚠️ Bài hát này bị chặn bản quyền. Tự động chuyển bài tiếp theo...' 
        : '⚠️ Track is copyright restricted. Skipping to next...');
      setTimeout(() => {
        handleNext();
      }, 1000);
    }
  };
  handleYouTubeBlockedOrStalledRef.current = handleYouTubeBlockedOrStalled;

  const handleToggleYoutubeVideo = () => {
    setShowYoutubeVideo(prev => {
      const next = !prev;
      if (next && currentTrackRef.current?.source === 'youtube') {
        const curCh = activeYtChannelRef.current;
        sendYtCmd('playVideo', [], curCh);
      }
      return next;
    });
  };

  // ─── Core play function ──────────────────────────────────────────────────
  const playTrackInternal = async (rawTrack: Track, isBackOrForward = false, isCrossfade = false) => {
    if (isConnectClientActive) {
      spytifyConnect.sendCommand({ type: 'PLAY_TRACK', track: rawTrack });
      return;
    }
    const isWebShim = typeof window !== 'undefined' && Boolean((window as any).__TAURI_WEB_SHIM__);
    userInitiatedPauseRef.current = false;

    // Mobile / iOS WebKit: Prime audio elements synchronously during user gesture BEFORE any await
    if (isWebShim) {
      try {
        ensureAudioContextRunning();
        if (onlineAudio1Ref.current) {
          (onlineAudio1Ref.current as any).playsInline = true;
          if (!onlineAudio1Ref.current.src) {
            onlineAudio1Ref.current.src = createSilentKeepAliveWavUri();
          }
          onlineAudio1Ref.current.play().catch(() => {});
        }
        if (onlineAudio2Ref.current) {
          (onlineAudio2Ref.current as any).playsInline = true;
          if (!onlineAudio2Ref.current.src) {
            onlineAudio2Ref.current.src = createSilentKeepAliveWavUri();
          }
        }
        if (bgKeepAliveAudioRef.current) {
          (bgKeepAliveAudioRef.current as any).playsInline = true;
          bgKeepAliveAudioRef.current.play().catch(() => {});
        }
      } catch {}
    } else if (isBackgroundPlayEnabledRef.current) {
      bgKeepAliveAudioRef.current?.play().catch(() => {});
    }

    // Desktop only: if this track was downloaded to local disk, switch to offline local track for instant Hi-Fi playback!
    let track = rawTrack;
    let resolvedOfflineBlobUrl: string | null = null;

    if (isWebShim) {
      const candidateIds: string[] = [];
      const addCandidate = (id?: string | null) => {
        if (id && !candidateIds.includes(id)) candidateIds.push(id);
      };
      if (rawTrack.path_or_url?.startsWith('indexeddb://')) {
        addCandidate(rawTrack.path_or_url.slice('indexeddb://'.length));
      }
      addCandidate(rawTrack.id);
      if (rawTrack.id && !rawTrack.id.startsWith('local_')) {
        addCandidate(`local_${rawTrack.id}`);
      } else if (rawTrack.id?.startsWith('local_')) {
        addCandidate(rawTrack.id.slice('local_'.length));
      }
      const normT = (rawTrack.title || '').trim().toLowerCase();
      const normA = (rawTrack.artist || '').trim().toLowerCase();
      const matchedLocalTrack = tracksRef.current.find(
        t =>
          t.source === 'local' &&
          (t.id === rawTrack.id ||
            t.id === `local_${rawTrack.id}` ||
            (normT &&
              t.title.trim().toLowerCase() === normT &&
              (!normA || t.artist.trim().toLowerCase() === normA)))
      );
      if (matchedLocalTrack) {
        if (matchedLocalTrack.path_or_url?.startsWith('indexeddb://')) {
          addCandidate(matchedLocalTrack.path_or_url.slice('indexeddb://'.length));
        }
        addCandidate(matchedLocalTrack.id);
      }

      for (const cid of candidateIds) {
        const blobUrl = await getOfflineAudioBlobUrl(cid);
        if (blobUrl) {
          resolvedOfflineBlobUrl = blobUrl;
          break;
        }
      }

      if (resolvedOfflineBlobUrl) {
        track = {
          ...rawTrack,
          source: 'local',
          path_or_url: resolvedOfflineBlobUrl,
          cover_art: rawTrack.cover_art || matchedLocalTrack?.cover_art || null,
          is_downloaded: true,
        };
      }
    }

    if (!isWebShim && track.source !== 'local') {
      const localMatch = tracks.find(t => 
        t.source === 'local' && t.path_or_url && (
          t.id === rawTrack.id ||
          t.id === `local_${rawTrack.id}` ||
          (t.title && t.title.trim().toLowerCase() === rawTrack.title?.trim().toLowerCase() &&
           t.artist && t.artist.trim().toLowerCase() === rawTrack.artist?.trim().toLowerCase())
        )
      );
      if (localMatch) {
        track = {
          ...localMatch,
          cover_art: rawTrack.cover_art || localMatch.cover_art,
        };
      }
    }

    // Web PWA: không đọc được file ổ cứng local trong Album đồng bộ -> tự động chuyển sang phát trực tuyến online
    if (isWebShim && !resolvedOfflineBlobUrl) {
      const rawPath = (track.path_or_url || '').trim();
      const isValidDirectLocalStream =
        track.source === 'local' &&
        (rawPath.startsWith('blob:') ||
          (rawPath.startsWith('https://') && !rawPath.includes('googlevideo.com')));
      const isIndexedDbMissing = rawPath.startsWith('indexeddb://');
      const isMachineFilePath =
        !rawPath ||
        isIndexedDbMissing ||
        (!rawPath.startsWith('http://') &&
          !rawPath.startsWith('https://') &&
          !rawPath.startsWith('blob:') &&
          (/[a-zA-Z]:[\\/]/.test(rawPath) ||
            rawPath.startsWith('/') ||
            /\.(mp3|flac|wav|m4a|ogg|aac|opus|wma)$/i.test(rawPath)));

      if (!isValidDirectLocalStream && (track.source === 'local' || isMachineFilePath)) {
        const idYtMatch = `${track.id} ${rawPath}`.match(/(?:youtube_|yt_)([A-Za-z0-9_-]{11})(?:$|[^A-Za-z0-9_-])/);
        const directYtId = /^[A-Za-z0-9_-]{11}$/.test(rawPath) ? rawPath : null;
        const extractedVid = idYtMatch?.[1] || directYtId;

        if (extractedVid) {
          track = {
            ...track,
            source: 'youtube',
            path_or_url: extractedVid,
            is_downloaded: false,
          };
        } else {
          const normTitle = (track.title || '').trim().toLowerCase();
          const normArtist = (track.artist || '').trim().toLowerCase();
          const cachedOnline = tracksRef.current.find(
            t =>
              t.source !== 'local' &&
              t.path_or_url &&
              (
                t.id === track.id.replace(/^local_/, '') ||
                (normTitle &&
                  t.title.trim().toLowerCase() === normTitle &&
                  (!normArtist || t.artist.trim().toLowerCase() === normArtist))
              )
          );

          if (cachedOnline) {
            track = {
              ...track,
              source: cachedOnline.source,
              path_or_url: cachedOnline.path_or_url,
              cover_art: track.cover_art || cachedOnline.cover_art,
              duration_secs: track.duration_secs || cachedOnline.duration_secs,
              is_downloaded: false,
            };
          } else {
            currentTrackRef.current = track;
            setCurrentTrack(track);
            showNotification(
              `☁️ ${language === 'vi' ? 'Đang phát trực tuyến:' : 'Streaming online:'} ${track.title}...`
            );
            try {
              const query = `${track.title || ''} ${track.artist || ''}`.trim();
              let results = await invoke<SearchResult[]>('search_online', { query, source: 'youtube' });
              if (!results || results.length === 0) {
                results = await invoke<SearchResult[]>('search_online', { query, source: 'all' });
              }
              if (currentTrackRef.current?.id !== track.id) return;
              if (results && results.length > 0 && results[0].url_or_id) {
                const hit = results[0];
                track = {
                  ...track,
                  source: hit.source,
                  path_or_url: hit.url_or_id,
                  cover_art: track.cover_art || hit.thumbnail,
                  duration_secs: track.duration_secs || hit.duration_secs || 200,
                  is_downloaded: false,
                };
              } else {
                showNotification(
                  language === 'vi'
                    ? '⚠️ Bản Web chưa tìm thấy nguồn trực tuyến cho bài nhạc máy này.'
                    : '⚠️ Could not find an online stream for this local file on Web.'
                );
                return;
              }
            } catch {
              showNotification(
                language === 'vi'
                  ? '⚠️ Không thể phát trực tuyến bài hát này trên bản Web.'
                  : '⚠️ Unable to stream this track on Web.'
              );
              return;
            }
          }
        }
      }
    }

    // Record true previously playing track into playback history stack before switching
    if (!isBackOrForward && currentTrackRef.current && currentTrackRef.current.id !== track.id) {
      playbackHistoryStackRef.current.push(currentTrackRef.current);
      if (playbackHistoryStackRef.current.length > 50) {
        playbackHistoryStackRef.current.shift();
      }
      playbackForwardStackRef.current = [];
    }

    // Track position in active playlist and alternate 'mix' mode (Old Playlist Track <-> New Discovery Track)
    const activeQ = getEffectiveQueue();
    const qIdx = activeQ.findIndex(t => t.id === track.id);
    if (qIdx !== -1) {
      lastPlaylistIndexRef.current = qIdx;
      mixNextIsNewRef.current = true;
    } else {
      mixNextIsNewRef.current = false;
    }

    const previousTrack = currentTrackRef.current;
    currentTrackRef.current = track;
    setCurrentTrack(track);
    currentTimeRef.current = 0;
    setCurrentTime(0);
    ytMusicFallbackActiveRef.current = false;
    ytMusicFallbackTriedRef.current = false;

    // Record into in-memory listened set immediately so candidate promotion never picks the currently playing track
    if (track.title) listenedHistoryTitlesRef.current.add(track.title.trim().toLowerCase());
    if (track.id) listenedHistoryTitlesRef.current.add(track.id.toLowerCase());
    if (track.path_or_url) listenedHistoryTitlesRef.current.add(track.path_or_url.toLowerCase());

    // Record into persistent history for intelligent search suggestions
    try {
      const raw = localStorage.getItem('spytify_played_history');
      const hist: Array<{ title: string; artist: string }> = raw ? JSON.parse(raw) : [];
      const cleanTitle = (track.title || '').trim();
      const cleanArtist = (track.artist || '').trim();
      if (cleanTitle) {
        const filtered = hist.filter(h => h.title.toLowerCase() !== cleanTitle.toLowerCase());
        const updated = [{ title: cleanTitle, artist: cleanArtist }, ...filtered].slice(0, 30);
        localStorage.setItem('spytify_played_history', JSON.stringify(updated));
      }
    } catch {}

    // Immediately promote an existing pre-fetched discovery candidate (0ms delay, no waiting for network!)
    const trackTitleNorm = track.title.trim().toLowerCase();
    const isValidNewCandidate = (c: Track | null): c is Track =>
      Boolean(
        c &&
        c.id !== track.id &&
        c.title.trim().toLowerCase() !== trackTitleNorm &&
        !listenedHistoryTitlesRef.current.has(c.title.trim().toLowerCase()) &&
        !isTrackInUserPlaylists(c.title, c.path_or_url)
      );

    let nextPreloaded: Track | null = null;
    const curArtistNorm = track.artist.trim().toLowerCase();
    if (
      preloadedNextTrackRef.current &&
      isValidNewCandidate(preloadedNextTrackRef.current) &&
      (
        (curArtistNorm && preloadedNextTrackRef.current.artist.trim().toLowerCase() === curArtistNorm) ||
        preloadedNextTrackRef.current.title.trim().toLowerCase() !== trackTitleNorm
      )
    ) {
      nextPreloaded = preloadedNextTrackRef.current;
    } else {
      // Clear stale candidates completely so we never leak unrelated songs into the new track
      nextPreloaded = null;
      preloadedAlternativesRef.current = [];
    }
    preloadedNextTrackRef.current = nextPreloaded;
    setPreloadedNextTrack(nextPreloaded);

    const isLiveTrack = checkIsLiveTrack(track);
    const initialDur = isLiveTrack ? 0 : (track.duration_secs || 0);
    durationRef.current = initialDur;
    setDuration(initialDur);

    // Smart DJ always prepares upcoming tracks for seamless auto-play & immediate popup
    if (nextPreloaded) {
      setIsAiLoadingNext(false);
      if (isNextTrackPopupEnabledRef.current && !isTrayModeRef.current) {
        const immediateData = buildImmediatePopupData();
        if (immediateData) {
          setNextTrackPopup(immediateData);
        }
      }
      if (preloadedAlternativesRef.current.length < 2) {
        fetchUpcomingForTrack(track);
      }
    } else {
      setIsAiLoadingNext(true);
      if (isNextTrackPopupEnabledRef.current && !isTrayModeRef.current) {
        setNextTrackPopup(null);
      }
      fetchUpcomingForTrack(track);
    }

    // Reset Wall-clock timer
    accumulatedTimeRef.current = 0;
    playStartTimestampRef.current = Date.now();

    // Record history to SQLite if logged in
    if (currentUserRef.current) {
      invoke('db_add_history', { userId: currentUserRef.current.id, track }).catch(console.error);
    }

    // Spotify-style crossfade support across all platforms
    const effectiveIsCrossfade = isCrossfade;

    // ──────────────────────────────────────────────────────────────────────────
    // CASE A: NORMAL PLAYBACK (No Crossfade — Direct Switch)
    // ──────────────────────────────────────────────────────────────────────────
    if (!effectiveIsCrossfade) {
      if (crossfadeTimerRef.current) {
        clearInterval(crossfadeTimerRef.current);
        crossfadeTimerRef.current = null;
      }
      crossfadeActiveRef.current = false;
      setIsCrossfading(false);
      isPlayingRef.current = false;
      setIsPlaying(false);

      if (track.source === 'local') {
        if (ytUnavailableTimerRef.current) clearTimeout(ytUnavailableTimerRef.current);
        clearYtLoadTimers();
        sendYtCmd('pauseVideo', [], 1);
        sendYtCmd('stopVideo', [], 1);
        sendYtCmd('pauseVideo', [], 2);
        sendYtCmd('stopVideo', [], 2);
        latestYtVideoId1Ref.current = null;
        latestYtVideoId2Ref.current = null;
        setYtVideoId1(null);
        setYtVideoId2(null);
        setShowYoutubeVideo(false);
        sendScCmd('pause', undefined, 1);
        sendScCmd('pause', undefined, 2);
        setScTrackUrl1(null);
        setScTrackUrl2(null);

        activeAudioChannelRef.current = 1;
        onlineAudioRef.current = onlineAudio1Ref.current;
        onlineAudio2Ref.current?.pause();
        if (onlineAudio2Ref.current) onlineAudio2Ref.current.src = '';

        let playedViaBrowser = false;
        if (onlineAudio1Ref.current) {
          try {
            try { await invoke('stop_track'); } catch {}
            ensureAudioContextRunning();
            const fileUrl = convertFileSrc(track.path_or_url);
            if (isWebShim) {
              onlineAudio1Ref.current.removeAttribute('crossorigin');
            } else {
              onlineAudio1Ref.current.crossOrigin = 'anonymous';
            }
            onlineAudio1Ref.current.src = fileUrl;
            onlineAudio1Ref.current.volume = volumeRef.current;
            await onlineAudio1Ref.current.play();
            isPlayingRef.current = true;
            setIsPlaying(true);
            playedViaBrowser = true;
            showNotification(`▶ ${track.title} - ${track.artist}`);
          } catch (e) {
            try {
              onlineAudio1Ref.current.removeAttribute('crossorigin');
              const fileUrl = convertFileSrc(track.path_or_url);
              onlineAudio1Ref.current.src = fileUrl;
              onlineAudio1Ref.current.volume = volumeRef.current;
              await onlineAudio1Ref.current.play();
              isPlayingRef.current = true;
              setIsPlaying(true);
              playedViaBrowser = true;
              showNotification(`▶ ${track.title} - ${track.artist}`);
            } catch (e2) {
              console.warn('Browser convertFileSrc play failed, fallback to Rodio:', e2);
            }
          }
        }

        if (!playedViaBrowser) {
          try {
            if (onlineAudio1Ref.current) onlineAudio1Ref.current.src = '';
            await invoke('play_track', { track });
            try { await invoke('set_volume', { volume: volumeRef.current }); } catch {}
            isPlayingRef.current = true;
            setIsPlaying(true);
            showNotification(`▶ ${track.title} - ${track.artist}`);
          } catch (err) {
            console.error('Rodio play_track error:', err);
            showNotification(`${getTranslation(language, 'toast.playbackError')}: ${track.title}`);
          }
        }

      } else if (track.source === 'youtube') {
        if (isConnectHostActive) {
          ytMusicFallbackTriedRef.current = false;
          const directOk = await fallbackToYoutubeMusicStream(track);
          if (directOk) return;
        }
        try { invoke('stop_track').catch(() => {}); } catch {}
        sendScCmd('pause', undefined, 1);
        sendScCmd('pause', undefined, 2);
        setScTrackUrl1(null);
        setScTrackUrl2(null);
        onlineAudio1Ref.current?.pause();
        if (onlineAudio1Ref.current) onlineAudio1Ref.current.src = '';
        onlineAudio2Ref.current?.pause();
        if (onlineAudio2Ref.current) onlineAudio2Ref.current.src = '';

        const rawVid = extractCleanYtId(track.path_or_url || track.id);
        const cachedUnblocked = getCachedUnblockedVideoId(track.title, track.artist, rawVid);
        const cached7c = getCached7CloudsVideoId(track.title, track.artist);
        const videoId = cachedUnblocked || cached7c || rawVid;
        if (!cachedUnblocked && !cached7c && track.title) {
          resolve7CloudsVideoId(track.title, track.artist, rawVid).catch(() => {});
        }

        activeYtChannelRef.current = 1;
        sendYtCmd('pauseVideo', [], 2);
        sendYtCmd('stopVideo', [], 2);
        latestYtVideoId2Ref.current = null;
        setYtVideoId2(null);

        const curVol = volumeRef.current;
        ytHasStartedPlayingRef.current = false;
        isPlayingRef.current = true;
        setIsPlaying(true);
        loadOrMountYtChannel(videoId, 1, curVol * 100);
        showNotification(`▶ YouTube Hi-Fi: ${track.title}`);

        if (ytUnavailableTimerRef.current) clearTimeout(ytUnavailableTimerRef.current);
        ytUnavailableRetryTimerRef.current = setTimeout(() => {
          if (
            !ytHasStartedPlayingRef.current &&
            currentTrackRef.current?.source === 'youtube' &&
            currentTrackRef.current?.id === track.id &&
            isPlayingRef.current &&
            !ytMusicFallbackActiveRef.current
          ) {
            const target = ytIframe1Ref.current;
            if (target?.contentWindow) {
              target.contentWindow.postMessage(
                JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'
              );
            }
            const vol = volumeRef.current;
            sendYtCmd(vol === 0 ? 'mute' : 'unMute', [], 1);
            sendYtCmd('setVolume', [Math.round(vol * 100)], 1);
            sendYtCmd('playVideo', [], 1);
          }
        }, 1000);

        const fallbackDelayMs = isWebShim ? 2500 : 1800;
        ytUnavailableTimerRef.current = setTimeout(() => {
          if (
            !ytHasStartedPlayingRef.current &&
            currentTrackRef.current?.source === 'youtube' &&
            currentTrackRef.current?.id === track.id &&
            !ytMusicFallbackActiveRef.current
          ) {
            console.warn('[YouTube Watchdog] Video has not started playing after 1.8s. Triggering recovery...');
            handleYouTubeBlockedOrStalled(currentTrackRef.current);
          }
        }, fallbackDelayMs);

      } else if (track.source === 'soundcloud') {
        if (ytUnavailableTimerRef.current) clearTimeout(ytUnavailableTimerRef.current);
        clearYtLoadTimers();
        try { invoke('stop_track').catch(() => {}); } catch {}
        sendYtCmd('pauseVideo', [], 1);
        sendYtCmd('stopVideo', [], 1);
        sendYtCmd('pauseVideo', [], 2);
        sendYtCmd('stopVideo', [], 2);
        latestYtVideoId1Ref.current = null;
        latestYtVideoId2Ref.current = null;
        setYtVideoId1(null);
        setYtVideoId2(null);
        setShowYoutubeVideo(false);
        onlineAudio1Ref.current?.pause();
        if (onlineAudio1Ref.current) onlineAudio1Ref.current.src = '';
        onlineAudio2Ref.current?.pause();
        if (onlineAudio2Ref.current) onlineAudio2Ref.current.src = '';

        let scUrl = track.path_or_url;
        if (!scUrl || !scUrl.startsWith('http')) {
          showNotification(`${getTranslation(language, 'toast.findingSource')} SoundCloud: ${track.title}...`);
          try {
            const res = await invoke<SearchResult[]>('search_online', { query: `${track.title} ${track.artist}`, source: 'soundcloud' });
            if (res && res.length > 0) {
              scUrl = res[0].url_or_id;
            }
          } catch {}
        }
        if (scUrl) {
          activeScChannelRef.current = 1;
          sendScCmd('pause', undefined, 2);
          setScTrackUrl2(null);
          setScTrackUrl1(scUrl);
          sendScCmd('setVolume', volumeRef.current * 100, 1);
          isPlayingRef.current = true;
          setIsPlaying(true);
          showNotification(`▶ SoundCloud: ${track.title}`);
        } else {
          showNotification(getTranslation(language, 'toast.sourceNotFound'));
        }

      } else if (track.source === 'audius') {
        if (ytUnavailableTimerRef.current) clearTimeout(ytUnavailableTimerRef.current);
        clearYtLoadTimers();
        try { invoke('stop_track').catch(() => {}); } catch {}
        sendYtCmd('pauseVideo', [], 1);
        sendYtCmd('stopVideo', [], 1);
        sendYtCmd('pauseVideo', [], 2);
        sendYtCmd('stopVideo', [], 2);
        latestYtVideoId1Ref.current = null;
        latestYtVideoId2Ref.current = null;
        setYtVideoId1(null);
        setYtVideoId2(null);
        setShowYoutubeVideo(false);
        sendScCmd('pause', undefined, 1);
        sendScCmd('pause', undefined, 2);
        setScTrackUrl1(null);
        setScTrackUrl2(null);

        activeAudioChannelRef.current = 1;
        onlineAudioRef.current = onlineAudio1Ref.current;
        onlineAudio2Ref.current?.pause();
        if (onlineAudio2Ref.current) onlineAudio2Ref.current.src = '';

        let streamUrl = track.path_or_url;
        try {
          if (!streamUrl.includes('/tracks/cidstream/') || streamUrl.includes('audius.co')) {
            const resolved = await invoke<string>('resolve_audius_stream', { urlOrId: streamUrl });
            if (resolved) streamUrl = resolved;
          }
        } catch (e) {
          console.warn('Audius stream resolve error:', e);
        }

        let playedViaBrowser = false;
        if (onlineAudio1Ref.current) {
          try {
            onlineAudio1Ref.current.pause();
            ensureAudioContextRunning();
            if (isWebShim) {
              onlineAudio1Ref.current.removeAttribute('crossorigin');
            } else {
              onlineAudio1Ref.current.crossOrigin = 'anonymous';
            }
            onlineAudio1Ref.current.src = streamUrl;
            onlineAudio1Ref.current.volume = volumeRef.current;
            onlineAudio1Ref.current.load();
            await onlineAudio1Ref.current.play();
            isPlayingRef.current = true;
            setIsPlaying(true);
            playedViaBrowser = true;
            showNotification(`▶ Audius Hi-Fi 320K: ${track.title}`);
          } catch (e) {
            console.warn('Browser Audius play error, trying fallback:', e);
            try {
              const fallback = await invoke<string>('resolve_audius_stream', { urlOrId: track.path_or_url });
              if (fallback && onlineAudio1Ref.current) {
                if (isWebShim) {
                  onlineAudio1Ref.current.removeAttribute('crossorigin');
                } else {
                  onlineAudio1Ref.current.crossOrigin = 'anonymous';
                }
                onlineAudio1Ref.current.src = fallback;
                onlineAudio1Ref.current.load();
                await onlineAudio1Ref.current.play();
                isPlayingRef.current = true;
                setIsPlaying(true);
                playedViaBrowser = true;
                showNotification(`▶ Audius Hi-Fi 320K: ${track.title}`);
              }
            } catch {}
          }
        }

        if (!playedViaBrowser && !isWebShim) {
          try {
            if (onlineAudio1Ref.current) onlineAudio1Ref.current.src = '';
            await invoke('play_track', { track: { ...track, path_or_url: streamUrl } });
            isPlayingRef.current = true;
            setIsPlaying(true);
            playedViaBrowser = true;
            showNotification(`▶ Audius Native 320K: ${track.title}`);
          } catch (rustErr) {
            console.error('Rust native Audius play error:', rustErr);
            showNotification(getTranslation(language, 'toast.audiusError'));
          }
        } else if (!playedViaBrowser) {
          showNotification(getTranslation(language, 'toast.audiusError'));
        }
      }
      return;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CASE B: SPOTIFY-STYLE EQUAL-POWER CROSSFADE OVERLAP
    // ──────────────────────────────────────────────────────────────────────────
    const outSource = previousTrack?.source || 'local';
    const outAudioChannel = activeAudioChannelRef.current;
    const outAudio = outAudioChannel === 1 ? onlineAudio1Ref.current : onlineAudio2Ref.current;
    const outYtChannel = activeYtChannelRef.current;
    const outScChannel = activeScChannelRef.current;
    const outSc = outSource === 'soundcloud';

    const isMobileWeb = typeof window !== 'undefined' && (
      Boolean((window as any).__TAURI_WEB_SHIM__) ||
      window.innerWidth < 768 ||
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    );

    // Pick alternate incoming channels
    const inAudioChannel: 1 | 2 = outAudioChannel === 1 ? 2 : 1;
    const inAudio = inAudioChannel === 1 ? onlineAudio1Ref.current : onlineAudio2Ref.current;
    // On mobile web, browsers (WebKit / Chrome Mobile) enforce a single-audio-element gesture policy.
    // Switching to an unactivated secondary iframe causes Safari to mute it. Keep the same channel on mobile web.
    const inYtChannel: 1 | 2 = (isMobileWeb && outSource === 'youtube') ? outYtChannel : (outYtChannel === 1 ? 2 : 1);
    const inScChannel: 1 | 2 = outScChannel === 1 ? 2 : 1;

    // Toast notification for Spotify Crossfade
    showNotification(`🔀 ${getTranslation(language, 'settings.crossfadingToast', { seconds: crossfadeDurationRef.current })}: ${track.title} - ${track.artist}`);

    // Start incoming track with volume = 0
    if (track.source === 'local') {
      activeAudioChannelRef.current = inAudioChannel;
      onlineAudioRef.current = inAudio;
      if (inAudio) {
        try {
          const fileUrl = convertFileSrc(track.path_or_url);
          if (isWebShim) inAudio.removeAttribute('crossorigin');
          else inAudio.crossOrigin = 'anonymous';
          inAudio.src = fileUrl;
          inAudio.volume = 0;
          await inAudio.play();
          isPlayingRef.current = true;
          setIsPlaying(true);
        } catch (e) {
          console.warn('Crossfade local play error:', e);
        }
      }

    } else if (track.source === 'youtube') {
      activeYtChannelRef.current = inYtChannel;
      const rawVid = extractCleanYtId(track.path_or_url || track.id);
      const cachedUnblocked = getCachedUnblockedVideoId(track.title, track.artist, rawVid);
      const cached7c = getCached7CloudsVideoId(track.title, track.artist);
      const videoId = cachedUnblocked || cached7c || rawVid;
      if (!cachedUnblocked && !cached7c && track.title) {
        resolve7CloudsVideoId(track.title, track.artist, rawVid).catch(() => {});
      }
      ytHasStartedPlayingRef.current = false;
      isPlayingRef.current = true;
      setIsPlaying(true);
      playStartTimestampRef.current = Date.now();
      const initialVolPct = (isMobileWeb && outYtChannel === inYtChannel) ? Math.round(volumeRef.current * 100) : 0;
      loadOrMountYtChannel(videoId, inYtChannel, initialVolPct);

      if (ytUnavailableTimerRef.current) clearTimeout(ytUnavailableTimerRef.current);
      ytUnavailableTimerRef.current = setTimeout(() => {
        if (
          !ytHasStartedPlayingRef.current &&
          currentTrackRef.current?.source === 'youtube' &&
          currentTrackRef.current?.id === track.id &&
          !ytMusicFallbackActiveRef.current
        ) {
          console.warn('[YouTube Crossfade Watchdog] Video has not started playing after 1.8s. Triggering recovery...');
          handleYouTubeBlockedOrStalled(currentTrackRef.current);
        }
      }, 1800);

    } else if (track.source === 'audius') {
      activeAudioChannelRef.current = inAudioChannel;
      onlineAudioRef.current = inAudio;
      let streamUrl = track.path_or_url;
      try {
        if (!streamUrl.includes('/tracks/cidstream/') || streamUrl.includes('audius.co')) {
          const resolved = await invoke<string>('resolve_audius_stream', { urlOrId: streamUrl });
          if (resolved) streamUrl = resolved;
        }
      } catch (e) {
        console.warn('Audius stream resolve error:', e);
      }
      if (inAudio) {
        if (isWebShim) {
          inAudio.removeAttribute('crossorigin');
        } else {
          inAudio.crossOrigin = 'anonymous';
        }
        inAudio.src = streamUrl;
        inAudio.volume = 0;
        inAudio.load();
        inAudio.play().catch(console.warn);
        isPlayingRef.current = true;
        setIsPlaying(true);
      }

    } else if (track.source === 'soundcloud') {
      activeScChannelRef.current = inScChannel;
      let scUrl = track.path_or_url;
      if (scUrl) {
        if (inScChannel === 1) {
          setScTrackUrl1(scUrl);
        } else {
          setScTrackUrl2(scUrl);
        }
        sendScCmd('setVolume', 0, inScChannel);
        isPlayingRef.current = true;
        setIsPlaying(true);
      }
    }

    // Launch Equal-Power Crossfade Fader Loop (50ms interval)
    const durationMs = (isMobileWeb && outYtChannel === inYtChannel)
      ? 1200
      : Math.max(1000, crossfadeDurationRef.current * 1000);
    const startTime = Date.now();
    setIsCrossfading(true);
    crossfadeActiveRef.current = true;

    if (crossfadeTimerRef.current) clearInterval(crossfadeTimerRef.current);
    crossfadeTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const baseVol = volumeRef.current;

      // Equal-power crossfade curve: constant perceived loudness
      const outVol = Math.cos(progress * 0.5 * Math.PI) * baseVol;
      const inVol = Math.sin(progress * 0.5 * Math.PI) * baseVol;

      // Fade out outgoing channel
      if (outYtChannel !== inYtChannel) {
        if (outSource === 'local' || outSource === 'audius' || (outSource === 'youtube' && ytMusicFallbackActiveRef.current)) {
          if (outAudio) outAudio.volume = Math.max(0, Math.min(1, outVol));
        } else if (outSource === 'youtube') {
          sendYtCmd('setVolume', [Math.max(0, Math.min(100, Math.round(outVol * 100)))], outYtChannel);
        } else if (outSc) {
          sendScCmd('setVolume', Math.max(0, Math.min(100, Math.round(outVol * 100))), outScChannel);
        }
      }

      // Fade in incoming channel
      if (track.source === 'local' || track.source === 'audius' || (track.source === 'youtube' && ytMusicFallbackActiveRef.current)) {
        if (inAudio) inAudio.volume = Math.max(0, Math.min(1, inVol));
      } else if (track.source === 'youtube') {
        if (baseVol > 0) {
          sendYtCmd('unMute', [], inYtChannel);
        }
        sendYtCmd('setVolume', [Math.max(0, Math.min(100, Math.round(inVol * 100)))], inYtChannel);
      } else if (track.source === 'soundcloud') {
        sendScCmd('setVolume', Math.max(0, Math.min(100, Math.round(inVol * 100))), inScChannel);
      }

      if (progress >= 1) {
        if (crossfadeTimerRef.current) {
          clearInterval(crossfadeTimerRef.current);
          crossfadeTimerRef.current = null;
        }
        crossfadeActiveRef.current = false;
        setIsCrossfading(false);

        // Stop and clean up outgoing channel completely (only if distinct from incoming)
        if (outYtChannel !== inYtChannel) {
          if (outSource === 'local' || outSource === 'audius' || (outSource === 'youtube' && ytMusicFallbackActiveRef.current)) {
            if (outAudio) {
              outAudio.pause();
              outAudio.src = '';
            }
          } else if (outSource === 'youtube') {
            sendYtCmd('pauseVideo', [], outYtChannel);
            sendYtCmd('stopVideo', [], outYtChannel);
            if (outYtChannel === 1) {
              latestYtVideoId1Ref.current = null;
              setYtVideoId1(null);
            } else {
              latestYtVideoId2Ref.current = null;
              setYtVideoId2(null);
            }
          } else if (outSc) {
            sendScCmd('pause', undefined, outScChannel);
            if (outScChannel === 1) setScTrackUrl1(null);
            else setScTrackUrl2(null);
          }
        }

        // Finalize incoming volume to set volume (use current volumeRef in case user moved slider during crossfade)
        const finalVol = volumeRef.current;
        const finalPct = Math.round(finalVol * 100);
        if (track.source === 'local' || track.source === 'audius' || (track.source === 'youtube' && ytMusicFallbackActiveRef.current)) {
          if (inAudio) inAudio.volume = finalVol;
        } else if (track.source === 'youtube') {
          if (finalVol > 0) {
            sendYtCmd('unMute', [], inYtChannel);
          }
          sendYtCmd('setVolume', [finalPct], inYtChannel);
        } else if (track.source === 'soundcloud') {
          sendScCmd('setVolume', finalPct, inScChannel);
        }
      }
    }, 50);
  };

  const handlePlayTrack = (track: Track, customQueue?: Track[]) => {
    // Nếu bài hát này đang phát, giữ phát liên tục (không reload giật lag hay bắt đầu lại từ 0:00)
    if (currentTrackRef.current?.id === track.id && isPlayingRef.current) {
      if (customQueue && customQueue.length > 0) {
        activeQueueRef.current = customQueue;
        setActiveQueue(customQueue);
      }
      return;
    }
    // Nếu là bài hiện tại nhưng đang tạm dừng, tiếp tục phát tức thì
    if (currentTrackRef.current?.id === track.id && !isPlayingRef.current) {
      handleTogglePlay();
      return;
    }

    if (customQueue && customQueue.length > 0) {
      activeQueueRef.current = customQueue;
      setActiveQueue(customQueue);
      activeQueueContextRef.current = 'albums';
      setActiveQueueContext('albums');
    } else {
      activeQueueContextRef.current = currentView;
      setActiveQueueContext(currentView);
      activeQueueRef.current = displayedTracksRef.current;
      setActiveQueue(displayedTracksRef.current);
    }
    playTrackInternal(track);
  };

  const handleTogglePlay = async () => {
    if (isConnectClientActive) {
      if (connectAudioRef.current && connectAudioRef.current.paused) {
        connectAudioRef.current.play().catch(() => {});
      }
      spytifyConnect.resumeAudio();
      spytifyConnect.sendCommand({ type: isPlayingRef.current ? 'PAUSE' : 'PLAY' });
      return;
    }
    const track = currentTrackRef.current;
    if (!track) return;

    if (isPlayingRef.current) {
      // Transitioning to PAUSE
      userInitiatedPauseRef.current = true;
      bgKeepAliveAudioRef.current?.pause();
      if (playStartTimestampRef.current) {
        accumulatedTimeRef.current += (Date.now() - playStartTimestampRef.current) / 1000;
        playStartTimestampRef.current = null;
      }
      isPlayingRef.current = false;
      setIsPlaying(false);

      if (track.source === 'local') {
        onlineAudioRef.current?.pause();
        try { await invoke('pause_track'); } catch {}
      } else if (track.source === 'youtube') {
        if (ytMusicFallbackActiveRef.current && onlineAudioRef.current?.src) {
          onlineAudioRef.current.pause();
        } else {
          sendYtCmd('pauseVideo');
        }
      } else if (track.source === 'soundcloud') {
        sendScCmd('pause');
      } else {
        onlineAudioRef.current?.pause();
      }

    } else {
      // Transitioning to PLAY
      userInitiatedPauseRef.current = false;
      ensureAudioContextRunning();
      if (isBackgroundPlayEnabledRef.current) {
        bgKeepAliveAudioRef.current?.play().catch(() => {});
      }
      playStartTimestampRef.current = Date.now();
      isPlayingRef.current = true;
      setIsPlaying(true);

      if (track.source === 'local') {
        if (onlineAudioRef.current && onlineAudioRef.current.src && onlineAudioRef.current.src.length > 0) {
          onlineAudioRef.current.play().catch(console.error);
        } else {
          try { await invoke('resume_track'); } catch {}
        }
      } else if (track.source === 'youtube') {
        if (isConnectHostActive && !ytMusicFallbackActiveRef.current) {
          fallbackToYoutubeMusicStream(track).catch(() => {});
        } else if (ytMusicFallbackActiveRef.current && onlineAudioRef.current?.src) {
          onlineAudioRef.current.play().catch(console.error);
        } else {
          sendYtCmd('playVideo');
        }
      } else if (track.source === 'soundcloud') {
        sendScCmd('play');
      } else {
        onlineAudioRef.current?.play().catch(console.error);
      }
    }
  };

  const handlePauseTrack = () => {
    if (isPlayingRef.current) {
      handleTogglePlay();
    }
  };

  const handleTogglePlayRef = useRef(handleTogglePlay);
  handleTogglePlayRef.current = handleTogglePlay;
  const handleUserPrevRef = useRef<() => void>(() => {});

  // ─── SYSTEM TRAY & RAM OPTIMIZER (MỤC 3: GIẢI PHÓNG BỘ NHỚ KHI ẨN / THU NHỎ <= 150MB) ───
  useEffect(() => {
    let unlistenPlay: (() => void) | undefined;
    let unlistenPrev: (() => void) | undefined;
    let unlistenNext: (() => void) | undefined;
    let unlistenState: (() => void) | undefined;

    const enterTrayLowMemoryMode = () => {
      isTrayModeRef.current = true;
      setIsTrayMode(true);
      document.documentElement.classList.add('app-minimized');
      invoke('trim_memory').catch(() => {});
    };

    const exitTrayLowMemoryMode = () => {
      isTrayModeRef.current = false;
      setIsTrayMode(false);
      document.documentElement.classList.remove('app-minimized');
      syncPlaybackStateNow();
    };

    // Lắng nghe sự kiện từ menu System Tray
    listen('tray-toggle-play', () => {
      handleTogglePlayRef.current();
    }).then(fn => { unlistenPlay = fn; });

    listen('tray-prev-track', () => {
      handleUserPrevRef.current();
    }).then(fn => { unlistenPrev = fn; });

    listen('tray-next-track', () => {
      handleNextRef.current(true);
    }).then(fn => { unlistenNext = fn; });

    // Lắng nghe trạng thái cửa sổ từ Tauri backend (minimized / hidden / normal)
    listen<string>('app-window-state', (event) => {
      if (event.payload === 'hidden' || event.payload === 'minimized') {
        enterTrayLowMemoryMode();
      } else {
        exitTrayLowMemoryMode();
      }
    }).then(fn => { unlistenState = fn; });

    return () => {
      if (unlistenPlay) unlistenPlay();
      if (unlistenPrev) unlistenPrev();
      if (unlistenNext) unlistenNext();
      if (unlistenState) unlistenState();
      document.documentElement.classList.remove('app-minimized');
    };
  }, [syncPlaybackStateNow]);

  const handleSeek = async (secs: number) => {
    if (isConnectClientActive) {
      spytifyConnect.resumeAudio();
      spytifyConnect.sendCommand({ type: 'SEEK', time: secs });
      return;
    }
    if (!currentTrack) return;
    // Don't seek on live streams without duration to avoid crashes
    const effDur = duration > 0 ? duration : (currentTrack.duration_secs || 0);
    if (effDur <= 0 && currentTrack.source !== 'local') return;

    setCurrentTime(secs);
    accumulatedTimeRef.current = secs;
    if (isPlayingRef.current) {
      playStartTimestampRef.current = Date.now();
    } else {
      playStartTimestampRef.current = null;
    }

    if (currentTrack?.source === 'local') {
      if (onlineAudioRef.current && onlineAudioRef.current.src) {
        onlineAudioRef.current.currentTime = secs;
      }
      try { await invoke('seek_track', { positionSecs: Math.floor(secs) }); } catch {}
    } else if (currentTrack?.source === 'youtube') {
      if (ytMusicFallbackActiveRef.current && onlineAudioRef.current?.src) {
        onlineAudioRef.current.currentTime = secs;
      } else {
        sendYtCmd('seekTo', [secs, true]);
      }
    } else if (currentTrack?.source === 'soundcloud') {
      sendScCmd('seekTo', secs * 1000);
    } else if (onlineAudioRef.current) {
      onlineAudioRef.current.currentTime = secs;
    }
  };

  const handleVolumeChange = async (v: number) => {
    const clamped = Math.max(0, Math.min(1, isNaN(v) ? 0.8 : v));
    if (isConnectClientActive) {
      spytifyConnect.sendCommand({ type: 'SET_VOLUME', volume: clamped });
    }
    setVolume(clamped);
    volumeRef.current = clamped;
    const volPct = Math.round(clamped * 100);

    try { localStorage.setItem('spytify_volume', String(clamped)); } catch {}
    try { await invoke('set_volume', { volume: clamped }); } catch {}

    const muteCmd = clamped === 0 ? 'mute' : 'unMute';
    sendYtCmd(muteCmd, [], 1);
    sendYtCmd(muteCmd, [], 2);
    sendYtCmd('setVolume', [volPct], 1);
    sendYtCmd('setVolume', [volPct], 2);

    sendScCmd('setVolume', volPct);

    if (onlineAudio1Ref.current) onlineAudio1Ref.current.volume = clamped;
    if (onlineAudio2Ref.current) onlineAudio2Ref.current.volume = clamped;
    if (onlineAudioRef.current) onlineAudioRef.current.volume = clamped;

    window.dispatchEvent(new CustomEvent('spytify-volume-change', { detail: clamped }));
  };

  
  const handleUserNext = () => {
    if (isConnectClientActive) {
      spytifyConnect.resumeAudio();
      spytifyConnect.sendCommand({ type: 'NEXT' });
      return;
    }
    // If the user previously navigated backwards, forward through history first
    if (playbackForwardStackRef.current.length > 0) {
      const cur = currentTrackRef.current;
      if (cur) {
        playbackHistoryStackRef.current.push(cur);
      }
      const nextTrack = playbackForwardStackRef.current.pop()!;
      playTrackInternal(nextTrack, true);
      showNotification(`⏭ ${nextTrack.title} - ${nextTrack.artist}`);
      return;
    }

    // Khi đang trong Album / Playlist cụ thể (Album nghệ sĩ, Album người dùng, Yêu thích, Local):
    // Luôn ưu tiên chuyển bài tiếp theo tuần tự trong chính Album / Playlist đó!
    const isDedicatedPlaylist = isScopedPlaylistContext(activeQueueContextRef.current);
    if (isDedicatedPlaylist) {
      const nextTrack = getNextPlaylistTrack(currentTrackRef.current);
      if (nextTrack) {
        playTrackInternal(nextTrack);
        return;
      }
    }

    // When recommendation mode is active ('fresh' = 100% outside playlist, 'mix' = alternating old & new), follow handleNext
    if (recommendModeRef.current !== 'off') {
      handleNext(true);
      return;
    }

    const nextTrack = getNextPlaylistTrack(currentTrackRef.current);
    if (nextTrack) {
      playTrackInternal(nextTrack);
    }
  };

  const handleUserPrev = () => {
    if (isConnectClientActive) {
      spytifyConnect.resumeAudio();
      spytifyConnect.sendCommand({ type: 'PREV' });
      return;
    }
    const isDedicatedPlaylist = isScopedPlaylistContext(activeQueueContextRef.current);

    if (!isDedicatedPlaylist && playbackHistoryStackRef.current.length > 0) {
      const cur = currentTrackRef.current;
      if (cur) {
        playbackForwardStackRef.current.push(cur);
      }
      const prevTrack = playbackHistoryStackRef.current.pop()!;
      playTrackInternal(prevTrack, true);
      showNotification(`⏮ ${prevTrack.title} - ${prevTrack.artist}`);
      return;
    }

    // Move to previous track in active playlist
    const list = getEffectiveQueue();
    if (!list.length || !currentTrackRef.current) return;
    const curId = currentTrackRef.current.id;
    const idx = list.findIndex(t => t.id === curId);
    const prevIdx = idx > 0 ? idx - 1 : (idx === 0 ? list.length - 1 : 0);
    const prevTrack = list[prevIdx];
    if (prevTrack) {
      playTrackInternal(prevTrack, true);
      showNotification(`⏮ ${prevTrack.title} - ${prevTrack.artist}`);
    }
  };

  const handlePrev = handleUserPrev;
  handleUserPrevRef.current = handleUserPrev;
  const handleUserNextRef = useRef(handleUserNext);
  handleUserNextRef.current = handleUserNext;
  const handleSeekRef = useRef(handleSeek);
  handleSeekRef.current = handleSeek;

  // ─── SPYTIFY CONNECT (Host Broadcaster & Mobile Listener) ──────────────
  // Monitor Host presence for the current user/account
  useEffect(() => {
    const effectiveUserId = currentUser?.id || 'guest_user';
    const unsub = spytifyConnect.monitorHostOnline(effectiveUserId, (online) => {
      setIsHostOnline(online);
    });
    return unsub;
  }, [currentUser?.id]);

  // Broadcast state to LiveKit / Supabase subscribers whenever host playback changes
  useEffect(() => {
    if (!isConnectHostActive) return;
    spytifyConnect.broadcastPlaybackState({
      currentTrack,
      isPlaying,
      currentTime,
      duration,
      volume,
      timestamp: Date.now(),
    });
  }, [isConnectHostActive, currentTrack, isPlaying, duration, volume]);

  const handleToggleConnectHost = useCallback(async () => {
    if (!isTauriApp) {
      showNotification(language === 'vi' ? 'Trạm phát Host chỉ khả dụng trên Spytify Desktop App (Tauri Rust)' : 'Host Broadcaster is only available on Desktop Tauri App');
      return;
    }
    const effectiveUserId = currentUser?.id || localStorage.getItem('spytify_active_user_id') || 'guest_user';
    if (isConnectHostActive) {
      await spytifyConnect.stopHost();
      setIsConnectHostActive(false);
      try { localStorage.setItem('spytify_connect_host_enabled', 'false'); } catch {}
      showNotification(language === 'vi' ? 'Đã tắt trạm phát Spytify Connect' : 'Spytify Connect Broadcaster Stopped');
      return;
    }

    // If Desktop is playing a YouTube track via iframe, switch it to direct stream so Web Audio captures it
    ytMusicFallbackTriedRef.current = false;
    if (currentTrackRef.current?.source === 'youtube' && !ytMusicFallbackActiveRef.current) {
      await fallbackToYoutubeMusicStream(currentTrackRef.current).catch(() => {});
    }

    ensureAudioContextRunning();
    const masterStream = getOrCreateMasterAudioStream();
    const ok = await spytifyConnect.startHost(
      effectiveUserId,
      masterStream,
      (cmd: ConnectCommand) => {
        console.log('[Spytify Connect] Received remote command from mobile:', cmd);
        switch (cmd.type) {
          case 'PLAY':
            if (!isPlayingRef.current) handleTogglePlayRef.current();
            break;
          case 'PAUSE':
            if (isPlayingRef.current) handleTogglePlayRef.current();
            break;
          case 'TOGGLE_PLAY':
            handleTogglePlayRef.current();
            break;
          case 'NEXT':
            handleUserNextRef.current();
            break;
          case 'PREV':
            handleUserPrevRef.current();
            break;
          case 'SEEK':
            handleSeekRef.current(cmd.time);
            break;
          case 'SET_VOLUME':
            handleVolumeChange(cmd.volume);
            break;
          case 'PLAY_TRACK':
            if (cmd.track) playTrackInternal(cmd.track);
            break;
        }
      }
    );

    if (ok) {
      setIsConnectHostActive(true);
      try { localStorage.setItem('spytify_connect_host_enabled', 'true'); } catch {}
      spytifyConnect.broadcastPlaybackState({
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        timestamp: Date.now(),
      });
      showNotification(language === 'vi' ? 'Trạm phát Spytify Connect đã sẵn sàng! Mở Spytify trên iPhone để nghe live' : 'Spytify Connect is live! Connect on iPhone to listen');
    } else {
      showNotification(language === 'vi' ? 'Không thể khởi động Spytify Connect' : 'Failed to start Spytify Connect');
    }
  }, [currentUser?.id, isConnectHostActive, currentTrack, isPlaying, currentTime, duration, volume, language, isTauriApp]);

  const handleToggleConnectClient = useCallback(async () => {
    const effectiveUserId = currentUser?.id || 'guest_user';
    if (isConnectClientActive) {
      await spytifyConnect.disconnectClient();
      setIsConnectClientActive(false);
      showNotification(language === 'vi' ? 'Đã ngắt kết nối với Desktop' : 'Disconnected from Desktop');
      return;
    }

    // Synchronously prime iOS Safari WebKit audio during user tap
    ensureAudioContextRunning();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const dummy = new AudioCtx();
        dummy.resume().catch(() => {});
      }
    } catch {}

    if (!connectAudioRef.current) {
      const el = new Audio();
      (el as any).playsInline = true;
      el.setAttribute('playsinline', 'true');
      el.setAttribute('webkit-playsinline', 'true');
      el.autoplay = true;
      connectAudioRef.current = el;
      if (typeof document !== 'undefined' && document.body) {
        document.body.appendChild(el);
      }
    }
    if (connectAudioRef.current) {
      connectAudioRef.current.muted = false;
      connectAudioRef.current.play().catch(() => {});
    }

    const ok = await spytifyConnect.connectClient(
      effectiveUserId,
      (remoteState: ConnectPlaybackState) => {
        if (remoteState.currentTrack) {
          setCurrentTrack(remoteState.currentTrack);
          currentTrackRef.current = remoteState.currentTrack;
        }
        if (typeof remoteState.isPlaying === 'boolean') {
          setIsPlaying(remoteState.isPlaying);
          isPlayingRef.current = remoteState.isPlaying;
          if (remoteState.isPlaying) {
            spytifyConnect.resumeAudio();
          }
        }
        if (typeof remoteState.currentTime === 'number') {
          setCurrentTime(remoteState.currentTime);
          currentTimeRef.current = remoteState.currentTime;
        }
        if (typeof remoteState.duration === 'number') {
          setDuration(remoteState.duration);
          durationRef.current = remoteState.duration;
        }
        if (typeof remoteState.volume === 'number') {
          setVolume(remoteState.volume);
          volumeRef.current = remoteState.volume;
        }
      },
      connectAudioRef.current || undefined
    );

    if (ok) {
      setIsConnectClientActive(true);
      showNotification(language === 'vi' ? 'Đã kết nối! Đang nghe trực tiếp âm thanh từ Desktop (WebRTC)' : 'Connected! Streaming live master audio from Desktop');
    } else {
      showNotification(language === 'vi' ? 'Không thể kết nối tới Desktop. Hãy chắc chắn Desktop đã bật Host!' : 'Failed to connect. Ensure Desktop host is active!');
    }
  }, [currentUser?.id, isConnectClientActive, language]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !currentTrack) return;
    try {
      const artworkUrl = currentTrack.cover_art
        ? optimizeThumbnailUrl(currentTrack.cover_art, currentTrack.path_or_url || currentTrack.id)
        : spytifyLogo;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: sanitizeTrackTitle(currentTrack.title),
        artist: currentTrack.artist || 'Spytify',
        album: currentTrack.album || 'Spytify Hi-Fi',
        artwork: artworkUrl ? [{ src: artworkUrl, sizes: '512x512', type: 'image/png' }] : [],
      });
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      navigator.mediaSession.setActionHandler('play', async () => {
        userInitiatedPauseRef.current = false;
        isPlayingRef.current = true;
        setIsPlaying(true);
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';

        const track = currentTrackRef.current;
        if (!track) return;

        // 1. If HTML5 audio stream is loaded, resume it directly (iOS WebKit allows this in MediaSession callback!)
        if (onlineAudioRef.current && onlineAudioRef.current.src && onlineAudioRef.current.src !== '') {
          try {
            await onlineAudioRef.current.play();
            return;
          } catch {}
        }

        // 2. On iPhone/mobile web if playing YouTube, hand over to direct audio proxy so sound plays through lock screen
        if (track.source === 'youtube') {
          const vid = extractCleanYtId(track.path_or_url || track.id);
          if (vid && onlineAudioRef.current) {
            try {
              const streamProxy = `/api/yt-stream?proxy=1&videoId=${encodeURIComponent(vid)}`;
              onlineAudioRef.current.src = streamProxy;
              onlineAudioRef.current.currentTime = currentTimeRef.current || 0;
              onlineAudioRef.current.volume = volumeRef.current;
              await onlineAudioRef.current.play();
              ytMusicFallbackActiveRef.current = true;
              return;
            } catch (e) {
              console.warn('[LockScreen] HTML5 audio handover error:', e);
            }
          }
        }

        handleTogglePlayRef.current();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        userInitiatedPauseRef.current = true;
        isPlayingRef.current = false;
        setIsPlaying(false);
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
        if (onlineAudioRef.current) {
          onlineAudioRef.current.pause();
        }
        sendYtCmd('pauseVideo');
        sendScCmd('pause');
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => handleUserPrevRef.current());
      navigator.mediaSession.setActionHandler('nexttrack', () => handleUserNextRef.current());
    } catch {}

    try {
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (typeof details.seekTime === 'number') {
          handleSeekRef.current(details.seekTime);
        }
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const offset = details.seekOffset || 10;
        handleSeekRef.current(Math.max(0, (currentTimeRef.current || 0) - offset));
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const offset = details.seekOffset || 10;
        const maxDur = durationRef.current || currentTrack.duration_secs || 9999;
        handleSeekRef.current(Math.min(maxDur, (currentTimeRef.current || 0) + offset));
      });
    } catch {}

    try {
      if ('setPositionState' in navigator.mediaSession) {
        const effDur = duration > 0 && isFinite(duration) ? duration : (currentTrack.duration_secs || 0);
        if (effDur > 0 && isFinite(effDur)) {
          navigator.mediaSession.setPositionState({
            duration: effDur,
            playbackRate: isPlaying ? 1 : 0,
            position: Math.max(0, Math.min(effDur, currentTimeRef.current || 0)),
          });
        }
      }
    } catch {}
  }, [currentTrack, isPlaying, duration]);

  const handleToggleFavorite = async (trackToFav?: Track) => {
    const target = trackToFav || currentTrack;
    if (!target) return;

    if (currentUser) {
      try {
        const isFav = await invoke<boolean>('db_toggle_favorite', {
          userId: currentUser.id,
          track: target,
        });
        setFavorites(prev => {
          const next = new Set(prev);
          isFav ? next.add(target.id) : next.delete(target.id);
          return next;
        });
        showNotification(isFav ? getTranslation(language, 'toast.favoriteAdded') : getTranslation(language, 'toast.favoriteRemoved'));
      } catch (err) {
        console.error(err);
      }
    } else {
      setFavorites(prev => {
        const next = new Set(prev);
        next.has(target.id) ? next.delete(target.id) : next.add(target.id);
        try { localStorage.setItem('soundify_favorites', JSON.stringify([...next])); } catch {}
        return next;
      });
      showNotification(getTranslation(language, 'toast.favoriteAdded'));
    }
  };

  const handleSelectFolder = async () => {
    try {
      const selected = await open({ directory: true, multiple: false, title: getTranslation(language, 'header.selectFolder') });
      if (selected && typeof selected === 'string') {
        const t0 = performance.now();
        setLocalFolder(selected);
        localStorage.setItem('spytify_local_folder', selected);
        const scanned = await invoke<Track[]>('scan_music_folder', { folderPath: selected });
        const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
        setTracks(prev => {
          return deduplicateTracks([...scanned, ...prev]);
        });
        setCurrentView('local');
        showNotification(getTranslation(language, 'toast.folderScanned', { count: scanned.length, time: elapsed }));
      }
    } catch (err) { showNotification(`Lỗi: ${err}`); }
  };

  const handleDownloadTrack = async (track: Track) => {
    const isWeb = typeof window !== 'undefined' && Boolean((window as any).__TAURI_WEB_SHIM__);
    const alreadyInWebOffline =
      isWeb &&
      tracks.some(
        lt =>
          lt.source === 'local' &&
          (lt.path_or_url?.startsWith('indexeddb://') || lt.path_or_url?.startsWith('blob:')) &&
          (lt.id === track.id ||
            lt.id === `local_${track.id}` ||
            (lt.title.trim().toLowerCase() === track.title.trim().toLowerCase() &&
              lt.artist.trim().toLowerCase() === track.artist.trim().toLowerCase()))
      );
    if ((!isWeb && track.source === 'local') || alreadyInWebOffline) {
      showNotification(getTranslation(language, 'download.alreadyLocal'));
      return;
    }

    if (downloadingTrackIds.has(track.id)) return;

    setDownloadingTrackIds(prev => new Set(prev).add(track.id));
    showNotification(`⏳ ${getTranslation(language, 'download.downloading')}: ${track.title}`);

    try {
      const savedTrack = await invoke<Track>('download_track', {
        track,
        targetDir: downloadFolder || null,
      });

      // Crucial fix: Mark the online track as downloaded in-place so its row in the current table remains intact,
      // and prepend savedTrack so it's instantly visible under "Nhạc trên máy" without breaking track tables!
      setTracks(prev => {
        const updated = prev.map(t => {
          if (
            t.id === track.id ||
            (t.path_or_url && t.path_or_url === track.path_or_url) ||
            (t.title.trim().toLowerCase() === track.title.trim().toLowerCase() &&
             t.artist.trim().toLowerCase() === track.artist.trim().toLowerCase())
          ) {
            return { ...t, is_downloaded: true };
          }
          return t;
        });

        const hasSaved = updated.some(t => t.id === savedTrack.id || (t.path_or_url && t.path_or_url === savedTrack.path_or_url));
        return hasSaved ? updated : [savedTrack, ...updated];
      });

      // Also mark the track as downloaded inside any user albums containing it
      setAlbums(prev => {
        let changed = false;
        const normTitle = track.title.trim().toLowerCase();
        const normArtist = track.artist.trim().toLowerCase();
        const updated = prev.map(album => {
          let albumChanged = false;
          const nextTracks = (album.tracks || []).map(t => {
            if (
              t.id === track.id ||
              t.id === savedTrack.id ||
              (t.path_or_url && (t.path_or_url === track.path_or_url || t.path_or_url === savedTrack.path_or_url)) ||
              (t.title.trim().toLowerCase() === normTitle && t.artist.trim().toLowerCase() === normArtist)
            ) {
              if (!t.is_downloaded) {
                albumChanged = true;
                changed = true;
                return { ...t, is_downloaded: true };
              }
            }
            return t;
          });
          return albumChanged ? { ...album, tracks: nextTracks } : album;
        });
        if (changed) {
          persistAlbumsForUser(currentUserRef.current?.id, updated);
        }
        return changed ? updated : prev;
      });

      // If the online track was in favorites, also add the savedTrack ID to favorites
      if (favorites.has(track.id)) {
        setFavorites(prev => new Set(prev).add(savedTrack.id));
        invoke('db_add_favorite', { trackId: savedTrack.id }).catch(() => {});
      }

      // If this was the playing track, mark it as downloaded without mutating active player stream
      if (
        currentTrackRef.current?.id === track.id ||
        (currentTrackRef.current?.path_or_url && currentTrackRef.current.path_or_url === track.path_or_url) ||
        (currentTrackRef.current?.title.trim().toLowerCase() === track.title.trim().toLowerCase() &&
         currentTrackRef.current?.artist.trim().toLowerCase() === track.artist.trim().toLowerCase())
      ) {
        const updatedCurrent: Track = {
          ...currentTrackRef.current,
          is_downloaded: true,
        };
        currentTrackRef.current = updatedCurrent;
        setCurrentTrack(updatedCurrent);
      }

      showNotification(`✅ ${getTranslation(language, 'download.downloadSuccess', { title: savedTrack.title })}`);
    } catch (err) {
      showNotification(`❌ ${getTranslation(language, 'download.downloadError', { error: String(err) })}`);
    } finally {
      setDownloadingTrackIds(prev => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
    }
  };

  const handleDownloadAlbum = async (album: UserAlbum) => {
    const cleanTracks = deduplicateTracks(album.tracks || []);
    const isWeb = typeof window !== 'undefined' && Boolean((window as any).__TAURI_WEB_SHIM__);
    const localPool = tracks.filter(t => t.source === 'local' || (!isWeb && t.is_downloaded));
    const isAlreadyLocal = (t: Track) => {
      if (!isWeb && (t.source === 'local' || t.is_downloaded)) return true;
      const nTitle = t.title.trim().toLowerCase();
      const nArtist = t.artist.trim().toLowerCase();
      return localPool.some(
        lt =>
          lt.id === t.id ||
          lt.id === `local_${t.id}` ||
          (lt.path_or_url && lt.path_or_url === t.path_or_url) ||
          (lt.title.trim().toLowerCase() === nTitle && lt.artist.trim().toLowerCase() === nArtist)
      );
    };
    const tracksToDownload = cleanTracks.filter(t => !isAlreadyLocal(t));
    if (tracksToDownload.length === 0) {
      // Sync is_downloaded flag on album tracks if needed
      setAlbums(prev => {
        const updated = prev.map(a =>
          a.id === album.id
            ? { ...a, tracks: (a.tracks || []).map(t => ({ ...t, is_downloaded: true })) }
            : a
        );
        persistAlbumsForUser(currentUserRef.current?.id, updated);
        return updated;
      });
      showNotification(language === 'vi' ? 'Toàn bộ bài hát trong album này đã được tải về máy!' : 'All songs in this album are already downloaded!');
      return;
    }

    cancelledAlbumIdsRef.current.delete(album.id);
    setDownloadingAlbumId(album.id);

    showNotification(`⏳ ${language === 'vi' ? `Bắt đầu tải ${tracksToDownload.length} bài hát trong album "${album.title}"...` : `Starting download of ${tracksToDownload.length} tracks in album "${album.title}"...`}`);

    let downloadedCount = 0;
    let wasCancelled = false;

    try {
      for (const track of tracksToDownload) {
        if (cancelledAlbumIdsRef.current.has(album.id)) {
          wasCancelled = true;
          break;
        }
        await handleDownloadTrack(track);
        downloadedCount++;
        if (cancelledAlbumIdsRef.current.has(album.id)) {
          wasCancelled = true;
          break;
        }
      }
    } finally {
      cancelledAlbumIdsRef.current.delete(album.id);
      setDownloadingAlbumId(prev => (prev === album.id ? null : prev));
    }

    if (wasCancelled) {
      showNotification(`🛑 ${language === 'vi' ? `Đã dừng tải album "${album.title}" (${downloadedCount}/${tracksToDownload.length} bài).` : `Stopped downloading album "${album.title}" (${downloadedCount}/${tracksToDownload.length} tracks).`}`);
    } else {
      showNotification(`✅ ${language === 'vi' ? `Hoàn tất tải xuống toàn bộ album "${album.title}"!` : `Successfully downloaded album "${album.title}"!`}`);
    }
  };

  const handleCancelDownloadAlbum = (albumId: string) => {
    cancelledAlbumIdsRef.current.add(albumId);
    setDownloadingAlbumId(prev => (prev === albumId ? null : prev));
    showNotification(language === 'vi' ? '🛑 Đang hủy hàng đợi tải album...' : '🛑 Stopping album download queue...');
  };

  const handleChangeDownloadFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: getTranslation(language, 'download.folderSetting'),
      });
      if (selected && typeof selected === 'string') {
        setDownloadFolder(selected);
        localStorage.setItem('spytify_download_folder', selected);
        showNotification(`📁 Đã đổi thư mục lưu nhạc: ${selected}`);
        try {
          const scanned = await invoke<Track[]>('scan_music_folder', { folderPath: selected });
          if (scanned && scanned.length > 0) {
            setTracks(prev => deduplicateTracks([...scanned, ...prev]));
          }
        } catch {}
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenDownloadFolder = async () => {
    try {
      const target = downloadFolder || (await invoke<string>('get_default_download_directory'));
      await openPath(target);
    } catch (e) {
      showNotification(`Không mở được thư mục: ${e}`);
    }
  };

  const handleSearchOnline = async (query: string, source: string): Promise<SearchResult[]> => {
    try { return await invoke<SearchResult[]>('search_online', { query, source }); }
    catch { return []; }
  };

  const handlePlaySearchResult = (result: SearchResult, allResults?: SearchResult[]) => {
    if (allResults && allResults.length > 0) {
      lastSearchResultsRef.current = allResults;
    }
    const cleaned = result.source === 'youtube'
      ? cleanTrackMetadata(result.title, result.artist)
      : { title: result.title, artist: result.artist };
    const safeUrl = result.url_or_id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const deterministicId = `${result.source}_${safeUrl}`;

    // Prevent duplicate entries by reusing existing track if already in library
    const existing = tracks.find(
      t => t.id === deterministicId ||
           (t.path_or_url && t.path_or_url === result.url_or_id) ||
           (t.title.trim().toLowerCase() === cleaned.title.trim().toLowerCase() &&
            t.artist.trim().toLowerCase() === cleaned.artist.trim().toLowerCase())
    );

    const track: Track = existing || {
      id: deterministicId,
      title: cleaned.title,
      artist: cleaned.artist,
      album: result.album,
      duration_secs: result.duration_secs,
      path_or_url: result.url_or_id,
      cover_art: result.thumbnail,
      source: result.source,
    };

    activeQueueContextRef.current = currentView;
    setActiveQueueContext(currentView);

    // If search or view provided the list of results, preload genuine recommendations instantly
    let queueFromResults: Track[] = [track];
    if (allResults && allResults.length > 1) {
      const allConverted: Track[] = allResults.map(r => {
        const safeUrl = r.url_or_id.replace(/[^a-zA-Z0-9_-]/g, '_');
        const deterministicId = `${r.source}_${safeUrl}`;
        const existing = tracks.find(
          t => t.id === deterministicId ||
               (t.path_or_url && t.path_or_url === r.url_or_id) ||
               (t.title.trim().toLowerCase() === r.title.trim().toLowerCase() &&
                t.artist.trim().toLowerCase() === r.artist.trim().toLowerCase())
        );
        return existing || {
          id: deterministicId,
          title: r.title,
          artist: r.artist,
          album: r.album || 'Top Hits',
          duration_secs: r.duration_secs || 210,
          path_or_url: r.url_or_id,
          cover_art: r.thumbnail,
          source: r.source,
        };
      });

      queueFromResults = allConverted;
      const curIndex = allConverted.findIndex(
        t => t.id === track.id || t.path_or_url === track.path_or_url
      );
      const nextIdx = curIndex >= 0 ? (curIndex + 1) % allConverted.length : 0;
      preloadedNextTrackRef.current = allConverted[nextIdx];
      setPreloadedNextTrack(allConverted[nextIdx]);
      preloadedAlternativesRef.current = allConverted.slice(nextIdx + 1, nextIdx + 6);
    }
    activeQueueRef.current = queueFromResults;
    setActiveQueue(queueFromResults);

    setTracks(prev => {
      const filtered = prev.filter(t => t.id !== track.id && t.path_or_url !== track.path_or_url);
      return [track, ...filtered];
    });
    playTrackInternal(track);
  };

  const handlePlayArtistMix = (mix: ArtistMix, startTrackOrIndex: SearchResult | number = 0) => {
    if (!mix.tracks || mix.tracks.length === 0) return;

    // Chuyển toàn bộ danh sách bài trong Album Mix sang Track[] giữ nguyên 100% thứ tự với videoId sạch sẽ
    const albumTracks: Track[] = mix.tracks.map((r) => {
      const rawId = (r.url_or_id || '').trim();
      let cleanVid = rawId;
      if (cleanVid.includes('watch?v=')) cleanVid = cleanVid.split('watch?v=')[1].split('&')[0];
      if (cleanVid.includes('youtu.be/')) cleanVid = cleanVid.split('youtu.be/')[1].split('?')[0];
      if (cleanVid.startsWith('yt_')) cleanVid = cleanVid.replace('yt_', '');

      const deterministicId = `youtube_${cleanVid.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

      return {
        id: deterministicId,
        title: r.title,
        artist: r.artist,
        album: r.album || mix.title,
        duration_secs: r.duration_secs || 180,
        path_or_url: cleanVid,
        cover_art: r.thumbnail || mix.cover_art,
        source: r.source || 'youtube',
      };
    });

    let targetIndex = 0;
    if (typeof startTrackOrIndex === 'number') {
      targetIndex = Math.max(0, Math.min(startTrackOrIndex, albumTracks.length - 1));
    } else {
      const foundIdx = albumTracks.findIndex(
        t => t.path_or_url === startTrackOrIndex.url_or_id ||
             t.title.trim().toLowerCase() === startTrackOrIndex.title.trim().toLowerCase()
      );
      if (foundIdx !== -1) targetIndex = foundIdx;
    }

    const currentTrackToPlay = albumTracks[targetIndex];

    // Cập nhật thư viện
    setTracks(prev => deduplicateTracks([...albumTracks, ...prev]));

    // Cài đặt hàng đợi chuẩn xác cho Album nghệ sĩ
    activeQueueRef.current = albumTracks;
    setActiveQueue(albumTracks);
    activeQueueContextRef.current = 'artist_mix';
    setActiveQueueContext('artist_mix');

    // Khởi tạo preloaded next track là bài tiếp theo trong album
    const nextIdx = (targetIndex + 1) % albumTracks.length;
    preloadedNextTrackRef.current = albumTracks[nextIdx];
    setPreloadedNextTrack(albumTracks[nextIdx]);
    preloadedAlternativesRef.current = albumTracks.slice(nextIdx + 1, nextIdx + 6);

    playTrackInternal(currentTrackToPlay);
    showNotification(`▶ Đang phát Album Mix: ${mix.title} • Bài ${targetIndex + 1}/${albumTracks.length}`);
  };

  const localCount = tracks.filter(t => t.source === 'local').length;

  return (
    <div className="flex flex-col h-[100dvh] w-screen bg-black text-[#a0a0a0] overflow-hidden select-none font-sans pt-[env(safe-area-inset-top,0px)]">
      {/* iOS Safari Add-to-Home-Screen PWA Banner */}
      {showIosInstallBanner && (
        <div className="md:hidden px-3 py-2 bg-[#12121e] border-b border-white/10 flex items-center justify-between gap-2 text-[11px] z-50 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <img src={spytifyLogo} alt="Spytify" className="w-6 h-6 rounded-lg flex-shrink-0" />
            <p className="text-zinc-200 leading-tight truncate">
              Cài App iPhone: bấm <strong>Chia sẻ (⬆️)</strong> ➔ <strong>Thêm vào MH chính</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowIosInstallBanner(false);
              try {
                localStorage.setItem('spytify_ios_pwa_dismissed', '1');
              } catch {}
            }}
            className="p-1 text-zinc-400 hover:text-white flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Spy Minimalist Discord-style Startup Screen */}
      {!isTrayMode && showSplash && (
        <SplashScreen
          onFinish={() => setShowSplash(false)}
          themeMode={themeMode}
          accentColor={accentColor}
        />
      )}

      {/* ─── NEXT TRACK POPUP (SMOOTH PLAYBACK FLOATING WIDGET) ── */}
      {isNextTrackPopupVisible && (
        <div 
          ref={nextTrackPopupCallbackRef}
          className={`fixed left-2.5 right-2.5 sm:left-auto z-50 p-2.5 sm:p-3.5 rounded-2xl border shadow-2xl flex flex-col gap-2 sm:gap-2.5 transition-all duration-300 max-h-[55vh] sm:max-h-none overflow-y-auto ${
            themeMode === 'light' ? 'bg-white/98' : 'bg-[#0c0c14]/98'
          } ${
            isPlayerBarMinimized
              ? 'bottom-[calc(100px+env(safe-area-inset-bottom,0px))] md:bottom-[34px]'
              : 'bottom-[calc(122px+env(safe-area-inset-bottom,0px))] md:bottom-[58px]'
          } ${
            showYoutubeVideo && currentTrack?.source === 'youtube'
              ? 'sm:right-[344px] lg:right-[384px]'
              : 'sm:right-6 md:right-6'
          } ${
            isNextTrackPopupCollapsed ? 'w-auto sm:w-80' : 'w-auto sm:w-88 max-w-full sm:max-w-[calc(100vw-3rem)]'
          }`}
          style={{
            borderColor: `${activeAccentColor}60`,
            boxShadow: themeMode === 'light'
              ? `0 12px 35px rgba(15, 23, 42, 0.14), 0 0 14px ${activeAccentColor}25`
              : `0 12px 35px rgba(0,0,0,0.8), 0 0 16px ${activeAccentColor}30`
          }}
        >
          {isNextTrackPopupCollapsed && nextTrackPopup ? (
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 overflow-hidden flex-1">
                <span className="text-[10px] font-mono font-bold uppercase flex-shrink-0" style={{ color: activeAccentColor }}>
                  {currentTrack ? `⏭ ${getTranslation(language, 'popup.nextTrack')}:` : 'SMART DJ:'}
                </span>
                <span className="text-xs font-semibold text-white truncate" title={nextTrackPopup.title}>
                  {sanitizeTrackTitle(nextTrackPopup.title)}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => {
                    if ((!currentTrack || shouldNextBeNewDiscovery()) && preloadedNextTrackRef.current) {
                      playTrackInternal(preloadedNextTrackRef.current);
                    } else {
                      handleUserNext();
                    }
                  }}
                  className="p-1 text-[#888] hover:text-white cursor-pointer"
                  title={getTranslation(language, 'popup.playNow')}
                >
                  <Play className="w-3 h-3 fill-current" style={{ color: activeAccentColor }} />
                </button>
                <button
                  onClick={() => setIsNextTrackPopupCollapsed(false)}
                  className="p-1 text-[#888] hover:text-white cursor-pointer"
                  title={getTranslation(language, 'popup.expand')}
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleToggleNextTrackPopupEnabled}
                  className="p-1 text-[#666] hover:text-white cursor-pointer text-xs leading-none"
                  title={getTranslation(language, 'popup.close')}
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (isAiLoadingNext && !nextTrackPopup) ? (
            <div className="flex flex-col gap-2.5 py-1">
              <style>{`
                @keyframes spytifyPopupPulse {
                  0%, 100% { transform: scale(1) translateY(0px); }
                  50% { transform: scale(1.08) translateY(-3px); }
                }
              `}</style>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#1c1c28] pb-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: activeAccentColor }}>
                  <Sparkles className="w-3 h-3 animate-spin" />
                  {getTranslation(language, 'popup.aiAnalyzing')}
                </span>
                <button 
                  onClick={handleToggleNextTrackPopupEnabled}
                  className="text-[#666] hover:text-white transition-colors cursor-pointer text-xs p-1 leading-none"
                  title={getTranslation(language, 'popup.close')}
                >
                  ✕
                </button>
              </div>

              {/* Spy Logo Breathing Glow Box & Analyzing Text */}
              <div className="flex flex-col items-center justify-center py-2.5 select-none">
                <div
                  style={{
                    animation: 'spytifyPopupPulse 1.2s ease-in-out infinite',
                    filter: `drop-shadow(0 4px 16px ${activeAccentColor}80)`,
                  }}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#151520] border border-[#2a2a3e] p-2"
                >
                  <img
                    src={spytifyLogo}
                    alt="Spytify"
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="mt-2 text-xs font-semibold text-white animate-pulse">
                  {getTranslation(language, 'popup.findingRelated')}
                </p>
                <p className="text-[10px] font-mono text-[#888899] mt-0.5 truncate max-w-[220px]">
                  {currentTrack?.title} • {currentTrack?.artist}
                </p>
              </div>

              {/* Shimmer Skeleton Placeholder */}
              <div className="space-y-2 p-2 rounded-xl bg-[#12121a]/60 border border-[#1e1e2c]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#20202e] animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 w-4/5 bg-[#252536] rounded-full animate-pulse" />
                    <div className="h-2 w-2/5 bg-[#1b1b26] rounded-full animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          ) : nextTrackPopup ? (
            <>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#1c1c28] pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: activeAccentColor }}>
                    <span className="animate-pulse">{currentTrack ? '⏭' : '✨'}</span>{' '}
                    {currentTrack ? getTranslation(language, 'popup.nextTrack') : getTranslation(language, 'popup.aiMixRecommend')}
                  </span>
                  {nextTrackPopup.isCountdown && typeof nextTrackPopup.remainingSecs === 'number' && (
                    <span 
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold"
                      style={{ backgroundColor: `${activeAccentColor}25`, color: activeAccentColor }}
                    >
                      {getTranslation(language, 'popup.startsIn')} ~{nextTrackPopup.remainingSecs}s
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setIsNextTrackPopupCollapsed(true)}
                    className="text-[#888] hover:text-white transition-colors cursor-pointer p-1"
                    title={getTranslation(language, 'popup.collapse')}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={handleToggleNextTrackPopupEnabled}
                    className="text-[#666] hover:text-white transition-colors cursor-pointer text-xs p-1 leading-none"
                    title={getTranslation(language, 'popup.close')}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Main Next Track Card */}
              <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#14141c] border border-[#222230]">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#181824] flex-shrink-0 border border-[#2a2a38]">
                  {nextTrackPopup.thumbnail ? (
                    <img 
                      src={optimizeThumbnailUrl(nextTrackPopup.thumbnail)} 
                      alt={nextTrackPopup.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => handleImageError(e, nextTrackPopup.thumbnail)}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#555]">
                      <Music className="w-4 h-4" />
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-bold text-white truncate" title={nextTrackPopup.title}>
                    {sanitizeTrackTitle(nextTrackPopup.title)}
                  </p>
                  <p className="text-[11px] text-[#8e8e9f] truncate">
                    {nextTrackPopup.artist}
                  </p>
                  <span className="text-[9px] font-mono text-[#777] uppercase">
                    {nextTrackPopup.source} • {nextTrackPopup.modeLabel}
                  </span>
                </div>
                <button
                  onClick={() => {
                    if ((!currentTrack || shouldNextBeNewDiscovery()) && preloadedNextTrackRef.current) {
                      playTrackInternal(preloadedNextTrackRef.current);
                    } else {
                      handleUserNext();
                    }
                  }}
                  style={{
                    backgroundColor: activeAccentColor,
                    color: getContrastTextColor(activeAccentColor),
                  }}
                  className="w-8 h-8 rounded-lg hover:scale-105 active:scale-95 transition-transform flex-shrink-0 cursor-pointer shadow-sm flex items-center justify-center border border-white/20"
                  title={getTranslation(language, 'popup.playNow')}
                >
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                </button>
              </div>

              {/* Alternatives / Similar Genre Recommendations */}
              {nextTrackPopup.alternatives && nextTrackPopup.alternatives.length > 0 && (
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold text-[#888899]">
                    <span>{getTranslation(language, 'popup.sameGenre')}</span>
                    <span className="text-[9px] text-[#555]">{getTranslation(language, 'popup.clickToChoose')}</span>
                  </div>
                  <div className="space-y-1 max-h-24 sm:max-h-32 overflow-y-auto pr-0.5">
                    {nextTrackPopup.alternatives.map((alt) => (
                      <div
                        key={alt.id}
                        onClick={() => {
                          playTrackInternal(alt);
                        }}
                        className="p-1.5 rounded-lg bg-[#0e0e16] hover:bg-[#181824] border border-[#1a1a26] hover:border-[#2e2e42] transition-colors flex items-center gap-2 cursor-pointer group"
                      >
                        <div className="w-7 h-7 rounded overflow-hidden bg-[#161620] flex-shrink-0 relative">
                          {alt.cover_art ? (
                            <img 
                              src={optimizeThumbnailUrl(alt.cover_art, alt.path_or_url || alt.id)} 
                              alt={alt.title}
                              referrerPolicy="no-referrer"
                              onError={(e) => handleImageError(e, alt.path_or_url || alt.id)}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#555]">
                              <Music className="w-3 h-3" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-2.5 h-2.5 fill-current text-white" />
                          </div>
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="text-[11px] font-semibold text-white truncate group-hover:text-white" title={alt.title}>
                            {alt.title}
                          </p>
                          <p className="text-[9px] text-[#777] truncate font-mono">
                            {alt.artist} • <span className="uppercase">{alt.source}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
      {/* Toast Notification — Invincible Accent (Hiển thị ngay trên thanh Play) */}
      {!isTrayMode && statusMessage && (
        <div 
          className={`fixed ${
            isPlayerBarMinimized
              ? 'bottom-[calc(96px+env(safe-area-inset-bottom,0px))] md:bottom-[36px]'
              : 'bottom-[calc(116px+env(safe-area-inset-bottom,0px))] md:bottom-[60px]'
          } left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-1.5rem)] px-4 sm:px-5 py-2 sm:py-2.5 rounded-full font-mono text-[11px] sm:text-xs flex items-center gap-2 sm:gap-2.5 transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 border shadow-2xl backdrop-blur-xl whitespace-nowrap pointer-events-none`}
          style={{
            backgroundColor: themeMode === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(14, 14, 20, 0.95)',
            color: themeMode === 'light' ? '#0f172a' : '#ffffff',
            borderColor: `${activeAccentColor}80`,
            boxShadow: themeMode === 'light' 
              ? `0 10px 30px rgba(0,0,0,0.15), 0 0 16px ${activeAccentColor}40` 
              : `0 10px 35px rgba(0,0,0,0.8), 0 0 20px ${activeAccentColor}50`
          }}
        >
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 animate-pulse" style={{ color: activeAccentColor }} />
          <span className="font-bold tracking-wide truncate" style={{ color: themeMode === 'light' ? '#0f172a' : '#ffffff' }}>
            {statusMessage}
          </span>
        </div>
      )}

      {!isTrayMode && (
        <>
          <AddToAlbumModal
            isOpen={isAddToAlbumModalOpen}
            onClose={() => {
              setIsAddToAlbumModalOpen(false);
              setTrackToAddToAlbum(null);
            }}
            trackToAdd={trackToAddToAlbum}
            albums={albums}
            onAddTrackToAlbum={handleAddTrackToAlbum}
            onCreateAlbum={handleCreateAlbum}
            language={language}
            accentColor={activeAccentColor}
          />

          {/* Create Custom Album from Selected Downloaded Tracks Modal */}
          <CreateAlbumFromSelectionModal
            isOpen={isCreateAlbumFromSelectionOpen}
            onClose={() => setIsCreateAlbumFromSelectionOpen(false)}
            availableTracks={tracks.filter(t => t.source === 'local')}
            onCreateAlbum={handleCreateAlbumWithSelectedTracks}
            language={language}
            accentColor={activeAccentColor}
          />

          {/* Auth Modal */}
          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
            onSuccess={handleLoginSuccess}
            language={language}
          />

          {/* Software Update Modal (Desktop only — Web stays in sync via GitHub/Vercel) */}
          {updateInfo && !(typeof window !== 'undefined' && (window as any).__TAURI_WEB_SHIM__) && (
            <UpdateModal
              isOpen={isUpdateModalOpen}
              updateInfo={updateInfo}
              accentColor={accentColor}
              isMandatory={isMandatoryUpdate}
              onClose={() => {
                if (!isMandatoryUpdate) {
                  setIsUpdateModalOpen(false);
                }
              }}
            />
          )}

          {/* Audio Equalizer (EQ) Modal */}
          <EqualizerModal
            isOpen={isEqualizerOpen}
            onClose={() => {
              setIsEqualizerOpen(false);
              setIsEqualizerActive(loadEqualizerState().enabled);
            }}
            currentTrack={currentTrack}
            accentColor={activeAccentColor}
            themeMode={themeMode}
            language={language}
            crossfadeDuration={crossfadeDuration}
            onUpdateCrossfadeDuration={setCrossfadeDuration}
            showVisualizer={showVisualizer}
            onToggleVisualizer={() => setShowVisualizer(p => !p)}
          />
        </>
      )}

      {/* YouTube iframe Channel 1 — mounts over mobile cover art slot or desktop cinema theater */}
      {ytIframeSrc1 && (
        <div
          className={
            currentTrack?.source === 'youtube' && activeYtChannelRef.current === 1
              ? (isMobilePlayerOpen
                  ? `fixed rounded-3xl overflow-hidden bg-black shadow-[0_20px_60px_rgba(0,0,0,0.95)] border border-white/20 transition-all duration-300 ${
                      showYoutubeVideo ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-100'
                    }`
                  : (showYoutubeVideo
                      ? 'max-md:fixed max-md:bottom-[68px] max-md:left-3 max-md:w-12 max-md:h-12 max-md:rounded-lg max-md:overflow-hidden max-md:pointer-events-none max-md:z-0 max-md:opacity-100 md:fixed md:bottom-[var(--desktop-yt-bottom,58px)] md:right-4 md:sm:right-6 md:z-40 md:w-[300px] md:sm:w-[320px] md:lg:w-[360px] md:h-[169px] md:sm:h-[180px] md:lg:h-[202px] md:min-h-[160px] md:aspect-video md:rounded-2xl md:overflow-hidden md:bg-black md:shadow-[0_20px_50px_rgba(0,0,0,0.95)] md:border md:border-white/20 md:ring-1 md:ring-white/10 md:pointer-events-auto md:opacity-100 md:transition-all md:duration-300 md:group/mv'
                      : 'max-md:fixed max-md:bottom-[68px] max-md:left-3 max-md:w-12 max-md:h-12 max-md:rounded-lg max-md:overflow-hidden max-md:pointer-events-none max-md:z-0 max-md:opacity-100 md:fixed md:top-0 md:-left-[9999px] md:w-[320px] md:h-[180px] md:overflow-hidden md:opacity-0 md:pointer-events-none'
                    ))
              : 'fixed top-0 -left-[9999px] w-[320px] h-[180px] overflow-hidden opacity-0 pointer-events-none'
          }
          style={
            currentTrack?.source === 'youtube' && activeYtChannelRef.current === 1 && isMobilePlayerOpen
              ? (mobileMvRect
                  ? {
                      top: `${mobileMvRect.top}px`,
                      left: `${mobileMvRect.left}px`,
                      width: `${mobileMvRect.width}px`,
                      height: `${mobileMvRect.height}px`,
                      zIndex: showYoutubeVideo ? 95 : 91,
                    }
                  : {
                      top: '16vh',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 'min(92vw, 400px)',
                      aspectRatio: showYoutubeVideo ? '16/9' : '1/1',
                      zIndex: showYoutubeVideo ? 95 : 91,
                    })
              : ({
                  '--desktop-yt-bottom': `${desktopYtBottom}px`,
                } as React.CSSProperties)
          }
        >
          {/* Mobile Cover Art Overlay in "Ảnh bìa" mode */}
          {!showYoutubeVideo && isMobilePlayerOpen && currentTrack?.source === 'youtube' && activeYtChannelRef.current === 1 && (
            <div className="absolute inset-0 z-20 bg-black flex items-center justify-center pointer-events-none select-none rounded-3xl overflow-hidden">
              {currentTrack?.cover_art ? (
                <img
                  src={optimizeThumbnailUrl(currentTrack.cover_art, currentTrack.path_or_url || currentTrack.id)}
                  alt={currentTrack.title}
                  referrerPolicy="no-referrer"
                  onError={(e) => handleImageError(e, currentTrack.path_or_url || currentTrack.id)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Music className="w-16 h-16 text-zinc-600" />
              )}
            </div>
          )}

          {/* Desktop Floating Header Bar (Overlay) */}
          {!isMobilePlayerOpen && Boolean(showYoutubeVideo && currentTrack?.source === 'youtube' && activeYtChannelRef.current === 1) && (
            <div className="hidden md:flex absolute top-0 inset-x-0 px-3 py-1.5 bg-black/85 backdrop-blur-md border-b border-white/10 items-center justify-between z-10 transition-opacity pointer-events-auto shadow-md">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse flex-shrink-0" />
                <span className="text-[11px] font-bold text-white truncate drop-shadow">
                  {currentTrack?.title} • {currentTrack?.artist}
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggleYoutubeVideo}
                className="p-1 rounded-full bg-white/10 hover:bg-white/25 text-white/90 hover:text-white transition-colors cursor-pointer border border-white/10"
                title={language === 'vi' ? 'Thu nhỏ MV' : 'Minimize MV'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <iframe
            key={ytIframeSrc1}
            ref={ytIframe1Ref}
            src={`https://www.youtube.com/embed/${ytIframeSrc1}?enablejsapi=1&autoplay=1&playsinline=1&modestbranding=1&rel=0`}
            onLoad={() => handleYtIframeLoad(1)}
            title="YouTube Player 1"
            className="w-full h-full border-0 object-cover"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {/* YouTube iframe Channel 2 — mounts over mobile cover art slot or desktop cinema theater */}
      {ytIframeSrc2 && (
        <div
          className={
            currentTrack?.source === 'youtube' && activeYtChannelRef.current === 2
              ? (isMobilePlayerOpen
                  ? `fixed rounded-3xl overflow-hidden bg-black shadow-[0_20px_60px_rgba(0,0,0,0.95)] border border-white/20 transition-all duration-300 ${
                      showYoutubeVideo ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-100'
                    }`
                  : (showYoutubeVideo
                      ? 'max-md:fixed max-md:bottom-[68px] max-md:left-3 max-md:w-12 max-md:h-12 max-md:rounded-lg max-md:overflow-hidden max-md:pointer-events-none max-md:z-0 max-md:opacity-100 md:fixed md:bottom-[var(--desktop-yt-bottom,58px)] md:right-4 md:sm:right-6 md:z-40 md:w-[300px] md:sm:w-[320px] md:lg:w-[360px] md:h-[169px] md:sm:h-[180px] md:lg:h-[202px] md:min-h-[160px] md:aspect-video md:rounded-2xl md:overflow-hidden md:bg-black md:shadow-[0_20px_50px_rgba(0,0,0,0.95)] md:border md:border-white/20 md:ring-1 md:ring-white/10 md:pointer-events-auto md:opacity-100 md:transition-all md:duration-300 md:group/mv'
                      : 'max-md:fixed max-md:bottom-[68px] max-md:left-3 max-md:w-12 max-md:h-12 max-md:rounded-lg max-md:overflow-hidden max-md:pointer-events-none max-md:z-0 max-md:opacity-100 md:fixed md:top-0 md:-left-[9999px] md:w-[320px] md:h-[180px] md:overflow-hidden md:opacity-0 md:pointer-events-none'
                    ))
              : 'fixed top-0 -left-[9999px] w-[320px] h-[180px] overflow-hidden opacity-0 pointer-events-none'
          }
          style={
            currentTrack?.source === 'youtube' && activeYtChannelRef.current === 2 && isMobilePlayerOpen
              ? (mobileMvRect
                  ? {
                      top: `${mobileMvRect.top}px`,
                      left: `${mobileMvRect.left}px`,
                      width: `${mobileMvRect.width}px`,
                      height: `${mobileMvRect.height}px`,
                      zIndex: showYoutubeVideo ? 95 : 91,
                    }
                  : {
                      top: '16vh',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 'min(92vw, 400px)',
                      aspectRatio: showYoutubeVideo ? '16/9' : '1/1',
                      zIndex: showYoutubeVideo ? 95 : 91,
                    })
              : ({
                  '--desktop-yt-bottom': `${desktopYtBottom}px`,
                } as React.CSSProperties)
          }
        >
          {/* Mobile Cover Art Overlay in "Ảnh bìa" mode */}
          {!showYoutubeVideo && isMobilePlayerOpen && currentTrack?.source === 'youtube' && activeYtChannelRef.current === 2 && (
            <div className="absolute inset-0 z-20 bg-black flex items-center justify-center pointer-events-none select-none rounded-3xl overflow-hidden">
              {currentTrack?.cover_art ? (
                <img
                  src={optimizeThumbnailUrl(currentTrack.cover_art, currentTrack.path_or_url || currentTrack.id)}
                  alt={currentTrack.title}
                  referrerPolicy="no-referrer"
                  onError={(e) => handleImageError(e, currentTrack.path_or_url || currentTrack.id)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Music className="w-16 h-16 text-zinc-600" />
              )}
            </div>
          )}

          {/* Desktop Floating Header Bar (Overlay) */}
          {!isMobilePlayerOpen && Boolean(showYoutubeVideo && currentTrack?.source === 'youtube' && activeYtChannelRef.current === 2) && (
            <div className="hidden md:flex absolute top-0 inset-x-0 px-3 py-1.5 bg-black/85 backdrop-blur-md border-b border-white/10 items-center justify-between z-10 transition-opacity pointer-events-auto shadow-md">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse flex-shrink-0" />
                <span className="text-[11px] font-bold text-white truncate drop-shadow">
                  {currentTrack?.title} • {currentTrack?.artist}
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggleYoutubeVideo}
                className="p-1 rounded-full bg-white/10 hover:bg-white/25 text-white/90 hover:text-white transition-colors cursor-pointer border border-white/10"
                title={language === 'vi' ? 'Thu nhỏ MV' : 'Minimize MV'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <iframe
            key={ytIframeSrc2}
            ref={ytIframe2Ref}
            src={`https://www.youtube.com/embed/${ytIframeSrc2}?enablejsapi=1&autoplay=1&playsinline=1&modestbranding=1&rel=0`}
            onLoad={() => handleYtIframeLoad(2)}
            title="YouTube Player 2"
            className="w-full h-full border-0 object-cover"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {/* SoundCloud Widget 1 — hidden player */}
      {scTrackUrl1 && (
        <div className="fixed -top-1 -left-1 w-1 h-1 overflow-hidden opacity-0 pointer-events-none">
          <iframe
            key={scTrackUrl1}
            ref={scIframe1Ref}
            src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(scTrackUrl1)}&auto_play=true&hide_related=true&show_artwork=false&show_user=false&show_reposts=false&visual=false&color=%2300e5ff`}
            onLoad={() => {
              try {
                sendScCmd('addEventListener', 'play', 1);
                sendScCmd('addEventListener', 'pause', 1);
                sendScCmd('addEventListener', 'finish', 1);
                sendScCmd('addEventListener', 'playProgress', 1);
                sendScCmd('addEventListener', 'seek', 1);
                if (!crossfadeActiveRef.current) {
                  sendScCmd('setVolume', volumeRef.current * 100, 1);
                } else if (activeScChannelRef.current === 1) {
                  sendScCmd('setVolume', 0, 1);
                }
              } catch {}
            }}
            title="SoundCloud Player 1"
            className="w-full h-full border-0"
            allow="autoplay"
          />
        </div>
      )}

      {/* SoundCloud Widget 2 — hidden player */}
      {scTrackUrl2 && (
        <div className="fixed -top-1 -left-1 w-1 h-1 overflow-hidden opacity-0 pointer-events-none">
          <iframe
            key={scTrackUrl2}
            ref={scIframe2Ref}
            src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(scTrackUrl2)}&auto_play=true&hide_related=true&show_artwork=false&show_user=false&show_reposts=false&visual=false&color=%2300e5ff`}
            onLoad={() => {
              try {
                sendScCmd('addEventListener', 'play', 2);
                sendScCmd('addEventListener', 'pause', 2);
                sendScCmd('addEventListener', 'finish', 2);
                sendScCmd('addEventListener', 'playProgress', 2);
                sendScCmd('addEventListener', 'seek', 2);
                if (!crossfadeActiveRef.current) {
                  sendScCmd('setVolume', volumeRef.current * 100, 2);
                } else if (activeScChannelRef.current === 2) {
                  sendScCmd('setVolume', 0, 2);
                }
              } catch {}
            }}
            title="SoundCloud Player 2"
            className="w-full h-full border-0"
            allow="autoplay"
          />
        </div>
      )}

      {/* Main Layout (Persistently mounted to keep WebRTC, Screen Share, Audio & Radio Bots alive) */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex h-full flex-shrink-0">
          <Sidebar
            currentView={currentView}
            onViewChange={setCurrentView}
            onSelectFolder={handleSelectFolder}
            localTrackCount={localCount}
            favoritesCount={favorites.size}
            albumCount={albums.length}
            currentUser={currentUser}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            accentColor={activeAccentColor}
            themeMode={themeMode}
            language={language}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={toggleSidebarCollapse}
          />
        </div>

        {/* Mobile Sidebar Drawer */}
        {isMobileSidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex"
            onClick={() => setIsMobileSidebarOpen(false)}
          >
            <div className="h-full flex pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]" onClick={(e) => e.stopPropagation()}>
              <Sidebar
                currentView={currentView}
                onViewChange={(view) => {
                  setCurrentView(view);
                  setIsMobileSidebarOpen(false);
                }}
                onSelectFolder={() => {
                  handleSelectFolder();
                  setIsMobileSidebarOpen(false);
                }}
                localTrackCount={localCount}
                favoritesCount={favorites.size}
                albumCount={albums.length}
                currentUser={currentUser}
                onOpenAuth={() => {
                  setIsAuthModalOpen(true);
                  setIsMobileSidebarOpen(false);
                }}
                accentColor={activeAccentColor}
                themeMode={themeMode}
                language={language}
                isCollapsed={false}
              />
            </div>
          </div>
        )}

        <main className="flex-1 flex flex-col overflow-hidden bg-[#000000] min-w-0">
          {/* Admin Realtime Broadcast Banner */}
          {remoteBroadcast && !isBroadcastDismissed && (
            <div
              className={`px-4 py-2 text-xs flex items-center justify-between border-b transition-all z-50 animate-fadeIn ${
                remoteBroadcast.type === 'alert'
                  ? 'bg-rose-950/80 text-rose-200 border-rose-500/40'
                  : remoteBroadcast.type === 'warning'
                  ? 'bg-amber-950/80 text-amber-200 border-amber-500/40'
                  : remoteBroadcast.type === 'update'
                  ? 'bg-purple-950/80 text-purple-200 border-purple-500/40'
                  : 'bg-cyan-950/80 text-cyan-200 border-cyan-500/40'
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden truncate">
                <span className="font-bold shrink-0">{remoteBroadcast.title}:</span>
                <span className="truncate opacity-90">{remoteBroadcast.content}</span>
                {remoteBroadcast.actionUrl && (
                  <a
                    href={remoteBroadcast.actionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline font-bold shrink-0 hover:text-white ml-1"
                  >
                    Xem ngay &rarr;
                  </a>
                )}
              </div>
              <button
                onClick={() => {
                  setIsBroadcastDismissed(true);
                  if (remoteBroadcast?.id) {
                    localStorage.setItem(`spytify_dismissed_broadcast_${remoteBroadcast.id}`, 'true');
                  }
                }}
                className="p-1 hover:opacity-100 opacity-70 cursor-pointer ml-3 shrink-0"
                title="Đóng thông báo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Header Bar — Minimalist (Chỉ hiển thị trên Desktop, trên Mobile tiết kiệm tối đa không gian vì đã có thanh điều hướng ở dưới) */}
          <header className="hidden md:flex h-12 px-3 sm:px-6 items-center justify-between border-b border-[#141416] bg-black/95 z-40">
            <div className="flex items-center gap-2 text-xs font-medium text-[#888]">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#666] truncate">
                {currentView === 'community'
                  ? getTranslation(language, 'nav.community').toUpperCase()
                  : currentView === 'search'
                  ? getTranslation(language, 'nav.search').toUpperCase()
                  : currentView === 'albums'
                  ? getTranslation(language, 'nav.myAlbums').toUpperCase()
                  : currentView === 'ai_mix'
                  ? getTranslation(language, 'nav.aiMix').toUpperCase()
                  : currentView === 'profile'
                  ? getTranslation(language, 'nav.account').toUpperCase()
                  : currentView === 'youtube'
                  ? 'YOUTUBE MUSIC'
                  : currentView === 'soundcloud'
                  ? 'SOUNDCLOUD'
                  : currentView === 'audius'
                  ? 'AUDIUS HI-FI'
                  : currentView === 'local'
                  ? getTranslation(language, 'nav.localMusic').toUpperCase()
                  : currentView === 'favorites'
                  ? getTranslation(language, 'nav.favorites').toUpperCase()
                  : getTranslation(language, 'nav.trending').toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2.5">

              {/* Spytify Vercel Website Button (Desktop) */}
              <button
                type="button"
                onClick={() => openWebsite()}
                title="Mở trang web giới thiệu Spytify (Vercel) trên trình duyệt"
                className={`hidden md:flex px-2.5 py-1 text-xs font-medium rounded-md border transition-all items-center gap-1.5 cursor-pointer hover:scale-105 shadow-sm ${
                  themeMode === 'light'
                    ? 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-300'
                    : 'bg-[#101018] hover:bg-[#181824] text-white border-[#222230] hover:border-cyan-500/50'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-semibold text-[11px] hidden sm:inline">
                  {getTranslation(language, 'website.headerBtn')}
                </span>
                <ArrowUpRight className="w-3 h-3 text-cyan-400/80" />
              </button>

              {/* Quick Language Switcher Dropdown (Desktop) */}
              <div className="hidden md:block relative" ref={langDropdownRef}>
                <button
                  onClick={() => setShowLanguageDropdown(p => !p)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors flex items-center gap-1.5 cursor-pointer ${
                    themeMode === 'light'
                      ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-sm'
                      : 'bg-[#121212] hover:bg-[#1c1c1c] text-white border-[#222]'
                  }`}
                  title={getTranslation(language, 'header.language')}
                >
                  <Globe className="w-3.5 h-3.5" style={{ color: activeAccentColor }} />
                  <span className="font-mono text-[11px] font-bold tracking-wider">
                    {SUPPORTED_LANGUAGES.find(l => l.code === language)?.tag || 'VN'}
                  </span>
                </button>

                {showLanguageDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 bg-transparent" 
                      onClick={() => setShowLanguageDropdown(false)} 
                    />
                    <div
                      className={`absolute right-0 top-full mt-2 w-52 py-1.5 rounded-xl border z-50 text-xs font-sans ${
                        themeMode === 'light'
                          ? 'bg-white text-slate-900 border-slate-200 shadow-xl'
                          : 'bg-[#0e0e14] text-white border-[#222230] shadow-2xl'
                      }`}
                      style={{
                        borderColor: `${activeAccentColor}50`,
                        boxShadow: themeMode === 'light'
                          ? `0 12px 28px rgba(0,0,0,0.12), 0 0 12px ${activeAccentColor}20`
                          : `0 16px 36px rgba(0,0,0,0.9), 0 0 16px ${activeAccentColor}25`
                      }}
                    >
                      <div className={`px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider border-b mb-1 flex items-center justify-between ${
                        themeMode === 'light' ? 'text-slate-400 border-slate-100' : 'text-[#666] border-[#1c1c28]'
                      }`}>
                        <span className="flex items-center gap-1.5" style={{ color: activeAccentColor }}>
                          <Languages className="w-3.5 h-3.5" />
                          {getTranslation(language, 'header.language')}
                        </span>
                        <span className={`text-[9px] font-mono ${themeMode === 'light' ? 'text-slate-400' : 'text-[#555]'}`}>
                          {SUPPORTED_LANGUAGES.length}
                        </span>
                      </div>
                      {SUPPORTED_LANGUAGES.map((l) => {
                        const isSel = l.code === language;
                        return (
                          <button
                            key={l.code}
                            onClick={() => {
                              handleUpdateLanguage(l.code);
                              setShowLanguageDropdown(false);
                            }}
                            className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors cursor-pointer ${
                              themeMode === 'light'
                                ? isSel 
                                  ? 'bg-slate-100 font-semibold text-slate-900' 
                                  : 'text-slate-700 hover:bg-slate-50'
                                : isSel 
                                  ? 'bg-[#181824] font-semibold text-white' 
                                  : 'text-[#bbb] hover:bg-[#181824]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span 
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border flex-shrink-0 ${
                                  isSel
                                    ? ''
                                    : themeMode === 'light'
                                    ? 'bg-slate-100 text-slate-700 border-slate-200'
                                    : 'bg-[#181822] text-[#ccc] border-[#262636]'
                                }`}
                                style={isSel ? {
                                  color: activeAccentColor,
                                  borderColor: `${activeAccentColor}50`,
                                  backgroundColor: `${activeAccentColor}18`
                                } : undefined}
                              >
                                {l.tag}
                              </span>
                              <span className="truncate">{l.nativeName}</span>
                            </div>
                            {isSel && (
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: activeAccentColor }}></span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {currentView === 'local' && (
                <button
                  onClick={handleSelectFolder}
                  className="px-3 py-1 bg-[#121212] hover:bg-[#1c1c1c] text-white text-xs font-medium rounded-md border border-[#222] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-white" />
                  {getTranslation(language, 'header.selectFolder')}
                </button>
              )}
            </div>
          </header>

          {/* ─── Persistent Spy Jam / Community View Container (Keep WebRTC Voice & Bot Radio alive in background) ─── */}
          <div className={`flex-1 p-0 overflow-hidden flex flex-col ${currentView === 'community' ? '' : 'hidden'}`}>
            <CommunityView
              currentUser={currentUser}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onPlayTrack={handlePlayTrack}
              onPauseTrack={handlePauseTrack}
              onOpenAuth={() => setIsAuthModalOpen(true)}
              onUpdateBio={handleUpdateBio}
              onUpdateThought={handleUpdateThought}
              onCloudProfileUpdate={handleCloudProfileUpdate}
              screenShareFps={screenShareFps}
              onScreenShareFpsChange={handleUpdateScreenShareFps}
              accentColor={activeAccentColor}
              language={language}
              themeMode={themeMode}
              onActiveServerChange={(server) => setCommunityServerColor(server ? server.accent_color : null)}
              onIncomingVoiceCall={() => setCurrentView('community')}
            />
          </div>

          {/* ─── Main Standard Views Container ─── */}
          <div className={`flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4 md:px-7 md:py-5 ${currentView !== 'community' ? '' : 'hidden'}`}>
            {showVisualizer && currentView !== 'profile' && currentView !== 'ai_mix' && currentView !== 'community' && (
              <AudioVisualizer 
                isPlaying={isPlaying} 
                language={language} 
                accentColor={activeAccentColor} 
                source={currentTrack?.source} 
                audioElement={onlineAudioRef.current}
                currentTime={currentTime}
                themeMode={themeMode}
                currentTrack={currentTrack}
              />
            )}

            {currentView === 'albums' ? (
              <AlbumsView
                albums={albums}
                onCreateAlbum={handleCreateAlbum}
                onDeleteAlbum={handleDeleteAlbum}
                onUpdateAlbum={handleUpdateAlbum}
                onRemoveTrackFromAlbum={handleRemoveTrackFromAlbum}
                onPlayTrack={handlePlayTrack}
                onPlayAlbum={handlePlayAlbum}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                favorites={favorites}
                onToggleFavorite={(id) => {
                  const t = displayedTracks.find(x => x.id === id) || {
                    id, title: 'Bài hát', artist: 'Nghệ sĩ', album: 'Spytify', duration_secs: 180, path_or_url: '', source: 'youtube'
                  };
                  handleToggleFavorite(t);
                }}
                onTogglePlay={handleTogglePlay}
                accentColor={activeAccentColor}
                language={language}
                availableTracks={tracks.filter(t => t.source === 'local' || t.is_downloaded)}
                onDownloadAlbum={handleDownloadAlbum}
                onCancelDownloadAlbum={handleCancelDownloadAlbum}
                downloadingAlbumId={downloadingAlbumId}
                onDownloadTrack={handleDownloadTrack}
                downloadingTrackIds={downloadingTrackIds}
              />
            ) : currentView === 'library' ? (
              <HomeTrendingView
                currentUser={currentUser}
                accentColor={activeAccentColor}
                language={language}
                onPlaySearchResult={handlePlaySearchResult}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                favorites={favorites}
                onToggleFavorite={(id) => {
                  const t = displayedTracks.find(x => x.id === id) || {
                    id, title: 'Bài hát', artist: 'Nghệ sĩ', album: 'Spytify', duration_secs: 180, path_or_url: '', source: 'youtube'
                  };
                  handleToggleFavorite(t);
                }}
                albums={albums}
                onSaveArtistMixAsAlbum={handleSaveArtistMixAsAlbum}
                onNavigateToAlbums={() => setCurrentView('albums')}
                onPlayArtistMix={handlePlayArtistMix}
              />
            ) : currentView === 'ai_mix' ? (
              <AiMixView
                currentUser={currentUser}
                allTracks={tracks}
                onPlayTrack={handlePlayTrack}
                onOpenAuth={() => setIsAuthModalOpen(true)}
                smartDjEnabled={smartDjEnabled}
                onToggleSmartDj={() => setSmartDjEnabled(p => !p)}
                accentColor={activeAccentColor}
                language={language}
                onPlaySearchResult={handlePlaySearchResult}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                favorites={favorites}
                onToggleFavorite={(id) => {
                  const t = displayedTracks.find(x => x.id === id) || {
                    id, title: 'Bài hát', artist: 'Nghệ sĩ', album: 'Spytify', duration_secs: 180, path_or_url: '', source: 'youtube'
                  };
                  handleToggleFavorite(t);
                }}
                albums={albums}
                onSaveArtistMixAsAlbum={handleSaveArtistMixAsAlbum}
                onNavigateToAlbums={() => setCurrentView('albums')}
                onPlayArtistMix={handlePlayArtistMix}
              />
            ) : currentView === 'profile' ? (
              <ProfileView
                currentUser={currentUser}
                language={language}
                onUpdateLanguage={handleUpdateLanguage}
                accentColor={accentColor}
                themeMode={themeMode}
                onUpdateAccentColor={handleUpdateAccentColor}
                onToggleThemeMode={handleToggleThemeMode}
                onUpdateAvatar={handleUpdateAvatar}
                onUpdateBio={handleUpdateBio}
                onLogout={handleLogout}
                onOpenAuth={() => setIsAuthModalOpen(true)}
                onPlayTrack={handlePlayTrack}
                screenShareFps={screenShareFps}
                onScreenShareFpsChange={handleUpdateScreenShareFps}
                downloadFolder={downloadFolder}
                onChangeDownloadFolder={handleChangeDownloadFolder}
                onOpenDownloadFolder={handleOpenDownloadFolder}
                onOpenUpdateModal={(info) => {
                  setUpdateInfo(info);
                  setIsUpdateModalOpen(true);
                }}
                onUpdateAlbums={(updatedAlbums) => {
                  persistAlbumsForUser(currentUser?.id, updatedAlbums);
                  setAlbums(updatedAlbums);
                }}
                crossfadeDuration={crossfadeDuration}
                onUpdateCrossfadeDuration={setCrossfadeDuration}
                volume={volume}
                onVolumeChange={handleVolumeChange}
                isBackgroundPlayEnabled={isBackgroundPlayEnabled}
                onToggleBackgroundPlay={handleToggleBackgroundPlay}
              />
            ) : currentView === 'search' ? (
              <SearchView
                language={language}
                onPlaySearchResult={handlePlaySearchResult}
                onSearchOnline={handleSearchOnline}
                localTracks={tracks}
                onTrackSelect={handlePlayTrack}
                currentTrack={currentTrack}
                accentColor={activeAccentColor}
              />
            ) : currentView === 'youtube' ? (
              <div>
                <div className="mb-5 p-5 rounded-xl bg-[#080808] border border-[#181818] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-red-400 flex items-center gap-1 font-mono">
                      <Radio className="w-3 h-3 text-red-500 animate-pulse" />
                      YOUTUBE AUDIO STREAM
                    </span>
                    <h2 className="text-xl font-extrabold text-white mt-1 tracking-tight">{getTranslation(language, 'stream.youtubeTitle')}</h2>
                    <p className="text-xs text-[#666] mt-0.5">{getTranslation(language, 'stream.youtubeSub')}</p>
                  </div>
                  <button
                    onClick={() => setCurrentView('search')}
                    className="px-4 py-2 rounded bg-white hover:bg-neutral-200 text-black font-semibold text-xs cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <span>{getTranslation(language, 'stream.findSong')}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {['Sơn Tùng M-TP', 'V-Pop Hot Hits', 'Lo-Fi Chill', 'Alan Walker', 'YOASOBI', 'The Weeknd'].map(t => (
                    <button
                      key={t}
                      onClick={async () => {
                        showNotification(`${getTranslation(language, 'toast.searching')}: "${t}"...`);
                        const r = await handleSearchOnline(t, 'youtube');
                        if (r.length) handlePlaySearchResult(r[0], r);
                      }}
                      className="px-3 py-1 bg-[#0a0a0a] hover:bg-[#141414] border border-[#1c1c1c] text-xs text-[#888] hover:text-white rounded flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <YoutubeIcon className="w-3 h-3 text-red-400" />{t}
                    </button>
                  ))}
                </div>
                <TrackTable
                  tracks={displayedTracks}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  favorites={favorites}
                  onTrackSelect={handlePlayTrack}
                  onTogglePlay={handleTogglePlay}
                  accentColor={accentColor}
                  language={language}
                  onDownloadTrack={handleDownloadTrack}
                  downloadingTrackIds={downloadingTrackIds}
                  onOpenMobilePlayer={() => setIsMobilePlayerOpen(true)}
                  onToggleMv={handleToggleYoutubeVideo}
                  showMv={showYoutubeVideo}
                  onAddToAlbum={(track) => {
                    setTrackToAddToAlbum(track);
                    setIsAddToAlbumModalOpen(true);
                  }}
                  onToggleFavorite={(id) => {
                    const t = displayedTracks.find(x => x.id === id);
                    if (t) handleToggleFavorite(t);
                  }}
                />
              </div>
            ) : currentView === 'soundcloud' ? (
              <div>
                <div className="mb-5 p-5 rounded-xl bg-[#080808] border border-[#181818] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400 flex items-center gap-1 font-mono">
                      <SoundCloudIcon className="w-3.5 h-3.5 text-orange-400" />
                      SOUNDCLOUD STREAM
                    </span>
                    <h2 className="text-xl font-extrabold text-white mt-1 tracking-tight">{getTranslation(language, 'stream.soundcloudTitle')}</h2>
                    <p className="text-xs text-[#666] mt-0.5">{getTranslation(language, 'stream.soundcloudSub')}</p>
                  </div>
                  <button
                    onClick={() => setCurrentView('search')}
                    className="px-4 py-2 rounded bg-white hover:bg-neutral-200 text-black font-semibold text-xs cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <span>{getTranslation(language, 'stream.findSong')}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {['Indie Nhạc Việt', 'Lo-Fi Hip Hop', 'Deep House Mix', 'Phùng Khánh Linh', 'RPT Orijinn', 'Underground Rap VN'].map(t => (
                    <button
                      key={t}
                      onClick={async () => {
                        showNotification(`${getTranslation(language, 'toast.searching')}: "${t}" (SoundCloud)...`);
                        const r = await handleSearchOnline(t, 'soundcloud');
                        if (r.length) handlePlaySearchResult(r[0], r);
                      }}
                      className="px-3 py-1 bg-[#0a0a0a] hover:bg-[#141414] border border-[#1c1c1c] text-xs text-[#888] hover:text-white rounded flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <SoundCloudIcon className="w-3 h-3 text-orange-400" />{t}
                    </button>
                  ))}
                </div>
                <TrackTable
                  tracks={displayedTracks}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  favorites={favorites}
                  onTrackSelect={handlePlayTrack}
                  onTogglePlay={handleTogglePlay}
                  accentColor={accentColor}
                  language={language}
                  onDownloadTrack={handleDownloadTrack}
                  downloadingTrackIds={downloadingTrackIds}
                  onOpenMobilePlayer={() => setIsMobilePlayerOpen(true)}
                  onToggleMv={handleToggleYoutubeVideo}
                  showMv={showYoutubeVideo}
                  onAddToAlbum={(track) => {
                    setTrackToAddToAlbum(track);
                    setIsAddToAlbumModalOpen(true);
                  }}
                  onToggleFavorite={(id) => {
                    const t = displayedTracks.find(x => x.id === id);
                    if (t) handleToggleFavorite(t);
                  }}
                />
              </div>
            ) : currentView === 'audius' ? (
              <div>
                <div className="mb-5 p-5 rounded-xl bg-[#080808] border border-[#181818] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 font-mono" style={{ color: accentColor }}>
                      <AudiusIcon className="w-3.5 h-3.5" style={{ color: accentColor }} />
                      AUDIUS OPEN HI-FI (320KBPS)
                    </span>
                    <h2 className="text-xl font-extrabold text-white mt-1 tracking-tight">{getTranslation(language, 'stream.audiusTitle')}</h2>
                    <p className="text-xs text-[#666] mt-0.5">{getTranslation(language, 'stream.audiusSub')}</p>
                  </div>
                  <button
                    onClick={() => setCurrentView('search')}
                    className="px-4 py-2 rounded bg-white hover:bg-neutral-200 text-black font-semibold text-xs cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <span>{getTranslation(language, 'stream.findSong')}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {['EDM Festival', 'Synthwave Retro', 'Trap & Bass', 'Lo-Fi Study Beats', 'Future Bass', 'Deep House 320K'].map(t => (
                    <button
                      key={t}
                      onClick={async () => {
                        showNotification(`${getTranslation(language, 'toast.searching')}: "${t}" (Audius 320K)...`);
                        const r = await handleSearchOnline(t, 'audius');
                        if (r.length) handlePlaySearchResult(r[0], r);
                      }}
                      className="px-3 py-1 bg-[#0a0a0a] hover:bg-[#141414] border border-[#1c1c1c] text-xs text-[#888] hover:text-white rounded flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <AudiusIcon className="w-3 h-3" style={{ color: accentColor }} />{t}
                    </button>
                  ))}
                </div>
                <TrackTable
                  tracks={displayedTracks}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  favorites={favorites}
                  onTrackSelect={handlePlayTrack}
                  onTogglePlay={handleTogglePlay}
                  accentColor={accentColor}
                  language={language}
                  onDownloadTrack={handleDownloadTrack}
                  downloadingTrackIds={downloadingTrackIds}
                  onOpenMobilePlayer={() => setIsMobilePlayerOpen(true)}
                  onToggleMv={handleToggleYoutubeVideo}
                  showMv={showYoutubeVideo}
                  onAddToAlbum={(track) => {
                    setTrackToAddToAlbum(track);
                    setIsAddToAlbumModalOpen(true);
                  }}
                  onToggleFavorite={(id) => {
                    const t = displayedTracks.find(x => x.id === id);
                    if (t) handleToggleFavorite(t);
                  }}
                />
              </div>
            ) : (
              <div>
                <div className="mb-5 p-5 rounded-xl bg-[#0a0a0c] border border-[#1a1a20] flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest font-mono flex items-center gap-1.5" style={{ color: accentColor }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }}></span>
                      {currentView === 'local' ? getTranslation(language, 'view.localBadge') : getTranslation(language, 'view.favoritesBadge')}
                    </span>
                    <h2 className="text-2xl font-black text-white mt-1 tracking-tight">
                      {currentView === 'local' ? getTranslation(language, 'view.localTitle') : getTranslation(language, 'view.favoritesTitle')}
                    </h2>
                    <p className="text-xs text-[#777] mt-0.5">{getTranslation(language, 'view.dbSyncedCount', { count: displayedTracks.length })}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {currentView === 'local' && displayedTracks.length > 0 && (
                      <button
                        type="button"
                        onClick={handleCreateAlbumFromDownloaded}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border bg-[#14141c] hover:bg-[#1a1a24] text-white border-[#272738] shadow-sm hover:scale-[1.02]"
                        style={{ borderColor: `${accentColor}50` }}
                        title={language === 'vi' ? 'Tạo album mới từ tất cả bài hát đã tải về máy' : 'Create new album from downloaded tracks'}
                      >
                        <FolderPlus className="w-4 h-4" style={{ color: accentColor }} />
                        <span>{language === 'vi' ? 'Tạo Album' : 'Create Album'}</span>
                      </button>
                    )}
                    {displayedTracks.length > 0 && (
                      <button
                        onClick={() => {
                          if (isPlaying && currentTrack && displayedTracks.some(t => t.id === currentTrack.id)) {
                            handleTogglePlay();
                          } else {
                            handlePlayTrack(displayedTracks[0]);
                          }
                        }}
                        style={{
                          backgroundColor: activeAccentColor,
                          color: getContrastTextColor(activeAccentColor),
                          boxShadow: `0 0 16px ${activeAccentColor}50`
                        }}
                        className="w-11 h-11 rounded-full hover:scale-105 active:scale-95 flex items-center justify-center transition-all cursor-pointer shadow-lg"
                        title={isPlaying && currentTrack && displayedTracks.some(t => t.id === currentTrack.id) ? (language === 'vi' ? 'Tạm dừng' : 'Pause') : (language === 'vi' ? 'Phát tất cả' : 'Play all')}
                      >
                        {isPlaying && currentTrack && displayedTracks.some(t => t.id === currentTrack.id) ? (
                          <Pause className="w-5 h-5 fill-current" />
                        ) : (
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <TrackTable
                  tracks={displayedTracks}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  favorites={favorites}
                  onTrackSelect={handlePlayTrack}
                  onTogglePlay={handleTogglePlay}
                  accentColor={accentColor}
                  language={language}
                  onDownloadTrack={handleDownloadTrack}
                  downloadingTrackIds={downloadingTrackIds}
                  onOpenMobilePlayer={() => setIsMobilePlayerOpen(true)}
                  onToggleMv={handleToggleYoutubeVideo}
                  showMv={showYoutubeVideo}
                  onAddToAlbum={(track) => {
                    setTrackToAddToAlbum(track);
                    setIsAddToAlbumModalOpen(true);
                  }}
                  onReorderTracks={currentView === 'local' ? (newLocalTracks) => {
                    setTracks(prev => {
                      const nonLocalTracks = prev.filter(t => t.source !== 'local');
                      return [...newLocalTracks, ...nonLocalTracks];
                    });
                    try {
                      const orderKeys = newLocalTracks.map(t => t.path_or_url || t.id || t.title);
                      localStorage.setItem('spytify_local_tracks_order', JSON.stringify(orderKeys));
                    } catch {}
                  } : undefined}
                  onToggleFavorite={(id) => {
                    const t = displayedTracks.find(x => x.id === id);
                    if (t) handleToggleFavorite(t);
                  }}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Ultra Hi-Fi Player Bar */}
      <PlayerBar
        language={language}
        isCompact={true}
        isMinimized={isPlayerBarMinimized}
        onToggleMinimize={() => {
          setIsPlayerBarMinimized(prev => {
            const next = !prev;
            userManuallyMinimizedRef.current = next;
            return next;
          });
        }}
        currentTrack={currentTrack}
        upcomingTrack={effectiveUpcomingTrack}
        previousTrack={previousTrack}
        upcomingModeLabel={nextTrackPopup?.modeLabel || getPlaylistModeLabel(activeQueueContext)}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        isFavorite={currentTrack ? favorites.has(currentTrack.id) : false}
        repeatMode={repeatMode}
        isShuffle={isShuffle}
        onToggleRepeat={() => {
          setRepeatMode(prev => {
            if (prev === 'all') return 'one';
            if (prev === 'one') return 'off';
            return 'all';
          });
        }}
        onToggleShuffle={() => setIsShuffle(p => !p)}
        onTogglePlay={handleTogglePlay}
        onPrev={handleUserPrev}
        onNext={handleUserNext}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onToggleFavorite={() => currentTrack && handleToggleFavorite(currentTrack)}
        accentColor={activeAccentColor}
        onAddToAlbum={() => {
          if (currentTrack) {
            setTrackToAddToAlbum(currentTrack);
            setIsAddToAlbumModalOpen(true);
          }
        }}
        onDownload={handleDownloadTrack}
        isDownloading={currentTrack ? downloadingTrackIds.has(currentTrack.id) : false}
        sleepTimerMinutes={sleepTimerMinutes}
        sleepTimerRemainingSecs={sleepTimerRemainingSecs}
        onSetSleepTimer={handleSetSleepTimer}
        onToggleVisualizer={() => setShowVisualizer(p => !p)}
        showVisualizer={showVisualizer}
        themeMode={themeMode}
        recommendMode={recommendMode}
        onCycleRecommendMode={handleCycleRecommendMode}
        isNextTrackPopupEnabled={Boolean(isNextTrackPopupEnabled && nextTrackPopup)}
        onToggleNextTrackPopupEnabled={handleToggleNextTrackPopupEnabled}
        crossfadeDuration={crossfadeDuration}
        onUpdateCrossfadeDuration={setCrossfadeDuration}
        isCrossfading={isCrossfading}
        onOpenEqualizer={() => setIsEqualizerOpen(true)}
        isEqualizerActive={isEqualizerActive}
        isBackgroundPlayEnabled={isBackgroundPlayEnabled}
        onToggleBackgroundPlay={handleToggleBackgroundPlay}
        onToggleMv={handleToggleYoutubeVideo}
        showMv={showYoutubeVideo}
        isMobilePlayerOpen={isMobilePlayerOpen}
        onToggleMobilePlayer={setIsMobilePlayerOpen}
        isConnectHostActive={isConnectHostActive}
        onToggleConnectHost={isTauriApp ? handleToggleConnectHost : undefined}
        isConnectClientActive={isConnectClientActive}
        isHostOnline={isHostOnline}
        onToggleConnectClient={!isTauriApp ? handleToggleConnectClient : undefined}
      />

      {/* Mobile Bottom Navigation Bar (App-like mobile shell with iOS safe-area bottom inset) */}
      <nav
        className={`md:hidden flex items-center justify-around border-t z-40 flex-shrink-0 pb-[env(safe-area-inset-bottom,0px)] select-none ${
          themeMode === 'light'
            ? 'bg-white/95 border-slate-200 text-slate-500'
            : 'bg-[#050508]/95 border-[#161620] text-[#777788]'
        } backdrop-blur-xl`}
      >
        {[
          { view: 'library' as ViewType, label: language === 'vi' ? 'Trang chủ' : 'Home', icon: <ModernHomeIcon className="w-4 h-4" active={currentView === 'library'} /> },
          { view: 'search' as ViewType, label: language === 'vi' ? 'Tìm kiếm' : 'Search', icon: <Search className="w-4 h-4" /> },
          { view: 'community' as ViewType, label: 'Spy Jam', icon: <SpyJamIcon className="w-4 h-4" /> },
          { view: 'albums' as ViewType, label: 'Album', icon: <Layers className="w-4 h-4" /> },
          { view: 'ai_mix' as ViewType, label: 'AI Mix', icon: <AudioLines className="w-4 h-4" /> },
          { view: 'profile' as ViewType, label: language === 'vi' ? 'Hồ sơ' : 'Profile', icon: <UserIcon className="w-4 h-4" /> },
        ].map((item) => {
          const isActive = currentView === item.view;
          return (
            <button
              key={item.view}
              type="button"
              onClick={() => setCurrentView(item.view)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-1 text-[10px] font-semibold transition-colors cursor-pointer"
              style={{ color: isActive ? activeAccentColor : undefined }}
            >
              <span>{item.icon}</span>
              <span className="truncate max-w-[64px]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
