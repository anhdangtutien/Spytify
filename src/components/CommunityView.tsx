import React, { useState, useEffect, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { 
  Radio, MessageSquare, Headphones, Users, Disc, Play, Send, 
  Music, Plus, Hash, Volume2, Flame, Activity, Share2,
  Mic, MicOff, PhoneCall, PhoneOff, VolumeX, Signal, Shield,
  X, Sparkles, Palette, Check, Settings, Sliders, Volume1, RotateCcw, CheckCircle2,
  MoreVertical, UserPlus, UserCheck, Heart, UserMinus, Trash2, Copy, Crown, Info,
  Search, ShieldAlert, AlertCircle, Edit3, EyeOff, Lock, LogIn,
  Monitor, MonitorOff, Image as ImageIcon, Paperclip, Maximize2, Minimize2, Download, Tag, FileText,
  ListMusic, SkipForward, Square, AlertTriangle, LogOut
} from 'lucide-react';
import { Track, User, CommunityServer, CommunityChannel, CommunityMessage, StageSession, VoiceParticipant, CommunityUserProfile, CommunityServerTag, SearchResult, RequestBotTrack } from '../types';
import {
  getSupabaseClient,
  MAX_CHAT_MESSAGES_LIMIT,
  fetchCloudDirectMessages,
  fetchIncomingCloudDirectMessages,
  pushCloudDirectMessage,
  fetchAllCloudProfiles,
  fetchCloudFollowGraph,
  pushCloudFollow,
  removeCloudFollow,
  CloudFollowEdge,
  pushCloudServer,
  deleteCloudServer,
  fetchCloudServerById,
  fetchCloudServersForUser,
  fetchCloudServerMembershipAudit,
  pushCloudServerInvite,
  removeCloudServerInvite,
  fetchCloudServerInvites,
  CloudServerInvite,
} from '../services/supabase';
import { LanguageCode, getTranslation } from '../locales/i18n';
import { getContrastTextColor } from '../utils/trackUtils';
import { SpyJamIcon } from './Icons';

interface CommunityViewProps {
  currentUser: User | null;
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track, customQueue?: Track[]) => void;
  onPauseTrack?: () => void;
  onOpenAuth?: () => void;
  accentColor?: string;
  language?: LanguageCode;
  themeMode?: 'dark' | 'light';
  onActiveServerChange?: (server: CommunityServer | null) => void;
  onIncomingVoiceCall?: () => void;
}

// Default DJ stage track (Cyberpunk Synthwave Radio 24/7)
const DEFAULT_DJ_TRACK: Track = {
  id: 'yt_after_dark',
  title: 'After Dark (Cyberpunk Radio 24/7)',
  artist: 'Mr.Kitty',
  album: 'Cyberpunk Synthwave 24/7',
  duration_secs: 259,
  path_or_url: 'sVx1mJDeUj8',
  source: 'youtube',
  cover_art: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
};

// Available Resident DJ Bots for 24/7 Radio Voice Channels
const DJ_BOT_OPTIONS = [
  {
    id: 'usr_host',
    name: 'DJ CyberHawk',
    genre: 'Cyberpunk & Synthwave Radio 24/7',
    liveStreamId: '4xDzrJKXOOY',
    liveStreamTitle: '🔴 Synthwave Radio 24/7 (Lofi Girl)',
    backupStreams: [
      { id: '5yx6BWlEVcY', title: '🔴 ChillSynth FM 24/7 (Synthwave Radio)' },
      { id: '8GW6sLrK40k', title: '🔴 Resonance Retro Synth Radio' },
      { id: 'MV_3Dpw-BRY', title: '🔴 Kavinsky Nightcall Electro Radio' },
      { id: 'mky64VkgkME', title: '🔴 Memory Reboot Cyber Radio' },
    ],
    trackName: '🔴 Synthwave Radio 24/7 (Lofi Girl)',
    track: {
      id: 'yt_live_synthwave',
      title: 'Synthwave Radio 24/7 (Beats to Chill/Game to)',
      artist: 'Lofi Girl / CyberHawk',
      album: 'Synthwave 24/7 Live Radio',
      duration_secs: 0,
      path_or_url: '4xDzrJKXOOY',
      source: 'youtube' as const,
      cover_art: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
    },
    playlist: [
      DEFAULT_DJ_TRACK,
      {
        id: 'yt_resonance_cyber',
        title: 'Resonance',
        artist: 'HOME',
        album: 'Odyssey',
        duration_secs: 212,
        path_or_url: '8GW6sLrK40k',
        source: 'youtube' as const,
        cover_art: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=60',
      },
      {
        id: 'yt_nightcall',
        title: 'Nightcall',
        artist: 'Kavinsky',
        album: 'OutRun',
        duration_secs: 256,
        path_or_url: 'MV_3Dpw-BRY',
        source: 'youtube' as const,
        cover_art: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
      },
      {
        id: 'yt_memory_reboot',
        title: 'Memory Reboot',
        artist: 'VØJ, Narvent',
        album: 'Memory Reboot',
        duration_secs: 184,
        path_or_url: 'mky64VkgkME',
        source: 'youtube' as const,
        cover_art: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
      },
    ],
  },
  {
    id: 'usr_agent_01',
    name: 'NeonSamurai',
    genre: 'Phonk & Dark Bass Radio 24/7',
    liveStreamId: 'o4JHOGFnl18',
    liveStreamTitle: '🔴 Phonk Radio 24/7 (Warrior & Drift Phonk)',
    backupStreams: [
      { id: 'WbVpY4mR5Yw', title: '🔴 Drift Phonk Live 24/7 (Aggressive Bass)' },
      { id: 'PTZgxW_3LIQ', title: '🔴 Dxrk Phonk Radio Live' },
      { id: '8GW6sLrK40k', title: '🔴 Resonance Dark Bass Wave' },
      { id: 'w-sQRS-Um9k', title: '🔴 Metamorphosis Phonk Live' },
    ],
    trackName: '🔴 Phonk Radio 24/7 (Warrior & Drift Phonk)',
    track: {
      id: 'yt_live_phonk',
      title: 'Phonk Radio 24/7 (Warrior & Drift Phonk)',
      artist: 'Warrior Phonk / NeonSamurai',
      album: 'Phonk 24/7 Live Radio',
      duration_secs: 0,
      path_or_url: 'o4JHOGFnl18',
      source: 'youtube' as const,
      cover_art: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=60',
    },
    playlist: [
      {
        id: 'yt_resonance',
        title: 'Resonance (Phonk Radio 24/7)',
        artist: 'HOME',
        album: 'Odyssey',
        duration_secs: 212,
        path_or_url: '8GW6sLrK40k',
        source: 'youtube' as const,
        cover_art: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=60',
      },
      {
        id: 'yt_metamorphosis',
        title: 'Metamorphosis',
        artist: 'INTERWORLD',
        album: 'Metamorphosis',
        duration_secs: 142,
        path_or_url: 'w-sQRS-Um9k',
        source: 'youtube' as const,
        cover_art: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
      },
      {
        id: 'yt_rave_dxrk',
        title: 'RAVE',
        artist: 'Dxrk ダーク',
        album: 'RAVE',
        duration_secs: 169,
        path_or_url: 'PTZgxW_3LIQ',
        source: 'youtube' as const,
        cover_art: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=60',
      },
      {
        id: 'yt_murder_in_my_mind',
        title: 'Murder In My Mind',
        artist: 'Kordhell',
        album: 'Murder In My Mind',
        duration_secs: 145,
        path_or_url: 'w-sQRS-Um9k',
        source: 'youtube' as const,
        cover_art: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
      },
    ],
  },
  {
    id: 'usr_luna_lofi',
    name: 'Luna Lofi',
    genre: 'Lofi Girl Chill Radio 24/7',
    liveStreamId: 'jfKfPfyJRdk',
    liveStreamTitle: '🔴 Lofi Girl Radio 24/7 (Beats to Relax/Study to)',
    backupStreams: [
      { id: '5qap5aO4i9A', title: '🔴 Lofi Girl Radio 24/7 (Beats to Sleep/Chill to)' },
      { id: 'rFZHOHl-L8A', title: '🔴 Lofi Hip Hop Chillhop Radio' },
      { id: 'N_7nL37m33s', title: '🔴 WYS Snowman Lofi Chill Session' },
      { id: '9_gkpYORQLU', title: '🔴 Jinsang Solitude Lofi Beats' },
    ],
    trackName: '🔴 Lofi Girl Radio 24/7 (Beats to Relax/Study to)',
    track: {
      id: 'yt_live_lofigirl',
      title: 'Lofi Hip Hop Radio 24/7 (Beats to Relax/Study to)',
      artist: 'Lofi Girl / Luna Lofi',
      album: 'Lofi Girl 24/7 Live Radio',
      duration_secs: 0,
      path_or_url: 'rFZHOHl-L8A',
      source: 'youtube' as const,
      cover_art: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
    },
    playlist: [
      {
        id: 'yt_snowman',
        title: 'Snowman (Lofi Chill Radio 24/7)',
        artist: 'WYS',
        album: '1 Am. Study Session',
        duration_secs: 184,
        path_or_url: 'N_7nL37m33s',
        source: 'youtube' as const,
        cover_art: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
      },
      {
        id: 'yt_lofi_sleep',
        title: 'Affection',
        artist: 'Jinsang',
        album: 'Solitude',
        duration_secs: 135,
        path_or_url: '9_gkpYORQLU',
        source: 'youtube' as const,
        cover_art: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
      },
      {
        id: 'yt_lofi_again',
        title: 'Again',
        artist: 'Wun Two',
        album: 'Penthouse',
        duration_secs: 128,
        path_or_url: '3L-L_e71618',
        source: 'youtube' as const,
        cover_art: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
      },
      {
        id: 'yt_lofi_eternal',
        title: 'Eternal Youth',
        artist: 'RUDE',
        album: 'Eternal Youth',
        duration_secs: 204,
        path_or_url: '1fK3A090rGg',
        source: 'youtube' as const,
        cover_art: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
      },
    ],
  },
  {
    id: 'custom',
    name: 'Custom Station',
    genre: 'Custom Stream / Video 24/7',
    liveStreamId: 'jfKfPfyJRdk',
    liveStreamTitle: 'Luồng YouTube 24/7 (Lofi Chill)',
    backupStreams: [
      { id: '5yx6BWlEVcY', title: '🔴 ChillSynth FM 24/7' },
      { id: '5qap5aO4i9A', title: '🔴 Lofi Girl Sleep Beats 24/7' },
    ],
    trackName: 'Custom Station Bot',
    track: {
      id: 'yt_custom_station',
      title: 'Custom Station Stream',
      artist: 'Custom Station Bot',
      album: 'Custom 24/7 Station',
      duration_secs: 0,
      path_or_url: 'jfKfPfyJRdk',
      source: 'youtube' as const,
      cover_art: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
    },
    playlist: [],
  },
];

// Các thẻ (tag) sở thích mặc định cho máy chủ (khi chủ server chưa tạo tag riêng)
export const DEFAULT_SERVER_TAGS: CommunityServerTag[] = [
  { id: 'tag_music', name: '🎵 Yêu Âm Nhạc', color: '#00E5FF' },
  { id: 'tag_chill', name: '☕ Chill / Lofi', color: '#10b981' },
  { id: 'tag_gamer', name: '🎮 Gamer', color: '#8b5cf6' },
  { id: 'tag_phonk', name: '🔥 Phonk Master', color: '#ef4444' },
  { id: 'tag_synthwave', name: '⚡ Cyberpunk', color: '#f59e0b' },
  { id: 'tag_nightowl', name: '🌙 Cú Đêm', color: '#a855f7' },
  { id: 'tag_audiophile', name: '🎧 Audiophile', color: '#ec4899' },
  { id: 'tag_beatmaker', name: '🎹 Beatmaker', color: '#3b82f6' },
];

// Danh sách tag đặc trưng được đánh dấu riêng cho từng DJ bot phát nhạc
export const DJ_BOT_TAGS: Record<string, CommunityServerTag[]> = {
  usr_host: [
    { id: 'bot_tag_radio', name: '📻 24/7 Radio', color: '#00E5FF' },
    { id: 'bot_tag_synth', name: '⚡ Synthwave', color: '#f59e0b' },
    { id: 'bot_tag_resident', name: '🎧 Resident DJ', color: '#a855f7' },
  ],
  usr_agent_01: [
    { id: 'bot_tag_radio', name: '📻 24/7 Radio', color: '#00E5FF' },
    { id: 'bot_tag_phonk', name: '🔥 Phonk Bass', color: '#ef4444' },
    { id: 'bot_tag_drift', name: '🏎️ Drift Beats', color: '#f97316' },
  ],
  usr_luna_lofi: [
    { id: 'bot_tag_radio', name: '📻 24/7 Radio', color: '#00E5FF' },
    { id: 'bot_tag_lofi', name: '☕ Lofi Chill', color: '#10b981' },
    { id: 'bot_tag_study', name: '📚 Relax & Study', color: '#06b6d4' },
  ],
  usr_music_bot: [
    { id: 'bot_tag_ondemand', name: '🎵 On-Demand DJ', color: '#10b981' },
    { id: 'bot_tag_queue', name: '📑 Music Queue', color: '#00E5FF' },
    { id: 'bot_tag_commands', name: '⚡ /p /sk /st', color: '#a855f7' },
  ],
  custom: [
    { id: 'bot_tag_custom', name: '🎙️ Custom Station', color: '#f59e0b' },
    { id: 'bot_tag_youtube', name: '▶️ YouTube Stream', color: '#ef4444' },
    { id: 'bot_tag_loop', name: '🔁 24/7 Loop/Live', color: '#00E5FF' },
  ],
};

const getServerTags = (server: CommunityServer): CommunityServerTag[] => {
  const custom = server.tags || [];
  const map = new Map<string, CommunityServerTag>();
  // Luôn đảm bảo có các tag mặc định
  DEFAULT_SERVER_TAGS.forEach(t => map.set(t.id, t));
  // Sau đó ghi đè hoặc bổ sung tag tùy chỉnh của máy chủ
  custom.forEach(t => map.set(t.id, t));
  return Array.from(map.values());
};

export const getCleanMemberUsername = (
  member: { id: string; name?: string; username?: string; userProfile?: any },
  registeredUsersList: CommunityUserProfile[] = [],
  currentLoggedInUser: any = null
): string => {
  const raw = member.username || member.userProfile?.username;
  if (raw && !/^[0-9a-f\-]{12,}$/i.test(raw) && raw !== 'me' && raw !== 'usr_me') {
    return raw.startsWith('@') ? raw.slice(1) : raw;
  }
  const registered = registeredUsersList.find(u => u.id === member.id);
  if (registered?.username && !/^[0-9a-f\-]{12,}$/i.test(registered.username)) {
    return registered.username;
  }
  const candidateName = member.name || member.userProfile?.display_name || '';
  const sanitized = candidateName.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (sanitized && sanitized.length >= 2) {
    return sanitized;
  }
  if (currentLoggedInUser?.username && (member.id === 'usr_me' || member.id === currentLoggedInUser.id)) {
    return currentLoggedInUser.username;
  }
  return member.id.replace(/^usr_/, '');
};

// Chỉ 4 bot gốc của hệ thống mới được phép follow / có mối quan hệ bạn bè
export const CAN_FOLLOW_BOT_IDS = new Set(['usr_host', 'usr_agent_01', 'usr_luna_lofi', 'usr_music_bot']);

const getMemberTags = (
  userId: string,
  server: CommunityServer,
  currentUserId?: string,
  myParticipantId?: string,
  userNameOrDisplay?: string,
  realtimePresences?: Record<string, any>
): CommunityServerTag[] => {
  if (DJ_BOT_TAGS[userId]) {
    return DJ_BOT_TAGS[userId];
  }
  const allTags = getServerTags(server);
  const isMe =
    userId === 'usr_me' ||
    Boolean(currentUserId && userId === currentUserId) ||
    Boolean(myParticipantId && userId === myParticipantId);

  // 1. Kiểm tra tag được đồng bộ realtime qua Supabase presence
  const rtTags = realtimePresences?.[userId]?.tags || realtimePresences?.[userId]?.tag_ids;
  if (Array.isArray(rtTags) && rtTags.length > 0) {
    return allTags.filter(t => rtTags.includes(t.id));
  }

  const memberTags = server.member_tags || {};
  let tagIds: string[] = [];

  if (isMe) {
    const candidateKeys = [currentUserId, myParticipantId, 'usr_me', userId].filter(Boolean) as string[];
    for (const k of candidateKeys) {
      if (Array.isArray(memberTags[k]) && memberTags[k].length > 0) {
        tagIds = memberTags[k];
        break;
      }
    }
  } else {
    // Với người khác, chỉ lấy tag của đúng userId đó, tuyệt đối không lấy usr_me của máy mình
    if (Array.isArray(memberTags[userId]) && memberTags[userId].length > 0) {
      tagIds = memberTags[userId];
    } else if (userNameOrDisplay && Array.isArray(memberTags[userNameOrDisplay]) && memberTags[userNameOrDisplay].length > 0) {
      tagIds = memberTags[userNameOrDisplay];
    }
  }

  return allTags.filter(t => tagIds.includes(t.id));
};

export const HoverMarquee: React.FC<{ text: string; className?: string; title?: string }> = ({ text, className = '', title }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    if (containerRef.current && textRef.current) {
      setOverflows(textRef.current.scrollWidth > containerRef.current.clientWidth);
    }
  }, [text]);

  const handleMouseEnter = () => {
    if (containerRef.current && textRef.current) {
      setOverflows(textRef.current.scrollWidth > containerRef.current.clientWidth);
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const scrollDistance = (textRef.current?.scrollWidth || 0) - (containerRef.current?.clientWidth || 0);

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      title={title || text}
      className={`relative overflow-hidden whitespace-nowrap ${className}`}
    >
      <span
        ref={textRef}
        className="inline-block transition-transform ease-linear"
        style={{
          transform: isHovered && overflows && scrollDistance > 0 ? `translateX(-${scrollDistance}px)` : 'translateX(0px)',
          transitionDuration: overflows && scrollDistance > 0 ? `${Math.max(1.5, scrollDistance / 35)}s` : '0.3s',
        }}
      >
        {text}
      </span>
    </div>
  );
};

export interface SlashCommandItem {
  id: string;
  name: string;
  syntax: string;
  alias?: string;
  description: string;
  category: 'Âm nhạc' | 'Điều khiển' | 'Thông tin';
  insertText: string;
}

export const BOT_SLASH_COMMANDS: SlashCommandItem[] = [
  {
    id: 'cmd_play',
    name: '/play',
    syntax: '/play [@id_bot] <tên bài hoặc link YouTube>',
    alias: '/p',
    description: 'Gọi bot yêu cầu đầu tiên (hoặc chỉ định @id_bot) vào phòng thoại phát nhạc',
    category: 'Âm nhạc',
    insertText: '/play ',
  },
  {
    id: 'cmd_p',
    name: '/p',
    syntax: '/p [@id_bot] <tên bài hoặc link YouTube>',
    alias: '/play',
    description: 'Lệnh tắt: Gọi bot đầu tiên hoặc /p @id_bot <tên bài / link> để phát nhạc',
    category: 'Âm nhạc',
    insertText: '/p ',
  },
  {
    id: 'cmd_skip',
    name: '/skip',
    syntax: '/skip [@id_bot]',
    alias: '/sk',
    description: 'Bỏ qua bài hiện tại, phát bài tiếp theo trong hàng đợi',
    category: 'Điều khiển',
    insertText: '/skip',
  },
  {
    id: 'cmd_sk',
    name: '/sk',
    syntax: '/sk [@id_bot]',
    alias: '/skip',
    description: 'Lệnh tắt: Bỏ qua bài hát hiện tại',
    category: 'Điều khiển',
    insertText: '/sk',
  },
  {
    id: 'cmd_stop',
    name: '/stop',
    syntax: '/stop [@id_bot]',
    alias: '/st',
    description: 'Dừng phát nhạc, dọn sạch hàng đợi & bot rời phòng thoại',
    category: 'Điều khiển',
    insertText: '/stop',
  },
  {
    id: 'cmd_st',
    name: '/st',
    syntax: '/st [@id_bot]',
    alias: '/stop',
    description: 'Lệnh tắt: Dừng phát nhạc và bot rời phòng thoại',
    category: 'Điều khiển',
    insertText: '/st',
  },
  {
    id: 'cmd_queue',
    name: '/queue',
    syntax: '/queue [@id_bot]',
    alias: '/q',
    description: 'Xem danh sách bài hát đang chờ trong hàng đợi',
    category: 'Thông tin',
    insertText: '/queue',
  },
  {
    id: 'cmd_q',
    name: '/q',
    syntax: '/q [@id_bot]',
    alias: '/queue',
    description: 'Lệnh tắt: Xem danh sách hàng đợi',
    category: 'Thông tin',
    insertText: '/q',
  },
  {
    id: 'cmd_pause',
    name: '/pause',
    syntax: '/pause [@id_bot]',
    description: 'Tạm dừng phát nhạc trong phòng thoại',
    category: 'Điều khiển',
    insertText: '/pause',
  },
  {
    id: 'cmd_resume',
    name: '/resume',
    syntax: '/resume [@id_bot]',
    description: 'Tiếp tục phát nhạc đang tạm dừng',
    category: 'Điều khiển',
    insertText: '/resume',
  },
  {
    id: 'cmd_loop',
    name: '/loop',
    syntax: '/loop [@id_bot]',
    alias: '/l',
    description: 'Bật hoặc tắt chế độ phát lặp lại bài hát hiện tại (Single Track Loop)',
    category: 'Điều khiển',
    insertText: '/loop',
  },
  {
    id: 'cmd_l',
    name: '/l',
    syntax: '/l [@id_bot]',
    alias: '/loop',
    description: 'Lệnh tắt: Bật/tắt lặp lại bài hát hiện tại',
    category: 'Điều khiển',
    insertText: '/l',
  },
  {
    id: 'cmd_help',
    name: '/help',
    syntax: '/help',
    description: 'Xem hướng dẫn sử dụng bot và danh sách câu lệnh',
    category: 'Thông tin',
    insertText: '/help',
  },
];

// Helper trích xuất video ID 11 ký tự từ link YouTube hoặc chuỗi ID (hỗ trợ watch, live, embed, shorts, youtu.be)
export const extractYouTubeId = (urlOrQuery: string): string | null => {
  if (!urlOrQuery) return null;
  const trimmed = urlOrQuery.trim();
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|live\/|shorts\/))([\w-]{11})/;
  const match = trimmed.match(regExp);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const v = urlObj.searchParams.get('v');
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1];
    if (lastPart && /^[a-zA-Z0-9_-]{11}$/.test(lastPart)) return lastPart;
  } catch {}
  return null;
};

// Helper nén ảnh gửi chat client-side (< 250KB JPEG) để tối ưu truyền realtime và localStorage
const compressChatImageFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1200;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(e.target?.result as string);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Registered Operatives in Spytify Network
const INITIAL_USERS: CommunityUserProfile[] = [
  {
    id: 'usr_host',
    username: 'cyberhawk',
    display_name: 'DJ CyberHawk',
    avatar: null,
    role: 'DJ / HOST',
    status: 'online',
    bio: 'Resident DJ tại Cyber Lounge 2077. Chuyên dòng nhạc Synthwave, Cyberpunk Beats & Lofi chill 320Kbps.',
    listening: 'After Dark - Mr.Kitty',
    listeningTrack: DEFAULT_DJ_TRACK,
    isHost: true,
    followsCurrentUser: false,
    joinedAt: '2024-01-15',
  },
  {
    id: 'usr_agent_01',
    username: 'neonsamurai',
    display_name: 'NeonSamurai',
    avatar: null,
    role: 'PRODUCER',
    status: 'online',
    bio: 'Cyberpunk Sound Designer & Beatsmith. Đam mê Synth & Phonk bass bùng nổ.',
    listening: '🔴 Phonk Radio 24/7 (Warrior & Drift Phonk)',
    listeningTrack: {
      id: 'yt_live_phonk',
      title: 'Phonk Radio 24/7 (Warrior & Drift Phonk)',
      artist: 'Warrior Phonk / NeonSamurai',
      album: 'Phonk 24/7 Live Radio',
      duration_secs: 0,
      path_or_url: 'o4JHOGFnl18',
      source: 'youtube',
      cover_art: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=60',
    },
    isHost: false,
    followsCurrentUser: false,
    joinedAt: '2024-03-20',
  },
  {
    id: 'usr_luna_lofi',
    username: 'lunalofi',
    display_name: 'Luna Lofi',
    avatar: null,
    role: 'CHILL HOST',
    status: 'online',
    bio: 'Thưởng thức trà chiều, mưa rơi và những giai điệu Lofi êm đềm.',
    listening: '🔴 Lofi Girl Radio 24/7 (Beats to Relax/Study to)',
    listeningTrack: {
      id: 'yt_live_lofigirl',
      title: 'Lofi Hip Hop Radio 24/7 (Beats to Relax/Study to)',
      artist: 'Lofi Girl / Luna Lofi',
      album: 'Lofi Girl 24/7 Live Radio',
      duration_secs: 0,
      path_or_url: 'rFZHOHl-L8A',
      source: 'youtube',
      cover_art: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
    },
    isHost: false,
    followsCurrentUser: false,
    joinedAt: '2024-05-10',
  },
  {
    id: 'usr_music_bot',
    username: 'rythm',
    display_name: 'Rythm',
    avatar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
    role: 'ON-DEMAND DJ',
    status: 'online',
    bio: 'Bot phát nhạc theo yêu cầu. Dùng @Rythm /p [link hoặc tên bài hát], /st (dừng), /sk (skip), /q (hàng đợi).',
    listening: null,
    listeningTrack: null,
    isHost: false,
    followsCurrentUser: false,
    joinedAt: '2024-06-01',
  },
  {
    id: 'usr_ghost_op',
    username: 'ghostop',
    display_name: 'GhostOperative',
    avatar: null,
    role: 'AGENT',
    status: 'offline',
    bio: 'Thành viên yêu âm nhạc Spytify. Âm nhạc là chìa khóa mở mọi cánh cửa.',
    listening: null,
    listeningTrack: null,
    isHost: false,
    followsCurrentUser: false,
    joinedAt: '2024-07-02',
  },
];

// Gentle Discord-style connection and disconnection sounds
function playAudioChime(type: 'join' | 'leave') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'join') {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    } else {
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    }
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch {}
}

// Fallback placeholder when user has not created any custom server yet
const EMPTY_SERVER_FALLBACK: CommunityServer = {
  id: 'srv_none',
  name: 'Chưa có máy chủ',
  description: 'Nhấn dấu (+) ở thanh bên trái để tự tạo máy chủ của bạn.',
  icon: '🎧',
  badge: '',
  accent_color: '#00E5FF',
  channels: [
    { id: 'ch_none_gen', name: 'general-chat', type: 'text', topic: 'Kênh trò chuyện chung' },
    { id: 'ch_none_voice', name: 'Phòng Thoại Voice', type: 'voice', topic: 'Phòng đàm thoại thời gian thực' },
  ],
  is_custom: false,
  owner_id: '',
  member_ids: [],
  moderator_ids: [],
};

// Server Template Presets for Custom Server Creator
const SERVER_PRESETS = [
  {
    key: 'cyber',
    label: 'Cyber Lounge',
    icon: '⚡',
    color: '#00E5FF',
    desc: 'Trạm phát Synthwave, Cyberpunk Beats & Giác đấu ban đêm.',
    defaultChannels: [
      { name: 'general-chat', type: 'text' as const },
      { name: 'Phòng Thoại Voice', type: 'voice' as const },
    ]
  },
  {
    key: 'lofi',
    label: 'Lofi Chill Hub',
    icon: '☕',
    color: '#00FF66',
    desc: 'Không gian thư thái, học tập, đọc sách và tập trung cao độ.',
    defaultChannels: [
      { name: 'chill-chat', type: 'text' as const },
      { name: 'Phòng Học Tập & Chill', type: 'voice' as const },
    ]
  },
  {
    key: 'club',
    label: 'Bar & Nightclub',
    icon: '🍸',
    color: '#E040FB',
    desc: 'Quầy Bar sôi động, EDM, Deep House, Bassline tiệc tùng.',
    defaultChannels: [
      { name: 'quay-bar-talk', type: 'text' as const },
      { name: 'VIP Lounge Voice Call', type: 'voice' as const },
    ]
  },
  {
    key: 'custom',
    label: 'Tự do sáng tạo',
    icon: '🎧',
    color: '#FF2A55',
    desc: 'Tự đặt tên, biểu tượng và màu neon theo cá tính riêng của bạn.',
    defaultChannels: [
      { name: 'general-talk', type: 'text' as const },
      { name: 'Voice Call Room', type: 'voice' as const },
    ]
  }
];

const sanitizeModeratorIds = (
  mods: unknown,
  ownerId?: string | null,
  kickedIds?: unknown,
  currentUserId?: string | null
): string[] => {
  if (!Array.isArray(mods)) return [];
  const kickedSet = new Set<string>(Array.isArray(kickedIds) ? kickedIds.filter(Boolean) : []);
  return Array.from(
    new Set(
      mods.filter(
        (id): id is string =>
          typeof id === 'string' &&
          Boolean(id) &&
          id !== ownerId &&
          !kickedSet.has(id) &&
          (!currentUserId || id !== 'usr_me')
      )
    )
  );
};

const resolveServerRoleFlags = (srv: CommunityServer, userId?: string | null) => {
  if (!srv || srv.id === 'srv_none') {
    return { isOwner: false, isMod: false, canManage: false, badge: 'MEMBER' as const };
  }
  const isOwner = userId
    ? srv.owner_id === userId
    : (!srv.owner_id || srv.owner_id === 'usr_me');
  const mods = Array.isArray(srv.moderator_ids) ? srv.moderator_ids : [];
  const isMod = Boolean(
    !isOwner &&
    (userId ? mods.includes(userId) : mods.includes('usr_me'))
  );
  const badge: 'OWNER' | 'MOD' | 'MEMBER' = isOwner ? 'OWNER' : isMod ? 'MOD' : 'MEMBER';
  return { isOwner, isMod, canManage: isOwner || isMod, badge };
};

const saveServerOrderIds = (userId: string | undefined | null, list: CommunityServer[]) => {
  if (!userId) return;
  try {
    localStorage.setItem(
      `spytify_server_order_${userId}`,
      JSON.stringify(list.filter(s => s.id !== 'srv_none').map(s => s.id))
    );
  } catch {}
};

const applySavedServerOrder = (userId: string | undefined | null, list: CommunityServer[]): CommunityServer[] => {
  if (!userId || list.length <= 1) return list;
  try {
    const raw = localStorage.getItem(`spytify_server_order_${userId}`);
    if (!raw) return list;
    const savedIds: string[] = JSON.parse(raw);
    if (!Array.isArray(savedIds) || savedIds.length === 0) return list;
    const rank = new Map<string, number>();
    savedIds.forEach((id, idx) => rank.set(id, idx));
    return [...list].sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const rb = rank.has(b.id) ? rank.get(b.id)! : Number.MAX_SAFE_INTEGER;
      return ra - rb;
    });
  } catch {
    return list;
  }
};

const loadUserServersFromStorage = (userId?: string | null): CommunityServer[] => {
  if (!userId) {
    try {
      // Xóa key chung cũ để khi đăng xuất không còn lưu trạng thái server
      localStorage.removeItem('spytify_user_servers');
    } catch {}
    return [];
  }
  try {
    const userKey = `spytify_user_servers_${userId}`;
    let saved = localStorage.getItem(userKey);
    const legacySaved = localStorage.getItem('spytify_user_servers');
    if (!saved && legacySaved) {
      saved = legacySaved;
      localStorage.removeItem('spytify_user_servers');
    } else if (legacySaved) {
      localStorage.removeItem('spytify_user_servers');
    }
    if (saved) {
      const migratedFlag = localStorage.getItem('spytify_custom_srv_zero_members_v1');
      const parsed: CommunityServer[] = JSON.parse(saved);
      const cleaned = parsed
        .filter(s => s.id.startsWith('srv_custom_') || s.is_custom)
        .filter(
          s =>
            !s.owner_id ||
            s.owner_id === 'usr_me' ||
            s.owner_id === userId ||
            (Array.isArray(s.member_ids) && (s.member_ids.includes(userId) || s.member_ids.includes('usr_me'))) ||
            (Array.isArray(s.moderator_ids) && s.moderator_ids.includes(userId))
        )
        .map(s => {
          const isOldDefaultMembers =
            !migratedFlag &&
            Array.isArray(s.member_ids) &&
            s.member_ids.length === 3 &&
            s.member_ids.includes('usr_me') &&
            s.member_ids.includes('usr_host') &&
            s.member_ids.includes('usr_agent_01');
          const resolvedOwnerId = !s.owner_id || s.owner_id === 'usr_me' ? userId : s.owner_id;
          const sanitizedMods = sanitizeModeratorIds(s.moderator_ids, resolvedOwnerId, s.kicked_ids, userId);
          const rawMembers = isOldDefaultMembers ? ['usr_me', userId] : s.member_ids || ['usr_me', userId];
          const memberSet = new Set(rawMembers);
          memberSet.add('usr_me');
          memberSet.add(userId);
          const draft: CommunityServer = {
            ...s,
            is_custom: true,
            owner_id: resolvedOwnerId,
            channels: s.channels.filter(c => c.type !== 'stage'),
            member_ids: Array.from(memberSet),
            moderator_ids: sanitizedMods,
          };
          const { badge } = resolveServerRoleFlags(draft, userId);
          return {
            ...draft,
            badge,
          };
        });
      const ordered = applySavedServerOrder(userId, cleaned);
      if (!migratedFlag) {
        localStorage.setItem('spytify_custom_srv_zero_members_v1', '1');
      }
      localStorage.setItem(userKey, JSON.stringify(ordered));
      return ordered;
    }
  } catch {}
  return [];
};

export const CommunityView: React.FC<CommunityViewProps> = ({
  currentUser,
  currentTrack,
  isPlaying,
  onPlayTrack,
  onPauseTrack,
  onOpenAuth,
  accentColor = '#FF2A55',
  language = 'vi',
  themeMode = 'dark',
  onActiveServerChange,
  onIncomingVoiceCall,
}) => {
  const isLight = themeMode === 'light';
  // Load user-created custom servers scoped strictly to logged-in user (empty when logged out)
  const [servers, setServers] = useState<CommunityServer[]>(() => loadUserServersFromStorage(currentUser?.id));

  const persistServers = (nextServers: CommunityServer[]) => {
    if (!currentUser?.id) return;
    try {
      localStorage.setItem(`spytify_user_servers_${currentUser.id}`, JSON.stringify(nextServers));
      localStorage.removeItem('spytify_user_servers');
    } catch {}
  };

  // Drag & Drop sắp xếp vị trí icon Server trên thanh bên trái
  const [draggedServerId, setDraggedServerId] = useState<string | null>(null);
  const [dragOverServerId, setDragOverServerId] = useState<string | null>(null);
  const [dragDropPosition, setDragDropPosition] = useState<'above' | 'below' | null>(null);
  const serverRailDragRef = useRef<{
    serverId: string;
    startX: number;
    startY: number;
    moved: boolean;
    overId: string | null;
    position: 'above' | 'below' | null;
  } | null>(null);
  const suppressServerClickIdRef = useRef<string | null>(null);

  const handleReorderServers = (fromId: string, toId: string, position: 'above' | 'below' = 'above') => {
    if (!fromId || !toId || fromId === toId) return;
    setServers(prev => {
      const fromIndex = prev.findIndex(s => s.id === fromId);
      const toIndex = prev.findIndex(s => s.id === toId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const next = [...prev];
      const [movedItem] = next.splice(fromIndex, 1);
      let insertIndex = next.findIndex(s => s.id === toId);
      if (insertIndex === -1) return prev;
      if (position === 'below') insertIndex += 1;
      next.splice(insertIndex, 0, movedItem);
      persistServers(next);
      saveServerOrderIds(currentUser?.id, next);
      return next;
    });
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const drag = serverRailDragRef.current;
      if (!drag) return;
      const dx = Math.abs(e.clientX - drag.startX);
      const dy = Math.abs(e.clientY - drag.startY);
      if (!drag.moved && dx < 6 && dy < 6) return;
      if (!drag.moved) {
        drag.moved = true;
        setDraggedServerId(drag.serverId);
      }
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const targetSlot = el?.closest('[data-server-rail-id]') as HTMLElement | null;
      const targetId = targetSlot?.getAttribute('data-server-rail-id') || null;
      if (targetSlot && targetId && targetId !== drag.serverId) {
        const rect = targetSlot.getBoundingClientRect();
        const pos: 'above' | 'below' = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
        drag.overId = targetId;
        drag.position = pos;
        setDragOverServerId(targetId);
        setDragDropPosition(pos);
      } else if (!targetId || targetId === drag.serverId) {
        drag.overId = null;
        drag.position = null;
        setDragOverServerId(null);
        setDragDropPosition(null);
      }
    };

    const handlePointerUp = () => {
      const drag = serverRailDragRef.current;
      if (!drag) return;
      serverRailDragRef.current = null;
      if (drag.moved) {
        suppressServerClickIdRef.current = drag.serverId;
        setTimeout(() => {
          if (suppressServerClickIdRef.current === drag.serverId) {
            suppressServerClickIdRef.current = null;
          }
        }, 120);
        if (drag.overId && drag.overId !== drag.serverId) {
          handleReorderServers(drag.serverId, drag.overId, drag.position || 'above');
        }
      }
      setDraggedServerId(null);
      setDragOverServerId(null);
      setDragDropPosition(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [currentUser?.id]);

  const [selectedServer, setSelectedServer] = useState<CommunityServer>(servers[0] || EMPTY_SERVER_FALLBACK);
  const [selectedChannel, setSelectedChannel] = useState<CommunityChannel>((servers[0] || EMPTY_SERVER_FALLBACK).channels[0]);
  const [messages, setMessages] = useState<CommunityMessage[]>(() => {
    if (!currentUser?.id) return [];
    try {
      const saved =
        localStorage.getItem(`spytify_server_messages_${currentUser.id}`) ||
        localStorage.getItem('spytify_server_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        }
      }
    } catch {}
    return [];
  });

  // Thêm tin nhắn mới vào server - giới hạn 80 tin nhắn độc lập cho từng server và bảo đảm thứ tự thời gian
  const appendServerMessage = (newMsg: CommunityMessage) => {
    setMessages(prev => {
      if (prev.some(m => m.id === newMsg.id)) return prev;
      const targetSrvId = newMsg.server_id || selectedServer.id;
      const thisSrvMsgs = prev.filter(m => (m.server_id || selectedServer.id) === targetSrvId);
      const otherSrvMsgs = prev.filter(m => (m.server_id || selectedServer.id) !== targetSrvId);

      const updatedThisSrv = [...thisSrvMsgs, newMsg]
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .slice(-MAX_CHAT_MESSAGES_LIMIT);

      const merged = [...otherSrvMsgs, ...updatedThisSrv].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      try {
        if (currentUser?.id) {
          localStorage.setItem(`spytify_server_messages_${currentUser.id}`, JSON.stringify(merged));
        }
      } catch {}
      return merged;
    });
  };
  const [inputText, setInputText] = useState('');
  const [attachCurrentTrack, setAttachCurrentTrack] = useState(false);

  // ──────── TẠO PHÒNG CHAT / PHÒNG THOẠI MỚI TRONG SERVER (RIÊNG BIỆT TỪNG SERVER) ────────
  const [creatingChannelState, setCreatingChannelState] = useState<{
    serverId: string;
    type: 'text' | 'voice';
  } | null>(null);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelIsRadio, setNewChannelIsRadio] = useState(false);
  const [newChannelDjBot, setNewChannelDjBot] = useState('usr_host');
  const [newChannelCustomUrl, setNewChannelCustomUrl] = useState('');
  const [newChannelCustomTitle, setNewChannelCustomTitle] = useState('');
  const [newChannelIsLoopSingle, setNewChannelIsLoopSingle] = useState(false);

  // ──────── SỬA LINK PHÁT SÓNG TRẠM YOUTUBE (CUSTOM STATION BOT / STREAM) ────────
  const [editingStationChannel, setEditingStationChannel] = useState<CommunityChannel | null>(null);
  const [editStationUrlDraft, setEditStationUrlDraft] = useState('');
  const [editStationTitleDraft, setEditStationTitleDraft] = useState('');
  const [editStationIsLoopDraft, setEditStationIsLoopDraft] = useState(false);
  const [editStationBotNameDraft, setEditStationBotNameDraft] = useState('');
  const [editStationBotAvatarDraft, setEditStationBotAvatarDraft] = useState('');

  // ──────── GỬI ẢNH CHAT & LIGHTBOX PREVIEW ────────
  const [pendingChatImage, setPendingChatImage] = useState<string | null>(null);
  const [pendingDmImage, setPendingDmImage] = useState<string | null>(null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const chatImageInputRef = useRef<HTMLInputElement | null>(null);
  const dmImageInputRef = useRef<HTMLInputElement | null>(null);

  // ──────── DISCORD-STYLE SCREEN SHARING (CHIA SẺ MÀN HÌNH NHIỀU NGƯỜI ĐỒNG THỜI) ────────
  type ScreenShareSession = {
    userId: string;
    userName: string;
    avatar?: string | null;
    stream: MediaStream;
  };
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShares, setScreenShares] = useState<Record<string, ScreenShareSession>>({});
  const [selectedScreenShareUserId, setSelectedScreenShareUserId] = useState<string | null>(null);
  const screenSharesList = useMemo(() => Object.values(screenShares), [screenShares]);
  const activeScreenShare =
    (selectedScreenShareUserId && screenShares[selectedScreenShareUserId]) ||
    screenSharesList[0] ||
    null;

  const upsertScreenShare = (session: ScreenShareSession, autoFocus = false) => {
    setScreenShares(prev => ({
      ...prev,
      [session.userId]: session,
    }));
    setSelectedScreenShareUserId(prev => (!prev || autoFocus ? session.userId : prev));
  };

  const removeScreenShare = (targetUserId: string) => {
    remoteScreenStreamsRef.current.delete(targetUserId);
    setScreenShares(prev => {
      if (!prev[targetUserId]) return prev;
      const next = { ...prev };
      delete next[targetUserId];
      return next;
    });
    setSelectedScreenShareUserId(prev => (prev === targetUserId ? null : prev));
  };

  const clearAllScreenShares = () => {
    remoteScreenStreamsRef.current.clear();
    setScreenShares({});
    setSelectedScreenShareUserId(null);
  };

  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteScreenStreamsRef = useRef<Map<string, MediaStream>>(new Map());

  // Đồng bộ luồng video chia sẻ màn hình vào thẻ video ngay khi đổi tab hoặc có stream mới
  useEffect(() => {
    if (screenVideoRef.current) {
      if (activeScreenShare?.stream) {
        if (screenVideoRef.current.srcObject !== activeScreenShare.stream) {
          screenVideoRef.current.srcObject = activeScreenShare.stream;
        }
        screenVideoRef.current.play().catch(() => {});
      } else {
        screenVideoRef.current.srcObject = null;
      }
    }
  }, [activeScreenShare?.userId, activeScreenShare?.stream]);
  const creatingChannelType =
    creatingChannelState && creatingChannelState.serverId === selectedServer.id
      ? creatingChannelState.type
      : null;

  // ──────── MODAL TẠO SERVER MỚI (DISCORD-STYLE STEP WIZARD) ────────
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createServerStep, setCreateServerStep] = useState<1 | 2 | 3>(1);
  const [newServerPreset, setNewServerPreset] = useState('cyber');
  const [newServerName, setNewServerName] = useState('My Cyber Lounge');
  const [newServerDesc, setNewServerDesc] = useState('Trạm phát sóng âm nhạc');
  const [newServerIcon, setNewServerIcon] = useState('⚡');
  const [newServerColor, setNewServerColor] = useState('#00E5FF');

  // ──────── CUSTOM BOT MODAL & STATE (CHIA THÀNH 2 LOẠI: BOT TRẠM LIVE 24/7 & BOT THEO YÊU CẦU) ────────
  const [isBotModalOpen, setIsBotModalOpen] = useState(false);
  const [editingBotTargetId, setEditingBotTargetId] = useState<string | null>(null);
  const [botDraftType, setBotDraftType] = useState<'station' | 'demand'>('station');
  const [botDraftName, setBotDraftName] = useState('');
  const [botDraftAvatar, setBotDraftAvatar] = useState('');
  const [botDraftTag, setBotDraftTag] = useState('DJ');
  const [botDraftListening, setBotDraftListening] = useState('');
  const [botDraftStreamUrl, setBotDraftStreamUrl] = useState('');
  const [botDraftBackupUrls, setBotDraftBackupUrls] = useState('');
  const [botDraftIsLoopSingle, setBotDraftIsLoopSingle] = useState(false);

  const getChannelName = (channel: CommunityChannel) => {
    return channel.name;
  };

  const getChannelTopic = (channel: CommunityChannel) => {
    if (channel.id === 'ch_cyber_gen') return getTranslation(language, 'community.generalChatTopic');
    if (channel.id === 'ch_cyber_share') return getTranslation(language, 'community.musicRadarTopic');
    if (channel.id === 'ch_cyber_voice') return getTranslation(language, 'community.agentVoiceTopic');
    return channel.topic;
  };

  // ──────── VOICE CALL STATE & SUPABASE SYNC ────────
  const [connectedVoiceChannel, setConnectedVoiceChannel] = useState<string | null>(null);
  const [connectedVoiceServerId, setConnectedVoiceServerId] = useState<string | null>(null);
  const connectedVoiceChannelRef = useRef<string | null>(null);
  connectedVoiceChannelRef.current = connectedVoiceChannel;
  const connectedVoiceServerIdRef = useRef<string | null>(null);
  connectedVoiceServerIdRef.current = connectedVoiceServerId;
  const handleLeaveVoiceCallRef = useRef<() => void>(() => {});
  const evictSelfFromKickedServerRef = useRef<(serverId: string, toastMsg?: string) => void>(() => {});
  const broadcastUserOfflineRef = useRef<() => void>(() => {});
  const broadcastUserOnlineRef = useRef<() => void>(() => {});
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);

  // ──────── ON-DEMAND MUSIC BOT (RYTHM / USR_MUSIC_BOT) RIÊNG BIỆT CHO TỪNG SERVER ────────
  const requestBotIframesRef = useRef<Record<string, HTMLIFrameElement | null>>({});
  const lastEndedBotTrackRef = useRef<Record<string, string>>({});
  const chatTextInputRef = useRef<HTMLInputElement | null>(null);

  type ServerDemandBotState = {
    currentTrack: RequestBotTrack | null;
    queue: RequestBotTrack[];
    isPlaying: boolean;
    isLooping: boolean;
    voiceChannelId: string | null;
    startedAt?: number;
  };

  const EMPTY_DEMAND_BOT_STATE: ServerDemandBotState = {
    currentTrack: null,
    queue: [],
    isPlaying: false,
    isLooping: false,
    voiceChannelId: null,
    startedAt: undefined,
  };

  const getDemandBotKey = (srvId: string, botId: string = 'usr_music_bot') => `${srvId}::${botId}`;
  const parseDemandBotKey = (key: string): { srvId: string; botId: string } => {
    const idx = key.indexOf('::');
    if (idx !== -1) {
      return { srvId: key.slice(0, idx), botId: key.slice(idx + 2) };
    }
    return { srvId: key, botId: 'usr_music_bot' };
  };

  const [serverRythmBots, setServerRythmBots] = useState<Record<string, ServerDemandBotState>>(() => {
    try {
      const s = localStorage.getItem('spytify_server_rythm_bots');
      if (s) return JSON.parse(s);
    } catch {}
    return {};
  });

  const serverRythmBotsRef = useRef(serverRythmBots);
  serverRythmBotsRef.current = serverRythmBots;

  const getServerRythmBotFromRecord = (
    all: Record<string, ServerDemandBotState>,
    srvId: string = selectedServer.id,
    botId: string = 'usr_music_bot'
  ): ServerDemandBotState => {
    const key = getDemandBotKey(srvId, botId);
    if (all[key]) return all[key];
    if (all[srvId] && (botId === 'usr_music_bot' || !Object.keys(all).some(k => k.startsWith(`${srvId}::`)))) {
      return all[srvId];
    }
    return EMPTY_DEMAND_BOT_STATE;
  };

  const getServerRythmBot = (srvId: string = selectedServer.id, botId: string = 'usr_music_bot'): ServerDemandBotState => {
    return getServerRythmBotFromRecord(serverRythmBots, srvId, botId);
  };

  const updateServerRythmBot = (
    srvId: string,
    botId: string,
    updater: (prev: ServerDemandBotState) => ServerDemandBotState
  ) => {
    setServerRythmBots(all => {
      const key = getDemandBotKey(srvId, botId);
      const current = getServerRythmBotFromRecord(all, srvId, botId);
      const next = updater(current);
      const updated = { ...all, [key]: next };
      if (updated[srvId] && (botId === 'usr_music_bot' || !Object.keys(all).some(k => k.startsWith(`${srvId}::`)))) {
        delete updated[srvId];
      }
      try {
        localStorage.setItem('spytify_server_rythm_bots', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const [slashDismissed, setSlashDismissed] = useState(false);
  const [selectedMentionBotIndex, setSelectedMentionBotIndex] = useState(0);
  const [mentionBotDismissed, setMentionBotDismissed] = useState(false);
  const [kickedRadioBots, setKickedRadioBots] = useState<Record<string, boolean>>({});

  // ──────── AUDIO & VOICE SETTINGS (MIC & SPEAKER) ────────
  const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState(false);
  const [audioSettingsTab, setAudioSettingsTab] = useState<'mic' | 'speaker' | 'bot' | 'processing'>('mic');
  const [micVolume, setMicVolume] = useState<number>(() => {
    try {
      const v = localStorage.getItem('spytify_mic_volume');
      return v ? Math.min(100, Math.max(0, parseInt(v, 10))) : 100;
    } catch {
      return 100;
    }
  });
  const [speakerVolume, setSpeakerVolume] = useState<number>(() => {
    try {
      const v = localStorage.getItem('spytify_speaker_volume');
      return v ? Math.min(100, Math.max(0, parseInt(v, 10))) : 100;
    } catch {
      return 100;
    }
  });
  const [micSensitivity, setMicSensitivity] = useState<number>(() => {
    try {
      const v = localStorage.getItem('spytify_mic_sensitivity');
      return v ? parseInt(v, 10) : 14;
    } catch {
      return 14;
    }
  });
  const [noiseSuppression, setNoiseSuppression] = useState<boolean>(() => {
    try {
      return localStorage.getItem('spytify_noise_suppression') !== 'false';
    } catch {
      return true;
    }
  });
  const [echoCancellation, setEchoCancellation] = useState<boolean>(() => {
    try {
      return localStorage.getItem('spytify_echo_cancellation') !== 'false';
    } catch {
      return true;
    }
  });

  // ──────── MEMBER LIST VISIBILITY (DISCORD STYLE) ────────
  const [isMemberListVisible, setIsMemberListVisible] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('spytify_member_list_visible');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleMemberList = () => {
    setIsMemberListVisible(prev => {
      const next = !prev;
      try {
        localStorage.setItem('spytify_member_list_visible', String(next));
      } catch {}
      return next;
    });
  };

  // Live Mic Test in Settings
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [testMicLevel, setTestMicLevel] = useState(0);
  const testStreamRef = useRef<MediaStream | null>(null);
  const testCtxRef = useRef<AudioContext | null>(null);
  const testAnimRef = useRef<number | null>(null);

  // Microphone stream & Web Audio Analyser references
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micGainRef = useRef<GainNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // My unique participant ID (persisted per session)
  const myParticipantIdRef = useRef<string>(
    currentUser?.id || 'guest_' + Math.random().toString(36).substring(2, 8)
  );

  // Voice call participants in current channel (Synced in Realtime via Supabase & Invites!)
  const [voiceParticipants, setVoiceParticipants] = useState<VoiceParticipant[]>([]);
  const voiceParticipantsRef = useRef<VoiceParticipant[]>([]);
  voiceParticipantsRef.current = voiceParticipants;

  // Floating Mini Profile Card on hover for members & bots
  const [hoveredProfile, setHoveredProfile] = useState<{
    member: {
      id: string;
      name: string;
      username?: string;
      avatar?: string | null;
      role?: string;
      status?: string;
      listening?: string | null;
      isHost?: boolean;
      thought?: string | null;
      custom_status?: string | null;
    };
    rect: DOMRect;
    tags: CommunityServerTag[];
    bio?: string;
  } | null>(null);
  const hoverTimeoutRef = useRef<any>(null);

  // Incoming Voice Call Invitation Modal (user must accept to join!)
  const [incomingVoiceInvite, setIncomingVoiceInvite] = useState<{
    callId?: string;
    isDmCall?: boolean;
    roomId?: string;
    fromUserId: string;
    fromUserName: string;
    fromUserAvatar?: string | null;
    targetUserId: string;
    targetUserName?: string;
    serverId: string;
    serverName: string;
    channelId: string;
    channelName: string;
    timestamp: number;
  } | null>(null);
  const incomingVoiceInviteRef = useRef<typeof incomingVoiceInvite>(null);
  incomingVoiceInviteRef.current = incomingVoiceInvite;

  // Local Mute for Me (Tắt tiếng cá nhân người khác khi họ ồn ào)
  const [locallyMutedUsers, setLocallyMutedUsers] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('spytify_locally_muted_users');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleToggleLocalMute = (targetUserId: string) => {
    setLocallyMutedUsers(prev => {
      const isMuting = !prev[targetUserId];
      const next = { ...prev, [targetUserId]: isMuting };
      try {
        localStorage.setItem('spytify_locally_muted_users', JSON.stringify(next));
      } catch {}
      const el = remoteAudioRef.current.get(targetUserId);
      if (el) {
        el.muted = isDeafened || isMuting;
        el.volume = isMuting ? 0 : Math.max(0, Math.min(1, (speakerVolume / 100) * ((userVolumes[targetUserId] ?? 100) / 100)));
      }
      // Nếu là DJ Bot hệ thống / Loa phát thanh phòng thoại: Tắt hoặc mở lại tiếng tức thì
      const isTargetBot =
        ACTIVE_BOT_IDS.has(targetUserId) ||
        targetUserId === currentVoiceDjBot?.id ||
        targetUserId === connectedVoiceChannelObj?.dj_bot_id ||
        targetUserId === 'usr_host' ||
        targetUserId === 'usr_agent_01' ||
        targetUserId === 'usr_luna_lofi';
      if (isTargetBot) {
        if (isMuting) {
          sendBotCmd('mute');
          sendBotCmd('setVolume', [0]);
          sendBotCmd('pauseVideo');
          setIsBotSpeaking(false);
          // Nếu người dùng đang nghe bài của bot trên player chính Spytify, tạm dừng luôn
          const botOpt = DJ_BOT_OPTIONS.find(d => d.id === targetUserId);
          if (botOpt && currentTrack && (currentTrack.id === botOpt.track.id || currentTrack.path_or_url === botOpt.liveStreamId)) {
            onPauseTrack?.();
          }
        } else {
          const botUserVol = userVolumes[targetUserId] ?? 80;
          const eff = (isDeafened || isBotMuted) ? 0 : Math.round(botUserVol * (speakerVolume / 100));
          if (eff > 0) {
            sendBotCmd('unMute');
            sendBotCmd('setVolume', [eff]);
            sendBotCmd('seekTo', [99999999, true]);
            sendBotCmd('playVideo');
            setIsBotSpeaking(true);
          }
        }
      }
      return next;
    });
  };

  const startPrivateCallRef = useRef<(friend: CommunityUserProfile, opts?: { isAnswering?: boolean }) => Promise<void>>(async () => {});

  const handleAcceptVoiceInvite = () => {
    if (!incomingVoiceInvite) return;
    const inv = incomingVoiceInvite;
    setIncomingVoiceInvite(null);

    // Nếu là cuộc gọi thoại riêng 1-1 (DM Private Call): mở đúng khung DM của người gọi và kết nối trực tiếp topic dm_private
    if (inv.isDmCall || inv.serverId === 'dm_private') {
      const existingFriend = registeredUsers.find(u => u.id === inv.fromUserId);
      const callerProfile: CommunityUserProfile = existingFriend || {
        id: inv.fromUserId,
        username: inv.fromUserName || 'operative',
        display_name: inv.fromUserName || 'Người dùng',
        avatar: inv.fromUserAvatar || null,
        role: 'THÀNH VIÊN',
        status: 'online',
        bio: 'Thành viên Spytify từ hệ thống cộng đồng.',
        listening: null,
        listeningTrack: null,
        isHost: false,
        followsCurrentUser: Boolean(followersOfMeMap[inv.fromUserId]),
      };
      setIsFriendsTabActive(true);
      setActiveDmFriend(callerProfile);
      startPrivateCallRef.current(callerProfile, { isAnswering: true }).catch(() => {});
      return;
    }

    // Chuyển sang máy chủ của lời mời nếu khác máy chủ hiện tại
    const targetServer = servers.find(s => s.id === inv.serverId);
    if (targetServer && targetServer.id !== selectedServer.id) {
      setSelectedServer(targetServer);
      setIsFriendsTabActive(false);
    }
    const targetChannel = (targetServer || selectedServer).channels.find(c => c.id === inv.channelId);
    handleJoinVoiceCall(inv.channelId, targetChannel);
    playAudioChime('join');
  };

  const handleDeclineVoiceInvite = () => {
    const inv = incomingVoiceInvite;
    setIncomingVoiceInvite(null);
    if (inv && currentUser) {
      globalSocialChannelRef.current?.send({
        type: 'broadcast',
        event: 'voice_call_declined',
        payload: {
          callId: inv.callId,
          channelId: inv.channelId,
          serverId: inv.serverId,
          isDmCall: Boolean(inv.isDmCall || inv.serverId === 'dm_private'),
          fromUserId: inv.fromUserId,
          declinedByUserId: currentUser.id,
          declinedByName: currentUser.display_name || currentUser.username || 'Người dùng',
        },
      });
    }
  };

  // Right-click context menu for online members
  const [memberMenu, setMemberMenu] = useState<{
    x: number;
    y: number;
    member: {
      id: string;
      name: string;
      avatar?: string | null;
      role: string;
      listening: string | null;
      isHost?: boolean;
      status?: string;
      listeningTrack?: Track | null;
    };
    fromVoice?: boolean;
  } | null>(null);

  // Right-click context menu for channels (Text & Voice)
  const [channelContextMenu, setChannelContextMenu] = useState<{
    x: number;
    y: number;
    channel: CommunityChannel;
  } | null>(null);

  // Floating notification toast for voice actions
  const [voiceToast, setVoiceToast] = useState<string | null>(null);
  const showVoiceToast = (msg: string) => {
    setVoiceToast(msg);
    setTimeout(() => setVoiceToast(prev => (prev === msg ? null : prev)), 3500);
  };

  // Track start time for Rythm bot to calculate continuous real-time playback
  const requestBotTrackStartedAtRef = useRef<number>(0);

  useEffect(() => {
    const handleCloseMenu = () => {
      setMemberMenu(null);
      setChannelContextMenu(null);
    };
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  const handleInviteMemberToVoice = (member: { id: string; name: string; isHost?: boolean }) => {
    const defaultVoiceCh = selectedServer.channels.find(c => c.type === 'voice') || selectedChannel;
    const targetVoiceChId =
      connectedVoiceServerId === selectedServer.id && connectedVoiceChannel
        ? connectedVoiceChannel
        : defaultVoiceCh.id;

    // "các bot live stream nếu đã được phân vào live station thì nếu mời thì sẽ không hợp lệ"
    const assignedLiveStation = selectedServer.channels.find(
      c => c.type === 'voice' && c.is_radio && (c.dj_bot_id === member.id || (!c.dj_bot_id && member.id === 'usr_host'))
    );
    if (assignedLiveStation) {
      showVoiceToast(
        language === 'vi'
          ? `Bot "${member.name}" đã được phân bổ cho Trạm Live "${assignedLiveStation.name}". Không thể mời sang phòng thoại khác!`
          : `Bot "${member.name}" is dedicated to Live Station "${assignedLiveStation.name}". Cannot invite to another room!`
      );
      setMemberMenu(null);
      return;
    }

    // If not currently in this server's voice channel, join voice first!
    if (connectedVoiceServerId !== selectedServer.id || !connectedVoiceChannel) {
      handleJoinVoiceCall(targetVoiceChId);
    }

    // Nếu là DJ Bot hệ thống: Cho vào phòng đàm thoại ngay lập tức
    if (ACTIVE_BOT_IDS.has(member.id) || member.isHost) {
      const newVp: VoiceParticipant = {
        id: member.id,
        name: member.name,
        username: member.id.replace('usr_', ''),
        avatar: null,
        isMuted: false,
        isDeafened: false,
        isSpeaking: true,
        isHost: true,
        isBot: true,
        serverId: selectedServer.id,
        channelId: targetVoiceChId,
      };

      setVoiceParticipants(prev => {
        const withoutOld = prev.filter(p => !(p.id === member.id && (p.serverId || selectedServer.id) === selectedServer.id));
        return [...withoutOld, newVp];
      });

      playAudioChime('join');
      setMemberMenu(null);
      return;
    }

    // Nếu là Người dùng (Human): Gửi lời mời qua broadcast -> Bên kia phải nhấn CHẤP NHẬN mới vào!
    const targetChannel = selectedServer.channels.find(c => c.id === targetVoiceChId) || defaultVoiceCh;
    const invitePayload = {
      fromUserId: myParticipantIdRef.current,
      fromUserName: currentUser?.display_name || 'Người dùng',
      fromUserAvatar: currentUser?.avatar || null,
      targetUserId: member.id,
      targetUserName: member.name,
      serverId: selectedServer.id,
      serverName: selectedServer.name,
      channelId: targetVoiceChId,
      channelName: targetChannel?.name || 'Phòng Thoại Voice',
      timestamp: Date.now(),
    };

    activeChannelRef.current?.send({
      type: 'broadcast',
      event: 'voice_call_invite',
      payload: invitePayload,
    });
    globalSocialChannelRef.current?.send({
      type: 'broadcast',
      event: 'voice_call_invite',
      payload: invitePayload,
    });

    setMemberMenu(null);
  };

  const handleRemoveMemberFromVoice = (memberId: string) => {
    // Chỉ Chủ Server (Owner) hoặc Điều hành viên (Mod) mới có quyền kick thành viên khỏi voice
    if (!isServerOwner && !isServerMod && !canManageServer) return;
    setVoiceParticipants(prev =>
      prev.filter(p => !(p.id === memberId && (!p.serverId || p.serverId === selectedServer.id)))
    );
    const kickPayload = {
      targetUserId: memberId,
      serverId: selectedServer.id,
      channelId: connectedVoiceChannel,
      kickedBy: currentUser?.display_name || 'Quản trị viên',
    };
    activeChannelRef.current?.send({
      type: 'broadcast',
      event: 'voice_kick',
      payload: kickPayload,
    });
    globalSocialChannelRef.current?.send({
      type: 'broadcast',
      event: 'voice_kick',
      payload: kickPayload,
    });
    playAudioChime('leave');
    setMemberMenu(null);
  };

  const getEffectiveVoiceParticipants = (channel: CommunityChannel): VoiceParticipant[] => {
    const myId = currentUser?.id;
    const list = voiceParticipants.filter(
      p =>
        p.id !== myParticipantIdRef.current &&
        (!myId || p.id !== myId) &&
        p.id !== 'usr_me' &&
        (!p.serverId || p.serverId === selectedServer.id) &&
        (!p.channelId || p.channelId === channel.id)
    );
    if (channel.is_radio) {
      const djId = channel.dj_bot_id || 'usr_host';
      const hasDj = list.some(p => p.id === djId);
      if (!hasDj) {
        const djOpt = DJ_BOT_OPTIONS.find(d => d.id === djId) || DJ_BOT_OPTIONS[0];
        const botProfile = registeredUsers.find(u => u.id === djId) || INITIAL_USERS.find(u => u.id === djId);
        const resolvedBotName = channel.custom_bot_name || (djId === 'custom' ? (channel.custom_stream_title ? `${channel.custom_stream_title} DJ` : 'Custom Station Bot') : (botProfile?.display_name || djOpt.name));
        list.unshift({
          id: djId,
          name: resolvedBotName,
          username: botProfile?.username || resolvedBotName.toLowerCase().replace(/\s+/g, ''),
          avatar: channel.custom_bot_avatar || botProfile?.avatar || null,
          isMuted: isBotMuted,
          isDeafened: false,
          isSpeaking: isConnectedVoiceRadio && (channel.id === connectedVoiceChannel) ? isBotSpeaking : true,
          isHost: true,
          isBot: true,
          listening: channel.custom_stream_title || djOpt.liveStreamTitle || djOpt.trackName,
          listeningTrack: (() => {
            const customVid = channel.custom_stream_url ? extractYouTubeId(channel.custom_stream_url) : null;
            if (customVid) {
              return {
                id: `yt_station_${djId}`,
                title: channel.custom_stream_title || channel.name || resolvedBotName,
                artist: resolvedBotName,
                album: 'Spytify 24/7 Live Radio',
                duration_secs: 0,
                path_or_url: customVid,
                source: 'youtube' as const,
                cover_art: 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?w=500&auto=format&fit=crop&q=60',
              };
            }
            return djOpt.track;
          })(),
          serverId: selectedServer.id,
          channelId: channel.id,
        });
      }
    }

    // On-Demand Music Bots (hiển thị tất cả Bot Yêu Cầu đang giữ phòng / phát nhạc trên Server, kể cả khi người dùng đã out)
    demandMusicBots.forEach((dbot: CommunityUserProfile) => {
      const dbotState = getServerRythmBot(selectedServer.id, dbot.id);
      if (dbotState.voiceChannelId === channel.id && dbotState.currentTrack) {
        const idx = list.findIndex(p => p.id === dbot.id);
        const isDbotLocallyMuted = Boolean(locallyMutedUsers[dbot.id]);
        const botParticipant: VoiceParticipant = {
          id: dbot.id,
          name: dbot.display_name || 'Rythm',
          username: dbot.username || 'rythm',
          avatar: dbot.avatar || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
          isMuted: isDbotLocallyMuted,
          isDeafened: false,
          isSpeaking: dbotState.isPlaying && !isDbotLocallyMuted,
          isHost: false,
          isBot: true,
          role: dbot.role || 'ON-DEMAND',
          serverId: selectedServer.id,
          channelId: channel.id,
          listening: `🎶 ${dbotState.currentTrack.title} - ${dbotState.currentTrack.artist}`,
          listeningTrack: {
            id: dbotState.currentTrack.id,
            title: dbotState.currentTrack.title,
            artist: dbotState.currentTrack.artist,
            album: 'On-Demand Music Queue',
            duration_secs: 180,
            path_or_url: dbotState.currentTrack.url_or_id,
            source: 'youtube' as const,
            cover_art: dbotState.currentTrack.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
          },
        };
        if (idx >= 0) {
          list[idx] = botParticipant;
        } else {
          list.push(botParticipant);
        }
      }
    });

    return list;
  };

  // Live Stage session state with authentic DJ CyberHawk stream
  const [stageSession, setStageSession] = useState<StageSession>({
    server_id: (servers[0] || EMPTY_SERVER_FALLBACK).id,
    channel_id: 'ch_cyber_stage',
    host_user_id: 'usr_host',
    host_name: 'DJ CyberHawk',
    current_track: DEFAULT_DJ_TRACK,
    position_secs: 42,
    is_playing: true,
    listener_count: 14,
    updated_at: Date.now(),
  });

  // ──────── REGISTERED USERS & MUTUAL FOLLOW FRIENDS SYSTEM ────────
  const BASE_BOT_IDS = new Set(['usr_host', 'usr_agent_01', 'usr_luna_lofi', 'usr_music_bot', 'custom']);
  const isBaseOrCustomBotId = (id: string, role?: string) =>
    BASE_BOT_IDS.has(id) ||
    id.startsWith('usr_music_bot') ||
    id.startsWith('bot_custom') ||
    id.startsWith('bot_') ||
    (role ? (role.includes('DEMAND') || role.includes('RADIO') || role.includes('DJ')) : false);

  const [registeredUsers, setRegisteredUsers] = useState<CommunityUserProfile[]>(() => {
    try {
      const saved = localStorage.getItem('spytify_registered_users');
      if (saved) {
        const parsed: CommunityUserProfile[] = JSON.parse(saved);
        // Exclude fake/injected custom users from earlier searches; reset non-bot users to offline & followsCurrentUser=false until cloud sync
        const filtered = parsed
          .filter(u => !u.id.startsWith('usr_custom_') && u.username !== 'a')
          .map(u => ({
            ...u,
            followsCurrentUser: false,
            status: (isBaseOrCustomBotId(u.id, u.role) ? 'online' : 'offline') as CommunityUserProfile['status'],
          }));
        const map = new Map<string, CommunityUserProfile>();
        INITIAL_USERS.forEach(u => map.set(u.id, u));
        filtered.forEach(u => map.set(u.id, { ...map.get(u.id), ...u }));
        const merged = Array.from(map.values());
        localStorage.setItem('spytify_registered_users', JSON.stringify(merged));
        return merged;
      }
    } catch {}
    return INITIAL_USERS;
  });

  const ACTIVE_BOT_IDS = useMemo(() => {
    const ids = new Set(['usr_host', 'usr_agent_01', 'usr_luna_lofi', 'usr_music_bot', 'custom']);
    registeredUsers.forEach(u => {
      if (isBaseOrCustomBotId(u.id, u.role)) {
        ids.add(u.id);
      }
    });
    return ids;
  }, [registeredUsers]);

  // Danh sách các Bot yêu cầu nhạc (On-Demand Music Bots) của Server hiện tại, sắp xếp theo thứ tự tạo (ưu tiên bot tạo trước)
  const demandMusicBots = useMemo(() => {
    const isRestrictedSrv = Boolean(
      selectedServer.is_custom ||
      selectedServer.id.startsWith('srv_custom_') ||
      Array.isArray(selectedServer.member_ids)
    );
    const hasMember = (botId: string) => {
      if (Array.isArray(selectedServer.kicked_ids) && selectedServer.kicked_ids.includes(botId)) return false;
      if (Array.isArray(selectedServer.member_ids) && selectedServer.member_ids.includes(botId)) return true;
      if (messages.some(m => m.server_id === selectedServer.id && m.user_id === botId)) return true;
      return !isRestrictedSrv;
    };

    const bots: CommunityUserProfile[] = [];
    const baseBot = registeredUsers.find(u => u.id === 'usr_music_bot') || INITIAL_USERS.find(u => u.id === 'usr_music_bot');
    if (baseBot && hasMember(baseBot.id)) bots.push(baseBot);
    registeredUsers.forEach(u => {
      if (u.id !== 'usr_music_bot' && (u.id.startsWith('usr_music_bot') || (u.role || '').toUpperCase().includes('DEMAND'))) {
        if (hasMember(u.id)) {
          bots.push(u);
        }
      }
    });

    if (bots.length === 0 && baseBot && !(Array.isArray(selectedServer.kicked_ids) && selectedServer.kicked_ids.includes(baseBot.id))) {
      bots.push(baseBot);
    }

    return bots.sort((a, b) => {
      const timeA = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
      const timeB = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
      return timeA - timeB;
    });
  }, [registeredUsers, selectedServer, messages]);

  const isDemandBotId = (botId: string) =>
    botId === 'usr_music_bot' ||
    botId.startsWith('usr_music_bot') ||
    demandMusicBots.some(b => b.id === botId);

  const primaryDemandBotId = demandMusicBots[0]?.id || 'usr_music_bot';
  const curServerBot = getServerRythmBot(selectedServer.id, primaryDemandBotId);
  const requestBotCurrentTrack = curServerBot.currentTrack;
  const requestBotQueue = curServerBot.queue;
  const isRequestBotPlaying = curServerBot.isPlaying;
  const requestBotVoiceChannelId = curServerBot.voiceChannelId;

  // Cloud Follow Graph: danh sách những người đã gửi lời mời kết bạn / theo dõi currentUser
  const [followersOfMeMap, setFollowersOfMeMap] = useState<Record<string, CloudFollowEdge>>({});
  const globalSocialChannelRef = useRef<any>(null);

  // ──────── USER PRESENCE STATUS (ONLINE / BẬN / VÔ HÌNH) & SERVER NICKNAMES ────────
  const [myStatus, setMyStatus] = useState<'online' | 'dnd' | 'invisible'>(() => {
    try {
      const s = localStorage.getItem('spytify_user_status');
      if (s === 'online' || s === 'dnd' || s === 'invisible') return s;
    } catch {}
    return 'online';
  });

  const [serverNicknames, setServerNicknames] = useState<Record<string, string>>(() => {
    if (!currentUser?.id) return {};
    try {
      const s =
        localStorage.getItem(`spytify_server_nicknames_${currentUser.id}`) ||
        localStorage.getItem('spytify_server_nicknames');
      if (s) return JSON.parse(s);
    } catch {}
    return {};
  });

  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState('');

  // User Bio (Tiểu sử cá nhân)
  const [myBio, setMyBio] = useState<string>(() => {
    try {
      const saved =
        (currentUser?.id ? localStorage.getItem(`spytify_user_bio_${currentUser.id}`) : null) ||
        localStorage.getItem('spytify_user_bio');
      if (saved) return saved;
      if (currentUser?.bio) return currentUser.bio;
    } catch {}
    return 'Đang khám phá âm nhạc trên Spytify.';
  });
  const [isBioModalOpen, setIsBioModalOpen] = useState(false);
  const [bioDraft, setBioDraft] = useState('');

  const handleOpenBioModal = () => {
    setBioDraft(myBio);
    setIsStatusMenuOpen(false);
    setIsBioModalOpen(true);
  };

  const handleSaveBio = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = bioDraft.trim() || 'Đang khám phá âm nhạc trên Spytify.';
    setMyBio(trimmed);
    try {
      if (currentUser?.id) {
        localStorage.setItem(`spytify_user_bio_${currentUser.id}`, trimmed);
      }
      localStorage.setItem('spytify_user_bio', trimmed);
    } catch {}
    if (activeChannelRef.current) {
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'user_presence',
        payload: {
          ...myPresencePayloadRef.current,
          bio: trimmed,
        },
      });
    }
    setIsBioModalOpen(false);
  };

  const handleOpenThoughtModal = () => {
    setThoughtDraft(myUserThought);
    setIsStatusMenuOpen(false);
    setIsEditingThoughtModal(true);
  };

  const handleSaveThought = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = thoughtDraft.trim();
    setMyUserThought(trimmed);
    try {
      if (currentUser?.id) {
        localStorage.setItem(`spytify_user_thought_${currentUser.id}`, trimmed);
      }
      localStorage.setItem('spytify_user_thought', trimmed);
    } catch {}
    if (activeChannelRef.current) {
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'user_presence',
        payload: {
          ...myPresencePayloadRef.current,
          custom_status: trimmed,
        },
      });
    }
    setIsEditingThoughtModal(false);
  };

  // Helper truy xuất toàn diện tag của thành viên (xử lý cả 'usr_me' và ID thật)
  const resolveMemberTags = (userId: string, server: CommunityServer = selectedServer, userNameOrDisplay?: string): CommunityServerTag[] => {
    return getMemberTags(userId, server, currentUser?.id, myParticipantIdRef.current, userNameOrDisplay, realtimeUserPresences);
  };

  // Real-time online presence map keyed by user id / username
  const [realtimeUserPresences, setRealtimeUserPresences] = useState<
    Record<string, {
      id: string;
      username: string;
      display_name: string;
      avatar?: string | null;
      status: 'online' | 'dnd' | 'invisible' | 'offline';
      bio?: string | null;
      thought?: string | null;
      custom_status?: string | null;
      tags?: string[] | null;
      listening?: string | null;
      listeningTrack?: Track | null;
    }>
  >({});

  const myServerDisplayName =
    (serverNicknames[connectedVoiceServerId || selectedServer.id]?.trim()) ||
    (serverNicknames[selectedServer.id]?.trim()) ||
    currentUser?.display_name ||
    (currentUser?.username ? `@${currentUser.username}` : 'Khách (Chưa đăng nhập)');

  const handleChangeMyStatus = (newStatus: 'online' | 'dnd' | 'invisible') => {
    setMyStatus(newStatus);
    try {
      localStorage.setItem('spytify_user_status', newStatus);
    } catch {}
    setIsStatusMenuOpen(false);
  };

  const handleOpenNicknameModal = () => {
    setNicknameDraft(serverNicknames[selectedServer.id] || currentUser?.display_name || '');
    setIsStatusMenuOpen(false);
    setMemberMenu(null);
    setIsNicknameModalOpen(true);
  };

  const handleSaveServerNickname = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = nicknameDraft.trim();
    setServerNicknames(prev => {
      const next = { ...prev };
      if (trimmed) {
        next[selectedServer.id] = trimmed;
      } else {
        delete next[selectedServer.id];
      }
      try {
        if (currentUser?.id) {
          localStorage.setItem(`spytify_server_nicknames_${currentUser.id}`, JSON.stringify(next));
        }
        localStorage.removeItem('spytify_server_nicknames');
      } catch {}
      return next;
    });
    setIsNicknameModalOpen(false);
  };

  // Helper: chỉ hiện đèn khi thực sự online hoặc đang ở chế độ Bận (dnd); nếu offline hoặc vô hình thì không hiện đèn
  const renderStatusDot = (status?: string, size: 'sm' | 'md' | 'lg' = 'sm') => {
    if (status !== 'online' && status !== 'dnd') return null;
    const sizeClasses =
      size === 'lg'
        ? 'w-5 h-5 -bottom-0.5 -right-0.5 border-2'
        : size === 'md'
        ? 'w-3.5 h-3.5 -bottom-0.5 -right-0.5 border-2'
        : 'w-2.5 h-2.5 -bottom-0.5 -right-0.5 border';
    if (status === 'dnd') {
      return (
        <span
          className={`absolute ${sizeClasses} rounded-full bg-red-500 border-black flex items-center justify-center`}
          title="Bận / Không làm phiền (Do Not Disturb)"
        >
          <span className={`${size === 'lg' ? 'w-2.5 h-0.5' : 'w-1.5 h-[1.5px]'} bg-white rounded-full`} />
        </span>
      );
    }
    return (
      <span
        className={`absolute ${sizeClasses} rounded-full border-black`}
        style={{ backgroundColor: accentColor, boxShadow: `0 0 6px ${accentColor}` }}
        title="Trực tuyến (Online)"
      />
    );
  };

  // Helper: hiển thị ảnh đại diện (avatar) từ đám mây hoặc chữ cái đầu nếu chưa có ảnh
  const resolveUserAvatar = (userId?: string | null, fallbackAvatar?: string | null): string | null => {
    if (!userId) return fallbackAvatar || null;
    if (userId === 'usr_me' || (currentUser && userId === currentUser.id)) {
      return currentUser?.avatar || fallbackAvatar || null;
    }
    const rt = realtimeUserPresences[userId];
    if (rt?.avatar) return rt.avatar;
    const reg = registeredUsers.find(u => u.id === userId);
    if (reg?.avatar) return reg.avatar;
    const fol = followersOfMeMap[userId];
    if (fol?.followerAvatar) return fol.followerAvatar;
    return fallbackAvatar || null;
  };

  const renderAvatarContent = (name?: string | null, avatar?: string | null) => {
    if (avatar) {
      return (
        <img
          src={avatar}
          alt={name || 'avatar'}
          className="w-full h-full object-cover rounded-[inherit]"
        />
      );
    }
    return <span>{(name || 'U').charAt(0).toUpperCase()}</span>;
  };

  const isCustomServerImageLogo = (icon?: string | null): boolean =>
    Boolean(
      icon &&
        (icon.startsWith('data:image/') ||
          icon.startsWith('http://') ||
          icon.startsWith('https://') ||
          icon.startsWith('asset://'))
    );

  const renderServerIconContent = (
    icon?: string | null,
    serverName?: string | null,
    color?: string,
    spyIconSizeClass = 'w-5 h-5'
  ) => {
    if (icon === 'spy_logo') {
      return (
        <SpyJamIcon
          className={spyIconSizeClass}
          style={{
            color: color || accentColor,
            backgroundColor: color || accentColor,
          }}
        />
      );
    }
    if (isCustomServerImageLogo(icon)) {
      return (
        <img
          src={icon!}
          alt={serverName || 'Server Logo'}
          className="w-full h-full object-cover rounded-[inherit]"
        />
      );
    }
    return <span>{icon || (serverName || 'S').charAt(0).toUpperCase()}</span>;
  };

  const handleUploadServerLogoFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    onDone: (dataUrl: string) => void
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) return;
      const img = new Image();
      img.onload = () => {
        try {
          const size = 128;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            onDone(result);
            return;
          }
          ctx.clearRect(0, 0, size, size);
          const minSide = Math.min(img.width, img.height);
          const sx = Math.max(0, (img.width - minSide) / 2);
          const sy = Math.max(0, (img.height - minSide) / 2);
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
          const compressed = canvas.toDataURL('image/png');
          onDone(compressed);
        } catch {
          onDone(result);
        }
      };
      img.onerror = () => onDone(result);
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  // User's following list (stored in localStorage per account & synced with Supabase Cloud)
  const [followingUserIds, setFollowingUserIds] = useState<Set<string>>(() => {
    if (!currentUser?.id) return new Set();
    try {
      const migratedKey = `spytify_follow_cloud_v2_${currentUser.id}`;
      if (!localStorage.getItem(migratedKey)) {
        localStorage.removeItem(`spytify_user_following_${currentUser.id}`);
        localStorage.removeItem('spytify_user_following');
        localStorage.setItem(migratedKey, '1');
        return new Set();
      }
      const saved = localStorage.getItem(`spytify_user_following_${currentUser.id}`);
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        const filtered = parsed.filter(id => !id.startsWith('usr_custom_'));
        return new Set(filtered);
      }
    } catch {}
    return new Set();
  });

  // Individual user volume scaling (0% - 100%, default 100%)
  const [userVolumes, setUserVolumes] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('spytify_user_volumes');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  // ──────── RESIDENT DJ BOT IN-ROOM SPEAKER (LOA PHÁT THANH PHÒNG THOẠI 24/7) ────────
  const botRadioIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isBotSpeaking, setIsBotSpeaking] = useState(false);
  const [isBotMuted, setIsBotMuted] = useState(false);

  // Active stream index for each DJ Bot (supports automatic and manual rotation across live stream candidates)
  const [botActiveStreamIdx, setBotActiveStreamIdx] = useState<Record<string, number>>({});
  const [editServerAllowInvites, setEditServerAllowInvites] = useState<boolean>(true);

  const [myUserThought, setMyUserThought] = useState<string>(() => {
    try {
      return localStorage.getItem('spytify_user_thought') || '';
    } catch {
      return '';
    }
  });
  const [isEditingThoughtModal, setIsEditingThoughtModal] = useState(false);
  const [thoughtDraft, setThoughtDraft] = useState('');
  const [openMemberActionsMenuId, setOpenMemberActionsMenuId] = useState<string | null>(null);
  const [newChannelCustomBackupUrls, setNewChannelCustomBackupUrls] = useState<string>('');
  const [editStationBackupStreamsDraft, setEditStationBackupStreamsDraft] = useState<string>('');

  const getBotCurrentStream = (botId: string) => {
    // Luồng YouTube tùy biến được gắn trực tiếp trên kênh Radio hiện tại (Custom YouTube Station)
    if (connectedVoiceChannelObj?.is_radio && (connectedVoiceChannelObj.custom_stream_url || connectedVoiceChannelObj.custom_backup_streams?.length)) {
      const primaryUrl = (connectedVoiceChannelObj.custom_stream_url || '').trim();
      const backupUrls = connectedVoiceChannelObj.custom_backup_streams || [];
      const allUrls = [primaryUrl, ...backupUrls].filter(Boolean);
      const dj = DJ_BOT_OPTIONS.find(d => d.id === botId) || DJ_BOT_OPTIONS.find(d => d.id === 'custom') || DJ_BOT_OPTIONS[0];

      if (allUrls.length > 0) {
        const candidates = allUrls.map((u, i) => {
          const extracted = extractYouTubeId(u) || (u.length === 11 ? u : 'jfKfPfyJRdk');
          return {
            id: extracted,
            title: i === 0
              ? (connectedVoiceChannelObj.custom_stream_title || 'Trạm YouTube Tùy Biến')
              : `${connectedVoiceChannelObj.custom_stream_title || 'Trạm Tùy Biến'} (Dự phòng #${i})`
          };
        });
        const curIdx = (botActiveStreamIdx[botId] || 0) % candidates.length;
        return {
          ...candidates[curIdx],
          index: curIdx,
          total: candidates.length,
          dj,
          isCustom: true,
          isLoopSingle: Boolean(connectedVoiceChannelObj.is_loop_single),
        };
      }
    }
    const dj = DJ_BOT_OPTIONS.find(d => d.id === botId) || DJ_BOT_OPTIONS[0];
    const candidates = [
      { id: dj.liveStreamId, title: dj.liveStreamTitle },
      ...(dj.backupStreams || [])
    ];
    const idx = (botActiveStreamIdx[botId] || 0) % candidates.length;
    return {
      ...candidates[idx],
      index: idx,
      total: candidates.length,
      dj,
      isCustom: false,
      isLoopSingle: false,
    };
  };

  const handleRotateBotStream = (botId: string, reason?: string) => {
    if (!canManageServer) {
      showVoiceToast(language === 'vi' ? 'Chỉ Chủ server và Mod mới có quyền điều chỉnh bot!' : 'Only Server Owner and Mod can adjust bots!');
      return;
    }
    setBotActiveStreamIdx(prev => {
      let total = 1;
      let botTitle = botId;
      if (connectedVoiceChannelObj?.is_radio && (connectedVoiceChannelObj.custom_stream_url || connectedVoiceChannelObj.custom_backup_streams?.length)) {
        const primary = (connectedVoiceChannelObj.custom_stream_url || '').trim();
        const backups = connectedVoiceChannelObj.custom_backup_streams || [];
        const all = [primary, ...backups].filter(Boolean);
        total = Math.max(1, all.length);
        botTitle = connectedVoiceChannelObj.custom_stream_title || 'Trạm Tùy Biến';
      } else {
        const dj = DJ_BOT_OPTIONS.find(d => d.id === botId) || DJ_BOT_OPTIONS[0];
        const candidates = [
          { id: dj.liveStreamId, title: dj.liveStreamTitle },
          ...(dj.backupStreams || [])
        ];
        total = candidates.length;
        botTitle = dj.name;
      }
      const curIdx = prev[botId] || 0;
      const nextIdx = (curIdx + 1) % total;
      console.warn(`[DJ Bot Stream Rotation] ${botTitle} switched to #${nextIdx + 1}/${total} (Lý do: ${reason || 'Chuyển luồng'})`);
      return { ...prev, [botId]: nextIdx };
    });
  };

  // Gửi lệnh điều khiển (mute, unMute, setVolume, playVideo) tới iframe loa của DJ bot
  const sendBotCmd = (func: string, args: unknown[] = []) => {
    try {
      botRadioIframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func, args }), '*'
      );
    } catch {}
  };

  // ──────── ON-DEMAND MUSIC BOT (RYTHM / USR_MUSIC_BOT) HELPERS & LOGIC ────────
  const persistBotCurrentTrack = (track: RequestBotTrack | null) => {
    try {
      if (track) {
        localStorage.setItem('spytify_request_bot_current', JSON.stringify(track));
      } else {
        localStorage.removeItem('spytify_request_bot_current');
      }
    } catch {}
  };

  const persistBotQueue = (q: RequestBotTrack[]) => {
    try {
      localStorage.setItem('spytify_request_bot_queue', JSON.stringify(q));
    } catch {}
  };

  const sendBotChatMessage = (
    content: string,
    botProfile?: { id?: string; name?: string; display_name?: string; username?: string; avatar?: string | null },
    explicitServerId?: string
  ) => {
    const activeBot = botProfile || demandMusicBots[0] || {
      id: 'usr_music_bot',
      display_name: 'Rythm',
      username: 'rythm',
      avatar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
    };
    const bId = activeBot.id || 'usr_music_bot';
    const bName = (activeBot as any).display_name || (activeBot as any).name || 'Rythm';
    const bUser = (activeBot as any).username || bName.toLowerCase().replace(/\s+/g, '_');
    const bAvatar = activeBot.avatar || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';
    const createdAtStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const targetSrvId = explicitServerId || selectedServer.id;
    const targetChId =
      targetSrvId === selectedServer.id
        ? selectedChannel.id
        : (servers.find(s => s.id === targetSrvId)?.channels.find(c => c.type === 'text')?.id || selectedChannel.id);

    const botMsg: CommunityMessage = {
      id: `msg_bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      server_id: targetSrvId,
      channel_id: targetChId,
      user_id: bId,
      username: bUser,
      display_name: bName,
      avatar: bAvatar,
      content,
      track_embed: null,
      created_at: createdAtStr,
    };

    appendServerMessage(botMsg);

    if (targetSrvId === selectedServer.id) {
      activeChannelRef.current?.send({
        type: 'broadcast',
        event: 'new_message',
        payload: botMsg,
      });
    }
  };

  const syncBotState = (
    cur: RequestBotTrack | null,
    q: RequestBotTrack[],
    playing: boolean,
    vChId?: string | null,
    vSrvId?: string | null,
    botId: string = 'usr_music_bot',
    looping?: boolean,
    startedAt?: number
  ) => {
    const finalVSrvId = vSrvId !== undefined && vSrvId !== null ? vSrvId : selectedServer.id;
    const currentBotState = getServerRythmBotFromRecord(serverRythmBotsRef.current, finalVSrvId, botId);
    const finalVChId = vChId !== undefined ? vChId : currentBotState.voiceChannelId;
    activeChannelRef.current?.send({
      type: 'broadcast',
      event: 'request_bot_sync',
      payload: {
        serverId: finalVSrvId,
        botId,
        currentTrack: cur,
        queue: q,
        isPlaying: playing,
        isLooping: looping !== undefined ? looping : currentBotState.isLooping,
        voiceChannelId: finalVChId,
        voiceServerId: finalVSrvId,
        startedAt: startedAt !== undefined ? startedAt : currentBotState.startedAt,
      },
    });
  };

  const resolveBotProfileById = (botId: string) =>
    registeredUsers.find(u => u.id === botId) ||
    INITIAL_USERS.find(u => u.id === botId) || {
      id: botId,
      display_name: botId === 'usr_music_bot' ? 'Rythm' : 'Music Bot',
      username: botId === 'usr_music_bot' ? 'rythm' : botId,
      avatar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
    };

  const handleRequestBotTrackEnded = (targetSrvId?: string, botId: string = 'usr_music_bot', endedTrackId?: string) => {
    const srvId = targetSrvId || connectedVoiceServerId || selectedServer.id;
    const botKey = getDemandBotKey(srvId, botId);
    const botState = getServerRythmBotFromRecord(serverRythmBotsRef.current, srvId, botId);
    if (!botState.currentTrack) return;

    const curTrackId = botState.currentTrack.id;
    if (endedTrackId && endedTrackId !== curTrackId) return;
    if (!botState.isLooping && lastEndedBotTrackRef.current[botKey] === curTrackId) return;
    lastEndedBotTrackRef.current[botKey] = curTrackId;

    const botProfile = resolveBotProfileById(botId);
    const queue = botState.queue || [];

    // Ưu tiên phát tiếp bài tiếp theo trong hàng đợi kể cả khi mọi người đã out phòng thoại
    if (queue.length > 0) {
      const nextTrack = queue[0];
      const remainingQueue = queue.slice(1);
      const startedAt = Date.now();
      updateServerRythmBot(srvId, botId, prev => ({
        ...prev,
        currentTrack: nextTrack,
        queue: remainingQueue,
        isPlaying: true,
        startedAt,
      }));
      requestBotTrackStartedAtRef.current = startedAt;
      persistBotCurrentTrack(nextTrack);
      persistBotQueue(remainingQueue);

      try {
        const iframe = requestBotIframesRef.current[botKey];
        iframe?.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'loadVideoById', args: [nextTrack.url_or_id] }), '*'
        );
        iframe?.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*'
        );
      } catch {}

      sendBotChatMessage(
        `🎶 **TIẾP TỤC PHÁT TỰ ĐỘNG TỪ HÀNG ĐỢI**\n🎵 **${nextTrack.title}** - *${nextTrack.artist}*\n👤 Yêu cầu bởi: **@${nextTrack.requestedBy.name}**\n🔢 Còn **${remainingQueue.length}** bài trong hàng đợi.`,
        botProfile,
        srvId
      );
      syncBotState(nextTrack, remainingQueue, true, botState.voiceChannelId, srvId, botId, botState.isLooping, startedAt);
      return;
    }

    if (botState.isLooping && botState.currentTrack) {
      const startedAt = Date.now();
      delete lastEndedBotTrackRef.current[botKey];
      requestBotTrackStartedAtRef.current = startedAt;
      updateServerRythmBot(srvId, botId, prev => ({ ...prev, isPlaying: true, startedAt }));
      try {
        const iframe = requestBotIframesRef.current[botKey];
        iframe?.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'seekTo', args: [0, true] }), '*'
        );
        iframe?.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*'
        );
      } catch {}
      sendBotChatMessage(
        language === 'vi'
          ? `🔂 **ĐANG LẶP LẠI BÀI HÁT:** **${botState.currentTrack.title}** - *${botState.currentTrack.artist}*`
          : `🔂 **LOOPING TRACK:** **${botState.currentTrack.title}** - *${botState.currentTrack.artist}*`,
        botProfile,
        srvId
      );
      return;
    }

    // Chỉ rời phòng thoại khi đã phát xong toàn bộ hàng đợi
    const prevVoiceChId = botState.voiceChannelId;
    delete lastEndedBotTrackRef.current[botKey];
    updateServerRythmBot(srvId, botId, () => ({ ...EMPTY_DEMAND_BOT_STATE }));
    setVoiceParticipants(prev => prev.filter(p => !(p.id === botId && (!p.serverId || p.serverId === srvId))));
    persistBotCurrentTrack(null);
    persistBotQueue([]);
    if (connectedVoiceServerId === srvId && connectedVoiceChannel && connectedVoiceChannel === prevVoiceChId) {
      playAudioChime('leave');
    }
    sendBotChatMessage(
      language === 'vi'
        ? `⏹️ **ĐÃ PHÁT XONG TOÀN BỘ HÀNG ĐỢI!**\n📭 Hàng đợi đã hết bài, **${botProfile.display_name}** đã hoàn thành danh sách phát và rời phòng thoại. Dùng \`/play${botId === primaryDemandBotId ? '' : ` @${botId}`} [tên bài hát]\` để tiếp tục nghe nhạc!`
        : `⏹️ **QUEUE FINISHED!**\n📭 Queue completed and **${botProfile.display_name}** left the voice channel. Use \`/play${botId === primaryDemandBotId ? '' : ` @${botId}`} [song name]\` to play more music!`,
      botProfile,
      srvId
    );
    syncBotState(null, [], false, null, srvId, botId, false, undefined);
  };

  const handleRequestBotError = (errorCode?: number | string, targetSrvId?: string, botId: string = 'usr_music_bot') => {
    const srvId = targetSrvId || connectedVoiceServerId || selectedServer.id;
    const botState = getServerRythmBotFromRecord(serverRythmBotsRef.current, srvId, botId);
    const botProfile = resolveBotProfileById(botId);
    if (botState.currentTrack) {
      sendBotChatMessage(
        `⚠️ Bài hát **${botState.currentTrack.title}** không khả dụng trên trình phát (Mã lỗi YouTube: ${errorCode || 'Unavailable'}). Đang tự động chuyển bài tiếp theo...`,
        botProfile,
        srvId
      );
    }
    handleRequestBotTrackEnded(srvId, botId, botState.currentTrack?.id);
  };

  const processBotMusicCommand = async (content: string, sender: { id: string; name: string; username: string }) => {
    const raw = content.trim();
    if (!raw) return;

    const findDemandBotByToken = (token: string): CommunityUserProfile | undefined => {
      const q = token.trim().toLowerCase();
      if (!q) return undefined;
      return demandMusicBots.find((b: CommunityUserProfile) => {
        const bId = b.id.toLowerCase();
        const bUser = (b.username || '').toLowerCase();
        const bName = (b.display_name || '').toLowerCase();
        return bId === q || bUser === q || bName === q;
      });
    };

    let cmdName: string | null = null;
    let explicitBotToken: string | null = null;
    let resolvedMentionedBot: CommunityUserProfile | undefined = undefined;
    let argsText = '';

    const slashMatch = raw.match(/^\/(p|play|st|stop|sk|skip|q|queue|pause|resume|l|loop|help)(?:\s+([\s\S]*))?$/i);
    if (slashMatch) {
      cmdName = slashMatch[1].toLowerCase();
      const afterCmd = (slashMatch[2] || '').trim();
      if (afterCmd.startsWith('@')) {
        const singleTok = afterCmd.match(/^@(?:"([^"]+)"|([^\s]+))(?:\s+([\s\S]*))?$/);
        const tok = (singleTok?.[1] || singleTok?.[2] || '').trim();
        const directMatch = tok ? findDemandBotByToken(tok) : undefined;
        if (directMatch) {
          explicitBotToken = tok;
          resolvedMentionedBot = directMatch;
          argsText = (singleTok?.[3] || '').trim();
        } else {
          // Hỗ trợ tên bot có khoảng trắng không cần dấu ngoặc kép (VD: /play @Music Bot 2 Tên bài)
          const lowerAfterAt = afterCmd.slice(1).toLowerCase();
          const prefixMatch = demandMusicBots.find((b: CommunityUserProfile) => {
            const name = (b.display_name || '').toLowerCase();
            return name && (lowerAfterAt === name || lowerAfterAt.startsWith(name + ' '));
          });
          if (prefixMatch) {
            explicitBotToken = prefixMatch.display_name;
            resolvedMentionedBot = prefixMatch;
            argsText = afterCmd.slice(1 + (prefixMatch.display_name || '').length).trim();
          } else {
            explicitBotToken = tok || afterCmd.slice(1);
            argsText = (singleTok?.[3] || '').trim();
          }
        }
      } else {
        argsText = afterCmd;
      }
    } else if (raw.startsWith('@')) {
      const leadTok = raw.match(/^@(?:"([^"]+)"|([^\s]+))(?:\s+([\s\S]*))?$/);
      const tok = (leadTok?.[1] || leadTok?.[2] || '').trim();
      const directMatch = tok ? findDemandBotByToken(tok) : undefined;
      if (directMatch) {
        resolvedMentionedBot = directMatch;
        explicitBotToken = tok;
        const afterTok = (leadTok?.[3] || '').trim();
        const innerSlash = afterTok.match(/^\/(p|play|st|stop|sk|skip|q|queue|pause|resume|l|loop|help)(?:\s+([\s\S]*))?$/i);
        if (innerSlash) {
          cmdName = innerSlash[1].toLowerCase();
          argsText = (innerSlash[2] || '').trim();
        } else {
          cmdName = 'help';
          argsText = afterTok;
        }
      }
    }

    if (!cmdName) return;

    const firstDemandBot = demandMusicBots[0] || resolveBotProfileById('usr_music_bot');

    // Nếu người dùng chỉ định @id_bot nhưng không khớp bot yêu cầu nào
    if (explicitBotToken && !resolvedMentionedBot) {
      const stationHit = registeredUsers.find(
        u => !isDemandBotId(u.id) && (
          u.id.toLowerCase() === explicitBotToken!.toLowerCase() ||
          (u.username || '').toLowerCase() === explicitBotToken!.toLowerCase() ||
          (u.display_name || '').toLowerCase() === explicitBotToken!.toLowerCase()
        )
      );
      const availableList = demandMusicBots.map(b => `\`@${b.id}\` (**${b.display_name}**)`).join(', ');
      if (stationHit) {
        sendBotChatMessage(
          `⚠️ **${stationHit.display_name}** là **Bot Trạm Live 24/7**, không nhận lệnh theo yêu cầu.\n🎵 Bot Yêu Cầu khả dụng trong server: ${availableList}`,
          firstDemandBot
        );
      } else {
        sendBotChatMessage(
          `❌ Không tìm thấy Bot Yêu Cầu **@${explicitBotToken}** trong server này.\n🤖 Bot hợp lệ: ${availableList}\n💡 Cú pháp: \`/play @id_bot <tên bài hát hoặc link YouTube>\``,
          firstDemandBot
        );
      }
      return;
    }

    // /play hoặc /p không kèm @id_bot -> CHỈ gọi bot yêu cầu đầu tiên theo thứ tự được tạo
    // Các lệnh điều khiển không kèm @id_bot -> ưu tiên bot đang phát ở phòng thoại hiện tại hoặc bot đầu tiên
    const isPlayCmd = cmdName === 'p' || cmdName === 'play';
    const selectedBot = resolvedMentionedBot || (
      isPlayCmd
        ? firstDemandBot
        : (
            demandMusicBots.find((b: CommunityUserProfile) => {
              const st = getServerRythmBot(selectedServer.id, b.id);
              return Boolean(connectedVoiceChannel && st.voiceChannelId === connectedVoiceChannel && st.currentTrack);
            }) ||
            demandMusicBots.find((b: CommunityUserProfile) => Boolean(getServerRythmBot(selectedServer.id, b.id).currentTrack)) ||
            firstDemandBot
          )
    );
    const targetBotId = selectedBot.id;
    const targetBotName = selectedBot.display_name || 'Rythm';
    const targetBotKey = getDemandBotKey(selectedServer.id, targetBotId);
    const botState = getServerRythmBot(selectedServer.id, targetBotId);
    const syntaxPrefix = targetBotId === firstDemandBot.id ? '/play' : `/play @${targetBotId}`;

    // 2. Bắt buộc người dùng phải tham gia một phòng thoại trước khi yêu cầu nhạc
    const isSenderInVoice =
      (sender.id === currentUser?.id || sender.id === 'usr_me')
        ? Boolean(connectedVoiceChannel)
        : voiceParticipants.some(vp => vp.id === sender.id || vp.name === sender.name);

    if (!isSenderInVoice) {
      sendBotChatMessage(
        language === 'vi'
          ? `⚠️ **@${sender.name}**, vui lòng tham gia một phòng thoại (Voice Channel) trước khi yêu cầu bot phát nhạc!`
          : `⚠️ **@${sender.name}**, please join a voice channel before requesting music!`,
        selectedBot
      );
      return;
    }

    // Kiểm tra quyền điều khiển bot đối với các lệnh can thiệp (skip, stop, pause, loop)
    const isControlCmd = ['st', 'stop', 'sk', 'skip', 'pause', 'l', 'loop'].includes(cmdName);
    if (isControlCmd) {
      const isRequester = botState.currentTrack?.requestedBy?.id === sender.id;
      if (!canManageServer && !isRequester) {
        sendBotChatMessage(`⚠️ Chỉ Chủ Server, Mod hoặc người đã yêu cầu bài hát này mới có quyền điều khiển **${targetBotName}**.`, selectedBot);
        return;
      }
    }

    // 0. Lệnh Lặp bài hát hiện hành (/l hoặc /loop)
    if (cmdName === 'l' || cmdName === 'loop') {
      if (!botState.currentTrack) {
        sendBotChatMessage(`⚠️ Hiện tại **${targetBotName}** chưa phát bài hát nào để lặp. Dùng \`${syntaxPrefix} [tên bài hát]\` để phát nhạc trước.`, selectedBot);
        return;
      }
      const nextLoop = !botState.isLooping;
      updateServerRythmBot(selectedServer.id, targetBotId, prev => ({ ...prev, isLooping: nextLoop }));
      try {
        localStorage.setItem('spytify_bot_loop_state', JSON.stringify(nextLoop));
      } catch {}
      sendBotChatMessage(
        nextLoop
          ? `🔂 **ĐÃ BẬT LẶP BÀI HÁT HIỆN HÀNH:** **${botState.currentTrack.title}** - *${botState.currentTrack.artist}* (Theo yêu cầu của **@${sender.name}**)`
          : `➡️ **ĐÃ TẮT LẶP BÀI HÁT:** **${targetBotName}** sẽ tiếp tục phát các bài tiếp theo trong hàng đợi khi bài hát kết thúc.`,
        selectedBot
      );
      syncBotState(botState.currentTrack, botState.queue, botState.isPlaying, botState.voiceChannelId, selectedServer.id, targetBotId, nextLoop, botState.startedAt);
      return;
    }

    // 1. Lệnh Dừng (/st hoặc /stop) -> Dừng và bot rời phòng thoại
    if (cmdName === 'st' || cmdName === 'stop') {
      delete lastEndedBotTrackRef.current[targetBotKey];
      updateServerRythmBot(selectedServer.id, targetBotId, () => ({ ...EMPTY_DEMAND_BOT_STATE }));
      setVoiceParticipants(prev => prev.filter(p => !(p.id === targetBotId && (!p.serverId || p.serverId === selectedServer.id))));
      try {
        localStorage.removeItem('spytify_request_bot_voice_channel');
        localStorage.removeItem('spytify_request_bot_voice_server');
      } catch {}
      persistBotCurrentTrack(null);
      persistBotQueue([]);
      playAudioChime('leave');

      sendBotChatMessage(
        `⏹️ **ĐÃ DỪNG PHÁT VÀ RỜI PHÒNG THOẠI**\n**${targetBotName}** đã dừng phát nhạc, dọn sạch hàng đợi và rời phòng thoại theo lệnh của **@${sender.name}**.`,
        selectedBot
      );
      syncBotState(null, [], false, null, selectedServer.id, targetBotId, false, undefined);
      return;
    }

    // 2. Lệnh Bỏ qua (/sk hoặc /skip)
    if (cmdName === 'sk' || cmdName === 'skip') {
      if (!botState.currentTrack) {
        sendBotChatMessage(`⚠️ Hiện tại **${targetBotName}** không có bài hát nào đang phát để skip.`, selectedBot);
        return;
      }
      if (botState.queue.length > 0) {
        const nextTrack = botState.queue[0];
        const nextQueue = botState.queue.slice(1);
        const startedAt = Date.now();
        updateServerRythmBot(selectedServer.id, targetBotId, prev => ({
          ...prev,
          currentTrack: nextTrack,
          queue: nextQueue,
          isPlaying: true,
          startedAt,
        }));
        persistBotCurrentTrack(nextTrack);
        persistBotQueue(nextQueue);

        sendBotChatMessage(
          `⏭️ **ĐÃ SKIP BÀI HÁT** (Bởi @${sender.name})\n🎶 **Đang phát tiếp theo:** **${nextTrack.title}** - *${nextTrack.artist}*\n👤 Yêu cầu bởi: **@${nextTrack.requestedBy.name}**\n🔢 Còn **${nextQueue.length}** bài trong hàng đợi.`,
          selectedBot
        );
        syncBotState(nextTrack, nextQueue, true, botState.voiceChannelId, selectedServer.id, targetBotId, botState.isLooping, startedAt);
      } else {
        delete lastEndedBotTrackRef.current[targetBotKey];
        updateServerRythmBot(selectedServer.id, targetBotId, () => ({ ...EMPTY_DEMAND_BOT_STATE }));
        setVoiceParticipants(prev => prev.filter(p => !(p.id === targetBotId && (!p.serverId || p.serverId === selectedServer.id))));
        try {
          localStorage.removeItem('spytify_request_bot_voice_channel');
          localStorage.removeItem('spytify_request_bot_voice_server');
        } catch {}
        persistBotCurrentTrack(null);
        persistBotQueue([]);
        playAudioChime('leave');

        sendBotChatMessage(
          `⏭️ **ĐÃ SKIP BÀI HÁT CUỐI CÙNG** (Bởi @${sender.name})\n📭 Hàng đợi đã hết bài, **${targetBotName}** đã rời khỏi phòng thoại. Dùng \`${syntaxPrefix} [tên bài hát]\` để tiếp tục nghe nhạc.`,
          selectedBot
        );
        syncBotState(null, [], false, null, selectedServer.id, targetBotId, false, undefined);
      }
      return;
    }

    // 3. Lệnh Tạm dừng (/pause) & Tiếp tục (/resume)
    if (cmdName === 'pause') {
      if (!botState.isPlaying || !botState.currentTrack) {
        sendBotChatMessage(`⚠️ **${targetBotName}** không có bài hát nào đang phát để tạm dừng.`, selectedBot);
        return;
      }
      updateServerRythmBot(selectedServer.id, targetBotId, prev => ({ ...prev, isPlaying: false }));
      try {
        requestBotIframesRef.current[targetBotKey]?.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*'
        );
      } catch {}
      sendBotChatMessage(`⏸️ **ĐÃ TẠM DỪNG PHÁT NHẠC** (Bởi @${sender.name}). Dùng \`/resume${targetBotId === firstDemandBot.id ? '' : ` @${targetBotId}`}\` để tiếp tục.`, selectedBot);
      syncBotState(botState.currentTrack, botState.queue, false, botState.voiceChannelId, selectedServer.id, targetBotId, botState.isLooping, botState.startedAt);
      return;
    }

    if (cmdName === 'resume') {
      if (botState.isPlaying || !botState.currentTrack) {
        sendBotChatMessage(`⚠️ **${targetBotName}** không trong trạng thái tạm dừng.`, selectedBot);
        return;
      }
      updateServerRythmBot(selectedServer.id, targetBotId, prev => ({ ...prev, isPlaying: true }));
      try {
        requestBotIframesRef.current[targetBotKey]?.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*'
        );
      } catch {}
      sendBotChatMessage(`▶️ **TIẾP TỤC PHÁT NHẠC** (Bởi @${sender.name}): **${botState.currentTrack.title}**.`, selectedBot);
      syncBotState(botState.currentTrack, botState.queue, true, botState.voiceChannelId, selectedServer.id, targetBotId, botState.isLooping, botState.startedAt);
      return;
    }

    // 4. Lệnh Xem Hàng Đợi (/q hoặc /queue)
    if (cmdName === 'q' || cmdName === 'queue') {
      if (!botState.currentTrack) {
        sendBotChatMessage(`📭 **Hàng đợi của ${targetBotName} hiện đang trống.**\nDùng \`${syntaxPrefix} [link hoặc tên bài hát]\` để phát bài hát yêu thích!`, selectedBot);
        return;
      }
      let text = `📜 **DANH SÁCH HÀNG ĐỢI — ${targetBotName.toUpperCase()}**\n`;
      text += `▶️ **Đang phát:** **${botState.currentTrack.title}** - *${botState.currentTrack.artist}* (Yêu cầu bởi @${botState.currentTrack.requestedBy.name})\n\n`;
      if (botState.queue.length === 0) {
        text += `*Hàng đợi tiếp theo đang trống. Dùng \`${syntaxPrefix} [tên bài hát]\` để thêm nhạc vào danh sách!*`;
      } else {
        text += `📋 **Tiếp theo trong hàng đợi (${botState.queue.length} bài):**\n`;
        botState.queue.slice(0, 5).forEach((t, i) => {
          text += `${i + 1}. **${t.title}** - *${t.artist}* (bởi @${t.requestedBy.name})\n`;
        });
        if (botState.queue.length > 5) {
          text += `*... và còn ${botState.queue.length - 5} bài hát khác.*`;
        }
      }
      sendBotChatMessage(text, selectedBot);
      return;
    }

    // 5. Lệnh Phát nhạc (/p hoặc /play) -> /play <bài> chỉ gọi bot đầu tiên; /play @id_bot <bài> gọi đúng bot chỉ định
    if (isPlayCmd) {
      const rawQuery = argsText.replace(/^["']|["']$/g, '').trim();
      if (!rawQuery) {
        sendBotChatMessage(
          `⚠️ **Cú pháp:**\n• \`/play <tên bài hát hoặc link YouTube>\` *(gọi bot mặc định: **${firstDemandBot.display_name}**)*\n• \`/play @id_bot <tên bài hát hoặc link YouTube>\` *(chỉ định bot cụ thể)*`,
          selectedBot
        );
        return;
      }

      let videoId = extractYouTubeId(rawQuery);
      let resolvedTitle = rawQuery;
      let resolvedArtist = 'YouTube';
      let resolvedThumb: string | undefined = undefined;

      if (videoId) {
        try {
          const resp = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
          if (resp.ok) {
            const data = await resp.json();
            if (data.title) {
              resolvedTitle = data.title;
              resolvedArtist = data.author_name || 'YouTube';
              resolvedThumb = data.thumbnail_url;
            }
          }
        } catch {}
      } else {
        try {
          const searchRes = await invoke<SearchResult[]>('search_online', { query: rawQuery, source: 'youtube' });
          if (searchRes && searchRes.length > 0) {
            const first = searchRes[0];
            videoId = first.url_or_id.replace(/^yt_/, '');
            resolvedTitle = first.title;
            resolvedArtist = first.artist || 'YouTube';
            resolvedThumb = first.thumbnail || undefined;
          }
        } catch (err) {
          console.warn('[Demand Bot] Search failed:', err);
        }
      }

      if (!videoId) {
        sendBotChatMessage(`❌ Không tìm thấy kết quả phù hợp cho: "${rawQuery}". Vui lòng thử link YouTube trực tiếp hoặc từ khóa khác!`, selectedBot);
        return;
      }

      const newTrack: RequestBotTrack = {
        id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: resolvedTitle,
        artist: resolvedArtist,
        url_or_id: videoId,
        requestedBy: {
          id: sender.id,
          name: sender.name,
        },
        thumbnail: resolvedThumb,
      };

      const isBotCurrentlyActive = Boolean(botState.currentTrack && botState.isPlaying);
      const targetVoiceChId =
        (isBotCurrentlyActive ? botState.voiceChannelId : null) ||
        connectedVoiceChannel ||
        selectedServer.channels.find(c => c.type === 'voice')?.id ||
        null;
      const targetVoiceSrvId = connectedVoiceServerId || selectedServer.id;
      const targetVoiceChObj = selectedServer.channels.find(c => c.id === targetVoiceChId);
      const roomDisplayName = targetVoiceChObj ? getChannelName(targetVoiceChObj) : 'Phòng thoại';

      if (targetVoiceChId) {
        try {
          localStorage.setItem('spytify_request_bot_voice_channel', targetVoiceChId);
          localStorage.setItem('spytify_request_bot_voice_server', targetVoiceSrvId);
        } catch {}
      }
      playAudioChime('join');

      const latestState = getServerRythmBotFromRecord(serverRythmBotsRef.current, targetVoiceSrvId, targetBotId);
      if (!latestState.currentTrack || !latestState.isPlaying) {
        const startedAt = Date.now();
        delete lastEndedBotTrackRef.current[targetBotKey];
        requestBotTrackStartedAtRef.current = startedAt;
        updateServerRythmBot(targetVoiceSrvId, targetBotId, prev => ({
          ...prev,
          currentTrack: newTrack,
          isPlaying: true,
          voiceChannelId: targetVoiceChId,
          startedAt,
        }));
        persistBotCurrentTrack(newTrack);

        sendBotChatMessage(
          `🎶 **${targetBotName.toUpperCase()} ĐÃ THAM GIA PHÒNG & ĐANG PHÁT** (\`@${targetBotId}\`)\n🎵 **${newTrack.title}** - *${newTrack.artist}*\n📍 Đang phát tại: **${roomDisplayName}**\n👤 Yêu cầu bởi: **@${sender.name}**\n⚡ Dùng \`/sk\` để skip • \`/st\` để dừng & rời phòng • \`/q\` để xem hàng đợi`,
          selectedBot
        );
        syncBotState(newTrack, latestState.queue, true, targetVoiceChId, targetVoiceSrvId, targetBotId, latestState.isLooping, startedAt);
      } else {
        const nextQueue = [...latestState.queue, newTrack];
        updateServerRythmBot(targetVoiceSrvId, targetBotId, prev => ({
          ...prev,
          queue: nextQueue,
          voiceChannelId: prev.voiceChannelId || targetVoiceChId,
        }));
        persistBotQueue(nextQueue);

        sendBotChatMessage(
          `📋 **ĐÃ THÊM VÀO HÀNG ĐỢI — ${targetBotName.toUpperCase()} [#${nextQueue.length}]**\n🎵 **${newTrack.title}** - *${newTrack.artist}*\n📍 Phòng thoại: **${roomDisplayName}**\n👤 Yêu cầu bởi: **@${sender.name}**\n🔢 Hàng đợi hiện có **${nextQueue.length}** bài hát.`,
          selectedBot
        );
        syncBotState(latestState.currentTrack, nextQueue, latestState.isPlaying, latestState.voiceChannelId || targetVoiceChId, targetVoiceSrvId, targetBotId, latestState.isLooping, latestState.startedAt);
      }
      return;
    }

    // 6. Nếu chỉ tag bot mà không kèm lệnh (hoặc /help)
    const botListHint = demandMusicBots.length > 1
      ? `\n🤖 **Bot Yêu Cầu trong server:** ${demandMusicBots.map((b, i) => `${i === 0 ? '★ ' : ''}\`@${b.id}\` (${b.display_name})`).join(', ')}`
      : '';
    sendBotChatMessage(
      `🤖 **Xin chào @${sender.name}! Tôi là ${targetBotName} (\`@${targetBotId}\`) - Bot phát nhạc theo yêu cầu:**\n` +
      `• \`/play <tên bài hoặc link>\` (viết tắt \`/p\`): Gọi bot đầu tiên (**${firstDemandBot.display_name}**)\n` +
      `• \`/play @id_bot <tên bài hoặc link>\`: Chỉ định bot cụ thể phát nhạc\n` +
      `• \`/skip\` / \`/stop\` / \`/queue\` / \`/pause\` / \`/resume\` (có thể thêm \`@id_bot\`)${botListHint}`,
      selectedBot
    );
  };

  // Xác định kênh thoại và máy chủ hiện tại đang kết nối (độc lập với server người dùng đang xem)
  const connectedVoiceServer = servers.find(s => s.id === connectedVoiceServerId) || (selectedServer.id === connectedVoiceServerId ? selectedServer : null);
  const connectedVoiceChannelObj = connectedVoiceServer?.channels.find(c => c.id === connectedVoiceChannel) || selectedServer.channels.find(c => c.id === connectedVoiceChannel);

  // Tìm bot DJ có mặt trong phòng thoại hiện tại (dù là đài radio hay phòng thoại thường được mời vào)
  const invitedBotInConnectedVoice = connectedVoiceChannel
    ? voiceParticipants.find(p => p.channelId === connectedVoiceChannel && (ACTIVE_BOT_IDS.has(p.id) || p.isBot) && !isDemandBotId(p.id))
    : null;

  const isConnectedVoiceRadio = Boolean(
    connectedVoiceChannel &&
    (connectedVoiceChannelObj?.is_radio || Boolean(invitedBotInConnectedVoice))
  );
  const currentVoiceDjBot = isConnectedVoiceRadio
    ? (
        connectedVoiceChannelObj?.is_radio
          ? (DJ_BOT_OPTIONS.find(d => d.id === (connectedVoiceChannelObj?.dj_bot_id || 'usr_host')) || DJ_BOT_OPTIONS[0])
          : (invitedBotInConnectedVoice ? (DJ_BOT_OPTIONS.find(d => d.id === invitedBotInConnectedVoice.id) || DJ_BOT_OPTIONS[0]) : null)
      )
    : null;

  // Cập nhật âm lượng loa bot theo userVolumes[djBotId] và speakerVolume tổng của phòng
  useEffect(() => {
    if (!currentVoiceDjBot || !botRadioIframeRef.current) return;
    const botUserVol =
      (connectedVoiceChannelObj?.dj_bot_id ? userVolumes[connectedVoiceChannelObj.dj_bot_id] : undefined) ??
      userVolumes[currentVoiceDjBot.id] ??
      80;
    const isBotLocallyMuted = Boolean(
      locallyMutedUsers[currentVoiceDjBot.id] ||
      (connectedVoiceChannelObj?.dj_bot_id && locallyMutedUsers[connectedVoiceChannelObj.dj_bot_id])
    );
    const effectiveVol = (isBotMuted || isDeafened || isBotLocallyMuted) ? 0 : Math.round(botUserVol * (speakerVolume / 100));
    if (effectiveVol === 0) {
      sendBotCmd('mute');
      sendBotCmd('setVolume', [0]);
      setIsBotSpeaking(false);
    } else {
      sendBotCmd('unMute');
      sendBotCmd('setVolume', [effectiveVol]);
      setIsBotSpeaking(true);
    }
  }, [userVolumes, speakerVolume, isDeafened, isBotMuted, locallyMutedUsers, currentVoiceDjBot, connectedVoiceChannelObj?.dj_bot_id]);

  // Watchdog kiểm tra nếu bot kết nối phòng nhưng không thể phát sau 9s -> tự động chuyển sang luồng stream khác cùng chủ đề
  useEffect(() => {
    if (!isConnectedVoiceRadio || !currentVoiceDjBot) return;
    const isBotLocallyMuted = Boolean(
      locallyMutedUsers[currentVoiceDjBot.id] ||
      (connectedVoiceChannelObj?.dj_bot_id && locallyMutedUsers[connectedVoiceChannelObj.dj_bot_id])
    );
    if (isBotMuted || isDeafened || isBotLocallyMuted) return;

    const timer = setTimeout(() => {
      if (!isBotSpeaking) {
        console.warn(`[DJ Bot Watchdog] Bot ${currentVoiceDjBot.name} chưa phát được sau 9s, tự động fetch luồng dự phòng...`);
        handleRotateBotStream(currentVoiceDjBot.id, 'Watchdog 9s stalled');
      }
    }, 9000);

    return () => clearTimeout(timer);
  }, [isConnectedVoiceRadio, currentVoiceDjBot?.id, botActiveStreamIdx, isBotSpeaking, isBotMuted, isDeafened, locallyMutedUsers]);

  // Nhận thông điệp sự kiện từ YouTube iframe của loa Bot để cập nhật visual sóng nhạc
  useEffect(() => {
    const onBotMsg = (event: MessageEvent) => {
      try {
        const matchedBotEntry = Object.entries(requestBotIframesRef.current).find(
          ([, iframeEl]) => iframeEl && iframeEl.contentWindow === event.source
        );
        if (matchedBotEntry) {
          const [matchedKey, matchedIframe] = matchedBotEntry;
          const { srvId, botId } = parseDemandBotKey(matchedKey);
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (!data) return;
          if (data.event === 'onError' || data.info?.errorCode) {
            handleRequestBotError(data.data || data.info?.errorCode, srvId, botId);
            return;
          }
          const botState = getServerRythmBotFromRecord(serverRythmBotsRef.current, srvId, botId);
          if (data.event === 'onReady') {
            const botUserVol = userVolumes[botId] ?? userVolumes['usr_music_bot'] ?? 80;
            const isUserInConnectedVoice = Boolean(connectedVoiceChannel);
            const isUserInSameServer = connectedVoiceServerId === srvId;
            const isUserInSameRoom = !botState.voiceChannelId || connectedVoiceChannel === botState.voiceChannelId;
            const canUserHearBot = isUserInConnectedVoice && isUserInSameServer && isUserInSameRoom;
            const isMuted = Boolean(locallyMutedUsers[botId] || isDeafened || !canUserHearBot);
            const effectiveVol = isMuted ? 0 : Math.round(botUserVol * (speakerVolume / 100));
            try {
              matchedIframe?.contentWindow?.postMessage(
                JSON.stringify({ event: 'command', func: effectiveVol === 0 ? 'mute' : 'unMute', args: [] }), '*'
              );
              matchedIframe?.contentWindow?.postMessage(
                JSON.stringify({ event: 'command', func: 'setVolume', args: [effectiveVol] }), '*'
              );
              if (botState.startedAt) {
                const elapsedSecs = Math.floor((Date.now() - botState.startedAt) / 1000);
                if (elapsedSecs > 3 && elapsedSecs < 14400) {
                  matchedIframe?.contentWindow?.postMessage(
                    JSON.stringify({ event: 'command', func: 'seekTo', args: [elapsedSecs, true] }), '*'
                  );
                }
              }
              matchedIframe?.contentWindow?.postMessage(
                JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*'
              );
            } catch {}
          }
          if (data.event === 'onStateChange') {
            const state = data.info !== undefined ? data.info : data.data;
            if (state === 0) {
              handleRequestBotTrackEnded(srvId, botId, botState.currentTrack?.id);
            }
          }
          if (data.event === 'infoDelivery' && data.info?.playerState === 0) {
            handleRequestBotTrackEnded(srvId, botId, botState.currentTrack?.id);
          }
          return;
        }

        if (!botRadioIframeRef.current || event.source !== botRadioIframeRef.current.contentWindow) {
          return;
        }
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data) return;

        // Bắt lỗi stream từ YouTube Iframe API (code 100, 101, 150, 2, 5) để tự động chuyển luồng dự phòng
        if (data.event === 'onError' || data.info?.errorCode) {
          console.warn('[DJ Bot Speaker] Phát hiện lỗi YouTube live stream, tự động chuyển luồng dự phòng:', data);
          if (currentVoiceDjBot) {
            handleRotateBotStream(currentVoiceDjBot.id, `Lỗi YouTube (${data.data || data.info?.errorCode})`);
          }
        }

        if (data.event === 'onReady') {
          const botUserVol = currentVoiceDjBot
            ? ((connectedVoiceChannelObj?.dj_bot_id ? userVolumes[connectedVoiceChannelObj.dj_bot_id] : undefined) ?? userVolumes[currentVoiceDjBot.id] ?? 80)
            : 80;
          const isBotLocallyMuted = currentVoiceDjBot ? Boolean(
            locallyMutedUsers[currentVoiceDjBot.id] ||
            (connectedVoiceChannelObj?.dj_bot_id && locallyMutedUsers[connectedVoiceChannelObj.dj_bot_id])
          ) : false;
          const effectiveVol = (isBotMuted || isDeafened || isBotLocallyMuted) ? 0 : Math.round(botUserVol * (speakerVolume / 100));
          if (effectiveVol === 0) {
            sendBotCmd('mute');
            sendBotCmd('setVolume', [0]);
            setIsBotSpeaking(false);
          } else {
            sendBotCmd('unMute');
            sendBotCmd('setVolume', [effectiveVol]);
            setIsBotSpeaking(true);
          }
          if (!connectedVoiceChannelObj?.is_loop_single) {
            sendBotCmd('seekTo', [99999999, true]); // Đồng bộ ngay tới điểm phát sóng trực tiếp (live edge)
          }
          sendBotCmd('playVideo');
        }
        if (data.event === 'onStateChange') {
          if (data.info === 1) {
            const isBotLocallyMuted = currentVoiceDjBot ? Boolean(
              locallyMutedUsers[currentVoiceDjBot.id] ||
              (connectedVoiceChannelObj?.dj_bot_id && locallyMutedUsers[connectedVoiceChannelObj.dj_bot_id])
            ) : false;
            setIsBotSpeaking(!isBotMuted && !isDeafened && !isBotLocallyMuted);
          } else if (data.info === 0) {
            // Nếu là kênh phát lặp video thường (is_loop_single): tự động seekTo 0 và play lại ngay liên tục
            if (connectedVoiceChannelObj?.is_loop_single) {
              console.log('[DJ Bot Speaker] Video lặp kết thúc, tự động phát lại bài từ đầu...');
              sendBotCmd('seekTo', [0, true]);
              sendBotCmd('playVideo');
              setIsBotSpeaking(true);
            } else {
              // Stream ended -> tự động chuyển sang luồng tiếp theo cùng chủ đề
              console.warn('[DJ Bot Speaker] Luồng stream kết thúc (state 0), tự động chuyển sang luồng tiếp theo...');
              setIsBotSpeaking(false);
              if (currentVoiceDjBot) {
                handleRotateBotStream(currentVoiceDjBot.id, 'Stream đã kết thúc');
              }
            }
          } else if (data.info === 2) {
            setIsBotSpeaking(false);
          }
        }
        if (data.event === 'infoDelivery' && data.info) {
          if (data.info.playerState === 1) {
            const isBotLocallyMuted = currentVoiceDjBot ? Boolean(
              locallyMutedUsers[currentVoiceDjBot.id] ||
              (connectedVoiceChannelObj?.dj_bot_id && locallyMutedUsers[connectedVoiceChannelObj.dj_bot_id])
            ) : false;
            setIsBotSpeaking(!isBotMuted && !isDeafened && !isBotLocallyMuted);
          }
        }
      } catch {}
    };
    window.addEventListener('message', onBotMsg);
    return () => window.removeEventListener('message', onBotMsg);
  }, [currentVoiceDjBot, userVolumes, speakerVolume, isDeafened, isBotMuted, locallyMutedUsers, connectedVoiceChannelObj?.dj_bot_id, serverRythmBots, connectedVoiceChannel, connectedVoiceServerId]);

  // Đồng bộ âm lượng và trạng thái mute tới tất cả các loa bot phát nhạc theo yêu cầu đang hoạt động
  useEffect(() => {
    Object.entries(requestBotIframesRef.current).forEach(([botKey, iframeEl]) => {
      if (!iframeEl) return;
      const { srvId, botId } = parseDemandBotKey(botKey);
      const botState = getServerRythmBotFromRecord(serverRythmBots, srvId, botId);
      if (!botState.currentTrack) return;
      const botUserVol = userVolumes[botId] ?? userVolumes['usr_music_bot'] ?? 80;
      const isUserInConnectedVoice = Boolean(connectedVoiceChannel);
      const isUserInSameServer = connectedVoiceServerId === srvId;
      const isUserInSameRoom = !botState.voiceChannelId || connectedVoiceChannel === botState.voiceChannelId;
      const canUserHearBot = isUserInConnectedVoice && isUserInSameServer && isUserInSameRoom;
      const isMuted = Boolean(locallyMutedUsers[botId] || isDeafened || !canUserHearBot);
      const effectiveVol = isMuted ? 0 : Math.round(botUserVol * (speakerVolume / 100));
      try {
        iframeEl.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: effectiveVol === 0 ? 'mute' : 'unMute', args: [] }), '*'
        );
        iframeEl.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'setVolume', args: [effectiveVol] }), '*'
        );
      } catch {}
    });
  }, [userVolumes, locallyMutedUsers, isDeafened, speakerVolume, serverRythmBots, connectedVoiceChannel, connectedVoiceServerId]);

  const [isFriendsTabActive, setIsFriendsTabActive] = useState(() => servers.length === 0);
  const [friendsTab, setFriendsTab] = useState<'online' | 'all' | 'pending' | 'add'>('online');
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [addFriendInput, setAddFriendInput] = useState('');
  const [addFriendMessage, setAddFriendMessage] = useState<string | null>(null);
  const [addFriendError, setAddFriendError] = useState<string | null>(null);
  const [selectedProfileUser, setSelectedProfileUser] = useState<CommunityUserProfile | null>(null);

  // ──────── CHAT RIÊNG (DIRECT MESSAGE 1-1) & CALL RIÊNG VỚI BẠN BÈ ────────
  const [activeDmFriend, setActiveDmFriend] = useState<CommunityUserProfile | null>(null);
  const [dmMessages, setDmMessages] = useState<CommunityMessage[]>([]);
  const [dmInputText, setDmInputText] = useState('');
  const [dmAttachTrack, setDmAttachTrack] = useState(false);
  const [dmCallConnected, setDmCallConnected] = useState(false);
  const [dmCallCountdown, setDmCallCountdown] = useState(30);
  const activeDmChannelRef = useRef<any>(null);
  const dmMessagesEndRef = useRef<HTMLDivElement>(null);

  // ──────── THÔNG BÁO TIN NHẮN MỚI CHƯA ĐỌC (KÝ HIỆU SỐ MÀU ĐỎ) ────────
  const [unreadDmCounts, setUnreadDmCounts] = useState<Record<string, number>>(() => {
    if (!currentUser?.id) return {};
    try {
      const raw = localStorage.getItem(`spytify_unread_dm_${currentUser.id}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [unreadChannelCounts, setUnreadChannelCounts] = useState<Record<string, number>>(() => {
    if (!currentUser?.id) return {};
    try {
      const raw = localStorage.getItem(`spytify_unread_ch_${currentUser.id}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  const persistSeenMessageIds = () => {
    if (!currentUser?.id) return;
    try {
      const arr = Array.from(seenMessageIdsRef.current).slice(-500);
      localStorage.setItem(`spytify_seen_msg_ids_${currentUser.id}`, JSON.stringify(arr));
    } catch {}
  };

  const markDmAsRead = (friendId: string, messagesInRoom?: CommunityMessage[]) => {
    if (!currentUser?.id || !friendId) return;
    if (messagesInRoom && messagesInRoom.length > 0) {
      messagesInRoom.forEach(m => {
        if (m.id) seenMessageIdsRef.current.add(m.id);
      });
      persistSeenMessageIds();
    }
    setUnreadDmCounts(prev => {
      if (!prev[friendId]) return prev;
      const next = { ...prev };
      delete next[friendId];
      try {
        localStorage.setItem(`spytify_unread_dm_${currentUser.id}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const markChannelAsRead = (channelId: string) => {
    if (!currentUser?.id || !channelId) return;
    setUnreadChannelCounts(prev => {
      if (!prev[channelId]) return prev;
      const next = { ...prev };
      delete next[channelId];
      try {
        localStorage.setItem(`spytify_unread_ch_${currentUser.id}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const getDmRoomId = (uid1: string, uid2: string) =>
    ['dm', ...[uid1, uid2].sort()].join('_');

  // ──────── SERVER INVITES (ĐỒNG Ý MỚI VÀO SERVER) & LINK MỜI ────────
  const [incomingServerInvites, setIncomingServerInvites] = useState<CloudServerInvite[]>([]);
  const [outgoingServerInvites, setOutgoingServerInvites] = useState<CloudServerInvite[]>([]);
  const [joinServerLinkInput, setJoinServerLinkInput] = useState('');
  const [joinServerStatusMsg, setJoinServerStatusMsg] = useState<string | null>(null);
  const [joinServerErrorMsg, setJoinServerErrorMsg] = useState<string | null>(null);

  // ──────── SERVER SETTINGS & CONFIRMATION MODAL STATE ────────
  const [isServerSettingsOpen, setIsServerSettingsOpen] = useState(false);
  const [confirmActionModal, setConfirmActionModal] = useState<
    | { type: 'delete_server'; serverId: string; serverName: string }
    | { type: 'kick_member'; memberId: string; memberName: string }
    | { type: 'transfer_owner'; memberId: string; memberName: string }
    | { type: 'delete_channel'; channelId: string; channelName: string; channelType: 'text' | 'voice' | 'stage' }
    | null
  >(null);
  const [serverSettingsTab, setServerSettingsTab] = useState<'overview' | 'members' | 'tags' | 'invites' | 'danger'>('overview');
  const [editServerName, setEditServerName] = useState('');
  const [editServerDesc, setEditServerDesc] = useState('');
  const [editServerIcon, setEditServerIcon] = useState('⚡');
  const [editServerColor, setEditServerColor] = useState('#00E5FF');
  const [editServerMaxMembers, setEditServerMaxMembers] = useState(50);
  const [inviteCopied, setInviteCopied] = useState(false);

  // ──────── USER TAG SELECTION & SERVER OWNER TAG MANAGEMENT ────────
  const [isTagSelectModalOpen, setIsTagSelectModalOpen] = useState(false);
  const [selectedTagIdsDraft, setSelectedTagIdsDraft] = useState<string[]>([]);
  const [newTagDraftName, setNewTagDraftName] = useState('');
  const [newTagDraftColor, setNewTagDraftColor] = useState('#00E5FF');
  const [newTagDraftIcon, setNewTagDraftIcon] = useState('🎵');

  // Mở trực tiếp tab chọn Tag sở thích trong Cài đặt Server
  const handleOpenTagSelectModal = () => {
    handleOpenServerSettings(selectedServer, 'tags');
  };

  const handleToggleTagDraft = (tagId: string) => {
    setSelectedTagIdsDraft(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSaveUserTags = () => {
    const myId = currentUser?.id || myParticipantIdRef.current || 'usr_me';
    const currentMemberTags = selectedServer.member_tags || {};
    const updatedMemberTags: Record<string, string[]> = {
      ...currentMemberTags,
      [myId]: selectedTagIdsDraft,
      usr_me: selectedTagIdsDraft,
    };
    if (currentUser?.id) {
      updatedMemberTags[currentUser.id] = selectedTagIdsDraft;
    }
    if (myParticipantIdRef.current) {
      updatedMemberTags[myParticipantIdRef.current] = selectedTagIdsDraft;
    }
    const updatedSrv: CommunityServer = {
      ...selectedServer,
      member_tags: updatedMemberTags,
    };
    broadcastAndPersistServerUpdate(updatedSrv);
    setIsTagSelectModalOpen(false);
  };

  // Chủ server thêm tag mới
  const handleAddServerTag = () => {
    if (!newTagDraftName.trim()) return;
    const currentTags = getServerTags(selectedServer);
    const newTag: CommunityServerTag = {
      id: `tag_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: newTagDraftName.trim(),
      color: newTagDraftColor,
      icon: newTagDraftIcon || '🏷️',
    };
    const updatedSrv: CommunityServer = {
      ...selectedServer,
      tags: [...currentTags, newTag],
    };
    broadcastAndPersistServerUpdate(updatedSrv);
    setNewTagDraftName('');
  };

  // Chủ server xóa tag
  const handleDeleteServerTag = (tagId: string) => {
    const currentTags = getServerTags(selectedServer);
    const updatedSrv: CommunityServer = {
      ...selectedServer,
      tags: currentTags.filter(t => t.id !== tagId),
    };
    broadcastAndPersistServerUpdate(updatedSrv);
  };

  // Kiểm tra người dùng có thực sự đang theo dõi currentUser trên hệ thống đám mây hay không
  const isUserFollowingMe = (userId: string): boolean => {
    return Boolean(followersOfMeMap[userId]);
  };

  // Rule: A follows B and B follows A => Friends!
  const isMutualFriend = (user: CommunityUserProfile): boolean => {
    return followingUserIds.has(user.id) && isUserFollowingMe(user.id);
  };

  // Danh sách lời mời kết bạn đến (người khác đã gửi kết bạn / theo dõi mình nhưng mình chưa đồng ý)
  const incomingFriendRequests: CloudFollowEdge[] = Object.values(followersOfMeMap).filter(
    edge => edge.followerId && edge.followerId !== currentUser?.id && !followingUserIds.has(edge.followerId)
  );

  // Follow / Unfollow logic (đồng bộ trực tiếp lên Supabase Cloud & phát thông báo real-time)
  const handleToggleFollow = (userId: string) => {
    if (!currentUser) return;
    const isBot = ACTIVE_BOT_IDS.has(userId) || userId === 'custom' || userId.startsWith('bot_');
    if (isBot && !CAN_FOLLOW_BOT_IDS.has(userId)) {
      return;
    }
    const isCurrentlyFollowing = followingUserIds.has(userId);
    setFollowingUserIds(prev => {
      const next = new Set(prev);
      if (isCurrentlyFollowing) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      try {
        localStorage.setItem(`spytify_user_following_${currentUser.id}`, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });

    if (isCurrentlyFollowing) {
      removeCloudFollow(currentUser.id, userId).catch(() => {});
      globalSocialChannelRef.current?.send({
        type: 'broadcast',
        event: 'follow_update',
        payload: {
          action: 'unfollow',
          followerId: currentUser.id,
          targetId: userId,
        },
      });
    } else {
      pushCloudFollow(
        {
          id: currentUser.id,
          username: currentUser.username,
          display_name: currentUser.display_name,
          avatar: currentUser.avatar || null,
        },
        userId
      ).catch(() => {});
      globalSocialChannelRef.current?.send({
        type: 'broadcast',
        event: 'follow_update',
        payload: {
          action: 'follow',
          followerId: currentUser.id,
          followerUsername: currentUser.username,
          followerDisplayName: currentUser.display_name,
          followerAvatar: currentUser.avatar || null,
          targetId: userId,
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      });
    }
  };

  // Đồng ý lời mời kết bạn (Follow lại người đã gửi lời mời -> Trở thành Bạn bè ngay lập tức)
  const handleAcceptFriendRequest = (edge: CloudFollowEdge) => {
    if (!currentUser) return;
    // Đảm bảo người gửi có trong registeredUsers để hiện trong danh sách Bạn bè
    setRegisteredUsers(prev => {
      const exists = prev.some(u => u.id === edge.followerId);
      const updated = exists
        ? prev.map(u =>
            u.id === edge.followerId
              ? {
                  ...u,
                  username: edge.followerUsername || u.username,
                  display_name: edge.followerDisplayName || u.display_name,
                  avatar: edge.followerAvatar || u.avatar,
                  followsCurrentUser: true,
                }
              : u
          )
        : [
            ...prev,
            {
              id: edge.followerId,
              username: edge.followerUsername || 'operative',
              display_name: edge.followerDisplayName || edge.followerUsername || 'Operative',
              avatar: edge.followerAvatar || null,
              role: 'AGENT',
              status: 'offline' as const,
              bio: 'Thành viên Spytify từ hệ thống cộng đồng.',
              listening: null,
              isHost: false,
              followsCurrentUser: true,
              joinedAt: new Date().toISOString().split('T')[0],
            },
          ];
      try {
        localStorage.setItem('spytify_registered_users', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setFollowingUserIds(prev => {
      const next = new Set(prev);
      next.add(edge.followerId);
      try {
        localStorage.setItem(`spytify_user_following_${currentUser.id}`, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });

    pushCloudFollow(
      {
        id: currentUser.id,
        username: currentUser.username,
        display_name: currentUser.display_name,
        avatar: currentUser.avatar || null,
      },
      edge.followerId
    ).catch(() => {});

    globalSocialChannelRef.current?.send({
      type: 'broadcast',
      event: 'follow_update',
      payload: {
        action: 'follow',
        followerId: currentUser.id,
        followerUsername: currentUser.username,
        followerDisplayName: currentUser.display_name,
        followerAvatar: currentUser.avatar || null,
        targetId: edge.followerId,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    });
  };

  // Từ chối / Xóa lời mời kết bạn đến
  const handleDeclineFriendRequest = (edge: CloudFollowEdge) => {
    if (!currentUser) return;
    setFollowersOfMeMap(prev => {
      const next = { ...prev };
      delete next[edge.followerId];
      return next;
    });
    removeCloudFollow(edge.followerId, currentUser.id).catch(() => {});
    globalSocialChannelRef.current?.send({
      type: 'broadcast',
      event: 'follow_update',
      payload: {
        action: 'unfollow',
        followerId: edge.followerId,
        targetId: currentUser.id,
      },
    });
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddFriendMessage(null);
    setAddFriendError(null);

    const cleanHandle = addFriendInput.trim().replace(/^@/, '').toLowerCase();
    if (!cleanHandle) return;

    // Check if adding self
    if (currentUser && (currentUser.username?.toLowerCase() === cleanHandle || currentUser.display_name?.toLowerCase() === cleanHandle)) {
      setAddFriendError('Bạn không thể tự kết bạn với chính mình!');
      setTimeout(() => setAddFriendError(null), 3500);
      return;
    }

    // 1. Check in known registered users
    let target = registeredUsers.find(u => 
      !u.id.startsWith('usr_custom_') && 
      (u.username.toLowerCase() === cleanHandle || u.display_name.toLowerCase() === cleanHandle)
    );

    // 2. Query Supabase Cloud Database for real users (luôn lấy avatar mới nhất trên Cloud)
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data } = await client
          .from('spytify_profiles')
          .select('id, username, display_name, avatar')
          .or(`username.ilike.${cleanHandle},display_name.ilike.${cleanHandle}`)
          .limit(1);

        if (data && data.length > 0) {
          const p = data[0];
          target = {
            id: p.id,
            username: p.username || cleanHandle,
            display_name: p.display_name || p.username || cleanHandle,
            avatar: p.avatar || target?.avatar || null,
            role: target?.role || 'AGENT',
            status: target?.status || 'offline',
            bio: target?.bio || 'Thành viên Spytify từ hệ thống cộng đồng.',
            listening: target?.listening || null,
            isHost: Boolean(target?.isHost),
            followsCurrentUser: isUserFollowingMe(p.id),
            joinedAt: target?.joinedAt || new Date().toISOString().split('T')[0],
          };
          setRegisteredUsers(prev => {
            const next = [...prev.filter(u => u.id !== target!.id), target!];
            localStorage.setItem('spytify_registered_users', JSON.stringify(next));
            return next;
          });
        }
      } catch (err) {
        console.error('Supabase user search failed:', err);
      }
    }

    // 3. If STILL not found: STRICT REJECTION! Do NOT invent fake users!
    if (!target) {
      setAddFriendError(`Người dùng @${cleanHandle} không tồn tại trên hệ thống Spytify!`);
      setTimeout(() => setAddFriendError(null), 3500);
      return;
    }

    setFollowingUserIds(prev => {
      const next = new Set(prev);
      next.add(target!.id);
      if (currentUser?.id) {
        localStorage.setItem(`spytify_user_following_${currentUser.id}`, JSON.stringify(Array.from(next)));
      }
      return next;
    });

    if (currentUser) {
      pushCloudFollow(
        {
          id: currentUser.id,
          username: currentUser.username,
          display_name: currentUser.display_name,
          avatar: currentUser.avatar || null,
        },
        target.id
      ).catch(() => {});

      globalSocialChannelRef.current?.send({
        type: 'broadcast',
        event: 'follow_update',
        payload: {
          action: 'follow',
          followerId: currentUser.id,
          followerUsername: currentUser.username,
          followerDisplayName: currentUser.display_name,
          followerAvatar: currentUser.avatar || null,
          targetId: target.id,
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      });
    }

    if (isUserFollowingMe(target.id)) {
      setAddFriendMessage(`Hai bạn đã theo dõi lẫn nhau và chính thức là Bạn bè với ${target.display_name} (@${target.username})!`);
    } else {
      setAddFriendMessage(`Đã gửi lời mời kết bạn tới @${target.username}. Khi đối phương nhấn Đồng ý, hai bạn sẽ trở thành bạn bè!`);
    }
    setAddFriendInput('');
    setTimeout(() => setAddFriendMessage(null), 4000);
  };

  const handlePlayMemberTrack = async (member: { id?: string; name?: string; display_name?: string; listeningTrack?: Track | null; listening?: string | null }) => {
    // 1. Nếu đã có Track hợp lệ (URL, YouTube Video ID 11 ký tự, hoặc đường dẫn cục bộ)
    const lt = member.listeningTrack;
    if (lt && lt.path_or_url) {
      const ytId = extractYouTubeId(lt.path_or_url);
      if (lt.source === 'youtube' && ytId) {
        onPlayTrack({
          ...lt,
          path_or_url: ytId,
          duration_secs: lt.album === 'On-Demand Music Queue' ? (lt.duration_secs > 0 ? lt.duration_secs : 180) : lt.duration_secs,
        });
        return;
      }
      if (lt.source !== 'youtube' || /^[a-zA-Z0-9_-]{11}$/.test(lt.path_or_url.replace(/^yt_/, ''))) {
        onPlayTrack(lt);
        return;
      }
    }

    // 2. Nếu là Bot Yêu Cầu (/play): lấy trực tiếp bài hát hiện hành trong state của Bot đó
    if (member.id && isDemandBotId(member.id)) {
      const botState = getServerRythmBot(selectedServer.id, member.id);
      if (botState.currentTrack) {
        const cur = botState.currentTrack;
        onPlayTrack({
          id: cur.id,
          title: cur.title,
          artist: cur.artist,
          album: 'On-Demand Music Queue',
          duration_secs: 180,
          path_or_url: cur.url_or_id,
          source: 'youtube',
          cover_art: cur.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
        });
        return;
      }
      showVoiceToast(
        language === 'vi'
          ? 'Bot hiện đang chờ lệnh /play trong phòng thoại, chưa có bài hát nào đang phát.'
          : 'This bot is idle and not playing any track yet.'
      );
      return;
    }

    // 3. Nếu là Bot Trạm Live: tìm đúng kênh radio / DJ option của bot để lấy YouTube Stream ID thực tế
    if (member.id) {
      const stationCh = selectedServer.channels.find(
        c => c.is_radio && (c.dj_bot_id === member.id || (!c.dj_bot_id && member.id === 'usr_host'))
      );
      if (stationCh?.custom_stream_url) {
        const stationVid = extractYouTubeId(stationCh.custom_stream_url);
        if (stationVid) {
          onPlayTrack({
            id: `yt_station_${member.id}`,
            title: stationCh.custom_stream_title || stationCh.name || member.display_name || member.name || 'Live Station',
            artist: member.display_name || member.name || 'Custom DJ',
            album: 'Spytify 24/7 Live Radio',
            duration_secs: 0,
            path_or_url: stationVid,
            source: 'youtube',
            cover_art: 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?w=500&auto=format&fit=crop&q=60',
          });
          return;
        }
      }
      const djOpt = DJ_BOT_OPTIONS.find(d => d.id === member.id);
      if (djOpt?.track) {
        onPlayTrack(djOpt.track);
        return;
      }
    }

    // 4. Suy luận từ chuỗi text trạng thái listening: tìm link/ID YouTube hoặc tìm kiếm YouTube thực tế
    if (member.listening) {
      const cleaned = member.listening.replace(/^[\s🔴🎶🎵🎧▶️]+/, '').trim();
      const lower = cleaned.toLowerCase();
      if (!cleaned || lower.includes('sẵn sàng nhận lệnh') || lower === 'sẵn sàng' || lower === 'ready') {
        showVoiceToast(
          language === 'vi'
            ? 'Không có bài hát đang phát ở trạng thái hiện tại.'
            : 'No playable track in current status.'
        );
        return;
      }

      const directYt = extractYouTubeId(cleaned);
      const parts = cleaned.split(' - ');
      if (directYt) {
        onPlayTrack({
          id: `yt_track_${Date.now()}`,
          title: parts[0] || cleaned,
          artist: parts[1] || 'Spytify Artist',
          album: 'Community Listen Along',
          duration_secs: 180,
          path_or_url: directYt,
          source: 'youtube',
          cover_art: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
        });
        return;
      }

      try {
        const searchRes = await invoke<SearchResult[]>('search_online', { query: cleaned, source: 'youtube' });
        if (searchRes && searchRes.length > 0) {
          const first = searchRes[0];
          const vid = first.url_or_id.replace(/^yt_/, '');
          onPlayTrack({
            id: `yt_track_${vid}_${Date.now()}`,
            title: first.title || parts[0] || cleaned,
            artist: first.artist || parts[1] || 'YouTube',
            album: 'Community Listen Along',
            duration_secs: first.duration_secs || 180,
            path_or_url: vid,
            source: 'youtube',
            cover_art: first.thumbnail || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
          });
          return;
        }
      } catch (err) {
        console.warn('[Listen Along] Failed resolving track:', err);
      }

      showVoiceToast(
        language === 'vi'
          ? `Không tìm thấy nguồn phát cho "${cleaned}"`
          : `Could not find playable stream for "${cleaned}"`
      );
    }
  };

  const handleOpenServerSettings = (
    srv: CommunityServer,
    initialTab: 'overview' | 'members' | 'tags' | 'invites' | 'danger' = 'overview'
  ) => {
    setEditServerName(srv.name);
    setEditServerDesc(srv.description);
    setEditServerIcon(srv.icon);
    setEditServerColor(srv.accent_color);
    setEditServerMaxMembers(srv.max_members || 50);
    setEditServerAllowInvites(srv.allow_member_invites ?? true);
    setNicknameDraft(serverNicknames[srv.id] || currentUser?.display_name || '');
    const myTags = resolveMemberTags(currentUser?.id || 'usr_me', srv, myServerDisplayName);
    setSelectedTagIdsDraft(myTags.map(t => t.id));
    setServerSettingsTab(initialTab);
    setInviteCopied(false);
    setIsServerSettingsOpen(true);
  };

  const handleSaveNicknameOnly = () => {
    const trimmedNick = nicknameDraft.trim();
    setServerNicknames(prev => {
      const next = { ...prev };
      if (trimmedNick) {
        next[selectedServer.id] = trimmedNick;
      } else {
        delete next[selectedServer.id];
      }
      try {
        localStorage.setItem('spytify_server_nicknames', JSON.stringify(next));
      } catch {}
      return next;
    });
    showVoiceToast(language === 'vi' ? 'Đã lưu biệt danh máy chủ!' : 'Server nickname saved!');
    setIsServerSettingsOpen(false);
  };

  const handleSaveServerSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editServerName.trim()) return;

    const trimmedNick = nicknameDraft.trim();
    setServerNicknames(prev => {
      const next = { ...prev };
      if (trimmedNick) {
        next[selectedServer.id] = trimmedNick;
      } else {
        delete next[selectedServer.id];
      }
      try {
        if (currentUser?.id) {
          localStorage.setItem(`spytify_server_nicknames_${currentUser.id}`, JSON.stringify(next));
        }
      } catch {}
      return next;
    });

    if (!canManageServer) {
      showVoiceToast('Đã lưu biệt danh trên máy chủ!');
      setIsServerSettingsOpen(false);
      return;
    }

    const updatedSrv: CommunityServer = {
      ...selectedServer,
      name: editServerName.trim(),
      description: editServerDesc.trim(),
      icon: editServerIcon.trim() || '⚡',
      accent_color: editServerColor,
      max_members: editServerMaxMembers,
      allow_member_invites: isServerOwner ? editServerAllowInvites : (selectedServer.allow_member_invites ?? true),
    };

    const updatedList = servers.map(s => s.id === selectedServer.id ? updatedSrv : s);
    setServers(updatedList);
    setSelectedServer(updatedSrv);
    persistServers(updatedList);
    pushCloudServer(updatedSrv).catch(() => {});
    activeChannelRef.current?.send({
      type: 'broadcast',
      event: 'server_updated',
      payload: updatedSrv,
    });

    onActiveServerChange?.(updatedSrv);
    setIsServerSettingsOpen(false);
  };

  const handleSaveBotConfig = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canManageServer) {
      showVoiceToast(language === 'vi' ? 'Chỉ Chủ server và Mod mới có quyền tùy biến bot!' : 'Only Server Owner and Mod can customize bots!');
      return;
    }
    const isDemand = botDraftType === 'demand';
    let botId = editingBotTargetId;
    if (!botId) {
      if (isDemand) {
        const hasBase = registeredUsers.some(u => u.id === 'usr_music_bot');
        botId = hasBase ? `usr_music_bot_${Date.now()}` : 'usr_music_bot';
      } else {
        botId = `bot_custom_${Date.now()}`;
      }
    }
    const trimmedName = botDraftName.trim() || (isDemand ? (botId === 'usr_music_bot' ? 'Rythm' : `Music Bot ${demandMusicBots.length + 1}`) : 'Custom DJ');
    const trimmedTag = botDraftTag.trim() || (isDemand ? 'ON-DEMAND' : 'RADIO');
    const trimmedListening = botDraftListening.trim() || (isDemand ? 'Sẵn sàng nhận lệnh /play' : null);

    const stationStreamVid = !isDemand && botDraftStreamUrl.trim() ? extractYouTubeId(botDraftStreamUrl.trim()) : null;
    const savedStationTrack: Track | null = stationStreamVid
      ? {
          id: `yt_station_${botId}`,
          title: trimmedListening || `${trimmedName} Live`,
          artist: trimmedName,
          album: 'Spytify 24/7 Live Radio',
          duration_secs: 0,
          path_or_url: stationStreamVid,
          source: 'youtube',
          cover_art: 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?w=500&auto=format&fit=crop&q=60',
        }
      : null;

    const existingBotProfile = registeredUsers.find(u => u.id === botId);
    const savedBotProfile: CommunityUserProfile = {
      id: botId,
      username: existingBotProfile?.username || trimmedName.toLowerCase().replace(/\s+/g, '_'),
      display_name: trimmedName,
      avatar: botDraftAvatar || existingBotProfile?.avatar || null,
      role: trimmedTag,
      status: 'online',
      bio: isDemand
        ? 'Bot phát nhạc theo yêu cầu (/play) hoạt động độc lập theo từng Server.'
        : 'Bot trạm phát nhạc Radio 24/7.',
      listening: trimmedListening,
      listeningTrack: savedStationTrack || existingBotProfile?.listeningTrack || null,
      isHost: true,
      followsCurrentUser: false,
      joinedAt: existingBotProfile?.joinedAt || new Date().toISOString(),
    };

    setRegisteredUsers(prev => {
      const exists = prev.some(u => u.id === botId);
      const next = exists
        ? prev.map(u => (u.id === botId ? { ...u, ...savedBotProfile } : u))
        : [...prev, savedBotProfile];
      try {
        localStorage.setItem('spytify_registered_users', JSON.stringify(next));
      } catch {}
      return next;
    });

    const existingOption = DJ_BOT_OPTIONS.find(d => d.id === botId);
    if (existingOption) {
      existingOption.name = trimmedName;
      if (trimmedListening) {
        existingOption.liveStreamTitle = trimmedListening;
        existingOption.trackName = trimmedListening;
      }
    }

    let nextChannels = selectedServer.channels;

    if (!isDemand) {
      const cleanUrl = botDraftStreamUrl.trim();
      const backupList = botDraftBackupUrls
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

      // Cập nhật hoặc tạo kênh Radio tương ứng cho Bot Trạm Live
      const targetCh = selectedServer.channels.find(
        c => c.is_radio && (
          c.dj_bot_id === botId ||
          (!c.dj_bot_id && botId === 'usr_host') ||
          (editingBotTargetId && c.id === 'custom')
        )
      );
      if (targetCh) {
        const updatedChannel: CommunityChannel = {
          ...targetCh,
          custom_bot_name: trimmedName,
          custom_bot_avatar: botDraftAvatar || undefined,
          custom_stream_url: cleanUrl || targetCh.custom_stream_url,
          custom_backup_streams: backupList.length > 0 ? backupList : targetCh.custom_backup_streams,
          is_loop_single: botDraftIsLoopSingle,
          custom_stream_title: trimmedListening || targetCh.custom_stream_title,
        };
        nextChannels = selectedServer.channels.map(c => c.id === targetCh.id ? updatedChannel : c);
      } else if (!editingBotTargetId && cleanUrl) {
        const newCh: CommunityChannel = {
          id: `radio_${botId}`,
          name: trimmedName,
          type: 'voice',
          is_radio: true,
          dj_bot_id: botId,
          custom_bot_name: trimmedName,
          custom_bot_avatar: botDraftAvatar || undefined,
          custom_stream_url: cleanUrl,
          custom_backup_streams: backupList.length > 0 ? backupList : undefined,
          is_loop_single: botDraftIsLoopSingle,
          custom_stream_title: trimmedListening || `${trimmedName} Live`,
        };
        nextChannels = [...selectedServer.channels, newCh];
      }
    }

    // Luôn đảm bảo Bot (cả Trạm Live lẫn Theo Yêu Cầu) được add vào danh sách thành viên & custom_bots của Server để đồng bộ tới mọi user khác
    const usesExplicitMembers = Boolean(
      Array.isArray(selectedServer.member_ids) ||
      selectedServer.is_custom ||
      selectedServer.id.startsWith('srv_custom_')
    );
    const currentMemberIds = Array.isArray(selectedServer.member_ids) ? selectedServer.member_ids : [];
    const needsMemberAdd = usesExplicitMembers && !currentMemberIds.includes(botId);
    const nextMemberIds = usesExplicitMembers
      ? (needsMemberAdd ? [...currentMemberIds, botId] : currentMemberIds)
      : selectedServer.member_ids;
    const hasKicked = Array.isArray(selectedServer.kicked_ids) && selectedServer.kicked_ids.includes(botId);
    const nextKickedIds = hasKicked
      ? (selectedServer.kicked_ids || []).filter(id => id !== botId)
      : selectedServer.kicked_ids;

    const prevCustomBots = Array.isArray(selectedServer.custom_bots) ? selectedServer.custom_bots : [];
    const nextCustomBots = prevCustomBots.some(b => b.id === botId)
      ? prevCustomBots.map(b => (b.id === botId ? { ...b, ...savedBotProfile } : b))
      : [...prevCustomBots, savedBotProfile];

    const updatedSrv: CommunityServer = {
      ...selectedServer,
      channels: nextChannels,
      custom_bots: nextCustomBots,
      ...(usesExplicitMembers ? { member_ids: nextMemberIds } : {}),
      ...(hasKicked ? { kicked_ids: nextKickedIds } : {}),
    };
    broadcastAndPersistServerUpdate(updatedSrv);

    showVoiceToast(
      language === 'vi'
        ? `Đã lưu cấu hình ${isDemand ? 'Bot Theo Yêu Cầu' : 'Bot Trạm Live'}: ${trimmedName}`
        : `Saved ${isDemand ? 'On-Demand' : 'Station'} Bot: ${trimmedName}`
    );
    setIsBotModalOpen(false);
    setEditingBotTargetId(null);
  };

  // ──────── QUYỀN HẠN TRONG SERVER (CHỦ SERVER / MOD / THÀNH VIÊN) ────────
  const myAccountUserId = currentUser?.id || null;
  const hasActiveServer = !isFriendsTabActive && servers.length > 0 && selectedServer.id !== 'srv_none';
  const mySelectedServerRoles = resolveServerRoleFlags(selectedServer, currentUser?.id);
  const isServerOwner = mySelectedServerRoles.isOwner;
  const isServerMod = mySelectedServerRoles.isMod;
  const canManageServer = mySelectedServerRoles.canManage;

  const isMemberModerator = (memberId: string, srv: CommunityServer = selectedServer): boolean => {
    if (srv.id === 'srv_none') return false;
    if (memberId === 'usr_me' || (currentUser?.id && memberId === currentUser.id)) {
      return resolveServerRoleFlags(srv, currentUser?.id).isMod;
    }
    return srv.owner_id !== memberId && Array.isArray(srv.moderator_ids) && srv.moderator_ids.includes(memberId);
  };

  const isMemberServerOwner = (memberId: string, srv: CommunityServer = selectedServer): boolean => {
    if (srv.id === 'srv_none') return false;
    if (memberId === 'usr_me' || (currentUser?.id && memberId === currentUser.id)) {
      return resolveServerRoleFlags(srv, currentUser?.id).isOwner;
    }
    return srv.owner_id === memberId;
  };

  const mergeCustomBotsLists = (
    localBots?: CommunityUserProfile[],
    cloudBots?: CommunityUserProfile[]
  ): CommunityUserProfile[] | undefined => {
    const map = new Map<string, CommunityUserProfile>();
    (Array.isArray(localBots) ? localBots : []).forEach(b => {
      if (b?.id) map.set(b.id, b);
    });
    (Array.isArray(cloudBots) ? cloudBots : []).forEach(b => {
      if (b?.id) map.set(b.id, { ...map.get(b.id), ...b });
    });
    return map.size > 0 ? Array.from(map.values()) : undefined;
  };

  const syncServerCustomBotsToRegisteredUsers = (srvs: CommunityServer[]) => {
    const incomingBots: CommunityUserProfile[] = [];
    srvs.forEach(s => {
      if (Array.isArray(s?.custom_bots)) {
        s.custom_bots.forEach(b => {
          if (b?.id) incomingBots.push(b);
        });
      }
    });
    if (incomingBots.length === 0) return;

    setRegisteredUsers(prev => {
      const byId = new Map<string, CommunityUserProfile>();
      prev.forEach(u => byId.set(u.id, u));
      let changed = false;
      incomingBots.forEach(bot => {
        const existing = byId.get(bot.id);
        if (!existing) {
          byId.set(bot.id, {
            ...bot,
            status: 'online',
            isHost: true,
          });
          changed = true;
        } else if (
          existing.display_name !== bot.display_name ||
          existing.avatar !== bot.avatar ||
          existing.role !== bot.role ||
          existing.listening !== bot.listening ||
          existing.listeningTrack?.path_or_url !== bot.listeningTrack?.path_or_url
        ) {
          byId.set(bot.id, {
            ...existing,
            ...bot,
            status: 'online',
            isHost: true,
          });
          changed = true;
        }
      });
      if (!changed) return prev;
      const next = Array.from(byId.values());
      try {
        localStorage.setItem('spytify_registered_users', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const broadcastAndPersistServerUpdate = (updatedSrv: CommunityServer) => {
    syncServerCustomBotsToRegisteredUsers([updatedSrv]);
    setServers(prev => {
      const exists = prev.some(s => s.id === updatedSrv.id);
      const next = exists ? prev.map(s => (s.id === updatedSrv.id ? updatedSrv : s)) : [...prev, updatedSrv];
      persistServers(next);
      return next;
    });
    if (selectedServer.id === updatedSrv.id) {
      setSelectedServer(updatedSrv);
    }
    pushCloudServer(updatedSrv).catch(() => {});
    activeChannelRef.current?.send({
      type: 'broadcast',
      event: 'server_updated',
      payload: updatedSrv,
    });
    globalSocialChannelRef.current?.send({
      type: 'broadcast',
      event: 'server_updated',
      payload: updatedSrv,
    });
  };

  const postServerWelcomeMessage = (
    srv: CommunityServer,
    joinedMember: { id: string; username: string; display_name: string; avatar?: string | null }
  ) => {
    const firstTextCh = srv.channels.find(c => c.type === 'text') || srv.channels[0];
    if (!firstTextCh) return;
    const createdAtStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const welcomeMsg: CommunityMessage = {
      id: `msg_welcome_${srv.id}_${joinedMember.id}_${Date.now()}`,
      server_id: srv.id,
      channel_id: firstTextCh.id,
      user_id: joinedMember.id,
      username: joinedMember.username || 'operative',
      display_name: joinedMember.display_name || joinedMember.username || 'Thành viên mới',
      avatar: joinedMember.avatar || null,
      content: `🎉 Chào mừng @${joinedMember.username} (${joinedMember.display_name}) vừa chính thức tham gia máy chủ "${srv.name}"! Hãy cùng gửi lời chào tới thành viên mới nhé!`,
      track_embed: null,
      created_at: createdAtStr,
    };

    appendServerMessage(welcomeMsg);

    activeChannelRef.current?.send({
      type: 'broadcast',
      event: 'new_message',
      payload: welcomeMsg,
    });

    globalSocialChannelRef.current?.send({
      type: 'broadcast',
      event: 'server_message_notify',
      payload: {
        serverId: srv.id,
        channelId: firstTextCh.id,
        senderId: welcomeMsg.user_id,
        message: welcomeMsg,
      },
    });

    pushCloudDirectMessage({
      id: welcomeMsg.id,
      room_id: `spytify_srv_chat_${srv.id}`,
      sender_id: welcomeMsg.user_id,
      receiver_id: firstTextCh.id,
      sender_username: welcomeMsg.username,
      sender_display_name: welcomeMsg.display_name,
      sender_avatar: welcomeMsg.avatar || null,
      content: welcomeMsg.content,
      track_embed: null,
      created_at: createdAtStr,
      sent_at: new Date().toISOString(),
    }).catch(() => {});
  };

  const handleToggleModerator = (memberId: string) => {
    if (!isServerOwner || memberId === 'usr_me' || memberId === currentUser?.id || ACTIVE_BOT_IDS.has(memberId)) return;
    const currentMods = sanitizeModeratorIds(selectedServer.moderator_ids, selectedServer.owner_id, selectedServer.kicked_ids, myAccountUserId);
    const nextMods = currentMods.includes(memberId)
      ? currentMods.filter(id => id !== memberId)
      : [...currentMods, memberId];
    const updatedSrv: CommunityServer = { ...selectedServer, moderator_ids: nextMods };
    broadcastAndPersistServerUpdate(updatedSrv);
  };

  const requestTransferOwnership = (memberId: string, memberName?: string) => {
    if (memberId === 'usr_me' || (currentUser?.id && memberId === currentUser.id) || ACTIVE_BOT_IDS.has(memberId)) return;
    const resolvedName =
      memberName ||
      onlineMembers.find(m => m.id === memberId)?.name ||
      registeredUsers.find(u => u.id === memberId)?.display_name ||
      memberId;
    setConfirmActionModal({
      type: 'transfer_owner',
      memberId,
      memberName: resolvedName,
    });
  };

  // Nhượng quyền Chủ Server cho thành viên khác & hạ quyền Chủ hiện tại xuống Điều hành viên (Mod)
  const handleTransferOwnership = (newOwnerId: string) => {
    if (!isServerOwner || !newOwnerId || newOwnerId === 'usr_me' || (currentUser?.id && newOwnerId === currentUser.id) || ACTIVE_BOT_IDS.has(newOwnerId)) return;
    const currentMods = sanitizeModeratorIds(selectedServer.moderator_ids, newOwnerId, selectedServer.kicked_ids, myAccountUserId);
    const modSet = new Set(currentMods);
    if (myAccountUserId) {
      modSet.add(myAccountUserId);
    } else {
      modSet.add('usr_me');
    }

    const currentMembers = Array.isArray(selectedServer.member_ids) ? selectedServer.member_ids : ['usr_me'];
    const memberSet = new Set(currentMembers);
    if (myAccountUserId) memberSet.add(myAccountUserId);
    memberSet.add('usr_me');
    memberSet.add(newOwnerId);

    const updatedSrv: CommunityServer = {
      ...selectedServer,
      owner_id: newOwnerId,
      badge: 'MOD',
      member_ids: Array.from(memberSet),
      moderator_ids: Array.from(modSet),
    };

    broadcastAndPersistServerUpdate(updatedSrv);
    onActiveServerChange?.(updatedSrv);
    setConfirmActionModal(null);
    showVoiceToast(language === 'vi' ? 'Đã nhượng quyền Chủ Sở Hữu thành công!' : 'Transferred server ownership successfully!');
  };

  const requestDeleteServer = (srv: CommunityServer = selectedServer) => {
    if (!isServerOwner) return;
    setConfirmActionModal({
      type: 'delete_server',
      serverId: srv.id,
      serverName: srv.name,
    });
  };

  const requestKickMember = (memberId: string, memberName?: string) => {
    if (!canManageServer || memberId === 'usr_me' || ACTIVE_BOT_IDS.has(memberId)) return;
    if (!isServerOwner && (isMemberServerOwner(memberId) || isMemberModerator(memberId))) return;
    const resolvedName =
      memberName ||
      onlineMembers.find(m => m.id === memberId)?.name ||
      registeredUsers.find(u => u.id === memberId)?.display_name ||
      memberId;
    setConfirmActionModal({
      type: 'kick_member',
      memberId,
      memberName: resolvedName,
    });
  };

  const handleDeleteServer = (srvId: string) => {
    if (!isServerOwner) return;
    if (connectedVoiceServerId === srvId) {
      handleLeaveVoiceCall();
    }
    deleteCloudServer(srvId).catch(() => {});
    const nextServers = servers.filter(s => s.id !== srvId);
    setServers(nextServers);
    persistServers(nextServers);
    setConfirmActionModal(null);
    setIsServerSettingsOpen(false);
    setCreatingChannelState(null);
    setNewChannelName('');
    if (nextServers.length > 0) {
      setSelectedServer(nextServers[0]);
      setSelectedChannel(nextServers[0].channels[0]);
      onActiveServerChange?.(nextServers[0]);
    } else {
      setSelectedServer(EMPTY_SERVER_FALLBACK);
      setSelectedChannel(EMPTY_SERVER_FALLBACK.channels[0]);
      setIsFriendsTabActive(true);
    }
  };

  const handleLeaveServer = (srvId: string) => {
    if (connectedVoiceServerId === srvId) {
      handleLeaveVoiceCall();
    }
    const nextServers = servers.filter(s => s.id !== srvId);
    setServers(nextServers);
    persistServers(nextServers);
    setIsServerSettingsOpen(false);
    if (nextServers.length > 0) {
      setSelectedServer(nextServers[0]);
      setSelectedChannel(nextServers[0].channels[0]);
      onActiveServerChange?.(nextServers[0]);
    } else {
      setSelectedServer(EMPTY_SERVER_FALLBACK);
      setSelectedChannel(EMPTY_SERVER_FALLBACK.channels[0]);
      setIsFriendsTabActive(true);
    }
    showVoiceToast('Bạn đã rời khỏi máy chủ.');
  };

  // Xử lý ngay lập tức khi tài khoản hiện tại bị kick / xóa khỏi một server (tránh stale closure từ Realtime/Cloud sync)
  const evictSelfFromKickedServer = (kickedServerId: string, toastMsg?: string) => {
    if (!kickedServerId || kickedServerId === 'srv_none' || kickedServerId === 'dm_private') return;
    if (
      connectedVoiceServerIdRef.current === kickedServerId ||
      voiceServerIdRef.current === kickedServerId
    ) {
      handleLeaveVoiceCallRef.current();
    }
    setVoiceParticipants(prev =>
      prev.filter(p => p.serverId !== kickedServerId)
    );
    setServers(prev => {
      if (!prev.some(s => s.id === kickedServerId)) return prev;
      const next = prev.filter(s => s.id !== kickedServerId);
      persistServers(next);
      return next;
    });
    if (viewStateRef.current.selectedServerId === kickedServerId) {
      setIsFriendsTabActive(true);
      setSelectedServer(EMPTY_SERVER_FALLBACK);
      setSelectedChannel(EMPTY_SERVER_FALLBACK.channels[0]);
      setIsServerSettingsOpen(false);
      onActiveServerChange?.(null);
    }
    if (toastMsg) {
      showVoiceToast(toastMsg);
    }
  };
  evictSelfFromKickedServerRef.current = evictSelfFromKickedServer;

  // Đồng bộ thông tin thành viên vào danh sách đặc vụ đã đăng ký & danh sách member_ids của Server
  const ensureMemberSyncedToServer = (
    memberInfo: { id: string; username: string; display_name: string; avatar?: string | null },
    srvId: string,
    isRejoinWelcome = false
  ) => {
    if (!memberInfo?.id || memberInfo.id === 'usr_me' || !srvId || srvId === 'srv_none' || srvId === 'dm_private') {
      return;
    }

    if (!currentUser || memberInfo.id !== currentUser.id) {
      setRegisteredUsers(prev => {
        const existing = prev.find(
          u => u.id === memberInfo.id || u.username.toLowerCase() === (memberInfo.username || '').toLowerCase()
        );
        if (existing) {
          if (
            (memberInfo.avatar && memberInfo.avatar !== existing.avatar) ||
            (memberInfo.display_name && memberInfo.display_name !== existing.display_name)
          ) {
            const next = prev.map(u =>
              u.id === existing.id
                ? {
                    ...u,
                    id: memberInfo.id,
                    username: memberInfo.username || u.username,
                    display_name: memberInfo.display_name || u.display_name,
                    avatar: memberInfo.avatar || u.avatar || null,
                  }
                : u
            );
            try {
              localStorage.setItem('spytify_registered_users', JSON.stringify(next));
            } catch {}
            return next;
          }
          return prev;
        }
        const newUser: CommunityUserProfile = {
          id: memberInfo.id,
          username: memberInfo.username || 'operative',
          display_name: memberInfo.display_name || memberInfo.username || 'Operative',
          avatar: memberInfo.avatar || null,
          role: 'THÀNH VIÊN',
          status: 'offline',
          bio: 'Thành viên Spytify từ hệ thống cộng đồng.',
          listening: null,
          listeningTrack: null,
          isHost: false,
          followsCurrentUser: Boolean(followersOfMeMap[memberInfo.id]),
          joinedAt: new Date().toISOString().split('T')[0],
        };
        const next = [...prev, newUser];
        try {
          localStorage.setItem('spytify_registered_users', JSON.stringify(next));
        } catch {}
        return next;
      });
    }

    setServers(prev => {
      let changed = false;
      const next = prev.map(s => {
        if (s.id !== srvId) return s;
        const kickedList = Array.isArray(s.kicked_ids) ? s.kicked_ids : [];
        if (kickedList.includes(memberInfo.id) && !isRejoinWelcome) return s;
        const currentMembers = Array.isArray(s.member_ids) ? s.member_ids : ['usr_me'];
        const nextKicked = isRejoinWelcome ? kickedList.filter(id => id !== memberInfo.id) : kickedList;
        if (currentMembers.includes(memberInfo.id) && nextKicked.length === kickedList.length) return s;
        changed = true;
        return {
          ...s,
          member_ids: Array.from(new Set([...currentMembers, memberInfo.id])),
          kicked_ids: nextKicked,
        };
      });
      if (changed) persistServers(next);
      return changed ? next : prev;
    });

    setSelectedServer(prev => {
      if (prev.id !== srvId) return prev;
      const kickedList = Array.isArray(prev.kicked_ids) ? prev.kicked_ids : [];
      if (kickedList.includes(memberInfo.id) && !isRejoinWelcome) return prev;
      const currentMembers = Array.isArray(prev.member_ids) ? prev.member_ids : ['usr_me'];
      const nextKicked = isRejoinWelcome ? kickedList.filter(id => id !== memberInfo.id) : kickedList;
      if (currentMembers.includes(memberInfo.id) && nextKicked.length === kickedList.length) return prev;
      return {
        ...prev,
        member_ids: Array.from(new Set([...currentMembers, memberInfo.id])),
        kicked_ids: nextKicked,
      };
    });
  };

  // Check if a user is a member of the currently selected server
  const isMemberInServer = (userId: string, srv: CommunityServer = selectedServer): boolean => {
    if (!userId) return false;
    if (userId === 'usr_me') return true;
    if (srv.owner_id === userId) return true;
    if (Array.isArray(srv.moderator_ids) && srv.moderator_ids.includes(userId)) return true;
    if (Array.isArray(srv.kicked_ids) && srv.kicked_ids.includes(userId)) return false;
    if (Array.isArray(srv.member_ids) && srv.member_ids.includes(userId)) return true;
    // Nếu người dùng đã có tin nhắn chào mừng hoặc trò chuyện trong Server này (và chưa bị kick) thì chắc chắn là thành viên
    if (messages.some(m => m.server_id === srv.id && m.user_id === userId)) return true;
    const isCustomSrv = Boolean(srv.is_custom || srv.id.startsWith('srv_custom_'));
    if (isCustomSrv) {
      return false;
    }
    if (Array.isArray(srv.member_ids)) {
      return false;
    }
    return true;
  };

  const handleKickMember = (memberId: string) => {
    if (!canManageServer || memberId === 'usr_me' || ACTIVE_BOT_IDS.has(memberId)) return;
    if (!isServerOwner && (isMemberServerOwner(memberId) || isMemberModerator(memberId))) return;
    const currentMemberIds = Array.isArray(selectedServer.member_ids)
      ? selectedServer.member_ids
      : ['usr_me', ...registeredUsers.map(u => u.id), ...Object.keys(realtimeUserPresences)];
    const nextMemberIds = currentMemberIds.filter(id => id !== memberId);
    const nextModeratorIds = Array.isArray(selectedServer.moderator_ids)
      ? selectedServer.moderator_ids.filter(id => id !== memberId)
      : [];
    const currentKickedIds = Array.isArray(selectedServer.kicked_ids) ? selectedServer.kicked_ids : [];
    const nextKickedIds = Array.from(new Set([...currentKickedIds, memberId]));
    const updatedSrv: CommunityServer = {
      ...selectedServer,
      member_ids: nextMemberIds,
      moderator_ids: nextModeratorIds,
      kicked_ids: nextKickedIds,
    };
    broadcastAndPersistServerUpdate(updatedSrv);
    setVoiceParticipants(prev =>
      prev.filter(p => !(p.id === memberId && (!p.serverId || p.serverId === selectedServer.id)))
    );

    // Phát broadcast lập tức trên tất cả kênh (server, global social, và voice WebRTC) để client của thành viên bị kick ngắt kết nối voice & thoát khỏi server ngay
    try {
      activeChannelRef.current?.send({
        type: 'broadcast',
        event: 'member_kicked',
        payload: { serverId: selectedServer.id, memberId },
      });
      globalSocialChannelRef.current?.send({
        type: 'broadcast',
        event: 'member_kicked',
        payload: { serverId: selectedServer.id, memberId },
      });
      globalSocialChannelRef.current?.send({
        type: 'broadcast',
        event: 'server_updated',
        payload: updatedSrv,
      });
      activeChannelRef.current?.send({
        type: 'broadcast',
        event: 'voice_kick',
        payload: { targetUserId: memberId, serverId: selectedServer.id },
      });
      globalSocialChannelRef.current?.send({
        type: 'broadcast',
        event: 'voice_kick',
        payload: { targetUserId: memberId, serverId: selectedServer.id },
      });
      rtcSendRef.current?.('member_kicked', { serverId: selectedServer.id, memberId });
      rtcSendRef.current?.('voice_kick', { targetUserId: memberId, serverId: selectedServer.id });
    } catch {}
  };

  // Gửi lời mời vào Server: người dùng thật phải bấm Đồng ý mới được vào Server (Bot AI vào ngay)
  const handleInviteMemberToServer = (memberId: string) => {
    if (!currentUser || selectedServer.id === 'srv_none') return;
    if (isMemberInServer(memberId, selectedServer)) return;

    const currentMemberIds = Array.isArray(selectedServer.member_ids) ? selectedServer.member_ids : ['usr_me'];
    const currentKickedIds = Array.isArray(selectedServer.kicked_ids) ? selectedServer.kicked_ids : [];
    const cleanedKickedIds = currentKickedIds.filter(id => id !== memberId);
    const serverReadyForInvite: CommunityServer =
      cleanedKickedIds.length !== currentKickedIds.length
        ? { ...selectedServer, kicked_ids: cleanedKickedIds }
        : selectedServer;

    // Đồng bộ server lên Cloud trước để link mời hoạt động
    if (cleanedKickedIds.length !== currentKickedIds.length) {
      broadcastAndPersistServerUpdate(serverReadyForInvite);
    } else {
      pushCloudServer(serverReadyForInvite).catch(() => {});
    }

    // Nếu là AI Bot mặc định thì cho vào ngay và gửi tin nhắn chào mừng
    if (ACTIVE_BOT_IDS.has(memberId)) {
      const botUser = registeredUsers.find(u => u.id === memberId);
      const nextMemberIds = Array.from(new Set([...currentMemberIds, memberId]));
      const updatedSrv: CommunityServer = {
        ...serverReadyForInvite,
        member_ids: nextMemberIds,
        kicked_ids: cleanedKickedIds,
      };
      broadcastAndPersistServerUpdate(updatedSrv);
      if (botUser) {
        postServerWelcomeMessage(updatedSrv, {
          id: botUser.id,
          username: botUser.username,
          display_name: botUser.display_name,
          avatar: botUser.avatar,
        });
      }
      return;
    }

    // Với người dùng thật: tạo lời mời chờ xác nhận (Pending Server Invite)
    if (selectedServer.allow_member_invites === false && !isServerOwner && !isServerMod) {
      showVoiceToast(
        language === 'vi'
          ? 'Chủ máy chủ đã tắt quyền mời tự do. Lời mời cần được Chủ server duyệt!'
          : 'Server owner disabled free invites. Invites require owner approval!'
      );
      return;
    }

    const alreadyInvited = outgoingServerInvites.some(
      inv => inv.serverId === selectedServer.id && inv.targetUserId === memberId
    );
    if (alreadyInvited) return;

    const createdAtStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const inviteObj: CloudServerInvite = {
      id: `srv_inv_${selectedServer.id}_${memberId}`,
      serverId: selectedServer.id,
      serverName: selectedServer.name,
      serverIcon: selectedServer.icon || '🎧',
      serverColor: selectedServer.accent_color || accentColor,
      inviterId: currentUser.id,
      inviterUsername: currentUser.username || 'operative',
      inviterDisplayName: currentUser.display_name || currentUser.username || 'Operative',
      inviterAvatar: currentUser.avatar || null,
      targetUserId: memberId,
      createdAt: createdAtStr,
    };

    setOutgoingServerInvites(prev => [...prev.filter(i => i.id !== inviteObj.id), inviteObj]);
    pushCloudServerInvite(inviteObj).catch(() => {});

    // Gửi kèm link mời trong DM 1-1 cho người đó
    const dmRoom = getDmRoomId(currentUser.id, memberId);
    const dmInviteMsg: CommunityMessage = {
      id: `dm_inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      server_id: 'dm_private',
      channel_id: dmRoom,
      user_id: currentUser.id,
      username: currentUser.username || 'operative',
      display_name: currentUser.display_name || 'Operative',
      avatar: currentUser.avatar || null,
      content: `📩 Mời bạn tham gia máy chủ "${selectedServer.name}": spytify://station/join/${selectedServer.id}`,
      track_embed: null,
      created_at: createdAtStr,
    };
    pushCloudDirectMessage({
      id: dmInviteMsg.id,
      room_id: dmRoom,
      sender_id: currentUser.id,
      receiver_id: memberId,
      sender_username: dmInviteMsg.username,
      sender_display_name: dmInviteMsg.display_name,
      sender_avatar: dmInviteMsg.avatar,
      content: dmInviteMsg.content,
      track_embed: null,
      created_at: createdAtStr,
      sent_at: new Date().toISOString(),
    }).catch(() => {});

    globalSocialChannelRef.current?.send({
      type: 'broadcast',
      event: 'server_invite_update',
      payload: { action: 'invite', invite: inviteObj },
    });

    globalSocialChannelRef.current?.send({
      type: 'broadcast',
      event: 'dm_message_notify',
      payload: {
        roomId: dmRoom,
        senderId: currentUser.id,
        receiverId: memberId,
        message: dmInviteMsg,
      },
    });
  };

  // Tham gia Server thông qua lời mời hoặc Link mời `spytify://station/join/...`
  const joinServerAndWelcome = async (rawServerIdOrLink: string, fromInvite?: CloudServerInvite): Promise<boolean> => {
    if (!currentUser) return false;
    const cleanServerId = rawServerIdOrLink
      .trim()
      .replace(/^.*spytify:\/\/station\/join\//i, '')
      .split(/\s+/)[0]
      .trim();
    if (!cleanServerId) return false;

    const localMatch = servers.find(s => s.id === cleanServerId);
    const cloudMatch = await fetchCloudServerById(cleanServerId);
    let targetSrv: CommunityServer | null = cloudMatch || localMatch || null;

    if (cloudMatch && localMatch) {
      const mergedKicked = Array.from(new Set([...(cloudMatch.kicked_ids || [])]));
      const effectiveOwner = cloudMatch.owner_id || localMatch.owner_id;
      const sanitizedCloudMods = sanitizeModeratorIds(
        cloudMatch.moderator_ids,
        effectiveOwner,
        mergedKicked,
        currentUser.id
      );
      targetSrv = {
        ...localMatch,
        ...cloudMatch,
        member_ids: Array.from(
          new Set([...(localMatch.member_ids || []), ...(cloudMatch.member_ids || [])])
        ),
        moderator_ids: sanitizedCloudMods,
      };
    }

    if (!targetSrv && fromInvite) {
      targetSrv = {
        id: fromInvite.serverId,
        name: fromInvite.serverName,
        description: `Trạm sóng của @${fromInvite.inviterUsername}`,
        icon: fromInvite.serverIcon || '🎧',
        badge: 'MEMBER',
        accent_color: fromInvite.serverColor || '#00E5FF',
        channels: [
          {
            id: `ch_${fromInvite.serverId}_0`,
            name: 'general-chat',
            type: 'text',
            topic: `Kênh trò chuyện chung - ${fromInvite.serverName}`,
          },
          {
            id: `ch_${fromInvite.serverId}_1`,
            name: 'Phòng Thoại Voice',
            type: 'voice',
            topic: `Đàm thoại tại ${fromInvite.serverName}`,
          },
        ],
        is_verified: true,
        owner_id: fromInvite.inviterId,
        is_custom: true,
        max_members: 50,
        member_ids: [fromInvite.inviterId, currentUser.id, 'usr_me'],
        moderator_ids: [],
        kicked_ids: [],
      };
    }

    if (!targetSrv) return false;

    const existingMembers = Array.isArray(targetSrv.member_ids) ? targetSrv.member_ids : [];
    const existingKicked = Array.isArray(targetSrv.kicked_ids) ? targetSrv.kicked_ids : [];
    const alreadyMember =
      existingMembers.includes(currentUser.id) &&
      !existingKicked.includes(currentUser.id) &&
      servers.some(s => s.id === targetSrv!.id);

    const nextKicked = existingKicked.filter(id => id !== currentUser.id);
    const nextMembers = Array.from(
      new Set([...existingMembers, currentUser.id, 'usr_me', ...(targetSrv.owner_id ? [targetSrv.owner_id] : [])])
    ).filter(id => !nextKicked.includes(id));

    const updatedSrv: CommunityServer = {
      ...targetSrv,
      is_custom: true,
      badge:
        targetSrv.owner_id === currentUser.id
          ? 'OWNER'
          : Array.isArray(targetSrv.moderator_ids) && targetSrv.moderator_ids.includes(currentUser.id)
          ? 'MOD'
          : 'MEMBER',
      member_ids: nextMembers,
      kicked_ids: nextKicked,
    };

    setServers(prev => {
      const exists = prev.some(s => s.id === updatedSrv.id);
      const next = exists ? prev.map(s => (s.id === updatedSrv.id ? updatedSrv : s)) : [...prev, updatedSrv];
      persistServers(next);
      return next;
    });

    await pushCloudServer(updatedSrv);

    if (fromInvite) {
      setIncomingServerInvites(prev => prev.filter(i => i.serverId !== updatedSrv.id));
      removeCloudServerInvite(updatedSrv.id, currentUser.id).catch(() => {});
    }

    globalSocialChannelRef.current?.send({
      type: 'broadcast',
      event: 'server_invite_update',
      payload: {
        action: 'accepted',
        serverId: updatedSrv.id,
        targetUserId: currentUser.id,
        targetUsername: currentUser.username || 'operative',
        targetDisplayName: currentUser.display_name || currentUser.username || 'Operative',
        targetAvatar: currentUser.avatar || null,
        updatedServer: updatedSrv,
      },
    });

    setIsFriendsTabActive(false);
    setSelectedServer(updatedSrv);
    setSelectedChannel(updatedSrv.channels[0]);
    onActiveServerChange?.(updatedSrv);

    setTimeout(() => {
      activeChannelRef.current?.send({
        type: 'broadcast',
        event: 'server_updated',
        payload: updatedSrv,
      });
      if (!alreadyMember) {
        postServerWelcomeMessage(updatedSrv, {
          id: currentUser.id,
          username: currentUser.username || 'operative',
          display_name: currentUser.display_name || currentUser.username || 'Operative',
          avatar: currentUser.avatar || null,
        });
      }
    }, 300);

    return true;
  };

  const handleAcceptServerInvite = async (invite: CloudServerInvite) => {
    await joinServerAndWelcome(invite.serverId, invite);
  };

  const handleDeclineServerInvite = (invite: CloudServerInvite) => {
    if (!currentUser) return;
    setIncomingServerInvites(prev => prev.filter(i => i.id !== invite.id && i.serverId !== invite.serverId));
    removeCloudServerInvite(invite.serverId, currentUser.id).catch(() => {});
    globalSocialChannelRef.current?.send({
      type: 'broadcast',
      event: 'server_invite_update',
      payload: {
        action: 'declined',
        serverId: invite.serverId,
        targetUserId: currentUser.id,
      },
    });
  };

  const handleJoinServerByLinkForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinServerErrorMsg(null);
    setJoinServerStatusMsg(null);
    if (!joinServerLinkInput.trim()) return;
    const ok = await joinServerAndWelcome(joinServerLinkInput);
    if (ok) {
      setJoinServerStatusMsg('Đã tham gia máy chủ thành công!');
      setJoinServerLinkInput('');
      setIsCreateModalOpen(false);
      setTimeout(() => setJoinServerStatusMsg(null), 3000);
    } else {
      setJoinServerErrorMsg('Liên kết mời không hợp lệ hoặc máy chủ không tồn tại trên hệ thống đám mây!');
      setTimeout(() => setJoinServerErrorMsg(null), 4000);
    }
  };

  const handleCreateChannel = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newChannelName.trim();
    if (!cleanName || !creatingChannelType) return;
    const formattedName =
      creatingChannelType === 'text'
        ? cleanName.toLowerCase().replace(/\s+/g, '-')
        : cleanName;
    const selectedDj = DJ_BOT_OPTIONS.find(d => d.id === newChannelDjBot);
    const isCustomStation = newChannelIsRadio && (newChannelDjBot === 'custom' || Boolean(newChannelCustomUrl.trim()));
    const cleanCustomUrl = newChannelCustomUrl.trim();
    const newCh: CommunityChannel = {
      id: `ch_${selectedServer.id}_${Date.now()}`,
      name: formattedName,
      type: creatingChannelType,
      topic:
        creatingChannelType === 'text'
          ? `Kênh trò chuyện #${formattedName}`
          : (newChannelIsRadio
              ? (isCustomStation
                  ? `Trạm phát YouTube: ${newChannelCustomTitle.trim() || cleanCustomUrl} (${newChannelIsLoopSingle ? 'Lặp lại liên tục' : 'Luồng Live 24/7'})`
                  : `Phòng Radio phát sóng 24/24 cùng ${selectedDj?.name || 'DJ Bot'}`)
              : `Phòng đàm thoại ${formattedName}`),
      is_radio: creatingChannelType === 'voice' ? newChannelIsRadio : false,
      dj_bot_id: creatingChannelType === 'voice' && newChannelIsRadio ? newChannelDjBot : undefined,
      custom_stream_url: isCustomStation && cleanCustomUrl ? cleanCustomUrl : undefined,
      custom_stream_title: isCustomStation && (newChannelCustomTitle.trim() || formattedName) ? (newChannelCustomTitle.trim() || formattedName) : undefined,
      custom_backup_streams: isCustomStation && newChannelCustomBackupUrls.trim()
        ? newChannelCustomBackupUrls.split('\n').map(s => s.trim()).filter(Boolean)
        : undefined,
      is_loop_single: isCustomStation ? newChannelIsLoopSingle : undefined,
    };

    // "nếu tạo live station có bot đó thì bot đó phải thoát khỏi call thường, được ưu tiên phân vào ngay live station đó"
    if (creatingChannelType === 'voice' && newChannelIsRadio && newChannelDjBot) {
      setVoiceParticipants(prev => prev.filter(p => p.id !== newChannelDjBot));
      activeChannelRef.current?.send({
        type: 'broadcast',
        event: 'voice_kick',
        payload: { targetUserId: newChannelDjBot, reason: 'Assigned to newly created Live Station' }
      });
    }

    const updatedSrv: CommunityServer = {
      ...selectedServer,
      channels: [...selectedServer.channels, newCh],
    };
    broadcastAndPersistServerUpdate(updatedSrv);
    setCreatingChannelState(null);
    setNewChannelName('');
    setNewChannelIsRadio(false);
    setNewChannelDjBot('usr_host');
    setNewChannelCustomUrl('');
    setNewChannelCustomTitle('');
    setNewChannelCustomBackupUrls('');
    setNewChannelIsLoopSingle(false);
    handleSelectChannel(newCh);
  };

  const handleOpenEditStationModal = (channel: CommunityChannel) => {
    if (!canManageServer) {
      showVoiceToast(language === 'vi' ? 'Chỉ Chủ server và Mod mới có quyền cấu hình trạm phát!' : 'Only Server Owner and Mod can configure stations!');
      return;
    }
    setEditingStationChannel(channel);
    setEditStationUrlDraft(channel.custom_stream_url || '');
    setEditStationTitleDraft(channel.custom_stream_title || channel.name || '');
    setEditStationBackupStreamsDraft((channel.custom_backup_streams || []).join('\n'));
    setEditStationIsLoopDraft(Boolean(channel.is_loop_single));
    setEditStationBotNameDraft(channel.custom_bot_name || (channel.dj_bot_id === 'usr_host' ? 'DJ CyberHawk' : 'Custom Station Bot'));
    setEditStationBotAvatarDraft(channel.custom_bot_avatar || '');
  };

  const handleSaveStationEdit = () => {
    if (!editingStationChannel) return;
    const cleanUrl = editStationUrlDraft.trim();
    const cleanBotName = editStationBotNameDraft.trim();
    const updatedChannels = selectedServer.channels.map(c => {
      if (c.id === editingStationChannel.id) {
        return {
          ...c,
          custom_bot_name: cleanBotName || undefined,
          custom_bot_avatar: editStationBotAvatarDraft || undefined,
          custom_stream_url: cleanUrl || undefined,
          custom_stream_title: editStationTitleDraft.trim() || undefined,
          custom_backup_streams: editStationBackupStreamsDraft.trim()
            ? editStationBackupStreamsDraft.split('\n').map(s => s.trim()).filter(Boolean)
            : undefined,
          is_loop_single: editStationIsLoopDraft,
          topic: cleanUrl
            ? `Trạm phát YouTube: ${editStationTitleDraft.trim() || cleanUrl} (${editStationIsLoopDraft ? 'Lặp lại liên tục' : 'Luồng Live 24/7'})`
            : c.topic,
        };
      }
      return c;
    });

    if (cleanBotName) {
      const djId = editingStationChannel.dj_bot_id || 'usr_host';
      setRegisteredUsers(prev => {
        const exists = prev.some(u => u.id === djId);
        if (exists) {
          return prev.map(u => u.id === djId ? {
            ...u,
            display_name: cleanBotName,
            avatar: editStationBotAvatarDraft || u.avatar,
          } : u);
        }
        return prev;
      });
    }

    const updatedSrv: CommunityServer = {
      ...selectedServer,
      channels: updatedChannels,
    };
    broadcastAndPersistServerUpdate(updatedSrv);
    if (selectedChannel.id === editingStationChannel.id) {
      const updatedCur = updatedChannels.find(c => c.id === editingStationChannel.id);
      if (updatedCur) setSelectedChannel(updatedCur);
    }
    showVoiceToast(language === 'vi' ? 'Đã lưu cấu hình trạm phát & tên Bot!' : 'Saved station & bot settings!');
    setEditingStationChannel(null);
  };

  const executeDeleteChannel = (channelId: string) => {
    const target = selectedServer.channels.find(c => c.id === channelId);
    if (!target) return;
    const sameTypeCount = selectedServer.channels.filter(c => c.type === target.type).length;
    if (sameTypeCount <= 1) return;
    if (connectedVoiceChannel === channelId) {
      handleLeaveVoiceCall();
    }
    const nextChannels = selectedServer.channels.filter(c => c.id !== channelId);
    const updatedSrv: CommunityServer = {
      ...selectedServer,
      channels: nextChannels,
    };
    broadcastAndPersistServerUpdate(updatedSrv);
    if (selectedChannel.id === channelId && nextChannels.length > 0) {
      const remainingSameType = nextChannels.filter(c => c.type === target.type);
      setSelectedChannel(remainingSameType[0] || nextChannels[0]);
    }
  };

  const requestDeleteChannel = (channel: CommunityChannel, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!canManageServer) return;
    const sameTypeCount = selectedServer.channels.filter(c => c.type === channel.type).length;
    if (sameTypeCount <= 1) {
      alert(`Không thể xóa ${channel.type === 'voice' ? 'phòng thoại' : 'kênh chat'} duy nhất còn lại của máy chủ.`);
      return;
    }
    setConfirmActionModal({
      type: 'delete_channel',
      channelId: channel.id,
      channelName: getChannelName(channel),
      channelType: channel.type,
    });
  };

  const handleDeleteChannel = (channelId: string, e?: React.MouseEvent) => {
    const target = selectedServer.channels.find(c => c.id === channelId);
    if (target) {
      requestDeleteChannel(target, e);
    } else {
      executeDeleteChannel(channelId);
    }
  };

  const handleCopyInvite = (srvId: string) => {
    if (selectedServer.allow_member_invites === false && !isServerOwner && !isServerMod) {
      showVoiceToast(
        language === 'vi'
          ? 'Chủ máy chủ đã tắt quyền mời tự do. Chỉ Chủ Server và Mod mới có thể lấy link mời!'
          : 'Server owner disabled free invites. Only Owner & Mods can copy invite links!'
      );
      return;
    }
    navigator.clipboard.writeText(`spytify://station/join/${srvId}`);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2500);
  };

  // Determine real-time effective status for any user
  const getEffectiveStatus = (u: CommunityUserProfile): 'online' | 'dnd' | 'offline' => {
    if (ACTIVE_BOT_IDS.has(u.id)) return 'online';
    const rt = realtimeUserPresences[u.id] || Object.values(realtimeUserPresences).find(p => p.username && u.username && p.username.toLowerCase() === u.username.toLowerCase());
    if (rt) {
      if (rt.status === 'offline' || (rt.status as string) === 'invisible') return 'offline';
      if (rt.status === 'online' || rt.status === 'dnd') return rt.status;
    }
    return 'offline';
  };

  // Online & server members list synced with real-time presence + server nicknames + server membership
  const myEffectivePublicStatus: 'online' | 'dnd' | 'offline' = myStatus === 'invisible' ? 'offline' : myStatus;
  // Khi ở chế độ Vô hình (invisible): ẩn hoàn toàn trạng thái đang nghe bài hát gì đối với mọi người
  const myVisibleListening =
    myStatus === 'invisible' ? null : currentTrack ? `${currentTrack.title} - ${currentTrack.artist}` : null;
  const myVisibleTrack = myStatus === 'invisible' ? null : currentTrack;

  // Thu thập thêm các thành viên đã tham gia / nhắn tin trong Server nhưng chưa kịp đồng bộ vào registeredUsers
  const extraServerMemberProfiles = (() => {
    const map = new Map<string, { id: string; username: string; display_name: string; avatar: string | null }>();
    const myId = currentUser?.id || myParticipantIdRef.current;
    const myUname = (currentUser?.username || '').toLowerCase();

    messages.forEach(m => {
      if (m.server_id !== selectedServer.id || !m.user_id || m.user_id === 'usr_me' || m.user_id === myId) return;
      if (myUname && (m.username || '').toLowerCase() === myUname) return;
      if (!isMemberInServer(m.user_id)) return;
      const alreadyKnown =
        registeredUsers.some(u => u.id === m.user_id || (u.username && m.username && u.username.toLowerCase() === m.username.toLowerCase())) ||
        Object.values(realtimeUserPresences).some(
          rt => rt.id === m.user_id || (rt.username && m.username && rt.username.toLowerCase() === m.username.toLowerCase())
        );
      if (!alreadyKnown) {
        map.set(m.user_id, {
          id: m.user_id,
          username: m.username || 'operative',
          display_name: m.display_name || m.username || 'Operative',
          avatar: m.avatar || followersOfMeMap[m.user_id]?.followerAvatar || null,
        });
      }
    });

    (selectedServer.member_ids || []).forEach(memId => {
      if (!memId || memId === 'usr_me' || memId === myId || map.has(memId)) return;
      if (!isMemberInServer(memId)) return;
      const alreadyKnown =
        registeredUsers.some(u => u.id === memId) ||
        Object.values(realtimeUserPresences).some(rt => rt.id === memId);
      if (!alreadyKnown) {
        const fol = followersOfMeMap[memId];
        if (fol) {
          map.set(memId, {
            id: memId,
            username: fol.followerUsername || 'operative',
            display_name: fol.followerDisplayName || fol.followerUsername || 'Operative',
            avatar: fol.followerAvatar || null,
          });
        }
      }
    });

    return Array.from(map.values());
  })();

  const rawMembers = [
    ...registeredUsers
      .filter(u => isMemberInServer(u.id))
      .filter(u => !currentUser || (u.id !== currentUser.id && u.username.toLowerCase() !== (currentUser.username || '').toLowerCase()))
      .map(u => {
        const rt = realtimeUserPresences[u.id] || Object.values(realtimeUserPresences).find(p => p.username && u.username && p.username.toLowerCase() === u.username.toLowerCase());
        const latestMsgWithAvatar = [...messages]
          .reverse()
          .find(m => m.user_id === u.id && m.avatar);
        const effStatus = getEffectiveStatus(u);
        const effName = rt?.display_name || u.display_name;
        const effAvatar = rt?.avatar || u.avatar || latestMsgWithAvatar?.avatar || followersOfMeMap[u.id]?.followerAvatar || null;
        const isDemandBotMember = isDemandBotId(u.id);
        const demandBotState = isDemandBotMember ? getServerRythmBot(selectedServer.id, u.id) : null;
        const stationChForBot = !isDemandBotMember
          ? selectedServer.channels.find(c => c.is_radio && (c.dj_bot_id === u.id || (!c.dj_bot_id && u.id === 'usr_host')))
          : null;
        const stationVid = stationChForBot?.custom_stream_url ? extractYouTubeId(stationChForBot.custom_stream_url) : null;
        const fallbackDjOpt = !isDemandBotMember ? DJ_BOT_OPTIONS.find(d => d.id === u.id) : null;
        const resolvedStationTrack: Track | null = stationVid
          ? {
              id: `yt_station_${u.id}`,
              title: stationChForBot?.custom_stream_title || effName,
              artist: effName,
              album: 'Spytify 24/7 Live Radio',
              duration_secs: 0,
              path_or_url: stationVid,
              source: 'youtube',
              cover_art: 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?w=500&auto=format&fit=crop&q=60',
            }
          : (fallbackDjOpt?.track || null);

        const effListening = isDemandBotMember && demandBotState
          ? (demandBotState.currentTrack && demandBotState.isPlaying ? `🎶 ${demandBotState.currentTrack.title} - ${demandBotState.currentTrack.artist}` : (u.listening || 'Sẵn sàng nhận lệnh /play'))
          : (effStatus === 'offline' && !ACTIVE_BOT_IDS.has(u.id) ? null : (rt?.listening !== undefined ? rt.listening : (stationChForBot?.custom_stream_title || u.listening || null)));
        const effTrack = isDemandBotMember && demandBotState
          ? (demandBotState.currentTrack && demandBotState.isPlaying ? {
              id: demandBotState.currentTrack.id,
              title: demandBotState.currentTrack.title,
              artist: demandBotState.currentTrack.artist,
              album: 'On-Demand Music Queue',
              duration_secs: 180,
              path_or_url: demandBotState.currentTrack.url_or_id,
              source: 'youtube' as const,
              cover_art: demandBotState.currentTrack.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
            } : null)
          : (effStatus === 'offline' && !ACTIVE_BOT_IDS.has(u.id) ? null : (rt?.listeningTrack !== undefined ? rt.listeningTrack : (u.listeningTrack || resolvedStationTrack || null)));
        const effRole = isMemberServerOwner(u.id)
          ? 'CHỦ SERVER'
          : isMemberModerator(u.id)
          ? 'MOD'
          : u.role;
        return {
          id: u.id,
          name: effName,
          username: u.username,
          avatar: effAvatar,
          role: effRole,
          status: effStatus,
          listening: effListening,
          listeningTrack: effTrack,
          isHost: Boolean(u.isHost),
          userProfile: {
            ...u,
            username: u.username,
            avatar: effAvatar,
            role: effRole,
            display_name: effName,
            status: effStatus,
            listening: effListening,
            listeningTrack: effTrack,
            followsCurrentUser: isUserFollowingMe(u.id),
          },
        };
      }),
    // Include any real-time connected users not yet in registeredUsers (if in server)
    ...Object.values(realtimeUserPresences)
      .filter(rt =>
        isMemberInServer(rt.id) &&
        rt.id !== (currentUser?.id || myParticipantIdRef.current) &&
        (rt.status === 'online' || rt.status === 'dnd') &&
        !registeredUsers.some(u => u.id === rt.id || (u.username && rt.username && u.username.toLowerCase() === rt.username.toLowerCase()))
      )
      .map(rt => {
        const effStatus: 'online' | 'dnd' | 'offline' = rt.status === 'online' || rt.status === 'dnd' ? rt.status : 'offline';
        const effRole = isMemberServerOwner(rt.id)
          ? (language === 'vi' ? 'CHỦ SERVER' : 'OWNER')
          : isMemberModerator(rt.id)
          ? 'MOD'
          : (language === 'vi' ? 'THÀNH VIÊN' : 'MEMBER');
        return {
          id: rt.id,
          name: rt.display_name,
          username: rt.username,
          avatar: rt.avatar || null,
          role: effRole,
          status: effStatus,
          listening: effStatus === 'offline' ? null : (rt.listening || null),
          listeningTrack: effStatus === 'offline' ? null : (rt.listeningTrack || null),
          isHost: false,
          userProfile: {
            id: rt.id,
            username: rt.username,
            display_name: rt.display_name,
            avatar: rt.avatar || null,
            role: effRole,
            status: effStatus,
            bio: `Thành viên tại ${selectedServer.name}`,
            listening: effStatus === 'offline' ? null : (rt.listening || null),
            listeningTrack: effStatus === 'offline' ? null : (rt.listeningTrack || null),
            isHost: false,
            followsCurrentUser: isUserFollowingMe(rt.id),
          },
        };
      }),
    // Include members derived from server chat / welcome messages or follow graph if not yet in registeredUsers
    ...extraServerMemberProfiles.map(em => {
      const effRole = isMemberServerOwner(em.id)
        ? (language === 'vi' ? 'CHỦ SERVER' : 'OWNER')
        : isMemberModerator(em.id)
        ? 'MOD'
        : (language === 'vi' ? 'THÀNH VIÊN' : 'MEMBER');
      return {
        id: em.id,
        name: em.display_name,
        username: em.username,
        avatar: em.avatar,
        role: effRole,
        status: 'offline' as const,
        listening: null,
        listeningTrack: null,
        isHost: false,
        userProfile: {
          id: em.id,
          username: em.username,
          display_name: em.display_name,
          avatar: em.avatar,
          role: effRole,
          status: 'offline' as const,
          bio: `Thành viên tại ${selectedServer.name}`,
          listening: null,
          listeningTrack: null,
          isHost: false,
          followsCurrentUser: isUserFollowingMe(em.id),
        },
      };
    }),
    {
      id: 'usr_me',
      name: myServerDisplayName,
      username: currentUser?.username || myServerDisplayName.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'operative',
      avatar: currentUser?.avatar || null,
      role: isServerOwner ? (language === 'vi' ? 'CHỦ SERVER' : 'OWNER') : isServerMod ? 'MOD' : (language === 'vi' ? 'THÀNH VIÊN' : 'MEMBER'),
      status: myEffectivePublicStatus,
      listening: myVisibleListening,
      listeningTrack: myVisibleTrack,
      isHost: false,
      bio: myBio,
      userProfile: {
        id: 'usr_me',
        username: currentUser?.username || myServerDisplayName.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'operative',
        display_name: myServerDisplayName,
        avatar: currentUser?.avatar || null,
        role: isServerOwner ? (language === 'vi' ? 'CHỦ SERVER' : 'OWNER') : isServerMod ? 'MOD' : (language === 'vi' ? 'THÀNH VIÊN' : 'MEMBER'),
        status: myEffectivePublicStatus,
        bio: myBio,
        listening: myVisibleListening,
        listeningTrack: myVisibleTrack,
        isHost: false,
        followsCurrentUser: false,
      }
    }
  ];

  // Sort: Online / DND members first, Offline members below
  const onlineMembers = [...rawMembers].sort((a, b) => {
    const aActive = a.status === 'online' || a.status === 'dnd' ? 0 : 1;
    const bActive = b.status === 'online' || b.status === 'dnd' ? 0 : 1;
    return aActive - bActive;
  });
  const activeOnlineCount = onlineMembers.filter(m => m.status === 'online' || m.status === 'dnd').length;

  // Phân chia thành viên cho cột danh sách bên phải:
  // 1. Bot phát nhạc (Resident DJ Bots) được nhóm riêng ở phần trên cùng
  const botMembers = onlineMembers.filter(m =>
    ACTIVE_BOT_IDS.has(m.id) || m.isHost || m.id === 'usr_host' || m.id === 'usr_agent_01' || m.id === 'usr_luna_lofi'
  );
  // 2. Thành viên người dùng đang trực tuyến
  const humanOnlineMembers = onlineMembers.filter(m =>
    !ACTIVE_BOT_IDS.has(m.id) && !m.isHost && m.id !== 'usr_host' && m.id !== 'usr_agent_01' && m.id !== 'usr_luna_lofi' &&
    (m.status === 'online' || m.status === 'dnd')
  );
  // 3. Thành viên người dùng ngoại tuyến
  const humanOfflineMembers = onlineMembers.filter(m =>
    !ACTIVE_BOT_IDS.has(m.id) && !m.isHost && m.id !== 'usr_host' && m.id !== 'usr_agent_01' && m.id !== 'usr_luna_lofi' &&
    m.status === 'offline'
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeChannelRef = useRef<any>(null);

  // ──────── WEBRTC REAL-TIME VOICE (P2P MESH, SIGNALING QUA SUPABASE BROADCAST) ────────
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const remoteAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const rtcSendRef = useRef<((event: string, payload: any) => void) | null>(null);
  const outboundStreamRef = useRef<MediaStream | null>(null);
  const voiceServerIdRef = useRef<string>('');
  const myVoiceParticipantRef = useRef<VoiceParticipant | null>(null);
  const voiceVolRef = useRef({ speaker: 100, deafened: false, users: {} as Record<string, number> });

  const applyRemoteVolume = (peerId: string) => {
    const el = remoteAudioRef.current.get(peerId);
    if (!el) return;
    const { speaker, deafened, users } = voiceVolRef.current;
    const isLocallyMuted = !!locallyMutedUsers[peerId];
    el.muted = deafened || isLocallyMuted;
    el.volume = isLocallyMuted ? 0 : Math.max(0, Math.min(1, (speaker / 100) * ((users[peerId] ?? 100) / 100)));
  };

  useEffect(() => {
    voiceVolRef.current = { speaker: speakerVolume, deafened: isDeafened, users: userVolumes };
    remoteAudioRef.current.forEach((_, id) => applyRemoteVolume(id));
  }, [speakerVolume, isDeafened, userVolumes, locallyMutedUsers]);

  const closePeer = (peerId: string) => {
    const pc = peersRef.current.get(peerId);
    if (pc) {
      try { pc.close(); } catch {}
      peersRef.current.delete(peerId);
    }
    pendingIceRef.current.delete(peerId);
    const el = remoteAudioRef.current.get(peerId);
    if (el) {
      el.pause();
      el.srcObject = null;
      remoteAudioRef.current.delete(peerId);
    }
    removeScreenShare(peerId);
  };

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !connectedVoiceChannel) return;
    const myId = myParticipantIdRef.current;
    const topic = `spytify_voice_${voiceServerIdRef.current}_${connectedVoiceChannel}`;
    const ch = client.channel(topic, { config: { broadcast: { ack: false, self: false } } });
    const send = (event: string, payload: any) => {
      ch.send({ type: 'broadcast', event, payload });
    };
    rtcSendRef.current = send;
    const ICE_SERVERS: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];

    const createPeer = (peerId: string): RTCPeerConnection => {
      const existing = peersRef.current.get(peerId);
      if (existing) {
        if (
          existing.connectionState === 'failed' ||
          existing.connectionState === 'closed' ||
          existing.signalingState === 'closed'
        ) {
          closePeer(peerId);
        } else {
          return existing;
        }
      }
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peersRef.current.set(peerId, pc);

      const out = outboundStreamRef.current;
      if (out && out.getAudioTracks().length > 0) {
        out.getAudioTracks().forEach(t => pc.addTrack(t, out));
      } else {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }

      if (screenStreamRef.current && screenStreamRef.current.getVideoTracks().length > 0) {
        screenStreamRef.current.getVideoTracks().forEach(t => pc.addTrack(t, screenStreamRef.current!));
      } else {
        pc.addTransceiver('video', { direction: 'recvonly' });
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) send('rtc_ice', { from: myId, to: peerId, candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        setDmCallConnected(true);
        if (e.track.kind === 'video') {
          const videoStream = e.streams[0] || new MediaStream([e.track]);
          remoteScreenStreamsRef.current.set(peerId, videoStream);
          const matchedVp = voiceParticipantsRef.current.find(p => p.id === peerId);
          const matchedReg = registeredUsers.find(u => u.id === peerId);
          const peerName = matchedVp?.name || matchedReg?.display_name || 'Thành viên';
          const peerAvatar = matchedVp?.avatar || matchedReg?.avatar || null;
          setVoiceParticipants(prev =>
            prev.map(p => (p.id === peerId ? { ...p, isScreenSharing: true } : p))
          );
          e.track.onended = () => {
            removeScreenShare(peerId);
            setVoiceParticipants(prev =>
              prev.map(p => (p.id === peerId ? { ...p, isScreenSharing: false } : p))
            );
          };
          upsertScreenShare(
            {
              userId: peerId,
              userName: peerName,
              avatar: peerAvatar,
              stream: videoStream,
            },
            false
          );
          return;
        }
        let el = remoteAudioRef.current.get(peerId);
        if (!el) {
          el = new Audio();
          el.autoplay = true;
          remoteAudioRef.current.set(peerId, el);
        }
        el.srcObject = e.streams[0] || new MediaStream([e.track]);
        applyRemoteVolume(peerId);
        el.play().catch(() => {});
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') setDmCallConnected(true);
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') closePeer(peerId);
      };
      return pc;
    };

    const flushIce = async (peerId: string, pc: RTCPeerConnection) => {
      const queued = pendingIceRef.current.get(peerId) || [];
      pendingIceRef.current.delete(peerId);
      for (const c of queued) {
        try { await pc.addIceCandidate(c); } catch {}
      }
    };

    const makeOffer = async (peerId: string) => {
      const pc = createPeer(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send('rtc_offer', { from: myId, to: peerId, sdp: pc.localDescription });
    };

    // Người có ID nhỏ hơn luôn là bên gửi offer -> tránh xung đột (glare)
    ch.on('broadcast', { event: 'rtc_hello' }, ({ payload }) => {
      if (!payload?.from || payload.from === myId) return;
      if (payload.to && payload.to !== myId) return;
      setDmCallConnected(true);
      if (myId < payload.from) {
        makeOffer(payload.from).catch(err => console.error('RTC offer error:', err));
      } else if (!payload.to) {
        send('rtc_hello', { from: myId, to: payload.from });
      }
    });

    ch.on('broadcast', { event: 'rtc_offer' }, async ({ payload }) => {
      if (!payload || payload.to !== myId) return;
      setDmCallConnected(true);
      try {
        let pc = createPeer(payload.from);
        if (pc.signalingState !== 'stable') {
          try {
            await pc.setLocalDescription({ type: 'rollback' } as RTCSessionDescriptionInit);
          } catch {
            closePeer(payload.from);
            pc = createPeer(payload.from);
          }
        }
        await pc.setRemoteDescription(payload.sdp);
        await flushIce(payload.from, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send('rtc_answer', { from: myId, to: payload.from, sdp: pc.localDescription });
      } catch (err) {
        console.error('RTC answer error:', err);
      }
    });

    ch.on('broadcast', { event: 'rtc_answer' }, async ({ payload }) => {
      if (!payload || payload.to !== myId) return;
      setDmCallConnected(true);
      const pc = peersRef.current.get(payload.from);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(payload.sdp);
        await flushIce(payload.from, pc);
      } catch (err) {
        console.error('RTC set answer error:', err);
      }
    });

    ch.on('broadcast', { event: 'rtc_ice' }, async ({ payload }) => {
      if (!payload || payload.to !== myId || !payload.candidate) return;
      const pc = peersRef.current.get(payload.from);
      if (pc && pc.remoteDescription) {
        try { await pc.addIceCandidate(payload.candidate); } catch {}
      } else {
        const q = pendingIceRef.current.get(payload.from) || [];
        q.push(payload.candidate);
        pendingIceRef.current.set(payload.from, q);
      }
    });

    ch.on('broadcast', { event: 'rtc_bye' }, ({ payload }) => {
      if (payload?.from) {
        closePeer(payload.from);
        if (voiceServerIdRef.current === 'dm_private' && peersRef.current.size === 0) {
          setDmCallConnected(false);
        }
      }
    });

    ch.on('broadcast', { event: 'rtc_screen_stopped' }, ({ payload }) => {
      if (payload?.userId) {
        removeScreenShare(payload.userId);
        setVoiceParticipants(prev =>
          prev.map(p => (p.id === payload.userId ? { ...p, isScreenSharing: false } : p))
        );
      }
    });

    // Đồng bộ người tham gia voice & sự kiện nói/tắt mic trực tiếp trên kênh voice (đảm bảo không bị ngắt khi đổi server)
    ch.on('broadcast', { event: 'voice_presence' }, ({ payload }) => {
      if (!payload) return;
      if ((payload.action === 'join' || payload.action === 'here') && payload.participant) {
        const incomingVp: VoiceParticipant = {
          ...payload.participant,
          serverId: payload.participant.serverId || voiceServerIdRef.current,
        };
        setVoiceParticipants(prev => {
          const exists = prev.some(
            p => p.id === incomingVp.id && (p.serverId || voiceServerIdRef.current) === incomingVp.serverId
          );
          if (exists) {
            return prev.map(p =>
              p.id === incomingVp.id && (p.serverId || voiceServerIdRef.current) === incomingVp.serverId
                ? { ...p, ...incomingVp }
                : p
            );
          }
          return [...prev, incomingVp];
        });
        if (incomingVp.isScreenSharing) {
          setScreenShares(prev =>
            prev[incomingVp.id]
              ? {
                  ...prev,
                  [incomingVp.id]: {
                    ...prev[incomingVp.id],
                    userName: incomingVp.name,
                    avatar: incomingVp.avatar,
                  },
                }
              : prev
          );
        }
        if (payload.action === 'join' && myVoiceParticipantRef.current && payload.participant.id !== myParticipantIdRef.current) {
          send('voice_presence', { action: 'here', participant: myVoiceParticipantRef.current });
        }
      } else if (payload.action === 'leave' && payload.userId) {
        setVoiceParticipants(prev =>
          prev.filter(p => !(p.id === payload.userId && (!p.serverId || p.serverId === voiceServerIdRef.current)))
        );
        closePeer(payload.userId);
        removeScreenShare(payload.userId);
      } else if (payload.action === 'screen_share' && payload.userId) {
        setVoiceParticipants(prev =>
          prev.map(p => (p.id === payload.userId ? { ...p, isScreenSharing: Boolean(payload.isScreenSharing) } : p))
        );
        if (!payload.isScreenSharing) {
          removeScreenShare(payload.userId);
        }
      }
    });

    ch.on('broadcast', { event: 'voice_speaking' }, ({ payload }) => {
      if (!payload) return;
      setVoiceParticipants(prev =>
        prev.map(p => (p.id === payload.userId ? { ...p, isSpeaking: payload.isSpeaking } : p))
      );
    });

    ch.on('broadcast', { event: 'voice_mute' }, ({ payload }) => {
      if (!payload) return;
      setVoiceParticipants(prev =>
        prev.map(p => (p.id === payload.userId ? { ...p, isMuted: payload.isMuted } : p))
      );
    });

    ch.on('broadcast', { event: 'voice_kick' }, ({ payload }) => {
      if (payload && (payload.targetUserId === myParticipantIdRef.current || (currentUser && payload.targetUserId === currentUser.id))) {
        handleLeaveVoiceCallRef.current();
        playAudioChime('leave');
      }
    });

    ch.on('broadcast', { event: 'member_kicked' }, ({ payload }) => {
      if (!payload || !currentUser) return;
      if (payload.memberId === currentUser.id || payload.memberId === myParticipantIdRef.current) {
        evictSelfFromKickedServerRef.current(
          payload.serverId || voiceServerIdRef.current || '',
          'Bạn đã bị quản trị viên mời ra khỏi máy chủ.'
        );
      }
    });

    ch.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        send('rtc_hello', { from: myId });
        if (myVoiceParticipantRef.current) {
          send('voice_presence', { action: 'join', participant: myVoiceParticipantRef.current });
        }
      }
    });

    return () => {
      rtcSendRef.current = null;
      send('rtc_bye', { from: myId });
      Array.from(peersRef.current.keys()).forEach(closePeer);
      ch.unsubscribe();
    };
  }, [connectedVoiceChannel]);

  // ──────── TỰ ĐỘNG THÔNG BÁO VÀ NGẮT VOICE SẠCH SẼ KHI TẮT CỬA SỔ / THOÁT ỨNG DỤNG ────────
  useEffect(() => {
    let unlistenClose: (() => void) | undefined;
    let unlistenState: (() => void) | undefined;

    // 1. Khi người dùng bấm nút đóng X hoặc Thoát ứng dụng từ System Tray
    listen('app-close-requested', () => {
      handleLeaveVoiceCallRef.current();
      broadcastUserOfflineRef.current();
    }).then(fn => { unlistenClose = fn; }).catch(() => {});

    // 2. Khi cửa sổ bị ẩn vào System Tray (nút X khi bật close-to-tray)
    // Tự động out phòng voice và cập nhật ngay trạng thái sang Vô hình (offline)
    listen<string>('app-window-state', (event) => {
      if (event.payload === 'hidden') {
        handleLeaveVoiceCallRef.current();
        broadcastUserOfflineRef.current();
      } else if (event.payload === 'normal') {
        broadcastUserOnlineRef.current();
      }
    }).then(fn => { unlistenState = fn; }).catch(() => {});

    // 3. Sự kiện beforeunload khi refresh / đóng webview
    const handleBeforeUnload = () => {
      handleLeaveVoiceCallRef.current();
      broadcastUserOfflineRef.current();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (unlistenClose) unlistenClose();
      if (unlistenState) unlistenState();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // ──────── TỰ ĐỘNG HỦY CUỘC GỌI RIÊNG 1-1 SAU 30 GIÂY NẾU ĐỐI PHƯƠNG KHÔNG BẮT MÁY ────────
  useEffect(() => {
    if (connectedVoiceServerId !== 'dm_private' || !connectedVoiceChannel) {
      setDmCallCountdown(30);
      setDmCallConnected(false);
      return;
    }

    // Nếu gọi với AI Bot đang hoạt động thì coi như bắt máy ngay
    if (activeDmFriend && ACTIVE_BOT_IDS.has(activeDmFriend.id)) {
      setDmCallConnected(true);
      setDmCallCountdown(30);
      return;
    }

    if (dmCallConnected || peersRef.current.size > 0) {
      return;
    }

    setDmCallCountdown(30);
    const interval = setInterval(() => {
      setDmCallCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleLeaveVoiceCall();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [connectedVoiceServerId, connectedVoiceChannel, activeDmFriend?.id, dmCallConnected]);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!currentUser || servers.length === 0 || selectedServer.id === 'srv_none') {
      onActiveServerChange?.(null);
    } else {
      onActiveServerChange?.(selectedServer);
    }
  }, [currentUser, servers.length, selectedServer, onActiveServerChange]);

  // ──────── ĐỒNG BỘ HOẶC XÓA SẠCH TRẠNG THÁI SERVER KHI ĐĂNG NHẬP / ĐĂNG XUẤT ────────
  useEffect(() => {
    myParticipantIdRef.current =
      currentUser?.id || 'guest_' + Math.random().toString(36).substring(2, 8);

    if (!currentUser) {
      // Khi đăng xuất: ngắt kết nối voice call, xóa toàn bộ trạng thái server trong bộ nhớ
      if (connectedVoiceChannel || micStreamRef.current) {
        handleLeaveVoiceCall();
      }
      setServers([]);
      setSelectedServer(EMPTY_SERVER_FALLBACK);
      setSelectedChannel(EMPTY_SERVER_FALLBACK.channels[0]);
      setMessages([]);
      setVoiceParticipants([]);
      setServerNicknames({});
      setFollowingUserIds(new Set());
      setFollowersOfMeMap({});
      setCreatingChannelState(null);
      setNewChannelName('');
      setIsServerSettingsOpen(false);
      setConfirmActionModal(null);
      setIsCreateModalOpen(false);
      setIsNicknameModalOpen(false);
      setIsStatusMenuOpen(false);
      setMemberMenu(null);
      setActiveDmFriend(null);
      setDmMessages([]);
      setDmInputText('');
      setDmAttachTrack(false);
      setUnreadDmCounts({});
      setUnreadChannelCounts({});
      seenMessageIdsRef.current = new Set();
      onActiveServerChange?.(null);
      return;
    }

    // Tải trạng thái số tin nhắn chưa đọc & danh sách ID tin nhắn đã xem của tài khoản
    try {
      const savedSeen = localStorage.getItem(`spytify_seen_msg_ids_${currentUser.id}`);
      seenMessageIdsRef.current = savedSeen ? new Set(JSON.parse(savedSeen)) : new Set();
    } catch {
      seenMessageIdsRef.current = new Set();
    }
    try {
      const savedUnreadDm = localStorage.getItem(`spytify_unread_dm_${currentUser.id}`);
      setUnreadDmCounts(savedUnreadDm ? JSON.parse(savedUnreadDm) : {});
    } catch {
      setUnreadDmCounts({});
    }
    try {
      const savedUnreadCh = localStorage.getItem(`spytify_unread_ch_${currentUser.id}`);
      setUnreadChannelCounts(savedUnreadCh ? JSON.parse(savedUnreadCh) : {});
    } catch {
      setUnreadChannelCounts({});
    }

    // Khi đăng nhập: tải đúng danh sách server & dữ liệu của tài khoản đó
    const userServers = loadUserServersFromStorage(currentUser.id);
    syncServerCustomBotsToRegisteredUsers(userServers);
    setServers(userServers);
    if (userServers.length > 0) {
      setSelectedServer(userServers[0]);
      setSelectedChannel(userServers[0].channels[0]);
      setIsFriendsTabActive(false);
      onActiveServerChange?.(userServers[0]);
    } else {
      setSelectedServer(EMPTY_SERVER_FALLBACK);
      setSelectedChannel(EMPTY_SERVER_FALLBACK.channels[0]);
      setIsFriendsTabActive(true);
      onActiveServerChange?.(null);
    }

    try {
      const savedMsgs = localStorage.getItem(`spytify_server_messages_${currentUser.id}`);
      setMessages(savedMsgs ? JSON.parse(savedMsgs) : []);
    } catch {
      setMessages([]);
    }

    try {
      const savedNicks = localStorage.getItem(`spytify_server_nicknames_${currentUser.id}`);
      setServerNicknames(savedNicks ? JSON.parse(savedNicks) : {});
    } catch {
      setServerNicknames({});
    }

    try {
      const migratedKey = `spytify_follow_cloud_v2_${currentUser.id}`;
      if (!localStorage.getItem(migratedKey)) {
        localStorage.removeItem(`spytify_user_following_${currentUser.id}`);
        localStorage.removeItem('spytify_user_following');
        localStorage.setItem(migratedKey, '1');
        setFollowingUserIds(new Set());
      } else {
        const savedFollow = localStorage.getItem(`spytify_user_following_${currentUser.id}`);
        if (savedFollow) {
          const parsed: string[] = JSON.parse(savedFollow);
          setFollowingUserIds(new Set(parsed.filter(id => !id.startsWith('usr_custom_'))));
        } else {
          setFollowingUserIds(new Set());
        }
      }
    } catch {
      setFollowingUserIds(new Set());
    }
  }, [currentUser?.id]);

  // Lưu trạng thái màn hình hiện tại vào Ref để các listener real-time biết người dùng đang mở khung chat nào
  const viewStateRef = useRef({
    isFriendsTabActive,
    activeDmFriendId: activeDmFriend?.id || null,
    selectedServerId: selectedServer.id,
    selectedChannelId: selectedChannel.id,
  });
  viewStateRef.current = {
    isFriendsTabActive,
    activeDmFriendId: activeDmFriend?.id || null,
    selectedServerId: selectedServer.id,
    selectedChannelId: selectedChannel.id,
  };

  const handleIncomingDmMessage = (
    msg: CommunityMessage,
    senderId: string,
    roomId: string,
    playBeep = true
  ) => {
    if (!currentUser?.id || !msg?.id || !senderId || senderId === currentUser.id) return;

    // Lưu tin nhắn vào bộ nhớ cục bộ của phòng DM đó
    const storageKey = `spytify_dm_messages_${roomId}`;
    try {
      const raw = localStorage.getItem(storageKey);
      const existing: CommunityMessage[] = raw ? JSON.parse(raw) : [];
      if (!existing.some(m => m.id === msg.id)) {
        const updated = [...existing, msg].slice(-MAX_CHAT_MESSAGES_LIMIT);
        localStorage.setItem(storageKey, JSON.stringify(updated));
      }
    } catch {}

    // Đảm bảo người gửi có trong danh sách registeredUsers để hiển thị ở cột TIN NHẮN TRỰC TIẾP
    setRegisteredUsers(prev => {
      if (prev.some(u => u.id === senderId)) return prev;
      const nextUser: CommunityUserProfile = {
        id: senderId,
        username: msg.username || 'operative',
        display_name: msg.display_name || msg.username || 'Operative',
        avatar: msg.avatar || null,
        role: 'AGENT',
        status: 'online',
        bio: 'Thành viên Spytify từ hệ thống cộng đồng.',
        listening: null,
        listeningTrack: null,
        isHost: false,
        followsCurrentUser: Boolean(followersOfMeMap[senderId]),
      };
      return [...prev, nextUser];
    });

    const isViewingThisDm =
      viewStateRef.current.isFriendsTabActive && viewStateRef.current.activeDmFriendId === senderId;

    if (isViewingThisDm) {
      seenMessageIdsRef.current.add(msg.id);
      persistSeenMessageIds();
      setDmMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg].slice(-MAX_CHAT_MESSAGES_LIMIT);
      });
    } else if (!seenMessageIdsRef.current.has(msg.id)) {
      seenMessageIdsRef.current.add(msg.id);
      persistSeenMessageIds();
      setUnreadDmCounts(prev => {
        const next = { ...prev, [senderId]: (prev[senderId] || 0) + 1 };
        try {
          localStorage.setItem(`spytify_unread_dm_${currentUser.id}`, JSON.stringify(next));
        } catch {}
        return next;
      });
      if (playBeep) {
        playAudioChime('join');
      }
    }
  };

  // ──────── ĐỒNG BỘ HỒ SƠ ĐÁM MÂY (AVATAR), TIN NHẮN MỚI & LỜI MỜI KẾT BẠN REAL-TIME QUA SUPABASE ────────
  useEffect(() => {
    if (!currentUser?.id) return;

    let isMounted = true;

    const syncIncomingCloudDms = async (isFirstSync = false) => {
      try {
        const incomingRows = await fetchIncomingCloudDirectMessages(currentUser.id);
        if (!isMounted || !incomingRows.length) return;
        const initFlagKey = `spytify_seen_dm_init_${currentUser.id}`;
        const isAlreadyInitialized = Boolean(localStorage.getItem(initFlagKey));
        if (!isAlreadyInitialized) {
          // Lần đầu tiên khởi tạo bộ đếm trên thiết bị: đánh dấu các tin nhắn cũ trong quá khứ là đã biết
          incomingRows.forEach(r => {
            if (r.id) seenMessageIdsRef.current.add(r.id);
          });
          persistSeenMessageIds();
          try {
            localStorage.setItem(initFlagKey, '1');
          } catch {}
          return;
        }

        incomingRows.forEach(r => {
          if (!r.id || r.sender_id === currentUser.id) return;
          const dmMsg: CommunityMessage = {
            id: r.id,
            server_id: 'dm_private',
            channel_id: r.room_id,
            user_id: r.sender_id,
            username: r.sender_username || 'operative',
            display_name: r.sender_display_name || r.sender_username || 'Operative',
            avatar: r.sender_avatar || null,
            content: r.content,
            track_embed: r.track_embed || null,
            created_at: r.created_at || '',
          };
          handleIncomingDmMessage(dmMsg, r.sender_id, r.room_id, !isFirstSync);
        });
      } catch {}
    };

    const syncCloudProfilesAndFollows = async () => {
      try {
        const [cloudProfiles, followGraph, serverInvites, serverAudit] = await Promise.all([
          fetchAllCloudProfiles(),
          fetchCloudFollowGraph(currentUser.id),
          fetchCloudServerInvites(currentUser.id),
          fetchCloudServerMembershipAudit(currentUser.id),
        ]);

        if (!isMounted) return;

        // 0. Đồng bộ lời mời vào Server (incoming / outgoing) & các Server của user từ Cloud
        setIncomingServerInvites(serverInvites.incoming);
        setOutgoingServerInvites(serverInvites.outgoing);

        const removedServerSet = new Set<string>(serverAudit.removedServerIds || []);
        serverAudit.removedServerIds.forEach(removedSrvId => {
          evictSelfFromKickedServerRef.current(removedSrvId);
        });

        const cloudServers = serverAudit.activeServers;
        if (cloudServers && cloudServers.length > 0) {
          const mergeServerWithCloud = (localSrv: CommunityServer | undefined, cs: CommunityServer): CommunityServer => {
            const kickedSet = new Set<string>([
              ...(Array.isArray(cs.kicked_ids) ? cs.kicked_ids : []),
            ]);
            const combinedMembers = Array.from(
              new Set([
                ...(Array.isArray(localSrv?.member_ids) ? localSrv!.member_ids! : []),
                ...(Array.isArray(cs.member_ids) ? cs.member_ids : []),
                ...(cs.owner_id ? [cs.owner_id] : []),
              ])
            ).filter(id => !kickedSet.has(id) || id === cs.owner_id);
            const authoritativeMods = sanitizeModeratorIds(
              cs.moderator_ids,
              cs.owner_id,
              Array.from(kickedSet),
              currentUser.id
            );
            const draftSrv: CommunityServer = {
              ...localSrv,
              ...cs,
              is_custom: true,
              member_ids: combinedMembers,
              moderator_ids: authoritativeMods,
              kicked_ids: Array.from(kickedSet),
              custom_bots: mergeCustomBotsLists(localSrv?.custom_bots, cs.custom_bots),
            };
            const { badge } = resolveServerRoleFlags(draftSrv, currentUser.id);
            return {
              ...draftSrv,
              badge,
            };
          };

          syncServerCustomBotsToRegisteredUsers(cloudServers);

          setServers(prev => {
            const byId = new Map<string, CommunityServer>();
            prev.forEach(s => {
              if (!removedServerSet.has(s.id)) {
                byId.set(s.id, s);
              }
            });
            cloudServers.forEach((cs: CommunityServer) => {
              if (!cs?.id || cs.id === 'srv_none') return;
              if (
                cs.owner_id !== currentUser.id &&
                Array.isArray(cs.kicked_ids) &&
                cs.kicked_ids.includes(currentUser.id)
              ) {
                return;
              }
              byId.set(cs.id, mergeServerWithCloud(byId.get(cs.id), cs));
            });
            const merged = applySavedServerOrder(currentUser.id, Array.from(byId.values()));
            persistServers(merged);
            return merged;
          });

          setSelectedServer(prev => {
            if (!prev || prev.id === 'srv_none') return prev;
            if (removedServerSet.has(prev.id)) return EMPTY_SERVER_FALLBACK;
            const matchedCloud = cloudServers.find((cs: CommunityServer) => cs?.id === prev.id);
            if (!matchedCloud) return prev;
            return mergeServerWithCloud(prev, matchedCloud);
          });
        } else if (removedServerSet.size > 0) {
          setServers(prev => {
            const next = prev.filter(s => !removedServerSet.has(s.id));
            if (next.length !== prev.length) persistServers(next);
            return next;
          });
        }

        // 1. Cập nhật danh sách những người đã theo dõi / gửi lời mời kết bạn cho mình
        const nextFollowersMap: Record<string, CloudFollowEdge> = {};
        followGraph.followersOfMe.forEach(edge => {
          if (edge.followerId && edge.followerId !== currentUser.id) {
            // Tìm avatar mới nhất từ bảng spytify_profiles nếu có
            const matchedProfile = cloudProfiles.find(p => p.id === edge.followerId);
            nextFollowersMap[edge.followerId] = {
              ...edge,
              followerAvatar: matchedProfile?.avatar || edge.followerAvatar || null,
              followerDisplayName: matchedProfile?.display_name || edge.followerDisplayName,
              followerUsername: matchedProfile?.username || edge.followerUsername,
            };
          }
        });
        setFollowersOfMeMap(nextFollowersMap);

        // 2. Đồng bộ danh sách mình đang theo dõi từ đám mây
        setFollowingUserIds(prev => {
          const merged = new Set(prev);
          followGraph.myFollowingIds.forEach(id => {
            if (id && !id.startsWith('usr_custom_')) merged.add(id);
          });
          try {
            localStorage.setItem(
              `spytify_user_following_${currentUser.id}`,
              JSON.stringify(Array.from(merged))
            );
          } catch {}
          return merged;
        });

        // 3. Đồng bộ avatar và tên hiển thị của tất cả người dùng từ bảng spytify_profiles trên đám mây
        if (cloudProfiles.length > 0) {
          setRegisteredUsers(prev => {
            const byId = new Map<string, CommunityUserProfile>();
            prev.forEach(u => {
              if (!u.id.startsWith('usr_custom_') && u.id !== currentUser.id) {
                byId.set(u.id, {
                  ...u,
                  followsCurrentUser: Boolean(nextFollowersMap[u.id]),
                });
              }
            });

            cloudProfiles.forEach(cp => {
              if (!cp.id || cp.id === currentUser.id || cp.id.startsWith('usr_custom_')) return;
              const existing =
                byId.get(cp.id) ||
                Array.from(byId.values()).find(
                  u => u.username.toLowerCase() === (cp.username || '').toLowerCase()
                );

              if (existing) {
                byId.set(existing.id, {
                  ...existing,
                  id: cp.id,
                  username: cp.username || existing.username,
                  display_name: cp.display_name || existing.display_name,
                  avatar: cp.avatar || existing.avatar || null,
                  followsCurrentUser: Boolean(nextFollowersMap[cp.id]),
                });
              } else {
                byId.set(cp.id, {
                  id: cp.id,
                  username: cp.username,
                  display_name: cp.display_name || cp.username,
                  avatar: cp.avatar || null,
                  role: 'AGENT',
                  status: 'offline',
                  bio: 'Thành viên Spytify từ hệ thống cộng đồng.',
                  listening: null,
                  listeningTrack: null,
                  isHost: false,
                  followsCurrentUser: Boolean(nextFollowersMap[cp.id]),
                  joinedAt: new Date().toISOString().split('T')[0],
                });
              }
            });

            const nextList = Array.from(byId.values());
            try {
              localStorage.setItem('spytify_registered_users', JSON.stringify(nextList));
            } catch {}
            return nextList;
          });
        }
      } catch (err) {
        console.warn('Cloud profiles / follow graph sync error:', err);
      }
    };

    syncCloudProfilesAndFollows();
    syncIncomingCloudDms(true);
    const dmPollTimer = setInterval(() => {
      syncIncomingCloudDms(false);
      syncCloudProfilesAndFollows();
    }, 5000);

    const client = getSupabaseClient();
    if (!client) {
      return () => {
        isMounted = false;
        clearInterval(dmPollTimer);
      };
    }

    const socialCh = client.channel('spytify_global_social', {
      config: { broadcast: { ack: false } },
    });
    globalSocialChannelRef.current = socialCh;

    socialCh.on('broadcast', { event: 'dm_message_notify' }, ({ payload }) => {
      if (!payload || payload.receiverId !== currentUser.id || !payload.message) return;
      handleIncomingDmMessage(
        payload.message as CommunityMessage,
        payload.senderId || payload.message.user_id,
        payload.roomId || payload.message.channel_id,
        true
      );
    });

    socialCh.on('broadcast', { event: 'voice_call_invite' }, ({ payload }) => {
      if (payload && (payload.targetUserId === myParticipantIdRef.current || (currentUser && payload.targetUserId === currentUser.id))) {
        // Nếu đang kết nối sẵn trong đúng phòng thoại DM đó (ví dụ cả 2 cùng bấm gọi nhau) -> coi như đã kết nối, không bật popup thừa
        if (
          (payload.isDmCall || payload.serverId === 'dm_private') &&
          connectedVoiceServerIdRef.current === 'dm_private' &&
          connectedVoiceChannelRef.current === payload.channelId
        ) {
          setDmCallConnected(true);
          return;
        }
        playAudioChime('join');
        setIncomingVoiceInvite(payload);
        onIncomingVoiceCall?.();
      }
    });

    socialCh.on('broadcast', { event: 'voice_call_cancel' }, ({ payload }) => {
      if (!payload || !currentUser) return;
      if (payload.targetUserId === currentUser.id || payload.targetUserId === myParticipantIdRef.current) {
        const curInv = incomingVoiceInviteRef.current;
        if (curInv && (!payload.channelId || curInv.channelId === payload.channelId)) {
          setIncomingVoiceInvite(null);
          showVoiceToast(`${payload.fromUserName || 'Người gọi'} đã hủy cuộc gọi.`);
        }
      }
    });

    socialCh.on('broadcast', { event: 'voice_call_declined' }, ({ payload }) => {
      if (!payload || !currentUser) return;
      if (payload.fromUserId === currentUser.id || payload.fromUserId === myParticipantIdRef.current) {
        if (
          payload.isDmCall &&
          connectedVoiceServerIdRef.current === 'dm_private' &&
          connectedVoiceChannelRef.current === payload.channelId
        ) {
          handleLeaveVoiceCallRef.current();
          showVoiceToast(`${payload.declinedByName || 'Người nhận'} đã từ chối cuộc gọi.`);
        }
      }
    });

    socialCh.on('broadcast', { event: 'voice_call_accepted' }, ({ payload }) => {
      if (!payload || !currentUser) return;
      if (payload.fromUserId === currentUser.id || payload.fromUserId === myParticipantIdRef.current) {
        if (
          payload.isDmCall &&
          connectedVoiceServerIdRef.current === 'dm_private' &&
          connectedVoiceChannelRef.current === payload.channelId
        ) {
          setDmCallConnected(true);
        }
      }
    });

    socialCh.on('broadcast', { event: 'voice_kick' }, ({ payload }) => {
      if (payload && (payload.targetUserId === myParticipantIdRef.current || (currentUser && payload.targetUserId === currentUser.id))) {
        if (!payload.serverId || connectedVoiceServerIdRef.current === payload.serverId || voiceServerIdRef.current === payload.serverId) {
          handleLeaveVoiceCallRef.current();
          playAudioChime('leave');
        }
      }
    });

    socialCh.on('broadcast', { event: 'server_message_notify' }, ({ payload }) => {
      if (!payload || !payload.message || payload.senderId === currentUser.id) return;
      const msg: CommunityMessage = payload.message;
      const srvId = payload.serverId || msg.server_id;
      const chId = payload.channelId || msg.channel_id;
      if (!srvId || !chId) return;

      const isWelcomeJoin = String(msg.id || '').startsWith('msg_welcome_');
      if (msg.user_id) {
        ensureMemberSyncedToServer(
          {
            id: msg.user_id,
            username: msg.username || 'operative',
            display_name: msg.display_name || msg.username || 'Operative',
            avatar: msg.avatar || null,
          },
          srvId,
          isWelcomeJoin
        );
      }

      appendServerMessage(msg);

      const isViewingThisChannel =
        !viewStateRef.current.isFriendsTabActive &&
        viewStateRef.current.selectedServerId === srvId &&
        viewStateRef.current.selectedChannelId === chId;

      if (isViewingThisChannel) {
        seenMessageIdsRef.current.add(msg.id);
        persistSeenMessageIds();
      } else if (!seenMessageIdsRef.current.has(msg.id)) {
        seenMessageIdsRef.current.add(msg.id);
        persistSeenMessageIds();
        setUnreadChannelCounts(prev => {
          const next = { ...prev, [chId]: (prev[chId] || 0) + 1 };
          try {
            localStorage.setItem(`spytify_unread_ch_${currentUser.id}`, JSON.stringify(next));
          } catch {}
          return next;
        });
      }
    });

    socialCh.on('broadcast', { event: 'follow_update' }, ({ payload }) => {
      if (!payload) return;
      if (payload.targetId === currentUser.id) {
        if (payload.action === 'follow' && payload.followerId) {
          const edge: CloudFollowEdge = {
            followerId: payload.followerId,
            followerUsername: payload.followerUsername || 'operative',
            followerDisplayName: payload.followerDisplayName || payload.followerUsername || 'Operative',
            followerAvatar: payload.followerAvatar || null,
            targetId: currentUser.id,
            createdAt: payload.createdAt || '',
          };
          setFollowersOfMeMap(prev => ({
            ...prev,
            [edge.followerId]: edge,
          }));
          setRegisteredUsers(prev =>
            prev.map(u =>
              u.id === edge.followerId
                ? {
                    ...u,
                    avatar: edge.followerAvatar || u.avatar,
                    display_name: edge.followerDisplayName || u.display_name,
                    followsCurrentUser: true,
                  }
                : u
            )
          );
        } else if (payload.action === 'unfollow' && payload.followerId) {
          setFollowersOfMeMap(prev => {
            const next = { ...prev };
            delete next[payload.followerId];
            return next;
          });
          setRegisteredUsers(prev =>
            prev.map(u => (u.id === payload.followerId ? { ...u, followsCurrentUser: false } : u))
          );
        }
      }
    });

    socialCh.on('broadcast', { event: 'server_invite_update' }, ({ payload }) => {
      if (!payload) return;
      if (payload.action === 'invite' && payload.invite?.targetUserId === currentUser.id) {
        const inv: CloudServerInvite = payload.invite;
        setIncomingServerInvites(prev => [...prev.filter(i => i.id !== inv.id && i.serverId !== inv.serverId), inv]);
      } else if (payload.action === 'accepted' && payload.updatedServer) {
        const upd: CommunityServer = payload.updatedServer;
        if (payload.targetUserId) {
          ensureMemberSyncedToServer(
            {
              id: payload.targetUserId,
              username: payload.targetUsername || 'operative',
              display_name: payload.targetDisplayName || payload.targetUsername || 'Operative',
              avatar: payload.targetAvatar || null,
            },
            upd.id,
            true
          );
        }
        setOutgoingServerInvites(prev =>
          prev.filter(i => !(i.serverId === upd.id && i.targetUserId === payload.targetUserId))
        );
        setServers(prev => {
          if (!prev.some(s => s.id === upd.id)) return prev;
          const next = prev.map(s =>
            s.id === upd.id
              ? {
                  ...s,
                  ...upd,
                  member_ids: Array.from(
                    new Set([...(s.member_ids || []), ...(upd.member_ids || [])])
                  ),
                  badge:
                    upd.owner_id === currentUser.id
                      ? 'OWNER'
                      : Array.isArray(upd.moderator_ids) && upd.moderator_ids.includes(currentUser.id)
                      ? 'MOD'
                      : 'MEMBER',
                }
              : s
          );
          persistServers(next);
          return next;
        });
        setSelectedServer(prev =>
          prev.id === upd.id
            ? {
                ...prev,
                ...upd,
                member_ids: Array.from(
                  new Set([...(prev.member_ids || []), ...(upd.member_ids || [])])
                ),
                badge:
                  upd.owner_id === currentUser.id
                    ? 'OWNER'
                    : Array.isArray(upd.moderator_ids) && upd.moderator_ids.includes(currentUser.id)
                    ? 'MOD'
                    : 'MEMBER',
              }
            : prev
        );
      } else if (payload.action === 'declined' && payload.serverId && payload.targetUserId) {
        setOutgoingServerInvites(prev =>
          prev.filter(i => !(i.serverId === payload.serverId && i.targetUserId === payload.targetUserId))
        );
      }
    });

    socialCh.on('broadcast', { event: 'member_kicked' }, ({ payload }) => {
      if (!payload || !currentUser) return;
      if (payload.memberId === currentUser.id || payload.memberId === myParticipantIdRef.current) {
        evictSelfFromKickedServerRef.current(
          payload.serverId,
          'Bạn đã bị quản trị viên mời ra khỏi máy chủ.'
        );
      } else if (payload.serverId && payload.memberId) {
        setVoiceParticipants(prev =>
          prev.filter(p => !(p.id === payload.memberId && (!p.serverId || p.serverId === payload.serverId)))
        );
      }
    });

    socialCh.on('broadcast', { event: 'server_updated' }, ({ payload }) => {
      if (!payload || !payload.id || !currentUser) return;
      const upd: CommunityServer = payload;
      if (
        upd.owner_id !== currentUser.id &&
        (upd.kicked_ids?.includes(currentUser.id) ||
          (Array.isArray(upd.member_ids) && !upd.member_ids.includes(currentUser.id)))
      ) {
        evictSelfFromKickedServerRef.current(upd.id, 'Bạn đã bị quản trị viên mời ra khỏi máy chủ.');
        return;
      }

      const cleanedMods = sanitizeModeratorIds(upd.moderator_ids, upd.owner_id, upd.kicked_ids, currentUser.id);
      const normalizedUpd: CommunityServer = { ...upd, moderator_ids: cleanedMods };
      const { canManage, badge: myBadge } = resolveServerRoleFlags(normalizedUpd, currentUser.id);
      const isMyServer =
        upd.owner_id === currentUser.id ||
        (Array.isArray(upd.member_ids) && upd.member_ids.includes(currentUser.id)) ||
        cleanedMods.includes(currentUser.id);

      syncServerCustomBotsToRegisteredUsers([normalizedUpd]);
      setServers(prev => {
        if (!prev.some(s => s.id === normalizedUpd.id) && !isMyServer) return prev;
        const mergedItem: CommunityServer = { ...normalizedUpd, badge: myBadge };
        const exists = prev.some(s => s.id === normalizedUpd.id);
        const next = exists ? prev.map(s => (s.id === normalizedUpd.id ? mergedItem : s)) : [...prev, mergedItem];
        persistServers(next);
        return next;
      });
      setSelectedServer(prev => {
        if (prev.id !== normalizedUpd.id) return prev;
        if (!canManage) {
          setServerSettingsTab(cur => (cur === 'members' ? 'overview' : cur));
        }
        return { ...normalizedUpd, badge: myBadge };
      });
    });

    socialCh.subscribe();

    return () => {
      isMounted = false;
      clearInterval(dmPollTimer);
      socialCh.unsubscribe();
      globalSocialChannelRef.current = null;
    };
  }, [currentUser?.id]);

  // Đồng bộ avatar mới nhất cho activeDmFriend và selectedProfileUser khi registeredUsers cập nhật
  useEffect(() => {
    if (activeDmFriend) {
      const updated = registeredUsers.find(u => u.id === activeDmFriend.id);
      if (updated && (updated.avatar !== activeDmFriend.avatar || updated.display_name !== activeDmFriend.display_name)) {
        setActiveDmFriend(prev => (prev ? { ...prev, avatar: updated.avatar, display_name: updated.display_name } : null));
      }
    }
    if (selectedProfileUser && selectedProfileUser.id !== 'usr_me') {
      const updated = registeredUsers.find(u => u.id === selectedProfileUser.id);
      if (
        updated &&
        (updated.avatar !== selectedProfileUser.avatar ||
          updated.display_name !== selectedProfileUser.display_name ||
          isUserFollowingMe(updated.id) !== selectedProfileUser.followsCurrentUser)
      ) {
        setSelectedProfileUser(prev =>
          prev
            ? {
                ...prev,
                avatar: updated.avatar,
                display_name: updated.display_name,
                followsCurrentUser: isUserFollowingMe(updated.id),
              }
            : null
        );
      }
    }
  }, [registeredUsers, followersOfMeMap]);

  // Handle server switch (mỗi server hoạt động hoàn toàn độc lập)
  const handleSelectServer = (server: CommunityServer) => {
    setSelectedServer(server);
    const firstCh = server.channels[0];
    setSelectedChannel(firstCh);
    if (firstCh?.id) {
      markChannelAsRead(firstCh.id);
    }
    setCreatingChannelState(null);
    setNewChannelName('');
    setInputText('');
    setAttachCurrentTrack(false);
    setMemberMenu(null);
    setIsStatusMenuOpen(false);
    onActiveServerChange?.(server);
  };

  // Handle channel switch
  const handleSelectChannel = (channel: CommunityChannel) => {
    setSelectedChannel(channel);
    markChannelAsRead(channel.id);
    setCreatingChannelState(null);
    setNewChannelName('');

    // Nếu là kênh Voice: Tự động tham gia cuộc gọi ngay lập tức giống Discord!
    if (channel.type === 'voice') {
      if (connectedVoiceChannel !== channel.id || connectedVoiceServerId !== selectedServer.id) {
        handleJoinVoiceCall(channel.id, channel);
      }
    }
  };

  // Keep ref to latest user presence payload for real-time responses
  const myPresencePayloadRef = useRef<any>(null);
  myPresencePayloadRef.current = {
    id: currentUser?.id || myParticipantIdRef.current,
    username: currentUser?.username || currentUser?.email?.split('@')[0] || 'operative',
    display_name: myServerDisplayName,
    avatar: currentUser?.avatar || null,
    status: myStatus === 'invisible' ? 'offline' : myStatus,
    bio: myBio,
    thought: myUserThought,
    custom_status: myUserThought,
    tags: resolveMemberTags('usr_me', selectedServer).map(t => t.id),
    listening: myVisibleListening,
    listeningTrack: myVisibleTrack,
  };

  // Broadcast presence updates whenever status, server nickname, avatar, track, thought or tags change
  useEffect(() => {
    if (activeChannelRef.current && myPresencePayloadRef.current) {
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'user_presence',
        payload: myPresencePayloadRef.current,
      });
    }
    if (myVoiceParticipantRef.current && activeChannelRef.current) {
      myVoiceParticipantRef.current = {
        ...myVoiceParticipantRef.current,
        name: myServerDisplayName,
        avatar: currentUser?.avatar || null,
      };
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'voice_presence',
        payload: { action: 'here', participant: myVoiceParticipantRef.current },
      });
    }
  }, [myStatus, myServerDisplayName, myBio, myUserThought, currentTrack?.id, currentUser?.avatar, selectedServer.member_tags]);

  // ──────── SUPABASE REALTIME SYNC (MESSAGES & VOICE STATE THEO SERVER) ────────
  useEffect(() => {
    if (!currentUser || selectedServer.id === 'srv_none') return;
    const client = getSupabaseClient();
    if (!client) return;

    const currentSrvId = selectedServer.id;

    // Tải cấu hình Server mới nhất trên Cloud + lịch sử tin nhắn để gộp đầy đủ danh sách member_ids trước khi đồng bộ ngược
    Promise.all([
      fetchCloudServerById(currentSrvId),
      fetchCloudDirectMessages(`spytify_srv_chat_${currentSrvId}`),
    ]).then(([cloudSrv, cloudRows]) => {
      // Nếu bản ghi Cloud cho thấy user hiện tại đã bị kick hoặc bị xóa khỏi danh sách thành viên -> trục xuất ngay lập tức
      if (cloudSrv && cloudSrv.owner_id !== currentUser.id) {
        const cloudKicked =
          Array.isArray(cloudSrv.kicked_ids) && cloudSrv.kicked_ids.includes(currentUser.id);
        const cloudMemberMissing =
          Array.isArray(cloudSrv.member_ids) &&
          !cloudSrv.member_ids.includes(currentUser.id) &&
          !(Array.isArray(cloudSrv.moderator_ids) && cloudSrv.moderator_ids.includes(currentUser.id));
        if (cloudKicked || cloudMemberMissing) {
          evictSelfFromKickedServerRef.current(
            currentSrvId,
            'Bạn không còn là thành viên của máy chủ này.'
          );
          return;
        }
      }

      const cloudKickedSet = new Set<string>(
        Array.isArray(cloudSrv?.kicked_ids) ? cloudSrv.kicked_ids : []
      );
      const chatSenders = new Map<string, { id: string; username: string; display_name: string; avatar: string | null }>();

      if (cloudRows && cloudRows.length > 0) {
        cloudRows.forEach(r => {
          if (r.sender_id && r.sender_id !== 'usr_me') {
            chatSenders.set(r.sender_id, {
              id: r.sender_id,
              username: r.sender_username || 'operative',
              display_name: r.sender_display_name || r.sender_username || 'Operative',
              avatar: r.sender_avatar || null,
            });
          }
        });

        setMessages(prev => {
          const map = new Map<string, CommunityMessage>();
          prev.forEach(m => map.set(m.id, m));
          cloudRows.forEach(r => {
            map.set(r.id, {
              id: r.id,
              server_id: currentSrvId,
              channel_id: r.receiver_id || selectedServer.channels[0]?.id || '',
              user_id: r.sender_id,
              username: r.sender_username || 'operative',
              display_name: r.sender_display_name || r.sender_username || 'Operative',
              avatar: r.sender_avatar || null,
              content: r.content,
              track_embed: r.track_embed || null,
              image_url: r.image_url || null,
              created_at: r.created_at || '',
            });
          });
          const allMsgs = Array.from(map.values());
          const thisSrvMsgs = allMsgs
            .filter(m => (m.server_id || selectedServer.id) === currentSrvId)
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .slice(-MAX_CHAT_MESSAGES_LIMIT);
          const otherSrvMsgs = allMsgs.filter(m => (m.server_id || selectedServer.id) !== currentSrvId);

          const merged = [...otherSrvMsgs, ...thisSrvMsgs].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          try {
            localStorage.setItem(`spytify_server_messages_${currentUser.id}`, JSON.stringify(merged));
          } catch {}
          return merged;
        });

        chatSenders.forEach(sender => {
          if (!cloudKickedSet.has(sender.id)) {
            ensureMemberSyncedToServer(sender, currentSrvId, false);
          }
        });
      }

      const kickedSet = new Set<string>([
        ...(Array.isArray(cloudSrv?.kicked_ids) ? cloudSrv.kicked_ids : []),
        ...(Array.isArray(selectedServer.kicked_ids) ? selectedServer.kicked_ids : []),
      ]);

      const mergedMemberIds = Array.from(
        new Set([
          ...(Array.isArray(selectedServer.member_ids) ? selectedServer.member_ids : []),
          ...(Array.isArray(cloudSrv?.member_ids) ? cloudSrv.member_ids : []),
          ...Array.from(chatSenders.keys()),
          ...(selectedServer.owner_id ? [selectedServer.owner_id] : []),
          ...(cloudSrv?.owner_id ? [cloudSrv.owner_id] : []),
          currentUser.id,
          'usr_me',
        ])
      ).filter(id => !kickedSet.has(id) || id === (cloudSrv?.owner_id || selectedServer.owner_id));

      const effectiveOwnerId = cloudSrv?.owner_id || selectedServer.owner_id;
      const mergedModIds = sanitizeModeratorIds(
        cloudSrv ? cloudSrv.moderator_ids : selectedServer.moderator_ids,
        effectiveOwnerId,
        Array.from(kickedSet),
        currentUser.id
      );

      const draftSrv: CommunityServer = {
        ...selectedServer,
        ...(cloudSrv || {}),
        id: currentSrvId,
        is_custom: true,
        owner_id: effectiveOwnerId,
        member_ids: mergedMemberIds,
        moderator_ids: mergedModIds,
        kicked_ids: Array.from(kickedSet),
        custom_bots: mergeCustomBotsLists(selectedServer.custom_bots, cloudSrv?.custom_bots),
      };
      const { badge: myBadge } = resolveServerRoleFlags(draftSrv, currentUser.id);
      const mergedSrv: CommunityServer = { ...draftSrv, badge: myBadge };

      syncServerCustomBotsToRegisteredUsers([mergedSrv]);
      setServers(prev => {
        const next = prev.map(s => (s.id === currentSrvId ? mergedSrv : s));
        persistServers(next);
        return next;
      });
      setSelectedServer(prev => (prev.id === currentSrvId ? mergedSrv : prev));
      const cloudNeedsMemberSync =
        !cloudSrv ||
        (effectiveOwnerId !== currentUser.id &&
          (!Array.isArray(cloudSrv.member_ids) || !cloudSrv.member_ids.includes(currentUser.id)));
      if (cloudNeedsMemberSync) {
        pushCloudServer(mergedSrv).catch(() => {});
      }
    });

    const channelTopic = `spytify_server_${selectedServer.id}`;
    const channel = client.channel(channelTopic, {
      config: {
        broadcast: { ack: false },
        presence: { key: myParticipantIdRef.current },
      },
    });

    activeChannelRef.current = channel;

    // 0. Nhận cập nhật cấu hình Server real-time (đổi tên, phân quyền Mod, nhượng quyền Chủ Server, thêm phòng...)
    channel.on('broadcast', { event: 'server_updated' }, ({ payload }) => {
      if (payload && payload.id === selectedServer.id) {
        const upd: CommunityServer = payload;
        // Kiểm tra xem người dùng hiện tại có bị loại hoặc kick khỏi server không
        if (
          currentUser &&
          upd.owner_id !== currentUser.id &&
          (upd.kicked_ids?.includes(currentUser.id) ||
            (Array.isArray(upd.member_ids) && !upd.member_ids.includes(currentUser.id)))
        ) {
          evictSelfFromKickedServerRef.current(
            upd.id,
            'Bạn đã bị quản trị viên mời ra khỏi máy chủ.'
          );
          return;
        }

        const cleanedMods = sanitizeModeratorIds(upd.moderator_ids, upd.owner_id, upd.kicked_ids, currentUser.id);
        const normalizedUpd: CommunityServer = { ...upd, moderator_ids: cleanedMods };
        const { canManage, badge: myBadge } = resolveServerRoleFlags(normalizedUpd, currentUser.id);
        const mergedSrv = { ...normalizedUpd, badge: myBadge };
        if (!canManage) {
          setServerSettingsTab(cur => (cur === 'members' ? 'overview' : cur));
        }
        syncServerCustomBotsToRegisteredUsers([mergedSrv]);
        setServers(prev => {
          const next = prev.map(s => (s.id === mergedSrv.id ? mergedSrv : s));
          persistServers(next);
          return next;
        });
        setSelectedServer(mergedSrv);
      }
    });

    channel.on('broadcast', { event: 'member_kicked' }, ({ payload }) => {
      if (!payload || !currentUser) return;
      if (payload.serverId === selectedServer.id) {
        if (payload.memberId === currentUser.id || payload.memberId === myParticipantIdRef.current) {
          evictSelfFromKickedServerRef.current(
            payload.serverId,
            'Bạn đã bị quản trị viên mời ra khỏi máy chủ.'
          );
        } else {
          setVoiceParticipants(prev =>
            prev.filter(p => !(p.id === payload.memberId && (!p.serverId || p.serverId === payload.serverId)))
          );
        }
      }
    });

    // 1. Nhận tin nhắn chat mới từ mọi máy khác trong cùng server (giới hạn 80 tin nhắn gần nhất)
    channel.on('broadcast', { event: 'new_message' }, ({ payload }) => {
      if (payload && payload.id) {
        if (payload.user_id) {
          ensureMemberSyncedToServer(
            {
              id: payload.user_id,
              username: payload.username || 'operative',
              display_name: payload.display_name || payload.username || 'Operative',
              avatar: payload.avatar || null,
            },
            payload.server_id || selectedServer.id,
            String(payload.id).startsWith('msg_welcome_')
          );
        }

        appendServerMessage(payload);

        const isViewingCh =
          !viewStateRef.current.isFriendsTabActive &&
          viewStateRef.current.selectedServerId === payload.server_id &&
          viewStateRef.current.selectedChannelId === payload.channel_id;

        if (isViewingCh) {
          seenMessageIdsRef.current.add(payload.id);
          persistSeenMessageIds();
        } else if (payload.user_id !== currentUser?.id && !seenMessageIdsRef.current.has(payload.id)) {
          seenMessageIdsRef.current.add(payload.id);
          persistSeenMessageIds();
          if (payload.channel_id) {
            setUnreadChannelCounts(prev => {
              const next = { ...prev, [payload.channel_id]: (prev[payload.channel_id] || 0) + 1 };
              try {
                if (currentUser?.id) {
                  localStorage.setItem(`spytify_unread_ch_${currentUser.id}`, JSON.stringify(next));
                }
              } catch {}
              return next;
            });
          }
        }
      }
    });

    // 2. Nhận tín hiệu Sân khấu Live Stage DJ
    channel.on('broadcast', { event: 'stage_sync' }, ({ payload }) => {
      if (payload) {
        setStageSession(payload);
      }
    });

    // 2b. Đồng bộ trạng thái và hàng đợi phát nhạc của On-Demand Bot (hỗ trợ đa bot theo botId)
    channel.on('broadcast', { event: 'request_bot_sync' }, ({ payload }) => {
      if (payload) {
        const srvId = payload.serverId || payload.voiceServerId || selectedServer.id;
        const bId = payload.botId || 'usr_music_bot';
        updateServerRythmBot(srvId, bId, () => ({
          currentTrack: payload.currentTrack || null,
          queue: Array.isArray(payload.queue) ? payload.queue : [],
          isPlaying: Boolean(payload.isPlaying),
          isLooping: Boolean(payload.isLooping),
          voiceChannelId: payload.voiceChannelId || null,
          startedAt: payload.startedAt,
        }));
      }
    });

    // 3. ĐỒNG BỘ TRẠNG THÁI TRỰC TUYẾN / BẬN / VÔ HÌNH & TÊN HIỂN THỊ TRÊN SERVER
    channel.on('broadcast', { event: 'user_presence_sync_request' }, () => {
      if (myPresencePayloadRef.current && myPresencePayloadRef.current.status !== 'offline') {
        channel.send({
          type: 'broadcast',
          event: 'user_presence',
          payload: myPresencePayloadRef.current,
        });
      }
    });

    channel.on('broadcast', { event: 'user_presence' }, ({ payload }) => {
      if (!payload || !payload.id) return;
      setRealtimeUserPresences(prev => ({
        ...prev,
        [payload.id]: {
          ...payload,
          status: payload.status || 'offline',
          username: payload.username || prev[payload.id]?.username || '',
          display_name: payload.display_name || prev[payload.id]?.display_name || payload.username || 'Operative',
          thought: payload.thought ?? payload.custom_status ?? prev[payload.id]?.thought ?? null,
          custom_status: payload.custom_status ?? payload.thought ?? prev[payload.id]?.custom_status ?? null,
          bio: payload.bio ?? prev[payload.id]?.bio ?? null,
          tags: payload.tags ?? prev[payload.id]?.tags ?? null,
        },
      }));
      ensureMemberSyncedToServer(
        {
          id: payload.id,
          username: payload.username || 'operative',
          display_name: payload.display_name || payload.username || 'Operative',
          avatar: payload.avatar || null,
        },
        selectedServer.id,
        false
      );
    });

    // 4. ĐỒNG BỘ HỘI THOẠI REALTIME (VOICE CALL STATE SYNC)
    channel.on('broadcast', { event: 'voice_sync_request' }, () => {
      if (myVoiceParticipantRef.current) {
        channel.send({
          type: 'broadcast',
          event: 'voice_presence',
          payload: { action: 'here', participant: myVoiceParticipantRef.current },
        });
      }
      // Đồng bộ trạng thái các Bot Yêu Cầu đang phát trên Server hiện tại cho người mới vào phòng
      Object.entries(serverRythmBotsRef.current).forEach(([botKey, bState]) => {
        const { srvId, botId } = parseDemandBotKey(botKey);
        if (srvId === selectedServer.id && bState?.currentTrack && bState.voiceChannelId) {
          channel.send({
            type: 'broadcast',
            event: 'request_bot_sync',
            payload: {
              serverId: srvId,
              botId,
              currentTrack: bState.currentTrack,
              queue: bState.queue || [],
              isPlaying: Boolean(bState.isPlaying),
              isLooping: Boolean(bState.isLooping),
              voiceChannelId: bState.voiceChannelId,
              voiceServerId: srvId,
              startedAt: bState.startedAt,
            },
          });
        }
      });
    });

    channel.on('broadcast', { event: 'voice_presence' }, ({ payload }) => {
      if (!payload) return;
      if ((payload.action === 'join' || payload.action === 'here') && payload.participant) {
        const incomingVp: VoiceParticipant = {
          ...payload.participant,
          serverId: payload.participant.serverId || selectedServer.id,
        };
        setVoiceParticipants(prev => {
          const exists = prev.some(
            p => p.id === incomingVp.id && (p.serverId || selectedServer.id) === incomingVp.serverId
          );
          if (exists) {
            return prev.map(p =>
              p.id === incomingVp.id && (p.serverId || selectedServer.id) === incomingVp.serverId
                ? { ...p, ...incomingVp }
                : p
            );
          }
          return [...prev, incomingVp];
        });
        // Người đã ở trong phòng báo danh lại để người mới thấy đủ danh sách
        if (payload.action === 'join' && myVoiceParticipantRef.current && payload.participant.id !== myParticipantIdRef.current) {
          channel.send({
            type: 'broadcast',
            event: 'voice_presence',
            payload: { action: 'here', participant: myVoiceParticipantRef.current },
          });
        }
      } else if (payload.action === 'leave' && payload.userId) {
        setVoiceParticipants(prev =>
          prev.filter(p => !(p.id === payload.userId && (!p.serverId || p.serverId === selectedServer.id)))
        );
        closePeer(payload.userId);
        removeScreenShare(payload.userId);
      } else if (payload.action === 'screen_share' && payload.userId) {
        setVoiceParticipants(prev =>
          prev.map(p => (p.id === payload.userId ? { ...p, isScreenSharing: Boolean(payload.isScreenSharing) } : p))
        );
        if (!payload.isScreenSharing) {
          removeScreenShare(payload.userId);
        }
      }
    });

    channel.on('broadcast', { event: 'voice_speaking' }, ({ payload }) => {
      if (!payload) return;
      setVoiceParticipants(prev =>
        prev.map(p => (p.id === payload.userId ? { ...p, isSpeaking: payload.isSpeaking } : p))
      );
    });

    channel.on('broadcast', { event: 'voice_mute' }, ({ payload }) => {
      if (!payload) return;
      setVoiceParticipants(prev =>
        prev.map(p => (p.id === payload.userId ? { ...p, isMuted: payload.isMuted } : p))
      );
    });

    channel.on('broadcast', { event: 'voice_call_invite' }, ({ payload }) => {
      if (payload && (payload.targetUserId === myParticipantIdRef.current || (currentUser && payload.targetUserId === currentUser.id))) {
        playAudioChime('join');
        setIncomingVoiceInvite(payload);
        onIncomingVoiceCall?.();
      }
    });

    channel.on('broadcast', { event: 'voice_kick' }, ({ payload }) => {
      if (payload && (payload.targetUserId === myParticipantIdRef.current || (currentUser && payload.targetUserId === currentUser.id))) {
        handleLeaveVoiceCallRef.current();
        playAudioChime('leave');
      }
    });

    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        channel.send({ type: 'broadcast', event: 'voice_sync_request', payload: {} });
        channel.send({ type: 'broadcast', event: 'user_presence_sync_request', payload: {} });
        if (myPresencePayloadRef.current && myPresencePayloadRef.current.status !== 'offline') {
          channel.send({
            type: 'broadcast',
            event: 'user_presence',
            payload: myPresencePayloadRef.current,
          });
        }
        if (myVoiceParticipantRef.current) {
          channel.send({
            type: 'broadcast',
            event: 'voice_presence',
            payload: { action: 'join', participant: myVoiceParticipantRef.current },
          });
        }
      }
    });

    return () => {
      if (myPresencePayloadRef.current) {
        channel.send({
          type: 'broadcast',
          event: 'user_presence',
          payload: { ...myPresencePayloadRef.current, status: 'offline' },
        });
      }
      channel.unsubscribe();
      activeChannelRef.current = null;
    };
  }, [selectedServer.id, currentUser?.id]);

  // ──────── THAM GIA / RỜI CUỘC GỌI VOICE CALL ────────
  const handleJoinVoiceCall = async (targetChannelId?: string, explicitTargetChannel?: CommunityChannel) => {
    const myId = myParticipantIdRef.current;
    const channelIdToConnect = targetChannelId || selectedChannel.id;
    const targetServerId = explicitTargetChannel
      ? (servers.find(s => s.channels.some(c => c.id === explicitTargetChannel.id))?.id || selectedServer.id)
      : selectedServer.id;

    // Không dừng nhạc cá nhân (tracktable) của người dùng khi tham gia voice phòng
    voiceServerIdRef.current = targetServerId;
    outboundStreamRef.current = null;

    // Dọn dẹp session cũ nếu đang kết nối ở kênh khác
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    micGainRef.current = null;

    const myParticipant: VoiceParticipant = {
      id: myId,
      name: myServerDisplayName,
      username: currentUser?.username || 'operative',
      avatar: currentUser?.avatar || null,
      isMuted: false,
      isDeafened: false,
      isSpeaking: false,
      isHost: false,
      isBot: false,
      isStreaming: false,
      listening: null,
      listeningTrack: null,
      serverId: selectedServer.id,
      channelId: channelIdToConnect,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression,
          echoCancellation,
        },
      });
      micStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      const micGain = audioCtx.createGain();
      micGain.gain.setValueAtTime(micVolume / 100, audioCtx.currentTime);
      source.connect(micGain);
      micGain.connect(analyser);

      // Luồng mic đã qua gain -> gửi tới các peer WebRTC (giọng nói thật real-time)
      const outboundDest = audioCtx.createMediaStreamDestination();
      micGain.connect(outboundDest);
      outboundStreamRef.current = outboundDest.stream;

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      micGainRef.current = micGain;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let wasSpeaking = false;

      const checkAudioActivity = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const nowSpeaking = !isMuted && avg > micSensitivity;

        if (nowSpeaking !== wasSpeaking) {
          wasSpeaking = nowSpeaking;
          setIsUserSpeaking(nowSpeaking);

          // Phát sóng trạng thái nói Realtime qua Supabase!
          rtcSendRef.current?.('voice_speaking', { userId: myId, isSpeaking: nowSpeaking });
          if (activeChannelRef.current) {
            activeChannelRef.current.send({
              type: 'broadcast',
              event: 'voice_speaking',
              payload: { userId: myId, isSpeaking: nowSpeaking },
            });
          }
        }

        animFrameRef.current = requestAnimationFrame(checkAudioActivity);
      };
      checkAudioActivity();

      setConnectedVoiceChannel(channelIdToConnect);
      setConnectedVoiceServerId(targetServerId);
      playAudioChime('join');

      // Phát sóng trạng thái tham gia cuộc gọi qua Supabase!
      myVoiceParticipantRef.current = myParticipant;
      rtcSendRef.current?.('voice_presence', { action: 'join', participant: myParticipant });
      if (activeChannelRef.current) {
        activeChannelRef.current.send({
          type: 'broadcast',
          event: 'voice_presence',
          payload: { action: 'join', participant: myParticipant },
        });
      }
    } catch {
      setConnectedVoiceChannel(channelIdToConnect);
      setConnectedVoiceServerId(targetServerId);
      setIsMuted(true);
      playAudioChime('join');

      myVoiceParticipantRef.current = { ...myParticipant, isMuted: true };
      rtcSendRef.current?.('voice_presence', { action: 'join', participant: { ...myParticipant, isMuted: true } });
      if (activeChannelRef.current) {
        activeChannelRef.current.send({
          type: 'broadcast',
          event: 'voice_presence',
          payload: { action: 'join', participant: { ...myParticipant, isMuted: true } },
        });
      }
    }
  };

  const handleStartScreenShare = async () => {
    if (!connectedVoiceChannel) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      screenStreamRef.current = stream;
      const myId = myParticipantIdRef.current;
      setIsScreenSharing(true);
      if (myVoiceParticipantRef.current) {
        myVoiceParticipantRef.current = { ...myVoiceParticipantRef.current, isScreenSharing: true };
      }
      upsertScreenShare(
        {
          userId: myId,
          userName: myServerDisplayName,
          avatar: currentUser?.avatar || null,
          stream,
        },
        true
      );

      // Gán stream trực tiếp cho video preview của người chia sẻ
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        screenVideoRef.current.play().catch(() => {});
      }

      const videoTrack = stream.getVideoTracks()[0];
      peersRef.current.forEach(async (pc, peerId) => {
        try {
          const existingVideoSender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (existingVideoSender) {
            await existingVideoSender.replaceTrack(videoTrack);
          } else {
            pc.addTrack(videoTrack, stream);
          }
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          rtcSendRef.current?.('rtc_offer', { from: myId, to: peerId, sdp: pc.localDescription });
        } catch (e) {
          console.warn('Cannot add screen video track to peer:', e);
        }
      });

      videoTrack.onended = () => {
        handleStopScreenShare();
      };

      rtcSendRef.current?.('voice_presence', { action: 'screen_share', userId: myId, isScreenSharing: true });
      if (activeChannelRef.current) {
        activeChannelRef.current.send({
          type: 'broadcast',
          event: 'voice_presence',
          payload: { action: 'screen_share', userId: myId, isScreenSharing: true },
        });
      }
    } catch (err) {
      console.warn('Screen share canceled or failed:', err);
    }
  };

  const handleStopScreenShare = () => {
    const myId = myParticipantIdRef.current;
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);
    if (myVoiceParticipantRef.current) {
      myVoiceParticipantRef.current = { ...myVoiceParticipantRef.current, isScreenSharing: false };
    }
    removeScreenShare(myId);

    peersRef.current.forEach(async (pc, peerId) => {
      try {
        const senders = pc.getSenders();
        senders.forEach(s => {
          if (s.track?.kind === 'video') pc.removeTrack(s);
        });
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        rtcSendRef.current?.('rtc_offer', { from: myId, to: peerId, sdp: pc.localDescription });
      } catch (e) {
        console.warn('Cannot remove screen video track from peer:', e);
      }
    });

    rtcSendRef.current?.('voice_presence', { action: 'screen_share', userId: myId, isScreenSharing: false });
    rtcSendRef.current?.('rtc_screen_stopped', { userId: myId });
    if (activeChannelRef.current) {
      try {
        activeChannelRef.current.send({
          type: 'broadcast',
          event: 'voice_presence',
          payload: { action: 'screen_share', userId: myId, isScreenSharing: false },
        });
      } catch {}
    }
  };

  const handleLeaveVoiceCall = () => {
    const wasInCall = Boolean(connectedVoiceChannel || connectedVoiceChannelRef.current || myVoiceParticipantRef.current);
    // Nếu đang đổ chuông cuộc gọi riêng 1-1 mà người gọi tắt máy trước khi đối phương bắt máy -> gửi tín hiệu hủy chuông
    if (
      (voiceServerIdRef.current === 'dm_private' || connectedVoiceServerIdRef.current === 'dm_private') &&
      peersRef.current.size === 0 &&
      activeDmFriend &&
      currentUser &&
      connectedVoiceChannelRef.current
    ) {
      globalSocialChannelRef.current?.send({
        type: 'broadcast',
        event: 'voice_call_cancel',
        payload: {
          fromUserId: currentUser.id,
          fromUserName: currentUser.display_name || currentUser.username || 'Người dùng',
          targetUserId: activeDmFriend.id,
          channelId: connectedVoiceChannelRef.current,
        },
      });
    }
    handleStopScreenShare();
    clearAllScreenShares();
    const myId = myParticipantIdRef.current;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    micGainRef.current = null;
    outboundStreamRef.current = null;
    myVoiceParticipantRef.current = null;
    voiceServerIdRef.current = '';

    // Giữ phát nhạc nền 24/7 liên tục khi chuyển phòng hoặc rời voice call

    rtcSendRef.current?.('voice_presence', { action: 'leave', userId: myId });
    rtcSendRef.current?.('rtc_bye', { from: myId });
    if (activeChannelRef.current) {
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'voice_presence',
        payload: { action: 'leave', userId: myId },
      });
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'user_presence',
        payload: {
          ...(myPresencePayloadRef.current || {}),
          id: currentUser?.id || myId,
          username: currentUser?.username || myPresencePayloadRef.current?.username || 'operative',
          display_name: myServerDisplayName,
          status: 'offline',
          listening: null,
          listeningTrack: null,
        },
      });
    }

    setConnectedVoiceChannel(null);
    setConnectedVoiceServerId(null);
    setDmCallConnected(false);
    setDmCallCountdown(30);
    setIsUserSpeaking(false);
    if (wasInCall) {
      playAudioChime('leave');
    }
  };
  handleLeaveVoiceCallRef.current = handleLeaveVoiceCall;

  const broadcastUserOffline = () => {
    const myId = currentUser?.id || myParticipantIdRef.current;
    if (activeChannelRef.current) {
      try {
        activeChannelRef.current.send({
          type: 'broadcast',
          event: 'user_presence',
          payload: {
            ...(myPresencePayloadRef.current || {}),
            id: myId,
            username: currentUser?.username || myPresencePayloadRef.current?.username || 'operative',
            display_name: myServerDisplayName,
            avatar: currentUser?.avatar || null,
            status: 'offline',
            listening: null,
            listeningTrack: null,
          },
        });
      } catch {}
    }
  };

  const broadcastUserOnline = () => {
    if (myStatus === 'invisible') return;
    const myId = currentUser?.id || myParticipantIdRef.current;
    if (activeChannelRef.current) {
      try {
        activeChannelRef.current.send({
          type: 'broadcast',
          event: 'user_presence',
          payload: {
            ...(myPresencePayloadRef.current || {}),
            id: myId,
            username: currentUser?.username || myPresencePayloadRef.current?.username || 'operative',
            display_name: myServerDisplayName,
            avatar: currentUser?.avatar || null,
            status: myStatus,
            listening: myVisibleListening,
            listeningTrack: myVisibleTrack,
          },
        });
      } catch {}
    }
  };
  broadcastUserOfflineRef.current = broadcastUserOffline;
  broadcastUserOnlineRef.current = broadcastUserOnline;

  const handleToggleMute = () => {
    const myId = myParticipantIdRef.current;
    setIsMuted(prev => {
      const next = !prev;
      if (micStreamRef.current) {
        micStreamRef.current.getAudioTracks().forEach(t => {
          t.enabled = !next;
        });
      }
      rtcSendRef.current?.('voice_mute', { userId: myId, isMuted: next });
      if (activeChannelRef.current) {
        activeChannelRef.current.send({
          type: 'broadcast',
          event: 'voice_mute',
          payload: { userId: myId, isMuted: next },
        });
      }
      return next;
    });
  };

  const handleToggleDeafen = () => {
    setIsDeafened(prev => !prev);
  };

  // ──────── AUDIO CONTROL HELPERS (VOLUME, CHIME, MIC TEST) ────────
  const handleMicVolumeChange = (newVol: number) => {
    setMicVolume(newVol);
    localStorage.setItem('spytify_mic_volume', String(newVol));
    if (micGainRef.current && audioContextRef.current) {
      try {
        micGainRef.current.gain.setValueAtTime(newVol / 100, audioContextRef.current.currentTime);
      } catch {}
    }
  };

  const handleSpeakerVolumeChange = (newVol: number) => {
    setSpeakerVolume(newVol);
    localStorage.setItem('spytify_speaker_volume', String(newVol));
  };

  const playSpeakerTestSound = (vol?: number) => {
    try {
      const effectiveVol = vol !== undefined ? vol : (isDeafened ? 0 : speakerVolume);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      const volumeLevel = Math.max(0, Math.min(2, effectiveVol / 100)) * 0.25;
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
    } catch (e) {
      console.error('Test audio error:', e);
    }
  };

  const startMicTest = async () => {
    try {
      setIsTestingMic(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression,
          echoCancellation,
        },
      });
      testStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(micVolume / 100, audioCtx.currentTime);
      source.connect(gain);
      gain.connect(analyser);

      testCtxRef.current = audioCtx;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const loop = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100 * (micVolume / 100)));
        setTestMicLevel(normalized);
        testAnimRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (err) {
      console.warn('Cannot test microphone:', err);
      setIsTestingMic(false);
    }
  };

  const stopMicTest = () => {
    setIsTestingMic(false);
    setTestMicLevel(0);
    if (testAnimRef.current) cancelAnimationFrame(testAnimRef.current);
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach(t => t.stop());
      testStreamRef.current = null;
    }
    if (testCtxRef.current) {
      testCtxRef.current.close().catch(() => {});
      testCtxRef.current = null;
    }
  };

  // ──────── TỰ TẠO SERVER MỚI (CUSTOM SERVER CREATION) ────────
  const handleSelectPreset = (presetKey: string) => {
    const p = SERVER_PRESETS.find(x => x.key === presetKey);
    if (!p) return;
    setNewServerPreset(presetKey);
    setNewServerName(p.label);
    setNewServerDesc(p.desc);
    setNewServerIcon(p.icon);
    setNewServerColor(p.color);
  };

  const handleCreateServer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServerName.trim()) return;

    const p = SERVER_PRESETS.find(x => x.key === newServerPreset) || SERVER_PRESETS[0];
    const srvId = `srv_custom_${Date.now()}`;

    const newChannels: CommunityChannel[] = p.defaultChannels.map((c, idx) => ({
      id: `ch_${srvId}_${idx}`,
      name: c.name,
      type: c.type,
      topic: `${c.name} - Trạm ${newServerName}`,
    }));

    const createdServer: CommunityServer = {
      id: srvId,
      name: newServerName.trim(),
      description: newServerDesc.trim() || 'Trạm sóng âm nhạc cá nhân Spytify',
      icon: newServerIcon || '🎧',
      badge: 'OWNER',
      accent_color: newServerColor,
      channels: newChannels,
      is_verified: true,
      owner_id: currentUser?.id || 'usr_me',
      is_custom: true,
      max_members: 50,
      member_ids: currentUser?.id ? ['usr_me', currentUser.id] : ['usr_me'],
      moderator_ids: [],
    };

    const updated = [...servers, createdServer];
    setServers(updated);
    persistServers(updated);
    pushCloudServer(createdServer).catch(() => {});

    setIsCreateModalOpen(false);
    setIsFriendsTabActive(false);
    setCreatingChannelState(null);
    setNewChannelName('');
    setSelectedServer(createdServer);
    setSelectedChannel(createdServer.channels[0]);
  };

  // Send message
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputText.trim();
    if (!clean && !attachCurrentTrack && !pendingChatImage) return;

    const createdAtStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMsg: CommunityMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      server_id: selectedServer.id,
      channel_id: selectedChannel.id,
      user_id: currentUser?.id || 'guest',
      username: currentUser?.username || 'operative',
      display_name: myServerDisplayName,
      avatar: currentUser?.avatar || null,
      content: clean,
      track_embed: attachCurrentTrack ? currentTrack : null,
      image_url: pendingChatImage || null,
      created_at: createdAtStr,
    };

    appendServerMessage(newMsg);
    setInputText('');
    setAttachCurrentTrack(false);
    setPendingChatImage(null);

    if (activeChannelRef.current) {
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'new_message',
        payload: newMsg,
      });
    }

    globalSocialChannelRef.current?.send({
      type: 'broadcast',
      event: 'server_message_notify',
      payload: {
        serverId: selectedServer.id,
        channelId: selectedChannel.id,
        senderId: currentUser?.id || 'guest',
        message: newMsg,
      },
    });

    if (currentUser?.id && selectedServer.id !== 'srv_none') {
      pushCloudDirectMessage({
        id: newMsg.id,
        room_id: `spytify_srv_chat_${selectedServer.id}`,
        sender_id: currentUser.id,
        receiver_id: selectedChannel.id,
        sender_username: newMsg.username,
        sender_display_name: newMsg.display_name,
        sender_avatar: newMsg.avatar,
        content: newMsg.content,
        track_embed: newMsg.track_embed,
        image_url: newMsg.image_url || null,
        created_at: createdAtStr,
        sent_at: new Date().toISOString(),
      }).catch(() => {});
    }

    // Kiểm tra và xử lý lệnh điều khiển bot phát nhạc theo yêu cầu (@Rythm /p, /st, /sk, /q)
    processBotMusicCommand(clean, {
      id: currentUser?.id || 'guest',
      name: myServerDisplayName,
      username: currentUser?.username || 'operative',
    });
  };

  const handleSelectChatImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressChatImageFile(file);
      setPendingChatImage(dataUrl);
    } catch (err) {
      console.warn('Failed to compress image:', err);
    }
    if (e.target) e.target.value = '';
  };

  const handleSelectDmImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressChatImageFile(file);
      setPendingDmImage(dataUrl);
    } catch (err) {
      console.warn('Failed to compress image:', err);
    }
    if (e.target) e.target.value = '';
  };
  const currentDmRoomId =
    currentUser && activeDmFriend ? getDmRoomId(currentUser.id, activeDmFriend.id) : null;
  const currentDmVoiceChannelId = currentDmRoomId ? `dm_voice_${currentDmRoomId}` : null;
  const isConnectedToCurrentDmVoice = Boolean(
    currentDmVoiceChannelId &&
      connectedVoiceServerId === 'dm_private' &&
      connectedVoiceChannel === currentDmVoiceChannelId
  );

  useEffect(() => {
    if (!currentUser || !activeDmFriend || !currentDmRoomId) {
      setDmMessages([]);
      return;
    }

    const storageKey = `spytify_dm_messages_${currentDmRoomId}`;
    let localLoaded: CommunityMessage[] = [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          localLoaded = parsed.slice(-MAX_CHAT_MESSAGES_LIMIT);
        }
      }
    } catch {}
    setDmMessages(localLoaded);
    markDmAsRead(activeDmFriend.id, localLoaded);

    // Tải đồng bộ tối đa 80 tin nhắn gần nhất từ Supabase Cloud (nếu có bảng spytify_direct_messages)
    fetchCloudDirectMessages(currentDmRoomId).then(cloudRows => {
      if (cloudRows && cloudRows.length > 0) {
        setDmMessages(prev => {
          const map = new Map<string, CommunityMessage>();
          prev.forEach(m => map.set(m.id, m));
          cloudRows.forEach(r => {
            map.set(r.id, {
              id: r.id,
              server_id: 'dm_private',
              channel_id: r.room_id,
              user_id: r.sender_id,
              username: r.sender_username || 'operative',
              display_name: r.sender_display_name || r.sender_username || 'Operative',
              avatar: r.sender_avatar || null,
              content: r.content,
              track_embed: r.track_embed || null,
              image_url: r.image_url || null,
              created_at: r.created_at || '',
            });
          });
          const merged = Array.from(map.values()).slice(-MAX_CHAT_MESSAGES_LIMIT);
          try {
            localStorage.setItem(storageKey, JSON.stringify(merged));
          } catch {}
          markDmAsRead(activeDmFriend.id, merged);
          return merged;
        });
      }
    });

    const client = getSupabaseClient();
    if (!client) return;

    const dmChannel = client.channel(`spytify_dm_${currentDmRoomId}`, {
      config: { broadcast: { ack: false } },
    });
    activeDmChannelRef.current = dmChannel;

    dmChannel.on('broadcast', { event: 'new_dm_message' }, ({ payload }) => {
      if (payload && payload.id) {
        seenMessageIdsRef.current.add(payload.id);
        persistSeenMessageIds();
        setDmMessages(prev => {
          if (prev.some(m => m.id === payload.id)) return prev;
          const next = [...prev, payload].slice(-MAX_CHAT_MESSAGES_LIMIT);
          try {
            localStorage.setItem(storageKey, JSON.stringify(next));
          } catch {}
          return next;
        });
      }
    });

    dmChannel.subscribe();

    return () => {
      dmChannel.unsubscribe();
      activeDmChannelRef.current = null;
    };
  }, [currentUser?.id, activeDmFriend?.id, currentDmRoomId]);

  useEffect(() => {
    dmMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dmMessages]);

  const handleOpenDirectMessage = (friend: CommunityUserProfile) => {
    setIsFriendsTabActive(true);
    setActiveDmFriend(friend);
    markDmAsRead(friend.id);
  };

  const handleStartPrivateCall = async (
    friend: CommunityUserProfile,
    options?: { isAnswering?: boolean }
  ) => {
    if (!currentUser) return;
    setIsFriendsTabActive(true);
    setActiveDmFriend(friend);

    const roomId = getDmRoomId(currentUser.id, friend.id);
    const dmVoiceChId = `dm_voice_${roomId}`;

    // Nếu đang ở trong chính cuộc gọi riêng này
    if (connectedVoiceServerIdRef.current === 'dm_private' && connectedVoiceChannelRef.current === dmVoiceChId) {
      if (options?.isAnswering) {
        setDmCallConnected(true);
        globalSocialChannelRef.current?.send({
          type: 'broadcast',
          event: 'voice_call_accepted',
          payload: {
            isDmCall: true,
            fromUserId: friend.id,
            acceptedByUserId: currentUser.id,
            channelId: dmVoiceChId,
          },
        });
      }
      return;
    }

    // Nếu đang ở phòng voice khác -> gửi rời phòng cũ sạch sẽ trước khi vào DM call
    if (connectedVoiceChannelRef.current && connectedVoiceChannelRef.current !== dmVoiceChId) {
      const oldId = myParticipantIdRef.current;
      rtcSendRef.current?.('voice_presence', { action: 'leave', userId: oldId });
      rtcSendRef.current?.('rtc_bye', { from: oldId });
      activeChannelRef.current?.send({
        type: 'broadcast',
        event: 'voice_presence',
        payload: { action: 'leave', userId: oldId },
      });
    }

    // Dọn dẹp thiết bị mic cũ nếu có
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    micGainRef.current = null;
    outboundStreamRef.current = null;
    voiceServerIdRef.current = 'dm_private';

    const myId = myParticipantIdRef.current;
    const dmParticipant: VoiceParticipant = {
      id: myId,
      name: currentUser.display_name || currentUser.username || 'Operative',
      username: currentUser.username || 'operative',
      avatar: currentUser.avatar || null,
      isMuted: false,
      isDeafened: false,
      isSpeaking: false,
      isHost: false,
      isBot: false,
      isStreaming: false,
      listening: null,
      listeningTrack: null,
      serverId: 'dm_private',
      channelId: dmVoiceChId,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { noiseSuppression, echoCancellation },
      });
      micStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      const micGain = audioCtx.createGain();
      micGain.gain.setValueAtTime(micVolume / 100, audioCtx.currentTime);
      source.connect(micGain);
      micGain.connect(analyser);

      const outboundDest = audioCtx.createMediaStreamDestination();
      micGain.connect(outboundDest);
      outboundStreamRef.current = outboundDest.stream;

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      micGainRef.current = micGain;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let wasSpeaking = false;
      const checkAudio = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        const nowSpeaking = !isMuted && avg > micSensitivity;
        if (nowSpeaking !== wasSpeaking) {
          wasSpeaking = nowSpeaking;
          setIsUserSpeaking(nowSpeaking);
        }
        animFrameRef.current = requestAnimationFrame(checkAudio);
      };
      checkAudio();
      myVoiceParticipantRef.current = dmParticipant;
    } catch {
      setIsMuted(true);
      myVoiceParticipantRef.current = { ...dmParticipant, isMuted: true };
    }

    setDmCallCountdown(30);
    setDmCallConnected(Boolean(options?.isAnswering));
    setConnectedVoiceServerId('dm_private');
    setConnectedVoiceChannel(dmVoiceChId);
    playAudioChime('join');

    // Phát tín hiệu cuộc gọi đến / xác nhận bắt máy qua kênh Realtime toàn cục cho bạn bè (trừ AI Bot)
    if (!ACTIVE_BOT_IDS.has(friend.id)) {
      if (options?.isAnswering) {
        globalSocialChannelRef.current?.send({
          type: 'broadcast',
          event: 'voice_call_accepted',
          payload: {
            isDmCall: true,
            fromUserId: friend.id,
            acceptedByUserId: currentUser.id,
            channelId: dmVoiceChId,
          },
        });
      } else {
        const callInvitePayload = {
          callId: `dm_call_${roomId}_${Date.now()}`,
          isDmCall: true,
          roomId,
          fromUserId: currentUser.id,
          fromUserName: currentUser.display_name || currentUser.username || 'Người dùng',
          fromUserAvatar: currentUser.avatar || null,
          targetUserId: friend.id,
          targetUserName: friend.display_name || friend.username || 'Bạn bè',
          serverId: 'dm_private',
          serverName: 'Cuộc gọi riêng 1-1',
          channelId: dmVoiceChId,
          channelName: 'Cuộc gọi thoại riêng',
          timestamp: Date.now(),
        };
        globalSocialChannelRef.current?.send({
          type: 'broadcast',
          event: 'voice_call_invite',
          payload: callInvitePayload,
        });
      }
    }
  };
  startPrivateCallRef.current = handleStartPrivateCall;

  const handleSendDmMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser || !activeDmFriend || !currentDmRoomId) return;
    const clean = dmInputText.trim();
    if (!clean && !dmAttachTrack && !pendingDmImage) return;

    const createdAtStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMsg: CommunityMessage = {
      id: 'dm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      server_id: 'dm_private',
      channel_id: currentDmRoomId,
      user_id: currentUser.id,
      username: currentUser.username || 'operative',
      display_name: currentUser.display_name || currentUser.username || 'Operative',
      avatar: currentUser.avatar || null,
      content: clean,
      track_embed: dmAttachTrack ? currentTrack : null,
      image_url: pendingDmImage || null,
      created_at: createdAtStr,
    };

    const storageKey = `spytify_dm_messages_${currentDmRoomId}`;
    setDmMessages(prev => {
      const next = [...prev.slice(-(MAX_CHAT_MESSAGES_LIMIT - 1)), newMsg];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });

    setDmInputText('');
    setDmAttachTrack(false);
    setPendingDmImage(null);

    if (activeDmChannelRef.current) {
      activeDmChannelRef.current.send({
        type: 'broadcast',
        event: 'new_dm_message',
        payload: newMsg,
      });
    }

    globalSocialChannelRef.current?.send({
      type: 'broadcast',
      event: 'dm_message_notify',
      payload: {
        roomId: currentDmRoomId,
        senderId: currentUser.id,
        receiverId: activeDmFriend.id,
        message: newMsg,
      },
    });

    // Lưu lên Supabase Cloud & tự động xóa tin nhắn cũ vượt quá 80 tin nhắn gần nhất
    pushCloudDirectMessage({
      id: newMsg.id,
      room_id: currentDmRoomId,
      sender_id: currentUser.id,
      receiver_id: activeDmFriend.id,
      sender_username: newMsg.username,
      sender_display_name: newMsg.display_name,
      sender_avatar: newMsg.avatar,
      content: newMsg.content,
      track_embed: newMsg.track_embed,
      image_url: newMsg.image_url,
      created_at: createdAtStr,
      sent_at: new Date().toISOString(),
    });
  };

  // Broadcast current track as Stage Host
  const handleBroadcastMyTrackAsHost = () => {
    if (!currentTrack) return;
    const newSession: StageSession = {
      server_id: selectedServer.id,
      channel_id: selectedChannel.id,
      host_user_id: currentUser?.id || 'guest',
      host_name: currentUser?.display_name || 'DJ Host',
      current_track: currentTrack,
      position_secs: 0,
      is_playing: true,
      listener_count: stageSession.listener_count + 1,
      updated_at: Date.now(),
    };
    setStageSession(newSession);

    if (activeChannelRef.current) {
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'stage_sync',
        payload: newSession,
      });
    }
  };

  const isStage = selectedChannel.type === 'stage';
  const isVoice = selectedChannel.type === 'voice';
  const isConnectedToCurrentVoice =
    connectedVoiceServerId === selectedServer.id && connectedVoiceChannel === selectedChannel.id;

  // ──────── YÊU CẦU ĐĂNG NHẬP ĐỂ SỬ DỤNG SPY JAM ────────
  if (!currentUser) {
    return (
      <div
        className={`flex-1 flex flex-col items-center justify-center h-full select-none overflow-hidden font-sans p-6 relative ${
          isLight ? 'bg-[#f8fafc] text-[#0f172a]' : 'bg-[#07070a] text-white'
        }`}
      >
        {/* Ambient glow */}
        <div
          className="absolute w-96 h-96 rounded-full blur-[130px] opacity-15 pointer-events-none"
          style={{ backgroundColor: accentColor }}
        />

        <div
          className={`relative z-10 w-full max-w-md rounded-2xl border p-7 flex flex-col items-center text-center shadow-2xl ${
            isLight
              ? 'bg-white border-[#e2e8f0]'
              : 'bg-[#0c0c14]/95 border-[#1e1e2d] shadow-black/80'
          }`}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border relative"
            style={{
              backgroundColor: `${accentColor}15`,
              borderColor: `${accentColor}40`,
              boxShadow: `0 0 24px ${accentColor}25`,
            }}
          >
            <SpyJamIcon className="w-8 h-8" style={{ color: accentColor }} />
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center absolute -bottom-1 -right-1 border-2 border-[#0c0c14]"
              style={{
                backgroundColor: accentColor,
                color: getContrastTextColor(accentColor),
              }}
            >
              <Lock className="w-3 h-3" />
            </div>
          </div>

          <span
            className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-full border font-bold mb-3"
            style={{
              color: accentColor,
              backgroundColor: `${accentColor}12`,
              borderColor: `${accentColor}30`,
            }}
          >
            SPY JAM • TRẠM SÓNG CỘNG ĐỒNG
          </span>

          <h2 className={`text-lg font-bold tracking-tight ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>
            Yêu Cầu Đăng Nhập Để Sử Dụng Spy Jam
          </h2>
          <p className="text-xs text-[#8e8e9f] mt-2 leading-relaxed">
            Vui lòng đăng nhập tài khoản Spytify của bạn để tự tạo máy chủ (Server), tham gia phòng thoại Voice thời gian thực, kết bạn và trò chuyện cùng cộng đồng.
          </p>

          <div
            className={`w-full mt-5 p-3.5 rounded-xl border text-left space-y-2.5 ${
              isLight ? 'bg-[#f8fafc] border-[#e2e8f0]' : 'bg-[#08080e] border-[#181824]'
            }`}
          >
            <div className="flex items-center gap-2.5 text-xs">
              <Crown className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
              <span className={isLight ? 'text-[#334155]' : 'text-[#c4c4d4]'}>
                Tạo Server riêng, phân quyền <strong>Mod</strong> và quản lý thành viên
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-xs">
              <Headphones className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
              <span className={isLight ? 'text-[#334155]' : 'text-[#c4c4d4]'}>
                Đàm thoại <strong>Voice Call Real-time</strong> & chia sẻ bài hát đang nghe
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-xs">
              <Users className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
              <span className={isLight ? 'text-[#334155]' : 'text-[#c4c4d4]'}>
                Lưu trữ độc lập trạng thái máy chủ và danh sách bạn bè theo tài khoản
              </span>
            </div>
          </div>

          <button
            onClick={() => onOpenAuth?.()}
            className="w-full mt-6 py-3 px-5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all hover:opacity-95 active:scale-[0.98]"
            style={{
              backgroundColor: accentColor,
              color: getContrastTextColor(accentColor),
              boxShadow: `0 0 20px ${accentColor}40`,
            }}
          >
            <LogIn className="w-4 h-4" />
            <span>Đăng Nhập / Đăng Ký Ngay</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 flex h-full select-none overflow-hidden font-sans ${isLight ? 'bg-[#f8fafc] text-[#0f172a]' : 'bg-[#07070a] text-white'}`}>
      {/* ──────────────── 1. DISCORD-STYLE SERVER RAIL (FAR LEFT) ──────────────── */}
      <div className={`w-16 flex flex-col items-center py-3 gap-2 flex-shrink-0 z-20 border-r ${isLight ? 'bg-[#f1f5f9] border-[#e2e8f0]' : 'bg-[#040407] border-[#14141c]'}`}>
        {/* Top: Discord Direct Messages / Friends Button */}
        {(() => {
          const totalUnreadDms = Object.values(unreadDmCounts).reduce((acc, c) => acc + (c || 0), 0);
          const totalFriendsBadge =
            incomingFriendRequests.length + incomingServerInvites.length + totalUnreadDms;
          return (
            <button
              onClick={() => setIsFriendsTabActive(true)}
              className={`w-11 h-11 flex items-center justify-center cursor-pointer transition-all shadow-md group relative ${
                isFriendsTabActive
                  ? 'rounded-xl border'
                  : isLight
                  ? 'rounded-2xl hover:rounded-xl bg-[#ffffff] border border-[#cbd5e1] text-[#334155] hover:text-[#0f172a]'
                  : 'rounded-2xl hover:rounded-xl bg-[#0e0e16] border border-[#222230] text-white hover:border-white/40'
              }`}
              style={{
                backgroundColor: isFriendsTabActive ? `${accentColor}25` : undefined,
                borderColor: isFriendsTabActive ? accentColor : undefined,
                color: isFriendsTabActive ? accentColor : undefined,
              }}
              title="Spy Jam - Bạn bè & Tin nhắn trực tiếp (Friends & DMs)"
            >
              <SpyJamIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
              {totalFriendsBadge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-mono font-black flex items-center justify-center border-2 border-[#040407] shadow-md animate-bounce">
                  {totalFriendsBadge > 99 ? '99+' : totalFriendsBadge}
                </span>
              )}
              <span 
                className={`absolute -left-1 w-1 rounded-r-full transition-all duration-200 ${
                  isFriendsTabActive ? 'h-8 opacity-100' : 'h-2 opacity-0 group-hover:opacity-100'
                }`} 
                style={{ backgroundColor: accentColor }}
              />
            </button>
          );
        })()}

        <div className={`w-8 h-[1px] my-0.5 ${isLight ? 'bg-[#e2e8f0]' : 'bg-[#1a1a24]'}`} />

        {/* Server Icons List (Kéo thả để sắp xếp vị trí Server) */}
        <div className="flex-1 w-full flex flex-col items-center gap-2 overflow-y-auto no-scrollbar py-1">
          {servers.map(srv => {
            const isSelected = !isFriendsTabActive && selectedServer.id === srv.id;
            const srvUnreadCount = srv.channels.reduce(
              (acc, ch) => acc + (unreadChannelCounts[ch.id] || 0),
              0
            );
            const isDraggingThis = draggedServerId === srv.id;
            const isDropTarget = dragOverServerId === srv.id && draggedServerId !== srv.id;
            return (
              <div
                key={srv.id}
                data-server-rail-id={srv.id}
                className={`relative group flex items-center justify-center w-full select-none transition-transform duration-150 ${
                  isDraggingThis ? 'opacity-45 scale-90 cursor-grabbing' : ''
                }`}
              >
                {isDropTarget && dragDropPosition === 'above' && (
                  <div
                    className="absolute -top-1.5 left-3 right-3 h-0.5 rounded-full z-20 shadow-sm pointer-events-none"
                    style={{ backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}` }}
                  />
                )}
                {isDropTarget && dragDropPosition === 'below' && (
                  <div
                    className="absolute -bottom-1.5 left-3 right-3 h-0.5 rounded-full z-20 shadow-sm pointer-events-none"
                    style={{ backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}` }}
                  />
                )}
                <span 
                  className={`absolute left-0 w-1 rounded-r-full transition-all duration-200 ${
                    isSelected ? 'h-8' : srvUnreadCount > 0 ? 'h-3 bg-red-500 opacity-100' : 'h-2 bg-zinc-600 opacity-0 group-hover:opacity-100'
                  }`}
                  style={{ backgroundColor: isSelected ? accentColor : undefined }}
                />
                
                <button
                  type="button"
                  onPointerDown={e => {
                    if (e.button !== 0 || servers.length <= 1) return;
                    serverRailDragRef.current = {
                      serverId: srv.id,
                      startX: e.clientX,
                      startY: e.clientY,
                      moved: false,
                      overId: null,
                      position: null,
                    };
                  }}
                  onClick={() => {
                    if (suppressServerClickIdRef.current === srv.id) return;
                    setIsFriendsTabActive(false);
                    handleSelectServer(srv);
                  }}
                  className={`w-11 h-11 flex items-center justify-center text-base font-bold transition-all duration-200 shadow-md relative ${
                    isDraggingThis ? 'cursor-grabbing' : 'cursor-pointer'
                  } ${
                    isSelected 
                      ? 'rounded-xl border' 
                      : isLight 
                      ? 'rounded-3xl hover:rounded-xl bg-[#ffffff] border border-[#cbd5e1] text-[#334155] hover:text-[#0f172a]'
                      : 'rounded-3xl hover:rounded-xl bg-[#0e0e14] border border-[#1e1e28] hover:border-white/30 text-zinc-300 hover:text-white'
                  } ${isDropTarget ? 'ring-2 ring-cyan-400/70' : ''}`}
                  style={{
                    backgroundColor: isSelected ? `${accentColor}25` : undefined,
                    borderColor: isSelected ? accentColor : undefined,
                    color: isSelected ? accentColor : undefined,
                  }}
                  title={`${srv.name} (Giữ & kéo để đổi vị trí)`}
                >
                  <div className="w-full h-full rounded-[inherit] overflow-hidden flex items-center justify-center pointer-events-none">
                    {renderServerIconContent(srv.icon, srv.name, isSelected ? accentColor : srv.accent_color, 'w-5 h-5')}
                  </div>
                  {srvUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-mono font-black flex items-center justify-center border-2 border-[#040407] shadow-md pointer-events-none">
                      {srvUnreadCount > 99 ? '99+' : srvUnreadCount}
                    </span>
                  )}
                  {connectedVoiceServerId === srv.id && connectedVoiceChannel && (
                    <span
                      className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-black flex items-center justify-center border-2 border-[#040407] shadow-md shadow-emerald-500/50 animate-pulse pointer-events-none"
                      title="Đang trong phòng thoại tại máy chủ này"
                    >
                      <Volume2 className="w-2.5 h-2.5 stroke-[2.5]" />
                    </span>
                  )}
                </button>
              </div>
            );
          })}

          {/* NÚT "+" ĐỂ MỞ BẢNG TỰ TẠO SERVER */}
          <button
            onClick={() => {
              setCreateServerStep(1);
              setIsCreateModalOpen(true);
            }}
            className={`w-11 h-11 rounded-3xl hover:rounded-xl border flex items-center justify-center transition-all cursor-pointer mt-1 group ${
              isLight 
                ? 'bg-[#ffffff] border-[#cbd5e1] text-[#64748b] hover:text-[#0f172a] hover:border-emerald-500'
                : 'bg-[#0e0e14] hover:bg-emerald-950/40 border-[#20202a] hover:border-emerald-500/50 text-[#666] hover:text-emerald-400'
            }`}
            title={getTranslation(language, 'community.createServer')}
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          </button>
        </div>
      </div>

      {/* ──────────────── 2. CHANNELS LIST OR FRIENDS NAVIGATION COLUMN ──────────────── */}
      <div className={`w-56 flex flex-col flex-shrink-0 z-10 border-r ${isLight ? 'bg-[#f8fafc] border-[#e2e8f0]' : 'bg-[#09090e] border-[#15151e]'}`}>
        {isFriendsTabActive ? (
          <>
            {/* Friends Navigation Header */}
            <div className={`p-3.5 border-b flex items-center justify-between ${isLight ? 'border-[#e2e8f0]' : 'border-[#15151e]'}`}>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" style={{ color: accentColor }} />
                <span className={`text-xs font-black uppercase tracking-wider ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>
                  Bạn Bè
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <button
                onClick={() => {
                  setActiveDmFriend(null);
                  setFriendsTab('online');
                }}
                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  !activeDmFriend && friendsTab === 'online'
                    ? isLight ? 'bg-slate-200 text-slate-900' : 'bg-white/10 text-white'
                    : isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-[#888] hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>Trực tuyến</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/20">
                  {registeredUsers.filter(u => isMutualFriend(u) && (getEffectiveStatus(u) === 'online' || getEffectiveStatus(u) === 'dnd')).length}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveDmFriend(null);
                  setFriendsTab('all');
                }}
                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  !activeDmFriend && friendsTab === 'all'
                    ? isLight ? 'bg-slate-200 text-slate-900' : 'bg-white/10 text-white'
                    : isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-[#888] hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Tất cả bạn bè</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/20">
                  {registeredUsers.filter(u => isMutualFriend(u)).length}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveDmFriend(null);
                  setFriendsTab('pending');
                }}
                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  !activeDmFriend && friendsTab === 'pending'
                    ? isLight ? 'bg-slate-200 text-slate-900' : 'bg-white/10 text-white'
                    : isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-[#888] hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Heart className="w-3.5 h-3.5 text-pink-400" />
                  <span>Đang theo dõi</span>
                </div>
                <div className="flex items-center gap-1">
                  {(incomingFriendRequests.length + incomingServerInvites.length) > 0 && (
                    <span
                      className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-red-500 text-white"
                      title={`${incomingFriendRequests.length + incomingServerInvites.length} lời mời đang chờ đồng ý`}
                    >
                      +{incomingFriendRequests.length + incomingServerInvites.length}
                    </span>
                  )}
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/20">
                    {followingUserIds.size}
                  </span>
                </div>
              </button>

              <button
                onClick={() => {
                  setActiveDmFriend(null);
                  setFriendsTab('add');
                }}
                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  !activeDmFriend && friendsTab === 'add'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-emerald-500 hover:bg-emerald-500/10'
                }`}
              >
                <div className="flex items-center gap-2">
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Thêm bạn mới</span>
                </div>
              </button>

              <div className="pt-3 pb-1 px-1 flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#666]">
                  TIN NHẮN TRỰC TIẾP
                </span>
                {Object.values(unreadDmCounts).reduce((a, b) => a + (b || 0), 0) > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-mono font-black flex items-center justify-center shadow-sm">
                    {Object.values(unreadDmCounts).reduce((a, b) => a + (b || 0), 0)}
                  </span>
                )}
              </div>

              {registeredUsers
                .filter(u => isMutualFriend(u) || (unreadDmCounts[u.id] || 0) > 0)
                .sort((a, b) => (unreadDmCounts[b.id] || 0) - (unreadDmCounts[a.id] || 0))
                .map(fr => {
                  const isDmSelected = activeDmFriend?.id === fr.id;
                  const frRoomId = currentUser ? getDmRoomId(currentUser.id, fr.id) : '';
                  const isCallingThisFriend =
                    connectedVoiceServerId === 'dm_private' &&
                    connectedVoiceChannel === `dm_voice_${frRoomId}`;
                  const effSt = getEffectiveStatus(fr);
                  const unreadCount = unreadDmCounts[fr.id] || 0;
                  return (
                    <div
                      key={fr.id}
                      onClick={() => handleOpenDirectMessage(fr)}
                      className={`group/dm flex items-center justify-between gap-2 p-2 rounded-xl transition-all cursor-pointer border ${
                        isDmSelected
                          ? isLight
                            ? 'bg-slate-200 border-slate-300 text-slate-900'
                            : 'bg-[#161624] border-white/15 text-white shadow-sm'
                          : unreadCount > 0
                          ? isLight
                            ? 'bg-red-50 border-red-200 text-slate-900'
                            : 'bg-red-950/20 border-red-500/30 text-white'
                          : isLight
                          ? 'border-transparent hover:bg-slate-100'
                          : 'border-transparent hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                        <div className="relative flex-shrink-0">
                          <div className="w-7 h-7 rounded-lg bg-zinc-800 overflow-hidden flex items-center justify-center font-bold text-[10px] text-white">
                            {renderAvatarContent(fr.display_name, resolveUserAvatar(fr.id, fr.avatar))}
                          </div>
                          {renderStatusDot(effSt, 'sm')}
                          {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-mono font-black flex items-center justify-center border border-[#09090e] shadow-sm">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          )}
                        </div>
                        <div className="truncate flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <p
                              className={`text-xs truncate ${
                                unreadCount > 0
                                  ? 'font-black text-white'
                                  : isLight
                                  ? 'font-semibold text-slate-800'
                                  : 'font-semibold text-zinc-200'
                              }`}
                            >
                              {fr.display_name}
                            </p>
                            {isCallingThisFriend && (
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping flex-shrink-0" title="Đang gọi thoại riêng" />
                            )}
                          </div>
                          <p className={`text-[9px] font-mono truncate ${unreadCount > 0 ? 'text-red-400 font-bold' : 'text-[#888]'}`}>
                            {unreadCount > 0
                              ? `💬 ${unreadCount} tin nhắn mới`
                              : fr.listening
                              ? `🎵 ${fr.listening}`
                              : `@${fr.username}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {unreadCount > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-mono font-black flex items-center justify-center shadow-md shadow-red-500/40 animate-pulse">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartPrivateCall(fr);
                          }}
                          title={`Gọi thoại riêng với ${fr.display_name}`}
                          className={`p-1.5 rounded-lg transition-all cursor-pointer flex-shrink-0 ${
                            isCallingThisFriend
                              ? 'bg-emerald-500/20 text-emerald-400 opacity-100'
                              : 'opacity-0 group-hover/dm:opacity-100 text-[#888] hover:text-emerald-400 hover:bg-emerald-500/10'
                          }`}
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </>
        ) : (
          <>
            {/* Server Header */}
            <div className={`p-3.5 border-b flex items-center justify-between gap-2 ${isLight ? 'border-[#e2e8f0]' : 'border-[#15151e]'}`}>
              <div className="truncate flex-1">
                <h2 className={`text-xs font-black tracking-tight flex items-center gap-1.5 truncate ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>
                  <span>{selectedServer.name}</span>
                  {selectedServer.badge && (
                    <span 
                      className="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold tracking-wider uppercase border"
                      style={{
                        backgroundColor: `${accentColor}18`,
                        color: accentColor,
                        borderColor: `${accentColor}35`,
                      }}
                    >
                      {selectedServer.badge}
                    </span>
                  )}
                </h2>
                <p className={`text-[10px] font-mono truncate mt-0.5 ${isLight ? 'text-[#64748b]' : 'text-[#777]'}`}>{selectedServer.description}</p>
              </div>

              {/* Server Settings Cog Button (Hiển thị cho tất cả thành viên) */}
              <button
                onClick={() => handleOpenServerSettings(selectedServer)}
                title={canManageServer ? 'Cài đặt máy chủ & Quản lý thành viên' : 'Xem thông tin & Tùy chọn máy chủ'}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer flex-shrink-0 ${
                  isLight 
                    ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900' 
                    : 'bg-[#12121a] hover:bg-[#1a1a26] border-[#222230] text-[#888] hover:text-white'
                }`}
              >
                <Settings className="w-3.5 h-3.5 hover:rotate-90 transition-transform" />
              </button>
            </div>

            {/* Channels List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-4 text-xs font-sans">
          {/* Text Channels Group */}
          <div>
            <div className="flex items-center justify-between px-2 mb-1">
              <p className={`text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-[#64748b]' : 'text-[#555]'}`}>
                <MessageSquare className="w-3 h-3 text-[#444]" />
                {getTranslation(language, 'community.textChannels')}
              </p>
              {canManageServer && (
                <button
                  type="button"
                  onClick={() => {
                    setCreatingChannelState(prev =>
                      prev && prev.serverId === selectedServer.id && prev.type === 'text'
                        ? null
                        : { serverId: selectedServer.id, type: 'text' }
                    );
                    setNewChannelName('');
                  }}
                  title="Thêm phòng trò chuyện mới"
                  className={`p-0.5 rounded transition-colors cursor-pointer ${
                    isLight ? 'text-[#64748b] hover:text-[#0f172a] hover:bg-slate-200' : 'text-[#666] hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {canManageServer && creatingChannelType === 'text' && (
              <form onSubmit={handleCreateChannel} className="mb-1.5 px-1 space-y-1.5">
                <input
                  type="text"
                  autoFocus
                  maxLength={28}
                  value={newChannelName}
                  onChange={e => setNewChannelName(e.target.value)}
                  placeholder="Đặt tên kênh chat..."
                  className={`w-full px-2.5 py-1.5 rounded-lg text-[11px] border outline-none ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-slate-500'
                      : 'bg-[#12121c] border-[#262638] text-white focus:border-white/50'
                  }`}
                />
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => { setCreatingChannelState(null); setNewChannelName(''); }}
                    className="px-2 py-0.5 rounded text-[10px] font-mono text-[#888] hover:text-white cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={!newChannelName.trim()}
                    style={{
                      backgroundColor: accentColor,
                      color: getContrastTextColor(accentColor),
                    }}
                    className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold disabled:opacity-40 cursor-pointer"
                  >
                    Tạo phòng
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-0.5">
              {selectedServer.channels
                .filter(c => c.type === 'text')
                .map(channel => {
                  const isCur = selectedChannel.id === channel.id;
                  const textCount = selectedServer.channels.filter(c => c.type === 'text').length;
                  const chUnread = unreadChannelCounts[channel.id] || 0;
                  return (
                    <div
                      key={channel.id}
                      onClick={() => handleSelectChannel(channel)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setChannelContextMenu({
                          x: Math.min(e.clientX, window.innerWidth - 240),
                          y: Math.min(e.clientY, window.innerHeight - 250),
                          channel,
                        });
                      }}
                      className={`group/ch w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-left cursor-pointer transition-colors ${
                        isCur
                          ? isLight ? 'bg-[#e2e8f0] text-[#0f172a] font-semibold' : 'bg-[#151520] text-white font-semibold'
                          : chUnread > 0
                          ? isLight ? 'bg-red-50 text-[#0f172a] font-bold' : 'bg-red-950/20 text-white font-bold'
                          : isLight ? 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#edf2f7]' : 'text-[#888899] hover:text-white hover:bg-[#0e0e14]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Hash className="w-3.5 h-3.5 text-[#666] flex-shrink-0" />
                        <span className="truncate">{channel.name}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {chUnread > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-mono font-black flex items-center justify-center shadow-sm">
                            {chUnread > 99 ? '99+' : chUnread}
                          </span>
                        )}
                        {canManageServer && textCount > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleDeleteChannel(channel.id, e);
                            }}
                            title="Xóa phòng chat"
                            className="opacity-0 group-hover/ch:opacity-100 p-1 rounded hover:bg-red-500/20 text-[#777] hover:text-red-400 transition-all cursor-pointer flex-shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Voice Call Channels Group */}
          <div>
            <div className="flex items-center justify-between px-2 mb-1">
              <p className={`text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-[#64748b]' : 'text-[#555]'}`}>
                <Mic className="w-3 h-3 text-[#444]" />
                {getTranslation(language, 'community.voiceChannels')}
              </p>
              {canManageServer && (
                <button
                  type="button"
                  onClick={() => {
                    setCreatingChannelState(prev =>
                      prev && prev.serverId === selectedServer.id && prev.type === 'voice'
                        ? null
                        : { serverId: selectedServer.id, type: 'voice' }
                    );
                    setNewChannelName('');
                  }}
                  title="Thêm phòng đàm thoại (Voice) mới"
                  className={`p-0.5 rounded transition-colors cursor-pointer ${
                    isLight ? 'text-[#64748b] hover:text-[#0f172a] hover:bg-slate-200' : 'text-[#666] hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {canManageServer && creatingChannelType === 'voice' && (
              <form onSubmit={handleCreateChannel} className="mb-2 p-2 rounded-xl border space-y-2 bg-black/30 border-white/10">
                <input
                  type="text"
                  autoFocus
                  maxLength={28}
                  value={newChannelName}
                  onChange={e => setNewChannelName(e.target.value)}
                  placeholder={newChannelIsRadio ? "Đặt tên phòng Radio 24/24..." : "Đặt tên phòng thoại..."}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-[11px] border outline-none ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-slate-500'
                      : 'bg-[#12121c] border-[#262638] text-white focus:border-white/50'
                  }`}
                />

                {/* Tùy chọn Phòng Thoại thường vs Phòng Radio 24/24 */}
                <div className="flex items-center gap-1 text-[10px] font-mono">
                  <button
                    type="button"
                    onClick={() => setNewChannelIsRadio(false)}
                    className={`flex-1 py-1 rounded-md border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      !newChannelIsRadio
                        ? 'bg-white/15 border-white/30 text-white font-bold'
                        : 'bg-transparent border-transparent text-[#777] hover:text-white'
                    }`}
                  >
                    <Mic className="w-3 h-3 text-emerald-400" />
                    Thoại
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewChannelIsRadio(true);
                      if (!newChannelName.trim()) setNewChannelName('Trạm Radio 24/7');
                    }}
                    className={`flex-1 py-1 rounded-md border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      newChannelIsRadio
                        ? 'bg-amber-500/20 border-amber-400/50 text-amber-300 font-bold'
                        : 'bg-transparent border-transparent text-[#777] hover:text-amber-300'
                    }`}
                  >
                    <Radio className="w-3 h-3 text-amber-400 animate-pulse" />
                    Radio 24/24
                  </button>
                </div>

                {/* Chọn DJ bot chính cho phòng Radio 24/24 */}
                {newChannelIsRadio && (
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono text-amber-300 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      DJ Chính phát nhạc:
                    </label>
                    <div className="grid grid-cols-1 gap-1">
                      {DJ_BOT_OPTIONS.map(dj => (
                        <button
                          key={dj.id}
                          type="button"
                          onClick={() => setNewChannelDjBot(dj.id)}
                          className={`px-2 py-1 rounded-md border text-left flex items-center justify-between cursor-pointer transition-all text-[10px] ${
                            newChannelDjBot === dj.id
                              ? 'bg-amber-400/15 border-amber-400/60 text-white'
                              : 'bg-black/20 border-white/5 text-[#888] hover:text-white'
                          }`}
                        >
                          <div className="truncate flex-1">
                            <span className="font-bold text-amber-300 mr-1">{dj.name}</span>
                            <span className="text-[9px] text-[#777] font-mono truncate">({dj.trackName})</span>
                          </div>
                          {newChannelDjBot === dj.id && <Check className="w-3 h-3 text-amber-400 ml-1 shrink-0" />}
                        </button>
                      ))}
                    </div>

                    {/* Trường nhập link YouTube & chế độ cho Trạm tùy biến */}
                    {newChannelDjBot === 'custom' && (
                      <div className="space-y-1.5 p-2 rounded-lg bg-black/40 border border-amber-400/30 mt-1.5">
                        <div>
                          <label className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider block mb-0.5">
                            Link YouTube hoặc ID video:
                          </label>
                          <input
                            type="text"
                            value={newChannelCustomUrl}
                            onChange={e => setNewChannelCustomUrl(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=... hoặc video ID"
                            className="w-full px-2 py-1 rounded bg-[#10101a] border border-white/10 text-white text-[10px] font-mono outline-none focus:border-amber-400"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider block mb-0.5">
                            Tên hiển thị trạm (Tùy chọn):
                          </label>
                          <input
                            type="text"
                            value={newChannelCustomTitle}
                            onChange={e => setNewChannelCustomTitle(e.target.value)}
                            placeholder="VD: Nhạc Lofi Anime Chữa Lành..."
                            className="w-full px-2 py-1 rounded bg-[#10101a] border border-white/10 text-white text-[10px] outline-none focus:border-amber-400"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider block mb-0.5">
                            Luồng dự phòng 24/7 (Mỗi dòng 1 URL YouTube):
                          </label>
                          <textarea
                            rows={2}
                            value={newChannelCustomBackupUrls}
                            onChange={e => setNewChannelCustomBackupUrls(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=...&#10;https://www.youtube.com/watch?v=..."
                            className="w-full px-2 py-1 rounded bg-[#10101a] border border-white/10 text-white text-[10px] font-mono outline-none resize-none focus:border-amber-400"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-1 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCreatingChannelState(null);
                      setNewChannelName('');
                      setNewChannelIsRadio(false);
                      setNewChannelCustomUrl('');
                      setNewChannelCustomTitle('');
                      setNewChannelCustomBackupUrls('');
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-mono text-[#888] hover:text-white cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={!newChannelName.trim()}
                    style={{
                      backgroundColor: newChannelIsRadio ? '#f59e0b' : accentColor,
                      color: '#000000',
                    }}
                    className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold disabled:opacity-40 cursor-pointer shadow-md"
                  >
                    {newChannelIsRadio ? 'Tạo Trạm Radio' : 'Tạo phòng'}
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-0.5">
              {selectedServer.channels
                .filter(c => c.type === 'voice')
                .map(channel => {
                  const isCur = selectedChannel.id === channel.id;
                  const isVoiceActive =
                    connectedVoiceServerId === selectedServer.id && connectedVoiceChannel === channel.id;
                  const otherVoiceParticipants = getEffectiveVoiceParticipants(channel);
                  const totalVoiceCount = (isVoiceActive ? 1 : 0) + otherVoiceParticipants.length;
                  const voiceCount = selectedServer.channels.filter(c => c.type === 'voice').length;

                  return (
                    <div key={channel.id} className="space-y-1">
                      <div
                        onClick={() => handleSelectChannel(channel)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setChannelContextMenu({
                            x: Math.min(e.clientX, window.innerWidth - 240),
                            y: Math.min(e.clientY, window.innerHeight - 250),
                            channel,
                          });
                        }}
                        className={`group/vch w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left cursor-pointer transition-colors ${
                          isCur
                            ? isLight ? 'bg-[#e2e8f0] text-[#0f172a] font-semibold' : 'bg-[#161624] text-white font-semibold'
                            : isLight ? 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#edf2f7]' : 'text-[#888899] hover:text-white hover:bg-[#0e0e14]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2 overflow-hidden">
                          {channel.is_radio ? (
                            <Radio className="w-3.5 h-3.5 flex-shrink-0 text-amber-400 animate-pulse" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: isVoiceActive ? '#00FF66' : accentColor }} />
                          )}
                          <HoverMarquee text={getChannelName(channel)} className="flex-1 min-w-0 text-[11px]" />
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isVoiceActive ? (
                            <span 
                              className="w-2 h-2 rounded-full animate-ping"
                              style={{ backgroundColor: accentColor }}
                              title="Đang kết nối"
                            />
                          ) : totalVoiceCount > 0 && !channel.is_radio ? (
                            <span className={`shrink-0 whitespace-nowrap text-[9px] font-mono px-1.5 py-0.2 rounded border ${isLight ? 'bg-[#ffffff] text-[#64748b] border-[#cbd5e1]' : 'bg-[#121218] text-[#666] border-[#202028]'}`}>
                              {totalVoiceCount} {getTranslation(language, 'community.members')}
                            </span>
                          ) : null}

                          {/* Nút Thêm Người (Mời bạn bè vào phòng thoại) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleCopyInvite(selectedServer.id);
                            }}
                            title={language === 'vi' ? 'Sao chép link mời vào phòng thoại' : 'Copy invite link to this voice channel'}
                            className="opacity-0 group-hover/vch:opacity-100 p-1 rounded hover:bg-white/10 text-[#777] hover:text-white transition-all cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                          </button>

                          {/* Nút Bánh Răng Cài Đặt (Thay thế cho nút sửa/xóa riêng biệt) */}
                          {canManageServer && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const rect = e.currentTarget.getBoundingClientRect();
                                setChannelContextMenu({
                                  x: Math.min(rect.right + 4, window.innerWidth - 240),
                                  y: Math.min(rect.top, window.innerHeight - 200),
                                  channel,
                                });
                              }}
                              title={language === 'vi' ? 'Cài đặt phòng thoại (Chỉnh sửa / Xóa)' : 'Voice channel settings'}
                              className="opacity-0 group-hover/vch:opacity-100 p-1 rounded hover:bg-white/10 text-[#777] hover:text-white transition-all cursor-pointer"
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Indented Participants list under voice channel */}
                      {(isVoiceActive || otherVoiceParticipants.length > 0) && (
                        <div className="pl-6 space-y-1 py-0.5">
                          {isVoiceActive && (
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: accentColor }}>
                              <div className="relative flex-shrink-0">
                                <span 
                                  className="w-4 h-4 rounded-full overflow-hidden border text-[9px] font-bold flex items-center justify-center text-white transition-all"
                                  style={{
                                    backgroundColor: `${accentColor}30`,
                                    borderColor: isUserSpeaking ? accentColor : `${accentColor}50`,
                                    boxShadow: isUserSpeaking ? `0 0 6px ${accentColor}` : undefined,
                                  }}
                                >
                                  {renderAvatarContent(myServerDisplayName, currentUser?.avatar)}
                                </span>
                              </div>
                              <span className="truncate">{myServerDisplayName} ({getTranslation(language, 'community.you')})</span>
                              {isScreenSharing && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectChannel(channel);
                                    setSelectedScreenShareUserId(myParticipantIdRef.current);
                                  }}
                                  className="ml-auto inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8px] font-mono font-bold bg-red-600 text-white border border-red-400/50 cursor-pointer flex-shrink-0"
                                  title="Bạn đang chia sẻ màn hình — bấm để xem"
                                >
                                  <Monitor className="w-2.5 h-2.5" />
                                  <span>LIVE</span>
                                </button>
                              )}
                              {isMuted && <MicOff className={`w-2.5 h-2.5 text-red-400 flex-shrink-0 ${isScreenSharing ? '' : 'ml-auto'}`} />}
                            </div>
                          )}

                          {otherVoiceParticipants.map(vp => {
                            const vpSharing = Boolean(vp.isScreenSharing || screenShares[vp.id]);
                            return (
                              <div 
                                key={vp.id} 
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setMemberMenu({
                                    x: Math.min(e.clientX, window.innerWidth - 240),
                                    y: Math.min(e.clientY, window.innerHeight - 300),
                                    member: {
                                      id: vp.id,
                                      name: vp.name,
                                      avatar: resolveUserAvatar(vp.id, vp.avatar),
                                      role: (ACTIVE_BOT_IDS.has(vp.id) || vp.isBot) ? 'DJ' : (vp.isHost ? 'HOST' : 'MEMBER'),
                                      isHost: vp.isHost,
                                      status: 'online',
                                      listening: vp.listeningTrack ? `${vp.listeningTrack.title} - ${vp.listeningTrack.artist}` : (vp.listening || null),
                                      listeningTrack: vp.listeningTrack || null,
                                    },
                                    fromVoice: true,
                                  });
                                }}
                                className={`flex items-center gap-1.5 text-[11px] p-0.5 rounded hover:bg-white/5 cursor-pointer ${isLight ? 'text-[#475569]' : 'text-[#aaa]'}`}
                              >
                                <div className="relative flex-shrink-0">
                                  <span 
                                    className={`w-4 h-4 rounded-full overflow-hidden border text-[9px] font-bold flex items-center justify-center transition-all ${isLight ? 'bg-[#e2e8f0] text-[#0f172a]' : 'bg-[#161622] text-white'}`}
                                    style={{
                                      borderColor: vp.isSpeaking ? accentColor : (isLight ? '#cbd5e1' : 'rgba(255,255,255,0.2)'),
                                      boxShadow: vp.isSpeaking ? `0 0 6px ${accentColor}` : undefined,
                                    }}
                                  >
                                    {renderAvatarContent(vp.name, resolveUserAvatar(vp.id, vp.avatar))}
                                  </span>
                                </div>
                                <span className="truncate">{vp.name}</span>
                                {((vp.isHost && (ACTIVE_BOT_IDS.has(vp.id) || vp.isBot)) || channel.dj_bot_id === vp.id) && (
                                  <span className="text-[8px] font-mono font-bold text-amber-400 bg-amber-400/10 px-1 rounded border border-amber-400/30 flex-shrink-0">
                                    DJ
                                  </span>
                                )}
                                {vpSharing && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectChannel(channel);
                                      if (screenShares[vp.id]) {
                                        setSelectedScreenShareUserId(vp.id);
                                      }
                                    }}
                                    className="ml-auto inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8px] font-mono font-bold bg-red-600/90 text-white border border-red-400/50 cursor-pointer flex-shrink-0 hover:bg-red-500"
                                    title={`${vp.name} đang chia sẻ màn hình — bấm để xem`}
                                  >
                                    <Monitor className="w-2.5 h-2.5" />
                                    <span>LIVE</span>
                                  </button>
                                )}
                                {vp.isMuted && <MicOff className={`w-2.5 h-2.5 text-red-400 flex-shrink-0 ${vpSharing ? '' : 'ml-auto'}`} />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
          </>
        )}

        {/* Persistent Bottom Voice Status Bar */}
        {connectedVoiceChannel && (
          <div className={`p-2.5 border-t flex flex-col gap-2 animate-in fade-in duration-200 ${isLight ? 'bg-[#f1f5f9] border-[#e2e8f0]' : 'bg-[#0c0c14] border-[#181824]'}`}>
            <div className="flex items-center justify-between text-xs">
              <div
                className="flex items-center gap-1.5 cursor-pointer hover:opacity-85 transition-opacity min-w-0"
                onClick={() => {
                  if (connectedVoiceServer && connectedVoiceServer.id !== selectedServer.id) {
                    setSelectedServer(connectedVoiceServer);
                    setIsFriendsTabActive(false);
                    if (connectedVoiceChannelObj) {
                      setSelectedChannel(connectedVoiceChannelObj);
                    }
                  } else if (connectedVoiceChannelObj) {
                    setSelectedChannel(connectedVoiceChannelObj);
                  }
                }}
                title="Bấm để quay về phòng thoại đang kết nối"
              >
                <Signal className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <div className="min-w-0 truncate">
                  <p className="text-[10px] font-bold text-emerald-400 font-mono flex items-center gap-1">
                    {getTranslation(language, 'community.callConnected')}
                    <span className="text-[8px] text-[#666]">18ms</span>
                  </p>
                  <p className={`text-[9px] font-mono truncate max-w-[130px] ${isLight ? 'text-[#64748b]' : 'text-[#888]'}`}>
                    {connectedVoiceServer && connectedVoiceServer.id !== selectedServer.id ? `${connectedVoiceServer.name} / ` : ''}
                    {connectedVoiceChannelObj ? getChannelName(connectedVoiceChannelObj) : getTranslation(language, 'community.voiceChannelFallback')}
                  </p>
                </div>
              </div>

              <button
                onClick={handleLeaveVoiceCall}
                className="p-1.5 rounded-lg bg-red-950/50 hover:bg-red-900 border border-red-500/30 text-red-300 hover:text-white transition-colors cursor-pointer flex-shrink-0"
                title={getTranslation(language, 'community.disconnect')}
              >
                <PhoneOff className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-1 pt-0.5">
              <button
                onClick={handleToggleMute}
                className={`flex-1 py-1 px-2 rounded-md border text-[10px] font-mono flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  isMuted 
                    ? 'bg-red-950/40 border-red-500/40 text-red-300' 
                    : isLight 
                    ? 'bg-[#ffffff] border-[#cbd5e1] text-[#334155] hover:text-[#0f172a]'
                    : 'bg-[#151522] border-[#262638] text-zinc-300 hover:text-white'
                }`}
              >
                {isMuted ? <MicOff className="w-3 h-3 text-red-400" /> : <Mic className="w-3 h-3 text-emerald-400" />}
                <span>{isMuted ? getTranslation(language, 'community.unmuteMic') : getTranslation(language, 'community.muteMic')}</span>
              </button>

              <button
                onClick={handleToggleDeafen}
                className={`flex-1 py-1 px-2 rounded-md border text-[10px] font-mono flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  isDeafened 
                    ? 'bg-red-950/40 border-red-500/40 text-red-300' 
                    : isLight 
                    ? 'bg-[#ffffff] border-[#cbd5e1] text-[#334155] hover:text-[#0f172a]'
                    : 'bg-[#151522] border-[#262638] text-zinc-300 hover:text-white'
                }`}
              >
                {isDeafened ? <VolumeX className="w-3 h-3 text-red-400" /> : <Headphones className="w-3 h-3 text-cyan-400" />}
                <span>{isDeafened ? getTranslation(language, 'community.unmuteSpeaker') : getTranslation(language, 'community.muteSpeaker')}</span>
              </button>

              <button
                onClick={() => setIsAudioSettingsOpen(true)}
                title={getTranslation(language, 'community.audioSettingsTitle')}
                className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                  isLight 
                    ? 'bg-[#ffffff] hover:bg-[#edf2f7] border-[#cbd5e1] text-[#64748b] hover:text-[#0f172a]' 
                    : 'bg-[#151522] hover:bg-[#202030] border-[#262638] text-[#888899] hover:text-[#00E5FF]'
                }`}
              >
                <Settings className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* ──────── DISCORD-STYLE USER STATUS & SERVER NICKNAME BAR ──────── */}
        <div className={`relative p-2 border-t flex items-center justify-between gap-2 select-none ${
          isLight ? 'bg-[#f1f5f9] border-[#e2e8f0]' : 'bg-[#08080e] border-[#151520]'
        }`}>
          <button
            type="button"
            onClick={() => setIsStatusMenuOpen(p => !p)}
            className={`flex items-center gap-2 p-1 rounded-lg flex-1 min-w-0 text-left transition-colors cursor-pointer ${
              isLight ? 'hover:bg-[#e2e8f0]' : 'hover:bg-[#141420]'
            }`}
            title="Bấm để đổi trạng thái (Trực tuyến / Bận / Vô hình) hoặc tên hiển thị trên Server"
          >
            <div className="relative flex-shrink-0 group/avt">
              <div
                className="w-7 h-7 rounded-lg border flex items-center justify-center font-bold text-xs overflow-hidden"
                style={{
                  backgroundColor: `${accentColor}20`,
                  borderColor: `${accentColor}40`,
                  color: accentColor,
                }}
              >
                {currentUser?.avatar ? (
                  <img src={currentUser.avatar} alt={myServerDisplayName} className="w-full h-full object-cover" />
                ) : (
                  <span>{myServerDisplayName.charAt(0).toUpperCase()}</span>
                )}
              </div>
              {renderStatusDot(myEffectivePublicStatus, 'sm')}

              {/* Hộp thoại suy nghĩ / Note trên Avatar (Discord / Instagram style) */}
              {myUserThought ? (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenThoughtModal();
                  }}
                  title={`Suy nghĩ: "${myUserThought}" - Bấm để chỉnh sửa`}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 max-w-[140px] px-2.5 py-0.5 rounded-xl bg-zinc-900/95 border border-cyan-400 text-[8.5px] font-mono font-medium text-cyan-200 shadow-xl shadow-cyan-950/70 flex items-center gap-1 z-30 cursor-pointer hover:scale-105 hover:border-cyan-300 transition-all truncate whitespace-nowrap"
                >
                  <span className="text-[9px] shrink-0">💭</span>
                  <span className="truncate">{myUserThought}</span>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-1.5 h-1.5 -mt-0.5 bg-zinc-900 border-r border-b border-cyan-400 rotate-45 pointer-events-none" />
                </div>
              ) : (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenThoughtModal();
                  }}
                  title="Đặt suy nghĩ / Note mới"
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover/avt:opacity-100 px-1.5 py-0.5 rounded-full bg-zinc-900/95 border border-cyan-500/60 text-[7.5px] font-mono text-cyan-300 hover:text-white z-30 transition-all cursor-pointer whitespace-nowrap shadow"
                >
                  + Note
                </div>
              )}
            </div>

            <div className="truncate flex-1 min-w-0">
              <p className={`text-[11px] font-bold truncate leading-tight ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>
                {myServerDisplayName}
              </p>
              <p className="text-[9px] font-mono truncate flex items-center gap-1 text-[#888]">
                {myStatus === 'online' && <span style={{ color: accentColor }}>● Trực tuyến</span>}
                {myStatus === 'dnd' && <span className="text-red-400">⛔ Bận</span>}
                {myStatus === 'invisible' && <span className="text-zinc-400">👻 Vô hình</span>}
              </p>
            </div>
          </button>

          {/* Status & Server Nickname Popover Menu */}
          {isStatusMenuOpen && (
            <div
              className={`absolute bottom-full left-2 right-2 mb-2 rounded-xl border shadow-2xl p-1.5 z-50 text-xs animate-in fade-in duration-150 ${
                isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0e0e18] border-[#26263a] text-white'
              }`}
            >
              <p className="px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-wider text-[#777]">
                TRẠNG THÁI HIỂN THỊ
              </p>
              <button
                type="button"
                onClick={() => handleChangeMyStatus('online')}
                className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                  myStatus === 'online' ? 'bg-white/10 font-bold' : 'hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accentColor, boxShadow: `0 0 6px ${accentColor}` }} />
                  <span>Trực tuyến</span>
                </span>
                {myStatus === 'online' && <Check className="w-3.5 h-3.5" style={{ color: accentColor }} />}
              </button>

              <button
                type="button"
                onClick={() => handleChangeMyStatus('dnd')}
                className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                  myStatus === 'dnd' ? 'bg-white/10 font-bold' : 'hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex items-center justify-center">
                    <span className="w-1.5 h-[1.5px] bg-white rounded-full" />
                  </span>
                  <span>Bận (Không làm phiền)</span>
                </span>
                {myStatus === 'dnd' && <Check className="w-3.5 h-3.5 text-red-400" />}
              </button>

              <button
                type="button"
                onClick={() => handleChangeMyStatus('invisible')}
                className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                  myStatus === 'invisible' ? 'bg-white/10 font-bold' : 'hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-2">
                  <EyeOff className="w-3 h-3 text-zinc-400" />
                  <span>Vô hình (Ẩn đèn online)</span>
                </span>
                {myStatus === 'invisible' && <Check className="w-3.5 h-3.5 text-zinc-400" />}
              </button>

              <div className="my-1 border-t border-white/10" />

              <button
                type="button"
                onClick={handleOpenThoughtModal}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 hover:bg-white/5 cursor-pointer transition-colors text-emerald-400"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="font-semibold">{myUserThought ? 'Đổi suy nghĩ người dùng...' : 'Đặt suy nghĩ người dùng...'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ──────────────── 3. MAIN CONTENT (CHAT / VOICE / STAGE OR FRIENDS HUB) ──────────────── */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden ${isLight ? 'bg-[#ffffff]' : 'bg-[#0a0a0f]'}`}>
        {isFriendsTabActive ? (
          activeDmFriend ? (
            /* ──────── 3.0 GIAO DIỆN CHAT RIÊNG (DM 1-1) & CALL RIÊNG VỚI BẠN BÈ ──────── */
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* DM Header Bar */}
              <div className={`h-14 px-5 border-b flex items-center justify-between flex-shrink-0 ${isLight ? 'bg-white/90 backdrop-blur border-[#e2e8f0]' : 'bg-black/60 backdrop-blur border-[#151520]'}`}>
                <div className="flex items-center gap-3 truncate">
                  <button
                    type="button"
                    onClick={() => setActiveDmFriend(null)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono border cursor-pointer transition-colors ${
                      isLight
                        ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                        : 'bg-[#141420] hover:bg-[#1e1e30] border-[#262638] text-[#aaa] hover:text-white'
                    }`}
                  >
                    ← Bạn bè
                  </button>

                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-zinc-800 overflow-hidden border border-white/10 flex items-center justify-center font-bold text-sm text-white">
                      {renderAvatarContent(
                        activeDmFriend.display_name,
                        resolveUserAvatar(activeDmFriend.id, activeDmFriend.avatar)
                      )}
                    </div>
                    {renderStatusDot(getEffectiveStatus(activeDmFriend), 'sm')}
                  </div>

                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {activeDmFriend.display_name}
                      </span>
                      <span className="text-[11px] font-mono text-cyan-400">@{activeDmFriend.username}</span>
                    </div>
                    <p className="text-[10px] font-mono text-[#777] truncate">
                      {activeDmFriend.listening
                        ? `🎵 Đang nghe: ${activeDmFriend.listening}`
                        : getEffectiveStatus(activeDmFriend) === 'online'
                        ? '🟢 Đang trực tuyến'
                        : getEffectiveStatus(activeDmFriend) === 'dnd'
                        ? '⛔ Bận (Không làm phiền)'
                        : '⚫ Ngoại tuyến'}
                    </p>
                  </div>
                </div>

                {/* DM Right Action Buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {activeDmFriend.listening && (
                    <button
                      type="button"
                      onClick={() => handlePlayMemberTrack(activeDmFriend)}
                      className="px-3 py-1.5 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span className="hidden md:inline">Nghe cùng</span>
                    </button>
                  )}

                  {isConnectedToCurrentDmVoice ? (
                    <button
                      type="button"
                      onClick={handleLeaveVoiceCall}
                      className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-600/30 transition-all"
                    >
                      <PhoneOff className="w-3.5 h-3.5" />
                      <span>Kết thúc gọi riêng</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStartPrivateCall(activeDmFriend)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/25 transition-all"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>Gọi thoại riêng</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedProfileUser(activeDmFriend)}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                      isLight
                        ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                        : 'bg-[#141420] hover:bg-[#1e1e30] border-[#262638] text-[#aaa] hover:text-white'
                    }`}
                    title="Xem hồ sơ"
                  >
                    <Users className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 1-on-1 Private Voice Call Stage (nếu đang trong cuộc gọi riêng) */}
              {isConnectedToCurrentDmVoice && (
                <div
                  className={`p-4 border-b flex flex-col items-center justify-between gap-4 ${
                    isLight
                      ? 'bg-slate-100/90 border-slate-200'
                      : 'bg-gradient-to-r from-[#091512] via-[#0b0e17] to-[#091512] border-emerald-500/30'
                  }`}
                >
                  <div className="grid grid-cols-[1fr_auto_1fr] items-start justify-items-center gap-4 sm:gap-8 w-full max-w-xl mx-auto py-1">
                    {/* You */}
                    <div className="w-44 sm:w-52 flex flex-col items-center text-center gap-2">
                      <div
                        className={`w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center font-black text-xl text-white border-2 transition-all relative ${
                          isUserSpeaking && !isMuted
                            ? 'border-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.55)] scale-105'
                            : 'border-white/20'
                        }`}
                        style={{ backgroundColor: '#161622' }}
                      >
                        {renderAvatarContent(currentUser?.display_name || 'Bạn', currentUser?.avatar)}
                        {isMuted && (
                          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center border-2 border-black">
                            <MicOff className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <span className={`text-xs font-bold truncate max-w-full ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {currentUser?.display_name || 'Bạn'}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400">
                        {isMuted ? 'Đã tắt Mic' : isUserSpeaking ? 'Đang nói...' : 'Đang kết nối'}
                      </span>
                    </div>

                    {/* Wave divider — căn chính giữa chiều ngang & ngang tầm 2 avatar */}
                    <div className="h-16 flex items-center justify-center gap-1 px-2">
                      {[1, 2, 3, 4, 5].map(bar => (
                        <span
                          key={bar}
                          className="w-1 rounded-full bg-emerald-400/70 animate-pulse"
                          style={{
                            height: `${10 + (bar % 3) * 8}px`,
                            animationDelay: `${bar * 120}ms`,
                          }}
                        />
                      ))}
                    </div>

                    {/* Friend */}
                    <div className="w-44 sm:w-52 flex flex-col items-center text-center gap-2">
                      <div
                        className="w-16 h-16 rounded-2xl overflow-hidden bg-[#161622] border-2 border-cyan-400/50 shadow-[0_0_20px_rgba(0,229,255,0.2)] flex items-center justify-center font-black text-xl text-white relative"
                      >
                        {renderAvatarContent(
                          activeDmFriend.display_name,
                          resolveUserAvatar(activeDmFriend.id, activeDmFriend.avatar)
                        )}
                        {renderStatusDot(getEffectiveStatus(activeDmFriend), 'md')}
                      </div>
                      <span className={`text-xs font-bold truncate max-w-full ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {activeDmFriend.display_name}
                      </span>
                      <span className="text-[10px] font-mono text-cyan-400">
                        {dmCallConnected || peersRef.current.size > 0 || ACTIVE_BOT_IDS.has(activeDmFriend.id)
                          ? 'Đã kết nối âm thanh'
                          : `Đang đổ chuông... Tự hủy sau ${dmCallCountdown}s`}
                      </span>
                    </div>
                  </div>

                  {/* Call Controls */}
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleToggleMute}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 cursor-pointer border transition-all ${
                        isMuted
                          ? 'bg-red-500/20 border-red-500/40 text-red-400'
                          : 'bg-[#161624] hover:bg-[#1f1f32] border-white/15 text-white'
                      }`}
                    >
                      {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                      <span>{isMuted ? 'Bật Mic' : 'Tắt Mic'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleDeafen}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 cursor-pointer border transition-all ${
                        isDeafened
                          ? 'bg-red-500/20 border-red-500/40 text-red-400'
                          : 'bg-[#161624] hover:bg-[#1f1f32] border-white/15 text-white'
                      }`}
                    >
                      {isDeafened ? <VolumeX className="w-4 h-4" /> : <Headphones className="w-4 h-4 text-cyan-400" />}
                      <span>{isDeafened ? 'Bật Loa' : 'Tắt Loa'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsAudioSettingsOpen(true)}
                      className="p-2 rounded-xl bg-[#161624] hover:bg-[#1f1f32] border border-white/15 text-[#aaa] hover:text-white cursor-pointer"
                      title="Cài đặt Mic & Loa"
                    >
                      <Sliders className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={handleLeaveVoiceCall}
                      className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold font-mono flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-600/30"
                    >
                      <PhoneOff className="w-4 h-4" />
                      <span>Ngắt cuộc gọi</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Direct Messages History (Discord-style left-aligned without speech bubbles) */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar">
                {dmMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-12 opacity-80">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 border"
                      style={{
                        backgroundColor: `${accentColor}15`,
                        borderColor: `${accentColor}35`,
                      }}
                    >
                      <MessageSquare className="w-7 h-7" style={{ color: accentColor }} />
                    </div>
                    <h4 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      Bắt đầu cuộc trò chuyện riêng với {activeDmFriend.display_name}
                    </h4>
                    <p className="text-xs text-[#777] max-w-md mt-1 leading-relaxed">
                      Hãy gửi lời chào hoặc chia sẻ giai điệu bạn đang thưởng thức cho @{activeDmFriend.username}.
                    </p>
                  </div>
                ) : (
                  dmMessages.map(msg => {
                    const inviteMatch = msg.content?.match(/spytify:\/\/station\/join\/([a-zA-Z0-9_-]+)/i);
                    const invitedSrvId = inviteMatch ? inviteMatch[1] : null;
                    return (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-3 -mx-2 px-2 py-1 rounded-lg transition-colors ${
                          isLight ? 'hover:bg-[#f1f5f9]' : 'hover:bg-[#101016]/40'
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                        >
                          {renderAvatarContent(msg.display_name, resolveUserAvatar(msg.user_id, msg.avatar))}
                        </div>

                        <div className="flex-1 overflow-hidden">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-xs font-bold ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>
                              {msg.display_name}
                            </span>
                            <span className={`text-[10px] font-mono ${isLight ? 'text-[#64748b]' : 'text-[#555]'}`}>
                              @{msg.username}
                            </span>
                            <span className={`text-[10px] font-mono ${isLight ? 'text-[#94a3b8]' : 'text-[#444]'}`}>
                              {msg.created_at}
                            </span>
                          </div>

                          {msg.content && (
                            <p className={`text-xs leading-relaxed break-words font-sans ${isLight ? 'text-[#334155]' : 'text-[#ddd]'}`}>
                              {msg.content}
                            </p>
                          )}

                          {invitedSrvId && (
                            <div
                              className={`mt-2 max-w-sm p-3 rounded-xl border flex items-center justify-between gap-3 ${
                                isLight
                                  ? 'bg-emerald-50 border-emerald-200'
                                  : 'bg-[#0d1518] border-emerald-500/35'
                              }`}
                            >
                              <div className="truncate">
                                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-400 block">
                                  📩 LỜI MỜI THAM GIA MÁY CHỦ
                                </span>
                                <p className={`text-xs font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                  spytify://station/join/{invitedSrvId}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => joinServerAndWelcome(invitedSrvId)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs font-mono shrink-0 cursor-pointer transition-transform hover:scale-105"
                              >
                                Tham gia
                              </button>
                            </div>
                          )}

                          {msg.track_embed && (
                            <div
                              className={`mt-2 max-w-sm p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#12121c] border-[#222234]'
                              }`}
                            >
                              <div className="truncate flex-1">
                                <span className="text-[9px] font-mono uppercase tracking-wider text-cyan-400 block">
                                  🎵 CHIA SẺ BÀI HÁT
                                </span>
                                <p className={`text-xs font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                  {msg.track_embed.title}
                                </p>
                                <p className="text-[10px] text-[#888] truncate">{msg.track_embed.artist}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => onPlayTrack(msg.track_embed!)}
                                style={{
                                  backgroundColor: accentColor,
                                  color: getContrastTextColor(accentColor),
                                }}
                                className="p-2 rounded-lg cursor-pointer transition-transform hover:scale-105 shrink-0"
                                title="Phát bài hát này"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                              </button>
                            </div>
                          )}

                          {msg.image_url && (
                            <div className="mt-2">
                              <img
                                src={msg.image_url}
                                alt="Ảnh đính kèm"
                                onClick={() => setLightboxImageUrl(msg.image_url!)}
                                className="max-w-[320px] max-h-[260px] rounded-xl object-cover cursor-pointer hover:opacity-95 transition-all border border-white/10 shadow-lg hover:scale-[1.01]"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={dmMessagesEndRef} />
              </div>

              {/* DM Input Box */}
              <div className={`p-3.5 border-t ${isLight ? 'bg-white border-[#e2e8f0]' : 'bg-[#07070c] border-[#151520]'}`}>
                {pendingDmImage && (
                  <div className="relative inline-block mb-2 rounded-xl overflow-hidden border border-white/20 shadow-lg group">
                    <img src={pendingDmImage} alt="Ảnh chuẩn bị gửi" className="max-h-28 rounded-xl object-cover" />
                    <button
                      type="button"
                      onClick={() => setPendingDmImage(null)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/80 hover:bg-red-600 text-white transition-all cursor-pointer shadow"
                      title="Xóa ảnh đính kèm"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {dmAttachTrack && currentTrack && (
                  <div className="mb-2 px-3 py-1.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-center justify-between text-xs">
                    <span className="text-cyan-300 font-mono truncate">
                      🎵 Đính kèm: <b>{currentTrack.title}</b> — {currentTrack.artist}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDmAttachTrack(false)}
                      className="text-[#888] hover:text-white ml-2 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <form onSubmit={handleSendDmMessage} className="flex items-center gap-2">
                  <input
                    ref={dmImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleSelectDmImage}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => dmImageInputRef.current?.click()}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                      pendingDmImage
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : isLight
                        ? 'bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900'
                        : 'bg-[#101018] border-[#222232] text-[#888] hover:text-white'
                    }`}
                    title="Gửi file ảnh trong cuộc trò chuyện này"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => currentTrack && setDmAttachTrack(p => !p)}
                    disabled={!currentTrack}
                    title={currentTrack ? 'Đính kèm bài hát đang phát' : 'Chưa có bài hát nào đang phát'}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer disabled:opacity-40 ${
                      dmAttachTrack
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                        : isLight
                        ? 'bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900'
                        : 'bg-[#101018] border-[#222232] text-[#888] hover:text-white'
                    }`}
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  <input
                    type="text"
                    value={dmInputText}
                    onChange={e => setDmInputText(e.target.value)}
                    placeholder={`Nhắn tin riêng cho @${activeDmFriend.username}...`}
                    className={`flex-1 px-3.5 py-2.5 rounded-xl text-xs border outline-none transition-colors font-sans ${
                      isLight
                        ? 'bg-[#f8fafc] text-[#0f172a] border-[#cbd5e1] placeholder-[#94a3b8] focus:border-[#64748b]'
                        : 'bg-[#101018] text-white border-[#222232] placeholder-[#666] focus:border-white/50'
                    }`}
                  />

                  <button
                    type="submit"
                    disabled={!dmInputText.trim() && !dmAttachTrack && !pendingDmImage}
                    className="p-2.5 rounded-xl font-bold flex items-center justify-center transition-all cursor-pointer disabled:opacity-40"
                    style={{
                      backgroundColor: accentColor,
                      color: getContrastTextColor(accentColor),
                    }}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <>
              {/* Friends Hub Header */}
              <div className={`h-12 px-5 border-b flex items-center justify-between flex-shrink-0 ${isLight ? 'bg-white/80 backdrop-blur border-[#e2e8f0]' : 'bg-black/50 backdrop-blur border-[#151520]'}`}>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <Users className="w-4 h-4" style={{ color: accentColor }} />
                    <span className={isLight ? 'text-slate-900' : 'text-white'}>Bạn Bè</span>
                  </div>
                  <div className="h-4 w-[1px] bg-zinc-700/40" />
                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      onClick={() => setFriendsTab('online')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                        friendsTab === 'online'
                          ? isLight ? 'bg-slate-200 text-slate-900 font-bold' : 'bg-white/10 text-white font-bold'
                          : 'text-[#888] hover:text-white'
                      }`}
                    >
                      Trực tuyến
                    </button>
                    <button
                      onClick={() => setFriendsTab('all')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                        friendsTab === 'all'
                          ? isLight ? 'bg-slate-200 text-slate-900 font-bold' : 'bg-white/10 text-white font-bold'
                          : 'text-[#888] hover:text-white'
                      }`}
                    >
                      Tất cả
                    </button>
                    <button
                      onClick={() => setFriendsTab('pending')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                        friendsTab === 'pending'
                          ? isLight ? 'bg-slate-200 text-slate-900 font-bold' : 'bg-white/10 text-white font-bold'
                          : 'text-[#888] hover:text-white'
                      }`}
                    >
                      <span>Đang theo dõi & Lời mời</span>
                      {(incomingFriendRequests.length + incomingServerInvites.length) > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-mono font-bold">
                          {incomingFriendRequests.length + incomingServerInvites.length}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setFriendsTab('add')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        friendsTab === 'add'
                          ? 'bg-emerald-500 text-black'
                          : 'text-emerald-400 hover:bg-emerald-500/10'
                      }`}
                    >
                      + Thêm bạn
                    </button>
                  </div>
                </div>

                {/* Quick Friend Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#666]" />
                  <input
                    type="text"
                    value={friendSearchQuery}
                    onChange={e => setFriendSearchQuery(e.target.value)}
                    placeholder="Tìm bạn bè..."
                    className={`pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none border transition-colors ${
                      isLight 
                        ? 'bg-slate-100 text-slate-900 border-slate-200 placeholder-slate-400 focus:border-slate-400' 
                        : 'bg-[#12121a] text-white border-[#222230] placeholder-[#666] focus:border-white/40'
                    }`}
                  />
                </div>
              </div>

              {/* Friends Hub Body Content */}
              <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* ──────── THÔNG BÁO LỜI MỜI THAM GIA MÁY CHỦ (HIỆN ĐỂ ĐỒNG Ý MỚI VÀO SERVER) ──────── */}
                {incomingServerInvites.length > 0 && (
                  <div
                    className={`max-w-4xl p-4 rounded-2xl border space-y-3 animate-in fade-in duration-200 ${
                      isLight
                        ? 'bg-cyan-50/90 border-cyan-300'
                        : 'bg-gradient-to-r from-cyan-950/40 via-[#0d1420] to-purple-950/30 border-cyan-500/40 shadow-lg'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                        <span className="text-xs font-mono font-black uppercase tracking-wider text-cyan-400">
                          📩 LỜI MỜI THAM GIA MÁY CHỦ ({incomingServerInvites.length})
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[#888]">
                        Nhấn "Đồng ý vào Server" để chính thức gia nhập máy chủ
                      </span>
                    </div>

                    <div className="space-y-2">
                      {incomingServerInvites.map(inv => (
                        <div
                          key={inv.id}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                            isLight ? 'bg-white border-cyan-200' : 'bg-[#0b0e18]/90 border-cyan-500/30'
                          }`}
                        >
                          <div className="flex items-center gap-3 truncate">
                            <div
                              className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center font-bold text-base shrink-0 border"
                              style={{
                                backgroundColor: `${inv.serverColor || '#00E5FF'}20`,
                                borderColor: `${inv.serverColor || '#00E5FF'}50`,
                                color: inv.serverColor || '#00E5FF',
                              }}
                            >
                              {renderServerIconContent(inv.serverIcon || '🎧', inv.serverName, inv.serverColor || '#00E5FF', 'w-5 h-5')}
                            </div>
                            <div className="truncate">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                  {inv.serverName}
                                </span>
                                <span className="text-[9px] font-mono font-bold text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-1.5 py-0.2 rounded">
                                  LỜI MỜI VÀO SERVER
                                </span>
                              </div>
                              <p className="text-[11px] font-mono text-[#888] mt-0.5 truncate">
                                Mời bởi <b className="text-cyan-400">{inv.inviterDisplayName}</b> (@{inv.inviterUsername}) • {inv.createdAt}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleAcceptServerInvite(inv)}
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs font-mono flex items-center gap-1.5 cursor-pointer shadow-md transition-transform hover:scale-105 active:scale-95"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Đồng ý vào Server</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeclineServerInvite(inv)}
                              className="px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 text-xs font-mono flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Từ chối</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ──────── THÔNG BÁO LỜI MỜI KẾT BẠN ĐẾN (HIỆN ĐỂ ĐỒNG Ý HOẶC TỪ CHỐI) ──────── */}
                {incomingFriendRequests.length > 0 && (
                  <div
                    className={`max-w-4xl p-4 rounded-2xl border space-y-3 animate-in fade-in duration-200 ${
                      isLight
                        ? 'bg-emerald-50/80 border-emerald-300'
                        : 'bg-gradient-to-r from-emerald-950/35 via-[#0d1618] to-cyan-950/25 border-emerald-500/40 shadow-lg'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                        <span className="text-xs font-mono font-black uppercase tracking-wider text-emerald-400">
                          🔔 THÔNG BÁO LỜI MỜI KẾT BẠN ĐẾN ({incomingFriendRequests.length})
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[#888]">
                        Nhấn "Đồng ý kết bạn" để trở thành Bạn bè ngay lập tức
                      </span>
                    </div>

                    <div className="space-y-2">
                      {incomingFriendRequests.map(req => {
                        const reqAvatar = resolveUserAvatar(req.followerId, req.followerAvatar);
                        return (
                          <div
                            key={req.followerId}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                              isLight
                                ? 'bg-white border-emerald-200'
                                : 'bg-[#0b0e16]/90 border-emerald-500/30'
                            }`}
                          >
                            <div className="flex items-center gap-3 truncate">
                              <div className="w-10 h-10 rounded-xl bg-zinc-800 overflow-hidden border border-emerald-500/40 flex items-center justify-center font-bold text-sm text-white shrink-0">
                                {renderAvatarContent(req.followerDisplayName, reqAvatar)}
                              </div>
                              <div className="truncate">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                    {req.followerDisplayName}
                                  </span>
                                  <span className="text-[10px] font-mono text-cyan-400">
                                    @{req.followerUsername}
                                  </span>
                                  <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-400/10 border border-amber-500/30 px-1.5 py-0.2 rounded">
                                    ĐÃ GỬI LỜI MỜI KẾT BẠN
                                  </span>
                                </div>
                                <p className="text-[11px] font-mono text-[#888] mt-0.5 truncate">
                                  Người dùng này đang theo dõi bạn và muốn kết bạn trên Spy Jam.
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleAcceptFriendRequest(req)}
                                className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs font-mono flex items-center gap-1.5 cursor-pointer shadow-md transition-transform hover:scale-105 active:scale-95"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Đồng ý kết bạn</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeclineFriendRequest(req)}
                                className="px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 text-xs font-mono flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Từ chối</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {friendsTab === 'add' ? (
                  <div className="max-w-xl mx-auto space-y-6 pt-4">
                    <div>
                      <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        THÊM BẠN BÈ
                      </h3>
                      <p className="text-xs text-[#888] mt-1">
                        Nhập tên người dùng hoặc handle (ví dụ: <code className="text-cyan-400 font-mono">@cyberhawk</code>). Quy tắc kết bạn: <b>Nếu bạn follow người kia và người kia follow lại thì là bạn bè</b>!
                      </p>
                    </div>

                    <form onSubmit={handleAddFriend} className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3.5 top-3 text-[#666] font-mono text-sm">@</span>
                        <input
                          type="text"
                          value={addFriendInput}
                          onChange={e => setAddFriendInput(e.target.value)}
                          placeholder="Nhập tên người dùng hoặc @handle..."
                          className={`w-full pl-8 pr-4 py-2.5 rounded-xl text-xs font-sans border outline-none ${
                            isLight 
                              ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-slate-500' 
                              : 'bg-[#12121a] border-[#242436] text-white focus:border-cyan-400'
                          }`}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={!addFriendInput.trim()}
                        className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shadow-lg"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>Kết bạn</span>
                      </button>
                    </form>

                    {addFriendMessage && (
                      <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 text-xs font-mono flex items-center gap-2 animate-in fade-in">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        <span>{addFriendMessage}</span>
                      </div>
                    )}

                    {addFriendError && (
                      <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-400 text-xs font-mono flex items-center gap-2 animate-in fade-in">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{addFriendError}</span>
                      </div>
                    )}

                    {/* Suggested Operatives */}
                    <div className="pt-4 border-t border-[#1a1a24]">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#777] block mb-3">
                        GỢI Ý KẾT BẠN TRONG SPY JAM
                      </span>
                      <div className="space-y-2">
                        {registeredUsers.map(u => {
                          const isFriend = isMutualFriend(u);
                          const isFollowing = followingUserIds.has(u.id);
                          const followsMe = isUserFollowingMe(u.id);
                          return (
                            <div 
                              key={u.id}
                              className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#0e0e16] border-[#1e1e2c]'
                              }`}
                            >
                              <div className="flex items-center gap-3 truncate">
                                <div className="w-10 h-10 rounded-xl bg-zinc-800 overflow-hidden border border-white/10 flex items-center justify-center font-bold text-sm text-white shrink-0">
                                  {renderAvatarContent(u.display_name, resolveUserAvatar(u.id, u.avatar))}
                                </div>
                                <div className="truncate">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{u.display_name}</span>
                                    <span className="text-[10px] text-cyan-400 font-mono">@{u.username}</span>
                                    {isFriend ? (
                                      <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                                        BẠN BÈ
                                      </span>
                                    ) : followsMe ? (
                                      <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-400/10 border border-amber-500/25 px-1.5 py-0.2 rounded">
                                        ĐÃ GỬI KB CHO BẠN
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="text-[11px] text-[#888] font-mono truncate mt-0.5">{u.bio}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  onClick={() => handleOpenDirectMessage(u)}
                                  className="px-3 py-1.5 rounded-lg border border-[#2a2a3a] text-xs font-mono text-cyan-400 hover:bg-cyan-500/10 cursor-pointer flex items-center gap-1"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span>Nhắn tin</span>
                                </button>
                                <button
                                  onClick={() => setSelectedProfileUser(u)}
                                  className="px-3 py-1.5 rounded-lg border border-[#2a2a3a] text-xs font-mono text-[#aaa] hover:text-white hover:bg-white/5 cursor-pointer"
                                >
                                  Hồ sơ
                                </button>
                                <button
                                  onClick={() => handleToggleFollow(u.id)}
                                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                                    isFollowing
                                      ? 'bg-zinc-800 hover:bg-red-950/40 text-zinc-300 hover:text-red-400 border border-zinc-700 hover:border-red-500/40'
                                      : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-md'
                                  }`}
                                >
                                  {isFollowing ? (
                                    <>
                                      <UserCheck className="w-3.5 h-3.5" />
                                      <span>{isFriend ? 'Bạn bè' : 'Đã gửi KB / Đang theo dõi'}</span>
                                    </>
                                  ) : followsMe ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Đồng ý kết bạn</span>
                                    </>
                                  ) : (
                                    <>
                                      <UserPlus className="w-3.5 h-3.5" />
                                      <span>Kết bạn</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Online, All, or Pending lists
                  <div className="space-y-2 max-w-4xl">
                    <div className="pb-2 flex items-center justify-between text-xs text-[#777] font-mono">
                      <span>
                        {friendsTab === 'online' 
                          ? `BẠN BÈ TRỰC TUYẾN — ${registeredUsers.filter(u => isMutualFriend(u) && (getEffectiveStatus(u) === 'online' || getEffectiveStatus(u) === 'dnd')).length}`
                          : friendsTab === 'all'
                          ? `TẤT CẢ BẠN BÈ — ${registeredUsers.filter(u => isMutualFriend(u)).length}`
                          : `DANH SÁCH ĐANG THEO DÕI — ${followingUserIds.size}`}
                      </span>
                    </div>

                    {registeredUsers
                      .filter(u => {
                        if (friendSearchQuery) {
                          const q = friendSearchQuery.toLowerCase();
                          if (!u.display_name.toLowerCase().includes(q) && !u.username.toLowerCase().includes(q)) return false;
                        }
                        const effSt = getEffectiveStatus(u);
                        if (friendsTab === 'online') return isMutualFriend(u) && (effSt === 'online' || effSt === 'dnd');
                        if (friendsTab === 'all') return isMutualFriend(u);
                        if (friendsTab === 'pending') return followingUserIds.has(u.id);
                        return true;
                      })
                      .map(fr => {
                        const isFriend = isMutualFriend(fr);
                        const effSt = getEffectiveStatus(fr);
                        return (
                          <div
                            key={fr.id}
                            className={`p-3 rounded-2xl border flex items-center justify-between gap-4 transition-all ${
                              isLight 
                                ? 'bg-white hover:bg-slate-50 border-slate-200 shadow-sm' 
                                : 'bg-[#0d0d14] hover:bg-[#12121e] border-[#1e1e2c]'
                            }`}
                          >
                            <div className="flex items-center gap-3.5 truncate">
                              <div className="relative flex-shrink-0 cursor-pointer" onClick={() => handleOpenDirectMessage(fr)}>
                                <div className="w-11 h-11 rounded-2xl bg-zinc-800 overflow-hidden border border-white/10 flex items-center justify-center font-bold text-base text-white shadow-md">
                                  {renderAvatarContent(fr.display_name, resolveUserAvatar(fr.id, fr.avatar))}
                                </div>
                                {renderStatusDot(effSt, 'md')}
                                {(unreadDmCounts[fr.id] || 0) > 0 && (
                                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-mono font-black flex items-center justify-center border-2 border-[#0d0d14] shadow-md animate-bounce">
                                    {unreadDmCounts[fr.id] > 99 ? '99+' : unreadDmCounts[fr.id]}
                                  </span>
                                )}
                              </div>

                              <div className="truncate">
                                <div className="flex items-center gap-2">
                                  <span 
                                    onClick={() => handleOpenDirectMessage(fr)}
                                    className={`text-sm font-bold truncate cursor-pointer hover:underline ${isLight ? 'text-slate-900' : 'text-white'}`}
                                  >
                                    {fr.display_name}
                                  </span>
                                  <span className="text-xs text-[#777] font-mono">@{fr.username}</span>
                                  {isFriend ? (
                                    <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-500/20 px-1.5 py-0.2 rounded flex items-center gap-1">
                                      <Sparkles className="w-2.5 h-2.5" />
                                      BẠN BÈ
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-mono text-cyan-400 bg-cyan-400/10 px-1.5 py-0.2 rounded">
                                      Đang theo dõi
                                    </span>
                                  )}
                                </div>

                                {fr.listening ? (
                                  <p className="text-xs text-cyan-400 font-mono flex items-center gap-1.5 mt-0.5 truncate">
                                    <Activity className="w-3 h-3 animate-pulse text-cyan-400 flex-shrink-0" />
                                    <span className="truncate">Đang nghe: <b>{fr.listening}</b></span>
                                  </p>
                                ) : (
                                  <p className="text-[11px] text-[#777] font-mono truncate mt-0.5">{fr.bio}</p>
                                )}
                              </div>
                            </div>

                            {/* Friend Action Buttons */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {fr.listening && (
                                <button
                                  onClick={() => handlePlayMemberTrack(fr)}
                                  className="px-3 py-1.5 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-105 active:scale-95 transition-all"
                                  title={`Nghe bài này cùng ${fr.display_name}`}
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                  <span>Nghe cùng</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleOpenDirectMessage(fr)}
                                className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer relative ${
                                  (unreadDmCounts[fr.id] || 0) > 0
                                    ? 'bg-red-500/15 hover:bg-red-500/25 border-red-500/40 text-white'
                                    : isLight
                                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                                    : 'bg-[#181824] hover:bg-[#222234] border-[#2c2c3e] text-zinc-200 hover:text-white'
                                }`}
                                title={`Nhắn tin riêng với ${fr.display_name}`}
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                                <span>Nhắn tin</span>
                                {(unreadDmCounts[fr.id] || 0) > 0 && (
                                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-mono font-black flex items-center justify-center shadow-sm">
                                    {unreadDmCounts[fr.id] > 99 ? '99+' : unreadDmCounts[fr.id]}
                                  </span>
                                )}
                              </button>

                              <button
                                onClick={() => handleStartPrivateCall(fr)}
                                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                                  isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-[#181824] hover:bg-[#222234] border-[#2c2c3e] text-zinc-300 hover:text-white'
                                }`}
                                title={`Gọi thoại riêng với ${fr.display_name}`}
                              >
                                <PhoneCall className="w-4 h-4 text-emerald-400" />
                              </button>

                              <button
                                onClick={() => setSelectedProfileUser(fr)}
                                className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-colors cursor-pointer ${
                                  isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' : 'bg-[#181824] hover:bg-[#222234] border-[#2c2c3e] text-zinc-300 hover:text-white'
                                }`}
                              >
                                Xem hồ sơ
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* ──────── 3.2 CỘT "ĐANG HOẠT ĐỘNG" BÊN PHẢI (ACTIVE NOW THEO THIẾT KẾ DISCORD) ──────── */}
              <div className={`w-80 border-l p-4 flex flex-col gap-3 overflow-y-auto flex-shrink-0 ${
                isLight ? 'bg-[#f8fafc] border-[#e2e8f0]' : 'bg-[#09090f] border-[#181824]'
              }`}>
                <h3 className={`text-sm font-bold tracking-tight uppercase font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Đang hoạt động
                </h3>

                {(() => {
                  const activeFriends = registeredUsers.filter(u => {
                    if (!isMutualFriend(u) && !followingUserIds.has(u.id)) return false;
                    const eff = getEffectiveStatus(u);
                    const inVoice = voiceParticipants.some(p => p.id === u.id);
                    return eff === 'online' || eff === 'dnd' || Boolean(u.listening || (u as any).custom_status || inVoice);
                  });

                  if (activeFriends.length === 0) {
                    return (
                      <div className={`p-4 rounded-2xl border text-center space-y-2 ${
                        isLight ? 'bg-white border-slate-200 text-slate-500' : 'bg-[#101018] border-[#1e1e2c] text-[#777]'
                      }`}>
                        <Radio className="w-8 h-8 mx-auto text-[#555]" />
                        <p className="text-xs font-semibold">Chưa có ai đang hoạt động</p>
                        <p className="text-[11px] leading-relaxed">
                          Khi bạn bè của bạn nghe nhạc hoặc vào phòng thoại, hoạt động của họ sẽ hiển thị tại đây!
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {activeFriends.map(af => {
                        const effStatus = getEffectiveStatus(af);
                        const inVoice = voiceParticipants.find(p => p.id === af.id);
                        return (
                          <div
                            key={af.id}
                            className={`p-3.5 rounded-2xl border space-y-2.5 transition-all shadow-sm ${
                              isLight
                                ? 'bg-white border-slate-200 hover:border-slate-300'
                                : 'bg-[#11111c] border-[#222232] hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="relative flex-shrink-0">
                                <div className="w-9 h-9 rounded-xl bg-zinc-800 overflow-hidden flex items-center justify-center font-bold text-xs text-white">
                                  {renderAvatarContent(af.display_name, resolveUserAvatar(af.id, af.avatar))}
                                </div>
                                {renderStatusDot(effStatus, 'sm')}
                              </div>
                              <div className="truncate flex-1 min-w-0">
                                <p className={`text-xs font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                  {af.display_name}
                                </p>
                                <p className="text-[10px] text-cyan-400 font-mono truncate">
                                  @{getCleanMemberUsername(af, registeredUsers, currentUser)}
                                </p>
                              </div>
                            </div>

                            {/* Thought / Custom Status */}
                            {(af as any).custom_status && (
                              <p className="text-[11px] font-mono text-zinc-300 italic bg-white/5 p-1.5 rounded-lg border border-white/5 truncate">
                                💬 "{(af as any).custom_status}"
                              </p>
                            )}

                            {/* Activity 1: Listening on Spytify */}
                            {af.listening && (
                              <div className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-950/40 to-black/60 border border-cyan-500/30 space-y-1.5">
                                <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-wider text-cyan-400">
                                  <Activity className="w-3 h-3 animate-pulse" />
                                  <span>Đang nghe trên Spytify</span>
                                </div>
                                <p className="text-xs font-bold text-white truncate">{af.listening}</p>
                                <button
                                  onClick={() => handlePlayMemberTrack(af)}
                                  className="w-full py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-transform hover:scale-[1.02] active:scale-95"
                                >
                                  <Play className="w-3 h-3 fill-current" />
                                  <span>Nghe cùng</span>
                                </button>
                              </div>
                            )}

                            {/* Activity 2: In Voice Channel */}
                            {inVoice && (
                              <div className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-950/40 to-black/60 border border-emerald-500/30 space-y-1.5">
                                <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                                  <Mic className="w-3 h-3 animate-bounce" />
                                  <span>Đang trong phòng thoại</span>
                                </div>
                                <p className="text-xs font-bold text-white truncate">
                                  {selectedServer.channels.find(c => c.id === inVoice.channelId)?.name || 'Phòng Thoại'}
                                </p>
                                <button
                                  onClick={() => handleJoinVoiceCall(inVoice.channelId)}
                                  className="w-full py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-transform hover:scale-[1.02] active:scale-95"
                                >
                                  <Volume2 className="w-3 h-3" />
                                  <span>Tham gia phòng</span>
                                </button>
                              </div>
                            )}

                            {!af.listening && !inVoice && !(af as any).custom_status && (
                              <p className="text-[10px] text-zinc-500 font-mono">
                                {effStatus === 'dnd' ? '⛔ Không làm phiền' : '● Trực tuyến trên Spytify'}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
            </>
          )
        ) : (
          <>
            {/* Channel Header Bar */}
            <div className={`h-12 px-4 border-b flex items-center justify-between flex-shrink-0 ${isLight ? 'bg-[#ffffff]/80 backdrop-blur border-[#e2e8f0]' : 'bg-black/50 backdrop-blur border-[#151520]'}`}>
          <div className="flex items-center gap-2 truncate">
            {isVoice ? (
              <Mic className="w-4 h-4 text-emerald-400" />
            ) : isStage ? (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            ) : (
              <Hash className="w-4 h-4 text-[#777]" />
            )}
            <h3 className={`text-xs font-bold tracking-wide truncate ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>{getChannelName(selectedChannel)}</h3>
            {selectedChannel.is_radio && canManageServer && (
              <button
                type="button"
                onClick={() => handleOpenEditStationModal(selectedChannel)}
                className="ml-1.5 px-2 py-0.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
                title="Sửa link YouTube hoặc chế độ phát sóng của trạm này"
              >
                <Edit3 className="w-3 h-3 text-amber-400" />
                <span>Sửa link phát</span>
              </button>
            )}
            {selectedChannel.topic && (
              <>
                <span className={isLight ? 'text-[#cbd5e1]' : 'text-[#333]'}>|</span>
                <p className={`text-[11px] font-mono truncate hidden sm:block ${isLight ? 'text-[#64748b]' : 'text-[#777]'}`}>{getChannelTopic(selectedChannel)}</p>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-[#777]">
            {/* Discord-style Member List Toggle Button (Single User Icon) */}
            <button
              onClick={toggleMemberList}
              title={getTranslation(language, 'community.toggleMemberList')}
              style={isMemberListVisible ? {
                backgroundColor: `${accentColor}25`,
                borderColor: `${accentColor}60`,
                color: accentColor,
                boxShadow: `0 0 10px ${accentColor}30`,
              } : undefined}
              className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                isMemberListVisible
                  ? ''
                  : isLight
                  ? 'bg-[#ffffff] hover:bg-[#f1f5f9] border-[#cbd5e1] text-[#64748b] hover:text-[#0f172a]'
                  : 'bg-[#12121c] hover:bg-[#1a1a2a] border-[#222234] text-[#888899] hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ──────── 3A. DISCORD VOICE CALL ROOM VIEW ──────── */}
        {isVoice ? (
          <div className={`flex-1 flex flex-col p-6 items-center justify-between overflow-y-auto ${
            isLight ? 'bg-gradient-to-b from-[#f8fafc] to-[#f1f5f9]' : 'bg-gradient-to-b from-[#08080f] to-[#040407]'
          }`}>
            {/* Discord-style Multi-Screen Share Stage View (Chia Tab chọn từng màn hình đang phát) */}
            {activeScreenShare && (
              <div className="w-full max-w-5xl flex flex-col items-center mb-4">
                {/* Thanh Tab chọn màn hình của từng người trong cuộc gọi */}
                <div className="w-full flex items-center justify-between gap-2 mb-2 px-1">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    {screenSharesList.map(ss => {
                      const isActiveTab = activeScreenShare.userId === ss.userId;
                      const isMine = ss.userId === myParticipantIdRef.current;
                      return (
                        <button
                          key={ss.userId}
                          type="button"
                          onClick={() => setSelectedScreenShareUserId(ss.userId)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer flex-shrink-0 ${
                            isActiveTab
                              ? 'shadow-lg'
                              : isLight
                              ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                              : 'bg-[#14151e] hover:bg-[#1c1e2b] border-white/10 text-zinc-300'
                          }`}
                          style={isActiveTab ? {
                            backgroundColor: `${accentColor}22`,
                            borderColor: accentColor,
                            color: isLight ? '#0f172a' : '#ffffff',
                          } : undefined}
                        >
                          <div className="w-4 h-4 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                            {renderAvatarContent(ss.userName, resolveUserAvatar(ss.userId, ss.avatar))}
                          </div>
                          <Monitor className="w-3.5 h-3.5 flex-shrink-0" style={{ color: isActiveTab ? accentColor : '#10b981' }} />
                          <span className="truncate max-w-[140px]">
                            {ss.userName}{isMine ? ` (${getTranslation(language, 'community.you')})` : ''}
                          </span>
                          <span className="px-1 py-0.2 rounded text-[8px] font-mono font-bold bg-red-600 text-white">
                            LIVE
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {screenSharesList.length > 1 && (
                    <span className="text-[10px] font-mono text-zinc-400 flex-shrink-0 px-2 py-1 rounded-lg bg-black/40 border border-white/10">
                      {screenSharesList.length} màn hình đang chia sẻ
                    </span>
                  )}
                </div>

                <div className="w-full rounded-2xl bg-black/90 border border-white/15 overflow-hidden shadow-2xl relative group">
                  {/* Top Screen Share Header Bar */}
                  <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between z-20">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                        <Monitor className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white tracking-wide">
                            {activeScreenShare.userName}
                            {activeScreenShare.userId === myParticipantIdRef.current ? ` (${getTranslation(language, 'community.you')})` : ''}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-red-600 text-white animate-pulse">
                            LIVE
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 font-mono">Đang chia sẻ màn hình trực tiếp</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {activeScreenShare.userId === myParticipantIdRef.current && (
                        <button
                          onClick={handleStopScreenShare}
                          className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <MonitorOff className="w-3.5 h-3.5" />
                          <span>Dừng chia sẻ</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (screenVideoRef.current) {
                            if (document.fullscreenElement) {
                              document.exitFullscreen().catch(() => {});
                            } else {
                              screenVideoRef.current.requestFullscreen().catch(() => {});
                            }
                          }
                        }}
                        className="p-1.5 rounded-lg bg-black/60 hover:bg-white/20 text-white transition-all cursor-pointer"
                        title="Toàn màn hình"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Video Stream Element */}
                  <video
                    key={activeScreenShare.userId}
                    ref={(el) => {
                      screenVideoRef.current = el;
                      if (el && activeScreenShare?.stream && el.srcObject !== activeScreenShare.stream) {
                        el.srcObject = activeScreenShare.stream;
                        el.play().catch(() => {});
                      }
                    }}
                    autoPlay
                    playsInline
                    muted={activeScreenShare?.userId === myParticipantIdRef.current}
                    className="w-full max-h-[62vh] object-contain bg-black"
                  />
                </div>
              </div>
            )}

            {/* Participants Grid */}
            <div className="w-full max-w-4xl flex flex-col items-center pt-2 pb-6">
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {/* Current User Card */}
                {isConnectedToCurrentVoice && (
                  <div 
                    className={`rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center relative aspect-[4/3] shadow-xl overflow-hidden group ${
                      isLight ? 'bg-[#ffffff] border-[#cbd5e1]' : 'bg-[#1e1f22] border-[#2b2d31]'
                    }`}
                    style={isUserSpeaking ? {
                      borderColor: accentColor,
                      boxShadow: `0 0 24px ${accentColor}50`
                    } : undefined}
                  >
                    <div className="relative">
                      <div 
                        className={`w-20 h-20 rounded-full overflow-hidden border-2 flex items-center justify-center text-xl font-bold transition-all ${
                          isLight ? 'border-[#cbd5e1] bg-[#f1f5f9] text-[#0f172a]' : 'border-white/20 bg-[#2b2d31] text-white'
                        }`}
                        style={isUserSpeaking ? {
                          borderColor: accentColor,
                          boxShadow: `0 0 20px ${accentColor}70`,
                        } : undefined}
                      >
                        {currentUser?.avatar ? (
                          <img src={currentUser.avatar} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span>{(currentUser?.display_name || 'B').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      {isMuted && (
                        <span className="absolute bottom-0 right-0 p-1.5 rounded-full bg-red-600 border-2 border-black text-white shadow-md">
                          <MicOff className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>

                    {/* Discord Bottom-left Tag */}
                    <div className={`absolute bottom-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-md border max-w-[85%] truncate ${
                      isLight ? 'bg-[#ffffff]/95 border-[#cbd5e1]' : 'bg-black/85 border-white/10'
                    }`}>
                      <span className={`text-xs font-bold tracking-wide truncate ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>
                        {myServerDisplayName}
                      </span>
                      <span className={`text-[10px] font-mono ${isLight ? 'text-[#64748b]' : 'text-zinc-400'}`}>({getTranslation(language, 'community.you')})</span>
                      {isScreenSharing && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedScreenShareUserId(myParticipantIdRef.current);
                          }}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[8px] font-mono font-bold bg-red-600 text-white border border-red-400/50 cursor-pointer flex-shrink-0"
                          title="Bạn đang chia sẻ màn hình — bấm để xem"
                        >
                          <Monitor className="w-2.5 h-2.5" />
                          <span>SHARE</span>
                        </button>
                      )}
                      {isUserSpeaking && (
                        <span className="w-2 h-2 rounded-full animate-ping ml-1" style={{ backgroundColor: accentColor }} />
                      )}
                    </div>
                  </div>
                )}

                {/* Other Invited / Real Participants */}
                {getEffectiveVoiceParticipants(selectedChannel).map(vp => (
                  <div
                    key={vp.id}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMemberMenu({
                        x: Math.min(e.clientX, window.innerWidth - 240),
                        y: Math.min(e.clientY, window.innerHeight - 300),
                        member: {
                          id: vp.id,
                          name: vp.name,
                          avatar: resolveUserAvatar(vp.id, vp.avatar),
                          role: (ACTIVE_BOT_IDS.has(vp.id) || vp.isBot) ? 'DJ' : (vp.isHost ? 'HOST' : 'MEMBER'),
                          isHost: vp.isHost,
                          status: 'online',
                          listening: vp.listeningTrack ? `${vp.listeningTrack.title} - ${vp.listeningTrack.artist}` : (vp.listening || null),
                          listeningTrack: vp.listeningTrack || null,
                        },
                        fromVoice: true,
                      });
                    }}
                    className={`rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center relative aspect-[4/3] shadow-xl overflow-hidden group cursor-pointer ${
                      isLight ? 'bg-[#ffffff] border-[#cbd5e1]' : 'bg-[#1e1f22] border-[#2b2d31]'
                    }`}
                    style={vp.isSpeaking ? {
                      borderColor: (ACTIVE_BOT_IDS.has(vp.id) || vp.isBot) ? '#10b981' : accentColor,
                      boxShadow: (ACTIVE_BOT_IDS.has(vp.id) || vp.isBot) ? '0 0 24px rgba(16, 185, 129, 0.5)' : `0 0 24px ${accentColor}50`
                    } : undefined}
                  >
                    {/* Discord Music Stream / Bot Speaker In-Room Banner */}
                    {(ACTIVE_BOT_IDS.has(vp.id) || vp.isBot) ? (() => {
                      const isBotSilenced = isBotMuted || Boolean(locallyMutedUsers[vp.id] || (connectedVoiceChannelObj?.dj_bot_id && locallyMutedUsers[connectedVoiceChannelObj.dj_bot_id]));
                      return (
                        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-auto">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const willSilence = !isBotSilenced;
                              setIsBotMuted(willSilence);
                              setLocallyMutedUsers(prev => ({ ...prev, [vp.id]: willSilence }));
                              if (willSilence) {
                                sendBotCmd('mute');
                                sendBotCmd('setVolume', [0]);
                                sendBotCmd('pauseVideo');
                                setIsBotSpeaking(false);
                                if (currentVoiceDjBot && currentTrack && (currentTrack.id === currentVoiceDjBot.track.id || currentTrack.path_or_url === currentVoiceDjBot.liveStreamId)) {
                                  onPauseTrack?.();
                                }
                              } else {
                                const botUserVol = userVolumes[vp.id] ?? 80;
                                const eff = isDeafened ? 0 : Math.round(botUserVol * (speakerVolume / 100));
                                if (eff > 0) {
                                  sendBotCmd('unMute');
                                  sendBotCmd('setVolume', [eff]);
                                  sendBotCmd('seekTo', [99999999, true]);
                                  sendBotCmd('playVideo');
                                  setIsBotSpeaking(true);
                                }
                              }
                            }}
                            title={isBotSilenced ? `Bật tiếng loa phòng (${vp.name})` : `Tắt tiếng loa phòng (${vp.name})`}
                            className={`px-2.5 py-1 rounded-lg bg-black/85 border text-[10px] font-mono font-bold flex items-center gap-1.5 cursor-pointer hover:scale-105 transition-transform shadow-lg ${
                              isBotSilenced ? 'border-red-500/60 text-red-400' : 'border-emerald-500/60 text-emerald-400'
                            }`}
                          >
                            {!isBotSilenced ? (
                              <>
                                <div className="flex items-end gap-0.5 h-3">
                                  <span className="w-0.5 bg-emerald-400 rounded-full animate-bounce h-2" style={{ animationDelay: '0ms' }} />
                                  <span className="w-0.5 bg-emerald-400 rounded-full animate-bounce h-3" style={{ animationDelay: '150ms' }} />
                                  <span className="w-0.5 bg-emerald-400 rounded-full animate-bounce h-1.5" style={{ animationDelay: '300ms' }} />
                                </div>
                                <span className="truncate max-w-[125px] text-white font-sans">
                                  {vp.listening || 'Live Radio 24/7'}
                                </span>
                                <span className="px-1 py-0.2 text-[8px] font-bold rounded bg-red-500/20 text-red-400 border border-red-500/30">
                                  LIVE
                                </span>
                              </>
                            ) : (
                              <>
                                <VolumeX className="w-3.5 h-3.5 text-red-400" />
                                <span className="text-red-300 font-sans">Loa phòng đã tắt</span>
                              </>
                            )}
                          </button>
                          <div className="flex items-center gap-1 bg-black/85 px-1.5 py-1 rounded-lg border border-white/10 backdrop-blur-sm">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleLocalMute(vp.id);
                              }}
                              className={`p-1 rounded-md transition-colors cursor-pointer ${
                                isBotSilenced
                                  ? 'bg-red-600 text-white shadow-sm'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                              title={isBotSilenced ? "Bật lại âm thanh bot" : "Tắt tiếng bot (Chỉ mình bạn)"}
                            >
                              {isBotSilenced ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                            </button>
                            {canManageServer && (
                              isDemandBotId(vp.id) ? (
                                <div className="flex items-center gap-0.5 ml-0.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      processBotMusicCommand(`/sk @${vp.id}`, { id: currentUser?.id || 'guest', name: myServerDisplayName, username: currentUser?.username || 'operative' });
                                    }}
                                    className="p-1 rounded bg-white/5 hover:bg-white/15 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                                    title="Bỏ qua bài hát hiện tại (/skip)"
                                  >
                                    <SkipForward className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      processBotMusicCommand(`/st @${vp.id}`, { id: currentUser?.id || 'guest', name: myServerDisplayName, username: currentUser?.username || 'operative' });
                                    }}
                                    className="p-1 rounded bg-white/5 hover:bg-white/15 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                                    title="Dừng phát và bot rời phòng (/stop)"
                                  >
                                    <Square className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRotateBotStream(vp.id, 'Người dùng bấm đổi luồng trên thẻ');
                                    }}
                                    className="p-1 rounded bg-white/5 hover:bg-white/15 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer ml-0.5"
                                    title="Tự động đổi sang luồng phát sóng 24/7 dự phòng khác cùng thể loại"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEditStationModal(connectedVoiceChannelObj || selectedChannel);
                                    }}
                                    className="p-1 rounded bg-white/5 hover:bg-white/15 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer ml-0.5"
                                    title="Sửa link YouTube hoặc chế độ phát sóng của trạm này"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                </>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })() : (
                      /* Top action bar: Track play or Volume / Local Mute */
                      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-auto">
                        {vp.listeningTrack ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayMemberTrack({ id: vp.id, name: vp.name, listening: vp.listening, listeningTrack: vp.listeningTrack });
                            }}
                            title={`Bấm để nghe cùng ${vp.name}!`}
                            className="px-2.5 py-1 rounded-lg bg-black/85 border text-[10px] font-mono font-bold flex items-center gap-1.5 cursor-pointer hover:scale-105 transition-transform shadow-lg"
                            style={{ borderColor: `${accentColor}70`, color: accentColor }}
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span className="truncate max-w-[120px] text-white font-sans">
                              {vp.listeningTrack.title || 'Phát nhạc'}
                            </span>
                          </button>
                        ) : <div />}

                        <div className="flex items-center gap-1.5 ml-auto bg-black/85 px-1.5 py-1 rounded-lg border border-white/10 backdrop-blur-sm">
                          {vp.id !== myParticipantIdRef.current ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleLocalMute(vp.id);
                              }}
                              className={`p-1 rounded-md transition-all cursor-pointer ${
                                locallyMutedUsers[vp.id]
                                  ? 'bg-red-600 text-white shadow-sm'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                              title={locallyMutedUsers[vp.id] ? "Bật tiếng (Unmute)" : "Tắt tiếng (Mute)"}
                            >
                              {locallyMutedUsers[vp.id] ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                            </button>
                          ) : (
                            <span className="text-[9px] font-mono text-emerald-400 px-1 py-0.5">
                              Mic: {isMuted ? 'Muted' : 'Live'}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="relative">
                      <div
                        className={`w-20 h-20 rounded-full overflow-hidden border-2 flex items-center justify-center text-xl font-bold transition-all ${
                          isLight ? 'border-[#cbd5e1] bg-[#f1f5f9] text-[#0f172a]' : 'border-white/20 bg-[#2b2d31] text-white'
                        }`}
                        style={vp.isSpeaking ? {
                          borderColor: (ACTIVE_BOT_IDS.has(vp.id) || vp.isBot) ? '#10b981' : accentColor,
                          boxShadow: (ACTIVE_BOT_IDS.has(vp.id) || vp.isBot) ? '0 0 20px rgba(16, 185, 129, 0.6)' : `0 0 20px ${accentColor}70`,
                        } : undefined}
                      >
                        {renderAvatarContent(vp.name, resolveUserAvatar(vp.id, vp.avatar))}
                      </div>
                      {vp.isMuted && (
                        <span className="absolute bottom-0 right-0 p-1.5 rounded-full bg-red-600 border-2 border-black text-white shadow-md">
                          <MicOff className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>

                    {/* Discord Bottom-left Tag */}
                    <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/85 border border-white/10 max-w-[85%] truncate">
                      <span className="text-xs font-bold text-white tracking-wide truncate">{vp.name}</span>
                      {(vp.isScreenSharing || Boolean(screenShares[vp.id])) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (screenShares[vp.id]) {
                              setSelectedScreenShareUserId(vp.id);
                            }
                          }}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[8px] font-mono font-bold bg-red-600 text-white border border-red-400/50 cursor-pointer flex-shrink-0 hover:bg-red-500"
                          title={`${vp.name} đang chia sẻ màn hình — bấm để xem`}
                        >
                          <Monitor className="w-2.5 h-2.5" />
                          <span>SHARE</span>
                        </button>
                      )}
                      {locallyMutedUsers[vp.id] && (
                        <span className="text-[8px] font-mono font-bold text-red-400 bg-red-400/20 border border-red-400/40 px-1 py-0.2 rounded flex items-center gap-0.5">
                          <VolumeX className="w-2.5 h-2.5" />
                          TẮT TIẾNG
                        </span>
                      )}
                      {(ACTIVE_BOT_IDS.has(vp.id) || vp.isBot) ? (
                        <span
                          className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded border flex items-center gap-1"
                          style={{ color: accentColor, backgroundColor: `${accentColor}20`, borderColor: `${accentColor}50` }}
                        >
                          <Radio className="w-2.5 h-2.5 animate-pulse" />
                          DJ
                        </span>
                      ) : vp.isHost ? (
                        <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded border text-amber-300 bg-amber-400/20 border-amber-400/40">
                          DJ
                        </span>
                      ) : (
                        <span className="text-[8px] font-mono text-zinc-400">
                          {userVolumes[vp.id] ?? 100}%
                        </span>
                      )}
                      {vp.isSpeaking && (
                        <span className="w-2 h-2 rounded-full animate-ping ml-1" style={{ backgroundColor: accentColor }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* In-Call Controls Bottom Dock — Discord Signature Floating Dock */}
            <div className="my-2 z-10">
              {!isConnectedToCurrentVoice ? (
                <div className="p-3 px-6 rounded-2xl bg-[#111214]/90 border border-[#26282c] shadow-2xl flex flex-col items-center gap-2">
                  <button
                    onClick={() => handleJoinVoiceCall()}
                    className="py-2.5 px-6 rounded-xl font-bold text-xs uppercase tracking-wider text-black bg-emerald-400 hover:bg-emerald-300 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(0,255,102,0.4)] hover:scale-[1.02]"
                  >
                    <PhoneCall className="w-4 h-4" />
                    <span>{getTranslation(language, 'community.reconnect')}</span>
                  </button>

                  <button
                    onClick={() => setIsAudioSettingsOpen(true)}
                    className="text-[11px] font-mono text-[#888] hover:text-[#00E5FF] flex items-center gap-1.5 transition-colors cursor-pointer py-1"
                  >
                    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{getTranslation(language, 'community.callAudioSettings')}</span>
                  </button>
                </div>
              ) : (
                <div className="p-2 px-4 rounded-full bg-[#111214]/90 border border-[#26282c] shadow-[0_12px_40px_rgba(0,0,0,0.7)] backdrop-blur-xl flex items-center gap-3">
                  {/* Mic Toggle Button */}
                  <button
                    onClick={handleToggleMute}
                    title={isMuted ? getTranslation(language, 'community.unmuteMic') : getTranslation(language, 'community.muteMic')}
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md ${
                      isMuted 
                        ? 'bg-red-600 hover:bg-red-500 text-white' 
                        : 'bg-[#2b2d31] hover:bg-[#35373c] text-white hover:text-emerald-400'
                    }`}
                  >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-emerald-400" />}
                  </button>

                  {/* Deafen Toggle Button */}
                  <button
                    onClick={handleToggleDeafen}
                    title={isDeafened ? getTranslation(language, 'community.unmuteSpeaker') : getTranslation(language, 'community.muteSpeaker')}
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md ${
                      isDeafened 
                        ? 'bg-red-600 hover:bg-red-500 text-white' 
                        : 'bg-[#2b2d31] hover:bg-[#35373c] text-white hover:text-cyan-400'
                    }`}
                  >
                    {isDeafened ? <VolumeX className="w-5 h-5" /> : <Headphones className="w-5 h-5 text-cyan-400" />}
                  </button>

                  {/* Screen Share Toggle Button (Discord style) */}
                  <button
                    onClick={isScreenSharing ? handleStopScreenShare : handleStartScreenShare}
                    title={isScreenSharing ? "Dừng chia sẻ màn hình" : "Chia sẻ màn hình"}
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md ${
                      isScreenSharing
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/40 animate-pulse'
                        : 'bg-[#2b2d31] hover:bg-[#35373c] text-white hover:text-emerald-400'
                    }`}
                  >
                    {isScreenSharing ? <MonitorOff className="w-5 h-5 text-black" /> : <Monitor className="w-5 h-5" />}
                  </button>

                  {/* Audio Settings Button */}
                  <button
                    onClick={() => setIsAudioSettingsOpen(true)}
                    className="w-11 h-11 rounded-full bg-[#2b2d31] hover:bg-[#35373c] text-zinc-300 hover:text-[#00E5FF] transition-all cursor-pointer flex items-center justify-center shadow-md"
                    title={getTranslation(language, 'community.voiceSettings')}
                  >
                    <Sliders className="w-5 h-5 text-emerald-400" />
                  </button>

                  {/* Disconnect Red Button */}
                  <button
                    onClick={handleLeaveVoiceCall}
                    className="px-5 h-11 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:scale-105 active:scale-95"
                    title={getTranslation(language, 'community.leaveRoom')}
                  >
                    <PhoneOff className="w-4 h-4" />
                    <span>{getTranslation(language, 'community.leaveRoom')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ──────── 3B. TEXT CHAT OR STAGE CHANNEL ──────── */
          <>
            {/* Live Stage DJ Booth Banner */}
            {isStage && (
              <div className="m-3 p-4 rounded-xl bg-gradient-to-r from-[#0d0d16] via-[#10101c] to-[#0d0d16] border border-[#202030] shadow-xl relative overflow-hidden flex-shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div 
                      className="w-12 h-12 rounded-xl overflow-hidden border border-white/20 flex items-center justify-center flex-shrink-0 shadow-lg relative group"
                      style={{ boxShadow: `0 0 16px ${selectedServer.accent_color}30` }}
                    >
                      {stageSession.current_track?.cover_art ? (
                        <img src={stageSession.current_track.cover_art} alt="cover" className="w-full h-full object-cover" />
                      ) : (
                        <Disc className="w-6 h-6 animate-spin text-white/80" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span 
                          className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase tracking-wider border"
                          style={{
                            backgroundColor: `${selectedServer.accent_color}20`,
                            color: selectedServer.accent_color,
                            borderColor: `${selectedServer.accent_color}40`,
                          }}
                        >
                          DJ LIVE STAGE
                        </span>
                        <span className="text-[10px] text-[#888] font-mono">Host: {stageSession.host_name}</span>
                      </div>
                      <h4 className="text-sm font-black text-white mt-0.5 tracking-tight">
                        {stageSession.current_track?.title || 'Chưa có bài hát nào được phát trên Sân khấu'}
                      </h4>
                      <p className="text-[11px] text-[#888] font-mono">
                        {stageSession.current_track?.artist || 'Bấm "Làm DJ" bên phải để phát nhạc của bạn cho cả phòng nghe'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {stageSession.current_track && (
                      <button
                        onClick={() => onPlayTrack(stageSession.current_track!)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-transform hover:scale-105"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Nghe cùng Host</span>
                      </button>
                    )}

                    {currentTrack && (
                      <button
                        onClick={handleBroadcastMyTrackAsHost}
                        className="px-3 py-1.5 rounded-lg bg-[#181824] hover:bg-[#202030] border border-[#303044] text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                        title="Phát bài bạn đang nghe lên sân khấu cho mọi người cùng thưởng thức"
                      >
                        <Disc className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Làm DJ Sân Khấu</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Messages Stream */}
            <div className={`flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar ${isLight ? 'bg-[#ffffff]' : 'bg-[#0a0a0f]'}`}>
              {messages
                .filter(
                  msg =>
                    (!msg.server_id || msg.server_id === selectedServer.id) &&
                    (!msg.channel_id || msg.channel_id === selectedChannel.id)
                )
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .map(msg => {
                  const isWelcomeMsg = msg.id.startsWith('msg_welcome_');
                  const inviteMatch = msg.content?.match(/spytify:\/\/station\/join\/([a-zA-Z0-9_-]+)/i);
                  const invitedSrvId = inviteMatch ? inviteMatch[1] : null;
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-3 -mx-2 px-2.5 py-1.5 rounded-xl transition-colors ${
                        isWelcomeMsg
                          ? isLight
                            ? 'bg-emerald-50/90 border border-emerald-200'
                            : 'bg-gradient-to-r from-emerald-950/35 via-[#0f1a18] to-transparent border border-emerald-500/30'
                          : isLight
                          ? 'hover:bg-[#f1f5f9]'
                          : 'hover:bg-[#101016]/40'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                      >
                        {renderAvatarContent(msg.display_name, resolveUserAvatar(msg.user_id, msg.avatar))}
                      </div>

                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs font-bold hover:underline cursor-pointer ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>
                            {msg.display_name}
                          </span>
                          <span className={`text-[10px] font-mono ${isLight ? 'text-[#64748b]' : 'text-[#555]'}`}>@{msg.username}</span>
                          {isWelcomeMsg && (
                            <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                              🎉 THÀNH VIÊN MỚI
                            </span>
                          )}
                          <span className={`text-[10px] font-mono ${isLight ? 'text-[#94a3b8]' : 'text-[#444]'}`}>{msg.created_at}</span>
                        </div>

                        {msg.content && (
                          <p
                            className={`text-xs leading-relaxed break-words font-sans ${
                              isWelcomeMsg
                                ? isLight
                                  ? 'text-emerald-900 font-semibold'
                                  : 'text-emerald-300 font-medium'
                                : isLight
                                ? 'text-[#334155]'
                                : 'text-[#ddd]'
                            }`}
                          >
                            {msg.content}
                          </p>
                        )}

                        {invitedSrvId && (
                          <div
                            className={`mt-2 max-w-sm p-3 rounded-xl border flex items-center justify-between gap-3 ${
                              isLight ? 'bg-emerald-50 border-emerald-200' : 'bg-[#0d1518] border-emerald-500/35'
                            }`}
                          >
                            <div className="truncate">
                              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-400 block">
                                📩 LỜI MỜI THAM GIA MÁY CHỦ
                              </span>
                              <p className={`text-xs font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                spytify://station/join/{invitedSrvId}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => joinServerAndWelcome(invitedSrvId)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs font-mono shrink-0 cursor-pointer transition-transform hover:scale-105"
                            >
                              Tham gia
                            </button>
                          </div>
                        )}

                        {/* Embedded Track Card */}
                        {msg.track_embed && (
                          <div className={`mt-2 max-w-sm p-2.5 rounded-xl border transition-colors flex items-center justify-between gap-3 shadow-md ${
                            isLight ? 'bg-[#ffffff] border-[#cbd5e1] hover:border-[#94a3b8]' : 'bg-[#12121c] border-[#222234] hover:border-white/30'
                          }`}>
                            <div className="flex items-center gap-2.5 truncate">
                              <div className={`w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 ${
                                isLight ? 'bg-[#f1f5f9]' : 'bg-[#1a1a26]'
                              }`}>
                                {msg.track_embed.cover_art ? (
                                  <img src={msg.track_embed.cover_art} alt="cover" className="w-full h-full object-cover" />
                                ) : (
                                  <Music className="w-4 h-4 text-[#888]" />
                                )}
                              </div>
                              <div className="truncate">
                                <p className={`text-xs font-bold truncate ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>{msg.track_embed.title}</p>
                                <p className={`text-[10px] font-mono truncate ${isLight ? 'text-[#64748b]' : 'text-[#888]'}`}>{msg.track_embed.artist}</p>
                              </div>
                            </div>

                            <button
                              onClick={() => onPlayTrack(msg.track_embed!)}
                              className={`p-2 rounded-lg transition-all cursor-pointer flex-shrink-0 ${
                                isLight ? 'bg-[#f1f5f9] hover:bg-[#0f172a] text-[#0f172a] hover:text-white' : 'bg-white/10 hover:bg-white text-white hover:text-black'
                              }`}
                              title="Phát bài này"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </button>
                          </div>
                        )}
                        {/* Embedded Attached Image */}
                        {msg.image_url && (
                          <div className="mt-2">
                            <img
                              src={msg.image_url}
                              alt="Ảnh đính kèm"
                              onClick={() => setLightboxImageUrl(msg.image_url!)}
                              className="max-w-[320px] max-h-[260px] rounded-xl object-cover cursor-pointer hover:opacity-95 transition-all border border-white/10 shadow-lg hover:scale-[1.01]"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input Box */}
            <div className={`p-3 border-t flex-shrink-0 relative ${isLight ? 'bg-[#ffffff] border-[#e2e8f0]' : 'bg-[#07070a] border-[#151520]'}`}>
              {/* Slash Command Autocomplete Popover */}
              {(() => {
                const slashFilter = inputText.startsWith('/') ? inputText.trim().toLowerCase() : '';
                const filteredSlashCommands = slashFilter
                  ? BOT_SLASH_COMMANDS.filter(c =>
                      c.name.toLowerCase().startsWith(slashFilter) ||
                      (c.alias && c.alias.toLowerCase().startsWith(slashFilter))
                    )
                  : [];
                const showSlashAutocomplete =
                  !slashDismissed &&
                  inputText.startsWith('/') &&
                  !inputText.includes(' ') &&
                  filteredSlashCommands.length > 0;

                if (showSlashAutocomplete) {
                  return (
                    <div className={`absolute bottom-full left-3 right-3 mb-2 rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-xl z-50 transition-all ${
                      isLight ? 'bg-white/95 border-slate-300 text-slate-800' : 'bg-[#101018]/95 border-cyan-500/30 text-white'
                    }`}>
                      <div className={`px-3 py-2 border-b flex items-center justify-between text-[10px] font-mono uppercase tracking-wider font-bold ${
                        isLight ? 'bg-slate-100/90 text-slate-600 border-slate-200' : 'bg-black/70 text-cyan-400 border-white/10'
                      }`}>
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                          <span>LỆNH BOT ÂM NHẠC ({filteredSlashCommands.length})</span>
                        </span>
                        <span className="text-[9px] text-[#888] font-mono lowercase">dùng ↑ ↓ để chọn • Enter/Tab để chèn</span>
                      </div>

                      <div className="max-h-56 overflow-y-auto py-1 divide-y divide-white/5 no-scrollbar">
                        {filteredSlashCommands.map((cmd, idx) => {
                          const isSelected = idx === selectedSlashIndex;
                          return (
                            <button
                              key={cmd.id}
                              type="button"
                              onClick={() => {
                                setInputText(cmd.insertText);
                                setSlashDismissed(false);
                                chatTextInputRef.current?.focus();
                              }}
                              onMouseEnter={() => setSelectedSlashIndex(idx)}
                              className={`w-full px-3 py-2 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                                isSelected
                                  ? isLight
                                    ? 'bg-cyan-50 text-cyan-900 font-medium'
                                    : 'bg-cyan-500/20 text-white'
                                  : isLight
                                  ? 'hover:bg-slate-100 text-slate-700'
                                  : 'hover:bg-white/5 text-[#ccc]'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded border ${
                                  isSelected
                                    ? 'bg-cyan-500/30 text-cyan-300 border-cyan-400/50'
                                    : 'bg-black/40 text-cyan-400 border-cyan-500/20'
                                }`}>
                                  {cmd.name}
                                </span>
                                <span className="text-[11px] font-mono text-zinc-400 truncate">
                                  {cmd.syntax.replace(cmd.name, '').trim()}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-[11px] text-[#888] truncate max-w-[240px]">
                                  {cmd.description}
                                </span>
                                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold ${
                                  cmd.category === 'Âm nhạc'
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                    : cmd.category === 'Điều khiển'
                                    ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                }`}>
                                  {cmd.category}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                // Autocomplete @id_bot khi người dùng gõ `/play @...` hoặc `/sk @...`
                const slashMentionMatch = inputText.match(/^(\/(?:p|play|sk|skip|st|stop|q|queue|pause|resume|l|loop)\s+)@([^\s]*)$/i);
                const botFilter = slashMentionMatch ? (slashMentionMatch[2] || '').toLowerCase() : '';
                const filteredMentionBots = slashMentionMatch
                  ? demandMusicBots.filter(b =>
                      b.id.toLowerCase().includes(botFilter) ||
                      (b.username || '').toLowerCase().includes(botFilter) ||
                      (b.display_name || '').toLowerCase().includes(botFilter)
                    )
                  : [];
                const showBotMentionAutocomplete = Boolean(!mentionBotDismissed && slashMentionMatch && filteredMentionBots.length > 0);
                if (!showBotMentionAutocomplete) return null;

                const prefixCmd = slashMentionMatch![1];
                return (
                  <div className={`absolute bottom-full left-3 right-3 mb-2 rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-xl z-50 transition-all ${
                    isLight ? 'bg-white/95 border-slate-300 text-slate-800' : 'bg-[#101018]/95 border-cyan-500/30 text-white'
                  }`}>
                    <div className={`px-3 py-2 border-b flex items-center justify-between text-[10px] font-mono uppercase tracking-wider font-bold ${
                      isLight ? 'bg-slate-100/90 text-slate-600 border-slate-200' : 'bg-black/70 text-cyan-400 border-white/10'
                    }`}>
                      <span className="flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                        <span>CHỌN BOT YÊU CẦU (@id_bot)</span>
                      </span>
                      <span className="text-[9px] text-[#888] font-mono lowercase">↑ ↓ để chọn • Enter/Tab để chèn</span>
                    </div>
                    <div className="max-h-52 overflow-y-auto py-1 divide-y divide-white/5 no-scrollbar">
                      {filteredMentionBots.map((dbot, idx) => {
                        const isSelected = idx === selectedMentionBotIndex;
                        const orderIndex = demandMusicBots.findIndex(x => x.id === dbot.id);
                        return (
                          <button
                            key={dbot.id}
                            type="button"
                            onClick={() => {
                              setInputText(`${prefixCmd}@${dbot.id} `);
                              setMentionBotDismissed(true);
                              chatTextInputRef.current?.focus();
                            }}
                            onMouseEnter={() => setSelectedMentionBotIndex(idx)}
                            className={`w-full px-3 py-2 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                              isSelected
                                ? isLight
                                  ? 'bg-cyan-50 text-cyan-900 font-medium'
                                  : 'bg-cyan-500/20 text-white'
                                : isLight
                                ? 'hover:bg-slate-100 text-slate-700'
                                : 'hover:bg-white/5 text-[#ccc]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-6 h-6 rounded-md overflow-hidden bg-zinc-800 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
                                {renderAvatarContent(dbot.display_name, dbot.avatar)}
                              </div>
                              <span className="text-xs font-bold truncate">{dbot.display_name}</span>
                              <span className="text-[11px] font-mono text-cyan-400 truncate">@{dbot.id}</span>
                            </div>
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold ${
                              orderIndex === 0
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                            }`}>
                              {orderIndex === 0 ? '#1 Mặc định (/play)' : `#${orderIndex + 1}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {pendingChatImage && (
                <div className="relative inline-block mb-2 rounded-xl overflow-hidden border border-white/20 shadow-lg group">
                  <img src={pendingChatImage} alt="Ảnh chuẩn bị gửi" className="max-h-28 rounded-xl object-cover" />
                  <button
                    type="button"
                    onClick={() => setPendingChatImage(null)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/80 hover:bg-red-600 text-white transition-all cursor-pointer shadow"
                    title="Xóa ảnh đính kèm"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {attachCurrentTrack && currentTrack && (
                <div className={`mb-2 p-1.5 px-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
                  isLight ? 'bg-[#f8fafc] border-[#cbd5e1] text-[#334155]' : 'bg-[#12121a] border-[#242434] text-[#aaa]'
                }`}>
                  <span className="flex items-center gap-2 truncate text-cyan-400">
                    <Music className="w-3.5 h-3.5" />
                    {getTranslation(language, 'community.attachTrack')} <b className={`truncate ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>{currentTrack.title} - {currentTrack.artist}</b>
                  </span>
                  <button 
                    onClick={() => setAttachCurrentTrack(false)} 
                    className="text-[#666] hover:text-white cursor-pointer ml-2"
                  >
                    ✕
                  </button>
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <input
                  ref={chatImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSelectChatImage}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => chatImageInputRef.current?.click()}
                  className={`p-2 rounded-xl border transition-colors cursor-pointer flex-shrink-0 ${
                    pendingChatImage
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : isLight
                      ? 'bg-[#f1f5f9] border-[#cbd5e1] text-[#64748b] hover:text-[#0f172a]'
                      : 'bg-[#101016] border-[#222230] text-[#777] hover:text-white'
                  }`}
                  title="Gửi file ảnh lên kênh chat"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>

                {currentTrack && (
                  <button
                    type="button"
                    onClick={() => setAttachCurrentTrack(p => !p)}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer flex-shrink-0 ${
                      attachCurrentTrack 
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' 
                        : isLight 
                        ? 'bg-[#f1f5f9] border-[#cbd5e1] text-[#64748b] hover:text-[#0f172a]' 
                        : 'bg-[#101016] border-[#222230] text-[#777] hover:text-white'
                    }`}
                    title={getTranslation(language, 'community.attachTrackTooltip')}
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                )}

                <input
                  ref={chatTextInputRef}
                  type="text"
                  value={inputText}
                  onChange={e => {
                    setInputText(e.target.value);
                    setSlashDismissed(false);
                    setSelectedSlashIndex(0);
                    setMentionBotDismissed(false);
                    setSelectedMentionBotIndex(0);
                  }}
                  onKeyDown={e => {
                    const slashFilter = inputText.startsWith('/') ? inputText.trim().toLowerCase() : '';
                    const filtered = slashFilter
                      ? BOT_SLASH_COMMANDS.filter(c =>
                          c.name.toLowerCase().startsWith(slashFilter) ||
                          (c.alias && c.alias.toLowerCase().startsWith(slashFilter))
                        )
                      : [];
                    const isAutocompleteActive = !slashDismissed && inputText.startsWith('/') && !inputText.includes(' ') && filtered.length > 0;
                    if (isAutocompleteActive) {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setSelectedSlashIndex(prev => (prev + 1) % filtered.length);
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setSelectedSlashIndex(prev => (prev - 1 + filtered.length) % filtered.length);
                      } else if (e.key === 'Enter' || e.key === 'Tab') {
                        const selected = filtered[selectedSlashIndex];
                        if (selected) {
                          e.preventDefault();
                          setInputText(selected.insertText);
                          setSlashDismissed(true);
                        }
                      } else if (e.key === 'Escape') {
                        setSlashDismissed(true);
                      }
                      return;
                    }

                    const slashMentionMatch = inputText.match(/^(\/(?:p|play|sk|skip|st|stop|q|queue|pause|resume|l|loop)\s+)@([^\s]*)$/i);
                    const botFilter = slashMentionMatch ? (slashMentionMatch[2] || '').toLowerCase() : '';
                    const filteredBots = slashMentionMatch
                      ? demandMusicBots.filter(b =>
                          b.id.toLowerCase().includes(botFilter) ||
                          (b.username || '').toLowerCase().includes(botFilter) ||
                          (b.display_name || '').toLowerCase().includes(botFilter)
                        )
                      : [];
                    const isBotMentionActive = Boolean(!mentionBotDismissed && slashMentionMatch && filteredBots.length > 0);
                    if (!isBotMentionActive) return;

                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelectedMentionBotIndex(prev => (prev + 1) % filteredBots.length);
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedMentionBotIndex(prev => (prev - 1 + filteredBots.length) % filteredBots.length);
                    } else if (e.key === 'Enter' || e.key === 'Tab') {
                      const picked = filteredBots[selectedMentionBotIndex % filteredBots.length];
                      if (picked && slashMentionMatch) {
                        e.preventDefault();
                        setInputText(`${slashMentionMatch[1]}@${picked.id} `);
                        setMentionBotDismissed(true);
                      }
                    } else if (e.key === 'Escape') {
                      setMentionBotDismissed(true);
                    }
                  }}
                  placeholder={getTranslation(language, 'community.sendMessageTo', { channel: selectedChannel.name })}
                  className={`flex-1 px-3.5 py-2.5 rounded-xl text-xs border outline-none transition-colors font-sans ${
                    isLight 
                      ? 'bg-[#f8fafc] text-[#0f172a] border-[#cbd5e1] placeholder-[#94a3b8] focus:border-[#64748b]' 
                      : 'bg-[#101018] text-white border-[#222232] placeholder-[#666] focus:border-white/50'
                  }`}
                />

                <button
                  type="submit"
                  disabled={!inputText.trim() && !attachCurrentTrack && !pendingChatImage}
                  className="p-2.5 rounded-xl text-black font-bold flex items-center justify-center transition-all cursor-pointer disabled:opacity-40"
                  style={{
                    backgroundColor: accentColor,
                    color: accentColor === '#FFFFFF' ? '#000000' : '#FFFFFF',
                  }}
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        )}
          </>
        )}
      </div>

      {/* ──────────────── 4. SERVER MEMBERS LIST (RIGHT RAIL - CHỈ HIỆN KHI ĐANG Ở TRONG MỘT SERVER) ──────────────── */}
      {hasActiveServer && (
        <div 
          className={`border-l flex flex-col overflow-y-auto no-scrollbar text-xs select-none transition-all duration-300 ease-in-out ${
            isLight ? 'bg-[#f8fafc] border-[#e2e8f0]' : 'bg-[#07070b] border-[#15151e]'
          } ${
            isMemberListVisible 
              ? 'w-52 p-3 opacity-100 flex-shrink-0' 
              : 'w-0 p-0 border-l-0 opacity-0 overflow-hidden pointer-events-none'
          }`}
        >
          <div className={`flex items-center justify-between mb-2 pb-1.5 border-b ${isLight ? 'border-[#e2e8f0]' : 'border-[#14141e]'}`}>
            <div className="truncate pr-1">
              <p className={`text-[10px] font-mono font-bold uppercase tracking-wider ${isLight ? 'text-[#64748b]' : 'text-[#888]'}`}>
                {language === 'vi' ? 'THÀNH VIÊN' : 'MEMBERS'} — {onlineMembers.length}
              </p>
              <p className="text-[9px] font-mono text-[#666] truncate">
                {selectedServer.name}
              </p>
            </div>
            <button
              onClick={toggleMemberList}
              title={getTranslation(language, 'community.toggleMemberList')}
              className={`p-1 rounded transition-colors cursor-pointer shrink-0 ${
                isLight ? 'hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a]' : 'hover:bg-[#161622] text-[#666] hover:text-white'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 1. SECTION: BOT PHÁT NHẠC (DJ BOTS ĐƯỢC ĐÁNH TAG VÀ NHÓM RIÊNG) */}
          {botMembers.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 px-1 py-1 mb-1 text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                <Radio className="w-3 h-3 animate-pulse" />
                <span>{language === 'vi' ? 'BOT PHÁT NHẠC' : 'MUSIC BOTS'} — {botMembers.length}</span>
              </div>
              <div className="space-y-1">
                {botMembers.map(mem => {
                  return (
                    <div
                      key={mem.id}
                      onMouseEnter={(e) => {
                        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                        const rect = e.currentTarget.getBoundingClientRect();
                        const tags = resolveMemberTags(mem.id, selectedServer);
                        const userProfile = registeredUsers.find(u => u.id === mem.id) || INITIAL_USERS.find(u => u.id === mem.id);
                        const djOpt = DJ_BOT_OPTIONS.find(d => d.id === mem.id);
                        setHoveredProfile({
                          member: mem,
                          rect,
                          tags,
                          bio: userProfile?.bio || (djOpt ? `Resident DJ Bot phát sóng trực tiếp 24/24 tại ${selectedServer.name}.` : 'Bot phát nhạc hệ thống Spytify.'),
                        });
                      }}
                      onMouseLeave={() => {
                        hoverTimeoutRef.current = setTimeout(() => {
                          setHoveredProfile(null);
                        }, 220);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setMemberMenu({
                          x: Math.min(e.clientX, window.innerWidth - 220),
                          y: Math.min(e.clientY, window.innerHeight - 240),
                          member: mem,
                        });
                      }}
                      className={`flex flex-col p-1.5 rounded-lg transition-all cursor-pointer group ${
                        isLight ? 'hover:bg-[#e2e8f0]' : 'hover:bg-[#12121c]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative flex-shrink-0">
                          <div
                            className={`w-7 h-7 rounded-lg overflow-hidden border flex items-center justify-center font-bold text-[10px] ${
                              isLight ? 'bg-[#ffffff] border-emerald-400/60 text-[#0f172a]' : 'bg-[#14141e] border-emerald-500/50 text-white'
                            }`}
                          >
                            {renderAvatarContent(mem.name, resolveUserAvatar(mem.id, mem.avatar))}
                          </div>
                          {renderStatusDot('online', 'sm')}
                        </div>
                        <div className="truncate flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <HoverMarquee text={mem.name} className="text-xs font-bold text-emerald-400 flex-1 min-w-0" />
                            <span className="text-[8px] font-mono font-bold text-emerald-400 bg-emerald-400/15 border border-emerald-400/30 px-1 py-0.2 rounded flex-shrink-0">
                              DJ BOT
                            </span>
                          </div>
                          {mem.listening && (
                            <p className="text-[9px] text-cyan-400/80 font-mono truncate flex items-center gap-1 mt-0.5">
                              <Activity className="w-2.5 h-2.5 animate-pulse" />
                              {mem.listening}
                            </p>
                          )}
                        </div>

                        {/* 3-dots Menu Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMemberMenu({
                              x: Math.min(rect.left - 180, window.innerWidth - 220),
                              y: Math.min(rect.bottom + 4, window.innerHeight - 240),
                              member: mem,
                            });
                          }}
                          title={language === 'vi' ? 'Tùy chỉnh âm lượng bot hoặc mời vào voice' : 'Bot volume or invite to voice'}
                          className="p-1 rounded hover:bg-white/10 text-[#666] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity ml-auto cursor-pointer flex-shrink-0"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. SECTION: THÀNH VIÊN TRỰC TUYẾN */}
          {humanOnlineMembers.length > 0 && (
            <div className="mb-3">
              <div className={`px-1 py-1 mb-1 text-[9px] font-mono font-bold uppercase tracking-wider ${isLight ? 'text-[#64748b]' : 'text-[#888]'}`}>
                {language === 'vi' ? 'TRỰC TUYẾN' : 'ONLINE'} — {humanOnlineMembers.length}
              </div>
              <div className="space-y-1">
                {humanOnlineMembers.map(mem => {
                  return (
                    <div
                      key={mem.id}
                      onMouseEnter={(e) => {
                        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                        const rect = e.currentTarget.getBoundingClientRect();
                        const isMe = mem.id === 'usr_me' || (currentUser && mem.id === currentUser.id) || (myParticipantIdRef.current && mem.id === myParticipantIdRef.current);
                        const tags = resolveMemberTags(mem.id, selectedServer);
                        const userProfile = registeredUsers.find(u => u.id === mem.id) || INITIAL_USERS.find(u => u.id === mem.id);
                        const memberBio = isMe ? myBio : (realtimeUserPresences[mem.id]?.bio || userProfile?.bio || (mem as any).bio || 'Thành viên cộng đồng Spytify.');
                        const memberThought = isMe ? myUserThought : (realtimeUserPresences[mem.id]?.thought || (mem as any).thought || null);
                        setHoveredProfile({
                          member: {
                            ...mem,
                            thought: memberThought,
                          },
                          rect,
                          tags,
                          bio: memberBio,
                        });
                      }}
                      onMouseLeave={() => {
                        hoverTimeoutRef.current = setTimeout(() => {
                          setHoveredProfile(null);
                        }, 220);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setMemberMenu({
                          x: Math.min(e.clientX, window.innerWidth - 220),
                          y: Math.min(e.clientY, window.innerHeight - 240),
                          member: mem,
                        });
                      }}
                      className={`flex flex-col p-1.5 rounded-lg transition-all cursor-pointer group ${
                        isLight ? 'hover:bg-[#e2e8f0]' : 'hover:bg-[#12121c]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative flex-shrink-0">
                          <div
                            className={`w-7 h-7 rounded-lg overflow-hidden border flex items-center justify-center font-bold text-[10px] ${
                              isLight ? 'bg-[#ffffff] border-[#cbd5e1] text-[#0f172a]' : 'bg-[#14141e] border-white/10 text-white'
                            }`}
                          >
                            {renderAvatarContent(mem.name, resolveUserAvatar(mem.id, mem.avatar))}
                          </div>
                          {renderStatusDot(mem.status, 'sm')}
                        </div>
                        <div className="truncate flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <HoverMarquee text={mem.name} className={`text-xs font-semibold flex-1 min-w-0 ${isLight ? 'text-[#0f172a]' : 'text-zinc-300'}`} />
                            {isMemberServerOwner(mem.id) && (
                              <span
                                title={language === 'vi' ? `Chủ Server ${selectedServer.name}` : `Server Owner of ${selectedServer.name}`}
                                className="text-[8px] font-mono font-bold text-amber-400 bg-amber-400/15 border border-amber-400/30 px-1 py-0.2 rounded flex items-center gap-0.5 flex-shrink-0"
                              >
                                <Crown className="w-2.5 h-2.5" />
                                {language === 'vi' ? 'CHỦ' : 'OWNER'}
                              </span>
                            )}
                            {!isMemberServerOwner(mem.id) && isMemberModerator(mem.id) && (
                              <span
                                title={language === 'vi' ? `Điều hành viên (Mod) tại ${selectedServer.name}` : `Moderator at ${selectedServer.name}`}
                                className="text-[8px] font-mono font-bold text-emerald-400 bg-emerald-400/15 border border-emerald-400/30 px-1 py-0.2 rounded flex items-center gap-0.5 flex-shrink-0"
                              >
                                <Shield className="w-2.5 h-2.5" />
                                MOD
                              </span>
                            )}
                          </div>
                          {(mem as any).custom_status && (
                            <p className="text-[9px] text-zinc-400 font-mono italic truncate flex items-center gap-1 mt-0.5">
                              <span>💬</span>
                              <span className="truncate">{(mem as any).custom_status}</span>
                            </p>
                          )}
                          {mem.listening && (
                            <p className="text-[9px] text-cyan-400/80 font-mono truncate flex items-center gap-1 mt-0.5">
                              <Activity className="w-2.5 h-2.5 animate-pulse" />
                              {mem.listening}
                            </p>
                          )}
                        </div>

                        {/* 3-dots Menu Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMemberMenu({
                              x: Math.min(rect.left - 180, window.innerWidth - 220),
                              y: Math.min(rect.bottom + 4, window.innerHeight - 240),
                              member: mem,
                            });
                          }}
                          title={mem.id === 'usr_me' ? (language === 'vi' ? 'Tùy chỉnh trạng thái & Biệt danh Server' : 'Edit status & server nickname') : getTranslation(language, 'community.inviteToVoice')}
                          className="p-1 rounded hover:bg-white/10 text-[#666] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity ml-auto cursor-pointer flex-shrink-0"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. SECTION: THÀNH VIÊN NGOẠI TUYẾN */}
          {humanOfflineMembers.length > 0 && (
            <div>
              <div className={`px-1 py-1 mb-1 text-[9px] font-mono font-bold uppercase tracking-wider ${isLight ? 'text-[#94a3b8]' : 'text-[#555]'}`}>
                {language === 'vi' ? 'NGOẠI TUYẾN' : 'OFFLINE'} — {humanOfflineMembers.length}
              </div>
              <div className="space-y-1">
                {humanOfflineMembers.map(mem => {
                  return (
                    <div
                      key={mem.id}
                      onMouseEnter={(e) => {
                        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                        const rect = e.currentTarget.getBoundingClientRect();
                        const isMe = mem.id === 'usr_me' || (currentUser && mem.id === currentUser.id) || (myParticipantIdRef.current && mem.id === myParticipantIdRef.current);
                        const tags = resolveMemberTags(mem.id, selectedServer);
                        const userProfile = registeredUsers.find(u => u.id === mem.id) || INITIAL_USERS.find(u => u.id === mem.id);
                        const memberBio = isMe ? myBio : (realtimeUserPresences[mem.id]?.bio || userProfile?.bio || (mem as any).bio || 'Thành viên cộng đồng Spytify.');
                        const memberThought = isMe ? myUserThought : (realtimeUserPresences[mem.id]?.thought || (mem as any).thought || null);
                        setHoveredProfile({
                          member: {
                            ...mem,
                            thought: memberThought,
                          },
                          rect,
                          tags,
                          bio: memberBio,
                        });
                      }}
                      onMouseLeave={() => {
                        hoverTimeoutRef.current = setTimeout(() => {
                          setHoveredProfile(null);
                        }, 220);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setMemberMenu({
                          x: Math.min(e.clientX, window.innerWidth - 220),
                          y: Math.min(e.clientY, window.innerHeight - 240),
                          member: mem,
                        });
                      }}
                      className={`flex flex-col p-1.5 rounded-lg transition-all cursor-pointer group opacity-60 hover:opacity-100 ${
                        isLight ? 'hover:bg-[#e2e8f0]' : 'hover:bg-[#12121c]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative flex-shrink-0">
                          <div
                            className={`w-7 h-7 rounded-lg overflow-hidden border flex items-center justify-center font-bold text-[10px] ${
                              isLight ? 'bg-[#ffffff] border-[#cbd5e1] text-[#0f172a]' : 'bg-[#14141e] border-white/10 text-white'
                            }`}
                          >
                            {renderAvatarContent(mem.name, resolveUserAvatar(mem.id, mem.avatar))}
                          </div>
                          {renderStatusDot(mem.status, 'sm')}
                        </div>
                        <div className="truncate flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <HoverMarquee text={mem.name} className={`text-xs font-semibold flex-1 min-w-0 ${isLight ? 'text-[#0f172a]' : 'text-zinc-400'}`} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────── MEMBER CONTEXT MENU (CHUỘT PHẢI ĐỂ MỜI DJ VÀO CHAT) ──────────────── */}
      {memberMenu && (
        <div 
          className={`fixed z-50 w-56 rounded-xl shadow-2xl py-1 text-xs animate-in fade-in duration-150 border ${
            isLight ? 'bg-[#ffffff] border-[#cbd5e1] text-[#0f172a]' : 'bg-[#0e0e18] border-[#26263a] text-white'
          }`}
          style={{ top: memberMenu.y, left: memberMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`px-3 py-1.5 border-b flex items-center gap-2 ${isLight ? 'border-[#e2e8f0]' : 'border-[#1c1c28]'}`}>
            <div className={`w-6 h-6 rounded-full overflow-hidden border flex items-center justify-center font-bold text-[10px] ${
              isLight ? 'bg-[#f1f5f9] border-[#cbd5e1] text-[#0f172a]' : 'bg-[#181826] border-white/20 text-white'
            }`}>
              {renderAvatarContent(
                memberMenu.member.name,
                resolveUserAvatar(memberMenu.member.id, memberMenu.member.avatar)
              )}
            </div>
            <div className="truncate flex-1">
              <p className={`font-bold truncate text-[11px] ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>{memberMenu.member.name}</p>
              <p className="text-[9px] font-mono" style={{ color: accentColor }}>{memberMenu.member.role}</p>
            </div>
          </div>

          <div className="p-1 space-y-0.5">
            {memberMenu.member.id === 'usr_me' && (
              <>
                <div className="px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-wider text-[#777]">
                  Trạng thái của bạn
                </div>
                <button
                  onClick={() => { handleChangeMyStatus('online'); setMemberMenu(null); }}
                  className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left cursor-pointer transition-colors ${
                    myStatus === 'online' ? 'bg-white/10 font-bold' : 'hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
                    <span>Trực tuyến</span>
                  </span>
                  {myStatus === 'online' && <Check className="w-3.5 h-3.5" style={{ color: accentColor }} />}
                </button>
                <button
                  onClick={() => { handleChangeMyStatus('dnd'); setMemberMenu(null); }}
                  className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left cursor-pointer transition-colors ${
                    myStatus === 'dnd' ? 'bg-white/10 font-bold' : 'hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex items-center justify-center">
                      <span className="w-1.5 h-[1.5px] bg-white rounded-full" />
                    </span>
                    <span>Bận (Không làm phiền)</span>
                  </span>
                  {myStatus === 'dnd' && <Check className="w-3.5 h-3.5 text-red-400" />}
                </button>
                <button
                  onClick={() => { handleChangeMyStatus('invisible'); setMemberMenu(null); }}
                  className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left cursor-pointer transition-colors ${
                    myStatus === 'invisible' ? 'bg-white/10 font-bold' : 'hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <EyeOff className="w-3 h-3 text-zinc-400" />
                    <span>Vô hình (Ẩn đèn online)</span>
                  </span>
                  {myStatus === 'invisible' && <Check className="w-3.5 h-3.5 text-zinc-400" />}
                </button>
                <button
                  onClick={handleOpenNicknameModal}
                  className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left cursor-pointer transition-colors border-t border-white/10 mt-1 pt-1.5"
                  style={{ color: accentColor }}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span className="font-semibold">Đổi tên hiển thị trên Server</span>
                </button>
                <button
                  onClick={() => {
                    setMemberMenu(null);
                    handleOpenTagSelectModal();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left cursor-pointer transition-colors border-t border-white/10 mt-1 pt-1.5 text-cyan-400 hover:bg-cyan-500/10"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span className="font-semibold">Chọn Tag sở thích Server</span>
                </button>
                <div className="my-1 border-t border-white/10" />
              </>
            )}

            {/* Play listening track */}
            {memberMenu.member.listening && (
              <button
                onClick={() => {
                  handlePlayMemberTrack(memberMenu.member);
                  setMemberMenu(null);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg text-cyan-300 font-medium flex items-center gap-2 text-left cursor-pointer transition-colors"
                style={{
                  backgroundColor: `${accentColor}20`,
                  color: accentColor,
                }}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span className="truncate">{language === 'vi' ? 'Nghe cùng' : 'Listen Along'} ({memberMenu.member.listening})</span>
              </button>
            )}

            {/* Profile */}
            <button
              onClick={() => {
                const found = registeredUsers.find(x => x.id === memberMenu.member.id);
                const u = found
                  ? {
                      ...found,
                      listening: memberMenu.member.listening ?? found.listening ?? null,
                      listeningTrack: memberMenu.member.listeningTrack ?? found.listeningTrack ?? null,
                    }
                  : {
                      id: memberMenu.member.id,
                      username: memberMenu.member.name.toLowerCase().replace(/\s+/g, ''),
                      display_name: memberMenu.member.name,
                      avatar: memberMenu.member.avatar || null,
                      role: memberMenu.member.role,
                      status: 'online' as const,
                      bio: `Thành viên tại ${selectedServer.name}`,
                      listening: memberMenu.member.listening || null,
                      listeningTrack: memberMenu.member.listeningTrack || null,
                      isHost: memberMenu.member.isHost,
                      followsCurrentUser: false,
                    };
                setSelectedProfileUser(u);
                setMemberMenu(null);
              }}
              className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left cursor-pointer transition-colors ${
                isLight ? 'hover:bg-[#f1f5f9] text-[#334155]' : 'hover:bg-[#161624] text-zinc-300 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-[#888]" />
              <span>{language === 'vi' ? 'Xem hồ sơ' : 'View Profile'}</span>
            </button>

            {/* User / Bot Volume Slider (0% - 100%) */}
            {(() => {
              const isTargetBot =
                ACTIVE_BOT_IDS.has(memberMenu.member.id) ||
                memberMenu.member.isHost ||
                currentVoiceDjBot?.id === memberMenu.member.id ||
                connectedVoiceChannelObj?.dj_bot_id === memberMenu.member.id;
              const isInVoice =
                isTargetBot ||
                voiceParticipants.some(p => p.id === memberMenu.member.id) ||
                getEffectiveVoiceParticipants(selectedChannel).some(p => p.id === memberMenu.member.id);

              if (!memberMenu.fromVoice || !isInVoice || memberMenu.member.id === 'usr_me' || memberMenu.member.id === currentUser?.id) {
                return null;
              }

              const currentVol = userVolumes[memberMenu.member.id] ?? (isTargetBot ? 80 : 100);

              return (
                <div className="px-2.5 py-2 border-y border-[#1e1e2c] my-1 bg-black/40 rounded-lg">
                  <div className="flex items-center justify-between text-[11px] font-mono text-[#aaa] mb-1.5">
                    <span className="flex items-center gap-1.5 font-semibold text-zinc-300">
                      <Volume2 className="w-3.5 h-3.5" style={{ color: accentColor }} />
                      {isTargetBot ? (language === 'vi' ? 'Âm lượng bot' : 'Bot volume') : (language === 'vi' ? 'Âm lượng mic người dùng' : 'User mic volume')}
                    </span>
                    <span className="font-bold text-white font-mono">{currentVol}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={currentVol}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setUserVolumes(prev => {
                        const next = { ...prev, [memberMenu.member.id]: val };
                        try { localStorage.setItem('spytify_user_volumes', JSON.stringify(next)); } catch {}
                        return next;
                      });
                    }}
                    className="w-full h-1 bg-[#262638] rounded-lg appearance-none cursor-pointer"
                    style={{ accentColor }}
                  />
                  {isTargetBot && canManageServer && (() => {
                    const targetMenuDemandState = getServerRythmBot(selectedServer.id, memberMenu.member.id);
                    return isDemandBotId(memberMenu.member.id) ? (
                      <div className="flex flex-col gap-1.5 mt-2">
                        {targetMenuDemandState.currentTrack && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                processBotMusicCommand(`/sk @${memberMenu.member.id}`, {
                                  id: currentUser?.id || 'guest',
                                  name: myServerDisplayName,
                                  username: currentUser?.username || 'operative',
                                });
                                setMemberMenu(null);
                              }}
                              className="flex-1 py-1 px-2 rounded bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 font-mono text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-colors"
                              title="Bỏ qua bài hát hiện tại"
                            >
                              <SkipForward className="w-3 h-3" />
                              <span>Skip</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                processBotMusicCommand(`/st @${memberMenu.member.id}`, {
                                  id: currentUser?.id || 'guest',
                                  name: myServerDisplayName,
                                  username: currentUser?.username || 'operative',
                                });
                                setMemberMenu(null);
                              }}
                              className="py-1 px-2 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 font-mono text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-colors"
                              title="Dừng phát và xóa hàng đợi"
                            >
                              <Square className="w-3 h-3" />
                              <span>{language === 'vi' ? 'Dừng' : 'Stop'}</span>
                            </button>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            processBotMusicCommand(`/q @${memberMenu.member.id}`, {
                              id: currentUser?.id || 'guest',
                              name: myServerDisplayName,
                              username: currentUser?.username || 'operative',
                            });
                            setMemberMenu(null);
                          }}
                          className="w-full py-1 px-2 rounded bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 text-purple-300 font-mono text-[10px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                          title="Xem hàng đợi nhạc hiện tại"
                        >
                          <ListMusic className="w-3 h-3" />
                          <span>{language === 'vi' ? `Hàng đợi (${targetMenuDemandState.queue.length} bài)` : `Queue (${targetMenuDemandState.queue.length} tracks)`}</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          handleRotateBotStream(memberMenu.member.id, 'Người dùng đổi luồng từ menu');
                          setMemberMenu(null);
                        }}
                        className="w-full mt-2 py-1.5 px-2 rounded bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 font-mono text-[10px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                        title="Chuyển sang luồng phát sóng 24/7 dự phòng khác cùng thể loại"
                      >
                        <RotateCcw className="w-3 h-3 animate-spin-once" />
                        <span>{language === 'vi' ? 'Đổi luồng stream 24/7 dự phòng' : 'Switch 24/7 backup stream'}</span>
                      </button>
                    );
                  })()}
                </div>
              );
            })()}

            {/* Local Mute Toggle (Bất kỳ thành viên nào cũng có thể tắt tiếng người khác cho riêng mình) */}
            {memberMenu.member.id !== 'usr_me' && memberMenu.member.id !== currentUser?.id && (
              <button
                type="button"
                onClick={() => {
                  handleToggleLocalMute(memberMenu.member.id);
                  setMemberMenu(null);
                }}
                className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left cursor-pointer transition-colors ${
                  locallyMutedUsers[memberMenu.member.id]
                    ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                    : 'hover:bg-white/5 text-zinc-300 hover:text-white'
                }`}
              >
                {locallyMutedUsers[memberMenu.member.id] ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>{language === 'vi' ? 'Bật tiếng' : 'Unmute'}</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{language === 'vi' ? 'Tắt tiếng' : 'Mute'}</span>
                  </>
                )}
              </button>
            )}

            {/* Voice kick (Chỉ Chủ Server hoặc Mod) or invite */}
            {(() => {
              const isTargetBot = ACTIVE_BOT_IDS.has(memberMenu.member.id) || memberMenu.member.isHost || memberMenu.member.id === 'usr_host' || memberMenu.member.id === 'usr_agent_01' || memberMenu.member.id === 'usr_luna_lofi' || memberMenu.member.id === 'usr_music_bot' || memberMenu.member.id === 'custom';
              const isAlreadyInRoom =
                voiceParticipants.some(p => p.id === memberMenu.member.id) ||
                (connectedVoiceChannelObj && getEffectiveVoiceParticipants(connectedVoiceChannelObj).some(p => p.id === memberMenu.member.id)) ||
                (selectedChannel && selectedChannel.type === 'voice' && getEffectiveVoiceParticipants(selectedChannel).some(p => p.id === memberMenu.member.id)) ||
                (connectedVoiceChannelObj?.is_radio && (connectedVoiceChannelObj?.dj_bot_id === memberMenu.member.id || (!connectedVoiceChannelObj?.dj_bot_id && memberMenu.member.id === 'usr_host'))) ||
                (isDemandBotId(memberMenu.member.id) && (() => { const dSt = getServerRythmBot(selectedServer.id, memberMenu.member.id); return Boolean(dSt.voiceChannelId && dSt.voiceChannelId === connectedVoiceChannel); })());

              if (isTargetBot) {
                // "các bot live stream nếu đã được phân vào live station thì nếu mời thì sẽ không hợp lệ" (Bot Yêu Cầu không phải station bot)
                const isStationBot = !isDemandBotId(memberMenu.member.id);
                const assignedLiveStation = isStationBot ? selectedServer.channels.find(
                  c => c.type === 'voice' && c.is_radio && (c.dj_bot_id === memberMenu.member.id || (!c.dj_bot_id && memberMenu.member.id === 'usr_host'))
                ) : null;
                if (assignedLiveStation) {
                  return (
                    <div className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-xs text-zinc-500 cursor-not-allowed bg-white/5 border border-white/5">
                      <Radio className="w-3.5 h-3.5 text-emerald-400/60" />
                      <span className="truncate">
                        {language === 'vi' ? `Trạm: ${assignedLiveStation.name}` : `Station: ${assignedLiveStation.name}`}
                      </span>
                    </div>
                  );
                }

                // Nếu là Bot: nếu bot đã ở sẵn trong phòng thoại hoặc người dùng chưa tham gia phòng thoại nào thì không hiện nút mời
                if (!connectedVoiceChannel || isAlreadyInRoom) return null;
              }

              if (isAlreadyInRoom) {
                return (isServerOwner || isServerMod) ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleRemoveMemberFromVoice(memberMenu.member.id);
                      setMemberMenu(null);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg hover:bg-red-950/40 text-red-400 flex items-center gap-2 text-left cursor-pointer transition-colors"
                  >
                    <PhoneOff className="w-3.5 h-3.5 text-red-400" />
                    <span>{language === 'vi' ? 'Kick khỏi phòng thoại (Chủ/Mod)' : 'Kick from Voice (Owner/Mod)'}</span>
                  </button>
                ) : null;
              }

              // Nếu người dùng chưa tham gia phòng thoại nào thì không hiện nút mời vào phòng thoại
              if (!connectedVoiceChannel) return null;

              return (
                <button
                  type="button"
                  onClick={() => {
                    handleInviteMemberToVoice(memberMenu.member);
                    setMemberMenu(null);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left cursor-pointer transition-colors"
                  style={{
                    color: accentColor,
                    backgroundColor: `${accentColor}18`,
                  }}
                >
                  <PhoneCall className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  <span>{memberMenu.member.isHost ? (language === 'vi' ? 'Mời DJ vào phòng thoại' : 'Call DJ into voice room') : (language === 'vi' ? 'Mời vào phòng thoại' : 'Invite to voice')}</span>
                </button>
              );
            })()}

            <button
              onClick={() => {
                setInputText(prev => `${prev}@${memberMenu.member.name} `);
                setMemberMenu(null);
              }}
              className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left cursor-pointer transition-colors ${
                isLight ? 'hover:bg-[#f1f5f9] text-[#334155] hover:text-[#0f172a]' : 'hover:bg-[#161624] text-zinc-300 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#888]" />
              <span>{language === 'vi' ? 'Nhắc tên trong chat (@)' : 'Mention in chat (@)'}</span>
            </button>

            {!ACTIVE_BOT_IDS.has(memberMenu.member.id) && !memberMenu.member.isHost && (
              <>
                {isServerOwner && memberMenu.member.id !== 'usr_me' && (
                  <>
                    <button
                      onClick={() => {
                        handleToggleModerator(memberMenu.member.id);
                        setMemberMenu(null);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg hover:bg-emerald-950/40 text-emerald-400 flex items-center gap-2 text-left cursor-pointer transition-colors border-t border-white/10 mt-1 pt-1.5"
                    >
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      <span>
                        {isMemberModerator(memberMenu.member.id)
                          ? (language === 'vi' ? 'Gỡ quyền Mod (Điều hành viên)' : 'Remove Moderator role')
                          : (language === 'vi' ? 'Cấp quyền Mod (Điều hành viên)' : 'Promote to Moderator')}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        requestTransferOwnership(memberMenu.member.id, memberMenu.member.name);
                        setMemberMenu(null);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg hover:bg-amber-950/40 text-amber-400 flex items-center gap-2 text-left cursor-pointer transition-colors border-t border-amber-500/20 mt-1 pt-1.5"
                    >
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                      <span>{language === 'vi' ? 'Nhượng quyền Chủ Server (Bạn xuống Mod)' : 'Transfer Server Ownership'}</span>
                    </button>
                  </>
                )}

                {canManageServer &&
                  memberMenu.member.id !== 'usr_me' &&
                  (isServerOwner || !isMemberModerator(memberMenu.member.id)) && (
                    <button
                      onClick={() => {
                        requestKickMember(memberMenu.member.id, memberMenu.member.name);
                        setMemberMenu(null);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg hover:bg-red-950/40 text-red-400 flex items-center gap-2 text-left cursor-pointer transition-colors border-t border-red-500/20 mt-1 pt-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      <span>Kick khỏi server</span>
                    </button>
                  )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ──────────────── CHANNEL CONTEXT MENU (CHUỘT PHẢI VÀO PHÒNG) ──────────────── */}
      {channelContextMenu && (
        <div
          className={`fixed z-50 w-56 rounded-xl shadow-2xl py-1 text-xs animate-in fade-in duration-150 border ${
            isLight ? 'bg-[#ffffff] border-[#cbd5e1] text-[#0f172a]' : 'bg-[#0e0e18] border-[#26263a] text-white'
          }`}
          style={{ top: channelContextMenu.y, left: channelContextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`px-3 py-1.5 border-b flex items-center gap-2 ${isLight ? 'border-[#e2e8f0]' : 'border-[#1c1c28]'}`}>
            {channelContextMenu.channel.type === 'voice' ? (
              channelContextMenu.channel.is_radio ? (
                <Radio className="w-4 h-4 text-amber-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )
            ) : (
              <Hash className="w-4 h-4 text-cyan-400" />
            )}
            <div className="truncate flex-1">
              <p className={`font-bold truncate text-[11px] ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>
                {getChannelName(channelContextMenu.channel)}
              </p>
              <p className="text-[9px] font-mono text-zinc-400">
                {channelContextMenu.channel.type === 'voice'
                  ? (channelContextMenu.channel.is_radio ? (language === 'vi' ? 'Trạm Radio 24/7' : '24/7 Radio Station') : (language === 'vi' ? 'Phòng thoại Voice' : 'Voice Channel'))
                  : (language === 'vi' ? 'Kênh văn bản' : 'Text Channel')}
              </p>
            </div>
          </div>

          <div className="p-1 space-y-0.5">
            {channelContextMenu.channel.type === 'voice' && (
              <>
                {connectedVoiceServerId === selectedServer.id && connectedVoiceChannel === channelContextMenu.channel.id ? (
                  <button
                    onClick={() => {
                      handleLeaveVoiceCall();
                      setChannelContextMenu(null);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left cursor-pointer transition-colors hover:bg-red-950/40 text-red-400"
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                    <span>{language === 'vi' ? 'Rời phòng thoại' : 'Leave Voice Channel'}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      handleJoinVoiceCall(channelContextMenu.channel.id, channelContextMenu.channel);
                      handleSelectChannel(channelContextMenu.channel);
                      setChannelContextMenu(null);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left cursor-pointer transition-colors"
                    style={{ color: accentColor, backgroundColor: `${accentColor}18` }}
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>{language === 'vi' ? 'Tham gia phòng thoại' : 'Join Voice Channel'}</span>
                  </button>
                )}

                {channelContextMenu.channel.is_radio && canManageServer && (
                  <button
                    onClick={() => {
                      handleOpenEditStationModal(channelContextMenu.channel);
                      setChannelContextMenu(null);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left cursor-pointer transition-colors ${
                      isLight ? 'hover:bg-[#f1f5f9] text-[#334155]' : 'hover:bg-[#161624] text-zinc-300 hover:text-white'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                    <span>{language === 'vi' ? 'Sửa link phát YouTube' : 'Edit Stream Link'}</span>
                  </button>
                )}
              </>
            )}

            <button
              onClick={() => {
                navigator.clipboard.writeText(getChannelName(channelContextMenu.channel));
                showVoiceToast(language === 'vi' ? 'Đã sao chép tên phòng!' : 'Copied room name!');
                setChannelContextMenu(null);
              }}
              className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left cursor-pointer transition-colors ${
                isLight ? 'hover:bg-[#f1f5f9] text-[#334155]' : 'hover:bg-[#161624] text-zinc-300 hover:text-white'
              }`}
            >
              <Copy className="w-3.5 h-3.5 text-zinc-400" />
              <span>{language === 'vi' ? 'Sao chép tên phòng' : 'Copy Channel Name'}</span>
            </button>

            {canManageServer && selectedServer.channels.filter(c => c.type === channelContextMenu.channel.type).length > 1 && (
              <button
                onClick={(e) => {
                  const ch = channelContextMenu.channel;
                  setChannelContextMenu(null);
                  requestDeleteChannel(ch, e);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left cursor-pointer transition-colors hover:bg-red-950/40 text-red-400 border-t border-white/10 mt-1 pt-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{language === 'vi' ? 'Xóa phòng này' : 'Delete Channel'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ──────────────── FLOATING TOAST NOTIFICATION ──────────────── */}
      {voiceToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 rounded-xl bg-black/90 border border-amber-500/50 text-amber-300 text-xs font-mono shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 backdrop-blur-md">
          <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>{voiceToast}</span>
        </div>
      )}

      {/* ──────────────── 5. MODAL TỰ TẠO TRẠM SÓNG / SERVER MỚI (DISCORD-STYLE STEP WIZARD) ──────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#0c0c14] border border-[#222234] rounded-2xl p-6 shadow-2xl relative text-white">
            {/* Close */}
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-[#666] hover:text-white hover:bg-[#181824] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header with Step Progress */}
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base bg-zinc-800/80"
                style={{ color: newServerColor, border: `1px solid ${newServerColor}60` }}
              >
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                  <span>Tạo Server Spy Jam</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    Bước {createServerStep}/3
                  </span>
                </h3>
                <p className="text-[11px] text-[#777] font-mono">
                  {createServerStep === 1 && 'Chọn phong cách mẫu hoặc dán link mời tham gia'}
                  {createServerStep === 2 && 'Đặt tên máy chủ và chọn biểu tượng / logo'}
                  {createServerStep === 3 && 'Tùy biến màu theme Neon & xem trước diện mạo'}
                </p>
              </div>
            </div>

            {/* Step Progress Bar */}
            <div className="flex items-center gap-1.5 mb-5">
              {[1, 2, 3].map(step => (
                <div
                  key={step}
                  onClick={() => setCreateServerStep(step as 1 | 2 | 3)}
                  className={`h-1.5 flex-1 rounded-full cursor-pointer transition-all ${
                    createServerStep >= step ? 'shadow-sm' : 'bg-white/10'
                  }`}
                  style={{
                    backgroundColor: createServerStep >= step ? newServerColor : undefined,
                  }}
                />
              ))}
            </div>

            {/* BƯỚC 1: Chọn mẫu hoặc tham gia link */}
            {createServerStep === 1 && (
              <div className="space-y-4">
                {/* Quick Join Server by Invite Link */}
                <form onSubmit={handleJoinServerByLinkForm} className="p-3 rounded-xl bg-[#11111c] border border-cyan-500/30 space-y-2">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400">
                    🔗 HOẶC THAM GIA BẰNG LINK MỜI:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={joinServerLinkInput}
                      onChange={e => {
                        setJoinServerLinkInput(e.target.value);
                        setJoinServerErrorMsg(null);
                      }}
                      placeholder="Dán link spytify://station/join/... vào đây"
                      className="flex-1 px-3 py-2 rounded-xl bg-[#0b0b12] border border-[#252538] text-cyan-300 text-xs font-mono outline-none focus:border-cyan-400 transition-colors"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs font-mono cursor-pointer transition-transform hover:scale-105 shrink-0"
                    >
                      Tham gia
                    </button>
                  </div>
                  {joinServerErrorMsg && (
                    <p className="text-[11px] font-mono text-red-400">{joinServerErrorMsg}</p>
                  )}
                  {joinServerStatusMsg && (
                    <p className="text-[11px] font-mono text-emerald-400">{joinServerStatusMsg}</p>
                  )}
                </form>

                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-2">
                    Chọn phong cách trạm sóng mẫu (Discord Style):
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {SERVER_PRESETS.map(p => {
                      const isSel = newServerPreset === p.key;
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => handleSelectPreset(p.key)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            isSel 
                              ? 'bg-[#151524] shadow-md' 
                              : 'bg-[#0e0e16] hover:bg-[#13131e] border-[#1e1e2c]'
                          }`}
                          style={{
                            borderColor: isSel ? p.color : undefined,
                            boxShadow: isSel ? `0 0 12px ${p.color}30` : undefined,
                          }}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xl">{p.icon}</span>
                            {isSel && (
                              <span className="p-0.5 rounded-full bg-white text-black">
                                <Check className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-white">{p.label}</p>
                          <p className="text-[10px] text-[#777] font-mono line-clamp-1 mt-0.5">{p.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#1e1e2c]">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#141420] hover:bg-[#1a1a2a] text-xs font-semibold text-[#888] hover:text-white transition-colors cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateServerStep(2)}
                    className="px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider text-black flex items-center gap-1.5 cursor-pointer shadow-lg transition-transform hover:scale-105"
                    style={{ backgroundColor: newServerColor }}
                  >
                    <span>Tiếp tục (Tên & Logo)</span>
                    <span>➔</span>
                  </button>
                </div>
              </div>
            )}

            {/* BƯỚC 2: Tên máy chủ, mô tả và logo */}
            {createServerStep === 2 && (
              <div className="space-y-4 font-sans">
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1">
                    Tên máy chủ / Trạm sóng:
                  </label>
                  <input
                    type="text"
                    required
                    value={newServerName}
                    onChange={e => setNewServerName(e.target.value)}
                    placeholder="Ví dụ: Neon Club 2077, Lofi Study Corner..."
                    className="w-full px-3 py-2.5 rounded-xl bg-[#12121c] border border-[#252538] text-white text-xs outline-none focus:border-cyan-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1">
                    Mô tả trạm sóng:
                  </label>
                  <input
                    type="text"
                    value={newServerDesc}
                    onChange={e => setNewServerDesc(e.target.value)}
                    placeholder="Mô tả ngắn về thể loại âm nhạc hoặc đối tượng tham gia..."
                    className="w-full px-3 py-2.5 rounded-xl bg-[#12121c] border border-[#252538] text-white text-xs outline-none focus:border-cyan-400 transition-colors"
                  />
                </div>

                {/* Logo / Biểu tượng Máy Chủ */}
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1.5">
                    Logo / Biểu tượng Máy Chủ (Tải ảnh hoặc chọn Icon):
                  </label>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div
                      className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center font-bold text-lg shrink-0 border bg-zinc-800/80 shadow-md"
                      style={{
                        borderColor: newServerColor,
                        color: newServerColor,
                      }}
                    >
                      {renderServerIconContent(newServerIcon, newServerName || 'Server', newServerColor, 'w-6 h-6')}
                    </div>

                    <label className="px-3 py-1.5 rounded-xl bg-[#161626] hover:bg-[#1e1e34] border border-cyan-500/40 text-cyan-300 text-[11px] font-mono font-bold cursor-pointer transition-colors flex items-center gap-1.5">
                      <span>📷 Tải ảnh Logo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => handleUploadServerLogoFile(e, dataUrl => setNewServerIcon(dataUrl))}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => setNewServerIcon('spy_logo')}
                      className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                        newServerIcon === 'spy_logo'
                          ? 'bg-white/20 border-white text-white scale-105'
                          : 'bg-[#141420] border-[#262638] text-[#bbb] hover:text-white'
                      }`}
                      title="Dùng biểu tượng Điệp viên Spy Jam"
                    >
                      <SpyJamIcon className="w-3.5 h-3.5" style={{ color: newServerColor, backgroundColor: newServerColor }} />
                      <span>Logo Spy</span>
                    </button>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {['⚡', '☕', '🍸', '🎧', '🪩', '🚀', '💎', '🐉', '🔥', '🌸'].map(ico => (
                        <button
                          key={ico}
                          type="button"
                          onClick={() => setNewServerIcon(ico)}
                          className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center cursor-pointer transition-transform ${
                            newServerIcon === ico ? 'scale-110 bg-white/20 border border-white' : 'hover:scale-105 bg-[#141420]'
                          }`}
                        >
                          {ico}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-between border-t border-[#1e1e2c]">
                  <button
                    type="button"
                    onClick={() => setCreateServerStep(1)}
                    className="px-4 py-2 rounded-xl bg-[#141420] hover:bg-[#1a1a2a] text-xs font-semibold text-[#888] hover:text-white transition-colors cursor-pointer"
                  >
                    ⬅️ Quay lại
                  </button>
                  <button
                    type="button"
                    disabled={!newServerName.trim()}
                    onClick={() => setCreateServerStep(3)}
                    className="px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider text-black flex items-center gap-1.5 cursor-pointer shadow-lg transition-transform hover:scale-105 disabled:opacity-40"
                    style={{ backgroundColor: newServerColor }}
                  >
                    <span>Tiếp tục (Màu & Xem trước)</span>
                    <span>➔</span>
                  </button>
                </div>
              </div>
            )}

            {/* BƯỚC 3: Tùy biến màu Neon chủ đạo & Xem trước */}
            {createServerStep === 3 && (
              <form onSubmit={handleCreateServer} className="space-y-4 font-sans">
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1.5">
                    Màu Theme Neon chủ đạo:
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {['#00E5FF', '#FF2A55', '#00FF66', '#E040FB', '#FFE600', '#9C27B0', '#FFFFFF'].map(clr => (
                      <button
                        key={clr}
                        type="button"
                        onClick={() => setNewServerColor(clr)}
                        className={`w-7 h-7 rounded-full cursor-pointer transition-transform flex items-center justify-center ${
                          newServerColor.toLowerCase() === clr.toLowerCase() ? 'scale-125 border-2 border-white shadow-lg' : 'hover:scale-110 opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: clr, boxShadow: `0 0 8px ${clr}50` }}
                      >
                        {newServerColor.toLowerCase() === clr.toLowerCase() && (
                          <Check className="w-3.5 h-3.5 text-black font-black" />
                        )}
                      </button>
                    ))}

                    {/* Color picker custom */}
                    <label
                      className="relative w-7 h-7 rounded-full border-2 border-white flex items-center justify-center cursor-pointer transition-transform hover:scale-110 shadow-sm"
                      style={{ backgroundColor: newServerColor }}
                      title="Chọn bảng màu tùy biến"
                    >
                      <input
                        type="color"
                        value={newServerColor.startsWith('#') && newServerColor.length === 7 ? newServerColor : '#00E5FF'}
                        onChange={e => setNewServerColor(e.target.value)}
                        className="opacity-0 w-0 h-0 absolute pointer-events-none"
                      />
                      <Palette className="w-3.5 h-3.5 text-black drop-shadow" />
                    </label>

                    <input
                      type="text"
                      value={newServerColor}
                      onChange={e => setNewServerColor(e.target.value)}
                      placeholder="#00E5FF"
                      className="w-20 px-2 py-1 rounded-lg text-xs font-mono border border-white/20 bg-black/40 text-white outline-none focus:border-cyan-400 uppercase"
                    />
                  </div>
                </div>

                {/* Thẻ xem trước máy chủ (Server Live Preview) */}
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1.5">
                    Xem trước diện mạo máy chủ (Preview):
                  </label>
                  <div
                    className="p-4 rounded-2xl border bg-[#101018] flex items-center gap-3.5 shadow-xl transition-all"
                    style={{
                      borderColor: `${newServerColor}50`,
                      boxShadow: `0 0 20px ${newServerColor}20`,
                    }}
                  >
                    <div
                      className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center font-bold text-xl shrink-0 border bg-zinc-800/80 shadow-md"
                      style={{ borderColor: newServerColor, color: newServerColor }}
                    >
                      {renderServerIconContent(newServerIcon, newServerName || 'Server', newServerColor, 'w-7 h-7')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-white truncate">{newServerName || 'Tên Máy Chủ'}</h4>
                        <span
                          className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border uppercase"
                          style={{
                            color: newServerColor,
                            backgroundColor: `${newServerColor}20`,
                            borderColor: `${newServerColor}40`,
                          }}
                        >
                          MỚI
                        </span>
                      </div>
                      <p className="text-[11px] text-[#888] line-clamp-1 mt-0.5 font-sans">
                        {newServerDesc || 'Trạm phát sóng âm nhạc cộng đồng Spytify'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-between border-t border-[#1e1e2c]">
                  <button
                    type="button"
                    onClick={() => setCreateServerStep(2)}
                    className="px-4 py-2 rounded-xl bg-[#141420] hover:bg-[#1a1a2a] text-xs font-semibold text-[#888] hover:text-white transition-colors cursor-pointer"
                  >
                    ⬅️ Quay lại
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-black flex items-center gap-2 cursor-pointer shadow-xl transition-transform hover:scale-[1.03]"
                    style={{
                      backgroundColor: newServerColor,
                      boxShadow: `0 0 16px ${newServerColor}40`,
                    }}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Tạo Máy Chủ Ngay!</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ──────────────── 5b. MODAL TẠO & TÙY BIẾN BOT (BOT CUSTOMIZER) ──────────────── */}
      {isBotModalOpen && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <form
            onSubmit={handleSaveBotConfig}
            className={`w-full max-w-md border rounded-2xl p-6 shadow-2xl relative ${
              isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0c0c14] border-[#222234] text-white'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setIsBotModalOpen(false);
                setEditingBotTargetId(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-full text-[#666] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-400"
              >
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight">
                  {editingBotTargetId ? 'Tùy Biến Cấu Hình Bot' : 'Tạo Bot Âm Nhạc Mới'}
                </h3>
                <p className="text-[11px] text-[#777] font-mono">
                  Tùy chỉnh tên bot, logo, tag vai trò và trạng thái bài hát
                </p>
              </div>
            </div>

            <div className="space-y-3 font-sans">
              {/* Phân loại Bot: Bot Trạm Live 24/7 vs Bot Theo Yêu Cầu (Rythm) */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/10 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => {
                    setBotDraftType('station');
                    if (!botDraftName || botDraftName === 'Rythm') setBotDraftName('Custom Station Bot');
                    if (botDraftTag === 'ON-DEMAND') setBotDraftTag('RADIO');
                  }}
                  className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer ${
                    botDraftType === 'station'
                      ? 'bg-amber-400/20 border border-amber-400/50 text-amber-300 shadow-sm'
                      : 'text-[#888] hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5 text-amber-400" />
                  <span>📻 Bot Trạm Live</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBotDraftType('demand');
                    if (!botDraftName || botDraftName === 'Custom Station Bot') setBotDraftName(demandMusicBots.length > 0 ? `Music Bot ${demandMusicBots.length + 1}` : 'Rythm');
                    if (botDraftTag === 'RADIO') setBotDraftTag('ON-DEMAND');
                    if (!botDraftListening) setBotDraftListening('Sẵn sàng nhận lệnh /play');
                  }}
                  className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer ${
                    botDraftType === 'demand'
                      ? 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 shadow-sm'
                      : 'text-[#888] hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>🎵 Bot Yêu Cầu (/play)</span>
                </button>
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] block mb-1">
                  TÊN BOT:
                </label>
                <input
                  type="text"
                  required
                  value={botDraftName}
                  onChange={e => setBotDraftName(e.target.value)}
                  placeholder={botDraftType === 'demand' ? 'Ví dụ: Rythm, MusicDJ...' : 'Ví dụ: Custom Station Bot, CyberHawk...'}
                  className={`w-full px-3 py-2 rounded-xl text-xs border outline-none font-sans ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#12121a] border-[#222232] text-white focus:border-cyan-400'
                  }`}
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] block mb-1">
                  TAG / VAI TRÒ CỦA BOT:
                </label>
                <div className="flex items-center gap-2">
                  {(botDraftType === 'demand' ? ['ON-DEMAND', 'DJ', 'MUSIC'] : ['RADIO', 'DJ', 'HOST', 'PRODUCER']).map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setBotDraftTag(tag)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border cursor-pointer transition-colors ${
                        botDraftTag === tag
                          ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                          : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={botDraftTag}
                    onChange={e => setBotDraftTag(e.target.value)}
                    placeholder="Tag khác..."
                    className="w-24 px-2 py-1 rounded-lg text-xs font-mono border border-white/20 bg-transparent text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] block mb-1">
                  TRẠNG THÁI NHẠC ĐANG PHÁT (LISTENING STATUS):
                </label>
                <input
                  type="text"
                  value={botDraftListening}
                  onChange={e => setBotDraftListening(e.target.value)}
                  placeholder={botDraftType === 'demand' ? 'Ví dụ: Sẵn sàng nhận lệnh /play...' : 'Ví dụ: Lofi Chill 24/7, After Dark...'}
                  className={`w-full px-3 py-2 rounded-xl text-xs border outline-none font-sans ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#12121a] border-[#222232] text-white focus:border-cyan-400'
                  }`}
                />
              </div>

              {/* Các thiết lập riêng cho Bot Trạm Live */}
              {botDraftType === 'station' && (
                <div className="space-y-3 p-3 rounded-xl bg-black/30 border border-white/10">
                  <div>
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] block mb-1">
                      LINK YOUTUBE HOẶC VIDEO ID TRẠM PHÁT CHÍNH:
                    </label>
                    <input
                      type="text"
                      value={botDraftStreamUrl}
                      onChange={e => setBotDraftStreamUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=... hoặc Video ID"
                      className={`w-full px-3 py-2 rounded-xl text-xs border outline-none font-mono ${
                        isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#101018] border-[#222232] text-white focus:border-amber-400'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-[#888] block mb-1">
                      Luồng phát sóng dự phòng (Mỗi dòng 1 URL YouTube):
                    </label>
                    <textarea
                      rows={2}
                      value={botDraftBackupUrls}
                      onChange={e => setBotDraftBackupUrls(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=...&#10;https://www.youtube.com/watch?v=..."
                      className={`w-full px-3 py-1.5 rounded-xl text-xs border outline-none font-mono resize-none ${
                        isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#101018] border-[#222232] text-white focus:border-amber-400'
                      }`}
                    />
                    <p className="text-[9px] text-[#777] font-mono mt-0.5">
                      Khi bấm nút xoay vòng luồng dự phòng trong phòng thoại, bot sẽ tự chuyển sang các link này.
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono pt-1">
                    <span className="text-[#aaa]">Chế độ phát:</span>
                    <button
                      type="button"
                      onClick={() => setBotDraftIsLoopSingle(!botDraftIsLoopSingle)}
                      className={`px-3 py-1 rounded-lg border cursor-pointer font-bold transition-all ${
                        botDraftIsLoopSingle
                          ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                          : 'bg-white/5 border-white/10 text-zinc-300'
                      }`}
                    >
                      {botDraftIsLoopSingle ? '🔁 Lặp lại bài đơn (Loop)' : '🔴 Luồng Live 24/7'}
                    </button>
                  </div>
                </div>
              )}

              {/* Thông tin lệnh cho Bot Yêu Cầu */}
              {botDraftType === 'demand' && (
                <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-xs font-mono space-y-1.5">
                  <p className="text-cyan-300 font-bold flex items-center gap-1.5 text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Lệnh điều khiển Bot trong kênh chat:</span>
                  </p>
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-zinc-300">
                    <div><span className="text-cyan-400 font-bold">/play [tên/link]</span>: Phát nhạc & vào voice</div>
                    <div><span className="text-cyan-400 font-bold">/skip</span> (/sk): Bỏ qua bài</div>
                    <div><span className="text-cyan-400 font-bold">/stop</span> (/st): Dừng & rời phòng</div>
                    <div><span className="text-cyan-400 font-bold">/queue</span> (/q): Xem hàng đợi</div>
                    <div><span className="text-cyan-400 font-bold">/pause</span> (/p): Tạm dừng / Tiếp tục</div>
                    <div><span className="text-cyan-400 font-bold">/loop</span>: Bật/tắt lặp lại</div>
                  </div>
                  <p className="text-[9px] text-zinc-400">
                    * Bot chạy độc lập hoàn toàn cho từng Server, tự động ghi nhớ hàng đợi bài hát riêng biệt.
                  </p>
                </div>
              )}

              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] block mb-1">
                  LOGO / AVATAR CHO BOT:
                </label>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-zinc-800 border border-white/20 flex items-center justify-center font-bold text-sm text-white shrink-0">
                    {renderAvatarContent(botDraftName || 'Bot', botDraftAvatar)}
                  </div>
                  <label className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold cursor-pointer transition-colors flex items-center gap-1.5">
                    <span>📷 Tải ảnh Avatar</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = ev => {
                            if (typeof ev.target?.result === 'string') {
                              setBotDraftAvatar(ev.target.result);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  {botDraftAvatar && (
                    <button
                      type="button"
                      onClick={() => setBotDraftAvatar('')}
                      className="text-xs text-red-400 hover:underline cursor-pointer font-mono"
                    >
                      Xóa ảnh
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsBotModalOpen(false);
                  setEditingBotTargetId(null);
                }}
                className="px-4 py-2 rounded-xl bg-[#141420] hover:bg-[#1a1a2a] text-xs font-semibold text-[#888] hover:text-white transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider text-black flex items-center gap-1.5 cursor-pointer shadow-lg bg-cyan-400 hover:bg-cyan-300"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Lưu Cấu Hình Bot</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ──────────────── 6. MODAL CÀI ĐẶT ÂM LƯỢNG MIC & LOA (VOICE AUDIO SETTINGS) ──────────────── */}
      {isAudioSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-lg border rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto ${
            isLight ? 'bg-[#ffffff] border-[#cbd5e1] text-[#0f172a]' : 'bg-[#0c0c14] border-[#222234] text-white'
          }`}>
            {/* Close Button */}
            <button
              onClick={() => {
                stopMicTest();
                setIsAudioSettingsOpen(false);
              }}
              className={`absolute top-4 right-4 p-1.5 rounded-full transition-colors cursor-pointer ${
                isLight ? 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]' : 'text-[#666] hover:text-white hover:bg-[#181824]'
              }`}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base border"
                style={{
                  backgroundColor: `${accentColor}20`,
                  color: accentColor,
                  borderColor: `${accentColor}40`,
                }}
              >
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className={`text-base font-black tracking-tight flex items-center gap-2 ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>
                  <span>{getTranslation(language, 'community.audioSettingsTitle')}</span>
                  <span 
                    className="text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold"
                    style={{
                      backgroundColor: `${accentColor}18`,
                      color: accentColor,
                      borderColor: `${accentColor}40`,
                    }}
                  >
                    VOICE LAB
                  </span>
                </h3>
                <p className={`text-[11px] font-mono ${isLight ? 'text-[#64748b]' : 'text-[#888899]'}`}>{getTranslation(language, 'community.audioSettingsSubtitle')}</p>
              </div>
            </div>

            {/* Segmented Category Tabs (Điều chỉnh âm thanh theo từng mục) */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-black/40 border border-white/10 mb-4 text-xs font-mono">
              <button
                type="button"
                onClick={() => setAudioSettingsTab('mic')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer ${
                  audioSettingsTab === 'mic'
                    ? 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 shadow-sm'
                    : 'text-[#888] hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Microphone</span>
              </button>

              <button
                type="button"
                onClick={() => setAudioSettingsTab('speaker')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer ${
                  audioSettingsTab === 'speaker'
                    ? 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 shadow-sm'
                    : 'text-[#888] hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Loa & Tai nghe</span>
              </button>

              <button
                type="button"
                onClick={() => setAudioSettingsTab('bot')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer ${
                  audioSettingsTab === 'bot'
                    ? 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 shadow-sm'
                    : 'text-[#888] hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Radio className="w-3.5 h-3.5 text-amber-400" />
                <span>Âm lượng Bot</span>
              </button>

              <button
                type="button"
                onClick={() => setAudioSettingsTab('processing')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer ${
                  audioSettingsTab === 'processing'
                    ? 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 shadow-sm'
                    : 'text-[#888] hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Lọc tạp âm</span>
              </button>
            </div>

            <div className="space-y-4">
              {/* ──────── MỤC 1: MICROPHONE (ĐẦU VÀO) ──────── */}
              {audioSettingsTab === 'mic' && (
                <div className={`p-4 rounded-xl border ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#13131e] border-[#222234]'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Mic className="w-4 h-4" style={{ color: accentColor }} />
                      <span className={`text-xs font-bold uppercase tracking-wider font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {getTranslation(language, 'community.micVolume')}
                      </span>
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
                        {micVolume}%
                      </span>
                      <button
                        type="button"
                        onClick={() => handleMicVolumeChange(100)}
                        title="100%"
                        className={`p-1 rounded text-[10px] font-mono transition-colors cursor-pointer flex items-center gap-1 border ${
                          isLight ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700' : 'bg-[#1a1a26] hover:bg-[#242436] border-[#2a2a3e] text-[#aaa]'
                        }`}
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>100%</span>
                      </button>
                    </div>
                  </div>

                  {/* Mic Volume Slider */}
                  <div className="relative mb-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={micVolume}
                      onChange={(e) => handleMicVolumeChange(parseInt(e.target.value, 10))}
                      style={{ accentColor }}
                      className="w-full h-2.5 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-[#1f1f2e]"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-[#777] mt-1.5 font-semibold">
                      <span>0%</span>
                      <span className="text-zinc-400">50%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Live Mic Test Meter */}
                  <div className="pt-3 border-t border-slate-200 dark:border-[#1e1e2c]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5 font-bold">
                        <Activity className="w-3.5 h-3.5" style={{ color: accentColor }} />
                        {getTranslation(language, 'community.testMic')}
                      </span>
                      <button
                        type="button"
                        onClick={isTestingMic ? stopMicTest : startMicTest}
                        style={!isTestingMic ? {
                          backgroundColor: `${accentColor}18`,
                          borderColor: `${accentColor}45`,
                          color: accentColor,
                        } : undefined}
                        className={`px-3 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                          isTestingMic
                            ? 'bg-red-950/60 border-red-500/50 text-red-300 hover:bg-red-900 animate-pulse'
                            : 'hover:opacity-90 shadow-sm'
                        }`}
                      >
                        {isTestingMic ? getTranslation(language, 'community.stopTestMic') : getTranslation(language, 'community.startTestMic')}
                      </button>
                    </div>

                    {/* VU Level Bar */}
                    <div className="h-3.5 bg-black/60 border border-slate-300 dark:border-[#2a2a3e] rounded-full overflow-hidden p-0.5 relative">
                      <div 
                        className={`h-full rounded-full transition-all duration-75 ${
                          testMicLevel > 80 ? 'bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500' : 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                        }`}
                        style={{ width: `${testMicLevel}%` }}
                      />
                      {/* Sensitivity Marker needle */}
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_4px_white]"
                        style={{ left: `${(micSensitivity / 50) * 100}%` }}
                        title={`Sensitivity: ${micSensitivity}`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono mt-1.5 text-[#777]">
                      <span>
                        {isTestingMic ? (
                          testMicLevel > micSensitivity ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                              {getTranslation(language, 'community.voiceActive', { level: testMicLevel })}
                            </span>
                          ) : (
                            <span className="text-zinc-400">{getTranslation(language, 'community.voiceBelowGate', { level: testMicLevel })}</span>
                          )
                        ) : (
                          getTranslation(language, 'community.voiceTestPrompt')
                        )}
                      </span>
                      <span className="font-bold text-zinc-400">{getTranslation(language, 'community.activationThreshold', { level: micSensitivity })}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ──────── MỤC 2: SPEAKER & OUTPUT (ĐẦU RA) ──────── */}
              {audioSettingsTab === 'speaker' && (
                <div className={`p-4 rounded-xl border ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#13131e] border-[#222234]'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4" style={{ color: accentColor }} />
                      <span className={`text-xs font-bold uppercase tracking-wider font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {getTranslation(language, 'community.speakerVolume')}
                      </span>
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
                        {speakerVolume}%
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSpeakerVolumeChange(100)}
                        title="100%"
                        className={`p-1 rounded text-[10px] font-mono transition-colors cursor-pointer flex items-center gap-1 border ${
                          isLight ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700' : 'bg-[#1a1a26] hover:bg-[#242436] border-[#2a2a3e] text-[#aaa]'
                        }`}
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>100%</span>
                      </button>
                    </div>
                  </div>

                  {/* Speaker Volume Slider */}
                  <div className="relative mb-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={speakerVolume}
                      onChange={(e) => handleSpeakerVolumeChange(parseInt(e.target.value, 10))}
                      style={{ accentColor }}
                      className="w-full h-2.5 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-[#1f1f2e]"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-[#777] mt-1.5 font-semibold">
                      <span>0%</span>
                      <span className="text-zinc-400">50%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Speaker Test Sound Button */}
                  <div className="pt-3 border-t border-slate-200 dark:border-[#1e1e2c] flex items-center justify-between">
                    <span className="text-[11px] font-mono text-[#777]">Âm lượng tai nghe / loa</span>
                    <button
                      type="button"
                      onClick={() => playSpeakerTestSound()}
                      style={{
                        backgroundColor: `${accentColor}18`,
                        borderColor: `${accentColor}40`,
                        color: accentColor,
                      }}
                      className="px-3.5 py-1.5 rounded-xl border font-mono text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
                    >
                      <Volume1 className="w-4 h-4" />
                      <span>{getTranslation(language, 'community.testSpeaker')}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ──────── MỤC 3: ÂM LƯỢNG BOT & NHẠC NỀN ──────── */}
              {audioSettingsTab === 'bot' && (
                <div className={`p-4 rounded-xl border space-y-4 ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#13131e] border-[#222234]'
                }`}>
                  {/* Danh sách Bot Theo Yêu Cầu (Ưu tiên theo thứ tự tạo) */}
                  {demandMusicBots.map((dbot: CommunityUserProfile, idx: number) => {
                    const botVol = userVolumes[dbot.id] ?? userVolumes['usr_music_bot'] ?? 80;
                    return (
                      <div key={dbot.id} className={idx > 0 ? "pt-3 border-t border-white/10" : ""}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-cyan-400" />
                            <span className="text-xs font-bold font-mono text-white">
                              {dbot.display_name || dbot.username} {idx === 0 ? '(Ưu tiên mặc định /play)' : '(/play)'}
                            </span>
                          </div>
                          <span className="text-xs font-mono font-bold text-cyan-400">
                            {botVol}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={botVol}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setUserVolumes(prev => {
                              const next = { ...prev, [dbot.id]: val };
                              try { localStorage.setItem('spytify_user_volumes', JSON.stringify(next)); } catch {}
                              return next;
                            });
                          }}
                          style={{ accentColor: '#00E5FF' }}
                          className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-[#1f1f2e]"
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ──────── MỤC 4: BỘ LỌC TẠP ÂM & KHỬ VANG ──────── */}
              {audioSettingsTab === 'processing' && (
                <div className={`p-4 rounded-xl border space-y-4 ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#13131e] border-[#222234]'
                }`}>
                  {/* Voice Sensitivity Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5 text-xs">
                      <span className="text-[11px] font-mono text-zinc-400">{getTranslation(language, 'community.noiseGate')}</span>
                      <span className="text-xs font-mono font-bold" style={{ color: accentColor }}>{micSensitivity}</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="50"
                      step="1"
                      value={micSensitivity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setMicSensitivity(val);
                        localStorage.setItem('spytify_mic_sensitivity', String(val));
                      }}
                      style={{ accentColor }}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-[#1f1f2e]"
                    />
                    <p className="text-[10px] text-[#666] font-mono mt-1">
                      {getTranslation(language, 'community.noiseGateHint')}
                    </p>
                  </div>

                  {/* Audio Filters (Noise Suppression & Echo Cancellation) */}
                  <div className="pt-3 border-t border-slate-200 dark:border-[#1e1e2c] grid grid-cols-2 gap-2 text-xs">
                    <label 
                      style={noiseSuppression ? { borderColor: `${accentColor}50`, backgroundColor: `${accentColor}10` } : undefined}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isLight ? 'bg-white border-slate-200' : 'bg-[#181826] border-[#252538]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={noiseSuppression}
                        onChange={(e) => {
                          setNoiseSuppression(e.target.checked);
                          localStorage.setItem('spytify_noise_suppression', String(e.target.checked));
                        }}
                        style={{ accentColor }}
                        className="rounded"
                      />
                      <span className={`text-[11px] font-mono font-semibold ${isLight ? 'text-slate-800' : 'text-zinc-200'}`}>
                        {getTranslation(language, 'community.noiseSuppression')}
                      </span>
                    </label>
                    <label 
                      style={echoCancellation ? { borderColor: `${accentColor}50`, backgroundColor: `${accentColor}10` } : undefined}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isLight ? 'bg-white border-slate-200' : 'bg-[#181826] border-[#252538]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={echoCancellation}
                        onChange={(e) => {
                          setEchoCancellation(e.target.checked);
                          localStorage.setItem('spytify_echo_cancellation', String(e.target.checked));
                        }}
                        style={{ accentColor }}
                        className="rounded"
                      />
                      <span className={`text-[11px] font-mono font-semibold ${isLight ? 'text-slate-800' : 'text-zinc-200'}`}>
                        {getTranslation(language, 'community.echoCancellation')}
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 mt-5 border-t border-slate-200 dark:border-[#1e1e2c] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  handleMicVolumeChange(100);
                  handleSpeakerVolumeChange(100);
                  setMicSensitivity(14);
                  localStorage.setItem('spytify_mic_sensitivity', '14');
                }}
                className="text-xs font-mono text-[#777] hover:text-white transition-colors cursor-pointer"
              >
                {getTranslation(language, 'community.resetDefaults')}
              </button>

              <button
                type="button"
                onClick={() => {
                  stopMicTest();
                  setIsAudioSettingsOpen(false);
                }}
                style={{
                  backgroundColor: accentColor,
                  color: getContrastTextColor(accentColor),
                  boxShadow: `0 0 16px ${accentColor}40`,
                }}
                className="px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer hover:scale-[1.02]"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── 7. MODAL CÀI ĐẶT SERVER (SERVER SETTINGS & MANAGEMENT) ──────────────── */}
      {isServerSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-4xl border rounded-2xl shadow-2xl relative h-[680px] max-h-[92vh] flex flex-col overflow-hidden ${
            isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0c0c14] border-[#222234] text-white'
          }`}>
            {/* Header */}
            <div className={`p-5 border-b flex items-center justify-between ${isLight ? 'border-slate-200' : 'border-[#1c1c28]'}`}>
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center font-bold text-lg shrink-0"
                  style={{ backgroundColor: `${editServerColor}20`, color: editServerColor, border: `1px solid ${editServerColor}40` }}
                >
                  {renderServerIconContent(editServerIcon || selectedServer.icon, selectedServer.name, editServerColor, 'w-5 h-5')}
                </div>
                <div>
                  <h3 className={`text-base font-black tracking-tight flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    <span>Cài Đặt Máy Chủ: {selectedServer.name}</span>
                    <span 
                      className="text-[9px] font-mono px-2 py-0.5 rounded-full border"
                      style={{ color: editServerColor, borderColor: `${editServerColor}40`, backgroundColor: `${editServerColor}15` }}
                    >
                      {isServerOwner ? 'BẠN LÀ CHỦ SERVER' : isServerMod ? 'ĐIỀU HÀNH VIÊN (MOD)' : 'THÀNH VIÊN'}
                    </span>
                  </h3>
                  <p className="text-xs text-[#888] font-mono">Tùy biến theme neon, đổi tên, giới hạn thành viên & phân quyền</p>
                </div>
              </div>

              <button
                onClick={() => setIsServerSettingsOpen(false)}
                className="p-1.5 rounded-full text-[#666] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Vertical Sub-Tabs (Discord Style) */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
              <div className={`w-52 shrink-0 border-r p-3.5 flex flex-col gap-1 overflow-y-auto ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#09090f] border-[#181824]'
              }`}>
                <div className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[#666] mb-1">
                  {canManageServer ? 'CÀI ĐẶT MÁY CHỦ' : 'TÙY CHỌN CỦA BẠN'}
                </div>
                {(() => {
                  const memberTabs = [
                    { id: 'overview' as const, name: 'Biệt danh máy chủ', icon: <Edit3 className="w-4 h-4 shrink-0" /> },
                    { id: 'tags' as const, name: 'Tags sở thích', icon: <Tag className="w-4 h-4 shrink-0" /> },
                    ...(selectedServer.allow_member_invites !== false ? [
                      { id: 'invites' as const, name: 'Mời bạn bè', icon: <UserPlus className="w-4 h-4 shrink-0" /> }
                    ] : []),
                    { id: 'danger' as const, name: 'Rời máy chủ', icon: <LogOut className="w-4 h-4 shrink-0 text-red-400" /> },
                  ];
                  const adminTabs = [
                    { id: 'overview' as const, name: 'Tổng quan', icon: <Sliders className="w-4 h-4 shrink-0" /> },
                    { id: 'members' as const, name: 'Thành viên & Bot', icon: <Users className="w-4 h-4 shrink-0" />, count: onlineMembers.length },
                    { id: 'tags' as const, name: 'Tag & Sở thích', icon: <Tag className="w-4 h-4 shrink-0" /> },
                    { id: 'invites' as const, name: 'Mời bạn bè', icon: <UserPlus className="w-4 h-4 shrink-0" /> },
                    { id: 'danger' as const, name: 'Vùng nguy hiểm', icon: <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" /> },
                  ];
                  const tabs = canManageServer ? adminTabs : memberTabs;
                  return tabs.map(tab => {
                    const isActive = serverSettingsTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setServerSettingsTab(tab.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-mono font-bold tracking-wider transition-all text-left cursor-pointer ${
                          isActive
                            ? isLight
                              ? 'bg-white text-slate-900 shadow-sm border border-slate-300 font-black'
                              : 'bg-[#181826] text-white border border-white/20 shadow-md font-black'
                            : tab.id === 'danger'
                            ? 'text-red-400 hover:bg-red-950/20'
                            : isLight
                            ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                            : 'text-[#888] hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <span style={{ color: isActive ? editServerColor : undefined }}>
                          {tab.icon}
                        </span>
                        <span>{tab.name}</span>
                        {'count' in tab && tab.count !== undefined && (
                          <span className="ml-auto text-[10px] font-mono opacity-60">({tab.count})</span>
                        )}
                      </button>
                    );
                  });
                })()}
              </div>

              {/* Right Tab Content Panel */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {serverSettingsTab === 'overview' && !canManageServer && (
                <div className="space-y-5 max-w-xl">
                  {/* Hồ sơ thành viên trong máy chủ */}
                  <div className={`p-4 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#101018] border-[#1e1e2c]'}`}>
                    <div className="flex items-center gap-3.5 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-zinc-800 overflow-hidden flex items-center justify-center font-bold text-sm text-white shrink-0 border border-white/10">
                        {renderAvatarContent(myServerDisplayName, currentUser?.avatar)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className={`text-sm font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                            {nicknameDraft.trim() || myServerDisplayName}
                          </h4>
                          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-800/80 text-zinc-300 border border-white/10">
                            THÀNH VIÊN
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-[#888] truncate mt-0.5">
                          @{currentUser?.username || 'user'} • Máy chủ: {selectedServer.name}
                        </p>
                      </div>
                    </div>

                    {/* Tags sở thích hiện tại */}
                    {(() => {
                      const currentTags = resolveMemberTags('usr_me', selectedServer);
                      if (currentTags.length === 0) return null;
                      return (
                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
                          {currentTags.map(tag => (
                            <span
                              key={tag.id}
                              className="text-[10px] font-mono px-2 py-0.5 rounded-md border flex items-center gap-1"
                              style={{
                                backgroundColor: `${tag.color || accentColor}18`,
                                color: tag.color || accentColor,
                                borderColor: `${tag.color || accentColor}35`,
                              }}
                            >
                              {tag.icon || '🏷️'} {tag.name}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Form đổi biệt danh máy chủ */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveNicknameOnly();
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1.5 flex items-center gap-1.5">
                        <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Biệt danh của bạn trong máy chủ này (Server Nickname):</span>
                      </label>
                      <input
                        type="text"
                        maxLength={32}
                        value={nicknameDraft}
                        onChange={e => setNicknameDraft(e.target.value)}
                        placeholder={currentUser?.display_name || 'Nhập biệt danh của bạn...'}
                        className={`w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none font-sans ${
                          isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#12121a] border-[#222232] text-white focus:border-cyan-400'
                        }`}
                      />
                      <p className="text-[10px] text-[#666] font-mono mt-1">
                        Biệt danh này chỉ hiển thị khi bạn nhắn tin, trò chuyện hoặc tham gia phòng thoại trong máy chủ này.
                      </p>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-black flex items-center gap-2 cursor-pointer shadow-lg hover:scale-105 active:scale-95 transition-all"
                        style={{ backgroundColor: accentColor }}
                      >
                        <Check className="w-4 h-4" />
                        <span>Lưu Biệt Danh</span>
                      </button>
                    </div>
                  </form>

                  {/* Thông tin máy chủ (Read-only) */}
                  <div className={`p-4 rounded-xl border space-y-2 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#101018] border-[#1e1e2c]'}`}>
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#888]">MÁY CHỦ:</span>
                      <span className="font-bold text-white">{selectedServer.name}</span>
                    </div>
                    {selectedServer.description && (
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-[#888]">MÔ TẢ:</span>
                        <span className="text-zinc-300 truncate max-w-[280px]">{selectedServer.description}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#888]">QUYỀN HẠN:</span>
                      <span className="text-emerald-400 font-bold">Thành viên thường (Member)</span>
                    </div>
                  </div>
                </div>
              )}

              {serverSettingsTab === 'overview' && canManageServer && (
                <form onSubmit={handleSaveServerSettings} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1.5">
                      Tên máy chủ (Server Name):
                    </label>
                    <input
                      type="text"
                      disabled={!canManageServer}
                      value={editServerName}
                      onChange={e => setEditServerName(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none font-sans disabled:opacity-60 disabled:cursor-not-allowed ${
                        isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#12121a] border-[#222232] text-white focus:border-white/50'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1.5">
                      Mô tả máy chủ (Description):
                    </label>
                    <input
                      type="text"
                      disabled={!canManageServer}
                      value={editServerDesc}
                      onChange={e => setEditServerDesc(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none font-sans disabled:opacity-60 disabled:cursor-not-allowed ${
                        isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#12121a] border-[#222232] text-white focus:border-white/50'
                      }`}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1.5">
                        Logo / Biểu tượng Máy Chủ (Tải ảnh hoặc chọn Icon):
                      </label>
                      <div className="flex items-center gap-2.5 mb-2.5 flex-wrap">
                        <div
                          className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center font-bold text-lg shrink-0 border bg-zinc-800/80"
                          style={{
                            borderColor: editServerColor,
                            color: editServerColor,
                          }}
                        >
                          {renderServerIconContent(editServerIcon || selectedServer.icon, editServerName || selectedServer.name, editServerColor, 'w-6 h-6')}
                        </div>

                        <label className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold cursor-pointer transition-colors flex items-center gap-1.5">
                          <span>📷 Tải ảnh Logo lên</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => handleUploadServerLogoFile(e, dataUrl => setEditServerIcon(dataUrl))}
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => setEditServerIcon('spy_logo')}
                          className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                            editServerIcon === 'spy_logo'
                              ? 'border-cyan-400 bg-cyan-950/40 text-white scale-105'
                              : 'border-[#222230] text-[#aaa] hover:bg-white/5 hover:text-white'
                          }`}
                          title="Dùng biểu tượng Điệp viên Spy Jam"
                        >
                          <SpyJamIcon className="w-3.5 h-3.5" style={{ color: editServerColor, backgroundColor: editServerColor }} />
                          <span>Logo Spy</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {['⚡', '🍸', '☕', '🎧', '🚀', '💎', '🛸', '🎮', '🔥', '🌸'].map(ico => (
                          <button
                            key={ico}
                            type="button"
                            onClick={() => setEditServerIcon(ico)}
                            className={`w-8 h-8 rounded-lg text-sm border flex items-center justify-center cursor-pointer transition-transform ${
                              editServerIcon === ico 
                                ? 'border-cyan-400 bg-cyan-950/40 scale-110 shadow-sm' 
                                : 'border-[#222230] hover:bg-white/5'
                            }`}
                          >
                            {ico}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1.5">
                        Giới hạn số lượng thành viên:
                      </label>
                      <select
                        value={editServerMaxMembers}
                        onChange={e => setEditServerMaxMembers(Number(e.target.value))}
                        className={`w-full px-3 py-2 rounded-xl text-xs border outline-none font-sans ${
                          isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#12121a] border-[#222232] text-white'
                        }`}
                      >
                        <option value={10}>10 thành viên (Phòng kín)</option>
                        <option value={25}>25 thành viên</option>
                        <option value={50}>50 thành viên (Tiêu chuẩn)</option>
                        <option value={100}>100 thành viên (Club lớn)</option>
                        <option value={500}>500 thành viên (Không giới hạn)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1.5">
                      Màu Theme Neon chủ đạo (Server Accent Color):
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {['#00E5FF', '#FF2A55', '#00FF66', '#E040FB', '#FFB300', '#9C27B0', '#FFFFFF'].map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditServerColor(c)}
                          className={`w-8 h-8 rounded-xl border-2 transition-transform cursor-pointer flex items-center justify-center ${
                            editServerColor.toLowerCase() === c.toLowerCase() ? 'scale-110 shadow-lg' : 'hover:scale-105 border-transparent'
                          }`}
                          style={{ backgroundColor: c, borderColor: editServerColor.toLowerCase() === c.toLowerCase() ? (c === '#FFFFFF' ? '#000000' : '#ffffff') : 'transparent' }}
                        >
                          {editServerColor.toLowerCase() === c.toLowerCase() && <Check className={`w-4 h-4 font-black ${c === '#FFFFFF' ? 'text-black' : 'text-black'}`} />}
                        </button>
                      ))}

                      {/* Bảng màu tùy biến (Color Picker) */}
                      <label
                        className="relative w-8 h-8 rounded-xl border-2 flex items-center justify-center cursor-pointer transition-transform hover:scale-110 shadow-sm"
                        style={{
                          backgroundColor: editServerColor,
                          borderColor: '#ffffff',
                        }}
                        title="Mở bảng màu tùy biến"
                      >
                        <input
                          type="color"
                          value={editServerColor.startsWith('#') && editServerColor.length === 7 ? editServerColor : '#00E5FF'}
                          onChange={e => setEditServerColor(e.target.value)}
                          className="opacity-0 w-0 h-0 absolute pointer-events-none"
                        />
                        <Palette className="w-4 h-4 text-black drop-shadow" />
                      </label>
                      <input
                        type="text"
                        value={editServerColor}
                        onChange={e => setEditServerColor(e.target.value)}
                        placeholder="#00E5FF"
                        className="w-20 px-2 py-1 rounded-lg text-xs font-mono border border-white/20 bg-black/40 text-white outline-none focus:border-cyan-400 uppercase"
                      />
                    </div>
                  </div>

                  {/* Server Nickname: Tên hiển thị trên server này */}
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1.5 flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Biệt danh của bạn trong Server này (Server Nickname):</span>
                    </label>
                    <input
                      type="text"
                      maxLength={32}
                      value={nicknameDraft}
                      onChange={e => setNicknameDraft(e.target.value)}
                      placeholder={currentUser?.display_name || 'Nhập biệt danh hiển thị...'}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none font-sans ${
                        isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#12121a] border-[#222232] text-white focus:border-cyan-400'
                      }`}
                    />
                    <p className="text-[10px] text-[#666] font-mono mt-1">Biệt danh này chỉ hiển thị khi bạn nhắn tin hoặc tham gia phòng thoại trong server này.</p>
                  </div>

                  {/* Quyền Mời Thành Viên Của Member Thường (Chỉ Chủ Server thiết lập) */}
                  <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#101018] border-[#1e1e2c]'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                          Cho phép thành viên tự do mời người khác
                        </p>
                        <p className="text-[10px] text-[#777] font-mono mt-0.5">
                          {editServerAllowInvites
                            ? 'Bất kỳ ai trong server đều có thể tạo và gửi link mời tham gia.'
                            : 'Chỉ có Chủ server và Mod mới có quyền mời trực tiếp; thành viên thường phải đợi duyệt.'}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={editServerAllowInvites}
                        disabled={!isServerOwner}
                        onChange={e => setEditServerAllowInvites(e.target.checked)}
                        className="w-4 h-4 rounded text-cyan-500 focus:ring-0 cursor-pointer disabled:opacity-50"
                      />
                    </div>
                    {!isServerOwner && (
                      <p className="text-[9px] text-amber-400 font-mono mt-1.5">
                        * Chỉ Chủ Server (Owner) mới có quyền thay đổi thiết lập này.
                      </p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-[#1e1e2c] flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-black flex items-center gap-2 cursor-pointer shadow-lg hover:scale-105 active:scale-95 transition-all"
                      style={{ backgroundColor: editServerColor }}
                    >
                      <Check className="w-4 h-4" />
                      <span>Lưu Thay Đổi</span>
                    </button>
                  </div>
                </form>
              )}

              {serverSettingsTab === 'members' && canManageServer && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-[#888] font-mono">
                    <span>DANH SÁCH THÀNH VIÊN ({onlineMembers.length} / {editServerMaxMembers})</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBotTargetId(null);
                        setBotDraftType('station');
                        setBotDraftName('');
                        setBotDraftAvatar('');
                        setBotDraftTag('RADIO');
                        setBotDraftListening('');
                        setBotDraftStreamUrl('');
                        setBotDraftBackupUrls('');
                        setBotDraftIsLoopSingle(false);
                        setIsBotModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tạo / Tùy Biến Bot</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {onlineMembers.map(mem => {
                      const isMemOwner = isMemberServerOwner(mem.id);
                      const isMemMod = isMemberModerator(mem.id);
                      return (
                        <div
                          key={mem.id}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#101018] border-[#1e1e2c]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-zinc-800 overflow-hidden flex items-center justify-center font-bold text-xs text-white">
                              {renderAvatarContent(mem.name, resolveUserAvatar(mem.id, mem.avatar))}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{mem.name}</span>
                                <span
                                  className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded flex items-center gap-1 ${
                                    isMemOwner
                                      ? 'text-amber-400 bg-amber-400/15 border border-amber-400/30'
                                      : isMemMod
                                      ? 'text-emerald-400 bg-emerald-400/15 border border-emerald-400/30'
                                      : 'text-amber-400 bg-amber-400/10'
                                  }`}
                                >
                                  {isMemOwner && <Crown className="w-2.5 h-2.5" />}
                                  {!isMemOwner && isMemMod && <Shield className="w-2.5 h-2.5" />}
                                  <span>{mem.role}</span>
                                </span>
                                {isDemandBotId(mem.id) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      try { navigator.clipboard.writeText(`@${mem.id}`); } catch {}
                                      showVoiceToast(language === 'vi' ? `Đã chép ID lệnh: @${mem.id}` : `Copied bot mention: @${mem.id}`);
                                    }}
                                    className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/20 cursor-pointer"
                                    title={`Nhấn để copy @${mem.id} dùng cho lệnh /play @${mem.id}`}
                                  >
                                    @{mem.id}
                                  </button>
                                )}
                              </div>
                              <p className="text-[10px] text-[#777] font-mono">{mem.listening ? `🎵 ${mem.listening}` : 'Sẵn sàng'}</p>
                            </div>
                          </div>

                          {mem.id !== 'usr_me' && (
                            <div className="relative flex items-center justify-end">
                              {ACTIVE_BOT_IDS.has(mem.id) ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingBotTargetId(mem.id);
                                      const isDemand = mem.id === 'usr_music_bot' || mem.id.startsWith('usr_music_bot') || (mem.role || '').toUpperCase().includes('DEMAND');
                                      setBotDraftType(isDemand ? 'demand' : 'station');
                                      setBotDraftName(mem.name);
                                      setBotDraftAvatar(mem.avatar || '');
                                      setBotDraftTag(mem.role || (isDemand ? 'ON-DEMAND' : 'RADIO'));
                                      setBotDraftListening(mem.listening || (isDemand ? 'Sẵn sàng nhận lệnh /play' : ''));
                                      const ch = selectedServer.channels.find(
                                        c => c.is_radio && (c.dj_bot_id === mem.id || (!c.dj_bot_id && mem.id === 'usr_host') || c.id === 'custom')
                                      );
                                      setBotDraftStreamUrl(ch?.custom_stream_url || '');
                                      setBotDraftBackupUrls((ch?.custom_backup_streams || []).join('\n'));
                                      setBotDraftIsLoopSingle(Boolean(ch?.is_loop_single));
                                      setIsBotModalOpen(true);
                                    }}
                                    className="px-2 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/80 text-cyan-400 hover:text-cyan-300 text-[11px] font-mono flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                                    title="Tùy biến tên, logo, tag và trạng thái bot"
                                  >
                                    <Sliders className="w-3 h-3" />
                                    <span>Tùy biến</span>
                                  </button>
                                  {!BASE_BOT_IDS.has(mem.id) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (Array.isArray(selectedServer.member_ids)) {
                                          const updatedSrv: CommunityServer = {
                                            ...selectedServer,
                                            member_ids: selectedServer.member_ids.filter(id => id !== mem.id),
                                            channels: selectedServer.channels.filter(c => c.dj_bot_id !== mem.id),
                                          };
                                          broadcastAndPersistServerUpdate(updatedSrv);
                                        }
                                        setRegisteredUsers(prev => {
                                          const next = prev.filter(u => u.id !== mem.id);
                                          try {
                                            localStorage.setItem('spytify_registered_users', JSON.stringify(next));
                                          } catch {}
                                          return next;
                                        });
                                        showVoiceToast(language === 'vi' ? `Đã xóa bot ${mem.name}` : `Removed bot ${mem.name}`);
                                      }}
                                      className="px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 text-[11px] font-mono flex items-center gap-1 transition-colors cursor-pointer"
                                      title="Xóa bot tùy biến khỏi server"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-zinc-400 flex items-center gap-1 shadow-sm">
                                    <Radio className="w-2.5 h-2.5 text-cyan-400 animate-pulse" />
                                    <span>{BASE_BOT_IDS.has(mem.id) ? 'Bot Hệ Thống' : 'Bot Tùy Biến'}</span>
                                  </span>
                                </div>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setOpenMemberActionsMenuId(openMemberActionsMenuId === mem.id ? null : mem.id)}
                                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                      openMemberActionsMenuId === mem.id
                                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                                        : isLight
                                        ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                                        : 'bg-zinc-800/60 hover:bg-zinc-800 border-zinc-700/50 text-zinc-300 hover:text-white'
                                    }`}
                                    title="Tùy chọn quản lý thành viên"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>

                                  {openMemberActionsMenuId === mem.id && (
                                    <div
                                      className={`absolute right-0 top-full mt-1.5 w-48 rounded-xl border shadow-2xl py-1 z-50 text-xs font-mono animate-in fade-in zoom-in-95 duration-100 ${
                                        isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#12121e] border-[#2c2c40] text-zinc-200'
                                      }`}
                                    >
                                      {isServerOwner && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              handleToggleModerator(mem.id);
                                              setOpenMemberActionsMenuId(null);
                                            }}
                                            className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/10 transition-colors cursor-pointer text-left text-cyan-400 hover:text-cyan-300"
                                          >
                                            <Shield className="w-3.5 h-3.5" />
                                            <span>{isMemMod ? 'Gỡ quyền Mod' : 'Cấp quyền Mod'}</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              requestTransferOwnership(mem.id, mem.name);
                                              setOpenMemberActionsMenuId(null);
                                            }}
                                            className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/10 transition-colors cursor-pointer text-left text-amber-400 hover:text-amber-300"
                                          >
                                            <Crown className="w-3.5 h-3.5" />
                                            <span>Nhượng quyền Chủ</span>
                                          </button>
                                          <div className="my-1 border-t border-white/10" />
                                        </>
                                      )}

                                      {canManageServer && (isServerOwner || !isMemMod) && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            requestKickMember(mem.id, mem.name);
                                            setOpenMemberActionsMenuId(null);
                                          }}
                                          className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors cursor-pointer text-left"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                          <span>Kick khỏi server</span>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {serverSettingsTab === 'tags' && (
                <div className="space-y-5 max-w-xl">
                  <div>
                    <h4 className={`text-sm font-bold mb-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      CHỌN TAG SỞ THÍCH CỦA BẠN ({selectedTagIdsDraft.length})
                    </h4>
                    <p className="text-xs text-[#888] font-mono">
                      Chọn các tag bạn muốn hiển thị trên hồ sơ của mình trong máy chủ này. Bấm vào tag để chọn hoặc bỏ chọn.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {getServerTags(selectedServer).map(tag => {
                      const isSelected = selectedTagIdsDraft.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            setSelectedTagIdsDraft(prev =>
                              prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id]
                            );
                          }}
                          className={`flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-all ${
                            isSelected
                              ? 'border-cyan-400 bg-cyan-950/40 shadow-md scale-[1.02]'
                              : isLight
                              ? 'bg-white border-slate-200 hover:border-slate-300'
                              : 'bg-[#101018] border-[#222232] hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {tag.icon ? (
                              <span className="text-base shrink-0">{tag.icon}</span>
                            ) : (
                              <span
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: tag.color }}
                              />
                            )}
                            <span
                              className="text-xs font-bold font-sans truncate px-2 py-0.5 rounded-md border"
                              style={{
                                backgroundColor: `${tag.color}15`,
                                borderColor: `${tag.color}40`,
                                color: tag.color,
                              }}
                            >
                              {tag.name}
                            </span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0 ml-2" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        handleSaveUserTags();
                        showVoiceToast(language === 'vi' ? 'Đã lưu tags sở thích!' : 'Saved interest tags!');
                        if (!canManageServer) {
                          setIsServerSettingsOpen(false);
                        }
                      }}
                      className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-black flex items-center gap-2 cursor-pointer shadow-lg hover:scale-105 active:scale-95 transition-all"
                      style={{ backgroundColor: accentColor }}
                    >
                      <Check className="w-4 h-4" />
                      <span>Lưu Tag Sở Thích</span>
                    </button>
                  </div>
                </div>
              )}

              {serverSettingsTab === 'tags' && canManageServer && (
                <div className="space-y-6 max-w-xl pt-5 border-t border-white/10">
                  <div>
                    <h4 className={`text-sm font-bold mb-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      QUẢN LÝ TAG SỞ THÍCH CỦA MÁY CHỦ
                    </h4>
                    <p className="text-xs text-[#888] font-mono">
                      Chủ server có thể tạo các tag sở thích riêng (âm nhạc, phong cách, gaming) để thành viên lựa chọn khi vào server.
                    </p>
                  </div>

                  {/* Form Tạo Tag Mới (Chỉ dành cho Chủ Server) */}
                  {isServerOwner && (
                    <div className={`p-4 rounded-xl border space-y-3 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#101018] border-[#222232]'}`}>
                      <h5 className="text-xs font-bold text-cyan-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" />
                        Tạo Tag Mới Cho Server
                      </h5>
                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <input
                          type="text"
                          value={newTagDraftName}
                          onChange={e => setNewTagDraftName(e.target.value)}
                          placeholder="vd: 🎸 Rocker, 🎧 Audiophile, 🎮 Gamer..."
                          className={`flex-1 px-3.5 py-2 rounded-xl text-xs border outline-none font-sans ${
                            isLight ? 'bg-white text-slate-900 border-slate-300' : 'bg-[#161622] text-white border-[#28283c]'
                          }`}
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={newTagDraftColor}
                            onChange={e => setNewTagDraftColor(e.target.value)}
                            className="w-9 h-9 rounded-lg border border-white/20 cursor-pointer bg-transparent flex-shrink-0"
                            title="Chọn màu tag"
                          />
                          <button
                            type="button"
                            onClick={handleAddServerTag}
                            disabled={!newTagDraftName.trim()}
                            style={{
                              backgroundColor: accentColor,
                              color: getContrastTextColor(accentColor),
                            }}
                            className="px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 cursor-pointer shadow"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Thêm Tag</span>
                          </button>
                        </div>
                      </div>

                      {/* Chọn biểu tượng / Icon cho Tag */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[10px] text-[#888] font-mono">Icon:</span>
                        {['🎵', '☕', '🎮', '⚡', '🎧', '🔥', '💎', '🌸', '🚀', '💬', '🤖', '👑', '⭐'].map(ico => (
                          <button
                            key={ico}
                            type="button"
                            onClick={() => setNewTagDraftIcon(ico)}
                            className={`w-7 h-7 rounded-lg text-xs border flex items-center justify-center cursor-pointer transition-transform ${
                              newTagDraftIcon === ico ? 'bg-cyan-500/20 border-cyan-400 scale-110 shadow-sm' : 'bg-white/5 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            {ico}
                          </button>
                        ))}
                      </div>

                      {/* Màu gợi ý nhanh */}
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <span className="text-[10px] text-[#888] font-mono">Màu nhanh:</span>
                        {['#00E5FF', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6'].map(col => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => setNewTagDraftColor(col)}
                            className="w-4 h-4 rounded-full border border-white/30 cursor-pointer hover:scale-125 transition-transform"
                            style={{ backgroundColor: col }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Danh sách các tag hiện tại */}
                  <div className="space-y-2.5">
                    <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#888]">
                      Danh sách Tag hiện có ({getServerTags(selectedServer).length}):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {getServerTags(selectedServer).map(tag => (
                        <div
                          key={tag.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                            isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#101018] border-[#222232]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {tag.icon ? (
                              <span className="text-sm shrink-0">{tag.icon}</span>
                            ) : (
                              <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: tag.color }}
                              />
                            )}
                            <span
                              className="text-xs font-bold font-sans truncate px-2 py-0.5 rounded-md border"
                              style={{
                                backgroundColor: `${tag.color}15`,
                                borderColor: `${tag.color}40`,
                                color: tag.color,
                              }}
                            >
                              {tag.name}
                            </span>
                          </div>
                          {isServerOwner && (
                            <button
                              type="button"
                              onClick={() => handleDeleteServerTag(tag.id)}
                              className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Xóa tag này khỏi máy chủ"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {serverSettingsTab === 'invites' && (
                !canManageServer && selectedServer.allow_member_invites === false ? (
                  <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 text-xs text-amber-200">
                    Chủ máy chủ đã tắt quyền mời thành viên đối với thành viên thường. Chỉ Chủ server hoặc Điều hành viên (Mod) mới có thể gửi link mời tham gia.
                  </div>
                ) : (
                <div className="space-y-5 max-w-xl">
                  <div>
                    <h4 className={`text-sm font-bold mb-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>MỜI BẠN BÈ VÀO MÁY CHỦ</h4>
                    <p className="text-xs text-[#888] font-mono">
                      Chia sẻ liên kết bên dưới hoặc mời trực tiếp từ danh sách bạn bè của bạn.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`spytify://station/join/${selectedServer.id}`}
                      className={`flex-1 px-3.5 py-2.5 rounded-xl text-xs font-mono border outline-none ${
                        isLight ? 'bg-slate-100 text-slate-900 border-slate-300' : 'bg-[#101018] text-cyan-300 border-[#242436]'
                      }`}
                    />
                    <button
                      onClick={() => handleCopyInvite(selectedServer.id)}
                      style={{
                        backgroundColor: accentColor,
                        color: getContrastTextColor(accentColor),
                      }}
                      className="px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-md"
                    >
                      {inviteCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{inviteCopied ? 'Đã sao chép!' : 'Sao chép link'}</span>
                    </button>
                  </div>

                  {/* Direct Friend & Member Invite List */}
                  <div className="pt-3 border-t border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-[#888]">
                      <span>DANH SÁCH BẠN BÈ & ĐẶC VỤ ({registeredUsers.length})</span>
                      <span>TRẠNG THÁI TRONG SERVER</span>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                      {[...registeredUsers]
                        .sort((a, b) => {
                          const aFr = isMutualFriend(a) ? 0 : followingUserIds.has(a.id) ? 1 : 2;
                          const bFr = isMutualFriend(b) ? 0 : followingUserIds.has(b.id) ? 1 : 2;
                          return aFr - bFr;
                        })
                        .map(u => {
                          const inSrv = isMemberInServer(u.id);
                          const isFr = isMutualFriend(u);
                          const isFol = followingUserIds.has(u.id);
                          const effSt = getEffectiveStatus(u);
                          return (
                            <div
                              key={u.id}
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#101018] border-[#1e1e2c]'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 truncate">
                                <div className="relative flex-shrink-0">
                                  <div className="w-8 h-8 rounded-lg bg-zinc-800 overflow-hidden border border-white/10 flex items-center justify-center font-bold text-xs text-white">
                                    {renderAvatarContent(u.display_name, resolveUserAvatar(u.id, u.avatar))}
                                  </div>
                                  {renderStatusDot(effSt, 'sm')}
                                </div>
                                <div className="truncate">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-xs font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                      {u.display_name}
                                    </span>
                                    <span className="text-[10px] text-cyan-400 font-mono">@{u.username}</span>
                                    {isFr ? (
                                      <span className="text-[8px] font-mono font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                                        BẠN BÈ
                                      </span>
                                    ) : isFol ? (
                                      <span className="text-[8px] font-mono text-cyan-400 bg-cyan-400/10 px-1.5 py-0.2 rounded">
                                        Đang theo dõi
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="text-[10px] text-[#777] font-mono truncate">
                                    {u.role} {u.listening ? `• 🎵 ${u.listening}` : ''}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {inSrv ? (
                                  <>
                                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold flex items-center gap-1">
                                      <Check className="w-3 h-3" />
                                      <span>Đã tham gia</span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => requestKickMember(u.id, u.display_name)}
                                      className="p-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                                      title="Kick khỏi server"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : outgoingServerInvites.some(inv => inv.serverId === selectedServer.id && inv.targetUserId === u.id) ? (
                                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-bold flex items-center gap-1">
                                    <span>⏳ Chờ đồng ý</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleInviteMemberToServer(u.id)}
                                    style={{
                                      backgroundColor: accentColor,
                                      color: getContrastTextColor(accentColor),
                                    }}
                                    className="px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-transform hover:scale-105 active:scale-95 shadow-sm"
                                  >
                                    <UserPlus className="w-3.5 h-3.5" />
                                    <span>Gửi lời mời</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
                )
              )}

              {serverSettingsTab === 'danger' && (
                isServerOwner ? (
                  <div className="p-4 rounded-xl border border-red-500/30 bg-red-950/20 space-y-3">
                    <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                      <ShieldAlert className="w-4 h-4" />
                      <span>XÓA MÁY CHỦ VĨNH VIỄN</span>
                    </div>
                    <p className="text-xs text-[#aaa]">
                      Nhấn nút bên dưới sẽ xóa ngay lập tức trạm sóng âm nhạc này và toàn bộ lịch sử tin nhắn.
                    </p>
                    <button
                      type="button"
                      onClick={() => requestDeleteServer(selectedServer)}
                      className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-md"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Xóa Máy Chủ Ngay</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-red-500/30 bg-red-950/20 space-y-3">
                    <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                      <LogOut className="w-4 h-4" />
                      <span>RỜI KHỎI MÁY CHỦ</span>
                    </div>
                    <p className="text-xs text-[#aaa]">
                      Bạn sẽ rời khỏi máy chủ này và không còn nhìn thấy danh sách kênh thoại hoặc tin nhắn cho đến khi được mời lại.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleLeaveServer(selectedServer.id)}
                      className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-md"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Rời Máy Chủ Ngay</span>
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    )}

      {/* ──────────────── 8. MODAL XEM HỒ SƠ MẬT VỤ (PROFILE MODAL) ──────────────── */}
      {selectedProfileUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-md border rounded-2xl shadow-2xl relative overflow-hidden ${
            isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0e0e16] border-[#222234] text-white'
          }`}>
            {/* Banner with Accent Glow */}
            <div 
              className="h-28 w-full relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${accentColor}40, #000000 90%)`,
                borderBottom: `1px solid ${accentColor}30`,
              }}
            >
              <button
                onClick={() => setSelectedProfileUser(null)}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 hover:bg-black text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Avatar & Floating Actions */}
            <div className="px-6 relative pb-6">
              <div className="flex items-end justify-between -mt-12 mb-4">
                <div className="relative group/profAvt">
                  <div 
                    className="w-20 h-20 rounded-2xl overflow-hidden bg-[#14141e] border-4 flex items-center justify-center font-black text-2xl text-white shadow-2xl"
                    style={{ borderColor: isLight ? '#ffffff' : '#0e0e16' }}
                  >
                    {renderAvatarContent(
                      selectedProfileUser.display_name,
                      resolveUserAvatar(selectedProfileUser.id, selectedProfileUser.avatar)
                    )}
                  </div>
                  {renderStatusDot(
                    selectedProfileUser.id === 'usr_me' ? myEffectivePublicStatus : getEffectiveStatus(selectedProfileUser),
                    'lg'
                  )}

                  {/* Thought note bubble on avatar */}
                  {((selectedProfileUser.id === 'usr_me' || selectedProfileUser.id === currentUser?.id)
                    ? myUserThought
                    : ((selectedProfileUser as any).thought || (selectedProfileUser as any).custom_status)) ? (
                    <div
                      onClick={() => {
                        if (selectedProfileUser.id === 'usr_me' || selectedProfileUser.id === currentUser?.id) {
                          handleOpenThoughtModal();
                        }
                      }}
                      title={selectedProfileUser.id === 'usr_me' ? 'Bấm để đổi suy nghĩ người dùng' : undefined}
                      className={`absolute -top-5 left-1/2 -translate-x-1/2 max-w-[140px] px-2.5 py-0.5 rounded-full bg-zinc-950/95 border border-cyan-400 text-[10px] font-mono text-cyan-200 shadow-xl flex items-center gap-1 z-30 truncate ${
                        (selectedProfileUser.id === 'usr_me' || selectedProfileUser.id === currentUser?.id) ? 'cursor-pointer hover:scale-105 hover:border-cyan-300' : ''
                      }`}
                    >
                      <span className="text-xs">💭</span>
                      <span className="truncate">
                        {(selectedProfileUser.id === 'usr_me' || selectedProfileUser.id === currentUser?.id)
                          ? myUserThought
                          : ((selectedProfileUser as any).thought || (selectedProfileUser as any).custom_status)}
                      </span>
                    </div>
                  ) : (selectedProfileUser.id === 'usr_me' || selectedProfileUser.id === currentUser?.id) ? (
                    <button
                      type="button"
                      onClick={handleOpenThoughtModal}
                      title="Đặt suy nghĩ / Note mới"
                      className="absolute -top-4 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-cyan-950/90 border border-cyan-500/60 text-[9px] font-mono text-cyan-300 hover:text-white hover:border-cyan-400 shadow-md flex items-center gap-1 cursor-pointer whitespace-nowrap z-30"
                    >
                      <span>💭</span>
                      <span>+ Đặt suy nghĩ</span>
                    </button>
                  ) : null}
                </div>

                {selectedProfileUser.id !== 'usr_me' && (
                  <div className="flex items-center gap-2">
                    {/* Nút Nhắn tin riêng */}
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenDirectMessage(selectedProfileUser);
                        setSelectedProfileUser(null);
                      }}
                      className="px-3.5 py-2 rounded-xl font-bold text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 shadow-md bg-cyan-500 hover:bg-cyan-400 text-black"
                      title={language === 'vi' ? 'Nhắn tin riêng với người này' : 'Direct Message'}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{language === 'vi' ? 'Nhắn tin riêng' : 'Tin nhắn'}</span>
                    </button>

                    {/* Nút Follow / Bạn bè (Chỉ áp dụng cho người dùng thật hoặc 4 bot gốc) */}
                    {(!ACTIVE_BOT_IDS.has(selectedProfileUser.id) && selectedProfileUser.id !== 'custom' && !selectedProfileUser.id.startsWith('bot_')) || CAN_FOLLOW_BOT_IDS.has(selectedProfileUser.id) ? (
                      <button
                        type="button"
                        onClick={() => handleToggleFollow(selectedProfileUser.id)}
                        className={`px-3.5 py-2 rounded-xl font-bold text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 shadow-md ${
                          followingUserIds.has(selectedProfileUser.id)
                            ? 'bg-zinc-800 hover:bg-red-950/40 text-zinc-300 hover:text-red-400 border border-zinc-700'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-black'
                        }`}
                      >
                        {followingUserIds.has(selectedProfileUser.id) ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>{isMutualFriend(selectedProfileUser) ? 'Bạn bè' : 'Đang theo dõi'}</span>
                          </>
                        ) : isUserFollowingMe(selectedProfileUser.id) ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Đồng ý kết bạn</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Follow kết bạn</span>
                          </>
                        )}
                      </button>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Name & Handle */}
              <div>
                <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <span>{selectedProfileUser.display_name}</span>
                  <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-400/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    {selectedProfileUser.role}
                  </span>
                </h3>
                <p className="text-xs text-cyan-400 font-mono mt-0.5">
                  @{getCleanMemberUsername(selectedProfileUser, registeredUsers, currentUser)}
                </p>
              </div>

              {/* Mutual Relationship Badge */}
              <div className="mt-3 p-2.5 rounded-xl bg-[#141420] border border-[#222234] text-xs font-mono flex items-center justify-between">
                <span className="text-[#888]">Mối quan hệ:</span>
                {isMutualFriend(selectedProfileUser) ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    BẠN BÈ (Follow Lẫn Nhau)
                  </span>
                ) : followingUserIds.has(selectedProfileUser.id) ? (
                  <span className="text-cyan-400">Bạn đang theo dõi người này (Đã gửi KB)</span>
                ) : isUserFollowingMe(selectedProfileUser.id) ? (
                  <span className="text-amber-400 font-bold">Người này đã gửi lời mời kết bạn cho bạn!</span>
                ) : (
                  <span className="text-[#666]">Chưa theo dõi</span>
                )}
              </div>

              {/* Bio */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#777] block">
                    TIỂU SỬ
                  </span>
                  {(selectedProfileUser.id === 'usr_me' || selectedProfileUser.id === currentUser?.id) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProfileUser(null);
                        handleOpenBioModal();
                      }}
                      className="text-[10px] text-cyan-400 hover:underline cursor-pointer font-mono lowercase flex items-center gap-1"
                    >
                      <Edit3 className="w-2.5 h-2.5" />
                      <span>chỉnh sửa</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-[#aaa] leading-relaxed font-sans">
                  {(selectedProfileUser.id === 'usr_me' || selectedProfileUser.id === currentUser?.id)
                    ? myBio
                    : (selectedProfileUser.bio || 'Chưa cập nhật tiểu sử.')}
                </p>
              </div>

              {/* Listening Activity Card */}
              {selectedProfileUser.listening && (
                <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-cyan-950/30 to-black border border-cyan-500/30 flex items-center justify-between gap-3 shadow-md">
                  <div className="truncate flex-1">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1 mb-0.5">
                      <Activity className="w-3 h-3 animate-pulse" />
                      ĐANG PHÁT TRÊN SPYTIFY
                    </span>
                    <p className="text-xs font-bold text-white truncate">{selectedProfileUser.listening}</p>
                  </div>
                  <button
                    onClick={() => handlePlayMemberTrack(selectedProfileUser)}
                    className="px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-transform hover:scale-105 active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Nghe cùng</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── 9. MODAL ĐỔI TÊN HIỂN THỊ TRÊN SERVER (SERVER NICKNAME) ──────────────── */}
      {isNicknameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <form
            onSubmit={handleSaveServerNickname}
            className={`w-full max-w-md border rounded-2xl p-6 shadow-2xl relative ${
              isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0c0c14] border-[#222234] text-white'
            }`}
          >
            <button
              type="button"
              onClick={() => setIsNicknameModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-[#666] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
                style={{
                  backgroundColor: `${accentColor}20`,
                  color: accentColor,
                  border: `1px solid ${accentColor}40`,
                }}
              >
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight">Đổi Tên Hiển Thị Trên Server</h3>
                <p className="text-[11px] text-[#777] font-mono">
                  Máy chủ: <span style={{ color: accentColor }}>{selectedServer.name}</span>
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold font-mono text-[#aaa] block mb-1.5">
                  BIỆT DANH TRÊN SERVER NÀY
                </label>
                <input
                  type="text"
                  maxLength={32}
                  value={nicknameDraft}
                  onChange={e => setNicknameDraft(e.target.value)}
                  placeholder={currentUser?.display_name || 'Nhập biệt danh mới...'}
                  autoFocus
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-sans border outline-none transition-colors ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-slate-500'
                      : 'bg-[#12121c] border-[#242436] text-white focus:border-white/50'
                  }`}
                />
                <p className="text-[10px] text-[#777] font-mono mt-1.5">
                  Để trống nếu muốn dùng tên tài khoản gốc ({currentUser?.display_name || 'Operative'}).
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setNicknameDraft('');
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-mono text-[#888] hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
                >
                  Đặt lại mặc định
                </button>
                <button
                  type="submit"
                  style={{
                    backgroundColor: accentColor,
                    color: getContrastTextColor(accentColor),
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold font-mono cursor-pointer transition-transform hover:scale-105 active:scale-95 shadow-lg"
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ──────────────── 9.1 MODAL CHỈNH SỬA TIỂU SỬ CÁ NHÂN (USER BIO) ──────────────── */}
      {isBioModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <form
            onSubmit={handleSaveBio}
            className={`w-full max-w-md border rounded-2xl p-6 shadow-2xl relative ${
              isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0c0c14] border-[#222234] text-white'
            }`}
          >
            <button
              type="button"
              onClick={() => setIsBioModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-[#666] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
              >
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Chỉnh sửa tiểu sử (Bio)</h3>
                <p className="text-[11px] text-[#777] font-mono">
                  Giới thiệu ngắn về bản thân khi người khác xem hồ sơ của bạn
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1.5">
                  Tiểu sử cá nhân
                </label>
                <textarea
                  rows={3}
                  maxLength={160}
                  value={bioDraft}
                  onChange={e => setBioDraft(e.target.value)}
                  placeholder="Ví dụ: Đam mê Synthwave & Phonk. Lắng nghe âm nhạc 24/7..."
                  autoFocus
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-sans border outline-none resize-none transition-colors ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-slate-500'
                      : 'bg-[#12121c] border-[#242436] text-white focus:border-white/50'
                  }`}
                />
                <div className="flex items-center justify-between text-[10px] text-[#777] font-mono mt-1.5">
                  <span>Hiển thị trên hồ sơ popover và mini profile của bạn.</span>
                  <span>{bioDraft.length}/160</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setBioDraft('Đang khám phá âm nhạc trên Spytify.');
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-mono text-[#888] hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
                >
                  Mặc định
                </button>
                <button
                  type="submit"
                  style={{
                    backgroundColor: accentColor,
                    color: getContrastTextColor(accentColor),
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold font-mono cursor-pointer transition-transform hover:scale-105 active:scale-95 shadow-lg"
                >
                  Lưu tiểu sử
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ──────────────── 9.2 MODAL THIẾT LẬP SUY NGHĨ NGƯỜI DÙNG (USER THOUGHT / STATUS) ──────────────── */}
      {isEditingThoughtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <form
            onSubmit={handleSaveThought}
            className={`w-full max-w-md border rounded-2xl p-6 shadow-2xl relative ${
              isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0c0c14] border-[#222234] text-white'
            }`}
          >
            <button
              type="button"
              onClick={() => setIsEditingThoughtModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-[#666] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
              >
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Đặt suy nghĩ người dùng</h3>
                <p className="text-[11px] text-[#777] font-mono">
                  Chia sẻ tâm trạng, suy nghĩ hoặc trạng thái ngắn của bạn
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1.5">
                  Suy nghĩ / Trạng thái ngắn
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={thoughtDraft}
                  onChange={e => setThoughtDraft(e.target.value)}
                  placeholder="Ví dụ: Đang chill cùng Synthwave... 🎧"
                  autoFocus
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-sans border outline-none transition-colors ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-slate-500'
                      : 'bg-[#12121c] border-[#242436] text-white focus:border-white/50'
                  }`}
                />
                <div className="flex items-center justify-between text-[10px] text-[#777] font-mono mt-1.5">
                  <span>Hiển thị trên danh sách thành viên và mục Đang hoạt động.</span>
                  <span>{thoughtDraft.length}/80</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setThoughtDraft('');
                    setMyUserThought('');
                    try {
                      if (currentUser?.id) {
                        localStorage.removeItem(`spytify_user_thought_${currentUser.id}`);
                      }
                      localStorage.removeItem('spytify_user_thought');
                    } catch {}
                    if (activeChannelRef.current) {
                      activeChannelRef.current.send({
                        type: 'broadcast',
                        event: 'user_presence',
                        payload: {
                          ...myPresencePayloadRef.current,
                          custom_status: '',
                        },
                      });
                    }
                    setIsEditingThoughtModal(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-mono font-bold text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer mr-auto"
                >
                  Xóa trạng thái
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingThoughtModal(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-colors cursor-pointer ${
                    isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-[#181824] hover:bg-[#202030] text-[#aaa] hover:text-white'
                  }`}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-mono font-bold text-black shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                  style={{ backgroundColor: accentColor }}
                >
                  Lưu trạng thái
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ──────────────── 10. MODAL XÁC NHẬN CẢNH BÁO (XÓA SERVER / KICK THÀNH VIÊN) ──────────────── */}
      {confirmActionModal && (
        <div
          onClick={() => setConfirmActionModal(null)}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-md border rounded-2xl p-6 shadow-2xl relative ${
              isLight ? 'bg-white border-red-200 text-slate-900' : 'bg-[#0c0c14] border-red-500/40 text-white'
            }`}
          >
            <button
              type="button"
              onClick={() => setConfirmActionModal(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-[#666] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3.5 mb-4">
              <div
                className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 shadow-lg ${
                  confirmActionModal.type === 'transfer_owner'
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-amber-950/30'
                    : 'bg-red-500/15 border-red-500/40 text-red-400 shadow-red-950/30'
                }`}
              >
                {confirmActionModal.type === 'transfer_owner' ? (
                  <Crown className="w-6 h-6" />
                ) : (
                  <ShieldAlert className="w-6 h-6" />
                )}
              </div>
              <div>
                <span
                  className={`text-[10px] font-mono uppercase tracking-widest font-bold block ${
                    confirmActionModal.type === 'transfer_owner' ? 'text-amber-400' : 'text-red-400'
                  }`}
                >
                  CẢNH BÁO HÀNH ĐỘNG QUAN TRỌNG
                </span>
                <h3 className="text-base font-black tracking-tight">
                  {confirmActionModal.type === 'delete_server'
                    ? 'Xác nhận xóa máy chủ?'
                    : confirmActionModal.type === 'transfer_owner'
                    ? 'Xác nhận nhượng quyền Chủ Server?'
                    : confirmActionModal.type === 'delete_channel'
                    ? (confirmActionModal.channelType === 'voice' ? 'Xác nhận xóa phòng thoại?' : 'Xác nhận xóa kênh chat?')
                    : 'Xác nhận Kick thành viên?'}
                </h3>
              </div>
            </div>

            <div
              className={`p-3.5 rounded-xl border text-xs leading-relaxed mb-5 ${
                confirmActionModal.type === 'transfer_owner'
                  ? isLight
                    ? 'bg-amber-50 border-amber-200 text-slate-700'
                    : 'bg-amber-950/20 border-amber-500/25 text-[#d4d4e0]'
                  : isLight
                  ? 'bg-red-50 border-red-200 text-slate-700'
                  : 'bg-red-950/20 border-red-500/25 text-[#d4d4e0]'
              }`}
            >
              {confirmActionModal.type === 'delete_server' ? (
                <p>
                  Bạn có chắc chắn muốn xóa vĩnh viễn máy chủ{' '}
                  <strong className="text-red-400">"{confirmActionModal.serverName}"</strong> không? Toàn bộ kênh trò chuyện, phòng thoại và cấu hình của máy chủ này sẽ bị xóa và không thể khôi phục.
                </p>
              ) : confirmActionModal.type === 'transfer_owner' ? (
                <p>
                  Bạn có chắc chắn muốn trao quyền <strong>Chủ Server (Owner)</strong> của máy chủ{' '}
                  <strong>"{selectedServer.name}"</strong> cho thành viên{' '}
                  <strong className="text-amber-400">"{confirmActionModal.memberName}"</strong> không? Sau khi nhượng quyền, vai trò của bạn sẽ tự động hạ xuống thành{' '}
                  <strong className="text-emerald-400">Điều hành viên (Mod)</strong>.
                </p>
              ) : confirmActionModal.type === 'delete_channel' ? (
                <p>
                  Bạn có chắc chắn muốn xóa {confirmActionModal.channelType === 'voice' ? 'phòng thoại' : 'kênh chat'}{' '}
                  <strong className="text-red-400">"{confirmActionModal.channelName}"</strong> không?{' '}
                  {confirmActionModal.channelType === 'voice'
                    ? 'Mọi người đang tham gia đàm thoại trong phòng này sẽ bị ngắt kết nối và toàn bộ thiết lập trạm phát sẽ bị xóa.'
                    : 'Toàn bộ tin nhắn trò chuyện trong kênh này sẽ bị xóa khỏi máy chủ.'}
                </p>
              ) : (
                <p>
                  Bạn có chắc chắn muốn trục xuất (Kick) thành viên{' '}
                  <strong className="text-red-400">"{confirmActionModal.memberName}"</strong> khỏi máy chủ{' '}
                  <strong>"{selectedServer.name}"</strong> không? Bạn vẫn có thể mời lại họ sau này nếu cần.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmActionModal(null)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold font-mono cursor-pointer transition-colors border ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    : 'bg-[#161622] hover:bg-[#1f1f30] text-[#bbb] hover:text-white border-[#262638]'
                }`}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmActionModal.type === 'delete_server') {
                    handleDeleteServer(confirmActionModal.serverId);
                  } else if (confirmActionModal.type === 'transfer_owner') {
                    handleTransferOwnership(confirmActionModal.memberId);
                  } else if (confirmActionModal.type === 'delete_channel') {
                    executeDeleteChannel(confirmActionModal.channelId);
                    setConfirmActionModal(null);
                  } else {
                    handleKickMember(confirmActionModal.memberId);
                    setConfirmActionModal(null);
                  }
                }}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 cursor-pointer transition-transform hover:scale-105 active:scale-95 shadow-lg ${
                  confirmActionModal.type === 'transfer_owner'
                    ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/30'
                    : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                }`}
              >
                {confirmActionModal.type === 'transfer_owner' ? (
                  <Crown className="w-3.5 h-3.5" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>
                  {confirmActionModal.type === 'delete_server'
                    ? 'Xóa máy chủ vĩnh viễn'
                    : confirmActionModal.type === 'transfer_owner'
                    ? 'Xác nhận nhượng quyền'
                    : confirmActionModal.type === 'delete_channel'
                    ? (confirmActionModal.channelType === 'voice' ? 'Xóa phòng thoại' : 'Xóa kênh chat')
                    : 'Xác nhận Kick'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── 11. LIGHTBOX XEM ẢNH FULL-SIZE ──────────────── */}
      {lightboxImageUrl && (
        <div
          onClick={() => setLightboxImageUrl(null)}
          className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center cursor-default"
          >
            <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
              <a
                href={lightboxImageUrl}
                download="spytify_image.jpg"
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-full bg-black/70 hover:bg-white/20 text-white transition-all cursor-pointer shadow"
                title="Tải ảnh về máy"
              >
                <Download className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => setLightboxImageUrl(null)}
                className="p-2 rounded-full bg-black/70 hover:bg-red-600 text-white transition-all cursor-pointer shadow"
                title="Đóng xem ảnh"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={lightboxImageUrl}
              alt="Ảnh xem chi tiết"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl border border-white/15"
            />
          </div>
        </div>
      )}

      {/* ──────────────── 12. RESIDENT DJ BOT IN-ROOM LIVE STREAM SPEAKER (LOA PHÁT THANH PHÒNG THOẠI 24/7) ──────────────── */}
      {isConnectedVoiceRadio && currentVoiceDjBot && (() => {
        const streamInfo = getBotCurrentStream(currentVoiceDjBot.id);
        const loopParam = streamInfo.isLoopSingle ? `&loop=1&playlist=${streamInfo.id}` : '';
        return (
          <iframe
            ref={botRadioIframeRef}
            key={`dj_speaker_${currentVoiceDjBot.id}_${streamInfo.id}_${streamInfo.isLoopSingle ? 'loop' : 'live'}`}
            src={`https://www.youtube.com/embed/${streamInfo.id}?enablejsapi=1&autoplay=1&playsinline=1&modestbranding=1&rel=0${loopParam}`}
            title={`Loa phát thanh phòng - ${currentVoiceDjBot.name} (${streamInfo.title})`}
            allow="autoplay; encrypted-media; gyroscope; picture-in-picture"
            className="fixed -top-96 -left-96 w-1 h-1 opacity-0 pointer-events-none"
            onLoad={() => {
              try {
                const initSpeaker = () => {
                  try {
                    botRadioIframeRef.current?.contentWindow?.postMessage(
                      JSON.stringify({ event: 'listening', id: 1 }), '*'
                    );
                    const botUserVol =
                      (connectedVoiceChannelObj?.dj_bot_id ? userVolumes[connectedVoiceChannelObj.dj_bot_id] : undefined) ??
                      userVolumes[currentVoiceDjBot.id] ??
                      80;
                    const isBotLocallyMuted = Boolean(
                      locallyMutedUsers[currentVoiceDjBot.id] ||
                      (connectedVoiceChannelObj?.dj_bot_id && locallyMutedUsers[connectedVoiceChannelObj.dj_bot_id])
                    );
                    const effectiveVol = (isBotMuted || isDeafened || isBotLocallyMuted) ? 0 : Math.round(botUserVol * (speakerVolume / 100));
                    if (effectiveVol === 0) {
                      sendBotCmd('mute');
                      sendBotCmd('setVolume', [0]);
                      setIsBotSpeaking(false);
                    } else {
                      sendBotCmd('unMute');
                      sendBotCmd('setVolume', [effectiveVol]);
                      setIsBotSpeaking(true);
                    }
                    if (!streamInfo.isLoopSingle) {
                      sendBotCmd('seekTo', [99999999, true]); // Đồng bộ tới điểm phát sóng trực tiếp (live edge)
                    }
                    sendBotCmd('playVideo');
                  } catch {}
                };
                initSpeaker();
                setTimeout(initSpeaker, 400);
                setTimeout(initSpeaker, 1200);
              } catch {}
            }}
          />
        );
      })()}

      {/* ──────────────── 12b. ON-DEMAND MUSIC BOTS STREAMING XUYÊN SUỐT (HỖ TRỢ ĐA BOT & KHÔNG NGỪNG KHI OUT PHÒNG) ──────────────── */}
      {(() => {
        const activeSpeakers = new Map<string, { srvId: string; botId: string; botState: ServerDemandBotState }>();
        Object.entries(serverRythmBots).forEach(([rawKey, st]) => {
          if (!st?.currentTrack || !st.isPlaying) return;
          const { srvId, botId } = parseDemandBotKey(rawKey);
          const canonicalKey = getDemandBotKey(srvId, botId);
          activeSpeakers.set(canonicalKey, { srvId, botId, botState: st });
        });

        return Array.from(activeSpeakers.entries()).map(([botKey, { srvId, botId, botState }]) => {
          const track = botState.currentTrack!;
          // Chỉ mở âm thanh ra loa khi người dùng thực sự đang ở đúng Server & Phòng thoại có Bot;
          // khi out phòng vẫn giữ stream chạy ngầm xuyên suốt tới khi hết hàng đợi
          const isUserInConnectedVoice = Boolean(connectedVoiceChannel);
          const isUserInSameServer = connectedVoiceServerId === srvId;
          const isUserInSameRoom = !botState.voiceChannelId || connectedVoiceChannel === botState.voiceChannelId;
          const canUserHearBot = isUserInConnectedVoice && isUserInSameServer && isUserInSameRoom;
          const botProfile = resolveBotProfileById(botId);

          return (
            <iframe
              ref={el => {
                if (el) {
                  requestBotIframesRef.current[botKey] = el;
                } else {
                  delete requestBotIframesRef.current[botKey];
                }
              }}
              key={`request_bot_${botKey}_${track.id}_${track.url_or_id}`}
              src={`https://www.youtube.com/embed/${track.url_or_id}?enablejsapi=1&autoplay=1&playsinline=1&modestbranding=1&rel=0`}
              title={`${botProfile.display_name} Bot - ${track.title}`}
              allow="autoplay; encrypted-media; gyroscope; picture-in-picture"
              className="fixed -top-96 -left-96 w-1 h-1 opacity-0 pointer-events-none"
              onLoad={() => {
                try {
                  const initBotSpeaker = () => {
                    try {
                      const targetWin = requestBotIframesRef.current[botKey]?.contentWindow;
                      if (!targetWin) return;
                      targetWin.postMessage(JSON.stringify({ event: 'listening', id: 1 }), '*');
                      const botUserVol = userVolumes[botId] ?? userVolumes['usr_music_bot'] ?? 80;
                      const isMuted = Boolean(locallyMutedUsers[botId] || isDeafened || !canUserHearBot);
                      const effectiveVol = isMuted ? 0 : Math.round(botUserVol * (speakerVolume / 100));
                      if (effectiveVol === 0) {
                        targetWin.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: [] }), '*');
                        targetWin.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [0] }), '*');
                      } else {
                        targetWin.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: [] }), '*');
                        targetWin.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [effectiveVol] }), '*');
                      }
                      if (botState.startedAt) {
                        const elapsedSecs = Math.floor((Date.now() - botState.startedAt) / 1000);
                        if (elapsedSecs > 3 && elapsedSecs < 14400) {
                          targetWin.postMessage(
                            JSON.stringify({ event: 'command', func: 'seekTo', args: [elapsedSecs, true] }), '*'
                          );
                        }
                      }
                      targetWin.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
                    } catch {}
                  };
                  initBotSpeaker();
                  setTimeout(initBotSpeaker, 400);
                  setTimeout(initBotSpeaker, 1200);
                } catch {}
              }}
            />
          );
        });
      })()}

      {/* ──────────────── 13. USER SERVER TAG SELECTION MODAL ──────────────── */}
      {isTagSelectModalOpen && (
        <div
          onClick={() => setIsTagSelectModalOpen(false)}
          className="fixed inset-0 z-[65] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden flex flex-col ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0e0e18] border-[#26263a] text-white'
            }`}
          >
            {/* Modal Header */}
            <div className={`flex items-center justify-between px-5 py-4 border-b ${isLight ? 'border-slate-200' : 'border-[#1a1a2c]'}`}>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wide">Chọn Tag Sở Thích Của Bạn</h3>
                  <p className="text-[10px] text-[#888] font-mono truncate max-w-xs">
                    Máy chủ {selectedServer.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTagSelectModalOpen(false)}
                className="p-1.5 rounded-full text-[#666] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-[#888] font-sans">
                Chọn một hoặc nhiều tag sở thích do chủ máy chủ tạo ra. Các tag này sẽ hiển thị bên cạnh tên của bạn trên danh sách thành viên:
              </p>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {getServerTags(selectedServer).map(tag => {
                  const isSelected = selectedTagIdsDraft.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleToggleTagDraft(tag.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-opacity-100 shadow-md scale-[1.02]'
                          : isLight
                          ? 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                          : 'bg-[#12121e] hover:bg-[#181828] border-[#222234]'
                      }`}
                      style={isSelected ? {
                        backgroundColor: `${tag.color}15`,
                        borderColor: tag.color,
                        boxShadow: `0 0 16px ${tag.color}30`,
                      } : undefined}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {tag.icon ? (
                          <span className="text-sm shrink-0">{tag.icon}</span>
                        ) : (
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: tag.color }}
                          />
                        )}
                        <span className="text-xs font-bold truncate" style={{ color: isSelected ? tag.color : undefined }}>
                          {tag.name}
                        </span>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                          isSelected
                            ? 'border-transparent text-black'
                            : 'border-white/20'
                        }`}
                        style={isSelected ? { backgroundColor: tag.color } : undefined}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-2 text-[10px] font-mono text-[#888]">
                <span>Đã chọn: <strong className="text-cyan-400">{selectedTagIdsDraft.length}</strong> tag</span>
                {selectedTagIdsDraft.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedTagIdsDraft([])}
                    className="text-red-400 hover:underline cursor-pointer"
                  >
                    Bỏ chọn tất cả
                  </button>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`flex items-center justify-end gap-2.5 px-5 py-3 border-t ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#09090f] border-[#1a1a2c]'}`}>
              <button
                type="button"
                onClick={() => setIsTagSelectModalOpen(false)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  isLight ? 'border-slate-300 hover:bg-slate-100 text-slate-700' : 'border-white/10 hover:bg-white/5 text-zinc-300'
                }`}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveUserTags}
                style={{
                  backgroundColor: accentColor,
                  color: getContrastTextColor(accentColor),
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Lưu Tag</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── 14. MINI PROFILE CARD (DISCORD-STYLE POPOVER KHI HOVER CHUỘT VÀO USER / BOT) ──────────────── */}
      {hoveredProfile && (
        <div
          onMouseEnter={() => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
          }}
          onMouseLeave={() => {
            setHoveredProfile(null);
          }}
          style={{
            position: 'fixed',
            left: Math.max(12, hoveredProfile.rect.left - 290),
            top: Math.max(20, Math.min(window.innerHeight - 380, hoveredProfile.rect.top - 20)),
            zIndex: 80,
            width: '280px',
          }}
          className={`rounded-2xl shadow-2xl border overflow-hidden animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md ${
            isLight ? 'bg-white/95 border-slate-300 text-slate-900 shadow-slate-300/50' : 'bg-[#0f0f18]/95 border-[#28283c] text-white shadow-black/80'
          }`}
        >
          {/* Banner Gradient Header */}
          <div
            className="h-20 w-full relative"
            style={{
              background: `linear-gradient(135deg, ${accentColor}80 0%, #0d0d16 100%)`,
            }}
          >
            <div className="absolute top-2 right-2">
              <span
                className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border backdrop-blur-sm"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  borderColor: `${accentColor}50`,
                  color: '#fff',
                }}
              >
                {hoveredProfile.member.isHost || ACTIVE_BOT_IDS.has(hoveredProfile.member.id)
                  ? '🎧 RESIDENT BOT'
                  : isMemberServerOwner(hoveredProfile.member.id)
                  ? (language === 'vi' ? '👑 CHỦ SERVER' : '👑 SERVER OWNER')
                  : isMemberModerator(hoveredProfile.member.id)
                  ? '🛡️ MOD'
                  : (language === 'vi' ? 'THÀNH VIÊN' : 'MEMBER')}
              </span>
            </div>
          </div>

          {/* Avatar Overlap */}
          <div className="px-4 pb-4 -mt-10 relative">
            <div className="flex items-end justify-between mb-2.5">
              <div className="relative group/hovAvt">
                <div
                  className={`w-16 h-16 rounded-2xl overflow-hidden border-4 flex items-center justify-center font-bold text-lg shadow-xl ${
                    isLight ? 'bg-white border-white text-black' : 'bg-[#12121e] border-[#0f0f18] text-white'
                  }`}
                >
                  {renderAvatarContent(hoveredProfile.member.name, resolveUserAvatar(hoveredProfile.member.id, hoveredProfile.member.avatar))}
                </div>
                {renderStatusDot(hoveredProfile.member.status, 'md')}

                {/* Thought note bubble on mini profile avatar */}
                {(() => {
                  const isMe = hoveredProfile.member.id === 'usr_me' || (currentUser && hoveredProfile.member.id === currentUser.id) || (myParticipantIdRef.current && hoveredProfile.member.id === myParticipantIdRef.current);
                  const effectiveThought = isMe ? myUserThought : ((hoveredProfile.member as any).thought || realtimeUserPresences[hoveredProfile.member.id]?.thought || null);
                  if (!effectiveThought) return null;
                  return (
                    <div
                      onClick={() => {
                        if (isMe) {
                          setHoveredProfile(null);
                          handleOpenThoughtModal();
                        }
                      }}
                      title={isMe ? 'Bấm để đổi suy nghĩ người dùng' : undefined}
                      className={`absolute -top-4 left-1/2 -translate-x-1/2 max-w-[140px] px-2.5 py-0.5 rounded-full bg-zinc-950/95 border border-cyan-400 text-[9.5px] font-mono text-cyan-200 shadow-xl flex items-center gap-1 z-30 truncate ${
                        isMe ? 'cursor-pointer hover:scale-105 hover:border-cyan-300' : ''
                      }`}
                    >
                      <span className="text-[10px]">💭</span>
                      <span className="truncate">{effectiveThought}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Quick Action Buttons on Mini Profile */}
              <div className="flex items-center gap-1.5 pb-1">
                {hoveredProfile.member.id !== 'usr_me' && hoveredProfile.member.id !== currentUser?.id && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const targetUser = registeredUsers.find(u => u.id === hoveredProfile.member.id) || {
                          id: hoveredProfile.member.id,
                          username: hoveredProfile.member.username || hoveredProfile.member.name.toLowerCase().replace(/\s+/g, ''),
                          display_name: hoveredProfile.member.name,
                          avatar: resolveUserAvatar(hoveredProfile.member.id, hoveredProfile.member.avatar),
                          status: (hoveredProfile.member.status || 'online') as CommunityUserProfile['status'],
                          role: hoveredProfile.member.role || 'THÀNH VIÊN',
                          bio: hoveredProfile.bio || 'Thành viên Spytify từ hệ thống cộng đồng.',
                          created_at: new Date().toISOString(),
                        };
                        handleOpenDirectMessage(targetUser);
                        setHoveredProfile(null);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                      title={language === 'vi' ? 'Nhắn tin riêng (DM)' : 'Direct Message (DM)'}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{language === 'vi' ? 'Nhắn tin' : 'Message'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleInviteMemberToVoice(hoveredProfile.member);
                        setHoveredProfile(null);
                      }}
                      className="p-1.5 rounded-xl transition-all cursor-pointer shadow text-black"
                      style={{ backgroundColor: accentColor }}
                      title={language === 'vi' ? 'Mời vào Voice Channel' : 'Invite to Voice Channel'}
                    >
                      <PhoneCall className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Name and Tag Info */}
            <div>
              <h4 className="text-sm font-bold truncate leading-tight flex items-center gap-1.5">
                <span>{hoveredProfile.member.name}</span>
              </h4>
              <p className="text-[11px] text-[#888] font-mono mt-0.5">
                @{getCleanMemberUsername(hoveredProfile.member, registeredUsers, currentUser)}
              </p>
            </div>

            {/* Bio */}
            {(() => {
              const isSelf =
                hoveredProfile.member.id === 'usr_me' ||
                (currentUser && (hoveredProfile.member.id === currentUser.id || hoveredProfile.member.username === currentUser.username)) ||
                (myParticipantIdRef.current && hoveredProfile.member.id === myParticipantIdRef.current) ||
                hoveredProfile.member.name === myServerDisplayName;
              return (
                <div className="mt-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] uppercase font-mono tracking-wider text-[#777] font-bold">
                      {language === 'vi' ? 'TIỂU SỬ' : 'ABOUT ME'}
                    </span>
                    {isSelf && (
                      <button
                        type="button"
                        onClick={() => {
                          setHoveredProfile(null);
                          handleOpenBioModal();
                        }}
                        className="text-[9px] text-cyan-400 hover:underline cursor-pointer font-mono lowercase flex items-center gap-1"
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                        <span>{language === 'vi' ? 'chỉnh sửa' : 'edit'}</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-[#ccc] font-sans line-clamp-3 leading-relaxed bg-black/25 p-2 rounded-lg border border-white/5">
                    {isSelf ? myBio : (hoveredProfile.bio || (language === 'vi' ? 'Chưa thiết lập tiểu sử.' : 'No bio set.'))}
                  </p>
                </div>
              );
            })()}

            {/* Currently Listening */}
            {hoveredProfile.member.listening && (
              <div className="mt-2.5 p-2 rounded-xl bg-cyan-950/20 border border-cyan-500/25 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse flex-shrink-0" />
                <div className="min-w-0 flex-1 truncate">
                  <span className="text-[9px] uppercase font-mono tracking-wider text-cyan-400 block font-bold">
                    {language === 'vi' ? 'ĐANG NGHE' : 'LISTENING TO'}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-200 truncate block">{hoveredProfile.member.listening}</span>
                </div>
              </div>
            )}

            {/* TAGS LIST SECTION */}
            {(() => {
              const isSelf =
                hoveredProfile.member.id === 'usr_me' ||
                (currentUser && (hoveredProfile.member.id === currentUser.id || hoveredProfile.member.username === currentUser.username)) ||
                (myParticipantIdRef.current && hoveredProfile.member.id === myParticipantIdRef.current) ||
                hoveredProfile.member.name === myServerDisplayName;
              const userTags = (hoveredProfile.tags && hoveredProfile.tags.length > 0)
                ? hoveredProfile.tags
                : resolveMemberTags(hoveredProfile.member.id, selectedServer, isSelf ? 'usr_me' : hoveredProfile.member.name);
              return (
                <div className="mt-3 pt-2.5 border-t border-white/10">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#888] uppercase tracking-wider font-bold mb-1.5">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3 text-cyan-400" />
                      <span>{language === 'vi' ? 'TAGS SỞ THÍCH' : 'INTEREST TAGS'} ({userTags.length})</span>
                    </span>
                    {isSelf && (
                      <button
                        type="button"
                        onClick={() => {
                          setHoveredProfile(null);
                          handleOpenTagSelectModal();
                        }}
                        className="text-cyan-400 hover:underline cursor-pointer lowercase"
                      >
                        {language === 'vi' ? 'đổi tag' : 'edit tags'}
                      </button>
                    )}
                  </div>

                  {userTags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-0.5">
                      {userTags.map(tag => (
                        <span
                          key={tag.id}
                          className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 shadow-sm"
                          style={{
                            backgroundColor: `${tag.color}18`,
                            borderColor: `${tag.color}50`,
                            color: tag.color,
                            boxShadow: `0 0 10px ${tag.color}20`,
                          }}
                        >
                          {tag.icon ? (
                            <span className="text-xs">{tag.icon}</span>
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                          )}
                          <span>{tag.name}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-[#666] font-mono italic">
                      {language === 'vi' ? 'Chưa thiết lập tag nào trên máy chủ này.' : 'No tags configured on this server.'}
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ──────────────── 15. INCOMING VOICE CALL INVITATION MODAL DIALOG ──────────────── */}
      {incomingVoiceInvite && (
        <div className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className={`w-full max-w-sm rounded-2xl shadow-2xl border p-5 flex flex-col items-center text-center animate-in zoom-in-95 duration-200 ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#10101c] border-[#2c2c42] text-white'
            }`}
          >
            <div className="relative mb-3">
              <div
                className="w-16 h-16 rounded-2xl overflow-hidden border-2 flex items-center justify-center text-xl font-bold shadow-xl animate-bounce"
                style={{ borderColor: accentColor }}
              >
                {renderAvatarContent(incomingVoiceInvite.fromUserName, incomingVoiceInvite.fromUserAvatar)}
              </div>
              <span
                className="absolute -bottom-1 -right-1 p-1.5 rounded-full text-black shadow-lg"
                style={{ backgroundColor: accentColor }}
              >
                <PhoneCall className="w-3.5 h-3.5 fill-current animate-pulse" />
              </span>
            </div>

            <h3 className="text-base font-extrabold tracking-tight">
              {incomingVoiceInvite.isDmCall || incomingVoiceInvite.serverId === 'dm_private'
                ? 'Cuộc Gọi Thoại Đến'
                : 'Lời Mời Vào Phòng Thoại'}
            </h3>
            <p className="text-xs text-[#888] mt-1.5 max-w-xs">
              {incomingVoiceInvite.isDmCall || incomingVoiceInvite.serverId === 'dm_private' ? (
                <>
                  <strong className={isLight ? 'text-slate-900' : 'text-white'}>{incomingVoiceInvite.fromUserName}</strong> đang gọi thoại riêng cho bạn. Bạn có muốn bắt máy không?
                </>
              ) : (
                <>
                  <strong className={isLight ? 'text-slate-900' : 'text-white'}>{incomingVoiceInvite.fromUserName}</strong> đang mời bạn tham gia phòng thoại{' '}
                  <strong className="text-cyan-400">"{incomingVoiceInvite.channelName}"</strong> tại máy chủ{' '}
                  <strong className="text-amber-400">{incomingVoiceInvite.serverName}</strong>.
                </>
              )}
            </p>

            <div className="grid grid-cols-2 gap-2.5 w-full mt-5">
              <button
                type="button"
                onClick={handleDeclineVoiceInvite}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold font-mono border flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  isLight
                    ? 'border-slate-300 hover:bg-slate-100 text-slate-700'
                    : 'border-white/10 hover:bg-white/5 text-zinc-300'
                }`}
              >
                <PhoneOff className="w-3.5 h-3.5 text-red-400" />
                <span>Từ chối</span>
              </button>

              <button
                type="button"
                onClick={handleAcceptVoiceInvite}
                style={{
                  backgroundColor: accentColor,
                  color: getContrastTextColor(accentColor),
                }}
                className="py-2.5 px-4 rounded-xl text-xs font-bold font-mono flex items-center justify-center gap-1.5 transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
              >
                <PhoneCall className="w-3.5 h-3.5 fill-current" />
                <span>Chấp nhận</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── 16. MODAL SỬA LINK PHÁT SÓNG TRẠM YOUTUBE ──────────────── */}
      {editingStationChannel && (
        <div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className={`w-full max-w-md rounded-2xl shadow-2xl border p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-200 ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#10101c] border-[#2c2c42] text-white'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <Radio className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Cấu Hình Luồng Phát Sóng Trạm</h3>
                  <p className="text-[10px] text-[#888] font-mono">
                    Kênh: <strong className="text-white">{editingStationChannel.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStationChannel(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-[#888] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-black/30 border border-amber-500/25 space-y-2.5">
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300 block mb-1">
                    TÊN BOT DJ CỦA TRẠM:
                  </label>
                  <input
                    type="text"
                    value={editStationBotNameDraft}
                    onChange={e => setEditStationBotNameDraft(e.target.value)}
                    placeholder="VD: XmasBot, DJ CyberHawk, Custom DJ..."
                    className={`w-full px-3 py-2 rounded-xl text-xs font-sans outline-none border transition-colors ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500'
                        : 'bg-black/40 border-white/15 text-white focus:border-amber-400'
                    }`}
                  />
                  <p className="text-[9px] text-[#777] font-mono mt-1">
                    Tên này sẽ hiển thị bên dưới tên trạm thoại và trên thẻ phát sóng.
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] block mb-1">
                    AVATAR / LOGO BOT DJ:
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-800 border border-white/20 flex items-center justify-center font-bold text-xs text-white shrink-0">
                      {renderAvatarContent(editStationBotNameDraft || 'Bot', editStationBotAvatarDraft)}
                    </div>
                    <label className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[11px] font-mono font-bold cursor-pointer transition-colors flex items-center gap-1">
                      <span>📷 Tải ảnh</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = ev => {
                              if (typeof ev.target?.result === 'string') {
                                setEditStationBotAvatarDraft(ev.target.result);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    {editStationBotAvatarDraft && (
                      <button
                        type="button"
                        onClick={() => setEditStationBotAvatarDraft('')}
                        className="text-xs text-red-400 hover:underline cursor-pointer font-mono"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#888] block mb-1">
                  Link YouTube hoặc ID Video:
                </label>
                <input
                  type="text"
                  value={editStationUrlDraft}
                  onChange={e => setEditStationUrlDraft(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... hoặc ID 11 ký tự"
                  className={`w-full px-3 py-2 rounded-xl text-xs font-mono outline-none border transition-colors ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500'
                      : 'bg-black/40 border-white/15 text-white focus:border-amber-400'
                  }`}
                />
                <p className="text-[9px] text-[#777] font-mono mt-1">
                  Dán link bất kỳ: Luồng trực tiếp 24/7 (Live Stream) hoặc video nhạc thông thường.
                </p>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#888] block mb-1">
                  Tên hiển thị trạm (Tùy chọn):
                </label>
                <input
                  type="text"
                  value={editStationTitleDraft}
                  onChange={e => setEditStationTitleDraft(e.target.value)}
                  placeholder="VD: Lofi Chill Rơi Lệ, Phonk Drift 24/7..."
                  className={`w-full px-3 py-2 rounded-xl text-xs outline-none border transition-colors ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500'
                      : 'bg-black/40 border-white/15 text-white focus:border-amber-400'
                  }`}
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#888] block mb-1">
                  Luồng phát sóng 24/7 dự phòng (Mỗi dòng 1 URL YouTube):
                </label>
                <textarea
                  rows={2}
                  value={editStationBackupStreamsDraft}
                  onChange={e => setEditStationBackupStreamsDraft(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=...&#10;https://www.youtube.com/watch?v=..."
                  className={`w-full px-3 py-2 rounded-xl text-xs font-mono outline-none resize-none border transition-colors ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500'
                      : 'bg-black/40 border-white/15 text-white focus:border-amber-400'
                  }`}
                />
                <p className="text-[9px] text-[#777] font-mono mt-1">
                  Khi người dùng bấm "Đổi luồng stream 24/7 dự phòng", bot sẽ tự động xoay vòng sang các link này.
                </p>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#888] block mb-1.5">
                  Chế độ phát sóng của Bot:
                </label>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => setEditStationIsLoopDraft(false)}
                    className={`py-2 px-3 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      !editStationIsLoopDraft
                        ? 'bg-red-500/20 border-red-500/60 text-red-300 font-bold shadow-lg'
                        : 'bg-black/20 border-white/10 text-[#777] hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                      Luồng Live 24/7
                    </span>
                    <span className="text-[9px] text-[#888] font-sans">Dành cho YouTube Live Streams</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditStationIsLoopDraft(true)}
                    className={`py-2 px-3 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      editStationIsLoopDraft
                        ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300 font-bold shadow-lg'
                        : 'bg-black/20 border-white/10 text-[#777] hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-xs">
                      <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                      Lặp lại liên tục
                    </span>
                    <span className="text-[9px] text-[#888] font-sans">Dành cho video thường (Loop)</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setEditingStationChannel(null)}
                className="px-4 py-2 rounded-xl text-xs font-mono text-[#888] hover:text-white cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveStationEdit}
                className="px-4 py-2 rounded-xl text-xs font-mono font-bold bg-amber-500 hover:bg-amber-400 text-black cursor-pointer shadow-lg transition-transform hover:scale-105"
              >
                Lưu và Phát Sóng Ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
