// ─── Cache 5 phút ────────────────────────────────────────────────────────────
let cache = { data: null, ts: 0 };
const CACHE_MS = 5 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ─── Trả cache nếu còn mới ───────────────────────────────────────────────
  if (cache.data && Date.now() - cache.ts < CACHE_MS) {
    return res.status(200).json({ ...cache.data, cached: true });
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const today   = new Date().toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric'
    });

    // ─── Dùng Claude search lấy tin tức đồng ─────────────────────────────
    const claudeRes = await fetch(`${baseUrl}/api/claude`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:      'claude-sonnet-4-5',
        max_tokens: 1000,
        messages: [{
          role:    'user',
          content: `Search latest copper market news today ${today}.
Find 4 most important news items about: copper price, LME, COMEX, China demand, supply disruptions, trade war tariffs affecting copper.
Return ONLY this raw JSON array, no markdown:
[
  {
    "title": "<tin tức tiếng Việt ngắn gọn>",
    "source": "<tên nguồn>",
    "impact": "<high|medium|low>",
    "direction": "<bullish|bearish|neutral>",
    "summary": "<tóm tắt 1 câu tiếng Việt>",
    "ts": <unix timestamp ms>
  }
]`,
        }],
      }),
    });

    const claudeData = await claudeRes.json();
    const text = (claudeData.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // ─── Parse JSON array ─────────────────────────────────────────────────
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const news = JSON.parse(match[0]);
      if (Array.isArray(news) && news.length > 0) {
        const result = { news, updated_at: Date.now() };
        cache = { data: result, ts: Date.now() };
        return res.status(200).json(result);
      }
    }

    return res.status(500).json({
      error:    'Không parse được tin tức',
      raw_text: text.slice(0, 200),
    });

  } catch (e) {
    console.error('News API error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}