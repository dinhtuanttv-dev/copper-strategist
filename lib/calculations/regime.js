/**
 * lib/calculations/regime.js
 * ─────────────────────────────────────────────────────────────
 * Pure functions — KHÔNG fetch, KHÔNG side-effect, chỉ nhận input/trả
 * output. Điều này giúp unit-test dễ dàng và không phá vỡ code khi
 * thay đổi nguồn dữ liệu phía trên.
 *
 * safeNum() là guard bắt buộc dùng ở MỌI nơi nhận input từ bên ngoài —
 * đây là cách xử lý triệt để lỗi "NaN/100" đã gặp trong bản trước:
 * thay vì để NaN lan truyền qua hàng loạt phép tính rồi hiện ra UI,
 * ta chặn nó ngay tại điểm vào của tầng tính toán.
 */

function safeNum(v, fallback = 0) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Phát hiện regime thị trường: risk-on / risk-off / stagflation.
 * Có "hysteresis" nhẹ (dùng ngưỡng lệch nhau cho vào/ra) để tránh
 * nhảy trạng thái liên tục khi số liệu dao động sát ngưỡng.
 */
function detectRegime({ dxyChg, fearGreed, cuGoldRatio, prevRegime }) {
  const dxy = safeNum(dxyChg, 0);
  const fg = safeNum(fearGreed, 50);
  const cg = safeNum(cuGoldRatio, 0.06);

  const stagflationScore = (dxy > 0 ? 1 : 0) + (fg < 40 ? 1 : 0) + (cg < 0.05 ? 1 : 0);
  const riskOffScore = (dxy > 0.3 ? 1 : 0) + (fg < 30 ? 1 : 0);
  const riskOnScore = (dxy < -0.1 ? 1 : 0) + (fg > 55 ? 1 : 0) + (cg > 0.058 ? 1 : 0);

  // Hysteresis: nếu regime trước là risk-on, cần điểm risk-off cao hơn
  // 1 bậc mới được chuyển, tránh nhấp nháy khi số liệu dao động nhẹ.
  const threshold = prevRegime === 'risk_on' ? 2 : 1;

  if (stagflationScore >= 2) return 'stagflation';
  if (riskOffScore >= threshold) return 'risk_off';
  if (riskOnScore >= 2) return 'risk_on';
  return prevRegime || 'risk_on';
}

function getWeights(regime) {
  const table = {
    risk_on: { technical: 0.35, fundamental: 0.3, macro: 0.15, sentiment: 0.1, blackswan: -0.1 },
    risk_off: { technical: 0.25, fundamental: 0.2, macro: 0.3, sentiment: 0.05, blackswan: -0.2 },
    stagflation: { technical: 0.2, fundamental: 0.25, macro: 0.35, sentiment: 0.05, blackswan: -0.15 },
  };
  return table[regime] || table.risk_on;
}

export { safeNum, detectRegime, getWeights };
