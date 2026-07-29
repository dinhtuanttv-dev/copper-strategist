// components/verdict/TradeReadinessCard.jsx
import { cardStyle, lblStyle, barWrap } from './shared';

export function TradeReadinessCard({ readiness, C }) {
  return (
    <div style={cardStyle(C)}>
      <div style={lblStyle(C)}>✓ Trade readiness — {readiness?.total || 7} điều kiện</div>
      {(readiness?.checks || []).map((check, i) => (
        <div key={check.id} style={{
          display:'flex', alignItems:'center', gap:7, padding:'4px 0',
          borderBottom: i < readiness.checks.length-1 ? `0.5px solid ${C.grid}` : 'none',
        }}>
          <div style={{
            width:17, height:17, borderRadius:'50%', flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:10,
            background: check.ok ? `${C.green}22` : `${C.amber}22`,
            color: check.ok ? C.green : C.amber,
          }}>{check.ok ? '✓' : '!'}</div>
          <span style={{ fontSize:11, flex:1, color:'#e2e8f0' }}>{check.label}</span>
          <span style={{ fontSize:10, fontFamily:'monospace', color: check.ok ? C.green : C.amber }}>
            {check.value}
          </span>
        </div>
      ))}
      <div style={{ ...barWrap(C), marginTop:7 }}>
        <div style={{ height:'100%', width:`${readiness?.readiness || 0}%`,
          background:C.green, borderRadius:2 }}/>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:3, fontSize:10 }}>
        <span style={{ color:C.muted }}>{readiness?.passCount || 0}/{readiness?.total || 7} điều kiện</span>
        <span style={{ color:C.amber, fontWeight:500 }}>
          {readiness?.readiness >= 85 ? 'Sẵn sàng' : 'Cẩn thận'}
        </span>
      </div>
    </div>
  );
}