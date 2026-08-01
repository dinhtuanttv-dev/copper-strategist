/**
 * components/TradingViewWidget.jsx
 * ─────────────────────────────────────────────────────────────
 * Nhúng TradingView Advanced Chart widget — MIỄN PHÍ, chính thức,
 * không cần tài khoản. Đây CHỈ LÀ HIỂN THỊ — không có cách nào lấy
 * dữ liệu ra từ widget này để tính toán (xem giải thích đã trao đổi
 * trước đó về giới hạn của widget free).
 *
 * symbol mặc định COMEX:HG1! (Copper Futures) — đổi nếu bạn muốn
 * theo dõi mã khác.
 */
import { useEffect, useRef } from 'react';

export default function TradingViewWidget({ symbol = 'COMEX:HG1!', height = 400 }) {
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
