// lib/verdictData.js — Data fetching layer với caching + fallback
// Tất cả nguồn miễn phí: FRED, CFTC, Yahoo Finance, Alpha Vantage free tier

// ─── Cache store ──────────────────────────────────────────────────────────────
const CACHE = new Map();
const CACHE_TTL = {
  price:      2 * 60 * 1000,   // 2 phút
  fred:      60 * 60 * 1000,   // 1 giờ
  cot:       24 * 60 * 60 * 1000, // 24 giờ (CFTC report tuần)
  lme:        5 * 60 * 1000,   // 5 phút
  news:       5 * 60 * 1000,   // 5 phút
  options:   15 * 60 * 1000,   // 15 phút
};

function cacheGet(key) {
  const hit = CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > (CACHE_TTL[hit.type] || 300000)) {
    CACHE.delete(key);
    return null;
  }
  return hit.data;
}

function cacheSet(key, data, type = 'price') {
  CACHE.set(key, { data, ts: Date.now(), type });
}

// ─── FRED API (Federal Reserve) — miễn phí, không cần key cho nhiều series
export async function fetchFREDSeries(seriesId) {
  const cacheKey = `fred_${seriesId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    // FRED public data endpoint
    const url = `/api/fred?series=${seriesId}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`FRED ${res.status}`);
    const json = await res.json();
    const result = {
      value: json.observations?.[json.observations.length - 1]?.value,
      date:  json.observations?.[json.observations.length - 1]?.date,
      series: seriesId,
    };
    cacheSet(cacheKey, result, 'fred');
    return result;
  } catch (e) {
    console.warn(`[verdictData] FRED ${seriesId} fallback:`, e.message);
    return { value: null, series: seriesId, source: 'fallback' };
  }
}

// ─── CFTC COT Data — miễn phí (CFTC public API)
export async function fetchCOTData() {
  const cacheKey = 'cot_copper';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch('/api/cot', { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`COT ${res.status}`);
    const data = await res.json();
    cacheSet(cacheKey, data, 'cot');
    return data;
  } catch (e) {
    console.warn('[verdictData] COT fallback:', e.message);
    // Fallback từ dữ liệu tuần trước đã lưu
    return {
      mm_long:  62400,
      mm_short: 18200,
      comm_long: 45000,
      comm_short: 118000,
      net_mm: 44200,
      date: 'N/A',
      source: 'fallback',
    };
  }
}

// ─── Copper price + OHLCV từ Yahoo Finance (qua /api/price)
export async function fetchCopperPrice() {
  const cacheKey = 'cu_price';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch('/api/price?symbol=HG%3DF', {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`Price ${res.status}`);
    const data = await res.json();
    cacheSet(cacheKey, data, 'price');
    return data;
  } catch (e) {
    console.warn('[verdictData] Price fallback:', e.message);
    return { comex: 6.265, comex_chg_pct: 0, source: 'fallback' };
  }
}

// ─── LME Inventory (qua /api/lme proxy từ LME public data)
export async function fetchLMEInventory() {
  const cacheKey = 'lme_inv';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch('/api/lme', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`LME ${res.status}`);
    const data = await res.json();
    cacheSet(cacheKey, data, 'lme');
    return data;
  } catch (e) {
    console.warn('[verdictData] LME fallback:', e.message);
    return {
      total: 125000,
      prev:  137400,
      change: -12400,
      weeks_declining: 3,
      source: 'fallback',
    };
  }
}

// ─── Economic Calendar từ TradingEconomics free RSS / Investing.com
export async function fetchEconomicCalendar() {
  const cacheKey = 'econ_cal';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch('/api/calendar', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Calendar ${res.status}`);
    const data = await res.json();
    cacheSet(cacheKey, data, 'news');
    return data;
  } catch (e) {
    console.warn('[verdictData] Calendar fallback:', e.message);
    return {
      events: [
        { name:'CPI Mỹ (YoY)',impact:'high',time:'21:30',date:'Hôm nay',forecast:'3.1%',prev:'3.3%',affectsCu:'bearish_if_high' },
        { name:'Fed Minutes',impact:'high',time:'03:00',date:'Ngày mai',forecast:'Dovish?',prev:'',affectsCu:'bullish_if_dovish' },
        { name:'ISM Manufacturing PMI',impact:'medium',time:'15:30',date:'T6 tuần này',forecast:'48.5',prev:'48.7',affectsCu:'medium' },
        { name:'China Industrial Output',impact:'high',time:'09:30',date:'T2 tới',forecast:'+5.8%',prev:'+5.6%',affectsCu:'bullish_if_beat' },
      ],
      source: 'fallback',
    };
  }
}

// ─── News từ Reuters/Bloomberg RSS feed (qua /api/news NLP filter)
export async function fetchCopperNews() {
  const cacheKey = 'cu_news';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch('/api/news?commodity=copper', {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`News ${res.status}`);
    const data = await res.json();
    cacheSet(cacheKey, data, 'news');
    return data;
  } catch (e) {
    console.warn('[verdictData] News fallback:', e.message);
    return {
      items: [
        { score:9.2, title:'Chile Escondida workers vote on strike — 78% in favour', source:'Reuters', age:'14 phút', direction:'bull', tags:['Supply','Urgent'] },
        { score:7.8, title:'SHFE copper inventory falls 12,400t — 3rd consecutive week', source:'Bloomberg', age:'1 giờ', direction:'bull', tags:['Supply','Demand'] },
        { score:7.1, title:'Fed officials signal no rate cut until inflation at 2%', source:'WSJ', age:'2 giờ', direction:'bear', tags:['Macro'] },
        { score:6.4, title:'China $500B infrastructure stimulus — copper demand spike expected', source:'Caixin', age:'3 giờ', direction:'bull', tags:['Demand','Macro'] },
      ],
      filtered: 127,
      relevant: 4,
      source: 'fallback',
    };
  }
}

// ─── Google Trends proxy (qua /api/trends)
export async function fetchGoogleTrends() {
  const cacheKey = 'gtrends_cu';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch('/api/trends?keyword=copper+price', {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Trends ${res.status}`);
    const data = await res.json();
    cacheSet(cacheKey, data, 'news');
    return data;
  } catch (e) {
    console.warn('[verdictData] Trends fallback:', e.message);
    return { value: 68, change: 34, keyword: '铜价', source: 'fallback' };
  }
}

// ─── Fetch tất cả data song song với Promise.allSettled (không block nhau)
export async function fetchAllVerdictData(s = {}) {
  const [price, cot, lme, calendar, news, trends] = await Promise.allSettled([
    fetchCopperPrice(),
    fetchCOTData(),
    fetchLMEInventory(),
    fetchEconomicCalendar(),
    fetchCopperNews(),
    fetchGoogleTrends(),
  ]);

  const get = (r, fallback) => r.status === 'fulfilled' ? r.value : fallback;

  return {
    price:    get(price,    { comex: s.comex || 6.265 }),
    cot:      get(cot,      { mm_long: 62400, mm_short: 18200, comm_short: 118000 }),
    lme:      get(lme,      { total: 125000, change: -12400, weeks_declining: 3 }),
    calendar: get(calendar, { events: [] }),
    news:     get(news,     { items: [] }),
    trends:   get(trends,   { value: 68, change: 34 }),
    fetchedAt: Date.now(),
  };
}