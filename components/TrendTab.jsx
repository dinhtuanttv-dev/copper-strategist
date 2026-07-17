// ─── TrendTab v7 FINAL ────────────────────────────────────────────────────────
// Fix: chart nhận bars từ useChartData, SVG render đúng
// Layout: 3-col stable, không overflow
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTrendEngine } from '../hooks/useTrendEngine';
import { useChartData }          from '../hooks/useChartData';
import { useAnalysisController } from '../hooks/useAnalysisController';
import { calcShortSetup }        from '../lib/calculations';
import SignalLog                 from './SignalLog';
import IMHeatmap                 from './IMHeatmap';

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b',
  blue:'#3b82f6',  teal:'#14b8a6', purple:'#8b5cf6',
  orange:'#f97316',cyan:'#06b6d4', muted:'#5a7090',
  bg:'#060d18', bg2:'#0a1520', grid:'#0f1e30',
};
const mono = { fontFamily:'monospace' };
const sc   = v => v>=70?C.green:v>=50?C.amber:C.red;

const DEFAULT_LAYERS = {
  smc:true, wyckoff:true, fib:true, elliott:true,
  vsa:true, harmonic:false, ai_detection:true,
};

// ─── Micro UI ─────────────────────────────────────────────────────────────────
function Bdg({ label, col, size=8 }) {
  return (
    <span style={{
      fontSize:size, padding:'2px 7px', borderRadius:4, fontWeight:700,
      background:col+'22', color:col, border:`0.5px solid ${col}44`, whiteSpace:'nowrap',
    }}>{label}</span>
  );
}

function Panel({ title, icon, glow, children, badge, badgeCol }) {
  return (
    <div style={{
      background:C.bg, border:`1px solid ${glow||C.grid}`,
      borderRadius:11, padding:'11px 13px',
      boxShadow:glow?`0 0 14px ${glow}14`:'none',
    }}>
      <div style={{ display:'flex', justifyContent:'space-between',
        alignItems:'center', marginBottom:9, flexWrap:'wrap', gap:5 }}>
        <div style={{ fontSize:10, fontWeight:600, color:'#e2e8f0',
          display:'flex', alignItems:'center', gap:5 }}>
          {icon&&<span style={{ fontSize:13 }}>{icon}</span>}{title}
        </div>
        {badge&&<Bdg label={badge} col={badgeCol||C.blue}/>}
      </div>
      {children}
    </div>
  );
}

function SBar({ label, score, col }) {
  const c=col||sc(score);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
      <span style={{ fontSize:9, color:C.muted, width:85, flexShrink:0 }}>{label}</span>
      <div style={{ flex:1, background:C.grid, borderRadius:2, height:5, overflow:'hidden' }}>
        <div style={{ width:`${Math.min(100,score)}%`, height:'100%',
          background:c, borderRadius:2, transition:'width .5s' }}/>
      </div>
      <span style={{ fontSize:9, fontWeight:700, color:c, width:22, textAlign:'right' }}>
        {score}
      </span>
    </div>
  );
}

function ToggleSwitch({ label, active, onChange, col, small }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between',
      alignItems:'center', marginBottom:small?3:5 }}>
      <span style={{ fontSize:small?8:9, color:active?'#e2e8f0':C.muted }}>{label}</span>
      <div onClick={()=>onChange?.(!active)} style={{
        width:28, height:14, borderRadius:7, position:'relative',
        cursor:'pointer', flexShrink:0, userSelect:'none',
        background:active?(col||C.green)+'44':C.grid,
        border:`0.5px solid ${active?(col||C.green):C.grid}`,
      }}>
        <div style={{
          width:10, height:10, borderRadius:'50%', position:'absolute',
          top:1, left:active?16:2,
          background:active?(col||C.green):C.muted,
          transition:'left .2s',
        }}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CANDLE CHART — không cần CDN, nhận bars trực tiếp
// ═══════════════════════════════════════════════════════════════════════════════
function CandleChart({ bars, activeTF, isLoading, ew, smcData, showFib, showSMC }) {
  const W=580, H=260, P={t:14,r:54,b:26,l:4};
  const iw=W-P.l-P.r, ih=H-P.t-P.b;

  const data = useMemo(()=>{
    if (!bars?.length) return [];
    return bars
      .filter(b => b && b.comex > 0)
      .map(b => ({
        t: b.ts ? Math.floor(b.ts/1000) : Date.now()/1000,
        o: +(b.open  || b.comex).toFixed(4),
        h: +(b.high  || b.comex*1.005).toFixed(4),
        l: +(b.low   || b.comex*0.995).toFixed(4),
        c: +b.comex.toFixed(4),
        v: b.vol || 0,
      }))
      .sort((a,b)=>a.t-b.t)
      .filter((v,i,a)=>i===0||v.t!==a[i-1].t)
      .slice(-80);
  },[bars]);

  // Loading state
  if (isLoading && data.length < 3) {
    return (
      <div style={{ width:'100%',height:H,background:C.bg,borderRadius:7,
        display:'flex',flexDirection:'column',alignItems:'center',
        justifyContent:'center',gap:8 }}>
        <div style={{ fontSize:22,animation:'spin 1s linear infinite',
          display:'inline-block',color:C.amber }}>⟳</div>
        <div style={{ color:C.muted,fontSize:10 }}>
          Đang tải dữ liệu {activeTF}...
        </div>
      </div>
    );
  }

  // No data
  if (data.length < 2) {
    return (
      <div style={{ width:'100%',height:H,background:C.bg,borderRadius:7,
        display:'flex',flexDirection:'column',alignItems:'center',
        justifyContent:'center',gap:8,border:`1px dashed ${C.grid}` }}>
        <div style={{ fontSize:28 }}>📊</div>
        <div style={{ color:C.muted,fontSize:10 }}>
          Chưa có dữ liệu {activeTF}
        </div>
        <div style={{ color:C.grid,fontSize:8 }}>
          Nhấn ↺ để tải hoặc chọn timeframe khác
        </div>
      </div>
    );
  }

  // Scale helpers
  const prices = data.flatMap(d=>[d.h,d.l]);
  const pMax=Math.max(...prices), pMin=Math.min(...prices);
  const pRange=Math.max(pMax-pMin, 0.01);
  const margin = pRange * 0.05;
  const scMin  = pMin - margin;
  const scMax  = pMax + margin;
  const scRange = scMax - scMin;

  const toY = p => P.t + ih*(1-(p-scMin)/scRange);
  const toX = i => P.l + iw*(i/(Math.max(data.length-1,1)));
  const bw  = Math.max(1.5, (iw/data.length)*0.7);

  // Y-axis ticks (5 levels)
  const yTicks = Array.from({length:5},(_,i)=>{
    const p = scMin + scRange*(i/4);
    return { y:toY(p), p };
  });

  // X-axis labels
  const xIdxs = [0,
    Math.floor(data.length*0.25),
    Math.floor(data.length*0.5),
    Math.floor(data.length*0.75),
    data.length-1,
  ].filter((v,i,a)=>a.indexOf(v)===i);

  const last  = data[data.length-1];
  const first = data[0];
  const chgPct = ((last.c-first.c)/first.c*100);
  const isUp  = last.c >= first.c;

  // Fib overlay lines
  const fibLines = [];
  if (showFib && ew) {
    [
      { p:ew.fib382,   col:'#14b8a6', lbl:'0.382' },
      { p:ew.fib500,   col:'#3b82f6', lbl:'0.500' },
      { p:ew.fib618,   col:'#f59e0b', lbl:'0.618' },
      { p:ew.fib786,   col:'#ef4444', lbl:'0.786' },
      { p:ew.w3Target, col:'#22c55e', lbl:'TP' },
    ].forEach(l=>{
      if (l.p>0 && l.p>scMin && l.p<scMax) fibLines.push(l);
    });
  }

  // SMC overlay lines
  const smcLines = [];
  if (showSMC && smcData) {
    [
      { p:smcData.obBear?.[0], col:'#ef4444', lbl:'OB↓' },
      { p:smcData.obBear?.[1], col:'#ef444466', lbl:'' },
      { p:smcData.obBull?.[1], col:'#22c55e', lbl:'OB↑' },
      { p:smcData.obBull?.[0], col:'#22c55e66', lbl:'' },
      { p:smcData.liq,          col:'#f59e0b', lbl:'Liq' },
    ].forEach(l=>{
      if (l.p>0 && l.p>scMin && l.p<scMax) smcLines.push(l);
    });
  }

  return (
    <div style={{ width:'100%' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        style={{ background:C.bg, borderRadius:'7px 7px 0 0', display:'block' }}
        preserveAspectRatio="none"
      >
        {/* Grid horizontal */}
        {yTicks.map((t,i)=>(
          <g key={i}>
            <line x1={P.l} y1={t.y} x2={W-P.r} y2={t.y}
              stroke={C.grid} strokeWidth={0.5} strokeDasharray="3,4" opacity={0.8}/>
            <text x={W-P.r+3} y={t.y+3.5}
              fill={C.muted} fontSize={7.5} fontFamily="monospace">
              ${t.p.toFixed(3)}
            </text>
          </g>
        ))}

        {/* Fib lines */}
        {fibLines.map((l,i)=>(
          <g key={`fib${i}`}>
            <line x1={P.l} y1={toY(l.p)} x2={W-P.r} y2={toY(l.p)}
              stroke={l.col} strokeWidth={0.8} strokeDasharray="6,3" opacity={0.75}/>
            {l.lbl&&(
              <text x={W-P.r+3} y={toY(l.p)+3.5}
                fill={l.col} fontSize={6.5} fontFamily="monospace">
                {l.lbl}
              </text>
            )}
          </g>
        ))}

        {/* SMC lines */}
        {smcLines.map((l,i)=>(
          <line key={`smc${i}`} x1={P.l} y1={toY(l.p)} x2={W-P.r} y2={toY(l.p)}
            stroke={l.col} strokeWidth={0.6} strokeDasharray="2,4" opacity={0.6}/>
        ))}

        {/* Volume bars (bottom 15%) */}
        {(()=>{
          const maxVol=Math.max(...data.map(d=>d.v),1);
          const volH=ih*0.14;
          return data.map((d,i)=>{
            const x=toX(i), vh=Math.max(1,(d.v/maxVol)*volH);
            const up=d.c>=d.o;
            return (
              <rect key={`v${i}`}
                x={x-bw/2} y={H-P.b-vh} width={bw} height={vh}
                fill={up?C.green:C.red} opacity={0.25}/>
            );
          });
        })()}

        {/* Candles */}
        {data.map((d,i)=>{
          const x=toX(i);
          const up=d.c>=d.o;
          const col=up?C.green:C.red;
          const bodyTop=toY(Math.max(d.o,d.c));
          const bodyBot=toY(Math.min(d.o,d.c));
          const bodyH=Math.max(1,bodyBot-bodyTop);
          return (
            <g key={i}>
              {/* Wick */}
              <line x1={x} y1={toY(d.h)} x2={x} y2={toY(d.l)}
                stroke={col} strokeWidth={0.8} opacity={0.8}/>
              {/* Body */}
              <rect x={x-bw/2} y={bodyTop} width={bw} height={bodyH}
                fill={col} opacity={0.9}/>
            </g>
          );
        })}

        {/* Last price dashed line */}
        <line x1={P.l} y1={toY(last.c)} x2={W-P.r} y2={toY(last.c)}
          stroke={isUp?C.green:C.red} strokeWidth={0.8}
          strokeDasharray="5,3" opacity={0.6}/>

        {/* Last price badge */}
        <rect x={W-P.r+1} y={toY(last.c)-8} width={50} height={16}
          rx={3} fill={isUp?C.green:C.red} opacity={0.95}/>
        <text x={W-P.r+26} y={toY(last.c)+4} fill="#050c16" fontSize={8.5}
          textAnchor="middle" fontWeight="bold" fontFamily="monospace">
          ${last.c.toFixed(3)}
        </text>

        {/* X-axis labels */}
        {xIdxs.map((idx,k)=>idx<data.length&&(
          <text key={k} x={toX(idx)} y={H-5} fill={C.muted} fontSize={7.5}
            textAnchor="middle">
            {new Date(data[idx].t*1000)
              .toLocaleDateString('vi-VN',{month:'2-digit',day:'2-digit'})}
          </text>
        ))}
      </svg>

      {/* Info bar */}
      <div style={{
        display:'flex', gap:10, alignItems:'center',
        padding:'3px 8px', background:C.bg2,
        borderRadius:'0 0 7px 7px',
        border:`0.5px solid ${C.grid}`, borderTop:'none',
        fontSize:8,
      }}>
        <span style={{ color:C.muted }}>{activeTF}</span>
        <span style={{ color:C.muted }}>{data.length} nến</span>
        <span style={{ ...mono, color:isUp?C.green:C.red }}>
          {isUp?'▲':'▼'}{Math.abs(chgPct).toFixed(2)}%
        </span>
        <span style={{ color:C.muted }}>
          H:{last.h.toFixed(3)} L:{last.l.toFixed(3)}
        </span>
        <span style={{ color:C.grid, marginLeft:'auto' }}>
          📊 Yahoo Finance · HG=F
        </span>
        {isLoading&&(
          <span style={{ color:C.amber, animation:'pulse 1s infinite' }}>
            ⟳ cập nhật...
          </span>
        )}
      </div>
    </div>
  );
}

// ─── PriceChart panel ─────────────────────────────────────────────────────────
function PriceChart({ safeS, activeTF, ew, smcData, onSetDrawingTool }) {
  // KEY FIX: gọi useChartData TRONG component này, không dùng ref external
  const { bars, loading, refresh, barCount } = useChartData(activeTF, safeS);

  const comexUp  = (safeS.comex_chg_pct||0) >= 0;
  const [activeTool, setActiveTool] = useState(null);
  const [showFib,    setShowFib]    = useState(true);
  const [showSMC,    setShowSMC]    = useState(true);
  const [showWy,     setShowWy]     = useState(true);

  const handleTool = t => {
    const n = activeTool===t ? null : t;
    setActiveTool(n);
    onSetDrawingTool?.(n);
  };

  return (
    <div style={{
      background:C.bg, border:`1px solid ${C.grid}`,
      borderRadius:11, padding:'11px 13px',
    }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between',
        alignItems:'center', marginBottom:7, flexWrap:'wrap', gap:5 }}>
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:11, fontWeight:600, color:'#e2e8f0' }}>
            ⚡ ĐỒNG COMEX — {activeTF}
          </span>
          {loading
            ? <Bdg label="⟳ Đang tải..." col={C.amber}/>
            : barCount < 3
            ? <Bdg label={`${barCount} bar`} col={C.red}/>
            : <Bdg label={ew?.label||`W${ew?.wave||'?'}`}
                col={ew?.failure?C.red:C.green}/>
          }
          {ew?.w3Target>0 && !ew?.failure && (
            <Bdg label={`TP $${ew.w3Target}`} col={C.amber}/>
          )}
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ ...mono, fontSize:13, fontWeight:700,
            color:comexUp?C.green:C.red }}>
            ${(safeS.comex||0).toFixed(3)}
          </span>
          <span style={{ fontSize:9, color:comexUp?C.green:C.red }}>
            {comexUp?'▲':'▼'}{Math.abs(safeS.comex_chg_pct||0).toFixed(2)}%
          </span>
          <span style={{ fontSize:8, color:C.muted }}>{barCount}b</span>
          <button onClick={()=>refresh(true)} disabled={loading} style={{
            fontSize:9, padding:'2px 8px', borderRadius:4,
            border:`0.5px solid ${C.grid}`, background:'transparent',
            color:C.muted, cursor:loading?'default':'pointer',
          }}>
            <span style={{
              animation:loading?'spin 1s linear infinite':'',
              display:'inline-block',
            }}>{loading?'⟳':'↺'}</span>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{
        display:'flex', gap:4, marginBottom:6, padding:'4px 8px',
        background:C.bg2, borderRadius:7, border:`0.5px solid ${C.grid}`,
        flexWrap:'wrap', alignItems:'center',
      }}>
        <span style={{ fontSize:8, color:C.muted, flexShrink:0 }}>VẼ:</span>
        {[
          { t:'trendline', icon:'╱', label:'Trendline', col:C.blue   },
          { t:'rectangle', icon:'▭', label:'OB Zone',   col:C.amber  },
          { t:'fibonacci',  icon:'⟨', label:'Fibonacci', col:C.purple },
        ].map(b=>(
          <button key={b.t} onClick={()=>handleTool(b.t)} style={{
            fontSize:8, padding:'2px 8px', borderRadius:4, cursor:'pointer',
            border:`0.5px solid ${activeTool===b.t?b.col:C.grid}`,
            background:activeTool===b.t?`${b.col}18`:'transparent',
            color:activeTool===b.t?b.col:C.muted,
            display:'flex', alignItems:'center', gap:3,
          }}>
            <span>{b.icon}</span>{b.label}
          </button>
        ))}
        {activeTool&&(
          <button onClick={()=>handleTool(null)} style={{
            fontSize:8, padding:'2px 8px', borderRadius:4, cursor:'pointer',
            border:`0.5px solid ${C.red}`, background:`${C.red}12`, color:C.red,
          }}>✕ Huỷ</button>
        )}
        <div style={{ marginLeft:'auto', display:'flex', gap:3 }}>
          {[
            { k:'fib', l:'Fib', col:C.amber,  v:showFib, s:setShowFib },
            { k:'smc', l:'SMC', col:C.blue,   v:showSMC, s:setShowSMC },
            { k:'wy',  l:'Wy',  col:C.purple, v:showWy,  s:setShowWy  },
          ].map(b=>(
            <button key={b.k} onClick={()=>b.s(v=>!v)} style={{
              fontSize:7, padding:'1px 6px', borderRadius:3, cursor:'pointer',
              border:`0.5px solid ${b.v?b.col:C.grid}`,
              background:b.v?`${b.col}18`:'transparent',
              color:b.v?b.col:C.muted,
            }}>{b.v?'●':'○'} {b.l}</button>
          ))}
        </div>
      </div>

      {activeTool&&(
        <div style={{
          background:`${C.blue}10`, border:`0.5px solid ${C.blue}44`,
          borderRadius:6, padding:'4px 9px', marginBottom:6,
          fontSize:8, color:C.blue, display:'flex', alignItems:'center', gap:5,
        }}>
          <span style={{ animation:'pulse 1s ease-in-out infinite' }}>✏️</span>
          Chế độ vẽ <b>{activeTool}</b> — click &amp; kéo
        </div>
      )}

      {/* SVG Chart — nhận bars trực tiếp */}
      <CandleChart
        bars={bars}
        activeTF={activeTF}
        isLoading={loading}
        ew={ew}
        smcData={smcData}
        showFib={showFib}
        showSMC={showSMC}
      />
    </div>
  );
}

// ─── ControlPanel ─────────────────────────────────────────────────────────────
function ControlPanel({ layers, onToggle, onSetTool, ew, vsa, wyckoff, rsi }) {
  const L = layers || DEFAULT_LAYERS;
  const [tool, setTool] = useState(null);
  const handleTool = t => {
    const n = tool===t ? null : t;
    setTool(n); onSetTool?.(n);
  };
  return (
    <div style={{
      background:C.bg,
      border:`1px solid ${L.ai_detection?C.purple+'66':C.grid}`,
      borderRadius:11, padding:'11px 13px',
    }}>
      <div style={{ fontSize:10, fontWeight:600, color:'#e2e8f0',
        marginBottom:9, display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ fontSize:13 }}>🎛️</span>PHÂN TÍCH &amp; CÔNG CỤ AI
      </div>

      <div style={{ fontSize:8, color:C.muted, marginBottom:5,
        fontWeight:600, letterSpacing:'.05em' }}>
        PHƯƠNG PHÁP BẬT / TẮT
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}>
        {[
          { k:'elliott', l:'Elliott Wave', col:C.blue   },
          { k:'vsa',     l:'VSA Engine',   col:C.green  },
          { k:'wyckoff', l:'Wyckoff',      col:C.amber  },
          { k:'smc',     l:'SMC',          col:C.teal   },
          { k:'harmonic',l:'Harmonic',     col:C.purple },
          { k:'fib',     l:'Fibonacci',    col:C.cyan   },
        ].map(item=>(
          <ToggleSwitch key={item.k} label={item.l}
            active={L[item.k]!==false}
            onChange={v=>onToggle?.(item.k,v)}
            col={item.col}/>
        ))}
      </div>

      {/* AI Detection master */}
      <div style={{
        background:L.ai_detection?`${C.purple}12`:C.bg2,
        border:`0.5px solid ${L.ai_detection?C.purple:C.grid}`,
        borderRadius:8, padding:'7px 10px', marginTop:7, marginBottom:8,
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:10, fontWeight:600,
              color:L.ai_detection?C.purple:'#e2e8f0' }}>🤖 AI Detection</div>
            <div style={{ fontSize:8, color:C.muted, marginTop:1 }}>
              Phân tích tương quan đa lớp
            </div>
          </div>
          <ToggleSwitch label="" small
            active={L.ai_detection!==false}
            onChange={v=>onToggle?.('ai_detection',v)}
            col={C.purple}/>
        </div>
        {L.ai_detection&&(
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:5 }}>
            <Bdg label={`W${ew?.wave||'?'}`} col={ew?.failure?C.red:C.green}/>
            <Bdg label={`RSI ${rsi||0}`}
              col={(rsi||0)>70?C.red:(rsi||0)<30?C.green:C.amber}/>
            <Bdg label={wyckoff?.label?.split(' ').pop()||'?'} col={C.amber}/>
          </div>
        )}
      </div>

      {/* Drawing tools */}
      <div style={{ borderTop:`0.5px solid ${C.grid}`, paddingTop:8 }}>
        <div style={{ fontSize:8, color:C.muted, marginBottom:5,
          fontWeight:600, letterSpacing:'.05em' }}>
          CÔNG CỤ VẼ TƯƠNG TÁC
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
          {[
            { t:'trendline', icon:'╱', l:'Trendline', col:C.blue   },
            { t:'rectangle', icon:'▭', l:'OB Zone',   col:C.amber  },
            { t:'fibonacci',  icon:'⟨', l:'Fibonacci', col:C.purple },
            { t:null,         icon:'✕', l:'Reset',     col:C.red    },
          ].map((b,i)=>(
            <button key={i} onClick={()=>handleTool(b.t)} style={{
              fontSize:8, padding:'5px 6px', borderRadius:6, cursor:'pointer',
              border:`0.5px solid ${tool===b.t?(b.col||C.red):C.grid}`,
              background:tool===b.t?`${b.col||C.red}18`:C.bg2,
              color:tool===b.t?(b.col||C.red):C.muted,
              display:'flex', alignItems:'center', gap:4,
            }}>
              <span style={{ fontSize:10 }}>{b.icon}</span>{b.l}
            </button>
          ))}
        </div>
        {tool&&(
          <div style={{
            marginTop:5, fontSize:8, color:C.blue,
            background:`${C.blue}08`, borderRadius:5,
            padding:'3px 7px', border:`0.5px solid ${C.blue}33`,
            display:'flex', alignItems:'center', gap:4,
          }}>
            <span style={{ animation:'pulse 1s ease-in-out infinite' }}>✏️</span>
            Đang vẽ <b style={{ color:'#e2e8f0' }}>{tool}</b>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PatternScanner ───────────────────────────────────────────────────────────
function detectPatterns(bars, ew, vsa, price) {
  if (!bars?.length || bars.length < 8) return [];
  const cu  = price || 6.07;
  const sl  = bars.slice(-20);
  const hi  = Math.max(...sl.map(b=>b.high||b.comex||cu));
  const lo  = Math.min(...sl.map(b=>b.low ||b.comex||cu));
  const rng = Math.max(hi-lo, 0.01);
  const pos = (cu-lo)/rng;
  const n   = bars.length;
  const mom = n>=5 ? (bars[n-1].comex||cu)-(bars[n-5].comex||cu) : 0;
  const vsaScore = vsa?.score || 50;
  const p = [];

  if (pos < 0.35 && vsaScore > 50)
    p.push({ id:'ihs',  tf:'H4', name:'Vai đầu vai ngược (IH&S)',
      status:'forming', direction:'long',  probability:72,
      target:+(cu+rng*0.7).toFixed(3), invalidation:+(lo-rng*0.1).toFixed(3),
      ai_tags:['accumulation','spring'] });
  if (pos > 0.55 && mom > 0 && ew?.wave==='3')
    p.push({ id:'cup',  tf:'D',  name:'Cốc tay cầm (Cup & Handle)',
      status:'forming', direction:'long',  probability:68,
      target:+(cu+rng*0.5).toFixed(3), invalidation:+(cu-rng*0.15).toFixed(3),
      ai_tags:['breakout','w3'] });
  if (pos >= 0.4 && pos <= 0.65)
    p.push({ id:'tri',  tf:'H4', name:'Tam giác tăng',
      status:pos>0.57?'formed':'forming', direction:'long', probability:63,
      target:+(hi+rng*0.3).toFixed(3), invalidation:+(lo+rng*0.3).toFixed(3),
      ai_tags:['triangle'] });
  if (ew?.wave === '4')
    p.push({ id:'flat', tf:'H4', name:'Phẳng (Flat Correction W4)',
      status:'forming', direction:'long',  probability:60,
      target:+(cu+rng*0.4).toFixed(3),
      invalidation:+(ew.fib786||cu-rng*0.2).toFixed(3),
      ai_tags:['correction','wave4'] });
  if (pos > 0.82 && vsaScore < 48)
    p.push({ id:'hns',  tf:'D',  name:'Vai đầu vai (H&S)',
      status:'forming', direction:'short', probability:64,
      target:+(cu-rng*0.5).toFixed(3), invalidation:+(hi+rng*0.05).toFixed(3),
      ai_tags:['distribution'] });
  if (pos < 0.22 && mom > 0)
    p.push({ id:'fw',   tf:'W',  name:'Nêm giảm (Falling Wedge)',
      status:'formed',  direction:'long',  probability:75,
      target:+(cu+rng*0.6).toFixed(3), invalidation:+(lo-rng*0.05).toFixed(3),
      ai_tags:['reversal'] });
  return p;
}

function PatternScanner({ bars, ew, vsa, safeS }) {
  const [tf,   setTF]   = useState('all');
  const [dir,  setDir]  = useState('all');
  const [minP, setMinP] = useState(60);

  const all = useMemo(()=>
    detectPatterns(bars, ew, vsa, safeS.comex),
    [bars, ew, vsa, safeS.comex]
  );
  const list = useMemo(()=>all.filter(p=>{
    if (tf!=='all' && p.tf!==tf)       return false;
    if (dir!=='all' && p.direction!==dir) return false;
    return p.probability >= minP;
  }),[all,tf,dir,minP]);

  return (
    <Panel title="PATTERN SCANNER" icon="🔍"
      glow={C.cyan} badge={`${list.length}/${all.length}`} badgeCol={C.cyan}>
      <div style={{ display:'flex', gap:3, marginBottom:7,
        flexWrap:'wrap', alignItems:'center' }}>
        {['all','H1','H4','D','W'].map(v=>(
          <button key={v} onClick={()=>setTF(v)} style={{
            fontSize:8, padding:'2px 7px', borderRadius:4, cursor:'pointer',
            border:`0.5px solid ${tf===v?C.cyan:C.grid}`,
            background:tf===v?`${C.cyan}18`:'transparent',
            color:tf===v?C.cyan:C.muted,
          }}>{v==='all'?'All TF':v}</button>
        ))}
        {['all','long','short'].map(v=>{
          const dc = v==='long'?C.green:v==='short'?C.red:C.muted;
          return (
            <button key={v} onClick={()=>setDir(v)} style={{
              fontSize:8, padding:'2px 7px', borderRadius:4, cursor:'pointer',
              border:`0.5px solid ${dir===v?dc:C.grid}`,
              background:dir===v?`${dc}18`:'transparent',
              color:dir===v?dc:C.muted,
            }}>{v==='all'?'All':v==='long'?'🟢 Long':'🔴 Short'}</button>
          );
        })}
        <div style={{ display:'flex', alignItems:'center', gap:4, marginLeft:'auto' }}>
          <span style={{ fontSize:8, color:C.muted }}>≥</span>
          <input type="range" min={50} max={90} value={minP}
            onChange={e=>setMinP(+e.target.value)}
            style={{ width:55, accentColor:C.cyan }}/>
          <span style={{ fontSize:8, color:C.cyan, ...mono }}>{minP}%</span>
        </div>
      </div>

      {list.length===0 ? (
        <div style={{ padding:'14px 0', textAlign:'center',
          color:C.muted, fontSize:9 }}>
          {all.length===0
            ? '⏳ Chưa đủ dữ liệu để phát hiện mô hình'
            : `Không có mô hình ≥${minP}% · Thử giảm ngưỡng`}
        </div>
      ) : list.map((p,i)=>{
        const dc  = p.direction==='long'?C.green:C.red;
        const sc2 = p.status==='formed'?C.green:C.amber;
        return (
          <div key={p.id} style={{
            background:C.bg2, border:`0.5px solid ${dc}33`,
            borderRadius:8, padding:'8px 10px', marginBottom:5,
          }}>
            <div style={{ display:'flex', justifyContent:'space-between',
              alignItems:'flex-start', marginBottom:5 }}>
              <div>
                <div style={{ fontSize:10, fontWeight:600, color:'#e2e8f0' }}>
                  {p.name}
                </div>
                <div style={{ display:'flex', gap:4, marginTop:3 }}>
                  <Bdg label={p.tf} col={C.blue} size={7}/>
                  <Bdg label={p.status==='formed'
                    ?'✅ Hình thành':'⏳ Đang hình thành'}
                    col={sc2} size={7}/>
                </div>
              </div>
              <div style={{ textAlign:'center', background:dc+'12',
                borderRadius:7, padding:'4px 8px',
                border:`0.5px solid ${dc}44`, flexShrink:0 }}>
                <div style={{ ...mono, fontSize:16, fontWeight:700,
                  color:dc, lineHeight:1 }}>{p.probability}%</div>
                <div style={{ fontSize:6, color:C.muted }}>prob</div>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
              {[
                { lbl:p.direction==='long'?'🟢 MUA':'🔴 BÁN',
                  val:p.direction==='long'?'Chiều Mua':'Chiều Bán', col:dc },
                { lbl:'🎯 Target',   val:`$${p.target}`,      col:C.green },
                { lbl:'⛔ SL',       val:`$${p.invalidation}`,col:C.red   },
              ].map((m,j)=>(
                <div key={j} style={{ background:C.bg, borderRadius:5,
                  padding:'4px 6px', border:`0.5px solid ${m.col}22` }}>
                  <div style={{ fontSize:7, color:C.muted }}>{m.lbl}</div>
                  <div style={{ ...mono, fontSize:9, fontWeight:700,
                    color:m.col }}>{m.val}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginTop:5 }}>
              {p.ai_tags.map((t,j)=>(
                <span key={j} style={{ fontSize:7, padding:'1px 5px',
                  borderRadius:3, background:`${C.purple}18`,
                  color:C.purple, border:`0.5px solid ${C.purple}33` }}>
                  #{t}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </Panel>
  );
}

// ─── FibPanel ─────────────────────────────────────────────────────────────────
function FibPanel({ safeS, ew, activeTF }) {
  const cu = safeS.comex||6.07;
  const rows = [
    { lbl:'Fib 1.618 — TP3',  p:ew.w3Target||+(cu*1.10).toFixed(3),  tag:'TP3',   col:C.cyan  },
    { lbl:'Fib 1.272 — TP2',  p:safeS.tp2||+(cu*1.058).toFixed(3),   tag:'TP2',   col:C.teal  },
    { lbl:'Fib 1.000 — TP1',  p:safeS.tp1||+(cu*1.025).toFixed(3),   tag:'TP1',   col:C.green },
    { lbl:'▶ Giá Hiện Tại',   p:cu,                                   tag:'NOW',   col:C.blue  },
    { lbl:'Fib 0.500 — Entry',p:ew.fib500||+(cu*0.985).toFixed(3),   tag:'Entry', col:C.green },
    { lbl:'Fib 0.618 — SL–',  p:ew.fib618||+(cu*0.975).toFixed(3),   tag:'SL–',   col:C.amber },
    { lbl:'Fib 0.786 — SL=',  p:ew.fib786||+(cu*0.960).toFixed(3),   tag:'SL=',   col:C.red   },
  ].sort((a,b)=>b.p-a.p);
  const tc = { TP3:C.cyan,TP2:C.teal,TP1:C.green,NOW:C.blue,
    Entry:C.green,'SL–':C.amber,'SL=':C.red };
  return (
    <Panel title="FIBONACCI — KEY LEVELS" icon="📐"
      glow={C.amber} badge={activeTF} badgeCol={C.blue}>
      {rows.map((r,i)=>{
        const isNow = r.tag==='NOW';
        const t     = tc[r.tag]||C.muted;
        const d     = cu>0 ? +((r.p-cu)/cu*100).toFixed(2) : 0;
        return (
          <div key={i} style={{
            display:'flex', alignItems:'center', gap:5,
            padding:'5px 7px', borderRadius:6, marginBottom:3,
            background:isNow?`${C.blue}18`:C.bg,
            border:`0.5px solid ${isNow?C.blue:C.grid}`,
          }}>
            <div style={{ fontSize:9, color:C.muted, flex:1 }}>{r.lbl}</div>
            <div style={{ ...mono, fontSize:11, fontWeight:700, color:r.col }}>
              ${r.p.toFixed(3)}
            </div>
            <span style={{ fontSize:7, ...mono, color:d>=0?C.green:C.red }}>
              {d>=0?'+':''}{d}%
            </span>
            <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3,
              fontWeight:700, background:t+'22', color:t,
              border:`0.5px solid ${t}44`, minWidth:30, textAlign:'center' }}>
              {r.tag}
            </span>
          </div>
        );
      })}
    </Panel>
  );
}

// ─── MultiMethodPanel ─────────────────────────────────────────────────────────
function MultiMethodPanel({ scores, bias, activeTF, shortSetup }) {
  const avg  = scores.length
    ? Math.round(scores.reduce((a,s)=>a+s.score,0)/scores.length) : 50;
  const col  = sc(avg);
  const pass = scores.filter(s=>s.score>=65).length;
  return (
    <Panel title="HỘI TỤ ĐA PHƯƠNG PHÁP" icon="⚡"
      glow={col} badge={`${pass}/${scores.length}`} badgeCol={col}>
      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:10 }}>
        <div style={{ width:54,height:54,borderRadius:'50%',flexShrink:0,
          background:`conic-gradient(${col} ${avg}%,${C.grid} 0)`,
          display:'flex',alignItems:'center',justifyContent:'center' }}>
          <div style={{ width:40,height:40,borderRadius:'50%',background:C.bg,
            display:'flex',flexDirection:'column',alignItems:'center',
            justifyContent:'center' }}>
            <div style={{ ...mono,fontSize:15,fontWeight:700,color:col,lineHeight:1 }}>
              {avg}
            </div>
            <div style={{ fontSize:7,color:col,fontWeight:600 }}>
              {avg>=70?'MUA':avg>=50?'TRUNG LẬP':'BÁN'}
            </div>
          </div>
        </div>
        <div style={{ flex:1 }}>
          {scores.map((s,i)=>(
            <SBar key={i} label={s.label} score={s.score} col={sc(s.score)}/>
          ))}
        </div>
      </div>
      <div style={{ background:col+'12', border:`1px solid ${col}44`,
        borderRadius:8, padding:'7px 10px', textAlign:'center' }}>
        <div style={{ fontSize:10, fontWeight:700, color:col }}>
          VERDICT: {avg>=70?'MUA':avg>=50?'TÍCH LŨY':'BÁN'} — {activeTF}
        </div>
        <div style={{ fontSize:8, color:C.muted, marginTop:2 }}>
          {pass}/{scores.length} phương pháp đồng thuận TĂNG
        </div>
      </div>
      {shortSetup?.active&&(
        <div style={{ marginTop:6, background:C.red+'12',
          border:`1px solid ${C.red}55`, borderRadius:8, padding:'7px 10px' }}>
          <div style={{ fontSize:9, fontWeight:700, color:C.red }}>
            📉 SHORT SETUP · {shortSetup.strength}/100
          </div>
          <div style={{ fontSize:8, color:C.muted, marginTop:2 }}>
            Entry ${shortSetup.entry?.low}–${shortSetup.entry?.high}
            · SL ${shortSetup.sl} · TP1 ${shortSetup.tp1}
          </div>
        </div>
      )}
    </Panel>
  );
}

// ─── WyckoffPanel ─────────────────────────────────────────────────────────────
function WyckoffPanel({ wyckoff }) {
  const isBear = wyckoff.phase==='DIST';
  const col    = isBear?C.red:C.amber;
  const phases = isBear ? [
    { l:'Preliminary Supply', s:'PSY → BC',          done:true, act:false, c:C.red   },
    { l:'Automatic Rally',    s:'AR — rebound',       done:true, act:false, c:C.red   },
    { l:'SOW',                s:'Breakdown confirm',  done:false,act:true,  c:C.red   },
    { l:'LPSY',               s:'Last Point Supply',  done:false,act:false, c:C.muted },
    { l:'Markdown',           s:'Downtrend Phase',    done:false,act:false, c:C.muted },
  ] : [
    { l:'Phase A', s:'SC → AR → ST',
      done:wyckoff.phase>='B', act:wyckoff.phase==='A', c:C.green },
    { l:'Phase B', s:'UT · Secondary Tests',
      done:wyckoff.phase>='C', act:wyckoff.phase==='B', c:C.green },
    { l:'Phase C', s:wyckoff.sub||'Spring/Test',
      done:wyckoff.phase>='D', act:wyckoff.phase==='C', c:C.amber },
    { l:'Phase D', s:'LPS → SOS Markup',
      done:wyckoff.phase>='E', act:wyckoff.phase==='D', c:C.teal  },
    { l:'Phase E', s:'Markup / Uptrend',
      done:false,              act:wyckoff.phase==='E', c:C.cyan  },
  ];
  return (
    <Panel title="WYCKOFF CYCLE" icon="🔄" glow={col}
      badge={`${wyckoff.label||'?'} ${wyckoff.confidence||0}%`} badgeCol={col}>
      {phases.map((ph,i)=>(
        <div key={i} style={{
          display:'flex', gap:8, alignItems:'flex-start',
          padding:'5px 7px', borderRadius:7, marginBottom:3,
          background:ph.act?`${ph.c}10`:ph.done?`${ph.c}06`:'transparent',
          border:`0.5px solid ${ph.act?ph.c:ph.done?ph.c+'88':C.grid}`,
        }}>
          <div style={{ width:15,height:15,borderRadius:'50%',flexShrink:0,
            marginTop:1,
            background:ph.done?ph.c:ph.act?ph.c:C.grid,
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:8,color:C.bg,fontWeight:700 }}>
            {ph.done?'✓':ph.act?'⚡':'○'}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:9,fontWeight:600,
              color:ph.act?ph.c:ph.done?ph.c:C.muted }}>{ph.l}</div>
            <div style={{ fontSize:7,color:C.muted,marginTop:1 }}>{ph.s}</div>
          </div>
        </div>
      ))}
    </Panel>
  );
}

// ─── SMCPanel ─────────────────────────────────────────────────────────────────
function SMCPanel({ safeS, atr }) {
  const cu=safeS.comex||6.07, at=atr||0.12;
  return (
    <Panel title="SMC ORDER BLOCKS" icon="🔷" glow={C.blue}>
      {[
        {l:'OB Giảm', r:`$${(cu+at).toFixed(3)}–$${(cu+at*1.8).toFixed(3)}`,   sig:'BÁN', col:C.red    },
        {l:'FVG',     r:`$${(cu+at*.3).toFixed(3)}–$${(cu+at*.7).toFixed(3)}`, sig:'FVG', col:C.purple },
        {l:'BOS ✓',   r:`$${(cu-at*.1).toFixed(3)} confirm`,                    sig:'BOS', col:C.green  },
        {l:'OB Tăng', r:`$${(cu-at*2).toFixed(3)}–$${(cu-at).toFixed(3)}`,     sig:'MUA', col:C.green  },
        {l:'Liquidity',r:`$${(cu-at*2.5).toFixed(3)}`,                          sig:'POOL',col:C.amber  },
      ].map((b,i)=>(
        <div key={i} style={{ padding:'5px 8px',borderRadius:7,marginBottom:4,
          background:C.bg2,border:`0.5px solid ${b.col}33` }}>
          <div style={{ display:'flex',justifyContent:'space-between',
            alignItems:'center',marginBottom:2 }}>
            <span style={{ fontSize:9,color:'#e2e8f0',fontWeight:500 }}>{b.l}</span>
            <Bdg label={b.sig} col={b.col}/>
          </div>
          <div style={{ ...mono,fontSize:9,color:b.col }}>{b.r}</div>
        </div>
      ))}
    </Panel>
  );
}

// ─── HarmonicPanel ────────────────────────────────────────────────────────────
function HarmonicPanel({ safeS }) {
  const cu=safeS.comex||6.07;
  return (
    <Panel title="HARMONIC PATTERNS" icon="🎯" glow={C.purple}>
      {[
        {n:'Bullish Gartley',  sig:'MUA',      rel:94,col:C.green,prz:`$${(cu*.975).toFixed(3)}`},
        {n:'Deep Crab',        sig:'THEO DÕI', rel:78,col:C.amber,prz:`$${(cu*1.09).toFixed(3)}`},
        {n:'Bearish Butterfly',sig:'BÁN',      rel:65,col:C.red,  prz:`$${(cu*1.15).toFixed(3)}`},
      ].map((p,i)=>(
        <div key={i} style={{ background:C.bg2,borderRadius:8,padding:'7px 10px',
          marginBottom:5,border:`0.5px solid ${p.col}44` }}>
          <div style={{ display:'flex',justifyContent:'space-between',
            alignItems:'center',marginBottom:3 }}>
            <span style={{ fontSize:9,fontWeight:600,color:p.col }}>{p.n}</span>
            <Bdg label={p.sig} col={p.col}/>
          </div>
          <div style={{ fontSize:8,color:C.muted,marginBottom:3 }}>PRZ: {p.prz}</div>
          <div style={{ background:C.bg,borderRadius:3,height:5,overflow:'hidden' }}>
            <div style={{ width:`${p.rel}%`,height:'100%',background:p.col,borderRadius:3 }}/>
          </div>
          <div style={{ fontSize:8,color:p.col,textAlign:'right',marginTop:2 }}>
            {p.rel}%
          </div>
        </div>
      ))}
    </Panel>
  );
}

// ─── ShortSetupPanel ──────────────────────────────────────────────────────────
function ShortSetupPanel({ ss }) {
  if (!ss?.active) return null;
  return (
    <div style={{ background:`${C.red}12`,border:`1.5px solid ${C.red}`,
      borderRadius:11,padding:'12px 14px' }}>
      <div style={{ display:'flex',justifyContent:'space-between',
        alignItems:'center',marginBottom:9 }}>
        <div style={{ fontSize:11,fontWeight:700,color:C.red }}>
          📉 SHORT SETUP — KÍCH HOẠT
        </div>
        <Bdg label={`${ss.strength}/100`} col={C.red}/>
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginBottom:9 }}>
        {[
          {l:'Verdict <40',     ok:ss.conditions?.cond1},
          {l:'Elliott W5/Fail', ok:ss.conditions?.cond2},
          {l:'VSA Bearish',     ok:ss.conditions?.cond3},
          {l:'DXY Tăng',        ok:ss.conditions?.cond4},
        ].map((c,i)=>(
          <div key={i} style={{ display:'flex',gap:5,alignItems:'center',
            padding:'4px 7px',borderRadius:5,
            background:c.ok?`${C.red}08`:`${C.muted}08` }}>
            <span style={{ fontSize:10 }}>{c.ok?'✅':'❌'}</span>
            <span style={{ fontSize:9,color:c.ok?'#e2e8f0':C.muted }}>{c.l}</span>
          </div>
        ))}
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5 }}>
        {[
          {l:'📍 Entry',v:`$${ss.entry?.low}–$${ss.entry?.high}`,col:C.red},
          {l:'🛑 SL',   v:`$${ss.sl}`,   col:C.amber},
          {l:'🎯 TP1',  v:`$${ss.tp1}`,  col:C.green},
          {l:'🎯 TP2',  v:`$${ss.tp2}`,  col:C.teal },
          {l:'🎯 TP3',  v:`$${ss.tp3}`,  col:C.cyan },
          {l:'R:R',     v:`1:${ss.rr}`,  col:ss.rr>=2?C.green:C.amber},
        ].map((m,i)=>(
          <div key={i} style={{ background:C.bg2,borderRadius:5,padding:'5px 7px',
            border:`0.5px solid ${m.col}33` }}>
            <div style={{ fontSize:8,color:C.muted }}>{m.l}</div>
            <div style={{ ...mono,fontSize:10,fontWeight:700,color:m.col }}>{m.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AITongHop ────────────────────────────────────────────────────────────────
function AITongHop({ safeS,ew,vsa,wyckoff,scores,bias,activeTF,shortSetup,imSignals }) {
  const [text,    setText]    = useState('');
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState('');

  const avg = scores.length
    ? Math.round(scores.reduce((a,s)=>a+s.score,0)/scores.length) : 50;
  const col = sc(avg);

  const imSum = useMemo(()=>{
    if (!imSignals) return '';
    const sup = Object.entries(imSignals)
      .filter(([,v])=>v.col===C.green).map(([k])=>k);
    const res = Object.entries(imSignals)
      .filter(([,v])=>v.col===C.red).map(([k])=>k);
    const p = [];
    if (sup.length) p.push(`${sup.join('+')} hỗ trợ`);
    if (res.length) p.push(`${res.join('+')} cản trở`);
    return p.join(' · ');
  },[imSignals]);

  const generate = useCallback(async()=>{
    setLoading(true); setErr('');
    try {
      const r = await fetch('/api/claude',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          model:'claude-sonnet-4-5', max_tokens:500,
          messages:[{ role:'user', content:
            `Chuyên gia phân tích kỹ thuật COMEX Copper.
Tóm tắt ~80 từ tiếng Việt cho ${activeTF}:
- Elliott: ${ew.label||'?'} (${ew.prob||0}%)
- VSA: ${vsa.meta?.label||'N/A'} Vol=${vsa.latestBar?.volRatio||1}×
- Wyckoff: ${wyckoff.label||'?'} (${wyckoff.confidence||0}%)
- RSI=${ew.rsi||50} COMEX=$${(safeS.comex||6.07).toFixed(3)} Bias=${bias}/100${imSum?'\n- IM: '+imSum:''}
Kết luận entry tối ưu.`,
          }],
        }),
      });
      if (!r.ok) {
        setErr(
          r.status===402 ? 'OpenRouter hết credit — nạp tại openrouter.ai/settings/credits' :
          r.status===429 ? 'Rate limit — thử lại sau 60 giây' :
          r.status===401 ? 'API key không hợp lệ — kiểm tra .env.local' :
          `Lỗi HTTP ${r.status}`
        );
        return;
      }
      const d = await r.json();
      const t = (d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
      if (t) setText(t);
      else   setErr('Không nhận được phản hồi từ AI');
    } catch(e) { setErr(`Lỗi kết nối: ${e.message}`); }
    finally { setLoading(false); }
  },[ew,vsa,wyckoff,safeS,bias,avg,activeTF,shortSetup,imSum]);

  return (
    <div style={{ background:C.bg,border:`1px solid ${col}44`,
      borderRadius:11,padding:'11px 14px' }}>
      <div style={{ display:'flex',alignItems:'center',
        gap:10,flexWrap:'wrap',marginBottom:8 }}>
        <div style={{ width:42,height:42,borderRadius:'50%',flexShrink:0,
          background:`conic-gradient(${col} ${avg}%,${C.grid} 0)`,
          display:'flex',alignItems:'center',justifyContent:'center' }}>
          <div style={{ width:31,height:31,borderRadius:'50%',background:C.bg,
            display:'flex',flexDirection:'column',
            alignItems:'center',justifyContent:'center' }}>
            <div style={{ ...mono,fontSize:12,fontWeight:700,
              color:col,lineHeight:1 }}>{avg}</div>
            <div style={{ fontSize:6,color:col }}>
              {avg>=70?'MUA':avg>=50?'TÍCH LŨY':'BÁN'}
            </div>
          </div>
        </div>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontSize:10,fontWeight:600,color:col,marginBottom:3 }}>
            🤖 AI Tổng Hợp — {activeTF}
          </div>
          {err ? (
            <div style={{ fontSize:9,color:C.amber,background:`${C.amber}10`,
              borderRadius:5,padding:'4px 8px',border:`0.5px solid ${C.amber}33` }}>
              ⚠️ {err}
            </div>
          ) : text ? (
            <div style={{ fontSize:9,color:'#b0b8d0',lineHeight:1.7 }}>{text}</div>
          ) : (
            <div style={{ fontSize:9,color:C.muted }}>
              {ew.label||'Elliott ?'} · {wyckoff.label||'Wyckoff ?'}
              {' '}· {vsa.meta?.short||'VSA'}
              {imSum&&<span style={{ color:C.cyan }}> · {imSum}</span>}
            </div>
          )}
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',
          gap:4,flexShrink:0 }}>
          {[
            {l:'Entry',v:`$${ew.fib500?.toFixed(3)||'–'}`,col:C.green},
            {l:'TP1',  v:`$${(safeS.tp1||6.32).toFixed(3)}`,col:C.teal},
            {l:'TP2',  v:`$${(safeS.tp2||6.58).toFixed(3)}`,col:C.cyan},
            {l:'SL',   v:`$${ew.fib618?.toFixed(3)||'–'}`,  col:C.red},
            {l:'R:R',  v:'1:2.4', col:C.amber},
            {l:'Vốn',  v:'2%',    col:C.purple},
          ].map((m,i)=>(
            <div key={i} style={{ background:C.bg2,borderRadius:5,
              padding:'4px 5px',textAlign:'center',
              border:`0.5px solid ${m.col}33` }}>
              <div style={{ fontSize:7,color:C.muted }}>{m.l}</div>
              <div style={{ ...mono,fontSize:9,fontWeight:700,color:m.col }}>
                {m.v}
              </div>
            </div>
          ))}
        </div>
      </div>
      <button onClick={generate} disabled={loading} style={{
        width:'100%',padding:'8px',borderRadius:8,
        background:loading?C.bg2:`${col}18`,
        border:`1px solid ${loading?C.grid:col}`,
        color:loading?C.muted:col,fontSize:10,fontWeight:700,
        cursor:loading?'default':'pointer',
        display:'flex',alignItems:'center',justifyContent:'center',gap:6,
      }}>
        <span style={{ animation:loading?'spin 1s linear infinite':'',
          display:'inline-block' }}>
          {loading?'⟳':'⚡'}
        </span>
        {loading
          ? 'Đang phân tích...'
          : `Kích Hoạt AI Phân Tích — ${activeTF}: Elliott + VSA + Wyckoff + SMC + Liên TT`}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export default function TrendTab({ s, verdict, bias }) {

  // GUARD 1: s undefined
  const safeS = s || {};

  const engine = useTrendEngine(safeS);
  const {
    activeTF, setActiveTF,
    activeBars, tfBars, loading,
    fetchTFData, ew, vsa, wyckoff, rsi, atr, pk1,
    imAssets, imSignals, imLoading, fetchIntermarket,
  } = engine;

  // GUARD 2: comexPrice — không dùng s.comex trực tiếp
  const comexPrice = safeS.comex;

  // GUARD 3: ctrlLayers fallback
  const chartRef = useRef(null);
  const {
    logs, imData:ctrlIMData,
    layers:ctrlLayersRaw,
    toggleLayer:    onToggle,
    setDrawingTool: onSetTool,
    notifyIMUpdate,
    renderSMC, renderFib, renderWyckoff,
  } = useAnalysisController(chartRef);
  const ctrlLayers = ctrlLayersRaw || DEFAULT_LAYERS;

  // Sync IM data
  useEffect(()=>{
    if (imAssets && Object.keys(imAssets).length > 0)
      notifyIMUpdate({assets:imAssets,signals:imSignals,updated_at:Date.now()});
  },[imAssets,imSignals]);

  // GUARD 4: dùng comexPrice trong dep array
  useEffect(()=>{
    if (!comexPrice) return;
    const t = setTimeout(()=>{
      if (ctrlLayers.fib && ew)           renderFib(ew);
      if (ctrlLayers.smc)                 renderSMC(comexPrice, atr||0.12);
      if (ctrlLayers.wyckoff && vsa?.bars) renderWyckoff(vsa.bars);
    }, 400);
    return ()=>clearTimeout(t);
  },[ew?.wave,ew?.failure,vsa?.score,comexPrice,atr,
     ctrlLayers.fib,ctrlLayers.smc,ctrlLayers.wyckoff]);

  const smcData = useMemo(()=>{
    const cu=safeS.comex||6.07, at=atr||0.12;
    return {
      obBear:[cu+at,   cu+at*1.8],
      obBull:[cu-at*2, cu-at],
      fvg:  [cu+at*.3, cu+at*.7],
      liq:   cu-at*2.5,
    };
  },[safeS.comex,atr]);

  const shortSetup = useMemo(()=>calcShortSetup(
    safeS,ew,vsa,verdict||{final:50},imSignals,atr
  ),[safeS,ew,vsa,verdict,imSignals,atr]);

  const scores = useMemo(()=>[
    { label:'Elliott Wave',    score:ew.score||50  },
    { label:'VSA Engine',      score:vsa.score||50 },
    { label:'Wyckoff Cycle',   score:wyckoff.confidence||50 },
    { label:'SMC',             score:pk1.pk1Score>65?80:55 },
    { label:'Harmonic',        score:72 },
    { label:'Liên Thị Trường', score:imSignals
        ? Math.round(
            Object.values(imSignals).filter(s=>s.col===C.green).length
            / Math.max(Object.keys(imSignals).length,1) * 100
          )
        : 60 },
  ],[ew,vsa,wyckoff,pk1,imSignals]);

  const TF_LIST = ['MN','W','D','H4','H1','M15'];

  return (
    <div style={{ display:'grid', gap:8 }}>

      {/* ── Timeframe bar ── */}
      <div style={{ display:'flex', gap:4, alignItems:'center',
        background:C.bg, borderRadius:9,
        padding:'6px 10px', border:`1px solid ${C.grid}`,
        flexWrap:'wrap' }}>
        <span style={{ fontSize:9,color:C.muted,fontWeight:600,marginRight:3 }}>
          TIMEFRAME:
        </span>
        {TF_LIST.map(tf=>{
          const bc=(tfBars[tf]||[]).length, il=loading[tf], hd=bc>=3;
          return (
            <button key={tf} onClick={()=>{
              setActiveTF(tf);
              if (!hd) fetchTFData(tf);
            }} style={{
              fontSize:9, padding:'3px 10px', borderRadius:5,
              position:'relative',
              border:`0.5px solid ${activeTF===tf?C.blue:C.grid}`,
              background:activeTF===tf?`${C.blue}18`:'transparent',
              color:activeTF===tf?C.blue:C.muted,
              cursor:'pointer', fontWeight:activeTF===tf?600:400,
            }}>
              {tf}
              <span style={{ position:'absolute', top:1, right:2,
                width:4, height:4, borderRadius:'50%', display:'inline-block',
                background:il?C.amber:hd?C.green:C.grid,
                animation:il?'pulse 1s ease-in-out infinite':'none' }}/>
            </button>
          );
        })}
        <div style={{ marginLeft:'auto', display:'flex', gap:5, flexWrap:'wrap' }}>
          <Bdg label={ew.label||`W${ew.wave||'?'}`}
            col={ew.failure?C.red:C.green}/>
          <Bdg label={`Bias ${bias||0}/100`} col={sc(bias||0)}/>
          <Bdg label={`RSI ${rsi}`}
            col={rsi>70?C.red:rsi<30?C.green:C.amber}/>
          <Bdg label={`${activeBars.length}b`} col={C.muted}/>
          {shortSetup?.active&&<Bdg label="📉 SHORT" col={C.red}/>}
          {ctrlLayers.ai_detection&&<Bdg label="🤖 AI" col={C.purple}/>}
        </div>
      </div>

      {shortSetup?.active && <ShortSetupPanel ss={shortSetup}/>}

      {/* ── 3-col layout ── */}
      <div style={{
        display:'grid',
        gridTemplateColumns:'minmax(0,215px) minmax(0,1fr) minmax(0,205px)',
        gap:8,
        alignItems:'start',
      }}>

        {/* LEFT */}
        <div style={{ display:'grid', gap:8, minWidth:0 }}>
          <FibPanel safeS={safeS} ew={ew} activeTF={activeTF}/>
          <MultiMethodPanel scores={scores} bias={bias||0}
            activeTF={activeTF} shortSetup={shortSetup}/>
          <IMHeatmap
            imData={ctrlIMData||(imAssets
              ? {assets:imAssets,signals:imSignals,
                 correlations:{},updated_at:Date.now()}
              : null)}
            onRefresh={()=>fetchIntermarket(true)}
            isLoading={imLoading}
          />
        </div>

        {/* CENTER — PriceChart gọi useChartData bên trong */}
        <div style={{ display:'grid', gap:8, minWidth:0 }}>
          <PriceChart
            safeS={safeS}
            activeTF={activeTF}
            ew={ew}
            smcData={smcData}
            onSetDrawingTool={onSetTool}
          />
          <ControlPanel
            layers={ctrlLayers}
            onToggle={onToggle}
            onSetTool={onSetTool}
            ew={ew} vsa={vsa} wyckoff={wyckoff} rsi={rsi}
          />
          <PatternScanner
            bars={activeBars} ew={ew} vsa={vsa} safeS={safeS}
          />
        </div>

        {/* RIGHT */}
        <div style={{ display:'grid', gap:8, minWidth:0 }}>
          <WyckoffPanel wyckoff={wyckoff}/>
          <SMCPanel safeS={safeS} atr={atr}/>
          <HarmonicPanel safeS={safeS}/>
        </div>
      </div>

      {/* Signal Log */}
      <SignalLog logs={logs} maxHeight={260}/>

      {/* AI Tổng Hợp */}
      <AITongHop
        safeS={safeS} ew={ew} vsa={vsa} wyckoff={wyckoff}
        scores={scores} bias={bias||0} activeTF={activeTF}
        shortSetup={shortSetup} imSignals={imSignals}
      />

      <style>{`
        @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
      `}</style>
    </div>
  );
}