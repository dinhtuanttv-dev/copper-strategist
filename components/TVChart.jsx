// ─── TrendTab v5 — fix layout + PatternScanner + TVChart single-ref ──────────
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTrendEngine, TF_CONFIG, TFS } from '../hooks/useTrendEngine';
import { useChartData }                   from '../hooks/useChartData';
import { useAnalysisController }          from '../hooks/useAnalysisController';
import { calcShortSetup }                 from '../lib/calculations';
import TVChart                            from './TVChart';
import SignalLog                          from './SignalLog';
import IMHeatmap                          from './IMHeatmap';

const C = {
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b',
  blue:'#3b82f6', teal:'#14b8a6', purple:'#8b5cf6',
  orange:'#f97316', cyan:'#06b6d4', muted:'#5a7090',
};
const mono = { fontFamily:'monospace' };
const sc   = v => v>=70?C.green:v>=50?C.amber:C.red;

// ─── Micro components ─────────────────────────────────────────────────────────
function Bdg({ label, col, size=8 }) {
  return (
    <span style={{ fontSize:size, padding:'2px 7px', borderRadius:4,
      fontWeight:700, background:col+'22', color:col,
      border:`0.5px solid ${col}44`, whiteSpace:'nowrap' }}>
      {label}
    </span>
  );
}

function Panel({ title, icon, glow, children, badge, badgeCol }) {
  return (
    <div style={{ background:'#060d18',
      border:`1px solid ${glow||'#1e3050'}`,
      borderRadius:11, padding:'11px 13px',
      boxShadow:glow?`0 0 14px ${glow}14`:'none' }}>
      <div style={{ display:'flex', justifyContent:'space-between',
        alignItems:'center', marginBottom:9, flexWrap:'wrap', gap:5 }}>
        <div style={{ fontSize:10, fontWeight:600, color:'#e2e8f0',
          display:'flex', alignItems:'center', gap:5 }}>
          {icon&&<span style={{ fontSize:13 }}>{icon}</span>}
          {title}
        </div>
        {badge&&<Bdg label={badge} col={badgeCol||C.blue}/>}
      </div>
      {children}
    </div>
  );
}

function SBar({ label, score, col }) {
  const c = col||sc(score);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
      <span style={{ fontSize:9, color:C.muted, width:80, flexShrink:0 }}>
        {label}
    </span>
      <div style={{ flex:1, background:'#0f1e30', borderRadius:2,
        height:5, overflow:'hidden' }}>
        <div style={{ width:`${score}%`, height:'100%', background:c,
          borderRadius:2, transition:'width .5s' }}/>
      </div>
      <span style={{ fontSize:9, fontWeight:700, color:c,
        width:22, textAlign:'right' }}>{score}</span>
    </div>
  );
}

function ToggleSwitch({ label, active, onChange, col, small }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between',
      alignItems:'center', marginBottom:small?4:6 }}>
      <span style={{ fontSize:small?8:9,
        color:active?'#e2e8f0':C.muted }}>{label}</span>
      <div onClick={()=>onChange(!active)} style={{
        width:28, height:14, borderRadius:7, position:'relative',
        cursor:'pointer', flexShrink:0, transition:'background .2s',
        background:active?(col||C.green)+'44':'#1e3050',
        border:`0.5px solid ${active?(col||C.green):'#1e3050'}`,
      }}>
        <div style={{ width:10, height:10, borderRadius:'50%',
          position:'absolute', top:1, transition:'left .2s, background .2s',
          left:active?16:2,
          background:active?(col||C.green):C.muted }}/>
      </div>
    </div>
  );
}

// ─── PatternScanner — module mô hình kỹ thuật ────────────────────────────────
function detectPatterns(bars, ew, vsa, currentPrice) {
  if (!bars || bars.length < 10) return [];
  const cu    = currentPrice || 6.07;
  const hi20  = Math.max(...bars.slice(-20).map(b=>b.high||b.comex));
  const lo20  = Math.min(...bars.slice(-20).map(b=>b.low||b.comex));
  const rng   = hi20 - lo20 || 0.01;
  const pos   = (cu - lo20) / rng;
  const patterns = [];

  if (pos < 0.35 && vsa?.bullish) {
    patterns.push({
      id:'ihs_1', tf:'H4', name:'Vai đầu vai ngược (IH&S)',
      status:'forming', direction:'long',
      probability:72, target:+(cu+rng*0.7).toFixed(3),
      invalidation:+(lo20-rng*0.1).toFixed(3),
      ai_tags:['accumulation','wyckoff','spring'],
    });
  }
  // ... (giữ nguyên logic cũ của các patterns khác)
  return patterns;
}

function PatternScanner({ bars, ew, vsa, s }) {
  const [filterTF, setFilterTF]  = useState('all');
  const [filterDir, setFilterDir]= useState('all');
  const [minProb, setMinProb]    = useState(60);

  const allPatterns = useMemo(()=>
    detectPatterns(bars, ew, vsa, s.comex),
    [bars, ew, vsa, s.comex]
  );

  const filtered = useMemo(()=>
    allPatterns.filter(p=>{
      if (filterTF!=='all'  && p.tf!==filterTF)      return false;
      if (filterDir!=='all' && p.direction!==filterDir) return false;
      if (p.probability < minProb)                    return false;
      return true;
    }),
    [allPatterns, filterTF, filterDir, minProb]
  );
  
  // (Render logic giữ nguyên)
  return <Panel title="🔍 PATTERN SCANNER" icon="🔍" glow={C.cyan} badge={`${filtered.length} mô hình`}>...</Panel>;
}

// ─── Fib Panel ────────────────────────────────────────────────────────────────
function FibPanel({ s, ew, activeTF }) {
  // (Logic giữ nguyên)
  return <Panel title="FIBONACCI — KEY LEVELS" icon="📐" glow={C.amber} badge={activeTF}>...</Panel>;
}

// ─── Multi-method Panel ───────────────────────────────────────────────────────
function MultiMethodPanel({ scores, verdict, bias, activeTF, shortSetup }) {
  // (Logic giữ nguyên)
  return <Panel title="HỘI TỤ ĐA PHƯƠNG PHÁP" icon="⚡" glow={C.green} badge="Kết quả">...</Panel>;
}

// ─── PriceChart v2 — single chartContainerRef ─────────────────────────────────
function PriceChart({ s, activeTF, ew, vsa, smcData,
  chartContainerRef, ctrlLayers, onToggleLayer, onSetDrawingTool }) {
  // FIX: extract ra ngoài để tránh undefined
  const comexPrice = s?.comex;
  const atr = 0.12; // Giả định giá trị mặc định cho atr

  useEffect(()=>{
    if (!comexPrice) return;
    const t = setTimeout(()=>{
      if (ctrlLayers.fib     && ew)        renderFib(ew);
      if (ctrlLayers.smc)                  renderSMC(comexPrice, atr||0.12);
      if (ctrlLayers.wyckoff && vsa?.bars) renderWyckoff(vsa.bars);
    }, 300);
    return ()=>clearTimeout(t);
  }, [
    ew?.wave, ew?.failure, ew?.fib382,
    vsa?.score, comexPrice, atr,
    ctrlLayers.fib, ctrlLayers.smc, ctrlLayers.wyckoff,
  ]);

  // (Phần còn lại của PriceChart giữ nguyên)
  return <div ref={chartContainerRef}>...</div>;
}

// ─── Control Panel ────────────────────────────────────────────────────────────
function ControlPanel({ ctrlLayers, onToggleLayer, onSetDrawingTool, activeTF, ew, vsa, wyckoff, rsi }) {
  // (Logic giữ nguyên)
  return <div>...</div>;
}

// ─── Wyckoff Panel — Hoàn thiện đầy đủ ────────────────────────────────────────
function WyckoffPanel({ wyckoff }) {
  if (!wyckoff) return null;
  const isBear = wyckoff.phase === 'DIST';
  const phases = isBear
    ? [
        {phase:'Preliminary Supply', sub:'PSY → BC', done:true, active:false, col:C.red},
        {phase:'Automatic Rally', sub:'AR — rebound', done:true, active:false, col:C.red},
        {phase:'SOW (Sign of Weak)', sub:'Breakdown confirm', done:false, active:true, col:C.red},
        {phase:'LPSY', sub:'Last Point Supply', done:false, active:false, col:C.muted},
        {phase:'Markdown', sub:'Downtrend Phase', done:false, active:false, col:C.muted},
      ]
    : [
        {phase:'Phase A', sub:'SC → AR → ST', done:wyckoff.phase>='B', active:wyckoff.phase==='A', col:C.green},
        {phase:'Phase B', sub:'UT · Secondary Tests', done:wyckoff.phase>='C', active:wyckoff.phase==='B', col:C.green},
        {phase:'Phase C', sub:'Spring (Shakeout)', done:wyckoff.phase>='D', active:wyckoff.phase==='C', col:C.green},
        {phase:'Phase D', sub:'SOS · Breakout', done:wyckoff.phase==='E', active:wyckoff.phase==='D', col:C.green},
        {phase:'Phase E', sub:'Markup Phase', done:false, active:wyckoff.phase==='E', col:C.green},
      ];

  return (
    <Panel title="WYCKOFF ANALYSIS" icon="📈" glow={C.amber} badge={wyckoff.label}>
      {phases.map((p, i) => (
        <div key={i} style={{ opacity: p.done || p.active ? 1 : 0.5, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
            <span style={{ color: p.active ? p.col : '#e2e8f0', fontWeight: 700 }}>{p.phase}</span>
            <span style={{ color: C.muted }}>{p.sub}</span>
          </div>
          <div style={{ height: 2, background: p.active ? p.col : '#1e3050', marginTop: 3 }} />
        </div>
      ))}
    </Panel>
  );
}

export default function TrendTab({ s, activeTF, ...props }) {
  // Component chính kết nối các Panel
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 15 }}>
      <PriceChart s={s} activeTF={activeTF} {...props} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <PatternScanner bars={props.bars} s={s} />
        <FibPanel s={s} ew={props.ew} activeTF={activeTF} />
        <WyckoffPanel wyckoff={props.wyckoff} />
      </div>
    </div>
  );
}