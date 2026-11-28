import React, { useEffect, useState, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  AudioLines, Flame, Play, Disc, Sparkles, TrendingUp, Music, 
  Crown, Loader2, RefreshCw, Compass, Headphones, Radio, Mic2,
  Shuffle, X, Heart, Clock, ChevronLeft, ChevronRight, ChevronDown, ListMusic,
  FolderPlus, FolderCheck, Library, Check
} from 'lucide-react';
import { SearchResult, Track, User, ArtistMix, UserAlbum } from '../types';
import { YoutubeIcon, SoundCloudIcon, AudiusIcon, ModernHomeIcon } from './Icons';
import { getContrastTextColor, optimizeThumbnailUrl, handleImageError, sanitizeTrackTitle } from '../utils/trackUtils';
import { 
  POPULAR_ARTIST_AVATARS, 
  DEFAULT_FEATURED_ARTISTS, 
  RecentArtistItem, 
  getOrResolveArtistAvatar, 
  fetchArtistPortraitOnline 
} from '../utils/artistAvatars';
import { LanguageCode, getTranslation } from '../locales/i18n';

interface HomeTrendingViewProps {
  currentUser?: User | null;
  onPlaySearchResult: (result: SearchResult, allResults?: SearchResult[]) => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  favorites: Set<string>;
  onToggleFavorite: (trackId: string) => void;
  accentColor?: string;
  language?: LanguageCode;
  albums?: UserAlbum[];
  onSaveArtistMixAsAlbum?: (mix: ArtistMix) => void;
  onNavigateToAlbums?: () => void;
  onPlayArtistMix?: (mix: ArtistMix, startTrackOrIndex?: SearchResult | number) => void;
  onAddToAlbum?: (track: Track) => void;
}

interface CategoryFilter {
  id: string;
  label: string;
  icon: string;
  group?: string;
}

const CATEGORIES: CategoryFilter[] = [
  { id: 'all', label: 'Tất cả Top Hits', icon: '' },
  { id: 'cortisol', label: 'Low Cortisol & Chill', icon: '' },
  { id: 'working', label: 'Deep Focus & Work', icon: '' },
  { id: 'lockin', label: 'Lock In & Grind', icon: '' },
  { id: 'gym', label: 'Gym & Workout', icon: '' },
  { id: 'nightdrive', label: 'Late Night Drive', icon: '' },
  { id: 'usuk', label: 'Billboard Hot 100', icon: '' },
  { id: 'kpop_jpop', label: 'J-Pop & K-Pop', icon: '' },
  { id: 'vpop', label: 'V-Pop Thịnh Hành', icon: '' },
  { id: 'lofi', label: 'Lo-Fi Chillout', icon: '' },
  { id: 'audius', label: 'Audius 320K', icon: '' },
];

// Curated Top Hits categorized: Real songs only, strictly no chart review / ranking countdown videos
const CURATED_BY_CATEGORY: Record<string, SearchResult[]> = {
  usuk: [
    {
      title: 'Die With A Smile',
      artist: 'Lady Gaga & Bruno Mars',
      album: 'Billboard Hot 100 #1',
      duration_secs: 251,
      source: 'youtube',
      url_or_id: 'kPa7bsKwL-c',
      thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'APT. (feat. Bruno Mars)',
      artist: 'ROSÉ & Bruno Mars',
      album: 'Global Viral Sensation',
      duration_secs: 173,
      source: 'youtube',
      url_or_id: 'ekr2nIex040',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Espresso',
      artist: 'Sabrina Carpenter',
      album: "Short n' Sweet (Global Top 10)",
      duration_secs: 175,
      source: 'youtube',
      url_or_id: 'eVli-tstM5E',
      thumbnail: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Birds of a Feather',
      artist: 'Billie Eilish',
      album: 'Hit Me Hard and Soft',
      duration_secs: 196,
      source: 'youtube',
      url_or_id: 'V9PVRfjEBTI',
      thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Taste',
      artist: 'Sabrina Carpenter',
      album: "Short n' Sweet",
      duration_secs: 157,
      source: 'youtube',
      url_or_id: '-5GI38vWew8',
      thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Cruel Summer',
      artist: 'Taylor Swift',
      album: 'Lover (The Eras Tour Live)',
      duration_secs: 178,
      source: 'youtube',
      url_or_id: 'ic8j13piAhQ',
      thumbnail: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Good Luck, Babe!',
      artist: 'Chappell Roan',
      album: 'Pop Sensation 2024',
      duration_secs: 218,
      source: 'youtube',
      url_or_id: '1RKqOmSkGgM',
      thumbnail: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Beautiful Things',
      artist: 'Benson Boone',
      album: 'Fireworks & Rollerblades',
      duration_secs: 180,
      source: 'youtube',
      url_or_id: 'Oa_RSwwpPaA',
      thumbnail: 'https://images.unsplash.com/photo-1526478806334-5fd488fcaabc?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Lose Control',
      artist: 'Teddy Swims',
      album: "I've Tried Everything But Therapy",
      duration_secs: 210,
      source: 'youtube',
      url_or_id: 'GZ3zL7kT6_c',
      thumbnail: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Too Sweet',
      artist: 'Hozier',
      album: 'Unheard',
      duration_secs: 251,
      source: 'youtube',
      url_or_id: 'IN-PeAZDi7g',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
    },
  ],
  jpop: [
    {
      title: 'Bling-Bang-Bang-Born',
      artist: 'Creepy Nuts',
      album: 'J-Pop Global Phenomenon',
      duration_secs: 172,
      source: 'youtube',
      url_or_id: 'lRDaREIDxEg',
      thumbnail: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Idol (アイドル)',
      artist: 'YOASOBI',
      album: 'Oshi no Ko / J-Pop All-Kill',
      duration_secs: 213,
      source: 'youtube',
      url_or_id: 'ZRtdQ81jPUQ',
      thumbnail: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Night Dancer',
      artist: 'imase',
      album: 'Viral J-Pop Anthem',
      duration_secs: 210,
      source: 'youtube',
      url_or_id: 'QbHBfxAOucI',
      thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Specialz',
      artist: 'King Gnu',
      album: 'Jujutsu Kaisen OP',
      duration_secs: 238,
      source: 'youtube',
      url_or_id: 'fhzKLBZJC3w',
      thumbnail: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Shinunoga E-Wa',
      artist: 'Fujii Kaze',
      album: 'HELP EVER HURT NEVER',
      duration_secs: 185,
      source: 'youtube',
      url_or_id: 'dFfvMsZ_aJ0',
      thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'KICK BACK',
      artist: 'Kenshi Yonezu',
      album: 'Chainsaw Man OP',
      duration_secs: 195,
      source: 'youtube',
      url_or_id: 'M2cckDmNLMI',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Show (唱)',
      artist: 'Ado',
      album: 'Universal Studios Japan Anthem',
      duration_secs: 192,
      source: 'youtube',
      url_or_id: 'pgXpM4l_MwI',
      thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&auto=format&fit=crop&q=60',
    },
  ],
  kpop: [
    {
      title: 'APT. (feat. Bruno Mars)',
      artist: 'ROSÉ & Bruno Mars',
      album: 'rosie - Global Smash',
      duration_secs: 173,
      source: 'youtube',
      url_or_id: 'ekr2nIex040',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Supernova',
      artist: 'aespa',
      album: 'Armageddon - K-Pop Smash',
      duration_secs: 178,
      source: 'youtube',
      url_or_id: 'G8YNFjruzPk',
      thumbnail: 'https://images.unsplash.com/photo-1526478806334-5fd488fcaabc?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Magnetic',
      artist: 'ILLIT',
      album: 'SUPER REAL ME',
      duration_secs: 160,
      source: 'youtube',
      url_or_id: 'Vk5-c_v4gMU',
      thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Standing Next to You',
      artist: 'Jung Kook',
      album: 'GOLDEN (Global Sensation)',
      duration_secs: 206,
      source: 'youtube',
      url_or_id: 'sn0viUbmUVU',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Whiplash',
      artist: 'aespa',
      album: 'The 5th Mini Album',
      duration_secs: 184,
      source: 'youtube',
      url_or_id: 'jWQx2f-CErU',
      thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Mantra',
      artist: 'JENNIE',
      album: 'Solo Comeback 2024',
      duration_secs: 136,
      source: 'youtube',
      url_or_id: 'bB3-CUMERIU',
      thumbnail: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Ditto',
      artist: 'NewJeans',
      album: 'OMG Single Album',
      duration_secs: 186,
      source: 'youtube',
      url_or_id: 'pSUydWEqKwE',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
    },
  ],
  anime: [
    {
      title: 'Idol (アイドル)',
      artist: 'YOASOBI',
      album: 'Oshi no Ko OP',
      duration_secs: 213,
      source: 'youtube',
      url_or_id: 'ZRtdQ81jPUQ',
      thumbnail: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'KICK BACK',
      artist: 'Kenshi Yonezu',
      album: 'Chainsaw Man OP',
      duration_secs: 195,
      source: 'youtube',
      url_or_id: 'M2cckDmNLMI',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Specialz',
      artist: 'King Gnu',
      album: 'Jujutsu Kaisen OP',
      duration_secs: 238,
      source: 'youtube',
      url_or_id: 'fhzKLBZJC3w',
      thumbnail: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&auto=format&fit=crop&q=60',
    },
  ],
  edm: [
    {
      title: 'Faded',
      artist: 'Alan Walker',
      album: 'Different World',
      duration_secs: 212,
      source: 'youtube',
      url_or_id: '60ItHLz5WEA',
      thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Animals',
      artist: 'Martin Garrix',
      album: 'Gold Skies EP',
      duration_secs: 184,
      source: 'youtube',
      url_or_id: 'gCYcTmT9wx4',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Wake Me Up',
      artist: 'Avicii',
      album: 'True',
      duration_secs: 247,
      source: 'youtube',
      url_or_id: 'IcrbM1l_BoI',
      thumbnail: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&auto=format&fit=crop&q=60',
    },
  ],
  hiphop: [
    {
      title: 'Not Like Us',
      artist: 'Kendrick Lamar',
      album: 'Billboard Hot 100 #1',
      duration_secs: 274,
      source: 'youtube',
      url_or_id: 'H58vbez_m4E',
      thumbnail: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'FE!N',
      artist: 'Travis Scott ft. Playboi Carti',
      album: 'UTOPIA',
      duration_secs: 191,
      source: 'youtube',
      url_or_id: 'B9synWjqBn8',
      thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&auto=format&fit=crop&q=60',
    },
  ],
  rock: [
    {
      title: 'The Emptiness Machine',
      artist: 'Linkin Park',
      album: 'From Zero (Comeback 2024)',
      duration_secs: 190,
      source: 'youtube',
      url_or_id: 'SRXH9AbT280',
      thumbnail: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Believer',
      artist: 'Imagine Dragons',
      album: 'Evolve',
      duration_secs: 204,
      source: 'youtube',
      url_or_id: '7wtfhZwyrcc',
      thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
    },
  ],
  acoustic: [
    {
      title: 'Beautiful Things',
      artist: 'Benson Boone',
      album: 'Fireworks & Rollerblades',
      duration_secs: 180,
      source: 'youtube',
      url_or_id: 'Oa_RSwwpPaA',
      thumbnail: 'https://images.unsplash.com/photo-1526478806334-5fd488fcaabc?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Lose Control',
      artist: 'Teddy Swims',
      album: "I've Tried Everything But Therapy",
      duration_secs: 210,
      source: 'youtube',
      url_or_id: 'GZ3zL7kT6_c',
      thumbnail: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&auto=format&fit=crop&q=60',
    },
  ],
  kpop_jpop: [
    {
      title: 'Bling-Bang-Bang-Born',
      artist: 'Creepy Nuts',
      album: 'J-Pop Global Phenomenon',
      duration_secs: 172,
      source: 'youtube',
      url_or_id: 'lRDaREIDxEg',
      thumbnail: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Supernova',
      artist: 'aespa',
      album: 'Armageddon - K-Pop Smash',
      duration_secs: 178,
      source: 'youtube',
      url_or_id: 'G8YNFjruzPk',
      thumbnail: 'https://images.unsplash.com/photo-1526478806334-5fd488fcaabc?w=500&auto=format&fit=crop&q=60',
    },
  ],
  soundcloud: [
    {
      title: 'Neon Nights & City Lights (Remix)',
      artist: 'SoundCloud Originals',
      album: 'Top Electronic Charts',
      duration_secs: 198,
      source: 'soundcloud',
      url_or_id: 'https://soundcloud.com/chillhopdotcom/streambeats-chill',
      thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Midnight Phonk Drift',
      artist: 'KSLV Noh & Ghostface Playa',
      album: 'SoundCloud Viral Phonk Top 50',
      duration_secs: 142,
      source: 'soundcloud',
      url_or_id: 'https://soundcloud.com/phonk-collective/drift-king',
      thumbnail: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Tokyo Rain Lo-Fi Beat',
      artist: 'Kudasaibeats',
      album: 'The SoundCloud Tape',
      duration_secs: 165,
      source: 'soundcloud',
      url_or_id: 'https://soundcloud.com/kudasaibeats/the-technician-at-the-tea-parlor',
      thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
    },
  ],
  vpop: [
    {
      title: 'Đừng Làm Trái Tim Anh Đau',
      artist: 'Sơn Tùng M-TP',
      album: 'V-Pop Quán Quân 2024 - 2025',
      duration_secs: 326,
      source: 'youtube',
      url_or_id: 'abPmZCZZrFA',
      thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Từng Quen',
      artist: 'Wren Evans',
      album: 'Loi Choi - The New V-Pop Wave',
      duration_secs: 174,
      source: 'youtube',
      url_or_id: 'zepHPnUDROE',
      thumbnail: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Nơi Này Có Anh',
      artist: 'Sơn Tùng M-TP',
      album: 'Hit Quốc Dân V-Pop',
      duration_secs: 279,
      source: 'youtube',
      url_or_id: 'FN7ALfpGxiI',
      thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Thủy Triều',
      artist: 'Quang Hùng MasterD',
      album: 'Giai Điệu Bắt Tai',
      duration_secs: 202,
      source: 'youtube',
      url_or_id: '7ig2lXjozdw',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Không Thể Say',
      artist: 'HIEUTHUHAI',
      album: 'Ai Cũng Phải Bắt Đầu Từ Đâu Đó',
      duration_secs: 215,
      source: 'youtube',
      url_or_id: 'i0nd3NPJ4MI',
      thumbnail: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Gặp Lại Năm Ta 60',
      artist: 'Orange',
      album: "Cam'On - Vietnamese Soul",
      duration_secs: 236,
      source: 'youtube',
      url_or_id: 'ZXNrz72k1ew',
      thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Cắt Đôi Nỗi Sầu',
      artist: 'Tăng Duy Tân',
      album: 'V-Pop Viral Sensation',
      duration_secs: 195,
      source: 'youtube',
      url_or_id: 'GpmOn4RyzZI',
      thumbnail: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Bật Tình Yêu Lên',
      artist: 'Tăng Duy Tân & Hòa Minzy',
      album: 'Song Ca Nổi Bật',
      duration_secs: 204,
      source: 'youtube',
      url_or_id: 'KUx2Pod0KJ4',
      thumbnail: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Ngày Đầu Tiên',
      artist: 'Đức Phúc',
      album: 'Tình Ca Lãng Mạn',
      duration_secs: 210,
      source: 'youtube',
      url_or_id: 'rIXhXaQ8tiM',
      thumbnail: 'https://images.unsplash.com/photo-1526478806334-5fd488fcaabc?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Nấu Ăn Cho Em',
      artist: 'Đen Vâu (feat. PiaLinh)',
      album: 'Đen Vâu Hit Collection',
      duration_secs: 260,
      source: 'youtube',
      url_or_id: 'ukHK1GVyr0I',
      thumbnail: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&auto=format&fit=crop&q=60',
    },
  ],
  lofi: [
    {
      title: 'lofi hip hop radio 📚 beats to relax/study to [LIVE 24/7]',
      artist: 'Lofi Girl',
      album: 'Lofi Girl 24/7 Live Radio',
      duration_secs: 0,
      source: 'youtube',
      url_or_id: 'jfKfPfyJRdk',
      thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
    },
    {
      title: 'synthwave radio 🌌 beats to chill/game to [LIVE 24/7]',
      artist: 'Lofi Girl',
      album: 'Lofi Girl Synthwave Live',
      duration_secs: 0,
      source: 'youtube',
      url_or_id: '4xDzrJKXOOY',
      thumbnail: 'https://i.ytimg.com/vi/4xDzrJKXOOY/hqdefault.jpg',
    },
    {
      title: 'lofi hip hop radio 💤 beats to sleep/chill to [LIVE 24/7]',
      artist: 'Lofi Girl',
      album: 'Lofi Sleep Live Stream',
      duration_secs: 0,
      source: 'youtube',
      url_or_id: 'rUxyKA_-grg',
      thumbnail: 'https://i.ytimg.com/vi/rUxyKA_-grg/hqdefault.jpg',
    },
    {
      title: 'Chillhop Radio - jazzy & lofi hip hop beats 🐾 [LIVE 24/7]',
      artist: 'Chillhop Music',
      album: 'Chillhop 24/7 Live Radio',
      duration_secs: 0,
      source: 'youtube',
      url_or_id: '5yx6BWlEVcY',
      thumbnail: 'https://i.ytimg.com/vi/5yx6BWlEVcY/hqdefault.jpg',
    },
    {
      title: 'Snowman (Lofi Version)',
      artist: 'Lofi Fruits Music',
      album: 'Chillhop Beats',
      duration_secs: 154,
      source: 'youtube',
      url_or_id: 'b1kbLwvqugk',
      thumbnail: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'coffee breath (Lofi)',
      artist: 'Kudasai',
      album: 'Falling Beats',
      duration_secs: 142,
      source: 'youtube',
      url_or_id: 'Ggddxkj8tU0',
      thumbnail: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Affection',
      artist: 'Jinsang',
      album: 'Life Collection',
      duration_secs: 150,
      source: 'youtube',
      url_or_id: 'XWLQKNvCepM',
      thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Controlla',
      artist: 'Idealism',
      album: 'Rainy Days',
      duration_secs: 168,
      source: 'youtube',
      url_or_id: 'LkhPi6J5Xg0',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Biscuit (Lofi Chill)',
      artist: 'Lukrembo',
      album: 'Daily Lofi Vibes',
      duration_secs: 112,
      source: 'youtube',
      url_or_id: 'EtZ2m2Zm3vY',
      thumbnail: 'https://i.ytimg.com/vi/EtZ2m2Zm3vY/hqdefault.jpg',
    },
    {
      title: '5:32pm (Lofi Beat)',
      artist: 'The Deli',
      album: 'Vibes 2',
      duration_secs: 132,
      source: 'youtube',
      url_or_id: '6ustyT4Kx-g',
      thumbnail: 'https://i.ytimg.com/vi/6ustyT4Kx-g/hqdefault.jpg',
    },
  ],
  all: [
    {
      title: 'Die With A Smile',
      artist: 'Lady Gaga & Bruno Mars',
      album: 'Billboard Hot 100 #1',
      duration_secs: 251,
      source: 'youtube',
      url_or_id: 'kPa7bsKwL-c',
      thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'APT. (feat. Bruno Mars)',
      artist: 'ROSÉ & Bruno Mars',
      album: 'Global Viral Sensation',
      duration_secs: 173,
      source: 'youtube',
      url_or_id: 'ekr2nIex040',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Đừng Làm Trái Tim Anh Đau',
      artist: 'Sơn Tùng M-TP',
      album: 'V-Pop Quán Quân 2024 - 2025',
      duration_secs: 326,
      source: 'youtube',
      url_or_id: 'abPmZCZZrFA',
      thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Espresso',
      artist: 'Sabrina Carpenter',
      album: "Short n' Sweet (Global Top 10)",
      duration_secs: 175,
      source: 'youtube',
      url_or_id: 'eVli-tstM5E',
      thumbnail: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Bling-Bang-Bang-Born',
      artist: 'Creepy Nuts',
      album: 'J-Pop Global Phenomenon',
      duration_secs: 172,
      source: 'youtube',
      url_or_id: 'lRDaREIDxEg',
      thumbnail: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Idol (アイドル)',
      artist: 'YOASOBI',
      album: 'Oshi no Ko / J-Pop All-Kill',
      duration_secs: 213,
      source: 'youtube',
      url_or_id: 'ZRtdQ81jPUQ',
      thumbnail: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Từng Quen',
      artist: 'Wren Evans',
      album: 'Loi Choi - The New V-Pop Wave',
      duration_secs: 174,
      source: 'youtube',
      url_or_id: 'zepHPnUDROE',
      thumbnail: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Supernova',
      artist: 'aespa',
      album: 'Armageddon - K-Pop Smash',
      duration_secs: 178,
      source: 'youtube',
      url_or_id: 'G8YNFjruzPk',
      thumbnail: 'https://images.unsplash.com/photo-1526478806334-5fd488fcaabc?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Magnetic',
      artist: 'ILLIT',
      album: 'SUPER REAL ME',
      duration_secs: 160,
      source: 'youtube',
      url_or_id: 'Vk5-c_v4gMU',
      thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Birds of a Feather',
      artist: 'Billie Eilish',
      album: 'Hit Me Hard and Soft',
      duration_secs: 196,
      source: 'youtube',
      url_or_id: 'V9PVRfjEBTI',
      thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
    },
  ],
  cortisol: [
    {
      title: 'A Low Cortisol Playlist (Sunset Waves)',
      artist: 'Etherealway & Lofi Chill',
      album: 'De-Stress & Peace',
      duration_secs: 3840,
      source: 'youtube',
      url_or_id: 'kPa7bsKwL-c',
      thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Snowman (Acoustic Slowed)',
      artist: 'Sia & Ethereal Beats',
      album: 'Low Cortisol Morning',
      duration_secs: 215,
      source: 'youtube',
      url_or_id: 'gset79KMmt0',
      thumbnail: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Dandelions (Slowed + Reverb)',
      artist: 'Ruth B.',
      album: 'Cortisol Relief',
      duration_secs: 245,
      source: 'youtube',
      url_or_id: 'W8a4sUabCUo',
      thumbnail: 'https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Golden Hour (Peaceful Piano)',
      artist: 'JVKE',
      album: 'Calm Sanctuary',
      duration_secs: 210,
      source: 'youtube',
      url_or_id: 'PEM0Vs8jf1w',
      thumbnail: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=500&auto=format&fit=crop&q=60',
    },
  ],
  working: [
    {
      title: 'Deep Focus Work & Coding Session',
      artist: 'Synthwave & Lofi Beats',
      album: 'Productive Flow',
      duration_secs: 1800,
      source: 'youtube',
      url_or_id: '5qap5aO4i9A',
      thumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Resonance',
      artist: 'HOME',
      album: 'Chillwave Work Beats',
      duration_secs: 212,
      source: 'youtube',
      url_or_id: '8GW6sLrK40k',
      thumbnail: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Coffee & Code (Alpha Waves)',
      artist: 'Ambient Work Music',
      album: 'Zero Distraction',
      duration_secs: 2400,
      source: 'youtube',
      url_or_id: 'jfKfPfyJRdk',
      thumbnail: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=500&auto=format&fit=crop&q=60',
    },
  ],
  lockin: [
    {
      title: 'LOCK IN (Aggressive Phonk & Focus)',
      artist: 'Kordhell & Hensonn',
      album: 'High Intensity Study',
      duration_secs: 195,
      source: 'youtube',
      url_or_id: 'w-sQRS-Mun8',
      thumbnail: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Sahara',
      artist: 'Hensonn',
      album: 'Lock In Beast Mode',
      duration_secs: 171,
      source: 'youtube',
      url_or_id: '43R_kKqXvK4',
      thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Midnight City (Dark Ambient Mix)',
      artist: 'M83 & Retro Beats',
      album: 'Tunnel Vision Study',
      duration_secs: 245,
      source: 'youtube',
      url_or_id: 'dX3k_QDnzHE',
      thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=60',
    },
  ],
  gym: [
    {
      title: 'Murder In My Mind (Beast Mode)',
      artist: 'Kordhell',
      album: 'Gym Workout Bangers',
      duration_secs: 145,
      source: 'youtube',
      url_or_id: 'w-sQRS-Mun8',
      thumbnail: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Montagem Mysterious Game',
      artist: 'LXNGVX',
      album: 'Brazilian Phonk Gym',
      duration_secs: 128,
      source: 'youtube',
      url_or_id: '7V_a_kE4N8w',
      thumbnail: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Till I Collapse (Remix)',
      artist: 'Eminem & Neffex',
      album: 'PR Workout Motivation',
      duration_secs: 298,
      source: 'youtube',
      url_or_id: 'Obim8BYGnOE',
      thumbnail: 'https://images.unsplash.com/photo-1534367507873-d2d7e24c797f?w=500&auto=format&fit=crop&q=60',
    },
  ],
  nightdrive: [
    {
      title: 'Nightcall (Drive OST)',
      artist: 'Kavinsky',
      album: 'Late Night City Cruising',
      duration_secs: 259,
      source: 'youtube',
      url_or_id: 'MV_3Dpw-BRY',
      thumbnail: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'After Dark',
      artist: 'Mr.Kitty',
      album: 'Time (Midnight Drive)',
      duration_secs: 259,
      source: 'youtube',
      url_or_id: 'waAlgFq9Xq8',
      thumbnail: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=500&auto=format&fit=crop&q=60',
    },
  ],
  audius: [
    {
      title: 'Fragments',
      artist: 'Xsetra',
      album: 'Audius Drum & Bass 320K',
      duration_secs: 212,
      source: 'audius',
      url_or_id: 'https://api.audius.co/v1/tracks/V66vyPP/stream?app_name=Spytify',
      thumbnail: 'https://v.monophonic.digital/content/baeaaaiqseau7mrpo7s6ibb7loyckmlix37ao33gltbea6qm3zud7mdxvbgyys/480x480.jpg',
    },
    {
      title: 'Never Let Me Go',
      artist: 'Duelle',
      album: 'Audius Bass 320K',
      duration_secs: 198,
      source: 'audius',
      url_or_id: 'https://api.audius.co/v1/tracks/Duelle/stream?app_name=Spytify',
      thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
    },
    {
      title: 'Sunset Lover (Audius Remix)',
      artist: 'Petit Biscuit',
      album: 'Audius Chill Hi-Fi',
      duration_secs: 238,
      source: 'audius',
      url_or_id: 'https://api.audius.co/v1/tracks/Sunset/stream?app_name=Spytify',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80',
    },
    {
      title: 'Neon Drive 320K',
      artist: 'Kavinsky & Lorn',
      album: 'Audius Synthwave',
      duration_secs: 220,
      source: 'audius',
      url_or_id: 'https://api.audius.co/v1/tracks/Neon/stream?app_name=Spytify',
      thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80',
    },
  ],
};

// Curated artist avatars and default recommendations are imported from ../utils/artistAvatars

interface ThemedCollection {
  id: string;
  title: string;
  desc: string;
  badge: string;
  cover: string;
  categoryKey: string;
}

const THEMED_COLLECTIONS: ThemedCollection[] = [
  {
    id: 'vpop',
    title: 'V-Pop Quán Quân & Thịnh Hành',
    desc: 'Sơn Tùng M-TP, HIEUTHUHAI, Vũ., Wren Evans, Đen Vâu',
    badge: '🇻🇳 V-POP HITS',
    cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    categoryKey: 'vpop',
  },
  {
    id: 'usuk',
    title: 'Billboard Global Top 100',
    desc: 'Bruno Mars, Lady Gaga, Billie Eilish, Sabrina Carpenter',
    badge: '🌍 BILLBOARD #1',
    cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
    categoryKey: 'usuk',
  },
  {
    id: 'lofi',
    title: 'Deep Focus & Lo-Fi Chillout',
    desc: 'Âm nhạc tập trung sâu, thư giãn học bài & lập trình không xao nhãng',
    badge: '☕ FOCUS & CODE',
    cover: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=600&auto=format&fit=crop&q=80',
    categoryKey: 'lofi',
  },
  {
    id: 'kpop_jpop',
    title: 'J-Pop & K-Pop All-Kill',
    desc: 'ROSÉ, YOASOBI, Creepy Nuts, NewJeans, aespa, Fujii Kaze',
    badge: '🎌 ASIA VIRAL',
    cover: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
    categoryKey: 'kpop_jpop',
  },
  {
    id: 'edm',
    title: 'EDM Festival & Cyber Bass',
    desc: 'Alan Walker, Marshmello, Phonk Gym & Bass bùng nổ năng lượng',
    badge: '⚡ BEAST MODE',
    cover: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop&q=80',
    categoryKey: 'edm',
  },
  {
    id: 'nightdrive',
    title: 'Late Night City Drive',
    desc: 'Kavinsky, Mr.Kitty, Phonk Synthwave neon huyền ảo xuyên màn đêm',
    badge: '🌃 MIDNIGHT DRIVE',
    cover: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80',
    categoryKey: 'lofi',
  },
  {
    id: 'acoustic',
    title: 'Acoustic & Indie Ballad',
    desc: 'Guitar mộc, piano ballad và những giai điệu êm dịu chữa lành tâm hồn',
    badge: '🪕 CHỮA LÀNH',
    cover: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600&auto=format&fit=crop&q=80',
    categoryKey: 'acoustic',
  },
  {
    id: 'audius',
    title: 'Audius Lossless 320K Hi-Fi',
    desc: 'Lossless underground 320Kbps chất lượng cao chuẩn phòng thu',
    badge: '⚡ LOSSLESS 320K',
    cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    categoryKey: 'audius',
  },
];

export const HomeTrendingView: React.FC<HomeTrendingViewProps> = ({
  currentUser,
  onPlaySearchResult,
  currentTrack,
  isPlaying,
  favorites,
  onToggleFavorite,
  accentColor = '#ff2a55',
  language = 'vi',
  albums = [],
  onSaveArtistMixAsAlbum,
  onNavigateToAlbums,
  onPlayArtistMix,
  onAddToAlbum,
}) => {
  const [trendingTracks, setTrendingTracks] = useState<SearchResult[]>(CURATED_BY_CATEGORY.usuk);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('usuk');
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setIsCategoryMenuOpen(false);
      }
    };
    if (isCategoryMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCategoryMenuOpen]);

  // Nghệ sĩ hay nghe của tài khoản hiện tại
  const [recentArtists, setRecentArtists] = useState<RecentArtistItem[]>(DEFAULT_FEATURED_ARTISTS);

  // Hero Billboard Showcase State (Tự động slideshow & cho phép chọn nghệ sĩ từ danh sách đề xuất)
  const [heroIndex, setHeroIndex] = useState(0);
  const [isHeroPaused, setIsHeroPaused] = useState(false);

  const heroArtists = useMemo(() => {
    return recentArtists;
  }, [recentArtists]);

  // Tự động chuyển slide cross-fade sau mỗi 6 giây (tạm dừng khi hover chuột hoặc tương tác)
  useEffect(() => {
    if (heroArtists.length <= 1 || isHeroPaused) return;
    const timer = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % heroArtists.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [heroArtists.length, isHeroPaused]);

  // Artist Album Mix (Powered by Rust Backend)
  const [activeArtistMix, setActiveArtistMix] = useState<ArtistMix | null>(null);
  const [loadingArtistMix, setLoadingArtistMix] = useState(false);
  const [loadingArtistName, setLoadingArtistName] = useState<string>('');
  const mixTracklistRef = useRef<HTMLDivElement | null>(null);
  const recentArtistsScrollRef = useRef<HTMLDivElement | null>(null);

  const scrollRecentArtists = (direction: 'left' | 'right') => {
    if (recentArtistsScrollRef.current) {
      const scrollAmount = 450;
      recentArtistsScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const scrollMixTracklist = (direction: 'left' | 'right') => {
    if (mixTracklistRef.current) {
      const scrollAmount = 540;
      mixTracklistRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  // Đóng modal khi nhấn phím Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeArtistMix) {
        setActiveArtistMix(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeArtistMix]);

  // Ngăn chặn cuộn dọc trang khi lăn chuột trên danh sách nghệ sĩ (chỉ trượt ngang nội bộ)
  useEffect(() => {
    const el = recentArtistsScrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [recentArtists]);

  useEffect(() => {
    const userId = currentUser?.id || 'guest_spy';
    Promise.all([
      invoke<any[]>('db_get_history', { userId, limit: 300 }).catch(() => []),
      invoke<Track[]>('db_get_favorites', { userId }).catch(() => [])
    ]).then(([historyList, favList]) => {
      const counts: Record<string, { count: number; cover?: string; topTitle?: string; id?: string }> = {};

      for (const t of favList) {
        if (t.artist && t.artist.trim().length > 1 && !t.artist.toLowerCase().includes('unknown')) {
          const clean = t.artist.split(',')[0].split('&')[0].split(/ x | ft\.?| feat\.?/i)[0].trim();
          if (!counts[clean]) {
            counts[clean] = { count: 0, cover: t.cover_art || (t as any).thumbnail, topTitle: t.title, id: t.path_or_url || t.id };
          }
          counts[clean].count += 3;
        }
      }

      for (const h of historyList) {
        if (h.artist && h.artist.trim().length > 1 && !h.artist.toLowerCase().includes('unknown')) {
          const clean = h.artist.split(',')[0].split('&')[0].split(/ x | ft\.?| feat\.?/i)[0].trim();
          let cover: string | undefined;
          if (h.track_json) {
            try {
              const parsed = typeof h.track_json === 'string' ? JSON.parse(h.track_json) : h.track_json;
              cover = parsed.thumbnail || parsed.album_art_url;
            } catch {}
          }
          if (!counts[clean]) {
            counts[clean] = { count: 0, cover, topTitle: h.track_title, id: h.path_or_url || h.track_id };
          }
          counts[clean].count += 1;
          if (!counts[clean].cover && cover) counts[clean].cover = cover;
        }
      }

      const userList = Object.entries(counts)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 24)
        .map(([artist, data]) => {
          const avatar = getOrResolveArtistAvatar(artist, data.cover);
          return {
            artist,
            count: data.count,
            avatar,
            topTrackTitle: data.topTitle,
            sampleVideoId: data.id,
          };
        });

      if (userList.length > 0) {
        setRecentArtists(userList);

        // Dynamically fetch verified portraits from Deezer for artists without a custom portrait
        userList.forEach(item => {
          fetchArtistPortraitOnline(item.artist).then(pic => {
            if (pic) {
              setRecentArtists(prev => prev.map(a => a.artist === item.artist ? { ...a, avatar: pic } : a));
            }
          });
        });
      } else {
        setRecentArtists(DEFAULT_FEATURED_ARTISTS);
      }
    });
  }, [currentUser?.id]);

  // Mở Album Mix của nghệ sĩ (xử lý toàn bộ logic tìm kiếm & tổng hợp bằng Rust backend)
  const handleOpenArtistMix = async (artistItem: RecentArtistItem) => {
    setLoadingArtistName(artistItem.artist);
    setLoadingArtistMix(true);
    try {
      const mix = await invoke<ArtistMix>('get_artist_album_mix', {
        artist: artistItem.artist,
        userId: currentUser?.id || null,
      });
      if (mix && mix.tracks && mix.tracks.length > 0) {
        if (!mix.cover_art && artistItem.avatar) {
          mix.cover_art = artistItem.avatar;
        }
        setActiveArtistMix(mix);
      } else {
        handlePlayArtistDirect(artistItem);
      }
    } catch (err) {
      console.warn('Failed to load artist mix from Rust backend:', err);
      handlePlayArtistDirect(artistItem);
    } finally {
      setLoadingArtistMix(false);
      setLoadingArtistName('');
    }
  };

  // Phát Album Mix trực tiếp ngay lập tức khi bấm nút Phát
  const handlePlayArtistMixDirect = async (artistItem: RecentArtistItem) => {
    setLoadingArtistName(artistItem.artist);
    setLoadingArtistMix(true);
    try {
      const mix = await invoke<ArtistMix>('get_artist_album_mix', {
        artist: artistItem.artist,
        userId: currentUser?.id || null,
      });
      if (mix && mix.tracks && mix.tracks.length > 0) {
        if (!mix.cover_art && artistItem.avatar) {
          mix.cover_art = artistItem.avatar;
        }
        if (onPlayArtistMix) {
          onPlayArtistMix(mix, 0);
        }
      } else {
        handlePlayArtistDirect(artistItem);
      }
    } catch (err) {
      console.warn('Failed to direct play artist mix:', err);
      handlePlayArtistDirect(artistItem);
    } finally {
      setLoadingArtistMix(false);
      setLoadingArtistName('');
    }
  };

  const handlePlayArtistDirect = async (artistItem: RecentArtistItem) => {
    // 1. Kiểm tra nếu có bài mẫu từ lịch sử
    if (artistItem.sampleVideoId && artistItem.topTrackTitle) {
      onPlaySearchResult({
        url_or_id: artistItem.sampleVideoId,
        title: artistItem.topTrackTitle,
        artist: artistItem.artist,
        album: artistItem.topTrackTitle || 'Top Hits',
        duration_secs: 180,
        source: 'youtube',
        thumbnail: artistItem.avatar,
      });
      return;
    }
    // 2. Tìm bài trong curated hoặc tìm kiếm online
    const curatedMatches = Object.values(CURATED_BY_CATEGORY)
      .flat()
      .filter(t => t.artist?.toLowerCase().includes(artistItem.artist.toLowerCase()));
    if (curatedMatches.length > 0) {
      onPlaySearchResult(curatedMatches[0], curatedMatches);
      return;
    }
    try {
      const results = await invoke<SearchResult[]>('search_online', {
        query: `${artistItem.artist} bài hát hay nhất official audio`,
        source: 'youtube',
      });
      if (results && results.length > 0) {
        onPlaySearchResult(results[0], results);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const GENRE_SEARCH_FALLBACK: Record<string, string> = {
    rnb: 'top r&b soul songs playlist official audio',
    classical: 'classical music study piano masterpiece',
    jazz: 'relaxing jazz music coffee shop cafe chill',
    phonk: 'drift phonk playlist bass boosted gym aggressive',
  };

  const fetchTrending = async (category: string) => {
    setLoading(true);
    setTrendingTracks([]);

    try {
      let results: SearchResult[] = [];
      if (GENRE_SEARCH_FALLBACK[category]) {
        try {
          results = await invoke<SearchResult[]>('search_youtube_stream', { query: GENRE_SEARCH_FALLBACK[category] });
        } catch {
          results = await invoke<SearchResult[]>('get_trending_hits', { category });
        }
      } else {
        results = await invoke<SearchResult[]>('get_trending_hits', { category });
      }

      const curated = CURATED_BY_CATEGORY[category] || [];
      const pool = results && results.length > 0
        ? (category === 'lofi' ? [...curated, ...results] : [...results, ...curated])
        : curated;

      const unique: SearchResult[] = [];
      for (const item of pool) {
        const itemTitleNorm = item.title.trim().toLowerCase();
        const exists = unique.some(
          u => u.url_or_id === item.url_or_id ||
               u.title.trim().toLowerCase() === itemTitleNorm ||
               (u.title.trim().toLowerCase().startsWith(itemTitleNorm.slice(0, 18)) &&
                u.artist.trim().toLowerCase() === item.artist.trim().toLowerCase())
        );
        if (!exists) {
          unique.push(item);
        }
      }
      setTrendingTracks(unique.length > 0 ? unique : (CURATED_BY_CATEGORY[category] || CURATED_BY_CATEGORY.usuk));
    } catch (err) {
      console.error('Failed to fetch trending hits:', err);
      setTrendingTracks(CURATED_BY_CATEGORY[category] || CURATED_BY_CATEGORY.usuk);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrending(activeCategory);
  }, [activeCategory]);

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || secs < 0 || secs > 86400) return '--:--';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'youtube':
        return (
          <span 
            className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#16161c] border flex items-center gap-1 font-mono"
            style={{ color: accentColor, borderColor: `${accentColor}50` }}
          >
            <YoutubeIcon className="w-2.5 h-2.5" />YT HI-FI
          </span>
        );
      case 'soundcloud':
        return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#16161c] text-orange-400 border border-orange-500/30 flex items-center gap-1 font-mono">
            <SoundCloudIcon className="w-2.5 h-2.5" />SC
          </span>
        );
      case 'audius':
        return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#16161c] text-white border border-white/20 flex items-center gap-1 font-mono">
            <AudiusIcon className="w-2.5 h-2.5" style={{ color: accentColor }} />AUDIUS
          </span>
        );
      default:
        return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#16161c] text-white border border-white/20 font-mono">
            LOSSLESS
          </span>
        );
    }
  };

  const featured = trendingTracks[0] || CURATED_BY_CATEGORY.usuk[0];
  const top10 = trendingTracks.slice(0, 10);
  const remaining = trendingTracks.slice(10);

  const categories: CategoryFilter[] = [
    // Phổ biến & Bảng xếp hạng
    { id: 'all', label: getTranslation(language, 'trending.tagAll') || 'Tất cả Top Hits', icon: '🔥', group: language === 'vi' ? 'Bảng xếp hạng & Xu hướng' : 'Charts & Trends' },
    { id: 'usuk', label: getTranslation(language, 'trending.tagUsuk') || 'Billboard Hot 100', icon: '🇺🇸', group: language === 'vi' ? 'Bảng xếp hạng & Xu hướng' : 'Charts & Trends' },
    { id: 'vpop', label: getTranslation(language, 'trending.tagVpop') || 'V-Pop Thịnh Hành', icon: '🇻🇳', group: language === 'vi' ? 'Bảng xếp hạng & Xu hướng' : 'Charts & Trends' },
    { id: 'kpop', label: getTranslation(language, 'trending.tagKpop') || 'K-Pop Viral Hits', icon: '🇰🇷', group: language === 'vi' ? 'Bảng xếp hạng & Xu hướng' : 'Charts & Trends' },
    { id: 'jpop', label: getTranslation(language, 'trending.tagJpop') || 'J-Pop Hits', icon: '🇯🇵', group: language === 'vi' ? 'Bảng xếp hạng & Xu hướng' : 'Charts & Trends' },
    { id: 'anime', label: getTranslation(language, 'trending.tagAnime') || 'Anime OST & Opening', icon: '🎌', group: language === 'vi' ? 'Bảng xếp hạng & Xu hướng' : 'Charts & Trends' },

    // Tâm trạng & Không gian nghe nhạc
    { id: 'lofi', label: getTranslation(language, 'trending.tagLofi') || 'Lo-Fi Chillout & Study', icon: '☕', group: language === 'vi' ? 'Tâm trạng & Tập trung' : 'Moods & Focus' },
    { id: 'cortisol', label: language === 'vi' ? 'Low Cortisol & Thư giãn' : 'Low Cortisol & Relax', icon: '🌿', group: language === 'vi' ? 'Tâm trạng & Tập trung' : 'Moods & Focus' },
    { id: 'working', label: language === 'vi' ? 'Deep Focus & Coding' : 'Deep Focus & Coding', icon: '💻', group: language === 'vi' ? 'Tâm trạng & Tập trung' : 'Moods & Focus' },
    { id: 'lockin', label: language === 'vi' ? 'Lock In & Tập trung cao độ' : 'Lock In & Grind', icon: '🎯', group: language === 'vi' ? 'Tâm trạng & Tập trung' : 'Moods & Focus' },
    { id: 'gym', label: language === 'vi' ? 'Gym & Tập luyện năng lượng' : 'Gym & Beast Mode', icon: '🏋️', group: language === 'vi' ? 'Tâm trạng & Tập trung' : 'Moods & Focus' },
    { id: 'nightdrive', label: language === 'vi' ? 'Late Night Drive' : 'Late Night Drive', icon: '🌃', group: language === 'vi' ? 'Tâm trạng & Tập trung' : 'Moods & Focus' },

    // Thể loại âm nhạc đa dạng
    { id: 'edm', label: getTranslation(language, 'trending.tagEdm') || 'EDM & Cyber Bass', icon: '⚡', group: language === 'vi' ? 'Thể loại âm nhạc' : 'Genres & Styles' },
    { id: 'hiphop', label: getTranslation(language, 'trending.tagHiphop') || 'Hip-Hop & Trap', icon: '🎤', group: language === 'vi' ? 'Thể loại âm nhạc' : 'Genres & Styles' },
    { id: 'rock', label: getTranslation(language, 'trending.tagRock') || 'Rock & Alternative', icon: '🎸', group: language === 'vi' ? 'Thể loại âm nhạc' : 'Genres & Styles' },
    { id: 'rnb', label: 'R&B & Neo-Soul', icon: '🎷', group: language === 'vi' ? 'Thể loại âm nhạc' : 'Genres & Styles' },
    { id: 'jazz', label: language === 'vi' ? 'Coffee Jazz & Relax' : 'Coffee Jazz & Relax', icon: '🎺', group: language === 'vi' ? 'Thể loại âm nhạc' : 'Genres & Styles' },
    { id: 'classical', label: language === 'vi' ? 'Cổ điển & Piano êm dịu' : 'Classical & Piano', icon: '🎹', group: language === 'vi' ? 'Thể loại âm nhạc' : 'Genres & Styles' },
    { id: 'phonk', label: 'Drift Phonk & Bass', icon: '🏎️', group: language === 'vi' ? 'Thể loại âm nhạc' : 'Genres & Styles' },
    { id: 'acoustic', label: getTranslation(language, 'trending.tagAcoustic') || 'Acoustic & Indie Folk', icon: '🌱', group: language === 'vi' ? 'Thể loại âm nhạc' : 'Genres & Styles' },

    // Nguồn trực tuyến
    { id: 'soundcloud', label: getTranslation(language, 'trending.tagSoundcloud') || 'Top SoundCloud Remix', icon: '☁️', group: language === 'vi' ? 'Nền tảng âm nhạc' : 'Streaming Platforms' },
    { id: 'audius', label: getTranslation(language, 'trending.tagAudius') || 'Audius 320K Hi-Fi', icon: '🟣', group: language === 'vi' ? 'Nền tảng âm nhạc' : 'Streaming Platforms' },
  ];

  const currentCategory = categories.find(c => c.id === activeCategory);
  const currentCategoryLabel = currentCategory ? currentCategory.label : 'Top Hits';

  return (
    <div className="flex-1 w-full pb-16 space-y-7 select-none">
      {/* ─── HOME & SMART DJ HEADER (UNIFIED) ───────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span 
              className="text-[11px] font-medium font-mono px-2.5 py-0.5 rounded-full border flex items-center gap-1.5"
              style={{
                color: accentColor,
                backgroundColor: `${accentColor}15`,
                borderColor: `${accentColor}30`,
              }}
            >
              <AudioLines className="w-3.5 h-3.5" />
              <span>{language === 'vi' ? 'Trang chủ & Smart DJ' : 'Home & Smart DJ'}</span>
            </span>
            {currentUser?.username && (
              <span className="text-[11px] text-zinc-400 font-mono">
                {getTranslation(language, 'home.curatedFor')} <strong className="text-white">@{currentUser.username}</strong>
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {language === 'vi' ? 'Khám phá âm nhạc cùng Smart DJ' : 'Discover Music & Smart DJ'}
          </h1>
        </div>
      </div>



      {/* ─── HERO SHOWCASE BILLBOARD: CHỌN NGHỆ SĨ TỪ DANH SÁCH ĐỀ XUẤT ──── */}
      {heroArtists.length > 0 && (
        <div 
          className="relative w-full h-[175px] sm:h-[260px] md:h-[290px] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-[#09090e] group select-none"
          onMouseEnter={() => setIsHeroPaused(true)}
          onMouseLeave={() => setIsHeroPaused(false)}
        >
          {heroArtists.map((artist, idx) => {
            const isActive = idx === (heroIndex % heroArtists.length);
            const isLoadingThis = loadingArtistMix && loadingArtistName === artist.artist;
            return (
              <div
                key={artist.artist + idx}
                className={`absolute inset-0 flex items-center justify-between p-3.5 sm:p-7 md:p-8 transition-all duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)] will-change-[opacity,transform] ${
                  isActive ? 'opacity-100 scale-100 translate-x-0 z-10 pointer-events-auto' : 'opacity-0 scale-[1.02] translate-x-2 z-0 pointer-events-none'
                }`}
              >
                {/* Clean Modern Surface — Unslop: No loud gradients or blur bloat */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div className="absolute inset-0 bg-zinc-950/95" />
                  <img
                    src={artist.avatar}
                    alt=""
                    aria-hidden="true"
                    referrerPolicy="no-referrer"
                    className={`w-full h-full object-cover opacity-15 filter grayscale pointer-events-none transition-transform duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)] ${
                      isActive ? 'scale-105' : 'scale-110'
                    }`}
                  />
                </div>

                {/* Left Column: Information & Actions */}
                <div className={`relative z-10 flex-1 min-w-0 pr-2 flex flex-col justify-center space-y-1.5 sm:space-y-4 transition-all duration-700 ease-out ${
                  isActive ? 'opacity-100 translate-y-0 delay-100' : 'opacity-0 translate-y-2'
                }`}>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span
                      className="text-[9px] sm:text-xs font-bold uppercase tracking-widest font-mono px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border flex items-center gap-1 sm:gap-1.5 shadow-sm"
                      style={{
                        color: accentColor,
                        backgroundColor: `${accentColor}20`,
                        borderColor: `${accentColor}40`,
                      }}
                    >
                      <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span>{language === 'vi' ? 'Nghệ sĩ bạn hay nghe' : 'Top Listened Artist'}</span>
                    </span>
                    <span className="text-[9px] sm:text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/90 border border-white/10">
                      #{idx + 1}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-xl sm:text-4xl md:text-5xl font-black text-white tracking-tight drop-shadow-xl truncate">
                      {artist.artist}
                    </h2>
                    <div className="flex items-center gap-2 sm:gap-3 mt-0.5 sm:mt-1.5 text-[11px] sm:text-sm text-zinc-300 font-medium">
                      <span className="flex items-center gap-1 sm:gap-1.5 text-zinc-300">
                        <Headphones className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-400" />
                        <strong className="text-white">{artist.count}</strong> {language === 'vi' ? 'lượt nghe gần đây' : 'recent plays'}
                      </span>
                      {artist.topTrackTitle && (
                        <>
                          <span className="text-zinc-600">•</span>
                          <span className="text-zinc-400 line-clamp-1 italic max-w-[120px] sm:max-w-xs">
                            {artist.topTrackTitle}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 pt-0.5 sm:pt-1">
                    <button
                      type="button"
                      onClick={() => handlePlayArtistMixDirect(artist)}
                      className="px-3.5 py-1.5 sm:px-5 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-xl flex items-center gap-1.5 sm:gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                      style={{
                        backgroundColor: accentColor,
                        color: getContrastTextColor(accentColor),
                      }}
                    >
                      {isLoadingThis ? (
                        <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current ml-0.5" />
                      )}
                      <span>{language === 'vi' ? 'Phát Album Mix' : 'Play Artist Mix'}</span>
                    </button>
                  </div>
                </div>

                {/* Right Column: Hero Artist Card Showcase (Visible on both mobile & desktop) */}
                <div className={`relative z-10 flex flex-col items-center justify-center flex-shrink-0 pr-1 sm:pr-2 gap-2 transition-all duration-700 ease-out ${
                  isActive ? 'opacity-100 scale-100 delay-150' : 'opacity-0 scale-95'
                }`}>
                  <div 
                    onClick={() => handleOpenArtistMix(artist)}
                    className="relative w-20 h-20 sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border-2 border-white/20 ring-2 sm:ring-4 ring-black/40 group/card cursor-pointer hover:border-white/30 transition-all duration-300 hover:scale-105"
                  >
                    <img
                      src={artist.avatar}
                      alt={artist.artist}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        target.onerror = null;
                        target.src = getOrResolveArtistAvatar(artist.artist);
                      }}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity hidden sm:flex items-end justify-center pb-3">
                      <span className="text-xs font-bold text-white px-3 py-1 rounded-full bg-white/20 backdrop-blur-md">
                        {language === 'vi' ? 'Mở Album Mix' : 'Open Mix'}
                      </span>
                    </div>
                  </div>

                  {/* Centered Mini Dots Indicators directly under photo */}
                  {heroArtists.length > 1 && (
                    <div className="flex items-center justify-center gap-1 sm:gap-1.5 bg-black/70 backdrop-blur-md px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-white/10 shadow-lg">
                      {heroArtists.slice(0, 10).map((_, i) => {
                        const isDotActive = i === (heroIndex % heroArtists.length);
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHeroIndex(i);
                            }}
                            className={`h-1.5 rounded-full transition-all cursor-pointer ${
                              isDotActive ? 'w-3.5 sm:w-5' : 'w-1 sm:w-1.5 bg-white/30 hover:bg-white/60'
                            }`}
                            style={{
                              backgroundColor: isDotActive ? accentColor : undefined,
                            }}
                            title={`Artist #${i + 1}`}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── NGHỆ SĨ BẠN HAY NGHE GẦN ĐÂY (Cuộn ngang 1 hàng duy nhất) ──────────────────── */}
      {recentArtists.length > 0 && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between border-b border-[#161620] pb-2">
            <div className="flex items-center gap-2">
              <Mic2 className="w-4 h-4" style={{ color: accentColor }} />
              <h2 className="text-sm font-bold text-white tracking-wide">
                {getTranslation(language, 'home.recentArtists')}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#777] font-mono">
                {currentUser?.username ? `@${currentUser.username}` : getTranslation(language, 'home.tasteRecommendations')}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => scrollRecentArtists('left')}
                  className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/5 active:scale-95"
                  title="Cuộn sang trái"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollRecentArtists('right')}
                  className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/5 active:scale-95"
                  title="Cuộn sang phải"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div
            ref={recentArtistsScrollRef}
            className="flex items-stretch gap-3 overflow-x-auto hover-scrollbar scroll-smooth py-1"
          >
            {recentArtists.map((artistItem, idx) => {
              const isLoadingThis = loadingArtistMix && loadingArtistName === artistItem.artist;
              const isSelected = idx === (heroIndex % recentArtists.length);
              return (
                <div
                  key={idx}
                  onClick={() => {
                    setHeroIndex(idx);
                    handleOpenArtistMix(artistItem);
                  }}
                  className={`group w-[124px] sm:w-[136px] md:w-[144px] lg:w-[152px] flex-shrink-0 p-3 rounded-2xl bg-[#09090d] hover:bg-[#14141c] border transition-all flex flex-col items-center text-center cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1 relative ${
                    isSelected ? 'shadow-lg -translate-y-0.5' : ''
                  }`}
                  style={isSelected ? {
                    borderColor: accentColor,
                    boxShadow: `0 0 16px ${accentColor}35`,
                  } : {
                    borderColor: '#181822',
                  }}
                >
                  {/* Artist Cover / Logo - Modern Rounded Square (Not fixed circle) */}
                  <div 
                    className="relative w-full aspect-square rounded-2xl overflow-hidden mb-2.5 bg-[#12121a] border transition-all shadow-md"
                    style={isSelected ? { borderColor: `${accentColor}80` } : { borderColor: 'rgba(255,255,255,0.1)' }}
                  >
                    <img
                      src={artistItem.avatar}
                      alt={artistItem.artist}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        target.onerror = null;
                        target.src = getOrResolveArtistAvatar(artistItem.artist);
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Active showcase indicator */}
                    {isSelected && (
                      <div 
                        className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full animate-pulse shadow-md z-10"
                        style={{ backgroundColor: accentColor, boxShadow: `0 0 6px ${accentColor}` }}
                      />
                    )}

                    {/* Hover Play / Loading Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-2">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayArtistMixDirect(artistItem);
                        }}
                        className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform cursor-pointer"
                        style={{
                          backgroundColor: accentColor,
                          color: getContrastTextColor(accentColor),
                        }}
                        title={getTranslation(language, 'home.playAllMix')}
                      >
                        {isLoadingThis ? (
                          <Loader2 className="w-4 h-4 animate-spin text-black" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        )}
                      </div>
                    </div>

                    {/* Album Mix Badge */}
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenArtistMix(artistItem);
                      }}
                      className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-sm border border-white/10 text-[8.5px] font-mono font-bold text-cyan-300 uppercase opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-black"
                    >
                      Mix
                    </div>
                  </div>

                  <p 
                    className="w-full text-xs font-bold truncate transition-colors"
                    style={{ color: isSelected ? accentColor : '#ffffff' }}
                  >
                    {artistItem.artist}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate w-full">
                    {artistItem.count > 0
                      ? `${artistItem.count} ${getTranslation(language, 'home.plays')}`
                      : getTranslation(language, 'home.suggested')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── REDESIGNED TRENDING TOP 10 SHOWCASE ─────────────────────────── */}
      <div className="space-y-4 pt-1">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#161620] pb-2.5 gap-2.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div 
              className="w-7 h-7 rounded-lg flex items-center justify-center shadow-md shrink-0"
              style={{
                backgroundColor: `${accentColor}20`,
                color: accentColor,
              }}
            >
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide">
                {getTranslation(language, 'trending.title')}
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/90 border border-white/10 font-bold shrink-0">
                TOP 10
              </span>
            </div>

            {/* ─── GENRE / CATEGORY SELECTOR DROPDOWN ─── */}
            <div className="relative" ref={categoryDropdownRef}>
              <button
                type="button"
                onClick={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-white border border-white/10 text-xs font-semibold cursor-pointer transition-all shadow-sm hover:border-white/25 active:scale-95"
                title={language === 'vi' ? 'Bấm để đổi thể loại' : 'Click to select genre'}
              >
                <Music className="w-3.5 h-3.5 text-zinc-400" />
                <span className="max-w-[140px] sm:max-w-[180px] truncate">
                  {currentCategoryLabel}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${isCategoryMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* DROPDOWN MENU */}
              {isCategoryMenuOpen && (
                <div className="absolute left-0 mt-2 w-72 max-h-96 overflow-y-auto py-1.5 rounded-2xl bg-[#0c0c12]/95 backdrop-blur-xl border border-white/15 shadow-2xl z-50 hover-scrollbar animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 border-b border-white/5 flex items-center justify-between">
                    <span>{language === 'vi' ? 'Chọn thể loại Top 10' : 'Select Top 10 Genre'}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fetchTrending(activeCategory);
                      }}
                      disabled={loading}
                      title={language === 'vi' ? 'Làm mới danh sách' : 'Refresh'}
                      className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  <div className="p-1 space-y-0.5">
                    {categories.map((cat, idx) => {
                      const isSel = activeCategory === cat.id;
                      const prevCat = categories[idx - 1];
                      const showGroupHeader = !prevCat || prevCat.group !== cat.group;

                      return (
                        <React.Fragment key={cat.id}>
                          {showGroupHeader && cat.group && (
                            <div className="pt-2 pb-1 px-3 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 border-t border-white/5 first:border-t-0 first:pt-1">
                              {cat.group}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCategory(cat.id);
                              setIsCategoryMenuOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                              isSel
                                ? 'bg-white text-zinc-950 font-bold shadow-sm'
                                : 'text-zinc-300 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              {cat.icon && <span className="text-sm shrink-0">{cat.icon}</span>}
                              <span className="truncate">{cat.label}</span>
                            </div>
                            {isSel && <Check className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />}
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => fetchTrending(activeCategory)}
              disabled={loading}
              title={language === 'vi' ? 'Làm mới' : 'Refresh'}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-zinc-900/70 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/10 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} style={{ color: loading ? accentColor : undefined }} />
              <span className="hidden md:inline">{getTranslation(language, 'aimix.refresh')}</span>
            </button>

            {top10.length > 0 && !loading && (
              <button
                type="button"
                onClick={() => onPlaySearchResult(top10[0], top10)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: accentColor,
                  color: getContrastTextColor(accentColor),
                }}
                title={language === 'vi' ? 'Phát toàn bộ danh sách Top 10' : 'Play all Top 10 tracks'}
              >
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                <span>{language === 'vi' ? 'Phát Top 10' : 'Play Top 10'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Showcase */}
        {loading ? (
          <div className="flex flex-col lg:flex-row gap-4 items-stretch">
            {/* Champion Skeleton */}
            <div className="w-full lg:w-[350px] xl:w-[380px] h-72 rounded-2xl bg-[#0d0d12] border border-[#1c1c24] p-5 flex flex-col justify-between animate-pulse flex-shrink-0">
              <div className="w-32 h-6 bg-white/10 rounded-full" />
              <div className="w-44 h-44 bg-white/10 rounded-2xl mx-auto" />
              <div className="space-y-2">
                <div className="w-3/4 h-4 bg-white/10 rounded" />
                <div className="w-1/2 h-3 bg-white/5 rounded" />
              </div>
            </div>
            {/* List Skeleton */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 content-start">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="p-3 rounded-xl bg-[#09090c] border border-[#161620] flex items-center gap-3 animate-pulse">
                  <div className="w-7 h-7 rounded-lg bg-white/10" />
                  <div className="w-10 h-10 rounded-lg bg-white/10" />
                  <div className="flex-1 space-y-1.5">
                    <div className="w-3/4 h-3 bg-white/10 rounded" />
                    <div className="w-1/2 h-2.5 bg-white/5 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : top10.length === 0 ? null : (
          <div className="flex flex-col lg:flex-row gap-4 items-stretch">
            {/* ─── LEFT: CHAMPION RANK #1 SPOTLIGHT CARD ─── */}
            {(() => {
              const rank1 = top10[0];
              const isCurrent = currentTrack && (
                rank1.url_or_id === currentTrack.id ||
                rank1.url_or_id === currentTrack.path_or_url ||
                rank1.title.trim().toLowerCase() === currentTrack.title.trim().toLowerCase()
              );

              return (
                <div
                  onClick={() => onPlaySearchResult(rank1, top10)}
                  className="relative w-full lg:w-[350px] xl:w-[380px] rounded-2xl overflow-hidden border border-white/10 p-5 flex flex-col justify-between group cursor-pointer shadow-xl transition-all duration-300 hover:border-white/30 hover:shadow-2xl flex-shrink-0"
                  style={{
                    backgroundColor: '#111116',
                    borderColor: isCurrent ? accentColor : 'rgba(255,255,255,0.1)',
                  }}
                >
                  {/* Clean Modern Card Surface — No blur slop */}
                  <div className="absolute inset-0 bg-zinc-900/40 pointer-events-none" />

                  {/* Top Header inside Card */}
                  <div className="relative z-10 flex items-center justify-between">
                    <div 
                      className="px-2.5 py-1 rounded-md border border-white/10 bg-white/5 flex items-center gap-1.5 text-[11px] font-medium text-zinc-200"
                    >
                      <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span>{language === 'vi' ? 'Top 1 Thịnh Hành' : 'Top 1 Trending'}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {getSourceBadge(rank1.source)}
                      {(!rank1.duration_secs || rank1.duration_secs <= 0) ? (
                        <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                          LIVE
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-zinc-400 font-medium">
                          {formatTime(rank1.duration_secs)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle: Artwork with Vinyl Disc feel */}
                  <div className="relative z-10 my-4 flex items-center justify-center">
                    <div className="relative w-44 h-44 sm:w-48 sm:h-48 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/15 group-hover:scale-105 transition-transform duration-500">
                      {rank1.thumbnail ? (
                        <img
                          src={optimizeThumbnailUrl(rank1.thumbnail || undefined, rank1.url_or_id)}
                          alt={rank1.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleImageError(e, rank1.url_or_id)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#14141c] flex items-center justify-center text-white">
                          <Disc className="w-12 h-12" />
                        </div>
                      )}

                      {/* Play Button Overlay */}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-100 transition-all"
                          style={{
                            backgroundColor: accentColor,
                            color: getContrastTextColor(accentColor),
                            boxShadow: `0 0 20px ${accentColor}80`,
                          }}
                        >
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Info and CTA */}
                  <div className="relative z-10 space-y-2.5">
                    <div>
                      <h3 
                        className="text-base sm:text-lg font-black text-white line-clamp-1 group-hover:text-cyan-300 transition-colors drop-shadow"
                        style={{ color: isCurrent ? accentColor : undefined }}
                      >
                        {sanitizeTrackTitle(rank1.title)}
                      </h3>
                      <p className="text-xs text-zinc-300 line-clamp-1 font-medium mt-0.5">
                        {rank1.artist} {rank1.album ? `• ${rank1.album}` : ''}
                      </p>
                    </div>

                    <div className="pt-1 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlaySearchResult(rank1, top10);
                        }}
                        className="flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md hover:scale-[1.02] active:scale-95 cursor-pointer"
                        style={{
                          backgroundColor: accentColor,
                          color: getContrastTextColor(accentColor),
                        }}
                      >
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        <span>{language === 'vi' ? 'Phát Quán Quân' : 'Play #1 Track'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ─── RIGHT: RUNNER-UPS (RANKS 2 TO 10) ─── */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 content-start">
              {top10.slice(1).map((item, idx) => {
                const rank = idx + 2;
                const isRank2 = rank === 2;
                const isRank3 = rank === 3;
                const isCurrent = currentTrack && (
                  item.url_or_id === currentTrack.id ||
                  item.url_or_id === currentTrack.path_or_url ||
                  item.title.trim().toLowerCase() === currentTrack.title.trim().toLowerCase()
                );

                return (
                  <div
                    key={idx}
                    onClick={() => onPlaySearchResult(item, top10)}
                    style={{
                      borderColor: isCurrent ? accentColor : undefined,
                      backgroundColor: isCurrent ? `${accentColor}18` : undefined,
                      // clean border, no glow
                    }}
                    className={`p-2.5 rounded-xl bg-[#09090d] hover:bg-[#13131c] border transition-all flex items-center justify-between gap-2.5 group cursor-pointer shadow-sm ${
                      isCurrent ? '' : 'border-[#171722] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden flex-1 min-w-0">
                      {/* Rank Numeral */}
                      <span 
                        className={`w-6 text-center font-mono font-black text-xs flex-shrink-0 ${
                          isRank2
                            ? 'text-slate-200'
                            : isRank3
                            ? 'text-amber-400'
                            : 'text-zinc-600 group-hover:text-zinc-400'
                        }`}
                      >
                        {rank < 10 ? `0${rank}` : rank}
                      </span>

                      {/* Thumbnail */}
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-[#14141c] border border-white/10">
                        {item.thumbnail ? (
                          <img
                            src={optimizeThumbnailUrl(item.thumbnail || undefined, item.url_or_id)}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            onError={(e) => handleImageError(e, item.url_or_id)}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#555]">
                            <Music className="w-4 h-4" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-3.5 h-3.5 fill-current text-white ml-0.5" />
                        </div>
                      </div>

                      {/* Song Title & Artist */}
                      <div className="overflow-hidden min-w-0 flex-1">
                        <p 
                          className="text-xs font-bold text-white truncate transition-colors group-hover:text-cyan-200" 
                          style={{ color: isCurrent ? accentColor : undefined }}
                        >
                          {sanitizeTrackTitle(item.title)}
                        </p>
                        <p className="text-[11px] text-zinc-400 truncate font-mono mt-0.5">
                          {item.artist}
                        </p>
                      </div>
                    </div>

                    {/* Metadata Right */}
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                      {onAddToAlbum && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddToAlbum({
                              id: item.url_or_id,
                              title: item.title,
                              artist: item.artist,
                              album: item.album || 'Spytify Top 10',
                              duration_secs: item.duration_secs || 210,
                              path_or_url: item.url_or_id,
                              cover_art: item.thumbnail,
                              source: item.source || 'youtube',
                            });
                          }}
                          className="p-1 rounded-md text-zinc-500 hover:text-white transition-colors cursor-pointer"
                          title={language === 'vi' ? 'Thêm vào Album' : 'Add to Album'}
                        >
                          <FolderPlus className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {getSourceBadge(item.source)}
                      <span className="text-[11px] font-mono text-zinc-500">
                        {item.duration_secs && item.duration_secs > 0 ? formatTime(item.duration_secs) : 'LIVE'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── CÁC BÀI HÁT CHỦ ĐỀ LIÊN QUAN (THEMED PLAYLISTS VỚI HÌNH ẢNH BÌA) ─────── */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between border-b border-[#161620] pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: accentColor }} />
            <h2 className="text-sm font-bold text-white tracking-wide">
              {getTranslation(language, 'trending.collections')}
            </h2>
          </div>
          <span className="text-xs text-[#777] font-mono">
            {getTranslation(language, 'home.curatedSoundscapes')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {THEMED_COLLECTIONS.map((col, idx) => (
            <div
              key={idx}
              onClick={() => {
                setActiveCategory(col.categoryKey);
                const cur = CURATED_BY_CATEGORY[col.categoryKey];
                if (cur && cur.length > 0) {
                  onPlaySearchResult(cur[0], cur);
                }
              }}
              className="group relative h-44 rounded-2xl overflow-hidden border border-[#20202c] hover:border-white/40 transition-all cursor-pointer shadow-md hover:shadow-2xl"
            >
              {/* Background Cover Image with Hover Zoom */}
              <img
                src={col.cover}
                alt={col.title}
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />

              {/* Gradient Overlay for high-contrast readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30 group-hover:from-black/95 transition-colors" />

              {/* Content */}
              <div className="relative z-10 p-4 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between w-full">
                  <span
                    className="text-[9px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full border bg-black/60 backdrop-blur-md shadow-sm"
                    style={{
                      color: accentColor,
                      borderColor: `${accentColor}50`,
                    }}
                  >
                    {col.badge}
                  </span>

                  {/* Play Button on Hover */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-y-1 group-hover:translate-y-0 transition-all shadow-xl"
                    style={{
                      backgroundColor: accentColor,
                      color: getContrastTextColor(accentColor),
                      boxShadow: `0 0 16px ${accentColor}80`,
                    }}
                  >
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-black text-white group-hover:text-cyan-200 transition-colors leading-snug drop-shadow-md">
                    {col.title}
                  </h3>
                  <p className="text-[11px] text-zinc-300 line-clamp-1 drop-shadow-sm font-sans">
                    {col.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── MORE TRENDING DISCOVERIES ────────────────────────────────────── */}
      {!loading && remaining.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-[#161620] pb-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-white" />
              {getTranslation(language, 'trending.discoverMore')}
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {remaining.map((item, idx) => (
              <div
                key={idx}
                onClick={() => onPlaySearchResult(item, remaining)}
                className="card-hover-accent p-2.5 rounded-xl bg-[#09090c] hover:bg-[#121218] border border-[#161620] transition-all flex flex-col group cursor-pointer"
              >
                <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-2 bg-[#14141c]">
                  {item.thumbnail ? (
                    <img
                      src={optimizeThumbnailUrl(item.thumbnail, item.url_or_id)}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => handleImageError(e, item.url_or_id)}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#444]">
                      <Music className="w-6 h-6" />
                    </div>
                  )}

                  <div 
                    className="absolute right-2 bottom-2 w-8 h-8 rounded-full flex items-center justify-center shadow-lg opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all cursor-pointer"
                    style={{
                      backgroundColor: accentColor,
                      color: getContrastTextColor(accentColor),
                    }}
                  >
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>

                  <div className="absolute top-1.5 left-1.5">
                    {getSourceBadge(item.source)}
                  </div>
                </div>

                <p className="card-title-accent text-xs font-bold text-white truncate transition-colors">
                  {sanitizeTrackTitle(item.title)}
                </p>
                <p className="text-[11px] text-[#777] truncate font-mono mt-0.5">
                  {item.artist}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}



      {/* ─── ARTIST ALBUM MIX MODAL (POWERED BY RUST BACKEND) ──────────────── */}
      {activeArtistMix && (() => {
        const isArtistMixSaved = Boolean(
          albums && activeArtistMix && albums.some(a => 
            a.title.trim().toLowerCase() === (activeArtistMix.title || `${activeArtistMix.artist} Album Mix`).trim().toLowerCase() ||
            a.title.trim().toLowerCase() === `${activeArtistMix.artist} Mix`.toLowerCase()
          )
        );

        return (
        <div 
          onClick={() => setActiveArtistMix(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl sm:max-w-4xl max-h-[90dvh] sm:max-h-[88vh] bg-[#0c0c14] border border-cyan-500/30 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 md:p-7 shadow-2xl flex flex-col space-y-3 sm:space-y-4 relative overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Ambient backlight */}
            <div 
              className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none"
              style={{ backgroundColor: accentColor }}
            />

            {/* Close Button */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveArtistMix(null);
              }}
              className="absolute top-3 right-3 sm:top-5 sm:right-5 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-all cursor-pointer z-50 shadow-md active:scale-90"
              title={getTranslation(language, 'home.close')}
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Album Mix Header */}
            <div className="flex flex-row items-center sm:items-end gap-3 sm:gap-5 pt-0.5 pr-9 sm:pr-10 relative z-10">
              <div className="w-16 h-16 sm:w-36 sm:h-36 rounded-xl sm:rounded-2xl overflow-hidden bg-[#181824] border-2 border-white/10 shadow-2xl flex-shrink-0 group relative">
                <img
                  src={activeArtistMix.cover_art || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80'}
                  alt={activeArtistMix.artist}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="hidden sm:inline-block absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-cyan-500 text-black font-black text-[9px] uppercase tracking-wider font-mono">
                  ALBUM MIX
                </span>
              </div>

              <div className="flex-1 text-left min-w-0 space-y-1 sm:space-y-2">
                <span className="inline-block text-[9px] sm:text-[10px] font-mono uppercase font-bold text-cyan-400 tracking-wider sm:tracking-widest px-1.5 sm:px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 max-w-full truncate">
                  {getTranslation(language, 'home.artistMix', { artist: activeArtistMix.artist })}
                </span>
                <h2 className="text-base sm:text-2xl font-black text-white tracking-tight truncate">
                  {activeArtistMix.title}
                </h2>
                <p className="hidden sm:line-clamp-2 text-xs text-zinc-400 leading-relaxed">
                  {activeArtistMix.description}
                </p>
                <div className="flex flex-wrap items-center justify-start gap-x-2 gap-y-0.5 sm:gap-3 text-[11px] sm:text-xs text-zinc-400 font-mono pt-0.5">
                  <span className="text-white font-bold truncate max-w-[140px] sm:max-w-none">{activeArtistMix.artist}</span>
                  <span>•</span>
                  <span>{activeArtistMix.track_count} {getTranslation(language, 'home.tracks')}</span>
                  {isArtistMixSaved && (
                    <>
                      <span>•</span>
                      <span className="text-cyan-400 flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold">
                        <FolderCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span>{getTranslation(language, 'home.inAlbums')}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons: Play All, Shuffle, Add to Album */}
            <div className="flex items-center gap-2 sm:gap-2.5 pt-2 sm:pt-1 border-t border-white/5 relative z-10 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  if (onPlayArtistMix) {
                    onPlayArtistMix(activeArtistMix, 0);
                  } else if (activeArtistMix.tracks.length > 0) {
                    onPlaySearchResult(activeArtistMix.tracks[0], activeArtistMix.tracks);
                  }
                }}
                className="px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl font-bold text-[11px] sm:text-xs uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 cursor-pointer shadow-lg transition-all hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: accentColor,
                  color: getContrastTextColor(accentColor),
                }}
              >
                <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current ml-0.5" />
                <span>{getTranslation(language, 'home.playAllMix')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (activeArtistMix.tracks.length > 0) {
                    const shuffledTracks = [...activeArtistMix.tracks].sort(() => Math.random() - 0.5);
                    const shuffledMix: ArtistMix = { ...activeArtistMix, tracks: shuffledTracks };
                    if (onPlayArtistMix) {
                      onPlayArtistMix(shuffledMix, 0);
                    } else {
                      onPlaySearchResult(shuffledTracks[0], shuffledTracks);
                    }
                  }
                }}
                className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold text-[11px] sm:text-xs transition-colors cursor-pointer border border-white/10 flex items-center gap-1.5 sm:gap-2"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>{getTranslation(language, 'home.shuffle')}</span>
              </button>

              {/* Nút Thêm vào Album / Đã lưu vào Album */}
              <button
                type="button"
                onClick={() => {
                  if (onSaveArtistMixAsAlbum && activeArtistMix) {
                    onSaveArtistMixAsAlbum(activeArtistMix);
                  }
                }}
                className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-semibold text-[11px] sm:text-xs transition-all cursor-pointer border flex items-center gap-1.5 sm:gap-2 active:scale-95 shadow-md ${
                  isArtistMixSaved
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30'
                    : 'bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-cyan-500/30'
                }`}
                title={isArtistMixSaved ? getTranslation(language, 'home.inAlbums') : getTranslation(language, 'home.addToAlbums')}
              >
                {isArtistMixSaved ? (
                  <>
                    <FolderCheck className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{getTranslation(language, 'home.inAlbums')}</span>
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{getTranslation(language, 'home.addToAlbums')}</span>
                  </>
                )}
              </button>

              {/* Nút xem trong mục Album khi đã lưu */}
              {isArtistMixSaved && onNavigateToAlbums && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveArtistMix(null);
                    onNavigateToAlbums();
                  }}
                  className="px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-400 border border-cyan-500/30 font-semibold text-[11px] sm:text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Mở thư mục Album để nghe hoặc chỉnh sửa"
                >
                  <Library className="w-3.5 h-3.5" />
                  <span>{getTranslation(language, 'home.viewInAlbums')}</span>
                </button>
              )}
            </div>

            {/* Tracklist List View */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5 sm:pr-1 no-scrollbar relative z-10">
              {activeArtistMix.tracks.map((track, idx) => {
                const isThisPlaying = currentTrack?.path_or_url === track.url_or_id || currentTrack?.title === track.title;
                const isFav = favorites.has(track.url_or_id);
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (onPlayArtistMix) {
                        onPlayArtistMix(activeArtistMix, track);
                      } else {
                        onPlaySearchResult(track, activeArtistMix.tracks);
                      }
                    }}
                    className={`p-2 sm:p-2.5 rounded-xl border flex items-center justify-between gap-2 sm:gap-3 group transition-all cursor-pointer overflow-hidden ${
                      isThisPlaying
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                        : 'bg-[#101018] hover:bg-[#181824] border-white/5 hover:border-white/15 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      {/* Track Index / Play status */}
                      <span className="w-5 sm:w-6 text-center text-[11px] sm:text-xs font-mono font-bold text-zinc-500 group-hover:text-cyan-400 flex-shrink-0">
                        {isThisPlaying && isPlaying ? (
                          <div className="flex items-end justify-center gap-0.5 h-3.5">
                            <span className="w-0.5 h-full bg-cyan-400 animate-pulse" />
                            <span className="w-0.5 h-2/3 bg-cyan-400 animate-pulse delay-75" />
                            <span className="w-0.5 h-4/5 bg-cyan-400 animate-pulse delay-150" />
                          </div>
                        ) : (
                          <span>{(idx + 1).toString().padStart(2, '0')}</span>
                        )}
                      </span>

                      {/* Track Thumbnail */}
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0 border border-white/10 relative">
                        <img
                          src={track.thumbnail || activeArtistMix.cover_art || ''}
                          alt={track.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
                        </div>
                      </div>

                      {/* Title & Artist */}
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-bold truncate ${isThisPlaying ? 'text-cyan-300' : 'text-white group-hover:text-cyan-300'}`}>
                          {track.title}
                        </p>
                        <p className="text-[11px] text-zinc-500 truncate font-mono">
                          {track.artist}
                        </p>
                      </div>
                    </div>

                    {/* Duration & Actions */}
                    <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
                      {onAddToAlbum && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddToAlbum({
                              id: track.url_or_id,
                              title: track.title,
                              artist: track.artist,
                              album: track.album || 'Spytify',
                              duration_secs: track.duration_secs,
                              path_or_url: track.url_or_id,
                              cover_art: track.thumbnail,
                              source: 'youtube',
                            });
                          }}
                          className="p-1 sm:p-1.5 rounded-lg text-zinc-500 hover:text-white transition-colors cursor-pointer"
                          title={language === 'vi' ? 'Thêm bài hát vào Album' : 'Add to Album'}
                        >
                          <FolderPlus className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(track.url_or_id);
                        }}
                        className={`p-1 sm:p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isFav ? 'text-rose-500 hover:text-rose-400' : 'text-zinc-500 hover:text-white'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                      </button>

                      <span className="text-[10px] sm:text-[11px] font-mono text-zinc-400 w-8 sm:w-10 text-right">
                        {Math.floor(track.duration_secs / 60)}:{(track.duration_secs % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};
