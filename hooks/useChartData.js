// hooks/useChartData.js — ESModule export, 4-tầng fallback
import { useState, useEffect, useCallback, useRef } from 'react';

// ── Synthetic bars ────────────────────────────────────────────────────────────
function buildSyntheticBars(cp = 6.07, tf = 'H4', count = 60) {
  const now = Date.now();
  const ms  = { MN:30*24*3600*1000, W:7*24*3600*1000, D:24*3600*1000,
    H4:4*3600*1000, H1:3600*1000, M15:15*60*1000 }[tf] || 4*3600*1000;
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
      ts:    now - (count - i) * ms,
      comex: +close.toFixed(4),
      open:  +price.toFixed(4),
      high:  +Math.max(high, 0.01).toFixed(4),
      low:   +Math.max(low, 0.01).toFixed(4),
      vol:   Math.floor(1000 + Math.random() * 8000),
    });
    price = close;
  }
  if (bars.length) {
    const last = bars[bars.length - 1];
    last.comex = cp; last.high = Math.max(last.high, cp);
    last.low = Math.min(last.low, cp); last.ts = now;
  }
  return bars;
}

// ── LocalStorage cache ────────────────────────────────────────────────────────
const LS_KEY = 'cu_ohlcv_v5';
const LS_TTL = 20 * 60 * 1000;

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

  const getInit = () => {
    const c = cacheRef.current[activeTF] || [];
    return c.length >= 3 ? c : buildSyntheticBars(safeS.comex || 6.07, activeTF, 60);
  };

  const [bars,    setBars]    = useState(getInit);
  const [loading, setLoading] = useState(false);
  const [source,  setSource]  = useState('init');
  const lastFetch = useRef({});

  const fetchBars = useCallback(async (tf, force = false) => {
    const now  = Date.now();
    const last = lastFetch.current[tf] || 0;
    if (!force && now - last < 60_000) return;

    const cached = cacheRef.current[tf] || [];
    if (!force && cached.length >= 5) {
      setBars(cached); setSource('cache'); return;
    }

    setLoading(true);
    lastFetch.current[tf] = now;
    let result = null;

    // Tầng 1: /api/ohlcv proxy
    try {
      const resp = await fetch(`/api/ohlcv?tf=${tf}&symbol=HG%3DF`,
        { signal: AbortSignal.timeout(12000) });
      if (resp.ok) {
        const json = await resp.json();
        if (json?.bars?.length >= 3) { result = json.bars; setSource('yahoo'); }
      }
    } catch(e) { console.warn('[useChartData] ohlcv:', e.message); }

    // Tầng 2: priceChart prop
    if (!result && safeS.priceChart?.length >= 3) {
      result = safeS.priceChart.map(b => ({
        ts: Date.now(), comex: b.comex||safeS.comex||6.07,
        open:b.comex||6.07, high:(b.comex||6.07)*1.003,
        low:(b.comex||6.07)*0.997, vol:1000,
      }));
      setSource('priceChart');
    }

    // Tầng 3: stale cache
    if (!result && cached.length >= 3) { result = cached; setSource('stale'); }

    // Tầng 4: synthetic — LUÔN có dữ liệu
    if (!result || result.length < 3) {
      result = buildSyntheticBars(safeS.comex || 6.07, tf, 60);
      setSource('synthetic');
    }

    // Update RT price
    if (safeS.comex > 0 && result.length > 0) {
      const last2 = result[result.length - 1];
      result = [...result.slice(0,-1), {
        ...last2, comex:safeS.comex,
        high:Math.max(last2.high||0, safeS.comex),
        low:Math.min(last2.low||9999, safeS.comex), ts:now,
      }];
    }

    const clean = result
      .filter(b => b?.comex > 0 && b?.ts > 0)
      .sort((a,b) => a.ts - b.ts)
      .filter((v,i,a) => i===0 || v.ts !== a[i-1].ts)
      .slice(-120);

    cacheRef.current = { ...cacheRef.current, [tf]: clean };
    if (!source?.includes('synthetic')) lsSave(cacheRef.current);

    setBars(clean);
    setLoading(false);
  }, [safeS.comex, safeS.priceChart]);

  useEffect(() => { fetchBars(activeTF, false); }, [activeTF]);

  // RT price tick
  useEffect(() => {
    if (!safeS.comex || safeS.comex <= 0) return;
    setBars(prev => {
      if (!prev.length) return buildSyntheticBars(safeS.comex, activeTF, 60);
      const last = prev[prev.length - 1];
      return [...prev.slice(0,-1), {
        ...last, comex:safeS.comex,
        high:Math.max(last.high||0, safeS.comex),
        low:Math.min(last.low||9999, safeS.comex), ts:Date.now(),
      }];
    });
  }, [safeS.comex]);

  return {
    bars, loading, barCount: bars.length, source,
    refresh: (force=true) => fetchBars(activeTF, force),
  };
}

export default useChartData;