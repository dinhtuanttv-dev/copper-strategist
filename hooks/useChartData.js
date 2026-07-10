// ─── Data Controller: fetchMarketData → chart + all analysis engines ──────────
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ─── Fetch OHLCV từ Yahoo Finance (HG=F) ─────────────────────────────────────
async function fetchMarketData(tf) {
  const TF_MAP = {
    MN:  { interval:'1mo', range:'10y'  },
    W:   { interval:'1wk', range:'2y'   },
    D:   { interval:'1d',  range:'1y'   },
    H4:  { interval:'1h',  range:'60d'  },
    H1:  { interval:'1h',  range:'7d'   },
    M15: { interval:'15m', range:'5d'   },
  };
  const cfg = TF_MAP[tf] || TF_MAP.D;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/HG=F`
      + `?interval=${cfg.interval}&range=${cfg.range}`;
    const r   = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal:  AbortSignal.timeout(12000),
    });
    if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}`);
    const d   = await r.json();
    const res = d?.chart?.result?.[0];
    if (!res) throw new Error('No result');

    const timestamps = res.timestamp || [];
    const q          = res.indicators?.quote?.[0] || {};

    let bars = timestamps.map((ts, i) => ({
      ts:    ts * 1000,
      d:     new Date(ts * 1000).toLocaleDateString('vi-VN',
               { day:'2-digit', month:'2-digit' }),
      open:  q.open?.[i]  ? +q.open[i].toFixed(4)  : null,
      high:  q.high?.[i]  ? +q.high[i].toFixed(4)  : null,
      low:   q.low?.[i]   ? +q.low[i].toFixed(4)   : null,
      comex: q.close?.[i] ? +q.close[i].toFixed(4) : null,
      vol:   q.volume?.[i]|| 0,
    })).filter(b => b.comex && b.comex > 0);

    // H4: resample 1h → H4 (nhóm 4 nến)
    if (tf === 'H4') {
      const grouped = [];
      for (let i = 0; i < bars.length; i += 4) {
        const chunk = bars.slice(i, i + 4);
        if (!chunk.length) continue;
        grouped.push({
          ts:    chunk[0].ts,
          d:     chunk[0].d,
          open:  chunk[0].open,
          high:  Math.max(...chunk.map(b => b.high || b.comex)),
          low:   Math.min(...chunk.map(b => b.low  || b.comex)),
          comex: chunk[chunk.length - 1].comex,
          vol:   chunk.reduce((s, b) => s + (b.vol || 0), 0),
        });
      }
      bars = grouped;
    }

    return { bars, source:'yahoo', tf };
  } catch(e) {
    console.error(`fetchMarketData(${tf}):`, e.message);
    return { bars:[], source:'error', tf, error:e.message };
  }
}

// ─── Derived SMC data từ bars ─────────────────────────────────────────────────
function buildSMCData(bars, currentPrice, atr = 0.12) {
  if (!bars.length || !currentPrice) return null;
  const a = atr;
  return {
    obBear:  [currentPrice + a * 1.0, currentPrice + a * 1.8],  // [from, to]
    obBull:  [currentPrice - a * 2.0, currentPrice - a * 1.0],
    fvg:     [currentPrice + a * 0.3, currentPrice + a * 0.7],
    liq:      currentPrice - a * 2.5,
    bos:      currentPrice - a * 0.1,
  };
}

// ─── LS cache helpers ─────────────────────────────────────────────────────────
const LS_KEY      = 'cu_chart_data_v4';
const LS_EXPIRE   = 30 * 60 * 1000;

function lsLoad(tf) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${LS_KEY}_${tf}`);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (Date.now() - (p._ts || 0) > LS_EXPIRE) return null;
    return p.bars || null;
  } catch { return null; }
}

function lsSave(tf, bars) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${LS_KEY}_${tf}`,
      JSON.stringify({ bars, _ts: Date.now() }));
  } catch { /* quota */ }
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useChartData(activeTF, s) {
  const [bars, setBars]               = useState([]);
  const [loading, setLoading]         = useState(false);
  const [lastFetch, setLastFetch]     = useState(null);
  const [error, setError]             = useState(null);
  const fetchingRef                   = useRef(false);

  // ─── Fetch + cache ───────────────────────────────────────────────────────
  const refresh = useCallback(async (force = false) => {
    if (fetchingRef.current) return;
    // Cache check
    if (!force && lastFetch && Date.now() - lastFetch < 5 * 60 * 1000) return;

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    // Try localStorage cache first
    const cached = !force ? lsLoad(activeTF) : null;
    if (cached?.length >= 5) {
      setBars(cached);
      setLastFetch(Date.now());
      setLoading(false);
      fetchingRef.current = false;
      return;
    }

    const result = await fetchMarketData(activeTF);
    if (result.bars.length > 0) {
      setBars(result.bars);
      lsSave(activeTF, result.bars);
      setLastFetch(Date.now());
    } else {
      setError(result.error || 'Không lấy được dữ liệu');
    }

    setLoading(false);
    fetchingRef.current = false;
  }, [activeTF, lastFetch]);

  // ─── Auto-fetch khi TF thay đổi ──────────────────────────────────────────
  useEffect(() => {
    refresh();
  }, [activeTF]);

  // ─── Append realtime bar từ s.comex ──────────────────────────────────────
  useEffect(() => {
    if (!s?.comex || !bars.length) return;
    const now = Date.now();
    const bar = {
      ts:    now,
      d:     new Date(now).toLocaleDateString('vi-VN',
               { day:'2-digit', month:'2-digit' }),
      open:  s.comex,
      high:  s.prev_high || s.comex,
      low:   s.prev_low  || s.comex,
      comex: s.comex,
      vol:   s.session_vol || 100000,
    };
    setBars(prev => {
      if (!prev.length) return [bar];
      const last = prev[prev.length - 1];
      // Cùng ngày → update last candle
      if (last.d === bar.d) {
        const updated = {
          ...last,
          comex: bar.comex,
          high:  Math.max(last.high || 0, bar.comex),
          low:   Math.min(last.low  || Infinity, bar.comex),
          vol:   (last.vol || 0) + (bar.vol || 0),
        };
        const next = [...prev.slice(0, -1), updated];
        lsSave(activeTF, next);
        return next;
      }
      // Ngày mới → append
      const next = [...prev, bar].slice(-300);
      lsSave(activeTF, next);
      return next;
    });
  }, [s?.comex, activeTF]);

  // ─── Derived SMC data ────────────────────────────────────────────────────
  const smcData = useMemo(() =>
    buildSMCData(bars, s?.comex, s?.atr || 0.12),
    [bars, s?.comex, s?.atr]
  );

  return {
    bars,
    loading,
    error,
    lastFetch,
    smcData,
    refresh,
    barCount: bars.length,
  };
}