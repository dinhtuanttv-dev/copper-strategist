/**
 * pages/api/claude.js — AI gateway (đã đổi từ OpenRouter sang Gemini)
 * ─────────────────────────────────────────────────────────────
 * THAY ĐỔI: OpenRouter hết credit → chuyển sang Google Gemini API
 * (GOOGLE_GENERATIVE_AI_API_KEY đã có sẵn trong Vercel từ Jul 10,
 * free tier 1500 req/ngày — đủ dùng cho toàn bộ tính năng AI của app).
 *
 * Interface giữ nguyên 100% — mọi nơi gọi /api/claude với body
 * {model, max_tokens, messages} vẫn hoạt động không cần sửa gì.
 * Model string được map: claude-sonnet-4-5 → gemini-1.5-flash
 */

const GEMINI_MODEL = 'gemini-1.5-flash-latest'; // đúng tên cho API v1beta
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GOOGLE_GENERATIVE_AI_API_KEY chưa được cấu hình' });
  }

  const { messages, max_tokens, system } = req.body || {};

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Thiếu tham số messages' });
  }

  try {
    // Chuyển đổi format OpenAI/Anthropic → Gemini
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
    }));

    const body = {
      contents,
      generationConfig: {
        maxOutputTokens: max_tokens || 1000,
        temperature: 0.3,
      },
    };

    // Thêm system instruction nếu có
    if (system) {
      body.systemInstruction = { parts: [{ text: system }] };
    }

    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    });

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
      console.error('[/api/claude→Gemini] Error:', JSON.stringify(geminiData));
      return res.status(geminiRes.status).json({
        error: geminiData.error?.message || 'Gemini API error',
        raw: geminiData,
      });
    }

    // Chuyển response Gemini → format Anthropic (giữ tương thích với code cũ)
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return res.status(200).json({
      content: [{ type: 'text', text }],
      model: GEMINI_MODEL,
      usage: {
        input_tokens: geminiData.usageMetadata?.promptTokenCount || 0,
        output_tokens: geminiData.usageMetadata?.candidatesTokenCount || 0,
      },
    });
  } catch (err) {
    console.error('[/api/claude→Gemini]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
