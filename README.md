# MarvelVN — Đặt vé chiếu phim offline (MVP)

Web đơn giản để tổ chức 1 sự kiện chiếu phim offline: xem thông tin phim, đăng nhập Google, đặt vé (thanh toán trực tiếp tại sự kiện), nhận QR code check-in. Admin quản lý event và đánh dấu check-in thủ công.

Giao diện được thiết kế theo phong cách phim **Avengers: Doomsday** — tông tối, đỏ Avengers làm màu chủ đạo, vàng/kim làm điểm nhấn, font `Bebas Neue` cho heading.

## Yêu cầu hệ thống

- Node.js 20.19+ / 22.11+ (dự án đang dùng v22.11.0)
- npm

## Setup từ đầu

1. Cài dependency:
   ```bash
   npm install
   ```

2. Tạo file `.env` từ mẫu:
   ```bash
   cp .env.example .env
   ```

3. Điền các biến môi trường trong `.env`:
   - `DATABASE_URL` — để mặc định `file:./dev.db` (SQLite local, không cần đổi).
   - `ADMIN_EMAIL` — email Google của bạn. Đăng nhập bằng email này sẽ có quyền vào `/admin`.
   - `AUTH_SECRET` — sinh bằng `npx auth secret` hoặc `openssl rand -base64 32`.
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — tạo tại [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
     - APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application.
     - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`.
     - Nếu OAuth consent screen ở chế độ **Testing**, phải thêm email sẽ dùng để đăng nhập (kể cả `ADMIN_EMAIL`) vào danh sách **Test users**, nếu không Google sẽ từ chối đăng nhập.

4. Khởi tạo database + seed dữ liệu mẫu (admin user + event "Avengers: Doomsday"):
   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```

5. Chạy dev server:
   ```bash
   npm run dev
   ```
   Mở http://localhost:3000.

## Luồng sử dụng

**User:**
1. Vào trang chủ → thấy thông tin phim đang mở bán (poster, giờ chiếu, địa điểm, giá vé, số vé còn lại).
2. Đăng nhập Google.
3. Chọn số lượng vé → "Đặt vé ngay" → vé được xác nhận ngay lập tức (không cần admin duyệt).
4. Vào "Vé của tôi" để xem QR code check-in.

**Admin** (đăng nhập bằng `ADMIN_EMAIL`):
1. Vào menu "Quản trị" (hoặc `/admin/events`).
2. Tạo event mới / sửa event, bấm "Mở bán" để công khai trên trang chủ (tự động đóng event đang mở khác, chỉ 1 event mở bán tại 1 thời điểm).
3. Vào "Vé" của từng event để xem danh sách vé đã bán, bấm "Đánh dấu check-in" khi khách đến (quét QR bằng mắt/thủ công — MVP chưa có quét camera).

## Cấu trúc chính

```
prisma/schema.prisma          # User, Event, Ticket + bảng Auth.js (Account/Session/VerificationToken)
prisma/seed.ts                # Seed admin user + event mẫu "Avengers: Doomsday"
auth.ts                       # Cấu hình Auth.js v5 (Google OAuth)
src/lib/auth-helpers.ts       # requireUser(), requireAdmin(), isAdminEmail()
src/app/page.tsx              # Trang chủ = event đang "open" duy nhất
src/app/my-tickets/           # Vé của tôi + QR code
src/app/admin/                # CRUD event, mở/đóng bán, check-in
src/app/actions/              # Server Actions (booking, admin-events, admin-tickets)
```

## Giới hạn MVP (out of scope)

Chọn ghế cụ thể, quét QR bằng camera, email xác nhận, thanh toán online, nhiều admin/phân quyền, giới hạn số vé/user, deploy production.

## Ghi chú kỹ thuật

- Chống bán vượt vé (oversell) bằng `prisma.$transaction` — kiểm tra + trừ `remainingSeats` atomic.
- SQLite: đường dẫn `DATABASE_URL` trong `.env` được resolve lại ở `src/lib/prisma.ts` (dựa trên `process.cwd()/prisma/`) để khớp với nơi `prisma migrate`/`db seed` ghi file — tránh lệch đường dẫn do Next.js/Turbopack bundle lại code của Prisma Client.
