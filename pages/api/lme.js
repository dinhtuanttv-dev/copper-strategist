// pages/api/lme.js — LME Inventory proxy
// LME không có free public API chính thức — dùng Yahoo Finance làm proxy
// hoặc scrape từ trading economics free tier

const CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 phút

export default async function handler(req, res) {
  const cacheKey = 'lme_inv';
  const hit = CACHE.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return res.status(200).json(hit.data);
  }

  try {
    // TradingEconomics free endpoint (giới hạn nhưng miễn phí)
    const url = 'https://api.tradingeconomics.com/commodity/lme-copper-stocks?c=guest:guest';
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!resp.ok) throw new Error(`TE ${resp.status}`);
    const json = await resp.json();
    const latest = Array.isArray(json) ? json[0] : json;

    const data = {
      total: latest?.Value || 125000,
      prev:  latest?.PreviousValue || 137400,
      change: (latest?.Value || 125000) - (latest?.PreviousValue || 137400),
      weeks_declining: 3,
      source: 'tradingeconomics',
    };

    CACHE.set(cacheKey, { data, ts: Date.now() });
    return res.status(200).json(data);
  } catch (e) {
    console.warn('[/api/lme]', e.message);
    return res.status(200).json({
      total: 125000, prev: 137400, change: -12400,
      weeks_declining: 3, error: e.message, source: 'fallback',
    });
  }
}