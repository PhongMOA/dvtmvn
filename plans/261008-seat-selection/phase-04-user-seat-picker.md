# Phase 4 — Trang chọn ghế user + confirm

Priority: P1 · Status: Done · Effort: 4h

## Files
- Sửa `src/app/my-tickets/page.tsx`: khối "Chọn ghế" cho mỗi event user có allowance.
- Tạo `src/app/my-tickets/seats/[eventId]/page.tsx` (server: auth, load allowance + bookings)
- Tạo `src/components/seat-map.tsx` (client, dùng lại cho admin ở phase 5 với prop `mode`)
- Tạo `src/components/seat-picker.tsx` (client: state picked, poll, confirm)
- Tạo `src/app/actions/seats.ts` (`getSeatState`, `confirmSeats`)
- Đọc docs Next trong `node_modules/next/dist/docs` (server actions, client components) trước khi code.

## Nút ở /my-tickets
- Chưa chốt / chưa có allowance: ẩn (hoặc text "Chưa mở chọn ghế").
- `now < unlockAt`: nút disabled + "Đến lượt bạn lúc HH:mm dd/MM (còn X phút)" — countdown client nhỏ, tới giờ tự enable (không cần reload).
- Đã chọn đủ: hiện danh sách ghế, không còn nút.
- Đã mở + còn vé chưa chọn: nút "Chọn ghế (N vé)".

## Server actions `seats.ts`
```ts
getSeatState(eventId) → { taken: string[]; mine: string[]; ticketsLeft; unlockAt }
  // taken không lộ userId của người khác

confirmSeats(eventId, picked: string[])
  user = requireUser()
  prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'seat:'+eventId}))`
    allowance = findUnique(eventId,userId)      → "Bạn không có quyền chọn ghế"
    if (now < allowance.unlockAt)               → "Chưa tới lượt"
    mine = count SeatBooking của user
    ticketsLeft = allowance.ticketCount - mine; if 0 → "Đã chọn đủ"
    taken = all seatCode của event
    picked trùng taken → "Ghế X vừa có người chọn" (seat X)
    validateSelection({ taken, picked: expandSelection(picked), ticketsNeeded: ticketsLeft })
    createMany SeatBooking
  })
  catch P2002 → "Ghế vừa có người chọn, vui lòng chọn lại"
  revalidatePath my-tickets + trang seats
  return { ok, error?, seat? }
```
Lock cùng key với phase 3 (`seat:`+eventId) → chốt danh sách và confirm cũng tuần tự.

## Seat picker (client)
- Render SEAT_LAYOUT: hàng label trái/phải, khối cách nhau bằng lối đi, sweetbox rộng gấp đôi theo cặp. Màu theo legend ảnh: Đã chọn (taken), Không thể chọn (blocked + không hợp lệ), Thường/VIP/Sweetbox, Đang chọn (picked).
- Poll `getSeatState` mỗi 5s (dừng khi tab ẩn — `visibilitychange`).
- Click ghế: toggle (sweetbox toggle cả cặp); không cho chọn quá ticketsLeft.
- `selectableSeats` để làm mờ; khi bấm "Xác nhận" chạy `validateSelection` client trước, hiện reason qua toast.
- Lỗi server có `seat` → toast "Ghế X vừa có người chọn", bỏ X khỏi picked, refetch.
- Confirm dialog "Chọn xong không đổi được" trước khi gửi.
- Mobile: sơ đồ cuộn ngang trong container riêng (trang không cuộn ngang).

## Todo
- [ ] actions seats.ts
- [ ] seat-map + seat-picker
- [ ] trang seats/[eventId]
- [ ] khối nút ở my-tickets
- [ ] typecheck + lint

## Success
- Gọi thẳng `confirmSeats` trước unlockAt → bị từ chối.
- 2 tab 2 user confirm cùng ghế → 1 thành công, 1 nhận lỗi rõ ràng.
- Sau khi chọn, reload vẫn thấy ghế của mình; không chọn thêm được.
