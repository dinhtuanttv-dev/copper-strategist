/**
 * lib/calculations/blackswan.js
 * ─────────────────────────────────────────────────────────────
 * Không đổi so với bản trước — file này thuần tính toán, không fetch
 * gì nên không xung đột với pages/api/*.js đã có sẵn.
 */
import { safeNum } from './regime';

const TYPE_WEIGHT = { acute: 1.0, structural: 0.7 };

export function computeBlackSwanRisk(events) {
  if (!Array.isArray(events) || events.length === 0) return 0;
  const weightedSum = events.reduce((sum, e) => {
    const impact = safeNum(e.impact, 0);
    const weight = TYPE_WEIGHT[e.bsType] ?? 0.8;
    return sum + impact * weight;
  }, 0);
  const totalWeight = events.reduce((sum, e) => sum + (TYPE_WEIGHT[e.bsType] ?? 0.8), 0);
  const risk = totalWeight > 0 ? weightedSum / totalWeight : 0;
  return Math.max(0, Math.min(100, Math.round(risk)));
}
