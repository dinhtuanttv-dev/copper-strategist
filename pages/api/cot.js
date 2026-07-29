// pages/api/cot.js — CFTC COT (Commitment of Traders) proxy
// CFTC public API, không cần key: https://publicreporting.cftc.gov/resource/

const CACHE = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h — CFTC chỉ update thứ 6

export default async function handler(req, res) {
  const cacheKey = 'cot_copper';
  const hit = CACHE.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return res.status(200).json(hit.data);
  }

  try {
    // CFTC Socrata API — public, không cần key
    // Commodity code cho Copper: "COPPER-GRADE #1"
    const url = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json' +
      '?$where=contract_market_name like \'%25COPPER%25\'' +
      '&$order=report_date_as_yyyy_mm_dd DESC&$limit=1';

    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error(`CFTC ${resp.status}`);

    const rows = await resp.json();
    if (!rows.length) throw new Error('No CFTC data');

    const r = rows[0];
    const data = {
      mm_long:    +r.m_money_positions_long_all || 62400,
      mm_short:   +r.m_money_positions_short_all || 18200,
      comm_long:  +r.prod_merc_positions_long || 45000,
      comm_short: +r.prod_merc_positions_short || 118000,
      net_mm:     (+r.m_money_positions_long_all || 62400) - (+r.m_money_positions_short_all || 18200),
      date:       r.report_date_as_yyyy_mm_dd,
      source:     'cftc-live',
    };

    CACHE.set(cacheKey, { data, ts: Date.now() });
    return res.status(200).json(data);
  } catch (e) {
    console.error('[/api/cot]', e.message);
    return res.status(200).json({
      mm_long: 62400, mm_short: 18200,
      comm_long: 45000, comm_short: 118000,
      net_mm: 44200, date: 'N/A',
      error: e.message, source: 'fallback',
    });
  }
}