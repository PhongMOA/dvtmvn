import { test } from "node:test";
import assert from "node:assert/strict";
import { SEAT_LAYOUT, type SeatLayout, type SeatType } from "./layout";
import { existsValidPlacement, validateSelection } from "./rules";

// Layout nhỏ cho test: hàng X 1 segment 6 ghế (X1..X6), hàng Y 2 segment
// (Y1..Y3 | Y4 blocked, Y5), hàng S Sweetbox S1..S4 (cặp S1+S2, S3+S4).
function seg(row: string, codes: number[], type: SeatType = "normal") {
  return codes.map((n) => ({ code: `${row}${n}`, type }));
}
const LAYOUT: SeatLayout = [
  { label: "X", segments: [seg("X", [1, 2, 3, 4, 5, 6])] },
  {
    label: "Y",
    segments: [seg("Y", [1, 2, 3]), [{ code: "Y4", type: "blocked" }, { code: "Y5", type: "normal" }]],
  },
  { label: "S", segments: [seg("S", [1, 2, 3, 4], "sweetbox")] },
];

function check(taken: string[], picked: string[], ticketsNeeded = picked.length) {
  return validateSelection(LAYOUT, { taken: new Set(taken), picked, ticketsNeeded });
}

test("ghế không tồn tại / blocked / đã có người -> từ chối", () => {
  assert.equal(check([], ["Z9"]).ok, false);
  assert.equal(check([], ["Y4"]).ok, false);
  const taken = check(["X1"], ["X1"]);
  assert.equal(taken.ok, false);
  assert.equal(!taken.ok && taken.seat, "X1");
});

test("chọn trùng ghế trong danh sách -> từ chối", () => {
  assert.equal(check([], ["X1", "X1"], 2).ok, false);
});

test("số ghế phải đúng bằng số vé cần chọn", () => {
  assert.equal(check([], ["X1"], 2).ok, false);
  assert.equal(check([], ["X1", "X2", "X3"], 2).ok, false);
});

test("Sweetbox phải chọn cả cặp, 1 vé không chọn được Sweetbox", () => {
  assert.equal(check([], ["S1"], 1).ok, false);
  assert.equal(check([], ["S2", "S3"], 2).ok, false); // khác cặp
  assert.deepEqual(check([], ["S1", "S2"], 2), { ok: true, relaxed: false });
});

test("để trống 1 ghế lẻ ở đầu dãy -> từ chối, chỉ ra ghế lẻ", () => {
  const result = check([], ["X2"]);
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.seat, "X1");
});

test("chọn sát đầu dãy hoặc chừa >= 2 ghế -> hợp lệ", () => {
  assert.deepEqual(check([], ["X1", "X2"]), { ok: true, relaxed: false });
  assert.deepEqual(check([], ["X3", "X4"]), { ok: true, relaxed: false }); // chừa X1-X2, X5-X6
});

test("tạo khoảng trống 1 ghế ở giữa 2 ghế đã có người -> từ chối", () => {
  // X1 đã có người, chọn X3 -> X2 lẻ.
  assert.equal(check(["X1"], ["X3"]).ok, false);
});

test("ghế lẻ có sẵn không phạt; lấp ghế lẻ thì hợp lệ", () => {
  // X2 trống lẻ có sẵn (X1, X3 đã lấy). Chọn X4+X5 chừa X6 lẻ -> tăng ghế lẻ -> từ chối.
  assert.equal(check(["X1", "X3"], ["X4", "X5"]).ok, false);
  // Chọn X5+X6 -> X4 lẻ mới, X2 lẻ cũ: tăng -> từ chối.
  assert.equal(check(["X1", "X3"], ["X5", "X6"]).ok, false);
  // Lấp X2 -> giảm ghế lẻ.
  assert.deepEqual(check(["X1", "X3"], ["X2"]), { ok: true, relaxed: false });
  // Ghế lẻ X2 có sẵn, chọn X4..X6 không tạo lẻ mới -> hợp lệ.
  assert.deepEqual(check(["X1", "X3"], ["X4", "X5", "X6"]), { ok: true, relaxed: false });
});

test("ghế blocked là vách ngăn: Y5 đứng một mình không bị coi là tạo lẻ khi chọn", () => {
  assert.deepEqual(check([], ["Y5"]), { ok: true, relaxed: false });
});

test("lối thoát: không còn cách nào tránh ghế lẻ thì cho chọn", () => {
  // Chỉ còn X1-X2 trống (dãy 2 ghế), Y và S hết chỗ; 1 vé buộc phải để lẻ.
  const taken = ["X3", "X4", "X5", "X6", "Y1", "Y2", "Y3", "Y5", "S1", "S2", "S3", "S4"];
  assert.equal(existsValidPlacement(LAYOUT, new Set(taken), 1), false);
  assert.deepEqual(check(taken, ["X1"]), { ok: true, relaxed: true });
});

test("không dùng lối thoát khi vẫn còn cách xếp hợp lệ ở segment khác", () => {
  // Y5 (sau ghế blocked) chọn được mà không tạo lẻ -> chọn X2 (để X1 lẻ) bị từ chối.
  const taken = ["X3", "X4", "X5", "X6", "Y1", "Y2", "Y3", "S1", "S2", "S3", "S4"];
  assert.equal(existsValidPlacement(LAYOUT, new Set(taken), 1), true);
  assert.equal(check(taken, ["X2"]).ok, false);
});

test("chọn trải nhiều segment đều hợp lệ -> ok", () => {
  assert.deepEqual(check([], ["X1", "X2", "Y5"]), { ok: true, relaxed: false });
});

test("existsValidPlacement tính Sweetbox theo cặp", () => {
  const taken = new Set(["X1", "X2", "X3", "X4", "X5", "X6", "Y1", "Y2", "Y3", "Y5", "S1", "S2"]);
  assert.equal(existsValidPlacement(LAYOUT, taken, 2), true); // S3+S4
  assert.equal(existsValidPlacement(LAYOUT, taken, 1), false);
  assert.equal(existsValidPlacement(LAYOUT, taken, 4), false);
});

test("sơ đồ thật: mã ghế không trùng, A1-A4 blocked, Sweetbox M1-M26", () => {
  const codes = SEAT_LAYOUT.flatMap((r) => r.segments.flat().map((s) => s.code));
  assert.equal(new Set(codes).size, codes.length);
  const blocked = SEAT_LAYOUT.flatMap((r) => r.segments.flat()).filter((s) => s.type === "blocked");
  assert.deepEqual(blocked.map((s) => s.code).sort(), ["A1", "A2", "A3", "A4"]);
  const sweetbox = SEAT_LAYOUT.flatMap((r) => r.segments.flat()).filter((s) => s.type === "sweetbox");
  assert.equal(sweetbox.length, 26);
  assert.deepEqual(validateSelection(SEAT_LAYOUT, { taken: new Set(), picked: ["M1", "M2"], ticketsNeeded: 2 }), {
    ok: true,
    relaxed: false,
  });
});
