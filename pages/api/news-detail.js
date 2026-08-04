/**
 * pages/api/news-detail.js
 * ─────────────────────────────────────────────────────────────
 * Phân tích sâu 1 tin — CHỈ gọi khi người dùng chủ động bấm mở rộng
 * (không tự động phân tích hàng loạt tin khi tải trang).
 *
 * Dùng lại /api/claude đã có sẵn (không tự setup Anthropic SDK/API
 * key riêng) — cùng pattern với pages/api/cron/collect-sample.js.
 *
 * Cache qua Upstash Redis (đã có sẵn từ pipeline trước) — TTL 24h vì
 * nội dung tin không đổi, tránh phân tích lại tốn phí vô ích.
 *
 * HIỆN TẠI: chỉ 1 nguồn AI (Claude). Gemini CHƯA được thêm — chờ
 * người dùng cung cấp API key riêng khi cần, đặt vào biến môi trường
 * GEMINI_API_KEY (KHÔNG bao giờ hardcode trong code). Khi thêm, tạo
 * hàm fetchGeminiAnalysis() riêng và hiển thị 2 khối tách biệt rõ
 * ràng — không gộp thành 1 "Consensus Score" (đã thống nhất tránh
 * thổi phồng độ tin cậy).
 */
import { getCached, setCached } from '../../lib/dataCollection/store';
import { extractJ, getTxt } from '../../lib/calculations';

const TTL_SECONDS = 24 * 60 * 60;

function cacheKeyFor(title) {
  // Hash đơn giản không cần thêm dependency — đủ dùng để tạo key ổn định
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash << 5) - hash + title.charCodeAt(i);
    hash |= 0;
  }
  return `news-detail:${hash}`;
}

export default async function handler(req, res) {
  const { title } = req.query;
  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'Thiếu tham số title' });
  }

  const key = cacheKeyFor(title);

  try {
    const cached = await getCached(key);
    if (cached) {
      return res.status(200).json({ ...cached, fromCache: true });
    }
  } catch (e) {
    console.warn('[/api/news-detail] cache read lỗi, tiếp tục gọi AI', e.message);
  }

  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT || 3000}`;

    const claudeRes = await fetch(`${baseUrl}/api/claude`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `Bạn là chuyên gia phân tích thị trường đồng. Đây là tiêu đề 1 tin tức: "${title}"
Viết phân tích ngắn (2-3 câu tiếng Việt) về tác động tới giá đồng thế giới, dựa trên hiểu biết chung, không suy đoán số liệu cụ thể không có trong tiêu đề.
Trả về CHỈ đúng JSON, không markdown: {"analysis":"<phân tích>"}`,
        }],
      }),
    });

    const claudeData = await claudeRes.json();
    const text = getTxt(claudeData);
    const parsed = extractJ(text);

    const result = {
      analysis: parsed?.analysis || 'Không tạo được phân tích lúc này.',
      source: 'claude',
      analyzedAt: Date.now(),
    };

    try {
      await setCached(key, result, TTL_SECONDS);
    } catch (e) {
      console.warn('[/api/news-detail] cache write lỗi (không chặn response)', e.message);
    }

    return res.status(200).json({ ...result, fromCache: false });
  } catch (err) {
    console.error('[/api/news-detail]', err.message);
    return res.status(200).json({ analysis: null, error: err.message, source: 'claude' });
  }
}
