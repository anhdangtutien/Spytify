import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, MessageSquare, Headphones, Users, Disc, Play, Send, 
  Music, Plus, Hash, Volume2, Flame, Activity, Share2,
  Mic, MicOff, PhoneCall, PhoneOff, VolumeX, Signal, Shield,
  X, Sparkles, Palette, Check, Settings, Sliders, Volume1, RotateCcw, CheckCircle2,
  MoreVertical, UserPlus, UserCheck, Heart, UserMinus, Trash2, Copy, Crown, Info,
  Search, ShieldAlert, AlertCircle, Edit3, EyeOff, Lock, LogIn
} from 'lucide-react';
import { Track, User, CommunityServer, CommunityChannel, CommunityMessage, StageSession, VoiceParticipant, CommunityUserProfile } from '../types';
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
  onPlayTrack: (track: Track) => void;
  onOpenAuth?: () => void;
  accentColor?: string;
  language?: LanguageCode;
  themeMode?: 'dark' | 'light';
  onActiveServerChange?: (server: CommunityServer | null) => void;
}

// Default DJ stage track
const DEFAULT_DJ_TRACK: Track = {
  id: 'yt_after_dark',
  title: 'After Dark',
  artist: 'Mr.Kitty',
  album: 'Time (Cyberpunk Synthwave)',
  duration_secs: 259,
  path_or_url: 'sVx1mJDeUj8',
  source: 'youtube',
  cover_art: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
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
    listening: 'Resonance - HOME',
    listeningTrack: {
      id: 'yt_resonance',
      title: 'Resonance',
      artist: 'HOME',
      album: 'Odyssey',
      duration_secs: 212,
      path_or_url: '8GW6sLrK40k',
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
    listening: 'Snowman - WYS',
    listeningTrack: {
      id: 'yt_snowman',
      title: 'Snowman',
      artist: 'WYS',
      album: '1 Am. Study Session',
      duration_secs: 184,
      path_or_url: 'N_7nL37m33s',
      source: 'youtube',
      cover_art: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
    },
    isHost: false,
    followsCurrentUser: false,
    joinedAt: '2024-05-10',
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
          const rawMembers = isOldDefaultMembers ? ['usr_me', userId] : s.member_ids || ['usr_me', userId];
          const memberSet = new Set(rawMembers);
          memberSet.add('usr_me');
          memberSet.add(userId);
          return {
            ...s,
            is_custom: true,
            owner_id: resolvedOwnerId,
            badge:
              resolvedOwnerId === userId
                ? 'OWNER'
                : Array.isArray(s.moderator_ids) && s.moderator_ids.includes(userId)
                ? 'MOD'
                : 'MEMBER',
            channels: s.channels.filter(c => c.type !== 'stage'),
            member_ids: Array.from(memberSet),
            moderator_ids: Array.isArray(s.moderator_ids) ? s.moderator_ids : [],
          };
        });
      if (!migratedFlag) {
        localStorage.setItem('spytify_custom_srv_zero_members_v1', '1');
      }
      localStorage.setItem(userKey, JSON.stringify(cleaned));
      return cleaned;
    }
  } catch {}
  return [];
};

export const CommunityView: React.FC<CommunityViewProps> = ({
  currentUser,
  currentTrack,
  isPlaying,
  onPlayTrack,
  onOpenAuth,
  accentColor = '#FF2A55',
  language = 'vi',
  themeMode = 'dark',
  onActiveServerChange,
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
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [inputText, setInputText] = useState('');
  const [attachCurrentTrack, setAttachCurrentTrack] = useState(false);

  // ──────── TẠO PHÒNG CHAT / PHÒNG THOẠI MỚI TRONG SERVER (RIÊNG BIỆT TỪNG SERVER) ────────
  const [creatingChannelState, setCreatingChannelState] = useState<{
    serverId: string;
    type: 'text' | 'voice';
  } | null>(null);
  const [newChannelName, setNewChannelName] = useState('');
  const creatingChannelType =
    creatingChannelState && creatingChannelState.serverId === selectedServer.id
      ? creatingChannelState.type
      : null;

  // ──────── MODAL TẠO SERVER MỚI ────────
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newServerPreset, setNewServerPreset] = useState('cyber');
  const [newServerName, setNewServerName] = useState('My Cyber Lounge');
  const [newServerDesc, setNewServerDesc] = useState('Trạm phát sóng âm nhạc');
  const [newServerIcon, setNewServerIcon] = useState('⚡');
  const [newServerColor, setNewServerColor] = useState('#00E5FF');

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
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);

  // ──────── AUDIO & VOICE SETTINGS (MIC & SPEAKER) ────────
  const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState(false);
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
  } | null>(null);

  useEffect(() => {
    const handleCloseMenu = () => setMemberMenu(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  const handleInviteMemberToVoice = (member: { id: string; name: string; isHost?: boolean }) => {
    const defaultVoiceCh = selectedServer.channels.find(c => c.type === 'voice') || selectedChannel;
    const targetVoiceChId =
      connectedVoiceServerId === selectedServer.id && connectedVoiceChannel
        ? connectedVoiceChannel
        : defaultVoiceCh.id;

    // If not currently in this server's voice channel, join voice first!
    if (connectedVoiceServerId !== selectedServer.id || !connectedVoiceChannel) {
      handleJoinVoiceCall(targetVoiceChId);
    }

    const newVp: VoiceParticipant = {
      id: member.id,
      name: member.name,
      username: member.id.replace('usr_', ''),
      avatar: null,
      isMuted: false,
      isDeafened: false,
      isSpeaking: !!member.isHost,
      isHost: !!member.isHost,
      serverId: selectedServer.id,
      channelId: targetVoiceChId,
    };

    setVoiceParticipants(prev => {
      if (prev.some(p => p.id === member.id && (p.serverId || selectedServer.id) === selectedServer.id)) return prev;
      return [...prev, newVp];
    });

    playAudioChime('join');
    setMemberMenu(null);
  };

  const handleRemoveMemberFromVoice = (memberId: string) => {
    setVoiceParticipants(prev =>
      prev.filter(p => !(p.id === memberId && (!p.serverId || p.serverId === selectedServer.id)))
    );
    playAudioChime('leave');
    setMemberMenu(null);
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
  const ACTIVE_BOT_IDS = new Set(['usr_host', 'usr_agent_01', 'usr_luna_lofi']);
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
            status: (ACTIVE_BOT_IDS.has(u.id) ? 'online' : 'offline') as CommunityUserProfile['status'],
          }));
        localStorage.setItem('spytify_registered_users', JSON.stringify(filtered));
        return filtered;
      }
    } catch {}
    return INITIAL_USERS;
  });

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

  // Real-time online presence map keyed by user id / username
  const [realtimeUserPresences, setRealtimeUserPresences] = useState<
    Record<string, {
      id: string;
      username: string;
      display_name: string;
      avatar?: string | null;
      status: 'online' | 'dnd' | 'invisible' | 'offline';
      listening?: string | null;
      listeningTrack?: Track | null;
    }>
  >({});

  const myServerDisplayName = (serverNicknames[selectedServer.id]?.trim()) || currentUser?.display_name || 'Bạn (Operative)';

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

  // Individual user volume scaling (Discord-style: 0% - 200%, default 100%)
  const [userVolumes, setUserVolumes] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('spytify_user_volumes');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

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
    | null
  >(null);
  const [serverSettingsTab, setServerSettingsTab] = useState<'overview' | 'members' | 'invites' | 'danger'>('overview');
  const [editServerName, setEditServerName] = useState('');
  const [editServerDesc, setEditServerDesc] = useState('');
  const [editServerIcon, setEditServerIcon] = useState('⚡');
  const [editServerColor, setEditServerColor] = useState('#00E5FF');
  const [editServerMaxMembers, setEditServerMaxMembers] = useState(50);
  const [inviteCopied, setInviteCopied] = useState(false);

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

  const handlePlayMemberTrack = (member: { listeningTrack?: Track | null, listening?: string | null }) => {
    if (member.listeningTrack) {
      onPlayTrack(member.listeningTrack);
    } else if (member.listening) {
      const parts = member.listening.split(' - ');
      const t: Track = {
        id: `yt_track_${Date.now()}`,
        title: parts[0] || member.listening,
        artist: parts[1] || 'Spytify Artist',
        album: 'Cyber Station Radio',
        duration_secs: 210,
        path_or_url: member.listening,
        source: 'youtube',
        cover_art: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
      };
      onPlayTrack(t);
    }
  };

  const handleOpenServerSettings = (srv: CommunityServer) => {
    setEditServerName(srv.name);
    setEditServerDesc(srv.description);
    setEditServerIcon(srv.icon);
    setEditServerColor(srv.accent_color);
    setEditServerMaxMembers(srv.max_members || 50);
    setServerSettingsTab('overview');
    setInviteCopied(false);
    setIsServerSettingsOpen(true);
  };

  const handleSaveServerSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editServerName.trim()) return;

    const updatedSrv: CommunityServer = {
      ...selectedServer,
      name: editServerName.trim(),
      description: editServerDesc.trim(),
      icon: editServerIcon.trim() || '⚡',
      accent_color: editServerColor,
      max_members: editServerMaxMembers,
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

  // ──────── QUYỀN HẠN TRONG SERVER (CHỦ SERVER / MOD / THÀNH VIÊN) ────────
  const myAccountUserId = currentUser?.id || 'usr_me';
  const hasActiveServer = !isFriendsTabActive && servers.length > 0 && selectedServer.id !== 'srv_none';
  const isServerOwner = Boolean(
    selectedServer.id !== 'srv_none' &&
    (selectedServer.owner_id === myAccountUserId || selectedServer.owner_id === 'usr_me')
  );
  const isServerMod = Boolean(
    selectedServer.id !== 'srv_none' &&
    !isServerOwner &&
    Array.isArray(selectedServer.moderator_ids) &&
    (selectedServer.moderator_ids.includes(myAccountUserId) || selectedServer.moderator_ids.includes('usr_me'))
  );
  const canManageServer = isServerOwner || isServerMod;

  const isMemberModerator = (memberId: string, srv: CommunityServer = selectedServer): boolean => {
    if (srv.id === 'srv_none') return false;
    if (memberId === 'usr_me') return isServerMod;
    return Array.isArray(srv.moderator_ids) && srv.moderator_ids.includes(memberId);
  };

  const isMemberServerOwner = (memberId: string, srv: CommunityServer = selectedServer): boolean => {
    if (srv.id === 'srv_none') return false;
    return memberId === 'usr_me' ? isServerOwner : srv.owner_id === memberId;
  };

  const broadcastAndPersistServerUpdate = (updatedSrv: CommunityServer) => {
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

    setMessages(prev => {
      const next = [...prev.slice(-(MAX_CHAT_MESSAGES_LIMIT - 1)), welcomeMsg];
      try {
        if (currentUser?.id) {
          localStorage.setItem(`spytify_server_messages_${currentUser.id}`, JSON.stringify(next));
        }
      } catch {}
      return next;
    });

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
    if (!isServerOwner || memberId === 'usr_me') return;
    const currentMods = Array.isArray(selectedServer.moderator_ids) ? selectedServer.moderator_ids : [];
    const nextMods = currentMods.includes(memberId)
      ? currentMods.filter(id => id !== memberId)
      : [...currentMods, memberId];
    const updatedSrv: CommunityServer = { ...selectedServer, moderator_ids: nextMods };
    broadcastAndPersistServerUpdate(updatedSrv);
  };

  const requestTransferOwnership = (memberId: string, memberName?: string) => {
    if (!isServerOwner || memberId === 'usr_me' || memberId === myAccountUserId) return;
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
    if (!isServerOwner || !newOwnerId || newOwnerId === 'usr_me' || newOwnerId === myAccountUserId) return;
    const currentMods = Array.isArray(selectedServer.moderator_ids) ? selectedServer.moderator_ids : [];
    const modSet = new Set(currentMods.filter(id => id !== newOwnerId));
    modSet.add(myAccountUserId);
    modSet.add('usr_me');

    const currentMembers = Array.isArray(selectedServer.member_ids) ? selectedServer.member_ids : ['usr_me'];
    const memberSet = new Set(currentMembers);
    memberSet.add(myAccountUserId);
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
    if (!canManageServer || memberId === 'usr_me') return;
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
    if (!canManageServer || memberId === 'usr_me') return;
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
      targetSrv = {
        ...localMatch,
        ...cloudMatch,
        member_ids: Array.from(
          new Set([...(localMatch.member_ids || []), ...(cloudMatch.member_ids || [])])
        ),
        moderator_ids: Array.from(
          new Set([...(localMatch.moderator_ids || []), ...(cloudMatch.moderator_ids || [])])
        ),
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
    const newCh: CommunityChannel = {
      id: `ch_${selectedServer.id}_${Date.now()}`,
      name: formattedName,
      type: creatingChannelType,
      topic:
        creatingChannelType === 'text'
          ? `Kênh trò chuyện #${formattedName}`
          : `Phòng đàm thoại ${formattedName}`,
    };
    const updatedSrv: CommunityServer = {
      ...selectedServer,
      channels: [...selectedServer.channels, newCh],
    };
    const nextServers = servers.map(s => (s.id === selectedServer.id ? updatedSrv : s));
    setServers(nextServers);
    setSelectedServer(updatedSrv);
    persistServers(nextServers);
    setCreatingChannelState(null);
    setNewChannelName('');
    handleSelectChannel(newCh);
  };

  const handleDeleteChannel = (channelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
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
    const nextServers = servers.map(s => (s.id === selectedServer.id ? updatedSrv : s));
    setServers(nextServers);
    setSelectedServer(updatedSrv);
    persistServers(nextServers);
    if (selectedChannel.id === channelId && nextChannels.length > 0) {
      setSelectedChannel(nextChannels[0]);
    }
  };

  const handleCopyInvite = (srvId: string) => {
    navigator.clipboard.writeText(`spytify://station/join/${srvId}`);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2500);
  };

  // Determine real-time effective status for any user
  const getEffectiveStatus = (u: CommunityUserProfile): 'online' | 'dnd' | 'offline' => {
    if (ACTIVE_BOT_IDS.has(u.id)) return 'online';
    const rt = realtimeUserPresences[u.id] || Object.values(realtimeUserPresences).find(p => p.username.toLowerCase() === u.username.toLowerCase());
    if (rt && (rt.status === 'online' || rt.status === 'dnd')) return rt.status;
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
        registeredUsers.some(u => u.id === m.user_id || u.username.toLowerCase() === (m.username || '').toLowerCase()) ||
        Object.values(realtimeUserPresences).some(
          rt => rt.id === m.user_id || rt.username.toLowerCase() === (m.username || '').toLowerCase()
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
        const rt = realtimeUserPresences[u.id] || Object.values(realtimeUserPresences).find(p => p.username.toLowerCase() === u.username.toLowerCase());
        const latestMsgWithAvatar = [...messages]
          .reverse()
          .find(m => m.user_id === u.id && m.avatar);
        const effStatus = getEffectiveStatus(u);
        const effName = rt?.display_name || u.display_name;
        const effAvatar = rt?.avatar || u.avatar || latestMsgWithAvatar?.avatar || followersOfMeMap[u.id]?.followerAvatar || null;
        const effListening = effStatus === 'offline' && !ACTIVE_BOT_IDS.has(u.id) ? null : (rt?.listening !== undefined ? rt.listening : (u.listening || null));
        const effTrack = effStatus === 'offline' && !ACTIVE_BOT_IDS.has(u.id) ? null : (rt?.listeningTrack !== undefined ? rt.listeningTrack : (u.listeningTrack || null));
        const effRole = isMemberServerOwner(u.id)
          ? 'CHỦ SERVER'
          : isMemberModerator(u.id)
          ? 'MOD'
          : u.role;
        return {
          id: u.id,
          name: effName,
          avatar: effAvatar,
          role: effRole,
          status: effStatus,
          listening: effListening,
          listeningTrack: effTrack,
          isHost: Boolean(u.isHost),
          userProfile: {
            ...u,
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
        !registeredUsers.some(u => u.id === rt.id || u.username.toLowerCase() === rt.username.toLowerCase())
      )
      .map(rt => {
        const effStatus: 'online' | 'dnd' | 'offline' = rt.status === 'online' || rt.status === 'dnd' ? rt.status : 'offline';
        const effRole = isMemberServerOwner(rt.id)
          ? 'CHỦ SERVER'
          : isMemberModerator(rt.id)
          ? 'MOD'
          : 'THÀNH VIÊN';
        return {
          id: rt.id,
          name: rt.display_name,
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
        ? 'CHỦ SERVER'
        : isMemberModerator(em.id)
        ? 'MOD'
        : 'THÀNH VIÊN';
      return {
        id: em.id,
        name: em.display_name,
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
      avatar: currentUser?.avatar || null,
      role: isServerOwner ? 'CHỦ SERVER' : isServerMod ? 'MOD' : 'THÀNH VIÊN',
      status: myEffectivePublicStatus,
      listening: myVisibleListening,
      listeningTrack: myVisibleTrack,
      isHost: false,
      userProfile: {
        id: 'usr_me',
        username: currentUser?.username || currentUser?.email?.split('@')[0] || 'me',
        display_name: myServerDisplayName,
        avatar: currentUser?.avatar || null,
        role: isServerOwner ? 'CHỦ SERVER' : isServerMod ? 'MOD' : 'THÀNH VIÊN',
        status: myEffectivePublicStatus,
        bio: 'Đang lắng nghe âm nhạc trên Spytify.',
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeChannelRef = useRef<any>(null);

  // ──────── WEBRTC REAL-TIME VOICE (P2P MESH, SIGNALING QUA SUPABASE BROADCAST) ────────
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const remoteAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const outboundStreamRef = useRef<MediaStream | null>(null);
  const voiceServerIdRef = useRef<string>('');
  const myVoiceParticipantRef = useRef<VoiceParticipant | null>(null);
  const voiceVolRef = useRef({ speaker: 100, deafened: false, users: {} as Record<string, number> });

  const applyRemoteVolume = (peerId: string) => {
    const el = remoteAudioRef.current.get(peerId);
    if (!el) return;
    const { speaker, deafened, users } = voiceVolRef.current;
    el.muted = deafened;
    el.volume = Math.max(0, Math.min(1, (speaker / 100) * ((users[peerId] ?? 100) / 100)));
  };

  useEffect(() => {
    voiceVolRef.current = { speaker: speakerVolume, deafened: isDeafened, users: userVolumes };
    remoteAudioRef.current.forEach((_, id) => applyRemoteVolume(id));
  }, [speakerVolume, isDeafened, userVolumes]);

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
    const ICE_SERVERS: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];

    const createPeer = (peerId: string): RTCPeerConnection => {
      const existing = peersRef.current.get(peerId);
      if (existing) return existing;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peersRef.current.set(peerId, pc);

      const out = outboundStreamRef.current;
      if (out && out.getAudioTracks().length > 0) {
        out.getAudioTracks().forEach(t => pc.addTrack(t, out));
      } else {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) send('rtc_ice', { from: myId, to: peerId, candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        setDmCallConnected(true);
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
        const pc = createPeer(payload.from);
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
        if (peersRef.current.size === 0) {
          setDmCallConnected(false);
        }
      }
    });

    ch.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') send('rtc_hello', { from: myId });
    });

    return () => {
      send('rtc_bye', { from: myId });
      Array.from(peersRef.current.keys()).forEach(closePeer);
      ch.unsubscribe();
    };
  }, [connectedVoiceChannel]);

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
        const [cloudProfiles, followGraph, serverInvites, cloudServers] = await Promise.all([
          fetchAllCloudProfiles(),
          fetchCloudFollowGraph(currentUser.id),
          fetchCloudServerInvites(currentUser.id),
          fetchCloudServersForUser(currentUser.id),
        ]);

        if (!isMounted) return;

        // 0. Đồng bộ lời mời vào Server (incoming / outgoing) & các Server của user từ Cloud
        setIncomingServerInvites(serverInvites.incoming);
        setOutgoingServerInvites(serverInvites.outgoing);

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
                'usr_me',
              ])
            ).filter(id => !kickedSet.has(id) || id === cs.owner_id);
            const combinedMods = Array.from(
              new Set([
                ...(Array.isArray(localSrv?.moderator_ids) ? localSrv!.moderator_ids! : []),
                ...(Array.isArray(cs.moderator_ids) ? cs.moderator_ids : []),
              ])
            ).filter(id => !kickedSet.has(id));
            const badge =
              cs.owner_id === currentUser.id
                ? 'OWNER'
                : combinedMods.includes(currentUser.id)
                ? 'MOD'
                : 'MEMBER';
            return {
              ...localSrv,
              ...cs,
              is_custom: true,
              badge,
              member_ids: combinedMembers,
              moderator_ids: combinedMods,
              kicked_ids: Array.from(kickedSet),
            };
          };

          setServers(prev => {
            const byId = new Map<string, CommunityServer>();
            prev.forEach(s => byId.set(s.id, s));
            cloudServers.forEach((cs: CommunityServer) => {
              if (!cs?.id || cs.id === 'srv_none') return;
              byId.set(cs.id, mergeServerWithCloud(byId.get(cs.id), cs));
            });
            const merged = Array.from(byId.values());
            persistServers(merged);
            return merged;
          });

          setSelectedServer(prev => {
            if (!prev || prev.id === 'srv_none') return prev;
            const matchedCloud = cloudServers.find((cs: CommunityServer) => cs?.id === prev.id);
            if (!matchedCloud) return prev;
            return mergeServerWithCloud(prev, matchedCloud);
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

      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        const next = [...prev, msg].slice(-MAX_CHAT_MESSAGES_LIMIT);
        try {
          localStorage.setItem(`spytify_server_messages_${currentUser.id}`, JSON.stringify(next));
        } catch {}
        return next;
      });

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

    socialCh.subscribe();

    return () => {
      isMounted = false;
      clearInterval(dmPollTimer);
      socialCh.unsubscribe();
      globalSocialChannelRef.current = null;
    };
  }, [currentUser?.id, isFriendsTabActive]);

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
        handleJoinVoiceCall(channel.id);
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
    listening: myVisibleListening,
    listeningTrack: myVisibleTrack,
  };

  // Broadcast presence updates whenever status, server nickname, avatar, or track changes
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
  }, [myStatus, myServerDisplayName, currentTrack?.id, currentUser?.avatar]);

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
              created_at: r.created_at || '',
            });
          });
          const merged = Array.from(map.values()).slice(-MAX_CHAT_MESSAGES_LIMIT);
          try {
            localStorage.setItem(`spytify_server_messages_${currentUser.id}`, JSON.stringify(merged));
          } catch {}
          return merged;
        });

        chatSenders.forEach(sender => {
          ensureMemberSyncedToServer(sender, currentSrvId, false);
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

      const mergedModIds = Array.from(
        new Set([
          ...(Array.isArray(selectedServer.moderator_ids) ? selectedServer.moderator_ids : []),
          ...(Array.isArray(cloudSrv?.moderator_ids) ? cloudSrv.moderator_ids : []),
        ])
      ).filter(id => !kickedSet.has(id));

      const effectiveOwnerId = cloudSrv?.owner_id || selectedServer.owner_id;
      const myBadge =
        effectiveOwnerId === currentUser.id
          ? 'OWNER'
          : mergedModIds.includes(currentUser.id)
          ? 'MOD'
          : 'MEMBER';

      const mergedSrv: CommunityServer = {
        ...selectedServer,
        ...(cloudSrv || {}),
        id: currentSrvId,
        is_custom: true,
        badge: myBadge,
        owner_id: effectiveOwnerId,
        member_ids: mergedMemberIds,
        moderator_ids: mergedModIds,
        kicked_ids: Array.from(kickedSet),
      };

      setServers(prev => {
        const next = prev.map(s => (s.id === currentSrvId ? mergedSrv : s));
        persistServers(next);
        return next;
      });
      setSelectedServer(prev => (prev.id === currentSrvId ? mergedSrv : prev));
      pushCloudServer(mergedSrv).catch(() => {});
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
        const myBadge =
          upd.owner_id === currentUser.id
            ? 'OWNER'
            : Array.isArray(upd.moderator_ids) && upd.moderator_ids.includes(currentUser.id)
            ? 'MOD'
            : 'MEMBER';
        const mergedSrv = { ...upd, badge: myBadge };
        setServers(prev => {
          const next = prev.map(s => (s.id === mergedSrv.id ? mergedSrv : s));
          persistServers(next);
          return next;
        });
        setSelectedServer(mergedSrv);
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

        setMessages(prev => {
          if (prev.some(m => m.id === payload.id)) return prev;
          const next = [...prev, payload].slice(-MAX_CHAT_MESSAGES_LIMIT);
          try {
            if (currentUser?.id) {
              localStorage.setItem(`spytify_server_messages_${currentUser.id}`, JSON.stringify(next));
            }
          } catch {}
          return next;
        });

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
        [payload.id]: payload,
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
  const handleJoinVoiceCall = async (targetChannelId?: string) => {
    const myId = myParticipantIdRef.current;
    const channelIdToConnect = targetChannelId || selectedChannel.id;
    voiceServerIdRef.current = selectedServer.id;
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
      isHost: selectedServer.id.startsWith('srv_custom_'),
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
      setConnectedVoiceServerId(selectedServer.id);
      playAudioChime('join');

      // Phát sóng trạng thái tham gia cuộc gọi qua Supabase!
      myVoiceParticipantRef.current = myParticipant;
      if (activeChannelRef.current) {
        activeChannelRef.current.send({
          type: 'broadcast',
          event: 'voice_presence',
          payload: { action: 'join', participant: myParticipant },
        });
      }
    } catch {
      setConnectedVoiceChannel(channelIdToConnect);
      setConnectedVoiceServerId(selectedServer.id);
      setIsMuted(true);
      playAudioChime('join');
      myVoiceParticipantRef.current = { ...myParticipant, isMuted: true };

      if (activeChannelRef.current) {
        activeChannelRef.current.send({
          type: 'broadcast',
          event: 'voice_presence',
          payload: { action: 'join', participant: { ...myParticipant, isMuted: true } },
        });
      }
    }
  };

  const handleLeaveVoiceCall = () => {
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
    if (activeChannelRef.current) {
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'voice_presence',
        payload: { action: 'leave', userId: myId },
      });
    }

    setConnectedVoiceChannel(null);
    setConnectedVoiceServerId(null);
    setIsUserSpeaking(false);
    playAudioChime('leave');
  };

  const handleToggleMute = () => {
    const myId = myParticipantIdRef.current;
    setIsMuted(prev => {
      const next = !prev;
      if (micStreamRef.current) {
        micStreamRef.current.getAudioTracks().forEach(t => {
          t.enabled = !next;
        });
      }
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
    if (!clean && !attachCurrentTrack) return;

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
      created_at: createdAtStr,
    };

    setMessages(prev => {
      const next = [...prev.slice(-(MAX_CHAT_MESSAGES_LIMIT - 1)), newMsg];
      try {
        if (currentUser?.id) {
          localStorage.setItem(`spytify_server_messages_${currentUser.id}`, JSON.stringify(next));
        }
        localStorage.removeItem('spytify_server_messages');
      } catch {}
      return next;
    });
    setInputText('');
    setAttachCurrentTrack(false);

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
        created_at: createdAtStr,
        sent_at: new Date().toISOString(),
      }).catch(() => {});
    }
  };

  // ──────── ĐỒNG BỘ TIN NHẮN RIÊNG (DM 1-1) & CALL RIÊNG (TỐI ĐA 80 TIN NHẮN) ────────
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

  const handleStartPrivateCall = async (friend: CommunityUserProfile) => {
    if (!currentUser) return;
    setIsFriendsTabActive(true);
    setActiveDmFriend(friend);

    const roomId = getDmRoomId(currentUser.id, friend.id);
    const dmVoiceChId = `dm_voice_${roomId}`;

    // Nếu đang ở trong chính cuộc gọi riêng này thì giữ nguyên
    if (connectedVoiceServerId === 'dm_private' && connectedVoiceChannel === dmVoiceChId) {
      return;
    }

    // Dọn dẹp cuộc gọi cũ nếu có
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
    } catch {
      setIsMuted(true);
    }

    setConnectedVoiceServerId('dm_private');
    setConnectedVoiceChannel(dmVoiceChId);
    playAudioChime('join');
  };

  const handleSendDmMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser || !activeDmFriend || !currentDmRoomId) return;
    const clean = dmInputText.trim();
    if (!clean && !dmAttachTrack) return;

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

        {/* Server Icons List */}
        <div className="flex-1 w-full flex flex-col items-center gap-2 overflow-y-auto no-scrollbar">
          {servers.map(srv => {
            const isSelected = !isFriendsTabActive && selectedServer.id === srv.id;
            const srvUnreadCount = srv.channels.reduce(
              (acc, ch) => acc + (unreadChannelCounts[ch.id] || 0),
              0
            );
            return (
              <div key={srv.id} className="relative group flex items-center justify-center w-full">
                <span 
                  className={`absolute left-0 w-1 rounded-r-full transition-all duration-200 ${
                    isSelected ? 'h-8' : srvUnreadCount > 0 ? 'h-3 bg-red-500 opacity-100' : 'h-2 bg-zinc-600 opacity-0 group-hover:opacity-100'
                  }`}
                  style={{ backgroundColor: isSelected ? accentColor : undefined }}
                />
                
                <button
                  onClick={() => {
                    setIsFriendsTabActive(false);
                    handleSelectServer(srv);
                  }}
                  className={`w-11 h-11 flex items-center justify-center text-base font-bold cursor-pointer transition-all duration-200 shadow-md relative ${
                    isSelected 
                      ? 'rounded-xl border' 
                      : isLight 
                      ? 'rounded-3xl hover:rounded-xl bg-[#ffffff] border border-[#cbd5e1] text-[#334155] hover:text-[#0f172a]'
                      : 'rounded-3xl hover:rounded-xl bg-[#0e0e14] border border-[#1e1e28] hover:border-white/30 text-zinc-300 hover:text-white'
                  }`}
                  style={{
                    backgroundColor: isSelected ? `${accentColor}25` : undefined,
                    borderColor: isSelected ? accentColor : undefined,
                    color: isSelected ? accentColor : undefined,
                  }}
                  title={srv.name}
                >
                  <div className="w-full h-full rounded-[inherit] overflow-hidden flex items-center justify-center">
                    {renderServerIconContent(srv.icon, srv.name, isSelected ? accentColor : srv.accent_color, 'w-5 h-5')}
                  </div>
                  {srvUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-mono font-black flex items-center justify-center border-2 border-[#040407] shadow-md">
                      {srvUnreadCount > 99 ? '99+' : srvUnreadCount}
                    </span>
                  )}
                </button>
              </div>
            );
          })}

          {/* NÚT "+" ĐỂ MỞ BẢNG TỰ TẠO SERVER */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
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

              {/* Server Settings Cog Button */}
              <button
                onClick={() => handleOpenServerSettings(selectedServer)}
                title="Cài đặt máy chủ & Quản lý thành viên (Discord Server Settings)"
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
                            onClick={(e) => handleDeleteChannel(channel.id, e)}
                            title="Xóa phòng chat"
                            className="opacity-0 group-hover/ch:opacity-100 p-0.5 rounded text-[#666] hover:text-red-400 transition-opacity cursor-pointer flex-shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
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
              <form onSubmit={handleCreateChannel} className="mb-1.5 px-1 space-y-1.5">
                <input
                  type="text"
                  autoFocus
                  maxLength={28}
                  value={newChannelName}
                  onChange={e => setNewChannelName(e.target.value)}
                  placeholder="Đặt tên phòng thoại..."
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
                .filter(c => c.type === 'voice')
                .map(channel => {
                  const isCur = selectedChannel.id === channel.id;
                  const isVoiceActive =
                    connectedVoiceServerId === selectedServer.id && connectedVoiceChannel === channel.id;
                  const otherVoiceParticipants = voiceParticipants.filter(
                    p =>
                      p.id !== myParticipantIdRef.current &&
                      (!p.serverId || p.serverId === selectedServer.id) &&
                      (!p.channelId || p.channelId === channel.id)
                  );
                  const totalVoiceCount = (isVoiceActive ? 1 : 0) + otherVoiceParticipants.length;
                  const voiceCount = selectedServer.channels.filter(c => c.type === 'voice').length;

                  return (
                    <div key={channel.id} className="space-y-1">
                      <div
                        onClick={() => handleSelectChannel(channel)}
                        className={`group/vch w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left cursor-pointer transition-colors ${
                          isCur
                            ? isLight ? 'bg-[#e2e8f0] text-[#0f172a] font-semibold' : 'bg-[#161624] text-white font-semibold'
                            : isLight ? 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#edf2f7]' : 'text-[#888899] hover:text-white hover:bg-[#0e0e14]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Volume2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: isVoiceActive ? '#00FF66' : accentColor }} />
                          <span className="truncate">{getChannelName(channel)}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isVoiceActive ? (
                            <span 
                              className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.2 rounded border"
                              style={{
                                color: accentColor,
                                backgroundColor: `${accentColor}18`,
                                borderColor: `${accentColor}40`,
                              }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: accentColor }} />
                              {getTranslation(language, 'community.connected')}
                            </span>
                          ) : totalVoiceCount > 0 ? (
                            <span className={`shrink-0 whitespace-nowrap text-[9px] font-mono px-1.5 py-0.2 rounded border ${isLight ? 'bg-[#ffffff] text-[#64748b] border-[#cbd5e1]' : 'bg-[#121218] text-[#666] border-[#202028]'}`}>
                              {totalVoiceCount} {getTranslation(language, 'community.members')}
                            </span>
                          ) : null}
                          {canManageServer && voiceCount > 1 && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteChannel(channel.id, e)}
                              title="Xóa phòng thoại"
                              className="opacity-0 group-hover/vch:opacity-100 p-0.5 rounded text-[#666] hover:text-red-400 transition-opacity cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
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
                              {isMuted && <MicOff className="w-2.5 h-2.5 text-red-400 ml-auto" />}
                            </div>
                          )}

                          {otherVoiceParticipants.map(vp => (
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
                                    role: vp.isHost ? 'DJ / HOST' : 'MEMBER',
                                    isHost: vp.isHost,
                                    status: 'online',
                                    listening: vp.isHost ? 'After Dark - Mr.Kitty' : null,
                                    listeningTrack: vp.isHost ? DEFAULT_DJ_TRACK : null,
                                  },
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
                              {vp.isHost && (
                                <span className="text-[8px] font-mono font-bold text-amber-400 bg-amber-400/10 px-1 rounded">
                                  DJ
                                </span>
                              )}
                              {vp.isMuted && <MicOff className="w-2.5 h-2.5 text-red-400 ml-auto" />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Persistent Bottom Voice Status Bar */}
        {connectedVoiceChannel && connectedVoiceServerId === selectedServer.id && (
          <div className={`p-2.5 border-t flex flex-col gap-2 animate-in fade-in duration-200 ${isLight ? 'bg-[#f1f5f9] border-[#e2e8f0]' : 'bg-[#0c0c14] border-[#181824]'}`}>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Signal className="w-3.5 h-3.5 text-emerald-400" />
                <div>
                  <p className="text-[10px] font-bold text-emerald-400 font-mono flex items-center gap-1">
                    {getTranslation(language, 'community.callConnected')}
                    <span className="text-[8px] text-[#666]">18ms</span>
                  </p>
                  <p className={`text-[9px] font-mono truncate max-w-[120px] ${isLight ? 'text-[#64748b]' : 'text-[#888]'}`}>
                    {selectedServer.channels.find(c => c.id === connectedVoiceChannel) ? getChannelName(selectedServer.channels.find(c => c.id === connectedVoiceChannel)!) : getTranslation(language, 'community.voiceChannelFallback')}
                  </p>
                </div>
              </div>

              <button
                onClick={handleLeaveVoiceCall}
                className="p-1.5 rounded-lg bg-red-950/50 hover:bg-red-900 border border-red-500/30 text-red-300 hover:text-white transition-colors cursor-pointer"
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
            <div className="relative flex-shrink-0">
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
            </div>

            <div className="truncate flex-1 min-w-0">
              <p className={`text-[11px] font-bold truncate leading-tight ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>
                {myServerDisplayName}
              </p>
              <p className="text-[9px] font-mono truncate flex items-center gap-1 text-[#888]">
                {myStatus === 'online' && <span style={{ color: accentColor }}>● Trực tuyến</span>}
                {myStatus === 'dnd' && <span className="text-red-400">⛔ Chế độ Bận</span>}
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
                onClick={handleOpenNicknameModal}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 hover:bg-white/5 cursor-pointer transition-colors"
                style={{ color: accentColor }}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="font-semibold">Đổi tên hiển thị trên Server</span>
              </button>
            </div>
          )}
        </div>
          </>
        )}
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
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={dmMessagesEndRef} />
              </div>

              {/* DM Input Box */}
              <div className={`p-3.5 border-t ${isLight ? 'bg-white border-[#e2e8f0]' : 'bg-[#07070c] border-[#151520]'}`}>
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
                    disabled={!dmInputText.trim() && !dmAttachTrack}
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
                        {currentUser?.display_name || getTranslation(language, 'community.you')}
                      </span>
                      <span className={`text-[10px] font-mono ${isLight ? 'text-[#64748b]' : 'text-zinc-400'}`}>({getTranslation(language, 'community.you')})</span>
                      {isUserSpeaking && (
                        <span className="w-2 h-2 rounded-full animate-ping ml-1" style={{ backgroundColor: accentColor }} />
                      )}
                    </div>
                  </div>
                )}

                {/* Other Invited / Real Participants */}
                {voiceParticipants
                  .filter(
                    vp =>
                      vp.id !== myParticipantIdRef.current &&
                      (!vp.serverId || vp.serverId === selectedServer.id) &&
                      (!vp.channelId || vp.channelId === selectedChannel.id)
                  )
                  .map(vp => (
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
                            role: vp.isHost ? 'DJ / HOST' : 'MEMBER',
                            isHost: vp.isHost,
                            status: 'online',
                            listening: vp.isHost ? 'After Dark - Mr.Kitty' : null,
                            listeningTrack: vp.isHost ? DEFAULT_DJ_TRACK : null,
                          },
                        });
                      }}
                      className={`rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center relative aspect-[4/3] shadow-xl overflow-hidden group cursor-pointer ${
                        isLight ? 'bg-[#ffffff] border-[#cbd5e1]' : 'bg-[#1e1f22] border-[#2b2d31]'
                      }`}
                      style={vp.isSpeaking ? {
                        borderColor: accentColor,
                        boxShadow: `0 0 24px ${accentColor}50`
                      } : undefined}
                    >
                      {/* Discord Music Bot Stream Banner */}
                      {vp.isHost && (
                        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-auto">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayMemberTrack({ listeningTrack: DEFAULT_DJ_TRACK });
                            }}
                            title="Bấm để nghe cùng bot phát nhạc!"
                            className="px-2 py-1 rounded-lg bg-black/80 border text-[10px] font-mono font-bold flex items-center gap-1.5 cursor-pointer hover:scale-105 transition-transform"
                            style={{ borderColor: `${accentColor}50`, color: accentColor }}
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span className="truncate max-w-[130px] text-white">After Dark</span>
                          </button>
                          <span className="text-[9px] font-mono text-zinc-300 bg-black/75 px-1.5 py-0.5 rounded border border-white/10">
                            {userVolumes[vp.id] ?? 100}% Vol
                          </span>
                        </div>
                      )}

                      <div className="relative">
                        <div 
                          className={`w-20 h-20 rounded-full overflow-hidden border-2 flex items-center justify-center text-xl font-bold transition-all ${
                            isLight ? 'border-[#cbd5e1] bg-[#f1f5f9] text-[#0f172a]' : 'border-white/20 bg-[#2b2d31] text-white'
                          }`}
                          style={vp.isSpeaking ? {
                            borderColor: accentColor,
                            boxShadow: `0 0 20px ${accentColor}70`,
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
                        {vp.isHost ? (
                          <span 
                            className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded border flex items-center gap-1"
                            style={{ color: accentColor, backgroundColor: `${accentColor}20`, borderColor: `${accentColor}50` }}
                          >
                            <Radio className="w-2.5 h-2.5 animate-pulse" />
                            BOT
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
                      </div>
                    </div>
                  );
                })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input Box */}
            <div className={`p-3 border-t flex-shrink-0 ${isLight ? 'bg-[#ffffff] border-[#e2e8f0]' : 'bg-[#07070a] border-[#151520]'}`}>
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
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder={getTranslation(language, 'community.sendMessageTo', { channel: selectedChannel.name })}
                  className={`flex-1 px-3.5 py-2.5 rounded-xl text-xs border outline-none transition-colors font-sans ${
                    isLight 
                      ? 'bg-[#f8fafc] text-[#0f172a] border-[#cbd5e1] placeholder-[#94a3b8] focus:border-[#64748b]' 
                      : 'bg-[#101018] text-white border-[#222232] placeholder-[#666] focus:border-white/50'
                  }`}
                />

                <button
                  type="submit"
                  disabled={!inputText.trim() && !attachCurrentTrack}
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
          <div className={`flex items-center justify-between mb-2.5 pb-1.5 border-b ${isLight ? 'border-[#e2e8f0]' : 'border-[#14141e]'}`}>
            <div className="truncate pr-1">
              <p className={`text-[10px] font-mono font-bold uppercase tracking-wider ${isLight ? 'text-[#64748b]' : 'text-[#888]'}`}>
                THÀNH VIÊN — {onlineMembers.length}
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
          <div className="space-y-1">
            {onlineMembers.map(mem => (
              <div 
                key={mem.id} 
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMemberMenu({
                    x: Math.min(e.clientX, window.innerWidth - 220),
                    y: Math.min(e.clientY, window.innerHeight - 240),
                    member: mem,
                  });
                }}
                className={`flex items-center gap-2 p-1.5 rounded-lg transition-all cursor-pointer group ${
                  isLight ? 'hover:bg-[#e2e8f0]' : 'hover:bg-[#12121c]'
                } ${mem.status === 'offline' ? 'opacity-60 hover:opacity-100' : ''}`}
              >
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
                    <span className={`text-xs font-semibold truncate ${isLight ? 'text-[#0f172a]' : 'text-zinc-300'}`}>{mem.name}</span>
                    {isMemberServerOwner(mem.id) && (
                      <span
                        title={`Chủ Server ${selectedServer.name}`}
                        className="text-[8px] font-mono font-bold text-amber-400 bg-amber-400/15 border border-amber-400/30 px-1 py-0.2 rounded flex items-center gap-0.5 flex-shrink-0"
                      >
                        <Crown className="w-2.5 h-2.5" />
                        CHỦ
                      </span>
                    )}
                    {!isMemberServerOwner(mem.id) && isMemberModerator(mem.id) && (
                      <span
                        title={`Điều hành viên (Mod) tại ${selectedServer.name}`}
                        className="text-[8px] font-mono font-bold text-emerald-400 bg-emerald-400/15 border border-emerald-400/30 px-1 py-0.2 rounded flex items-center gap-0.5 flex-shrink-0"
                      >
                        <Shield className="w-2.5 h-2.5" />
                        MOD
                      </span>
                    )}
                    {mem.isHost && (
                      <span className="text-[8px] font-mono font-bold text-amber-400 bg-amber-400/10 px-1 py-0.2 rounded flex-shrink-0">
                        DJ
                      </span>
                    )}
                  </div>
                  {mem.listening && (
                    <p className="text-[9px] text-cyan-400/80 font-mono truncate flex items-center gap-1">
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
                  title={mem.id === 'usr_me' ? 'Tùy chỉnh trạng thái & Biệt danh Server' : getTranslation(language, 'community.inviteToVoice')}
                  className="p-1 rounded hover:bg-white/10 text-[#666] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity ml-auto cursor-pointer flex-shrink-0"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
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
                <span className="truncate">Nghe cùng ({memberMenu.member.listening})</span>
              </button>
            )}

            {/* Profile */}
            <button
              onClick={() => {
                const u = registeredUsers.find(x => x.id === memberMenu.member.id) || {
                  id: memberMenu.member.id,
                  username: memberMenu.member.name.toLowerCase().replace(/\s+/g, ''),
                  display_name: memberMenu.member.name,
                  avatar: null,
                  role: memberMenu.member.role,
                  status: 'online' as const,
                  bio: `Thành viên tại ${selectedServer.name}`,
                  listening: memberMenu.member.listening,
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
              <span>Xem hồ sơ</span>
            </button>

            {/* User / Bot Volume Slider (Discord Style: 0% - 200%) */}
            {voiceParticipants.some(p => p.id === memberMenu.member.id) && (
              <div className="px-2.5 py-2 border-y border-[#1e1e2c] my-1 bg-black/40 rounded-lg">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#aaa] mb-1.5">
                  <span className="flex items-center gap-1.5 font-semibold text-zinc-300">
                    <Volume2 className="w-3.5 h-3.5" style={{ color: accentColor }} />
                    {memberMenu.member.isHost ? 'Âm lượng bot phát nhạc' : 'Âm lượng mic người dùng'}
                  </span>
                  <span className="font-bold text-white font-mono">{userVolumes[memberMenu.member.id] ?? 100}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={userVolumes[memberMenu.member.id] ?? 100}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setUserVolumes(prev => {
                      const next = { ...prev, [memberMenu.member.id]: val };
                      localStorage.setItem('spytify_user_volumes', JSON.stringify(next));
                      return next;
                    });
                  }}
                  className="w-full h-1 bg-[#262638] rounded-lg appearance-none cursor-pointer"
                  style={{ accentColor }}
                />
              </div>
            )}

            {/* Voice kick or invite */}
            {voiceParticipants.some(p => p.id === memberMenu.member.id) ? (
              <button
                onClick={() => {
                  handleRemoveMemberFromVoice(memberMenu.member.id);
                  setMemberMenu(null);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg hover:bg-red-950/40 text-red-400 flex items-center gap-2 text-left cursor-pointer transition-colors"
              >
                <PhoneOff className="w-3.5 h-3.5 text-red-400" />
                <span>{getTranslation(language, 'community.removeFromVoice') || 'Mời rời khỏi voice'}</span>
              </button>
            ) : (
              <button
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
                <span>{memberMenu.member.isHost ? getTranslation(language, 'community.callDj') : getTranslation(language, 'community.inviteToVoice')}</span>
              </button>
            )}

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
              <span>{getTranslation(language, 'community.mentionInChat')}</span>
            </button>

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
                      ? 'Gỡ quyền Mod (Điều hành viên)'
                      : 'Cấp quyền Mod (Điều hành viên)'}
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
                  <span>Nhượng quyền Chủ Server (Bạn xuống Mod)</span>
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
          </div>
        </div>
      )}

      {/* ──────────────── 5. MODAL TỰ TẠO TRẠM SÓNG / SERVER MỚI ──────────────── */}
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

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base"
                style={{ backgroundColor: `${newServerColor}25`, color: newServerColor, border: `1px solid ${newServerColor}40` }}
              >
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight text-white">Tạo hoặc Tham Gia Server Spy Jam</h3>
                <p className="text-[11px] text-[#777] font-mono">Dán link mời hoặc tự tạo trạm sóng âm nhạc mới</p>
              </div>
            </div>

            {/* Quick Join Server by Invite Link */}
            <form onSubmit={handleJoinServerByLinkForm} className="mb-4 p-3 rounded-xl bg-[#11111c] border border-cyan-500/30 space-y-2">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400">
                🔗 THAM GIA SERVER BẰNG LINK MỜI:
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

            {/* Step 1: Chọn phong cách mẫu (Preset Templates) */}
            <div className="mb-4">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-2">
                1. Chọn phong cách trạm sóng mẫu:
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

            {/* Step 2: Form tùy biến thông tin */}
            <form onSubmit={handleCreateServer} className="space-y-3 font-sans">
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1">
                  2. Tên máy chủ / Trạm sóng:
                </label>
                <input
                  type="text"
                  required
                  value={newServerName}
                  onChange={e => setNewServerName(e.target.value)}
                  placeholder="Ví dụ: Neon Club 2077, Lofi Study Corner..."
                  className="w-full px-3 py-2 rounded-xl bg-[#12121c] border border-[#252538] text-white text-xs outline-none focus:border-white transition-colors"
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
                  className="w-full px-3 py-2 rounded-xl bg-[#12121c] border border-[#252538] text-white text-xs outline-none focus:border-white transition-colors"
                />
              </div>

              {/* Icon / Custom Logo & Color Picker */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1.5">
                    Logo / Biểu tượng Máy Chủ (Tải ảnh riêng hoặc chọn Icon):
                  </label>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div
                      className="w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center font-bold text-lg shrink-0 border"
                      style={{
                        backgroundColor: `${newServerColor}20`,
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
                      {['⚡', '☕', '🍸', '🎧', '🪩', '🚀', '💎', '🐉'].map(ico => (
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

                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1">
                    Màu Neon chủ đạo:
                  </label>
                  <div className="flex items-center gap-1.5">
                    {['#00E5FF', '#E040FB', '#00FF66', '#FF2A55', '#FFE600'].map(clr => (
                      <button
                        key={clr}
                        type="button"
                        onClick={() => setNewServerColor(clr)}
                        className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                          newServerColor === clr ? 'scale-125 border-2 border-white' : 'hover:scale-110 opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: clr, boxShadow: `0 0 8px ${clr}50` }}
                      />
                    ))}
                  </div>
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
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider text-black flex items-center gap-2 cursor-pointer shadow-lg transition-transform hover:scale-[1.02]"
                  style={{
                    backgroundColor: newServerColor,
                    boxShadow: `0 0 16px ${newServerColor}40`,
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Tạo Server Ngay</span>
                </button>
              </div>
            </form>
          </div>
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

            <div className="space-y-4">
              {/* ──────── SECTION 1: MICROPHONE (ĐẦU VÀO) ──────── */}
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

                {/* Voice Sensitivity Slider */}
                <div className="pt-3 border-t border-slate-200 dark:border-[#1e1e2c] mt-3">
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
                <div className="pt-3 border-t border-slate-200 dark:border-[#1e1e2c] mt-3 grid grid-cols-2 gap-2 text-xs">
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

              {/* ──────── SECTION 2: SPEAKER & OUTPUT (ĐẦU RA) ──────── */}
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
          <div className={`w-full max-w-2xl border rounded-2xl shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden ${
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

            {/* Sub-Tabs: Overview, Members, Invites, Danger */}
            <div className={`flex items-center gap-2 px-5 py-2.5 border-b text-xs font-mono font-bold uppercase tracking-wider ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#09090f] border-[#181824]'}`}>
              {(['overview', 'members', 'invites', 'danger'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setServerSettingsTab(tab)}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    serverSettingsTab === tab
                      ? isLight ? 'bg-white text-slate-900 shadow-sm' : 'bg-[#181826] text-white border border-white/20'
                      : 'text-[#777] hover:text-white'
                  }`}
                >
                  {tab === 'overview' && 'Tổng quan'}
                  {tab === 'members' && 'Thành viên'}
                  {tab === 'invites' && 'Mời bạn bè'}
                  {tab === 'danger' && 'Vùng nguy hiểm'}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {serverSettingsTab === 'overview' && (
                <form onSubmit={handleSaveServerSettings} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1.5">
                      Tên máy chủ (Server Name):
                    </label>
                    <input
                      type="text"
                      value={editServerName}
                      onChange={e => setEditServerName(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none font-sans ${
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
                      value={editServerDesc}
                      onChange={e => setEditServerDesc(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none font-sans ${
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
                          className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center font-bold text-lg shrink-0 border"
                          style={{
                            backgroundColor: `${editServerColor}20`,
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
                            editServerColor === c ? 'scale-110 shadow-lg' : 'hover:scale-105 border-transparent'
                          }`}
                          style={{ backgroundColor: c, borderColor: editServerColor === c ? '#ffffff' : 'transparent' }}
                        >
                          {editServerColor === c && <Check className="w-4 h-4 text-black font-black" />}
                        </button>
                      ))}
                    </div>
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

              {serverSettingsTab === 'members' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-[#888] font-mono">
                    <span>DANH SÁCH THÀNH VIÊN ({onlineMembers.length} / {editServerMaxMembers})</span>
                    <span>
                      Quyền hạn: {isServerOwner ? 'Chủ Server (Owner)' : isServerMod ? 'Điều hành viên (Mod)' : 'Thành viên'}
                    </span>
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
                              </div>
                              <p className="text-[10px] text-[#777] font-mono">{mem.listening ? `🎵 ${mem.listening}` : 'Sẵn sàng'}</p>
                            </div>
                          </div>

                          {mem.id !== 'usr_me' && (
                            <div className="flex items-center gap-2 flex-wrap justify-end">
                              {isServerOwner && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleModerator(mem.id)}
                                    className={`px-3 py-1 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
                                      isMemMod
                                        ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                                        : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20'
                                    }`}
                                    title={isMemMod ? 'Gỡ quyền Điều hành viên (Mod)' : 'Cấp quyền Điều hành viên (Mod)'}
                                  >
                                    <Shield className="w-3.5 h-3.5" />
                                    <span>{isMemMod ? 'Hủy quyền Mod' : 'Cấp quyền Mod'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => requestTransferOwnership(mem.id, mem.name)}
                                    className="px-3 py-1 rounded-lg border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                                    title="Trao quyền Chủ Server cho thành viên này và hạ bạn xuống làm Mod"
                                  >
                                    <Crown className="w-3.5 h-3.5" />
                                    <span>Nhượng quyền Chủ</span>
                                  </button>
                                </>
                              )}

                              {canManageServer && (isServerOwner || !isMemMod) && (
                                <button
                                  type="button"
                                  onClick={() => requestKickMember(mem.id, mem.name)}
                                  className="px-3 py-1 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Kick khỏi server</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {serverSettingsTab === 'invites' && (
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
              )}

              {serverSettingsTab === 'danger' && (
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
                    disabled={!isServerOwner}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-md"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{isServerOwner ? 'Xóa Máy Chủ Ngay' : 'Chỉ Chủ Server mới có quyền xóa'}</span>
                  </button>
                </div>
              )}
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
                <div className="relative">
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
                </div>

                {selectedProfileUser.id !== 'usr_me' && (
                  <button
                    onClick={() => handleToggleFollow(selectedProfileUser.id)}
                    className={`px-4 py-2 rounded-xl font-bold text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 shadow-md ${
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
                <p className="text-xs text-cyan-400 font-mono mt-0.5">@{selectedProfileUser.username}</p>
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
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#777] block mb-1">
                  TIỂU SỬ
                </span>
                <p className="text-xs text-[#aaa] leading-relaxed font-sans">{selectedProfileUser.bio || 'Chưa cập nhật tiểu sử.'}</p>
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

      {/* ──────────────── 10. MODAL XÁC NHẬN CẢNH BÁO (XÓA SERVER / KICK THÀNH VIÊN) ──────────────── */}
      {confirmActionModal && (
        <div
          onClick={() => setConfirmActionModal(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150"
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
                    : 'Xác nhận Kick'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
