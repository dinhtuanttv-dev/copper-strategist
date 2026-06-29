// ─── Cache trong memory ───────────────────────────────────────────────────────
let cache = { data: null, ts: 0 };
const CACHE_MS = 60 * 1000; // cache 60 giây

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ─── Trả cache nếu còn mới ───────────────────────────────────────────────
  if (cache.data && Date.now() - cache.ts < CACHE_MS) {
    return res.status(200).json({ ...cache.data, cached: true });
  }

  // ─── Dùng Claude web search lấy giá ─────────────────────────────────────
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const claudeRes = await fetch(`${baseUrl}/api/claude`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role:    'user',
          content: `Search COMEX copper HG futures price today in USD per pound from investing.com or barchart.com or marketwatch.com.
Return ONLY this raw JSON, no markdown, no explanation:
{"comex":<price as USD/lb float>,"comex_chg_pct":<daily change % float>,"prev_high":<float>,"prev_low":<float>,"lme":<LME price USD/MT int>}`,
        }],
      }),
    });

    const claudeData = await claudeRes.json();

    // ─── Parse JSON từ response ─────────────────────────────────────────
    const text = (claudeData.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    const match = text.match(/\{[\s\S]*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);

      if (parsed.comex && parsed.comex > 1 && parsed.comex < 20) {
        const result = {
          source:        'claude_search',
          comex:         +parsed.comex.toFixed(4),
          comex_chg_pct: +( parsed.comex_chg_pct || 0).toFixed(2),
          prev_high:     parsed.prev_high || +(parsed.comex * 1.008).toFixed(4),
          prev_low:      parsed.prev_low  || +(parsed.comex * 0.992).toFixed(4),
          lme:           parsed.lme       || null,
          updated_at:    Date.now(),
        };

        cache = { data: result, ts: Date.now() };
        return res.status(200).json(result);
      }
    }

    // ─── Trả raw text nếu không parse được ─────────────────────────────
    return res.status(500).json({
      error:    'Không parse được giá',
      raw_text: text.slice(0, 300),
    });

  } catch (e) {
    console.error('Price API error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}