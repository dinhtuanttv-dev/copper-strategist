/**
 * pages/api/claude.js — AI gateway (dùng Anthropic API trực tiếp)
 * ─────────────────────────────────────────────────────────────
 * LỊCH SỬ:
 *   v1: OpenRouter → hết credit ($0)
 *   v2: Gemini → quota 429 + key không có quyền model 1.5
 *   v3 (bản này): Anthropic API trực tiếp — ANTHROPIC_API_KEY đã có
 *      sẵn trong Vercel từ Aug 1, chưa được dùng lần nào.
 *
 * Interface giữ nguyên 100%: mọi nơi gọi /api/claude với body
 * {model, max_tokens, messages} vẫn hoạt động không sửa gì.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'; // rẻ nhất, nhanh nhất

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY chưa được cấu hình' });
  }

  const { messages, max_tokens, system, model } = req.body || {};

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Thiếu tham số messages' });
  }

  try {
    const body = {
      model: DEFAULT_MODEL,
      max_tokens: max_tokens || 1000,
      messages,
    };

    if (system) body.system = system;

    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      console.error('[/api/claude→Anthropic]', JSON.stringify(data));
      return res.status(anthropicRes.status).json({
        error: data.error?.message || 'Anthropic API error',
        raw: data,
      });
    }

    // Trả về đúng format Anthropic — tương thích với getTxt()/extractJ() đang dùng
    return res.status(200).json(data);

  } catch (err) {
    console.error('[/api/claude→Anthropic]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
