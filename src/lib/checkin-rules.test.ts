import { test } from "node:test";
import assert from "node:assert/strict";
import { maskName, phoneKey, sortSeats, ticketCount } from "./checkin-rules";

test("maskName giữ tên gọi, viết tắt họ + đệm", () => {
  assert.equal(maskName("Lê Quốc Bảo"), "L. Q. Bảo");
  assert.equal(maskName("  Hải   Nguyễn "), "H. Nguyễn");
  assert.equal(maskName("Bảo"), "Bảo");
  assert.equal(maskName("đỗ gia huy"), "Đ. G. huy");
  assert.equal(maskName(""), "");
});

test("phoneKey khớp mọi cách nhập SĐT", () => {
  assert.equal(phoneKey("0912345678"), "912345678");
  assert.equal(phoneKey("+84 912 345 678"), "912345678");
  assert.equal(phoneKey("84912345678"), "912345678");
  assert.equal(phoneKey("12345"), null);
});

test("ticketCount chỉ đếm vé của đúng event, trừ phần đã nâng cấp", () => {
  const items = [
    { quantity: 2, upgradedQuantity: 0, comboType: { eventId: "e1", includesTicket: true } },
    { quantity: 3, upgradedQuantity: 1, comboType: { eventId: "e1", includesTicket: true } },
    { quantity: 5, upgradedQuantity: 0, comboType: { eventId: "e1", includesTicket: false } },
    { quantity: 4, upgradedQuantity: 0, comboType: { eventId: "e2", includesTicket: true } },
  ];
  assert.equal(ticketCount(items, "e1"), 4);
  assert.equal(ticketCount(items, "e2"), 4);
  assert.equal(ticketCount(items, "e3"), 0);
});

test("sortSeats theo hàng rồi số", () => {
  assert.deepEqual(sortSeats(["F10", "G5", "F7", "F8"]), ["F7", "F8", "F10", "G5"]);
});
