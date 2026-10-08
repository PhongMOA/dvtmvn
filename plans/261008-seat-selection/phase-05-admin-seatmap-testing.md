# Phase 5 — Admin xem sơ đồ + xoá booking + test thủ công

Priority: P2 · Status: Code xong, chờ test thủ công · Effort: 1.5h

## Files
- Sửa `src/app/admin/events/[id]/seats/page.tsx`: thêm sơ đồ chế độ admin.
- Sửa `src/components/seat-map.tsx`: `mode="admin"` — hover/tap ghế hiện tên/email người ngồi.
- Sửa `src/app/actions/seat-admin.ts`: `deleteSeatBooking(eventId, userId)` — xoá toàn bộ ghế của 1 user (cho phép user chọn lại), cùng advisory lock.

## UI
- Sơ đồ + thống kê: đã chọn / tổng ghế khả dụng / tổng vé đã bán.
- Bảng allowance (phase 3) thêm cột ghế đã chọn + nút "Huỷ ghế" (confirm).

## Test thủ công (local DB, KHÔNG dùng DB production)
1. Tạo 3 user mua vé (skipPayment theo thứ tự), đặt seatOpenAt = now+1ph, turn 2ph.
2. Chốt danh sách → unlockAt 3 mốc cách 2ph. Chốt lại → không đổi.
3. User 3 trước giờ: nút disabled + countdown; gọi action trực tiếp bị từ chối.
4. User 1 chọn để ghế lẻ → bị chặn; chọn hợp lệ → ok.
5. User 1 + 2 (đã mở) confirm cùng ghế đồng thời → chỉ 1 thành công.
6. Mua thêm đơn sau chốt → user mới nối cuối / ticketCount tăng.
7. Admin huỷ ghế user → user chọn lại được.
8. `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## Todo
- [ ] admin seat map
- [ ] deleteSeatBooking
- [ ] test thủ công + build

## Success
Toàn bộ kịch bản trên đúng; build pass. Nhắc user chạy migration script trên DB thật trước khi deploy.
