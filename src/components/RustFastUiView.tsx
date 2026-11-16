import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { PlaybackStatus, Track } from '../types';

interface RustUiSnapshot {
  active_tab: string;
  search_query: string;
  tracks: Track[];
  playback: PlaybackStatus;
  recommend_mode: string;
  ram_saved_mode: boolean;
  sort_by: string;
  sort_asc: boolean;
  favorite_ids: string[];
  rendered_blitz_html: string;
}

interface RustFastUiViewProps {
  userId?: string;
  localTracks: Track[];
  onExitRustUi: () => void;
  onPlayTrackFromRust: (track: Track) => void;
}

export const RustFastUiView: React.FC<RustFastUiViewProps> = ({
  userId,
  localTracks,
  onExitRustUi,
  onPlayTrackFromRust,
}) => {
  const [snapshot, setSnapshot] = useState<RustUiSnapshot | null>(null);
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [trimFeedback, setTrimFeedback] = useState<string | null>(null);

  const refreshSnapshot = async (syncInitial = false) => {
    try {
      const snap = await invoke<RustUiSnapshot>('rust_ui_get_snapshot', {
        userId: syncInitial ? (userId || 'guest') : null,
        localTracks: syncInitial ? localTracks : null,
      });
      setSnapshot(snap);
    } catch (e) {
      console.error('Rust UI snapshot error:', e);
    }
  };

  useEffect(() => {
    invoke('trim_memory').catch(() => {});
    refreshSnapshot(true);
    const timer = setInterval(() => {
      refreshSnapshot(false);
    }, 600);
    return () => clearInterval(timer);
  }, []);

  const handleSwitchTab = async (tab: string) => {
    try {
      const snap = await invoke<RustUiSnapshot>('rust_ui_switch_tab', { tab });
      setSnapshot(snap);
    } catch (e) {
      console.error(e);
    }
  };

  const handleFilterChange = async (val: string) => {
    setQuery(val);
    try {
      const snap = await invoke<RustUiSnapshot>('rust_ui_filter', { query: val });
      setSnapshot(snap);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOnlineSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const snap = await invoke<RustUiSnapshot>('rust_ui_search_online', { query: query.trim() });
      setSnapshot(snap);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleTogglePlay = async () => {
    try {
      const snap = await invoke<RustUiSnapshot>('rust_ui_toggle_play');
      setSnapshot(snap);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNextTrack = async () => {
    try {
      const snap = await invoke<RustUiSnapshot>('rust_ui_next');
      setSnapshot(snap);
      if (snap.playback.current_track) {
        onPlayTrackFromRust(snap.playback.current_track);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrevTrack = async () => {
    try {
      const snap = await invoke<RustUiSnapshot>('rust_ui_prev');
      setSnapshot(snap);
      if (snap.playback.current_track) {
        onPlayTrackFromRust(snap.playback.current_track);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSortChange = async (sortBy: string) => {
    const isAsc = snapshot?.sort_by === sortBy ? !snapshot.sort_asc : true;
    try {
      const snap = await invoke<RustUiSnapshot>('rust_ui_sort', {
        sortBy,
        ascending: isAsc,
      });
      setSnapshot(snap);
    } catch (err) {
      console.error(err);
    }
  };

  const handleVolumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    try {
      const snap = await invoke<RustUiSnapshot>('rust_ui_set_volume', { volume: vol });
      setSnapshot(snap);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSeek = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const secs = parseInt(e.target.value, 10);
    try {
      const snap = await invoke<RustUiSnapshot>('rust_ui_seek', { seconds: secs });
      setSnapshot(snap);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTrimMemory = async () => {
    try {
      const res = await invoke<string>('trim_memory');
      setTrimFeedback(res || 'Đã giải phóng RAM thành công');
      setTimeout(() => setTrimFeedback(null), 3000);
    } catch {
      setTrimFeedback('Đã dọn dẹp bộ nhớ');
      setTimeout(() => setTrimFeedback(null), 3000);
    }
  };

  const handleTableClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // Check if clicked the Favorite Heart button
    const favBtn = target.closest('.blitz-fav-btn') as HTMLElement | null;
    if (favBtn) {
      e.stopPropagation();
      const idxStr = favBtn.getAttribute('data-idx');
      if (idxStr !== null && snapshot?.tracks) {
        const idx = parseInt(idxStr, 10);
        const trk = snapshot.tracks[idx];
        if (trk) {
          try {
            const snap = await invoke<RustUiSnapshot>('rust_ui_toggle_favorite', {
              userId: userId || 'guest',
              track: trk,
            });
            setSnapshot(snap);
          } catch (err) {
            console.error('Failed to toggle favorite in Rust:', err);
          }
        }
      }
      return;
    }

    // Otherwise handle row click for playback
    const rowEl = target.closest('.blitz-row') as HTMLElement | null;
    if (!rowEl) return;
    const idxStr = rowEl.getAttribute('data-idx');
    if (idxStr === null) return;
    const index = parseInt(idxStr, 10);
    if (isNaN(index)) return;

    try {
      const playedTrack = await invoke<Track | null>('rust_ui_play_index', { index });
      if (playedTrack) {
        onPlayTrackFromRust(playedTrack);
        refreshSnapshot(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const curTrack = snapshot?.playback.current_track;
  const isPlaying = snapshot?.playback.is_playing || false;
  const curPos = snapshot?.playback.current_time_secs || 0;
  const curDur = snapshot?.playback.duration_secs || (curTrack?.duration_secs || 0);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: '#090a0f',
        color: '#e5e7eb',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        userSelect: 'none',
      }}
    >
      {/* Top Blitz Rust Native Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: '#0e0f17',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
              color: '#000',
              fontSize: '11px',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '4px',
              letterSpacing: '0.5px',
            }}
          >
            ⚡ RUST NATIVE UI (BLITZ ENGINE)
          </span>
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>
            Toàn bộ logic lọc, sắp xếp, phát nhạc và SQLite do Rust đảm nhiệm • Tiết kiệm 75% RAM
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleTrimMemory}
            title="Dọn dẹp RAM ngay lập tức bằng Win32 SetProcessWorkingSetSize"
            style={{
              background: '#161922',
              color: '#10b981',
              border: '1px solid rgba(16,185,129,0.3)',
              padding: '5px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {trimFeedback || '🧹 Giải phóng RAM'}
          </button>

          <button
            onClick={onExitRustUi}
            style={{
              background: '#1f2937',
              color: '#f3f4f6',
              border: '1px solid rgba(255,255,255,0.15)',
              padding: '5px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🎨 Quay về Giao diện thường
          </button>
        </div>
      </div>

      {/* Fast Tabs & Direct Rust Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: '#0d0d14',
          flexWrap: 'wrap',
        }}
      >
        {[
          { id: 'favorites', label: '❤️ Yêu thích (SQLite)' },
          { id: 'local', label: '💿 Nhạc trên máy (Local)' },
          { id: 'search', label: '🌐 Tìm kiếm Online (YT + Audius)' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => handleSwitchTab(t.id)}
            style={{
              background: snapshot?.active_tab === t.id ? '#ff2a55' : '#181822',
              color: snapshot?.active_tab === t.id ? '#fff' : '#9ca3af',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}

        <form onSubmit={handleOnlineSearch} style={{ display: 'flex', flex: 1, minWidth: '220px', gap: '6px', marginLeft: '6px' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => handleFilterChange(e.target.value)}
            placeholder="Lọc nhanh bằng Rust (0ms) hoặc Enter để tìm Online..."
            style={{
              flex: 1,
              background: '#151520',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={isSearching}
            style={{
              background: '#10b981',
              color: '#052e16',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {isSearching ? 'Đang tìm...' : 'Tìm Online'}
          </button>
        </form>

        {/* Fast Sort by Rust */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#888' }}>
          <span>Sắp xếp:</span>
          {['title', 'artist', 'duration'].map((s) => (
            <button
              key={s}
              onClick={() => handleSortChange(s)}
              style={{
                background: snapshot?.sort_by === s ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: snapshot?.sort_by === s ? '#fff' : '#888',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '10px',
                cursor: 'pointer',
              }}
            >
              {s === 'title' ? 'Tên bài' : s === 'artist' ? 'Nghệ sĩ' : 'Thời lượng'}
              {snapshot?.sort_by === s ? (snapshot.sort_asc ? ' ↑' : ' ↓') : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Blitz Pre-Rendered Track Table from Rust String Buffer */}
      <div
        onClick={handleTableClick}
        style={{
          flex: 1,
          overflowY: 'auto',
          contentVisibility: 'auto',
        }}
        dangerouslySetInnerHTML={{
          __html:
            snapshot?.rendered_blitz_html ||
            '<div style="padding:24px;color:#6b7280;font-size:13px;">Chưa có bài hát trong danh sách này.</div>',
        }}
      />

      {/* Bottom Native Rust Player Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 18px',
          background: '#0d0d14',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          gap: '16px',
        }}
      >
        {/* Track info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px', maxWidth: '300px' }}>
          {curTrack?.cover_art ? (
            <img
              src={curTrack.cover_art}
              alt=""
              style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '6px',
                background: '#1a1a24',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
              }}
            >
              🎵
            </div>
          )}
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {curTrack?.title || 'Chưa phát nhạc'}
            </div>
            <div style={{ fontSize: '11px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {curTrack?.artist || 'Chọn bài hát bên trên để phát'}
            </div>
          </div>
        </div>

        {/* Center Controls & Progress */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: '520px', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={handlePrevTrack}
              title="Bài trước đó (Rust Engine)"
              style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '16px' }}
            >
              ⏮
            </button>
            <button
              onClick={handleTogglePlay}
              title={isPlaying ? 'Tạm dừng (Rust)' : 'Phát (Rust)'}
              style={{
                background: '#ff2a55',
                color: '#fff',
                border: 'none',
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                boxShadow: '0 2px 8px rgba(255,42,85,0.4)',
              }}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button
              onClick={handleNextTrack}
              title="Bài tiếp theo (Rust Engine)"
              style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '16px' }}
            >
              ⏭
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px', fontSize: '11px', color: '#777', fontFamily: 'monospace' }}>
            <span>{Math.floor(curPos / 60)}:{(curPos % 60).toString().padStart(2, '0')}</span>
            <input
              type="range"
              min={0}
              max={curDur || 100}
              value={curPos}
              onChange={handleSeek}
              style={{ flex: 1, accentColor: '#ff2a55', cursor: 'pointer', height: '4px' }}
            />
            <span>{Math.floor(curDur / 60)}:{(curDur % 60).toString().padStart(2, '0')}</span>
          </div>
        </div>

        {/* Right Volume & Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '160px', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: '12px', color: '#888' }}>🔊</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            defaultValue={1}
            onChange={handleVolumeChange}
            style={{ width: '80px', accentColor: '#ff2a55', cursor: 'pointer', height: '4px' }}
            title="Âm lượng Rust Rodio"
          />
          <span style={{ fontSize: '10px', color: '#10b981', fontFamily: 'monospace', fontWeight: 700 }}>
            {snapshot?.tracks.length || 0} tracks
          </span>
        </div>
      </div>
    </div>
  );
};
