/**
 * pages/api/session-stats.js (bản 2 — thêm ma trận thứ × phiên)
 * ─────────────────────────────────────────────────────────────
 * Bổ sung computeSessionByWeekdayMatrix() để dựng Session Heatmap đầy
 * đủ (7 ngày × 4 phiên) theo đúng thiết kế ban đầu — dùng LẠI đúng dữ
 * liệu mẫu đã thu thập (mỗi mẫu đã có sẵn field weekday + sessions),
 * chỉ nhóm theo 2 chiều thay vì 1 chiều như hàm computeSessionReturns
 * cũ. Không cần thu thập thêm dữ liệu mới.
 *
 * Mỗi ô (thứ, phiên) cần NHIỀU lần lặp lại đúng tổ hợp đó mới đủ tin
 * cậy thống kê — sẽ mất nhiều tuần hơn so với ngưỡng MIN_DAYS=7 dùng
 * cho sessionReturns 1 chiều. UI phía client tự hiển thị "–" cho ô
 * chưa đủ dữ liệu, không hiển thị số chưa đáng tin.
 */
import { getAllSamples } from '../../lib/dataCollection/store';

const MIN_DAYS = 7;

function computeSessionReturns(samples) {
  const groups = {};
  samples.forEach((s) => {
    (s.sessions || []).forEach((session) => {
      const key = `${s.dateKey}:${session}`;
      (groups[key] = groups[key] || []).push(s);
    });
  });
  const bySession = {};
  Object.entries(groups).forEach(([key, group]) => {
    if (group.length < 2) return;
    const sorted = [...group].sort((a, b) => a.ts - b.ts);
    const first = sorted[0].comex, last = sorted[sorted.length - 1].comex;
    if (!first) return;
    const ret = ((last - first) / first) * 100;
    const session = key.split(':')[1];
    (bySession[session] = bySession[session] || []).push(ret);
  });
  const avg = {};
  Object.entries(bySession).forEach(([session, rets]) => {
    avg[session] = rets.reduce((a, b) => a + b, 0) / rets.length;
  });
  return avg;
}

function computeWeekdayReturns(samples) {
  const byDate = {};
  samples.forEach((s) => (byDate[s.dateKey] = byDate[s.dateKey] || []).push(s));
  const byWeekday = {};
  Object.values(byDate).forEach((group) => {
    if (group.length < 2) return;
    const sorted = [...group].sort((a, b) => a.ts - b.ts);
    const first = sorted[0].comex, last = sorted[sorted.length - 1].comex;
    if (!first) return;
    const ret = ((last - first) / first) * 100;
    const wd = sorted[0].weekday;
    (byWeekday[wd] = byWeekday[wd] || []).push(ret);
  });
  const avg = {};
  Object.entries(byWeekday).forEach(([wd, rets]) => {
    avg[wd] = rets.reduce((a, b) => a + b, 0) / rets.length;
  });
  return avg;
}

/** Ma trận (thứ × phiên) cho Session Heatmap đầy đủ 7×4 */
function computeSessionByWeekdayMatrix(samples) {
  const groups = {};
  samples.forEach((s) => {
    (s.sessions || []).forEach((session) => {
      const key = `${s.dateKey}:${session}`;
      (groups[key] = groups[key] || []).push(s);
    });
  });
  const matrix = {}; // key `${weekday}:${session}` -> [returns theo từng lần]
  Object.entries(groups).forEach(([key, group]) => {
    if (group.length < 2) return;
    const sorted = [...group].sort((a, b) => a.ts - b.ts);
    const first = sorted[0].comex, last = sorted[sorted.length - 1].comex;
    if (!first) return;
    const ret = ((last - first) / first) * 100;
    const session = key.split(':')[1];
    const weekday = sorted[0].weekday;
    const mkey = `${weekday}:${session}`;
    (matrix[mkey] = matrix[mkey] || []).push(ret);
  });
  const avgMatrix = {};
  Object.entries(matrix).forEach(([k, rets]) => {
    avgMatrix[k] = { avg: rets.reduce((a, b) => a + b, 0) / rets.length, count: rets.length };
  });
  return avgMatrix;
}

export default async function handler(req, res) {
  try {
    const samples = await getAllSamples();
    const distinctDays = new Set(samples.map((s) => s.dateKey)).size;
    const dataReady = distinctDays >= MIN_DAYS;

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({
      dataReady,
      distinctDays,
      minDaysRequired: MIN_DAYS,
      sessionReturns: computeSessionReturns(samples),
      weekdayReturns: computeWeekdayReturns(samples),
      sessionByWeekday: computeSessionByWeekdayMatrix(samples),
      sampleCount: samples.length,
    });
  } catch (err) {
    res.status(200).json({ dataReady: false, error: err.message, sessionReturns: {}, weekdayReturns: {}, sessionByWeekday: {} });
  }
}
