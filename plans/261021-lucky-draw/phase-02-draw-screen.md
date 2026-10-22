# Phase 2 — Màn hình quay: animation + popup + full-screen

**Effort:** 4h · **Status:** Done — code ở `src/components/lucky-draw/`. Không làm memo từng ô: ~300 ô re-render mỗi 50ms vẫn nhẹ, đo lại trên máy chiếu thật nếu giật.

## Route
`/admin/events/[id]/lucky-draw/stage` — server component lấy `getDrawState`, render client component `LuckyDrawStage` (`src/components/lucky-draw/lucky-draw-stage.tsx`).

## Bố cục màn chiếu
- Nền tối, toàn màn hình (`document.documentElement.requestFullscreen()` qua nút "Trình chiếu"; phím `F` bật/tắt, `Space`/`Enter` = Quay, `Esc` thoát).
- Trên: tên event + "Lượt 3 / 10" + số ghế còn trong pool.
- Giữa: sơ đồ ghế phóng to vừa khung (`ResizeObserver` đo kích thước sơ đồ gốc → `transform: scale(min(wW/w, wH/h))`).
- Dưới: nút **QUAY** lớn (ẩn khi full-screen nếu admin dùng phím), dải chip các ghế đã trúng (A12, F7, …).

## `SeatMap` — prop mới (không đổi hành vi cũ)
```ts
drawMode?: {
  eligible: Set<string>;   // ghế trong pool: sáng nhẹ
  winners: Set<string>;    // ghế đã trúng: vàng + icon cúp
  active: string | null;   // ô đang chạy qua: sáng rực, scale 1.15, glow
}
```
- Ghế trống / không trong pool: mờ (`opacity-25`).
- Để mỗi bước chỉ re-render 2 ô: tách `SeatCell` thành `memo` với prop `state` dạng chuỗi (`"eligible" | "active" | "winner" | ...`) — so sánh rẻ, ~300 ghế vẫn mượt.

## Animation (`src/components/lucky-draw/use-spin.ts`)
Mỗi bước sáng **đúng 1 ô**, nhảy random tới ghế bất kỳ trong pool. Nhịp chia 3 giai đoạn (user chốt 21/10):

| Giai đoạn | Thời lượng | Khoảng cách giữa 2 bước | Cảm giác |
|---|---|---|---|
| 1. Nhanh | ~3s | cố định ~50ms (~60 bước) | ô màu chạy loạn khắp rạp |
| 2. Chậm dần | ~3s | tăng dần 50ms → ~400ms (ease-out) | bắt đầu nhìn rõ từng ghế |
| 3. Thật chậm | ~4–5s | 600ms → 900ms → 1.2s → 1.5s (4–5 bước cuối) | khán giả đọc được từng số ghế, hồi hộp chờ dừng |

Tổng ~10–11s. Các con số để thành hằng số đầu file (`SPIN_TIMING`) để chỉnh khi tập dượt.

1. Bấm Quay → khoá nút, gọi `spinLuckyDraw` và **bắt đầu giai đoạn 1 ngay** (giai đoạn 1 đủ dài để che độ trễ chờ server). Lịch trình giai đoạn 2–3 chỉ tính khi đã có kết quả; nếu server chậm, giai đoạn 1 tiếp tục chạy tới khi có kết quả.
2. Mỗi bước chọn ngẫu nhiên 1 ghế trong `eligible`, **không trùng ghế ở ~5 bước gần nhất** (pool nhỏ thì nới ra còn "không trùng bước liền trước") để không có cảm giác ô đứng yên.
3. **Bước cuối = `seatCode` server trả**. Ghế thắng không được xuất hiện ở giai đoạn 3 trước bước cuối, để khán giả không đoán trước được.
4. Giai đoạn 3: mỗi ô dừng kèm hiển thị số ghế to ở góc màn (`F7…`, `B12…`) cho người ngồi xa đọc kịp.
5. Dừng → ô thắng giữ sáng, nhấp nháy 3 lần (~1s) → mở popup.
- Dùng `setTimeout` chuỗi theo lịch trình (không `setInterval`), dọn dẹp khi unmount.
- Âm "tick" theo từng bước nên tự thưa dần theo nhịp; giai đoạn 3 dùng tick trầm hơn, to hơn.
- `prefers-reduced-motion`: bỏ glow/scale, giữ nhảy ô.
- Âm thanh (tuỳ chọn, mặc định bật, có nút tắt): tiếng "tick" mỗi bước bằng Web Audio API (oscillator ngắn, không cần file), "ta-da" khi dừng. Trình duyệt yêu cầu tương tác trước khi phát — lần bấm Quay đầu tiên đã đủ.

## Popup trúng thưởng
- Card lớn giữa màn: "🎉 LƯỢT 3/10", **số ghế cực lớn** (`A12`), tên người mua, SĐT che. Hiệu ứng confetti (canvas tự viết ~40 dòng hoặc `canvas-confetti` qua npm — kiểm tra bundle trước khi thêm).
- Nút: **"Tiếp tục"** (đóng popup, ghế chuyển trạng thái winner) · **"Vắng mặt — quay lại lượt này"** (confirm → `voidLuckyDrawWinner` → ghế đánh dấu xám gạch, round giữ nguyên).
- Lượt cuối → popup kèm nút "Xem tổng kết" → màn danh sách toàn bộ người trúng.

## Khôi phục khi F5
State lấy từ DB (`getDrawState`), nên tải lại trang hiện đúng lượt hiện tại + các ghế đã trúng; lượt vừa quay nhưng chưa xem popup thì hiện ngay ở dải chip.
