// ─── UI primitives dùng chung ─────────────────────────────────────────────────
import { C } from '../constants/colors';

export function Bdg({ label, col, size=8 }) {
  return (
    <span style={{
      fontSize:size, padding:'2px 7px', borderRadius:4,
      fontWeight:700, background:col+'22', color:col,
      border:`0.5px solid ${col}44`, whiteSpace:'nowrap',
    }}>{label}</span>
  );
}

export function Panel({ title, icon, glow, children, badge, badgeCol }) {
  return (
    <div style={{
      background:'#060d18', border:`1px solid ${glow||'#1e3050'}`,
      borderRadius:11, padding:'11px 13px',
      boxShadow:glow?`0 0 14px ${glow}14`:'none',
    }}>
      <div style={{
        display:'flex', justifyContent:'space-between',
        alignItems:'center', marginBottom:9, flexWrap:'wrap', gap:5,
      }}>
        <div style={{
          fontSize:10, fontWeight:600, color:'#e2e8f0',
          display:'flex', alignItems:'center', gap:5,
        }}>
          {icon&&<span style={{ fontSize:13 }}>{icon}</span>}
          {title}
        </div>
        {badge&&<Bdg label={badge} col={badgeCol||C.blue}/>}
      </div>
      {children}
    </div>
  );
}

export function SBar({ label, score, col, sc }) {
  const c = col||sc(score);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
      <span style={{ fontSize:9, color:C.muted, width:80, flexShrink:0 }}>
        {label}
      </span>
      <div style={{ flex:1, background:'#0f1e30', borderRadius:2,
        height:5, overflow:'hidden' }}>
        <div style={{ width:`${score}%`, height:'100%', background:c,
          borderRadius:2, transition:'width .5s' }}/>
      </div>
      <span style={{ fontSize:9, fontWeight:700, color:c,
        width:22, textAlign:'right' }}>{score}</span>
    </div>
  );
}

export function ToggleSwitch({ label, active, onChange, col, small }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between',
      alignItems:'center', marginBottom:small?4:6 }}>
      <span style={{ fontSize:small?8:9,
        color:active?'#e2e8f0':C.muted }}>{label}</span>
      <div onClick={()=>onChange(!active)} style={{
        width:28, height:14, borderRadius:7, position:'relative',
        cursor:'pointer', flexShrink:0, transition:'background .2s',
        background:active?(col||C.green)+'44':'#1e3050',
        border:`0.5px solid ${active?(col||C.green):'#1e3050'}`,
      }}>
        <div style={{
          width:10, height:10, borderRadius:'50%', position:'absolute',
          top:1, transition:'left .2s, background .2s', left:active?16:2,
          background:active?(col||C.green):C.muted,
        }}/>
      </div>
    </div>
  );
}