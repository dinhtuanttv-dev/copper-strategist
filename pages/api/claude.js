/**
 * pages/api/claude.js — Centralized AI Gateway
 * ─────────────────────────────────────────────────────────────
 * THIẾT KẾ: 1 endpoint duy nhất, hỗ trợ nhiều AI provider.
 * Hiện tại: Gemini 2.5 Flash (chủ lực, free tier 250 req/ngày)
 * Sẵn sàng thêm: Claude, OpenAI, Grok — chỉ cần thêm case vào
 * hàm routeToProvider() và thêm biến môi trường tương ứng.
 *
 * LỊCH SỬ LỖI ĐÃ SỬA:
 *   - OpenRouter: hết credit
 *   - gemini-1.5-flash: model không tồn tại ở v1beta (404)
 *   - gemini-2.0-flash: hết quota (429) vì test liên tục nhiều lần
 *   - gemini-2.5-flash: model đúng theo tài liệu tháng 8/2026
 *
 * CÁCH GỌI (interface giữ nguyên từ đầu dự án):
 *   POST /api/claude
 *   Body: { model?, max_tokens?, messages: [{role, content}], system? }
 *   Response: { content: [{type:"text", text:"..."}], model, usage }
 *
 * Trả về format Anthropic (content array) để không phải sửa
 * getTxt() và extractJ() đang dùng khắp nơi trong project.
 */

// ─── Cấu hình provider ──────────────────────────────────────────────────────
const PROVIDERS = {
  gemini: {
    model: 'gemini-2.5-flash',
    endpoint: (model) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    envKey: 'GOOGLE_GENERATIVE_AI_API_KEY',
    available: () => !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  },
  // Thêm provider mới ở đây khi cần:
  // anthropic: { ... },
  // openai: { ... },
};

const PRIMARY_PROVIDER = 'gemini';

// ─── Gemini request/response adapter ────────────────────────────────────────
async function callGemini({ messages, max_tokens, system, apiKey, model }) {
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{
      text: typeof m.content === 'string'
        ? m.content
        : JSON.stringify(m.content),
    }],
  }));

  const body = {
    contents,
    generationConfig: {
      maxOutputTokens: max_tokens || 1000,
      temperature: 0.3,
    },
  };

  if (system) {
    body.systemInstruction = { parts: [{ text: system }] };
  }

  const provider = PROVIDERS.gemini;
  const url = `${provider.endpoint(model)}?key=${apiKey}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });

  const data = await resp.json();

  if (!resp.ok) {
    const msg = data.error?.message || `Gemini HTTP ${resp.status}`;
    throw Object.assign(new Error(msg), { status: resp.status, raw: data });
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Trả về format Anthropic để tương thích với getTxt() / extractJ()
  return {
    content: [{ type: 'text', text }],
    model: PROVIDERS.gemini.model,
    provider: 'gemini',
    usage: {
      input_tokens: data.usageMetadata?.promptTokenCount || 0,
      output_tokens: data.usageMetadata?.candidatesTokenCount || 0,
    },
  };
}

// ─── Handler chính ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, max_tokens, system } = req.body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Thiếu hoặc sai định dạng messages' });
  }

  const provider = PROVIDERS[PRIMARY_PROVIDER];
  const apiKey = process.env[provider.envKey];

  if (!apiKey) {
    return res.status(500).json({
      error: `Thiếu biến môi trường ${provider.envKey}`,
      provider: PRIMARY_PROVIDER,
    });
  }

  try {
    const result = await callGemini({
      messages,
      max_tokens,
      system,
      apiKey,
      model: provider.model,
    });
    return res.status(200).json(result);

  } catch (err) {
    console.error(`[/api/claude→${PRIMARY_PROVIDER}]`, err.message);
    const status = err.status || 500;
    return res.status(status).json({
      error: err.message,
      provider: PRIMARY_PROVIDER,
      raw: err.raw,
    });
  }
}
