// components/verdict/SmartMoneyCard.jsx — TIER 3: Behavioral edge
import { cardStyle, lblStyle, barWrap } from './shared';

export function SmartMoneyCard({ divergence, C }) {
  if (!divergence) return <div style={cardStyle(C)}>Đang tải COT data...</div>;

  const groups = [
    { label:'Commercials',   data:divergence.commercials,   color:C.red },
    { label:'Managed money', data:divergence.managedMoney,  color:C.green },
    { label:'Non-reportable',data:divergence.nonReportable, color:C.blue },
  ];

  return (
    <div style={cardStyle(C)}>
      <div style={lblStyle(C)}>👥 Smart money divergence — COT 3 nhóm</div>
      <div style={{ marginBottom:8 }}>
        {groups.map((g, i) => {
          const total = Math.abs(g.data.long) + Math.abs(g.data.short);
          const longPct = total > 0 ? (g.data.long / total) * 100 : 50;
          const shortPct = 100 - longPct;
          return (
            <div key={i} style={{
              display:'flex', alignItems:'center', gap:7, padding:'5px 0',
              borderBottom: i < 2 ? `0.5px solid ${C.grid}` : 'none',
            }}>
              <div style={{ width:90, fontSize:10, color:C.muted }}>{g.label}</div>
              <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                <div>
                  <div style={{ fontSize:9, color:C.muted }}>Long</div>
                  <div style={{ ...barWrap(C), marginTop:2 }}>
                    <div style={{ height:'100%', width:`${longPct}%`, background:C.blue, borderRadius:2 }}/>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:9, color:C.muted }}>Short</div>
                  <div style={{ ...barWrap(C), marginTop:2 }}>
                    <div style={{ height:'100%', width:`${shortPct}%`, background:C.red, borderRadius:2 }}/>
                  </div>
                </div>
              </div>
              <div style={{
                textAlign:'right', fontSize:11, fontWeight:500, fontFamily:'monospace', minWidth:50,
                color: g.data.net > 0 ? C.green : g.data.net < 0 ? C.red : C.blue,
              }}>
                {g.data.net > 0 ? '+' : ''}{(g.data.net/1000).toFixed(1)}k
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize:9, color:divergence.isFallback ? C.amber : C.muted, marginBottom:6 }}>
        {divergence.isFallback ? '⚠ Dữ liệu COT tham khảo, chưa xác thực live' : `Nguồn: ${divergence.source}`}
      </div>

      {divergence.divergence && (
        <div style={{ padding:'7px 10px', background:`${C.green}10`,
          border:`0.5px solid ${C.green}33`, borderRadius:7, marginBottom:6 }}>
          <div style={{ fontSize:11, fontWeight:500, color:C.green, marginBottom:2 }}>Smart money setup</div>
          <div style={{ fontSize:10, color:'#b0b8d0' }}>{divergence.signal}</div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
        <div style={{ background:'#0a1520', border:`0.5px solid ${C.grid}`, borderRadius:6, padding:7 }}>
          <div style={{ fontSize:9, color:C.muted }}>Open interest trend</div>
          <div style={{ fontSize:12, fontWeight:500, color:C.green }}>
            {divergence.openInterestTrend > 0 ? '+' : ''}{divergence.openInterestTrend}%
          </div>
        </div>
        <div style={{ background:'#0a1520', border:`0.5px solid ${C.grid}`, borderRadius:6, padding:7 }}>
          <div style={{ fontSize:9, color:C.muted }}>Comm. short z-score</div>
          <div style={{ fontSize:12, fontWeight:500, color: Math.abs(divergence.commZScore) > 1.5 ? C.amber : C.blue }}>
            {divergence.commZScore > 0 ? '+' : ''}{divergence.commZScore}σ
          </div>
        </div>
      </div>
    </div>
  );
}