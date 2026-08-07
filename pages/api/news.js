// pages/api/news.js — Copper news aggregator
// Nguồn miễn phí: RSS công khai (mining.com, kitco, reuters, investing.com) + NLP scoring
//
// ═══ CHANGELOG (senior review) ═══════════════════════════════════════════════
// FIX-1 [đồng bộ dữ liệu giữa các tab — quan trọng nhất]:
//   File gốc tự định nghĩa scoreArticle() riêng (server), trong khi
//   useVerdictEngine.js lại gọi scoreNewsRelevance() từ lib/verdictCalculations.js
//   (client) để TÍNH LẠI score/tags và GHI ĐÈ lên kết quả server trả về:
//     items.map(item => ({ ...item, ...scoreNewsRelevance(item.title) }))
//   → 2 thuật toán khác công thức chạy trên CÙNG 1 bài báo, số điểm server
//     lọc top-8 không phải số điểm cuối cùng hiển thị cho user — lãng phí
//     tính toán và có thể lọc nhầm (bài đáng lẽ điểm cao ở client bị loại
//     sớm vì điểm thấp ở server, hoặc ngược lại).
//   Fix: import CHUNG scoreNewsRelevance() từ lib/verdictCalculations.js —
//        một nguồn tính điểm duy nhất dùng cả server lẫn client (DRY).
//        Không đổi tên field trả về (`score`, `tags` vẫn giữ nguyên) nên
//        useVerdictEngine.js không cần sửa gì — chỉ là bây giờ nó ghi đè
//        bằng chính công thức đã dùng để lọc, tức là vô hại/idempotent.
//
// FIX-2 [thiếu field — vỡ giao diện]:
//   scored.map() cũ KHÔNG trả field `tags`, trong khi FALLBACK_NEWS CÓ
//   `tags`. SmartNewsCard.jsx đọc item.tags?.length → bài live luôn thiếu
//   tag hiển thị dù fallback thì có → 2 nguồn dữ liệu khác SHAPE nhau.
//   Fix: dùng scoreNewsRelevance() (FIX-1) nên tags có sẵn cho mọi item,
//        đồng nhất shape với FALLBACK_NEWS.
//
// FIX-3 [logic sai — direction không bao giờ ra 'bear']:
//   Regex cũ chỉ match từ khoá BULLISH (strike/shock/shortage/cut) để gán
//   direction:'bull', còn lại luôn là 'neutral' — bài live KHÔNG BAO GIỜ
//   nhận được direction:'bear', trong khi FALLBACK_NEWS lại có ví dụ 'bear'.
//   Fix: thêm bộ từ khoá bearish (hike, hawkish, tariff, oversupply…),
//        ưu tiên kiểm tra bearish trước để tránh nhập nhằng.
//
// FIX-4 [parsing RSS không sạch — lỗi hiển thị]:
//   - Regex title/link không strip CDATA (<![CDATA[...]]>) → tiêu đề hiện
//     ra UI kèm rác "<![CDATA[" / "]]>".
//   - Không decode HTML entity (&amp; &#39; &quot;) → hiển thị sai ký tự.
//   - new URL(item.link) có thể throw nếu link rỗng/malformed → crash CẢ
//     request (rơi vào catch tổng, loại bỏ luôn các bài báo hợp lệ khác).
//   - pubDate không hợp lệ → formatAge() trả "NaN phút".
//   Fix: hàm cleanText() strip CDATA + decode entity; try/catch riêng từng
//        item khi tạo URL; guard isNaN cho pubDate.
//
// FIX-5 [bổ sung — 2026-08]:
//   Object trả về của scored.map() KHÔNG có field `link` — biến này chỉ
//   dùng nội bộ để tính `source` (new URL(item.link)) rồi bị bỏ đi, khiến
//   UI không có cách nào trỏ tới bài gốc ("Đọc bài gốc" không hoạt động).
//   Fix: thêm `link: item.link` vào object trả về (và vào FALLBACK_NEWS
//        cho nhất quán shape) — không đổi field/logic nào khác.
//
// Feed Bloomberg cũ là URL placeholder ("ví dụ" — không tồn tại thật) →
// thay bằng các nguồn RSS công khai thật: mining.com, kitco.com. Giữ
// nguyên Promise.allSettled nên 1 feed lỗi không ảnh hưởng feed khác
// (thiết kế gốc đã đúng, giữ nguyên).
// ═══════════════════════════════════════════════════════════════════════════

import { scoreNewsRelevance } from '../../lib/verdictCalculations'; // FIX-1: dùng chung 1 nguồn tính điểm

const CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000; // giữ nguyên như bản gốc

// ─── RSS feeds — thay placeholder không tồn tại bằng nguồn thật, miễn phí ────
const RSS_FEEDS = [
  'https://www.reuters.com/markets/commodities/rss', // best-effort, có thể 404 tuỳ thời điểm
  'https://www.mining.com/feed/',                     // mining.com — RSS công khai, ổn định
  'https://www.kitco.com/rss/KitcoNews.xml',          // Kitco metals news — RSS công khai
];

const COPPER_KEYWORDS = [
  'copper', 'smelter', 'escondida', 'chile mine', 'shfe', 'lme copper',
  'china manufacturing', 'grasberg', 'codelco',
];

function isRelevant(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return COPPER_KEYWORDS.some(kw => lower.includes(kw));
}

// ─── FIX-4: strip CDATA + decode HTML entity, không cần thêm dependency ─────
function cleanText(raw) {
  if (!raw) return '';
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1') // bỏ wrapper CDATA
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

// ─── FIX-3: bổ sung bearish keywords — trước đó direction không bao giờ 'bear'
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
    // Simple regex parse — thay bằng xml2js nếu cần robust hơn (giữ nguyên cách tiếp cận gốc)
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .map(m => {
        const block = m[1];
        const title   = cleanText(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
        const link    = cleanText(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '');
        const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
        return { title, link, pubDate };
      })
      .filter(item => isRelevant(item.title));
    return items;
  } catch (e) {
    console.warn('[parseRSS]', url, e.message);
    return []; // giữ nguyên hành vi gốc — 1 feed lỗi không phá các feed khác
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
      .map(item => {
        // FIX-4: bọc riêng từng item — 1 link hỏng không làm crash toàn bộ
        let source = 'unknown';
        try {
          source = new URL(item.link || 'https://reuters.com').hostname.replace('www.', '');
        } catch { /* giữ 'unknown', không throw ra ngoài */ }

        // FIX-1 + FIX-2: dùng CHUNG hàm tính điểm/tag với client
        // (lib/verdictCalculations.js) — không còn 2 thuật toán lệch nhau
        const { score, tags } = scoreNewsRelevance(item.title);

        return {
          title: item.title,
          link: item.link,                          // FIX-5: field còn thiếu ở bản trước — cần cho "Đọc bài gốc"
          source,
          age: item.pubDate ? formatAge(item.pubDate) : 'N/A',
          score,
          tags,                                   // FIX-2: field còn thiếu ở bản gốc
          direction: detectDirection(item.title),  // FIX-3: giờ có cả 'bear'
        };
      })
      .filter(item => item.score >= 6) // ngưỡng giữ nguyên như bản gốc
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const data = {
      items: scored.length ? scored : FALLBACK_NEWS,
      filtered: allItems.length,   // giữ nguyên tên field (backward compatible)
      relevant: scored.length,     // giữ nguyên tên field (backward compatible)
      fetched: results.length,     // bổ sung mới — không phá field cũ, chỉ thêm
      source: scored.length ? 'rss-live' : 'fallback',
    };

    CACHE.set(cacheKey, { data, ts: Date.now() });
    return res.status(200).json(data);

  } catch (e) {
    console.error('[/api/news]', e.message);
    return res.status(200).json({ items: FALLBACK_NEWS, error: e.message, source: 'fallback' });
  }
}

// ─── FIX-4: guard pubDate không hợp lệ (tránh "NaN phút") ────────────────────
function formatAge(pubDate) {
  const t = new Date(pubDate).getTime();
  if (isNaN(t)) return 'N/A';
  const diff = Math.max(0, Date.now() - t); // tránh số âm nếu lệch giờ server
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút`;
  const hours = Math.floor(mins / 60);
  return `${hours} giờ`;
}

// FIX-5: bổ sung field `link` cho fallback để nhất quán shape với dữ liệu live
const FALLBACK_NEWS = [
  { score:9.2, title:'Chile Escondida workers vote on strike — 78% in favour', link:'https://www.reuters.com', source:'reuters.com', age:'14 phút', direction:'bull', tags:['Supply','Urgent'] },
  { score:7.8, title:'SHFE copper inventory falls 12,400t — 3rd consecutive week', link:'https://www.bloomberg.com', source:'bloomberg.com', age:'1 giờ', direction:'bull', tags:['Supply','Demand'] },
  { score:7.1, title:'Fed officials signal no rate cut until inflation at 2%', link:'https://www.wsj.com', source:'wsj.com', age:'2 giờ', direction:'bear', tags:['Macro'] },
  { score:6.4, title:'China $500B infrastructure stimulus — copper demand spike expected', link:'https://www.caixin.com', source:'caixin.com', age:'3 giờ', direction:'bull', tags:['Demand','Macro'] },
];
