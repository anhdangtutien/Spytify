// Vercel Serverless Function: High-performance YouTube Music audio stream resolver & proxy
// Supports both direct URL metadata and HTTP 206 Partial Content byte proxying for iOS/Android background play

let cachedVisitorData = '';
let cachedVisitorAt = 0;

async function getVisitorData(query = 'Sơn Tùng M-TP') {
  const now = Date.now();
  if (cachedVisitorData && now - cachedVisitorAt < 10 * 60 * 1000) {
    return cachedVisitorData;
  }
  const cleanQ = (query && query.trim().length >= 2) ? query.trim() : 'Sơn Tùng M-TP';
  try {
    const res = await fetch('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://music.youtube.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20240717.01.00',
            hl: 'vi',
            gl: 'VN',
          },
        },
        query: cleanQ,
        params: 'EgWKAQIIAWoKEAkQBRAKEAMQBA==',
      }),
    });
    const json = await res.json();
    const visitor = json?.responseContext?.visitorData;
    if (visitor) {
      cachedVisitorData = visitor;
      cachedVisitorAt = now;
      return visitor;
    }
  } catch {}
  return cachedVisitorData || '';
}

async function resolveAudioStream(videoId, visitorData) {
  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
        'X-Youtube-Client-Name': '101',
        'X-Youtube-Client-Version': '1.02',
        'Origin': 'https://www.youtube.com',
        ...(visitorData ? { 'X-Goog-Visitor-Id': visitorData } : {}),
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'VISIONOS',
            clientVersion: '1.02',
            deviceMake: 'Apple',
            deviceModel: 'RealityDevice17,1',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
            osName: 'visionOS',
            osVersion: '26.5.23O471',
            hl: 'en',
            timeZone: 'UTC',
            utcOffsetMinutes: 0,
            ...(visitorData ? { visitorData } : {}),
          },
        },
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
      }),
    });

    const json = await res.json();
    if (json?.playabilityStatus?.status !== 'OK') {
      return {
        error: true,
        status: json?.playabilityStatus?.status,
        reason: json?.playabilityStatus?.reason,
      };
    }

    const adaptiveFormats = json?.streamingData?.adaptiveFormats || [];
    const audioFormats = adaptiveFormats
      .filter(f => (f.mimeType || '').startsWith('audio/'))
      .sort((a, b) => {
        // Priority to itag 140 (audio/mp4 AAC)
        const a140 = a.itag === 140 ? 1 : 0;
        const b140 = b.itag === 140 ? 1 : 0;
        if (a140 !== b140) return b140 - a140;
        return (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0);
      });

    const best = audioFormats[0];
    if (!best || !best.url) return null;

    return {
      url: best.url,
      mimeType: best.mimeType || 'audio/mp4',
      duration_secs: Number(json?.videoDetails?.lengthSeconds) || 200,
      title: json?.videoDetails?.title || '',
      author: json?.videoDetails?.author || '',
    };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  // Set Universal CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const { searchParams } = new URL(req.url, 'http://localhost');
  const videoId = searchParams.get('videoId') || searchParams.get('id');
  const title = searchParams.get('title') || '';
  const artist = searchParams.get('artist') || '';
  const isProxy = searchParams.get('proxy') === '1';

  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Valid 11-char YouTube videoId required' }));
    return;
  }

  const visitor = await getVisitorData(`${title} ${artist}`.trim() || 'Sơn Tùng M-TP');
  const streamInfo = await resolveAudioStream(videoId, visitor);

  if (!streamInfo || streamInfo.error || !streamInfo.url) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ 
      error: 'Audio stream could not be resolved',
      debug: {
        hasVisitor: Boolean(visitor),
        status: streamInfo?.status || 'none',
        reason: streamInfo?.reason || 'none',
      }
    }));
    return;
  }

  // Proxy mode: stream audio directly to the browser with Range header support
  if (isProxy) {
    try {
      const clientRange = req.headers['range'] || req.headers['Range'] || '';
      const upstreamHeaders = clientRange ? { Range: clientRange } : {};
      const upstream = await fetch(streamInfo.url, { headers: upstreamHeaders });

      res.statusCode = upstream.status;
      res.setHeader('Content-Type', streamInfo.mimeType || 'audio/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      const contentRange = upstream.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);
      const contentLength = upstream.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      if (upstream.body) {
        const reader = upstream.body.getReader();
        const pump = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        };
        await pump();
        return;
      }

      const buf = Buffer.from(await upstream.arrayBuffer());
      res.end(buf);
      return;
    } catch (proxyErr) {
      // If direct proxy fails, fallback to redirect
      res.writeHead(302, { Location: streamInfo.url });
      res.end();
      return;
    }
  }

  // JSON metadata mode: return stream info and convenient proxy URL
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=1800');
  res.end(
    JSON.stringify({
      stream_url: streamInfo.url,
      proxy_url: `/api/yt-stream?proxy=1&videoId=${videoId}`,
      duration_secs: streamInfo.duration_secs,
      resolved_video_id: videoId,
      title: streamInfo.title,
      artist: streamInfo.author,
    })
  );
}
