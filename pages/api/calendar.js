// pages/api/calendar.js — Economic Calendar
// Nguồn miễn phí: TradingEconomics guest API hoặc Investing.com RSS

const CACHE = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 phút

// Sự kiện có ảnh hưởng trực tiếp đến đồng — whitelist
const COPPER_RELEVANT_EVENTS = [
  'CPI', 'Fed', 'FOMC', 'PMI', 'GDP', 'Industrial Production',
  'Retail Sales', 'PPI', 'Non-Farm', 'ISM',
];

function isRelevant(eventName) {
  return COPPER_RELEVANT_EVENTS.some(kw =>
    eventName.toLowerCase().includes(kw.toLowerCase())
  );
}

function classifyImpact(event) {
  if (event.name.includes('CPI') && event.actual > event.forecast) return 'bearish_if_high';
  if (event.name.includes('Fed') || event.name.includes('FOMC')) return 'bullish_if_dovish';
  if (event.name.includes('PMI')) return 'bullish_if_beat';
  return 'medium';
}

export default async function handler(req, res) {
  const cacheKey = 'econ_cal';
  const hit = CACHE.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return res.status(200).json(hit.data);
  }

  try {
    // TradingEconomics guest calendar (giới hạn requests nhưng miễn phí)
    const now = new Date();
    const to = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    const url = `https://api.tradingeconomics.com/calendar/country/united%20states,china` +
      `?c=guest:guest&d1=${now.toISOString().slice(0,10)}&d2=${to.toISOString().slice(0,10)}`;

    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error(`TE calendar ${resp.status}`);

    const raw = await resp.json();
    const events = (Array.isArray(raw) ? raw : [])
      .filter(e => isRelevant(e.Event || ''))
      .map(e => {
        const eventTime = new Date(e.Date);
        const minutesUntil = Math.round((eventTime - now) / 60000);
        return {
          name: e.Event,
          impact: e.Importance >= 3 ? 'high' : e.Importance === 2 ? 'medium' : 'low',
          time: eventTime.toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' }),
          date: eventTime.toLocaleDateString('vi-VN'),
          forecast: e.Forecast,
          prev: e.Previous,
          minutesUntil,
          affectsCu: classifyImpact({ name: e.Event, actual: e.Actual, forecast: e.Forecast }),
        };
      })
      .filter(e => e.minutesUntil > -60) // chỉ giữ sự kiện chưa qua quá 1h
      .sort((a, b) => a.minutesUntil - b.minutesUntil)
      .slice(0, 10);

    const data = { events, source: 'tradingeconomics' };
    CACHE.set(cacheKey, { data, ts: Date.now() });
    return res.status(200).json(data);

  } catch (e) {
    console.warn('[/api/calendar]', e.message);
    return res.status(200).json({
      events: [
        { name:'CPI Mỹ (YoY)', impact:'high', time:'21:30', date:'Hôm nay',
          forecast:'3.1%', prev:'3.3%', minutesUntil: 102, affectsCu:'bearish_if_high' },
        { name:'Fed Minutes', impact:'high', time:'03:00', date:'Ngày mai',
          forecast:'', prev:'', minutesUntil: 480, affectsCu:'bullish_if_dovish' },
        { name:'ISM Manufacturing PMI', impact:'medium', time:'15:30', date:'T6 tuần này',
          forecast:'48.5', prev:'48.7', minutesUntil: 2400, affectsCu:'medium' },
      ],
      error: e.message, source: 'fallback',
    });
  }
}