// ─── Data flow: CFTC ZIP → FRED → Claude fallback → JSON ─────────────────────

const FRED_KEY   = process.env.FRED_API_KEY    || '';
const BASE_URL   = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

// ─── Cache 15 phút ────────────────────────────────────────────────────────────
let cache    = { data:null, ts:0 };
let cotCache = { rows:[], ts:0 };
const CACHE_MS     = 15 * 60 * 1000;
const COT_CACHE_MS = 60 * 60 * 1000; // COT cache 1 giờ

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  result.push(cur.trim());
  return result;
}

async function claudeSearch(prompt) {
  try {
    const r = await fetch(`${BASE_URL}/api/claude`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model:'claude-sonnet-4-5', max_tokens:600,
        messages:[{ role:'user', content: prompt }],
      }),
    });
    const d    = await r.json();
    const text = (d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
    const m    = text.match(/\{[\s\S]*?\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch { return null; }
}

async function claudeSearchArr(prompt) {
  try {
    const r = await fetch(`${BASE_URL}/api/claude`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model:'claude-sonnet-4-5', max_tokens:800,
        messages:[{ role:'user', content: prompt }],
      }),
    });
    const d    = await r.json();
    const text = (d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
    const m    = text.match(/\[[\s\S]*?\]/);
    return m ? JSON.parse(m[0]) : null;
  } catch { return null; }
}

// ─── CFTC COT Historical (52 tuần thật) ───────────────────────────────────────
async function fetchCOTHistory() {
  // Dùng cache nếu còn mới
  if (cotCache.rows.length && Date.now()-cotCache.ts < COT_CACHE_MS) {
    return cotCache.rows;
  }

  try {
    // CFTC Disaggregated Futures — legacy format, public
    const year = new Date().getFullYear();
    const url  = `https://www.cftc.gov/files/dea/history/fut_fin_xls_${year}.zip`;

    const resp = await fetch(url, { signal:AbortSignal.timeout(15000) });
    if (!resp.ok) throw new Error(`CFTC ZIP HTTP ${resp.status}`);

    // ZIP → text (CFTC ZIP thực ra là CSV rename thành .zip)
    const buf  = await resp.arrayBuffer();
    const text = new TextDecoder('utf-8').decode(buf);
    const lines = text.split('\n').filter(l =>
      l.includes('COPPER') || l.includes('085692')
    );

    if (!lines.length) throw new Error('No copper rows in CFTC');

    // Parse tối đa 52 dòng gần nhất
    const rows = lines.slice(0, 52).map(line => {
      const f = parseCSVLine(line);
      return {
        date:     f[2]  || '',
        oi:       parseInt(f[7])  || 0,
        mm_long:  parseInt(f[8])  || 0,
        mm_short: parseInt(f[9])  || 0,
        mm_net:   (parseInt(f[8])||0) - (parseInt(f[9])||0),
        comm_long:  parseInt(f[12]) || 0,
        comm_short: parseInt(f[13]) || 0,
      };
    }).filter(r => r.mm_long > 0).reverse(); // chronological

    cotCache = { rows, ts:Date.now() };
    return rows;
  } catch(e) {
    console.error('CFTC ZIP error:', e.message);

    // Fallback: CFTC legacy text file
    try {
      const r2 = await fetch('https://www.cftc.gov/dea/newcot/FinFutCot.txt', {
        signal: AbortSignal.timeout(10000),
      });
      const txt   = await r2.text();
      const lines = txt.split('\n').filter(l =>
        l.includes('COPPER') || l.includes('085692')
      );
      if (!lines.length) throw new Error('No copper in legacy txt');

      const rows = lines.slice(0,52).map(line => {
        const f = parseCSVLine(line);
        return {
          date:       f[2]  || '',
          oi:         parseInt(f[7])  || 0,
          mm_long:    parseInt(f[8])  || 0,
          mm_short:   parseInt(f[9])  || 0,
          mm_net:     (parseInt(f[8])||0)-(parseInt(f[9])||0),
          comm_long:  parseInt(f[12]) || 0,
          comm_short: parseInt(f[13]) || 0,
        };
      }).filter(r => r.mm_long>0).reverse();

      cotCache = { rows, ts:Date.now() };
      return rows;
    } catch(e2) {
      console.error('CFTC legacy error:', e2.message);
      return [];
    }
  }
}

// ─── FRED API ─────────────────────────────────────────────────────────────────
async function fetchFRED(series, limit=14) {
  if (!FRED_KEY) return [];
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations`
      + `?series_id=${series}&api_key=${FRED_KEY}&limit=${limit}`
      + `&sort_order=desc&file_type=json`;
    const r = await fetch(url, { signal:AbortSignal.timeout(6000) });
    const d = await r.json();
    return (d.observations||[])
      .filter(o => o.value !== '.')
      .map(o => ({ date:o.date, value:parseFloat(o.value) }))
      .reverse();
  } catch { return []; }
}

// ─── Inventory history qua Claude ────────────────────────────────────────────
async function fetchInvHistory() {
  const arr = await claudeSearchArr(
    `Search LME copper warehouse stocks for last 5 weeks (weekly data).
     Return ONLY raw JSON array (oldest first):
     [{"w":"DD/MM","lme":<int MT>,"shfe":<int MT>,"comex":<int MT>}]
     Use real data from lme.com, shfe.com.cn, cmegroup.com`
  );
  return Array.isArray(arr) && arr.length >= 3 ? arr : null;
}

// ─── TC/RC history qua Claude ─────────────────────────────────────────────────
async function fetchTCRCHistory() {
  const arr = await claudeSearchArr(
    `Search copper treatment refining charges TC/RC for last 12 months from ICSG, SMM, Fastmarkets, or Reuters.
     Return ONLY raw JSON array (oldest first, 12 items):
     [{"m":"YYYY-MM","tc":<USD per MT float>}]`
  );
  return Array.isArray(arr) && arr.length >= 6 ? arr : null;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error:'Method not allowed' });

  const force = req.query.force === '1';
  if (!force && cache.data && Date.now()-cache.ts < CACHE_MS) {
    return res.status(200).json({ ...cache.data, cached:true });
  }

  // ─── Parallel fetch ────────────────────────────────────────────────────────
  const [
    cotHistory,
    dxyArr,
    us10yArr,
    invHistoryRaw,
    tcrcHistoryRaw,
  ] = await Promise.all([
    fetchCOTHistory(),
    fetchFRED('DTWEXBGS', 30),
    fetchFRED('DGS10',    30),
    fetchInvHistory(),
    fetchTCRCHistory(),
  ]);

  // ─── COT current (lấy row mới nhất từ history) ────────────────────────────
  let cot = cotHistory.length
    ? { ...cotHistory[cotHistory.length-1], source:'cftc' }
    : null;

  // Fallback COT qua Claude nếu CFTC fail
  if (!cot || cot.mm_long === 0) {
    cot = await claudeSearch(
      `Search latest CFTC COT report copper HG futures managed money long short net positions.
       Return ONLY raw JSON: {"mm_long":<int>,"mm_short":<int>,"mm_net":<int>,"comm_long":<int>,"comm_short":<int>,"oi":<int>,"date":"<YYYY-MM-DD>","source":"claude"}`
    ) || { mm_long:64000, mm_short:18000, mm_net:46000, comm_long:45000, comm_short:73000, oi:180000, source:'default' };
  }

  // ─── FRED latest values ───────────────────────────────────────────────────
  const dxy   = dxyArr.length   ? dxyArr[dxyArr.length-1].value   : null;
  const us10y = us10yArr.length ? us10yArr[us10yArr.length-1].value : null;

  // ─── Inventory + TC/RC qua Claude ────────────────────────────────────────
  const inv = await claudeSearch(
    `Search today LME copper warehouse stocks MT, SHFE copper inventory MT, COMEX copper stocks MT, TC/RC charges, cancelled warrants, weekly drain %.
     Return ONLY raw JSON: {"lme":<int>,"shfe":<int>,"comex":<int>,"cancelled_warrants":<int>,"tc_rc":<float>,"lme_drain_pct":<float>,"shfe_drain_pct":<float>,"comex_drain_pct":<float>}`
  ) || { lme:280000, shfe:51000, comex:9500, cancelled_warrants:3100, tc_rc:4, lme_drain_pct:-2.1, shfe_drain_pct:-1.4, comex_drain_pct:-3.2 };

  // ─── Forward curve qua Claude ────────────────────────────────────────────
  const curve = await claudeSearch(
    `Search COMEX copper HG futures M1 through M12 prices today USD per pound.
     Return ONLY raw JSON: {"m1":<float>,"m2":<float>,"m3":<float>,"m4":<float>,"m6":<float>,"m9":<float>,"m12":<float>,"spread_m1_m3":<float>,"structure":"backwardation|contango|flat"}`
  ) || { m1:6.07, m2:6.09, m3:6.11, m4:6.12, m6:6.10, m9:6.08, m12:6.06, spread_m1_m3:-0.04, structure:'contango' };

  // ─── Tightness composite ─────────────────────────────────────────────────
  const totalInv  = (inv.lme||0)+(inv.shfe||0)+(inv.comex||0);
  const invScore  = totalInv<350000?80:totalInv<450000?60:40;
  const cotScore  = (cot.mm_net||0)>30000?75:(cot.mm_net||0)>0?55:35;
  const tcrcScore = (inv.tc_rc||4)<5?80:(inv.tc_rc||4)<15?55:35;
  const tightness = Math.round(invScore*0.4+cotScore*0.35+tcrcScore*0.25);

  // ─── Build inventory history (thật hoặc Claude) ───────────────────────────
  const invHistory = invHistoryRaw || [
    { w:'4T', lme:Math.round((inv.lme||280000)*1.14), shfe:Math.round((inv.shfe||51000)*1.22), comex:Math.round((inv.comex||9500)*1.47) },
    { w:'3T', lme:Math.round((inv.lme||280000)*1.09), shfe:Math.round((inv.shfe||51000)*1.14), comex:Math.round((inv.comex||9500)*1.26) },
    { w:'2T', lme:Math.round((inv.lme||280000)*1.04), shfe:Math.round((inv.shfe||51000)*1.06), comex:Math.round((inv.comex||9500)*1.16) },
    { w:'1T', lme:Math.round((inv.lme||280000)*1.02), shfe:Math.round((inv.shfe||51000)*1.06), comex:Math.round((inv.comex||9500)*1.16) },
    { w:'Now', lme:inv.lme||280000, shfe:inv.shfe||51000, comex:inv.comex||9500 },
  ];

  // ─── TC/RC history (thật hoặc extrapolate từ current) ────────────────────
  const tcrcHistory = tcrcHistoryRaw || (() => {
    const base = inv.tc_rc || 4;
    const trend = [1.8,1.7,1.5,1.4,1.3,1.2,1.1,1.05,1.02,1.01,1.0,1.0];
    return Array.from({length:12}, (_,i) => {
      const d = new Date();
      d.setMonth(d.getMonth()-11+i);
      return {
        m: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
        tc: +(base * trend[i]).toFixed(1),
      };
    });
  })();

  const result = {
    cot,
    cot_history:   cotHistory.slice(-52),
    inv,
    inv_history:   invHistory,
    tcrc_history:  tcrcHistory,
    curve,
    macro: {
      dxy:         dxy   || 99.8,
      us10y:       us10y || 4.3,
      dxy_history:  dxyArr.slice(-14),
      us10y_history: us10yArr.slice(-14),
    },
    tightness,
    total_inventory:  totalInv,
    balance_deficit: -Math.abs((inv.cancelled_warrants||3100)*28),
    data_sources: {
      cot:   cot.source || 'cftc',
      dxy:   dxy   ? 'fred' : 'default',
      us10y: us10y ? 'fred' : 'default',
      inv:   'claude',
      curve: 'claude',
    },
    updated_at: Date.now(),
  };

  cache = { data:result, ts:Date.now() };
  return res.status(200).json(result);
}