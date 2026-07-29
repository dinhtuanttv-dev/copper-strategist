// components/verdict/ScenarioCard.jsx
import { cardStyle } from './shared';

const TYPE_CFG = {
  bull: { title:'Kịch bản A — Bull case', letter:'A' },
  base: { title:'Kịch bản B — Base case', letter:'B' },
  bear: { title:'Kịch bản C — Bear case', letter:'C' },
};

export function ScenarioCard({ type, data, C }) {
  if (!data) return <div style={cardStyle(C)}>Đang tính toán...</div>;
  const cfg = TYPE_CFG[type];
  const color = type === 'bull' ? C.green : type === 'base' ? C.blue : C.red;
  const isBase = type === 'base';

  return (
    <div style={{ ...cardStyle(C, color), borderWidth: isBase ? 1.5 : 1 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:500, color }}>{cfg.title}</div>
          <div style={{ fontSize:9, color:'#5a7090', marginTop:1 }}>
            Xác suất {data.prob}% · {data.timeframe}{isBase ? ' · XÁC SUẤT CAO NHẤT' : ''}
          </div>
        </div>
        <span style={{ fontSize:10, fontWeight:500, padding:'2px 8px', borderRadius:4,
          background:`${color}18`, color, border:`0.5px solid ${color}44` }}>
          {data.prob}%
        </span>
      </div>

      <div style={{ fontSize:24, fontWeight:500, color, fontFamily:'monospace', marginBottom:2 }}>
        ${data.target}
      </div>
      <div style={{ fontSize:10, color:'#5a7090', marginBottom:8 }}>
        Target price
      </div>

      <div style={{ fontSize:10, fontWeight:500, color:'#5a7090', textTransform:'uppercase',
        letterSpacing:'.05em', marginBottom:5 }}>
        Điều kiện kích hoạt (dữ liệu thực)
      </div>
      <div style={{ display:'grid', gap:4, marginBottom:8 }}>
        {(data.conditions || []).map((cond, i) => (
          <div key={i} style={{ display:'flex', gap:6, fontSize:10 }}>
            <span style={{ color, flexShrink:0 }}>▸</span>
            <span style={{ color:'#b0b8d0' }}>{cond}</span>
          </div>
        ))}
        {!data.conditions?.length && (
          <div style={{ fontSize:10, color:'#5a7090' }}>Chưa đủ dữ liệu để xác định điều kiện</div>
        )}
      </div>

      {data.swans?.length > 0 && (
        <div style={{ borderTop:`0.5px solid ${C.grid}`, paddingTop:7, marginBottom:7 }}>
          <div style={{ fontSize:10, fontWeight:500, color:'#5a7090', textTransform:'uppercase',
            letterSpacing:'.05em', marginBottom:5 }}>
            Thiên nga đen liên quan
          </div>
          {data.swans.map((swan, i) => (
            <div key={i} style={{ display:'flex', gap:6, alignItems:'center', fontSize:10, marginBottom:2 }}>
              <span style={{ color, fontWeight:500 }}>{swan.probability}%</span>
              <span style={{ color:'#b0b8d0' }}>{swan.name}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ background:`${color}08`, borderRadius:6, padding:'7px 9px' }}>
        <div style={{ fontSize:11, fontWeight:500, color, marginBottom:3 }}>
          {type === 'bear' ? 'Thoát / short nếu' : 'Chiến lược'}
        </div>
        {type === 'bear' ? (
          <div style={{ fontSize:10, color:'#b0b8d0' }}>
            H4 đóng dưới <span style={{ color, fontFamily:'monospace' }}>${data.exitTrigger}</span> → exit ngay
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:`repeat(${isBase?4:3},1fr)`, gap:4 }}>
            <MiniStat label="Entry" value={`$${data.entry}`} color={color} />
            <MiniStat label={isBase?'TP1':'TP'} value={`$${data.target}`} color={C.green} />
            <MiniStat label="SL" value={`$${data.sl}`} color={C.red} />
            {isBase && <MiniStat label="R:R" value={`1:${data.rr}`} color={C.amber} />}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:9, color:'#5a7090' }}>{label}</div>
      <div style={{ fontSize:11, fontWeight:500, color, fontFamily:'monospace' }}>{value}</div>
    </div>
  );
}