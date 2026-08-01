/**
 * lib/dataCollection/session.js
 * ─────────────────────────────────────────────────────────────
 * Định nghĩa ranh giới phiên giao dịch theo giờ Việt Nam (UTC+7).
 * Đây là ranh giới chuẩn ngành (forex/kim loại) — chỉnh nếu sàn bạn
 * theo dõi định nghĩa khác giờ mở/đóng phiên.
 *
 * Pure functions — không fetch, không side-effect, dễ unit-test.
 * Dùng ESM (export) để khớp với style của pages/api/*.js thật trong
 * project (price.js, cot.js, lme.js, news.js đều dùng export default).
 */

export const SESSION_HOURS_VN = {
  asia:     { start: 5,  end: 14 },
  london:   { start: 14, end: 23 },
  new_york: { start: 19, end: 28 }, // 28 = 4h sáng hôm sau, xử lý wrap ở dưới
  overlap:  { start: 19, end: 23 }, // London-NY overlap
};

/** @param {number} tsMs - timestamp (ms, UTC) */
export function getVnHour(tsMs) {
  const d = new Date(tsMs);
  const utcHour = d.getUTCHours() + d.getUTCMinutes() / 60;
  return (utcHour + 7) % 24;
}

export function getVnDateKey(tsMs) {
  const d = new Date(tsMs + 7 * 3600 * 1000); // dịch sang giờ VN rồi lấy ngày theo UTC
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function getVnWeekday(tsMs) {
  const d = new Date(tsMs + 7 * 3600 * 1000);
  return d.getUTCDay(); // 0=CN,1=T2,...,6=T7
}

/**
 * Xác định sample thuộc phiên nào. 1 sample có thể thuộc nhiều phiên
 * cùng lúc (ví dụ 20h VN vừa là New York vừa là Overlap) — trả về mảng.
 */
export function getSessionsForHour(hourVn) {
  const sessions = [];
  const inRange = (h, start, end) => {
    if (end <= 24) return h >= start && h < end;
    return h >= start || h < end - 24; // wrap qua nửa đêm
  };
  Object.entries(SESSION_HOURS_VN).forEach(([name, { start, end }]) => {
    if (inRange(hourVn, start, end)) sessions.push(name);
  });
  return sessions;
}
