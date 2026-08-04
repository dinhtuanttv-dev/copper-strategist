/**
 * hooks/useNewsDetail.js
 * ─────────────────────────────────────────────────────────────
 * Fetch phân tích sâu 1 tin — CHỈ khi được yêu cầu (gọi hàm fetchDetail
 * chủ động từ component, không tự fetch khi mount). Cache 1 lần trong
 * state của hook cho phiên hiện tại (tránh gọi lại nếu người dùng đóng
 * rồi mở lại cùng 1 tin trong cùng phiên duyệt web) — bổ sung cho
 * cache Redis phía server (bền qua nhiều phiên/nhiều người dùng).
 */
import { useState, useCallback, useRef } from 'react';

export function useNewsDetail() {
  const [details, setDetails] = useState({}); // title -> { analysis, loading, error }
  const inFlight = useRef(new Set());

  const fetchDetail = useCallback(async (title) => {
    if (details[title] || inFlight.current.has(title)) return;
    inFlight.current.add(title);
    setDetails((prev) => ({ ...prev, [title]: { loading: true } }));

    try {
      const res = await fetch(`/api/news-detail?title=${encodeURIComponent(title)}`);
      const json = await res.json();
      setDetails((prev) => ({ ...prev, [title]: { loading: false, ...json } }));
    } catch (err) {
      setDetails((prev) => ({ ...prev, [title]: { loading: false, error: err.message } }));
    } finally {
      inFlight.current.delete(title);
    }
  }, [details]);

  return { details, fetchDetail };
}
