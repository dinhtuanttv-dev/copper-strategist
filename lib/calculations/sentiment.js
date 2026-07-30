/**
 * lib/calculations/sentiment.js
 * ─────────────────────────────────────────────────────────────
 * ĐÃ SỬA: tham số đổi tên khớp đúng với response thật của /api/cot.js
 *   (mm_long, mm_short, net_mm) — bản trước dùng sai tên field
 *   `mmNetChangeWow` (không tồn tại trong cot.js của bạn, vì cot.js
 *   hiện tại chỉ trả 1 tuần gần nhất, không có tuần trước để so sánh).
 *
 * Nếu sau này cot.js được nâng cấp để trả thêm dòng tuần trước (để
 * tính "net_mm thay đổi bao nhiêu so với tuần trước"), truyền thêm
 * netMmChange vào đây — hiện tại tạm bỏ qua thành phần đó, chỉ dùng
 * mức net_mm tuyệt đối làm proxy (net dương lớn -> nghiêng tham lam).
 */
import { safeNum } from './regime';

export function computeFearGreedProxy({ rsi, volRatio, netMm, netMmChange }) {
  const rsiComponent = safeNum(rsi, 50);
  const volComponent = Math.min(100, safeNum(volRatio, 1) * 50);

  // Nếu có netMmChange (tuần này so tuần trước) thì ưu tiên dùng — nhạy hơn.
  // Nếu không có (như cot.js hiện tại), dùng mức net_mm tuyệt đối làm proxy,
  // chuẩn hoá quanh mốc trung tính ước lượng ~44,000 hợp đồng (dựa trên
  // giá trị fallback net_mm:44200 trong cot.js — coi đây là mức "bình thường").
  let mmComponent;
  if (netMmChange != null) {
    mmComponent = 50 + Math.max(-30, Math.min(30, safeNum(netMmChange, 0) / 500));
  } else {
    const neutral = 44200;
    mmComponent = 50 + Math.max(-30, Math.min(30, (safeNum(netMm, neutral) - neutral) / 1500));
  }

  const weighted = rsiComponent * 0.5 + volComponent * 0.25 + mmComponent * 0.25;
  return Math.max(0, Math.min(100, Math.round(weighted)));
}
