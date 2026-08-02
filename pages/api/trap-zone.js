/**
 * pages/api/trap-zone.js
 * ─────────────────────────────────────────────────────────────
 * Tính Trap Zone (vùng High/Low ước lượng) cho 3 phiên chính, dùng
 * LẠI đúng dữ liệu mẫu đã thu thập (không cần nguồn mới). Với mỗi
 * phiên, lấy ngày gần nhất có mẫu, tính max/min các mẫu trong phiên
 * đó của ngày đó.
 *
 * GIỚI HẠN TRUNG THỰC (bắt buộc hiểu trước khi dùng):
 *   - Đây là High/Low ước lượng từ các điểm lấy mẫu 20 phút/lần,
 *     KHÔNG phải dữ liệu tick — có thể bỏ lỡ đỉnh/đáy thật xảy ra
 *     giữa 2 lần lấy mẫu.
 *   - `count` càng thấp thì càng kém tin cậy — UI phía client PHẢI
 *     hiển thị con số này, không được giấu.
 */
import { getAllSamples } from '../../lib/dataCollection/store';

const SESSIONS = ['asia', 'london', 'new_york'];
const SESSION_LABELS = { asia: 'Châu Á', london: 'LME (Âu)', new_york: 'COMEX (Mỹ)' };
const ROUND_STEP = 0.05; // mốc tâm lý phổ biến cho đồng: $0.05/lb

function nearestRoundLevel(price) {
  return Math.round(price / ROUND_STEP) * ROUND_STEP;
}

function computeSessionRange(samples, session) {
  const relevant = samples.filter((s) => (s.sessions || []).includes(session));
  if (!relevant.length) return { count: 0, insufficient: true };

  const latestDateKey = relevant.reduce((max, s) => (s.dateKey > max ? s.dateKey : max), relevant[0].dateKey);
  const todays = relevant.filter((s) => s.dateKey === latestDateKey);
  if (todays.length < 2) return { count: todays.length, insufficient: true };

  const prices = todays.map((s) => s.comex).filter(Number.isFinite);
  if (prices.length < 2) return { count: todays.length, insufficient: true };

  return {
    high: Math.max(...prices),
    low: Math.min(...prices),
    count: todays.length,
    lastTs: Math.max(...todays.map((s) => s.ts)),
    dateKey: latestDateKey,
    insufficient: false,
  };
}

function buildScenario(range) {
  if (!range || range.insufficient) return null;
  const { high, low } = range;
  const width = high - low;
  const shortTarget = +(low - width * 0.3).toFixed(4);
  const longTarget = +(high + width * 0.3).toFixed(4);
  return {
    reversalText: `Giá quét qua $${high.toFixed(4)} rồi rút chân → cân nhắc Short về $${shortTarget}`,
    breakoutText: `Giá đóng cửa vững trên $${high.toFixed(4)} → cân nhắc Long theo xu hướng`,
    shortTarget,
    longTarget,
  };
}

export default async function handler(req, res) {
  try {
    const samples = await getAllSamples();
    const zones = {};

    SESSIONS.forEach((session) => {
      const range = computeSessionRange(samples, session);
      zones[session] = {
        label: SESSION_LABELS[session],
        range,
        roundLevel: range.insufficient ? null : nearestRoundLevel((range.high + range.low) / 2),
        scenario: buildScenario(range),
      };
    });

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ zones, computedAt: Date.now() });
  } catch (err) {
    res.status(200).json({ zones: {}, error: err.message, computedAt: Date.now() });
  }
}
