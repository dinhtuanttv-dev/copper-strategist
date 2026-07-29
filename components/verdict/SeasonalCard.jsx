// components/verdict/SeasonalCard.jsx — TIER 3: Behavioral edge
import { cardStyle, lblStyle } from './shared';
import { SEASONAL_PATTERN_10Y } from '../../lib/verdictCalculations';

const MONTH_LABELS = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];

export function SeasonalCard({ seasonal, C }) {
  const currentMonth = new Date().getMonth() + 1;

  return (
    <div style={cardStyle(C)}>
      <div style={lblStyle(C)}>📅 Seasonal pattern overlay — lịch sử 10 năm</div>
      <div style={{ border:`0.5px solid ${C.grid}`, borderRadius:7, padding:8, marginBottom:7 }}>
        <div style={{ fontSize:9, color:C.muted, marginBottom:5 }}>
          Hiệu suất trung bình Cu theo tháng (%) — 2015–2024
        </div>
        <SeasonalBarChart currentMonth={currentMonth} C={C} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
        <div style={{ padding:'7px 10px', background:`${C.green}08`,
          border:`0.5px solid ${C.green}33`, borderRadius:7 }}>
          <div style={{ fontSize:11, fontWeight:500, color:C.green }}>
            {MONTH_LABELS[currentMonth-1]} hiện tại
          </div>
          <div style={{ fontSize:20, fontWeight:500, color:C.green, fontFamily:'monospace', margin:'3px 0' }}>
            {seasonal?.current?.avgReturn > 0 ? '+' : ''}{seasonal?.current?.avgReturn}%
          </div>
          <div style={{ fontSize:9, color:C.muted }}>{seasonal?.note}</div>
        </div>
        <div style={{ padding:'7px 10px',
          background: (seasonal?.nextMonth?.avgReturn||0) > 0 ? `${C.green}08` : `${C.red}08`,
          border:`0.5px solid ${(seasonal?.nextMonth?.avgReturn||0) > 0 ? C.green : C.red}33`, borderRadius:7 }}>
          <div style={{ fontSize:11, fontWeight:500,
            color: (seasonal?.nextMonth?.avgReturn||0) > 0 ? C.green : C.red }}>
            {MONTH_LABELS[currentMonth % 12]} sắp tới
          </div>
          <div style={{ fontSize:20, fontWeight:500, fontFamily:'monospace', margin:'3px 0',
            color: (seasonal?.nextMonth?.avgReturn||0) > 0 ? C.green : C.red }}>
            {seasonal?.nextMonth?.avgReturn > 0 ? '+' : ''}{seasonal?.nextMonth?.avgReturn}%
          </div>
          <div style={{ fontSize:9, color:C.muted }}>
            {(seasonal?.nextMonth?.avgReturn||0) > 0 ? 'Historically bullish' : 'Historically weak'}
          </div>
        </div>
      </div>
    </div>
  );
}

function SeasonalBarChart({ currentMonth, C }) {
  const maxAbs = Math.max(...SEASONAL_PATTERN_10Y.map(m => Math.abs(m.avgReturn)));
  const w = 560, h = 70, barW = 36, gap = 10;

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
      <line x1="0" y1={h/2} x2={w} y2={h/2} stroke={C.grid} strokeWidth="0.5"/>
      {SEASONAL_PATTERN_10Y.map((m, i) => {
        const x = 4 + i * (barW + gap);
        const barH = (Math.abs(m.avgReturn) / maxAbs) * (h/2 - 8);
        const y = m.avgReturn >= 0 ? h/2 - barH : h/2;
        const color = m.avgReturn >= 0 ? C.green : C.red;
        const opacity = 0.2 + (Math.abs(m.avgReturn) / maxAbs) * 0.55;
        const isCurrent = m.month === currentMonth;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={Math.max(barH,3)} rx={3}
              fill={color} opacity={opacity}
              stroke={isCurrent ? C.blue : 'none'} strokeWidth={isCurrent ? 1.5 : 0}/>
            <text x={x + barW/2} y={h-2} fill={isCurrent ? C.blue : C.muted}
              fontSize="8" textAnchor="middle" fontWeight={isCurrent?500:400}>
              {MONTH_LABELS[i]}
            </text>
            {isCurrent && (
              <text x={x + barW/2} y={y - 4} fill={C.blue} fontSize="8" textAnchor="middle">Now</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}