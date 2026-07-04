// ─── Data flow: calculations + Claude AI → 6 engine panels ───────────────────
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
  ComposedChart, Bar, Line, ReferenceLine, Area, AreaChart,
} from 'recharts';

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b',
  blue:'#3b82f6', teal:'#14b8a6', purple:'#8b5cf6',
  orange:'#f97316', cyan:'#06b6d4', muted:'#5a7090',
  pink:'#ec4899', lime:'#84cc16',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sc = s => s>=70?C.green:s>=50?C.amber:C.red;
const mono = { fontFamily:'monospace' };

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function TT({ active, payload, label }) {
  if (!active||!payload?.length) return null;
  return (
    <div style={{ background:'#060d18', border:'1px solid #1e3050',
      borderRadius:8, padding:'7px 11px', fontSize:10 }}>
      <div style={{ color:C.muted, marginBottom:3 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ color:p.color||C.cyan }}>
          {p.name}: <b>{typeof p.value==='number'?p.value.toLocaleString():p.value}</b>
        </div>
      ))}
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────
function Panel({ title, icon, glow, children, badge, badgeCol, right }) {
  return (
    <div style={{ background:'#060d18', border:`1px solid ${glow||'#1e3050'}`,
      borderRadius:11, padding:'11px 13px',
      boxShadow:glow?`0 0 14px ${glow}14`:'none' }}>
      <div style={{ display:'flex', justifyContent:'space-between',
        alignItems:'center', marginBottom:9, flexWrap:'wrap', gap:5 }}>
        <div style={{ fontSize:10, fontWeight:600, color:'#e2e8f0',
          display:'flex', alignItems:'center', gap:5 }}>
          {icon && <span style={{ fontSize:13 }}>{icon}</span>}
          {title}
        </div>
        <div style={{ display:'flex', gap:5, alignItems:'center' }}>
          {badge && (
            <span style={{ fontSize:8, padding:'2px 7px', borderRadius:4,
              fontWeight:700, background:(badgeCol||C.blue)+'22',
              color:badgeCol||C.blue,
              border:`0.5px solid ${badgeCol||C.blue}44` }}>{badge}</span>
          )}
          {right}
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Bdg({ label, col, size=8 }) {
  return (
    <span style={{ fontSize:size, padding:'2px 7px', borderRadius:4, fontWeight:700,
      background:col+'22', color:col, border:`0.5px solid ${col}44`,
      whiteSpace:'nowrap' }}>{label}</span>
  );
}

// ─── ScoreBar ─────────────────────────────────────────────────────────────────
function SBar({ label, score, col, showNum=true }) {
  const c = col||sc(score);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
      <span style={{ fontSize:9, color:C.muted, width:80, flexShrink:0 }}>{label}</span>
      <div style={{ flex:1, background:'#0f1e30', borderRadius:2, height:5, overflow:'hidden' }}>
        <div style={{ width:`${score}%`, height:'100%', background:c,
          borderRadius:2, transition:'width .5s' }} />
      </div>
      {showNum && <span style={{ fontSize:9, fontWeight:700, color:c, width:22,
        textAlign:'right' }}>{score}</span>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 1. FIBONACCI + KEY LEVELS (left sidebar)
// ═══════════════════════════════════════════════════════════
function FibPanel({ s, ew }) {
  const levels = [
    { lbl:'Fib 1.618 — TP3', price:6.890, type:'TP3',  col:C.cyan,   tag:'TP3'  },
    { lbl:'Fib 1.272 — TP2', price:6.620, type:'TP2',  col:C.teal,   tag:'TP2'  },
    { lbl:'Fib 1.000 — TP1', price:6.380, type:'TP1',  col:C.green,  tag:'TP1'  },
    { lbl:'Giá Hiện Tại',    price:s.comex||6.256, type:'NOW', col:C.blue, tag:'NOW' },
    { lbl:'Fib 0.500 — Entry',price:6.100, type:'ENTRY',col:C.green, tag:'Entry'},
    { lbl:'Fib 0.618 — SL mềm',price:5.940,type:'SL1', col:C.amber,  tag:'SL-'  },
    { lbl:'Fib 0.786 — SL cứng',price:5.765,type:'SL2',col:C.red,   tag:'SL+'  },
  ];

  const tagColors = {
    TP3:'#06b6d4', TP2:'#14b8a6', TP1:'#22c55e',
    NOW:'#3b82f6', Entry:'#22c55e', 'SL-':'#f59e0b', 'SL+':'#ef4444',
  };

  return (
    <Panel title="FIBONACCI — KEY LEVELS" icon="📐" glow={C.amber}>
      {levels.map((lv,i) => {
        const isNow = lv.type==='NOW';
        const tc    = tagColors[lv.tag]||C.muted;
        return (
          <div key={i} style={{
            display:'flex', alignItems:'center', gap:6,
            padding:'5px 7px', borderRadius:6, marginBottom:3,
            background: isNow?`${C.blue}18`:'#060d18',
            border:`0.5px solid ${isNow?C.blue:'#1e3050'}`,
          }}>
            <div style={{ fontSize:9, color:C.muted, flex:1 }}>{lv.lbl}</div>
            <div style={{ ...mono, fontSize:12, fontWeight:700, color:lv.col }}>
              ${lv.price.toFixed(3)}
            </div>
            <span style={{ fontSize:8, padding:'1px 6px', borderRadius:3,
              fontWeight:700, background:tc+'22', color:tc,
              border:`0.5px solid ${tc}44`, minWidth:34, textAlign:'center' }}>
              {lv.tag}
            </span>
          </div>
        );
      })}
    </Panel>
  );
}

// ═══════════════════════════════════════════════════════════
// 2. MULTI-METHOD SCORE (left sidebar)
// ═══════════════════════════════════════════════════════════
function MultiMethodPanel({ scores, verdict, bias }) {
  const total   = scores.reduce((a,s)=>a+s.score,0);
  const avg     = Math.round(total/scores.length);
  const col     = sc(avg);
  const vLabel  = avg>=70?'MUA':avg>=50?'TÍCH LŨY':'BÁN';

  return (
    <Panel title="HỘI TỤ ĐA PHƯƠNG PHÁP" icon="⚡" glow={col}
      badge={`${scores.filter(s=>s.score>=65).length}/${scores.length} đồng thuận`}
      badgeCol={col}>

      {/* Score circle */}
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:10 }}>
        <div style={{ width:56, height:56, borderRadius:'50%',
          background:`conic-gradient(${col} ${avg}%, #0f1e30 0)`,
          display:'flex', alignItems:'center', justifyContent:'center',
          flexShrink:0, position:'relative' }}>
          <div style={{ width:42, height:42, borderRadius:'50%',
            background:'#060d18', display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center' }}>
            <div style={{ ...mono, fontSize:16, fontWeight:700, color:col, lineHeight:1 }}>
              {avg}
            </div>
            <div style={{ fontSize:7, color:col, fontWeight:600 }}>{vLabel}</div>
          </div>
        </div>

        {/* Mini radar pentagon SVG */}
        <svg width="54" height="54" viewBox="0 0 54 54">
          {(() => {
            const cx=27, cy=27, R=22, n=scores.length;
            const pts = scores.map((sc2,i) => {
              const a = (i/n)*Math.PI*2-Math.PI/2;
              const f = sc2.score/100;
              return `${(cx+R*f*Math.cos(a)).toFixed(1)},${(cy+R*f*Math.sin(a)).toFixed(1)}`;
            }).join(' ');
            const grid = [0.33,0.66,1].map(f =>
              scores.map((_,i) => {
                const a=(i/n)*Math.PI*2-Math.PI/2;
                return `${(cx+R*f*Math.cos(a)).toFixed(1)},${(cy+R*f*Math.sin(a)).toFixed(1)}`;
              }).join(' ')
            );
            return (
              <>
                {grid.map((g,i) => (
                  <polygon key={i} points={g} fill="none"
                    stroke="#1e3050" strokeWidth={i===2?0.8:0.4} />
                ))}
                {scores.map((_,i) => {
                  const a=(i/n)*Math.PI*2-Math.PI/2;
                  return <line key={i} x1={cx} y1={cy}
                    x2={(cx+R*Math.cos(a)).toFixed(1)}
                    y2={(cy+R*Math.sin(a)).toFixed(1)}
                    stroke="#1e3050" strokeWidth={0.4} />;
                })}
                <polygon points={pts} fill={`${col}28`}
                  stroke={col} strokeWidth={1.5} strokeLinejoin="round" />
              </>
            );
          })()}
        </svg>
      </div>

      {/* Score bars */}
      {scores.map((sc2,i) => (
        <SBar key={i} label={sc2.label} score={sc2.score} col={sc(sc2.score)} />
      ))}

      {/* Verdict box */}
      <div style={{ marginTop:8, background:col+'12',
        border:`1px solid ${col}44`, borderRadius:8,
        padding:'7px 10px', textAlign:'center' }}>
        <div style={{ fontSize:10, fontWeight:700, color:col }}>
          VERDICT: {vLabel} — {avg>=70?'MUA':avg>=50?'TÍCH LŨY':'BÁN'}
        </div>
        <div style={{ fontSize:8, color:C.muted, marginTop:2 }}>
          {scores.filter(s=>s.score>=65).length}/6 phương pháp đồng thuận TĂNG
        </div>
      </div>
    </Panel>
  );
}

// ═══════════════════════════════════════════════════════════
// 3. PRICE CHART với Volume (center)
// ═══════════════════════════════════════════════════════════
function PriceChart({ s, priceChart, timeframe }) {
  const comexUp = (s.comex_chg_pct||0) >= 0;
  const data    = priceChart.map((d,i) => ({
    ...d,
    vol: d.vol||Math.round(80000+Math.random()*60000),
  }));

  return (
    <div style={{ background:'#060d18', border:'1px solid #1e3050',
      borderRadius:11, padding:'11px 13px' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between',
        alignItems:'center', marginBottom:8, flexWrap:'wrap', gap:6 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:11, fontWeight:600, color:'#e2e8f0' }}>
            ⚡ ĐỒNG COMEX — {timeframe}
          </span>
          <Bdg label={`Sóng ${s.wave||'3'}`} col={C.green} />
          <Bdg label={`PRZ $${(s.tp1||6.100).toFixed(3)}`} col={C.amber} />
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ ...mono, fontSize:13, fontWeight:700,
            color:comexUp?C.green:C.red }}>
            ${(s.comex||6.256).toFixed(3)}
          </span>
          <span style={{ fontSize:9, color:comexUp?C.green:C.red }}>
            {comexUp?'▲':'▼'}{Math.abs(s.comex_chg_pct||2.61).toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Main chart */}
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data} margin={{top:4,right:4,left:0,bottom:0}}>
          <defs>
            <linearGradient id="pgrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={comexUp?C.green:C.red} stopOpacity={0.18}/>
              <stop offset="95%" stopColor={comexUp?C.green:C.red} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#0f1e30" strokeDasharray="3 3" />
          <XAxis dataKey="d" tick={{fill:C.muted,fontSize:8}} />
          <YAxis yAxisId="p" domain={['auto','auto']}
            tick={{fill:C.muted,fontSize:8}} tickFormatter={v=>`$${v.toFixed(2)}`} />
          <YAxis yAxisId="v" orientation="right"
            tick={{fill:C.muted,fontSize:7}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
          <Tooltip content={<TT/>} />

          {/* TP/SL reference lines */}
          <ReferenceLine yAxisId="p" y={s.tp1||6.380}
            stroke={C.green} strokeDasharray="4 3" strokeOpacity={0.6}
            label={{value:'TP1',fill:C.green,fontSize:7,position:'right'}}/>
          <ReferenceLine yAxisId="p" y={s.prev_low||5.940}
            stroke={C.red} strokeDasharray="4 3" strokeOpacity={0.6}
            label={{value:'SL',fill:C.red,fontSize:7,position:'right'}}/>

          <Bar yAxisId="v" dataKey="vol" name="Vol"
            fill={C.blue} opacity={0.18} radius={[1,1,0,0]}/>
          <Area yAxisId="p" type="monotone" dataKey="comex" name="COMEX"
            stroke={comexUp?C.green:C.red} strokeWidth={1.8}
            fill="url(#pgrad)" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Volume label */}
      <div style={{ textAlign:'center', fontSize:8, color:C.muted, marginTop:3 }}>
        Khối Lượng Giao Dịch — Volume Spread Analysis
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 4. ELLIOTT WAVE TABS ENGINE
// ═══════════════════════════════════════════════════════════
const EW_TABS = ['Elliott Wave','VSA Engine','Wyckoff Cycle','SMC','Harmonic','Liên Thị Trường'];

function ElliottTabsEngine({ s, ew, vsa }) {
  const [activeTab, setActiveTab] = useState(0);

  // Wave phases
  const phases = [
    { label:'Đây Sóng 1', val:'Hoàn tất', active:false },
    { label:'Đây Sóng 2', val:'Hoàn tất', active:false },
    { label:`WО — Active`, val:'Active ⚡', active:true  },
    { label:'WО',          val:'Chờ',       active:false },
    { label:'WО',          val:'Chờ',       active:false },
  ];

  return (
    <div style={{ background:'#060d18', border:'1px solid #1e3050',
      borderRadius:11, padding:'11px 13px' }}>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:10, flexWrap:'wrap' }}>
        {EW_TABS.map((t,i) => (
          <button key={i} onClick={()=>setActiveTab(i)} style={{
            fontSize:9, padding:'4px 10px', borderRadius:6,
            border:`0.5px solid ${activeTab===i?C.green:'#1e3050'}`,
            background:activeTab===i?`${C.green}18`:'transparent',
            color:activeTab===i?C.green:C.muted,
            cursor:'pointer', fontWeight:activeTab===i?600:400,
            display:'flex', alignItems:'center', gap:4,
          }}>
            <span style={{ width:5, height:5, borderRadius:'50%', flexShrink:0,
              background:activeTab===i?C.green:'#1e3050', display:'inline-block' }}/>
            {t}
          </button>
        ))}
      </div>

      {/* Tab 0: Elliott Wave */}
      {activeTab===0 && (
        <div>
          {/* Phase cards */}
          <div style={{ display:'grid',
            gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',
            gap:6, marginBottom:10 }}>
            {phases.map((ph,i) => (
              <div key={i} style={{
                background:ph.active?`${C.green}14`:'#0a1520',
                border:`0.5px solid ${ph.active?C.green:'#1e3050'}`,
                borderRadius:8, padding:'8px 10px', textAlign:'center',
              }}>
                <div style={{ fontSize:8, color:C.muted, marginBottom:3 }}>
                  {ph.label}
                </div>
                <div style={{ ...mono, fontSize:13, fontWeight:700,
                  color:ph.active?C.green:C.muted }}>
                  WО
                </div>
                <div style={{ fontSize:8,
                  color:ph.active?C.green:C.muted, marginTop:2 }}>
                  {ph.val}
                </div>
              </div>
            ))}
          </div>

          {/* Wave details grid */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr',
            gap:6, marginBottom:6 }}>
            {[
              {lbl:'Đây Sóng 1', val:'$5.200', col:C.cyan},
              {lbl:'Mục Tiêu Sóng 3', val:'$6.620', col:C.green},
              {lbl:'Sóng 2 Retrace', val:'61.8%', col:C.amber},
              {lbl:'Kết Thúc Sóng 5', val:'$7.200', col:C.teal},
              {lbl:'Rổi Phân Kỳ', val:'Chưa có', col:C.muted},
              {lbl:'Khung Thời Gian', val:'MN', col:C.purple},
            ].map((m,i) => (
              <div key={i} style={{ background:'#0a1520', borderRadius:6,
                padding:'6px 8px', border:'0.5px solid #1e3050' }}>
                <div style={{ fontSize:8, color:C.muted, marginBottom:2 }}>{m.lbl}</div>
                <div style={{ ...mono, fontSize:11, fontWeight:700, color:m.col }}>
                  {m.val}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 1: VSA Engine */}
      {activeTab===1 && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
            {[
              {lbl:'Signal hiện tại', val:vsa?.meta?.label||'Neutral', col:C.amber},
              {lbl:'Volume Ratio',    val:`${vsa?.latestBar?.volRatio||1.0}×`, col:C.blue},
              {lbl:'Spread',         val:`${vsa?.latestBar?.spread||0.04}`, col:C.teal},
              {lbl:'VSA Score',      val:`${vsa?.score||50}/100`, col:sc(vsa?.score||50)},
            ].map((m,i) => (
              <div key={i} style={{ background:'#0a1520', borderRadius:6,
                padding:'6px 8px', border:'0.5px solid #1e3050' }}>
                <div style={{ fontSize:8, color:C.muted }}>{m.lbl}</div>
                <div style={{ ...mono, fontSize:11, fontWeight:700, color:m.col }}>
                  {m.val}
                </div>
              </div>
            ))}
          </div>
          {(vsa?.bars||[]).slice(-5).reverse().map((b,i) => {
            const VC = {
              ABSORPTION_BULL:C.green, ABSORPTION_BEAR:C.red,
              STOPPING_VOLUME:C.amber, UPTHRUST:C.red, SPRING:C.green,
              NO_DEMAND:C.orange, NO_SUPPLY:C.teal, NEUTRAL:C.muted,
            };
            const col = VC[b.vsa]||C.muted;
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:6,
                padding:'4px 7px', borderRadius:5, marginBottom:3,
                background:i===0?`${col}10`:'#0a1520',
                border:`0.5px solid ${i===0?col:'#1e3050'}` }}>
                <span style={{ fontSize:8, color:C.muted, width:32 }}>{b.d}</span>
                <span style={{ ...mono, fontSize:10, fontWeight:600,
                  color:b.up?C.green:C.red }}>${b.comex?.toFixed(3)}</span>
                <span style={{ fontSize:8, color:C.muted, flex:1 }}>{b.volRatio}×</span>
                <Bdg label={b.vsa||'NEUTRAL'} col={col} />
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Wyckoff Cycle */}
      {activeTab===2 && (
        <div>
          {[
            {phase:'Phase A', sub:'SC → AR → ST', done:true,   col:C.green},
            {phase:'Phase B', sub:'QT → Secondary Tests', done:true,  col:C.green},
            {phase:'Phase C', sub:'Spring/Test — LPS = SOS Markup', done:false, active:true, col:C.amber},
            {phase:'Phase D', sub:'LPS → SOS Markup', done:false, col:C.muted},
            {phase:'Phase E', sub:'Markup/Markdown', done:false, col:C.muted},
          ].map((ph,i) => (
            <div key={i} style={{ display:'flex', gap:10, alignItems:'center',
              padding:'7px 10px', borderRadius:7, marginBottom:4,
              background:ph.active?`${C.amber}10`:ph.done?`${C.green}08`:'#0a1520',
              border:`0.5px solid ${ph.active?C.amber:ph.done?C.green:'#1e3050'}` }}>
              <div style={{ width:18, height:18, borderRadius:'50%', flexShrink:0,
                background:ph.done?C.green:ph.active?C.amber:'#1e3050',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:9, color:'#060d18', fontWeight:700 }}>
                  {ph.done?'✓':ph.active?'⚡':'○'}
                </span>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, fontWeight:600,
                  color:ph.active?C.amber:ph.done?C.green:C.muted }}>{ph.phase}</div>
                <div style={{ fontSize:8, color:C.muted, marginTop:1 }}>{ph.sub}</div>
              </div>
              {ph.active && <Bdg label="Active" col={C.amber} />}
              {ph.done && <Bdg label="Done" col={C.green} />}
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: SMC */}
      {activeTab===3 && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            {[
              {lbl:'Order Block Giảm', range:'$6.500–$6.620', sig:'BÁN',   col:C.red,   desc:'Vùng Cung'},
              {lbl:'Fair Value Gap',   range:'$6.280–$6.330', sig:'FVG',   col:C.purple,desc:'Imbalance'},
              {lbl:'BOS Breakout',     range:'$6.140 xác nhận',sig:'BOS',  col:C.green, desc:'Structure Break'},
              {lbl:'Order Block Tăng', range:'$5.980–$6.120', sig:'MUA',   col:C.green, desc:'Vùng Cầu'},
              {lbl:'Liquidity Pool',   range:'$5.940',         sig:'THANH KHOẢN',col:C.amber,desc:'Stop Hunt'},
              {lbl:'MSS / CHoCH',      range:'$6.256 hiện tại',sig:'TÍCH LŨY',col:C.cyan,desc:'Market Shift'},
            ].map((m,i) => (
              <div key={i} style={{ background:'#0a1520', borderRadius:7,
                padding:'7px 9px', border:`0.5px solid ${m.col}33` }}>
                <div style={{ display:'flex', justifyContent:'space-between',
                  marginBottom:4 }}>
                  <span style={{ fontSize:9, fontWeight:600, color:m.col }}>{m.lbl}</span>
                  <Bdg label={m.sig} col={m.col} />
                </div>
                <div style={{ ...mono, fontSize:9, color:'#e2e8f0',
                  marginBottom:2 }}>{m.range}</div>
                <div style={{ fontSize:8, color:C.muted }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Harmonic */}
      {activeTab===4 && (
        <div>
          {[
            {name:'Bullish Gartley', sig:'MUA', rel:94, col:C.green,
              range:'$5.100–$5.800', desc:'D tại 0.786 XA — entry $6.10'},
            {name:'Deep Crab (theo dõi)', sig:'THEO DÕI', rel:78, col:C.amber,
              range:'$6.580–$6.750', desc:'Tiếp tục theo dõi hoàn thành'},
            {name:'Bearish Butterfly', sig:'BÁN (tiềm năng)', rel:65, col:C.red,
              range:'W: $6.750',     desc:'Tiềm năng đảo chiều giảm'},
          ].map((p,i) => (
            <div key={i} style={{ background:'#0a1520', borderRadius:8,
              padding:'9px 11px', marginBottom:6,
              border:`0.5px solid ${p.col}44` }}>
              <div style={{ display:'flex', justifyContent:'space-between',
                alignItems:'center', marginBottom:5 }}>
                <div style={{ fontSize:10, fontWeight:600, color:p.col }}>{p.name}</div>
                <Bdg label={p.sig} col={p.col} />
              </div>
              <div style={{ fontSize:9, color:C.muted, marginBottom:5 }}>
                {p.desc}
              </div>
              <div style={{ background:'#060d18', borderRadius:3,
                height:6, overflow:'hidden' }}>
                <div style={{ width:`${p.rel}%`, height:'100%',
                  background:p.col, borderRadius:3 }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between',
                marginTop:3, fontSize:8, color:C.muted }}>
                <span>{p.range}</span>
                <span style={{ color:p.col }}>{p.rel}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 5: Inter-market */}
      {activeTab===5 && (
        <div>
          <div style={{ marginBottom:6, fontSize:9, color:C.muted }}>
            TƯƠNG QUAN LIÊN THỊ TRƯỜNG — ĐỘ CHÍNH XÁC XÁC SUẤT
          </div>
          <div style={{ display:'grid',
            gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:5 }}>
            {[
              {name:'DXY (Chỉ Số USD)', val:'99.8',  chg:'-0.40%', corr:'-0.75',
               sig:'HỖ TRỢ TĂNG', col:C.green,  desc:'DXY yếu → đồng tăng'},
              {name:'S&P 500 (SPX)',    val:'5,200', chg:'+0.62',  corr:'+0.62',
               sig:'HỖ TRỢ TĂNG', col:C.green,  desc:'Risk-on hỗ trợ'},
              {name:'Shanghai (CN50)',  val:'3,250', chg:'+1.10%', corr:'+0.71',
               sig:'HỖ TRỢ MẠNH', col:C.green,  desc:'TQ phục hồi → cầu tăng'},
              {name:'SHFE Copper TQ',  val:'¥78,450',chg:'+0.95',corr:'+0.95',
               sig:'ĐỒNG THUẬN',   col:C.teal,  desc:'Giá đồng TQ đồng thuận'},
              {name:'Vàng XAU',        val:'$2,350', chg:'+0.45', corr:'+0.45',
               sig:'TRUNG TÍNH',  col:C.amber,  desc:'Cùng chiều vừa phải'},
              {name:'Bạc XAG',         val:'$28.4',  chg:'+0.78', corr:'+0.78',
               sig:'HỖ TRỢ TĂNG', col:C.green,  desc:'Bạc tăng → kim loại công nghiệp'},
              {name:'Bạch Kim PLAT',   val:'$980',   chg:'+0.55', corr:'+0.55',
               sig:'PHÂN KỲ NHẸ', col:C.amber,  desc:'Bạch kim chiều cần thêm dữ liệu'},
            ].map((m,i) => (
              <div key={i} style={{ background:'#0a1520', borderRadius:7,
                padding:'7px 9px', border:`0.5px solid ${m.col}33` }}>
                <div style={{ display:'flex', justifyContent:'space-between',
                  marginBottom:4 }}>
                  <span style={{ fontSize:8, fontWeight:600, color:'#e2e8f0' }}>
                    {m.name}
                  </span>
                </div>
                <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:3 }}>
                  <span style={{ ...mono, fontSize:11, fontWeight:700, color:m.col }}>
                    {m.val}
                  </span>
                  <span style={{ fontSize:8,
                    color:m.chg.startsWith('+')?C.green:C.red }}>{m.chg}</span>
                </div>
                <div style={{ fontSize:7, color:C.muted, marginBottom:4 }}>
                  Tương quan: <span style={{ color:m.col }}>{m.corr}</span>
                </div>
                <div style={{ background:'#060d18', borderRadius:2,
                  height:3, overflow:'hidden', marginBottom:4 }}>
                  <div style={{ width:`${Math.abs(parseFloat(m.corr))*100}%`,
                    height:'100%', background:m.col, borderRadius:2 }} />
                </div>
                <Bdg label={m.sig} col={m.col} size={7} />
                <div style={{ fontSize:7, color:C.muted, marginTop:3 }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 5. WYCKOFF CYCLE (right sidebar)
// ═══════════════════════════════════════════════════════════
function WyckoffPanel() {
  return (
    <Panel title="WYCKOFF CYCLE" icon="🔄" glow={C.amber}>
      {[
        {phase:'Phase A', sub:'SC → AR → ST',          done:true,   col:C.green},
        {phase:'Phase B', sub:'QT → Secondary Tests',  done:true,   col:C.green},
        {phase:'Phase C', sub:'Spring/Test — LPS = SOS',done:false,active:true,col:C.amber},
        {phase:'Phase D', sub:'LPS → SOS Markup',      done:false,  col:C.muted},
        {phase:'Phase E', sub:'Markup / CND',           done:false,  col:C.muted},
      ].map((ph,i) => (
        <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start',
          padding:'6px 8px', borderRadius:7, marginBottom:3,
          background:ph.active?`${C.amber}10`:ph.done?`${C.green}08`:'transparent',
          border:`0.5px solid ${ph.active?C.amber:ph.done?C.green:'#1e3050'}` }}>
          <div style={{ width:16, height:16, borderRadius:'50%', flexShrink:0,
            marginTop:1,
            background:ph.done?C.green:ph.active?C.amber:'#1e3050',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:9, color:'#060d18', fontWeight:700 }}>
            {ph.done?'✓':ph.active?'⚡':'○'}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:9, fontWeight:600,
              color:ph.active?C.amber:ph.done?C.green:C.muted }}>
              {ph.phase}
            </div>
            <div style={{ fontSize:7, color:C.muted, marginTop:1 }}>{ph.sub}</div>
          </div>
        </div>
      ))}
    </Panel>
  );
}

// ═══════════════════════════════════════════════════════════
// 6. SMC ORDER BLOCKS (right sidebar)
// ═══════════════════════════════════════════════════════════
function SMCPanel() {
  const blocks = [
    {lbl:'Vùng Cung (OB Giảm)', range:'$6.500–$6.620', sig:'BÁN',           col:C.red   },
    {lbl:'Fair Value Gap (FVG)', range:'$6.280–$6.330', sig:'FVG',           col:C.purple},
    {lbl:'BOS Breakout ✓',      range:'$6.140 confirmed',sig:'BOS',          col:C.green },
    {lbl:'Vùng Cầu (OB Tăng)',  range:'$5.980–$6.120', sig:'MUA',           col:C.green },
    {lbl:'Liquidity Pool',      range:'$5.940',         sig:'THANH KHOẢN',   col:C.amber },
  ];
  return (
    <Panel title="SMC ORDER BLOCKS" icon="🔷" glow={C.blue}>
      {blocks.map((b,i) => (
        <div key={i} style={{ padding:'6px 8px', borderRadius:7, marginBottom:4,
          background:'#0a1520', border:`0.5px solid ${b.col}33` }}>
          <div style={{ display:'flex', justifyContent:'space-between',
            alignItems:'center', marginBottom:3 }}>
            <span style={{ fontSize:9, color:'#e2e8f0', fontWeight:500 }}>{b.lbl}</span>
            <Bdg label={b.sig} col={b.col} />
          </div>
          <div style={{ ...mono, fontSize:9, color:b.col }}>{b.range}</div>
        </div>
      ))}
    </Panel>
  );
}

// ═══════════════════════════════════════════════════════════
// 7. HARMONIC PATTERNS (right sidebar)
// ═══════════════════════════════════════════════════════════
function HarmonicPanel() {
  const patterns = [
    {name:'Bullish Gartley',      sig:'MUA',            rel:94, col:C.green,
     range:'$5.100–$5.800'},
    {name:'Deep Crab (theo dõi)', sig:'THEO DÕI',       rel:78, col:C.amber,
     range:'$6.580–$6.750'},
    {name:'Bearish Butterfly',    sig:'BÁN (tiềm năng)',rel:65, col:C.red,
     range:'W: $6.750'},
  ];
  return (
    <Panel title="HARMONIC PATTERNS" icon="🎯" glow={C.purple}>
      {patterns.map((p,i) => (
        <div key={i} style={{ background:'#0a1520', borderRadius:8,
          padding:'8px 10px', marginBottom:5,
          border:`0.5px solid ${p.col}44` }}>
          <div style={{ display:'flex', justifyContent:'space-between',
            alignItems:'center', marginBottom:4 }}>
            <span style={{ fontSize:9, fontWeight:600, color:p.col }}>{p.name}</span>
            <Bdg label={p.sig} col={p.col} />
          </div>
          <div style={{ background:'#060d18', borderRadius:3,
            height:5, overflow:'hidden' }}>
            <div style={{ width:`${p.rel}%`, height:'100%',
              background:p.col, borderRadius:3 }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between',
            marginTop:3, fontSize:8 }}>
            <span style={{ color:C.muted }}>{p.range}</span>
            <span style={{ color:p.col, fontWeight:600 }}>{p.rel}%</span>
          </div>
        </div>
      ))}
    </Panel>
  );
}

// ═══════════════════════════════════════════════════════════
// 8. AI TỔNG HỢP (bottom)
// ═══════════════════════════════════════════════════════════
function AITongHop({ s, scores, loading, onGenerate, text }) {
  const avg = scores.length
    ? Math.round(scores.reduce((a,sc2)=>a+sc2.score,0)/scores.length)
    : 82;
  const col = sc(avg);

  return (
    <div style={{ background:'#060d18', border:`1px solid ${col}44`,
      borderRadius:11, padding:'11px 14px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10,
        flexWrap:'wrap', marginBottom:8 }}>

        {/* Score circle */}
        <div style={{ width:44, height:44, borderRadius:'50%', flexShrink:0,
          background:`conic-gradient(${col} ${avg}%, #0f1e30 0)`,
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ width:33, height:33, borderRadius:'50%', background:'#060d18',
            display:'flex', flexDirection:'column', alignItems:'center',
            justifyContent:'center' }}>
            <div style={{ ...mono, fontSize:13, fontWeight:700, color:col, lineHeight:1 }}>
              {avg}
            </div>
            <div style={{ fontSize:6, color:col }}>TÍCH LŨY</div>
          </div>
        </div>

        <div style={{ flex:1 }}>
          <div style={{ fontSize:10, fontWeight:600, color:col, marginBottom:2 }}>
            🤖 AI Tổng Hợp MN
          </div>
          {text ? (
            <div style={{ fontSize:9, color:'#b0b8d0', lineHeight:1.7 }}>
              {text}
            </div>
          ) : (
            <div style={{ fontSize:9, color:C.muted }}>
              Elliott WО mở rộng + Wyckoff Spring Phase C + SMC Demand $6.08 chắc chắn
              + VSA No Supply + DXY yếu + SHFE Cu tăng 1.1% + XAG đồng thuận.
              <span style={{ color:C.green, fontWeight:600 }}>
                {' '}Entry vùng $6.08–$6.12 tối ưu nhất.
              </span>
            </div>
          )}
        </div>

        {/* Entry/TP/SL */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)',
          gap:6, flexShrink:0 }}>
          {[
            {lbl:'Entry', val:`$${(s.prev_low||6.100).toFixed(3)}`, col:C.green},
            {lbl:'TP1',   val:`$${(s.tp1||6.380).toFixed(3)}`,      col:C.teal},
            {lbl:'TP2',   val:`$${(s.tp2||6.620).toFixed(3)}`,      col:C.cyan},
          ].map((m,i) => (
            <div key={i} style={{ background:'#0a1520', borderRadius:5,
              padding:'4px 7px', textAlign:'center',
              border:`0.5px solid ${m.col}33` }}>
              <div style={{ fontSize:7, color:C.muted }}>{m.lbl}</div>
              <div style={{ ...mono, fontSize:9, fontWeight:700, color:m.col }}>
                {m.val}
              </div>
            </div>
          ))}
          {[
            {lbl:'SL',    val:`$${(s.sl||5.940).toFixed(3)}`, col:C.red},
            {lbl:'R:R',   val:'1 : 2.6',                      col:C.amber},
            {lbl:'Vốn',   val:'2% vốn',                       col:C.purple},
          ].map((m,i) => (
            <div key={i} style={{ background:'#0a1520', borderRadius:5,
              padding:'4px 7px', textAlign:'center',
              border:`0.5px solid ${m.col}33` }}>
              <div style={{ fontSize:7, color:C.muted }}>{m.lbl}</div>
              <div style={{ ...mono, fontSize:9, fontWeight:700, color:m.col }}>
                {m.val}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA button */}
      <button onClick={onGenerate} disabled={loading} style={{
        width:'100%', padding:'9px', borderRadius:8,
        background: loading?'#0f1e30':`${C.green}18`,
        border:`1px solid ${loading?'#1e3050':C.green}`,
        color: loading?C.muted:C.green,
        fontSize:10, fontWeight:700, cursor:loading?'default':'pointer',
        display:'flex', alignItems:'center', justifyContent:'center', gap:6,
      }}>
        <span style={{ animation:loading?'spin 1s linear infinite':'' }}>
          {loading?'⟳':'⚡'}
        </span>
        {loading?'Đang phân tích...'
          :'Kích Hoạt AI Phân Tích Sâu — Elliott + VSA + Wyckoff + SMC + Harmonic + Liên Thị Trường (Real-Time)'}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════
export default function TrendTab({ s, ew, vsa, ti, mh, verdict, bias }) {
  const [aiText, setAiText]   = useState('');
  const [loading, setLoading] = useState(false);
  const [timeframe, setTimeframe] = useState('MN');

  const TFS = ['MN','W','D','H4','H1','M15'];

  // ─── Score array ─────────────────────────────────────────
  const scores = useMemo(() => [
    { label:'Elliott Wave', score:ew?.score||88 },
    { label:'VSA Engine',   score:vsa?.score||82 },
    { label:'Wyckoff Cycle',score:75 },
    { label:'SMC',          score:91 },
    { label:'Harmonic',     score:70 },
    { label:'Liên Thị Trường', score:85 },
  ], [ew, vsa]);

  // ─── AI generate ─────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/claude', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          model:'claude-sonnet-4-5', max_tokens:500,
          messages:[{ role:'user', content:
            `Bạn là chuyên gia phân tích kỹ thuật đồng COMEX chuyên nghiệp.
Tổng hợp phân tích ngắn gọn tiếng Việt (~80 từ) dựa trên:
- Elliott Wave: W${ew?.wave||'3'} (${ew?.label||'Sóng 3'}) — xác suất ${ew?.prob||72}%
- VSA: ${vsa?.meta?.label||'Neutral'} — Vol ratio ${vsa?.latestBar?.volRatio||1.0}×
- Wyckoff: Phase C — Spring confirmed
- SMC: BOS breakout $6.140, Demand zone $5.98–$6.12
- Harmonic: Bullish Gartley 94%
- Liên TT: DXY -0.4%, Shanghai +1.1%, XAG đồng thuận
- COMEX: $${s.comex?.toFixed(3)||'6.256'}/lb | Bias: ${bias}/100
Kết luận: entry zone cụ thể + hành động ưu tiên.`
          }],
        }),
      });
      const d    = await r.json();
      const text = (d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
      if (text) setAiText(text);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [ew, vsa, s.comex, bias]);

  const priceChart = s.priceChart || [];

  return (
    <div style={{ display:'grid', gap:9 }}>

      {/* Timeframe selector */}
      <div style={{ display:'flex', gap:4, alignItems:'center',
        background:'#060d18', borderRadius:9, padding:'6px 10px',
        border:'1px solid #1e3050', flexWrap:'wrap' }}>
        <span style={{ fontSize:9, color:C.muted, marginRight:4, fontWeight:500 }}>
          TIMEFRAME:
        </span>
        {TFS.map(tf => (
          <button key={tf} onClick={()=>setTimeframe(tf)} style={{
            fontSize:9, padding:'3px 10px', borderRadius:5,
            border:`0.5px solid ${timeframe===tf?C.blue:'#1e3050'}`,
            background:timeframe===tf?`${C.blue}18`:'transparent',
            color:timeframe===tf?C.blue:C.muted,
            cursor:'pointer', fontWeight:timeframe===tf?600:400,
          }}>{tf}</button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
          <Bdg label={`W${ew?.wave||'3'}`} col={C.green} />
          <Bdg label={`Bias ${bias}/100`}  col={sc(bias)} />
          <Bdg label={verdict?.verdictLabel||'BUY'} col={verdict?.verdictCol||C.green} />
        </div>
      </div>

      {/* Main layout: left | center | right */}
      <div style={{ display:'grid',
        gridTemplateColumns:'220px 1fr 210px', gap:9, alignItems:'start' }}>

        {/* LEFT: Fib + Multi-method */}
        <div style={{ display:'grid', gap:9 }}>
          <FibPanel s={s} ew={ew} />
          <MultiMethodPanel scores={scores} verdict={verdict} bias={bias} />
        </div>

        {/* CENTER: Price chart + Elliott tabs */}
        <div style={{ display:'grid', gap:9 }}>
          <PriceChart s={s} priceChart={priceChart} timeframe={timeframe} />
          <ElliottTabsEngine s={s} ew={ew} vsa={vsa} />
        </div>

        {/* RIGHT: Wyckoff + SMC + Harmonic */}
        <div style={{ display:'grid', gap:9 }}>
          <WyckoffPanel />
          <SMCPanel />
          <HarmonicPanel />
        </div>
      </div>

      {/* Bottom: AI Tổng Hợp */}
      <AITongHop
        s={s} scores={scores}
        loading={loading}
        onGenerate={handleGenerate}
        text={aiText}
      />
    </div>
  );
}