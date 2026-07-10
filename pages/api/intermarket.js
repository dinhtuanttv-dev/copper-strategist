// ─── Data flow: Yahoo Finance batch → 9 assets → cache 5m → JSON ─────────────

let cache = { data:null, ts:0 };
const CACHE_MS = 5 * 60 * 1000;

// ─── 9 symbols (thêm CN50 + SHFE) ────────────────────────────────────────────
const SYMBOLS = {
  DXY:  { ticker:'DX-Y.NYB',  name:'DXY (USD Index)',     region:'US',  corrDefault:-0.75 },
  SPX:  { ticker:'^GSPC',     name:'S&P 500',             region:'US',  corrDefault:+0.62 },
  XAU:  { ticker:'GC=F',      name:'Vàng XAU',            region:'US',  corrDefault:+0.45 },
  XAG:  { ticker:'SI=F',      name:'Bạc XAG',             region:'US',  corrDefault:+0.78 },
  PLAT: { ticker:'PL=F',      name:'Bạch Kim PLAT',       region:'US',  corrDefault:+0.55 },
  OIL:  { ticker:'CL=F',      name:'Dầu WTI',             region:'US',  corrDefault:+0.40 },
  VIX:  { ticker:'^VIX',      name:'VIX (Fear Index)',     region:'US',  corrDefault:-0.55 },
  CN50: { ticker:'000001.SS', name:'Shanghai Composite',  region:'CN',  corrDefault:+0.71 },
  SHFE: { ticker:null,        name:'SHFE Copper (TQ)',     region:'CN',  corrDefault:+0.95 },
};

// ─── Fetch Yahoo Finance single symbol ───────────────────────────────────────
async function fetchYahoo(sym, cfg) {
  if (!cfg.ticker) return { sym, price:null, chg:0, history:[], ok:false, err:'no_ticker' };
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${cfg.ticker}`
      + `?interval=1d&range=30d`;
    const r = await fetch(url, {
      headers:{ 'User-Agent':'Mozilla/5.0' },
      signal: AbortSignal.timeout(7000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d    = await r.json();
    const res  = d?.chart?.result?.[0];
    if (!res)  throw new Error('no result');

    const meta      = res.meta;
    const price     = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose || price;
    const chg       = prevClose>0 ? +((price-prevClose)/prevClose*100).toFixed(2) : 0;
    const closes    = res.indicators?.quote?.[0]?.close?.filter(v=>v!=null) || [];

    return { sym, price:+price.toFixed(3), chg, history:closes.slice(-20), ok:true };
  } catch(e) {
    return { sym, price:null, chg:0, history:[], ok:false, err:e.message };
  }
}

// ─── Claude fallback ─────────────────────────────────────────────────────────
async function fetchViaClaude(items, baseUrl) {
  if (!items.length) return {};
  try {
    const r = await fetch(`${baseUrl}/api/claude`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model:'claude-sonnet-4-5', max_tokens:600,
        messages:[{ role:'user', content:
          `Search current prices for: ${items.map(i=>`${i.sym} (${i.cfg.name})`).join(', ')}.
           For SHFE Copper search "SHFE copper price CNY per MT" from shfe.com.cn or Reuters.
           Return ONLY raw JSON: {${items.map(i=>`"${i.sym}":{"price":<float>,"chg":<float>}`).join(',')}}` }],
      }),
    });
    const d    = await r.json();
    const text = (d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
    const m    = text.match(/\{[\s\S]*?\}/);
    return m ? JSON.parse(m[0]) : {};
  } catch { return {}; }
}

// ─── Pearson rolling correlation ─────────────────────────────────────────────
function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 5) return 0;
  const ax = xs.slice(-n).reduce((a,v)=>a+v,0)/n;
  const ay = ys.slice(-n).reduce((a,v)=>a+v,0)/n;
  let num=0, dx=0, dy=0;
  for (let i=0;i<n;i++) {
    const ex=xs[xs.length-n+i]-ax, ey=ys[ys.length-n+i]-ay;
    num+=ex*ey; dx+=ex*ex; dy+=ey*ey;
  }
  const denom=Math.sqrt(dx*dy);
  return denom>0 ? +(num/denom).toFixed(2) : 0;
}

// ─── Signal logic ─────────────────────────────────────────────────────────────
function getSignal(corr, chg) {
  const aligned = (corr>0&&chg>0)||(corr<0&&chg<0);
  const abs     = Math.abs(corr);
  if (abs>=0.70&&aligned)  return { sig:'HỖ TRỢ MẠNH',  col:'#22c55e' };
  if (abs>=0.50&&aligned)  return { sig:'HỖ TRỢ TĂNG',  col:'#22c55e' };
  if (abs>=0.70&&!aligned) return { sig:'CẢN TRỞ MẠNH', col:'#ef4444' };
  if (abs>=0.50&&!aligned) return { sig:'CẢN TRỞ NHẸ',  col:'#f59e0b' };
  return { sig:'TRUNG TÍNH', col:'#f59e0b' };
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET')
    return res.status(405).json({ error:'Method not allowed' });

  const force = req.query.force === '1';
  if (!force && cache.data && Date.now()-cache.ts < CACHE_MS)
    return res.status(200).json({ ...cache.data, cached:true });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  // ─── Fetch tất cả song song ───────────────────────────────────────────────
  const yResults = await Promise.all(
    Object.entries(SYMBOLS).map(([sym,cfg]) => fetchYahoo(sym,cfg))
  );

  // ─── Claude fallback cho failed + no-ticker ───────────────────────────────
  const needClaude = yResults
    .filter(r => !r.ok)
    .map(r => ({ sym:r.sym, cfg:SYMBOLS[r.sym] }));

  const claudeData = needClaude.length>0
    ? await fetchViaClaude(needClaude, baseUrl)
    : {};

  // ─── Build assets map ─────────────────────────────────────────────────────
  const assets = {};
  for (const r of yResults) {
    const cfg  = SYMBOLS[r.sym];
    const fall = claudeData[r.sym];
    assets[r.sym] = {
      name:    cfg.name,
      region:  cfg.region,
      price:   r.ok ? r.price : (fall?.price||null),
      chg:     r.ok ? r.chg   : (fall?.chg||0),
      history: r.history,
      source:  r.ok ? 'yahoo' : (fall?.price?'claude':'unavailable'),
      corrDefault: cfg.corrDefault,
    };
  }

  // ─── Tính correlation dùng XAU làm Cu proxy ──────────────────────────────
  const cuProxy = assets.XAU?.history || [];
  const correlations = {};
  for (const [sym, data] of Object.entries(assets)) {
    correlations[sym] = data.history.length>=5 && cuProxy.length>=5
      ? pearson(cuProxy, data.history)
      : data.corrDefault;
  }

  // ─── Build signals ────────────────────────────────────────────────────────
  const signals = {};
  for (const [sym, data] of Object.entries(assets)) {
    signals[sym] = {
      ...getSignal(correlations[sym]||0, data.chg||0),
      corr: correlations[sym]||data.corrDefault,
      chg:  data.chg||0,
    };
  }

  const result = { assets, correlations, signals, updated_at:Date.now() };
  cache = { data:result, ts:Date.now() };
  return res.status(200).json(result);
}