// pages/api/claude.js — OpenRouter proxy với token budget thấp (fix 402)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error:'ANTHROPIC_API_KEY not set' });

  const isOpenRouter = process.env.OPENROUTER === 'true';
  const body = req.body || {};

  // FIX 402: Giới hạn max_tokens ≤ 250 để không vượt credit
  const safeMaxTokens = Math.min(body.max_tokens || 250, 250);

  // Rút ngắn system prompt & content nếu quá dài
  const messages = (body.messages || []).map(m => ({
    ...m,
    content: typeof m.content === 'string'
      ? m.content.slice(0, 1500)  // Cắt bớt prompt dài
      : m.content,
  }));

  const payload = {
    model:      body.model || 'anthropic/claude-haiku-4-5', // Dùng Haiku (rẻ hơn)
    max_tokens: safeMaxTokens,
    messages,
  };

  const endpoint = isOpenRouter
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : 'https://api.anthropic.com/v1/messages';

  const headers = isOpenRouter
    ? {
        'Content-Type':   'application/json',
        'Authorization':  `Bearer ${apiKey}`,
        'HTTP-Referer':   'http://localhost:3000',
        'X-Title':        'Copper Strategist',
      }
    : {
        'Content-Type': 'application/json',
        'x-api-key':    apiKey,
        'anthropic-version': '2023-06-01',
      };

  try {
    const upstream = await fetch(endpoint, {
      method:  'POST',
      headers,
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(30000),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error('OpenRouter error:', JSON.stringify(data, null, 2));
      return res.status(upstream.status).json({
        error: data?.error?.message || 'API error',
        code:  upstream.status,
      });
    }

    // Normalize response: OpenRouter vs Anthropic format
    if (isOpenRouter) {
      // OpenRouter trả về OpenAI format
      const text = data?.choices?.[0]?.message?.content || '';
      return res.status(200).json({
        content: [{ type:'text', text }],
        model:   data.model,
        usage:   data.usage,
      });
    }

    // Anthropic format — trả thẳng
    return res.status(200).json(data);

  } catch(e) {
    console.error('[/api/claude] error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}