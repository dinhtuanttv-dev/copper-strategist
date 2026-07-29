// components/verdict/CopperIntelCard.jsx
import { cardStyle, lblStyle, metricBox, barWrap } from './shared';

export function CopperIntelCard({ copperIntel, C }) {
  if (!copperIntel) return <div style={cardStyle(C)}>Đang tải...</div>;

  const metrics = [
    { key:'shanghaiPremium', label:'Shanghai premium', fmt: v => `+$${v}`, pct: 72 },
    { key:'shfeLmeRatio',    label:'SHFE/LME ratio',    fmt: v => v.toFixed(3), pct: 68 },
    { key:'tcRc',            label:'TC/RC margin',      fmt: v => `$${v}`, pct: 38 },
    { key:'googleTrends',    label:'Google Trends TQ',  fmt: v => `+${v}%`, pct: 65, sub:true },
  ];

  return (
    <div style={cardStyle(C)}>
      <div style={lblStyle(C)}>📈 Copper intelligence — chỉ báo chuyên biệt</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:7 }}>
        {metrics.map(m => {
          const data = copperIntel[m.key];
          const value = m.sub ? data?.change : data?.value;
          const color = data?.signal === 'bullish' ? C.green
            : data?.signal === 'supply_tight' ? C.amber : C.blue;
          return (
            <div key={m.key} style={metricBox(C)}>
              <div style={{ fontSize:9, color:C.muted }}>{m.label}</div>
              <div style={{ fontSize:16, fontWeight:500, color, fontFamily:'monospace', margin:'2px 0' }}>
                {value != null ? m.fmt(value) : '--'}
              </div>
              <div style={{ fontSize:9, color }}>↑ {data?.label}</div>
              <div style={{ ...barWrap(C), marginTop:4 }}>
                <div style={{ height:'100%', width:`${m.pct}%`, background:color, borderRadius:2 }}/>
              </div>
            </div>
          );
        })}
      </div>

      {/* Forward curve mini SVG */}
      <div style={{ border:`0.5px solid ${C.grid}`, borderRadius:6, padding:'6px 8px' }}>
        <div style={{ fontSize:9, color:C.muted, marginBottom:4 }}>
          CME forward curve — backwardation bullish
        </div>
        <ForwardCurveSVG C={C} isBackwardation={copperIntel.shfeLmeRatio?.value > 1} />
      </div>
    </div>
  );
}

function ForwardCurveSVG({ C, isBackwardation }) {
  const pts = isBackwardation
    ? "8,24 52,18 104,14 156,15 208,18 252,22"
    : "8,14 52,16 104,18 156,20 208,23 252,26";
  return (
    <svg width="100%" height="32" viewBox="0 0 260 32">
      <line x1="0" y1="26" x2="260" y2="26" stroke={C.grid} strokeWidth="0.5"/>
      <polyline points={pts} fill="none" stroke={isBackwardation?C.green:C.amber} strokeWidth="1.8" strokeLinecap="round"/>
      <polyline points={`${pts} 252,32 8,32`} fill={`${isBackwardation?C.green:C.amber}12`} stroke="none"/>
      <text x="8" y="31" fill={C.muted} fontSize="7" fontFamily="monospace">Spot</text>
      <text x="88" y="10" fill={isBackwardation?C.green:C.amber} fontSize="7">
        {isBackwardation ? 'BACKWARDATION' : 'CONTANGO'}
      </text>
      <text x="232" y="20" fill={C.muted} fontSize="7" fontFamily="monospace">12M</text>
    </svg>
  );
}