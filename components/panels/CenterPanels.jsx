// ─── Center column: PriceChart + ControlPanel ─────────────────────────────────
import { useState } from 'react';
import { C } from '../constants/colors';
import { Bdg, ToggleSwitch } from '../ui/Primitives';
import { useChartData } from '../../hooks/useChartData';
import TVChart from '../TVChart';

export function PriceChart({ safeS, activeTF, ew, vsa, smcData,
  chartContainerRef, ctrlLayers, onToggleLayer, onSetDrawingTool }) {

  const { bars, loading, refresh, barCount } = useChartData(activeTF, safeS);
  const comexUp  = (safeS.comex_chg_pct||0)>=0;
  const [activeTool,   setActiveTool]   = useState(null);
  const [crosshairBar, setCrosshairBar] = useState(null);
  const [showFib,      setShowFib]      = useState(true);
  const [showSMC,      setShowSMC]      = useState(true);
  const [showWyckoff,  setShowWyckoff]  = useState(true);

  const handleTool = (tool) => {
    const next = activeTool===tool?null:tool;
    setActiveTool(next);
    onSetDrawingTool?.(next);
  };

  return (
    <div style={{ background:'#060d18', border:'1px solid #1e3050',
      borderRadius:11, padding:'11px 13px' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between',
        alignItems:'center', marginBottom:7, flexWrap:'wrap', gap:5 }}>
        <div style={{ display:'flex', gap:7, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:11, fontWeight:600, color:'#e2e8f0' }}>
            ⚡ ĐỒNG COMEX — {activeTF}
          </span>
          {loading
            ?<Bdg label="⟳ Đang tải..." col={C.amber}/>
            :barCount<5
            ?<Bdg label="Chưa đủ dữ liệu" col={C.red}/>
            :<Bdg label={ew?.label||`W${ew?.wave}`} col={ew?.failure?C.red:C.green}/>}
          {ew?.w3Target>0&&!ew?.failure&&(
            <Bdg label={`TP $${ew.w3Target}`} col={C.amber}/>
          )}
        </div>
        <div style={{ display:'flex', gap:7, alignItems:'center' }}>
          {crosshairBar&&(
            <div style={{ display:'flex', gap:4, fontSize:9,
              fontFamily:'monospace', color:C.muted }}>
              <span style={{ color:'#e2e8f0' }}>O:{crosshairBar.open?.toFixed(3)}</span>
              <span style={{ color:C.green }}>H:{crosshairBar.high?.toFixed(3)}</span>
              <span style={{ color:C.red }}>L:{crosshairBar.low?.toFixed(3)}</span>
              <span style={{ color:crosshairBar.close>=(crosshairBar.open||0)?C.green:C.red }}>
                C:{crosshairBar.close?.toFixed(3)}
              </span>
            </div>
          )}
          <span style={{ fontFamily:'monospace', fontSize:13, fontWeight:700,
            color:comexUp?C.green:C.red }}>
            ${(safeS.comex||0).toFixed(3)}
          </span>
          <span style={{ fontSize:9, color:comexUp?C.green:C.red }}>
            {comexUp?'▲':'▼'}{Math.abs(safeS.comex_chg_pct||0).toFixed(2)}%
          </span>
          <span style={{ fontSize:8, color:C.muted }}>{barCount}b</span>
          <button onClick={()=>refresh(true)} disabled={loading} style={{
            fontSize:8, padding:'2px 7px', borderRadius:4,
            border:'0.5px solid #1e3050', background:'transparent',
            color:C.muted, cursor:loading?'default':'pointer',
          }}>
            <span style={{ animation:loading?'spin 1s linear infinite':'',
              display:'inline-block' }}>{loading?'⟳':'↺'}</span>
          </button>
        </div>
      </div>

      {/* Drawing Palette */}
      <div style={{ display:'flex', gap:4, marginBottom:6, padding:'5px 8px',
        background:'#0a1520', borderRadius:7, border:'0.5px solid #1e3050',
        flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:8, color:C.muted, flexShrink:0 }}>VẼ:</span>
        {[
          {tool:'trendline',icon:'/',  label:'Trendline', col:C.blue},
          {tool:'rectangle',icon:'⬜',label:'OB Zone',   col:C.amber},
          {tool:'fibonacci', icon:'📐',label:'Fibonacci', col:C.purple},
        ].map(btn=>(
          <button key={btn.tool} onClick={()=>handleTool(btn.tool)} style={{
            fontSize:8, padding:'2px 8px', borderRadius:4, cursor:'pointer',
            border:`0.5px solid ${activeTool===btn.tool?btn.col:'#1e3050'}`,
            background:activeTool===btn.tool?`${btn.col}18`:'transparent',
            color:activeTool===btn.tool?btn.col:C.muted,
            display:'flex', alignItems:'center', gap:4, transition:'all 0.2s',
          }}>
            <span>{btn.icon}</span>{btn.label}
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
            {key:'fib',     label:'Fib',     col:C.amber,  val:showFib,     set:setShowFib},
            {key:'smc',     label:'SMC',     col:C.blue,   val:showSMC,     set:setShowSMC},
            {key:'wyckoff', label:'Wyckoff', col:C.purple, val:showWyckoff, set:setShowWyckoff},
          ].map(btn=>(
            <button key={btn.key} onClick={()=>btn.set(v=>!v)} style={{
              fontSize:7, padding:'1px 6px', borderRadius:3, cursor:'pointer',
              border:`0.5px solid ${btn.val?btn.col:'#1e3050'}`,
              background:btn.val?`${btn.col}18`:'transparent',
              color:btn.val?btn.col:C.muted,
            }}>{btn.val?'●':'○'} {btn.label}</button>
          ))}
        </div>
      </div>

      {activeTool&&(
        <div style={{ background:`${C.blue}10`, border:`0.5px solid ${C.blue}44`,
          borderRadius:6, padding:'4px 9px', marginBottom:6,
          fontSize:8, color:C.blue,
          display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ animation:'pulse 1s ease-in-out infinite', fontSize:10 }}>
            ✏️
          </span>
          Chế độ vẽ <b>{activeTool}</b> — click &amp; kéo, AI tự động phân tích
        </div>
      )}

      <TVChart
        bars={bars} activeTF={activeTF} ew={ew} vsa={vsa}
        smcData={smcData} showFib={showFib} showSMC={showSMC}
        showWyckoff={showWyckoff} showVolume={true}
        isLoading={loading} onCrosshair={setCrosshairBar}
        chartContainerRef={chartContainerRef}
      />

      <div style={{ textAlign:'center', fontSize:8, color:C.muted, marginTop:5 }}>
        TradingView Lightweight Charts · {activeTF} · {barCount} candles ·{' '}
        {loading?'Đang cập nhật...':'Yahoo Finance HG=F'}
        {activeTool&&(
          <span style={{ color:C.blue, marginLeft:6 }}>· ✏️ {activeTool}</span>
        )}
      </div>
    </div>
  );
}

export function ControlPanel({ ctrlLayers, onToggleLayer,
  onSetDrawingTool, activeTF, ew, vsa, wyckoff, rsi }) {
  const [activeTool, setActiveTool] = useState(null);
  const handleTool = (tool) => {
    const next = activeTool===tool?null:tool;
    setActiveTool(next);
    onSetDrawingTool?.(next);
  };
  return (
    <div style={{ background:'#060d18',
      border:`1px solid ${ctrlLayers.ai_detection?C.purple+'66':'#1e3050'}`,
      borderRadius:11, padding:'11px 13px' }}>
      <div style={{ fontSize:10, fontWeight:600, color:'#e2e8f0',
        marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ fontSize:14 }}>🎛️</span>PHÂN TÍCH &amp; CÔNG CỤ AI
      </div>
      <div style={{ fontSize:8, color:C.muted, marginBottom:6,
        fontWeight:600, letterSpacing:'.05em' }}>PHƯƠNG PHÁP BẬT/TẮT</div>
      {[
        {key:'elliott', label:'Elliott Wave', col:C.blue},
        {key:'vsa',     label:'VSA Engine',   col:C.green},
        {key:'wyckoff', label:'Wyckoff',      col:C.amber},
        {key:'smc',     label:'SMC',          col:C.teal},
        {key:'harmonic',label:'Harmonic',     col:C.purple},
        {key:'fib',     label:'Fibonacci',    col:C.cyan},
      ].map(item=>(
        <ToggleSwitch key={item.key} label={item.label}
          active={ctrlLayers[item.key]!==false}
          onChange={v=>onToggleLayer(item.key,v)} col={item.col}/>
      ))}
      <div style={{
        background:ctrlLayers.ai_detection?`${C.purple}12`:'#0a1520',
        border:`0.5px solid ${ctrlLayers.ai_detection?C.purple:'#1e3050'}`,
        borderRadius:8, padding:'8px 10px', marginTop:8, marginBottom:10,
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
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
            onChange={v=>onToggleLayer('ai_detection',v)} col={C.purple}/>
        </div>
        {ctrlLayers.ai_detection&&(
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:5 }}>
            <Bdg label={`W${ew?.wave||'?'}`} col={ew?.failure?C.red:C.green}/>
            <Bdg label={`RSI ${rsi}`}
              col={rsi>70?C.red:rsi<30?C.green:C.amber}/>
            <Bdg label={wyckoff?.label?.replace('Phase ','')||'?'} col={C.amber}/>
          </div>
        )}
      </div>
      <div style={{ borderTop:'0.5px solid #1e3050', paddingTop:9 }}>
        <div style={{ fontSize:8, color:C.muted, marginBottom:6,
          fontWeight:600, letterSpacing:'.05em' }}>CÔNG CỤ VẼ TƯƠNG TÁC</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
          {[
            {tool:'trendline',icon:'/',  label:'Trendline', col:C.blue},
            {tool:'rectangle',icon:'⬜',label:'OB Zone',   col:C.amber},
            {tool:'fibonacci', icon:'📐',label:'Fibonacci', col:C.purple},
            {tool:null,        icon:'✕', label:'Reset',     col:C.red},
          ].map((btn,i)=>(
            <button key={i} onClick={()=>handleTool(btn.tool)} style={{
              fontSize:8, padding:'5px 8px', borderRadius:6, cursor:'pointer',
              border:`0.5px solid ${activeTool===btn.tool?(btn.col||C.red):'#1e3050'}`,
              background:activeTool===btn.tool?`${btn.col||C.red}18`:'#0a1520',
              color:activeTool===btn.tool?(btn.col||C.red):C.muted,
              display:'flex', alignItems:'center', gap:5, transition:'all 0.2s',
            }}>
              <span style={{ fontSize:10 }}>{btn.icon}</span>{btn.label}
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
            Đang vẽ <b style={{ color:'#e2e8f0' }}>{activeTool}</b> — AI phân tích tự động
          </div>
        )}
      </div>
    </div>
  );
}