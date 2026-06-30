// ─── Cache trong memory ───────────────────────────────────────────────────────
let cache = { data: null, ts: 0 };
const CACHE_MS = 60 * 1000; // cache 60 giây

// ─── Validate giá hợp lý (copper thường 3.5–8.0 USD/lb) ────────────────────────
const isValidPrice = p => typeof p === 'number' && p > 3.0 && p < 9.0;

// ─── LỚP 1: Stooq CSV (không cần key, số liệu trực tiếp) ──────────────────────
async function fetchFromStooq() {
  const res = await fetch('https://stooq.com/q/l/?s=hg.f&f=sd2t2ohlcv&h&e=csv');
  if (!res.ok) throw new Error(`Stooq HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('Stooq: không có dữ liệu');

  const headers = lines[0].split(',');
  const values  = lines[1].split(',');
  const row = {};
  headers.forEach((h, i) => { row[h.trim()] = values[i]; });

  const close = parseFloat(row.Close);
  const open  = parseFloat(row.Open);
  const high  = parseFloat(row.High);
  const low   = parseFloat(row.Low);

  if (!isValidPrice(close)) throw new Error(`Stooq: giá ngoài range (${close})`);

  const chgPct = open > 0 ? +((close - open) / open * 100).toFixed(2) : 0;

  return {
    source:        'stooq',
    comex:         +close.toFixed(4),
    comex_chg_pct: chgPct,
    prev_high:     +high.toFixed(4),
    prev_low:      +low.toFixed(4),
    updated_at:    Date.now(),
  };
}

// ─── LỚP 2: Yahoo Finance chart API (không cần key, JSON có cấu trúc) ─────────
async function fetchFromYahoo() {
  const res = await fetch(
    'https://query1.finance.yahoo.com/v8/finance/chart/HG=F?interval=1d&range=5d',
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  );
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  const data = await res.json();

  const result = data?.chart?.result?.[0];
  if (!result) throw new Error('Yahoo: không có result');

  const meta  = result.meta;
  const close = meta.regularMarketPrice;
  const prevClose = meta.previousClose ?? meta.chartPreviousClose;

  if (!isValidPrice(close)) throw new Error(`Yahoo: giá ngoài range (${close})`);

  const chgPct = prevClose > 0 ? +((close - prevClose) / prevClose * 100).toFixed(2) : 0;

  // Lấy high/low từ candle gần nhất
  const quote = result.indicators?.quote?.[0];
  const highs = quote?.high?.filter(v => v != null) || [];
  const lows  = quote?.low?.filter(v => v != null)  || [];

  return {
    source:        'yahoo',
    comex:         +close.toFixed(4),
    comex_chg_pct: chgPct,
    prev_high:     highs.length ? +Math.max(...highs).toFixed(4) : +(close*1.01).toFixed(4),
    prev_low:      lows.length  ? +Math.min(...lows).toFixed(4)  : +(close*0.99).toFixed(4),
    updated_at:    Date.now(),
  };
}

// ─── LỚP 3: Claude web search (fallback cuối, có validate) ────────────────────
async function fetchFromClaude(baseUrl) {
  const claudeRes = await fetch(`${baseUrl}/api/claude`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:      'claude-sonnet-4-5',
      max_tokens: 500,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role:    'user',
        content: `Search COMEX copper HG futures CURRENT price right now in USD per pound from investing.com, marketwatch.com, or cmegroup.com. The price must be a decimal between 3.5 and 8.0 (e.g. 4.65, not 465 or 0.465).
Return ONLY this raw JSON, no markdown, no explanation:
{"comex":<price as USD/lb float between 3.5-8.0>,"comex_chg_pct":<daily change % float>,"prev_high":<float>,"prev_low":<float>,"source_name":"<which website you found this on>"}`,
      }],
    }),
  });

  const claudeData = await claudeRes.json();
  const text = (claudeData.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) throw new Error('Claude: không parse được JSON');

  const parsed = JSON.parse(match[0]);
  if (!isValidPrice(parsed.comex)) {
    throw new Error(`Claude: giá ngoài range hợp lệ (${parsed.comex}) — từ chối dùng`);
  }

  return {
    source:        'claude_search',
    source_name:   parsed.source_name || 'unknown',
    comex:         +parsed.comex.toFixed(4),
    comex_chg_pct: +(parsed.comex_chg_pct || 0).toFixed(2),
    prev_high:     parsed.prev_high || +(parsed.comex * 1.008).toFixed(4),
    prev_low:      parsed.prev_low  || +(parsed.comex * 0.992).toFixed(4),
    updated_at:    Date.now(),
  };
}

// ─── Handler chính ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ─── Trả cache nếu còn mới ───────────────────────────────────────────────
  if (cache.data && Date.now() - cache.ts < CACHE_MS) {
    return res.status(200).json({ ...cache.data, cached: true });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
    `http://localhost:${process.env.PORT || 3000}`;

  const errors = [];

  // ─── Thử Lớp 1: Stooq ───────────────────────────────────────────────────
  try {
    const result = await fetchFromStooq();
    cache = { data: result, ts: Date.now() };
    return res.status(200).json(result);
  } catch (e) {
    errors.push(`Stooq: ${e.message}`);
  }

  // ─── Thử Lớp 2: Yahoo Finance ─────────────────────────────────────────────
  try {
    const result = await fetchFromYahoo();
    cache = { data: result, ts: Date.now() };
    return res.status(200).json(result);
  } catch (e) {
    errors.push(`Yahoo: ${e.message}`);
  }

  // ─── Thử Lớp 3: Claude search (fallback cuối) ────────────────────────────
  try {
    const result = await fetchFromClaude(baseUrl);
    cache = { data: result, ts: Date.now() };
    return res.status(200).json(result);
  } catch (e) {
    errors.push(`Claude: ${e.message}`);
  }

  // ─── Tất cả đều fail ──────────────────────────────────────────────────────
  return res.status(503).json({
    error:  'Không lấy được giá từ bất kỳ nguồn nào',
    detail: errors,
  });
}