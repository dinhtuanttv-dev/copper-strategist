/**
 * pages/api/claude.js — Centralized AI Gateway v4
 * ─────────────────────────────────────────────────────────────
 * THIẾT KẾ LINH HOẠT: Model Gemini được điều khiển qua biến môi
 * trường GEMINI_MODEL — không cần redeploy khi Gemini ra model mới,
 * chỉ cần cập nhật biến môi trường trên Vercel là xong.
 *
 * Thứ tự ưu tiên model:
 *   1. process.env.GEMINI_MODEL  (tuỳ chỉnh qua Vercel env var)
 *   2. FALLBACK_MODELS[0]        (fallback tự động nếu model chính fail)
 *   3. FALLBACK_MODELS[1], [2]   (thử lần lượt cho đến khi có 1 thành công)
 *
 * CÁCH NÂNG CẤP MODEL KHI GEMINI RA VERSION MỚI:
 *   Vercel → Settings → Environment Variables → GEMINI_MODEL → đổi giá trị
 *   → Redeploy (hoặc chỉ cần trigger lại deploy) → xong, không sửa code.
 *
 * LỊCH SỬ MODEL ĐÃ THỬ VÀ KẾT QUẢ:
 *   gemini-1.5-flash        ❌ 404 v1beta
 *   gemini-1.5-flash-latest ❌ 404 v1beta
 *   gemini-2.0-flash        ❌ 429 (quota khi test liên tục)
 *   gemini-2.5-flash        ❌ 404 "no longer available to new users"
 *   gemini-2.5-flash-lite   → đang thử (khuyến nghị Google Aug 2026)
 *   gemini-3.5-flash-lite   → gợi ý từ user (thêm vào fallback list)
 *
 * THÊM AI PROVIDER MỚI (Claude/OpenAI/Grok...):
 *   1. Thêm adapter function callXxx() tương tự callGemini()
 *   2. Thêm vào PROVIDERS object
 *   3. Đổi PRIMARY_PROVIDER hoặc thêm logic fallback giữa providers
 *
 * Interface output giữ nguyên format Anthropic (content array) để
 * getTxt() / extractJ() trong toàn bộ project không cần sửa.
 */

// ─── Model config — đổi GEMINI_MODEL trên Vercel để nâng cấp ───────────────
const FALLBACK_MODELS = [
  'gemini-2.5-flash-lite',   // khuyến nghị Google Aug 2026
  'gemini-3.5-flash-lite',   // gợi ý user — sẽ hoạt động khi Gemini release
  'gemini-2.5-flash-preview-05-20', // preview model thường có sẵn
  'gemini-2.0-flash-lite',   // lite variant ít bị rate limit hơn
];

function getModel() {
  return process.env.GEMINI_MODEL || FALLBACK_MODELS[0];
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ─── Gọi Gemini với 1 model string cụ thể ──────────────────────────────────
async function callGeminiModel(model, { messages, max_tokens, system, apiKey }) {
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
  }));

  const body = {
    contents,
    generationConfig: { maxOutputTokens: max_tokens || 1000, temperature: 0.3 },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  const resp = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });

  const data = await resp.json();
  if (!resp.ok) {
    const err = Object.assign(
      new Error(data.error?.message || `HTTP ${resp.status}`),
      { status: resp.status, code: data.error?.code }
    );
    throw err;
  }

  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    model,
    usage: {
      input_tokens: data.usageMetadata?.promptTokenCount || 0,
      output_tokens: data.usageMetadata?.candidatesTokenCount || 0,
    },
  };
}

// ─── Thử lần lượt model list cho đến khi 1 thành công ───────────────────────
async function callGeminiWithFallback(payload, apiKey) {
  const primaryModel = getModel();
  // Xây danh sách thử: primary trước, rồi các fallback (bỏ qua primary nếu đã có)
  const modelsToTry = [
    primaryModel,
    ...FALLBACK_MODELS.filter((m) => m !== primaryModel),
  ];

  let lastErr;
  for (const model of modelsToTry) {
    try {
      const result = await callGeminiModel(model, { ...payload, apiKey });
      if (model !== primaryModel) {
        console.log(`[AI Gateway] Primary model ${primaryModel} failed, used fallback: ${model}`);
      }
      return { ...result, usedFallback: model !== primaryModel };
    } catch (err) {
      lastErr = err;
      // Chỉ thử fallback khi là lỗi "model không tồn tại/quota" — không retry lỗi API key
      const retryable = err.status === 404 || err.status === 429 || err.status === 503;
      if (!retryable) throw err;
      console.warn(`[AI Gateway] Model ${model} failed (${err.status}), trying next...`);
    }
  }
  throw lastErr;
}

// ─── Handler chính ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, max_tokens, system } = req.body || {};
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Thiếu hoặc sai định dạng messages' });
  }

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Thiếu biến môi trường GOOGLE_GENERATIVE_AI_API_KEY' });
  }

  try {
    const { text, model, usage, usedFallback } = await callGeminiWithFallback(
      { messages, max_tokens, system },
      apiKey
    );

    // Format Anthropic — giữ tương thích với getTxt() / extractJ() toàn project
    return res.status(200).json({
      content: [{ type: 'text', text }],
      model,
      provider: 'gemini',
      usedFallback: usedFallback || false,
      usage,
    });

  } catch (err) {
    console.error('[AI Gateway]', err.message);
    return res.status(err.status || 500).json({
      error: err.message,
      provider: 'gemini',
      hint: 'Cập nhật model mới: Vercel → Settings → Environment Variables → GEMINI_MODEL',
    });
  }
}
