# Brainstorm — Chọn ghế tuần tự (demo)

Ngày: 2026-10-08 · Trạng thái: đã chốt với user

## Vấn đề / yêu cầu
- Sau khi mua vé, tới giờ admin định → mở chọn ghế cho user đã mua.
- Mỗi user có 1 mốc `unlockAt`; mua trước chọn trước; cách nhau 15ph tính từ giờ mở.
- Chưa tới giờ → nút chọn ghế disable.
- Combo chỉ đếm SỐ vé (không có hạng vé) → user có N vé chọn N ghế, 1 lần xác nhận.
- Sweetbox = ghế đôi, cần ≥2 vé, chọn cả cặp.
- Không bao giờ để lại 1 ghế lẻ trống (phải chừa ≥2 ghế cạnh nhau).
- Chọn xong là chốt, không đổi (demo).

## Quyết định đã chốt
| Câu hỏi | Chọn |
|---|---|
| Kiểu lượt | Mở dần, mở rồi giữ luôn (cumulative), không phải cửa sổ độc quyền |
| Quy mô | Demo — interval + batch size cấu hình được (mặc định 15ph, 1 người/lượt) |
| N vé | Chọn đủ N ghế trong 1 lần, all-or-nothing |
| Hạng ghế | Không ràng buộc combo; Sweetbox = cặp cố định; luật chống ghế lẻ |

## Phương án đã cân nhắc
1. **Tính unlockAt động theo paidAt mỗi lần** — tự đúng, nhưng 1 đơn huỷ làm xê dịch giờ của mọi người phía sau → loại.
2. **Snapshot unlockAt khi admin "Chốt danh sách"** (chọn) — giờ ổn định, admin sửa tay được; người mua sau được nối cuối hàng.
3. Cửa sổ 15ph độc quyền — phức tạp, user lỡ giờ bị mất quyền → loại.

Chống trùng ghế:
- Chỉ unique constraint — chặn trùng 1 ghế nhưng không chặn 2 lựa chọn song song cùng tạo ghế lẻ → chưa đủ.
- Giữ ghế tạm (hold) kiểu rạp — thừa với lượt cách 15ph → YAGNI.
- **Unique constraint + advisory lock theo event** (chọn) — serialize các lần xác nhận, re-validate trên state mới nhất.

## Giải pháp chốt

### Dữ liệu
- `ShopSetting` (hoặc Event): `seatOpenAt DateTime?`, `seatTurnMinutes Int @default(15)`, `seatBatchSize Int @default(1)`.
- `SeatAllowance { eventId, userId, rank, ticketCount, unlockAt, @@unique([eventId,userId]) }`.
- `SeatBooking { eventId, seatCode, userId, createdAt, @@unique([eventId,seatCode]) }`.
- Sơ đồ ghế: file config tĩnh TS (hàng → các đoạn ngăn bởi lối đi → ghế `{code, type: normal|vip|sweetbox|blocked, pair?}`), theo ảnh mẫu (A–L, 3 khối, hàng M sweetbox, A1–A4 blocked).

### Thứ tự lượt
- ticketCount = Σ quantity các OrderItem có `comboType.includesTicket` của đơn `paid`.
- rank theo `min(paidAt)` của đơn có vé; hoà → orderCode.
- `unlockAt = seatOpenAt + floor(rank / batchSize) × turnMinutes`.
- Admin bấm "Chốt danh sách" (idempotent: user đã có allowance giữ nguyên rank/unlockAt, chỉ cập nhật ticketCount; user mới nối cuối với `max(last + interval, now)`).
- Khi đơn mới chuyển paid sau chốt → upsert allowance (nối cuối / tăng ticketCount).
- UI: disable + "Đến lượt bạn lúc HH:mm (còn X phút)"; server luôn check `now ≥ unlockAt`.

### Xác nhận ghế (server action)
Transaction:
1. `pg_advisory_xact_lock(hash(eventId))`.
2. Đọc allowance (now ≥ unlockAt, đã chọn + N ≤ ticketCount).
3. Đọc toàn bộ SeatBooking của event → validate luật ghế bằng hàm thuần dùng chung.
4. `createMany` N ghế. P2002 / vi phạm → rollback, trả lỗi cụ thể ("Ghế D7 vừa có người chọn").
Client poll sơ đồ 5s; lỗi → refetch.

### Luật ghế (hàm thuần `validateSelection(layout, taken, picked, ticketsLeft)`)
- Ghế phải tồn tại, không blocked, chưa bị lấy; số ghế (sweetbox tính 2) = đúng số vé muốn dùng ≤ vé còn lại.
- Sweetbox: phải chọn cả cặp.
- Đoạn = dãy ghế liền giữa 2 biên (lối đi/tường/blocked).
- Không được làm TĂNG số khoảng trống dài đúng 1 trong mỗi đoạn (ghế lẻ có sẵn không tính; lấp ghế lẻ được khuyến khích).
- Lối thoát: nếu không tồn tại cách xếp hợp lệ nào cho số vé của user → nới luật.
- Client dùng cùng hàm để làm mờ ghế không hợp lệ + hiện lý do.

## Phạm vi demo
Làm: sơ đồ theo ảnh, lượt + countdown, chống trùng + chống ghế lẻ, admin chốt danh sách + xem ai ngồi đâu.
Chưa: editor sơ đồ, push khi tới lượt, đổi ghế, hold ghế, realtime, gắn ghế vào QR vé.

## Rủi ro
1. skipPayment admin → paidAt = lúc bấm, ảnh hưởng xếp hạng.
2. 15ph × 1 người: 100 người ≈ 25 giờ — chỉnh interval/batch trước khi chạy thật.
3. Luật ghế lẻ + lối thoát là phần dễ sai nhất → viết hàm thuần + test biên trước UI.
4. Lối thoát "có tồn tại cách xếp hợp lệ" cần duyệt tổ hợp theo đoạn — giới hạn trong từng đoạn nên chi phí nhỏ (≤ ~25 ghế/đoạn).

## Tiêu chí kiểm thử
- User chưa tới giờ gọi thẳng action → bị từ chối.
- 2 user xác nhận cùng ghế đồng thời → chỉ 1 thành công.
- 2 user chọn song song tạo ghế lẻ → lần sau bị chặn.
- 1 vé, chỉ còn khoảng trống 2 ghế → vẫn chọn được (lối thoát).
- Sweetbox với 1 vé → không chọn được.
- Đơn paid sau khi chốt → xuất hiện cuối hàng.

## Bước tiếp
Lập plan chi tiết (phases: schema+migration script → layout config + hàm luật + test → allowance/chốt danh sách admin → trang chọn ghế user → admin xem sơ đồ).
