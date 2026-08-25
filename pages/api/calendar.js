// pages/api/calendar.js — Economic Calendar
// Nguồn miễn phí: TradingEconomics guest API hoặc Investing.com RSS
//
// ═══ CHANGELOG (senior review) ═══════════════════════════════════════════════
// FIX-1: classifyImpact() cũ so sánh event.actual > event.forecast — với sự
//        kiện CHƯA XẢY RA thì `actual` luôn undefined, khiến so sánh trả về
//        false và MỌI sự kiện CPI/PMI đều rơi vào nhánh mặc định 'medium'.
//        → Sự kiện quan trọng nhất (CPI) mất tag 'bearish_if_high', làm
//          PreEventAlert & EventImpactCard không nhận diện được rủi ro.
//        Fix: phân loại thuần theo LOẠI sự kiện, không phụ thuộc actual.
// FIX-2: `name` trả về nguyên văn từ TE ("Fed Minutes") không khớp key trong
//        HISTORICAL_IMPACT_TABLE / SENSITIVITY_MATRIX ở verdictCalculations.js
//        (key là 'Fed Rate', 'China PMI'…) → simulateEventImpact() ở
//        EventImpactCard luôn trả null cho các sự kiện này (đồng bộ dữ liệu
//        giữa file API và file tính toán bị lệch tên).
//        Fix: chuẩn hoá tên qua NAME_ALIAS_MAP trước khi trả về — vẫn cùng
//        field `name` (không đổi shape) nên KHÔNG breaking cho consumer.
// FIX-3: new Date(e.Date) có thể là Invalid Date nếu TE đổi format → toàn bộ
//        item bị NaN minutesUntil và "Invalid Date" hiển thị ra UI.
//        Fix: guard isNaN, loại bỏ item lỗi thay vì để lọt ra ngoài.
// FIX-4: e.Importance có thể là string "3" thay vì number 3 (tuỳ response) →
//        so sánh >= 3 sai kiểu. Fix: Number(e.Importance).
// FIX-5: .json() có thể throw nếu TE trả HTML lỗi (rate-limit) — đã nằm trong
//        try/catch nên không crash, nhưng thêm log rõ ràng hơn để debug.
// Bổ sung thêm keyword copper-relevant (LME, Trade Balance, Caixin) — thuần
// additive, không đổi hành vi cũ với các sự kiện đã match trước đó.
// ═══════════════════════════════════════════════════════════════════════════

const CACHE = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 phút — giữ nguyên như bản gốc

// Sự kiện có ảnh hưởng trực tiếp đến đồng — whitelist (bổ sung thêm keyword)
const COPPER_RELEVANT_EVENTS = [
  'CPI', 'Fed', 'FOMC', 'PMI', 'GDP', 'Industrial Production',
  'Retail Sales', 'PPI', 'Non-Farm', 'ISM',
  // ── bổ sung, chỉ mở rộng whitelist, không xoá gì cũ ──
  'Trade Balance', 'Caixin', 'Manufacturing', 'LME',
];

// ─── Chuẩn hoá tên sự kiện để khớp key trong verdictCalculations.js ──────────
// (SENSITIVITY_MATRIX / HISTORICAL_IMPACT_TABLE dùng: 'CPI', 'Fed Rate', 'China PMI')
// Không đổi field name (`name`), chỉ chuẩn hoá GIÁ TRỊ để 2 nơi đồng bộ.
const NAME_ALIAS_MAP = [
  { test: /fomc|fed.*(minutes|rate|decision)/i, alias: 'Fed Rate Decision' },
  { test: /china.*pmi|caixin.*pmi/i,             alias: 'China PMI' },
  { test: /^cpi|consumer price/i,                alias: 'CPI' },
  { test: /ism.*manufacturing/i,                 alias: 'ISM Manufacturing PMI' },
  { test: /lme.*(stock|warehouse|inventory)/i,   alias: 'LME Stocks' },
];

function normalizeName(rawName) {
  const hit = NAME_ALIAS_MAP.find(m => m.test.test(rawName));
  // Giữ tên gốc trong ngoặc để user vẫn thấy nguyên văn từ nguồn
  return hit ? `${hit.alias} (${rawName})` : rawName;
}

function isRelevant(eventName) {
  if (!eventName) return false; // FIX-3 phụ: guard tên rỗng
  return COPPER_RELEVANT_EVENTS.some(kw =>
    eventName.toLowerCase().includes(kw.toLowerCase())
  );
}

// ─── FIX-1: phân loại theo LOẠI sự kiện, không phụ thuộc actual (chưa có) ────
function classifyImpact(rawName) {
  const n = (rawName || '').toLowerCase();
  if (n.includes('cpi') || n.includes('consumer price'))      return 'bearish_if_high';
  if (n.includes('fomc') || n.includes('fed'))                 return 'bullish_if_dovish';
  if (n.includes('china') && n.includes('pmi'))                 return 'bullish_if_beat';
  if (n.includes('caixin'))                                     return 'bullish_if_beat';
  if (n.includes('ism') && n.includes('manufacturing'))         return 'bullish_if_beat';
  if (n.includes('lme'))                                        return 'bullish_if_stock_fall';
  if (n.includes('gdp'))                                        return 'bullish_if_beat';
  if (n.includes('non-farm') || n.includes('nfp'))              return 'bearish_if_high';
  return 'medium';
}

export default async function handler(req, res) {
  const cacheKey = 'econ_cal';
  const hit = CACHE.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return res.status(200).json(hit.data);
  }

  try {
    const credential = process.env.TRADINGECONOMICS_API_KEY;
    if (!credential && !process.env.CALENDAR_PROVIDER_URL) {
      throw new Error('Thiếu TRADINGECONOMICS_API_KEY hoặc CALENDAR_PROVIDER_URL');
    }

    const now = new Date();
    const to = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    const url = process.env.CALENDAR_PROVIDER_URL
      || `https://api.tradingeconomics.com/calendar/country/united%20states,china` +
         `?c=${encodeURIComponent(credential)}&d1=${now.toISOString().slice(0,10)}&d2=${to.toISOString().slice(0,10)}`;

    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error(`TE calendar ${resp.status}`);

    // FIX-5: tách riêng bước parse JSON để log rõ nguyên nhân nếu TE trả HTML
    let raw;
    try {
      raw = await resp.json();
    } catch (parseErr) {
      throw new Error(`TE calendar returned non-JSON: ${parseErr.message}`);
    }

    if (!Array.isArray(raw)) throw new Error('Calendar provider trả response không hợp lệ');

    const events = raw
      .filter(e => isRelevant(e.Event || ''))
      .map(e => {
        const eventTime = new Date(e.Date);
        // FIX-3: loại bỏ item có ngày không hợp lệ ngay tại bước map
        if (isNaN(eventTime.getTime())) return null;

        const minutesUntil = Math.round((eventTime - now) / 60000);
        const importance = Number(e.Importance) || 1; // FIX-4: ép kiểu number an toàn
        const rawName = e.Event || 'Unknown Event';

        return {
          name:        normalizeName(rawName),          // FIX-2: tên đồng bộ với calc layer
          impact:      importance >= 3 ? 'high' : importance === 2 ? 'medium' : 'low',
          time:        eventTime.toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' }),
          date:        eventTime.toLocaleDateString('vi-VN'),
          forecast:    e.Forecast ?? null,
          prev:        e.Previous ?? null,
          timestamp:   eventTime.getTime(),
          minutesUntil,
          affectsCu:   classifyImpact(rawName),          // FIX-1: không còn phụ thuộc actual
        };
      })
      .filter(Boolean)                    // loại bỏ null từ FIX-3
      .filter(e => e.minutesUntil > -60)  // chỉ giữ sự kiện chưa qua quá 1h — giữ nguyên logic gốc
      .sort((a, b) => a.minutesUntil - b.minutesUntil)
      .slice(0, 10);

    const data = { events, source: process.env.CALENDAR_PROVIDER_URL ? 'custom-provider' : 'tradingeconomics' };
    CACHE.set(cacheKey, { data, ts: Date.now() });
    return res.status(200).json(data);

  } catch (e) {
    console.warn('[/api/calendar]', e.message);
    const fallbackNow = Date.now();
    // Giữ dữ liệu tham khảo cho simulator, nhưng đánh dấu estimate và không
    // cho phép dùng làm cảnh báo thời gian thực.
    return res.status(200).json({
      events: [
        { name:'CPI (CPI Mỹ YoY)', impact:'high', time:'', date:'', forecast:'3.1%', prev:'3.3%', minutesUntil:null, affectsCu:'bearish_if_high', isFallback:true },
        { name:'Fed Rate Decision (Fed Minutes)', impact:'high', time:'', date:'', forecast:'', prev:'', minutesUntil:null, affectsCu:'bullish_if_dovish', isFallback:true },
        { name:'ISM Manufacturing PMI (ISM Manufacturing PMI)', impact:'medium', time:'', date:'', forecast:'48.5', prev:'48.7', minutesUntil:null, affectsCu:'bullish_if_beat', isFallback:true },
        { name:'China PMI (Caixin China PMI)', impact:'high', time:'', date:'', forecast:'51.2', prev:'50.8', minutesUntil:null, affectsCu:'bullish_if_beat', isFallback:true },
      ],
      asOf: fallbackNow,
      error: e.message, source: 'fallback',
    });
  }
}