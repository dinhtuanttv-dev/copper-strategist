// components/verdict/BlackSwanTimelineCard.jsx
import { cardStyle, lblStyle } from './shared';

export function BlackSwanTimelineCard({ blackSwans, C }) {
  const swans = blackSwans?.length ? blackSwans : DEFAULT_SWANS;

  return (
    <div style={cardStyle(C)}>
      <div style={lblStyle(C)}>⚠ Black swan timeline — 30 ngày</div>
      <div style={{ position:'relative', height:70 }}>
        <div style={{ position:'absolute', top:'50%', left:0, right:0, height:1, background:C.grid }}/>
        <div style={{ position:'absolute', top:'10%', bottom:'10%', left:6, width:1.5, background:C.blue, opacity:0.6 }}/>
        <div style={{ position:'absolute', top:2, left:8, fontSize:8, color:C.blue }}>Now</div>
        {swans.map((swan, i) => {
          const size = 24 + (swan.probability / 100) * 30;
          const color = swan.direction === 'bull' ? C.green : swan.direction === 'bear' ? C.red : C.amber;
          const leftPct = swan.daysFromNow ? (swan.daysFromNow / 30) * 100 : 15 + i * 20;
          const topPct = 30 + (i % 3) * 20;
          return (
            <div key={i}>
              <div style={{
                position:'absolute', width:size, height:size,
                left:`calc(${leftPct}% - ${size/2}px)`, top:`calc(${topPct}% - ${size/2}px)`,
                borderRadius:'50%', background:`${color}18`, border:`1px solid ${color}55`,
                color, display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:9, fontFamily:'monospace', fontWeight:500,
              }}>{swan.probability}%</div>
              <div style={{
                position:'absolute', fontSize:8, bottom:0,
                left:`calc(${leftPct}% - 16px)`, color,
              }}>{swan.shortName}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display:'flex', gap:10, marginTop:4, fontSize:9, color:C.muted }}>
        <span><span style={{ color:C.green }}>●</span> Bullish Cu</span>
        <span><span style={{ color:C.red }}>●</span> Bearish Cu</span>
        <span style={{ marginLeft:'auto' }}>Kích thước = mức tác động</span>
      </div>
    </div>
  );
}

const DEFAULT_SWANS = [
  { shortName:'T.war', direction:'bear', probability:35, daysFromNow:5 },
  { shortName:'CPI',   direction:'amber',probability:25, daysFromNow:10 },
  { shortName:'Chile', direction:'bull', probability:35, daysFromNow:15 },
  { shortName:'CN stim',direction:'bull',probability:60, daysFromNow:22 },
  { shortName:'Fed',   direction:'bull', probability:45, daysFromNow:28 },
];