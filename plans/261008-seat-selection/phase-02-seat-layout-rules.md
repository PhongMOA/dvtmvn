# Phase 2 — Sơ đồ ghế + luật chọn + unit test

Priority: P1 (rủi ro cao nhất) · Status: Done · Effort: 4h

## Files
- Tạo `src/lib/seats/layout.ts` — sơ đồ tĩnh
- Tạo `src/lib/seats/rules.ts` — hàm thuần, KHÔNG import prisma/next (dùng được ở client)
- Tạo `src/lib/seats/rules.test.ts`
- `package.json`: thêm `"test": "tsx --test src/**/*.test.ts"`

## Layout (theo ảnh mẫu)
- Hàng A–L, mỗi hàng 3 khối ngăn bởi 2 lối đi; A1–A4 blocked; hàng M Sweetbox M1–M26 (13 cặp cố định M1+M2…M25+M26).
- Số ghế mỗi khối lấy theo ảnh (đếm lại khi implement); type `vip` cho các hàng giữa theo ảnh — chỉ để hiển thị.
```ts
type SeatType = "normal" | "vip" | "sweetbox" | "blocked";
type Seat = { code: string; type: SeatType; pairWith?: string };
type Row = { label: string; segments: Seat[][] }; // segment = dãy ghế liền, biên = lối đi/tường
export const SEAT_LAYOUT: Row[];
export const SEAT_INDEX: Map<string, { row; segIdx; pos; seat }>;
```
Ghế blocked nằm trong segment nhưng coi như biên (tách run).

## API luật
```ts
seatUnits(code): 1 | 2                   // sweetbox cặp = 2 vé
expandSelection(picked): string[]        // chọn 1 ghế sweetbox → cả cặp
validateSelection({ taken: Set<string>, picked: string[], ticketsNeeded: number })
  : { ok: true } | { ok: false; reason: string; seat?: string }
selectableSeats(taken, current picked, ticketsNeeded): Set<string> // để client làm mờ
```

### Kiểm tra theo thứ tự
1. Mã ghế tồn tại, không blocked, không trong `taken`, không trùng trong picked.
2. Sweetbox: phải có đủ cặp. Tổng units === `ticketsNeeded` (đúng số vé còn lại, all-or-nothing).
3. **Luật ghế lẻ** (chỉ áp cho hàng không phải sweetbox; sweetbox theo cặp nên không sinh lẻ):
   - Với mỗi segment bị đụng: `orphans(free)` = số run trống có độ dài đúng 1 (run tách bởi ghế đã lấy/blocked/biên).
   - Reject nếu `orphans(after) > orphans(before)` → reason `"Không được để trống 1 ghế lẻ cạnh X"`.
   - Ghế lẻ có sẵn không phạt; lấp ghế lẻ làm giảm count → hợp lệ.
4. **Lối thoát**: nếu bước 3 fail, kiểm tra `existsValidPlacement(taken, ticketsNeeded)`; nếu KHÔNG tồn tại cách xếp nào qua được luật → chấp nhận selection (bỏ bước 3).
   - Tính theo segment: với mỗi segment normal, liệt kê tập k khả thi (số ghế chọn trong segment mà không tăng orphan) bằng duyệt tổ hợp (segment ≤ ~12 ghế → ≤ 4096 tập, ổn). Sweetbox: k ∈ {0,2,4,…, 2×cặp trống}.
   - Knapsack bool trên các segment: có tổ hợp tổng = ticketsNeeded không. Memo theo `taken` trong 1 lần gọi.
   - Lưu ý: cách xếp hợp lệ có thể trải nhiều segment — chấp nhận (user không bắt buộc ngồi liền).

## Test cases tối thiểu
- Ghế blocked / đã lấy / không tồn tại → reject.
- Sweetbox chọn 1 ghế lẻ của cặp → reject; 1 vé chọn sweetbox → reject (units 2 ≠ 1).
- Segment 6 trống, chọn ghế 2 (để ghế 1 lẻ) → reject; chọn ghế 1–2 → ok.
- Segment có sẵn ghế lẻ, chọn ghế khác không tạo lẻ mới → ok; lấp ghế lẻ → ok.
- Chỉ còn đúng các run trống dài 2, user 1 vé → luật fail nhưng lối thoát cho phép.
- 3 vé, chọn ở 2 segment khác nhau đều hợp lệ → ok.
- Tổng units ≠ ticketsNeeded → reject.

## Todo
- [ ] layout.ts (đếm ghế theo ảnh)
- [ ] rules.ts
- [ ] rules.test.ts + script test
- [ ] `npm test` pass

## Success
Toàn bộ test pass; rules.ts không có import server-only.
