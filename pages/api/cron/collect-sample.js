/**
 * pages/api/cron/collect-sample.js
 * ─────────────────────────────────────────────────────────────
 * Endpoint được Vercel Cron gọi định kỳ (cấu hình trong vercel.json).
 * KHÔNG viết lại logic fetch giá — gọi thẳng /api/price đã có sẵn
 * (Stooq → Yahoo → Claude search, đã qua review) để không có 2 nguồn
 * lấy giá khác nhau trong cùng 1 app.
 *
 * Bảo mật: Vercel Cron tự động gửi header
 *   Authorization: Bearer ${CRON_SECRET}
 * nếu bạn đặt biến môi trường CRON_SECRET — endpoint kiểm tra header
 * này để chặn người ngoài gọi tràn lan làm tốn quota Upstash.
 * Xem: https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
 */
import { recordSample } from '../../../lib/dataCollection/store';
import { getVnHour, getVnDateKey, getVnWeekday, getSessionsForHour } from '../../../lib/dataCollection/session';

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT || 3000}`;

    const priceRes = await fetch(`${baseUrl}/api/price`);
    const priceData = await priceRes.json();

    if (!priceData.comex || !Number.isFinite(priceData.comex)) {
      return res.status(200).json({ ok: false, reason: 'Giá không hợp lệ, bỏ qua lần này', priceData });
    }

    const ts = Date.now();
    const hourVn = getVnHour(ts);

    const sample = {
      ts,
      comex: priceData.comex,
      source: priceData.source || 'unknown',
      dateKey: getVnDateKey(ts),
      weekday: getVnWeekday(ts),
      hourVn,
      sessions: getSessionsForHour(hourVn),
    };

    await recordSample(sample);
    return res.status(200).json({ ok: true, sample });
  } catch (err) {
    console.error('[/api/cron/collect-sample]', err.message);
    return res.status(200).json({ ok: false, error: err.message });
  }
}

