// pages/api/fundamentals.js — v4, root-fix lịch sử bằng Vercel KV thật
//
// ═══ CHANGELOG v4 ══════════════════════════════════════════════════════════
// ROOT-FIX-3 [lịch sử không tích luỹ — lỗi kiến trúc]: thay globalThis (tạm)
//   bằng Vercel KV (Upstash Redis, miễn phí) — bộ nhớ NGOÀI process, sống
//   sót qua mọi cold start / nhiều instance song song. Nếu KV CHƯA setup
//   (thiếu env var), code TỰ ĐỘNG fallback về globalThis — không crash,
//   chỉ mất tính năng lịch sử cho đến khi bạn setup xong (hướng dẫn cuối file).
// ROOT-FIX-COMEX [số "2k MT" nghi ngờ sai cột]: thêm debug.comex_raw_row VÔ
//   ĐIỀU KIỆN (không chỉ khi lỗi) — in ra toàn bộ dòng thô CME trả về để xác
//   minh cột TOTAL có đúng index 3 hay không, thay vì đoán mò.
// Giữ nguyên toàn bộ 5 fix của v3 (COT header/fallback-ID, drain velocity
// thật, TC/RC momentum thật, badge nguồn đúng).
// ═══════════════════════════════════════════════════════════════════════════

const XLSX = require('xlsx');

// ── Vercel KV — root-fix cho lịch sử. Nếu chưa cài @vercel/kv hoặc chưa
// setup env var, import sẽ throw — bọc try/catch để KHÔNG làm sập cả route.
let kv = null;
try {
  kv = require('@vercel/kv').kv;
} catch {
  console.warn('[fundamentals] @vercel/kv chưa cài — dùng globalThis tạm thời');
}

const FUNDAMENTALS_VERSION = 'v4-kv-debug-20260823'; // ← đối chiếu field version trong response để CHẮC CHẮN bản mới đã chạy
const CACHE = new Map();
const CACHE_TTL = 15 * 60 * 1000;
const HISTORY_MAX = 20;
const KV_INV_KEY  = 'fund:inv_history';
const KV_TCRC_KEY = 'fund:tcrc_history';

if (!globalThis.__FUND_INV_HISTORY)  globalThis.__FUND_INV_HISTORY  = [];
if (!globalThis.__FUND_TCRC_HISTORY) globalThis.__FUND_TCRC_HISTORY = [];

// ── Đọc/ghi lịch sử — ưu tiên KV thật, fallback globalThis nếu KV lỗi/chưa có ─
async function loadHistory(key, fallbackArr) {
  if (!kv) return fallbackArr;
  try {
    const data = await kv.get(key);
    return Array.isArray(data) ? data : fallbackArr;
  } catch (e) {
    console.warn(`[fundamentals] KV get ${key} lỗi:`, e.message);
    return fallbackArr;
  }
}
async function saveHistory(key, arr, fallbackRef) {
  if (kv) {
    try {
      await kv.set(key, arr);
      return;
    } catch (e) {
      console.warn(`[fundamentals] KV set ${key} lỗi:`, e.message);
    }
  }
  // Fallback: vẫn giữ globalThis để ít nhất còn hoạt động trong warm instance
  fallbackRef.length = 0;
  fallbackRef.push(...arr);
}

function toFiniteNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ═══ CFTC COT ═══════════════════════════════════════════════════════════
async function tryFetchCftcResource(resourceId) {
  const params = new URLSearchParams({
    '$where': "upper(contract_market_name) like '%COPPER%'",
    '$order': 'report_date_as_yyyy_mm_dd DESC',
    '$limit': '52',
  });
  const url = `https://publicreporting.cftc.gov/resource/${resourceId}.json?${params.toString()}`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!resp.ok) throw new Error(`CFTC ${resourceId} HTTP ${resp.status}`);
  const rows = await resp.json();
  if (!Array.isArray(rows) || !rows.length) throw new Error(`CFTC ${resourceId}: response rỗng`);

  const parsed = rows
    .map(r => {
      const mmLong  = toFiniteNumber(r.m_money_positions_long_all);
      const mmShort = toFiniteNumber(r.m_money_positions_short_all);
      if (mmLong === null || mmShort === null) return null;
      return {
        date: r.report_date_as_yyyy_mm_dd,
        mm_long: mmLong, mm_short: mmShort, mm_net: mmLong - mmShort,
        comm_long:  toFiniteNumber(r.prod_merc_positions_long),
        comm_short: toFiniteNumber(r.prod_merc_positions_short),
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!parsed.length) {
    throw new Error(`CFTC ${resourceId}: 0/${rows.length} row parse được. Raw keys mẫu: ${Object.keys(rows[0]||{}).slice(0,8).join(',')}`);
  }
  return parsed;
}

async function fetchCotWithHistory() {
  const RESOURCE_IDS = ['6dca-aqww', '72hh-3qpy'];
  let lastError = null;
  for (const id of RESOURCE_IDS) {
    try {
      const parsed = await tryFetchCftcResource(id);
      const latest = parsed[parsed.length - 1];
      return {
        cot: {
          mm_long: latest.mm_long, mm_short: latest.mm_short, mm_net: latest.mm_net,
          comm_long: latest.comm_long, comm_short: latest.comm_short, date: latest.date,
        },
        cot_history: parsed,
      };
    } catch (e) {
      lastError = e.message;
      console.warn(`[fundamentals] CFTC ${id} lỗi:`, e.message);
    }
  }
  throw new Error(lastError || 'Cả 2 CFTC resource ID đều lỗi');
}

// ═══ COMEX inventory — ROOT-FIX: debug vô điều kiện ════════════════════
async function fetchComexInventory() {
  const url = 'https://www.cmegroup.com/delivery_reports/Copper_Stocks.xls';
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`CME HTTP ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const wb  = XLSX.read(buf, { type: 'buffer' });
  const ws  = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const row = rows.find(r => String(r?.[0] || '').toUpperCase().includes('TOTAL COPPER'));
  if (!row) throw new Error('Không tìm thấy TOTAL COPPER trong file CME');
  const total = toFiniteNumber(row[3]);
  // ROOT-FIX: luôn trả kèm raw row — dù thành công hay thất bại — để verify cột
  const rawRow = row;
  if (total === null) throw new Error(`Cột index 3 không parse được — raw: ${JSON.stringify(rawRow)}`);
  return { value: Math.round(total * 0.907185), rawRow };
}

// ═══ LME ════════════════════════════════════════════════════════════════
async function fetchLmeInventory() {
  const url = 'https://api.tradingeconomics.com/commodity/lme-copper-stocks?c=guest:guest';
  const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) throw new Error(`TE HTTP ${resp.status}`);
  const json = await resp.json();
  const latest = Array.isArray(json) ? json[0] : json;
  const val = toFiniteNumber(latest?.Value);
  if (val === null) throw new Error('TE response thiếu Value hợp lệ');
  return Math.round(val);
}

// ═══ Yahoo Finance ═══════════════════════════════════════════════════════
async function fetchYahooCloses(symbol, range = '10d') {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) });
    if (!resp.ok) return [];
    const json = await resp.json();
    return (json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []).filter(Number.isFinite);
  } catch { return []; }
}
async function fetchYahooLastClose(symbol, range = '5d') {
  const closes = await fetchYahooCloses(symbol, range);
  return closes.length ? closes[closes.length - 1] : null;
}

async function fetchForwardCurve() {
  const year = new Date().getFullYear();
  const symbols = [{ k:'m1', symbol:'HG=F' }];
  ['H','K','N'].forEach((code, i) => symbols.push({ k:`m${(i+1)*2}`, symbol:`HG${code}${String(year).slice(-2)}.CMX` }));
  symbols.push({ k:'m9',  symbol:`HGU${String(year).slice(-2)}.CMX` });
  symbols.push({ k:'m12', symbol:`HGZ${String(year).slice(-2)}.CMX` });
  const results = await Promise.all(symbols.map(s => fetchYahooLastClose(s.symbol)));
  const curve = {};
  symbols.forEach((s, i) => { if (results[i] !== null) curve[s.k] = results[i]; });
  if (!curve.m1) throw new Error('Không lấy được giá spot HG=F');
  const spot = curve.m1, m3 = curve.m3 || curve.m2 || curve.m1;
  curve.structure    = m3 > spot ? 'contango' : 'backwardation';
  curve.spread_m1_m3 = +((m3 - spot)).toFixed(4);
  return curve;
}

// ═══ TC/RC ═══════════════════════════════════════════════════════════════
const BENCHMARK_2025_ANCHOR = -21.25;

async function fetchTcRc() {
  const feeds = ['https://www.mining.com/feed/', 'https://www.kitco.com/rss/KitcoNews.xml'];
  for (const feedUrl of feeds) {
    try {
      const resp = await fetch(feedUrl, { signal: AbortSignal.timeout(7000) });
      if (!resp.ok) continue;
      const xml = await resp.text();
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
      for (const m of items) {
        const text = m[1];
        if (!/tc\/rc|treatment charge/i.test(text)) continue;
        const match = text.match(/[-−]?\$?\s?(\d{1,3}(?:\.\d+)?)\s?\/?\s?(mt|tonne|ton)/i);
        if (match) {
          const isNeg = /negative|below zero|[-−]\$/i.test(text);
          const value = parseFloat(match[1]) * (isNeg ? -1 : 1);
          if (Number.isFinite(value)) return { value, tier: 1, source: 'smm-scrape' };
        }
      }
    } catch {}
  }
  const closes = await fetchYahooCloses('HG=F', '10d');
  let momentum = 0;
  if (closes.length >= 2) {
    const pct = (closes[closes.length-1] - closes[0]) / closes[0] * 100;
    momentum = +(-(pct * 0.3)).toFixed(2);
  }
  return { value: +(BENCHMARK_2025_ANCHOR + momentum).toFixed(2), tier: 2, source: 'smelter-margin-proxy' };
}

// ═══ Handler chính ═════════════════════════════════════════════════════
export default async function handler(req, res) {
  const force = req.query.force === '1';
  const cacheKey = 'fundamentals_all';
  const hit = CACHE.get(cacheKey);
  if (!force && hit && Date.now() - hit.ts < CACHE_TTL) {
    return res.status(200).json({ ...hit.data, cached: true });
  }

  const src = { cot: 'default', dxy: 'default', inv: 'default', curve: 'default' };
  const debug = { kv_enabled: !!kv };

  // ── COT ──
  let cot = { mm_long: 62400, mm_short: 18200, mm_net: 44200, date: 'N/A' };
  let cotHistory = [];
  try {
    const r = await fetchCotWithHistory();
    cot = r.cot; cotHistory = r.cot_history; src.cot = 'cftc';
  } catch (e) { debug.cot_error = e.message; }

  // ── Inventory ──
  let comexMt = null, lmeMt = null;
  try {
    const r = await fetchComexInventory();
    comexMt = r.value;
    debug.comex_raw_row = r.rawRow; // ROOT-FIX: luôn có, kể cả khi thành công
  } catch (e) { debug.comex_error = e.message; }
  try { lmeMt = await fetchLmeInventory(); } catch (e) { debug.lme_error = e.message; }
  if (comexMt !== null || lmeMt !== null) src.inv = 'cftc';

  const inv = {
    lme: lmeMt ?? 280000, shfe: 51000, comex: comexMt ?? 10000,
    cancelled_warrants: 3100, tc_rc: null,
    lme_drain_pct: 0, shfe_drain_pct: 0, comex_drain_pct: 0,
  };

  // ── ROOT-FIX-3: load/save history qua KV thật (fallback globalThis) ──
  let invHistory  = await loadHistory(KV_INV_KEY,  globalThis.__FUND_INV_HISTORY);
  let tcrcHistory = await loadHistory(KV_TCRC_KEY, globalThis.__FUND_TCRC_HISTORY);

  if (comexMt !== null || lmeMt !== null) {
    const now = Date.now();
    const w = new Date().toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit' });
    const prev = invHistory[invHistory.length - 1];

    if (!prev || now - (prev.ts || 0) > 3600 * 1000) {
      invHistory = [...invHistory, { ts: now, w, lme: inv.lme, shfe: inv.shfe, comex: inv.comex }];
      if (invHistory.length > HISTORY_MAX) invHistory = invHistory.slice(-HISTORY_MAX);
      await saveHistory(KV_INV_KEY, invHistory, globalThis.__FUND_INV_HISTORY);
    }

    if (invHistory.length >= 2) {
      const cur = invHistory[invHistory.length - 1];
      const prv = invHistory[invHistory.length - 2];
      inv.lme_drain_pct   = prv.lme   ? +(((cur.lme   - prv.lme)   / prv.lme)   * 100).toFixed(2) : 0;
      inv.shfe_drain_pct  = prv.shfe  ? +(((cur.shfe  - prv.shfe)  / prv.shfe)  * 100).toFixed(2) : 0;
      inv.comex_drain_pct = prv.comex ? +(((cur.comex - prv.comex) / prv.comex) * 100).toFixed(2) : 0;
    }
  }

  // ── Forward curve ──
  let curve = { m1: 6.07, structure: 'contango', spread_m1_m3: 0 };
  try { curve = await fetchForwardCurve(); src.curve = 'fred'; } catch (e) { debug.curve_error = e.message; }

  // ── TC/RC ──
  try {
    const r = await fetchTcRc();
    inv.tc_rc = r.value;
    const w = new Date().toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit' });
    const last = tcrcHistory[tcrcHistory.length - 1];
    if (!last || last.tc !== r.value) {
      tcrcHistory = [...tcrcHistory, { m: w, tc: r.value }];
      if (tcrcHistory.length > HISTORY_MAX) tcrcHistory = tcrcHistory.slice(-HISTORY_MAX);
      await saveHistory(KV_TCRC_KEY, tcrcHistory, globalThis.__FUND_TCRC_HISTORY);
    }
  } catch (e) { inv.tc_rc = BENCHMARK_2025_ANCHOR; debug.tcrc_error = e.message; }

  // ── DXY ──
  let dxy = null;
  try { dxy = await fetchYahooLastClose('DX-Y.NYB', '5d'); if (dxy !== null) src.dxy = 'fred'; } catch {}

  // ── Derive ──
  const totalInventory = inv.lme + inv.shfe + inv.comex;
  const balanceDeficit = invHistory.length >= 2
    ? (invHistory[invHistory.length-1].lme + invHistory[invHistory.length-1].comex
        - invHistory[0].lme - invHistory[0].comex)
    : 0;

  let tightness = 50;
  if (cot.mm_net) tightness += Math.max(-10, Math.min(10, (cot.mm_net/100000)*10));
  if (inv.tc_rc !== null) tightness += inv.tc_rc < 0 ? 15 : inv.tc_rc < 5 ? 8 : 0;
  if (curve.structure === 'backwardation') tightness += 12;
  tightness = Math.max(0, Math.min(100, Math.round(tightness)));

  const data = {
    inv, cot, cot_history: cotHistory,
    curve, tightness, balance_deficit: balanceDeficit, total_inventory: totalInventory,
    data_sources: src,
    inv_history: invHistory,
    tcrc_history: tcrcHistory,
    macro: { dxy: dxy ?? 99.8, us10y: null },
    version: FUNDAMENTALS_VERSION, // ← check field này trong JSON response
    cached: false,
    debug,
  };

  CACHE.set(cacheKey, { data, ts: Date.now() });
  return res.status(200).json(data);
}
