// ─── Inter-market Correlation Heatmap panel ───────────────────────────────────
import { useMemo } from 'react';

const C = {
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b',
  blue:'#3b82f6', teal:'#14b8a6', cyan:'#06b6d4',
  muted:'#5a7090', purple:'#8b5cf6',
};

const ASSETS_META = {
  DXY:  { name:'DXY',      flag:'🇺🇸', corrDefault:-0.75, desc:'USD Index'        },
  SPX:  { name:'S&P 500',  flag:'🇺🇸', corrDefault:+0.62, desc:'Risk-on indicator'},
  XAU:  { name:'XAU',      flag:'🇺🇸', corrDefault:+0.45, desc:'Gold'             },
  XAG:  { name:'XAG',      flag:'🇺🇸', corrDefault:+0.78, desc:'Silver'           },
  PLAT: { name:'PLAT',     flag:'🇺🇸', corrDefault:+0.55, desc:'Platinum'         },
  OIL:  { name:'OIL',      flag:'🇺🇸', corrDefault:+0.40, desc:'WTI Crude'        },
  VIX:  { name:'VIX',      flag:'🇺🇸', corrDefault:-0.55, desc:'Fear Index'       },
  CN50: { name:'Shanghai', flag:'🇨🇳', corrDefault:+0.71, desc:'China stocks'     },
  SHFE: { name:'SHFE Cu',  flag:'🇨🇳', corrDefault:+0.95, desc:'Leading indicator'},
};

// Màu heatmap theo correlation + chg direction
function cellStyle(corr, chg) {
  const aligned = (corr>0&&chg>0)||(corr<0&&chg<0);
  const abs     = Math.abs(corr);
  if (abs >= 0.70 && aligned)  return { bg:`${C.green}33`, color:C.green,  signal:'HỖ TRỢ' };
  if (abs >= 0.50 && aligned)  return { bg:`${C.green}22`, color:C.green,  signal:'NHẸ ↑' };
  if (abs >= 0.70 && !aligned) return { bg:`${C.red}33`,   color:C.red,    signal:'CẢN TRỞ'};
  if (abs >= 0.50 && !aligned) return { bg:`${C.red}22`,   color:C.red,    signal:'NHẸ ↓' };
  return                               { bg:'#0f1e30',       color:C.muted,  signal:'TRUNG' };
}

function AssetRow({ sym, asset, corr }) {
  const meta   = ASSETS_META[sym] || {};
  const chg    = asset?.chg || 0;
  const price  = asset?.price;
  const src    = asset?.source || 'loading';
  const style  = cellStyle(corr || meta.corrDefault || 0, chg);
  const barPct = Math.round(Math.abs(corr || meta.corrDefault || 0) * 100);
  const isCN   = meta.flag === '🇨🇳';

  return (
    <div style={{ display:'flex', alignItems:'center', gap:6,
      padding:'4px 7px', borderRadius:6, marginBottom:3,
      background:'#0a1520',
      border:`0.5px solid ${isCN?C.amber+'44':style.bg}` }}>
      <span style={{ fontSize:10, flexShrink:0 }}>{meta.flag}</span>
      <div style={{ width:36, flexShrink:0 }}>
        <div style={{ fontSize:9, fontWeight:600,
          color:isCN?C.amber:'#e2e8f0' }}>{sym}</div>
        <div style={{ fontSize:7, color:C.muted }}>{meta.desc}</div>
      </div>
      <div style={{ ...{fontFamily:'monospace'}, fontSize:10, fontWeight:700,
        color:chg>=0?C.green:C.red, width:42, flexShrink:0 }}>
        {price!=null?price:'–'}
      </div>
      <div style={{ fontSize:8,
        color:chg>=0?C.green:C.red, width:32, flexShrink:0 }}>
        {chg>=0?'▲':'▼'}{Math.abs(chg).toFixed(2)}%
      </div>
      <div style={{ flex:1 }}>
        <div style={{ background:'#1e3050', borderRadius:2, height:4, overflow:'hidden' }}>
          <div style={{ width:`${barPct}%`, height:'100%',
            background:style.color, borderRadius:2 }}/>
        </div>
      </div>
      <div style={{ ...{fontFamily:'monospace'}, fontSize:8,
        color:style.color, width:28, textAlign:'right' }}>
        {(corr||meta.corrDefault||0).toFixed(2)}
      </div>
      <span style={{ fontSize:7, padding:'1px 5px', borderRadius:3,
        background:style.bg, color:style.color,
        border:`0.5px solid ${style.color}44`, flexShrink:0, minWidth:36,
        textAlign:'center' }}>{style.signal}</span>
      <span style={{ fontSize:7,
        color:src==='yahoo'?C.green:src==='claude'?C.amber:C.muted }}>
        {src==='yahoo'?'✅':src==='claude'?'🤖':'⟳'}
      </span>
    </div>
  );
}

function HeatmapGrid({ assets, correlations }) {
  const pairs = Object.keys(ASSETS_META);
  return (
    <div>
      <div style={{ fontSize:8, color:C.muted, marginBottom:5 }}>
        Ma trận tương quan 30D rolling — Pearson
      </div>
      <div style={{ display:'grid',
        gridTemplateColumns:'repeat(3,1fr)', gap:4, marginBottom:8 }}>
        {pairs.slice(0,6).map(sym => {
          const corr   = correlations?.[sym] || ASSETS_META[sym]?.corrDefault || 0;
          const chg    = assets?.[sym]?.chg || 0;
          const style  = cellStyle(corr, chg);
          return (
            <div key={sym} style={{ background:style.bg, borderRadius:5,
              padding:'5px 7px', textAlign:'center',
              border:`0.5px solid ${style.color}33` }}>
              <div style={{ fontSize:8, color:C.muted }}>Cu/{sym}</div>
              <div style={{ ...{fontFamily:'monospace'}, fontSize:11,
                fontWeight:700, color:style.color }}>{corr.toFixed(2)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function IMHeatmap({ imData, onRefresh, isLoading }) {
  const assets       = imData?.assets       || {};
  const correlations = imData?.correlations || {};
  const signals      = imData?.signals      || {};

  // Tổng hợp AI impact message
  const aiImpact = useMemo(() => {
    const msgs = [];
    const dxy  = assets.DXY;
    const cn50 = assets.CN50;
    const shfe = assets.SHFE;
    if (dxy?.chg > 0.3)  msgs.push(`⚠️ DXY +${dxy.chg.toFixed(1)}% → Cu áp lực giảm`);
    if (dxy?.chg < -0.3) msgs.push(`✅ DXY ${dxy.chg.toFixed(1)}% → Cu hỗ trợ tăng`);
    if (cn50?.chg > 0.5) msgs.push(`✅ Shanghai +${cn50.chg.toFixed(1)}% → cầu TQ tăng`);
    if (shfe?.chg > 0.5) msgs.push(`✅ SHFE Cu +${shfe.chg.toFixed(1)}% → leading bullish`);
    if (shfe?.chg < -0.5)msgs.push(`⚠️ SHFE Cu ${shfe.chg.toFixed(1)}% → leading bearish`);
    return msgs;
  }, [assets]);

  return (
    <div style={{ background:'#060d18', border:'1px solid #1e3050',
      borderRadius:11, padding:'11px 13px' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between',
        alignItems:'center', marginBottom:9 }}>
        <div style={{ fontSize:10, fontWeight:600, color:'#e2e8f0',
          display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ fontSize:13 }}>🌐</span>
          LIÊN THỊ TRƯỜNG
        </div>
        <div style={{ display:'flex', gap:5, alignItems:'center' }}>
          {imData && <span style={{ fontSize:7, color:C.muted }}>
            {new Date(imData.updated_at||Date.now()).toLocaleTimeString('vi-VN')}
          </span>}
          <button onClick={()=>onRefresh?.(true)} disabled={isLoading} style={{
            fontSize:8, padding:'2px 8px', borderRadius:4,
            border:`0.5px solid ${C.blue}`, background:`${C.blue}18`,
            color:C.blue, cursor:'pointer',
          }}>
            <span style={{ animation:isLoading?'spin 1s linear infinite':'' }}>
              {isLoading?'⟳':'🔄'}
            </span>
          </button>
        </div>
      </div>

      {/* Asset rows */}
      {Object.keys(ASSETS_META).map(sym => (
        <AssetRow
          key={sym} sym={sym}
          asset={assets[sym]}
          corr={correlations[sym]}
        />
      ))}

      {/* Heatmap grid */}
      <div style={{ marginTop:8, borderTop:'0.5px solid #1e3050', paddingTop:8 }}>
        <HeatmapGrid assets={assets} correlations={correlations} />
      </div>

      {/* AI Impact signals */}
      {aiImpact.length > 0 && (
        <div style={{ borderTop:'0.5px solid #1e3050', paddingTop:7 }}>
          <div style={{ fontSize:8, color:C.muted, marginBottom:4 }}>
            AI tác động liên thị trường
          </div>
          {aiImpact.map((msg,i) => (
            <div key={i} style={{ fontSize:9, color:'#b0b8d0',
              padding:'2px 0', lineHeight:1.5 }}>{msg}</div>
          ))}
        </div>
      )}
    </div>
  );
}