// components/TVChart.jsx — SVG chart + LWC fallback
import { useEffect, useRef, useState, useMemo } from 'react';

const C = {
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b',
  blue:'#3b82f6', purple:'#8b5cf6', muted:'#5a7090',
  bg:'#060d18', bg2:'#0a1520', grid:'#0f1e30',
};

// ─── SVG Chart nội bộ ─────────────────────────────────────────────────────────
function SVGCandleChart({ bars, activeTF, isLoading, ew, smcData, showFib, showSMC }) {
  const W=580, H=260, P={t:14,r:56,b:26,l:4};
  const iw=W-P.l-P.r, ih=H-P.t-P.b;

  const data = useMemo(()=>{
    if (!bars?.length) return [];
    return bars
      .filter(b=>b&&b.comex>0)
      .map(b=>({
        t: b.ts ? Math.floor(b.ts/1000) : 0,
        o: +(b.open||b.comex).toFixed(4),
        h: +(b.high||b.comex*1.003).toFixed(4),
        l: +(b.low||b.comex*0.997).toFixed(4),
        c: +b.comex.toFixed(4),
        v: b.vol||0,
      }))
      .filter(b=>b.t>0)
      .sort((a,b)=>a.t-b.t)
      .filter((v,i,a)=>i===0||v.t!==a[i-1].t)
      .slice(-80);
  },[bars]);

  if (isLoading && data.length < 2) return (
    <div style={{ width:'100%',height:H,background:C.bg,borderRadius:7,
      display:'flex',flexDirection:'column',alignItems:'center',
      justifyContent:'center',gap:8 }}>
      <div style={{ fontSize:22,animation:'spin 1s linear infinite',
        display:'inline-block',color:C.amber }}>⟳</div>
      <div style={{ color:C.muted,fontSize:10 }}>Đang tải {activeTF}...</div>
    </div>
  );

  if (data.length < 2) return (
    <div style={{ width:'100%',height:H,background:C.bg,borderRadius:7,
      display:'flex',flexDirection:'column',alignItems:'center',
      justifyContent:'center',gap:8,border:`1px dashed ${C.grid}` }}>
      <div style={{ fontSize:26 }}>📊</div>
      <div style={{ color:C.muted,fontSize:10 }}>Chưa có dữ liệu {activeTF}</div>
      <div style={{ color:C.grid,fontSize:8 }}>Nhấn ↺ để tải</div>
    </div>
  );

  const allH=data.map(d=>d.h), allL=data.map(d=>d.l);
  const pMax=Math.max(...allH), pMin=Math.min(...allL);
  const pRange=Math.max(pMax-pMin,0.001);
  const pad=pRange*0.06;
  const scMax=pMax+pad, scMin=pMin-pad, scR=scMax-scMin;
  const toY = p=>P.t+ih*(1-(p-scMin)/scR);
  const toX = i=>P.l+iw*(i/Math.max(data.length-1,1));
  const bw  = Math.max(1.5,(iw/data.length)*0.72);

  const yTicks = [0,0.25,0.5,0.75,1].map(f=>({
    y:P.t+ih*f, p:scMax-scR*f,
  }));
  const xIdxs = [0,
    Math.floor(data.length*0.25),
    Math.floor(data.length*0.5),
    Math.floor(data.length*0.75),
    data.length-1
  ].filter((v,i,a)=>v<data.length&&a.indexOf(v)===i);

  const last=data[data.length-1], first=data[0];
  const chg=((last.c-first.c)/first.c*100);
  const isUp=last.c>=first.c;
  const maxVol=Math.max(...data.map(d=>d.v),1);
  const volH=ih*0.12;

  const fibLines=showFib&&ew?[
    {p:ew.fib382,col:'#14b8a6',lbl:'0.382'},
    {p:ew.fib500,col:'#3b82f6',lbl:'0.500'},
    {p:ew.fib618,col:'#f59e0b',lbl:'0.618'},
    {p:ew.fib786,col:'#ef4444',lbl:'0.786'},
    {p:ew.w3Target,col:'#22c55e',lbl:'TP'},
  ].filter(l=>l.p>0&&l.p>scMin&&l.p<scMax):[];

  const smcLines=showSMC&&smcData?[
    {p:smcData.obBear?.[0],col:'#ef444477',lbl:'OB↓'},
    {p:smcData.obBull?.[1],col:'#22c55e77',lbl:'OB↑'},
    {p:smcData.liq,col:'#f59e0b77',lbl:'Liq'},
  ].filter(l=>l.p>0&&l.p>scMin&&l.p<scMax):[];

  return (
    <div style={{ width:'100%' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}
        style={{ background:C.bg,borderRadius:'7px 7px 0 0',display:'block' }}
        preserveAspectRatio="none">
        {/* Grid */}
        {yTicks.map((t,i)=>(
          <g key={i}>
            <line x1={P.l} y1={t.y} x2={W-P.r} y2={t.y}
              stroke={C.grid} strokeWidth={0.5} strokeDasharray="3,4" opacity={0.8}/>
            <text x={W-P.r+3} y={t.y+3.5} fill={C.muted}
              fontSize={7.5} fontFamily="monospace">${t.p.toFixed(3)}</text>
          </g>
        ))}
        {/* Fib lines */}
        {fibLines.map((l,i)=>(
          <g key={`f${i}`}>
            <line x1={P.l} y1={toY(l.p)} x2={W-P.r} y2={toY(l.p)}
              stroke={l.col} strokeWidth={0.8} strokeDasharray="6,3" opacity={0.8}/>
            <text x={W-P.r+3} y={toY(l.p)+3.5}
              fill={l.col} fontSize={6.5} fontFamily="monospace">{l.lbl}</text>
          </g>
        ))}
        {/* SMC lines */}
        {smcLines.map((l,i)=>(
          <line key={`s${i}`} x1={P.l} y1={toY(l.p)} x2={W-P.r} y2={toY(l.p)}
            stroke={l.col} strokeWidth={0.7} strokeDasharray="2,4" opacity={0.6}/>
        ))}
        {/* Volume */}
        {data.map((d,i)=>{
          const x=toX(i), vh=Math.max(1,(d.v/maxVol)*volH);
          return <rect key={`v${i}`} x={x-bw/2} y={H-P.b-vh} width={bw}
            height={vh} fill={d.c>=d.o?C.green:C.red} opacity={0.22}/>;
        })}
        {/* Candles */}
        {data.map((d,i)=>{
          const x=toX(i), up=d.c>=d.o, col=up?C.green:C.red;
          const by=toY(Math.max(d.o,d.c)), bh=Math.max(1,toY(Math.min(d.o,d.c))-by);
          return (
            <g key={i}>
              <line x1={x} y1={toY(d.h)} x2={x} y2={toY(d.l)}
                stroke={col} strokeWidth={0.8} opacity={0.85}/>
              <rect x={x-bw/2} y={by} width={bw} height={bh}
                fill={col} opacity={0.92}/>
            </g>
          );
        })}
        {/* Last price line */}
        <line x1={P.l} y1={toY(last.c)} x2={W-P.r} y2={toY(last.c)}
          stroke={isUp?C.green:C.red} strokeWidth={0.8}
          strokeDasharray="4,3" opacity={0.55}/>
        {/* Last price badge */}
        <rect x={W-P.r+1} y={toY(last.c)-8} width={52} height={16}
          rx={3} fill={isUp?C.green:C.red} opacity={0.95}/>
        <text x={W-P.r+27} y={toY(last.c)+4} fill="#050c16" fontSize={8.5}
          textAnchor="middle" fontWeight="bold" fontFamily="monospace">
          ${last.c.toFixed(3)}
        </text>
        {/* X labels */}
        {xIdxs.map((idx,k)=>(
          <text key={k} x={toX(idx)} y={H-4} fill={C.muted}
            fontSize={7.5} textAnchor="middle">
            {new Date(data[idx].t*1000)
              .toLocaleDateString('vi-VN',{month:'2-digit',day:'2-digit'})}
          </text>
        ))}
      </svg>
      {/* Info bar */}
      <div style={{ display:'flex',gap:10,alignItems:'center',
        padding:'3px 8px',background:C.bg2,
        borderRadius:'0 0 7px 7px',
        border:`0.5px solid ${C.grid}`,borderTop:'none',fontSize:8 }}>
        <span style={{ color:C.muted }}>{activeTF}</span>
        <span style={{ color:C.muted }}>{data.length} nến</span>
        <span style={{ fontFamily:'monospace',color:isUp?C.green:C.red }}>
          {isUp?'▲':'▼'}{Math.abs(chg).toFixed(2)}%
        </span>
        <span style={{ color:C.muted }}>H:{last.h.toFixed(3)} L:{last.l.toFixed(3)}</span>
        <span style={{ color:C.grid,marginLeft:'auto' }}>📊 Yahoo Finance · HG=F</span>
        {isLoading&&<span style={{ color:C.amber }}>⟳ cập nhật...</span>}
      </div>
    </div>
  );
}

// ─── Main export — dùng SVG chart trực tiếp ───────────────────────────────────
export default function TVChart({
  bars=[], activeTF='H4', ew=null, smcData=null,
  showFib=true, showSMC=true, showWyckoff=true,
  showVolume=true, isLoading=false, onCrosshair=null,
  chartContainerRef=null,
}) {
  return (
    <SVGCandleChart
      bars={bars} activeTF={activeTF} isLoading={isLoading}
      ew={ew} smcData={smcData} showFib={showFib} showSMC={showSMC}
    />
  );
}