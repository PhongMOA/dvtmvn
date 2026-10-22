---
title: "Quay số may mắn trên sơ đồ ghế"
description: "Màn hình admin full-screen chiếu lên màn rạp: ô sáng chạy ngẫu nhiên trên sơ đồ ghế, chậm dần rồi dừng ở 1 ghế, popup báo số ghế + người mua. Cấu hình số lượt, ghế đã trúng không quay lại."
status: in-progress
priority: P3
effort: 8h
tags: [fullstack, nextjs, prisma, animation]
blockedBy: []
blocks: []
created: 2026-10-21
---

# Quay số may mắn trên sơ đồ ghế

## Quyết định đã chốt với user (2026-10-21)
| Câu hỏi | Chốt |
|---|---|
| Ghế nào được quay | **Mọi ghế đã đặt** (`SeatBooking` của event), không yêu cầu đã check-in |
| Chống trùng | **Theo ghế**: ghế đã trúng bị loại khỏi các lượt sau. Người mua nhiều ghế vẫn có thể trúng nhiều lần |
| Giải thưởng | **Không gắn giải**, chỉ cấu hình số lượt. Popup ghi "Lượt 3/10 — Trúng thưởng" |
| Hiển thị | **1 trang admin full-screen** chiếu qua máy chiếu, admin bấm Quay trên chính máy đó |
| Số phiên | **1 event chỉ có 1 phiên quay** |
| Tên trên màn chiếu | **Hiện tên đầy đủ**, không cần che |
| Nhịp hiệu ứng | **Nhanh → chậm dần → thật chậm**, mỗi bước nhảy random từng ô một để tạo hồi hộp (chi tiết ở phase 2) |

## Quyết định kỹ thuật (chốt trong plan)
- **Server chọn người trúng, client chỉ diễn animation.** Bấm Quay → server action chọn ghế bằng `crypto.randomInt`, **ghi DB ngay**, trả `seatCode` → client chạy hiệu ứng rồi dừng đúng ghế đó. Lý do: F5 giữa chừng không quay lại được (không "quay tới khi ra người quen"), kết quả không mất khi tắt trình duyệt, có lịch sử để đối chiếu.
- **Bảng `LuckyDraw` riêng, unique theo `eventId`** (1 event = 1 phiên) thay vì thêm cột vào `Event`: muốn quay lại từ đầu (VD sau khi quay thử trên staging) chỉ cần xoá phiên, cascade xoá luôn kết quả. Phiên có `totalRounds`; ghế đã trúng bị loại khỏi các lượt sau.
- **Chống bấm đúp / 2 tab cùng quay**: chọn ghế trong transaction có `lockEventSeats` (khoá chung với mọi thao tác ghế của event, nên admin huỷ ghế giữa lúc quay cũng không lệch pool); partial unique `(drawId, round) WHERE voided = false` + unique `(drawId, seatCode)` là chốt chặn cuối.
- **Lượt vắng mặt**: vì pool gồm cả người chưa check-in, popup có nút **"Vắng mặt — quay lại lượt này"**: kết quả cũ đánh `voided = true`, số lượt không tăng, **ghế đó vẫn bị loại** (không quay trúng lại người vắng).
- **Tên trên màn chiếu**: hiện tên người mua đầy đủ (`User.name`) + SĐT che `09xx xxx 789` để người trúng tự nhận. Không hiện email. Snapshot tên vào `LuckyDrawWinner.displayName` để lịch sử không đổi khi user sửa profile.
- **Sweetbox**: mỗi ghế M1/M2 là 1 ô quay độc lập (theo quyết định "theo ghế").
- **Tái dùng `SeatMap`** thay vì vẽ sơ đồ mới: thêm prop hiển thị chế độ quay; phóng to bằng `transform: scale()` cho vừa màn hình chiếu thay vì sửa `SEAT_PX`.
- Migration: chỉ `prisma/migrations/20261021000000_lucky_draw` — production tự `prisma migrate deploy` khi deploy (KHÔNG chạy SQL tay, từng gây lỗi P3018). Staging bổ sung bảng bằng `scripts/staging/migrate-lucky-draw.ts` (đã chạy 21/10).

## Phases
| # | Phase | Effort | Status |
|---|-------|--------|--------|
| 1 | [Schema + lib chọn ghế + server actions](./phase-01-schema-draw-core.md) | 2.5h | Done |
| 2 | [Màn hình quay: animation + popup + full-screen](./phase-02-draw-screen.md) | 4h | Done (chưa xem trên máy chiếu) |
| 3 | [Cài đặt phiên, lịch sử, test](./phase-03-admin-history-testing.md) | 1.5h | Code xong, còn test thủ công UI |

Phụ thuộc: 1 → 2 → 3 (phần cài đặt phiên ở phase 3 có thể làm song song với phase 2).

## Cross-Plan Dependencies
- Đọc `SeatBooking` + `SEAT_LAYOUT` (plan `261008-seat-selection`), chỉ **thêm prop** vào `src/components/seat-map.tsx`, không đổi hành vi hiện có của trang chọn ghế/admin.

## Rủi ro chính
- **Animation giật trên máy chiếu yếu / laptop cũ**: chỉ đổi class của 1–2 ô mỗi bước (không re-render cả sơ đồ ~300 ghế) — tách ô sáng thành overlay định vị theo toạ độ ghế, hoặc memo từng ghế.
- **Bị nghi "quay có sắp đặt"**: kết quả chọn bằng `crypto.randomInt` phía server, lưu thời điểm + người bấm; có trang lịch sử công khai cho admin xuất ra nếu cần.
- **Pool rỗng hoặc ít hơn số lượt**: chặn tạo/quay khi không còn ghế hợp lệ, báo "Hết ghế để quay (đã quay x/y lượt)".
- **Mất mạng lúc bấm Quay**: action lỗi thì không chạy animation; nếu action đã ghi nhưng response mất, tải lại trang sẽ thấy kết quả lượt đó trong lịch sử (không tạo lượt mới).

## Ngoài phạm vi
Danh sách giải thưởng theo lượt, nhiều phiên quay cho 1 event, màn điều khiển tách khỏi màn chiếu (realtime), gửi push/email báo trúng thưởng, quay theo người (gộp ghế), nhạc nền tuỳ chỉnh.
