// pages/api/news.js — Copper news aggregator
// ĐÃ SỬA (bản 2): bổ sung field `link` vào object trả về — bản trước
// chỉ dùng `item.link` nội bộ để tính `source` (new URL(item.link))
// rồi KHÔNG trả field này ra ngoài, khiến nút "Đọc bài gốc" ở
// CommandCenterTab không có URL nào để trỏ tới. Đây là bổ sung tối
// thiểu, không đổi field/logic nào khác đã có.

import { scoreNewsRelevance } from '../../lib/verdictCalculations';

const CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const RSS_FEEDS = [
  'https://www.reuters.com/markets/commodities/rss',
  'https://www.mining.com/feed/',
  'https://www.kitco.com/rss/KitcoNews.xml',
];

const COPPER_KEYWORDS = [
  'copper', 'smelter', 'escondida', 'chile mine', 'shfe', 'lme copper',
  'china manufacturing', 'grasberg', 'codelco',
];

function isRelevant(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return COPPER_KEYWORDS.some((kw) => lower.includes(kw));
}

function cleanText(raw) {
  if (!raw) return '';
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
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
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .map((m) => {
        const block = m[1];
        const title = cleanText(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
        const link = cleanText(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '');
        const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
        return { title, link, pubDate };
      })
      .filter((item) => isRelevant(item.title));
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
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value);

    const scored = allItems
      .map((item) => {
        let source = 'unknown';
        try {
          source = new URL(item.link || 'https://reuters.com').hostname.replace('www.', '');
        } catch { /* giữ 'unknown' */ }

        const { score, tags } = scoreNewsRelevance(item.title);

        return {
          title: item.title,
          link: item.link, // ĐÃ THÊM — trước đây bị bỏ sót, khiến "Đọc bài gốc" không có URL
          source,
          age: item.pubDate ? formatAge(item.pubDate) : 'N/A',
          score,
          tags,
          direction: detectDirection(item.title),
        };
      })
      .filter((item) => item.score >= 6)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const data = {
      items: scored.length ? scored : FALLBACK_NEWS,
      filtered: allItems.length,
      relevant: scored.length,
      fetched: results.length,
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
  const t = new Date(pubDate).getTime();
  if (isNaN(t)) return 'N/A';
  const diff = Math.max(0, Date.now() - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút`;
  const hours = Math.floor(mins / 60);
  return `${hours} giờ`;
}

// ĐÃ THÊM field `link` cho từng mục fallback để nhất quán shape
const FALLBACK_NEWS = [
  { score: 9.2, title: 'Chile Escondida workers vote on strike — 78% in favour', link: 'https://reuters.com', source: 'reuters.com', age: '14 phút', direction: 'bull', tags: ['Supply', 'Urgent'] },
  { score: 7.8, title: 'SHFE copper inventory falls 12,400t — 3rd consecutive week', link: 'https://bloomberg.com', source: 'bloomberg.com', age: '1 giờ', direction: 'bull', tags: ['Supply', 'Demand'] },
  { score: 7.1, title: 'Fed officials signal no rate cut until inflation at 2%', link: 'https://wsj.com', source: 'wsj.com', age: '2 giờ', direction: 'bear', tags: ['Macro'] },
  { score: 6.4, title: 'China $500B infrastructure stimulus — copper demand spike expected', link: 'https://caixin.com', source: 'caixin.com', age: '3 giờ', direction: 'bull', tags: ['Demand', 'Macro'] },
];
