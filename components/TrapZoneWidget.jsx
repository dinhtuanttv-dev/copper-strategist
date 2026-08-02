/**
 * components/TrapZoneWidget.jsx
 * ─────────────────────────────────────────────────────────────
 * "Vùng thao túng & Kịch bản đầu phiên" — bản đã lược bỏ mọi phần
 * không khả thi/bịa so với ý tưởng ban đầu (xem lịch sử trao đổi):
 *   - Không có "độ chính xác mô hình %" bịa
 *   - Không tự vẽ lên TradingView (không thể làm được với widget free)
 *     — thay bằng nút mở TradingView thật ở tab mới
 *   - Không phát hiện bóng nến 15 phút (thiếu dữ liệu OHLC)
 *   - Không có Volume Health (thiếu dữ liệu volume)
 *   - Nhãn "MM Signature" bỏ phần liên quan volume, chỉ giữ phần
 *     tính được thật từ giá
 *
 * Giờ mở phiên hiển thị (Asia 08:00, LME 15:00, COMEX 19:30) là quy
 * ước hiển thị cho người dùng dễ nhớ — khác với SESSION_HOURS_VN
 * trong lib/dataCollection/session.js (dùng cho mục đích gắn nhãn
 * phiên khi thu thập mẫu, phạm vi rộng hơn). Không nhầm lẫn 2 khái
 * niệm này khi bảo trì.
 */
import { useState, useEffect, useMemo } from 'react';
import { useTrapZone } from '../hooks/useTrapZone';

const SESSION_OPEN_VN = { asia: 8, london: 15, new_york: 19.5 };
const SESSION_ORDER = ['new_york', 'london', 'asia']; // hiện theo đúng thứ tự ảnh mẫu

function formatAgo(ts) {
  if (!ts) return null;
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  return `${Math.floor(mins / 60)} giờ trước`;
}

function nextSessionInfo(vnHour) {
  const entries = Object.entries(SESSION_OPEN_VN).map(([session, hour]) => {
    let diff = hour - vnHour;
    if (diff <= 0) diff += 24;
    return { session, diff };
  });
  return entries.sort((a, b) => a.diff - b.diff)[0];
}

const TRADINGVIEW_URL = 'https://www.tradingview.com/chart/?symbol=OANDA%3AXCUUSD';

export default function TrapZoneWidget() {
  const { zones, loading } = useTrapZone();
  const [now, setNow] = useState(() => Date.now());
  const [selected, setSelected] = useState('new_york');

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const vnHour = useMemo(() => {
    const d = new Date(now);
    return (d.getUTCHours() + 7 + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600) % 24;
  }, [now]);

  const next = nextSessionInfo(vnHour);
  const countdownStr = useMemo(() => {
    const totalSec = Math.round(next.diff * 3600);
    const hh = Math.floor(totalSec / 3600);
    const mm = Math.floor((totalSec % 3600) / 60);
    const ss = totalSec % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }, [next]);

  const selectedZone = zones[selected];
  const selectedRange = selectedZone?.range;

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
      {/* Banner cảnh báo đếm ngược */}
      <div style={{
        background: 'rgba(186,117,23,0.12)', border: '1px solid rgba(186,117,23,0.4)', borderRadius: 10,
        padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12,
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#BA7517' }}>
            ⚠️ Sắp mở phiên {zones[next.session]?.label || next.session}
          </div>
          <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>
            {zones[next.session]?.range?.insufficient
              ? 'Chưa đủ dữ liệu Trap Zone cho phiên này'
              : `Trap Zone ước lượng: $${zones[next.session]?.range?.low?.toFixed(4)}–$${zones[next.session]?.range?.high?.toFixed(4)}`}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 8, color: 'var(--muted)' }}>Đếm ngược mở phiên</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#BA7517', fontFamily: 'var(--font-mono)' }}>{countdownStr}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
        {/* Bảng ma trận */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>📊 MA TRẬN VÙNG THAO TÚNG & KỊCH BẢN</div>
          <div style={{ fontSize: 8, color: 'var(--muted)', marginBottom: 8 }}>
            Trap Zone = ước lượng từ mẫu giá 20 phút/lần, không phải dữ liệu tick
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, minWidth: 380 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', color: 'var(--muted)', fontWeight: 400, padding: '4px' }}>Phiên</th>
                  <th style={{ textAlign: 'left', color: 'var(--muted)', fontWeight: 400, padding: '4px' }}>Trap Zone</th>
                  <th style={{ textAlign: 'left', color: 'var(--muted)', fontWeight: 400, padding: '4px' }}>Ghi nhận</th>
                  <th style={{ textAlign: 'left', color: 'var(--muted)', fontWeight: 400, padding: '4px' }}>Kịch bản</th>
                </tr>
              </thead>
              <tbody>
                {SESSION_ORDER.map((session) => {
                  const z = zones[session];
                  const r = z?.range;
                  const insufficient = !r || r.insufficient;
                  return (
                    <tr key={session}
                      onClick={() => !insufficient && setSelected(session)}
                      style={{
                        borderTop: '1px solid var(--border)', cursor: insufficient ? 'default' : 'pointer',
                        background: selected === session ? 'var(--card2)' : 'transparent',
                      }}>
                      <td style={{ padding: '7px 4px', fontWeight: 600 }}>{z?.label || session}</td>
                      <td style={{ padding: '7px 4px', fontFamily: 'var(--font-mono)', color: insufficient ? 'var(--muted)' : '#BA7517' }}>
                        {insufficient ? '–' : `$${r.low.toFixed(4)}–$${r.high.toFixed(4)}`}
                      </td>
                      <td style={{ padding: '7px 4px', color: insufficient ? 'var(--muted)' : 'inherit' }}>
                        {insufficient
                          ? `Chưa đủ dữ liệu (${r?.count ?? 0} mẫu)`
                          : `Mốc tròn $${z.roundLevel.toFixed(2)} — ${r.count} mẫu, cập nhật ${formatAgo(r.lastTs)}`}
                      </td>
                      <td style={{ padding: '7px 4px', color: insufficient ? 'var(--muted)' : 'inherit' }}>
                        {insufficient ? 'Chưa đủ dữ liệu để nhận định' : z.scenario?.reversalText}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel bên phải */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>Minh hoạ khái niệm</div>
          <svg width="100%" viewBox="0 0 260 140" role="img" aria-label="Minh hoạ vùng quét thanh khoản và điểm vào lệnh">
            <rect x="150" y="20" width="90" height="45" fill="none" stroke="#E5484D" strokeDasharray="3 3" rx="4" />
            <text x="195" y="14" fontSize="8" fill="#E5484D" textAnchor="middle">Trap Zone</text>
            <line x1="30" y1="90" x2="30" y2="60" stroke="#1D9E75" strokeWidth="4" />
            <line x1="60" y1="95" x2="60" y2="55" stroke="#E5484D" strokeWidth="4" />
            <line x1="90" y1="98" x2="90" y2="30" stroke="#E5484D" strokeWidth="4" />
            <line x1="120" y1="70" x2="120" y2="105" stroke="#1D9E75" strokeWidth="4" />
            <circle cx="120" cy="70" r="4" fill="#378ADD" />
            <text x="150" y="72" fontSize="8" fill="#378ADD">Điểm vào lệnh (minh hoạ)</text>
          </svg>

          <div style={{ background: 'var(--card2)', borderRadius: 8, padding: 10, marginTop: 8 }}>
            <div style={{ fontSize: 9, color: 'var(--muted)' }}>Kịch bản đang chọn: {selectedZone?.label || '—'}</div>
            {selectedRange && !selectedRange.insufficient ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 4 }}>
                  <span>Vùng bẫy</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>${selectedRange.low.toFixed(4)}–${selectedRange.high.toFixed(4)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                  <span>Mục tiêu (đảo chiều)</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#1D9E75' }}>${selectedZone.scenario?.shortTarget}</span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Chưa đủ dữ liệu cho phiên này.</div>
            )}
          </div>

          <button
            onClick={() => window.open(TRADINGVIEW_URL, '_blank', 'noopener,noreferrer')}
            style={{ width: '100%', marginTop: 8, fontSize: 10, padding: '9px', borderRadius: 8, border: 'none', background: '#378ADD', color: '#fff', cursor: 'pointer' }}
          >
            Mở TradingView (mã đã chọn) ↗
          </button>
        </div>
      </div>

      {loading && <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 8 }}>⟳ Đang tải dữ liệu Trap Zone...</div>}
    </div>
  );
}
