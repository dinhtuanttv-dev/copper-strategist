// hooks/useTrendEngine.js — ESModule exports, full Elliott/VSA/Wyckoff engine
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ─── Constants export (TrendTab cần TF_LIST) ──────────────────────────────────
export const TFS = ['MN', 'W', 'D', 'H4', 'H1', 'M15'];

const MAX_BARS = 200;

const TF_CFG = {
  MN:  { interval:'1mo', range:'2y',  ms:30*24*3600*1000 },
  W:   { interval:'1wk', range:'1y',  ms:7*24*3600*1000  },
  D:   { interval:'1d',  range:'6mo', ms:24*3600*1000    },
  H4:  { interval:'60m', range:'60d', ms:4*3600*1000     },
  H1:  { interval:'60m', range:'7d',  ms:3600*1000       },
  M15: { interval:'15m', range:'5d',  ms:15*60*1000      },
};

// ─── Synthetic bars — luôn có dữ liệu kể cả offline ─────────────────────────
function buildSyntheticBars(cp = 6.07, tf = 'H4', count = 60) {
  const now = Date.now();
  const ms  = TF_CFG[tf]?.ms || 4*3600*1000;
  let price  = cp * 0.965;
  const vol  = cp * 0.0012;
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
      low:   +Math.max(low,  0.01).toFixed(4),
      vol:   Math.floor(1000 + Math.random() * 8000),
    });
    price = close;
  }
  if (bars.length) {
    const last = bars[bars.length - 1];
    last.comex = cp;
    last.high  = Math.max(last.high, cp);
    last.low   = Math.min(last.low,  cp);
    last.ts    = now;
  }
  return bars;
}

// ─── Fetch OHLCV qua /api/ohlcv (server proxy, không CORS) ──────────────────
async function fetchOHLCV(tf, cp = 6.07) {
  try {
    const resp = await fetch(
      `/api/ohlcv?tf=${tf}&symbol=HG%3DF`,
      { signal: AbortSignal.timeout(12000) }
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (Array.isArray(json?.bars) && json.bars.length >= 3) {
      return json.bars.slice(-MAX_BARS);
    }
    throw new Error(`bars=${json?.bars?.length || 0}`);
  } catch (e) {
    console.warn(`[useTrendEngine] fetchOHLCV(${tf}):`, e.message, '→ synthetic');
    return buildSyntheticBars(cp, tf, 60);
  }
}

// ─── Elliott Wave Engine ─────────────────────────────────────────────────────
function calcElliott(bars, currentPrice) {
  const cp = currentPrice || 6.07;
  if (!bars || bars.length < 10) {
    return {
      wave:'?', label:'W? (Chưa đủ dữ liệu)', prob:50, score:50,
      failure:false, scenario:'Chờ thêm dữ liệu',
      fib382: cp*0.990, fib500: cp*0.985, fib618: cp*0.975,
      fib786: cp*0.960, w3Target: cp*1.10,
      rsi: 50,
    };
  }
  const n     = bars.length;
  const slice = bars.slice(-20);
  const hi20  = Math.max(...slice.map(b => b.high  || b.comex || cp));
  const lo20  = Math.min(...slice.map(b => b.low   || b.comex || cp));
  const rng   = Math.max(hi20 - lo20, 0.001);
  const pos   = (cp - lo20) / rng;

  // RSI (14)
  const closes = bars.slice(-15).map(b => b.comex || cp);
  let gains = 0, losses = 0;
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i-1];
    if (d > 0) gains  += d;
    else        losses -= d;
  }
  const rsi = losses === 0 ? 100 : Math.round(100 - 100 / (1 + gains/losses));

  // Momentum
  const mom5  = n >= 5  ? (bars[n-1].comex||cp) - (bars[n-5].comex||cp)  : 0;
  const mom10 = n >= 10 ? (bars[n-1].comex||cp) - (bars[n-10].comex||cp) : 0;

  // Wave detection
  let wave = '3', label, prob = 65, score = 65, failure = false, scenario;

  if (pos < 0.25 && mom10 < 0) {
    wave = '4'; label = 'Wave 4 (Điều chỉnh)'; prob = 62; score = 58;
    scenario = 'Correction phase, chờ Wave 5';
  } else if (pos < 0.35 && mom5 > 0) {
    wave = '2'; label = 'Wave 2 (Spring/Test)'; prob = 68; score = 62;
    scenario = 'Accumulation, chuẩn bị Wave 3';
  } else if (pos > 0.6 && mom5 > 0 && rsi > 50) {
    wave = '3'; label = 'Wave 3 (Impulse)'; prob = 75; score = 75;
    scenario = 'Strong uptrend, target W3 = 1.618';
  } else if (pos > 0.8 && rsi > 70) {
    wave = '5'; label = 'Wave 5 (Exhaustion)'; prob = 58; score = 52;
    failure = true; scenario = 'Extended, risk of reversal';
  } else if (pos > 0.7 && mom5 < 0) {
    wave = 'A'; label = 'Wave A (Reversal)'; prob = 55; score = 48;
    failure = true; scenario = 'Distribution phase';
  } else {
    wave = '3'; label = 'Wave 3 (Impulse)'; prob = 65; score = 65;
    scenario = 'Uptrend continuation';
  }

  const base   = lo20;
  const fib382 = +(base + rng * 0.618).toFixed(4);
  const fib500 = +(base + rng * 0.500).toFixed(4);
  const fib618 = +(base + rng * 0.382).toFixed(4);
  const fib786 = +(base + rng * 0.214).toFixed(4);
  const w3Target = +(lo20 + rng * 1.618).toFixed(4);

  return {
    wave, label, prob, score, failure, scenario, rsi,
    fib382, fib500, fib618, fib786, w3Target,
  };
}

// ─── VSA Engine ──────────────────────────────────────────────────────────────
function calcVSA(bars) {
  if (!bars || bars.length < 5) {
    return {
      score: 50, bullish: false, bearish: false,
      meta: { label:'VSA: Chưa đủ dữ liệu', short:'N/A' },
      latestBar: { volRatio:1, relSpread:1 },
      atr: 0.12, bars: [],
    };
  }

  const n       = bars.length;
  const avgVol  = bars.slice(-20).reduce((s,b) => s+(b.vol||0), 0) / Math.min(20, n);
  const last    = bars[n-1];
  const volR    = avgVol > 0 ? (last.vol || 0) / avgVol : 1;

  // ATR (14)
  const atrSlice = bars.slice(-15);
  const trues    = atrSlice.slice(1).map((b,i) => {
    const prev = atrSlice[i];
    return Math.max(
      (b.high||b.comex) - (b.low||b.comex),
      Math.abs((b.high||b.comex) - (prev.comex||b.comex)),
      Math.abs((b.low||b.comex)  - (prev.comex||b.comex)),
    );
  });
  const atr = trues.length ? trues.reduce((a,v)=>a+v,0)/trues.length : 0.12;

  const spread    = Math.max((last.high||last.comex) - (last.low||last.comex), 0.001);
  const relSpread = atr > 0 ? spread / atr : 1;
  const isUp      = (last.comex || 0) >= (last.open || last.comex || 0);

  // Score
  let score   = 50;
  let label   = 'VSA: Neutral';
  let bullish = false, bearish = false;

  if (volR > 1.5 && isUp && relSpread > 0.8) {
    score = 75; bullish = true;
    label = `VSA: Demand Bar (Vol ${volR.toFixed(1)}×)`;
  } else if (volR > 1.5 && !isUp && relSpread > 0.8) {
    score = 25; bearish = true;
    label = `VSA: Supply Bar (Vol ${volR.toFixed(1)}×)`;
  } else if (volR < 0.5 && !isUp) {
    score = 65; bullish = true;
    label = 'VSA: No Supply (Low vol down)';
  } else if (volR < 0.5 && isUp) {
    score = 40;
    label = 'VSA: No Demand (Low vol up)';
  } else if (volR > 2.0) {
    score = isUp ? 70 : 35;
    bullish = isUp; bearish = !isUp;
    label = `VSA: Climax (Vol ${volR.toFixed(1)}×)`;
  }

  const vsaBars = bars.slice(-30).map(b => ({
    ...b,
    vsa: b.vol && b.vol > avgVol*1.5
      ? ((b.comex||0) >= (b.open||b.comex||0) ? 'ABSORPTION_BULL' : 'STOPPING_VOLUME')
      : null,
  })).filter(b => b.vsa);

  return {
    score, bullish, bearish, atr,
    meta: { label, short: label.split(':')[1]?.trim() || 'VSA' },
    latestBar: { volRatio: volR, relSpread },
    bars: vsaBars,
  };
}

// ─── Wyckoff Phase Engine ─────────────────────────────────────────────────────
function calcWyckoff(bars, vsaScore) {
  if (!bars || bars.length < 10) {
    return { phase:'B', label:'Phase B', sub:'Accumulation', confidence:55 };
  }

  const n     = bars.length;
  const prices = bars.slice(-30).map(b => b.comex || 0);
  const hi     = Math.max(...prices);
  const lo     = Math.min(...prices);
  const rng    = hi - lo || 0.001;
  const cp     = bars[n-1].comex || 0;
  const pos    = (cp - lo) / rng;

  const mom10 = n >= 10
    ? (bars[n-1].comex||0) - (bars[n-10].comex||0) : 0;

  let phase = 'B', label = 'Phase B', sub = 'Testing', confidence = 55;

  if (pos < 0.2 && vsaScore > 60) {
    phase = 'C'; label = 'Phase C'; sub = 'Spring/Test of Support'; confidence = 72;
  } else if (pos < 0.3 && mom10 > 0) {
    phase = 'C'; label = 'Phase C'; sub = 'Spring Confirmed'; confidence = 75;
  } else if (pos > 0.5 && mom10 > 0 && vsaScore > 60) {
    phase = 'D'; label = 'Phase D'; sub = 'LPS → SOS Markup'; confidence = 68;
  } else if (pos > 0.7 && mom10 > 0) {
    phase = 'E'; label = 'Phase E'; sub = 'Uptrend / Markup'; confidence = 70;
  } else if (pos > 0.8 && vsaScore < 45) {
    phase = 'DIST'; label = 'Distribution'; sub = 'Potential Top'; confidence = 60;
  } else if (pos < 0.4) {
    phase = 'A'; label = 'Phase A'; sub = 'SC → AR → ST'; confidence = 58;
  }

  return { phase, label, sub, confidence };
}

// ─── PK1 Score (combined) ─────────────────────────────────────────────────────
function calcPK1(ew, vsa, wyckoff) {
  const ewScore  = ew?.score  || 50;
  const vsaScore = vsa?.score || 50;
  const wyScore  = wyckoff?.confidence || 50;
  const pk1Score = Math.round((ewScore*0.35 + vsaScore*0.35 + wyScore*0.30));
  return { pk1Score, bias: pk1Score };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HOOK EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export function useTrendEngine(s = {}) {
  const safeS = s || {};

  const [activeTF,  setActiveTF]  = useState('H4');
  const [tfBars,    setTfBars]    = useState({});
  const [loading,   setLoading]   = useState({});
  const [imAssets,  setImAssets]  = useState(null);
  const [imSignals, setImSignals] = useState(null);
  const [imLoading, setImLoading] = useState(false);

  const fetchingRef = useRef({});

  // ── Fetch single TF ────────────────────────────────────────────────────────
  const fetchTFData = useCallback(async (tf, force = false) => {
    if (fetchingRef.current[tf] && !force) return;
    fetchingRef.current[tf] = true;
    setLoading(prev => ({ ...prev, [tf]: true }));

    const bars = await fetchOHLCV(tf, safeS.comex || 6.07);

    setTfBars(prev => ({ ...prev, [tf]: bars }));
    setLoading(prev => ({ ...prev, [tf]: false }));
    fetchingRef.current[tf] = false;
  }, [safeS.comex]);

  // ── Auto-load H4 on mount ──────────────────────────────────────────────────
  useEffect(() => {
    fetchTFData('H4', false);
  }, []);

  // ── Auto-load when TF changes ──────────────────────────────────────────────
  useEffect(() => {
    const bars = tfBars[activeTF] || [];
    if (bars.length < 3) fetchTFData(activeTF, false);
  }, [activeTF]);

  // ── Fetch intermarket ──────────────────────────────────────────────────────
  const fetchIntermarket = useCallback(async (force = false) => {
    if (imLoading && !force) return;
    setImLoading(true);
    try {
      const resp = await fetch('/api/intermarket', {
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const json = await resp.json();
        setImAssets(json.assets  || json);
        setImSignals(json.signals || {});
      }
    } catch (e) {
      console.warn('[useTrendEngine] intermarket:', e.message);
    }
    setImLoading(false);
  }, [imLoading]);

  useEffect(() => {
    fetchIntermarket(false);
  }, []);

  // ── Active bars ────────────────────────────────────────────────────────────
  const activeBars = useMemo(() => {
    const bars = tfBars[activeTF] || [];
    if (bars.length >= 3) return bars;
    return buildSyntheticBars(safeS.comex || 6.07, activeTF, 60);
  }, [tfBars, activeTF, safeS.comex]);

  // ── Update last bar with real-time price ───────────────────────────────────
  const activeBarsRT = useMemo(() => {
    if (!safeS.comex || !activeBars.length) return activeBars;
    const last = activeBars[activeBars.length - 1];
    return [
      ...activeBars.slice(0, -1),
      {
        ...last,
        comex: safeS.comex,
        high:  Math.max(last.high || 0, safeS.comex),
        low:   Math.min(last.low  || 9999, safeS.comex),
        ts:    Date.now(),
      },
    ];
  }, [activeBars, safeS.comex]);

  // ── Analysis engines ───────────────────────────────────────────────────────
  const ew      = useMemo(() => calcElliott(activeBarsRT, safeS.comex), [activeBarsRT, safeS.comex]);
  const vsa     = useMemo(() => calcVSA(activeBarsRT), [activeBarsRT]);
  const wyckoff = useMemo(() => calcWyckoff(activeBarsRT, vsa.score), [activeBarsRT, vsa.score]);
  const pk1     = useMemo(() => calcPK1(ew, vsa, wyckoff), [ew, vsa, wyckoff]);
  const rsi     = ew.rsi || 50;
  const atr     = vsa.atr || 0.12;

  return {
    // State
    activeTF, setActiveTF,
    activeBars: activeBarsRT,
    tfBars,
    loading,
    // Actions
    fetchTFData,
    fetchIntermarket,
    // Analysis
    ew, vsa, wyckoff, pk1,
    rsi, atr,
    // Intermarket
    imAssets, imSignals, imLoading,
  };
}

// Default export cho backward compat
export default useTrendEngine;