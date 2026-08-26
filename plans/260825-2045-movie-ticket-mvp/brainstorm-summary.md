---
title: Web đặt vé xem phim offline — MVP
date: 2026-08-25
status: approved
---

# Web đặt vé xem phim offline — MVP

## 1. Bài toán & yêu cầu

Web đơn giản để tổ chức event chiếu phim offline: user xem thông tin phim, đăng ký/mua vé (thanh toán trực tiếp tại sự kiện, không thanh toán online), đăng nhập để lưu vé, mỗi vé có QR code để check-in. Tại 1 thời điểm chỉ bán 1 phim (không phải nền tảng nhiều event song song).

**Ràng buộc đã chốt:**
- Chỉ 1 admin (không cần phân quyền nhiều organizer)
- Đặt vé xong = xác nhận ngay, QR có sẵn ngay (không có bước duyệt thanh toán riêng)
- Check-in: MVP chỉ hiển thị QR, quét bằng camera để sau (đánh dấu thủ công)
- Đăng nhập: Google OAuth
- Không giới hạn số vé/user — ai đặt trước được trước, nhưng phải chống oversell
- Chạy local/demo, chưa cần public
- Không cần gửi email xác nhận
- Không chọn ghế cụ thể ở MVP (để sau)
- Tại 1 thời điểm chỉ 1 event "open" bán vé — trang chủ = thẳng trang phim đang bán, không có trang danh sách event

## 2. Approach đã đánh giá

| Approach | Ưu | Nhược | Chọn? |
|---|---|---|---|
| Next.js full-stack + Prisma/SQLite | 1 stack duy nhất, ít moving part, dễ chạy local, dễ nâng cấp Postgres sau | Không tối ưu cho scale lớn (chấp nhận được vì scope hiện tại) | ✅ |
| React (FE) + Express/Node (BE) riêng + Postgres | Tách rõ FE/BE | Thừa 1 tầng hạ tầng cho quy mô 1 admin/local demo | ❌ |
| No-code (Airtable/Softr...) | Nhanh dựng | Không tự nhiên hỗ trợ QR code, logic chống oversell, auth Google tuỳ biến | ❌ |

## 3. Giải pháp chốt

### Tech stack
- Next.js (App Router, TypeScript)
- Prisma ORM + SQLite (nâng lên Postgres sau nếu cần public, chỉ đổi connection string)
- Auth.js (NextAuth) — Google OAuth
- Tailwind CSS + shadcn/ui
- Thư viện `qrcode` để generate QR

### Data model
```
User   { id, email, name, googleId, isAdmin }
Event  { id, title, description, posterUrl, venue, startAt, totalSeats, remainingSeats, price, status: draft|open|closed }
Ticket { id (uuid), eventId, userId, quantity, qrToken (uuid random), status: booked|checked_in, createdAt }
```
- `isAdmin` xác định bằng so khớp `email` với `ADMIN_EMAIL` trong `.env` (không cần bảng role).
- Ràng buộc: chỉ 1 `Event` ở trạng thái `open` tại 1 thời điểm. Khi admin mở bán event mới, hệ thống tự đóng event đang `open`.

### Luồng user
1. Trang chủ (`/`) = trang chi tiết event đang `open` (poster, mô tả, giờ chiếu, địa điểm, còn bao nhiêu vé). Không có event nào `open` → hiện "Hiện chưa mở bán vé".
2. Chọn số lượng vé → bấm "Đặt vé" → nếu chưa đăng nhập, bắt đăng nhập Google trước.
3. Đặt vé = xác nhận ngay (transaction kiểm tra + trừ `remainingSeats`, tạo `Ticket` với `qrToken` random).
4. Trang "Vé của tôi" (`/my-tickets`) → danh sách vé đã đặt, mỗi vé hiện QR code (encode `qrToken`).

### Luồng admin
1. `/admin/events` — CRUD event (tên phim, mô tả, poster, giờ chiếu, tổng vé, giá vé hiển thị).
2. Hành động "Mở bán" / "Đóng bán" cho từng event (enforce chỉ 1 event open).
3. `/admin/events/[id]/tickets` — danh sách vé đã bán, đánh dấu "đã check-in" thủ công (click nút, quét QR tự động để sau).

### Chống oversell
Đặt vé chạy trong 1 DB transaction: kiểm tra `remainingSeats >= quantity`, nếu đủ thì trừ và tạo ticket cùng lúc; nếu không đủ báo lỗi hết vé. Đảm bảo 2 người đặt cùng lúc không giẫm nhau dù không giới hạn vé/user.

### QR code & check-in
- `qrToken` = UUID random sinh lúc đặt vé, không đoán được — QR encode token này.
- MVP: chỉ tạo & hiển thị QR; check-in đánh dấu thủ công trên trang admin.
- Để sau: trang `/checkin` dùng camera điện thoại quét QR, tự động chuyển ticket sang `checked_in`.

## 4. Ngoài phạm vi MVP (làm sau)
- Chọn vị trí ghế cụ thể
- Quét QR tự động bằng camera
- Gửi email xác nhận vé
- Thanh toán online / nhiều admin / phân quyền
- Giới hạn số vé/user

## 5. Rủi ro
- "Đặt vé = xác nhận ngay" không có bước xác minh đã trả tiền thật → rủi ro no-show/đặt ảo vì đặt không tốn gì. Chấp nhận cho MVP; nếu phát sinh vấn đề khi vận hành thật, cân nhắc thêm bước admin duyệt.
- SQLite phù hợp local/demo, không phù hợp khi cần nhiều người dùng đồng thời qua internet — lúc đó đổi Postgres (Prisma hỗ trợ sẵn).

## 6. Next steps
- Chờ quyết định: có lập plan triển khai chi tiết (`/ck:plan`) hay dừng ở brainstorm.
