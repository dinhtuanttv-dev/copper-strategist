// ─── Data flow: radarData[] + verdict → SVG polygon + score bars ──────────────
import { useMemo } from 'react';

const RING_LEVELS  = [0.25, 0.5, 0.75, 1];
const SVG_W        = 190;
const SVG_H        = 180;
const CX           = 95;
const CY           = 90;
const R            = 68;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toAngle = (index, total) => (index / total) * Math.PI * 2 - Math.PI / 2;

const toPoint = (index, total, fraction) => ({
  x: CX + R * fraction * Math.cos(toAngle(index, total)),
  y: CY + R * fraction * Math.sin(toAngle(index, total)),
});

const toPolygonPoints = (total, fraction) =>
  Array.from({ length: total }, (_, i) => {
    const p = toPoint(i, total, fraction);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');

const scoreColor = (score) =>
  score >= 70 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';

// ─── Sub-components ───────────────────────────────────────────────────────────
function RadarGrid({ total, verdictCol }) {
  return (
    <>
      {RING_LEVELS.map((f) => (
        <polygon
          key={f}
          points={toPolygonPoints(total, f)}
          fill="none"
          stroke="var(--border)"
          strokeWidth={f === 1 ? 1.5 : 0.8}
          opacity={f === 1 ? 0.8 : 0.4}
        />
      ))}
      {Array.from({ length: total }, (_, i) => {
        const p = toPoint(i, total, 1);
        return (
          <line
            key={i}
            x1={CX} y1={CY}
            x2={p.x.toFixed(1)}
            y2={p.y.toFixed(1)}
            stroke="var(--border)"
            strokeWidth={0.8}
          />
        );
      })}
    </>
  );
}

function RadarPolygon({ radarData, verdictCol }) {
  const points = radarData
    .map((d, i) => {
      const p = toPoint(i, radarData.length, d.score / 100);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <polygon
      points={points}
      fill={`${verdictCol}25`}
      stroke={verdictCol}
      strokeWidth={2}
      strokeLinejoin="round"
    />
  );
}

function RadarLabels({ radarData }) {
  return (
    <>
      {radarData.map((d, i) => {
        const labelPt = toPoint(i, radarData.length, 1.22);
        const dotPt   = toPoint(i, radarData.length, d.score / 100);
        const col     = scoreColor(d.score);
        return (
          <g key={i}>
            <text
              x={labelPt.x} y={labelPt.y + 3.5}
              textAnchor="middle"
              fill="var(--muted)"
              fontSize={8.5}
              fontWeight="600"
            >
              {d.label}
            </text>
            <circle cx={dotPt.x} cy={dotPt.y} r={4} fill={col} />
            <text
              x={dotPt.x} y={dotPt.y - 6}
              textAnchor="middle"
              fill={col}
              fontSize={8}
              fontWeight="700"
            >
              {d.score}
            </text>
          </g>
        );
      })}
      <circle cx={CX} cy={CY} r={4} fill="var(--muted)" />
    </>
  );
}

function ScoreBars({ radarData, weights }) {
  return (
    <div style={{ flex: 1, minWidth: 110 }}>
      {radarData.map((d, i) => {
        const col = scoreColor(d.score);
        const w   = weights ? (weights[i] * 100).toFixed(0) : '–';
        return (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:7 }}>
            <span style={{ fontSize:9, color:'var(--muted)', width:42, flexShrink:0 }}>
              {d.label}
            </span>
            <div style={{ flex:1, background:'var(--border)', borderRadius:3,
              height:6, overflow:'hidden' }}>
              <div style={{ width:`${d.score}%`, height:'100%', background:col,
                borderRadius:3, transition:'width 0.5s ease' }} />
            </div>
            <span style={{ fontSize:8, color:'var(--muted)', width:20, textAlign:'right' }}>
              {w}%
            </span>
            <span style={{ fontSize:9, fontWeight:800, color:col, minWidth:22, textAlign:'right' }}>
              {d.score}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function BiasIndicator({ bias, sigCol, sigLabel }) {
  return (
    <div style={{ marginTop:8, background:'var(--card2)', borderRadius:7,
      padding:'7px 10px', border:`1px solid ${sigCol}44` }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:9, color:'var(--muted)' }}>Bias tổng hợp</span>
        <span style={{ fontSize:14, fontWeight:800, color:sigCol }}>{bias}/100</span>
      </div>
      <div style={{ background:'var(--border)', borderRadius:3, height:6,
        overflow:'hidden', marginTop:5 }}>
        <div style={{ width:`${bias}%`, height:'100%', background:sigCol,
          borderRadius:3, transition:'width 0.5s ease' }} />
      </div>
      <div style={{ fontSize:8, color:sigCol, marginTop:4, fontWeight:700 }}>{sigLabel}</div>
    </div>
  );
}

function WeightGrid({ radarData, weights }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(90px,1fr))',
      gap:5, marginTop:10 }}>
      {radarData.map((d, i) => {
        const col = scoreColor(d.score);
        const w   = weights ? (weights[i] * 100).toFixed(0) : '–';
        return (
          <div key={i} style={{ background:'var(--card2)', borderRadius:6, padding:'5px 8px' }}>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:8, color:'var(--muted)' }}>{d.label}</span>
              <span style={{ fontSize:7, color:'var(--muted)' }}>w:{w}%</span>
            </div>
            <div style={{ fontSize:12, fontWeight:800, color:col }}>{d.score}</div>
            <div style={{ background:'var(--border)', borderRadius:2,
              height:3, overflow:'hidden', marginTop:3 }}>
              <div style={{ width:`${d.score}%`, height:'100%', background:col }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function RadarChart({
  radarData,
  weights,
  verdict,
  bias,
  sigCol,
  sigLabel,
  rLabel,
}) {
  const n = radarData.length;

  return (
    <div style={{ background:'var(--card)', border:`1px solid ${verdict.verdictCol}`,
      borderRadius:12, padding:'13px 15px',
      boxShadow:`0 0 20px ${verdict.verdictCol}15` }}>

      {/* Header */}
      <div style={{ fontSize:11, fontWeight:700, marginBottom:10 }}>
        📡 MARKET INTELLIGENCE RADAR
        <span style={{ fontSize:9, color:'var(--muted)', fontWeight:400, marginLeft:8 }}>
          {rLabel}
        </span>
      </div>

      {/* Radar + Score bars */}
      <div style={{ display:'flex', justifyContent:'center',
        alignItems:'center', gap:16, flexWrap:'wrap' }}>

        <svg width={SVG_W} height={SVG_H}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ flexShrink:0 }}>
          <RadarGrid total={n} verdictCol={verdict.verdictCol} />
          <RadarPolygon radarData={radarData} verdictCol={verdict.verdictCol} />
          <RadarLabels radarData={radarData} />
        </svg>

        <div style={{ flex:1, minWidth:110 }}>
          <ScoreBars radarData={radarData} weights={weights} />
          <BiasIndicator bias={bias} sigCol={sigCol} sigLabel={sigLabel} />
        </div>
      </div>

      {/* Weight grid */}
      <WeightGrid radarData={radarData} weights={weights} />
    </div>
  );
}