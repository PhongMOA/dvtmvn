import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RECENT_WINDOW,
  SPIN_TIMING,
  buildFinale,
  currentRound,
  eligibleSeats,
  maskPhone,
  pickNext,
} from "./lucky-draw-rules";

// PRNG cố định để test lặp lại được.
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const POOL = Array.from({ length: 30 }, (_, i) => `F${i + 1}`);

test("eligibleSeats loại ghế đã trúng, kể cả lượt bị huỷ", () => {
  const winners = [
    { round: 1, seatCode: "A1", voided: false },
    { round: 2, seatCode: "B2", voided: true },
  ];
  assert.deepEqual(eligibleSeats(["A1", "B2", "C3"], winners), ["C3"]);
});

test("currentRound không tăng khi lượt bị huỷ", () => {
  assert.equal(currentRound([]), 1);
  assert.equal(
    currentRound([
      { round: 1, seatCode: "A1", voided: false },
      { round: 2, seatCode: "B2", voided: true },
    ]),
    2,
  );
});

test("maskPhone giữ 2 số đầu + 3 số cuối", () => {
  assert.equal(maskPhone("0912345678"), "09•• ••• 678");
  assert.equal(maskPhone("+84 912 345 678"), "84•• ••• 678");
  assert.equal(maskPhone("123"), null);
  assert.equal(maskPhone(null), null);
});

test("pickNext tránh ô vừa sáng và ô bị loại", () => {
  const rand = seeded(1);
  for (let i = 0; i < 200; i++) {
    const code = pickNext(["A", "B", "C"], ["A"], rand, "B");
    assert.equal(code, "C");
  }
  // pool chỉ còn ô bị tránh → vẫn trả được ô hợp lệ
  assert.equal(pickNext(["A"], ["A"], rand), "A");
});

test("buildFinale: dừng ở ghế thắng, thắng không lộ trước, nhịp chậm dần", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const steps = buildFinale(POOL, "F7", [], seeded(seed));
    assert.equal(steps.at(-1)!.code, "F7");
    assert.ok(steps.slice(0, -1).every((s) => s.code !== "F7"));

    const holds = steps.slice(0, -1).map((s) => s.holdMs);
    for (let i = 1; i < holds.length; i++) assert.ok(holds[i] >= holds[i - 1]);
    assert.deepEqual(holds.slice(-SPIN_TIMING.crawlMs.length), [...SPIN_TIMING.crawlMs]);

    for (let i = 1; i < steps.length - 1; i++) {
      const recent = steps.slice(Math.max(0, i - RECENT_WINDOW), i).map((s) => s.code);
      assert.ok(!recent.includes(steps[i].code), `lặp ô ${steps[i].code} ở bước ${i}`);
    }
  }
});

test("buildFinale với pool chỉ có ghế thắng", () => {
  const steps = buildFinale(["A1"], "A1");
  assert.ok(steps.every((s) => s.code === "A1"));
});
