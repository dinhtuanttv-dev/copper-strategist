// pages/api/ohlcv.js — Yahoo Finance server-side proxy, không bị CORS
const CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const TF_MAP = {
  MN:  { interval:'1mo', range:'2y'  },
  W:   { interval:'1wk', range:'1y'  },
  D:   { interval:'1d',  range:'6mo' },
  H4:  { interval:'60m', range:'60d' },
  H1:  { interval:'60m', range:'7d'  },
  M15: { interval:'15m', range:'5d'  },
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error:'Method not allowed' });

  const { tf = 'H4', symbol = 'HG=F' } = req.query;
  const cfg      = TF_MAP[tf] || TF_MAP.H4;
  const cacheKey = `${symbol}_${tf}`;

  // Serve from cache
  const hit = CACHE.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return res.status(200).json({ bars:hit.bars, source:'cache', tf, count:hit.bars.length });
  }

  const encodedSym = encodeURIComponent(symbol);
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSym}?interval=${cfg.interval}&range=${cfg.range}&includePrePost=false`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodedSym}?interval=${cfg.interval}&range=${cfg.range}&includePrePost=false`,
  ];

  let lastErr = '';
  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept':     'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!resp.ok) { lastErr = `HTTP ${resp.status}`; continue; }

      const json   = await resp.json();
      const result = json?.chart?.result?.[0];
      if (!result) { lastErr = 'no result'; continue; }

      const timestamps = result.timestamp || [];
      const q          = result.indicators?.quote?.[0] || {};

      const bars = timestamps
        .map((ts, i) => ({
          ts:    ts * 1000,
          comex: +(q.close?.[i]  || 0).toFixed(4),
          open:  +(q.open?.[i]   || q.close?.[i] || 0).toFixed(4),
          high:  +(q.high?.[i]   || q.close?.[i] || 0).toFixed(4),
          low:   +(q.low?.[i]    || q.close?.[i] || 0).toFixed(4),
          vol:   Math.floor(q.volume?.[i] || 0),
        }))
        .filter(b => b.comex > 0 && b.ts > 0)
        .sort((a, b) => a.ts - b.ts);

      if (bars.length < 3) { lastErr = `only ${bars.length} bars`; continue; }

      CACHE.set(cacheKey, { bars, ts: Date.now() });
      return res.status(200).json({ bars, source:'yahoo', tf, symbol, count:bars.length });

    } catch (e) { lastErr = e.message; }
  }

  // Trả stale cache nếu có
  const stale = CACHE.get(cacheKey);
  if (stale?.bars?.length > 0) {
    return res.status(200).json({ bars:stale.bars, source:'stale-cache', tf, error:lastErr });
  }

  return res.status(503).json({ bars:[], error:lastErr, tf, source:'error' });
}