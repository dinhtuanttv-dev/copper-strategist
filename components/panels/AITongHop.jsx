// ─── AI Tổng Hợp ──────────────────────────────────────────────────────────────
import { useState, useCallback, useMemo } from 'react';
import { C, mono, sc } from '../constants/colors';

export default function AITongHop({ safeS, ew, vsa, wyckoff,
  scores, bias, activeTF, shortSetup, imSignals }) {
  const [text,    setText]    = useState('');
  const [loading, setLoading] = useState(false);

  const avg = scores.length
    ? Math.round(scores.reduce((a,s)=>a+s.score,0)/scores.length) : 50;
  const col = sc(avg);

  const imSummary = useMemo(()=>{
    if (!imSignals) return '';
    const sup = Object.entries(imSignals)
      .filter(([,v])=>v.col===C.green).map(([k])=>k);
    const res = Object.entries(imSignals)
      .filter(([,v])=>v.col===C.red).map(([k])=>k);
    const p = [];
    if (sup.length) p.push(`${sup.join('+')} hỗ trợ`);
    if (res.length) p.push(`${res.join('+')} cản trở`);
    return p.join(' · ');
  },[imSignals]);

  const generate = useCallback(async()=>{
    setLoading(true);
    try {
      const shortNote = shortSetup?.active
        ?`\nSHORT SETUP ACTIVE: Entry $${shortSetup.entry?.low}–$${shortSetup.entry?.high}, SL $${shortSetup.sl}, TP1 $${shortSetup.tp1}.`:'';
      const imNote = imSummary?`\nLiên thị trường: ${imSummary}.`:'';
      const r = await fetch('/api/claude',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          model:'claude-sonnet-4-5', max_tokens:500,
          messages:[{ role:'user', content:
            `Bạn là chuyên gia phân tích kỹ thuật đồng COMEX.
Tổng hợp tiếng Việt ~90 từ cho ${activeTF}:
- Elliott: ${ew.label} (${ew.prob||0}%) — ${ew.scenario||''}
- VSA: ${vsa.meta?.label} Vol=${vsa.latestBar?.volRatio||1}×
- Wyckoff: ${wyckoff.label} (${wyckoff.confidence||0}%)
- RSI=${ew.rsi||50} ATR=${vsa.atr?.toFixed(3)||0}
- COMEX=$${(safeS.comex||6.07).toFixed(3)} Bias=${bias}/100 Confluence=${avg}/100${shortNote}${imNote}
Kết luận: ${shortSetup?.active?'SHORT setup + ':''}entry/hành động tối ưu.`
          }],
        }),
      });
      const d = await r.json();
      const t = (d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
      if (t) setText(t);
    } catch(e){ console.error('[AITongHop]',e); }
    finally{ setLoading(false); }
  },[ew,vsa,wyckoff,safeS,bias,avg,activeTF,shortSetup,imSummary]);

  return (
    <div style={{ background:'#060d18', border:`1px solid ${col}44`,
      borderRadius:11, padding:'11px 14px' }}>
      <div style={{ display:'flex', alignItems:'center',
        gap:10, flexWrap:'wrap', marginBottom:8 }}>
        <div style={{ width:44,height:44,borderRadius:'50%',flexShrink:0,
          background:`conic-gradient(${col} ${avg}%,#0f1e30 0)`,
          display:'flex',alignItems:'center',justifyContent:'center' }}>
          <div style={{ width:33,height:33,borderRadius:'50%',background:'#060d18',
            display:'flex',flexDirection:'column',alignItems:'center',
            justifyContent:'center' }}>
            <div style={{ ...mono,fontSize:13,fontWeight:700,
              color:col,lineHeight:1 }}>{avg}</div>
            <div style={{ fontSize:6,color:col }}>
              {avg>=70?'MUA':avg>=50?'TÍCH LŨY':'BÁN'}
            </div>
          </div>
        </div>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontSize:10,fontWeight:600,color:col,marginBottom:2 }}>
            🤖 AI Tổng Hợp — {activeTF}
          </div>
          {text
            ?<div style={{ fontSize:9,color:'#b0b8d0',lineHeight:1.7 }}>{text}</div>
            :<div style={{ fontSize:9,color:C.muted }}>
              {ew.label} · {wyckoff.label} · {vsa.meta?.short}
              {imSummary&&<span style={{ color:C.cyan }}> · {imSummary}</span>}
              {shortSetup?.active&&
                <span style={{ color:C.red,fontWeight:600 }}> · 📉 SHORT ACTIVE</span>}
            </div>}
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',
          gap:5,flexShrink:0 }}>
          {[
            {lbl:'Entry',val:`$${ew.fib500?.toFixed(3)||'–'}`,col:C.green},
            {lbl:'TP1',val:`$${(safeS.tp1||6.32).toFixed(3)}`,col:C.teal},
            {lbl:'TP2',val:`$${(safeS.tp2||6.58).toFixed(3)}`,col:C.cyan},
            {lbl:'SL',val:`$${ew.fib618?.toFixed(3)||'–'}`,col:C.red},
            {lbl:'R:R',val:'1 : 2.4',col:C.amber},
            {lbl:'Vốn',val:'2% vốn',col:C.purple},
          ].map((m,i)=>(
            <div key={i} style={{ background:'#0a1520',borderRadius:5,
              padding:'4px 6px',textAlign:'center',
              border:`0.5px solid ${m.col}33` }}>
              <div style={{ fontSize:7,color:C.muted }}>{m.lbl}</div>
              <div style={{ ...mono,fontSize:9,fontWeight:700,color:m.col }}>
                {m.val}
              </div>
            </div>
          ))}
        </div>
      </div>
      <button onClick={generate} disabled={loading} style={{
        width:'100%',padding:'9px',borderRadius:8,
        background:loading?'#0f1e30':`${col}18`,
        border:`1px solid ${loading?'#1e3050':col}`,
        color:loading?C.muted:col,fontSize:10,fontWeight:700,
        cursor:loading?'default':'pointer',
        display:'flex',alignItems:'center',justifyContent:'center',gap:6,
      }}>
        <span style={{ animation:loading?'spin 1s linear infinite':'',
          display:'inline-block' }}>{loading?'⟳':'⚡'}</span>
        {loading?'Đang phân tích...'
          :`Kích Hoạt AI Phân Tích Sâu — ${activeTF}: Elliott + VSA + Wyckoff + SMC + Liên TT`}
      </button>
    </div>
  );
}