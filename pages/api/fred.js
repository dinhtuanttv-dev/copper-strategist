// pages/api/fred.js — FRED (Federal Reserve Economic Data) proxy
// FRED có free API key đăng ký tại: https://fred.stlouisfed.org/docs/api/api_key.html
// Nếu chưa có key, dùng fallback từ static snapshot

const CACHE = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 giờ

export default async function handler(req, res) {
  const { series } = req.query;
  if (!series) return res.status(400).json({ error: 'Missing series param' });

  const cacheKey = `fred_${series}`;
  const hit = CACHE.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return res.status(200).json(hit.data);
  }

  const apiKey = process.env.FRED_API_KEY;

  if (!apiKey) {
    // Fallback: FRED cho phép fetch CSV không cần key qua endpoint công khai (giới hạn)
    try {
      const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const csv = await resp.text();
      const lines = csv.trim().split('\n');
      const lastLine = lines[lines.length - 1].split(',');
      const data = {
        observations: [{ date: lastLine[0], value: lastLine[1] }],
        source: 'fred-csv-noauth',
      };
      CACHE.set(cacheKey, { data, ts: Date.now() });
      return res.status(200).json(data);
    } catch (e) {
      return res.status(200).json({
        observations: [],
        error: e.message,
        source: 'fallback',
      });
    }
  }

  try {
    const url = `https://api.stlouisfed.org/fred/series/observations` +
      `?series_id=${series}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await resp.json();
    CACHE.set(cacheKey, { data, ts: Date.now() });
    return res.status(200).json(data);
  } catch (e) {
    return res.status(200).json({ observations: [], error: e.message, source: 'fallback' });
  }
}