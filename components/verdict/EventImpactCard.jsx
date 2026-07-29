// components/verdict/EventImpactCard.jsx
import { cardStyle, lblStyle } from './shared';
import { simulateEventImpact } from '../../lib/verdictCalculations';

export function EventImpactCard({ calendar, comex, atr, C }) {
  const events = (calendar?.events || []).slice(0, 2);

  return (
    <div style={cardStyle(C)}>
      <div style={lblStyle(C)}>🧪 Event impact simulator + volatility cone</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7, marginBottom:7 }}>
        {events.map((event, i) => {
          const sim = simulateEventImpact(event.name);
          return (
            <div key={i} style={{ border:`0.5px solid ${C.grid}`, borderRadius:7, padding:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:C.red, flexShrink:0 }}/>
                <span style={{ fontSize:11, fontWeight:500, color:'#e2e8f0' }}>
                  {event.name} — {event.time} {event.date}
                </span>
              </div>
              {sim ? (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                  {Object.entries(sim.scenarios).map(([key, val], j) => (
                    <ImpactBox key={j} label={key} impact={val.avgImpact} freq={val.freq} C={C} />
                  ))}
                </div>
              ) : (
                <div style={{ fontSize:10, color:C.muted }}>Chưa có dữ liệu lịch sử cho sự kiện này</div>
              )}
            </div>
          );
        })}
        {events.length === 0 && (
          <div style={{ fontSize:11, color:C.muted, gridColumn:'1/-1', textAlign:'center', padding:'12px 0' }}>
            Không có sự kiện lớn sắp tới
          </div>
        )}
      </div>

      {/* Volatility Cone */}
      <div style={{ border:`0.5px solid ${C.grid}`, borderRadius:7, padding:7 }}>
        <div style={{ fontSize:9, color:C.muted, marginBottom:4, textTransform:'uppercase', letterSpacing:'.05em' }}>
          Volatility cone — biên độ kỳ vọng (ATR 90 ngày)
        </div>
        <VolatilityConeSVG comex={comex} atr={atr} C={C} />
      </div>
    </div>
  );
}

function ImpactBox({ label, impact, freq, C }) {
  const color = impact > 0.5 ? C.green : impact < -0.5 ? C.red : C.blue;
  return (
    <div style={{ background:`${color}08`, borderRadius:5, padding:5, textAlign:'center' }}>
      <div style={{ fontSize:9, color:C.muted, textTransform:'capitalize' }}>{label.replace('_',' ')}</div>
      <div style={{ fontSize:14, fontWeight:500, color, fontFamily:'monospace' }}>
        {impact > 0 ? '+' : ''}{impact}%
      </div>
      <div style={{ fontSize:9, color:C.amber }}>{freq}% lần</div>
    </div>
  );
}

function VolatilityConeSVG({ comex, atr, C }) {
  const at = (atr || 0.12) / (comex || 6.265) * 100; // % ATR
  return (
    <svg width="100%" height="50" viewBox="0 0 540 50">
      <line x1="0" y1="25" x2="540" y2="25" stroke={C.grid} strokeWidth="0.5"/>
      <polygon points="0,25 165,8 165,42" fill={`${C.red}12`} />
      <line x1="0" y1="25" x2="165" y2="8" stroke={C.red} strokeWidth="1" strokeDasharray="4,3"/>
      <line x1="0" y1="25" x2="165" y2="42" stroke={C.red} strokeWidth="1" strokeDasharray="4,3"/>
      <line x1="165" y1="2" x2="165" y2="48" stroke={C.red} strokeWidth="1.5"/>
      <polygon points="165,8 540,2 540,48 165,42" fill={`${C.amber}0a`} />
      <line x1="165" y1="8" x2="540" y2="2" stroke={C.amber} strokeWidth="1" strokeDasharray="4,3"/>
      <line x1="165" y1="42" x2="540" y2="48" stroke={C.amber} strokeWidth="1" strokeDasharray="4,3"/>
      <line x1="0" y1="25" x2="540" y2="25" stroke={C.blue} strokeWidth="1.5" strokeDasharray="6,3"/>
      <circle cx="55" cy="25" r="3.5" fill={C.blue}/>
      <text x="4" y="14" fill={C.red} fontSize="8" fontFamily="monospace">+{(at*1.5).toFixed(1)}%</text>
      <text x="4" y="40" fill={C.red} fontSize="8" fontFamily="monospace">−{(at*1.5).toFixed(1)}%</text>
      <text x="59" y="21" fill={C.blue} fontSize="8">${comex?.toFixed(3)} now</text>
      <text x="300" y="44" fill={C.amber} fontSize="8">Sau event — vol mở rộng</text>
    </svg>
  );
}