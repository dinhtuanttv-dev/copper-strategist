/**
 * components/DecisionClock.jsx
 * ─────────────────────────────────────────────────────────────
 * Đồng hồ ra quyết định (giờ Việt Nam) — khôi phục vào tab Tổng quan
 * theo đúng thiết kế gốc đã duyệt trước đó, viết bằng React thật
 * (SVG do React render, không phải thao tác DOM tay như bản mockup).
 *
 * Vùng nhiễu (6-10h, 12-14h, 20-22h) và vùng an toàn (10h, 14h30,
 * 22h30) HIỆN VẪN LÀ HEURISTIC — như đã thống nhất từ đầu, CHƯA qua
 * backtest. Khi pipeline useSessionStats() (Upstash) đủ dữ liệu
 * (dataReady=true), có thể thay các mốc heuristic này bằng ngưỡng đo
 * được thật — đây là việc làm tiếp theo, CHƯA làm trong bản này.
 */
import { useState, useEffect, useMemo } from 'react';

const NOISE_ZONES = [
  { start: 6, end: 10, label: 'Phiên châu Á mở — vùng nhiễu' },
  { start: 12, end: 14, label: 'Phiên London — vùng nhiễu' },
  { start: 20, end: 22, label: 'Phiên New York — vùng nhiễu' },
];
const SAFE_HOURS = [
  { h: 10, label: 'Vùng an toàn 10h00' },
  { h: 14.5, label: 'Vùng an toàn 14h30' },
  { h: 22.5, label: 'Vùng an toàn 22h30' },
];
const SAFE_MINUTES = SAFE_HOURS.map((s) => s.h * 60);

function polar(cx, cy, r, hour) {
  const ang = (hour / 24) * 2 * Math.PI - Math.PI / 2;
  return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
}

function arcPath(cx, cy, rOut, rIn, hStart, hEnd) {
  const large = hEnd - hStart > 12 ? 1 : 0;
  const [x1, y1] = polar(cx, cy, rOut, hStart);
  const [x2, y2] = polar(cx, cy, rOut, hEnd);
  const [x3, y3] = polar(cx, cy, rIn, hEnd);
  const [x4, y4] = polar(cx, cy, rIn, hStart);
  return `M${x1},${y1} A${rOut},${rOut} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${rIn},${rIn} 0 ${large} 0 ${x4},${y4} Z`;
}

export default function DecisionClock() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const vnHour = useMemo(() => {
    const d = new Date(now);
    return (d.getUTCHours() + 7 + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600) % 24;
  }, [now]);

  const countdownText = useMemo(() => {
    const nowMin = Math.floor(vnHour * 60);
    let next = SAFE_MINUTES.find((m) => m > nowMin);
    let diff;
    if (next === undefined) { next = SAFE_MINUTES[0] + 1440; diff = next - nowMin; }
    else diff = next - nowMin;
    const hh = Math.floor(diff / 60), mm = diff % 60;
    const targetMin = next % 1440, th = Math.floor(targetMin / 60), tm = targetMin % 60;
    return `Còn ${hh > 0 ? hh + 'h ' : ''}${mm}p tới vùng an toàn (${String(th).padStart(2, '0')}:${String(tm).padStart(2, '0')})`;
  }, [vnHour]);

  const cx = 150, cy = 130, r = 100, rIn = r - 22;
  const [hx, hy] = polar(cx, cy, r - 30, vnHour);

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>🕐 ĐỒNG HỒ RA QUYẾT ĐỊNH (giờ Việt Nam)</div>
      <svg width="100%" viewBox="0 0 300 260" role="img" aria-label="Đồng hồ ra quyết định">
        <defs>
          <pattern id="dc-hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#BA7517" strokeWidth="2" />
          </pattern>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="1" />
        {NOISE_ZONES.map((z, i) => (
          <path key={i} d={arcPath(cx, cy, r, rIn, z.start, z.end)} fill="url(#dc-hatch)" fillOpacity="0.55" stroke="#BA7517" strokeWidth="0.5">
            <title>{z.label}</title>
          </path>
        ))}
        {Array.from({ length: 8 }, (_, i) => i * 3).map((h) => {
          const [x1, y1] = polar(cx, cy, r, h);
          const [x2, y2] = polar(cx, cy, r + 7, h);
          const [lx, ly] = polar(cx, cy, r + 20, h);
          return (
            <g key={h}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted)" strokeWidth="1" />
              <text x={lx} y={ly} fontSize="9" fill="var(--muted)" textAnchor="middle" dominantBaseline="central">{h}h</text>
            </g>
          );
        })}
        {SAFE_HOURS.map((s, i) => {
          const [x, y] = polar(cx, cy, r - 14, s.h);
          return <circle key={i} cx={x} cy={y} r="6" fill="#1D9E75"><title>{s.label}</title></circle>;
        })}
        <line x1={cx} y1={cy} x2={hx} y2={hy} stroke="#378ADD" strokeWidth="2" style={{ animation: 'dcPulse 1.6s ease-in-out infinite' }} />
        <circle cx={cx} cy={cy} r="4" fill="#378ADD" />
      </svg>
      <div style={{ textAlign: 'center', fontSize: 12, color: '#378ADD', fontWeight: 700, marginTop: 2 }}>{countdownText}</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6, fontSize: 9, color: 'var(--muted)' }}>
        <span>🟡 Vùng nhiễu (heuristic)</span>
        <span>🟢 Vùng an toàn (heuristic)</span>
      </div>
      <style jsx>{`
        @keyframes dcPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @media (prefers-reduced-motion: reduce) { line { animation: none !important; } }
      `}</style>
    </div>
  );
}
