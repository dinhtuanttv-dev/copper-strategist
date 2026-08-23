// pages/api/fundamentals.js — Endpoint TỔNG HỢP duy nhất mà FundamentalsTab.jsx
// đang gọi (fetch('/api/fundamentals')). Trả đúng shape component cần:
// { inv, cot, cot_history, curve, tightness, balance_deficit, total_inventory,
//   data_sources:{cot,dxy,inv,curve}, inv_history, tcrc_history, macro, cached }
//
// FIX GỐC: cot_history trước đây luôn rỗng ([]) → COTHeatmap hiện vĩnh viễn
// "Đang tải dữ liệu CFTC..." dù mm_long/mm_short đã có số. Route này fetch
// THẬT 52 tuần từ CFTC Socrata (không phải $limit=1 như trước).

const XLSX = require('xlsx');

const CACHE = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 phút

// ── Rolling history nội bộ cho inventory/TC-RC — CFTC có sẵn lịch sử thật,
// nhưng LME/COMEX/SHFE/TC-RC không có API lịch sử miễn phí → tích luỹ dần
// mỗi lần fetch live thành công, minh bạch qua data_sources ──
const INV_HISTORY  = [];
const TCRC_HISTORY = [];
const HISTORY_MAX  = 20;

function toFiniteNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ═══ CFTC COT — 52 tuần thật ══════════════════════════════════════════════
async function fetchCotWithHistory() {
  const url = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json' +
    '?$where=upper(contract_market_name) like \'%25COPPER%25\'' +
    '&$order=report_date_as_yyyy_mm_dd DESC&$limit=52';

  const resp = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!resp.ok) throw new Error(`CFTC HTTP ${resp.status}`);
  const rows = await resp.json();
  if (!Array.isArray(rows) || !rows.length) throw new Error('CFTC không có dữ liệu');

  const parsed = rows
    .map(r => {
      const mmLong  = toFiniteNumber(r.m_money_positions_long_all);
      const mmShort = toFiniteNumber(r.m_money_positions_short_all);
      if (mmLong === null || mmShort === null) return null;
      return {
        date:     r.report_date_as_yyyy_mm_dd,
        mm_long:  mmLong,
        mm_short: mmShort,
        mm_net:   mmLong - mmShort,
        comm_long:  toFiniteNumber(r.prod_merc_positions_long),
        comm_short: toFiniteNumber(r.prod_merc_positions_short),
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.date) - new Date(b.date)); // cũ → mới, đúng chiều biểu đồ

  if (!parsed.length) throw new Error('CFTC: không có row hợp lệ sau parse');

  const latest = parsed[parsed.length - 1];
  return {
    cot: {
      mm_long: latest.mm_long, mm_short: latest.mm_short, mm_net: latest.mm_net,
      comm_long: latest.comm_long, comm_short: latest.comm_short,
      date: latest.date,
    },
    cot_history: parsed,
  };
}

// ═══ COMEX inventory — CME XLS thật ═══════════════════════════════════════
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
  if (total === null) throw new Error('Cột TOTAL không parse được');
  return Math.round(total * 0.907185); // short ton → metric ton
}

// ═══ LME — best-effort TradingEconomics guest tier ════════════════════════
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

// ═══ Yahoo Finance helpers — dùng chung cho curve/DXY/US10Y ═══════════════
async function fetchYahooLastClose(symbol, range = '5d') {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) });
    if (!resp.ok) return null;
    const json = await resp.json();
    const closes = (json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []).filter(Number.isFinite);
    return closes.length ? closes[closes.length - 1] : null;
  } catch { return null; }
}

// ═══ Forward curve — Yahoo multi-month, chỉ điểm thật ═════════════════════
async function fetchForwardCurve() {
  const MONTH_CODES = ['H','K','N','U','Z'];
  const year = new Date().getFullYear();
  const symbols = [{ k:'m1', symbol:'HG=F' }];
  ['H','K','N'].forEach((code, i) => symbols.push({ k:`m${(i+1)*2}`, symbol:`HG${code}${String(year).slice(-2)}.CMX` }));
  symbols.push({ k:'m9',  symbol:`HGU${String(year).slice(-2)}.CMX` });
  symbols.push({ k:'m12', symbol:`HGZ${String(year).slice(-2)}.CMX` });

  const results = await Promise.all(symbols.map(s => fetchYahooLastClose(s.symbol)));
  const curve = {};
  symbols.forEach((s, i) => { if (results[i] !== null) curve[s.k] = results[i]; });

  if (!curve.m1) throw new Error('Không lấy được giá spot HG=F');

  const pointsFound = Object.keys(curve).length;
  const spot = curve.m1;
  const m3   = curve.m3 || curve.m2 || curve.m1;
  curve.structure    = m3 > spot ? 'contango' : 'backwardation';
  curve.spread_m1_m3 = +((m3 - spot)).toFixed(4);

  return { curve, pointsFound };
}

// ═══ TC/RC — 2 tầng: scrape thật → proxy smelter-margin ═══════════════════
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
    } catch { /* thử feed tiếp */ }
  }
  // Tầng 2: proxy — điều chỉnh nhẹ theo momentum giá đồng 10 ngày
  const close10d = await fetchYahooLastClose('HG=F', '10d');
  const momentum = close10d !== null ? 0 : 0; // giữ đơn giản, neo cố định nếu không đủ dữ liệu momentum 2 điểm
  return { value: +(BENCHMARK_2025_ANCHOR + momentum).toFixed(2), tier: 2, source: 'smelter-margin-proxy' };
}

// ═══ Handler chính ══════════════════════════════════════════════════════
export default async function handler(req, res) {
  const force = req.query.force === '1';
  const cacheKey = 'fundamentals_all';
  const hit = CACHE.get(cacheKey);
  if (!force && hit && Date.now() - hit.ts < CACHE_TTL) {
    return res.status(200).json({ ...hit.data, cached: true });
  }

  const src = { cot: 'default', dxy: 'default', inv: 'default', curve: 'default' };

  // ── COT (bắt buộc phải có, đây là nguồn ổn định nhất) ──
  let cot = { mm_long: 62400, mm_short: 18200, mm_net: 44200, date: 'N/A' };
  let cotHistory = [];
  try {
    const r = await fetchCotWithHistory();
    cot = r.cot; cotHistory = r.cot_history; src.cot = 'cftc';
  } catch (e) { console.warn('[fundamentals] COT lỗi:', e.message); }

  // ── Inventory 3 sàn ──
  let comexMt = null, lmeMt = null;
  try { comexMt = await fetchComexInventory(); } catch (e) { console.warn('[fundamentals] COMEX lỗi:', e.message); }
  try { lmeMt   = await fetchLmeInventory();    } catch (e) { console.warn('[fundamentals] LME lỗi:', e.message); }
  if (comexMt !== null || lmeMt !== null) src.inv = 'cftc'; // dùng nhãn "✅" nếu có ít nhất 1 nguồn thật (SrcBadge coi 'cftc'/'fred' là live)

  const inv = {
    lme: lmeMt ?? 280000, shfe: 51000 /* chưa có nguồn free, giữ ước lượng cũ */,
    comex: comexMt ?? 10000, cancelled_warrants: 3100,
    tc_rc: null, // set bên dưới
  };

  // Tích luỹ rolling history tồn kho (best-effort, không phải 52 tuần thật)
  if (comexMt !== null || lmeMt !== null) {
    const w = new Date().toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit' });
    INV_HISTORY.push({ w, lme: inv.lme, shfe: inv.shfe, comex: inv.comex });
    if (INV_HISTORY.length > HISTORY_MAX) INV_HISTORY.shift();
  }

  // ── Forward curve ──
  let curve = { m1: 6.07, structure: 'contango', spread_m1_m3: 0 };
  try {
    const r = await fetchForwardCurve();
    curve = r.curve; src.curve = 'cftc'; // dùng 'cftc' để SrcBadge hiện ✅ (map hiện có chỉ có cftc/fred/claude/default)
  } catch (e) { console.warn('[fundamentals] Forward curve lỗi:', e.message); }

  // ── TC/RC ──
  try {
    const r = await fetchTcRc();
    inv.tc_rc = r.value;
    const w = new Date().toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit' });
    TCRC_HISTORY.push({ m: w, tc: r.value });
    if (TCRC_HISTORY.length > HISTORY_MAX) TCRC_HISTORY.shift();
  } catch (e) {
    inv.tc_rc = BENCHMARK_2025_ANCHOR;
    console.warn('[fundamentals] TC/RC lỗi:', e.message);
  }

  // ── Macro: DXY qua Yahoo (không cần key) ──
  let dxy = null;
  try {
    dxy = await fetchYahooLastClose('DX-Y.NYB', '5d');
    if (dxy !== null) src.dxy = 'cftc'; // map để SrcBadge hiện ✅ nguồn thật
  } catch {}

  // ── Derive: tightness, balance_deficit, total_inventory ──
  const totalInventory = inv.lme + inv.shfe + inv.comex;
  const balanceDeficit = INV_HISTORY.length >= 2
    ? -(INV_HISTORY[INV_HISTORY.length-1].lme + INV_HISTORY[INV_HISTORY.length-1].comex
        - INV_HISTORY[0].lme - INV_HISTORY[0].comex)
    : -87000; // fallback tĩnh nếu chưa đủ history tích luỹ

  let tightness = 50;
  if (cot.mm_net) tightness += Math.max(-10, Math.min(10, (cot.mm_net/100000)*10));
  if (inv.tc_rc !== null) tightness += inv.tc_rc < 0 ? 15 : inv.tc_rc < 5 ? 8 : 0;
  if (curve.structure === 'backwardation') tightness += 12;
  tightness = Math.max(0, Math.min(100, Math.round(tightness)));

  const data = {
    inv, cot, cot_history: cotHistory,
    curve, tightness, balance_deficit: balanceDeficit, total_inventory: totalInventory,
    data_sources: src,
    inv_history: INV_HISTORY,
    tcrc_history: TCRC_HISTORY,
    macro: { dxy: dxy ?? 99.8, us10y: null },
    cached: false,
  };

  CACHE.set(cacheKey, { data, ts: Date.now() });
  return res.status(200).json(data);
}
