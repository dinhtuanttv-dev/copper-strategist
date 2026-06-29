export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ─── Đọc API key ─────────────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log('API Key prefix:', apiKey ? apiKey.slice(0, 12) : 'MISSING');

  if (!apiKey) {
    return res.status(500).json({ error: 'API key chưa cấu hình trong .env.local' });
  }

  try {
    // ─── Chuẩn hóa messages ───────────────────────────────────────────────
    const messages = (req.body.messages || []).map(m => ({
      role: m.role,
      content: typeof m.content === 'string'
        ? m.content
        : Array.isArray(m.content)
          ? m.content.map(c => c.text || c.content || '').join(' ')
          : JSON.stringify(m.content),
    }));

    // ─── Thêm system nếu có ───────────────────────────────────────────────
    if (req.body.system) {
      messages.unshift({ role: 'system', content: req.body.system });
    }

    const payload = {
      model:      'anthropic/claude-sonnet-4-5',
      max_tokens: req.body.max_tokens || 1000,
      messages,
    };

    console.log('Calling OpenRouter with model:', payload.model);

    // ─── Gọi OpenRouter ───────────────────────────────────────────────────
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer':  'http://localhost:3000',
        'X-Title':       'Copper Strategist',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log('OpenRouter status:', response.status);
    console.log('OpenRouter response keys:', Object.keys(data));

    // ─── Xử lý lỗi từ OpenRouter ─────────────────────────────────────────
    if (!response.ok) {
      console.error('OpenRouter error:', data);
      return res.status(response.status).json({
        error: data.error?.message || 'OpenRouter error',
        detail: data,
      });
    }

    // ─── Chuẩn hóa response về format Anthropic ──────────────────────────
    if (data.choices && data.choices[0]) {
      const text = data.choices[0].message?.content || '';
      const normalized = {
        content: [{ type: 'text', text }],
        model:       data.model,
        usage:       data.usage,
        stop_reason: data.choices[0].finish_reason,
      };
      return res.status(200).json(normalized);
    }

    return res.status(500).json({
      error: 'Không có choices trong response',
      raw:   data,
    });

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: error.message });
  }
}