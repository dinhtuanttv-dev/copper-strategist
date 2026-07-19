// components/Layout.js — FINAL, fix SSR hydration + sessionInfo guard
import { useState, useEffect } from 'react';
import { getSession, getHunting, isOverlap } from '../lib/calculations';

// ─── Safe defaults — tránh crash khi SSR ─────────────────────────────────────
const SESSION_DEFAULT = { name:'Loading...', col:'#5a7090', icon:'🌐', active:false, label:'Loading...' };
const OVERLAP_DEFAULT = { overlap:false, name:'No Overlap', col:'#5a7090', vol:'--' };
const HUNT_DEFAULT    = { active:false, label:'No Hunt Zone', col:'#5a7090', huntUp:0, huntDown:0 };

const TABS = [
  { icon:'📡', label:'Tổng quan'        },
  { icon:'🌊', label:'Xu hướng & Mô hình'},
  { icon:'📦', label:'Nền tảng & Dòng tiền'},
  { icon:'🏁', label:'Verdict'           },
  { icon:'🌏', label:'Kế hoạch phiên'   },
];

const A = {
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b',
  blue:'#3b82f6',  teal:'#14b8a6', purple:'#8b5cf6',
  orange:'#f97316', cyan:'#06b6d4', muted:'#5a7090',
};

function PriceTicker({ priceData }) {
  const [mounted, setMounted] = useState(false);
  useEffect(()=>setMounted(true),[]);
  const s      = priceData || {};
  const up     = (s.comex_chg_pct||0) >= 0;
  const comex  = s.comex?.toFixed(3) || '6.070';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12,
      padding:'4px 14px', background:'#060d18',
      borderBottom:'1px solid #1e3050', fontSize:10, flexWrap:'wrap' }}>
      <span style={{ color:A.muted, fontWeight:700, fontSize:9 }}>
        ⚡ LIVE
      </span>
      <span style={{ fontFamily:'monospace', fontSize:13, fontWeight:800,
        color:up?A.green:A.red }}>
        COMEX ${comex}
      </span>
      <span style={{ color:up?A.green:A.red, fontSize:10 }}>
        {up?'▲':'▼'}{Math.abs(s.comex_chg_pct||0).toFixed(2)}%
      </span>
      {mounted && s.dxy && (
        <span style={{ color:A.muted, fontSize:9 }}>
          DXY {s.dxy?.toFixed(1)}
          <span style={{ color:(s.dxy_chg||0)<0?A.green:A.red, marginLeft:3 }}>
            {(s.dxy_chg||0)<0?'▼':'▲'}{Math.abs(s.dxy_chg||0).toFixed(2)}%
          </span>
        </span>
      )}
      {mounted && s.lme && (
        <span style={{ color:A.muted, fontSize:9 }}>
          LME ${(s.lme||0).toLocaleString()}
        </span>
      )}
      <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
        {mounted && s.rsi_h4 && (
          <span style={{ fontSize:9, padding:'1px 7px', borderRadius:4,
            background:`${s.rsi_h4>70?A.red:s.rsi_h4<30?A.green:A.amber}22`,
            color:s.rsi_h4>70?A.red:s.rsi_h4<30?A.green:A.amber }}>
            RSI {s.rsi_h4}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Layout({ children, tab, onTabChange, priceData, verdict }) {
  const [mounted, setMounted] = useState(false);

  // FIX: chỉ gọi getSession/isOverlap/getHunting sau khi mounted (client-side)
  // Tránh SSR crash vì Date.now() khác nhau server/client
  const [sessionInfo, setSessionInfo] = useState(SESSION_DEFAULT);
  const [overlapInfo, setOverlapInfo] = useState(OVERLAP_DEFAULT);
  const [huntInfo,    setHuntInfo]    = useState(HUNT_DEFAULT);

  useEffect(() => {
    setMounted(true);
    // Gọi sau mount — chỉ chạy client-side
    try { setSessionInfo({ ...getSession(), label: getSession().name }); } catch {}
    try { setOverlapInfo(isOverlap()); } catch {}
    try { setHuntInfo(getHunting(priceData)); } catch {}
  }, []);

  // Update hunt info khi price thay đổi
  useEffect(() => {
    if (!mounted) return;
    try { setHuntInfo(getHunting(priceData)); } catch {}
  }, [priceData?.comex, mounted]);

  // Update session mỗi phút
  useEffect(() => {
    if (!mounted) return;
    const id = setInterval(() => {
      try { setSessionInfo({ ...getSession(), label: getSession().name }); } catch {}
      try { setOverlapInfo(isOverlap()); } catch {}
    }, 60000);
    return () => clearInterval(id);
  }, [mounted]);

  const v    = verdict?.final || 0;
  const vCol = v>=70?A.green:v>=55?A.amber:v>=40?A.orange:A.red;

  return (
    <div style={{ minHeight:'100vh', background:'#040b14', color:'#e2e8f0',
      fontFamily:'system-ui,-apple-system,sans-serif' }}>

      {/* ── Price Ticker ── */}
      <PriceTicker priceData={priceData}/>

      {/* ── Header ── */}
      <div style={{ background:'#060d18', borderBottom:'1px solid #1e3050',
        padding:'8px 16px', display:'flex',
        alignItems:'center', justifyContent:'space-between',
        flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:8,
            background:`linear-gradient(135deg,${A.cyan},${A.blue})`,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:16, fontWeight:800 }}>
            ⚡
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:'#e2e8f0',
              letterSpacing:'.02em' }}>
              COPPER STRATEGIST
            </div>
            <div style={{ fontSize:8, color:A.muted }}>
              COMEX HG=F · Elliott + VSA + Wyckoff + SMC
            </div>
          </div>
        </div>

        {/* Session + Overlap info */}
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          {mounted && (
            <>
              <span style={{ fontSize:9, padding:'2px 8px', borderRadius:5,
                background:sessionInfo.col+'18', color:sessionInfo.col,
                border:`1px solid ${sessionInfo.col}33` }}>
                {sessionInfo.icon} {sessionInfo.label}
              </span>
              {overlapInfo.overlap && (
                <span style={{ fontSize:9, padding:'2px 8px', borderRadius:5,
                  background:overlapInfo.col+'18', color:overlapInfo.col,
                  border:`1px solid ${overlapInfo.col}33` }}>
                  ⚡ {overlapInfo.name} Overlap
                </span>
              )}
              {huntInfo.active && (
                <span style={{ fontSize:9, padding:'2px 8px', borderRadius:5,
                  background:huntInfo.col+'18', color:huntInfo.col,
                  border:`1px solid ${huntInfo.col}33` }}>
                  {huntInfo.label}
                </span>
              )}
            </>
          )}
          {v > 0 && (
            <span style={{ fontSize:9, padding:'2px 8px', borderRadius:5,
              background:vCol+'22', color:vCol,
              border:`1px solid ${vCol}44`, fontWeight:700 }}>
              Verdict {v}/100
            </span>
          )}
        </div>
      </div>

      {/* ── Tab Nav ── */}
      <div style={{ background:'#060d18', borderBottom:'1px solid #1e3050',
        padding:'0 12px', display:'flex', gap:2, overflowX:'auto' }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => onTabChange?.(i)} style={{
            padding:'10px 14px', fontSize:10, fontWeight:tab===i?700:400,
            color:tab===i?A.cyan:A.muted, background:'transparent',
            border:'none', borderBottom:`2px solid ${tab===i?A.cyan:'transparent'}`,
            cursor:'pointer', whiteSpace:'nowrap',
            transition:'all .15s',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth:1400, margin:'0 auto',
        padding:'12px 14px', boxSizing:'border-box' }}>
        {children}
      </div>

      <style>{`
        * { box-sizing:border-box; }
        :root {
          --card:   #060d18;
          --card2:  #0a1520;
          --border: #1e3050;
          --text:   #e2e8f0;
          --muted:  #5a7090;
          --font-mono: monospace;
        }
        body { margin:0; background:#040b14; }
        button { font-family:inherit; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#1e3050; border-radius:4px; }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes glow { 0%,100%{opacity:1} 50%{opacity:.6} }
      `}</style>
    </div>
  );
}