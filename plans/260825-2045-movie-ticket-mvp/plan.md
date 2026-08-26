---
title: "Web đặt vé xem phim offline — MVP"
description: "Next.js full-stack app cho phép user xem 1 phim đang mở bán, đăng nhập Google, đặt vé (thanh toán trực tiếp tại sự kiện), nhận QR code; admin quản lý event và check-in thủ công."
status: in-progress
priority: P2
effort: 18h
tags: [fullstack, nextjs, prisma, auth, mvp]
blockedBy: []
blocks: []
created: 2026-08-25
---

# Web đặt vé xem phim offline — MVP

## Overview

Web đơn giản: tại 1 thời điểm chỉ 1 phim đang mở bán vé. User xem thông tin phim ngay ở trang chủ, đăng nhập Google, đặt vé (không chọn ghế, thanh toán trực tiếp tại sự kiện nên đặt = xác nhận ngay), xem vé + QR code trong tài khoản. Admin (1 tài khoản duy nhất) tạo/quản lý event, mở/đóng bán, xem danh sách vé đã bán và đánh dấu check-in thủ công.

Nguồn thiết kế: [brainstorm-summary.md](./brainstorm-summary.md)

**Trạng thái hiện tại (2026-08-26):** Code Phase 1-4 hoàn chỉnh. Phase 5 hoàn thành phần không phụ thuộc OAuth (build production pass, lint sạch, README, xử lý loading/error state); phần còn lại (smoke test đăng nhập Google thật, đặt vé/check-in/mở-đóng event qua UI thật) **vẫn blocked** vì `.env` chưa có `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` thật — cần user tự tạo Google OAuth credentials rồi test tiếp. Do đó plan **chưa set là `completed`**, giữ `in-progress`.

**Code review cuối cùng: 9.5/10 — auto-approved** (sau 1 vòng auto-fix cho 1 bug High + vài Medium/Low). Các fix đáng chú ý:
- `bookTicket` (đặt vé): chuyển từ đọc-rồi-ghi sang **conditional atomic `updateMany`** — check `status="open" AND remainingSeats >= quantity` ngay trong mệnh đề `where`, decrement cùng 1 câu lệnh DB, loại bỏ khoảng hở TOCTOU giữa đọc và ghi (bug High).
- `updateEvent` (sửa event ở admin): chuyển sang `$transaction` + `increment` **delta** (`remainingSeats: { increment: totalSeats mới - totalSeats cũ }`) thay vì ghi đè giá trị tuyệt đối, tránh mất phần đã bị trừ bởi 1 booking xảy ra đồng thời.
- `seed.ts`: bọc trong `$transaction` đóng mọi event `open` khác trước khi upsert event seed, giữ đúng invariant "chỉ 1 event open tại 1 thời điểm" kể cả khi seed chạy lại trên DB đã có data.
- Xoá dead code `getCurrentUser` không còn dùng tới.
- `isAdminEmail`: so sánh email không phân biệt hoa/thường (`.toLowerCase()` cả hai vế) — tránh admin bị chặn nhầm do khác hoa/thường trong `ADMIN_EMAIL`.

Tester xác nhận: build/lint pass, stress-test race condition đặt vé (nhiều request đồng thời khi `remainingSeats` thấp) pass — không oversell, logic mở/đóng event (enforce đúng 1 event open) pass. Các test này chạy ở mức action/transaction trực tiếp (bypass UI đăng nhập Google), **chưa phải** test qua trình duyệt thật với 2 tài khoản Google khác nhau — mục đó vẫn nằm trong phần blocked của Phase 5.

## Tech Stack (đã research, xác nhận bản mới nhất tại thời điểm lập plan 2026-08)

- Next.js 16 (App Router, TypeScript)
- Prisma ORM — dự định v7, **thực tế cài đặt dùng v6.19.3** vì máy dev dùng Node v22.11.0, Prisma 7 yêu cầu Node ^22.12+ (không có sẵn/không upgrade Node hệ thống để tránh ảnh hưởng project khác). v6.19.3 đã dùng sẵn generator `prisma-client` + `output` path custom + `prisma.config.ts` giống hệt hành vi đã research cho v7, nên không ảnh hưởng thiết kế — import PrismaClient từ `@/generated/prisma/client`, KHÔNG dùng `@prisma/client` mặc định.
- **Giao diện:** theo phong cách phim "Avengers: Doomsday" — tông tối (đen/xám gunmetal), đỏ Avengers làm màu chủ đạo, vàng/kim làm điểm nhấn, font `Bebas Neue` (condensed, cinematic) cho heading. Event đầu tiên seed sẵn là "Avengers: Doomsday".
- Auth.js v5 (`next-auth@beta` / `auth.js`) + `@auth/prisma-adapter` — Google OAuth. Config gốc tại `auth.ts`, dùng hàm `auth()` thay cho `getServerSession`. Env vars đổi prefix `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (không còn `NEXTAUTH_*`)
- Tailwind CSS + shadcn/ui
- `qrcode` (npm) để generate QR code
- **Bug phát hiện & fix trong lúc implement:** generator `prisma-client` (dùng `import.meta.url` để tự dò thư mục chứa schema) resolve sai đường dẫn SQLite `file:./dev.db` một khi code bị Next.js/Turbopack bundle lại (`.next/**`) — gây lỗi "Unable to open the database file" khi chạy `next dev`/`next build`, dù CLI (`migrate`/`db seed`) vẫn chạy đúng. Fix: `src/lib/prisma.ts` tự resolve lại path tương đối trong `DATABASE_URL` dựa trên `process.cwd()/prisma/` rồi truyền qua `new PrismaClient({ datasourceUrl })`, bỏ qua cơ chế tự dò của generator.
- **Base UI thay vì Radix:** shadcn scaffold ở project này dùng `@base-ui/react` — `Button` không có prop `asChild` như Radix, thay bằng `render={<Link .../>}`.

## Cross-Plan Dependencies

Không có plan nào khác đang chạy trong `plans/` — đây là plan độc lập, không blocked/blocks gì.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Project Setup & Data Model](./phase-01-setup-data-model.md) | Done |
| 2 | [Authentication (Google OAuth + Admin)](./phase-02-authentication.md) | Done (login thật chưa test — thiếu Google OAuth credentials) |
| 3 | [Event Page & Ticket Booking + QR](./phase-03-booking-qr.md) | Done |
| 4 | [Admin Panel (Events + Check-in)](./phase-04-admin-panel.md) | Done |
| 5 | [Polish & Manual Test Pass](./phase-05-polish-testing.md) | Partially done — code/README/error-state xong, build/lint pass, code review 9.5/10 auto-approved, stress-test race condition + logic mở/đóng event pass; smoke test qua UI với Google OAuth thật vẫn blocked bởi thiếu credentials |

## Dependencies

- Phase 2 cần Phase 1 (Prisma schema + User model) xong trước.
- Phase 3 cần Phase 1 (Event/Ticket model) + Phase 2 (auth để biết user nào đặt vé) xong trước.
- Phase 4 cần Phase 1 + Phase 2 (admin identification) xong trước.
- Phase 5 cần tất cả các phase trước xong.
- Cần credentials Google OAuth (Client ID/Secret) tạo tại Google Cloud Console trước khi chạy Phase 2 — xem hướng dẫn trong phase-02.

## Ngoài phạm vi (Out of scope — làm sau)

Chọn ghế cụ thể, quét QR bằng camera, email xác nhận, thanh toán online, nhiều admin/phân quyền, giới hạn vé/user, deploy production/Postgres.
