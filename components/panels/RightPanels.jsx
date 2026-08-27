// ─── Right column: WyckoffPanel + SMCPanel + HarmonicPanel ───────────────────
import { C, mono } from '../constants/colors';
import { Bdg, Panel } from '../ui/Primitives';

export function WyckoffPanel({ wyckoff }) {
  // Guard: wyckoff có thể undefined khi engine chưa sẵn sàng
  const safeW = wyckoff || { phase:'A', label:'?', confidence:0, sub:'' };
  const isBear = safeW.phase==='DIST';
  const phases = isBear
    ?[
      {phase:'Preliminary Supply',sub:'PSY → BC',done:true,active:false,col:C.red},
      {phase:'Automatic Rally',sub:'AR — rebound',done:true,active:false,col:C.red},
      {phase:'SOW',sub:'Breakdown confirm',done:false,active:true,col:C.red},
      {phase:'LPSY',sub:'Last Point Supply',done:false,active:false,col:C.muted},
      {phase:'Markdown',sub:'Downtrend Phase',done:false,active:false,col:C.muted},
    ]:[
      {phase:'Phase A',sub:'SC → AR → ST',done:safeW.phase>='B',active:safeW.phase==='A',col:C.green},
      {phase:'Phase B',sub:'UT · Secondary Tests',done:safeW.phase>='C',active:safeW.phase==='B',col:C.green},
      {phase:'Phase C',sub:safeW.sub||'Spring/Test',done:safeW.phase>='D',active:safeW.phase==='C',col:C.amber},
      {phase:'Phase D',sub:'LPS → SOS Markup',done:safeW.phase>='E',active:safeW.phase==='D',col:C.teal},
      {phase:'Phase E',sub:'Markup / Uptrend',done:false,active:safeW.phase==='E',col:C.cyan},
    ];
  const col = isBear?C.red:C.amber;
  return (
    <Panel title="WYCKOFF CYCLE" icon="🔄" glow={col}
      badge={`${safeW.label||'?'} · ${safeW.confidence||0}%`} badgeCol={col}>
      {phases.map((ph,i)=>(
        <div key={i} style={{
          display:'flex', gap:8, alignItems:'flex-start',
          padding:'6px 8px', borderRadius:7, marginBottom:3,
          background:ph.active?`${ph.col}10`:ph.done?`${ph.col}08`:'transparent',
          border:`0.5px solid ${ph.active?ph.col:ph.done?ph.col+'88':'#1e3050'}`,
        }}>
          <div style={{
            width:16, height:16, borderRadius:'50%', flexShrink:0, marginTop:1,
            background:ph.done?ph.col:ph.active?ph.col:'#1e3050',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:9, color:'#060d18', fontWeight:700,
          }}>
            {ph.done?'✓':ph.active?'⚡':'○'}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:9, fontWeight:600,
              color:ph.active?ph.col:ph.done?ph.col:C.muted }}>
              {ph.phase}
            </div>
            <div style={{ fontSize:7, color:C.muted, marginTop:1 }}>{ph.sub}</div>
          </div>
        </div>
      ))}
    </Panel>
  );
}

export function SMCPanel({ safeS, atr }) {
  const cu = safeS.comex || 6.07;
  const at = atr || 0.12;
  
  // Adaptive ATR multiplier based on volatility regime
  const atrMultiplier = at > 0.2 ? 1.5 : at > 0.1 ? 1.2 : 1.0;
  
  // OB Giảm (bearish OB below current price) - ensure lower bound < upper bound
  let obLower = cu - at * atrMultiplier;
  let obUpper = cu - at * 0.5 * atrMultiplier;
  if (obLower >= obUpper) {
    obLower = cu - at * 2.5;
    obUpper = cu - at * 1.0;
  }
  
  // FVG (Fair Value Gap) - ensure valid range
  let fvgLower = cu + at * 0.3 * atrMultiplier;
  let fvgUpper = cu + at * 0.7 * atrMultiplier;
  if (fvgLower >= fvgUpper) {
    fvgLower = cu + at * 0.1;
    fvgUpper = cu + at * 0.9;
  }
  
  // BOS (Break of Structure) - confirmed signal
  const bosPrice = cu - at * 0.1;
  
  // OB Tăng (bullish OB above current price) - ensure valid range
  let obTrapLower = cu + at * 0.5 * atrMultiplier;
  let obTrapUpper = cu + at * 2.0 * atrMultiplier;
  if (obTrapLower >= obTrapUpper) {
    obTrapLower = cu + at * 1.0;
    obTrapUpper = cu + at * 2.5;
  }
  
  // Liquidity pool
  const liqPrice = cu - at * 2.5 * atrMultiplier;
  
  return (
    <Panel title="SMC ORDER BLOCKS" icon="🔷" glow={C.blue}>
      {
        [
          { 
            lbl: 'OB Giảm', 
            range: `$${obLower.toFixed(3)}–$${obUpper.toFixed(3)}`, 
            sig: 'BÁN', 
            col: C.red 
          },
          { 
            lbl: 'FVG', 
            range: `$${fvgLower.toFixed(3)}–$${fvgUpper.toFixed(3)}`, 
            sig: 'FVG', 
            col: C.purple 
          },
          { 
            lbl: 'BOS ✓', 
            range: `$${bosPrice.toFixed(3)}`, 
            sig: 'BOS', 
            col: C.green 
          },
          { 
            lbl: 'OB Tăng', 
            range: `$${obTrapLower.toFixed(3)}–$${obTrapUpper.toFixed(3)}`, 
            sig: 'MUA', 
            col: C.green 
          },
          { 
            lbl: 'Liquidity', 
            range: `$${liqPrice.toFixed(3)}`, 
            sig: 'POOL', 
            col: C.amber 
          },
        ].map((b, i) => (
          <div key={i} style={{ 
            padding: '6px 8px', 
            borderRadius: 7, 
            marginBottom: 4,
            background: '#0a1520', 
            border: `0.5px solid ${b.col}33` 
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: 2 
            }}>
              <span style={{ 
                fontSize: 9, 
                color: '#e2e8f0', 
                fontWeight: 500 
              }}>{b.lbl}</span>
              <Bdg label={b.sig} col={b.col} />
            </div>
            <div style={{ ...mono, fontSize: 9, color: b.col }}>
              {b.range}
            </div>
          </div>
        ))
      }
    </Panel>
  );
}

export function HarmonicPanel({ safeS }) {
  const cu=safeS.comex||6.07;
  return (
    <Panel title="HARMONIC PATTERNS" icon="🎯" glow={C.purple}>
      {[
        {name:'Bullish Gartley',sig:'MUA',rel:94,col:C.green,prz:`$${(cu*0.975).toFixed(3)}`},
        {name:'Deep Crab',sig:'THEO DÕI',rel:78,col:C.amber,prz:`$${(cu*1.090).toFixed(3)}`},
        {name:'Bearish Butterfly',sig:'BÁN (tiềm năng)',rel:65,col:C.red,prz:`$${(cu*1.150).toFixed(3)}`},
      ].map((p,i)=>(
        <div key={i} style={{ background:'#0a1520', borderRadius:8,
          padding:'8px 10px', marginBottom:5, border:`0.5px solid ${p.col}44` }}>
          <div style={{ display:'flex', justifyContent:'space-between',
            alignItems:'center', marginBottom:3 }}>
            <span style={{ fontSize:9, fontWeight:600, color:p.col }}>{p.name}</span>
            <Bdg label={p.sig} col={p.col}/>
          </div>
          <div style={{ fontSize:8, color:C.muted, marginBottom:3 }}>PRZ: {p.prz}</div>
          <div style={{ background:'#060d18', borderRadius:3, height:5, overflow:'hidden' }}>
            <div style={{ width:`${p.rel}%`, height:'100%', background:p.col, borderRadius:3 }}/>
          </div>
          <div style={{ fontSize:8, color:p.col, textAlign:'right', marginTop:2 }}>
            {p.rel}%
          </div>
        </div>
      ))}
    </Panel>
  );
}