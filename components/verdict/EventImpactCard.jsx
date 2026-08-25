// components/verdict/EventImpactCard.jsx
import { cardStyle, lblStyle } from './shared';
import { simulateEventImpact } from '../../lib/verdictCalculations';
import { useEffect, useState } from 'react';

export function EventImpactCard({ calendar, comex, atr, C }) {
  const events = Array.isArray(calendar?.events) ? calendar.events.slice(0, 2) : [];
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={cardStyle(C)}>
      <div style={lblStyle(C)}>🧪 Event impact simulator + volatility cone</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7, marginBottom:7 }}>
        {events.map((event, i) => {
          const sim = simulateEventImpact(event.name || 'Sự kiện');
          const timestamp = Number(event.timestamp);
          const minutesUntil = Number.isFinite(timestamp) ? (timestamp - now) / 60000 : null;
          const countdown = minutesUntil == null
            ? 'Chưa có thời gian realtime'
            : minutesUntil < 0
              ? 'Đã diễn ra'
              : minutesUntil < 60
                ? `Còn ${Math.ceil(minutesUntil)} phút`
                : `Còn ${Math.floor(minutesUntil / 60)}h ${Math.floor(minutesUntil % 60)}'`;
          const expectedImpact = sim
            ? Object.values(sim.scenarios).reduce((sum, scenario) => sum + scenario.avgImpact * scenario.freq / 100, 0)
            : null;
          return (
            <div key={i} style={{ border:`0.5px solid ${C.grid}`, borderRadius:7, padding:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:C.red, flexShrink:0 }}/>
                <span style={{ fontSize:11, fontWeight:500, color:'#e2e8f0' }}>
                  {event.name}{event.isFallback ? ' — dữ liệu tham khảo' : ` — ${event.time} ${event.date}`}
                </span>
              </div>
              <div style={{ fontSize:9, color:minutesUntil == null ? C.muted : minutesUntil < 60 ? C.red : C.amber, marginBottom:6 }}>
                ⏱ {countdown}
              </div>
              {sim ? (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                    {Object.entries(sim.scenarios).map(([key, val], j) => (
                      <ImpactBox key={j} label={key} impact={val.avgImpact} freq={val.freq} C={C} />
                    ))}
                  </div>
                  <div style={{ marginTop:6, fontSize:9, color:C.muted }}>
                    Tác động kỳ vọng: <strong style={{ color:expectedImpact >= 0 ? C.green : C.red }}>
                      {expectedImpact >= 0 ? '+' : ''}{expectedImpact.toFixed(2)}%
                    </strong> (weighted theo tần suất lịch sử)
                  </div>
                </>
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
          Volatility cone — biên độ ước tính từ ATR hiện tại
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
  const price = Number.isFinite(Number(comex)) && Number(comex) > 0 ? Number(comex) : 6.265;
  const atrValue = Number.isFinite(Number(atr)) && Number(atr) > 0 ? Number(atr) : 0.12;
  const dailyVol = atrValue / price;
  const horizons = [1, 3, 7];
  const toY = (percent) => Math.max(2, Math.min(48, 25 - percent * 1000));
  const upper = horizons.map((days, index) => `${index * 270},${toY(dailyVol * Math.sqrt(days) * 2)}`).join(' ');
  const lower = horizons.map((days, index) => `${index * 270},${toY(-dailyVol * Math.sqrt(days) * 2)}`).join(' ');
  const oneDayPct = dailyVol * 100;
  const sevenDayPct = dailyVol * Math.sqrt(7) * 2 * 100;
  const oneDayMove = price * dailyVol;
  const sevenDayMove = price * dailyVol * Math.sqrt(7) * 2;
  return (
    <svg width="100%" height="50" viewBox="0 0 540 50">
      <line x1="0" y1="25" x2="540" y2="25" stroke={C.grid} strokeWidth="0.5"/>
      <polygon points={`0,25 ${upper} ${lower.split(' ').reverse().join(' ')}`} fill={`${C.amber}12`} />
      <polyline points={upper} fill="none" stroke={C.amber} strokeWidth="1" strokeDasharray="4,3"/>
      <polyline points={lower} fill="none" stroke={C.amber} strokeWidth="1" strokeDasharray="4,3"/>
      <line x1="0" y1="2" x2="0" y2="48" stroke={C.red} strokeWidth="1.5"/>
      <line x1="0" y1="25" x2="540" y2="25" stroke={C.blue} strokeWidth="1.5" strokeDasharray="6,3"/>
      <circle cx="55" cy="25" r="3.5" fill={C.blue}/>
      <text x="4" y="14" fill={C.red} fontSize="8" fontFamily="monospace">±{oneDayPct.toFixed(2)}% / 1d</text>
      <text x="4" y="40" fill={C.amber} fontSize="8" fontFamily="monospace">±{sevenDayPct.toFixed(2)}% / 7d</text>
      <text x="59" y="21" fill={C.blue} fontSize="8">${price.toFixed(3)} now</text>
      <text x="300" y="44" fill={C.amber} fontSize="8">ATR × √thời gian · ước tính</text>
      <text x="300" y="12" fill={C.amber} fontSize="8">1d ${Math.max(0, price-oneDayMove).toFixed(3)}–${(price+oneDayMove).toFixed(3)}</text>
      <text x="410" y="12" fill={C.amber} fontSize="8">7d ${Math.max(0, price-sevenDayMove).toFixed(3)}–${(price+sevenDayMove).toFixed(3)}</text>
    </svg>
  );
}