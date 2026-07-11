// ─── ShortSetupPanel ──────────────────────────────────────────────────────────
import { C, mono } from '../constants/colors';
import { Bdg } from '../ui/Primitives';

export default function ShortSetupPanel({ shortSetup }) {
  if (!shortSetup?.active) return null;
  return (
    <div style={{ background:`${C.red}12`, border:`1.5px solid ${C.red}`,
      borderRadius:11, padding:'12px 14px' }}>
      <div style={{ display:'flex', justifyContent:'space-between',
        alignItems:'center', marginBottom:9 }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.red }}>
          📉 SHORT SETUP — KÍCH HOẠT
        </div>
        <Bdg label={`Strength ${shortSetup.strength}/100`} col={C.red}/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)',
        gap:5, marginBottom:9 }}>
        {[
          {lbl:'Verdict <40',     ok:shortSetup.conditions?.cond1},
          {lbl:'Elliott W5/Fail', ok:shortSetup.conditions?.cond2},
          {lbl:'VSA Bearish',     ok:shortSetup.conditions?.cond3},
          {lbl:'DXY Tăng',        ok:shortSetup.conditions?.cond4},
        ].map((c,i)=>(
          <div key={i} style={{ display:'flex', gap:6, alignItems:'center',
            padding:'4px 7px', borderRadius:5,
            background:c.ok?`${C.red}08`:`${C.muted}08` }}>
            <span style={{ fontSize:10 }}>{c.ok?'✅':'❌'}</span>
            <span style={{ fontSize:9, color:c.ok?'#e2e8f0':C.muted }}>
              {c.lbl}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)',
        gap:5, marginBottom:7 }}>
        {[
          {lbl:'📍 Entry',
           val:`$${shortSetup.entry?.low}–$${shortSetup.entry?.high}`,col:C.red},
          {lbl:'🛑 SL',  val:`$${shortSetup.sl}`,  col:C.amber},
          {lbl:'🎯 TP1', val:`$${shortSetup.tp1}`, col:C.green},
          {lbl:'🎯 TP2', val:`$${shortSetup.tp2}`, col:C.teal},
          {lbl:'🎯 TP3', val:`$${shortSetup.tp3}`, col:C.cyan},
          {lbl:'📊 R:R',
           val:`1:${shortSetup.rr}`,
           col:shortSetup.rr>=2?C.green:C.amber},
        ].map((p,i)=>(
          <div key={i} style={{ background:'#0a1520', borderRadius:5,
            padding:'5px 7px', border:`0.5px solid ${p.col}33` }}>
            <div style={{ fontSize:8, color:C.muted }}>{p.lbl}</div>
            <div style={{ ...mono, fontSize:10, fontWeight:700, color:p.col }}>
              {p.val}
            </div>
          </div>
        ))}
      </div>
      <div style={{ background:`${C.red}08`, borderRadius:7, padding:'7px 9px' }}>
        <div style={{ fontSize:9, fontWeight:700, color:C.red, marginBottom:2 }}>
          📌 LUẬN ĐIỂM SHORT
        </div>
        <div style={{ fontSize:9, color:'#b0b8d0', lineHeight:1.65 }}>
          {shortSetup.thesis}
        </div>
        <div style={{ fontSize:8, color:C.red, marginTop:5, fontWeight:600 }}>
          Trigger: {shortSetup.trigger}
        </div>
        <div style={{ fontSize:8, color:C.muted, marginTop:2 }}>
          ⛔ Vô hiệu: {shortSetup.invalidation}
        </div>
      </div>
    </div>
  );
}