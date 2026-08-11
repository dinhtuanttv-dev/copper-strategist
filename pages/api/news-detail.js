import { getCached, setCached } from '../../lib/dataCollection/store';

const TTL_SECONDS = 24 * 60 * 60;

function cacheKeyFor(title) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash << 5) - hash + title.charCodeAt(i);
    hash |= 0;
  }
  return `news-detail:${hash}`;
}

function extractAnalysis(text) {
  if (!text || !text.trim()) return null;
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (parsed?.analysis && typeof parsed.analysis === 'string') return parsed.analysis.trim();
  } catch {}
  try {
    const match = text.match(/\{[^{}]*"analysis"\s*:\s*"([^"]+)"[^{}]*\}/);
    if (match?.[1]) return match[1].trim();
  } catch {}
  const cleaned = text.replace(/```[a-z]*/gi, '').replace(/```/g, '').replace(/^#+\s*/gm, '').trim();
  if (cleaned.length > 30) return cleaned;
  return null;
}

export default async function handler(req, res) {
  const { title } = req.query;
  if (!title || typeof title !== 'string') return res.status(400).json({ error: 'Thieu title' });

  const key = cacheKeyFor(title);
  try {
    const cached = await getCached(key);
    if (cached?.analysis) return res.status(200).json({ ...cached, fromCache: true });
  } catch (e) { console.warn('[news-detail] cache read:', e.message); }

  try {
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${process.env.PORT || 3000}`;
    const aiRes = await fetch(`${baseUrl}/api/claude`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        max_tokens: 400,
        messages: [{ role: 'user', content: `Ban la chuyen gia phan tich thi truong dong. Day la tieu de tin tuc: "${title}"\n\nViet phan tich ngan 2-3 cau tieng Viet ve tac dong toi gia dong the gioi. Chi viet phan tich, khong giai thich gi them.` }],
      }),
    });
    const aiData = await aiRes.json();
    const rawText = (aiData.content || []).map(c => c.text || '').join('').trim();
    const analysis = extractAnalysis(rawText);

    if (!analysis) return res.status(200).json({ analysis: 'Khong tao duoc phan tich luc nay.', source: 'gemini', fromCache: false });

    const result = { analysis, source: 'gemini', analyzedAt: Date.now() };
    try { await setCached(key, result, TTL_SECONDS); } catch {}
    return res.status(200).json({ ...result, fromCache: false });

  } catch (err) {
    console.error('[news-detail]', err.message);
    return res.status(200).json({ analysis: null, error: err.message, source: 'gemini' });
  }
}
