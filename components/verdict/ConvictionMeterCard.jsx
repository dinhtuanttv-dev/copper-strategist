// components/verdict/ConvictionMeterCard.jsx
import { cardStyle, lblStyle, barWrap } from './shared';

export function ConvictionMeterCard({ conviction, scenarios, C }) {
  const conf = conviction?.confluence || 50;
  const color = conf >= 65 ? C.green : conf >= 45 ? C.amber : C.red;

  const rings = [
    { r: 43, val: conviction?.longTerm || 50, opacity: 0.35, label: 'W/M dài hạn' },
    { r: 31, val: conviction?.midTerm  || 50, opacity: 0.65, label: 'D/H4 trung hạn' },
    { r: 19, val: conviction?.shortTerm|| 50, opacity: 1,    label: 'H1/M15 ngắn hạn' },
  ];

  return (
    <div style={cardStyle(C, color)}>
      <div style={lblStyle(C)}>◎ Conviction meter — 3 khung thời gian</div>
      <div style={{ display:'flex', alignItems:'center', gap:14 }}>
        <svg width="96" height="96" viewBox="0 0 96 96" style={{ flexShrink:0 }}>
          {rings.map((ring, i) => {
            const circumference = 2 * Math.PI * ring.r;
            const offset = circumference * (1 - ring.val/100);
            return (
              <g key={i}>
                <circle cx="48" cy="48" r={ring.r} fill="none" stroke={C.grid} strokeWidth="6"/>
                <circle cx="48" cy="48" r={ring.r} fill="none" stroke={color} strokeWidth="6"
                  strokeDasharray={circumference} strokeDashoffset={offset}
                  strokeLinecap="round" transform="rotate(-90 48 48)" opacity={ring.opacity}/>
              </g>
            );
          })}
          <text x="48" y="44" textAnchor="middle" fontSize="17" fontWeight="500" fill={color} fontFamily="monospace">
            {conf}
          </text>
          <text x="48" y="58" textAnchor="middle" fontSize="9" fill={C.muted}>confluence</text>
        </svg>
        <div style={{ flex:1 }}>
          {rings.map((ring, i) => (
            <div key={i} style={{ marginBottom: i===2?8:5 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}>
                <span style={{ color:C.muted }}>{ring.label}</span>
                <span style={{ color, fontWeight:500, opacity:ring.opacity }}>{ring.val}</span>
              </div>
              <div style={barWrap(C)}>
                <div style={{ height:'100%', width:`${ring.val}%`, background:color,
                  opacity:ring.opacity, borderRadius:2 }}/>
              </div>
            </div>
          ))}
          <div style={{ borderLeft:`2px solid ${color}`, padding:'5px 9px',
            borderRadius:'0 6px 6px 0', background:`${color}10` }}>
            <div style={{ fontSize:11, fontWeight:500, color }}>
              {conviction?.bluf?.action || 'Đang tính toán...'}
            </div>
            <div style={{ fontSize:10, color:'#b0b8d0', marginTop:1 }}>
              Entry ${scenarios?.base?.entry?.toFixed(3)} · SL ${scenarios?.base?.sl?.toFixed(3)} · TP ${scenarios?.base?.tp1?.toFixed(3)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}