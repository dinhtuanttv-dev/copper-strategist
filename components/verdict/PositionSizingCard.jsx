// components/verdict/PositionSizingCard.jsx
import { cardStyle, lblStyle, metricBox } from './shared';

export function PositionSizingCard({ positionSizing, optionsIntel, C }) {
  if (!positionSizing) return <div style={cardStyle(C)}>Đang tính toán...</div>;

  return (
    <div style={cardStyle(C)}>
      <div style={lblStyle(C)}>🧮 Position sizing + options intel</div>

      <div style={{ display:'grid', gap:5, marginBottom:8 }}>
        <div style={metricBox(C)}>
          <div style={{ fontSize:9, color:C.muted }}>Kelly Criterion (half)</div>
          <div style={{ fontSize:14, fontWeight:500, color:C.green, fontFamily:'monospace' }}>
            {positionSizing.halfKelly}% vốn
          </div>
          <div style={{ fontSize:9, color:C.muted }}>Full Kelly: {positionSizing.fullKelly}%</div>
        </div>
        <div style={metricBox(C)}>
          <div style={{ fontSize:9, color:C.muted }}>ATR-adjusted</div>
          <div style={{ fontSize:14, fontWeight:500,
            color: positionSizing.atrAdj < 1 ? C.amber : C.green, fontFamily:'monospace' }}>
            ×{positionSizing.atrAdj} {positionSizing.atrAdj < 1 ? 'giảm size' : 'giữ nguyên'}
          </div>
          <div style={{ fontSize:9, color:C.muted }}>ATR ratio {positionSizing.atrRatio}×</div>
        </div>
        <div style={{ ...metricBox(C), borderColor:`${C.green}44` }}>
          <div style={{ fontSize:9, color:C.muted }}>Optimal size</div>
          <div style={{ fontSize:18, fontWeight:500, color:C.green, fontFamily:'monospace' }}>
            {positionSizing.optimalSize}% vốn
          </div>
          <div style={{ fontSize:9, color:C.muted }}>
            {positionSizing.riskAmount ? `= $${positionSizing.riskAmount} risk` : ''}
          </div>
        </div>
      </div>

      {/* Options intel mini */}
      {optionsIntel && (
        <div style={{ border:`0.5px solid ${C.grid}`, borderRadius:6, padding:7 }}>
          <div style={{ fontSize:9, color:C.muted, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>
            Options market (CME Quikstrike)
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            <OptStat label="Put/Call ratio" value={optionsIntel.putCallRatio}
              color={optionsIntel.pcrSignal==='bearish_hedge'?C.red:C.green}
              sub={optionsIntel.pcrSignal==='bearish_hedge'?'Hedge bearish':'Hedge bullish'} />
            <OptStat label="Max pain" value={`$${optionsIntel.maxPain}`} color={C.blue} sub="MM target hết hạn" />
            <OptStat label="IV skew 25Δ" value={`+${optionsIntel.ivSkew}%`} color={C.amber} sub="Put premium cao" />
            <OptStat label="Gamma exp." value={`+$${optionsIntel.gammaExposure}M`} color={C.green} sub="Dealer buy floor" />
          </div>
        </div>
      )}
    </div>
  );
}

function OptStat({ label, value, color, sub }) {
  return (
    <div>
      <div style={{ fontSize:9, color:'#5a7090' }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:500, color, fontFamily:'monospace' }}>{value}</div>
      <div style={{ fontSize:9, color }}>{sub}</div>
    </div>
  );
}