/**
 * pages/api/cron/collect-sample.js
 * ─────────────────────────────────────────────────────────────
 * ĐÃ SỬA: baseUrl dùng VERCEL_URL (URL deployment ngẫu nhiên, có thể
 * bị chặn bởi deployment protection) → đổi sang domain cố định thật
 * của app, không phụ thuộc deployment nào.
 */
import { recordSample } from '../../../lib/dataCollection/store';
import { getVnHour, getVnDateKey, getVnWeekday, getSessionsForHour } from '../../../lib/dataCollection/session';

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Dùng domain cố định thay vì VERCEL_URL (URL deployment ngẫu nhiên
    // có thể bị deployment protection chặn, trả về HTML thay vì JSON)
    const baseUrl = 'https://copper-strategist.vercel.app';

    const priceRes = await fetch(`${baseUrl}/api/price`);
    const contentType = priceRes.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      const text = await priceRes.text();
      console.error('[collect-sample] /api/price khong tra JSON:', text.slice(0, 200));
      return res.status(200).json({ ok: false, reason: 'Response khong phai JSON', status: priceRes.status });
    }

    const priceData = await priceRes.json();

    if (!priceData.comex || !Number.isFinite(priceData.comex)) {
      return res.status(200).json({ ok: false, reason: 'Gia khong hop le', priceData });
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
    console.log('[collect-sample] Da ghi mau:', JSON.stringify(sample));
    return res.status(200).json({ ok: true, sample });

  } catch (err) {
    console.error('[/api/cron/collect-sample]', err.message);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
