// components/SignalLog.jsx — FINAL
import { useMemo } from 'react';

const C = {
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b',
  blue:'#3b82f6', teal:'#14b8a6', purple:'#8b5cf6', muted:'#5a7090',
  bg:'#060d18', bg2:'#0a1520', grid:'#0f1e30',
};

const TYPE_META = {
  signal_buy:  { col:C.green,  icon:'🟢', label:'BUY'  },
  signal_sell: { col:C.red,    icon:'🔴', label:'SELL' },
  confirm:     { col:C.teal,   icon:'✅', label:'CONF' },
  analyzing:   { col:C.blue,   icon:'⟳',  label:'AI'   },
  im_impact:   { col:C.amber,  icon:'🌐', label:'IM'   },
  warn:        { col:C.amber,  icon:'⚠️', label:'WARN' },
  info:        { col:C.muted,  icon:'·',  label:'INFO' },
};

function cleanMsg(msg) {
  if (!msg) return '';
  if (msg.includes('402')) return '⚠️ API quota hết — kiểm tra OpenRouter balance';
  if (msg.includes('401')) return '⚠️ API key không hợp lệ';
  if (msg.includes('429')) return '⚠️ Rate limit — thử lại sau 60 giây';
  if (msg.includes('50'))  return '⚠️ Server lỗi tạm thời';
  return msg;
}

function LogRow({ entry, isFirst }) {
  const meta = TYPE_META[entry.type] || TYPE_META.info;
  const msg  = cleanMsg(entry.message);
  const isWarn = msg.startsWith('⚠️') || entry.type === 'warn';
  const col    = isWarn ? C.amber : meta.col;
  const time   = new Date(entry.timestamp || Date.now())
    .toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  return (
    <div style={{
      display:'flex', gap:7, alignItems:'flex-start',
      padding:'5px 8px', borderRadius:6, marginBottom:3,
      background: isFirst ? `${col}10` : 'transparent',
      border: `0.5px solid ${isFirst ? col+'55' : C.grid}`,
    }}>
      <span style={{ fontSize:11, flexShrink:0 }}>{meta.icon}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{
          fontSize:9, color: isWarn ? C.amber : (isFirst ? '#e2e8f0' : '#b0b8d0'),
          lineHeight:1.6, wordBreak:'break-word',
        }}>{msg}</div>
      </div>
      <div style={{ display:'flex', flexDirection:'column',
        alignItems:'flex-end', gap:2, flexShrink:0 }}>
        <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3,
          background:`${col}22`, color:col, border:`0.5px solid ${col}44` }}>
          {isWarn ? 'WARN' : meta.label}
        </span>
        <span style={{ fontSize:7, color:C.muted, fontFamily:'monospace' }}>{time}</span>
      </div>
    </div>
  );
}

export default function SignalLog({ logs = [], maxHeight = 280 }) {
  const deduped = useMemo(()=>{
    const seen = new Set();
    return (logs || []).filter(l => {
      const key = cleanMsg(l.message || '').slice(0, 50);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }, [logs]);

  const stats = useMemo(()=>({
    buy:  deduped.filter(l=>l.type==='signal_buy').length,
    sell: deduped.filter(l=>l.type==='signal_sell').length,
    warn: deduped.filter(l=>l.type==='warn'||cleanMsg(l.message||'').startsWith('⚠️')).length,
  }), [deduped]);

  return (
    <div style={{ background:C.bg, border:`1px solid ${C.grid}`,
      borderRadius:11, padding:'11px 13px' }}>
      <div style={{ display:'flex', justifyContent:'space-between',
        alignItems:'center', marginBottom:8 }}>
        <div style={{ fontSize:10, fontWeight:600, color:'#e2e8f0',
          display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:C.green,
            display:'inline-block', animation:'pulse 1.5s ease-in-out infinite' }}/>
          TÍN HIỆU AI &amp; LOG THỜI GIAN
        </div>
        <div style={{ display:'flex', gap:4 }}>
          {stats.buy>0&&<span style={{ fontSize:7,padding:'1px 5px',borderRadius:3,
            background:C.green+'22',color:C.green,border:`0.5px solid ${C.green}44` }}>
            {stats.buy} BUY</span>}
          {stats.sell>0&&<span style={{ fontSize:7,padding:'1px 5px',borderRadius:3,
            background:C.red+'22',color:C.red,border:`0.5px solid ${C.red}44` }}>
            {stats.sell} SELL</span>}
          {stats.warn>0&&<span style={{ fontSize:7,padding:'1px 5px',borderRadius:3,
            background:C.amber+'22',color:C.amber,border:`0.5px solid ${C.amber}44` }}>
            {stats.warn} WARN</span>}
        </div>
      </div>

      {stats.warn >= 2 && (
        <div style={{ background:`${C.amber}10`, border:`0.5px solid ${C.amber}44`,
          borderRadius:7, padding:'6px 10px', marginBottom:8,
          fontSize:9, color:C.amber }}>
          💡 Kiểm tra OpenRouter balance:{' '}
          <b>openrouter.ai/settings/credits</b>
        </div>
      )}

      <div style={{ maxHeight, overflowY:'auto',
        scrollbarWidth:'thin', scrollbarColor:`${C.grid} transparent` }}>
        {deduped.length === 0 ? (
          <div style={{ padding:'16px 0', textAlign:'center',
            color:C.muted, fontSize:9 }}>
            AI Detection đang chờ tín hiệu...
          </div>
        ) : deduped.map((entry, i) => (
          <LogRow key={`${entry.timestamp}_${i}`} entry={entry} isFirst={i===0}/>
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );
}