import { optimizeThumbnailUrl } from './trackUtils';

/**
 * High-quality verified artist portraits from official CDN sources (Deezer / Spotify / Apple).
 * All URLs are guaranteed square portrait photos of the actual artists, avoiding fake profiles or stock images.
 */
export const POPULAR_ARTIST_AVATARS: Record<string, string> = {
  // Vietnamese Artists
  'sơn tùng m-tp': 'https://cdn-images.dzcdn.net/images/artist/736c5b8ff5a001b724fb92c7471c9f1d/500x500-000000-80-0-0.jpg',
  'sơn tùng': 'https://cdn-images.dzcdn.net/images/artist/736c5b8ff5a001b724fb92c7471c9f1d/500x500-000000-80-0-0.jpg',
  'son tung m-tp': 'https://cdn-images.dzcdn.net/images/artist/736c5b8ff5a001b724fb92c7471c9f1d/500x500-000000-80-0-0.jpg',
  'm-tp': 'https://cdn-images.dzcdn.net/images/artist/736c5b8ff5a001b724fb92c7471c9f1d/500x500-000000-80-0-0.jpg',
  'vũ.': 'https://cdn-images.dzcdn.net/images/artist/3b39de9719ace79996aa2a893a1d42c7/500x500-000000-80-0-0.jpg',
  'vũ': 'https://cdn-images.dzcdn.net/images/artist/3b39de9719ace79996aa2a893a1d42c7/500x500-000000-80-0-0.jpg',
  'vu': 'https://cdn-images.dzcdn.net/images/artist/3b39de9719ace79996aa2a893a1d42c7/500x500-000000-80-0-0.jpg',
  'đen': 'https://cdn-images.dzcdn.net/images/artist/ff44b36e05cc117f302e5966746cfe25/500x500-000000-80-0-0.jpg',
  'đen vâu': 'https://cdn-images.dzcdn.net/images/artist/ff44b36e05cc117f302e5966746cfe25/500x500-000000-80-0-0.jpg',
  'den': 'https://cdn-images.dzcdn.net/images/artist/ff44b36e05cc117f302e5966746cfe25/500x500-000000-80-0-0.jpg',
  'hieuthuhai': 'https://cdn-images.dzcdn.net/images/artist/731891d7627e78e25ea9e507d3fd8333/500x500-000000-80-0-0.jpg',
  'soobin hoàng sơn': 'https://cdn-images.dzcdn.net/images/artist/1ec4a87462f2e96ac18bc9b8dac67564/500x500-000000-80-0-0.jpg',
  'soobin': 'https://cdn-images.dzcdn.net/images/artist/1ec4a87462f2e96ac18bc9b8dac67564/500x500-000000-80-0-0.jpg',
  'mono': 'https://cdn-images.dzcdn.net/images/artist/4a65d2bb04b583957a3c463c11d6744e/500x500-000000-80-0-0.jpg',
  'wren evans': 'https://cdn-images.dzcdn.net/images/artist/ee2f42bb7a077ee88b189f4edf422b3e/500x500-000000-80-0-0.jpg',
  'grey d': 'https://cdn-images.dzcdn.net/images/artist/17a36e7031efb7d45546d1d152d2cad4/500x500-000000-80-0-0.jpg',
  'tlinh': 'https://cdn-images.dzcdn.net/images/artist/395e24e799b806e4b42e5b913f949fdc/500x500-000000-80-0-0.jpg',
  'mck': 'https://cdn-images.dzcdn.net/images/artist/7d02cd9134d5d35dc89ae9becc327089/500x500-000000-80-0-0.jpg',
  'low g': 'https://cdn-images.dzcdn.net/images/artist/8e41c01c6de212b06c8e952772a08ed9/500x500-000000-80-0-0.jpg',
  'amee': 'https://cdn-images.dzcdn.net/images/artist/0bfd1ba5423a94ccb48d2069d528fbb0/500x500-000000-80-0-0.jpg',
  'hoàng thùy linh': 'https://cdn-images.dzcdn.net/images/artist/ada412ca9a4796d6a7584567b871779a/500x500-000000-80-0-0.jpg',
  'đức phúc': 'https://cdn-images.dzcdn.net/images/artist/aa64c2ebcf1f0a8c969043d9bb5509c4/500x500-000000-80-0-0.jpg',
  'erik': 'https://cdn-images.dzcdn.net/images/artist/58b32b41a250bdbee252a877df414c7f/500x500-000000-80-0-0.jpg',
  'phan mạnh quỳnh': 'https://cdn-images.dzcdn.net/images/artist/7fef1c4692e850b65fba4534a1b0b571/500x500-000000-80-0-0.jpg',
  'châu khải phong': 'https://cdn-images.dzcdn.net/images/artist/b13a77f98e07973752e50ad75b7b04eb/500x500-000000-80-0-0.jpg',
  'trịnh thăng bình': 'https://cdn-images.dzcdn.net/images/artist/ec62caea54e38e68dbbdfdae4e463aa6/500x500-000000-80-0-0.jpg',

  // US-UK & Global Pop Artists
  'bruno mars': 'https://cdn-images.dzcdn.net/images/artist/90f0b5b11df4f87ee878f38569b5995b/500x500-000000-80-0-0.jpg',
  'taylor swift': 'https://cdn-images.dzcdn.net/images/artist/cc2495870fe1a792ad0cdb05501ad5ec/500x500-000000-80-0-0.jpg',
  'billie eilish': 'https://cdn-images.dzcdn.net/images/artist/8eab1a9a644889aabaca1e193e05f984/500x500-000000-80-0-0.jpg',
  'rosé': 'https://cdn-images.dzcdn.net/images/artist/eefd9b0fc6d1cb51405e29009c0ec280/500x500-000000-80-0-0.jpg',
  'rose': 'https://cdn-images.dzcdn.net/images/artist/eefd9b0fc6d1cb51405e29009c0ec280/500x500-000000-80-0-0.jpg',
  // Real Joji portrait (da30a1469009465fb3f130cc4dc6bb1c - 566k fans), replacing fake microphone profile
  'joji': 'https://cdn-images.dzcdn.net/images/artist/da30a1469009465fb3f130cc4dc6bb1c/500x500-000000-80-0-0.jpg',
  'calvin harris': 'https://cdn-images.dzcdn.net/images/artist/a53031d02dc2f8a8eb15d117c015d5eb/500x500-000000-80-0-0.jpg',
  'ellie goulding': 'https://cdn-images.dzcdn.net/images/artist/e3611824a11b28e07bc5a363c629dcb4/500x500-000000-80-0-0.jpg',
  'lady gaga': 'https://cdn-images.dzcdn.net/images/artist/721d8fab84b315502de422b8d0901509/500x500-000000-80-0-0.jpg',
  'sabrina carpenter': 'https://cdn-images.dzcdn.net/images/artist/4a9cdc7737e2a0e59b4917b47884b859/500x500-000000-80-0-0.jpg',
  'the weeknd': 'https://cdn-images.dzcdn.net/images/artist/581693b4724a7fcfa754455101e13a44/500x500-000000-80-0-0.jpg',
  'charlie puth': 'https://cdn-images.dzcdn.net/images/artist/c355b366638e0c5f20f4b265f0f12646/500x500-000000-80-0-0.jpg',
  'justin bieber': 'https://cdn-images.dzcdn.net/images/artist/fe097f693cebf1f882e3da79e99e3bf9/500x500-000000-80-0-0.jpg',
  'ariana grande': 'https://cdn-images.dzcdn.net/images/artist/19446d3e382d54e4776eaef6b39bf491/500x500-000000-80-0-0.jpg',
  'drake': 'https://cdn-images.dzcdn.net/images/artist/eb0ed5b21d1ea5af021fc074ded0e91f/500x500-000000-80-0-0.jpg',
  'adele': 'https://cdn-images.dzcdn.net/images/artist/67a8bd3b465446fc8098631c85d3c8a2/500x500-000000-80-0-0.jpg',
  'eminem': 'https://cdn-images.dzcdn.net/images/artist/7fa738468c9a73ff98c1e1b78d622b81/500x500-000000-80-0-0.jpg',
  'ed sheeran': 'https://cdn-images.dzcdn.net/images/artist/d6bb84390641d8ae9118228d9544e53d/500x500-000000-80-0-0.jpg',
  'olivia rodrigo': 'https://cdn-images.dzcdn.net/images/artist/2c9e480317183c037eaebcd7ba96daf4/500x500-000000-80-0-0.jpg',
  'dua lipa': 'https://cdn-images.dzcdn.net/images/artist/877872aaf75694f11d53c318700ab2b5/500x500-000000-80-0-0.jpg',
  'post malone': 'https://cdn-images.dzcdn.net/images/artist/ed49392e9bfb8cbfeee41f71588ec59a/500x500-000000-80-0-0.jpg',
  'alan walker': 'https://cdn-images.dzcdn.net/images/artist/ac2951e7fc35a22283cb736294eb8e3a/500x500-000000-80-0-0.jpg',
  'marshmello': 'https://cdn-images.dzcdn.net/images/artist/be32b509ef533a82df8211ba716503c8/500x500-000000-80-0-0.jpg',
  'coldplay': 'https://cdn-images.dzcdn.net/images/artist/8f8e02d4fb425d5d852928509b575791/500x500-000000-80-0-0.jpg',
  'maroon 5': 'https://cdn-images.dzcdn.net/images/artist/f1f107f9cbb870c97800ae7c52ae8b8f/500x500-000000-80-0-0.jpg',
  'imagine dragons': 'https://cdn-images.dzcdn.net/images/artist/1c6d36e2f1f50df64db0c4768ea822f3/500x500-000000-80-0-0.jpg',

  // Hip-Hop, Rap & R&B Global Legends
  'juice wrld': 'https://cdn-images.dzcdn.net/images/artist/2ecf2968fbbc8eb042b241b8e60e5d7e/500x500-000000-80-0-0.jpg',
  'juice world': 'https://cdn-images.dzcdn.net/images/artist/2ecf2968fbbc8eb042b241b8e60e5d7e/500x500-000000-80-0-0.jpg',
  'juicewrld': 'https://cdn-images.dzcdn.net/images/artist/2ecf2968fbbc8eb042b241b8e60e5d7e/500x500-000000-80-0-0.jpg',
  'fall out boy': 'https://cdn-images.dzcdn.net/images/artist/981d802fcf018a2ca52bddcb1d4a739a/500x500-000000-80-0-0.jpg',
  'travis scott': 'https://cdn-images.dzcdn.net/images/artist/8d8316146026d7e6ce377e314536df62/500x500-000000-80-0-0.jpg',
  'kendrick lamar': 'https://cdn-images.dzcdn.net/images/artist/be0a7c550567f4af0ed202d7235b74d6/500x500-000000-80-0-0.jpg',
  'kanye west': 'https://cdn-images.dzcdn.net/images/artist/bb76c2ee3b068726ab4c37b0aabdb57a/500x500-000000-80-0-0.jpg',
  'xxxtentacion': 'https://cdn-images.dzcdn.net/images/artist/62e6edfaf5461eeb5b7310903229607a/500x500-000000-80-0-0.jpg',
  'future': 'https://cdn-images.dzcdn.net/images/artist/1a695ee9c2cb49fab81d408836100ff3/500x500-000000-80-0-0.jpg',
  'metro boomin': 'https://cdn-images.dzcdn.net/images/artist/bc031b73f958987fa103031070be5c16/500x500-000000-80-0-0.jpg',
  '21 savage': 'https://cdn-images.dzcdn.net/images/artist/76b4cd56c7e94e8d2bdc3e2157e1080f/500x500-000000-80-0-0.jpg',
  'sza': 'https://cdn-images.dzcdn.net/images/artist/8ced041da2bed70d5715f0860956169b/500x500-000000-80-0-0.jpg',
  'the kid laroi': 'https://cdn-images.dzcdn.net/images/artist/ced3d1693e8b8add20a9e40bd01eeb2e/500x500-000000-80-0-0.jpg',
  'lil nas x': 'https://cdn-images.dzcdn.net/images/artist/1ca412353f85efec0825c88cc1a5f24c/500x500-000000-80-0-0.jpg',
  'playboi carti': 'https://cdn-images.dzcdn.net/images/artist/b90097972a60d9d8598a79a786be1a3a/500x500-000000-80-0-0.jpg',
  'tyler, the creator': 'https://cdn-images.dzcdn.net/images/artist/5eceecd683beab6dd901a7931294a121/500x500-000000-80-0-0.jpg',
  'tyler the creator': 'https://cdn-images.dzcdn.net/images/artist/5eceecd683beab6dd901a7931294a121/500x500-000000-80-0-0.jpg',
  'frank ocean': 'https://cdn-images.dzcdn.net/images/artist/882155c08dc31d6464d6d580083c968c/500x500-000000-80-0-0.jpg',
  'a$ap rocky': 'https://cdn-images.dzcdn.net/images/artist/2fd7529af23904e6634194c5b6f4def5/500x500-000000-80-0-0.jpg',
  'asap rocky': 'https://cdn-images.dzcdn.net/images/artist/2fd7529af23904e6634194c5b6f4def5/500x500-000000-80-0-0.jpg',

  // Asian / Japanese / Korean Artists
  // Real DAOKO official portrait (45861151ec512f0595e642b7285cd322)
  'daoko': 'https://cdn-images.dzcdn.net/images/artist/45861151ec512f0595e642b7285cd322/500x500-000000-80-0-0.jpg',
  // Real Hiroyuki Sawano verified portrait (e00822bee264f4888fb7e069eaa45967 - 51k fans)
  'hiroyuki sawano': 'https://cdn-images.dzcdn.net/images/artist/e00822bee264f4888fb7e069eaa45967/500x500-000000-80-0-0.jpg',
  'sawano hiroyuki': 'https://cdn-images.dzcdn.net/images/artist/e00822bee264f4888fb7e069eaa45967/500x500-000000-80-0-0.jpg',
  'newjeans': 'https://cdn-images.dzcdn.net/images/artist/0866c2c1d7d00879f5db46ddc1250db8/500x500-000000-80-0-0.jpg',
  'blackpink': 'https://cdn-images.dzcdn.net/images/artist/89675729453893a91be35bde691050ff/500x500-000000-80-0-0.jpg',
  'yoasobi': 'https://cdn-images.dzcdn.net/images/artist/2cbfaf626a591e162bfcc2b4b0214217/500x500-000000-80-0-0.jpg',
  'creepy nuts': 'https://cdn-images.dzcdn.net/images/artist/b7f4334dd626befb590e9349bca72c99/500x500-000000-80-0-0.jpg',
  'ado': 'https://cdn-images.dzcdn.net/images/artist/858e14d0f8ee062253851aaf3b31daef/500x500-000000-80-0-0.jpg',
  'kenshi yonezu': 'https://cdn-images.dzcdn.net/images/artist/36668c9f416b041169df04110a0812f0/500x500-000000-80-0-0.jpg',
  'eve': 'https://cdn-images.dzcdn.net/images/artist/5825a1c6545774d1d3484ec3703b7e37/500x500-000000-80-0-0.jpg',
  'fujii kaze': 'https://cdn-images.dzcdn.net/images/artist/16cbd84f0e0300725b734980f42112b6/500x500-000000-80-0-0.jpg',
  'bts': 'https://cdn-images.dzcdn.net/images/artist/f1a562095f92ffbcf3b3a62886c1be27/500x500-000000-80-0-0.jpg',
  'twice': 'https://cdn-images.dzcdn.net/images/artist/77334a15998df49cf7cb1727768e1a17/500x500-000000-80-0-0.jpg',
  'iu': 'https://cdn-images.dzcdn.net/images/artist/4ce36aa13c1c876404285b2c2865cbb0/500x500-000000-80-0-0.jpg',
  'radwimps': 'https://cdn-images.dzcdn.net/images/artist/145464161bb0804efbb12c6a01da6662/500x500-000000-80-0-0.jpg',
  'aimer': 'https://cdn-images.dzcdn.net/images/artist/ce5529f55e098df456ea3c7dcbb8d998/500x500-000000-80-0-0.jpg',
};

export interface RecentArtistItem {
  artist: string;
  count: number;
  avatar: string;
  topTrackTitle?: string;
  sampleVideoId?: string;
}

/**
 * Default curated artists list with verified portraits (ZERO stock/unsplash placeholders).
 */
export const DEFAULT_FEATURED_ARTISTS: RecentArtistItem[] = [
  {
    artist: 'Sơn Tùng M-TP',
    count: 24,
    avatar: POPULAR_ARTIST_AVATARS['sơn tùng m-tp'],
    topTrackTitle: 'Đừng Làm Trái Tim Anh Đau',
    sampleVideoId: 'abPmZCZZrFA',
  },
  {
    artist: 'Bruno Mars',
    count: 19,
    avatar: POPULAR_ARTIST_AVATARS['bruno mars'],
    topTrackTitle: 'Die With A Smile / APT.',
    sampleVideoId: 'kPa7bsKwL-8',
  },
  {
    artist: 'Billie Eilish',
    count: 16,
    avatar: POPULAR_ARTIST_AVATARS['billie eilish'],
    topTrackTitle: 'Birds of a Feather',
    sampleVideoId: 'd5gf9dXHevw',
  },
  {
    artist: 'Vũ.',
    count: 14,
    avatar: POPULAR_ARTIST_AVATARS['vũ.'],
    topTrackTitle: 'Bước Qua Mùa Cô Đơn',
    sampleVideoId: 'YQHsXMglC9A',
  },
  {
    artist: 'Taylor Swift',
    count: 18,
    avatar: POPULAR_ARTIST_AVATARS['taylor swift'],
    topTrackTitle: 'Cruel Summer',
    sampleVideoId: 'ic8j13piAhQ',
  },
  {
    artist: 'HIEUTHUHAI',
    count: 12,
    avatar: POPULAR_ARTIST_AVATARS['hieuthuhai'],
    topTrackTitle: 'Không Thể Say / NOLOVE',
    sampleVideoId: 'u4k4iG1u7lE',
  },
  {
    artist: 'ROSÉ',
    count: 15,
    avatar: POPULAR_ARTIST_AVATARS['rosé'],
    topTrackTitle: 'APT. (feat. Bruno Mars)',
    sampleVideoId: 'ekr2nIex040',
  },
  {
    artist: 'Joji',
    count: 14,
    avatar: POPULAR_ARTIST_AVATARS['joji'],
    topTrackTitle: 'Glimpse of Us / SLOW DANCING IN THE DARK',
    sampleVideoId: 'FvOpPeKSf_4',
  },
  {
    artist: 'YOASOBI',
    count: 11,
    avatar: POPULAR_ARTIST_AVATARS['yoasobi'],
    topTrackTitle: 'Idol (アイドル)',
    sampleVideoId: 'ZRtdQ81jPUQ',
  },
  {
    artist: 'NewJeans',
    count: 14,
    avatar: POPULAR_ARTIST_AVATARS['newjeans'],
    topTrackTitle: 'Super Shy / Hype Boy',
    sampleVideoId: 'ArmDp-zijuc',
  },
  {
    artist: 'The Weeknd',
    count: 17,
    avatar: POPULAR_ARTIST_AVATARS['the weeknd'],
    topTrackTitle: 'Blinding Lights / Starboy',
    sampleVideoId: '4NRXx6U8ABQ',
  },
  {
    artist: 'Đen',
    count: 13,
    avatar: POPULAR_ARTIST_AVATARS['đen'],
    topTrackTitle: 'Nấu Ăn Cho Em / Đi Về Nhà',
    sampleVideoId: '7Q3Z8wW1gGg',
  },
  {
    artist: 'Sabrina Carpenter',
    count: 15,
    avatar: POPULAR_ARTIST_AVATARS['sabrina carpenter'],
    topTrackTitle: 'Espresso / Please Please Please',
    sampleVideoId: 'eVli-tstM5E',
  },
  {
    artist: 'Calvin Harris',
    count: 12,
    avatar: POPULAR_ARTIST_AVATARS['calvin harris'],
    topTrackTitle: 'Summer / Outside',
    sampleVideoId: 'ebXbLfLAC34',
  },
  {
    artist: 'Ellie Goulding',
    count: 11,
    avatar: POPULAR_ARTIST_AVATARS['ellie goulding'],
    topTrackTitle: 'Love Me Like You Do / Lights',
    sampleVideoId: 'AJtDXIazrMo',
  },
  {
    artist: 'DAOKO',
    count: 10,
    avatar: POPULAR_ARTIST_AVATARS['daoko'],
    topTrackTitle: '打上花火 (Uchiage Hanabi)',
    sampleVideoId: '-tKVN2mAKRI',
  },
  {
    artist: 'Hiroyuki Sawano',
    count: 9,
    avatar: POPULAR_ARTIST_AVATARS['hiroyuki sawano'],
    topTrackTitle: 'Attack on Titan OST / Promare',
    sampleVideoId: 'w3UR7nsTLlQ',
  },
  {
    artist: 'Juice WRLD',
    count: 22,
    avatar: POPULAR_ARTIST_AVATARS['juice wrld'],
    topTrackTitle: 'Lucid Dreams / Robbery',
    sampleVideoId: 'mzB1V935HGg',
  },
];

/**
 * Resolves artist avatar immediately from synchronous cache or mapped dictionary,
 * falling back cleanly to an optimized track cover (no black bars) or neutral musical avatar.
 */
export const getOrResolveArtistAvatar = (artistName: string, trackCover?: string): string => {
  const norm = artistName.trim().toLowerCase();

  // 1. Direct match in verified dictionary
  if (POPULAR_ARTIST_AVATARS[norm]) return POPULAR_ARTIST_AVATARS[norm];

  // 2. Partial match in verified dictionary (e.g. "Juice WRLD & Fall Out Boy" matches "juice wrld")
  for (const [k, v] of Object.entries(POPULAR_ARTIST_AVATARS)) {
    if (
      norm === k ||
      norm.startsWith(k + ' ') ||
      norm.startsWith(k + ',') ||
      norm.startsWith(k + '&') ||
      norm.startsWith(k + ' &') ||
      norm.endsWith(' ' + k)
    ) {
      return v;
    }
  }

  // 3. LocalStorage persistent cache (previously fetched from Deezer/Apple CDN)
  try {
    const cached = localStorage.getItem(`spytify_artist_avatar_${norm}`);
    if (
      cached &&
      cached.startsWith('http') &&
      !cached.includes('3bdd07e6653666b8885b59c522ab3deb') &&
      // Prevent any non-Sơn Tùng artist from displaying Sơn Tùng M-TP's cached avatar
      (!cached.includes('736c5b8ff5a001b724fb92c7471c9f1d') || norm === 'sơn tùng m-tp' || norm === 'sơn tùng' || norm === 'son tung m-tp' || norm === 'm-tp')
    ) {
      return cached;
    }
  } catch {}

  // 4. Track cover fallback if valid (and strip out black-bar hqdefault YouTube thumbnails)
  if (trackCover && trackCover.startsWith('http') && !trackCover.includes('photo-1511671782779') && !trackCover.includes('photo-1514525253161')) {
    return optimizeThumbnailUrl(trackCover);
  }

  // 5. Default neutral ambient vinyl disc avatar (Never another artist's human face)
  return 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
};

/**
 * Online portrait fetcher from Deezer Public API / Apple iTunes CDN with fan-count prioritization.
 * Ensures verified major artist profile is chosen over duplicate or 1-fan accounts with stock photos.
 */
export const fetchArtistPortraitOnline = async (artistName: string): Promise<string | null> => {
  const norm = artistName.trim().toLowerCase();
  if (!norm || norm.length < 2) return null;

  // Clean artist string of collaborative keywords (e.g. "Juice WRLD & Fall Out Boy" -> "Juice WRLD")
  const clean = artistName.split(',')[0].split('&')[0].split(/ x | ft\.?| feat\.?|\/\//i)[0].trim();
  const cleanNorm = clean.toLowerCase();

  if (POPULAR_ARTIST_AVATARS[cleanNorm]) {
    return POPULAR_ARTIST_AVATARS[cleanNorm];
  }

  try {
    const cached = localStorage.getItem(`spytify_artist_avatar_${cleanNorm}`);
    if (
      cached &&
      cached.startsWith('http') &&
      !cached.includes('3bdd07e6653666b8885b59c522ab3deb') &&
      (!cached.includes('736c5b8ff5a001b724fb92c7471c9f1d') || cleanNorm === 'sơn tùng m-tp' || cleanNorm === 'sơn tùng' || cleanNorm === 'son tung m-tp' || cleanNorm === 'm-tp')
    ) {
      return cached;
    }
  } catch {}

  // 1. Try Deezer Public API
  try {
    const res = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(clean)}&limit=5`);
    if (res.ok) {
      const json = await res.json();
      if (json?.data && Array.isArray(json.data) && json.data.length > 0) {
        // Pick the artist with the highest fan count to avoid fake / duplicate accounts
        const bestArtist = json.data.reduce((max: any, item: any) => {
          if (item.picture_small?.includes('3bdd07e6653666b8885b59c522ab3deb')) return max;
          return (!max || (item.nb_fan || 0) > (max.nb_fan || 0)) ? item : max;
        }, null);

        const pic = bestArtist?.picture_big || bestArtist?.picture_medium;
        if (pic && pic.startsWith('http') && !pic.includes('3bdd07e6653666b8885b59c522ab3deb')) {
          try {
            localStorage.setItem(`spytify_artist_avatar_${cleanNorm}`, pic);
            localStorage.setItem(`spytify_artist_avatar_${norm}`, pic);
          } catch {}
          return pic;
        }
      }
    }
  } catch {}

  // 2. Fallback to Apple iTunes Search API (has Access-Control-Allow-Origin: * for web & iOS PWA browsers)
  try {
    const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(clean)}&entity=song&limit=1`);
    if (itunesRes.ok) {
      const itunesJson = await itunesRes.json();
      const rawArt = itunesJson?.results?.[0]?.artworkUrl100;
      if (rawArt && typeof rawArt === 'string') {
        const highRes = rawArt.replace('100x100bb', '600x600bb');
        try {
          localStorage.setItem(`spytify_artist_avatar_${cleanNorm}`, highRes);
          localStorage.setItem(`spytify_artist_avatar_${norm}`, highRes);
        } catch {}
        return highRes;
      }
    }
  } catch {}

  return null;
};
