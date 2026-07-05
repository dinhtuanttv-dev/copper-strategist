// ─── Data flow: tfHistory[tf] + TF multipliers → Elliott/VSA/Wyckoff/scores ──
import { useState, useEffect, useMemo, useCallback } from 'react';

// ─── TF-specific config ───────────────────────────────────────────────────────
const TF_CONFIG = {
  MN:  { rsiPeriod:14, atrPeriod:14, waveSens:0.030, volPeriod:20, label:'Monthly'  },
  W:   { rsiPeriod:14, atrPeriod:14, waveSens:0.025, volPeriod:20, label:'Weekly'   },
  D:   { rsiPeriod:14, atrPeriod:14, waveSens:0.020, volPeriod:20, label:'Daily'    },
  H4:  { rsiPeriod:14, atrPeriod:14, waveSens:0.015, volPeriod:20, label:'H4'       },
  H1:  { rsiPeriod:10, atrPeriod:10, waveSens:0.010, volPeriod:14, label:'H1'       },
  M15: { rsiPeriod:7,  atrPeriod:7,  waveSens:0.006, volPeriod:10, label:'M15'      },
};

const TFS       = ['MN','W','D','H4','H1','M15'];
const MAX_BARS  = 50;
const LS_KEY    = 'cu_tf_history_v2';

// ─── ATR(n) ───────────────────────────────────────────────────────────────────
function calcATR(bars, n=14) {
  if (bars.length < 2) return 0.1;
  const trs = bars.slice(1).map((b,i) => {
    const prev = bars[i];
    return Math.max(
      (b.high||b.comex) - (b.low||b.comex*0.99),
      Math.abs((b.high||b.comex) - (prev.comex||prev.close||0)),
      Math.abs((b.low||b.comex*0.99) - (prev.comex||prev.close||0)),
    );
  });
  const slice = trs.slice(-n);
  return slice.length ? +(slice.reduce((a,v)=>a+v,0)/slice.length).toFixed(4) : 0.1;
}

// ─── RSI(n) ───────────────────────────────────────────────────────────────────
function calcRSI(bars, n=14) {
  if (bars.length < n+1) return 50;
  const closes = bars.map(b => b.comex||b.close||0);
  const changes = closes.slice(1).map((c,i) => c - closes[i]);
  const slice   = changes.slice(-n);
  const gains   = slice.filter(c=>c>0).reduce((a,v)=>a+v,0)/n;
  const losses  = Math.abs(slice.filter(c=>c<0).reduce((a,v)=>a+v,0))/n;
  if (losses===0) return 100;
  const rs = gains/losses;
  return +(100 - 100/(1+rs)).toFixed(1);
}

// ─── SMA volume ───────────────────────────────────────────────────────────────
function volSMA(bars, n=20) {
  const vols = bars.map(b=>b.vol||100000).slice(-n);
  return vols.reduce((a,v)=>a+v,0) / vols.length;
}

// ─── Find swing highs/lows ────────────────────────────────────────────────────
function findSwings(bars, lookback=3) {
  const highs = [], lows = [];
  for (let i=lookback; i<bars.length-lookback; i++) {
    const h = bars[i].high||bars[i].comex;
    const l = bars[i].low||(bars[i].comex*0.99);
    const isH = bars.slice(i-lookback,i).every(b=>(b.high||b.comex)<=h)
             && bars.slice(i+1,i+lookback+1).every(b=>(b.high||b.comex)<=h);
    const isL = bars.slice(i-lookback,i).every(b=>(b.low||b.comex*0.99)>=l)
             && bars.slice(i+1,i+lookback+1).every(b=>(b.low||b.comex*0.99)>=l);
    if (isH) highs.push({ i, v:h });
    if (isL) lows.push({ i, v:l });
  }
  return { highs, lows };
}

// ─── Elliott Wave với Rule Validation ────────────────────────────────────────
function calcElliottTF(bars, tf) {
  const cfg = TF_CONFIG[tf] || TF_CONFIG.H4;
  if (bars.length < 10) return {
    wave:'?', label:'Chưa đủ dữ liệu', scenario:'',
    failure:false, score:50, prob:50,
    fib382:0, fib500:0, fib618:0, fib786:0,
    w1Start:0, w3Target:0, w5Target:0,
  };

  const closes = bars.map(b => b.comex||b.close||0);
  const { highs, lows } = findSwings(bars, 2);
  const hi = Math.max(...closes.slice(-20));
  const lo = Math.min(...closes.slice(-20));
  const rng = hi - lo || 0.01;
  const last = closes[closes.length-1];
  const pos  = (last - lo) / rng;

  // Fibonacci levels từ swing
  const f382 = +(hi - rng*0.382).toFixed(3);
  const f500 = +(hi - rng*0.500).toFixed(3);
  const f618 = +(hi - rng*0.618).toFixed(3);
  const f786 = +(hi - rng*0.786).toFixed(3);

  // Elliott Rule checks
  let wave='?', label='', scenario='', failure=false, score=50, prob=50;
  let w1Start=lo, w3Target=0, w5Target=0;

  // Wave 3 Extension: mạnh nhất khi pos > 0.7 và momentum dương
  const mom5  = closes.length>=5 ? closes[closes.length-1]-closes[closes.length-5] : 0;
  const mom10 = closes.length>=10? closes[closes.length-1]-closes[closes.length-10]: 0;

  if (pos > 0.85 && mom5 > 0) {
    wave='3'; label='⚡ Sóng 3 — Extension';
    scenario=`Extension mạnh. Target W3 = W1 × 1.618 = $${(lo+rng*1.618).toFixed(3)}`;
    score=85; prob=78;
    w3Target = +(lo + rng*1.618).toFixed(3);
    w5Target = +(lo + rng*2.000).toFixed(3);

    // Rule check: W3 phải là sóng mạnh nhất
    const w3Range = rng * pos;
    const w1Range = rng * 0.382;
    if (w3Range < w1Range) { failure=true; score=30; label='❌ Rule Violation: W3 < W1'; }

  } else if (pos > 0.65 && mom5 > 0) {
    wave='5'; label='🏁 Sóng 5 — Final Leg';
    scenario='Leg cuối. Vol giảm = divergence. Chuẩn bị đảo chiều.';
    score=60; prob=62;
    w5Target = +(hi + rng*0.382).toFixed(3);

  } else if (pos < 0.45 && mom5 < 0 && last > f618) {
    wave='4'; label='🔄 Sóng 4 — Correction';
    scenario=`Điều chỉnh bình thường. Giữ trên Fib 0.618 = $${f618}`;
    score=65; prob=65;
    // Rule: W4 không được xâm phạm đỉnh W1
    if (last < lo + rng*0.1) {
      failure=true; score=20;
      label='❌ Rule Violation: W4 xâm phạm W1';
    }

  } else if (pos < 0.35 && last < f618) {
    wave='2'; label='🔁 Sóng 2 — Pullback';
    scenario=`Pullback sâu. W2 không được retrace >100% W1.`;
    score=45; prob=55;
    // Rule: W2 không retrace > 100% W1
    if (last < lo) { failure=true; score=10; label='❌ Rule Violation: W2 > 100% W1'; }

  } else if (last < f786) {
    wave='F'; label='❌ Wave Failure';
    failure=true; score=10; prob=85;
    scenario='Phá Fib 0.786 — cấu trúc sóng vô hiệu.';

  } else {
    wave='1'; label='🌱 Sóng 1 — Khởi động';
    scenario='Khởi đầu impulse mới. Chờ xác nhận vol tăng.';
    score=55; prob=58;
    w3Target = +(lo + rng*1.618).toFixed(3);
  }

  return { wave, label, scenario, failure, score, prob,
    fib382:f382, fib500:f500, fib618:f618, fib786:f786,
    w1Start, w3Target, w5Target, pos:+pos.toFixed(3) };
}

// ─── VSA Engine với spread tương đối ─────────────────────────────────────────
function calcVSATF(bars, tf) {
  const cfg = TF_CONFIG[tf] || TF_CONFIG.H4;
  if (bars.length < 5) return {
    bars:[], meta:{label:'Không đủ dữ liệu',short:'N/A',desc:'',type:'neutral'},
    bullish:false, bearish:false, score:50,
    latestBar:{volRatio:1,up:true,vsa:'NEUTRAL',spread:0},
  };

  const atr    = calcATR(bars, cfg.atrPeriod);
  const volAvg = volSMA(bars, cfg.volPeriod);

  const analyzed = bars.map((b,i) => {
    if (!i) return {...b, spread:0, volRatio:1, vsa:'NEUTRAL', up:true, relSpread:0};

    const close  = b.comex   || b.close || 0;
    const prev   = bars[i-1];
    const high   = b.high    || close*1.005;
    const low    = b.low     || close*0.995;
    const spread = high - low;
    const relSpread = atr > 0 ? +(spread / atr).toFixed(2) : 0;
    const volRatio  = volAvg > 0 ? +(((b.vol||100000)) / volAvg).toFixed(2) : 1;
    const up        = close >= (prev.comex||prev.close||0);

    let vsa = 'NEUTRAL';

    // Stopping Volume: vol cực cao + spread hẹp
    if (volRatio > 2.0 && relSpread < 0.5)
      vsa = 'STOPPING_VOLUME';
    // Absorption — Bullish: vol cao + spread rộng + tăng giá
    else if (volRatio > 1.6 && relSpread > 1.0 && up)
      vsa = 'ABSORPTION_BULL';
    // Absorption — Bearish: vol cao + spread rộng + giảm giá
    else if (volRatio > 1.6 && relSpread > 1.0 && !up)
      vsa = 'ABSORPTION_BEAR';
    // Upthrust: phá đỉnh cũ nhưng vol thấp
    else if (volRatio < 0.7 && relSpread > 0.8 && !up)
      vsa = 'UPTHRUST';
    // Spring: phá đáy cũ nhưng vol thấp, đóng cửa trên đáy
    else if (volRatio < 0.7 && relSpread > 0.8 && up)
      vsa = 'SPRING';
    // No Demand: giá tăng nhẹ vol thấp
    else if (volRatio < 0.6 && up)
      vsa = 'NO_DEMAND';
    // No Supply: giá giảm nhẹ vol thấp
    else if (volRatio < 0.6 && !up)
      vsa = 'NO_SUPPLY';
    // Effort vs Result: vol lớn nhưng spread nhỏ
    else if (volRatio > 1.5 && relSpread < 0.6)
      vsa = 'EFFORT_VS_RESULT';

    return { ...b, spread:+spread.toFixed(4), relSpread, volRatio, vsa, up };
  });

  const VM = {
    ABSORPTION_BULL:  { label:'🟢 Hấp thụ Tăng',    short:'Hấp thụ↑',   type:'bullish', desc:'Smart Money tích lũy mạnh' },
    ABSORPTION_BEAR:  { label:'🔴 Hấp thụ Giảm',    short:'Hấp thụ↓',   type:'bearish', desc:'Smart Money phân phối' },
    STOPPING_VOLUME:  { label:'🟡 Stopping Volume',  short:'Stopping',    type:'neutral', desc:'Vol cao, giá ít di chuyển' },
    UPTHRUST:         { label:'🔴 Upthrust',          short:'Upthrust',    type:'bearish', desc:'Phá đỉnh vol thấp — bẫy tăng' },
    SPRING:           { label:'🟢 Spring',            short:'Spring',      type:'bullish', desc:'Phá đáy vol thấp — bẫy giảm' },
    NO_DEMAND:        { label:'🔴 No Demand',         short:'No Demand',   type:'bearish', desc:'Giá tăng nhẹ, vol thấp — không có lực' },
    NO_SUPPLY:        { label:'🟢 No Supply',         short:'No Supply',   type:'bullish', desc:'Giá giảm nhẹ, vol thấp — cạn lực bán' },
    EFFORT_VS_RESULT: { label:'🟡 Effort vs Result',  short:'EvR',         type:'neutral', desc:'Vol lớn nhưng di chuyển nhỏ' },
    NEUTRAL:          { label:'⚪ Bình thường',       short:'Neutral',     type:'neutral', desc:'Không có tín hiệu VSA rõ' },
  };

  const lat     = analyzed[analyzed.length-1];
  const meta    = VM[lat.vsa] || VM.NEUTRAL;
  const bullish = ['ABSORPTION_BULL','SPRING','NO_SUPPLY'].includes(lat.vsa);
  const bearish = ['ABSORPTION_BEAR','UPTHRUST','NO_DEMAND'].includes(lat.vsa);

  return {
    bars:    analyzed,
    latestBar: lat,
    meta,
    bullish, bearish,
    score: bullish?72:bearish?28:50,
    atr, volAvg,
  };
}

// ─── Wyckoff phase detection từ data ─────────────────────────────────────────
function detectWyckoff(bars, vsa) {
  if (bars.length < 15) return {
    phase:'C', label:'Phase C', sub:'Spring — Đang theo dõi',
    active:true, confidence:50,
  };

  const closes  = bars.map(b=>b.comex||b.close||0);
  const n       = closes.length;
  const hi20    = Math.max(...closes.slice(-20));
  const lo20    = Math.min(...closes.slice(-20));
  const hi10    = Math.max(...closes.slice(-10));
  const lo10    = Math.min(...closes.slice(-10));
  const current = closes[n-1];

  // Detect phase dựa trên price action pattern
  const compressionRatio = (hi10-lo10) / (hi20-lo20||0.01);
  const inRange = current > lo20+(hi20-lo20)*0.3
               && current < lo20+(hi20-lo20)*0.7;
  const newerLow   = lo10 < lo20 * 0.998;  // Spring signal
  const breakingUp = current > hi20 * 0.998; // Markup signal

  // Count stopping volume / springs
  const springs   = vsa.bars.filter(b=>b.vsa==='SPRING').length;
  const stVolume  = vsa.bars.filter(b=>b.vsa==='STOPPING_VOLUME').length;
  const noSupply  = vsa.bars.filter(b=>b.vsa==='NO_SUPPLY').length;
  const noDecision = compressionRatio < 0.5 && inRange;

  let phase, label, sub, active=false, confidence=50;

  if (breakingUp && (springs > 0 || noSupply > 1)) {
    phase='D'; label='Phase D'; active=true; confidence=75;
    sub='LPS → SOS Markup — Breakout xác nhận';
  } else if (newerLow && stVolume > 0) {
    phase='C'; label='Phase C'; active=true; confidence=70;
    sub='Spring (SOS) — Test cuối cùng trước Markup';
  } else if (noDecision && stVolume > 0) {
    phase='B'; label='Phase B'; active=false; confidence=65;
    sub='UT · Secondary Tests — Xây dựng nguyên nhân';
  } else if (lo10 < lo20 && stVolume > 1) {
    phase='A'; label='Phase A'; active=false; confidence=60;
    sub='SC → AR → ST — Dừng xu hướng giảm';
  } else if (breakingUp) {
    phase='E'; label='Phase E'; active=true; confidence=80;
    sub='Markup — Uptrend đang diễn ra';
  } else {
    phase='C'; label='Phase C'; active=true; confidence=55;
    sub='Spring/Shakeout — Đang theo dõi';
  }

  return { phase, label, sub, active, confidence };
}

// ─── Score tổng hợp PK1 ──────────────────────────────────────────────────────
function calcPK1(ew, vsa, tf) {
  const tfBonus = {MN:5, W:4, D:3, H4:0, H1:-2, M15:-4}[tf]||0;
  const ewScore  = ew.failure ? 5 : ew.score;
  const vsaScore = vsa.score;
  const base     = Math.round(ewScore*0.5 + vsaScore*0.4 + 10);
  const pk1      = Math.max(0, Math.min(100, base + tfBonus));
  return {
    pk1Score: pk1,
    pk1Col:   pk1>=70?'#22c55e':pk1>=50?'#f59e0b':'#ef4444',
    pk1Label: pk1>=70?'🟢 KỸ THUẬT MẠNH':pk1>=50?'🟡 TRUNG LẬP':'🔴 KỸ THUẬT YẾU',
    tfConverge: ew.wave==='3'||ew.wave==='1',
    tfLabel: `${tf}: W${ew.wave} ${vsa.meta.short}`,
  };
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useTrendEngine(s, externalTF) {
  // ─── State ──────────────────────────────────────────────
  const [activeTF, setActiveTF]       = useState(externalTF||'H4');
  const [tfHistory, setTfHistory]     = useState(() => {
    // Load from localStorage on init
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem(LS_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [imData, setImData]           = useState(null);
  const [imLoading, setImLoading]     = useState(false);
  const [imLastFetch, setImLastFetch] = useState(null);

  // ─── Sync activeTF với prop ──────────────────────────────
  useEffect(() => {
    if (externalTF && externalTF !== activeTF) setActiveTF(externalTF);
  }, [externalTF]);

  // ─── Persist tfHistory to localStorage ──────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // Chỉ lưu 30 bars/TF để tránh overflow
      const toSave = {};
      for (const tf of TFS) {
        toSave[tf] = (tfHistory[tf]||[]).slice(-30);
      }
      localStorage.setItem(LS_KEY, JSON.stringify(toSave));
    } catch { /* quota exceeded: skip */ }
  }, [tfHistory]);

  // ─── Thêm bar mới vào TF bucket ─────────────────────────
  const appendBar = useCallback((tf, bar) => {
    setTfHistory(prev => {
      const existing = prev[tf] || [];
      const last     = existing[existing.length-1];
      // Tránh duplicate (cùng date label)
      if (last && last.d === bar.d && last.comex === bar.comex) return prev;
      const updated = [...existing, {
        d:     bar.d     || new Date().toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'}),
        comex: bar.comex || bar.price,
        vol:   bar.vol   || bar.session_vol || 100000,
        high:  bar.prev_high || bar.comex,
        low:   bar.prev_low  || bar.comex,
      }].slice(-MAX_BARS);
      return { ...prev, [tf]: updated };
    });
  }, []);

  // ─── Auto-append khi giá thay đổi ───────────────────────
  useEffect(() => {
    if (!s.comex) return;
    appendBar(activeTF, {
      d:    new Date().toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'}),
      comex: s.comex,
      vol:   s.session_vol||100000,
      high:  s.prev_high||s.comex,
      low:   s.prev_low||s.comex,
    });
  }, [s.comex, activeTF]);

  // ─── Fetch inter-market data ─────────────────────────────
  const fetchIntermarket = useCallback(async (force=false) => {
    if (imLoading) return;
    const staleness = imLastFetch ? Date.now()-imLastFetch : Infinity;
    if (!force && staleness < 5*60*1000) return;
    setImLoading(true);
    try {
      const r = await fetch(`/api/intermarket${force?'?force=1':''}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setImData(d);
      setImLastFetch(Date.now());
    } catch(e) { console.error('IM fetch error:', e.message); }
    finally { setImLoading(false); }
  }, [imLoading, imLastFetch]);

  // ─── Auto-fetch IM khi mount ─────────────────────────────
  useEffect(() => { fetchIntermarket(); }, []);

  // ─── Active TF bars ──────────────────────────────────────
  const activeBars = useMemo(() => {
    const saved = tfHistory[activeTF] || [];
    // Fallback: dùng priceChart từ state nếu chưa có history
    if (saved.length < 5 && s.priceChart?.length) {
      return s.priceChart.map(b => ({
        ...b,
        high: b.comex*1.005,
        low:  b.comex*0.995,
      }));
    }
    return saved;
  }, [tfHistory, activeTF, s.priceChart]);

  // ─── Calculations với TF-aware formulas ──────────────────
  const ew      = useMemo(() => calcElliottTF(activeBars, activeTF), [activeBars, activeTF]);
  const vsa     = useMemo(() => calcVSATF(activeBars, activeTF),     [activeBars, activeTF]);
  const wyckoff = useMemo(() => detectWyckoff(activeBars, vsa),       [activeBars, vsa]);
  const rsi     = useMemo(() => calcRSI(activeBars, TF_CONFIG[activeTF]?.rsiPeriod||14), [activeBars, activeTF]);
  const atr     = useMemo(() => calcATR(activeBars, TF_CONFIG[activeTF]?.atrPeriod||14), [activeBars, activeTF]);
  const pk1     = useMemo(() => calcPK1(ew, vsa, activeTF), [ew, vsa, activeTF]);

  // ─── Inter-market signals ────────────────────────────────
  const imSignals = useMemo(() => {
    if (!imData) return null;
    return imData.signals || null;
  }, [imData]);

  const imAssets = useMemo(() => {
    if (!imData?.assets) return null;
    return imData.assets;
  }, [imData]);

  return {
    // TF control
    activeTF, setActiveTF,
    tfConfig: TF_CONFIG[activeTF] || TF_CONFIG.H4,
    tfHistory, appendBar,
    activeBars,

    // Calculations
    ew, vsa, wyckoff, rsi, atr, pk1,

    // Inter-market
    imData, imAssets, imSignals,
    imLoading, imLastFetch,
    fetchIntermarket,

    // Helpers
    TFS, TF_CONFIG,
  };
}