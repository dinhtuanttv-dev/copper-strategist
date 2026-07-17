// hooks/useChartData.js v5 — FINAL
// Flow: /api/ohlcv → s.priceChart prop → synthetic (luôn có dữ liệu)
import { useState, useEffect, useCallback, useRef } from 'react';

// ── Synthetic bars — chạy offline, không cần network ─────────────────────────
function buildSyntheticBars(currentPrice, tf = 'H4', count = 60) {
  const cp  = Math.max(currentPrice || 6.07, 0.01);
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
    const oc   = [price, price + (Math.random()-0.5)*vol*0.5];
    const high = Math.max(...oc) + Math.random()*vol*0.3;
    const low  = Math.min(...oc) - Math.random()*vol*0.3;
    bars.push({
      ts:    now - (count - i) * msPerBar,
      comex: +oc[1].toFixed(4),
      open:  +oc[0].toFixed(4),
      high:  +high.toFixed(4),
      low:   +Math.max(low, 0.01).toFixed(4),
      vol:   Math.floor(1000 + Math.random()*8000),
    });
    price = oc[1];
  }

  // Force last bar = exact current price
  if (bars.length) {
    const last  = bars[bars.length - 1];
    last.comex  = cp;
    last.high   = Math.max(last.high, cp);
    last.low    = Math.min(last.low, cp);
    last.ts     = now;
  }
  return bars;
}

// ── LocalStorage cache ────────────────────────────────────────────────────────
const LS_KEY = 'cu_ohlcv_v5';
const LS_TTL = 20 * 60 * 1000; // 20 phút

function lsLoad() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > LS_TTL) { localStorage.removeItem(LS_KEY); return {}; }
    return data || {};
  } catch { return {}; }
}

function lsSave(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useChartData(activeTF = 'H4', s = {}) {
  const safeS    = s || {};
  const cacheRef = useRef(lsLoad());

  // Init state từ cache hoặc synthetic ngay lập tức
  const getInitBars = () => {
    const cached = cacheRef.current[activeTF] || [];
    if (cached.length >= 3) return cached;
    return buildSyntheticBars(safeS.comex || 6.07, activeTF, 60);
  };

  const [bars,    setBars]    = useState(getInitBars);
  const [loading, setLoading] = useState(false);
  const [source,  setSource]  = useState('init');
  const lastFetch = useRef({});

  const fetchBars = useCallback(async (tf, force = false) => {
    const now  = Date.now();
    const last = lastFetch.current[tf] || 0;
    if (!force && now - last < 60_000) return; // debounce 60s

    const cached = cacheRef.current[tf] || [];
    if (!force && cached.length >= 5) {
      setBars(cached);
      setSource('cache');
      return;
    }

    setLoading(true);
    lastFetch.current[tf] = now;
    let result = null;

    // Tầng 1: /api/ohlcv (Next.js server proxy — không CORS)
    try {
      const resp = await fetch(
        `/api/ohlcv?tf=${tf}&symbol=HG%3DF`,
        { signal: AbortSignal.timeout(12000) }
      );
      if (resp.ok) {
        const json = await resp.json();
        if (Array.isArray(json?.bars) && json.bars.length >= 5) {
          result = json.bars;
          setSource('yahoo');
        }
      }
    } catch (e) {
      console.warn('[useChartData] /api/ohlcv:', e.message);
    }

    // Tầng 2: s.priceChart prop (daily data từ index.js)
    if (!result && safeS.priceChart?.length >= 3) {
      const cp = safeS.comex || 6.07;
      result = safeS.priceChart.map((b, i, arr) => ({
        ts:    Date.now() - (arr.length - i) * 86400000,
        comex: b.comex || cp,
        open:  b.comex || cp,
        high:  (b.comex || cp) * 1.003,
        low:   (b.comex || cp) * 0.997,
        vol:   b.vol || 1000,
      }));
      setSource('priceChart');
    }

    // Tầng 3: Stale cache
    if (!result && cached.length >= 3) {
      result = cached;
      setSource('stale-cache');
    }

    // Tầng 4: Synthetic — LUÔN có dữ liệu
    if (!result || result.length < 3) {
      result = buildSyntheticBars(safeS.comex || 6.07, tf, 60);
      setSource('synthetic');
    }

    // Update last candle = real-time price
    if (safeS.comex > 0 && result.length > 0) {
      const last2 = result[result.length - 1];
      result = [
        ...result.slice(0, -1),
        {
          ...last2,
          comex: safeS.comex,
          high:  Math.max(last2.high || 0, safeS.comex),
          low:   Math.min(last2.low  || 9999, safeS.comex),
          ts:    now,
        },
      ];
    }

    // Deduplicate & sort
    const clean = result
      .filter(b => b && b.comex > 0 && b.ts > 0)
      .sort((a, b) => a.ts - b.ts)
      .filter((v, i, a) => i === 0 || v.ts !== a[i-1].ts)
      .slice(-120);

    // Cache nếu không phải synthetic
    if (!source?.includes('synthetic')) {
      cacheRef.current = { ...cacheRef.current, [tf]: clean };
      lsSave(cacheRef.current);
    }

    setBars(clean);
    setLoading(false);
  }, [safeS.comex, safeS.priceChart]);

  // Auto-fetch khi TF đổi
  useEffect(() => {
    fetchBars(activeTF, false);
  }, [activeTF]);

  // Real-time tick update
  useEffect(() => {
    if (!safeS.comex || safeS.comex <= 0) return;
    setBars(prev => {
      if (!prev.length) return buildSyntheticBars(safeS.comex, activeTF, 60);
      const last = prev[prev.length - 1];
      return [
        ...prev.slice(0, -1),
        {
          ...last,
          comex: safeS.comex,
          high:  Math.max(last.high || 0, safeS.comex),
          low:   Math.min(last.low  || 9999, safeS.comex),
          ts:    Date.now(),
        },
      ];
    });
  }, [safeS.comex]);

  return {
    bars,
    loading,
    barCount: bars.length,
    source,
    refresh: (force = true) => fetchBars(activeTF, force),
  };
}