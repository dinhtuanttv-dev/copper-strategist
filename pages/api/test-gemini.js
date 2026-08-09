/**
 * pages/api/test-gemini.js — endpoint test tạm thời
 * Xác nhận model Gemini nào đang hoạt động với key hiện tại.
 * XOÁ file này sau khi xác nhận xong.
 */
const MODELS_TO_TRY = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash-8b',
  'gemini-pro',
];

export default async function handler(req, res) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Không có key' });

  const results = {};
  for (const model of MODELS_TO_TRY) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Say OK' }] }],
            generationConfig: { maxOutputTokens: 10 },
          }),
          signal: AbortSignal.timeout(8000),
        }
      );
      const data = await r.json();
      if (r.ok) {
        results[model] = '✅ OK — ' + (data.candidates?.[0]?.content?.parts?.[0]?.text || '?');
      } else {
        results[model] = `❌ ${r.status}: ${data.error?.message?.slice(0, 80)}`;
      }
    } catch (e) {
      results[model] = `❌ timeout/error: ${e.message}`;
    }
  }
  return res.status(200).json(results);
}
