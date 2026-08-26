---
date: 2026-08-25 21:21
type: journal
tags: [brainstorm, planning, mvp, movie-ticket]
status: planning-complete
---

# Brainstorm + Plan: MVP web bán vé chiếu phim offline

## Bối cảnh

Dự án mới hoàn toàn (thư mục trống trước session này). User muốn làm web đơn
giản để tổ chức event chiếu phim offline: xem thông tin event, đăng ký/mua vé
(thanh toán trực tiếp tại sự kiện, không thanh toán online), đăng nhập để lưu
vé, tạo QR code để check-in tại cửa.

## Việc đã làm

1. **Brainstorm nhiều vòng (AskUserQuestion)** để chốt scope MVP:
   - 1 admin duy nhất (không có hệ thống phân quyền phức tạp).
   - Đặt vé = xác nhận ngay, không có bước duyệt thanh toán riêng (vì thanh
     toán diễn ra offline tại sự kiện).
   - QR chỉ cần hiển thị trên trang vé của user; quét bằng camera để làm
     sau — check-in tại cửa làm thủ công (admin tick tay).
   - Đăng nhập qua Google OAuth.
   - Không giới hạn số vé/user nhưng bắt buộc chống oversell (giữ đúng sức
     chứa event).
   - Chạy local/demo với SQLite, chưa cần deploy public.
   - Không cần gửi email xác nhận.
   - Không có chọn ghế ở MVP.
   - **Điểm chỉnh sửa quan trọng từ user**: tại 1 thời điểm chỉ có đúng 1
     event đang "open" bán vé — đây không phải nền tảng multi-event. Trang
     chủ = thẳng trang phim đang bán vé, không có trang danh sách event.

2. Viết brainstorm summary tại
   `plans/260825-2045-movie-ticket-mvp/brainstorm-summary.md`.

3. Lập plan triển khai qua `/ck:plan`, có research web (WebSearch) để xác
   nhận version/API hiện tại (tính đến Aug 2026):
   - Next.js 16.3.2 (stable).
   - Prisma ORM 7 (stable) — **breaking change quan trọng**: bắt buộc khai
     báo `output` path cho generator `prisma-client`; phải import
     `PrismaClient` từ path custom thay vì mặc định `@prisma/client`.
   - Auth.js v5 (`next-auth@beta`) — config gốc đặt ở `auth.ts`, dùng hàm
     `auth()` thay cho `getServerSession` cũ, cần `@auth/prisma-adapter`,
     và env var đổi tên thành `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
     (không còn dùng prefix `NEXTAUTH_*`).

4. Plan chia 5 phase, lưu tại `plans/260825-2045-movie-ticket-mvp/`:
   - **Phase 1** — Project Setup & Data Model: scaffold Next.js/Prisma/
     Tailwind/shadcn, schema `User`/`Event`/`Ticket`, seed script.
   - **Phase 2** — Authentication: Google OAuth qua Auth.js v5 +
     Prisma adapter; xác định admin bằng so khớp `ADMIN_EMAIL` trong `.env`
     (không cần bảng role riêng).
   - **Phase 3** — Event Page & Ticket Booking + QR: trang chủ = event
     đang open; booking server action dùng `$transaction` để chống
     oversell; trang `my-tickets` hiển thị QR sinh từ `qrToken` (uuid).
   - **Phase 4** — Admin Panel: CRUD event + nút mở/đóng bán, enforce
     ràng buộc chỉ 1 event open tại 1 thời điểm; list ticket + đánh dấu
     check-in thủ công.
   - **Phase 5** — Polish & Manual Test Pass: README, kịch bản smoke test
     đầy đủ, xử lý edge case.

5. User chủ động chọn **bỏ qua** bước red-team review + validate interview
   trong quy trình `/ck:plan`, chuyển thẳng sang implement — vì scope đã
   brainstorm kỹ và đủ nhỏ cho một MVP cá nhân.

## Quyết định quan trọng cần nhớ

- **Kiến trúc "chỉ 1 event open tại 1 thời điểm"** là điểm chốt sau khi user
  tự sửa lại thiết kế ban đầu (ban đầu định làm nền tảng multi-event song
  song). Đây là quyết định kiến trúc trung tâm, ảnh hưởng đến routing (trang
  chủ = event đang bán) và logic admin (enforce toggle open/close).
- **Prisma 7 breaking change** (bắt buộc custom `output` path cho generator,
  import `PrismaClient` từ path custom) — cần nhớ để tránh lỗi ngay từ
  Phase 1.
- Không giới hạn vé/user, nhưng **bắt buộc dùng DB transaction** để chống
  oversell — đây là yêu cầu non-negotiable dù MVP đơn giản.

## Next steps

Sẵn sàng implement theo plan, bắt đầu từ Phase 1. Có thể chạy
`/ck:cook plans/260825-2045-movie-ticket-mvp/plan.md` (hoặc tương đương) để
bắt đầu code.
