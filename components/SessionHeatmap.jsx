/**
 * components/SessionHeatmap.jsx
 * ─────────────────────────────────────────────────────────────
 * Bảng 7 ngày × 4 phiên theo đúng thiết kế ban đầu. Đọc từ
 * sessionByWeekday (key `${weekday}:${session}` -> {avg, count}) do
 * /api/session-stats trả về — DỮ LIỆU THẬT, không phải minh hoạ.
 *
 * Ô hiện "–" khi chưa có mẫu nào cho đúng tổ hợp (thứ, phiên) đó —
 * mỗi ô cần lặp lại nhiều lần mới đủ tin cậy, có thể mất vài tuần để
 * lấp đầy toàn bảng dù sessionReturns tổng quát đã dataReady.
 */
import { memo } from 'react';

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]; // T2..T7, CN (getUTCDay: 0=CN)
const WEEKDAY_LABELS = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 0: 'CN' };
const SESSIONS = ['asia', 'london', 'new_york', 'overlap'];
const SESSION_LABELS = { asia: 'Asia', london: 'London', new_york: 'New York', overlap: 'L-NY overlap' };

function cellStyle(avg) {
  if (avg == null) return { background: 'transparent', color: 'var(--muted)' };
  const intensity = Math.min(1, Math.abs(avg) / 2);
  if (avg >= 0) return { background: `rgba(29,158,117,${0.15 + intensity * 0.55})`, color: intensity > 0.5 ? '#fff' : '#1D9E75' };
  return { background: `rgba(229,72,77,${0.15 + intensity * 0.55})`, color: intensity > 0.5 ? '#fff' : '#E5484D' };
}

export default memo(function SessionHeatmap({ sessionByWeekday }) {
  const overlapBest = SESSIONS.includes('overlap');
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700 }}>🗓️ SESSION HEATMAP — BIẾN ĐỘNG COMEX 7 NGÀY</div>
        {overlapBest && <div style={{ fontSize: 9, color: '#1D9E75' }}>London-NY overlap: liquidity cao nhất</div>}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 3, fontSize: 10, minWidth: 480 }}>
          <thead>
            <tr>
              <th style={{ width: 80 }} />
              {WEEKDAYS.map((wd) => (
                <th key={wd} style={{ color: 'var(--muted)', fontWeight: 400 }}>{WEEKDAY_LABELS[wd]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SESSIONS.map((session) => (
              <tr key={session}>
                <td style={{ color: 'var(--muted)', paddingRight: 6 }}>{SESSION_LABELS[session]}</td>
                {WEEKDAYS.map((wd) => {
                  const cell = sessionByWeekday?.[`${wd}:${session}`];
                  const style = cellStyle(cell?.avg);
                  return (
                    <td key={wd} style={{ textAlign: 'center', borderRadius: 5, padding: '4px 2px', fontWeight: 600, ...style }}
                      title={cell ? `Trung bình ${cell.avg.toFixed(2)}% (${cell.count} lần đo)` : 'Chưa đủ dữ liệu'}>
                      {cell ? `${cell.avg >= 0 ? '+' : ''}${cell.avg.toFixed(1)}` : '–'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 8, color: 'var(--muted)', marginTop: 6 }}>
        Ô "–" = chưa đủ dữ liệu cho tổ hợp (thứ, phiên) đó — mỗi ô cần nhiều lần lặp lại mới đáng tin cậy, sẽ lấp đầy dần theo thời gian.
      </div>
    </div>
  );
});
