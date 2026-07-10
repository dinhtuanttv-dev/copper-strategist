// ─── TrendTab v4 — Command Center: Drawing + AI + Log + IM Heatmap ────────────
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTrendEngine, TF_CONFIG, TFS } from '../hooks/useTrendEngine';
import { useChartData }                   from '../hooks/useChartData';
import { useAnalysisController }          from '../hooks/useAnalysisController';
import { calcShortSetup }                 from '../lib/calculations';
import TVChart                            from './TVChart';
import SignalLog                          from './SignalLog';
import IMHeatmap                          from './IMHeatmap';

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b',
  blue:'#3b82f6', teal:'#14b8a6', purple:'#8b5cf6',
  orange:'#f97316', cyan:'#06b6d4', muted:'#5a7090',
};
const mono = { fontFamily:'monospace' };
const sc   = v => v>=70?C.green:v>=50?C.amber:C.red;

// ─── Micro components ─────────────────────────────────────────────────────────
function Panel({ title, icon, glow, children, badge, badgeCol, topRight }) {
  return (
    <div style={{ background:'#060d18', border:`1px solid ${glow||'#1e3050'}`,
      borderRadius:11, padding:'11px 13px',
      boxShadow:glow?`0 0 14px ${glow}14`:'none' }}>
      <div style={{ display:'flex', justifyContent:'space-between',
        alignItems:'center', marginBottom:9, flexWrap:'wrap', gap:5 }}>
        <div style={{ fontSize:10, fontWeight:600, color:'#e2e8f0',
          display:'flex', alignItems:'center', gap:5 }}>
          {icon&&<span style={{ fontSize:13 }}>{icon}</span>}{title}
        </div>
        <div style={{ display:'flex', gap:5, alignItems:'center' }}>
          {badge&&<Bdg label={badge} col={badgeCol||C.blue}/>}
          {topRight}
        </div>
      </div>
      {children}
    </div>
  );
}

function Bdg({ label, col, size=8 }) {
  return (
    <span style={{ fontSize:size, padding:'2px 7px', borderRadius:4,
      fontWeight:700, background:col+'22', color:col,
      border:`0.5px solid ${col}44`, whiteSpace:'nowrap' }}>{label}</span>
  );
}

function SBar({ label, score, col, width=80 }) {
  const c = col||sc(score);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
      <span style={{ fontSize:9, color:C.muted, width, flexShrink:0 }}>{label}</span>
      <div style={{ flex:1, background:'#0f1e30', borderRadius:2,
        height:5, overflow:'hidden' }}>
        <div style={{ width:`${score}%`, height:'100%', background:c,
          borderRadius:2, transition:'width .5s' }} />
      </div>
      <span style={{ fontSize:9, fontWeight:700, color:c,
        width:22, textAlign:'right' }}>{score}</span>
    </div>
  );
}

// ─── Toggle Switch component ───────────────────────────────────────────────────
function ToggleSwitch({ label, active, onChange, col, small }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between',
      alignItems:'center', marginBottom:small?4:6 }}>
      <span style={{ fontSize:small?8:9, color:active?'#e2e8f0':C.muted }}>
        {label}
      </span>
      <div onClick={()=>onChange(!active)} style={{
        width:28, height:14, borderRadius:7, position:'relative',
        cursor:'pointer', flexShrink:0, transition:'background .2s',
        background:active?(col||C.green)+'44':'#1e3050',
        border:`0.5px solid ${active?(col||C.green):'#1e3050'}`,
      }}>
        <div style={{
          width:10, height:10, borderRadius:'50%', position:'absolute',
          top:1, transition:'left .2s, background .2s',
          left:active?16:2,
          background:active?(col||C.green):C.muted,
        }}/>
      </div>
    </div>
  );
}

// ─── 1. Fib + Key Levels ──────────────────────────────────────────────────────
function FibPanel({ s, ew, activeTF }) {
  const cu = s.comex||6.07;
  const levels = [
    {lbl:'Fib 1.618 — TP3', price:ew.w3Target||+(cu*1.10).toFixed(3), tag:'TP3', col:C.cyan},
    {lbl:'Fib 1.272 — TP2', price:s.tp2||+(cu*1.058).toFixed(3),      tag:'TP2', col:C.teal},
    {lbl:'Fib 1.000 — TP1', price:s.tp1||+(cu*1.025).toFixed(3),      tag:'TP1', col:C.green},
    {lbl:'▶ Giá Hiện Tại',  price:cu,                                  tag:'NOW', col:C.blue},
    {lbl:'Fib 0.500 — Entry',price:ew.fib500||+(cu*0.985).toFixed(3), tag:'Entry',col:C.green},
    {lbl:'Fib 0.618 — SL–', price:ew.fib618||+(cu*0.975).toFixed(3),  tag:'SL–', col:C.amber},
    {lbl:'Fib 0.786 — SL=', price:ew.fib786||+(cu*0.960).toFixed(3),  tag:'SL=', col:C.red},
  ].sort((a,b)=>b.price-a.price);

  const tagCol = {TP3:C.cyan,TP2:C.teal,TP1:C.green,NOW:C.blue,
    Entry:C.green,'SL–':C.amber,'SL=':C.red};

  return (
    <Panel title="FIBONACCI — KEY LEVELS" icon="📐"
      glow={C.amber} badge={activeTF} badgeCol={C.blue}>
      {levels.map((lv,i)=>{
        const isNow = lv.tag==='NOW';
        const tc    = tagCol[lv.tag]||C.muted;
        const dist  = cu>0?+((lv.price-cu)/cu*100).toFixed(2):0;
        return (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:5,
            padding:'5px 7px', borderRadius:6, marginBottom:3,
            background:isNow?`${C.blue}18`:'#060d18',
            border:`0.5px solid ${isNow?C.blue:'#1e3050'}` }}>
            <div style={{ fontSize:9, color:C.muted, flex:1 }}>{lv.lbl}</div>
            <div style={{ ...mono, fontSize:11, fontWeight:700, color:lv.col }}>
              ${lv.price.toFixed(3)}
            </div>
            <span style={{ fontSize:7,...mono,color:dist>=0?C.green:C.red }}>
              {dist>=0?'+':''}{dist}%
            </span>
            <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3,
              fontWeight:700, background:tc+'22', color:tc,
              border:`0.5px solid ${tc}44`, minWidth:30, textAlign:'center' }}>
              {lv.tag}
            </span>
          </div>
        );
      })}
    </Panel>
  );
}

// ─── 2. Multi-method score ────────────────────────────────────────────────────
function MultiMethodPanel({ scores, verdict, bias, activeTF, shortSetup }) {
  const avg  = scores.length
    ? Math.round(scores.reduce((a,s2)=>a+s2.score,0)/scores.length)
    : 50;
  const col  = sc(avg);
  const pass = scores.filter(s2=>s2.score>=65).length;

  return (
    <Panel title="HỘI TỤ ĐA PHƯƠNG PHÁP" icon="⚡" glow={col}
      badge={`${pass}/${scores.length} đồng thuận`} badgeCol={col}>
      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:10 }}>
        <div style={{ width:56,height:56,borderRadius:'50%',
          background:`conic-gradient(${col} ${avg}%,#0f1e30 0)`,
          display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
          <div style={{ width:42,height:42,borderRadius:'50%',background:'#060d18',
            display:'flex',flexDirection:'column',alignItems:'center',
            justifyContent:'center' }}>
            <div style={{ ...mono,fontSize:16,fontWeight:700,color:col,lineHeight:1 }}>
              {avg}
            </div>
            <div style={{ fontSize:7,color:col,fontWeight:600 }}>
              {avg>=70?'MUA':avg>=50?'THEO DÕI':'BÁN'}
            </div>
          </div>
        </div>
        <svg width="54" height="54" viewBox="0 0 54 54">
          {(()=>{
            const cx=27,cy=27,R=22,n=scores.length;
            const pts=scores.map((sc2,i)=>{
              const a=(i/n)*Math.PI*2-Math.PI/2,f=sc2.score/100;
              return `${(cx+R*f*Math.cos(a)).toFixed(1)},${(cy+R*f*Math.sin(a)).toFixed(1)}`;
            }).join(' ');
            return (<>
              {[0.33,0.66,1].map((f,gi)=>(
                <polygon key={gi} fill="none" stroke="#1e3050"
                  strokeWidth={gi===2?0.8:0.4}
                  points={scores.map((_,i)=>{
                    const a=(i/n)*Math.PI*2-Math.PI/2;
                    return `${(cx+R*f*Math.cos(a)).toFixed(1)},${(cy+R*f*Math.sin(a)).toFixed(1)}`;
                  }).join(' ')}/>
              ))}
              {scores.map((_,i)=>{
                const a=(i/n)*Math.PI*2-Math.PI/2;
                return <line key={i} x1={cx} y1={cy} stroke="#1e3050"
                  strokeWidth={0.4}
                  x2={(cx+R*Math.cos(a)).toFixed(1)}
                  y2={(cy+R*Math.sin(a)).toFixed(1)}/>;
              })}
              <polygon points={pts} fill={`${col}28`}
                stroke={col} strokeWidth={1.5} strokeLinejoin="round"/>
            </>);
          })()}
        </svg>
      </div>

      {scores.map((sc2,i)=>(
        <SBar key={i} label={sc2.label} score={sc2.score} col={sc(sc2.score)}/>
      ))}

      <div style={{ marginTop:7,background:col+'12',border:`1px solid ${col}44`,
        borderRadius:8,padding:'7px 10px',textAlign:'center' }}>
        <div style={{ fontSize:10,fontWeight:700,color:col }}>
          VERDICT: {avg>=70?'MUA':avg>=50?'TÍCH LŨY':'BÁN'} — {activeTF}
        </div>
        <div style={{ fontSize:8,color:C.muted,marginTop:2 }}>
          {pass}/{scores.length} phương pháp đồng thuận TĂNG
        </div>
      </div>

      {shortSetup?.active&&(
        <div style={{ marginTop:6,background:C.red+'12',
          border:`1px solid ${C.red}55`,borderRadius:8,padding:'7px 10px' }}>
          <div style={{ fontSize:10,fontWeight:700,color:C.red,marginBottom:3 }}>
            📉 SHORT SETUP KÍCH HOẠT
          </div>
          <div style={{ fontSize:8,color:C.muted }}>
            {shortSetup.strength}/100 · Entry
            ${shortSetup.entry.low}–${shortSetup.entry.high}
          </div>
        </div>
      )}
    </Panel>
  );
}// ─── 3. PriceChart — TradingView + Drawing Palette ───────────────────────────
function PriceChart({ s, activeTF, ew, vsa,
  chartContainerRef, ctrlLayers, onToggleLayer, onSetDrawingTool }) {
  const { bars, loading, smcData, refresh, barCount } = useChartData(activeTF, s);
  const comexUp  = (s.comex_chg_pct||0)>=0;
  const [activeTool, setActiveTool] = useState(null);
  const [crosshairBar, setCrosshairBar] = useState(null);

  const handleToolClick = (tool) => {
    const next = activeTool===tool ? null : tool;
    setActiveTool(next);
    onSetDrawingTool(next);
  };

  return (
    <div style={{ background:'#060d18', border:'1px solid #1e3050',
      borderRadius:11, padding:'11px 13px' }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between',
        alignItems:'center', marginBottom:7, flexWrap:'wrap', gap:5 }}>
        <div style={{ display:'flex', gap:7, alignItems:'center' }}>
          <span style={{ fontSize:11, fontWeight:600, color:'#e2e8f0' }}>
            ⚡ ĐỒNG COMEX — {activeTF}
          </span>
          {loading
            ? <Bdg label="⟳ Đang tải..." col={C.amber}/>
            : barCount<5
            ? <Bdg label="Chưa đủ dữ liệu" col={C.red}/>
            : <Bdg label={ew?.label||`W${ew?.wave}`}
                col={ew?.failure?C.red:C.green}/>
          }
          {ew?.w3Target>0&&!ew?.failure&&(
            <Bdg label={`TP $${ew.w3Target}`} col={C.amber}/>
          )}
        </div>
        <div style={{ display:'flex', gap:7, alignItems:'center' }}>
          {crosshairBar&&(
            <div style={{ display:'flex', gap:5, fontSize:9,
              ...mono, color:C.muted }}>
              <span style={{ color:'#e2e8f0' }}>
                O:{crosshairBar.open?.toFixed(3)}
              </span>
              <span style={{ color:C.green }}>
                H:{crosshairBar.high?.toFixed(3)}
              </span>
              <span style={{ color:C.red }}>
                L:{crosshairBar.low?.toFixed(3)}
              </span>
              <span style={{
                color:crosshairBar.close>=(crosshairBar.open||0)
                  ?C.green:C.red }}>
                C:{crosshairBar.close?.toFixed(3)}
              </span>
            </div>
          )}
          <span style={{ ...mono, fontSize:13, fontWeight:700,
            color:comexUp?C.green:C.red }}>
            ${(s.comex||0).toFixed(3)}
          </span>
          <span style={{ fontSize:9, color:comexUp?C.green:C.red }}>
            {comexUp?'▲':'▼'}{Math.abs(s.comex_chg_pct||0).toFixed(2)}%
          </span>
          <span style={{ fontSize:8, color:C.muted }}>{barCount}b</span>
          <button onClick={()=>refresh(true)} disabled={loading} style={{
            fontSize:8, padding:'2px 7px', borderRadius:4,
            border:'0.5px solid #1e3050', background:'transparent',
            color:C.muted, cursor:loading?'default':'pointer',
          }}>
            <span style={{ animation:loading?'spin 1s linear infinite':'' }}>
              {loading?'⟳':'↺'}
            </span>
          </button>
        </div>
      </div>

      {/* ── Drawing Palette ── */}
      <div style={{ display:'flex', gap:5, marginBottom:7,
        padding:'5px 8px', background:'#0a1520',
        borderRadius:7, border:'0.5px solid #1e3050',
        flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:8, color:C.muted, marginRight:2,
          flexShrink:0 }}>VẼ:</span>
        {[
          { tool:'trendline', icon:'/',      label:'Trendline', col:C.blue   },
          { tool:'rectangle', icon:'⬜',    label:'OB Zone',   col:C.amber  },
          { tool:'fibonacci', icon:'📐',    label:'Fibonacci', col:C.purple },
        ].map(btn=>(
          <button key={btn.tool} onClick={()=>handleToolClick(btn.tool)} style={{
            fontSize:8, padding:'2px 9px', borderRadius:4, cursor:'pointer',
            border:`0.5px solid ${activeTool===btn.tool?btn.col:'#1e3050'}`,
            background:activeTool===btn.tool?`${btn.col}18`:'transparent',
            color:activeTool===btn.tool?btn.col:C.muted,
            transition:'all 0.2s',
            display:'flex', alignItems:'center', gap:4,
          }}>
            <span>{btn.icon}</span> {btn.label}
          </button>
        ))}
        {activeTool&&(
          <button onClick={()=>handleToolClick(null)} style={{
            fontSize:8, padding:'2px 9px', borderRadius:4, cursor:'pointer',
            border:`0.5px solid ${C.red}`, background:`${C.red}12`,
            color:C.red, marginLeft:2,
          }}>✕ Huỷ</button>
        )}
        <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
          {[
            {key:'fib',    label:'Fib',    col:C.amber },
            {key:'smc',    label:'SMC',    col:C.blue  },
            {key:'wyckoff',label:'Wyckoff',col:C.purple},
          ].map(btn=>(
            <button key={btn.key} onClick={()=>onToggleLayer(btn.key,
              !ctrlLayers[btn.key])} style={{
              fontSize:7, padding:'1px 6px', borderRadius:3, cursor:'pointer',
              border:`0.5px solid ${ctrlLayers[btn.key]?btn.col:'#1e3050'}`,
              background:ctrlLayers[btn.key]?`${btn.col}18`:'transparent',
              color:ctrlLayers[btn.key]?btn.col:C.muted,
            }}>
              {ctrlLayers[btn.key]?'●':'○'} {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Drawing mode hint ── */}
      {activeTool&&(
        <div style={{ background:`${C.blue}10`, border:`0.5px solid ${C.blue}44`,
          borderRadius:6, padding:'4px 9px', marginBottom:6,
          fontSize:8, color:C.blue,
          display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ animation:'pulse 1s ease-in-out infinite' }}>✏️</span>
          Chế độ vẽ <b>{activeTool}</b> đang bật —
          click &amp; kéo trên biểu đồ, AI sẽ tự động phân tích
        </div>
      )}

      {/* ── TradingView chart ── */}
      <TVChart
        bars={bars} activeTF={activeTF} ew={ew} vsa={vsa}
        smcData={smcData}
        showFib={ctrlLayers.fib!==false}
        showSMC={ctrlLayers.smc!==false}
        showWyckoff={ctrlLayers.wyckoff!==false}
        showVolume={true}
        isLoading={loading}
        onCrosshair={setCrosshairBar}
        chartContainerRef={chartContainerRef}
      />

      <div style={{ textAlign:'center', fontSize:8, color:C.muted, marginTop:5 }}>
        TradingView Lightweight Charts · {activeTF} · {barCount} candles ·{' '}
        {loading?'Đang cập nhật...':'Yahoo Finance HG=F'}
        {activeTool&&(
          <span style={{ color:C.blue, marginLeft:6 }}>
            · ✏️ Đang vẽ {activeTool}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── 4. Control Panel — Toggle Switches + AI Master ───────────────────────────
function ControlPanel({ ctrlLayers, onToggleLayer, onSetDrawingTool,
  activeTF, ew, vsa, wyckoff, rsi }) {
  const [activeTool, setActiveTool] = useState(null);

  const handleTool = (tool) => {
    const next = activeTool===tool?null:tool;
    setActiveTool(next);
    onSetDrawingTool(next);
  };

  const toggleItems = [
    { key:'elliott',  label:'Elliott Wave',  col:C.blue   },
    { key:'vsa',      label:'VSA Engine',    col:C.green  },
    { key:'wyckoff',  label:'Wyckoff Cycle', col:C.amber  },
    { key:'smc',      label:'SMC',           col:C.teal   },
    { key:'harmonic', label:'Harmonic',      col:C.purple },
    { key:'fib',      label:'Fibonacci',     col:C.cyan   },
  ];

  return (
    <div style={{ background:'#060d18',
      border:`1px solid ${ctrlLayers.ai_detection?C.purple+'66':'#1e3050'}`,
      borderRadius:11, padding:'11px 13px' }}>

      {/* Header */}
      <div style={{ fontSize:10, fontWeight:600, color:'#e2e8f0',
        marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ fontSize:14 }}>🎛️</span>
        PHÂN TÍCH &amp; CÔNG CỤ AI
      </div>

      {/* Layer toggles */}
      <div style={{ fontSize:8, color:C.muted, marginBottom:6,
        fontWeight:600, letterSpacing:'.05em' }}>PHƯƠNG PHÁP BẬT/TẮT</div>

      {toggleItems.map(item=>(
        <ToggleSwitch key={item.key}
          label={item.label}
          active={ctrlLayers[item.key]!==false}
          onChange={v=>onToggleLayer(item.key,v)}
          col={item.col}
        />
      ))}

      {/* AI Detection master toggle */}
      <div style={{ background:ctrlLayers.ai_detection
          ?`${C.purple}12`:'#0a1520',
        border:`0.5px solid ${ctrlLayers.ai_detection?C.purple:'#1e3050'}`,
        borderRadius:8, padding:'8px 10px', marginTop:8, marginBottom:10 }}>
        <div style={{ display:'flex', justifyContent:'space-between',
          alignItems:'center' }}>
          <div>
            <div style={{ fontSize:10, fontWeight:600,
              color:ctrlLayers.ai_detection?C.purple:'#e2e8f0' }}>
              🤖 AI Detection
            </div>
            <div style={{ fontSize:8, color:C.muted, marginTop:1 }}>
              Phân tích tương quan đa lớp
            </div>
          </div>
          <ToggleSwitch label="" small
            active={ctrlLayers.ai_detection!==false}
            onChange={v=>onToggleLayer('ai_detection',v)}
            col={C.purple}
          />
        </div>
        {ctrlLayers.ai_detection&&(
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:5 }}>
            <Bdg label={`W${ew?.wave||'?'}`}
              col={ew?.failure?C.red:C.green}/>
            <Bdg label={`RSI ${rsi}`}
              col={rsi>70?C.red:rsi<30?C.green:C.amber}/>
            <Bdg label={wyckoff?.label?.replace('Phase ','')||'?'}
              col={C.amber}/>
          </div>
        )}
      </div>

      {/* Drawing tools */}
      <div style={{ borderTop:'0.5px solid #1e3050', paddingTop:9 }}>
        <div style={{ fontSize:8, color:C.muted, marginBottom:6,
          fontWeight:600, letterSpacing:'.05em' }}>CÔNG CỤ VẼ TƯƠNG TÁC</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
          {[
            { tool:'trendline', icon:'/',   label:'Trendline', col:C.blue   },
            { tool:'rectangle', icon:'⬜', label:'OB Zone',   col:C.amber  },
            { tool:'fibonacci', icon:'📐', label:'Fibonacci', col:C.purple },
            { tool:null,        icon:'✕',  label:'Reset',     col:C.red    },
          ].map((btn,i)=>(
            <button key={i} onClick={()=>handleTool(btn.tool)} style={{
              fontSize:8, padding:'5px 8px', borderRadius:6, cursor:'pointer',
              border:`0.5px solid ${activeTool===btn.tool
                ?(btn.col||C.red):'#1e3050'}`,
              background:activeTool===btn.tool
                ?`${btn.col||C.red}18`:'#0a1520',
              color:activeTool===btn.tool?(btn.col||C.red):C.muted,
              display:'flex', alignItems:'center', gap:5,
              transition:'all 0.2s',
            }}>
              <span style={{ fontSize:10 }}>{btn.icon}</span>
              {btn.label}
            </button>
          ))}
        </div>
        {activeTool&&(
          <div style={{ marginTop:6, fontSize:8, color:C.blue,
            background:`${C.blue}08`, borderRadius:5, padding:'4px 7px',
            border:`0.5px solid ${C.blue}33`,
            display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ animation:'pulse 1s ease-in-out infinite',
              fontSize:10 }}>✏️</span>
            Đang vẽ <b style={{ color:'#e2e8f0' }}>{activeTool}</b> —
            AI sẽ phân tích tự động
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 5. Wyckoff Panel (sidebar) ───────────────────────────────────────────────
function WyckoffPanel({ wyckoff }) {
  const isBear = wyckoff.phase==='DIST';
  const phases = isBear
    ? [
        {phase:'Preliminary Supply',sub:'PSY → BC',         done:true, active:false,col:C.red},
        {phase:'Automatic Rally',   sub:'AR — rebound',     done:true, active:false,col:C.red},
        {phase:'SOW (Sign of Weak)',sub:'Breakdown confirm', done:false,active:true, col:C.red},
        {phase:'LPSY',              sub:'Last Point Supply', done:false,active:false,col:C.muted},
        {phase:'Markdown',          sub:'Downtrend Phase',   done:false,active:false,col:C.muted},
      ]
    : [
        {phase:'Phase A',sub:'SC → AR → ST',     done:wyckoff.phase>='B',active:wyckoff.phase==='A',col:C.green},
        {phase:'Phase B',sub:'UT · Secondary',   done:wyckoff.phase>='C',active:wyckoff.phase==='B',col:C.green},
        {phase:'Phase C',sub:wyckoff.sub,         done:wyckoff.phase>='D',active:wyckoff.phase==='C',col:C.amber},
        {phase:'Phase D',sub:'LPS → SOS Markup', done:wyckoff.phase>='E',active:wyckoff.phase==='D',col:C.teal},
        {phase:'Phase E',sub:'Markup / Uptrend', done:false,             active:wyckoff.phase==='E',col:C.cyan},
      ];
  const col = isBear?C.red:C.amber;
  return (
    <Panel title="WYCKOFF CYCLE" icon="🔄" glow={col}
      badge={`${wyckoff.label} · ${wyckoff.confidence}%`} badgeCol={col}>
      {phases.map((ph,i)=>(
        <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start',
          padding:'6px 8px', borderRadius:7, marginBottom:3,
          background:ph.active?`${ph.col}10`:ph.done?`${ph.col}08`:'transparent',
          border:`0.5px solid ${ph.active?ph.col:ph.done?ph.col+'88':'#1e3050'}` }}>
          <div style={{ width:16,height:16,borderRadius:'50%',flexShrink:0,
            marginTop:1, background:ph.done?ph.col:ph.active?ph.col:'#1e3050',
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:9,color:'#060d18',fontWeight:700 }}>
            {ph.done?'✓':ph.active?'⚡':'○'}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:9,fontWeight:600,
              color:ph.active?ph.col:ph.done?ph.col:C.muted }}>{ph.phase}</div>
            <div style={{ fontSize:7,color:C.muted,marginTop:1 }}>{ph.sub}</div>
          </div>
        </div>
      ))}
    </Panel>
  );
}

// ─── 6. SMC Panel (sidebar) ───────────────────────────────────────────────────
function SMCPanel({ s }) {
  const cu  = s.comex||6.07;
  const atr = s.atr||0.12;
  return (
    <Panel title="SMC ORDER BLOCKS" icon="🔷" glow={C.blue}>
      {[
        {lbl:'OB Giảm',  range:`$${(cu+atr*1.0).toFixed(3)}–$${(cu+atr*1.8).toFixed(3)}`, sig:'BÁN',  col:C.red},
        {lbl:'FVG',      range:`$${(cu+atr*0.3).toFixed(3)}–$${(cu+atr*0.7).toFixed(3)}`, sig:'FVG',  col:C.purple},
        {lbl:'BOS ✓',    range:`$${(cu-atr*0.1).toFixed(3)} confirm`,                      sig:'BOS',  col:C.green},
        {lbl:'OB Tăng',  range:`$${(cu-atr*2.0).toFixed(3)}–$${(cu-atr*1.0).toFixed(3)}`, sig:'MUA',  col:C.green},
        {lbl:'Liquidity',range:`$${(cu-atr*2.5).toFixed(3)}`,                              sig:'POOL', col:C.amber},
      ].map((b,i)=>(
        <div key={i} style={{ padding:'6px 8px', borderRadius:7, marginBottom:4,
          background:'#0a1520', border:`0.5px solid ${b.col}33` }}>
          <div style={{ display:'flex', justifyContent:'space-between',
            alignItems:'center', marginBottom:2 }}>
            <span style={{ fontSize:9,color:'#e2e8f0',fontWeight:500 }}>{b.lbl}</span>
            <Bdg label={b.sig} col={b.col}/>
          </div>
          <div style={{ ...mono, fontSize:9, color:b.col }}>{b.range}</div>
        </div>
      ))}
    </Panel>
  );
}

// ─── 7. Harmonic Panel (sidebar) ─────────────────────────────────────────────
function HarmonicPanel({ s }) {
  const cu = s.comex||6.07;
  return (
    <Panel title="HARMONIC PATTERNS" icon="🎯" glow={C.purple}>
      {[
        {name:'Bullish Gartley', sig:'MUA',             rel:94,col:C.green,
         prz:`$${(cu*0.975).toFixed(3)}`},
        {name:'Deep Crab',       sig:'THEO DÕI',        rel:78,col:C.amber,
         prz:`$${(cu*1.090).toFixed(3)}`},
        {name:'Bearish Butterfly',sig:'BÁN (tiềm năng)',rel:65,col:C.red,
         prz:`$${(cu*1.150).toFixed(3)}`},
      ].map((p,i)=>(
        <div key={i} style={{ background:'#0a1520',borderRadius:8,
          padding:'8px 10px',marginBottom:5,
          border:`0.5px solid ${p.col}44` }}>
          <div style={{ display:'flex',justifyContent:'space-between',
            alignItems:'center',marginBottom:3 }}>
            <span style={{ fontSize:9,fontWeight:600,color:p.col }}>{p.name}</span>
            <Bdg label={p.sig} col={p.col}/>
          </div>
          <div style={{ fontSize:8,color:C.muted,marginBottom:3 }}>
            PRZ: {p.prz}
          </div>
          <div style={{ background:'#060d18',borderRadius:3,
            height:5,overflow:'hidden' }}>
            <div style={{ width:`${p.rel}%`,height:'100%',
              background:p.col,borderRadius:3 }}/>
          </div>
          <div style={{ fontSize:8,color:p.col,textAlign:'right',marginTop:2 }}>
            {p.rel}%
          </div>
        </div>
      ))}
    </Panel>
  );
}// ─── 8. Short Setup Panel ─────────────────────────────────────────────────────
function ShortSetupPanel({ shortSetup }) {
  if (!shortSetup?.active) return null;
  return (
    <div style={{ background:`${C.red}12`,
      border:`1.5px solid ${C.red}`, borderRadius:11,
      padding:'12px 14px' }}>
      <div style={{ display:'flex', justifyContent:'space-between',
        alignItems:'center', marginBottom:9 }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.red }}>
          📉 SHORT SETUP — KÍCH HOẠT
        </div>
        <Bdg label={`Strength ${shortSetup.strength}/100`} col={C.red}/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)',
        gap:5, marginBottom:9 }}>
        {[
          {lbl:'Verdict <40',     ok:shortSetup.conditions.cond1},
          {lbl:'Elliott W5/Fail', ok:shortSetup.conditions.cond2},
          {lbl:'VSA Bearish',     ok:shortSetup.conditions.cond3},
          {lbl:'DXY Tăng',        ok:shortSetup.conditions.cond4},
        ].map((c,i)=>(
          <div key={i} style={{ display:'flex', gap:6, alignItems:'center',
            padding:'4px 7px', borderRadius:5,
            background:c.ok?`${C.red}08`:`${C.muted}08` }}>
            <span style={{ fontSize:10 }}>{c.ok?'✅':'❌'}</span>
            <span style={{ fontSize:9,
              color:c.ok?'#e2e8f0':C.muted }}>{c.lbl}</span>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)',
        gap:5, marginBottom:7 }}>
        {[
          {lbl:'📍 Entry Short',
           val:`$${shortSetup.entry.low}–$${shortSetup.entry.high}`,col:C.red},
          {lbl:'🛑 SL',   val:`$${shortSetup.sl}`,   col:C.amber},
          {lbl:'🎯 TP1',  val:`$${shortSetup.tp1}`,  col:C.green},
          {lbl:'🎯 TP2',  val:`$${shortSetup.tp2}`,  col:C.teal},
          {lbl:'🎯 TP3',  val:`$${shortSetup.tp3}`,  col:C.cyan},
          {lbl:'📊 R:R',
           val:`1:${shortSetup.rr}`,
           col:shortSetup.rr>=2?C.green:C.amber},
        ].map((p,i)=>(
          <div key={i} style={{ background:'#0a1520', borderRadius:5,
            padding:'5px 7px', border:`0.5px solid ${p.col}33` }}>
            <div style={{ fontSize:8, color:C.muted }}>{p.lbl}</div>
            <div style={{ ...mono, fontSize:10, fontWeight:700, color:p.col }}>
              {p.val}
            </div>
          </div>
        ))}
      </div>

      <div style={{ background:`${C.red}08`, borderRadius:7, padding:'7px 9px' }}>
        <div style={{ fontSize:9, fontWeight:700,
          color:C.red, marginBottom:2 }}>📌 LUẬN ĐIỂM SHORT</div>
        <div style={{ fontSize:9, color:'#b0b8d0', lineHeight:1.65 }}>
          {shortSetup.thesis}
        </div>
        <div style={{ fontSize:8, color:C.red, marginTop:5, fontWeight:600 }}>
          Trigger: {shortSetup.trigger}
        </div>
        <div style={{ fontSize:8, color:C.muted, marginTop:2 }}>
          ⛔ Vô hiệu: {shortSetup.invalidation}
        </div>
      </div>
    </div>
  );
}

// ─── 9. AI Tổng Hợp ───────────────────────────────────────────────────────────
function AITongHop({ s, ew, vsa, wyckoff, scores, bias, activeTF,
  shortSetup, imSignals }) {
  const [text, setText]       = useState('');
  const [loading, setLoading] = useState(false);

  const avg = scores.length
    ? Math.round(scores.reduce((a,s2)=>a+s2.score,0)/scores.length)
    : 50;
  const col = sc(avg);

  // Tóm tắt IM impact ngắn gọn
  const imSummary = useMemo(()=>{
    if (!imSignals) return '';
    const supports = Object.entries(imSignals)
      .filter(([,v])=>v.col===C.green).map(([k])=>k);
    const resists  = Object.entries(imSignals)
      .filter(([,v])=>v.col===C.red).map(([k])=>k);
    const parts = [];
    if (supports.length) parts.push(`${supports.join('+')} hỗ trợ`);
    if (resists.length)  parts.push(`${resists.join('+')} cản trở`);
    return parts.join(' · ');
  }, [imSignals]);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const shortNote = shortSetup?.active
        ? `\nSHORT SETUP ACTIVE: Entry $${shortSetup.entry.low}–$${shortSetup.entry.high}, SL $${shortSetup.sl}, TP1 $${shortSetup.tp1}.`
        : '';
      const imNote = imSummary ? `\nLiên thị trường: ${imSummary}.` : '';

      const r = await fetch('/api/claude', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          model:'claude-sonnet-4-5', max_tokens:500,
          messages:[{ role:'user', content:
            `Bạn là chuyên gia phân tích kỹ thuật đồng COMEX.
Tổng hợp tiếng Việt ~90 từ cho ${activeTF}:
- Elliott: ${ew.label} (${ew.prob}%) — ${ew.scenario}
- VSA: ${vsa.meta?.label} Vol=${vsa.latestBar?.volRatio}× Spread=${vsa.latestBar?.relSpread}σ
- Wyckoff: ${wyckoff.label} — ${wyckoff.sub} (${wyckoff.confidence}%)
- RSI=${ew.rsi||50} ATR=${vsa.atr?.toFixed(3)}
- COMEX=$${s.comex?.toFixed(3)} Bias=${bias}/100 Confluence=${avg}/100${shortNote}${imNote}
Kết luận: ${shortSetup?.active?'SHORT setup + ':''}entry/hành động tối ưu cho ${activeTF}.`
          }],
        }),
      });
      const d = await r.json();
      const t = (d.content||[])
        .filter(b=>b.type==='text').map(b=>b.text).join('');
      if (t) setText(t);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [ew,vsa,wyckoff,s,bias,avg,scores,activeTF,shortSetup,imSummary]);

  return (
    <div style={{ background:'#060d18', border:`1px solid ${col}44`,
      borderRadius:11, padding:'11px 14px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10,
        flexWrap:'wrap', marginBottom:8 }}>

        {/* Score circle */}
        <div style={{ width:44,height:44,borderRadius:'50%',flexShrink:0,
          background:`conic-gradient(${col} ${avg}%,#0f1e30 0)`,
          display:'flex',alignItems:'center',justifyContent:'center' }}>
          <div style={{ width:33,height:33,borderRadius:'50%',
            background:'#060d18',
            display:'flex',flexDirection:'column',alignItems:'center',
            justifyContent:'center' }}>
            <div style={{ ...mono,fontSize:13,fontWeight:700,
              color:col,lineHeight:1 }}>{avg}</div>
            <div style={{ fontSize:6,color:col }}>
              {avg>=70?'MUA':avg>=50?'TÍCH LŨY':'BÁN'}
            </div>
          </div>
        </div>

        <div style={{ flex:1 }}>
          <div style={{ fontSize:10,fontWeight:600,color:col,marginBottom:2 }}>
            🤖 AI Tổng Hợp — {activeTF}
          </div>
          {text
            ? <div style={{ fontSize:9,color:'#b0b8d0',lineHeight:1.7 }}>
                {text}
              </div>
            : <div style={{ fontSize:9,color:C.muted }}>
                {ew.label} · Wyckoff {wyckoff.label} · VSA {vsa.meta?.short}
                {imSummary&&(
                  <span style={{ color:C.cyan }}> · {imSummary}</span>
                )}
                {shortSetup?.active&&(
                  <span style={{ color:C.red,fontWeight:600 }}>
                    {' '}· 📉 SHORT ACTIVE
                  </span>
                )}
              </div>
          }
        </div>

        {/* Entry/TP/SL summary */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',
          gap:5,flexShrink:0 }}>
          {[
            {lbl:'Entry',val:`$${ew.fib500?.toFixed(3)||'–'}`,col:C.green},
            {lbl:'TP1',  val:`$${(s.tp1||6.32).toFixed(3)}`,  col:C.teal},
            {lbl:'TP2',  val:`$${(s.tp2||6.58).toFixed(3)}`,  col:C.cyan},
            {lbl:'SL',   val:`$${ew.fib618?.toFixed(3)||'–'}`, col:C.red},
            {lbl:'R:R',  val:'1 : 2.4',                        col:C.amber},
            {lbl:'Vốn',  val:'2% vốn',                         col:C.purple},
          ].map((m,i)=>(
            <div key={i} style={{ background:'#0a1520',borderRadius:5,
              padding:'4px 6px',textAlign:'center',
              border:`0.5px solid ${m.col}33` }}>
              <div style={{ fontSize:7,color:C.muted }}>{m.lbl}</div>
              <div style={{ ...mono,fontSize:9,fontWeight:700,color:m.col }}>
                {m.val}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={generate} disabled={loading} style={{
        width:'100%',padding:'9px',borderRadius:8,
        background:loading?'#0f1e30':`${col}18`,
        border:`1px solid ${loading?'#1e3050':col}`,
        color:loading?C.muted:col,
        fontSize:10,fontWeight:700,cursor:loading?'default':'pointer',
        display:'flex',alignItems:'center',justifyContent:'center',gap:6,
      }}>
        <span style={{ animation:loading?'spin 1s linear infinite':'' }}>
          {loading?'⟳':'⚡'}
        </span>
        {loading?'Đang phân tích...'
          :`Kích Hoạt AI Phân Tích Sâu — ${activeTF}: Elliott + VSA + Wyckoff + SMC + Liên TT`}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════
export default function TrendTab({ s, ew:ewProp, vsa:vsaProp,
  ti, mh, verdict, bias }) {

  // ─── useTrendEngine — TF-aware calculations ──────────────
  const engine = useTrendEngine(s);
  const {
    activeTF, setActiveTF, TF_CONFIG: tfCfg,
    activeBars, tfBars, loading,
    fetchTFData, ew, vsa, wyckoff, rsi, atr, pk1,
    imAssets, imSignals, imLoading, fetchIntermarket,
  } = engine;

  // ─── Analysis Controller (Drawing + AI + Log) ────────────
  const chartContainerRef = useRef(null);
  const {
    logs, signals, imData: ctrlIMData, layers: ctrlLayers,
    setData:    ctrlSetData,
    toggleLayer:    onToggleLayer,
    setDrawingTool: onSetDrawingTool,
    notifyIMUpdate,
    renderSMC,
    renderFib,
    renderWyckoff,
  } = useAnalysisController(chartContainerRef);

  // ─── Sync IM data → Controller ───────────────────────────
  useEffect(()=>{
    if (imAssets && Object.keys(imAssets).length > 0) {
      notifyIMUpdate({ assets:imAssets, signals:imSignals,
        updated_at:Date.now() });
    }
  }, [imAssets, imSignals]);

  // ─── Sync overlays khi engine data thay đổi ──────────────
  useEffect(()=>{
    if (!ew || !s.comex) return;
    if (ctrlLayers.fib)     renderFib(ew);
    if (ctrlLayers.smc)     renderSMC(s.comex, atr||0.12);
    if (ctrlLayers.wyckoff && vsa?.bars) renderWyckoff(vsa.bars);
  }, [ew?.wave, ew?.failure, vsa?.score, s.comex, atr,
      ctrlLayers.fib, ctrlLayers.smc, ctrlLayers.wyckoff]);

  // ─── Short setup ──────────────────────────────────────────
  const shortSetup = useMemo(()=> calcShortSetup(
    s, ew, vsa, verdict||{final:50}, imSignals, atr
  ), [s,ew,vsa,verdict,imSignals,atr]);

  // ─── Score array ──────────────────────────────────────────
  const scores = useMemo(()=>[
    { label:'Elliott Wave',    score: ew.score||50   },
    { label:'VSA Engine',      score: vsa.score||50  },
    { label:'Wyckoff Cycle',   score: wyckoff.confidence||50 },
    { label:'SMC',             score: pk1.pk1Score>65?80:55 },
    { label:'Harmonic',        score: 72 },
    { label:'Liên Thị Trường', score: imSignals
        ? Math.round(
            Object.values(imSignals).filter(s2=>s2.col===C.green).length
            / Object.keys(imSignals).length * 100
          )
        : 60 },
  ], [ew,vsa,wyckoff,pk1,imSignals]);

  // ─── RENDER ──────────────────────────────────────────────
  return (
    <div style={{ display:'grid', gap:9 }}>

      {/* ── Timeframe selector ── */}
      <div style={{ display:'flex', gap:4, alignItems:'center',
        background:'#060d18', borderRadius:9, padding:'6px 10px',
        border:'1px solid #1e3050', flexWrap:'wrap' }}>
        <span style={{ fontSize:9,color:C.muted,
          marginRight:3,fontWeight:600 }}>TIMEFRAME:</span>

        {TFS.map(tf=>{
          const barCount  = (tfBars[tf]||[]).length;
          const isLoading = loading[tf];
          const hasData   = barCount >= 5;
          return (
            <button key={tf} onClick={()=>{
              setActiveTF(tf);
              if (!hasData) fetchTFData(tf);
            }} style={{
              fontSize:9, padding:'3px 10px', borderRadius:5,
              border:`0.5px solid ${activeTF===tf?C.blue:'#1e3050'}`,
              background:activeTF===tf?`${C.blue}18`:'transparent',
              color:activeTF===tf?C.blue:C.muted,
              cursor:'pointer', fontWeight:activeTF===tf?600:400,
              position:'relative',
            }}>
              {tf}
              <span style={{ position:'absolute',top:1,right:2,
                width:4,height:4,borderRadius:'50%',
                display:'inline-block',
                background:isLoading?C.amber:hasData?C.green:'#1e3050',
                animation:isLoading
                  ?'pulse 1s ease-in-out infinite':'none' }}/>
            </button>
          );
        })}

        {/* Right badges */}
        <div style={{ marginLeft:'auto', display:'flex',
          gap:5, flexWrap:'wrap' }}>
          <Bdg label={ew.label||`W${ew.wave}`}
            col={ew.failure?C.red:C.green}/>
          <Bdg label={`Bias ${bias}/100`} col={sc(bias)}/>
          <Bdg label={`RSI ${rsi}`}
            col={rsi>70?C.red:rsi<30?C.green:C.amber}/>
          <Bdg label={`${activeBars.length}b`} col={C.muted}/>
          {shortSetup?.active&&(
            <Bdg label="📉 SHORT ACTIVE" col={C.red}/>
          )}
          {ctrlLayers.ai_detection&&(
            <Bdg label="🤖 AI ON" col={C.purple}/>
          )}
        </div>
      </div>

      {/* ── Short Setup Panel ── */}
      {shortSetup?.active&&(
        <ShortSetupPanel shortSetup={shortSetup}/>
      )}

      {/* ── Main layout: LEFT | CENTER | RIGHT ── */}
      <div style={{ display:'grid',
        gridTemplateColumns:'220px 1fr 210px',
        gap:9, alignItems:'start' }}>

        {/* ── LEFT: Fib + Multi-method + IM Heatmap ── */}
        <div style={{ display:'grid', gap:9 }}>
          <FibPanel s={s} ew={ew} activeTF={activeTF}/>
          <MultiMethodPanel
            scores={scores} verdict={verdict}
            bias={bias} activeTF={activeTF}
            shortSetup={shortSetup}/>
          {/* IM Heatmap — thay thế hardcode liên thị trường */}
          <IMHeatmap
            imData={ctrlIMData || (imAssets
              ? { assets:imAssets, signals:imSignals,
                  correlations:{}, updated_at:Date.now() }
              : null)}
            onRefresh={()=>fetchIntermarket(true)}
            isLoading={imLoading}
          />
        </div>

        {/* ── CENTER: Price Chart + Control Panel ── */}
        <div style={{ display:'grid', gap:9 }}>
          {/* PriceChart nhận chartContainerRef để Controller bind */}
          <PriceChart
            s={s} activeTF={activeTF} ew={ew} vsa={vsa}
            chartContainerRef={chartContainerRef}
            ctrlLayers={ctrlLayers}
            onToggleLayer={onToggleLayer}
            onSetDrawingTool={onSetDrawingTool}
          />
          {/* Control Panel — Toggle switches + AI master + Drawing tools */}
          <ControlPanel
            ctrlLayers={ctrlLayers}
            onToggleLayer={onToggleLayer}
            onSetDrawingTool={onSetDrawingTool}
            activeTF={activeTF}
            ew={ew}
            vsa={vsa}
            wyckoff={wyckoff}
            rsi={rsi}
          />
        </div>

        {/* ── RIGHT: Wyckoff + SMC + Harmonic ── */}
        <div style={{ display:'grid', gap:9 }}>
          <WyckoffPanel wyckoff={wyckoff}/>
          <SMCPanel s={{...s, atr}}/>
          <HarmonicPanel s={s}/>
        </div>
      </div>

      {/* ── Signal Log thời gian thực (thay Short Signal tĩnh) ── */}
      <SignalLog logs={logs} maxHeight={300}/>

      {/* ── AI Tổng Hợp ── */}
      <AITongHop
        s={s} ew={ew} vsa={vsa} wyckoff={wyckoff}
        scores={scores} bias={bias} activeTF={activeTF}
        shortSetup={shortSetup}
        imSignals={imSignals}
      />

    </div>
  );
}