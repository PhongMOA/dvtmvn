# Phase 3 — Allowance + admin cấu hình / chốt danh sách

Priority: P1 · Status: Done · Effort: 3h

## Files
- Tạo `src/lib/seat-allowance.ts` (server-only)
- Tạo `src/app/actions/seat-admin.ts`
- Tạo `src/app/admin/events/[id]/seats/page.tsx` (phần cấu hình + bảng allowance; sơ đồ ở phase 5)
- Tạo `src/components/seat-config-form.tsx` (dùng `fromVnDatetimeLocal` như sales-countdown-form)
- Sửa link ở `/admin/events/[id]` (thêm "Chọn ghế" cạnh Combos/Orders)
- Sửa `src/app/api/webhooks/sepay/route.ts` (~dòng 141) và `src/app/actions/order-status.ts` (~dòng 75): sau `fulfillPaidOrder`, gọi `syncSeatAllowanceForOrder(orderId)` best-effort (try/catch, không throw).
- Đọc `node_modules/next/dist/docs` phần server actions/revalidate trước khi code.

## Logic `src/lib/seat-allowance.ts`
```ts
// Vé của user cho event: Σ quantity OrderItem có comboType.includesTicket,
// đơn paymentStatus="paid", comboType.eventId = eventId.
ticketTotals(eventId): Map<userId, { tickets, firstPaidAt, firstOrderCode }>

unlockFor(event, rank) = event.seatOpenAt + floor(rank / batch) * turnMinutes

finalizeSeatList(eventId)        // admin bấm, idempotent
  tx + pg_advisory_xact_lock(hashtext('seat:'+eventId))
  existing = allowance hiện có
  - user đã có: chỉ cập nhật ticketCount (giữ rank/unlockAt)
  - user mới: sort theo (firstPaidAt, orderCode), rank = maxRank+1..., 
    unlockAt = max(unlockFor(rank), now)
  - KHÔNG xoá allowance của user mất vé (demo; admin xử lý tay) — log cảnh báo nếu ticketCount=0

recomputeUnlockTimes(eventId)    // khi admin đổi seatOpenAt/turn/batch: unlockAt = unlockFor(rank) cho mọi allowance

syncSeatAllowanceForOrder(orderId)
  - lấy event(s) có vé trong đơn; với mỗi event có seatOpenAt != null VÀ đã có ≥1 allowance (tức đã chốt):
    upsert như nhánh "user mới"/"đã có" của finalizeSeatList cho đúng user đó (cùng lock).
  - chưa chốt → bỏ qua (lần chốt sau sẽ gom).
```

## Admin actions (`seat-admin.ts`, `requireAdmin` kiểm DB như các action admin khác)
- `updateSeatConfig(eventId, { openAt, turnMinutes 1–120, batchSize 1–50 })` → lưu Event, gọi `recomputeUnlockTimes`, revalidate.
- `finalizeSeatListAction(eventId)` → yêu cầu `seatOpenAt` đã đặt.

## UI `/admin/events/[id]/seats`
- Form cấu hình (giờ mở VN, phút/lượt, người/lượt).
- Nút "Chốt danh sách" + mô tả "chạy lại được, chỉ thêm người mới".
- Bảng allowance: rank, user (tên/email), số vé, đã chọn (count SeatBooking), unlockAt (giờ VN).
- Cảnh báo: "N người × M phút → người cuối mở lúc …".

## Todo
- [ ] seat-allowance.ts
- [ ] actions + requireAdmin
- [ ] page + form + link
- [ ] hook webhook/skipPayment
- [ ] typecheck

## Success
- Chốt 2 lần không đổi rank/unlockAt người cũ; người mua sau nối cuối.
- Đổi cấu hình → unlockAt tính lại đúng công thức.
- Lỗi sync allowance không làm webhook trả lỗi.
