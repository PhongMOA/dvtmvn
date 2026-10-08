/**
 * Sơ đồ ghế tĩnh (demo) — chép theo ảnh mẫu rạp: hàng A–L (không có hàng I),
 * mỗi hàng 3 khối ngăn bởi 2 lối đi, đánh số từ phải sang trái; hàng M là
 * Sweetbox (ghế đôi, cặp cố định M1+M2, M3+M4, …).
 *
 * Mỗi segment là 1 dãy ghế liền nhau, liệt kê theo thứ tự hiển thị trái → phải.
 * Hai đầu segment (lối đi/tường) là biên khi xét luật "không để ghế lẻ" (xem
 * rules.ts); ghế "blocked" nằm trong segment nhưng cũng coi như biên.
 *
 * KHÔNG import gì server-only — file này dùng ở cả client (sơ đồ) lẫn server.
 */
export type SeatType = "normal" | "vip" | "sweetbox" | "blocked";
export type Seat = { code: string; type: SeatType };
export type SeatRow = { label: string; segments: Seat[][] };
export type SeatLayout = SeatRow[];

// Ghế từ số `from` giảm dần tới `to` (hiển thị trái → phải).
function seats(row: string, from: number, to: number, type: SeatType): Seat[] {
  const out: Seat[] = [];
  for (let n = from; n >= to; n--) out.push({ code: `${row}${n}`, type });
  return out;
}

function standardRow(row: string, type: SeatType): SeatRow {
  return {
    label: row,
    segments: [seats(row, 25, 22, type), seats(row, 21, 5, type), seats(row, 4, 1, type)],
  };
}

function backRow(row: string): SeatRow {
  return {
    label: row,
    segments: [seats(row, 28, 25, "vip"), seats(row, 24, 8, "vip"), seats(row, 7, 1, "vip")],
  };
}

export const SEAT_LAYOUT: SeatLayout = [
  {
    label: "A",
    segments: [seats("A", 24, 22, "normal"), seats("A", 21, 5, "normal"), seats("A", 4, 1, "blocked")],
  },
  standardRow("B", "normal"),
  standardRow("C", "normal"),
  ...["D", "E", "F", "G", "H"].map((r) => standardRow(r, "vip")),
  ...["J", "K", "L"].map(backRow),
  { label: "M", segments: [seats("M", 26, 1, "sweetbox")] },
];

/** Ghế cặp của 1 ghế Sweetbox (M1↔M2, M3↔M4, …). Ghế khác trả null. */
export function sweetboxPartner(seat: Seat): string | null {
  if (seat.type !== "sweetbox") return null;
  const match = /^([A-Z]+)(\d+)$/.exec(seat.code);
  if (!match) return null;
  const n = Number(match[2]);
  return `${match[1]}${n % 2 === 1 ? n + 1 : n - 1}`;
}
