// ─── Data flow: /api/fundamentals → 9 panel, 0 mock data ─────────────────────
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  ComposedChart, ReferenceLine, Cell,
} from 'recharts';

const C = {
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b',
  blue:'#3b82f6', teal:'#14b8a6', purple:'#8b5cf6',
  orange:'#f97316', cyan:'#06b6d4', muted:'#5a7090',
};

const scoreCol = s => s>=70?C.green:s>=50?C.amber:C.red;
const fmtK     = v => v>=1000?`${(v/1000).toFixed(0)}k`:`${v}`;
const fmtMT    = v => `${(v/1000).toFixed(0)}k MT`;
const fmtDate  = d => {
  if (!d) return '–';
  const dt = new Date(d);
  return `${dt.getDate()}/${dt.getMonth()+1}`;
};

// ─── Source badge ─────────────────────────────────────────────────────────────
function SrcBadge({ src }) {
  const m = {
    cftc:    { label:'✅ CFTC.gov',   col:C.green  },
    fred:    { label:'✅ FRED API',   col:C.green  },
    claude:  { label:'🤖 Claude AI', col:C.blue   },
    default: { label:'⚙️ Default',   col:C.muted  },
  }[src] || { label:`📡 ${src}`, col:C.muted };
  return (
    <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3, fontWeight:700,
      background:m.col+'22', color:m.col, border:`1px solid ${m.col}33` }}>
      {m.label}
    </span>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function TT({ active, payload, label }) {
  if (!active||!payload?.length) return null;
  return (
    <div style={{ background:'#0f1623', border:'1px solid #1a2a3a',
      borderRadius:8, padding:'8px 12px', fontSize:10 }}>
      <div style={{ color:C.muted, marginBottom:3 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ color:p.color||C.cyan }}>
          {p.name}: <b>{typeof p.value==='number'?p.value.toLocaleString():p.value}</b>
        </div>
      ))}
    </div>
  );
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────
function Panel({ title, glow, children, badge, badgeCol, src }) {
  return (
    <div style={{ background:'#0f1623', border:`1px solid ${glow||'#1a2a3a'}`,
      borderRadius:12, padding:'12px 14px',
      boxShadow:glow?`0 0 18px ${glow}18`:'none' }}>
      <div style={{ display:'flex', justifyContent:'space-between',
        alignItems:'center', marginBottom:10, flexWrap:'wrap', gap:4 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#e2e8f0' }}>{title}</div>
        <div style={{ display:'flex', gap:5, alignItems:'center' }}>
          {src && <SrcBadge src={src} />}
          {badge && (
            <span style={{ fontSize:9, padding:'2px 8px', borderRadius:5, fontWeight:700,
              background:(badgeCol||C.blue)+'22', color:badgeCol||C.blue,
              border:`1px solid ${badgeCol||C.blue}44` }}>{badge}</span>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── 1. Balance Gauge ─────────────────────────────────────────────────────────
function BalanceGauge({ totalInv, deficit, src }) {
  const BASE    = 500000;
  const pct     = Math.min(100,Math.round((totalInv/BASE)*100));
  const surplus = totalInv > BASE;
  const col     = surplus?C.red:totalInv>BASE*0.7?C.amber:C.green;
  const label   = surplus?'DƯ CUNG':totalInv>BASE*0.7?'TRUNG LẬP':'THIẾU CUNG';
  const cx=90, cy=75, R=58;
  const ang = -180+(pct/100)*180;
  const rad = (ang*Math.PI)/180;
  const nx=cx+R*Math.cos(rad), ny=cy+R*Math.sin(rad);

  return (
    <Panel title="⚖️ SUPPLY / DEMAND BALANCE" glow={col}
      badge={label} badgeCol={col} src={src}>
      <div style={{ display:'flex', justifyContent:'center' }}>
        <svg width="180" height="95" viewBox="0 0 180 95">
          {[{s:0,e:40,c:C.green},{s:40,e:65,c:C.amber},{s:65,e:100,c:C.red}].map(({s,e,c},i) => {
            const a1=(-180+(s/100)*180)*Math.PI/180;
            const a2=(-180+(e/100)*180)*Math.PI/180;
            const x1=cx+R*Math.cos(a1),y1=cy+R*Math.sin(a1);
            const x2=cx+R*Math.cos(a2),y2=cy+R*Math.sin(a2);
            return <path key={i}
              d={`M${cx} ${cy}L${x1} ${y1}A${R} ${R} 0 0 1 ${x2} ${y2}Z`}
              fill={c} opacity={0.5} />;
          })}
          <circle cx={cx} cy={cy} r={42} fill="#0f1623" />
          <line x1={cx} y1={cy} x2={nx.toFixed(1)} y2={ny.toFixed(1)}
            stroke={col} strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={5} fill={col} />
          <text x={cx} y={cy-14} textAnchor="middle" fill={col} fontSize={17} fontWeight={800}>
            {fmtMT(totalInv)}
          </text>
          <text x={cx} y={cy-1} textAnchor="middle" fill={C.muted} fontSize={8}>Tổng tồn kho</text>
          <text x={8}   y={88} fill={C.muted} fontSize={8}>Thiếu</text>
          <text x={140} y={88} fill={C.muted} fontSize={8}>Dư</text>
        </svg>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:5, marginTop:4 }}>
        {[
          {lbl:'Deficit', val:deficit<0?`${(deficit/1000).toFixed(0)}k MT`:'±0', col:C.green},
          {lbl:'vs Base', val:`${pct}%`, col},
          {lbl:'Signal',  val:label, col},
        ].map((m,i) => (
          <div key={i} style={{ background:'#162033', borderRadius:6,
            padding:'5px 7px', textAlign:'center' }}>
            <div style={{ fontSize:8, color:C.muted }}>{m.lbl}</div>
            <div style={{ fontSize:10, fontWeight:800, color:m.col }}>{m.val}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── 2. Forward Curve ─────────────────────────────────────────────────────────
function ForwardCurve({ curve, src }) {
  const data = [
    {m:'M1', price:curve.m1},{m:'M2',price:curve.m2},
    {m:'M3',price:curve.m3},{m:'M4',price:curve.m4},
    {m:'M6',price:curve.m6},{m:'M9',price:curve.m9},
    {m:'M12',price:curve.m12},
  ].filter(d=>d.price);
  const isBack = curve.structure==='backwardation';
  const col    = isBack?C.green:C.orange;
  const spread = curve.spread_m1_m3||0;

  return (
    <Panel title="📈 FORWARD CURVE · CME HG" glow={col}
      badge={isBack?'🟢 BACKWARDATION':'🟠 CONTANGO'} badgeCol={col} src={src}>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data}>
          <CartesianGrid stroke="#1a2a3a" strokeDasharray="3 3" />
          <XAxis dataKey="m" tick={{fill:C.muted,fontSize:8}} />
          <YAxis domain={['auto','auto']} tick={{fill:C.muted,fontSize:8}}
            tickFormatter={v=>`$${v.toFixed(2)}`} />
          <Tooltip content={<TT/>} />
          <Line type="monotone" dataKey="price" name="$/lb"
            stroke={col} strokeWidth={2.5} dot={{r:4,fill:col}} />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ display:'flex', gap:8, marginTop:6, flexWrap:'wrap' }}>
        {[
          {lbl:'Spread M1–M3',val:`${spread>0?'+':''}${(spread*100).toFixed(0)}¢/lb`,col},
          {lbl:'Structure',   val:curve.structure?.toUpperCase()||'–',col},
          {lbl:'M1 spot',     val:`$${curve.m1?.toFixed(3)||'–'}`,col:C.cyan},
        ].map((m,i) => (
          <div key={i} style={{ background:'#162033', borderRadius:6, padding:'4px 9px' }}>
            <div style={{ fontSize:8, color:C.muted }}>{m.lbl}</div>
            <div style={{ fontSize:10, fontWeight:800, color:m.col }}>{m.val}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── 3. Tightness Signal ──────────────────────────────────────────────────────
function TightnessSignal({ score, src }) {
  const col   = scoreCol(score);
  const label = score>=70?'🟢 THẮT CHẶT':score>=50?'🟡 TRUNG LẬP':'🔴 LỎNG LẺO';
  const lights = [
    {col:C.green,  active:score>=70,             label:'Thắt chặt'},
    {col:C.amber,  active:score>=40&&score<70,   label:'Trung lập'},
    {col:C.red,    active:score<40,              label:'Lỏng lẻo'},
  ];
  return (
    <Panel title="🚦 TIGHTNESS COMPOSITE" glow={col}
      badge={`${score}/100`} badgeCol={col} src={src}>
      <div style={{ display:'flex', justifyContent:'center', gap:16, margin:'6px 0 10px' }}>
        {lights.map((l,i) => (
          <div key={i} style={{ textAlign:'center' }}>
            <div style={{ width:32, height:32, borderRadius:'50%',
              background:l.active?l.col:l.col+'20',
              boxShadow:l.active?`0 0 16px ${l.col}`:'none',
              margin:'0 auto 4px', border:`2px solid ${l.col}44`,
              transition:'all 0.4s' }} />
            <div style={{ fontSize:8, color:l.active?l.col:C.muted }}>{l.label}</div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom:6 }}>
        <div style={{ display:'flex', justifyContent:'space-between',
          fontSize:9, color:C.muted, marginBottom:3 }}>
          <span>Tổng hợp</span>
          <span style={{ color:col, fontWeight:700 }}>{score}/100</span>
        </div>
        <div style={{ background:'#1a2a3a', borderRadius:5, height:10, overflow:'hidden' }}>
          <div style={{ width:`${score}%`, height:'100%',
            background:`linear-gradient(90deg,${col}88,${col})`,
            borderRadius:5, transition:'width 0.6s ease' }} />
        </div>
      </div>
      <div style={{ fontSize:9, textAlign:'center', fontWeight:700, color:col }}>{label}</div>
    </Panel>
  );
}

// ─── 4. COT Heatmap 52W (THẬT từ CFTC) ───────────────────────────────────────
function COTHeatmap({ cot, cotHistory, src }) {
  const net = cot.mm_net||0;
  const col = net>20000?C.green:net>0?C.teal:net>-20000?C.amber:C.red;

  // Dùng dữ liệu thật từ CFTC — không mock
  const chartData = cotHistory && cotHistory.length > 0
    ? cotHistory.slice(-20).map(r => ({
        w:   fmtDate(r.date),
        net: r.mm_net,
        mm_long:  r.mm_long,
        mm_short: r.mm_short,
      }))
    : [];

  return (
    <Panel title="🦈 COT SMART MONEY · 52W" glow={col}
      badge={`Net ${net>0?'+':''}${(net/1000).toFixed(1)}k`} badgeCol={col} src={src}>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={100}>
          <ComposedChart data={chartData}>
            <CartesianGrid stroke="#1a2a3a" strokeDasharray="3 3" />
            <XAxis dataKey="w" tick={{fill:C.muted,fontSize:7}} interval={3} />
            <YAxis tick={{fill:C.muted,fontSize:7}}
              tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<TT/>} />
            <ReferenceLine y={0} stroke={C.muted} strokeDasharray="4 4" />
            <Bar dataKey="net" name="MM Net" radius={[2,2,0,0]}>
              {chartData.map((d,i) => (
                <Cell key={i} fill={d.net>0?C.green:C.red} opacity={0.75} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ height:100, display:'flex', alignItems:'center',
          justifyContent:'center', color:C.muted, fontSize:9 }}>
          ⟳ Đang tải dữ liệu CFTC...
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:5, marginTop:6 }}>
        {[
          {lbl:'MM Long',  val:`+${fmtK(cot.mm_long||0)}`,  col:C.green},
          {lbl:'MM Short', val:`-${fmtK(cot.mm_short||0)}`, col:C.red},
          {lbl:'MM Net',   val:`${net>0?'+':''}${fmtK(Math.abs(net))}`, col},
        ].map((m,i) => (
          <div key={i} style={{ background:'#162033', borderRadius:6,
            padding:'5px 7px', textAlign:'center' }}>
            <div style={{ fontSize:8, color:C.muted }}>{m.lbl}</div>
            <div style={{ fontSize:11, fontWeight:800, color:m.col }}>{m.val}</div>
          </div>
        ))}
      </div>
      {cot.date && (
        <div style={{ fontSize:8, color:C.muted, marginTop:5, textAlign:'right' }}>
          Báo cáo: {cot.date} · {cotHistory?.length||0} tuần
        </div>
      )}
    </Panel>
  );
}

// ─── 5. Drain Velocity ────────────────────────────────────────────────────────
function DrainVelocity({ inv, src }) {
  const drains = [
    {exchange:'LME',   drain:inv.lme_drain_pct||0,   stocks:inv.lme||0,   col:C.blue  },
    {exchange:'SHFE',  drain:inv.shfe_drain_pct||0,  stocks:inv.shfe||0,  col:C.purple},
    {exchange:'COMEX', drain:inv.comex_drain_pct||0, stocks:inv.comex||0, col:C.cyan  },
  ];
  const avgDrain = drains.reduce((a,d)=>a+d.drain,0)/drains.length;
  const col      = avgDrain<-2?C.green:avgDrain<0?C.teal:C.red;

  return (
    <Panel title="🌪️ DRAIN VELOCITY · %/week" glow={col}
      badge={`Avg ${avgDrain.toFixed(1)}%/w`} badgeCol={col} src={src}>
      {drains.map((d,i) => (
        <div key={i} style={{ marginBottom:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between',
            fontSize:9, marginBottom:3 }}>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <span style={{ color:d.col, fontWeight:700 }}>{d.exchange}</span>
              <span style={{ color:C.muted }}>{fmtMT(d.stocks)}</span>
            </div>
            <span style={{ color:d.drain<0?C.green:C.red, fontWeight:700 }}>
              {d.drain>0?'+':''}{d.drain.toFixed(1)}%/w
            </span>
          </div>
          <div style={{ background:'#1a2a3a', borderRadius:4, height:8, overflow:'hidden' }}>
            <div style={{ width:`${Math.min(100,Math.abs(d.drain)*15)}%`,
              height:'100%', background:d.drain<0?C.green:C.red,
              borderRadius:4, transition:'width 0.5s ease' }} />
          </div>
        </div>
      ))}
      <div style={{ background:col+'12', border:`1px solid ${col}33`,
        borderRadius:7, padding:'6px 9px', marginTop:4, textAlign:'center' }}>
        <div style={{ fontSize:9, color:C.muted }}>Tốc độ rút kho tổng hợp</div>
        <div style={{ fontSize:16, fontWeight:800, color:col }}>
          {avgDrain.toFixed(2)}% / tuần
        </div>
      </div>
    </Panel>
  );
}

// ─── 6. Inventory 3 Sàn (history thật) ───────────────────────────────────────
function InventoryPanel({ inv, invHistory, src }) {
  const warrantPct = inv.lme?Math.round((inv.cancelled_warrants||0)/inv.lme*100):0;
  const wcol       = warrantPct>10?C.red:warrantPct>5?C.amber:C.teal;

  return (
    <Panel title="📦 INVENTORY 3 SÀN" glow={C.teal}
      badge={`Warrants ${warrantPct}%`} badgeCol={wcol} src={src}>
      {invHistory && invHistory.length > 0 ? (
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={invHistory}>
            <CartesianGrid stroke="#1a2a3a" strokeDasharray="3 3" />
            <XAxis dataKey="w" tick={{fill:C.muted,fontSize:8}} />
            <YAxis tick={{fill:C.muted,fontSize:8}}
              tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<TT/>} />
            <Bar dataKey="lme"   name="LME"   stackId="s" fill={C.blue}   opacity={0.75} />
            <Bar dataKey="shfe"  name="SHFE"  stackId="s" fill={C.purple} opacity={0.75} />
            <Bar dataKey="comex" name="COMEX" stackId="s" fill={C.cyan}   opacity={0.9}  />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ height:120, display:'flex', alignItems:'center',
          justifyContent:'center', color:C.muted, fontSize:9 }}>
          ⟳ Đang tải lịch sử tồn kho...
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4, marginTop:6 }}>
        {[
          {lbl:'LME',      val:fmtMT(inv.lme||0),   col:C.blue},
          {lbl:'SHFE',     val:fmtMT(inv.shfe||0),  col:C.purple},
          {lbl:'COMEX',    val:fmtMT(inv.comex||0), col:C.cyan},
          {lbl:'Warrants', val:`${fmtK(inv.cancelled_warrants||0)} MT`, col:wcol},
        ].map((m,i) => (
          <div key={i} style={{ background:'#162033', borderRadius:6,
            padding:'4px 6px', textAlign:'center' }}>
            <div style={{ fontSize:7, color:C.muted }}>{m.lbl}</div>
            <div style={{ fontSize:9, fontWeight:800, color:m.col }}>{m.val}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── 7. TC/RC Monitor (history thật từ Claude / extrapolated trend) ───────────
function TCRCMonitor({ tcrc, tcrcHistory, src }) {
  const WARN_LOW  = 5;
  const WARN_HIGH = 20;
  const col       = tcrc<WARN_LOW?C.red:tcrc<WARN_HIGH?C.amber:C.green;
  const label     = tcrc<WARN_LOW?'🔴 KHỦNG HOẢNG':tcrc<WARN_HIGH?'🟡 THẤP':'🟢 BÌNH THƯỜNG';

  return (
    <Panel title="🧪 TC/RC MONITOR · USD/MT" glow={col}
      badge={label} badgeCol={col} src={src}>
      {tcrcHistory && tcrcHistory.length > 0 ? (
        <ResponsiveContainer width="100%" height={100}>
          <AreaChart data={tcrcHistory}>
            <CartesianGrid stroke="#1a2a3a" strokeDasharray="3 3" />
            <XAxis dataKey="m" tick={{fill:C.muted,fontSize:7}} interval={2} />
            <YAxis tick={{fill:C.muted,fontSize:7}} />
            <Tooltip content={<TT/>} />
            <ReferenceLine y={WARN_LOW}  stroke={C.red}
              label={{value:'Crisis',fill:C.red,fontSize:7}} />
            <ReferenceLine y={WARN_HIGH} stroke={C.green}
              label={{value:'Normal',fill:C.green,fontSize:7}} />
            <Area type="monotone" dataKey="tc" name="TC/RC"
              stroke={col} fill={col} fillOpacity={0.15} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ height:100, display:'flex', alignItems:'center',
          justifyContent:'center', color:C.muted, fontSize:9 }}>
          ⟳ Đang tải lịch sử TC/RC...
        </div>
      )}
      <div style={{ display:'flex', gap:8, marginTop:6, flexWrap:'wrap' }}>
        {[
          {lbl:'TC/RC hiện tại',        val:`$${tcrc}/MT`,       col},
          {lbl:'Ngưỡng khủng hoảng',    val:`<$${WARN_LOW}/MT`,  col:C.red},
          {lbl:'Ngưỡng bình thường',    val:`>$${WARN_HIGH}/MT`, col:C.green},
        ].map((m,i) => (
          <div key={i} style={{ background:'#162033', borderRadius:6, padding:'4px 9px' }}>
            <div style={{ fontSize:8, color:C.muted }}>{m.lbl}</div>
            <div style={{ fontSize:10, fontWeight:800, color:m.col }}>{m.val}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── 8. AI Commentary ─────────────────────────────────────────────────────────
function AICommentary({ data }) {
  const [text, setText]       = useState('');
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/claude', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          model:'claude-sonnet-4-5', max_tokens:600,
          messages:[{ role:'user', content:
            `Bạn là chuyên gia phân tích thị trường đồng. Viết commentary tiếng Việt ~120 từ:
- Tồn kho: LME ${data.inv?.lme?.toLocaleString()||'–'} MT, SHFE ${data.inv?.shfe?.toLocaleString()||'–'} MT, COMEX ${data.inv?.comex?.toLocaleString()||'–'} MT
- COT Net: ${(data.cot?.mm_net||0)>0?'+':''}${(data.cot?.mm_net||0).toLocaleString()} hợp đồng (nguồn: ${data.data_sources?.cot||'–'})
- TC/RC: $${data.inv?.tc_rc||4}/MT
- Tightness: ${data.tightness||65}/100
- Forward curve: ${data.curve?.structure||'–'}
- DXY: ${data.macro?.dxy||'–'} | US10Y: ${data.macro?.us10y||'–'}%
Kết luận 1 câu hành động ngắn hạn.`
          }],
        }),
      });
      const d = await r.json();
      const t = (d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
      setText(t);
    } catch { setText('Không thể tạo commentary.'); }
    finally { setLoading(false); }
  }, [data]);

  return (
    <Panel title="🤖 AI COMMENTARY · Claude Sonnet" glow={C.purple} src="claude">
      {text ? (
        <div style={{ fontSize:10, color:'#e2e8f0', lineHeight:1.8,
          background:C.purple+'08', borderRadius:8, padding:'10px',
          whiteSpace:'pre-line', marginBottom:8 }}>{text}</div>
      ) : (
        <div style={{ fontSize:9, color:C.muted, marginBottom:8, lineHeight:1.6 }}>
          AI tổng hợp toàn bộ dữ liệu nền tảng (CFTC + FRED + Claude) và viết nhận định tiếng Việt.
        </div>
      )}
      <button onClick={generate} disabled={loading} style={{
        background:loading?'#162033':C.purple+'22',
        border:`1px solid ${loading?'#1a2a3a':C.purple}`,
        color:loading?C.muted:C.purple,
        borderRadius:7, padding:'6px 14px', fontSize:10, fontWeight:700,
        cursor:loading?'default':'pointer',
        display:'flex', alignItems:'center', gap:5,
      }}>
        <span style={{ animation:loading?'spin 1s linear infinite':'' }}>
          {loading?'⟳':'🤖'}
        </span>
        {loading?'Đang viết...':'Tạo AI Commentary'}
      </button>
    </Panel>
  );
}

// ─── 9. Key Triggers ──────────────────────────────────────────────────────────
function KeyTriggers({ data }) {
  const triggers = useMemo(() => {
    const t   = [];
    const inv = data.inv  || {};
    const cot = data.cot  || {};
    const inv3 = (inv.lme||0)+(inv.shfe||0)+(inv.comex||0);

    if (inv3>0 && inv3<330000)
      t.push({icon:'🔴',level:'HIGH',col:C.red,   msg:`Tổng kho ${fmtMT(inv3)} < 330k ngưỡng khủng hoảng`,action:'LONG NGAY'});
    if ((inv.cancelled_warrants||0)>5000)
      t.push({icon:'⚠️',level:'HIGH',col:C.red,   msg:`Cancelled warrants ${fmtK(inv.cancelled_warrants)} MT — rút hàng cấp tính`,action:'TĂNG VỊ THẾ'});
    if ((cot.mm_net||0)>40000)
      t.push({icon:'🟢',level:'MED', col:C.green, msg:`MM Net Long +${fmtK(cot.mm_net)} — speculator bullish mạnh`,action:'GIỮ LONG'});
    if ((inv.tc_rc||10)<5)
      t.push({icon:'🔴',level:'HIGH',col:C.red,   msg:`TC/RC $${inv.tc_rc}/MT — smelter siết, nguồn cung giảm`,action:'LONG TRUNG HẠN'});
    if (data.curve?.structure==='backwardation')
      t.push({icon:'🟢',level:'MED', col:C.green, msg:'Backwardation — cầu giao ngay vượt cung',action:'LONG SPOT'});
    if ((data.tightness||0)>=70)
      t.push({icon:'🟢',level:'HIGH',col:C.green, msg:`Tightness ${data.tightness}/100 — thị trường thắt chặt`,action:'MUA PULLBACK'});
    if ((data.macro?.dxy||100)<98)
      t.push({icon:'🟢',level:'MED', col:C.teal,  msg:`DXY ${data.macro?.dxy?.toFixed(1)} — USD yếu hỗ trợ giá đồng`,action:'LONG BIAS'});
    if (t.length===0)
      t.push({icon:'⚪',level:'LOW', col:C.muted, msg:'Chưa có trigger nổi bật — chờ tín hiệu xác nhận',action:'STANDBY'});
    return t;
  }, [data]);

  return (
    <Panel title="⚡ KEY TRIGGERS · Logic Engine" glow={C.amber} src="calc">
      {triggers.map((tr,i) => (
        <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start',
          background:tr.col+'0a', border:`1px solid ${tr.col}33`,
          borderRadius:8, padding:'7px 10px', marginBottom:5 }}>
          <span style={{ fontSize:14, flexShrink:0 }}>{tr.icon}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:9, color:'#e2e8f0', lineHeight:1.5 }}>{tr.msg}</div>
          </div>
          <span style={{ fontSize:8, padding:'2px 7px', borderRadius:4, fontWeight:800,
            background:tr.col+'22', color:tr.col, border:`1px solid ${tr.col}44`,
            flexShrink:0 }}>{tr.action}</span>
        </div>
      ))}
    </Panel>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function FundamentalsTab({ s, mh, pci }) {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  const loadData = useCallback(async (force=false) => {
    if (loading) return;
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/fundamentals${force?'?force=1':''}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setData(d);
      setLastFetch(Date.now());
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [loading]);

  useEffect(() => { loadData(); }, []);

  if (!data && loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      height:200, color:C.muted, fontSize:12 }}>
      ⟳ Đang tải CFTC + FRED + Claude...
    </div>
  );

  if (!data && error) return (
    <div style={{ background:C.red+'12', border:`1px solid ${C.red}44`,
      borderRadius:10, padding:'14px', textAlign:'center' }}>
      <div style={{ color:C.red, marginBottom:8 }}>❌ {error}</div>
      <button onClick={()=>loadData(true)} style={{
        background:C.red+'22', border:`1px solid ${C.red}`,
        color:C.red, borderRadius:7, padding:'6px 14px',
        fontSize:10, fontWeight:700, cursor:'pointer' }}>Thử lại</button>
    </div>
  );

  const src = data?.data_sources || {};

  return (
    <div style={{ display:'grid', gap:10 }}>

      {/* Header bar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
        background:'#0f1623', borderRadius:10, padding:'7px 12px',
        border:'1px solid #1a2a3a', flexWrap:'wrap', gap:8 }}>
        <div style={{ fontSize:10, fontWeight:700, color:'#e2e8f0' }}>
          📊 FUNDAMENTALS DASHBOARD
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {/* Source status badges */}
          {data && (
            <>
              <SrcBadge src={src.cot} />
              <SrcBadge src={src.dxy} />
              <SrcBadge src={src.inv} />
            </>
          )}
          {lastFetch && (
            <span style={{ fontSize:8, color:C.muted }}>
              {new Date(lastFetch).toLocaleTimeString('vi-VN')}
              {data?.cached?' (cache)':''}
            </span>
          )}
          <button onClick={()=>loadData(true)} disabled={loading} style={{
            background:loading?'#162033':C.blue+'22',
            border:`1px solid ${loading?'#1a2a3a':C.blue}`,
            color:loading?C.muted:C.blue,
            borderRadius:6, padding:'4px 10px', fontSize:9, fontWeight:700,
            cursor:loading?'default':'pointer',
            display:'flex', alignItems:'center', gap:4,
          }}>
            <span style={{ animation:loading?'spin 1s linear infinite':'' }}>
              {loading?'⟳':'🔄'}
            </span>
            {loading?'Đang tải...':'Làm mới'}
          </button>
        </div>
      </div>

      {data && (
        <>
          {/* Row 1 */}
          <div style={{ display:'grid',
            gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:10 }}>
            <BalanceGauge
              totalInv={data.total_inventory||0}
              deficit={data.balance_deficit||0}
              src={src.inv} />
            <ForwardCurve curve={data.curve||{}} src={src.curve||'claude'} />
            <TightnessSignal score={data.tightness||0} src="calc" />
          </div>

          {/* Row 2 */}
          <div style={{ display:'grid',
            gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:10 }}>
            <COTHeatmap
              cot={data.cot||{}}
              cotHistory={data.cot_history||[]}
              src={src.cot} />
            <DrainVelocity inv={data.inv||{}} src={src.inv} />
            <InventoryPanel
              inv={data.inv||{}}
              invHistory={data.inv_history||[]}
              src={src.inv} />
          </div>

          {/* Row 3 */}
          <div style={{ display:'grid',
            gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:10 }}>
            <TCRCMonitor
              tcrc={data.inv?.tc_rc||4}
              tcrcHistory={data.tcrc_history||[]}
              src={src.inv} />
            <AICommentary data={data} />
            <KeyTriggers data={data} />
          </div>
        </>
      )}
    </div>
  );
}