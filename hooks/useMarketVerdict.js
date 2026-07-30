/**
 * hooks/useMarketVerdict.js (bản 4 — KHÔNG fetch)
 * ─────────────────────────────────────────────────────────────
 * ĐÃ ĐỔI HOÀN TOÀN so với các bản trước: hook này KHÔNG còn tự gọi API
 * nào cả. Lý do: index.js gốc đã tính sẵn mọi thứ cần thiết (ti.pk1Score,
 * mh.pk2Score, s.dxy_chg, s.fear_greed, stress.bsRisk, regime, weights)
 * — tự fetch thêm sẽ tạo ra nguồn số liệu thứ 2 lệch với các tab khác.
 *
 * Hook giờ chỉ là 1 lớp useMemo mỏng, tính lại khi 1 trong các input đổi,
 * KHÔNG tính lại mỗi lần re-render (quan trọng cho performance).
 */
import { useMemo } from 'react';
import { buildDriverBreakdown, buildSummary, computeConfidence } from '../lib/calculations/verdict';

/**
 * @param {object} p
 * @param {number} p.pk1Score - ti.pk1Score
 * @param {number} p.pk2Score - mh.pk2Score
 * @param {number} p.dxyChg - s.dxy_chg
 * @param {number} p.fearGreed - s.fear_greed
 * @param {number} p.blackSwanRisk - stress.bsRisk
 * @param {object} p.weights - weights (từ getWeights(regime) đã có sẵn)
 */
export function useMarketVerdict({ pk1Score, pk2Score, dxyChg, fearGreed, blackSwanRisk, weights }) {
  return useMemo(() => {
    const drivers = buildDriverBreakdown({ pk1Score, pk2Score, dxyChg, fearGreed, blackSwanRisk, weights });
    return {
      drivers,
      summary: buildSummary(drivers),
      confidence: computeConfidence(drivers),
    };
  }, [pk1Score, pk2Score, dxyChg, fearGreed, blackSwanRisk, weights]);
}
