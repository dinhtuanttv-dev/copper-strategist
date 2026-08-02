# Command Center — Ghi chú tích hợp (bản pipeline dữ liệu thật)

Đặt tên riêng file này (không phải README.md) để KHÔNG đè lên README
gốc của project — bài học từ lần trước lỡ ghi đè 2 lần.

## 1. Cài đặt package mới

```bash
npm install @upstash/redis
```

## 2. Tạo Upstash Redis (free, ~2 phút)

1. Vào https://console.upstash.com → đăng ký/đăng nhập
2. Create Database → chọn region **Singapore** (gần VN nhất, độ trễ thấp nhất)
3. Copy `UPSTASH_REDIS_REST_URL` và `UPSTASH_REDIS_REST_TOKEN`

## 3. Cấu hình biến môi trường

**Local** (`.env.local`, copy từ `.env.example`):
```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
CRON_SECRET=<chuỗi ngẫu nhiên bất kỳ, ví dụ: openssl rand -hex 32>
```

**Vercel** (Settings → Environment Variables) — **bắt buộc thêm cả 3 biến
trên đây nữa**, vì cron job chạy trên production, không đọc `.env.local`.

## 4. Cấu hình GitHub Actions (thay cho Vercel Cron)

> ⚠️ Vercel Cron trên gói Hobby (free) chỉ cho chạy 1 lần/ngày — không đủ
> cho nhu cầu 20 phút/lần. Dùng GitHub Actions (miễn phí, không giới hạn
> này) thay thế — file `.github/workflows/collect-price-sample.yml` đã
> viết sẵn trong gói này.

1. Push toàn bộ code (bao gồm `.github/workflows/`) lên GitHub
2. Vào repo → Settings → Secrets and variables → Actions → New repository secret
   - `CRON_SECRET` = đúng giá trị đã đặt ở bước 3
   - `APP_URL` = ví dụ `https://copper-strategist.vercel.app` (không có `/` ở cuối)
3. Vào tab **Actions** của repo → chọn workflow "Thu thập mẫu giá đồng định kỳ"
   → bấm **Run workflow** để test thử ngay (không cần đợi lịch tự động)
4. Kiểm tra log — nếu thành công sẽ thấy HTTP 200, không có dòng `curl: (22)`

## 5. Kiểm tra dữ liệu đang được ghi

```bash
curl https://copper-strategist.vercel.app/api/session-stats
```

Ban đầu sẽ thấy `"dataReady": false, "distinctDays": 0`. Sau vài ngày
(cron chạy đều), `distinctDays` sẽ tăng dần. Khi đạt `minDaysRequired`
(mặc định 7 ngày, chỉnh trong `pages/api/session-stats.js` nếu muốn),
`dataReady` chuyển `true` và Radar chu kỳ giá trong tab Tổng quan sẽ tự
động hiện số liệu thật thay vì banner "đang tích luỹ dữ liệu".

## 6. Tích hợp vào index.js

Giữ nguyên như bản trước — `CommandCenterTab` giờ tự gọi thêm
`useSessionStats()` bên trong, không cần truyền thêm prop nào mới từ
`index.js`. Chỉ cần đảm bảo import đúng:

```jsx
import CommandCenterTab from '../components/CommandCenterTab';

{tab === 0 && (
  <CommandCenterTab
    s={s} ti={ti} mh={mh} verdict={verdict} bias={bias}
    sigLabel={sigLabel} sigCol={sigCol} weights={weights} stress={stress}
    bsEvents={bsEvents} news={news} loadNews={loadNews} fetchNews={fetchNews}
  />
)}
```

## 7. Giới hạn còn lại (minh bạch)

- **Đồng hồ ra quyết định** (khung giờ nhiễu/an toàn): chưa nối vào
  pipeline này — vẫn là ngưỡng heuristic từ đầu cuộc trò chuyện. Khi có
  đủ dữ liệu (`dataReady:true`), có thể tính lại ngưỡng từ chính
  `sessionReturns`/độ lệch chuẩn theo giờ — đây là bước làm tiếp theo
  nếu bạn muốn, chưa nằm trong bản này.
- **Session Heatmap** (7 ngày × 4 phiên): endpoint `/api/session-stats`
  đã có `weekdayReturns` (theo thứ) nhưng CHƯA có breakdown đủ chi tiết
  theo (thứ × phiên) cùng lúc — hiện chỉ tách riêng theo phiên hoặc
  riêng theo thứ. Muốn bảng đầy đủ như thiết kế ban đầu (7 ngày × 4
  phiên) cần mở rộng `computeSessionReturns` để nhóm theo cả 2 chiều —
  làm được, nhưng cần thêm thời gian thu thập lâu hơn để mỗi ô có đủ
  mẫu (7 ngày × 4 phiên = 28 ô, mỗi ô cần nhiều lần lặp lại mới đáng
  tin cậy thống kê).
- **TradingView widget**: chỉ hiển thị, đã giải thích rõ không lấy
  được dữ liệu ra tính toán — nếu sau này muốn TradingView cung cấp dữ
  liệu thật cho tính toán riêng, cần xem xét gói Charting Library trả
  phí + datafeed riêng, ngoài phạm vi bản miễn phí này.

## 8. Trap Zone Widget (bản v8)

File mới: `pages/api/trap-zone.js`, `hooks/useTrapZone.js`, `components/TrapZoneWidget.jsx`.
KHÔNG cần biến môi trường mới — dùng lại đúng Upstash Redis đã cấu hình.

Đã lược bỏ khỏi ý tưởng ban đầu (không khả thi/không trung thực):
- "Độ chính xác mô hình %" — bịa, không đưa vào.
- Tự động vẽ hộp lên TradingView — không thể làm với widget free, thay
  bằng nút mở TradingView thật ở tab mới (`window.open`).
- Phát hiện bóng nến 15 phút — cần dữ liệu OHLC intraday chưa thu thập.
- Volume Health — cần dữ liệu volume chưa thu thập.

Nếu sau này muốn 2 mục cuối hoạt động thật, cần sửa
`pages/api/cron/collect-sample.js` để lưu thêm OHLC/volume mỗi lần
thu thập (hiện chỉ lưu 1 điểm giá `comex`), rồi đợi vài tuần tích luỹ.
