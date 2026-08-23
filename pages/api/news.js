// pages/api/news.js — Copper news aggregator v8
// ═══ CHANGELOG ═══════════════════════════════════════════════════════════════
// FIX-1→5: (giữ nguyên lịch sử — dùng chung scoreNewsRelevance, thêm tags/link,
//           direction bear, cleanText, Google News RSS thay RSS chết)
// FIX-7 [MỚI — bug quan trọng]: scoreNewsRelevance() trả `tags` dạng STRING
//   cách nhau bằng dấu cách ("supply demand urgent"), không phải MẢNG như
//   toàn bộ UI mong đợi. Component NewsFilter gọi (n.tags||[]).forEach(...)
//   — String không có .forEach → lỗi runtime, bộ lọc tag hỏng.
//   Fix: chuẩn hoá tags thành mảng NGAY tại API, viết hoa chữ đầu, không
//   phụ thuộc scoreNewsRelevance trả về string hay mảng.
// ═══════════════════════════════════════════════════════════════════════════

import { scoreNewsRelevance } from '../../lib/verdictCalculations';

const CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const RSS_FEEDS = [
  'https://news.google.com/rss/search?q=copper+mining+price&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=LME+copper+SHFE+copper&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=copper+supply+demand+smelter&hl=en-US&gl=US&ceid=US:en',
];

function cleanText(raw) {
  if (!raw) return '';
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '')
    .trim();
}

// FIX-7: chuẩn hoá tags — nhận string HOẶC mảng, luôn trả về mảng viết hoa
function normalizeTags(rawTags) {
  let arr;
  if (Array.isArray(rawTags)) {
    arr = rawTags;
  } else if (typeof rawTags === 'string' && rawTags.trim()) {
    arr = rawTags.trim().split(/\s+/);
  } else {
    arr = [];
  }
  const cleaned = arr
    .filter(Boolean)
    .map((t) => String(t).trim())
    .filter((t) => t.length > 0)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
  return cleaned.length ? [...new Set(cleaned)] : ['Copper'];
}

function detectDirection(title) {
  const t = (title || '').toLowerCase();
  const bearish = /hike|hawkish|no rate cut|tariff|oversupply|stockpile.build|inventor(y|ies).*(rise|climb|build)|recession|demand.falls|slowdown|decline|drop|slump|weaken/;
  const bullish = /strike|shock|shortage|supply.cut|halt|suspend|stimulus|demand.spike|inventor(y|ies).*(fall|drop)|deficit|surge|jump|rally|gain|strong/;
  if (bearish.test(t)) return 'bear';
  if (bullish.test(t)) return 'bull';
  return 'neutral';
}

function formatAge(pubDate) {
  const t = new Date(pubDate).getTime();
  if (isNaN(t)) return 'N/A';
  const diff = Math.max(0, Date.now() - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ`;
  return `${Math.floor(hours / 24)} ngày`;
}

async function parseGoogleNewsRSS(url) {
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const xml = await resp.text();

    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .map(m => {
        const block = m[1];
        const title = cleanText(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
        const rawLink = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]
          || block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1]
          || '';
        const link = cleanText(rawLink);
        const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
        const source = cleanText(block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || '');
        return { title, link, pubDate, sourceLabel: source };
      })
      .filter(item => item.title && item.title.length > 10);
  } catch (e) {
    console.warn('[parseGoogleNewsRSS]', url.slice(0, 60), e.message);
    return [];
  }
}

export default async function handler(req, res) {
  const debug = req.query.debug === '1';
  const cacheKey = 'cu_news_v8';

  if (!debug) {
    const hit = CACHE.get(cacheKey);
    if (hit && Date.now() - hit.ts < CACHE_TTL) {
      return res.status(200).json(hit.data);
    }
  }

  try {
    const results = await Promise.allSettled(RSS_FEEDS.map(parseGoogleNewsRSS));
    const allItems = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);

    const seen = new Set();
    const unique = allItems.filter(item => {
      const key = item.title.slice(0, 60).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const scored = unique
      .map(item => {
        let source = item.sourceLabel || 'unknown';
        if (!source || source === 'unknown') {
          try { source = new URL(item.link).hostname.replace('www.', ''); } catch {}
        }
        const { score, tags } = scoreNewsRelevance(item.title);
        return {
          title: item.title,
          link: item.link,
          source,
          age: item.pubDate ? formatAge(item.pubDate) : 'N/A',
          score,
          tags: normalizeTags(tags), // FIX-7: luôn là mảng chuẩn
          direction: detectDirection(item.title),
        };
      })
      .filter(item => item.score >= 4)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const hasLiveNews = scored.length > 0;
    const data = {
      items: hasLiveNews ? scored : FALLBACK_NEWS,
      filtered: allItems.length,
      relevant: scored.length,
      fetched: results.length,
      source: hasLiveNews ? 'google-news-rss' : 'fallback',
      ...(debug && {
        _debug_feed_status: results.map((r, idx) => ({
          url: RSS_FEEDS[idx].slice(0, 80),
          status: r.status,
          count: r.status === 'fulfilled' ? r.value.length : 0,
        })),
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
  { score: 9.2, title: 'Chile Escondida workers vote on strike — 78% in favour', link: 'https://www.reuters.com', source: 'reuters.com', age: '14 phút', direction: 'bull', tags: ['Supply', 'Urgent'] },
  { score: 7.8, title: 'SHFE copper inventory falls 12,400t — 3rd consecutive week', link: 'https://www.bloomberg.com', source: 'bloomberg.com', age: '1 giờ', direction: 'bull', tags: ['Supply', 'Demand'] },
  { score: 7.1, title: 'Fed officials signal no rate cut until inflation at 2%', link: 'https://www.wsj.com', source: 'wsj.com', age: '2 giờ', direction: 'bear', tags: ['Macro'] },
  { score: 6.4, title: 'China $500B infrastructure stimulus — copper demand spike expected', link: 'https://www.caixin.com', source: 'caixin.com', age: '3 giờ', direction: 'bull', tags: ['Demand', 'Macro'] },
];
