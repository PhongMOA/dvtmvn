# Phase 3 — Cài đặt phiên, lịch sử, test

**Effort:** 1.5h · **Status:** Code + unit test xong; test thủ công UI còn chờ (cần đăng nhập admin Google)

## Trang `/admin/events/[id]/lucky-draw`
- Chưa có phiên: form số lượt (hiện "đang có N ghế đã đặt") + nút "Tạo".
- Đã có phiên: tiến độ x/y lượt, sửa số lượt, nút **"Mở màn quay"**, nút "Quay lại từ đầu" (confirm 2 bước, xoá hết kết quả).
- Thêm link "Quay số" vào menu trang event admin (cạnh Ghế / Đơn hàng / Combo).

## Lịch sử / tổng kết
- Bảng ngay dưới phần cài đặt: Lượt · Ghế · Người mua · SĐT (đầy đủ cho admin) · Giờ quay · Người bấm · Vắng mặt.
- Nút "Copy danh sách" (text tab-separated để dán vào Sheet/Zalo).

## Test
- Unit (`src/lib/lucky-draw-rules.test.ts`, chạy như `checkin-rules.test.ts`):
  - pool loại ghế đã trúng, kể cả voided.
  - lịch trình animation (`buildSpinSchedule`): bước cuối = ghế thắng, ghế thắng không xuất hiện ở giai đoạn 3 trước đó, không trùng trong cửa sổ 5 bước, khoảng cách các bước không giảm.
  - `currentRound` không tăng khi lượt bị void.
  - pool rỗng → `NO_SEATS_LEFT`; đủ lượt → `DRAW_DONE`.
- Thủ công trên staging (dvtmarvelvn.8ternal.com):
  - Tập dượt nhịp quay với vài người xem thật, chỉnh `SPIN_TIMING` nếu thấy quá nhanh/quá lâu.
  - Tạo phiên 5 lượt với event seed có ~20 ghế đã đặt, quay hết, kiểm tra không trùng ghế.
  - Bấm Quay liên tục / mở 2 tab cùng quay → không sinh 2 kết quả cùng lượt.
  - F5 giữa animation → kết quả lượt đó vẫn còn, không quay lại được.
  - Void 1 lượt → lượt quay lại không trúng ghế cũ.
  - Chạy full-screen trên laptop nối máy chiếu/TV, kiểm tra độ mượt và độ to chữ nhìn từ cuối phòng.
