// ─── TF-aware engine: OHLCV fetch + resample + Elliott/VSA/Wyckoff ────────────
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { resampleOHLCV } from '../lib/calculations';

// ─── TF config ────────────────────────────────────────────────────────────────
export const TF_CONFIG = {
  MN:  { rsiPeriod:14, atrPeriod:14, waveSens:0.030, volPeriod:20,
         yahooInterval:'1mo', yahooRange:'10y', label:'Monthly'  },
  W:   { rsiPeriod:14, atrPeriod:14, waveSens:0.025, volPeriod:20,
         yahooInterval:'1wk', yahooRange:'2y',  label:'Weekly'   },
  D:   { rsiPeriod:14, atrPeriod:14, waveSens:0.020, volPeriod:20,
         yahooInterval:'1d',  yahooRange:'1y',  label:'Daily'    },
  H4:  { rsiPeriod:14, atrPeriod:14, waveSens:0.015, volPeriod:20,
         yahooInterval:'1h',  yahooRange:'60d', label:'H4',  resample:4 },
  H1:  { rsiPeriod:10, atrPeriod:10, waveSens:0.010, volPeriod:14,
         yahooInterval:'1h',  yahooRange:'7d',  label:'H1'       },
  M15: { rsiPeriod:7,  atrPeriod:7,  waveSens:0.006, volPeriod:10,
         yahooInterval:'15m', yahooRange:'5d',  label:'M15'      },
};

export const TFS       = ['MN','W','D','H4','H1','M15'];
const MAX_BARS         = 300;
const LS_KEY           = 'cu_tf_ohlcv_v3';
const LS_EXPIRE_MS     = 30 * 60 * 1000; // 30 phút

// ─── Load / Save localStorage ─────────────────────────────────────────────────
function lsLoad() {
  if (typeof window==='undefined') return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Expire check
    if (parsed._ts && Date.now()-parsed._ts > LS_EXPIRE_MS) {
      localStorage.removeItem(LS_KEY);
      return {};
    }
    return parsed;
  } catch { return {}; }
}

function lsSave(data) {
  if (typeof window==='undefined') return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ...data, _ts:Date.now() }));
  } catch { /* quota */ }
}

// ─── Fetch OHLCV từ Yahoo Finance ─────────────────────────────────────────────
async function fetchOHLCV(tf) {
  const cfg = TF_CONFIG[tf];
  if (!cfg) return [];
  try {
    const interval = cfg.yahooInterval;
    const range    = cfg.yahooRange;
    const url      = `https://query1.finance.yahoo.com/v8/finance/chart/HG=F`
      + `?interval=${interval}&range=${range}`;
    const r = await fetch(url, {
      headers:{ 'User-Agent':'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d     = await r.json();
    const res   = d?.chart?.result?.[0];
    if (!res)   throw new Error('no result');

    const ts     = res.timestamps || res.timestamp || [];
    const quote  = res.indicators?.quote?.[0] || {};
    const opens  = quote.open   || [];
    const highs  = quote.high   || [];
    const lows   = quote.low    || [];
    const closes = quote.close  || [];
    const vols   = quote.volume || [];

    let bars = ts.map((t,i) => ({
      ts:    t*1000,
      d:     new Date(t*1000).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'}),
      comex: closes[i] ? +closes[i].toFixed(4) : null,
      open:  opens[i]  ? +opens[i].toFixed(4)  : null,
      high:  highs[i]  ? +highs[i].toFixed(4)  : null,
      low:   lows[i]   ? +lows[i].toFixed(4)   : null,
      vol:   vols[i]   || 0,
    })).filter(b => b.comex && b.comex > 0);

    // H4: resample từ 1h → H4 (nhóm 4 nến 1h)
    if (tf==='H4' && cfg.resample) {
      const grouped = [];
      for (let i=0; i<bars.length; i+=cfg.resample) {
        const chunk = bars.slice(i, i+cfg.resample);
        if (!chunk.length) continue;
        grouped.push({
          ts:    chunk[0].ts,
          d:     chunk[0].d,
          comex: chunk[chunk.length-1].comex,
          open:  chunk[0].open,
          high:  Math.max(...chunk.map(b=>b.high||b.comex)),
          low:   Math.min(...chunk.map(b=>b.low||b.comex)),
          vol:   chunk.reduce((s,b)=>s+(b.vol||0),0),
        });
      }
      bars = grouped;
    }

    // MN/W: resample từ daily nếu TF cần
    if (['MN','W'].includes(tf) && interval==='1d') {
      bars = resampleOHLCV(bars, tf);
    }

    return bars.slice(-MAX_BARS);
  } catch(e) {
    console.error(`fetchOHLCV(${tf}) error:`, e.message);
    return [];
  }
}

// ─── ATR(n) ───────────────────────────────────────────────────────────────────
function calcATR(bars, n=14) {
  if (bars.length<2) return 0.12;
  const trs = bars.slice(1).map((b,i) => {
    const prev = bars[i];
    return Math.max(
      (b.high||b.comex)-(b.low||b.comex*0.99),
      Math.abs((b.high||b.comex)-(prev.comex||0)),
      Math.abs((b.low||b.comex*0.99)-(prev.comex||0)),
    );
  });
  const s = trs.slice(-n);
  return s.length ? +(s.reduce((a,v)=>a+v,0)/s.length).toFixed(4) : 0.12;
}

// ─── RSI(n) ───────────────────────────────────────────────────────────────────
function calcRSI(bars, n=14) {
  if (bars.length<n+1) return 50;
  const closes  = bars.map(b=>b.comex||0);
  const changes = closes.slice(1).map((c,i)=>c-closes[i]);
  const slice   = changes.slice(-n);
  const gains   = slice.filter(c=>c>0).reduce((a,v)=>a+v,0)/n;
  const losses  = Math.abs(slice.filter(c=>c<0).reduce((a,v)=>a+v,0))/n;
  if (!losses) return 100;
  return +(100-100/(1+gains/losses)).toFixed(1);
}

// ─── Vol SMA ──────────────────────────────────────────────────────────────────
function volSMA(bars, n=20) {
  const v = bars.map(b=>b.vol||100000).slice(-n);
  return v.reduce((a,x)=>a+x,0)/v.length;
}

// ─── Elliott Wave với TF params + Rule Validation ─────────────────────────────
function calcElliottTF(bars, tf) {
  const cfg  = TF_CONFIG[tf]||TF_CONFIG.H4;
  const MIN  = Math.max(8, Math.round(1/cfg.waveSens));
  if (bars.length < MIN) return {
    wave:'?', label:'⏳ Chưa đủ dữ liệu', scenario:`Cần ≥${MIN} bars cho ${tf}`,
    failure:false, score:50, prob:50,
    fib382:0, fib500:0, fib618:0, fib786:0,
    w3Target:0, w5Target:0, pos:0.5,
  };

  const closes = bars.map(b=>b.comex||0);
  const n      = closes.length;
  const lookback = Math.min(n, Math.round(50/cfg.waveSens*cfg.waveSens*20+20));
  const slice  = closes.slice(-lookback);
  const hi     = Math.max(...slice);
  const lo     = Math.min(...slice);
  const rng    = hi-lo || 0.01;
  const last   = closes[n-1];
  const pos    = (last-lo)/rng;

  const f382 = +(hi-rng*0.382).toFixed(3);
  const f500 = +(hi-rng*0.500).toFixed(3);
  const f618 = +(hi-rng*0.618).toFixed(3);
  const f786 = +(hi-rng*0.786).toFixed(3);

  const atr  = calcATR(bars, cfg.atrPeriod);
  const rsi  = calcRSI(bars, cfg.rsiPeriod);
  const mom5 = n>=5 ? closes[n-1]-closes[n-5] : 0;

  let wave='1', label='🌱 Sóng 1', scenario='', failure=false, score=55, prob=55;

  if (last < f786) {
    wave='F'; label='❌ Wave Failure';
    failure=true; score=10; prob=85;
    scenario=`Phá Fib 0.786 ($${f786}) — cấu trúc vô hiệu.`;
  } else if (pos>0.85 && mom5>atr*0.3 && !failure) {
    wave='3'; label='⚡ Sóng 3 Extension';
    score=85; prob=78;
    scenario=`Extension mạnh W3. Target = $${(lo+rng*1.618).toFixed(3)}`;
  } else if (pos>0.65 && mom5>0 && rsi<80) {
    wave='5'; label='🏁 Sóng 5 Final';
    score=58; prob=60;
    scenario='Leg cuối. RSI divergence là tín hiệu đảo chiều.';
  } else if (pos<0.45 && mom5<0 && last>f618) {
    wave='4'; label='🔄 Sóng 4 Correction';
    score=62; prob=65;
    scenario=`Điều chỉnh. Giữ trên Fib 0.618 = $${f618}.`;
    if (last < lo+rng*0.1) { failure=true; wave='F'; score=10; label='❌ W4 vi phạm W1'; }
  } else if (pos<0.35 && last<f618 && last>f786) {
    wave='2'; label='🔁 Sóng 2 Pullback';
    score=45; prob=55;
    scenario='Pullback tìm hỗ trợ. Theo dõi VSA Spring/No Supply.';
    if (last<lo) { failure=true; wave='F'; score=10; label='❌ W2>100% W1'; }
  }

  const w3Target = +(lo+rng*1.618).toFixed(3);
  const w5Target = +(lo+rng*2.000).toFixed(3);

  return { wave, label, scenario, failure, score, prob,
    fib382:f382, fib500:f500, fib618:f618, fib786:f786,
    w3Target, w5Target, pos:+pos.toFixed(3), atr, rsi };
}

// ─── VSA Engine với TF params ─────────────────────────────────────────────────
function calcVSATF(bars, tf) {
  const cfg = TF_CONFIG[tf]||TF_CONFIG.H4;
  if (bars.length<4) return {
    bars:[], meta:{label:'⏳ Chưa đủ dữ liệu',short:'N/A',desc:'',type:'neutral'},
    bullish:false, bearish:false, score:50,
    latestBar:{volRatio:1,up:true,vsa:'NEUTRAL',spread:0,relSpread:0},
    atr:0.12, volAvg:100000,
  };

  const atr    = calcATR(bars, cfg.atrPeriod);
  const vAvg   = volSMA(bars, cfg.volPeriod);

  const analyzed = bars.map((b,i) => {
    if (!i) return {...b,spread:0,relSpread:0,volRatio:1,vsa:'NEUTRAL',up:true};
    const close  = b.comex||0;
    const prev   = bars[i-1];
    const hi     = b.high||close*1.005;
    const lo     = b.low||close*0.995;
    const spread = hi-lo;
    const relSp  = atr>0 ? +(spread/atr).toFixed(2) : 0;
    const vR     = vAvg>0 ? +((b.vol||100000)/vAvg).toFixed(2) : 1;
    const up     = close>=(prev.comex||0);
    let vsa      = 'NEUTRAL';

    if      (vR>2.0 && relSp<0.5)                       vsa='STOPPING_VOLUME';
    else if (vR>1.6 && relSp>1.0 && up)                 vsa='ABSORPTION_BULL';
    else if (vR>1.6 && relSp>1.0 && !up)                vsa='ABSORPTION_BEAR';
    else if (vR<0.7 && relSp>0.8 && !up)                vsa='UPTHRUST';
    else if (vR<0.7 && relSp>0.8 && up)                 vsa='SPRING';
    else if (vR<0.6 && up)                              vsa='NO_DEMAND';
    else if (vR<0.6 && !up)                             vsa='NO_SUPPLY';
    else if (vR>1.5 && relSp<0.5)                       vsa='EFFORT_VS_RESULT';

    return {...b, spread:+spread.toFixed(4), relSpread:relSp, volRatio:vR, vsa, up};
  });

  const VM = {
    ABSORPTION_BULL:  {label:'🟢 Hấp thụ Tăng',    short:'Hấp thụ↑',  type:'bullish'},
    ABSORPTION_BEAR:  {label:'🔴 Hấp thụ Giảm',    short:'Hấp thụ↓',  type:'bearish'},
    STOPPING_VOLUME:  {label:'🟡 Stopping Volume',  short:'Stopping',   type:'neutral'},
    UPTHRUST:         {label:'🔴 Upthrust',          short:'Upthrust',   type:'bearish'},
    SPRING:           {label:'🟢 Spring',            short:'Spring',     type:'bullish'},
    NO_DEMAND:        {label:'🔴 No Demand',         short:'No Demand',  type:'bearish'},
    NO_SUPPLY:        {label:'🟢 No Supply',         short:'No Supply',  type:'bullish'},
    EFFORT_VS_RESULT: {label:'🟡 Effort vs Result',  short:'EvR',        type:'neutral'},
    NEUTRAL:          {label:'⚪ Bình thường',       short:'Neutral',    type:'neutral'},
  };

  const lat     = analyzed[analyzed.length-1];
  const meta    = {...(VM[lat.vsa]||VM.NEUTRAL), desc: VM[lat.vsa]?.label||'' };
  const bullish = ['ABSORPTION_BULL','SPRING','NO_SUPPLY'].includes(lat.vsa);
  const bearish = ['ABSORPTION_BEAR','UPTHRUST','NO_DEMAND'].includes(lat.vsa);

  return { bars:analyzed, latestBar:lat, meta,
    bullish, bearish, score:bullish?72:bearish?28:50, atr, volAvg:vAvg };
}

// ─── Wyckoff detection từ price action ───────────────────────────────────────
function detectWyckoffTF(bars, vsa) {
  if (bars.length<10) return {
    phase:'C', label:'Phase C',
    sub:'Chưa đủ dữ liệu', active:true, confidence:45,
  };

  const closes  = bars.map(b=>b.comex||0);
  const n       = closes.length;
  const hi20    = Math.max(...closes.slice(-20));
  const lo20    = Math.min(...closes.slice(-20));
  const hi10    = Math.max(...closes.slice(-10));
  const lo10    = Math.min(...closes.slice(-10));
  const cur     = closes[n-1];
  const rng     = hi20-lo20||0.01;

  const comprRatio = (hi10-lo10)/rng;
  const newerLow   = lo10 < lo20*0.999;
  const breakUp    = cur  > hi20*0.999;
  const inMidRange = cur > lo20+rng*0.3 && cur < lo20+rng*0.7;

  const springs  = vsa.bars.filter(b=>b.vsa==='SPRING').length;
  const stVol    = vsa.bars.filter(b=>b.vsa==='STOPPING_VOLUME').length;
  const noSup    = vsa.bars.filter(b=>b.vsa==='NO_SUPPLY').length;
  const noDemo   = vsa.bars.filter(b=>b.vsa==='NO_DEMAND').length;
  const upthrust = vsa.bars.filter(b=>b.vsa==='UPTHRUST').length;
  const bearish  = vsa.bearish;

  // Distribution (bearish Wyckoff)
  if (upthrust>=2 && noDemo>=2 && cur<hi20*0.97) {
    return { phase:'DIST', label:'Distribution ⚠️',
      sub:'UT + No Demand — phân phối cấu trúc giảm',
      active:true, confidence:70, bearish:true };
  }
  if (breakUp && (springs>0||noSup>1)) {
    return { phase:'D', label:'Phase D',
      sub:'LPS → SOS Markup — Breakout confirmed', active:true, confidence:75 };
  }
  if (newerLow && stVol>0) {
    return { phase:'C', label:'Phase C',
      sub:'Spring/Shakeout — Test cuối trước Markup', active:true, confidence:70 };
  }
  if (comprRatio<0.5 && inMidRange && stVol>0) {
    return { phase:'B', label:'Phase B',
      sub:'UT · Secondary Tests — Tích lũy', active:false, confidence:65 };
  }
  if (lo10<lo20 && stVol>1) {
    return { phase:'A', label:'Phase A',
      sub:'SC → AR → ST — Dừng giảm', active:false, confidence:60 };
  }
  if (cur>hi20*1.02) {
    return { phase:'E', label:'Phase E',
      sub:'Markup — Uptrend đang diễn ra', active:true, confidence:80 };
  }
  return { phase:'C', label:'Phase C',
    sub:'Spring đang theo dõi', active:true, confidence:50 };
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useTrendEngine(s) {
  // ─── Guard: s undefined ở render đầu, dùng safeS throughout ──────────────
  const safeS = s || {};

  const [activeTF, setActiveTF]       = useState('H4');
  const [tfBars, setTfBars]           = useState(() => lsLoad());
  const [loading, setLoading]         = useState({});
  const [imData, setImData]           = useState(null);
  const [imLoading, setImLoading]     = useState(false);
  const [imLastFetch, setImLastFetch] = useState(null);
  const fetchRef                      = useRef({});

  // ─── Fetch OHLCV cho 1 TF ─────────────────────────────────────────────────
  const fetchTFData = useCallback(async (tf, force=false) => {
    const lastFetch = fetchRef.current[tf] || 0;
    if (!force && Date.now()-lastFetch < 10000) return;
    if (loading[tf]) return;
    setLoading(p => ({...p, [tf]:true}));
    fetchRef.current[tf] = Date.now();
    const bars = await fetchOHLCV(tf);
    if (bars.length > 0) {
      setTfBars(prev => {
        const next = { ...prev, [tf]: bars };
        lsSave(next);
        return next;
      });
    }
    setLoading(p => ({...p, [tf]:false}));
  }, [loading]);

  // ─── Fetch IM data ─────────────────────────────────────────────────────────
  const fetchIntermarket = useCallback(async (force=false) => {
    const stale = imLastFetch ? Date.now()-imLastFetch : Infinity;
    if (!force && stale < 5*60*1000) return;
    if (imLoading) return;
    setImLoading(true);
    try {
      const r = await fetch(`/api/intermarket${force?'?force=1':''}`);
      if (r.ok) {
        const d = await r.json();
        setImData(d);
        setImLastFetch(Date.now());
      }
    } catch(e) { console.error('IM error:', e.message); }
    finally { setImLoading(false); }
  }, [imLoading, imLastFetch]);

  // ─── Auto-fetch khi mount & khi đổi TF ───────────────────────────────────
  useEffect(() => {
    fetchIntermarket();
    fetchTFData(activeTF);
  }, [activeTF]);

  // ─── Append real-time price — dùng safeS thay s ──────────────────────────
  useEffect(() => {
    // FIX: kiểm tra safeS.comex thay vì s.comex
    if (!safeS.comex) return;
    const bar = {
      ts:    Date.now(),
      d:     new Date().toLocaleDateString('vi-VN',
               {day:'2-digit', month:'2-digit'}),
      comex: safeS.comex,
      open:  safeS.comex,
      high:  safeS.prev_high || safeS.comex,
      low:   safeS.prev_low  || safeS.comex,
      vol:   safeS.session_vol || 100000,
    };
    setTfBars(prev => {
      const existing = prev[activeTF] || [];
      const last     = existing[existing.length-1];
      let updated;
      if (last && last.d === bar.d) {
        updated = [...existing.slice(0,-1), {
          ...last,
          comex: bar.comex,
          high:  Math.max(last.high||0, bar.comex),
          low:   Math.min(last.low||Infinity, bar.comex),
        }];
      } else {
        updated = [...existing, bar].slice(-MAX_BARS);
      }
      const next = { ...prev, [activeTF]: updated };
      lsSave(next);
      return next;
    });
  }, [safeS.comex, activeTF]); // ← FIX: safeS.comex

  // ─── Active bars ──────────────────────────────────────────────────────────
  const activeBars = useMemo(() => {
    const saved = tfBars[activeTF] || [];
    if (saved.length >= 5) return saved;
    // Fallback: dùng priceChart từ safeS
    return (safeS.priceChart || []).map(b => ({
      ...b,
      ts:   b.ts || Date.now(),
      high: b.high || b.comex * 1.005,
      low:  b.low  || b.comex * 0.995,
    }));
  }, [tfBars, activeTF, safeS.priceChart]);

  // ─── TF-aware calculations ────────────────────────────────────────────────
  const ew      = useMemo(() => calcElliottTF(activeBars, activeTF),
    [activeBars, activeTF]);
  const vsa     = useMemo(() => calcVSATF(activeBars, activeTF),
    [activeBars, activeTF]);
  const wyckoff = useMemo(() => detectWyckoffTF(activeBars, vsa),
    [activeBars, vsa]);
  const rsi     = useMemo(() =>
    calcRSI(activeBars, TF_CONFIG[activeTF]?.rsiPeriod||14),
    [activeBars, activeTF]);
  const atr     = useMemo(() =>
    calcATR(activeBars, TF_CONFIG[activeTF]?.atrPeriod||14),
    [activeBars, activeTF]);

  const pk1 = useMemo(() => {
    const tfBonus = {MN:5,W:4,D:3,H4:0,H1:-2,M15:-4}[activeTF]||0;
    const base    = Math.round(ew.score*0.5 + vsa.score*0.4 + 10);
    const score   = Math.max(0, Math.min(100, base+tfBonus));
    return {
      pk1Score: score,
      pk1Col:   score>=70?'#22c55e':score>=50?'#f59e0b':'#ef4444',
      pk1Label: score>=70?'🟢 MẠNH':score>=50?'🟡 TRUNG LẬP':'🔴 YẾU',
    };
  }, [ew, vsa, activeTF]);

  return {
    activeTF, setActiveTF, TFS, TF_CONFIG,
    activeBars, tfBars,
    loading, fetchTFData,
    ew, vsa, wyckoff, rsi, atr, pk1,
    imData,
    imAssets:  imData?.assets   || null,
    imSignals: imData?.signals  || null,
    imLoading, imLastFetch, fetchIntermarket,
  };
}