// components/verdict/SmartNewsCard.jsx
import { cardStyle, lblStyle } from './shared';

const TAG_COLORS = { Supply:'green', Demand:'blue', Macro:'amber', FX:'purple', Urgent:'red', urgent:'red', supply:'green', demand:'blue', macro:'amber', fx:'purple' };

export function SmartNewsCard({ news, C }) {
  const items = news?.length ? news : [];

  return (
    <div style={cardStyle(C)}>
      <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:7 }}>
        <div style={{ ...lblStyle(C), margin:0 }}>🔍 Smart news filter — NLP</div>
        <div style={{ marginLeft:'auto', display:'flex', gap:3 }}>
          {['Supply','Demand','Macro'].map(tag => (
            <span key={tag} style={{ fontSize:9, padding:'2px 6px', borderRadius:4,
              background:`${C[TAG_COLORS[tag]]||C.blue}18`, color:C[TAG_COLORS[tag]]||C.blue,
              border:`0.5px solid ${C[TAG_COLORS[tag]]||C.blue}33` }}>{tag}</span>
          ))}
        </div>
      </div>

      {items.length === 0 && (
        <div style={{ fontSize:11, color:C.muted, textAlign:'center', padding:'16px 0' }}>
          Chưa có tin tức vượt ngưỡng relevance
        </div>
      )}

      {items.slice(0, 4).map((item, i) => {
        const color = item.score >= 8 ? C.red : item.score >= 6.5 ? C.amber : C.green;
        return (
          <div key={i} style={{
            display:'flex', gap:8, padding:'5px 0', alignItems:'flex-start',
            borderBottom: i < 3 ? `0.5px solid ${C.grid}` : 'none',
          }}>
            <div style={{
              width:24, height:24, borderRadius:5, flexShrink:0,
              background:`${color}18`, color, display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:10, fontWeight:500, fontFamily:'monospace',
            }}>{item.score.toFixed(1)}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:11, fontWeight:500, color:'#e2e8f0' }}>{item.title}</div>
              <div style={{ fontSize:10, color:C.muted, marginTop:1 }}>
                {item.source} · {item.age} ·{' '}
                <span style={{ color: item.direction === 'bull' ? C.green : item.direction === 'bear' ? C.red : C.muted }}>
                  {item.direction === 'bull' ? '+Bull Cu' : item.direction === 'bear' ? '−Bear Cu' : 'Neutral'}
                </span>
              </div>
              {item.tags?.length > 0 && (
                <div style={{ display:'flex', gap:3, marginTop:2 }}>
                  {item.tags.slice(0,2).map((tag, j) => (
                    <span key={j} style={{ fontSize:9, padding:'1px 5px', borderRadius:3,
                      background:`${C[TAG_COLORS[tag]]||C.blue}10`, color:C[TAG_COLORS[tag]]||C.blue }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div style={{ textAlign:'center', padding:'5px 0', fontSize:9, color:C.muted,
        borderTop:`0.5px solid ${C.grid}`, marginTop:4 }}>
        {items.length}/127 tin hôm nay vượt ngưỡng impact ≥ 6.0
      </div>
    </div>
  );
}