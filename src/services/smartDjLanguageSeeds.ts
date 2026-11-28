import { Track } from '../types';
import { LanguageCode, normalizeLanguageCode } from '../locales/i18n';

export const getLanguageAiSeeds = (rawLang: LanguageCode | string): Track[] => {
  const lang = normalizeLanguageCode(rawLang);
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
        {
          id: 'aimix_seed_en_8',
          title: 'As It Was',
          artist: 'Harry Styles',
          album: 'AI Mix • Synthpop',
          duration_secs: 167,
          path_or_url: 'H5v3kku4y6Q',
          cover_art: 'https://i.ytimg.com/vi/H5v3kku4y6Q/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_en_9',
          title: 'Good Luck, Babe!',
          artist: 'Chappell Roan',
          album: 'AI Mix • Viral Alternative',
          duration_secs: 218,
          path_or_url: '1KI9XCGkzOM',
          cover_art: 'https://i.ytimg.com/vi/1KI9XCGkzOM/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_en_10',
          title: 'Stay',
          artist: 'The Kid LAROI & Justin Bieber',
          album: 'AI Mix • Pop Hit',
          duration_secs: 141,
          path_or_url: 'kTJczUoc56U',
          cover_art: 'https://i.ytimg.com/vi/kTJczUoc56U/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_en_11',
          title: 'Flowers',
          artist: 'Miley Cyrus',
          album: 'AI Mix • Disco Pop',
          duration_secs: 200,
          path_or_url: 'G7KNmW9a75Y',
          cover_art: 'https://i.ytimg.com/vi/G7KNmW9a75Y/hqdefault.jpg',
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
          album: 'AI Mix • V-Pop Hit',
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
          album: 'AI Mix • Bắt Tai',
          duration_secs: 202,
          path_or_url: '7ig2lXjozdw',
          cover_art: 'https://i.ytimg.com/vi/7ig2lXjozdw/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_vi_7',
          title: 'Cắt Đôi Nỗi Sầu',
          artist: 'Tăng Duy Tân',
          album: 'AI Mix • Vinahouse Pop',
          duration_secs: 195,
          path_or_url: 'GpmOn4RyzZI',
          cover_art: 'https://i.ytimg.com/vi/GpmOn4RyzZI/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_vi_8',
          title: 'Nơi Này Có Anh',
          artist: 'Sơn Tùng M-TP',
          album: 'AI Mix • Hit Quốc Dân',
          duration_secs: 279,
          path_or_url: 'FN7ALfpGxiI',
          cover_art: 'https://i.ytimg.com/vi/FN7ALfpGxiI/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_vi_9',
          title: 'Nấu Ăn Cho Em',
          artist: 'Đen Vâu (feat. PiaLinh)',
          album: 'AI Mix • Acoustic Rap',
          duration_secs: 260,
          path_or_url: 'ukHK1GVyr0I',
          cover_art: 'https://i.ytimg.com/vi/ukHK1GVyr0I/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_vi_10',
          title: 'Thanh Xuân',
          artist: 'Da LAB',
          album: 'AI Mix • Tuổi Trẻ',
          duration_secs: 228,
          path_or_url: 'GgQFO8dL5XQ',
          cover_art: 'https://i.ytimg.com/vi/GgQFO8dL5XQ/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_vi_11',
          title: 'Chịu Cách Mình Nói Thua',
          artist: 'Rhyder, CoolKid, BAN',
          album: 'AI Mix • Rap Việt',
          duration_secs: 205,
          path_or_url: '1J7wQf0z-1Y',
          cover_art: 'https://i.ytimg.com/vi/1J7wQf0z-1Y/hqdefault.jpg',
          source: 'youtube',
        },
      ];
      break;
  }
  return pool;
};

export const getLanguageAiPopupLabel = (rawLang: LanguageCode | string): string => {
  const lang = normalizeLanguageCode(rawLang);
  switch (lang) {
    case 'ko': return '✨ AI 믹스 • 당신을 위한 맞춤 추천';
    case 'ja': return '✨ AIミックス • あなたへのおすすめ';
    case 'zh-CN': return '✨ AI 混音 • 为你专属推荐';
    case 'en-US': return '✨ AI MIX • RECOMMENDED FOR YOU';
    case 'vi':
    default: return '✨ AI MIX • ĐỀ XUẤT CHO BẠN';
  }
};

export interface TimeBasedSmartDjConfig {
  period: 'morning' | 'afternoon' | 'evening' | 'late_night';
  timeLabel: string;
  moodDescription: string;
  recommendedTracks: Track[];
}

export const getTimeBasedSmartDjConfig = (rawLang: LanguageCode | string): TimeBasedSmartDjConfig => {
  const lang = normalizeLanguageCode(rawLang);
  const hour = new Date().getHours();
  let period: 'morning' | 'afternoon' | 'evening' | 'late_night' = 'evening';

  if (hour >= 5 && hour < 12) {
    period = 'morning';
  } else if (hour >= 12 && hour < 18) {
    period = 'afternoon';
  } else if (hour >= 18 && hour < 23) {
    period = 'evening';
  } else {
    period = 'late_night';
  }

  const pool = getLanguageAiSeeds(lang);
  let timeLabel = '';
  let moodDescription = '';

  switch (period) {
    case 'morning':
      timeLabel = lang === 'vi' ? 'Khởi đầu ngày mới' : lang === 'ja' ? '朝のエネルギー' : lang === 'ko' ? '상쾌한 아침' : lang === 'zh-CN' ? '晨间清爽' : 'Morning Kickstart';
      moodDescription = lang === 'vi' ? 'Giai điệu tươi vui, nạp năng lượng và cà phê sáng' : 'Fresh energy & uplifting morning rhythm';
      break;
    case 'afternoon':
      timeLabel = lang === 'vi' ? 'Tập trung buổi chiều' : lang === 'ja' ? '午後の集中' : lang === 'ko' ? '오후의 몰입' : lang === 'zh-CN' ? '午后专注' : 'Afternoon Focus';
      moodDescription = lang === 'vi' ? 'Tiết tấu thư thái, giúp làm việc và học tập hiệu quả' : 'Calm & deep flow for work and study';
      break;
    case 'evening':
      timeLabel = lang === 'vi' ? 'Thư giãn buổi tối' : lang === 'ja' ? '夕暮れのくつろぎ' : lang === 'ko' ? '저녁의 휴식' : lang === 'zh-CN' ? '晚间悠闲' : 'Evening Unwind';
      moodDescription = lang === 'vi' ? 'Âm hưởng hoàng hôn, xả stress sau một ngày dài' : 'Sunset vibes & relaxing melodic grooves';
      break;
    case 'late_night':
    default:
      timeLabel = lang === 'vi' ? 'Nhạc đêm khuya' : lang === 'ja' ? '深夜のドライブ' : lang === 'ko' ? '새벽 감성' : lang === 'zh-CN' ? '深夜心境' : 'Late Night Drive';
      moodDescription = lang === 'vi' ? 'Không gian tĩnh lặng, lo-fi & ambient cho tâm trạng lúc này' : 'Ambient, lo-fi & midnight dreamscapes';
      break;
  }

  // Shuffle or slice tailored for the period
  const seedSlice = period === 'late_night' 
    ? pool.slice(2, 8).concat(pool.slice(0, 2))
    : period === 'morning'
    ? pool.slice(0, 6)
    : pool.slice(1, 7);

  return {
    period,
    timeLabel,
    moodDescription,
    recommendedTracks: seedSlice,
  };
};

export interface AutoGenreMix {
  id: string;
  name: string;
  tag: string;
  sampleArtist?: string;
}

export const getAutoGeneratedGenresFromHistory = (lang: LanguageCode | string): AutoGenreMix[] => {
  const isVi = normalizeLanguageCode(lang) === 'vi';
  const mixes: AutoGenreMix[] = [];

  try {
    const rawArtists = typeof window !== 'undefined' ? localStorage.getItem('spytify_recent_artists') : null;
    let recentArtists: string[] = [];
    if (rawArtists) {
      const parsed = JSON.parse(rawArtists);
      if (Array.isArray(parsed)) {
        recentArtists = parsed.map(p => typeof p === 'string' ? p : p?.artist).filter(Boolean).slice(0, 8);
      }
    }

    if (recentArtists.length > 0) {
      recentArtists.slice(0, 4).forEach((artist, idx) => {
        mixes.push({
          id: 'auto_artist_' + idx,
          name: isVi ? `Mix cùng ${artist}` : `${artist} & Similar`,
          tag: isVi ? 'Gu yêu thích' : 'Top Taste',
          sampleArtist: artist,
        });
      });
    }
  } catch {}

  // Contextual genre clusters based on time
  const hour = new Date().getHours();
  if (hour >= 22 || hour < 6) {
    mixes.push({ id: 'time_night_1', name: isVi ? 'Lo-Fi Chill Đêm Khuya' : 'Midnight Lo-Fi & Beats', tag: isVi ? 'Đêm nay' : 'Tonight' });
    mixes.push({ id: 'time_night_2', name: isVi ? 'Indie / Dreampop Lắng Đọng' : 'Late Night Dreampop', tag: isVi ? 'Thư giãn' : 'Unwind' });
  } else if (hour >= 6 && hour < 13) {
    mixes.push({ id: 'time_morning_1', name: isVi ? 'Cà Phê Sáng Tích Cực' : 'Morning Acoustic & Coffee', tag: isVi ? 'Buổi sáng' : 'Morning' });
    mixes.push({ id: 'time_morning_2', name: isVi ? 'Pop Tươi Vui Năng Lượng' : 'Upbeat Pop Radiance', tag: isVi ? 'Năng lượng' : 'Energy' });
  } else {
    mixes.push({ id: 'time_day_1', name: isVi ? 'Deep Focus Làm Việc' : 'Deep Work & Concentration', tag: isVi ? 'Tập trung' : 'Focus' });
    mixes.push({ id: 'time_day_2', name: isVi ? 'Low Cortisol & Chill' : 'Low Cortisol Chillout', tag: isVi ? 'Bình yên' : 'Peaceful' });
  }

  // Common popular fallbacks
  mixes.push({ id: 'auto_vibe_1', name: isVi ? 'V-Pop & R&B Thịnh Hành' : 'Global Top Viral Hits', tag: isVi ? 'Thịnh hành' : 'Trending' });
  mixes.push({ id: 'auto_vibe_2', name: isVi ? 'K-Pop & J-Pop Selection' : 'Asian Wave & Pop Anthems', tag: isVi ? 'Nổi bật' : 'Featured' });

  return mixes.slice(0, 6);
};
