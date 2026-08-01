/**
 * components/TradingViewWidget.jsx
 * ─────────────────────────────────────────────────────────────
 * Nhúng TradingView Advanced Chart widget — MIỄN PHÍ, chính thức,
 * không cần tài khoản. Đây CHỈ LÀ HIỂN THỊ — không có cách nào lấy
 * dữ liệu ra từ widget này để tính toán (đã giải thích trước đó).
 *
 * QUAN TRỌNG — ĐÃ SỬA: symbol mặc định KHÔNG dùng "COMEX:HG1!" nữa.
 * Đó là hợp đồng tương lai CME/COMEX — CME bắt buộc người xem phải
 * đăng nhập TradingView VÀ tự chấp nhận điều khoản dữ liệu thị trường
 * của họ mới xem được. Khách vãng lai qua widget nhúng KHÔNG làm được
 * bước chấp nhận đó → widget báo lỗi "Mã giao dịch này chỉ có trên
 * TradingView" và hiện O0 H0 L0 C0 (không phải bug code, là giới hạn
 * cấp phép dữ liệu CME).
 *
 * Dùng "OANDA:XCUUSD" (Copper CFD, broker OANDA cấp dữ liệu tự do
 * cho mọi người xem qua widget, không cần đăng nhập/chấp nhận gì).
 * Giá CFD bám sát giá COMEX (chênh lệch rất nhỏ, không đáng kể cho
 * mục đích xem chart tham khảo).
 */
import { useEffect, useRef } from 'react';

export default function TradingViewWidget({ symbol = 'OANDA:XCUUSD', height = 400 }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = ''; // tránh nhân đôi widget khi re-render

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: 'D',
      timezone: 'Asia/Ho_Chi_Minh',
      theme: 'dark',
      style: '1',
      locale: 'vi_VN',
      allow_symbol_change: true,
      support_host: 'https://www.tradingview.com',
    });
    container.appendChild(script);
  }, [symbol]);

  return (
    <div style={{ height, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div ref={containerRef} className="tradingview-widget-container" style={{ height: '100%' }}>
        <div className="tradingview-widget-container__widget" style={{ height: '100%' }} />
      </div>
    </div>
  );
}
