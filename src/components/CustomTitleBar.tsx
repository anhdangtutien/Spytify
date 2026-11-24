import React, { useState, useEffect, useRef } from 'react';
import { 
  MoreHorizontal, ChevronLeft, ChevronRight, Home, Search, 
  Minus, Square, Copy, X, Globe, User as UserIcon, Radio,
  Sparkles, Settings, ExternalLink, LogOut, Check, Layers
} from 'lucide-react';
import { ViewType, User } from '../types';
import { LanguageCode, getTranslation } from '../locales/i18n';

interface CustomTitleBarProps {
  currentView: ViewType;
  onNavigateView: (view: ViewType) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  currentUser: User | null;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onOpenConnectModal?: () => void;
  isConnectHostActive?: boolean;
  isConnectClientActive?: boolean;
  language: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  themeMode?: 'dark' | 'light';
  isTauriApp: boolean;
  onOpenWebsite: () => void;
  accentColor?: string;
}

export const CustomTitleBar: React.FC<CustomTitleBarProps> = ({
  currentView,
  onNavigateView,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  searchQuery,
  onSearchChange,
  currentUser,
  onOpenAuth,
  onOpenProfile,
  onOpenConnectModal,
  isConnectHostActive,
  isConnectClientActive,
  language,
  onLanguageChange,
  themeMode = 'dark',
  isTauriApp,
  onOpenWebsite,
  accentColor = '#ff2a55',
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync maximized state on Tauri desktop
  useEffect(() => {
    if (!isTauriApp) return;
    let isCancelled = false;
    let unlistenResize: (() => void) | null = null;

    const initWindowState = async () => {
      try {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const appWindow = getCurrentWebviewWindow();
        if (isCancelled) return;
        const max = await appWindow.isMaximized();
        if (!isCancelled) setIsMaximized(max);

        const unlisten = await appWindow.onResized(async () => {
          if (!isCancelled) {
            setIsMaximized(await appWindow.isMaximized());
          }
        });
        unlistenResize = unlisten;
      } catch {}
    };

    initWindowState();

    return () => {
      isCancelled = true;
      if (unlistenResize) unlistenResize();
    };
  }, [isTauriApp]);

  // Click outside to close menus
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMinimize = async () => {
    try {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      await getCurrentWebviewWindow().minimize();
    } catch {}
  };

  const handleToggleMaximize = async () => {
    try {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const appWindow = getCurrentWebviewWindow();
      await appWindow.toggleMaximize();
      setIsMaximized(await appWindow.isMaximized());
    } catch {}
  };

  const handleClose = async () => {
    try {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      await getCurrentWebviewWindow().close();
    } catch {}
  };

  const handleSearchFocus = () => {
    if (currentView !== 'search') {
      onNavigateView('search');
    }
  };

  const languages = [
    { code: 'vi' as LanguageCode, label: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'en' as LanguageCode, label: 'English', flag: '🇺🇸' },
    { code: 'ja' as LanguageCode, label: '日本語', flag: '🇯🇵' },
    { code: 'zh' as LanguageCode, label: '中文', flag: '🇨🇳' },
    { code: 'ko' as LanguageCode, label: '한국어', flag: '🇰🇷' },
  ];

  return (
    <header
      className={`hidden md:flex h-12 w-full items-center justify-between ${isTauriApp ? 'pl-3 pr-0' : 'px-3'} select-none border-b shrink-0 z-50 ${
        themeMode === 'light'
          ? 'bg-slate-100 border-slate-200 text-slate-800'
          : 'bg-[#000000] border-[#181820] text-zinc-300'
      }`}
      data-tauri-drag-region="true"
      style={{ WebkitAppRegion: 'drag' } as any}
      onDoubleClick={isTauriApp ? handleToggleMaximize : undefined}
    >
      {/* ─── LEFT: Logo / Menu & Navigation History ─── */}
      <div 
        className="flex items-center gap-1.5 shrink-0" 
        data-tauri-drag-region="false"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {/* Menu Dropdown Button (•••) */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Menu Spytify"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {isMenuOpen && (
            <div className="absolute top-10 left-0 w-56 rounded-xl bg-[#14141c] border border-white/10 shadow-2xl py-1.5 z-50 text-xs font-medium text-zinc-300 animate-fadeIn">
              <button
                type="button"
                onClick={() => {
                  onNavigateView('library');
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 hover:text-white text-left transition-colors cursor-pointer"
              >
                <Home className="w-4 h-4 text-emerald-400" />
                <span>{getTranslation(language, 'nav.trending')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigateView('search');
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 hover:text-white text-left transition-colors cursor-pointer"
              >
                <Search className="w-4 h-4 text-cyan-400" />
                <span>{getTranslation(language, 'nav.search')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigateView('profile');
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 hover:text-white text-left transition-colors cursor-pointer"
              >
                <Settings className="w-4 h-4 text-purple-400" />
                <span>{getTranslation(language, 'nav.account')}</span>
              </button>
              <div className="my-1 border-t border-white/10" />
              <button
                type="button"
                onClick={() => {
                  onOpenWebsite();
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 hover:text-white text-left transition-colors cursor-pointer"
              >
                <ExternalLink className="w-4 h-4 text-zinc-400" />
                <span>{getTranslation(language, 'website.headerBtn')}</span>
              </button>
              {isTauriApp && (
                <>
                  <div className="my-1 border-t border-white/10" />
                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-rose-500/20 hover:text-rose-300 text-left transition-colors cursor-pointer text-rose-400"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Thoát ứng dụng</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Navigation History: Back (<) & Forward (>) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onGoBack}
            disabled={!canGoBack}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              canGoBack
                ? 'text-zinc-200 hover:text-white bg-white/5 hover:bg-white/15 cursor-pointer'
                : 'text-zinc-600 bg-white/[0.02] cursor-not-allowed opacity-50'
            }`}
            title="Quay lại"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onGoForward}
            disabled={!canGoForward}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              canGoForward
                ? 'text-zinc-200 hover:text-white bg-white/5 hover:bg-white/15 cursor-pointer'
                : 'text-zinc-600 bg-white/[0.02] cursor-not-allowed opacity-50'
            }`}
            title="Tiến lên"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── CENTER: Spotify-style Quick Home & Search Bar ─── */}
      <div 
        className="flex items-center gap-2 max-w-[520px] w-full px-2"
        data-tauri-drag-region="false"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {/* Quick Home Button (Round) */}
        <button
          type="button"
          onClick={() => onNavigateView('library')}
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer ${
            currentView === 'library'
              ? 'bg-white text-black shadow-md'
              : 'bg-[#1f1f26] text-zinc-300 hover:text-white hover:bg-[#282832]'
          }`}
          title="Trang chủ Spytify"
        >
          <Home className="w-4 h-4 fill-current" />
        </button>

        {/* Integrated Search Input Pill */}
        <div 
          className="relative flex-1 group"
          onClick={() => searchInputRef.current?.focus()}
        >
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400 group-hover:text-zinc-200 transition-colors">
            <Search className="w-4 h-4" />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={handleSearchFocus}
            placeholder={language === 'vi' ? 'Bạn muốn nghe gì?' : 'What do you want to play?'}
            className="w-full h-9 pl-9 pr-14 text-xs font-medium rounded-full bg-[#1f1f26] text-white placeholder-zinc-400 border border-transparent hover:border-white/20 focus:border-white/30 focus:bg-[#262630] focus:outline-none transition-all shadow-inner"
          />
          <div className="absolute inset-y-0 right-1 flex items-center gap-1 pr-1.5">
            {searchQuery && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSearchChange('');
                }}
                className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="w-[1px] h-3.5 bg-white/15 my-auto" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigateView('library');
              }}
              className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
              title="Khám phá / Browse"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── RIGHT: Status, Language, Profile & Window Controls ─── */}
      <div 
        className="flex items-center gap-1 shrink-0 h-full"
        data-tauri-drag-region="false"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {/* Spytify Connect Status Pill */}
        {onOpenConnectModal && (
          <button
            type="button"
            onClick={onOpenConnectModal}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer mr-1 ${
              isConnectHostActive || isConnectClientActive
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
            title="Spytify Connect — Điều khiển từ xa trên iPhone"
          >
            <Radio className={`w-3.5 h-3.5 ${isConnectHostActive || isConnectClientActive ? 'animate-pulse' : ''}`} />
            <span className="hidden lg:inline">Connect</span>
          </button>
        )}

        {/* Language Switcher */}
        <div className="relative" ref={langRef}>
          <button
            type="button"
            onClick={() => setIsLangOpen(!isLangOpen)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xs"
            title="Chọn ngôn ngữ"
          >
            <Globe className="w-3.5 h-3.5" />
          </button>

          {isLangOpen && (
            <div className="absolute top-10 right-0 w-40 rounded-xl bg-[#14141c] border border-white/10 shadow-2xl py-1 z-50 text-xs font-medium text-zinc-300 animate-fadeIn">
              {languages.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => {
                    onLanguageChange(l.code);
                    setIsLangOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/10 transition-colors cursor-pointer text-left ${
                    language === l.code ? 'text-white font-bold bg-white/5' : 'text-zinc-400'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{l.flag}</span>
                    <span>{l.label}</span>
                  </span>
                  {language === l.code && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User Profile Avatar */}
        <button
          type="button"
          onClick={currentUser ? onOpenProfile : onOpenAuth}
          className="w-8 h-8 rounded-full overflow-hidden bg-[#1f1f26] border border-white/15 flex items-center justify-center text-zinc-300 hover:scale-105 transition-transform cursor-pointer shadow"
          title={currentUser ? (currentUser.display_name || currentUser.username || '') : 'Đăng nhập'}
        >
          {currentUser?.avatar ? (
            <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <UserIcon className="w-4 h-4 text-zinc-400" />
          )}
        </button>

        {/* ─── NATIVE-STYLE WINDOW CONTROLS (Only for Desktop Tauri) ─── */}
        {isTauriApp && (
          <div className="flex items-center ml-2 h-full">
            {/* Minimize */}
            <button
              type="button"
              onClick={handleMinimize}
              className="w-12 h-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Thu nhỏ"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            {/* Maximize / Restore */}
            <button
              type="button"
              onClick={handleToggleMaximize}
              className="w-12 h-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title={isMaximized ? 'Khôi phục cửa sổ' : 'Phóng to'}
            >
              {isMaximized ? (
                <Copy className="w-3 h-3 rotate-180" />
              ) : (
                <Square className="w-3 h-3" />
              )}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={handleClose}
              className="w-12 h-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#e81123] transition-colors cursor-pointer"
              title="Đóng ứng dụng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
