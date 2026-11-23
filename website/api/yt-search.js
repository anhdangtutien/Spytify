// Vercel Serverless Function: High-speed YouTube search and unblocked video resolver
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const { searchParams } = new URL(req.url, 'http://localhost');
  const query = searchParams.get('q') || searchParams.get('query') || '';

  if (!query || query.trim().length === 0) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Query parameter q is required', items: [] }));
    return;
  }

  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim())}`;
    const ytRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept-Language': 'vi,en;q=0.9',
      },
    });

    const html = await ytRes.text();
    const rawJson =
      html.split('var ytInitialData = ')[1]?.split(';</script>')[0] ||
      html.split('ytInitialData = ')[1]?.split(';</script>')[0];

    const items = [];
    if (rawJson) {
      try {
        const data = JSON.parse(rawJson);
        const contents =
          data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]
            ?.itemSectionRenderer?.contents || [];

        for (const c of contents) {
          const r = c.videoRenderer;
          if (!r?.videoId) continue;
          const title = r.title?.runs?.[0]?.text || '';
          const author = r.ownerText?.runs?.[0]?.text || '';
          const durationStr = r.lengthText?.simpleText || '';
          let duration_secs = 200;
          if (durationStr) {
            const parts = durationStr.split(':').map(Number);
            if (parts.length === 2) duration_secs = parts[0] * 60 + parts[1];
            else if (parts.length === 3) duration_secs = parts[0] * 3600 + parts[1] * 60 + parts[2];
          }
          items.push({
            videoId: r.videoId,
            title,
            author,
            duration_secs,
            thumbnail: `https://i.ytimg.com/vi/${r.videoId}/hqdefault.jpg`,
          });
          if (items.length >= 20) break;
        }
      } catch {}
    }

    // Fallback regex if structured parsing was empty: only extract video blocks with genuine title
    if (items.length === 0) {
      const videoBlocks = [...html.matchAll(/"videoRenderer":\s*\{"videoId":"([A-Za-z0-9_-]{11})".*?"title":\{"runs":\[\{"text":"([^"]+)"\}\]/g)];
      for (const m of videoBlocks.slice(0, 15)) {
        items.push({
          videoId: m[1],
          title: m[2],
          author: 'YouTube',
          duration_secs: 210,
          thumbnail: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`,
        });
      }
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.end(JSON.stringify({ items }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: String(err), items: [] }));
  }
}
