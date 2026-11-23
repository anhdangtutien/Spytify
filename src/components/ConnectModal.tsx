import React from 'react';
import { Laptop, Smartphone, Check, Radio, Volume2, X, RefreshCw } from 'lucide-react';
import { Track } from '../types';

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  isHostOnline: boolean;
  hostName: string;
  playbackTarget: 'desktop' | 'this_device';
  onSelectTarget: (target: 'desktop' | 'this_device') => void;
  onDisconnect: () => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  accentColor: string;
  themeMode: 'dark' | 'light';
  language: string;
}

export const ConnectModal: React.FC<ConnectModalProps> = ({
  isOpen,
  onClose,
  isHostOnline,
  hostName,
  playbackTarget,
  onSelectTarget,
  onDisconnect,
  currentTrack,
  isPlaying,
  accentColor,
  themeMode,
  language,
}) => {
  if (!isOpen) return null;

  const isLight = themeMode === 'light';

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl transition-all border ${
          isLight ? 'bg-white text-slate-900 border-slate-200' : 'bg-[#0e0e14] text-white border-[#222230]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
            <h3 className="text-base font-bold tracking-tight">
              {language === 'vi' ? 'Thiết bị phát (Connect)' : 'Connect to a Device'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current status banner */}
        {currentTrack && (
          <div className={`p-3 rounded-xl mb-4 flex items-center gap-3 border ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#14141e] border-white/5'
          }`}>
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-black/40">
              {currentTrack.cover_art ? (
                <img src={currentTrack.cover_art} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs">🎵</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate">{currentTrack.title}</p>
              <p className="text-[11px] text-zinc-400 truncate">{currentTrack.artist}</p>
            </div>
            <div className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold shrink-0">
              {playbackTarget === 'desktop' ? 'ON DESKTOP' : 'ON THIS PHONE'}
            </div>
          </div>
        )}

        {/* Device List */}
        <div className="space-y-2.5 mb-5">
          {/* Option 1: Desktop */}
          <button
            type="button"
            onClick={() => {
              onSelectTarget('desktop');
              onClose();
            }}
            disabled={!isHostOnline}
            className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
              playbackTarget === 'desktop'
                ? 'border-emerald-500/60 bg-emerald-500/10 shadow-lg'
                : isHostOnline
                ? 'border-white/10 hover:border-white/30 hover:bg-white/5'
                : 'opacity-40 border-white/5 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                playbackTarget === 'desktop'
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/30'
                  : 'bg-white/10 text-zinc-300'
              }`}>
                <Laptop className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold truncate">
                    {hostName || 'Spytify Desktop'}
                  </span>
                  {isHostOnline ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse" />
                  ) : (
                    <span className="text-[10px] text-zinc-500">
                      ({language === 'vi' ? 'Ngoại tuyến' : 'Offline'})
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                  {language === 'vi' 
                    ? 'Phát ra loa máy tính (Dùng iPhone làm điều khiển từ xa)' 
                    : 'Stream to PC speakers (Use phone as remote)'}
                </p>
              </div>
            </div>

            {playbackTarget === 'desktop' ? (
              <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold pl-2 shrink-0">
                <Volume2 className="w-4 h-4 animate-bounce" />
                <span className="hidden sm:inline">{language === 'vi' ? 'Đang phát' : 'Playing'}</span>
              </div>
            ) : isHostOnline ? (
              <span className="text-xs font-semibold text-zinc-400 hover:text-white shrink-0 pl-2">
                {language === 'vi' ? 'Chọn' : 'Select'}
              </span>
            ) : null}
          </button>

          {/* Option 2: This Device (iPhone) */}
          <button
            type="button"
            onClick={() => {
              onSelectTarget('this_device');
              onClose();
            }}
            className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
              playbackTarget === 'this_device'
                ? 'border-emerald-500/60 bg-emerald-500/10 shadow-lg'
                : 'border-white/10 hover:border-white/30 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                playbackTarget === 'this_device'
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/30'
                  : 'bg-white/10 text-zinc-300'
              }`}>
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold truncate">
                    {language === 'vi' ? 'Thiết bị này (iPhone)' : 'This Phone (iPhone)'}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                  {language === 'vi'
                    ? 'Phát trực tiếp ra loa / tai nghe của điện thoại'
                    : 'Listen directly through phone speaker or headphones'}
                </p>
              </div>
            </div>

            {playbackTarget === 'this_device' ? (
              <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold pl-2 shrink-0">
                <Volume2 className="w-4 h-4 animate-bounce" />
                <span className="hidden sm:inline">{language === 'vi' ? 'Đang phát' : 'Playing'}</span>
              </div>
            ) : (
              <span className="text-xs font-semibold text-zinc-400 hover:text-white shrink-0 pl-2">
                {language === 'vi' ? 'Chọn' : 'Select'}
              </span>
            )}
          </button>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-zinc-400">
          <span>
            {language === 'vi'
              ? 'Tự động đồng bộ tiến độ giây và bài hát'
              : 'Auto-syncs track and playback position'}
          </span>
          <button
            type="button"
            onClick={onDisconnect}
            className="text-rose-400 hover:underline cursor-pointer"
          >
            {language === 'vi' ? 'Ngắt kết nối' : 'Disconnect'}
          </button>
        </div>
      </div>
    </div>
  );
};
