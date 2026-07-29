// components/verdict/RegimeCard.jsx
import { cardStyle, lblStyle } from './shared';

export function RegimeCard({ regime, C }) {
  const color = regime?.regime === 'risk_off' ? C.red
    : regime?.regime === 'stagflation' ? C.amber : C.green;

  return (
    <div style={cardStyle(C, color)}>
      <div style={lblStyle(C)}>📡 Regime</div>
      <div style={{ fontSize:13, fontWeight:500, color, textAlign:'center', marginBottom:4 }}>
        {regime?.label || 'Loading...'}
      </div>
      <div style={{ fontSize:10, color:C.muted, textAlign:'center', marginBottom:8 }}>
        {regime?.desc || ''}
      </div>
      <div style={{ display:'grid', gap:4 }}>
        <Row label="DXY" value={regime?.dxy < 0 ? 'Giảm ↓' : 'Tăng ↑'}
          color={regime?.dxy < 0 ? C.green : C.red} C={C} />
        <Row label="Fear&Greed" value={regime?.fearGreed || '--'} color={C.amber} C={C} />
        <Row label="Cu/Au ratio" value={regime?.cuGoldRatio?.toFixed(3) || '--'} color={C.green} C={C} />
        <Row label="Tech weight" value={`${Math.round((regime?.weights?.technical || 0.3)*100)}%`} color={C.blue} C={C} />
      </div>
      <div style={{ marginTop:8, fontSize:9, color:C.grid, textAlign:'center',
        borderTop:`0.5px solid ${C.grid}`, paddingTop:5 }}>
        Trọng số tự điều chỉnh
      </div>
    </div>
  );
}

function Row({ label, value, color, C }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}>
      <span style={{ color:C.muted }}>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  );
}