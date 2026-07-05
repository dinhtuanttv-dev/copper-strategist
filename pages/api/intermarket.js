// ─── Data flow: Yahoo Finance batch → cache 5m → JSON giá thật ───────────────

let cache = { data: null, ts: 0 };
const CACHE_MS = 5 * 60 * 1000;

// ─── Symbol map → Yahoo Finance tickers ──────────────────────────────────────
const SYMBOLS = {
  DXY:  'DX-Y.NYB',
  SPX:  '^GSPC',
  XAU:  'GC=F',
  XAG:  'SI=F',
  PLAT: 'PL=F',
  OIL:  'CL=F',
  VIX:  '^VIX',
};

// ─── Fetch 1 symbol từ Yahoo Finance ─────────────────────────────────────────
async function fetchYahoo(symbol, yahooTicker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}`
      + `?interval=1d&range=30d`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d    = await r.json();
    const meta = d?.chart?.result?.[0]?.meta;
    if (!meta) throw new Error('No meta');

    const closes = d?.chart?.result?.[0]?.indicators?.quote?.[0]?.closes
      || d?.chart?.result?.[0]?.indicators?.quote?.[0]?.close
      || [];
    const prevClose = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice;
    const price     = meta.regularMarketPrice;
    const chg       = prevClose > 0
      ? +((price - prevClose) / prevClose * 100).toFixed(2)
      : 0;

    // Rolling 20-day closes cho correlation
    const history = closes.filter(v => v != null).slice(-20);

    return { symbol, price: +price.toFixed(3), chg, history, ok: true };
  } catch(e) {
    return { symbol, price: null, chg: 0, history: [], ok: false, err: e.message };
  }
}

// ─── Claude fallback cho symbols Yahoo fail ───────────────────────────────────
async function fetchViaClaude(symbols, baseUrl) {
  try {
    const r = await fetch(`${baseUrl}/api/claude`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5', max_tokens: 500,
        messages: [{ role: 'user', content:
          `Search current prices: ${symbols.join(', ')}.
           Return ONLY raw JSON: {${symbols.map(s=>`"${s}":<float>`).join(',')}}` }],
      }),
    });
    const d    = await r.json();
    const text = (d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
    const m    = text.match(/\{[\s\S]*?\}/);
    return m ? JSON.parse(m[0]) : {};
  } catch { return {}; }
}

// ─── Pearson correlation ──────────────────────────────────────────────────────
function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 5) return 0;
  const ax = xs.slice(-n).reduce((a,v)=>a+v,0)/n;
  const ay = ys.slice(-n).reduce((a,v)=>a+v,0)/n;
  let num=0, dx=0, dy=0;
  for (let i=0; i<n; i++) {
    const ex = xs[xs.length-n+i]-ax;
    const ey = ys[ys.length-n+i]-ay;
    num += ex*ey; dx += ex*ex; dy += ey*ey;
  }
  const denom = Math.sqrt(dx*dy);
  return denom>0 ? +(num/denom).toFixed(2) : 0;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET')
    return res.status(405).json({ error: 'Method not allowed' });

  const force = req.query.force === '1';
  if (!force && cache.data && Date.now()-cache.ts < CACHE_MS)
    return res.status(200).json({ ...cache.data, cached: true });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  // ─── Fetch tất cả song song ───────────────────────────────────────────────
  const results = await Promise.all(
    Object.entries(SYMBOLS).map(([sym, ticker]) => fetchYahoo(sym, ticker))
  );

  // ─── Claude fallback cho symbols fail ────────────────────────────────────
  const failed = results.filter(r => !r.ok).map(r => r.symbol);
  let fallback = {};
  if (failed.length > 0) {
    fallback = await fetchViaClaude(failed, baseUrl);
  }

  // ─── Build assets map ────────────────────────────────────────────────────
  const assets = {};
  for (const r of results) {
    assets[r.symbol] = {
      price:   r.ok ? r.price : (fallback[r.symbol] || null),
      chg:     r.chg,
      history: r.history,
      source:  r.ok ? 'yahoo' : (fallback[r.symbol] ? 'claude' : 'unavailable'),
    };
  }

  // ─── Cần Cu history để tính correlation ──────────────────────────────────
  // Dùng GC=F (gold) history làm proxy nếu không có Cu riêng
  // Cu history sẽ được pass vào từ client khi gọi correlation
  const cuProxy = assets.XAU?.history || [];

  // ─── Tính rolling correlation Cu vs mỗi asset ────────────────────────────
  const correlations = {};
  for (const [sym, data] of Object.entries(assets)) {
    if (data.history.length >= 5 && cuProxy.length >= 5) {
      correlations[sym] = pearson(cuProxy, data.history);
    } else {
      // Fallback: known static correlations
      correlations[sym] = {DXY:-0.75,SPX:0.62,XAU:0.45,XAG:0.78,PLAT:0.55,OIL:0.40,VIX:-0.55}[sym]||0;
    }
  }

  // ─── Signal logic ────────────────────────────────────────────────────────
  function getSignal(sym, corr, chg) {
    const aligned = (corr > 0 && chg > 0) || (corr < 0 && chg < 0);
    if (Math.abs(corr) >= 0.70 && aligned) return { sig:'HỖ TRỢ MẠNH',  col:'#22c55e' };
    if (Math.abs(corr) >= 0.50 && aligned) return { sig:'HỖ TRỢ TĂNG',  col:'#22c55e' };
    if (Math.abs(corr) >= 0.70 && !aligned) return { sig:'CẢN TRỞ MẠNH', col:'#ef4444' };
    if (Math.abs(corr) >= 0.50 && !aligned) return { sig:'CẢN TRỞ NHẸ',  col:'#f59e0b' };
    return { sig:'TRUNG TÍNH', col:'#f59e0b' };
  }

  // ─── Final response ───────────────────────────────────────────────────────
  const response = {
    assets,
    correlations,
    signals: Object.fromEntries(
      Object.entries(assets).map(([sym, d]) => [
        sym,
        getSignal(sym, correlations[sym]||0, d.chg||0),
      ])
    ),
    updated_at: Date.now(),
  };

  cache = { data: response, ts: Date.now() };
  return res.status(200).json(response);
}