/**
 * hooks/useSessionStats.js
 * ─────────────────────────────────────────────────────────────
 * Đọc số liệu tổng hợp thật (hoặc dataReady:false nếu chưa đủ dữ liệu)
 * từ /api/session-stats. Poll thưa (5 phút/lần) vì dữ liệu này đổi rất
 * chậm (chỉ đổi khi cron ghi mẫu mới, 20 phút/lần).
 */
import { useState, useEffect, useRef, useCallback } from 'react';

const REFRESH_MS = 5 * 60 * 1000;

export function useSessionStats() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  const fetchOnce = useCallback(async () => {
    try {
      const res = await fetch('/api/session-stats');
      const json = await res.json();
      setData(json);
    } catch {
      /* giữ nguyên data cũ nếu lỗi tạm thời */
    } finally {
      setLoading(false);
      timerRef.current = setTimeout(fetchOnce, REFRESH_MS);
    }
  }, []);

  useEffect(() => {
    fetchOnce();
    return () => clearTimeout(timerRef.current);
  }, [fetchOnce]);

  return {
    dataReady: data?.dataReady ?? false,
    distinctDays: data?.distinctDays ?? 0,
    minDaysRequired: data?.minDaysRequired ?? 7,
    sessionReturns: data?.sessionReturns ?? {},
    weekdayReturns: data?.weekdayReturns ?? {},
    sessionByWeekday: data?.sessionByWeekday ?? {},
    loading,
  };
}
