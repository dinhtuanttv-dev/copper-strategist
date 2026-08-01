/**
 * pages/api/session-stats.js
 * ─────────────────────────────────────────────────────────────
 * Tổng hợp mẫu giá đã thu thập thành số liệu THẬT cho:
 *   - Radar chu kỳ giá (trung bình biến động theo phiên/theo thứ)
 *   - Session Heatmap (biến động theo phiên × ngày trong tuần)
 *
 * Thuật toán (minh bạch, để dễ kiểm chứng):
 *   1. Gom mẫu theo (ngày, phiên) — mỗi nhóm cần >=2 mẫu mới tính được.
 *   2. Return của nhóm đó = (mẫu cuối - mẫu đầu) / mẫu đầu × 100.
 *   3. avgReturn theo phiên = trung bình return của phiên đó qua mọi
 *      ngày đã thu thập được.
 *   4. dataReady = true chỉ khi có đủ >= MIN_DAYS ngày dữ liệu — trước
 *      đó trả dataReady:false để UI biết hiển thị nhãn "đang tích luỹ
 *      dữ liệu" thay vì số liệu chưa đủ tin cậy thống kê.
 */
import { getAllSamples } from '../../lib/dataCollection/store';

const MIN_DAYS = 7; // ngưỡng tối thiểu để coi là "đủ tin cậy" — có thể chỉnh

function computeSessionReturns(samples) {
  const groups = {}; // key: `${dateKey}:${session}` -> [samples]
  samples.forEach((s) => {
    (s.sessions || []).forEach((session) => {
      const key = `${s.dateKey}:${session}`;
      (groups[key] = groups[key] || []).push(s);
    });
  });

  const bySession = {}; // session -> [returns theo từng ngày]
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
  const byDate = {}; // dateKey -> [samples]
  samples.forEach((s) => (byDate[s.dateKey] = byDate[s.dateKey] || []).push(s));

  const byWeekday = {}; // 0-6 -> [returns]
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
      sampleCount: samples.length,
    });
  } catch (err) {
    res.status(200).json({ dataReady: false, error: err.message, sessionReturns: {}, weekdayReturns: {} });
  }
}
