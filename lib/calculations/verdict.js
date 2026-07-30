/**
 * lib/calculations/verdict.js
 * ─────────────────────────────────────────────────────────────
 * Pure function — KHÔNG fetch, KHÔNG side-effect. Tổng hợp PK1/PK2/macro/
 * sentiment/blackswan (đã tính sẵn trong index.js gốc) thành 1 bảng phân
 * rã "driver" dễ đọc cho Command Center.
 *
 * LƯU Ý QUAN TRỌNG: đây là bản tóm tắt cấp cao, dễ đọc — KHÔNG phải phân
 * rã chính xác từng số hạng của công thức `bias` gốc trong index.js
 * (công thức đó gồm nhiều biến nội bộ: pciA, cgI.adj, handoff.score,
 * curveInfo.biasAdj... không tách rời thành driver riêng lẻ được). Mục
 * đích của bảng này là giúp người dùng nắm nhanh "cái gì đang kéo/kìm",
 * KHÔNG thay thế tab Verdict/Kế hoạch phiên chi tiết đã có.
 */

function safeNum(v, fallback = 0) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : fallback;
}

function mkDriver(id, label, score, weight) {
  const s = safeNum(score, 50);
  const w = safeNum(weight, 0);
  return {
    id,
    label,
    score: s,
    contribution: Math.round((s - 50) * w),
    signal: s > 60 ? 'bullish' : s < 40 ? 'bearish' : 'neutral',
  };
}

/**
 * @param {number} pk1Score - ti.pk1Score (đã tính sẵn trong index.js)
 * @param {number} pk2Score - mh.pk2Score (đã tính sẵn trong index.js)
 * @param {number} dxyChg - s.dxy_chg (đã có sẵn)
 * @param {number} fearGreed - s.fear_greed (đã có sẵn, 0-100)
 * @param {number} blackSwanRisk - stress.bsRisk (đã có sẵn từ runStress)
 * @param {object} weights - weights (đã có sẵn từ getWeights(regime) trong index.js)
 */
export function buildDriverBreakdown({ pk1Score, pk2Score, dxyChg, fearGreed, blackSwanRisk, weights }) {
  const macroScore = Math.max(0, Math.min(100, 50 - safeNum(dxyChg, 0) * 8)); // DXY tăng -> macro giảm

  const drivers = [
    mkDriver('technical', 'Kỹ thuật (PK1)', pk1Score, weights?.technical ?? 0.3),
    mkDriver('fundamental', 'Nền tảng (PK2)', pk2Score, weights?.fundamental ?? 0.25),
    mkDriver('macro', 'Vĩ mô / DXY', macroScore, weights?.macro ?? 0.2),
    mkDriver('sentiment', 'Tâm lý (Fear&Greed)', fearGreed, weights?.sentiment ?? 0.1),
    mkDriver('blackswan', 'Black swan', 100 - safeNum(blackSwanRisk, 0), weights?.blackswan ?? -0.15),
  ];

  return drivers.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
}

export function buildSummary(drivers) {
  const top2 = drivers.slice(0, 2).map((d) => d.label).join(' và ');
  const drag = drivers.find((d) => d.contribution < 0);
  let text = `Động lực chính: ${top2}.`;
  if (drag) text += ` Bị kìm hãm bởi ${drag.label} (${drag.contribution}đ).`;
  return text;
}

export function computeConfidence(drivers) {
  const scores = drivers.map((d) => d.score);
  const spread = Math.max(...scores) - Math.min(...scores);
  return spread < 20 ? 'cao' : spread < 40 ? 'trung bình' : 'thấp';
}
