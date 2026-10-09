import { test } from "node:test";
import assert from "node:assert/strict";
import { SEAT_LAYOUT, type SeatLayout, type SeatType } from "./layout";
import { findContiguousPlacement, newOrphanSeats, validateSelection } from "./rules";

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
  // X2 trống lẻ có sẵn (X1, X3 đã lấy). Chọn X5 -> X4, X6 lẻ mới -> từ chối.
  assert.equal(check(["X1", "X3"], ["X5"]).ok, false);
  // Chọn X6 -> X4-X5 còn dãy 2, chỉ X2 lẻ cũ -> hợp lệ.
  assert.deepEqual(check(["X1", "X3"], ["X6"]), { ok: true, relaxed: false });
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
  assert.equal(findContiguousPlacement(LAYOUT, new Set(taken), 1), null);
  assert.deepEqual(check(taken, ["X1"]), { ok: true, relaxed: true });
});

test("lối thoát: nhóm 2 người chỉ còn dãy 3 ghế -> cho ngồi liền, không ép ngồi tách", () => {
  // Còn X2-X4 (dãy 3) + Y1, Y3 lẻ rời nhau. Chọn X2+X3 để lại X4 lẻ, nhưng
  // không còn chỗ nào cho 2 người ngồi liền mà không để lẻ -> cho phép.
  const taken = ["X1", "X5", "X6", "Y2", "Y5", "S1", "S2", "S3", "S4"];
  assert.equal(findContiguousPlacement(LAYOUT, new Set(taken), 2), null);
  assert.deepEqual(check(taken, ["X2", "X3"]), { ok: true, relaxed: true });
});

test("lối thoát theo khu: khu giữa hết chỗ thì không ép sang khối 2 bên", () => {
  // X (1 khối) là khu giữa, Y (2 khối) là khu 2 bên. Y5 còn trống nhưng khác khu
  // -> chọn X2 (để X1 lẻ) vẫn được cho phép.
  const taken = ["X3", "X4", "X5", "X6", "Y1", "Y2", "Y3", "S1", "S2", "S3", "S4"];
  assert.deepEqual(check(taken, ["X2"]), { ok: true, relaxed: true });
  assert.deepEqual(findContiguousPlacement(LAYOUT, new Set(taken), 1), ["Y5"]);
});

// Giống sơ đồ thật: mỗi hàng 3 khối [bên trái | giữa | bên phải].
const ZONE_LAYOUT: SeatLayout = ["A", "B", "C"].map((label) => ({
  label,
  segments: [seg(label, [1, 2, 3]), seg(label, [4, 5, 6, 7]), seg(label, [8, 9, 10])],
}));

function zoneCheck(taken: string[], picked: string[]) {
  return validateSelection(ZONE_LAYOUT, { taken: new Set(taken), picked, ticketsNeeded: picked.length });
}

test("gợi ý cùng khu giữa, hàng gần nhất (không gợi ý khối bên dù cùng hàng)", () => {
  // A5 để A6 lẻ. Khối bên hàng A còn trống nhưng gợi ý phải ở khối giữa hàng B.
  const result = zoneCheck(["A4", "A7"], ["A5"]);
  assert.equal(result.ok, false);
  assert.deepEqual(!result.ok && result.suggestion, ["B4"]);
});

test("khối giữa hết chỗ ngồi liền -> cho chọn ở giữa dù khối bên còn trống", () => {
  const taken = ["A4", "A7", "B4", "B5", "B6", "B7", "C4", "C5", "C6", "C7"];
  assert.deepEqual(zoneCheck(taken, ["A5"]), { ok: true, relaxed: true });
});

test("chọn ở khối bên thì gợi ý cũng ở khối bên", () => {
  // A2 để A1, A3 lẻ -> gợi ý A1 (cùng hàng, khối bên).
  const result = zoneCheck([], ["A2"]);
  assert.equal(result.ok, false);
  assert.deepEqual(!result.ok && result.suggestion, ["A1"]);
});

test("gợi ý là khối liền không tạo ghế lẻ, nêu trong thông báo", () => {
  const result = check(["S1", "S2", "S3", "S4"], ["X2", "X3"]);
  assert.equal(result.ok, false);
  assert.deepEqual(!result.ok && result.suggestion, ["X1", "X2"]);
  assert.match(!result.ok ? result.reason : "", /X1, X2/);
});

test("gợi ý ưu tiên dãy trống vừa khít, để dành dãy dài cho nhóm đông", () => {
  // X trống cả 6 ghế, Y1-Y2 trống (Y3 có người) -> 2 người gợi ý Y1-Y2.
  const taken = new Set(["Y3", "Y5", "S1", "S2", "S3", "S4"]);
  assert.deepEqual(findContiguousPlacement(LAYOUT, taken, 2)?.sort(), ["Y1", "Y2"]);
});

test("newOrphanSeats: báo ghế lẻ phát sinh khi đang chọn dở, bỏ qua ghế lẻ có sẵn", () => {
  assert.deepEqual(newOrphanSeats(LAYOUT, new Set(), ["X2"]), ["X1"]);
  assert.deepEqual(newOrphanSeats(LAYOUT, new Set(["X1", "X3"]), ["X4", "X5", "X6"]), []);
});

test("chọn trải nhiều segment đều hợp lệ -> ok", () => {
  assert.deepEqual(check([], ["X1", "X2", "Y5"]), { ok: true, relaxed: false });
});

test("findContiguousPlacement tính Sweetbox theo cặp", () => {
  const taken = new Set(["X1", "X2", "X3", "X4", "X5", "X6", "Y1", "Y2", "Y3", "Y5", "S1", "S2"]);
  assert.deepEqual(findContiguousPlacement(LAYOUT, taken, 2), ["S3", "S4"]);
  assert.equal(findContiguousPlacement(LAYOUT, taken, 1), null);
  assert.equal(findContiguousPlacement(LAYOUT, taken, 4), null);
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
