// ─── Left column: FibPanel + MultiMethodPanel ─────────────────────────────────
import { useMemo } from 'react';
import { C, mono, sc } from '../constants/colors';
import { Bdg, Panel, SBar } from '../ui/Primitives';

export function FibPanel({ safeS, ew, activeTF }) {
  const cu = safeS.comex||6.07;
  const levels = [
    { lbl:'Fib 1.618 — TP3',  price:ew.w3Target||+(cu*1.10).toFixed(3),  tag:'TP3',   col:C.cyan  },
    { lbl:'Fib 1.272 — TP2',  price:safeS.tp2||+(cu*1.058).toFixed(3),   tag:'TP2',   col:C.teal  },
    { lbl:'Fib 1.000 — TP1',  price:safeS.tp1||+(cu*1.025).toFixed(3),   tag:'TP1',   col:C.green },
    { lbl:'▶ Giá Hiện Tại',   price:cu,                                   tag:'NOW',   col:C.blue  },
    { lbl:'Fib 0.500 — Entry',price:ew.fib500||+(cu*0.985).toFixed(3),   tag:'Entry', col:C.green },
    { lbl:'Fib 0.618 — SL–',  price:ew.fib618||+(cu*0.975).toFixed(3),   tag:'SL–',   col:C.amber },
    { lbl:'Fib 0.786 — SL=',  price:ew.fib786||+(cu*0.960).toFixed(3),   tag:'SL=',   col:C.red   },
  ].sort((a,b)=>b.price-a.price);

  const tagCol = {
    TP3:C.cyan, TP2:C.teal, TP1:C.green, NOW:C.blue,
    Entry:C.green, 'SL–':C.amber, 'SL=':C.red,
  };

  return (
    <Panel title="FIBONACCI — KEY LEVELS" icon="📐"
      glow={C.amber} badge={activeTF} badgeCol={C.blue}>
      {levels.map((lv,i)=>{
        const isNow = lv.tag==='NOW';
        const tc    = tagCol[lv.tag]||C.muted;
        const dist  = cu>0?+((lv.price-cu)/cu*100).toFixed(2):0;
        return (
          <div key={i} style={{
            display:'flex', alignItems:'center', gap:5,
            padding:'5px 7px', borderRadius:6, marginBottom:3,
            background:isNow?`${C.blue}18`:'#060d18',
            border:`0.5px solid ${isNow?C.blue:'#1e3050'}`,
          }}>
            <div style={{ fontSize:9, color:C.muted, flex:1 }}>{lv.lbl}</div>
            <div style={{ ...mono, fontSize:11, fontWeight:700, color:lv.col }}>
              ${lv.price.toFixed(3)}
            </div>
            <span style={{ fontSize:7, ...mono, color:dist>=0?C.green:C.red }}>
              {dist>=0?'+':''}{dist}%
            </span>
            <span style={{
              fontSize:7, padding:'1px 5px', borderRadius:3,
              fontWeight:700, background:tc+'22', color:tc,
              border:`0.5px solid ${tc}44`, minWidth:30, textAlign:'center',
            }}>{lv.tag}</span>
          </div>
        );
      })}
    </Panel>
  );
}

export function MultiMethodPanel({ scores, bias, activeTF, shortSetup }) {
  const avg  = scores.length
    ? Math.round(scores.reduce((a,s)=>a+s.score,0)/scores.length) : 50;
  const col  = sc(avg);
  const pass = scores.filter(s=>s.score>=65).length;

  return (
    <Panel title="HỘI TỤ ĐA PHƯƠNG PHÁP" icon="⚡"
      glow={col} badge={`${pass}/${scores.length} đồng thuận`} badgeCol={col}>
      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:10 }}>
        <div style={{
          width:56, height:56, borderRadius:'50%', flexShrink:0,
          background:`conic-gradient(${col} ${avg}%,#0f1e30 0)`,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <div style={{
            width:42, height:42, borderRadius:'50%', background:'#060d18',
            display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center',
          }}>
            <div style={{ ...mono, fontSize:16, fontWeight:700,
              color:col, lineHeight:1 }}>{avg}</div>
            <div style={{ fontSize:7, color:col, fontWeight:600 }}>
              {avg>=70?'MUA':avg>=50?'THEO DÕI':'BÁN'}
            </div>
          </div>
        </div>
        <svg width="54" height="54" viewBox="0 0 54 54">
          {(()=>{
            const cx=27,cy=27,R=22,n=scores.length;
            const pts=scores.map((s,i)=>{
              const a=(i/n)*Math.PI*2-Math.PI/2, f=s.score/100;
              return `${(cx+R*f*Math.cos(a)).toFixed(1)},${(cy+R*f*Math.sin(a)).toFixed(1)}`;
            }).join(' ');
            return (<>
              {[0.33,0.66,1].map((f,gi)=>(
                <polygon key={gi} fill="none" stroke="#1e3050"
                  strokeWidth={gi===2?0.8:0.4}
                  points={scores.map((_,i)=>{
                    const a=(i/n)*Math.PI*2-Math.PI/2;
                    return `${(cx+R*f*Math.cos(a)).toFixed(1)},${(cy+R*f*Math.sin(a)).toFixed(1)}`;
                  }).join(' ')}/>
              ))}
              {scores.map((_,i)=>{
                const a=(i/n)*Math.PI*2-Math.PI/2;
                return <line key={i} x1={cx} y1={cy} stroke="#1e3050"
                  strokeWidth={0.4}
                  x2={(cx+R*Math.cos(a)).toFixed(1)}
                  y2={(cy+R*Math.sin(a)).toFixed(1)}/>;
              })}
              <polygon points={pts} fill={`${col}28`}
                stroke={col} strokeWidth={1.5} strokeLinejoin="round"/>
            </>);
          })()}
        </svg>
      </div>
      {scores.map((s,i)=>(
        <SBar key={i} label={s.label} score={s.score} col={sc(s.score)} sc={sc}/>
      ))}
      <div style={{
        marginTop:7, background:col+'12',
        border:`1px solid ${col}44`, borderRadius:8,
        padding:'7px 10px', textAlign:'center',
      }}>
        <div style={{ fontSize:10, fontWeight:700, color:col }}>
          VERDICT: {avg>=70?'MUA':avg>=50?'TÍCH LŨY':'BÁN'} — {activeTF}
        </div>
        <div style={{ fontSize:8, color:C.muted, marginTop:2 }}>
          {pass}/{scores.length} phương pháp đồng thuận TĂNG
        </div>
      </div>
      {shortSetup?.active&&(
        <div style={{ marginTop:6, background:C.red+'12',
          border:`1px solid ${C.red}55`, borderRadius:8, padding:'7px 10px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:C.red, marginBottom:3 }}>
            📉 SHORT SETUP KÍCH HOẠT
          </div>
          <div style={{ fontSize:8, color:C.muted }}>
            {shortSetup.strength}/100 · Entry
            ${shortSetup.entry?.low}–${shortSetup.entry?.high}
          </div>
        </div>
      )}
    </Panel>
  );
}