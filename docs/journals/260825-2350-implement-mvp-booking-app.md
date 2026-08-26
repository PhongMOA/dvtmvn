---
date: 2026-08-25 23:50
session: implement-mvp-booking-app
type: journal
tags: [implementation, nextjs, prisma, auth, mvp, code-review]
status: phase-5-partial
---

# Journal: 2026-08-25 — Implement MVP web bán vé chiếu phim (Phase 1-4 + 5 một phần)

## Context

Tiếp nối `260825-2121-brainstorm-plan-mvp.md` — plan 5 phase đã chốt xong
(`plans/260825-2045-movie-ticket-mvp/plan.md`), session này là session
implement thực tế theo plan đó, đi từ scaffold trống tới app chạy được local.

## What Happened

- Implement lần lượt Phase 1 → Phase 4 theo đúng thứ tự trong plan:
  - **Phase 1** — scaffold Next.js 16 + Prisma 7 (custom `output` path cho
    generator `prisma-client`) + Tailwind + shadcn, schema `User`/`Event`/
    `Ticket` (+ bảng Auth.js), seed script tạo admin user + event mẫu.
  - **Phase 2** — Auth.js v5 (`auth.ts` ở root, hàm `auth()`), Google OAuth
    provider, `@auth/prisma-adapter`, helper `requireUser()`/`requireAdmin()`/
    `isAdminEmail()` so email với `ADMIN_EMAIL` trong `.env`.
  - **Phase 3** — trang chủ = event đang "open" duy nhất, server action
    booking dùng transaction chống oversell, trang "Vé của tôi" render QR
    code sinh từ `qrToken` (uuid) của mỗi ticket.
  - **Phase 4** — admin panel: CRUD event, toggle mở/đóng bán (enforce
    invariant chỉ 1 event open cùng lúc), list vé theo event + đánh dấu
    check-in thủ công.
  - **Phase 5** — chạy build + lint, viết README hướng dẫn setup từ đầu
    (bao gồm cách tạo Google OAuth Client ID/Secret và lưu ý thêm test user
    khi consent screen ở chế độ Testing). Smoke test các phần không cần
    đăng nhập chạy ổn; các bước cần đăng nhập Google thật (đặt vé, check-in,
    race-condition test) bị **blocked** vì môi trường dev chưa có
    `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` thật — coi là việc còn lại của
    user trước khi đóng Phase 5.
- Áp theme giao diện theo phim **Avengers: Doomsday**: tông tối, đỏ Avengers
  làm màu chủ đạo, vàng/kim làm điểm nhấn, font heading `Bebas Neue`.
- **Bug quan trọng tự phát hiện khi chạy thử**: generator `prisma-client`
  của Prisma 7 tự bake đường dẫn thư mục schema vào lúc generate (dựa
  `import.meta.url`), nhưng khi Next.js/Turbopack bundle lại code client vào
  `.next/**`, `import.meta.url` trỏ vào vị trí bundle chứ không phải thư mục
  gốc `prisma/` → SQLite mở sai file, lệch với file mà `prisma migrate`/
  `db seed` ghi vào. Fix: tự resolve lại `DATABASE_URL` (`file:./dev.db`)
  thành đường dẫn tuyệt đối dựa trên `process.cwd()/prisma/` trong
  `src/lib/prisma.ts`, truyền qua option `datasourceUrl` khi khởi tạo
  `PrismaClient` — ổn định bất kể bundler đặt code ở đâu.
- Chạy quy trình code review (agent code-reviewer) sau khi code xong:
  - 1 bug **High**: `updateEvent` tính lại `remainingSeats` không atomic —
    nếu có booking đang chạy song song, ghi đè có thể xóa mất phần seat vừa
    bị trừ bởi booking đó (lost update).
  - Vài **Medium/Low**: `bookTicket` nên dùng conditional atomic `updateMany`
    (kiểu `WHERE remainingSeats >= n`) thay vì chỉ dựa vào transaction
    isolation của SQLite, để logic portable khi sau này đổi sang DB khác;
    `seed.ts` seed dữ liệu vi phạm invariant "chỉ 1 event open"; có dead code
    sót lại; so sánh email admin không lowercase trước khi so khớp.
  - Đã fix hết các finding trên, chạy lại review lần 2: đạt 9.5/10, auto-approved.

## Reflection

Việc bỏ qua red-team review ở bước plan (quyết định của user từ session
trước) không gây vấn đề lớn — code review sau khi implement vẫn bắt được
đúng loại lỗi mà lẽ ra red-team plan sẽ lo (race condition, invariant vi
phạm), chỉ là bắt muộn hơn (ở code thay vì ở thiết kế). Bug Prisma/Turbopack
là loại lỗi khó đoán trước từ plan — chỉ lộ ra khi chạy thực tế, nên thứ tự
"implement rồi mới phát hiện" là hợp lý ở đây. Điểm cần cẩn thận hơn ở
session implement tiếp theo (nếu có project khác dùng Prisma 7 + Next.js
bundler): kiểm tra ngay từ đầu xem custom output path của prisma-client có
sống sót qua bundling hay không, thay vì đợi lỗi runtime.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Override `datasourceUrl` trong code (`src/lib/prisma.ts`) thay vì đổi cấu trúc thư mục Prisma | Không muốn tái cấu trúc project chỉ để né lỗi bundler; resolve path ở runtime dựa `process.cwd()` là ổn định và cô lập trong 1 file | Prisma client luôn mở đúng file SQLite bất kể Next.js/Turbopack bundle lại code ra sao |
| `bookTicket` dùng conditional atomic `updateMany` (WHERE remainingSeats >= n) thay vì chỉ dựa transaction isolation của SQLite | Portable — không phụ thuộc đặc tính serialize riêng của SQLite, chống oversell đúng cả khi đổi sang Postgres/MySQL sau này | Logic chống oversell an toàn hơn, không cần sửa lại khi đổi DB |
| Fix ngay bug High (`updateEvent` lost update trên `remainingSeats`) trước khi coi Phase 4 xong | Bug ảnh hưởng trực tiếp tới invariant chống oversell — cùng nhóm rủi ro non-negotiable đã chốt từ session trước | Admin sửa event không còn nguy cơ ghi đè mất seat đã bán khi có booking chạy song song |

## Next Steps

- User tự tạo Google OAuth Client ID/Secret (theo hướng dẫn trong
  `README.md`) và điền `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` vào `.env`.
- Chạy smoke test full end-to-end với đăng nhập Google thật: đặt vé, xem QR
  ở "Vé của tôi", admin check-in, thử race condition đặt vé gần hết chỗ.
- Sau khi smoke test thật pass, đánh dấu Phase 5 hoàn tất trong
  `plans/260825-2045-movie-ticket-mvp/phase-05-polish-testing.md` và cập
  nhật status tổng ở `plan.md`.
