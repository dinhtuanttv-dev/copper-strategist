import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area, ComposedChart, Bar, Line,
} from 'recharts';
import Layout from '../components/Layout';
import {
  A, calcVSA, calcElliott, calcTI, calcMH, calcVerdict,
  calcPricePattern, analyzeCurve, runStress, calcHandoff,
  interpCG, calcPCI, detectRegime, getWeights,
  fmtTime, fmtAge, extractJ, getTxt,
  calcLiq, calcEZ, calcSC, buildPlan,
} from '../lib/calculations';

// ─── Default data ─────────────────────────────────────────────────────────────
const BS_DEF = [
  { region:'Chile',      event:'Đình công mỏ Escondida', impact:72, bsType:'acute',      col:A.red    },
  { region:'Peru',       event:'Bất ổn Las Bambas',       impact:65, bsType:'acute',      col:A.orange },
  { region:'Trung Quốc', event:'Suy thoái BĐS',           impact:55, bsType:'structural', col:A.amber  },
  { region:'Mỹ/TQ',     event:'Leo thang thuế quan',      impact:78, bsType:'structural', col:A.red    },
  { region:'DRC',        event:'Bất ổn Congo',             impact:45, bsType:'acute',      col:A.amber  },
];

const DEF_FUTURES = [
  { code:'HG1', months:0,  price:6.07, chg:0.07 },
  { code:'HG2', months:2,  price:6.09, chg:0.05 },
  { code:'HG3', months:4,  price:6.11, chg:0.04 },
  { code:'HG4', months:6,  price:6.12, chg:0.03 },
  { code:'HG5', months:9,  price:6.10, chg:0.02 },
  { code:'HG6', months:12, price:6.08, chg:0.01 },
];

const INIT = {
  comex:6.07, comex_chg_pct:0.07, lme:13285,
  dxy:99.8, dxy_chg:-0.4, cu_gold_ratio:0.059,
  rsi_h4:68, atr:0.12, vol_ma20_ratio:1.42,
  session_vol:91000, avg_vol:105000,
  prev_high:6.12, prev_low:5.89,
  cmex_stocks:9500,  prev_cmex_stocks:11000,
  lme_stocks:280000, prev_lme_stocks:285000,
  shfe_stocks:51000, prev_shfe_stocks:54000,
  warrants_cancelled:3100, tc_rc:4, cme_spread:390,
  mm_long:64000, comm_short:-73000,
  fear_greed:58, bias_raw:63,
  sl:5.72, tp1:6.32, tp2:6.58,
  syncVer:0,
  priceChart:[
    {d:'07/04',comex:5.46,vol:112000},{d:'08/04',comex:5.48,vol:90000},
    {d:'09/04',comex:5.55,vol:82000}, {d:'10/04',comex:5.73,vol:128000},
    {d:'11/04',comex:5.80,vol:118000},{d:'14/04',comex:5.71,vol:91000},
    {d:'15/04',comex:5.94,vol:142000},{d:'16/04',comex:6.07,vol:135000},
  ],
  cotChart:[
    {w:'3/3',mm:57000,comm:-65000},{w:'17/3',mm:55000,comm:-61000},
    {w:'1/4',mm:60000,comm:-69000},{w:'10/4',mm:64000,comm:-73000},
  ],
  invChart:[
    {w:'17/3',cmex:15000,lme:248000,shfe:62000,canc:6800},
    {w:'1/4', cmex:13000,lme:270000,shfe:58000,canc:4200},
    {w:'10/4',cmex:11000,lme:285000,shfe:54000,canc:2400},
    {w:'16/4',cmex:9500, lme:280000,shfe:51000,canc:3100},
  ],
  calendarEvents:[
    {name:'FOMC Minutes',  impact:'high',   currency:'USD',ts:Date.now()+3*3600*1000,note:'DXY tăng → COMEX áp lực'},
    {name:'China PMI',     impact:'high',   currency:'CNY',ts:Date.now()+8*3600*1000,note:'PMI>51 → Cầu đồng TQ tăng'},
    {name:'LME Warehouse', impact:'medium', currency:'LME',ts:Date.now()+5*3600*1000,note:'Giảm → Real Tightness'},
  ],
};

// ─── Tooltip Chart ────────────────────────────────────────────────────────────
function TT({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'var(--card2)', border:'1px solid var(--border)',
      borderRadius:8, padding:'8px 12px', fontSize:11 }}>
      <div style={{ color:'var(--muted)', marginBottom:4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color:p.color, marginBottom:2 }}>
          {p.name}: <b>{typeof p.value==='number' ? p.value.toLocaleString() : p.value}</b>
        </div>
      ))}
    </div>
  );
}

// ─── Score Bar ────────────────────────────────────────────────────────────────
function ScoreBar({ label, score, maxScore=100, col }) {
  return (
    <div style={{ marginBottom:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:3 }}>
        <span style={{ color:'var(--muted)' }}>{label}</span>
        <span style={{ color:col, fontWeight:700 }}>{score}/{maxScore}</span>
      </div>
      <div style={{ background:'var(--border)', borderRadius:5, height:8, overflow:'hidden' }}>
        <div style={{ width:`${Math.min(100,Math.round(score/maxScore*100))}%`,
          height:'100%', background:`linear-gradient(90deg,${col}99,${col})`, borderRadius:5 }} />
      </div>
    </div>
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────────
function Chip({ label, color, size=10, pulse }) {
  return (
    <span style={{ background:color+'22', color, border:`1px solid ${color}55`,
      borderRadius:6, padding:'2px 9px', fontSize:size, fontWeight:700, whiteSpace:'nowrap',
      animation: pulse ? 'glow 1.4s ease-in-out infinite' : '' }}>
      {label}
    </span>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function Card({ children, style={}, glow }) {
  return (
    <div style={{ background:'var(--card)', border:`1px solid ${glow||'var(--border)'}`,
      borderRadius:12, padding:'13px 15px',
      boxShadow: glow ? `0 0 20px ${glow}15` : 'none', ...style }}>
      {children}
    </div>
  );
}

// ─── Fetch Button ─────────────────────────────────────────────────────────────
function FetchBtn({ onClick, loading, label, icon, col, small }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      background: loading ? 'var(--card2)' : `${col}22`,
      border: `1px solid ${loading ? 'var(--border)' : col}`,
      color: loading ? 'var(--muted)' : col,
      borderRadius:7, padding: small ? '4px 10px' : '6px 13px',
      fontSize: small ? 9 : 10, fontWeight:700,
      cursor: loading ? 'default' : 'pointer',
      display:'flex', alignItems:'center', gap:4, whiteSpace:'nowrap',
    }}>
      <span style={{ animation: loading ? 'spin 1s linear infinite' : '' }}>
        {loading ? '⟳' : icon}
      </span>
      {loading ? 'Đang cập nhật...' : label}
    </button>
  );
}

// ─── Source Badge ─────────────────────────────────────────────────────────────
function SourceBadge({ source }) {
  if (!source) return null;
  const meta = {
    stooq:         { label:'Stooq',     col:A.green  },
    yahoo:         { label:'Yahoo',     col:A.teal   },
    claude_search: { label:'AI Search', col:A.amber  },
  }[source] || { label:source, col:A.muted };
  return (
    <span style={{ fontSize:8, padding:'1px 6px', borderRadius:4, fontWeight:700,
      background:meta.col+'22', color:meta.col, border:`1px solid ${meta.col}44` }}>
      📡 {meta.label}
    </span>
  );
}// ─── Timestamp Badge (fix hydration) ────────────────────────────────────────
function TsBadge({ ts }) {
  const [age, setAge]         = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!ts) return;
    const tick = () => setAge(fmtAge(ts));
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [ts]);

  if (!mounted) return <span style={{ fontSize:8, color:'var(--muted)' }}>–</span>;
  if (!ts) return <span style={{ fontSize:8, color:'var(--muted)', fontStyle:'italic' }}>Chưa cập nhật</span>;
  const sec = Math.floor((Date.now()-ts)/1000);
  const c = sec<300 ? A.green : sec<1800 ? A.amber : A.red;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:3 }}>
      <span style={{ width:4, height:4, borderRadius:'50%', background:c, display:'inline-block' }} />
      <span style={{ fontSize:8, color:c, fontWeight:600 }}>{fmtTime(ts)} · {age}</span>
    </div>
  );
}

// ─── News Panel ───────────────────────────────────────────────────────────────
function NewsPanel({ news, loading, onRefresh }) {
  if (loading) return (
    <div style={{ padding:'10px 0', textAlign:'center', fontSize:10, color:'var(--muted)' }}>
      ⟳ Đang tải tin tức...
    </div>
  );
  if (!news?.length) return (
    <div style={{ padding:'8px 0' }}>
      <FetchBtn onClick={onRefresh} loading={loading} label="Tải tin tức" icon="📰" col={A.blue} small />
    </div>
  );
  return (
    <div>
      {news.map((n, i) => {
        const col = n.direction==='bullish' ? A.green : n.direction==='bearish' ? A.red : A.amber;
        const imp = n.impact==='high' ? A.red : n.impact==='medium' ? A.amber : A.teal;
        return (
          <div key={i} style={{ background:'var(--card2)', border:`1px solid ${col}33`,
            borderRadius:8, padding:'7px 10px', marginBottom:5 }}>
            <div style={{ display:'flex', justifyContent:'space-between',
              alignItems:'flex-start', gap:6, marginBottom:3 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--text)', flex:1 }}>{n.title}</div>
              <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3,
                  background:imp+'22', color:imp, fontWeight:700 }}>{n.impact?.toUpperCase()}</span>
                <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3,
                  background:col+'22', color:col, fontWeight:700 }}>
                  {n.direction==='bullish'?'🟢':n.direction==='bearish'?'🔴':'🟡'}
                </span>
              </div>
            </div>
            <div style={{ fontSize:9, color:'var(--muted)' }}>{n.summary}</div>
            <div style={{ fontSize:8, color:'var(--muted)', marginTop:3 }}>{n.source}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Econ Calendar (fix hydration) ────────────────────────────────────────────
function EconCalendar({ events }) {
  const [now, setNow]         = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!mounted) return (
    <div style={{ color:'var(--muted)', fontSize:11, padding:'8px 0' }}>⏳ Đang tải...</div>
  );
  const sorted = [...(events||[])].sort((a,b) => a.ts - b.ts);
  if (!sorted.length) return (
    <div style={{ color:'var(--muted)', fontSize:11, padding:'8px 0' }}>
      ⏳ Nhấn Cập nhật để tải sự kiện.
    </div>
  );
  return (
    <div>
      {sorted.map((ev, i) => {
        const ms   = ev.ts - now;
        const past = ms < 0;
        const abs  = Math.abs(ms);
        const col  = ev.impact==='high' ? A.red : ev.impact==='medium' ? A.amber : A.teal;
        const hh   = String(Math.floor(abs/3600000)).padStart(2,'0');
        const mm   = String(Math.floor((abs%3600000)/60000)).padStart(2,'0');
        const ss   = String(Math.floor((abs%60000)/1000)).padStart(2,'0');
        return (
          <div key={i} style={{ background:'var(--card2)',
            border:`1px solid ${past?'var(--border)':col+'55'}`,
            borderRadius:8, padding:'7px 10px', marginBottom:4, opacity:past?0.5:1 }}>
            <div style={{ display:'flex', justifyContent:'space-between',
              alignItems:'center', marginBottom:past?0:3 }}>
              <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                <span style={{ background:col+'22', color:col, borderRadius:4,
                  padding:'1px 5px', fontSize:8, fontWeight:800 }}>{ev.impact?.toUpperCase()}</span>
                <span style={{ fontSize:10, fontWeight:700, color:'var(--text)' }}>{ev.name}</span>
              </div>
              <div style={{ fontSize:12, fontWeight:800,
                color:past?'var(--muted)':col, fontFamily:'var(--font-mono)' }}>
                {past ? 'ĐÃ QUA' : `${hh}:${mm}:${ss}`}
              </div>
            </div>
            {!past && ev.note && (
              <div style={{ background:col+'10', borderRadius:4,
                padding:'2px 6px', fontSize:9, color:col }}>💡 {ev.note}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Gauge Fear & Greed ───────────────────────────────────────────────────────
function Gauge({ value }) {
  const segs = [
    {s:0,e:30,c:A.red},{s:30,e:50,c:A.orange},
    {s:50,e:70,c:A.amber},{s:70,e:85,c:A.green},{s:85,e:100,c:A.teal},
  ];
  const a  = -180+(value/100)*180;
  const r2 = (a*Math.PI)/180;
  const cx=90, cy=80, R=60;
  const nx = cx+R*Math.cos(r2), ny=cy+R*Math.sin(r2);
  const col = value<30?A.red:value<50?A.orange:value<70?A.amber:value<85?A.green:A.teal;
  return (
    <svg width="180" height="105" viewBox="0 0 180 105">
      {segs.map(({s,e,c},i)=>{
        const a1=(-180+(s/100)*180)*Math.PI/180;
        const a2=(-180+(e/100)*180)*Math.PI/180;
        const x1=cx+R*Math.cos(a1),y1=cy+R*Math.sin(a1);
        const x2=cx+R*Math.cos(a2),y2=cy+R*Math.sin(a2);
        return(<path key={i}
          d={`M${cx} ${cy}L${x1} ${y1}A${R} ${R} 0 ${e-s>50?1:0} 1 ${x2} ${y2}Z`}
          fill={c} opacity={0.75}/>);
      })}
      <circle cx={cx} cy={cy} r={46} fill="var(--card)"/>
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={col} strokeWidth={2.5} strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={5} fill={col}/>
      <text x={cx} y={cy-16} textAnchor="middle" fill={col} fontSize={20} fontWeight={700}>{value}</text>
      <text x={cx} y={cy-2} textAnchor="middle" fill="var(--muted)" fontSize={8}>
        {value<30?'SỢ HÃI':value<50?'LO NGẠI':value<70?'TRUNG LẬP':value<85?'THAM LAM':'EXTREME'}
      </text>
      <text x={4}   y={100} fill="var(--muted)" fontSize={8}>Sợ</text>
      <text x={150} y={100} fill="var(--muted)" fontSize={8}>Tham</text>
    </svg>
  );
}// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function Home() {
  const [s, setS]             = useState(INIT);
  const [tab, setTab]         = useState(0);
  const [futures, setFutures] = useState(DEF_FUTURES);
  const [bsEvents, setBSE]    = useState(BS_DEF);
  const [news, setNews]       = useState([]);
  const [verdictText, setVT]  = useState(null);
  const [priceSource, setPriceSource] = useState(null);

  // ─── Loading states ────────────────────────────────────────
  const [loadPrice,   setLoadPrice]   = useState(false);
  const [loadInv,     setLoadInv]     = useState(false);
  const [loadCOT,     setLoadCOT]     = useState(false);
  const [loadCal,     setLoadCal]     = useState(false);
  const [loadBS,      setLoadBS]      = useState(false);
  const [loadNews,    setLoadNews]    = useState(false);
  const [loadVerdict, setLoadVerdict] = useState(false);

  // ─── Timestamps ────────────────────────────────────────────
  const [tsPrice, setTsPrice] = useState(null);
  const [tsInv,   setTsInv]   = useState(null);
  const [tsCOT,   setTsCOT]   = useState(null);
  const [tsCal,   setTsCal]   = useState(null);

  // ─── Log ───────────────────────────────────────────────────
  const [log, setLog] = useState([]);
  const aLog = useCallback(m => {
    setLog(p => [`${new Date().toLocaleTimeString('vi-VN')} – ${m}`, ...p].slice(0,15));
  }, []);

  // ─── Patch helpers ─────────────────────────────────────────
  const patchPrice = useCallback(f => {
    setS(prev => {
      const next = {...prev, ...f};
      const lbl  = new Date().toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'});
      const pc   = [...prev.priceChart];
      const last = pc[pc.length-1];
      if (last && last.d !== lbl) pc.push({d:lbl,comex:next.comex,vol:next.session_vol||91000});
      else if (last) pc[pc.length-1] = {...last, comex:next.comex};
      return {...next, priceChart:pc.slice(-14), syncVer:(prev.syncVer||0)+1};
    });
  }, []);

  const patchInv = useCallback(f => {
    setS(prev => {
      const next = {...prev, ...f};
      const inv  = [...prev.invChart];
      const w    = new Date().toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'});
      const il   = inv[inv.length-1];
      inv.push({
        w, cmex:f.cmex_stocks??il?.cmex??0,
        lme:f.lme_stocks??il?.lme??0,
        shfe:f.shfe_stocks??il?.shfe??0,
        canc:f.warrants_cancelled??il?.canc??0,
      });
      if (inv.length>10) inv.shift();
      return {...next, invChart:inv, syncVer:(prev.syncVer||0)+1};
    });
  }, []);

  const patchCOT = useCallback(f => {
    setS(prev => {
      const next = {...prev, ...f};
      const cot  = [...prev.cotChart];
      if (f.mm_long !== undefined) {
        const w = new Date().toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'});
        cot.push({w, mm:f.mm_long, comm:f.comm_short??prev.comm_short??-73000});
        if (cot.length>10) cot.shift();
      }
      return {...next, cotChart:cot, syncVer:(prev.syncVer||0)+1};
    });
  }, []);

  // ─── Fetch Price ────────────────────────────────────────────
  const fetchPrice = useCallback(async () => {
    if (loadPrice) return;
    setLoadPrice(true); aLog('⚡ Cập nhật giá...');
    try {
      const r = await fetch('/api/price');
      const d = await r.json();
      if (d.comex) {
        patchPrice(d);
        setTsPrice(Date.now());
        setPriceSource(d.source || 'unknown');
        aLog(`✅ COMEX $${d.comex.toFixed(3)}/lb [${d.source}]`);
      } else aLog('⚠️ Không lấy được giá');
    } catch(e) { aLog(`❌ ${e.message}`); }
    finally { setLoadPrice(false); }
  }, [loadPrice, aLog, patchPrice]);

  // ─── Fetch Inventory ────────────────────────────────────────
  const fetchInventory = useCallback(async () => {
    if (loadInv) return;
    setLoadInv(true); aLog('📦 Cập nhật tồn kho...');
    try {
      const r = await fetch('/api/claude', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          model:'claude-sonnet-4-5', max_tokens:500,
          messages:[{ role:'user', content:
            `Search today LME copper warehouse stocks MT, SHFE copper inventory MT, COMEX copper stocks MT.
Return ONLY raw JSON: {"lme_stocks":<int>,"shfe_stocks":<int>,"cmex_stocks":<int>,"warrants_cancelled":<int>}`
          }],
        }),
      });
      const d = await r.json();
      const p = extractJ(getTxt(d));
      if (p?.lme_stocks) {
        patchInv(p); setTsInv(Date.now());
        aLog(`✅ LME ${p.lme_stocks?.toLocaleString()} MT`);
      } else aLog('⚠️ Không parse được tồn kho');
    } catch(e) { aLog(`❌ ${e.message}`); }
    finally { setLoadInv(false); }
  }, [loadInv, aLog, patchInv]);

  // ─── Fetch COT ──────────────────────────────────────────────
  const fetchCOT = useCallback(async () => {
    if (loadCOT) return;
    setLoadCOT(true); aLog('🦈 Cập nhật COT...');
    try {
      const r = await fetch('/api/claude', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          model:'claude-sonnet-4-5', max_tokens:500,
          messages:[{ role:'user', content:
            `Search latest CFTC COT copper managed money long contracts, fear greed index, copper gold ratio, DXY.
Return ONLY raw JSON: {"mm_long":<int>,"comm_short":<int>,"fear_greed":<int>,"cu_gold_ratio":<float>,"dxy":<float>,"dxy_chg":<float>}`
          }],
        }),
      });
      const d = await r.json();
      const p = extractJ(getTxt(d));
      if (p?.mm_long) {
        patchCOT(p); setTsCOT(Date.now());
        aLog(`✅ MM Long ${p.mm_long?.toLocaleString()}`);
      } else aLog('⚠️ Không parse được COT');
    } catch(e) { aLog(`❌ ${e.message}`); }
    finally { setLoadCOT(false); }
  }, [loadCOT, aLog, patchCOT]);

  // ─── Fetch Calendar ─────────────────────────────────────────
  const fetchCalendar = useCallback(async () => {
    if (loadCal) return;
    setLoadCal(true); aLog('📅 Cập nhật lịch...');
    try {
      const r = await fetch('/api/claude', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          model:'claude-sonnet-4-5', max_tokens:800,
          messages:[{ role:'user', content:
            `Search economic calendar next 72 hours affecting copper: FOMC, China PMI, NFP, LME reports.
Return ONLY raw JSON array: [{"name":"<str>","impact":"<high|medium|low>","currency":"<str>","ts":<unix ms>,"note":"<Vietnamese>"}]`
          }],
        }),
      });
      const d = await r.json();
      const p = extractJ(getTxt(d));
      if (Array.isArray(p) && p.length>0) {
        setS(prev => ({...prev, calendarEvents:p, syncVer:(prev.syncVer||0)+1}));
        setTsCal(Date.now());
        aLog(`✅ Lịch: ${p.length} sự kiện`);
      } else aLog('⚠️ Không parse được lịch');
    } catch(e) { aLog(`❌ ${e.message}`); }
    finally { setLoadCal(false); }
  }, [loadCal, aLog]);

  // ─── Fetch News ─────────────────────────────────────────────
  const fetchNews = useCallback(async () => {
    if (loadNews) return;
    setLoadNews(true); aLog('📰 Tải tin tức...');
    try {
      const r = await fetch('/api/news');
      const d = await r.json();
      if (d.news?.length) { setNews(d.news); aLog(`✅ Tin tức: ${d.news.length} bài`); }
      else aLog('⚠️ Không có tin tức');
    } catch(e) { aLog(`❌ ${e.message}`); }
    finally { setLoadNews(false); }
  }, [loadNews, aLog]);

  // ─── Fetch Black Swan ────────────────────────────────────────
  const fetchBS = useCallback(async () => {
    if (loadBS) return;
    setLoadBS(true); aLog('🦢 Quét Black Swan...');
    try {
      const r = await fetch('/api/claude', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          model:'claude-sonnet-4-5', max_tokens:800,
          messages:[{ role:'user', content:
            `Search copper supply risks: mine strikes Chile Peru, trade war tariffs, China demand shock, DRC instability.
Return ONLY raw JSON array: [{"region":"<str>","event":"<Vietnamese>","impact":<int 0-100>,"bsType":"<acute|structural>"}]`
          }],
        }),
      });
      const d = await r.json();
      const p = extractJ(getTxt(d));
      if (Array.isArray(p) && p.length>0) {
        setBSE(p.map(e => ({...e, col:e.impact>70?A.red:e.impact>50?A.orange:A.amber})));
        aLog(`✅ BS: ${p.length} rủi ro`);
      } else aLog('⚠️ Không parse được BS');
    } catch(e) { aLog(`❌ ${e.message}`); }
    finally { setLoadBS(false); }
  }, [loadBS, aLog]);

  // ─── Fetch All ──────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    await fetchPrice();
    await new Promise(r => setTimeout(r,1000));
    await fetchInventory();
    await new Promise(r => setTimeout(r,1000));
    await fetchCOT();
    await new Promise(r => setTimeout(r,1000));
    await fetchCalendar();
    await new Promise(r => setTimeout(r,1000));
    await fetchNews();
  }, [fetchPrice, fetchInventory, fetchCOT, fetchCalendar, fetchNews]);

  // ─── AI Verdict ─────────────────────────────────────────────
  const doVerdict = useCallback(async (verdict, ti, mh, bias) => {
    if (loadVerdict) return;
    setLoadVerdict(true); aLog('🧠 AI Verdict...');
    try {
      const r = await fetch('/api/claude', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          model:'claude-sonnet-4-5', max_tokens:800,
          messages:[{ role:'user', content:
            `Bạn là chuyên gia phân tích đồng. Viết phân tích tiếng Việt 3 đoạn ~180 từ:
COMEX: $${s.comex?.toFixed(3)}/lb | PK1: ${ti.pk1Score} | PK2: ${mh.pk2Score} | Bias: ${bias} | VERDICT: ${verdict.final}/100 – ${verdict.verdictLabel}
Đoạn 1: Tổng quan. Đoạn 2: Điểm mạnh/yếu. Đoạn 3: Hành động cụ thể + giá mục tiêu.`
          }],
        }),
      });
      const d    = await r.json();
      const text = getTxt(d);
      if (text) { setVT(text); aLog('✅ AI Verdict hoàn tất'); }
    } catch(e) { aLog(`❌ ${e.message}`); }
    finally { setLoadVerdict(false); }
  }, [loadVerdict, aLog, s.comex]);

  // ─── Calculations ───────────────────────────────────────────
  const curveInfo    = useMemo(() => analyzeCurve(futures), [futures]);
  const stress       = useMemo(() => runStress(bsEvents, s.bias_raw||63), [bsEvents, s.bias_raw]);
  const vsa          = useMemo(() => calcVSA(s.priceChart), [s.priceChart]);
  const ew           = useMemo(() => calcElliott(s.priceChart, s.comex||6.07), [s.priceChart, s.comex]);
  const ti           = useMemo(() => calcTI(s.priceChart, s.comex||6.07, s.rsi_h4||68, vsa, ew), [s.priceChart, s.comex, s.rsi_h4, vsa, ew]);
  const mh           = useMemo(() => calcMH(s.invChart, s.cotChart, s.cmex_stocks, s.prev_cmex_stocks, s.lme_stocks, s.prev_lme_stocks, s.shfe_stocks, s.prev_shfe_stocks, s.mm_long), [s]);
  const pricePattern = useMemo(() => calcPricePattern(s.priceChart), [s.priceChart]);
  const pci          = useMemo(() => calcPCI(s.mm_long, s.comm_short), [s.mm_long, s.comm_short]);
  const cgI          = useMemo(() => interpCG(s.cu_gold_ratio||0.059), [s.cu_gold_ratio]);
  const handoff      = useMemo(() => calcHandoff(s.comex_chg_pct, s.session_vol, s.avg_vol), [s.comex_chg_pct, s.session_vol, s.avg_vol]);
  const regime       = useMemo(() => detectRegime(s.dxy_chg, s.fear_greed, s.cu_gold_ratio), [s.dxy_chg, s.fear_greed, s.cu_gold_ratio]);
  const weights      = useMemo(() => getWeights(regime), [regime]);
  const radarData    = useMemo(() => [
    {f:'Volume', s:Math.min(100,Math.round((s.vol_ma20_ratio||1.42)*50))},
    {f:'RSI H4', s:s.rsi_h4||68},
    {f:'Vật lý', s:(s.cmex_stocks||9500)<15000?74:45},
    {f:'TC/RC',  s:(s.tc_rc||4)<10?70:35},
    {f:'COT',    s:Math.min(99,Math.round(((s.mm_long||64000)/80000)*85))},
    {f:'Liên TT',s:60},
  ], [s]);
  const wRaw  = useMemo(() => Math.round(radarData.reduce((a,it,i)=>a+it.s*weights[i],0)), [radarData, weights]);
  const pciA  = pci>65?3:pci>45?0:-5;
  const bias  = useMemo(() => Math.max(0,Math.min(100,
    wRaw+pciA+cgI.adj+handoff.score+curveInfo.biasAdj
    -Math.round((stress.bsRisk||0)*0.15)
    -((s.fear_greed||58)>80?10:0)
  )), [wRaw,pciA,cgI.adj,handoff.score,curveInfo.biasAdj,stress.bsRisk,s.fear_greed]);
  const verdict = useMemo(() => calcVerdict(ti.pk1Score, mh.pk2Score, bias, stress), [ti, mh, bias, stress]);

  // ─── Trade Playbook calculations (MỚI) ─────────────────────
  const liq  = useMemo(() => calcLiq(s.comex||6.07, s.prev_high||6.12, s.prev_low||5.89, s.session_vol||91000, s.avg_vol||105000), [s.comex, s.prev_high, s.prev_low, s.session_vol, s.avg_vol]);
  const ez   = useMemo(() => calcEZ(s.comex||6.07, s.sl||5.72, s.tp1||6.32, s.tp2||6.58, s.prev_high||6.12, s.prev_low||5.89, s.atr||0.12), [s.comex, s.sl, s.tp1, s.tp2, s.prev_high, s.prev_low, s.atr]);
  const sc   = useMemo(() => calcSC(ew, vsa, stress, bias, s.comex||6.07, s.tp1||6.32, s.tp2||6.58, s.sl||5.72), [ew, vsa, stress, bias, s.comex, s.tp1, s.tp2, s.sl]);
  const plan = useMemo(() => buildPlan(s, ew, vsa, ti, mh, verdict, bias, stress, liq, ez, sc), [s, ew, vsa, ti, mh, verdict, bias, stress, liq, ez, sc]);

  const sigCol  = bias>=70?A.green:bias>=55?A.amber:A.red;
  const comexUp = (s.comex_chg_pct||0) >= 0;
  const rLabel  = regime==='risk_off'?'⚠️ RISK-OFF':regime==='stagflation'?'🌡️ STAGFLATION':'✅ RISK-ON';
  const rCol    = regime==='risk_off'?A.red:regime==='stagflation'?A.orange:A.green;

  // ─── RENDER ─────────────────────────────────────────────────
  return (
    <Layout tab={tab} onTabChange={setTab} priceData={s} verdict={verdict}>

      {/* ── Top action bar ── */}
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap',
        marginBottom:12, background:'var(--card)', borderRadius:10,
        padding:'8px 12px', border:'1px solid var(--border)' }}>
        <FetchBtn onClick={fetchAll}
          loading={loadPrice||loadInv||loadCOT||loadCal||loadNews}
          label="🔄 CẬP NHẬT TẤT CẢ" icon="🔄" col={A.blue} />
        <FetchBtn onClick={fetchPrice}    loading={loadPrice} label="⚡ Giá"  icon="⚡" col={A.cyan}  small />
        <FetchBtn onClick={fetchInventory} loading={loadInv}  label="📦 Kho"  icon="📦" col={A.teal}  small />
        <FetchBtn onClick={fetchCOT}      loading={loadCOT}   label="🦈 COT"  icon="🦈" col={A.green} small />
        <FetchBtn onClick={fetchNews}     loading={loadNews}  label="📰 Tin"  icon="📰" col={A.amber} small />
        <div style={{ marginLeft:'auto', display:'flex', gap:6, alignItems:'center' }}>
          <Chip label={rLabel} color={rCol} size={9} />
          <Chip label={`BS ${stress.bsRisk}/100`} color={stress.sevCol} size={9} />
          <span style={{ fontSize:8, color:'var(--muted)' }}>#{s.syncVer}</span>
        </div>
      </div>

      {/* ── Metric cards ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',
        gap:8, marginBottom:12 }}>

        {/* COMEX với SourceBadge */}
        <div style={{ background:'var(--card2)', border:'1px solid var(--border)',
          borderRadius:8, padding:'8px 10px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:2 }}>
            <span style={{ fontSize:8, color:'var(--muted)' }}>COMEX</span>
            <SourceBadge source={priceSource} />
          </div>
          <div style={{ fontSize:15, fontWeight:800, color:comexUp?A.green:A.red,
            fontFamily:'var(--font-mono)' }}>${s.comex?.toFixed(3)||'6.070'}</div>
          <div style={{ fontSize:9, color:comexUp?A.green:A.red }}>
            {comexUp?'▲':'▼'} {Math.abs(s.comex_chg_pct||0).toFixed(2)}%
          </div>
        </div>

        {[
          {lbl:'DXY',     val:`${s.dxy||99.8}`,     chg:s.dxy_chg,        col:(s.dxy_chg||0)<0?A.green:A.red},
          {lbl:'PK1',     val:`${ti.pk1Score}/100`,  col:ti.pk1Col},
          {lbl:'PK2',     val:`${mh.pk2Score}/100`,  col:mh.pk2Col},
          {lbl:'Elliott', val:`W${ew.wave}`,          col:ew.failure?A.red:A.blue},
          {lbl:'VSA',     val:vsa.meta.short,         col:vsa.bullish?A.green:vsa.bearish?A.red:A.amber},
          {lbl:'Verdict', val:`${verdict.final}/100`, col:verdict.verdictCol},
          {lbl:'Curve',   val:curveInfo.type==='BACKWARDATION'?'BACK':'CONT', col:curveInfo.col},
        ].map((m,i) => (
          <div key={i} style={{ background:'var(--card2)', border:'1px solid var(--border)',
            borderRadius:8, padding:'8px 10px' }}>
            <div style={{ fontSize:8, color:'var(--muted)', marginBottom:2 }}>{m.lbl}</div>
            <div style={{ fontSize:15, fontWeight:800, color:m.col,
              fontFamily:'var(--font-mono)' }}>{m.val}</div>
            {m.chg !== undefined && (
              <div style={{ fontSize:9, color:m.chg>=0?A.green:A.red }}>
                {m.chg>=0?'▲':'▼'} {Math.abs(m.chg).toFixed(2)}%
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          TAB 0 — Tổng quan
      ══════════════════════════════════════════════════════ */}
      {tab===0 && (
        <div style={{ display:'grid', gap:10 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:10 }}>

            <Card glow={verdict.verdictCol}>
              <div style={{ fontSize:11, fontWeight:700, marginBottom:8 }}>🏁 VERDICT</div>
              <div style={{ background:verdict.verdictCol+'18', border:`2px solid ${verdict.verdictCol}55`,
                borderRadius:10, padding:'12px', textAlign:'center', marginBottom:8 }}>
                <div style={{ fontSize:11, fontWeight:800, color:verdict.verdictCol }}>{verdict.verdictLabel}</div>
                <div style={{ fontSize:36, fontWeight:800, color:verdict.verdictCol, lineHeight:1 }}>{verdict.final}</div>
                <div style={{ fontSize:8, color:'var(--muted)' }}>/100</div>
              </div>
              <ScoreBar label="PK1 — Kỹ thuật" score={ti.pk1Score} col={ti.pk1Col} />
              <ScoreBar label="PK2 — Nền tảng"  score={mh.pk2Score} col={mh.pk2Col} />
              <ScoreBar label="Bias tổng hợp"   score={bias}        col={sigCol}    />
              <div style={{ marginTop:8 }}>
                <FetchBtn onClick={() => doVerdict(verdict,ti,mh,bias)}
                  loading={loadVerdict} label="🧠 AI Phân tích" icon="🧠" col={A.purple} />
              </div>
              {verdictText && (
                <div style={{ marginTop:8, background:A.purple+'08', borderRadius:8,
                  padding:'10px', fontSize:10, color:'var(--text)', lineHeight:1.8, whiteSpace:'pre-line' }}>
                  {verdictText}
                </div>
              )}
            </Card>

            <Card>
              <div style={{ fontSize:11, fontWeight:700, marginBottom:6 }}>🧠 SỢ HÃI & THAM LAM</div>
              <div style={{ display:'flex', justifyContent:'center' }}><Gauge value={s.fear_greed||58} /></div>
              <div style={{ marginTop:10, borderTop:'1px solid var(--border)', paddingTop:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <div style={{ fontSize:11, fontWeight:700 }}>📰 TIN TỨC</div>
                  <FetchBtn onClick={fetchNews} loading={loadNews} label="Cập nhật" icon="🔄" col={A.amber} small />
                </div>
                <NewsPanel news={news} loading={loadNews} onRefresh={fetchNews} />
              </div>
            </Card>
          </div>

          <Card glow={comexUp?A.green:A.red}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ fontSize:11, fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
                📈 COMEX PRICE CHART <SourceBadge source={priceSource} />
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <TsBadge ts={tsPrice} />
                <FetchBtn onClick={fetchPrice} loading={loadPrice} label="Cập nhật" icon="🔄" col={A.cyan} small />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={s.priceChart}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="d" tick={{fill:'var(--muted)',fontSize:9}} />
                <YAxis yAxisId="p" domain={['auto','auto']} tick={{fill:'var(--muted)',fontSize:9}} tickFormatter={v=>`$${v.toFixed(2)}`} />
                <YAxis yAxisId="v" orientation="right" tick={{fill:'var(--muted)',fontSize:8}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<TT/>} />
                <Bar yAxisId="v" dataKey="vol" name="Vol" fill={A.blue} opacity={0.2} />
                <Line yAxisId="p" type="monotone" dataKey="comex" name="COMEX"
                  stroke={comexUp?A.green:A.red} strokeWidth={2} dot={{r:3}} />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>

          <Card glow={A.amber}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ fontSize:11, fontWeight:700 }}>📅 LỊCH KINH TẾ</div>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <TsBadge ts={tsCal} />
                <FetchBtn onClick={fetchCalendar} loading={loadCal} label="Cập nhật" icon="🔄" col={A.amber} small />
              </div>
            </div>
            <EconCalendar events={s.calendarEvents||[]} />
          </Card>

          <Card>
            <div style={{ fontSize:11, fontWeight:700, marginBottom:6 }}>📋 ACTIVITY LOG</div>
            {log.slice(0,8).map((l,i) => (
              <div key={i} style={{ fontSize:9,
                color: i===0 ? A.cyan : 'var(--muted)',
                padding:'2px 4px', background: i===0?`${A.cyan}08`:'transparent',
                borderRadius:3, marginBottom:2 }}>{l}</div>
            ))}
            {!log.length && <div style={{ fontSize:9, color:'var(--muted)' }}>Nhấn Cập nhật để bắt đầu...</div>}
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 1 — Xu hướng
      ══════════════════════════════════════════════════════ */}
      {tab===1 && (
        <div style={{ display:'grid', gap:10 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:10 }}>

            <Card glow={ew.failure?A.red:A.blue}>
              <div style={{ fontSize:11, fontWeight:700, marginBottom:8 }}>🌊 ELLIOTT WAVE + FIB</div>
              <div style={{ background:(ew.failure?A.red:A.blue)+'14', borderRadius:8, padding:'8px', marginBottom:8 }}>
                <div style={{ fontSize:12, fontWeight:800, color:ew.failure?A.red:A.cyan }}>{ew.label}</div>
                <div style={{ fontSize:10, color:'var(--muted)', marginTop:3 }}>{ew.scenario}</div>
              </div>
              {[
                {lbl:'Fib 0.382',val:ew.fib382,col:A.teal},
                {lbl:'Fib 0.500',val:ew.fib500,col:A.blue},
                {lbl:'Fib 0.618',val:ew.fib618,col:A.amber},
                {lbl:'Fib 0.786',val:ew.fib786,col:A.red},
              ].map((f,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:7, padding:'5px 8px',
                  background: Math.abs((s.comex||6.07)-f.val)<0.05?f.col+'18':'var(--card2)',
                  border:`1px solid ${Math.abs((s.comex||6.07)-f.val)<0.05?f.col:'var(--border)'}`,
                  borderRadius:6, marginBottom:4 }}>
                  <span style={{ fontSize:9, color:'var(--muted)', width:65 }}>{f.lbl}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:f.col, fontFamily:'var(--font-mono)' }}>
                    ${f.val?.toFixed(3)||'–'}
                  </span>
                  {Math.abs((s.comex||6.07)-f.val)<0.05 && <Chip label="← NOW" color={f.col} size={8} />}
                </div>
              ))}
            </Card>

            <Card glow={vsa.bullish?A.green:vsa.bearish?A.red:A.amber}>
              <div style={{ fontSize:11, fontWeight:700, marginBottom:8 }}>📊 VSA ENGINE</div>
              <div style={{ background:(vsa.bullish?A.green:vsa.bearish?A.red:A.amber)+'14',
                borderRadius:7, padding:'7px', marginBottom:7 }}>
                <div style={{ fontSize:11, fontWeight:800,
                  color:vsa.bullish?A.green:vsa.bearish?A.red:A.amber }}>{vsa.meta.label}</div>
                <div style={{ fontSize:9, color:'var(--muted)', marginTop:2 }}>{vsa.meta.desc}</div>
              </div>
              {vsa.bars.slice(-5).reverse().map((b,i) => {
                const VC = {ABSORPTION_BULL:A.green,ABSORPTION_BEAR:A.red,STOPPING_VOLUME:A.amber,
                  UPTHRUST:A.red,SPRING:A.green,NO_DEMAND:A.orange,NO_SUPPLY:A.teal,NEUTRAL:'var(--muted)'};
                const col = VC[b.vsa]||'var(--muted)';
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 7px',
                    background: i===0?col+'12':'var(--card2)',
                    border:`1px solid ${i===0?col:'var(--border)'}`, borderRadius:5, marginBottom:3 }}>
                    <span style={{ fontSize:9, color:'var(--muted)', width:36 }}>{b.d}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:b.up?A.green:A.red }}>
                      ${b.comex?.toFixed(3)}
                    </span>
                    <span style={{ fontSize:9, color:'var(--muted)', flex:1 }}>{b.volRatio}×</span>
                    <Chip label={b.vsa} color={col} size={8} />
                  </div>
                );
              })}
            </Card>
          </div>

          <Card glow={pricePattern.meta.col}>
            <div style={{ fontSize:11, fontWeight:700, marginBottom:8 }}>
              🔍 PRICE PATTERN · <span style={{ color:pricePattern.meta.col }}>{pricePattern.meta.name}</span>
            </div>
            <div style={{ background:pricePattern.meta.col+'12',
              border:`1px solid ${pricePattern.meta.col}44`, borderRadius:10, padding:'10px' }}>
              <div style={{ fontSize:12, fontWeight:800, color:pricePattern.meta.col, marginBottom:5 }}>
                {pricePattern.meta.name}
              </div>
              <div style={{ fontSize:10, color:'var(--text)', lineHeight:1.7, marginBottom:7 }}>
                {pricePattern.desc}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
                <div style={{ background:'var(--card2)', borderRadius:6, padding:'6px 8px' }}>
                  <div style={{ fontSize:8, color:'var(--muted)' }}>Độ tin cậy</div>
                  <div style={{ fontSize:16, fontWeight:800, color:pricePattern.meta.col }}>
                    {pricePattern.reliability}%
                  </div>
                </div>
                <div style={{ background:'var(--card2)', borderRadius:6, padding:'6px 8px' }}>
                  <div style={{ fontSize:8, color:'var(--muted)' }}>Target</div>
                  <div style={{ fontSize:16, fontWeight:800, color:pricePattern.meta.col }}>
                    ${pricePattern.target}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 2 — Nền tảng
      ══════════════════════════════════════════════════════ */}
      {tab===2 && (
        <div style={{ display:'grid', gap:10 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:10 }}>

            <Card glow={mh.cotBullish?A.green:A.amber}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <div style={{ fontSize:11, fontWeight:700 }}>🦈 COT SMART MONEY</div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <TsBadge ts={tsCOT} />
                  <FetchBtn onClick={fetchCOT} loading={loadCOT} label="Cập nhật" icon="🔄" col={A.green} small />
                </div>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={s.cotChart}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="w" tick={{fill:'var(--muted)',fontSize:8}} />
                  <YAxis tick={{fill:'var(--muted)',fontSize:8}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<TT/>} />
                  <Area type="monotone" dataKey="mm"   name="MM Long"     stroke={A.green} fill={A.green} fillOpacity={0.2} />
                  <Area type="monotone" dataKey="comm" name="Commercials" stroke={A.red}   fill={A.red}   fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:5, marginTop:6 }}>
                {[
                  {lbl:'MM Long',   val:`+${(s.mm_long||64000).toLocaleString()}`, col:A.green},
                  {lbl:'PCI',       val:`${pci}%`, col:pci>65?A.green:pci>45?A.amber:A.red},
                  {lbl:'PK2 Score', val:`${mh.pk2Score}/100`, col:mh.pk2Col},
                ].map((m,i) => (
                  <div key={i} style={{ background:'var(--card2)', borderRadius:6, padding:'5px 7px', textAlign:'center' }}>
                    <div style={{ fontSize:8, color:'var(--muted)' }}>{m.lbl}</div>
                    <div style={{ fontSize:11, fontWeight:800, color:m.col }}>{m.val}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card glow={mh.invTrend==='DECREASING'?A.teal:'var(--border)'}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <div style={{ fontSize:11, fontWeight:700 }}>📦 TỒN KHO 3 SÀN</div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <TsBadge ts={tsInv} />
                  <FetchBtn onClick={fetchInventory} loading={loadInv} label="Cập nhật" icon="🔄" col={A.teal} small />
                </div>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <ComposedChart data={s.invChart}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="w" tick={{fill:'var(--muted)',fontSize:8}} />
                  <YAxis yAxisId="i" tick={{fill:'var(--muted)',fontSize:8}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
                  <YAxis yAxisId="c" orientation="right" tick={{fill:'var(--muted)',fontSize:8}} />
                  <Tooltip content={<TT/>} />
                  <Bar yAxisId="i" dataKey="lme"  name="LME"   fill={A.blue}   opacity={0.6} stackId="s" />
                  <Bar yAxisId="i" dataKey="shfe" name="SHFE"  fill={A.purple} opacity={0.6} stackId="s" />
                  <Bar yAxisId="i" dataKey="cmex" name="COMEX" fill={A.cyan}   opacity={0.8} stackId="s" />
                  <Line yAxisId="c" type="monotone" dataKey="canc" name="Warrant"
                    stroke={A.orange} strokeWidth={2} dot={{r:3}} />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card glow={stress.sevCol}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ fontSize:11, fontWeight:700 }}>🦢 BLACK SWAN RADAR</div>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <Chip label={stress.sevLabel} color={stress.sevCol} size={9} />
                <FetchBtn onClick={fetchBS} loading={loadBS} label="Cập nhật" icon="🔄" col={A.red} small />
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:8 }}>
              {bsEvents.slice(0,4).map((e,i) => (
                <div key={i} style={{ background:'var(--card2)', border:`1px solid ${e.col}35`,
                  borderRadius:8, padding:'8px 10px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:10, fontWeight:700, color:e.col }}>📍 {e.region}</span>
                    <Chip label={`${e.impact}/100`} color={e.col} size={8} />
                  </div>
                  <div style={{ fontSize:9, color:'var(--text)', marginBottom:5 }}>{e.event}</div>
                  <div style={{ background:'var(--border)', borderRadius:3, height:3, overflow:'hidden' }}>
                    <div style={{ width:`${e.impact}%`, height:'100%', background:e.col }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 3 — Verdict
      ══════════════════════════════════════════════════════ */}
      {tab===3 && (
        <div style={{ display:'grid', gap:10 }}>
          <Card glow={verdict.verdictCol}>
            <div style={{ fontSize:12, fontWeight:800, marginBottom:12 }}>🏁 THE FINAL VERDICT</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',
              gap:8, marginBottom:12 }}>
              {[
                {icon:'🏗️',lbl:'PK1',score:ti.pk1Score,col:ti.pk1Col,thr:65},
                {icon:'🏗️',lbl:'PK2',score:mh.pk2Score,col:mh.pk2Col,thr:60},
                {icon:'⚖️',lbl:'Bias',score:bias,       col:sigCol,   thr:60},
              ].map((m,i) => (
                <div key={i} style={{ background:m.score>=m.thr?m.col+'14':'var(--card2)',
                  border:`2px solid ${m.score>=m.thr?m.col:'var(--border)'}`,
                  borderRadius:10, padding:'11px', textAlign:'center' }}>
                  <div style={{ fontSize:12, marginBottom:3 }}>{m.icon}</div>
                  <div style={{ fontSize:10, color:'var(--muted)', marginBottom:3 }}>{m.lbl}</div>
                  <div style={{ fontSize:28, fontWeight:800, color:m.col }}>{m.score}</div>
                  <div style={{ fontSize:8, color:'var(--muted)', marginBottom:5 }}>ngưỡng ≥ {m.thr}</div>
                  <Chip label={m.score>=m.thr?'✅ ĐẠT':'⏳ CHƯA'}
                    color={m.score>=m.thr?m.col:A.red} size={9} />
                </div>
              ))}
            </div>
            <div style={{ background:verdict.verdictCol+'18', border:`2px solid ${verdict.verdictCol}`,
              borderRadius:12, padding:'14px', textAlign:'center', marginBottom:10 }}>
              <div style={{ fontSize:12, fontWeight:800, color:verdict.verdictCol, marginBottom:4 }}>
                {verdict.verdictLabel}
              </div>
              <div style={{ fontSize:40, fontWeight:800, color:verdict.verdictCol, lineHeight:1 }}>
                {verdict.final}
              </div>
              <div style={{ fontSize:10, color:'var(--muted)', margin:'4px 0' }}>/100</div>
              <div style={{ background:'var(--border)', borderRadius:5, height:9, overflow:'hidden', margin:'8px 0' }}>
                <div style={{ width:`${verdict.final}%`, height:'100%', background:verdict.verdictCol }} />
              </div>
              <div style={{ fontSize:10, color:'var(--muted)' }}>{verdict.verdictDesc}</div>
            </div>
            <FetchBtn onClick={() => doVerdict(verdict,ti,mh,bias)}
              loading={loadVerdict} label="🧠 AI Phân tích chuyên sâu" icon="🧠" col={A.purple} />
            {verdictText && (
              <div style={{ marginTop:10, background:A.purple+'08', borderRadius:8, padding:'12px',
                fontSize:11, color:'var(--text)', lineHeight:1.9, whiteSpace:'pre-line' }}>
                {verdictText}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 4 — Kế hoạch phiên (TRADE PLAYBOOK MỚI)
      ══════════════════════════════════════════════════════ */}
      {tab===4 && (
        <div style={{ display:'grid', gap:10 }}>

          {/* ── Liquidity status ── */}
          <div style={{ background:liq.col+'18', border:`1.5px solid ${liq.col}`,
            borderRadius:10, padding:'10px 13px', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:14 }}>💧</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, fontWeight:800, color:liq.col }}>{liq.badge}</div>
              <div style={{ fontSize:9, color:'var(--muted)' }}>{liq.detail}</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
              {[
                {lbl:'Giá',   val:`${(s.comex||6.07).toFixed(3)}`, col:liq.col},
                {lbl:'Vol%',  val:`${(liq.volR*100).toFixed(0)}%`, col:liq.volR>1.8?A.red:A.blue},
                {lbl:'Status',val:liq.type==='normal'?'OK':liq.type.includes('sweep')?'SWEEP':'CLIMAX', col:liq.col},
              ].map((m,i) => (
                <div key={i} style={{ background:'var(--card)', borderRadius:6, padding:'4px 8px', textAlign:'center' }}>
                  <div style={{ fontSize:8, color:'var(--muted)' }}>{m.lbl}</div>
                  <div style={{ fontSize:11, fontWeight:800, color:m.col }}>{m.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Trade Playbook 3 kịch bản A/B/C ── */}
          <div>
            <div style={{ fontSize:12, fontWeight:800, color:'var(--text)', marginBottom:8 }}>
              📖 TRADE PLAYBOOK
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:8 }}>
              {plan.scenarios.map((sc2,i) => (
                <div key={i} style={{
                  background: sc2.active&&sc2.type!=='avoid' ? sc2.col+'10' : 'var(--card)',
                  border: `${sc2.active?2:1}px solid ${sc2.active?sc2.col:'var(--border)'}`,
                  borderRadius:12, padding:'13px' }}>

                  {/* Header */}
                  <div style={{ display:'flex', justifyContent:'space-between',
                    alignItems:'flex-start', marginBottom:8 }}>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <div style={{ width:26, height:26, borderRadius:8,
                        background: sc2.active?sc2.col:'var(--border)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:13, fontWeight:800,
                        color: sc2.active?'#080c14':'var(--muted)', flexShrink:0 }}>{sc2.id}</div>
                      <div>
                        <div style={{ fontSize:11, fontWeight:800,
                          color: sc2.active?sc2.col:'var(--muted)' }}>{sc2.name}</div>
                        <Chip label={sc2.badge} color={sc2.col} size={8} />
                      </div>
                    </div>
                    <div style={{ textAlign:'center', background:sc2.col+'18',
                      borderRadius:7, padding:'4px 8px', minWidth:44 }}>
                      <div style={{ fontSize:16, fontWeight:800, color:sc2.col }}>{sc2.prob}%</div>
                      <div style={{ fontSize:8, color:'var(--muted)' }}>prob</div>
                    </div>
                  </div>

                  {/* Thesis */}
                  <div style={{ background:sc2.col+'08', borderRadius:7, padding:'7px 9px',
                    marginBottom:7, border:`1px solid ${sc2.col}22` }}>
                    <div style={{ fontSize:9, fontWeight:700, color:sc2.col, marginBottom:2 }}>📌 LUẬN ĐIỂM</div>
                    <div style={{ fontSize:10, color:'var(--text)', lineHeight:1.6 }}>{sc2.thesis}</div>
                  </div>

                  {/* Entry/SL/TP/R:R grid */}
                  {sc2.type!=='avoid' && (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:4, marginBottom:7 }}>
                      {[
                        {lbl:'📍 Entry', val:`${sc2.entry.low}–${sc2.entry.high}`, col:sc2.col},
                        {lbl:'🛑 SL',    val:`${sc2.sl}`,   col:A.red},
                        {lbl:'🎯 TP1',  val:`${sc2.tp1}`,  col:A.green},
                        {lbl:'🎯 TP2',  val:`${sc2.tp2}`,  col:A.teal},
                        {lbl:'📊 R:R',  val:`1:${sc2.entry.rr}`, col:sc2.entry.rr>=2?A.green:A.amber},
                        {lbl:'📈 Vol',  val:'>1.2×TB',     col:A.blue},
                      ].map((p,j) => (
                        <div key={j} style={{ background:'var(--card2)', borderRadius:5,
                          padding:'4px 7px', border:'1px solid var(--border)' }}>
                          <div style={{ fontSize:8, color:'var(--muted)' }}>{p.lbl}</div>
                          <div style={{ fontSize:10, fontWeight:700, color:p.col,
                            fontFamily:'var(--font-mono)' }}>{p.val}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Confirmations */}
                  {sc2.confirmations.map((c,j) => (
                    <div key={j} style={{ display:'flex', gap:6, alignItems:'center',
                      padding:'3px 7px', background: c.ok?A.green+'08':A.red+'08',
                      borderRadius:4, marginBottom:3 }}>
                      <span style={{ fontSize:10 }}>{c.ok?'✅':'❌'}</span>
                      <div style={{ flex:1 }}>
                        <span style={{ fontSize:9, fontWeight:700,
                          color: c.ok?'var(--text)':'var(--muted)' }}>{c.lbl}</span>
                        <span style={{ fontSize:9, color:'var(--muted)', marginLeft:5 }}>{c.note}</span>
                      </div>
                    </div>
                  ))}

                  {/* Invalidation */}
                  <div style={{ background:A.red+'08', borderRadius:6, padding:'5px 8px',
                    border:`1px solid ${A.red}22`, marginTop:4 }}>
                    <div style={{ fontSize:9, fontWeight:700, color:A.red }}>⛔ Vô hiệu hóa:</div>
                    <div style={{ fontSize:9, color:'var(--muted)' }}>{sc2.invalidation}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Key Levels table ── */}
          <Card glow={A.cyan}>
            <div style={{ fontSize:11, fontWeight:700, marginBottom:8 }}>
              📐 KEY LEVELS · ${s.comex?.toFixed(3)||'6.070'}/lb
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:'0 3px', fontSize:9 }}>
                <thead>
                  <tr>
                    {['Mức','$/lb','Type','Δ%','Hành động'].map((h,i) => (
                      <th key={i} style={{ color:'var(--muted)', textAlign:i<2?'left':'center',
                        padding:'3px 7px', fontWeight:400, fontSize:8,
                        borderBottom:'1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plan.keyLevels.map((lv,i) => {
                    const dist = ((lv.price-(s.comex||6.07))/(s.comex||6.07)*100).toFixed(2);
                    const near = Math.abs(lv.price-(s.comex||6.07)) < 0.05;
                    return (
                      <tr key={i} style={{ background: near?`${lv.col}12`:i%2===0?'var(--card2)':'transparent' }}>
                        <td style={{ padding:'5px 7px', borderRadius:'5px 0 0 5px' }}>
                          <span style={{ fontWeight:700, color:lv.col }}>{lv.icon} {lv.lbl}</span>
                        </td>
                        <td style={{ padding:'5px 7px' }}>
                          <span style={{ fontSize:11, fontWeight:800, color:lv.col,
                            fontFamily:'var(--font-mono)' }}>${lv.price.toFixed(3)}</span>
                          {near && (
                            <span style={{ marginLeft:4, background:A.amber+'22', color:A.amber,
                              borderRadius:3, padding:'1px 4px', fontSize:7 }}>NOW</span>
                          )}
                        </td>
                        <td style={{ padding:'5px 7px', textAlign:'center' }}>
                          <span style={{ background:lv.col+'18', color:lv.col,
                            borderRadius:4, padding:'1px 6px', fontSize:7, fontWeight:700 }}>{lv.type}</span>
                        </td>
                        <td style={{ padding:'5px 7px', textAlign:'center',
                          color:parseFloat(dist)>=0?A.green:A.red,
                          fontWeight:700, fontFamily:'var(--font-mono)' }}>
                          {parseFloat(dist)>=0?'+':''}{dist}%
                        </td>
                        <td style={{ padding:'5px 7px', borderRadius:'0 5px 5px 0',
                          color:'var(--muted)', fontSize:8 }}>{lv.action}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ── Stress test 3 kịch bản xác suất ── */}
          <Card glow={A.purple}>
            <div style={{ fontSize:11, fontWeight:700, marginBottom:8 }}>
              ⚗️ STRESS-TEST · HỘI TỤ {sc.conv.prob}% | PHÂN KỲ {sc.div.prob}% | GÃY {sc.brk.prob}%
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(255px,1fr))', gap:8 }}>
              {[
                {ss:sc.conv, entry:`$${ez.z1.low}–$${ez.z1.high}`, mgmt:'50%→thêm 50% Vol xác nhận', tp1:`$${s.tp1||6.32}`, tp2:`$${sc.conv.tp}`},
                {ss:sc.div,  entry:'KHÔNG vào lệnh', mgmt:'Theo dõi Vol', tp1:'–', tp2:'–'},
                {ss:sc.brk,  entry:'THOÁT toàn bộ', mgmt:`H4 dưới $${ew.fib786?.toFixed(3)||'–'} → exit`, tp1:'–', tp2:`$${sc.brk.target}`},
              ].map(({ss,entry,mgmt,tp1,tp2},i) => (
                <div key={i} style={{ background:ss.col+'12', border:`1.5px solid ${ss.col}55`,
                  borderRadius:10, padding:'11px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                    <div style={{ fontSize:11, fontWeight:800, color:ss.col }}>{ss.label}</div>
                    <Chip label={`${ss.prob}%`} color={ss.col} size={10} />
                  </div>
                  <div style={{ fontSize:10, color:'var(--text)', marginBottom:6 }}>{ss.detail}</div>
                  <div style={{ background:ss.col+'08', borderRadius:7, padding:'7px 9px' }}>
                    {[{l:'Entry',v:entry},{l:'Quản lý',v:mgmt},{l:'TP1',v:tp1},{l:'TP2',v:tp2}].map((r,j) => (
                      <div key={j} style={{ fontSize:9, marginBottom:3 }}>
                        <span style={{ color:'var(--muted)' }}>{r.l}: </span>
                        <span style={{ color:'var(--text)' }}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop:5, fontSize:8, color:'var(--muted)' }}>
                    <b style={{ color:ss.col }}>Điều kiện:</b> {ss.cond}
                  </div>
                </div>
              ))}
            </div>
          </Card>

        </div>
      )}

    </Layout>
  );
}