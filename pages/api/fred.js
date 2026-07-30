// pages/api/fred.js — FRED (Federal Reserve Economic Data) proxy
// FRED có free API key đăng ký tại: https://fred.stlouisfed.org/docs/api/api_key.html
// Nếu chưa có key, dùng fallback từ CSV endpoint công khai (giới hạn)
//
// ═══ CHANGELOG (senior review) ════════════════════════════════════════════════
// FIX-1 [nghiêm trọng — cache dữ liệu lỗi như dữ liệu hợp lệ]:
//   Cả 2 nhánh (có key / không key) không kiểm tra resp.ok trước khi parse.
//   Nếu FRED trả lỗi (series ID sai, rate-limit, key sai) → body là JSON
//   lỗi dạng {"error_code":400,...} hoặc trang HTML báo lỗi — code cũ vẫn
//   parse "thành công" và CACHE.set() luôn, khiến dữ liệu rác bị giữ trong
//   CACHE_TTL = 1 giờ, mọi request sau đó (kể cả khi FRED đã hết lỗi) vẫn
//   nhận dữ liệu hỏng cho tới khi cache hết hạn.
//   Fix: check resp.ok + validate shape JSON (không có error_code, có
//        observations là mảng) TRƯỚC khi cache; nếu bất thường → throw để
//        rơi vào catch, KHÔNG cache.
//
// FIX-2 [dữ liệu "." của FRED chưa được xử lý]:
//   FRED dùng ký tự "." để đánh dấu giá trị CHƯA CÔNG BỐ cho ngày đó (rất
//   phổ biến với series công bố theo quý/tháng khi tra đúng ngày mới nhất).
//   Code cũ lấy thẳng dòng cuối CSV / observation đầu tiên mà không kiểm
//   tra — có thể trả value:"." (không phải số) cho downstream, khiến các
//   phép tính ở Regime Detector nhận NaN mà không cảnh báo gì.
//   Fix: dò lùi tối đa 10 dòng/observation để tìm giá trị hợp lệ gần nhất,
//        đúng với cách các tổ chức tài chính vẫn làm khi đọc FRED.
//
// FIX-3 [đồng bộ dữ liệu giữa 2 nhánh — shape response khác nhau]:
//   Nhánh có API key trả nguyên object FRED gốc (kèm realtime_start,
//   observation_start, count, v.v.), còn nhánh không key chỉ trả
//   {observations:[{date,value}]} tối giản, không có field `source` nhất
//   quán. verdictData.js (client) đọc value/date từ observations[] nên
//   KHÔNG crash, nhưng shape lệch nhau gây khó debug & không đoán trước
//   được field nào luôn tồn tại.
//   Fix: chuẩn hoá CẢ 2 nhánh về cùng 1 shape tối giản
//        {observations:[{date,value}], source}, vẫn giữ đúng field
//        observations[].date / .value mà verdictData.js đang đọc — 
//        KHÔNG breaking, chỉ dọn sạch phần thừa.
//
// FIX-4 [an toàn tham số]: `series` có thể là mảng nếu URL có
//   ?series=A&series=B (Next.js query parsing) → template literal cũ sẽ
//   nối thành "A,B" gửi lên FRED, luôn lỗi mà không rõ nguyên nhân.
//   Fix: ép về string (lấy phần tử đầu nếu là mảng) + encodeURIComponent.
//
// FIX-5: limit=1 với sort_order=desc có rủi ro trúng đúng observation
//   "." (FIX-2). Nhánh có key đổi sang limit=5 để có đủ dữ liệu dò lùi,
//   nhưng response trả về CHO CLIENT vẫn chỉ 1 observation (giữ đúng
//   hành vi/kỳ vọng cũ của verdictData.js).
//
// Giữ nguyên: tên hàm handler, export default, tên CACHE/CACHE_TTL, tên
// query param `series`, cấu trúc rẽ nhánh có-key/không-key như bản gốc.
// ═══════════════════════════════════════════════════════════════════════════

const CACHE = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 giờ — giữ nguyên như bản gốc

// ─── FIX-2: dò lùi tìm observation hợp lệ gần nhất (không phải "." / rỗng) ───
function findLatestValidObservation(observations) {
  for (let i = 0; i < observations.length; i++) {
    const obs = observations[i];
    if (obs && obs.value !== '.' && obs.value !== '' && obs.value != null) {
      return obs;
    }
  }
  return null; // toàn bộ đều missing — hiếm nhưng có thể xảy ra
}

// ─── FIX-2 (CSV variant): parse nhiều dòng cuối, không chỉ 1 dòng ────────────
function parseLatestValidCSVLine(csvText) {
  const lines = csvText.trim().split('\n');
  // Dò lùi tối đa 10 dòng gần cuối (đủ cho series tháng/quý)
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 10); i--) {
    const cols = lines[i].split(',');
    const [date, value] = cols;
    if (date && value && value.trim() !== '.' && date.toLowerCase() !== 'date') {
      return { date: date.trim(), value: value.trim() };
    }
  }
  return null;
}

export default async function handler(req, res) {
  // FIX-4: chuẩn hoá series param — tránh mảng, tránh ký tự đặc biệt
  let { series } = req.query;
  if (Array.isArray(series)) series = series[0];
  if (!series) return res.status(400).json({ error: 'Missing series param' });
  series = String(series).trim();

  const cacheKey = `fred_${series}`;
  const hit = CACHE.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return res.status(200).json(hit.data);
  }

  const apiKey = process.env.FRED_API_KEY;
  const encSeries = encodeURIComponent(series); // FIX-4

  // ── Nhánh KHÔNG có API key: CSV endpoint công khai ───────────────────────
  if (!apiKey) {
    try {
      const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encSeries}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });

      // FIX-1: bắt lỗi HTTP trước khi parse — tránh coi trang lỗi là CSV hợp lệ
      if (!resp.ok) throw new Error(`FRED CSV HTTP ${resp.status}`);

      const csv = await resp.text();
      const latest = parseLatestValidCSVLine(csv); // FIX-2

      if (!latest) throw new Error('FRED CSV: không tìm thấy dòng dữ liệu hợp lệ');

      // FIX-3: shape thống nhất với nhánh có key
      const data = {
        observations: [{ date: latest.date, value: latest.value }],
        source: 'fred-csv-noauth',
      };
      CACHE.set(cacheKey, { data, ts: Date.now() }); // chỉ cache khi đã validate xong
      return res.status(200).json(data);

    } catch (e) {
      console.warn('[/api/fred:csv]', series, e.message);
      // Không cache lỗi — giữ đúng hành vi gốc (retry lần fetch kế tiếp)
      return res.status(200).json({
        observations: [],
        error: e.message,
        source: 'fallback',
      });
    }
  }

  // ── Nhánh CÓ API key: FRED REST API chính thức ───────────────────────────
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations` +
      `?series_id=${encSeries}&api_key=${apiKey}&file_type=json` +
      `&sort_order=desc&limit=5`; // FIX-5: limit=5 để có đủ dữ liệu dò lùi

    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) throw new Error(`FRED API HTTP ${resp.status}`); // FIX-1

    const raw = await resp.json();

    // FIX-1: FRED trả lỗi vẫn HTTP 200 kèm error_code trong body ở một số trường hợp
    if (raw.error_code || !Array.isArray(raw.observations)) {
      throw new Error(raw.error_message || 'FRED API: response không hợp lệ');
    }

    const latest = findLatestValidObservation(raw.observations); // FIX-2
    if (!latest) throw new Error('FRED API: toàn bộ observations đều missing (".")');

    // FIX-3: chuẩn hoá shape — chỉ giữ đúng 1 observation mới nhất hợp lệ,
    // khớp 100% với những gì verdictData.js đang đọc (observations[].date/.value)
    const data = {
      observations: [{ date: latest.date, value: latest.value }],
      source: 'fred-api',
    };

    CACHE.set(cacheKey, { data, ts: Date.now() }); // chỉ cache khi đã validate xong
    return res.status(200).json(data);

  } catch (e) {
    console.warn('[/api/fred:api]', series, e.message);
    return res.status(200).json({ observations: [], error: e.message, source: 'fallback' });
  }
}