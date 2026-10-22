# Phase 1 — Schema + lib chọn ghế + server actions

**Effort:** 2.5h · **Status:** Done (21/10 — bỏ cột `status` của LuckyDraw, "xong" suy ra từ số lượt; bỏ script apply tay vì prod tự `migrate deploy`; smoke test trên staging: 3 lượt song song ra 3 round khác nhau, void lượt cũ bị chặn, không trùng ghế)

## Schema (`prisma/schema.prisma`)
```prisma
// Phiên quay số may mắn trên sơ đồ ghế (xem src/lib/lucky-draw.ts). Ghế đã
// trúng trong phiên (kể cả lượt bị huỷ vì vắng mặt) không được quay lại.
// 1 event chỉ có 1 phiên (eventId unique). Xoá phiên = quay lại từ đầu.
model LuckyDraw {
  id          String   @id @default(uuid())
  eventId     String   @unique
  totalRounds Int
  status      String   @default("active") // active | done
  createdBy   String
  createdAt   DateTime @default(now())
  event       Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  winners     LuckyDrawWinner[]
}

model LuckyDrawWinner {
  id          String   @id @default(uuid())
  drawId      String
  round       Int      // 1-based
  seatCode    String
  userId      String
  displayName String   // snapshot tên lúc trúng
  maskedPhone String?
  voided      Boolean  @default(false) // vắng mặt → quay lại lượt này
  drawnBy     String
  createdAt   DateTime @default(now())
  draw        LuckyDraw @relation(fields: [drawId], references: [id], onDelete: Cascade)

  @@unique([drawId, seatCode])
  @@index([drawId, round])
}
```
- `(drawId, round)` **không** unique vì lượt bị void sẽ có thêm 1 bản ghi cùng round. Ràng buộc "mỗi round tối đa 1 bản ghi `voided = false`" giữ bằng advisory lock + kiểm tra trong transaction (hoặc partial unique index `WHERE voided = false` viết tay trong SQL migration — nên làm, Prisma không khai báo được nhưng không cản).
- `Event.luckyDraw LuckyDraw?`.
- Migration `prisma/migrations/20261021000000_lucky_draw/migration.sql` + `scripts/apply-lucky-draw-migration.ts` (copy pattern `apply-seat-selection-migration.ts`, dùng `CREATE TABLE IF NOT EXISTS`).

## `src/lib/lucky-draw.ts` (server-only)
```ts
getDrawState(drawId)      -> { draw, winners[], currentRound, remaining, eligibleSeats[] }
drawNextRound(drawId, actorId) -> winner    // lỗi: DRAW_DONE | NO_SEATS_LEFT
voidWinner(winnerId, actorId)  -> void      // chỉ void được lượt mới nhất còn hiệu lực
```
- **Pool** = `SeatBooking where eventId` − ghế đã có trong `LuckyDrawWinner` của phiên (kể cả voided).
- `currentRound` = số winner `voided = false` + 1. `currentRound > totalRounds` → `DRAW_DONE`, set `status = "done"`.
- `drawNextRound`: `prisma.$transaction` + `SELECT pg_advisory_xact_lock(hashtext(drawId))` → tính pool trên state mới nhất → `crypto.randomInt(pool.length)` → insert winner (snapshot `User.name`, SĐT che bằng helper mask sẵn có nếu có ở `src/lib/checkin.ts`, không thì thêm `maskPhone`).
- Tách phần thuần (tính pool, round hiện tại) ra `src/lib/lucky-draw-rules.ts` để unit test như `checkin-rules.ts`.

## Server actions (`src/app/actions/lucky-draw.ts`)
`saveLuckyDraw({ eventId, totalRounds })` (tạo, hoặc sửa số lượt khi chưa quay hết), `spinLuckyDraw(drawId)`, `voidLuckyDrawWinner(winnerId)`, `resetLuckyDraw(eventId)` (xoá phiên + kết quả, có confirm), `finishLuckyDraw(drawId)`.
- Không cho giảm `totalRounds` xuống dưới số lượt đã quay.
- Tất cả `requireAdmin()` (không mở cho staff — kiosk ở nơi công cộng).
- `spinLuckyDraw` trả `{ seatCode, displayName, maskedPhone, round, totalRounds, eligibleSeats }` — `eligibleSeats` là pool **trước** khi chọn để client có tập ô cho animation chạy qua.
- Validate `totalRounds` ≥ 1 và ≤ số ghế đã đặt lúc tạo (chỉ cảnh báo, vẫn cho tạo vì ghế có thể tăng thêm).
