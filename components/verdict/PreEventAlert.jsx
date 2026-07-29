// components/verdict/PreEventAlert.jsx
export function PreEventAlert({ event, atr, comex, C }) {
  if (!event) return null;
  const at = atr || 0.12;
  const cp = comex || 6.265;

  return (
    <div style={{
      background:`${C.red}12`, border:`1px solid ${C.red}55`,
      borderRadius:10, padding:'9px 12px',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
        <span style={{ color:C.red, fontSize:15 }}>⏰</span>
        <span style={{ fontSize:12, fontWeight:500, color:C.red }}>
          Pre-Event Alert — {event.name} còn {event.minutesUntil < 60
            ? `${event.minutesUntil} phút` : `${Math.floor(event.minutesUntil/60)}h ${event.minutesUntil%60}'`} ({event.time})
        </span>
        <span style={{ marginLeft:'auto', fontSize:10, padding:'2px 8px', borderRadius:4,
          background:`${C.red}18`, color:C.red, border:`0.5px solid ${C.red}44` }}>
          Dự báo {event.forecast || 'N/A'} · Trước {event.prev || 'N/A'}
        </span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
        <ActionBox color={C.red} label="Giảm size 50%" sub="1% → 0.5% vốn" />
        <ActionBox color={C.amber} label="Nới SL" sub={`SL hiện tại → mở rộng ${(at*0.3).toFixed(3)}`} />
        <ActionBox color={C.blue} label="Không mở lệnh mới" sub="Chờ 4h sau event" />
      </div>
    </div>
  );
}

function ActionBox({ color, label, sub }) {
  return (
    <div style={{ background:`${color}08`, border:`0.5px solid ${color}22`,
      borderRadius:6, padding:'6px 9px', textAlign:'center' }}>
      <div style={{ fontSize:11, fontWeight:500, color }}>{label}</div>
      <div style={{ fontSize:9, color:'#5a7090', marginTop:1 }}>{sub}</div>
    </div>
  );
}