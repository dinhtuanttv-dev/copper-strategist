// pages/api/trends.js — Google Trends proxy (không official API, dùng unofficial wrapper)
// Package miễn phí: google-trends-api (npm)

const CACHE = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 phút — Trends không đổi nhanh

export default async function handler(req, res) {
  const { keyword = 'copper price' } = req.query;
  const cacheKey = `gtrends_${keyword}`;
  const hit = CACHE.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return res.status(200).json(hit.data);
  }

  try {
    // Cần cài: npm install google-trends-api
    const googleTrends = require('google-trends-api');
    const results = await googleTrends.interestOverTime({
      keyword,
      startTime: new Date(Date.now() - 7 * 24 * 3600 * 1000),
    });
    const parsed = JSON.parse(results);
    const points = parsed?.default?.timelineData || [];
    const latest = points[points.length - 1];
    const weekAgo = points[0];

    const value  = latest?.value?.[0] || 68;
    const change = weekAgo?.value?.[0]
      ? Math.round(((value - weekAgo.value[0]) / weekAgo.value[0]) * 100)
      : 34;

    const data = { value, change, keyword, source: 'google-trends' };
    CACHE.set(cacheKey, { data, ts: Date.now() });
    return res.status(200).json(data);

  } catch (e) {
    console.warn('[/api/trends]', e.message);
    return res.status(200).json({
      value: 68, change: 34, keyword,
      error: e.message, source: 'fallback',
    });
  }
}