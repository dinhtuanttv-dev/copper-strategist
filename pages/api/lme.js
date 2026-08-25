// pages/api/lme.js — LME Inventory proxy
// LME không có free public API chính thức — dùng TradingEconomics guest tier
// làm best-effort proxy. Nếu shape dữ liệu không khớp, code TỰ NHẬN BIẾT và
// báo đúng source thay vì âm thầm trả số giả.
//
// ═══ CHANGELOG (senior review) ═══════════════════════════════════════════════
// FIX-1 [nghiêm trọng — dữ liệu giả được dán nhãn là dữ liệu thật]:
//   `latest?.Value || 125000` dùng toán tử `||` — nếu TE trả shape khác kỳ
//   vọng (rất có thể, vì slug "lme-copper-stocks" không đảm bảo đúng field
//   TE thật sự dùng) thì `latest?.Value` luôn là undefined, code IM LẶNG
//   rơi về số hardcode 125000/137400 NHƯNG vẫn gắn `source:'tradingeconomics'`
//   như thể đó là dữ liệu live thật. UI (SourceBadge ở các tab khác) sẽ
//   hiển thị "📡 TradingEconomics" trong khi 100% là số bịa.
//   Fix: validate Value/PreviousValue phải là số hữu hạn thật sự trước khi
//        chấp nhận; nếu không, throw để rơi vào catch → source:'fallback'
//        đúng bản chất, không dán nhãn sai.
//
// FIX-2 [logic — weeks_declining là hằng số cứng, không tính toán]:
//   `weeks_declining: 3` bị hardcode NGAY CẢ trong nhánh "thành công", nghĩa
//   là dù dữ liệu total/prev có thay đổi thế nào, con số này vĩnh viễn là 3
//   — một chỉ số trông như "AI phân tích xu hướng" nhưng thực chất là số
//   bịa cố định, đánh lừa Trade Readiness Checklist ở tab Verdict.
//   Fix: thêm HISTORY rolling buffer (module-level, giữ tối đa 12 lần fetch
//        live gần nhất) để tính streak giảm liên tiếp THẬT từ dữ liệu quan
//        sát được — best-effort vì không có API lịch sử LME miễn phí thật,
//        nhưng ít nhất số liệu phản ánh đúng dữ liệu đã thấy, không bịa.
//
// FIX-3 [toán tử `||` với số 0]: nếu Value hợp lệ nhưng bằng 0 (edge case
//   hiếm nhưng có thể xảy ra), `0 || 125000` sẽ SAI thành 125000. Fix dùng
//   kiểm tra kiểu số tường minh (Number.isFinite) thay vì `||`.
//
// FIX-4 [ép kiểu an toàn]: TE đôi khi trả field số dạng string ("125000")
//   thay vì number — Number(latest.Value) trước khi kiểm tra isFinite.
//
// Lưu ý (không phải bug, chỉ để tránh nhầm lẫn khi bảo trì): field `s.lme`
// trong state chính của index.js (INIT.lme = 13285) là MỘT CHỈ SỐ KHÁC
// (không phải tồn kho tấn) — HOÀN TOÀN không liên quan tới `total/prev/
// change` mà endpoint này trả về. Không đổi gì ở đây, chỉ ghi chú để
// tránh nhầm khi map dữ liệu giữa các tab.
//
// Giữ nguyên: tên hàm handler, export default, CACHE/CACHE_TTL, URL cũ
// (không đủ căn cứ để khẳng định URL khác "đúng hơn" mà chưa kiểm chứng
// được — an toàn hơn là làm code ROBUST với mọi shape có thể xảy ra thay
// vì đoán một URL mới), toàn bộ field response giữ nguyên tên/shape.
// ═══════════════════════════════════════════════════════════════════════════

const CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 phút — giữ nguyên như bản gốc

// ─── FIX-2: rolling history để tính weeks_declining thật, không hardcode ─────
// Giữ tối đa 12 điểm dữ liệu live gần nhất (mỗi điểm ứng với 1 lần fetch
// thành công thực sự, không tính cache-hit) — đủ để ước lượng streak giảm.
const HISTORY = [];
const HISTORY_MAX = 12;

function recordHistory(total) {
  HISTORY.push({ ts: Date.now(), total });
  if (HISTORY.length > HISTORY_MAX) HISTORY.shift();
}

function computeWeeksDeclining() {
  if (HISTORY.length < 2) return null; // chưa đủ dữ liệu để kết luận
  let streak = 0;
  for (let i = HISTORY.length - 1; i > 0; i--) {
    if (HISTORY[i].total < HISTORY[i - 1].total) streak++;
    else break;
  }
  return streak;
}

// ─── FIX-1/3/4: validate số hữu hạn thật sự, không dùng `||` gây sai lệch ────
function toFiniteNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req, res) {
  const cacheKey = 'lme_inv';
  const hit = CACHE.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return res.status(200).json(hit.data);
  }

  try {
    // TradingEconomics free endpoint (giới hạn nhưng miễn phí) — giữ nguyên URL gốc
    const credential = process.env.TRADINGECONOMICS_API_KEY;
    const defaultUrl = credential
      ? `https://api.tradingeconomics.com/commodity/lme-copper-stocks?c=${encodeURIComponent(credential)}`
      : 'https://api.tradingeconomics.com/commodity/lme-copper-stocks?c=guest:guest';
    const url = process.env.LME_COPPER_STOCKS_URL || defaultUrl;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!resp.ok) throw new Error(`LME provider HTTP ${resp.status}`);
    const json = await resp.json();
    const latest = Array.isArray(json) ? json[0] : json;

    // FIX-1/3/4: chỉ chấp nhận nếu CẢ HAI field đều là số hữu hạn thật
    const total = toFiniteNumber(latest?.Value);
    const prev  = toFiniteNumber(latest?.PreviousValue);

    if (total === null || prev === null) {
      // Shape TE không khớp kỳ vọng — KHÔNG âm thầm dùng số hardcode dán
      // nhãn 'tradingeconomics'. Ném lỗi để rơi vào catch, trả fallback
      // trung thực với source:'fallback'.
      throw new Error('TE response shape không có Value/PreviousValue hợp lệ');
    }

    recordHistory(total); // FIX-2: chỉ ghi nhận khi dữ liệu live thực sự hợp lệ
    const computedStreak = computeWeeksDeclining();

    const data = {
      total,
      prev,
      change: total - prev,
      // FIX-2: dùng streak tính được nếu đã có đủ lịch sử, nếu chưa thì
      // fallback về số đơn lẻ dựa trên chiều đổi của lần đọc này (0 hoặc 1)
      // — KHÔNG còn hardcode "3" vô điều kiện như bản gốc.
      weeks_declining: computedStreak !== null ? computedStreak : (total < prev ? 1 : 0),
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