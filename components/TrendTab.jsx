// ─── TrendTab v5 — Main coordinator — chỉ chứa logic + layout ────────────────
import { useMemo, useEffect, useRef }    from 'react';
import { useTrendEngine, TFS }           from '../hooks/useTrendEngine';
import { useAnalysisController }         from '../hooks/useAnalysisController';
import { calcShortSetup }                from '../lib/calculations';
import SignalLog                         from './SignalLog';
import IMHeatmap                         from './IMHeatmap';

// ── Imports từ các module con ─────────────────────────────────────────────────
import { C, sc }                         from './constants/colors';
import { Bdg }                           from './ui/Primitives';
import { FibPanel, MultiMethodPanel }    from './panels/LeftPanels';
import { PriceChart, ControlPanel }      from './panels/CenterPanels';
import { WyckoffPanel, SMCPanel,
         HarmonicPanel }                 from './panels/RightPanels';
import PatternScanner                    from './panels/PatternScanner';
import ShortSetupPanel                   from './panels/ShortSetup';
import AITongHop                         from './panels/AITongHop';

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function TrendTab({ s, verdict, bias }) {

  // FIX: guard s undefined ở render đầu
  const safeS = s || {};

  const engine = useTrendEngine(safeS);
  const {
    activeTF, setActiveTF,
    activeBars, tfBars, loading,
    fetchTFData, ew, vsa, wyckoff, rsi, atr, pk1,
    imAssets, imSignals, imLoading, fetchIntermarket,
  } = engine;

  // FIX: extract trước useEffect — không dùng s.comex trực tiếp
  const comexPrice = safeS.comex;

  // Single chart ref
  const chartContainerRef = useRef(null);

  const {
    logs, imData: ctrlIMData,
    layers: ctrlLayers,
    toggleLayer:    onToggleLayer,
    setDrawingTool: onSetDrawingTool,
    notifyIMUpdate,
    renderSMC, renderFib, renderWyckoff,
  } = useAnalysisController(chartContainerRef);

  // Sync IM → Controller
  useEffect(()=>{
    if (imAssets&&Object.keys(imAssets).length>0) {
      notifyIMUpdate({ assets:imAssets, signals:imSignals, updated_at:Date.now() });
    }
  },[imAssets, imSignals]);

  // Sync overlays — dùng comexPrice, KHÔNG dùng s.comex
  useEffect(()=>{
    if (!comexPrice) return;
    const t = setTimeout(()=>{
      if (ctrlLayers.fib&&ew)            renderFib(ew);
      if (ctrlLayers.smc)                renderSMC(comexPrice, atr||0.12);
      if (ctrlLayers.wyckoff&&vsa?.bars) renderWyckoff(vsa.bars);
    }, 300);
    return ()=>clearTimeout(t);
  },[ew?.wave, ew?.failure, vsa?.score,
     comexPrice, atr,
     ctrlLayers.fib, ctrlLayers.smc, ctrlLayers.wyckoff]);

  const smcData = useMemo(()=>{
    const cu=safeS.comex||6.07, at=atr||0.12;
    return {
      obBear:[cu+at*1.0, cu+at*1.8],
      obBull:[cu-at*2.0, cu-at*1.0],
      fvg:  [cu+at*0.3, cu+at*0.7],
      liq:   cu-at*2.5,
    };
  },[safeS.comex, atr]);

  const shortSetup = useMemo(()=>calcShortSetup(
    safeS, ew, vsa, verdict||{final:50}, imSignals, atr
  ),[safeS,ew,vsa,verdict,imSignals,atr]);

  const scores = useMemo(()=>[
    { label:'Elliott Wave',    score:ew.score||50 },
    { label:'VSA Engine',      score:vsa.score||50 },
    { label:'Wyckoff Cycle',   score:wyckoff.confidence||50 },
    { label:'SMC',             score:pk1.pk1Score>65?80:55 },
    { label:'Harmonic',        score:72 },
    { label:'Liên Thị Trường', score:imSignals
        ?Math.round(Object.values(imSignals)
          .filter(s=>s.col===C.green).length
          /Math.max(Object.keys(imSignals).length,1)*100)
        :60 },
  ],[ew,vsa,wyckoff,pk1,imSignals]);

  const TF_LIST = TFS||['MN','W','D','H4','H1','M15'];

  return (
    <div style={{ display:'grid', gap:9 }}>

      {/* Timeframe selector */}
      <div style={{ display:'flex', gap:4, alignItems:'center',
        background:'#060d18', borderRadius:9,
        padding:'6px 10px', border:'1px solid #1e3050', flexWrap:'wrap' }}>
        <span style={{ fontSize:9, color:'#5a7090', marginRight:3, fontWeight:600 }}>
          TIMEFRAME:
        </span>
        {TF_LIST.map(tf=>{
          const bc=(tfBars[tf]||[]).length, il=loading[tf], hd=bc>=5;
          return (
            <button key={tf} onClick={()=>{ setActiveTF(tf); if (!hd) fetchTFData(tf); }} style={{
              fontSize:9, padding:'3px 10px', borderRadius:5, position:'relative',
              border:`0.5px solid ${activeTF===tf?C.blue:'#1e3050'}`,
              background:activeTF===tf?`${C.blue}18`:'transparent',
              color:activeTF===tf?C.blue:'#5a7090',
              cursor:'pointer', fontWeight:activeTF===tf?600:400,
            }}>
              {tf}
              <span style={{ position:'absolute', top:1, right:2,
                width:4, height:4, borderRadius:'50%', display:'inline-block',
                background:il?C.amber:hd?C.green:'#1e3050',
                animation:il?'pulse 1s ease-in-out infinite':'none' }}/>
            </button>
          );
        })}
        <div style={{ marginLeft:'auto', display:'flex', gap:5, flexWrap:'wrap' }}>
          <Bdg label={ew.label||`W${ew.wave}`} col={ew.failure?C.red:C.green}/>
          <Bdg label={`Bias ${bias||0}/100`} col={sc(bias||0)}/>
          <Bdg label={`RSI ${rsi}`} col={rsi>70?C.red:rsi<30?C.green:C.amber}/>
          <Bdg label={`${activeBars.length}b`} col={'#5a7090'}/>
          {shortSetup?.active&&<Bdg label="📉 SHORT" col={C.red}/>}
          {ctrlLayers.ai_detection&&<Bdg label="🤖 AI ON" col={'#8b5cf6'}/>}
        </div>
      </div>

      {shortSetup?.active&&<ShortSetupPanel shortSetup={shortSetup}/>}

      {/* 3-col layout — FIX: minmax + minWidth:0 */}
      <div style={{
        display:'grid',
        gridTemplateColumns:'minmax(180px,220px) 1fr minmax(180px,210px)',
        gap:9, alignItems:'start',
      }}>
        {/* LEFT */}
        <div style={{ display:'grid', gap:9, minWidth:0 }}>
          <FibPanel safeS={safeS} ew={ew} activeTF={activeTF}/>
          <MultiMethodPanel scores={scores} bias={bias||0}
            activeTF={activeTF} shortSetup={shortSetup}/>
          <IMHeatmap
            imData={ctrlIMData||(imAssets
              ?{assets:imAssets,signals:imSignals,
                correlations:{},updated_at:Date.now()}
              :null)}
            onRefresh={()=>fetchIntermarket(true)}
            isLoading={imLoading}
          />
        </div>

        {/* CENTER */}
        <div style={{ display:'grid', gap:9, minWidth:0 }}>
          <PriceChart safeS={safeS} activeTF={activeTF}
            ew={ew} vsa={vsa} smcData={smcData}
            chartContainerRef={chartContainerRef}
            ctrlLayers={ctrlLayers}
            onToggleLayer={onToggleLayer}
            onSetDrawingTool={onSetDrawingTool}/>
          <ControlPanel ctrlLayers={ctrlLayers}
            onToggleLayer={onToggleLayer}
            onSetDrawingTool={onSetDrawingTool}
            activeTF={activeTF} ew={ew} vsa={vsa}
            wyckoff={wyckoff} rsi={rsi}/>
          <PatternScanner bars={activeBars}
            ew={ew} vsa={vsa} safeS={safeS}/>
        </div>

        {/* RIGHT */}
        <div style={{ display:'grid', gap:9, minWidth:0 }}>
          <WyckoffPanel wyckoff={wyckoff}/>
          <SMCPanel safeS={safeS} atr={atr}/>
          <HarmonicPanel safeS={safeS}/>
        </div>
      </div>

      <SignalLog logs={logs} maxHeight={280}/>

      <AITongHop safeS={safeS} ew={ew} vsa={vsa} wyckoff={wyckoff}
        scores={scores} bias={bias||0} activeTF={activeTF}
        shortSetup={shortSetup} imSignals={imSignals}/>

      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
      `}</style>
    </div>
  );
}