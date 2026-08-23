/**
 * hooks/useNewsDetail.js
 * Fetch phân tích sâu 1 tin — chỉ khi được yêu cầu chủ động.
 */
import { useState, useCallback, useRef } from 'react';

export function useNewsDetail() {
  const [details, setDetails] = useState({});
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
