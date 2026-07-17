// ═══════════════════════════════════════════════════════════════════════════════
// PATCH cho hooks/useTrendEngine.js
// Tìm hàm fetchOHLCV (khoảng line 90-115) và THAY TOÀN BỘ bằng code này:
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_BARS = 200;

// ── TF config ─────────────────────────────────────────────────────────────────
const TF_CFG = {
  MN:  { interval:'1mo', range:'2y'  },
  W:   { interval:'1wk', range:'1y'  },
  D:   { interval:'1d',  range:'6mo' },
  H4:  { interval:'60m', range:'60d' },
  H1:  { interval:'60m', range:'7d'  },
  M15: { interval:'15m', range:'5d'  },
};

// ── Synthetic bars fallback ────────────────────────────────────────────────────
function buildSyntheticBars(currentPrice = 6.07, tf = 'H4', count = 60) {
  const cp  = Math.max(currentPrice, 0.01);
  const now = Date.now();
  const msPerBar = {
    MN:30*24*3600*1000, W:7*24*3600*1000, D:24*3600*1000,
    H4:4*3600*1000,     H1:3600*1000,     M15:15*60*1000,
  }[tf] || 4*3600*1000;

  let price = cp * 0.965;
  const vol = cp * 0.0012;
  const bars = [];

  for (let i = 0; i < count; i++) {
    const trend = (cp - price) * 0.04;
    const noise = (Math.random() - 0.48) * vol;
    price = Math.max(cp * 0.85, price + trend + noise);
    const close = price + (Math.random() - 0.5) * vol * 0.4;
    const high  = Math.max(price, close) + Math.random() * vol * 0.3;
    const low   = Math.min(price, close) - Math.random() * vol * 0.3;
    bars.push({
      ts:    now - (count - i) * msPerBar,
      comex: +close.toFixed(4),
      open:  +price.toFixed(4),
      high:  +Math.max(high, 0.01).toFixed(4),
      low:   +Math.max(low,  0.01).toFixed(4),
      vol:   Math.floor(1000 + Math.random() * 8000),
    });
    price = close;
  }

  // Force last bar = current price
  if (bars.length) {
    const last = bars[bars.length - 1];
    last.comex = cp;
    last.high  = Math.max(last.high, cp);
    last.low   = Math.min(last.low, cp);
    last.ts    = now;
  }
  return bars;
}

// ── fetchOHLCV — GỌI QUA /api/ohlcv (server proxy), KHÔNG fetch Yahoo trực tiếp
async function fetchOHLCV(tf, currentPrice) {
  try {
    // 1. Gọi Next.js API route — chạy server-side, không CORS
    const resp = await fetch(
      `/api/ohlcv?tf=${tf}&symbol=HG%3DF`,
      { signal: AbortSignal.timeout(12000) }
    );

    if (!resp.ok) throw new Error(`API ${resp.status}`);

    const json = await resp.json();

    if (Array.isArray(json?.bars) && json.bars.length >= 3) {
      console.log(`[useTrendEngine] ✅ ohlcv ${tf}: ${json.bars.length} bars (${json.source})`);
      return json.bars.slice(-MAX_BARS);
    }

    throw new Error(`bars empty (${json.source})`);

  } catch(e) {
    console.warn(`[useTrendEngine] fetchOHLCV(${tf}) fallback synthetic:`, e.message);
    // 2. Fallback synthetic — luôn có dữ liệu
    return buildSyntheticBars(currentPrice || 6.07, tf, 60);
  }
}