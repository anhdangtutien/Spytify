import React, { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Flame, Play, Disc, Sparkles, TrendingUp, Music, 
  Crown, Loader2, RefreshCw, Compass, Headphones, Radio, Mic2,
  Shuffle, X, Heart, Clock, ChevronLeft, ChevronRight, ListMusic,
  FolderPlus, FolderCheck, Library, Check
} from 'lucide-react';
import { SearchResult, Track, User, ArtistMix, UserAlbum } from '../types';
import { YoutubeIcon, SoundCloudIcon, AudiusIcon, ModernHomeIcon } from './Icons';
import { getContrastTextColor, optimizeThumbnailUrl, handleImageError, sanitizeTrackTitle } from '../utils/trackUtils';
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
}

interface CategoryFilter {
  id: string;
  label: string;
  icon: string;
}

const CATEGORIES: CategoryFilter[] = [
  { id: 'all', label: 'Tổng Hợp Top Hits', icon: '🔥' },
  { id: 'cortisol', label: 'Low Cortisol & Chill', icon: '🌅' },
  { id: 'working', label: 'Deep Focus & Work', icon: '💻' },
  { id: 'lockin', label: 'Lock In & Grind', icon: '🎯' },
  { id: 'gym', label: 'Gym & Beast Workout', icon: '🏋️' },
  { id: 'nightdrive', label: 'Late Night Drive', icon: '🌃' },
  { id: 'usuk', label: 'Billboard US/UK Hot 100', icon: '🌍' },
  { id: 'kpop_jpop', label: 'J-Pop & K-Pop Thịnh Hành', icon: '🎌' },
  { id: 'vpop', label: 'V-Pop Đỉnh Chóp', icon: '🇻🇳' },
  { id: 'lofi', label: 'Lo-Fi Chillout', icon: '☕' },
  { id: 'audius', label: 'Audius 320K Charts', icon: '⚡' },
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
};

const POPULAR_ARTIST_AVATARS: Record<string, string> = {
  'sơn tùng m-tp': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
  'sơn tùng': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
  'vũ.': 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=400&auto=format&fit=crop&q=80',
  'vũ': 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=400&auto=format&fit=crop&q=80',
  'đen': 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&auto=format&fit=crop&q=80',
  'đen vâu': 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&auto=format&fit=crop&q=80',
  'hieuthuhai': 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&auto=format&fit=crop&q=80',
  'bruno mars': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
  'taylor swift': 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&auto=format&fit=crop&q=80',
  'billie eilish': 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80',
  'lady gaga': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
  'sabrina carpenter': 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&auto=format&fit=crop&q=80',
  'newjeans': 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=400&auto=format&fit=crop&q=80',
  'blackpink': 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=400&auto=format&fit=crop&q=80',
  'rosé': 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=400&auto=format&fit=crop&q=80',
  'yoasobi': 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80',
  'creepy nuts': 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=80',
};

interface RecentArtistItem {
  artist: string;
  count: number;
  avatar: string;
  topTrackTitle?: string;
  sampleVideoId?: string;
}

const DEFAULT_FEATURED_ARTISTS: RecentArtistItem[] = [
  {
    artist: 'Sơn Tùng M-TP',
    count: 24,
    avatar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
    topTrackTitle: 'Đừng Làm Trái Tim Anh Đau',
    sampleVideoId: 'abPmZCZZrFA',
  },
  {
    artist: 'Bruno Mars',
    count: 19,
    avatar: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
    topTrackTitle: 'Die With A Smile / APT.',
    sampleVideoId: 'kPa7bsKwL-8',
  },
  {
    artist: 'Billie Eilish',
    count: 16,
    avatar: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80',
    topTrackTitle: 'Birds of a Feather',
    sampleVideoId: 'd5gf9dXHevw',
  },
  {
    artist: 'Vũ.',
    count: 14,
    avatar: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=400&auto=format&fit=crop&q=80',
    topTrackTitle: 'Bước Qua Mùa Cô Đơn',
    sampleVideoId: 'YQHsXMglC9A',
  },
  {
    artist: 'Taylor Swift',
    count: 18,
    avatar: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&auto=format&fit=crop&q=80',
    topTrackTitle: 'Cruel Summer',
    sampleVideoId: 'ic8j13piAhQ',
  },
  {
    artist: 'HIEUTHUHAI',
    count: 12,
    avatar: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&auto=format&fit=crop&q=80',
    topTrackTitle: 'Không Thể Say / NOLOVE',
    sampleVideoId: 'u4k4iG1u7lE',
  },
  {
    artist: 'ROSÉ',
    count: 15,
    avatar: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=400&auto=format&fit=crop&q=80',
    topTrackTitle: 'APT. (feat. Bruno Mars)',
    sampleVideoId: 'ekr2nIex040',
  },
  {
    artist: 'YOASOBI',
    count: 11,
    avatar: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=80',
    topTrackTitle: 'Idol (アイドル)',
    sampleVideoId: 'ZRtdQ81jPUQ',
  },
  {
    artist: 'NewJeans',
    count: 14,
    avatar: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=400&auto=format&fit=crop&q=80',
    topTrackTitle: 'Super Shy / Hype Boy',
    sampleVideoId: 'ArmDp-zijuc',
  },
  {
    artist: 'The Weeknd',
    count: 17,
    avatar: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&auto=format&fit=crop&q=80',
    topTrackTitle: 'Blinding Lights / Timeless',
    sampleVideoId: '4NRXx6U8ABQ',
  },
  {
    artist: 'Đen',
    count: 13,
    avatar: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&auto=format&fit=crop&q=80',
    topTrackTitle: 'Nấu Ăn Cho Em',
    sampleVideoId: 'L8eRzOYhLuw',
  },
  {
    artist: 'Sabrina Carpenter',
    count: 15,
    avatar: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&auto=format&fit=crop&q=80',
    topTrackTitle: 'Espresso / Taste',
    sampleVideoId: 'eVli-tstM5E',
  },
  {
    artist: 'Eve',
    count: 10,
    avatar: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80',
    topTrackTitle: 'Kaikai Kitan (廻廻奇譚)',
    sampleVideoId: '1tk1pqwrOys',
  },
  {
    artist: 'DAOKO',
    count: 12,
    avatar: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&auto=format&fit=crop&q=80',
    topTrackTitle: 'Uchiage Hanabi (打上花火)',
    sampleVideoId: '-tKVN2mAKRI',
  },
  {
    artist: 'Lady Gaga',
    count: 13,
    avatar: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
    topTrackTitle: 'Die With A Smile / Poker Face',
    sampleVideoId: 'kPa7bsKwL-8',
  },
  {
    artist: 'Kenshi Yonezu',
    count: 11,
    avatar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
    topTrackTitle: 'Lemon / Kick Back',
    sampleVideoId: 'SX_ViT4Ra7k',
  },
  {
    artist: 'Charlie Puth',
    count: 12,
    avatar: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&auto=format&fit=crop&q=80',
    topTrackTitle: 'Attention / Left and Right',
    sampleVideoId: 'nfs8NYg7yQM',
  },
  {
    artist: 'Fujii Kaze',
    count: 10,
    avatar: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=400&auto=format&fit=crop&q=80',
    topTrackTitle: 'Shinunoga E-Wa (死ぬのがいいわ)',
    sampleVideoId: 'dFzVjUgtpRg',
  },
  {
    artist: 'Creepy Nuts',
    count: 9,
    avatar: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=80',
    topTrackTitle: 'Bling-Bang-Bang-Born',
    sampleVideoId: 'mLW35ymz1gk',
  },
  {
    artist: 'BLACKPINK',
    count: 14,
    avatar: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=400&auto=format&fit=crop&q=80',
    topTrackTitle: 'Pink Venom / How You Like That',
    sampleVideoId: 'gQlMMD8auMs',
  },
];

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
}) => {
  const [trendingTracks, setTrendingTracks] = useState<SearchResult[]>(CURATED_BY_CATEGORY.usuk);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('usuk');
  const [trendingKeywords, setTrendingKeywords] = useState<string[]>([]);
  const [keywordsLoading, setKeywordsLoading] = useState(false);

  // Nghệ sĩ hay nghe của tài khoản hiện tại
  const [recentArtists, setRecentArtists] = useState<RecentArtistItem[]>(DEFAULT_FEATURED_ARTISTS);

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
        .slice(0, 20)
        .map(([artist, data]) => {
          const fallbackCover = POPULAR_ARTIST_AVATARS[artist.toLowerCase()] || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80';
          return {
            artist,
            count: data.count,
            avatar: data.cover || fallbackCover,
            topTrackTitle: data.topTitle,
            sampleVideoId: data.id,
          };
        });

      if (userList.length > 0) {
        setRecentArtists(userList);
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

  // Thể loại động: sinh từ khóa theo top trending (YouTube autocomplete) — fallback: nghệ sĩ hot nhất
  const loadTrendingKeywords = async () => {
    setKeywordsLoading(true);
    try {
      const kws = await invoke<string[]>('get_trending_keywords', { language });
      if (kws && kws.length > 0) {
        setTrendingKeywords(kws);
        return;
      }
      throw new Error('empty');
    } catch {
      const freq = new Map<string, number>();
      Object.values(CURATED_BY_CATEGORY).flat().forEach(t => {
        const a = (t.artist || '').split(/,|&| x | ft\.?| feat\.?/i)[0].trim();
        if (a && a.length > 1) freq.set(a, (freq.get(a) || 0) + 1);
      });
      setTrendingKeywords([...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k));
    } finally {
      setKeywordsLoading(false);
    }
  };

  useEffect(() => {
    loadTrendingKeywords();
  }, [language]);

  const fetchTrending = async (category: string) => {
    setLoading(true);
    setTrendingTracks([]);

    try {
      const isKeyword = category.startsWith('kw:');
      const results = isKeyword
        ? await invoke<SearchResult[]>('search_online', { query: category.slice(3), source: 'youtube' })
        : await invoke<SearchResult[]>('get_trending_hits', { category });
      const curated = isKeyword ? [] : (CURATED_BY_CATEGORY[category] || []);
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
    { id: 'usuk', label: getTranslation(language, 'trending.tagUsuk') || 'Billboard US/UK Hot 100', icon: '🌍' },
    { id: 'jpop', label: getTranslation(language, 'trending.tagJpop'), icon: '🌸' },
    { id: 'kpop', label: getTranslation(language, 'trending.tagKpop'), icon: '⚡' },
    { id: 'vpop', label: getTranslation(language, 'trending.tagVpop'), icon: '🇻🇳' },
    { id: 'anime', label: getTranslation(language, 'trending.tagAnime'), icon: '🎌' },
    { id: 'audius', label: getTranslation(language, 'trending.tagAudius') || 'Audius 320K Charts', icon: '⚡' },
    { id: 'soundcloud', label: getTranslation(language, 'trending.tagSoundcloud'), icon: '☁️' },
    { id: 'all', label: getTranslation(language, 'trending.tagAll'), icon: '🔥' },
    { id: 'edm', label: getTranslation(language, 'trending.tagEdm'), icon: '🎛️' },
    { id: 'hiphop', label: getTranslation(language, 'trending.tagHiphop'), icon: '🎤' },
    { id: 'lofi', label: getTranslation(language, 'trending.tagLofi') || 'Lo-Fi Chillout', icon: '☕' },
    { id: 'rock', label: getTranslation(language, 'trending.tagRock'), icon: '🎸' },
    { id: 'acoustic', label: getTranslation(language, 'trending.tagAcoustic'), icon: '🪕' },
  ];

  return (
    <div className="flex-1 w-full pb-16 space-y-7 select-none">
      {/* ─── HOME HEADER & GREETING ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span 
              className="text-[10px] font-bold uppercase tracking-widest font-mono px-2 py-0.5 rounded border flex items-center gap-1.5"
              style={{
                color: accentColor,
                backgroundColor: `${accentColor}15`,
                borderColor: `${accentColor}30`,
              }}
            >
              <ModernHomeIcon className="w-3.5 h-3.5" active />
              <span>{getTranslation(language, 'nav.trending')}</span>
            </span>
            {currentUser?.username && (
              <span className="text-[11px] text-zinc-400 font-mono">
                {getTranslation(language, 'home.curatedFor')} <strong className="text-white">@{currentUser.username}</strong>
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {getTranslation(language, 'home.discoverMusic')}
          </h1>
        </div>
      </div>

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
              return (
                <div
                  key={idx}
                  onClick={() => handleOpenArtistMix(artistItem)}
                  className="group w-[124px] sm:w-[136px] md:w-[144px] lg:w-[152px] flex-shrink-0 p-3 rounded-2xl bg-[#09090d] hover:bg-[#14141c] border border-[#181822] hover:border-cyan-500/40 transition-all flex flex-col items-center text-center cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1 relative"
                >
                  {/* Artist Cover / Logo - Modern Rounded Square (Not fixed circle) */}
                  <div className="relative w-full aspect-square rounded-2xl overflow-hidden mb-2.5 bg-[#12121a] border border-white/10 group-hover:border-cyan-400/60 transition-all shadow-md">
                    <img
                      src={artistItem.avatar}
                      alt={artistItem.artist}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Hover Play / Loading Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-2">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform"
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
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-sm border border-white/10 text-[8.5px] font-mono font-bold text-cyan-300 uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                      Mix
                    </div>
                  </div>

                  <p className="w-full text-xs font-bold text-white truncate group-hover:text-cyan-300 transition-colors">
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

      {/* ─── HERO SPOTLIGHT (BILLBOARD HOT #1 / FEATURED TRACK) ──────────────── */}
      {loading ? (
        <div className="relative rounded-2xl overflow-hidden bg-[#0d0d12] border border-[#1c1c24] p-6 lg:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl animate-pulse">
          <div className="z-10 max-w-xl space-y-4 w-full">
            <div className="w-36 h-5 bg-white/10 rounded-full" />
            <div className="w-3/4 h-8 bg-white/10 rounded-xl" />
            <div className="w-1/2 h-4 bg-white/10 rounded-md" />
            <div className="w-32 h-9 bg-white/10 rounded-xl mt-3" />
          </div>
          <div className="w-44 h-44 lg:w-52 lg:h-52 rounded-2xl bg-white/10 flex-shrink-0" />
        </div>
      ) : featured ? (
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#0d0d12] via-[#09090c] to-black border border-[#1c1c24] p-6 lg:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
          <div className="z-10 max-w-xl space-y-3">
            <div className="flex items-center gap-2">
              <span 
                className="px-2.5 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wider font-mono flex items-center gap-1.5"
                style={{
                  backgroundColor: `${accentColor}20`,
                  color: accentColor,
                  borderColor: `${accentColor}50`,
                }}
              >
                <Crown className="w-3 h-3" style={{ color: accentColor }} />
                {getTranslation(language, 'trending.globalRank')}
              </span>
              <span className="text-xs text-[#8e8e9f] font-mono">Top Trending Stream</span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-tight">
              {sanitizeTrackTitle(featured.title)}
            </h1>

            <p className="text-sm font-medium text-[#a0a0b2]">
              {featured.artist} • <span className="text-white font-mono">{featured.album || 'Billboard Spotlight'}</span>
            </p>

            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => onPlaySearchResult(featured, trendingTracks)}
                style={{
                  backgroundColor: accentColor,
                  color: getContrastTextColor(accentColor),
                  boxShadow: `0 0 16px ${accentColor}40`
                }}
                className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 hover:scale-105 active:scale-95"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
                <span>{getTranslation(language, 'trending.playNow')}</span>
              </button>
              {(!featured.duration_secs || featured.duration_secs <= 0) ? (
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                  LIVE 24/7
                </span>
              ) : (
                <span className="text-xs font-mono text-[#777]">{formatTime(featured.duration_secs)}</span>
              )}
            </div>
          </div>

          {/* Featured Cover Art */}
          <div
            onClick={() => onPlaySearchResult(featured, trendingTracks)}
            className="relative w-44 h-44 lg:w-52 lg:h-52 rounded-2xl overflow-hidden border border-[#2a2a35] flex-shrink-0 cursor-pointer shadow-xl group"
          >
            {featured.thumbnail ? (
              <img
                src={optimizeThumbnailUrl(featured.thumbnail, featured.url_or_id)}
                alt={featured.title}
                referrerPolicy="no-referrer"
                onError={(e) => handleImageError(e, featured.url_or_id)}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full bg-[#121218] flex items-center justify-center text-white">
                <Disc className="w-12 h-12" />
              </div>
            )}
            <div className="absolute top-2 right-2">
              {getSourceBadge(featured.source)}
            </div>
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform"
                style={{
                  backgroundColor: accentColor,
                  color: getContrastTextColor(accentColor),
                  boxShadow: `0 0 16px ${accentColor}60`,
                }}
              >
                <Play className="w-5 h-5 fill-current ml-0.5" />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ─── CATEGORY FILTER PILLS ────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={isActive ? {
                  backgroundColor: accentColor,
                  color: getContrastTextColor(accentColor),
                  boxShadow: `0 0 14px ${accentColor}40`,
                  borderColor: accentColor,
                } : undefined}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
                  isActive
                    ? 'font-bold'
                    : 'bg-[#0e0e12] text-[#888899] hover:text-white hover:bg-[#16161e] border-[#1c1c24]'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => fetchTrending(activeCategory)}
          disabled={loading}
          className="p-2 rounded-lg bg-[#0e0e12] hover:bg-[#16161e] text-[#888] hover:text-white border border-[#1e1e26] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} style={{ color: loading ? accentColor : undefined }} />
          <span className="hidden sm:inline">{getTranslation(language, 'aimix.refresh')}</span>
        </button>
      </div>

      {/* ─── DYNAMIC TRENDING KEYWORD GENRES ───────────────────────────────── */}
      {(keywordsLoading || trendingKeywords.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap -mt-3">
          <span
            className="text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 mr-1"
            style={{ color: accentColor }}
          >
            <Sparkles className="w-3 h-3" />
            {getTranslation(language, 'home.trendingNow')}
          </span>
          {keywordsLoading && trendingKeywords.length === 0
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-7 w-24 rounded-xl bg-white/5 border border-[#1c1c24] animate-pulse" />
              ))
            : trendingKeywords.map((kw) => {
                const id = `kw:${kw}`;
                const isActive = activeCategory === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveCategory(id)}
                    title={kw}
                    style={isActive ? {
                      backgroundColor: accentColor,
                      color: getContrastTextColor(accentColor),
                      boxShadow: `0 0 14px ${accentColor}40`,
                      borderColor: accentColor,
                    } : { borderColor: `${accentColor}30` }}
                    className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-all cursor-pointer border max-w-[200px] truncate ${
                      isActive ? 'font-bold' : 'bg-[#0e0e12] text-[#a0a0b2] hover:text-white hover:bg-[#16161e]'
                    }`}
                  >
                    #{kw}
                  </button>
                );
              })}
          <button
            onClick={loadTrendingKeywords}
            disabled={keywordsLoading}
            className="p-1.5 rounded-lg text-[#666] hover:text-white transition-colors cursor-pointer"
            title={getTranslation(language, 'home.refreshKeywords')}
          >
            <RefreshCw className={`w-3 h-3 ${keywordsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      {/* ─── TOP 10 LEADERBOARD CHART ─────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#161620] pb-2">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: accentColor }} />
            {getTranslation(language, 'trending.title')}
          </h2>
          <span className="text-xs text-[#777] font-mono">{getTranslation(language, 'trending.top10')}</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-[#09090c] border border-[#161620] flex items-center justify-between gap-3 animate-pulse"
              >
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                  <div className="w-7 h-7 rounded-lg bg-white/10 flex-shrink-0" />
                  <div className="w-11 h-11 rounded-lg bg-white/10 flex-shrink-0" />
                  <div className="overflow-hidden flex-1 space-y-1.5">
                    <div className="w-3/4 h-3.5 bg-white/10 rounded" />
                    <div className="w-1/2 h-2.5 bg-white/5 rounded" />
                  </div>
                </div>
                <div className="w-14 h-4 bg-white/10 rounded flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {top10.map((item, idx) => {
              const rank = idx + 1;
              const isRank1 = rank === 1;
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
                    boxShadow: isCurrent ? `0 0 14px ${accentColor}30` : undefined,
                  }}
                  className={`card-hover-accent p-3 rounded-xl bg-[#09090c] hover:bg-[#121218] border transition-all flex items-center justify-between gap-3 group cursor-pointer shadow-sm ${
                    isCurrent ? '' : 'border-[#161620]'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    {/* Rank Badge */}
                    <div
                      style={isRank1 ? {
                        backgroundColor: accentColor,
                        color: getContrastTextColor(accentColor),
                        boxShadow: `0 0 10px ${accentColor}50`,
                      } : undefined}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs font-mono flex-shrink-0 ${
                        isRank1
                          ? ''
                          : isRank2
                          ? 'bg-white text-black'
                          : isRank3
                          ? 'bg-[#252530] text-white'
                          : 'bg-[#14141a] text-[#777]'
                      }`}
                    >
                      {rank}
                    </div>

                    {/* Thumbnail with hover play */}
                    <div className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-[#14141c] border border-[#222]">
                      {item.thumbnail ? (
                        <img
                          src={optimizeThumbnailUrl(item.thumbnail, item.url_or_id)}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleImageError(e, item.url_or_id)}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#555]">
                          <Music className="w-4 h-4" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-4 h-4 fill-current text-white" />
                      </div>
                    </div>

                    {/* Song Info */}
                    <div className="overflow-hidden">
                      <p 
                        className="card-title-accent text-xs font-bold text-white truncate transition-colors" 
                        style={{ color: isCurrent ? accentColor : undefined }}
                      >
                        {sanitizeTrackTitle(item.title)}
                      </p>
                      <p className="text-[11px] text-[#8e8e9f] truncate font-mono mt-0.5">
                        {item.artist}
                      </p>
                    </div>
                  </div>

                  {/* Right metadata */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(!item.duration_secs || item.duration_secs <= 0) ? (
                      <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                        LIVE
                      </span>
                    ) : (
                      <>
                        {getSourceBadge(item.source)}
                        <span className="text-[11px] font-mono text-[#666]">{formatTime(item.duration_secs)}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl sm:max-w-4xl max-h-[88vh] bg-[#0c0c14] border border-cyan-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col space-y-4 relative overflow-hidden animate-in zoom-in-95 duration-200"
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
              className="absolute top-4 right-4 sm:top-5 sm:right-5 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-all cursor-pointer z-50 shadow-md active:scale-90"
              title={getTranslation(language, 'home.close')}
            >
              <X className="w-5 h-5" />
            </button>

            {/* Album Mix Header */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 pt-1 relative z-10">
              <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-2xl overflow-hidden bg-[#181824] border-2 border-white/10 shadow-2xl flex-shrink-0 group relative">
                <img
                  src={activeArtistMix.cover_art || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80'}
                  alt={activeArtistMix.artist}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-cyan-500 text-black font-black text-[9px] uppercase tracking-wider font-mono">
                  ALBUM MIX
                </span>
              </div>

              <div className="flex-1 text-center sm:text-left min-w-0 space-y-2">
                <span className="text-[10px] font-mono uppercase font-bold text-cyan-400 tracking-widest px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30">
                  {getTranslation(language, 'home.artistMix', { artist: activeArtistMix.artist })}
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
                  {activeArtistMix.title}
                </h2>
                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                  {activeArtistMix.description}
                </p>
                <div className="flex items-center justify-center sm:justify-start gap-3 text-xs text-zinc-400 font-mono pt-1">
                  <span className="text-white font-bold">{activeArtistMix.artist}</span>
                  <span>•</span>
                  <span>{activeArtistMix.track_count} {getTranslation(language, 'home.tracks')}</span>
                  {isArtistMixSaved && (
                    <>
                      <span>•</span>
                      <span className="text-cyan-400 flex items-center gap-1 text-[11px] font-semibold">
                        <FolderCheck className="w-3.5 h-3.5" />
                        <span>{getTranslation(language, 'home.inAlbums')}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons: Play All, Shuffle, Add to Album */}
            <div className="flex items-center gap-2.5 pt-1 border-t border-white/5 relative z-10 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  if (onPlayArtistMix) {
                    onPlayArtistMix(activeArtistMix, 0);
                  } else if (activeArtistMix.tracks.length > 0) {
                    onPlaySearchResult(activeArtistMix.tracks[0], activeArtistMix.tracks);
                  }
                }}
                className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg transition-all hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: accentColor,
                  color: getContrastTextColor(accentColor),
                }}
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
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
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold text-xs transition-colors cursor-pointer border border-white/10 flex items-center gap-2"
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
                className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all cursor-pointer border flex items-center gap-2 active:scale-95 shadow-md ${
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
                  className="px-3 py-2.5 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-400 border border-cyan-500/30 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Mở thư mục Album để nghe hoặc chỉnh sửa"
                >
                  <Library className="w-3.5 h-3.5" />
                  <span>{getTranslation(language, 'home.viewInAlbums')}</span>
                </button>
              )}
            </div>

            {/* Tracklist List View */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[52vh] no-scrollbar relative z-10">
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
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 group transition-all cursor-pointer ${
                      isThisPlaying
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                        : 'bg-[#101018] hover:bg-[#181824] border-white/5 hover:border-white/15 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Track Index / Play status */}
                      <span className="w-6 text-center text-xs font-mono font-bold text-zinc-500 group-hover:text-cyan-400">
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
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0 border border-white/10 relative">
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
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(track.url_or_id);
                        }}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isFav ? 'text-rose-500 hover:text-rose-400' : 'text-zinc-500 hover:text-white'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                      </button>

                      <span className="text-[11px] font-mono text-zinc-400 w-10 text-right">
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
