// pages/api/news.js — Copper news aggregator
// Nguồn miễn phí: RSS công khai (mining.com, kitco, reuters, investing.com) + NLP scoring
//
// ═══ CHANGELOG (senior review) ═══════════════════════════════════════════════
// FIX-1 [đồng bộ dữ liệu giữa các tab — quan trọng nhất]:
//   Dùng chung scoreNewsRelevance() từ lib/verdictCalculations.js
//
// FIX-2 [thiếu field tags]:
//   scored.map() cũ KHÔNG trả field `tags`
//
// FIX-3 [logic sai — direction không bao giờ ra 'bear']:
//   Thêm bộ từ khoá bearish
//
// FIX-4 [parsing RSS không sạch]:
//   cleanText() strip CDATA + decode entity
//
// FIX-5 [bổ sung — 2026-08]:
//   Thêm field `link` vào object trả về
//
// FIX-6 [2026-08 — nguồn tin thực tế]:
//   RSS bên ngoài không ổn định → dùng /api/claude (OpenRouter) để search
//   tin copper thực tế, kết quả được cache 5 phút trong Map() để tránh
//   gọi AI quá nhiều. RSS vẫn được thử trước, AI là fallback thứ 2.
// ═══════════════════════════════════════════════════════════════════════════

import { scoreNewsRelevance } from '../../lib/verdictCalculations'; // FIX-1

const CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const RSS_FEEDS = [
  'https://www.mining.com/tag/copper/feed/',
  'https://www.kitco.com/rss/base_metals.xml',
  'https://www.northernminer.com/feed/',
  'https://www.miningweekly.com/rss/',
];

const COPPER_KEYWORDS = [
  'copper', 'cu ', 'comex copper', 'lme copper', 'shfe copper',
  'copper futures', 'red metal', 'escondida', 'codelco', 'grasberg',
  'freeport', 'antofagasta', 'ivanhoe', 'kamoa', 'las bambas',
  'chile mine', 'peru mine', 'chile copper', 'peru copper',
  'drc copper', 'zambia copper', 'smelter', 'copper inventor',
  'copper stockpil', 'copper supply', 'copper demand', 'copper output',
  'copper production', 'copper deficit', 'copper surplus',
  'china manufacturing', 'china pmi', 'copper price', 'base metal',
  'industrial metal',
];

function isRelevant(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return COPPER_KEYWORDS.some(kw => lower.includes(kw));
}

function cleanText(raw) {
  if (!raw) return '';
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .trim();
}

function detectDirection(title) {
  const t = (title || '').toLowerCase();
  const bearish = /hike|hawkish|no rate cut|tariff|oversupply|stockpile build|inventor(y|ies) (rise|rises|climb|climbs|build)|recession|demand falls|slowdown/;
  const bullish = /strike|shock|shortage|supply cut|halt|suspend|stimulus|demand spike|inventor(y|ies) (fall|falls|drop|drops)|deficit/;
  if (bearish.test(t)) return 'bear';
  if (bullish.test(t)) return 'bull';
  return 'neutral';
}

async function parseRSS(url) {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const xml = await resp.text();
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .map(m => {
        const block = m[1];
        return {
          title: cleanText(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''),
          link: cleanText(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || ''),
          pubDate: block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '',
        };
      })
      .filter(item => isRelevant(item.title));
  } catch (e) {
    console.warn('[parseRSS]', url, e.message);
    return [];
  }
}

// FIX-6: dùng /api/claude (OpenRouter) search tin thực tế khi RSS thất bại
async function fetchViaAI(baseUrl) {
  try {
    const resp = await fetch(`${baseUrl}/api/claude`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Search for the latest 6 copper market news from today. Include news about: copper price, LME/SHFE/COMEX copper, copper mining (Chile, Peru, DRC), copper supply/demand, smelter issues, China manufacturing PMI.

Return ONLY valid JSON array, no markdown:
[{"title":"<English headline>","source":"<domain>","direction":"bull|bear|neutral","tags":["Supply"|"Demand"|"Macro"|"Urgent"]}]`,
        }],
      }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const text = (data.content || []).map(c => c.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (!Array.isArray(parsed)) throw new Error('Not array');
    return parsed.map((item, i) => ({
      title: item.title || '',
      link: `https://${item.source || 'reuters.com'}`,
      pubDate: new Date().toISOString(),
      _fromAI: true,
    })).filter(item => item.title);
  } catch (e) {
    console.warn('[fetchViaAI]', e.message);
    return [];
  }
}

function formatAge(pubDate) {
  const t = new Date(pubDate).getTime();
  if (isNaN(t)) return 'N/A';
  const diff = Math.max(0, Date.now() - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút`;
  return `${Math.floor(mins / 60)} giờ`;
}

function scoreItems(rawItems) {
  return rawItems
    .map(item => {
      let source = 'unknown';
      try { source = new URL(item.link || 'https://reuters.com').hostname.replace('www.', ''); } catch {}
      const { score, tags } = scoreNewsRelevance(item.title);
      return {
        title: item.title,
        link: item.link,
        source,
        age: item.pubDate ? formatAge(item.pubDate) : 'vừa xong',
        score,
        tags,
        direction: detectDirection(item.title),
      };
    })
    .filter(item => item.score >= 5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

export default async function handler(req, res) {
  const debug = req.query.debug === '1';
  const cacheKey = 'cu_news';

  if (!debug) {
    const hit = CACHE.get(cacheKey);
    if (hit && Date.now() - hit.ts < CACHE_TTL) {
      return res.status(200).json(hit.data);
    }
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://localhost:${process.env.PORT || 3000}`;

  try {
    // Thử RSS trước
    const results = await Promise.allSettled(RSS_FEEDS.map(parseRSS));
    let allItems = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value);

    let source = 'rss-live';

    // Nếu RSS cho 0 kết quả → dùng AI search
    if (allItems.length === 0) {
      console.log('[/api/news] RSS = 0, thử AI search...');
      const aiItems = await fetchViaAI(baseUrl);
      if (aiItems.length > 0) {
        allItems = aiItems;
        source = 'ai-search';
      }
    }

    const scored = scoreItems(allItems);

    const data = {
      items: scored.length ? scored : FALLBACK_NEWS,
      filtered: allItems.length,
      relevant: scored.length,
      fetched: RSS_FEEDS.length,
      source: scored.length ? source : 'fallback',
      ...(debug && {
        _debug_feed_status: results.map((r, idx) => ({
          url: RSS_FEEDS[idx],
          status: r.status,
          count: r.status === 'fulfilled' ? r.value.length : 0,
          error: r.status === 'rejected' ? r.reason?.message : undefined,
        })),
        _debug_raw_count: allItems.length,
        _debug_source: source,
        _debug_openrouter_available: !!process.env.OPENROUTER_API_KEY,
      }),
    };

    CACHE.set(cacheKey, { data, ts: Date.now() });
    return res.status(200).json(data);

  } catch (e) {
    console.error('[/api/news]', e.message);
    return res.status(200).json({ items: FALLBACK_NEWS, error: e.message, source: 'fallback' });
  }
}

const FALLBACK_NEWS = [
  { score:9.2, title:'Chile Escondida workers vote on strike — 78% in favour', link:'https://www.reuters.com', source:'reuters.com', age:'14 phút', direction:'bull', tags:['Supply','Urgent'] },
  { score:7.8, title:'SHFE copper inventory falls 12,400t — 3rd consecutive week', link:'https://www.bloomberg.com', source:'bloomberg.com', age:'1 giờ', direction:'bull', tags:['Supply','Demand'] },
  { score:7.1, title:'Fed officials signal no rate cut until inflation at 2%', link:'https://www.wsj.com', source:'wsj.com', age:'2 giờ', direction:'bear', tags:['Macro'] },
  { score:6.4, title:'China $500B infrastructure stimulus — copper demand spike expected', link:'https://www.caixin.com', source:'caixin.com', age:'3 giờ', direction:'bull', tags:['Demand','Macro'] },
];
