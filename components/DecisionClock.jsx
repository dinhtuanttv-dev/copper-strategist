/**
 * components/DecisionClock.jsx (bản 2 — đa tầng, có Confluence Score)
 * ─────────────────────────────────────────────────────────────
 * 3 vòng tròn đồng tâm:
 *   Vòng 1 (trong)  — vùng giờ an toàn/nhiễu — HEURISTIC, ghi rõ nhãn
 *                      (như đã thống nhất từ đầu, chưa qua backtest)
 *   Vòng 2 (giữa)   — trạng thái biến động — DỮ LIỆU THẬT từ
 *                      s.vol_ma20_ratio (tỷ lệ volume/MA20 đã có sẵn
 *                      trong state, dùng làm proxy cho "co thắt/mở
 *                      rộng" thay vì tính lại dải Bollinger Band mà
 *                      app hiện chưa có sẵn)
 *   Vòng 3 (ngoài)  — trạng thái động lượng — DỮ LIỆU THẬT từ
 *                      s.rsi_h4 (RSI đã có sẵn trong state)
 *
 * Confluence Score (0-100%, giữa đồng hồ) = trung bình có trọng số
 * của 3 vòng trên — công thức và trọng số hiển thị công khai trong
 * code, không phải "hộp đen".
 *
 * Có nút bật/tắt hiển thị Vòng 2/Vòng 3 (yêu cầu "nút bật/tắt các lớp
 * chỉ báo").
 */
import { useState, useEffect, useMemo } from 'react';

const NOISE_ZONES = [
  { start: 6, end: 10, label: 'Phiên châu Á mở — vùng nhiễu (heuristic)' },
  { start: 12, end: 14, label: 'Phiên London — vùng nhiễu (heuristic)' },
  { start: 20, end: 22, label: 'Phiên New York — vùng nhiễu (heuristic)' },
];
const SAFE_HOURS = [
  { h: 10, label: 'Vùng an toàn 10h00 (heuristic)' },
  { h: 14.5, label: 'Vùng an toàn 14h30 (heuristic)' },
  { h: 22.5, label: 'Vùng an toàn 22h30 (heuristic)' },
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

function isInZone(hour, start, end) {
  if (end <= 24) return hour >= start && hour < end;
  return hour >= start || hour < end - 24;
}

export default function DecisionClock({ s }) {
  const [now, setNow] = useState(() => Date.now());
  const [showVol, setShowVol] = useState(true);
  const [showMomentum, setShowMomentum] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const vnHour = useMemo(() => {
    const d = new Date(now);
    return (d.getUTCHours() + 7 + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600) % 24;
  }, [now]);

  // ── Vòng 1: trạng thái giờ (heuristic) ──────────────────────────────
  const inNoise = NOISE_ZONES.some((z) => isInZone(vnHour, z.start, z.end));
  const timeScore = inNoise ? 30 : 90;

  // ── Vòng 2: trạng thái biến động — DỮ LIỆU THẬT (vol_ma20_ratio) ────
  const volRatio = Number.isFinite(s?.vol_ma20_ratio) ? s.vol_ma20_ratio : 1;
  const volState = volRatio >= 1.5 ? 'breakout' : volRatio < 1.1 ? 'sideway' : 'neutral';
  const volColor = volState === 'breakout' ? '#FF8C42' : volState === 'sideway' ? '#5B6472' : '#BA7517';
  const volLabel = volState === 'breakout' ? 'Mở rộng (Breakout)' : volState === 'sideway' ? 'Co thắt (Sideway)' : 'Trung tính';
  const volScore = volState === 'breakout' ? 82 : volState === 'sideway' ? 42 : 60;

  // ── Vòng 3: trạng thái động lượng — DỮ LIỆU THẬT (rsi_h4) ───────────
  const rsi = Number.isFinite(s?.rsi_h4) ? s.rsi_h4 : 50;
  const momState = rsi > 70 || rsi < 30 ? 'extreme' : rsi >= 45 && rsi <= 65 ? 'aligned' : 'moderate';
  const momColor = momState === 'aligned' ? '#1D9E75' : momState === 'extreme' ? '#E5484D' : '#BA7517';
  const momLabel = momState === 'aligned' ? `RSI ${rsi.toFixed(1)} — trung lập đẹp` : momState === 'extreme' ? `RSI ${rsi.toFixed(1)} — quá mua/quá bán` : `RSI ${rsi.toFixed(1)} — trung bình`;
  const momScore = momState === 'aligned' ? 85 : momState === 'extreme' ? 35 : 60;

  // ── Confluence Score — trọng số công khai: giờ 40%, biến động 30%, động lượng 30% ──
  const confluence = Math.round(timeScore * 0.4 + volScore * 0.3 + momScore * 0.3);
  const confluenceMeta = confluence >= 80
    ? { label: '🟢 Được phép vào lệnh', color: '#1D9E75' }
    : confluence >= 50
    ? { label: '🟡 Quan sát', color: '#BA7517' }
    : { label: '🔴 Cấm giao dịch', color: '#E5484D' };

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

  const cx = 150, cy = 130;
  const r1Out = 62, r1In = 44;   // vòng 1 — giờ
  const r2Out = 76, r2In = 64;   // vòng 2 — biến động
  const r3Out = 90, r3In = 78;   // vòng 3 — động lượng
  const [hx, hy] = polar(cx, cy, r3Out - 6, vnHour);

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700 }}>🕐 ĐỒNG HỒ RA QUYẾT ĐỊNH ĐA TẦNG (giờ Việt Nam)</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowVol((v) => !v)} style={{
            fontSize: 9, padding: '3px 8px', borderRadius: 6, border: `1px solid ${showVol ? volColor : 'var(--border)'}`,
            background: showVol ? `${volColor}22` : 'transparent', color: showVol ? volColor : 'var(--muted)', cursor: 'pointer',
          }}>Vòng biến động</button>
          <button onClick={() => setShowMomentum((v) => !v)} style={{
            fontSize: 9, padding: '3px 8px', borderRadius: 6, border: `1px solid ${showMomentum ? momColor : 'var(--border)'}`,
            background: showMomentum ? `${momColor}22` : 'transparent', color: showMomentum ? momColor : 'var(--muted)', cursor: 'pointer',
          }}>Vòng động lượng</button>
        </div>
      </div>

      <svg width="100%" viewBox="0 0 300 260" role="img" aria-label="Đồng hồ ra quyết định đa tầng">
        <defs>
          <pattern id="dc-hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#BA7517" strokeWidth="2" />
          </pattern>
        </defs>

        {/* Vòng 3 — động lượng (ngoài cùng) */}
        {showMomentum && (
          <circle cx={cx} cy={cy} r={(r3Out + r3In) / 2} fill="none" stroke={momColor} strokeWidth={r3Out - r3In} strokeOpacity="0.28">
            <title>{momLabel}</title>
          </circle>
        )}

        {/* Vòng 2 — biến động (giữa) */}
        {showVol && (
          <circle cx={cx} cy={cy} r={(r2Out + r2In) / 2} fill="none" stroke={volColor} strokeWidth={r2Out - r2In} strokeOpacity="0.32">
            <title>{volLabel}</title>
          </circle>
        )}

        {/* Vòng 1 — giờ (trong cùng, luôn hiện) */}
        <circle cx={cx} cy={cy} r={r1Out} fill="none" stroke="var(--border)" strokeWidth="1" />
        {NOISE_ZONES.map((z, i) => (
          <path key={i} d={arcPath(cx, cy, r1Out, r1In, z.start, z.end)} fill="url(#dc-hatch)" fillOpacity="0.6" stroke="#BA7517" strokeWidth="0.5">
            <title>{z.label}</title>
          </path>
        ))}
        {SAFE_HOURS.map((sfe, i) => {
          const [x, y] = polar(cx, cy, (r1Out + r1In) / 2, sfe.h);
          return <circle key={i} cx={x} cy={y} r="5" fill="#1D9E75"><title>{sfe.label}</title></circle>;
        })}

        {/* Vạch giờ + nhãn */}
        {Array.from({ length: 8 }, (_, i) => i * 3).map((h) => {
          const [x1, y1] = polar(cx, cy, r3Out, h);
          const [x2, y2] = polar(cx, cy, r3Out + 6, h);
          const [lx, ly] = polar(cx, cy, r3Out + 18, h);
          return (
            <g key={h}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted)" strokeWidth="1" />
              <text x={lx} y={ly} fontSize="9" fill="var(--muted)" textAnchor="middle" dominantBaseline="central">{h}h</text>
            </g>
          );
        })}

        {/* Kim giờ */}
        <line x1={cx} y1={cy} x2={hx} y2={hy} stroke="#378ADD" strokeWidth="2" style={{ animation: 'dcPulse 1.6s ease-in-out infinite' }} />
        <circle cx={cx} cy={cy} r="20" fill="var(--card)" stroke={confluenceMeta.color} strokeWidth="2" />
        <text x={cx} y={cy - 3} fontSize="14" fontWeight="700" fill={confluenceMeta.color} textAnchor="middle">{confluence}%</text>
        <text x={cx} y={cy + 10} fontSize="7" fill="var(--muted)" textAnchor="middle">Confluence</text>
      </svg>

      <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: confluenceMeta.color, marginTop: 2 }}>{confluenceMeta.label}</div>
      <div style={{ textAlign: 'center', fontSize: 11, color: '#378ADD', marginTop: 2 }}>{countdownText}</div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8, fontSize: 9, color: 'var(--muted)' }}>
        <span>🟡 Giờ: heuristic</span>
        <span style={{ color: volColor }}>● Biến động: {volLabel} (vol_ma20_ratio thật)</span>
        <span style={{ color: momColor }}>● Động lượng: {momLabel.split(' — ')[1] || momLabel} (RSI thật)</span>
      </div>
      <div style={{ fontSize: 8, color: 'var(--muted)', marginTop: 4 }}>
        Confluence = Giờ×40% + Biến động×30% + Động lượng×30% — công thức minh bạch, chưa qua backtest thực chiến.
      </div>

      <style jsx>{`
        @keyframes dcPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @media (prefers-reduced-motion: reduce) { line { animation: none !important; } }
      `}</style>
    </div>
  );
}
