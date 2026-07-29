// pages/api/news.js — Copper news aggregator
// Nguồn miễn phí: Reuters/Bloomberg RSS feeds + NLP scoring

const CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const RSS_FEEDS = [
  'https://www.reuters.com/markets/commodities/rss',
  'https://feeds.bloomberg.com/markets/news.rss', // ví dụ — thay bằng feed thực tế available
];

const COPPER_KEYWORDS = [
  'copper', 'smelter', 'escondida', 'chile mine', 'shfe', 'lme copper',
  'china manufacturing', 'grasberg', 'codelco',
];

function isRelevant(text) {
  const lower = text.toLowerCase();
  return COPPER_KEYWORDS.some(kw => lower.includes(kw));
}

function scoreArticle(title) {
  const lower = title.toLowerCase();
  let score = 5;
  if (/strike|shock|surge|halt/.test(lower)) score += 3;
  if (/china|shfe/.test(lower)) score += 1.5;
  if (/mine|smelter|supply/.test(lower)) score += 1.5;
  return Math.min(10, score);
}

async function parseRSS(url) {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const xml = await resp.text();
    // Simple regex parse — thay bằng xml2js nếu cần robust hơn
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .map(m => {
        const block = m[1];
        const title = block.match(/<title>(.*?)<\/title>/)?.[1] || '';
        const link  = block.match(/<link>(.*?)<\/link>/)?.[1] || '';
        const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
        return { title, link, pubDate };
      })
      .filter(item => isRelevant(item.title));
    return items;
  } catch (e) {
    console.warn('[parseRSS]', url, e.message);
    return [];
  }
}

export default async function handler(req, res) {
  const cacheKey = 'cu_news';
  const hit = CACHE.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return res.status(200).json(hit.data);
  }

  try {
    const results = await Promise.allSettled(RSS_FEEDS.map(parseRSS));
    const allItems = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);

    const scored = allItems
      .map(item => ({
        title: item.title,
        source: new URL(item.link || 'https://reuters.com').hostname.replace('www.',''),
        age: item.pubDate ? formatAge(item.pubDate) : 'N/A',
        score: scoreArticle(item.title),
        direction: /strike|shock|shortage|cut/.test(item.title.toLowerCase()) ? 'bull' : 'neutral',
      }))
      .filter(item => item.score >= 6)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const data = {
      items: scored.length ? scored : FALLBACK_NEWS,
      filtered: allItems.length,
      relevant: scored.length,
      source: scored.length ? 'rss-live' : 'fallback',
    };

    CACHE.set(cacheKey, { data, ts: Date.now() });
    return res.status(200).json(data);

  } catch (e) {
    console.error('[/api/news]', e.message);
    return res.status(200).json({ items: FALLBACK_NEWS, error: e.message, source: 'fallback' });
  }
}

function formatAge(pubDate) {
  const diff = Date.now() - new Date(pubDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} phút`;
  const hours = Math.floor(mins / 60);
  return `${hours} giờ`;
}

const FALLBACK_NEWS = [
  { score:9.2, title:'Chile Escondida workers vote on strike — 78% in favour', source:'reuters.com', age:'14 phút', direction:'bull', tags:['Supply','Urgent'] },
  { score:7.8, title:'SHFE copper inventory falls 12,400t — 3rd consecutive week', source:'bloomberg.com', age:'1 giờ', direction:'bull', tags:['Supply','Demand'] },
  { score:7.1, title:'Fed officials signal no rate cut until inflation at 2%', source:'wsj.com', age:'2 giờ', direction:'bear', tags:['Macro'] },
  { score:6.4, title:'China $500B infrastructure stimulus — copper demand spike expected', source:'caixin.com', age:'3 giờ', direction:'bull', tags:['Demand','Macro'] },
];