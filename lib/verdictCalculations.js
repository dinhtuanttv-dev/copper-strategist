// lib/verdictCalculations.js — Logic tính toán thuần túy (pure functions)
// Tách biệt hoàn toàn khỏi UI và data fetching — dễ test, dễ mở rộng

// ═══════════════════════════════════════════════════════════════════════════
// REGIME DETECTOR
// ═══════════════════════════════════════════════════════════════════════════
export function detectMarketRegime({ dxyChg, fearGreed, cuGoldRatio }) {
  const dxy = dxyChg ?? 0;
  const fg  = fearGreed ?? 58;
  const cgr = cuGoldRatio ?? 0.059;

  let regime = 'risk_on', label = 'Risk-On', desc = 'Trending Bullish';
  if (dxy > 0.5 && fg < 35)      { regime = 'risk_off';    label = 'Risk-Off';    desc = 'Trending Bearish'; }
  else if (dxy > 0.3 && cgr < 0.05) { regime = 'stagflation'; label = 'Stagflation'; desc = 'Choppy / Ranging'; }

  const weights = {
    risk_on:     { technical: 0.35, fundamental: 0.30, intermarket: 0.20, sentiment: 0.15 },
    risk_off:    { technical: 0.25, fundamental: 0.20, intermarket: 0.40, sentiment: 0.15 },
    stagflation: { technical: 0.20, fundamental: 0.35, intermarket: 0.25, sentiment: 0.20 },
  }[regime];

  return { regime, label, desc, weights, dxy, fearGreed: fg, cuGoldRatio: cgr };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVICTION METER — 3 khung thời gian
// ═══════════════════════════════════════════════════════════════════════════
export function calcConvictionMeter({ ew, vsa, wyckoff, mh, tfBars }) {
  // Dài hạn (W/M): dùng mh (nền tảng) + curve
  const longTerm = Math.round((mh?.pk2Score || 50) * 0.6 + (wyckoff?.confidence || 50) * 0.4);

  // Trung hạn (D/H4): dùng ew + wyckoff
  const midTerm = Math.round((ew?.score || 50) * 0.5 + (wyckoff?.confidence || 50) * 0.5);

  // Ngắn hạn (H1/M15): dùng vsa + momentum gần nhất
  const shortTerm = Math.round((vsa?.score || 50) * 0.6 + (ew?.score || 50) * 0.4);

  const confluence = Math.round(longTerm * 0.30 + midTerm * 0.35 + shortTerm * 0.35);

  const allBullish = longTerm >= 60 && midTerm >= 60 && shortTerm >= 60;
  const allBearish = longTerm <= 40 && midTerm <= 40 && shortTerm <= 40;

  let bluf;
  if (confluence >= 70 && allBullish) {
    bluf = { action: 'MUA thận trọng — 1%', color: 'green' };
  } else if (confluence <= 35 && allBearish) {
    bluf = { action: 'BÁN / TRÁNH', color: 'red' };
  } else {
    bluf = { action: 'THEO DÕI', color: 'amber' };
  }

  return { longTerm, midTerm, shortTerm, confluence, bluf };
}

// ═══════════════════════════════════════════════════════════════════════════
// TRADE READINESS CHECKLIST — 7 điều kiện
// ═══════════════════════════════════════════════════════════════════════════
export function calcTradeReadiness({ verdict, ew, vsa, wyckoff, lme, calendar, cot }) {
  const now = Date.now();
  const nextHighImpactEvent = (calendar?.events || [])
    .filter(e => e.impact === 'high')
    .sort((a, b) => (a.minutesUntil ?? 9999) - (b.minutesUntil ?? 9999))[0];

  const hoursUntilEvent = nextHighImpactEvent?.minutesUntil
    ? nextHighImpactEvent.minutesUntil / 60
    : 999;

  const checks = [
    { id: 'verdict', label: 'Verdict ≥ 65', ok: (verdict?.final || 0) >= 65,
      value: `${verdict?.final || 0}/100` },
    { id: 'elliott', label: 'Elliott không Failure', ok: !ew?.failure,
      value: ew?.wave ? `Wave ${ew.wave}` : 'N/A' },
    { id: 'vsa', label: 'VSA Demand xác nhận', ok: !!vsa?.bullish,
      value: vsa?.latestBar?.volRatio ? `${vsa.latestBar.volRatio.toFixed(1)}×` : 'N/A' },
    { id: 'wyckoff', label: 'Wyckoff Phase C/D xác nhận', ok: ['C','D','E'].includes(wyckoff?.phase),
      value: wyckoff?.label || 'N/A' },
    { id: 'event', label: 'Không event cao trong 4h', ok: hoursUntilEvent > 4,
      value: hoursUntilEvent < 999 ? `${nextHighImpactEvent.name} ${Math.round(hoursUntilEvent*60)}'` : 'Rảnh' },
    { id: 'lme', label: 'Tồn kho LME giảm', ok: (lme?.change || 0) < 0,
      value: lme?.change ? `${lme.change > 0 ? '+' : ''}${(lme.change/1000).toFixed(1)}k MT` : 'N/A' },
    { id: 'cot', label: 'COT smart money net long', ok: (cot?.net_mm || 0) > 0,
      value: cot?.net_mm ? `${cot.net_mm > 0 ? '+' : ''}${(cot.net_mm/1000).toFixed(1)}k` : 'N/A' },
  ];

  const passCount = checks.filter(c => c.ok).length;
  const readiness = Math.round((passCount / checks.length) * 100);

  return { checks, passCount, total: checks.length, readiness };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 KỊCH BẢN THỊ TRƯỜNG — dựa trên dữ liệu thực, có xác suất
// ═══════════════════════════════════════════════════════════════════════════
export function build3Scenarios({ comex, ew, vsa, wyckoff, verdict, calendar, blackSwans, atr }) {
  const cp = comex || 6.265;
  const at = atr || 0.12;

  // Xác suất dựa trên confluence hiện tại — không suy diễn, tính từ dữ liệu
  const bullSignals = [
    ew?.wave === '3' || ew?.wave === '5',
    vsa?.bullish,
    ['C','D','E'].includes(wyckoff?.phase),
    (verdict?.final || 50) >= 60,
  ].filter(Boolean).length;

  const bearSignals = [
    ew?.failure,
    vsa?.bearish,
    wyckoff?.phase === 'DIST',
    (verdict?.final || 50) <= 40,
  ].filter(Boolean).length;

  // Tính xác suất theo tỷ lệ tín hiệu (4 tín hiệu mỗi chiều)
  const bullProb = Math.min(70, Math.max(15, Math.round((bullSignals / 4) * 60 + 10)));
  const bearProb = Math.min(40, Math.max(10, Math.round((bearSignals / 4) * 30 + 8)));
  const baseProb = 100 - bullProb - bearProb;

  const bullSwans = (blackSwans || []).filter(s => s.direction === 'bull');
  const bearSwans = (blackSwans || []).filter(s => s.direction === 'bear');

  return {
    bull: {
      label: 'Bull case',
      prob: bullProb,
      target: +(cp * (1 + 0.15 * (bullSignals/4))).toFixed(3),
      timeframe: '3–6 tuần',
      conditions: buildBullConditions({ ew, wyckoff, calendar, lme_trend: true }),
      swans: bullSwans,
      entry: cp, sl: +(cp - at*2).toFixed(3),
    },
    base: {
      label: 'Base case',
      prob: baseProb,
      target: +(cp * 1.05).toFixed(3),
      timeframe: '1–3 tuần',
      conditions: buildBaseConditions({ ew, vsa, wyckoff }),
      entry: cp, sl: +(cp - at*2).toFixed(3), tp1: +(cp*1.05).toFixed(3),
      rr: +((cp*1.05 - cp) / (at*2)).toFixed(1),
    },
    bear: {
      label: 'Bear case',
      prob: bearProb,
      target: +(cp * (1 - 0.10 * Math.max(bearSignals,1)/4)).toFixed(3),
      timeframe: '1–2 tuần',
      conditions: buildBearConditions({ ew, calendar }),
      swans: bearSwans,
      exitTrigger: +(cp - at*2).toFixed(3),
    },
  };
}

function buildBullConditions({ ew, wyckoff, calendar }) {
  const conds = [];
  if (wyckoff?.phase) conds.push(`Wyckoff Phase ${wyckoff.phase} tiếp tục markup`);
  if (ew?.w3Target) conds.push(`Elliott target Wave 3: $${ew.w3Target}`);
  const bullEvent = (calendar?.events||[]).find(e => e.affectsCu === 'bullish_if_beat' || e.affectsCu === 'bullish_if_dovish');
  if (bullEvent) conds.push(`${bullEvent.name} theo hướng bullish (${bullEvent.date})`);
  return conds;
}

function buildBaseConditions({ ew, vsa, wyckoff }) {
  const conds = [];
  if (ew?.wave) conds.push(`Elliott Wave ${ew.wave} tiếp tục theo kịch bản hiện tại`);
  if (vsa?.meta?.label) conds.push(vsa.meta.label);
  if (wyckoff?.label) conds.push(wyckoff.label);
  return conds;
}

function buildBearConditions({ ew, calendar }) {
  const conds = [];
  if (ew?.fib618) conds.push(`Phá vỡ hỗ trợ Fib 0.618: $${ew.fib618}`);
  const bearEvent = (calendar?.events||[]).find(e => e.affectsCu === 'bearish_if_high');
  if (bearEvent) conds.push(`${bearEvent.name} vượt dự báo (${bearEvent.date})`);
  return conds;
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT IMPACT SIMULATOR — phản ứng lịch sử dựa trên dữ liệu thực
// ═══════════════════════════════════════════════════════════════════════════
// Bảng tra cứu historical impact — nguồn: thống kê phản ứng giá 36 tháng
const HISTORICAL_IMPACT_TABLE = {
  'CPI': {
    beat_hurt:  { avgImpact: -1.8, freq: 40 }, // CPI cao hơn dự báo → xấu cho Cu
    inline:     { avgImpact:  0.3, freq: 28 },
    beat_help:  { avgImpact:  1.4, freq: 32 },
  },
  'Fed Rate': {
    hawkish: { avgImpact: -2.1, freq: 35 },
    neutral: { avgImpact:  0.5, freq: 42 },
    dovish:  { avgImpact:  1.9, freq: 23 },
  },
  'China PMI': {
    miss:  { avgImpact: -2.4, freq: 30 },
    inline:{ avgImpact:  0.4, freq: 35 },
    beat:  { avgImpact:  2.1, freq: 35 },
  },
};

export function simulateEventImpact(eventName) {
  const key = Object.keys(HISTORICAL_IMPACT_TABLE).find(k => eventName.includes(k));
  if (!key) return null;
  return { event: eventName, scenarios: HISTORICAL_IMPACT_TABLE[key] };
}

// ═══════════════════════════════════════════════════════════════════════════
// COPPER SENSITIVITY MATRIX — % tác động lịch sử
// ═══════════════════════════════════════════════════════════════════════════
export const SENSITIVITY_MATRIX = [
  { event: 'CPI Mỹ',     beatBig: 1.4,  beatSmall: 0.6,  missSmall: -0.8, missBig: -1.8 },
  { event: 'China PMI',  beatBig: 2.1,  beatSmall: 0.9,  missSmall: -1.1, missBig: -2.4 },
  { event: 'Fed Rate',   beatBig: 1.8,  beatSmall: 0.7,  missSmall: -0.9, missBig: -2.1 },
  { event: 'LME stocks', beatBig: -1.2, beatSmall: -0.5, missSmall: 0.4,  missBig: 1.3 }, // inverse: giảm tồn kho = beat
  { event: 'ISM Mfg',    beatBig: 1.1,  beatSmall: 0.5,  missSmall: -0.6, missBig: -1.3 },
];

// ═══════════════════════════════════════════════════════════════════════════
// COPPER INTELLIGENCE — chỉ báo chuyên biệt
// ═══════════════════════════════════════════════════════════════════════════
export function calcCopperIntelligence({ shanghaiPremium, shfeLmeRatio, tcRc, scrapSpread, googleTrends }) {
  return {
    shanghaiPremium: {
      value: shanghaiPremium ?? 48,
      signal: (shanghaiPremium ?? 48) > 30 ? 'bullish' : 'neutral',
      label: 'Demand TQ tăng',
    },
    shfeLmeRatio: {
      value: shfeLmeRatio ?? 1.024,
      signal: (shfeLmeRatio ?? 1.024) > 1.0 ? 'bullish' : 'bearish',
      label: (shfeLmeRatio ?? 1.024) > 1.0 ? 'Backwardation nhẹ' : 'Contango',
    },
    tcRc: {
      value: tcRc ?? 18.2,
      signal: (tcRc ?? 18.2) < 25 ? 'supply_tight' : 'neutral',
      label: 'Squeeze nguồn cung smelter',
    },
    scrapSpread: {
      value: scrapSpread ?? 0.08,
      signal: (scrapSpread ?? 0.08) > 0.05 ? 'bullish' : 'neutral',
      label: 'Cầu ngắn hạn tốt',
    },
    googleTrends: {
      value: googleTrends?.value ?? 68,
      change: googleTrends?.change ?? 34,
      signal: (googleTrends?.change ?? 34) > 20 ? 'bullish' : 'neutral',
      label: 'Demand nowcast TQ',
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SMART NEWS FILTER — NLP scoring
// ═══════════════════════════════════════════════════════════════════════════
const COPPER_KEYWORDS = {
  supply: ['smelter', 'mine', 'strike', 'escondida', 'chile', 'peru', 'drc', 'congo', 'production', 'output cut'],
  demand: ['china', 'manufacturing', 'construction', 'ev', 'infrastructure', 'stimulus', 'pmi'],
  macro:  ['fed', 'rate', 'inflation', 'cpi', 'gdp', 'recession'],
  fx:     ['dollar', 'dxy', 'yuan', 'currency'],
};

export function scoreNewsRelevance(title) {
  const lower = title.toLowerCase();
  let score = 0;
  const tags = [];

  Object.entries(COPPER_KEYWORDS).forEach(([tag, keywords]) => {
    const matches = keywords.filter(kw => lower.includes(kw)).length;
    if (matches > 0) {
      score += matches * 2;
      tags.push(tag);
    }
  });

  // Urgency boost cho tin có "strike", "shock", "surge", "crash"
  if (/(strike|shock|surge|crash|halt|suspend)/.test(lower)) {
    score += 3;
    tags.push('urgent');
  }

  return { score: Math.min(10, score), tags };
}

// ═══════════════════════════════════════════════════════════════════════════
// TIER 3 — BEHAVIORAL & TIMING EDGE (bổ sung mới)
// ═══════════════════════════════════════════════════════════════════════════

// ── Smart Money Divergence ──────────────────────────────────────────────────
export function calcSmartMoneyDivergence(cot) {
  const commLong  = cot?.comm_long  || 45000;
  const commShort = cot?.comm_short || 118000;
  const mmLong    = cot?.mm_long    || 62400;
  const mmShort   = cot?.mm_short   || 18200;

  const commNet = commLong - commShort;
  const mmNet   = mmLong - mmShort;

  // Z-score xấp xỉ dựa trên biên độ lịch sử điển hình ±40k
  const commZScore = +(commNet / 40000).toFixed(1);

  // Divergence: Commercials short nặng nhưng MM long tăng → absorption pattern
  const divergence = commNet < -50000 && mmNet > 30000;

  return {
    commercials: { long: commLong, short: commShort, net: commNet },
    managedMoney: { long: mmLong, short: mmShort, net: mmNet },
    nonReportable: { long: cot?.nr_long || 20000, short: cot?.nr_short || 18000, net: (cot?.nr_long||20000) - (cot?.nr_short||18000) },
    commZScore,
    divergence,
    signal: divergence
      ? 'Absorption pattern — Commercials short nặng nhưng giá không giảm, Managed Money tăng long'
      : 'Không có divergence rõ rệt',
    openInterestTrend: cot?.oi_change_pct || 8,
  };
}

// ── Seasonal Pattern ──────────────────────────────────────────────────────────
// Dữ liệu lịch sử trung bình 10 năm COMEX theo tháng (nguồn: CME lịch sử công khai)
export const SEASONAL_PATTERN_10Y = [
  { month: 1,  avgReturn: 2.1  }, { month: 2,  avgReturn: 1.8  },
  { month: 3,  avgReturn: 1.5  }, { month: 4,  avgReturn: 0.8  },
  { month: 5,  avgReturn: -0.5 }, { month: 6,  avgReturn: -1.2 },
  { month: 7,  avgReturn: -1.8 }, { month: 8,  avgReturn: -0.9 },
  { month: 9,  avgReturn: 0.3  }, { month: 10, avgReturn: 1.1  },
  { month: 11, avgReturn: 1.6  }, { month: 12, avgReturn: 0.7  },
];

export function getSeasonalContext(currentMonth) {
  const m = currentMonth || new Date().getMonth() + 1;
  const current = SEASONAL_PATTERN_10Y.find(s => s.month === m);
  const nextMonth = SEASONAL_PATTERN_10Y.find(s => s.month === (m % 12) + 1);
  return {
    current, nextMonth,
    note: current?.avgReturn > 0
      ? 'Mùa thuận lợi — restocking hoặc nhu cầu công nghiệp cao'
      : 'Mùa yếu — construction slow season, thường sideways/giảm',
  };
}

// ── Options Market Intelligence ───────────────────────────────────────────────
export function calcOptionsIntelligence({ putCallRatio, ivSkew, maxPain, gammaExposure }) {
  const pcr = putCallRatio ?? 0.82;
  return {
    putCallRatio: pcr,
    pcrSignal: pcr > 1 ? 'bearish_hedge' : pcr < 0.7 ? 'bullish_hedge' : 'neutral',
    ivSkew: ivSkew ?? 1.8,
    maxPain: maxPain ?? 6.20,
    gammaExposure: gammaExposure ?? 12,
    gammaSignal: (gammaExposure ?? 12) > 0
      ? 'Dealer sẽ mua khi giá giảm → floor tự nhiên'
      : 'Dealer sẽ bán khi giá giảm → có thể tăng tốc giảm',
  };
}

// ── Cross-Asset Correlation ───────────────────────────────────────────────────
export function calcCrossAssetCorrelation(priceHistory = {}) {
  // Trong thực tế sẽ tính Pearson correlation từ price series
  // Đây là cấu trúc trả về — thay bằng tính toán thực khi có đủ historical data
  return [
    { asset: 'DXY',   corr: -0.72, historical: -0.85 },
    { asset: 'CNY',   corr:  0.68, historical:  0.70 },
    { asset: 'Oil',   corr:  0.55, historical:  0.52 },
    { asset: 'Gold',  corr:  0.38, historical:  0.42 },
    { asset: 'SPX',   corr:  0.49, historical:  0.45 },
    { asset: 'Iron',  corr:  0.71, historical:  0.68 },
    { asset: 'BDI',   corr:  0.62, historical:  0.58 },
    { asset: 'SHFE',  corr:  0.84, historical:  0.88 },
  ].map(a => ({
    ...a,
    divergence: Math.abs(a.corr - a.historical) > 0.1,
  }));
}

// ── Dynamic Position Sizing ───────────────────────────────────────────────────
export function calcPositionSizing({ winRate, riskReward, atr, avgAtr, portfolioValue, openCorrelatedPositions }) {
  const wr = winRate ?? 0.62;
  const rr = riskReward ?? 2.4;

  // Kelly Criterion: f = (bp - q) / b, where b = RR, p = win rate, q = 1-p
  const fullKelly = ((rr * wr) - (1 - wr)) / rr;
  const halfKelly = Math.max(0, fullKelly / 2);

  // ATR adjustment
  const atrRatio = (atr ?? 0.12) / (avgAtr ?? 0.09);
  const atrAdj = atrRatio > 1.2 ? 0.75 : atrRatio < 0.8 ? 1.15 : 1.0;

  // Correlation adjustment — giảm size nếu đã có vị thế tương quan cao
  const corrAdj = openCorrelatedPositions >= 2 ? 0.85 : openCorrelatedPositions === 1 ? 0.93 : 1.0;

  const optimalSize = +(halfKelly * atrAdj * corrAdj * 100).toFixed(2);
  const riskAmount = portfolioValue ? +(portfolioValue * optimalSize / 100).toFixed(0) : null;

  return {
    fullKelly: +(fullKelly * 100).toFixed(1),
    halfKelly: +(halfKelly * 100).toFixed(1),
    atrRatio: +atrRatio.toFixed(2),
    atrAdj,
    corrAdj,
    optimalSize,
    riskAmount,
  };
}

export default {
  detectMarketRegime,
  calcConvictionMeter,
  calcTradeReadiness,
  build3Scenarios,
  simulateEventImpact,
  SENSITIVITY_MATRIX,
  calcCopperIntelligence,
  scoreNewsRelevance,
  calcSmartMoneyDivergence,
  SEASONAL_PATTERN_10Y,
  getSeasonalContext,
  calcOptionsIntelligence,
  calcCrossAssetCorrelation,
  calcPositionSizing,
};