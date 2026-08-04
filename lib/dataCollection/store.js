/**
 * lib/dataCollection/store.js
 * ─────────────────────────────────────────────────────────────
 * Lớp lưu trữ mẫu giá — dùng Upstash Redis (REST API, không cần quản
 * lý kết nối TCP, hoạt động tốt trong serverless/edge function).
 *
 * ĐĂNG KÝ (miễn phí, ~2 phút):
 *   1. Vào https://console.upstash.com → tạo tài khoản free
 *   2. Create Database → chọn region gần bạn (Singapore là gần VN nhất)
 *   3. Copy "UPSTASH_REDIS_REST_URL" và "UPSTASH_REDIS_REST_TOKEN"
 *   4. Dán vào .env.local (xem .env.example) và vào Vercel → Settings →
 *      Environment Variables (bắt buộc phải thêm cả trên Vercel, không
 *      chỉ .env.local, vì cron job chạy trên Vercel production)
 *
 * Free tier Upstash: 10,000 lệnh/ngày — cron 20 phút/lần = 72 lần/ngày,
 * mỗi lần ghi ~2-3 lệnh → dư sức dùng, không tốn phí.
 */
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const SAMPLES_KEY = 'copper:price_samples';
const MAX_SAMPLES = 6000; // ~83 ngày dữ liệu ở tần suất 20 phút/lần — đủ dùng, tránh phình kho lưu trữ vô hạn

/**
 * Ghi 1 mẫu giá mới vào đầu danh sách, cắt bớt nếu vượt MAX_SAMPLES.
 * @param {{ts:number, comex:number, source:string}} sample
 */
export async function recordSample(sample) {
  await redis.lpush(SAMPLES_KEY, JSON.stringify(sample));
  await redis.ltrim(SAMPLES_KEY, 0, MAX_SAMPLES - 1);
}

/**
 * Lấy toàn bộ mẫu đã lưu (mới nhất trước). Dùng cho tầng tổng hợp.
 * @param {number} [limit] - giới hạn số mẫu lấy ra, mặc định lấy hết
 */
export async function getAllSamples(limit = MAX_SAMPLES) {
  const raw = await redis.lrange(SAMPLES_KEY, 0, limit - 1);
  return raw
    .map((r) => {
      try { return typeof r === 'string' ? JSON.parse(r) : r; }
      catch { return null; }
    })
    .filter(Boolean);
}

export async function getSampleCount() {
  return redis.llen(SAMPLES_KEY);
}

/**
 * Cache generic dùng cho kết quả phân tích AI (news-detail.js) — khác
 * với SAMPLES_KEY ở trên (dành riêng cho mẫu giá). TTL tính bằng giây,
 * dùng cơ chế EX có sẵn của Redis thay vì tự quản lý timestamp.
 */
export async function getCached(key) {
  const raw = await redis.get(key);
  if (raw == null) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { return null; }
}

export async function setCached(key, value, ttlSeconds) {
  await redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
}
