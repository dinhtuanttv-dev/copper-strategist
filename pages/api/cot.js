// pages/api/cot.js — CFTC COT (Commitment of Traders) proxy
// CFTC public API, không cần key: https://publicreporting.cftc.gov/resource/
//
// ═══ CHANGELOG (senior review) ════════════════════════════════════════════════
// FIX-1 [nghiêm trọng — dữ liệu giả dán nhãn 'cftc-live', giống bug đã tìm ở
//        lme.js]: `+r.m_money_positions_long_all || 62400` dùng `||` — nếu
//   resource 6dca-aqww không có đúng field này (rất có thể vì mỗi bảng COT
//   của CFTC có schema riêng, chưa kiểm chứng được field chính xác), code
//   IM LẶNG rơi về toàn bộ số hardcode nhưng vẫn gắn source:'cftc-live' —
//   UI hiển thị như dữ liệu thật 24h liền (CACHE_TTL) dù 100% là số bịa.
//   Fix: validate CẢ 4 field chính (mm_long/mm_short/comm_long/comm_short)
//        bằng Number.isFinite() trước khi chấp nhận + cache; nếu bất kỳ
//        field nào thiếu → throw → catch → source:'fallback' đúng bản chất.
//
// FIX-2 [đồng bộ dữ liệu giữa các tầng — nghiêm trọng nhất]:
//   lib/verdictCalculations.js → calcSmartMoneyDivergence(cot) đọc:
//     cot?.nr_long, cot?.nr_short   (Non-reportable traders — nhóm thứ 3
//                                    trong SmartMoneyCard)
//     cot?.oi_change_pct            (Open Interest trend hiển thị trong
//                                    SmartMoneyCard)
//   NHƯNG /api/cot.js CHƯA BAO GIỜ trả 3 field này — calcSmartMoneyDivergence
//   luôn rơi về fallback cứng (20000/18000/8%) BẤT KỂ API có chạy đúng hay
//   không. Nhóm "Non-reportable" và "Open Interest trend" trong Tầng-3
//   Behavioral Edge — vốn được quảng bá là dữ liệu CFTC thật — thực chất
//   VĨNH VIỄN là số giả cố định.
//   Fix: bổ sung nr_long/nr_short (field chuẩn CFTC: nonrept_positions_
//        long_all/short_all) và oi_change_pct (tính từ open_interest_all
//        tuần này so tuần trước, cần $limit=2 thay vì $limit=1 — xem FIX-3).
//        Đây là field MỚI, thuần additive — không đổi/xoá field cũ nào nên
//        KHÔNG breaking với bất kỳ consumer nào đang đọc mm_long/comm_short.
//
// FIX-3 [cần 2 dòng dữ liệu để tính % thay đổi thật]: $limit=1 (bản gốc)
//   chỉ lấy được 1 tuần nên KHÔNG THỂ tính oi_change_pct thực — buộc phải
//   hardcode. Đổi sang $limit=2 (tuần mới nhất + tuần trước) để so sánh
//   open_interest_all thật; row[0] vẫn dùng cho mm_long/comm_long/date như
//   cũ — hành vi các field gốc không đổi.
//
// FIX-4: bọc .json() riêng — Socrata trả HTML nếu cú pháp SoQL sai, JSON.parse
//   sẽ throw giữa chừng nếu không bọc rõ (đã nằm trong try/catch tổng nên
//   không crash, nhưng thêm log rõ nguyên nhân để dễ debug).
//
// FIX-5: LIKE query thêm upper() để không phụ thuộc case chính xác của
//   contract_market_name — robustness nhỏ, an toàn, không đổi hành vi khi
//   dữ liệu đã đúng case như hiện tại.
//
// Giữ nguyên: tên hàm handler, export default, CACHE/CACHE_TTL (24h),
// TOÀN BỘ field response cũ (mm_long, mm_short, comm_long, comm_short,
// net_mm, date, source) — không đổi tên/giá trị mặc định fallback.
// ═══════════════════════════════════════════════════════════════════════════

const CACHE = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h — CFTC chỉ update thứ 6, giữ nguyên
const AdmZip = require('adm-zip');
const XLSX = require('xlsx');

// ─── FIX-1: validate số hữu hạn thật, không dùng `||` (giống chuẩn lme.js) ───
function toFiniteNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function fetchOfficialArchive() {
  const year = new Date().getUTCFullYear();
  const resp = await fetch(`https://www.cftc.gov/files/dea/history/deacot${year}.zip`, {
    headers: { Accept: 'application/zip', 'User-Agent': 'copper-strategist/1.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!resp.ok) throw new Error(`CFTC archive ${resp.status}`);
  const zip = new AdmZip(Buffer.from(await resp.arrayBuffer()));
  const entry = zip.getEntry('annual.txt');
  if (!entry) throw new Error('CFTC archive thiếu annual.txt');
  const workbook = XLSX.read(entry.getData().toString('utf8'), { type: 'string' });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: null });
  const copperRows = rows
    .filter(row => String(row['Market and Exchange Names'] || '').toUpperCase().includes('COPPER'))
    .sort((a, b) => String(b['As of Date in Form YYYY-MM-DD']).localeCompare(String(a['As of Date in Form YYYY-MM-DD'])));
  const latest = copperRows[0];
  const previous = copperRows[1];
  if (!latest) throw new Error('CFTC archive không có dòng COPPER');
  const mmLong = toFiniteNumber(latest['Noncommercial Positions-Long (All)']);
  const mmShort = toFiniteNumber(latest['Noncommercial Positions-Short (All)']);
  const commLong = toFiniteNumber(latest['Commercial Positions-Long (All)']);
  const commShort = toFiniteNumber(latest['Commercial Positions-Short (All)']);
  if ([mmLong, mmShort, commLong, commShort].some(value => value === null)) {
    throw new Error('CFTC archive thiếu field Copper hợp lệ');
  }
  const nrLong = toFiniteNumber(latest['Nonreportable Positions-Long (All)']);
  const nrShort = toFiniteNumber(latest['Nonreportable Positions-Short (All)']);
  const oi = toFiniteNumber(latest['Open Interest (All)']);
  const previousOi = toFiniteNumber(previous?.['Open Interest (All)']);
  const rawDate = latest['As of Date in Form YYYY-MM-DD'];
  const date = typeof rawDate === 'number'
    ? new Date(Math.round((rawDate - 25569) * 86400 * 1000)).toISOString().slice(0, 10)
    : String(rawDate || 'N/A');
  return {
    mm_long: mmLong, mm_short: mmShort, comm_long: commLong, comm_short: commShort,
    net_mm: mmLong - mmShort, date,
    nr_long: nrLong, nr_short: nrShort,
    oi_change_pct: oi !== null && previousOi ? +(((oi - previousOi) / previousOi) * 100).toFixed(1) : null,
    open_interest: oi, source: 'cftc-official-archive',
  };
}

export default async function handler(req, res) {
  const cacheKey = 'cot_copper';
  const force = req.query.force === '1';
  const hit = CACHE.get(cacheKey);
  if (!force && hit && Date.now() - hit.ts < CACHE_TTL) {
    return res.status(200).json(hit.data);
  }

  try {
    // CFTC Socrata API — public, không cần key
    // Commodity code cho Copper: "COPPER-GRADE #1"
    // FIX-3: $limit=2 để có tuần trước tính oi_change_pct thật
    // FIX-5: upper() cho LIKE — không phụ thuộc case chính xác
    const baseUrl = process.env.CFTC_COT_URL || 'https://publicreporting.cftc.gov/resource/6dca-aqww.json';
    const separator = baseUrl.includes('?') ? '&' : '?';
    const url = baseUrl + separator +
      '$where=upper(contract_market_name) like \'%25COPPER%25\'' +
      '&$order=report_date_as_yyyy_mm_dd DESC&$limit=2';

    const headers = { Accept: 'application/json' };
    if (process.env.CFTC_APP_TOKEN) headers['X-App-Token'] = process.env.CFTC_APP_TOKEN;
    const resp = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error(`CFTC ${resp.status}`);

    // FIX-4: bọc riêng bước parse JSON
    let rows;
    try {
      rows = await resp.json();
    } catch (parseErr) {
      throw new Error(`CFTC trả non-JSON: ${parseErr.message}`);
    }

    if (!Array.isArray(rows) || !rows.length) throw new Error('No CFTC data');
    const r    = rows[0];        // tuần mới nhất
    const rPrev = rows[1] || null; // tuần trước (nếu có) — dùng cho oi_change_pct

    // ── FIX-1: validate 4 field chính — không âm thầm chấp nhận dữ liệu thiếu ──
    const mmLong    = toFiniteNumber(r.m_money_positions_long_all);
    const mmShort   = toFiniteNumber(r.m_money_positions_short_all);
    const commLong  = toFiniteNumber(r.prod_merc_positions_long);
    const commShort = toFiniteNumber(r.prod_merc_positions_short);

    if (mmLong === null || mmShort === null || commLong === null || commShort === null) {
      throw new Error('CFTC response thiếu field mm_long/mm_short/comm_long/comm_short hợp lệ');
    }

    // ── FIX-2: Non-reportable traders — field chuẩn CFTC, có thể không tồn tại
    // ở mọi resource nên xử lý mềm (null nếu thiếu, KHÔNG throw toàn request) ──
    const nrLong  = toFiniteNumber(r.nonrept_positions_long_all);
    const nrShort = toFiniteNumber(r.nonrept_positions_short_all);

    // ── FIX-2/3: Open Interest % thay đổi tuần này vs tuần trước ──────────────
    const oiNow  = toFiniteNumber(r.open_interest_all);
    const oiPrev = rPrev ? toFiniteNumber(rPrev.open_interest_all) : null;
    const oiChangePct = (oiNow !== null && oiPrev !== null && oiPrev !== 0)
      ? +(((oiNow - oiPrev) / oiPrev) * 100).toFixed(1)
      : null; // không đủ dữ liệu — để null thay vì bịa số

    const data = {
      // ── giữ nguyên 100% shape/field cũ ──
      mm_long:    mmLong,
      mm_short:   mmShort,
      comm_long:  commLong,
      comm_short: commShort,
      net_mm:     mmLong - mmShort,
      date:       r.report_date_as_yyyy_mm_dd,
      source:     'cftc-live',
      // ── field MỚI (thuần additive) — khớp đúng tên calcSmartMoneyDivergence cần ──
      nr_long:       nrLong,
      nr_short:      nrShort,
      oi_change_pct: oiChangePct,
      open_interest: oiNow,
    };

    CACHE.set(cacheKey, { data, ts: Date.now() }); // chỉ cache khi đã validate xong
    return res.status(200).json(data);

  } catch (e) {
    console.error('[/api/cot]', e.message);
    try {
      const archiveData = await fetchOfficialArchive();
      CACHE.set(cacheKey, { data: archiveData, ts: Date.now() });
      return res.status(200).json(archiveData);
    } catch (archiveError) {
      console.error('[/api/cot:archive]', archiveError.message);
    }
    return res.status(200).json({
      mm_long: 62400, mm_short: 18200,
      comm_long: 45000, comm_short: 118000,
      net_mm: 44200, date: 'N/A',
      // ── giữ nguyên default cho field mới khi fallback, khớp với những gì
      // calcSmartMoneyDivergence() đã tự fallback sẵn (20000/18000/8) ──
      nr_long: 20000, nr_short: 18000, oi_change_pct: 8, open_interest: null,
      error: e.message, source: 'fallback',
    });
  }
}