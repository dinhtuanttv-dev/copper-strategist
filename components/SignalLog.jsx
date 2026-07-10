// ─── Real-time AI Signal Log panel ───────────────────────────────────────────
import { useMemo } from 'react';

const C = {
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b',
  blue:'#3b82f6', purple:'#8b5cf6', teal:'#14b8a6', muted:'#5a7090',
};

const TYPE_META = {
  signal_buy:  { col:C.green,  icon:'🟢', label:'BUY'      },
  signal_sell: { col:C.red,    icon:'🔴', label:'SELL'     },
  confirm:     { col:C.teal,   icon:'✅', label:'CONFIRM'  },
  analyzing:   { col:C.blue,   icon:'⟳', label:'AI'       },
  im_impact:   { col:C.amber,  icon:'🌐', label:'IM'       },
  warn:        { col:C.amber,  icon:'⚠️', label:'WARN'     },
  info:        { col:C.muted,  icon:'·', label:'INFO'     },
};

function LogEntry({ entry, index }) {
  const meta   = TYPE_META[entry.type] || TYPE_META.info;
  const isNew  = index === 0;
  const time   = new Date(entry.timestamp).toLocaleTimeString('vi-VN', {
    hour:'2-digit', minute:'2-digit', second:'2-digit',
  });

  return (
    <div style={{
      display:'flex', gap:7, alignItems:'flex-start',
      padding:'5px 8px', borderRadius:6, marginBottom:3,
      background: isNew ? `${meta.col}10` : 'transparent',
      border: `0.5px solid ${isNew ? meta.col+'44' : '#1e3050'}`,
      transition:'background 0.3s',
    }}>
      <span style={{ fontSize:10, flexShrink:0 }}>{meta.icon}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:9, color: isNew?'#e2e8f0':'#b0b8d0',
          lineHeight:1.55, wordBreak:'break-word' }}>
          {entry.message}
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column',
        alignItems:'flex-end', gap:2, flexShrink:0 }}>
        <span style={{ fontSize:8, padding:'1px 5px', borderRadius:3,
          fontWeight:600, background:meta.col+'22', color:meta.col,
          border:`0.5px solid ${meta.col}44` }}>{meta.label}</span>
        <span style={{ fontSize:7, color:C.muted, ...{fontFamily:'monospace'} }}>
          {time}
        </span>
      </div>
    </div>
  );
}

export default function SignalLog({ logs = [], maxHeight = 340 }) {
  const stats = useMemo(() => ({
    buy:  logs.filter(l => l.type==='signal_buy').length,
    sell: logs.filter(l => l.type==='signal_sell').length,
    conf: logs.filter(l => l.type==='confirm').length,
  }), [logs]);

  return (
    <div style={{ background:'#060d18', border:'1px solid #1e3050',
      borderRadius:11, padding:'11px 13px' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between',
        alignItems:'center', marginBottom:8 }}>
        <div style={{ fontSize:10, fontWeight:600, color:'#e2e8f0',
          display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ width:6, height:6, borderRadius:'50%',
            background:C.green, display:'inline-block',
            animation:'pulse 1.5s ease-in-out infinite' }}/>
          TÍN HIỆU AI &amp; LOG THỜI GIAN
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {[
            { label:`${stats.buy} BUY`,  col:C.green },
            { label:`${stats.sell} SELL`,col:C.red   },
            { label:`${stats.conf} CONF`,col:C.teal  },
          ].map((s,i) => (
            <span key={i} style={{ fontSize:7, padding:'1px 5px', borderRadius:3,
              background:s.col+'22', color:s.col,
              border:`0.5px solid ${s.col}44` }}>{s.label}</span>
          ))}
        </div>
      </div>

      {/* Log list */}
      <div style={{ maxHeight, overflowY:'auto',
        scrollbarWidth:'thin', scrollbarColor:`#1e3050 transparent` }}>
        {logs.length === 0 ? (
          <div style={{ padding:'16px 0', textAlign:'center',
            color:C.muted, fontSize:9 }}>
            AI Detection đang chờ tín hiệu...
          </div>
        ) : (
          logs.map((entry, i) => (
            <LogEntry key={`${entry.timestamp}_${i}`} entry={entry} index={i} />
          ))
        )}
      </div>
    </div>
  );
}