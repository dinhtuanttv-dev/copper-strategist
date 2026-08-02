/**
 * hooks/useTrapZone.js
 * ─────────────────────────────────────────────────────────────
 * Đọc dữ liệu Trap Zone từ /api/trap-zone. Poll thưa (5 phút/lần) vì
 * dữ liệu chỉ đổi khi cron ghi mẫu mới (20 phút/lần).
 */
import { useState, useEffect, useRef, useCallback } from 'react';

const REFRESH_MS = 5 * 60 * 1000;

export function useTrapZone() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  const fetchOnce = useCallback(async () => {
    try {
      const res = await fetch('/api/trap-zone');
      const json = await res.json();
      setData(json);
    } catch {
      /* giữ dữ liệu cũ nếu lỗi tạm thời */
    } finally {
      setLoading(false);
      timerRef.current = setTimeout(fetchOnce, REFRESH_MS);
    }
  }, []);

  useEffect(() => {
    fetchOnce();
    return () => clearTimeout(timerRef.current);
  }, [fetchOnce]);

  return { zones: data?.zones ?? {}, computedAt: data?.computedAt ?? null, loading };
}
