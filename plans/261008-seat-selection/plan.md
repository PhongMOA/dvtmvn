---
title: "Chọn ghế tuần tự theo lượt (demo)"
description: "User đã mua vé được mở chọn ghế lần lượt theo thứ tự thanh toán (cách nhau N phút), chọn đủ số vé trong 1 lần, chống trùng ghế + chống để ghế lẻ."
status: in-progress
priority: P2
effort: 14h
tags: [fullstack, nextjs, prisma, concurrency, demo]
blockedBy: []
blocks: []
created: 2026-10-08
---

# Chọn ghế tuần tự theo lượt (demo)

Nguồn thiết kế: [brainstorm-report.md](./brainstorm-report.md)

## Overview
- Admin đặt giờ mở chọn ghế + khoảng cách lượt + số người/lượt cho 1 event, bấm "Chốt danh sách".
- Hệ thống snapshot `SeatAllowance` (rank, ticketCount, unlockAt) theo `paidAt` đơn đầu tiên có vé.
- User tới giờ → chọn đủ N ghế trên sơ đồ → xác nhận 1 lần (all-or-nothing), chốt luôn.
- Chống trùng: `@@unique(eventId, seatCode)` + `pg_advisory_xact_lock` theo event + re-validate server.
- Chống ghế lẻ: hàm thuần `validateSelection` dùng chung client/server.

## Quyết định kỹ thuật (chốt trong plan)
- Cấu hình chọn ghế đặt trên **Event** (không phải ShopSetting) vì allowance/booking theo event: `seatOpenAt`, `seatTurnMinutes`, `seatBatchSize`.
- Mọi trang admin chọn ghế gom vào 1 route `/admin/events/[id]/seats` (cấu hình + chốt danh sách + sơ đồ ai ngồi đâu + xoá booking).
- Trang user: `/my-tickets/seats` (theo event đang có allowance), nút ở `/my-tickets`.
- Test: `node:test` chạy qua `tsx --test` — không thêm dependency.
- Migration: SQL + script `scripts/apply-seat-selection-migration.ts` idempotent (`$executeRawUnsafe`), user tự chạy trên DB thật.

## Phases
| # | Phase | Effort | Status |
|---|-------|--------|--------|
| 1 | [Schema + migration](./phase-01-schema-migration.md) | 1.5h | Done |
| 2 | [Sơ đồ ghế + luật chọn + test](./phase-02-seat-layout-rules.md) | 4h | Done |
| 3 | [Allowance + admin cấu hình/chốt danh sách](./phase-03-allowance-admin-config.md) | 3h | Done |
| 4 | [Trang chọn ghế user + confirm](./phase-04-user-seat-picker.md) | 4h | Done |
| 5 | [Admin xem sơ đồ + xoá booking + test thủ công](./phase-05-admin-seatmap-testing.md) | 1.5h | Code xong — chờ chạy migration + test thủ công |

Phụ thuộc: 1 → (2 ∥ 3) → 4 → 5. Phase 2 là thuần logic, làm song song với 3 được.

## Cross-Plan Dependencies
Không. `260825-2045-movie-ticket-mvp` (in-progress, chỉ còn smoke test OAuth) không đụng phạm vi này.

## Rủi ro chính
- Luật ghế lẻ + lối thoát → test biên kỹ ở phase 2 trước khi làm UI.
- `skipPayment` đặt `paidAt` = lúc admin bấm → ảnh hưởng thứ hạng (chấp nhận cho demo, admin chỉnh unlockAt tay nếu cần — ngoài phạm vi UI, sửa qua DB).
- 15ph × 1 người/lượt kéo dài nhiều giờ → admin chỉnh batch/interval.

## Ngoài phạm vi
Editor sơ đồ, push khi tới lượt, đổi ghế, hold ghế, realtime, ghế trên QR vé.
