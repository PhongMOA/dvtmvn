# Phase 1 — Schema + migration

Priority: P1 · Status: Done · Effort: 1.5h

## Context
- `prisma/schema.prisma` (Event, Order.paidAt, ComboType.includesTicket)
- Mẫu script: `scripts/apply-coupons-migration.ts`, `scripts/apply-sales-countdown-migration.ts`
- `prisma migrate` treo qua Supavisor pooler → luôn dùng script `$executeRawUnsafe` idempotent.

## Thay đổi schema
```prisma
model Event {
  // ...
  seatOpenAt      DateTime? // null = chưa mở chọn ghế
  seatTurnMinutes Int @default(15)
  seatBatchSize   Int @default(1)
  seatAllowances  SeatAllowance[]
  seatBookings    SeatBooking[]
}

// Quyền chọn ghế của 1 user cho 1 event. Snapshot lúc admin "Chốt danh sách";
// đơn paid sau đó được nối cuối (rank lớn nhất + 1) hoặc tăng ticketCount.
model SeatAllowance {
  id          String   @id @default(uuid())
  eventId     String
  userId      String
  rank        Int      // 0-based, theo min(paidAt) đơn có vé
  ticketCount Int      // Σ quantity OrderItem includesTicket của đơn paid
  unlockAt    DateTime
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  event       Event    @relation(fields: [eventId], references: [id])
  user        User     @relation(fields: [userId], references: [id])
  @@unique([eventId, userId])
  @@index([eventId, rank])
}

model SeatBooking {
  id        String   @id @default(uuid())
  eventId   String
  seatCode  String   // "D7", "M3"... theo layout tĩnh
  userId    String
  createdAt DateTime @default(now())
  event     Event    @relation(fields: [eventId], references: [id])
  user      User     @relation(fields: [userId], references: [id])
  @@unique([eventId, seatCode]) // chốt chặn cuối chống trùng ghế
  @@index([eventId, userId])
}
```
User thêm back-relation `seatAllowances SeatAllowance[]`, `seatBookings SeatBooking[]`.

## Steps
1. Sửa schema như trên (comment tiếng Việt theo style file).
2. `prisma/migrations/20261008030000_seat_selection/migration.sql`: `ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS ...`, `CREATE TABLE IF NOT EXISTS "SeatAllowance"/"SeatBooking"`, unique index + FK (bọc `DO $$ ... EXCEPTION WHEN duplicate_object`).
3. `scripts/apply-seat-selection-migration.ts` chạy từng câu SQL idempotent, in kết quả — copy khung từ apply-coupons-migration.ts.
4. `npx prisma generate`, `npx tsc --noEmit`.

## Todo
- [ ] schema
- [ ] migration.sql
- [ ] apply script
- [ ] generate + typecheck

## Success
- Chạy script 2 lần không lỗi. Typecheck pass.
- KHÔNG tự chạy trên DB production — nhắc user chạy `npx tsx scripts/apply-seat-selection-migration.ts`.
