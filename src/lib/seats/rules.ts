import { sweetboxPartner, type Seat, type SeatLayout } from "./layout";

/**
 * Luật chọn ghế — hàm thuần, dùng chung client (báo lỗi trước khi gửi) và
 * server (confirmSeats re-validate trong transaction). KHÔNG import server-only.
 *
 * - Mỗi ghế = 1 vé; Sweetbox là ghế đôi, phải chọn cả cặp (= 2 vé).
 * - Chọn đủ đúng số vé còn lại trong 1 lần.
 * - Không để ghế lẻ: trong mỗi segment ghế thường, lựa chọn không được làm TĂNG
 *   số khoảng trống dài đúng 1 ghế (ghế lẻ có sẵn không tính; lấp ghế lẻ thì tốt).
 * - Lối thoát: nếu trong CÙNG KHU với ghế user chọn (khối giữa / khối 2 bên /
 *   Sweetbox) KHÔNG còn chỗ nào cho cả nhóm ngồi LIỀN NHAU mà không tạo ghế lẻ
 *   thì bỏ qua luật đó (relaxed). Không ép nhóm ngồi tách ra, cũng không ép
 *   đổi sang khu tầm nhìn kém hơn chỉ để tránh ghế lẻ.
 *   Còn chỗ thì báo lỗi kèm chỗ gợi ý (suggestion, cùng khu, gần hàng đang
 *   chọn nhất) để client tô viền.
 */

/** Khu ghế: khối giữa (tầm nhìn tốt nhất), khối 2 bên, Sweetbox. */
export type SeatZone = "middle" | "side" | "sweetbox";

type SeatPosition = { seat: Seat; segment: Seat[]; rowIndex: number; zone: SeatZone };

// Hàng 1 khối hoặc khối chính giữa của hàng có số khối lẻ (≥ 3) là "middle".
function segmentZone(segments: Seat[][], segIndex: number): SeatZone {
  if (isSweetboxSegment(segments[segIndex])) return "sweetbox";
  const count = segments.length;
  return count % 2 === 1 && segIndex === (count - 1) / 2 ? "middle" : "side";
}

const indexCache = new WeakMap<SeatLayout, Map<string, SeatPosition>>();

export function seatIndex(layout: SeatLayout): Map<string, SeatPosition> {
  let index = indexCache.get(layout);
  if (!index) {
    const map = new Map<string, SeatPosition>();
    index = map;
    layout.forEach((row, rowIndex) => {
      row.segments.forEach((segment, segIndex) => {
        const zone = segmentZone(row.segments, segIndex);
        for (const seat of segment) map.set(seat.code, { seat, segment, rowIndex, zone });
      });
    });
    indexCache.set(layout, index);
  }
  return index;
}

function isSweetboxSegment(segment: Seat[]): boolean {
  return segment.some((s) => s.type === "sweetbox");
}

// Các dãy ghế trống liền nhau trong segment; ghế blocked/đã lấy là vách ngăn.
function freeRuns(segment: Seat[], occupied: Set<string>): Seat[][] {
  const runs: Seat[][] = [];
  let current: Seat[] = [];
  for (const seat of segment) {
    if (seat.type === "blocked" || occupied.has(seat.code)) {
      if (current.length) runs.push(current);
      current = [];
    } else {
      current.push(seat);
    }
  }
  if (current.length) runs.push(current);
  return runs;
}

function orphanSeats(segment: Seat[], occupied: Set<string>): string[] {
  return freeRuns(segment, occupied)
    .filter((run) => run.length === 1)
    .map((run) => run[0].code);
}

/** Ghế lẻ MỚI phát sinh nếu chọn `picked` (ghế lẻ có sẵn không tính). */
export function newOrphanSeats(
  layout: SeatLayout,
  taken: Set<string>,
  picked: string[],
): string[] {
  const index = seatIndex(layout);
  const after = new Set([...taken, ...picked]);
  const segments = new Set(
    picked.map((code) => index.get(code)?.segment).filter((s): s is Seat[] => !!s),
  );
  const out: string[] = [];
  for (const segment of segments) {
    if (isSweetboxSegment(segment)) continue;
    const before = new Set(orphanSeats(segment, taken));
    for (const code of orphanSeats(segment, after)) if (!before.has(code)) out.push(code);
  }
  return out;
}

/**
 * Tìm 1 khối `count` ghế LIỀN NHAU (cùng 1 dãy trống) chọn được mà không làm
 * tăng số ghế lẻ; null nếu không còn. Sweetbox: count chẵn, các cặp trống liền
 * nhau.
 *
 * `near` (ghế user đang chọn): chỉ tìm trong cùng khu với các ghế đó, ưu tiên
 * hàng gần nhất. Sau đó ưu tiên khối vừa khít nhất (dãy trống dư ít ghế nhất)
 * để dành dãy dài cho nhóm đông; hoà thì lấy khối gặp trước (gần màn hình hơn).
 */
export function findContiguousPlacement(
  layout: SeatLayout,
  taken: Set<string>,
  count: number,
  near: string[] = [],
): string[] | null {
  if (count <= 0) return null;
  const index = seatIndex(layout);
  const nearPositions = near
    .map((code) => index.get(code))
    .filter((p): p is SeatPosition => !!p);
  const zones = new Set(nearPositions.map((p) => p.zone));
  const nearRows = nearPositions.map((p) => p.rowIndex);
  const rowDistance = (rowIndex: number) =>
    nearRows.length ? Math.min(...nearRows.map((r) => Math.abs(r - rowIndex))) : 0;

  let best: { seats: string[]; distance: number; leftover: number } | null = null;
  let rowIndex = 0;
  const consider = (seats: string[], runLength: number) => {
    const distance = rowDistance(rowIndex);
    const leftover = runLength - count;
    if (
      !best ||
      distance < best.distance ||
      (distance === best.distance && leftover < best.leftover)
    ) {
      best = { seats, distance, leftover };
    }
  };

  for (; rowIndex < layout.length; rowIndex++) {
    const row = layout[rowIndex];
    for (const [segIndex, segment] of row.segments.entries()) {
      if (zones.size > 0 && !zones.has(segmentZone(row.segments, segIndex))) continue;
      if (isSweetboxSegment(segment)) {
        if (count % 2 !== 0) continue;
        // Segment liệt kê cặp liền nhau (M26,M25), (M24,M23)…; gom các cặp trống liền.
        let run: string[] = [];
        const flush = () => {
          if (run.length >= count) consider(run.slice(0, count), run.length);
          run = [];
        };
        for (let i = 0; i + 1 < segment.length; i += 2) {
          const pair = [segment[i].code, segment[i + 1].code];
          if (pair.some((code) => taken.has(code))) flush();
          else run.push(...pair);
        }
        flush();
        continue;
      }

      const orphansBefore = orphanSeats(segment, taken).length;
      for (const run of freeRuns(segment, taken)) {
        if (run.length < count) continue;
        for (let start = 0; start + count <= run.length; start++) {
          const seats = run.slice(start, start + count).map((seat) => seat.code);
          const after = new Set([...taken, ...seats]);
          if (orphanSeats(segment, after).length <= orphansBefore) {
            consider(seats, run.length);
            break;
          }
        }
      }
    }
  }
  return best ? (best as { seats: string[] }).seats : null;
}

export type SelectionCheck =
  | { ok: true; relaxed: boolean }
  | { ok: false; reason: string; seat?: string; suggestion?: string[] };

export function validateSelection(
  layout: SeatLayout,
  input: { taken: Set<string>; picked: string[]; ticketsNeeded: number },
): SelectionCheck {
  const { taken, picked, ticketsNeeded } = input;
  const index = seatIndex(layout);
  const pickedSet = new Set(picked);

  if (pickedSet.size !== picked.length) return { ok: false, reason: "Danh sách ghế bị trùng." };

  for (const code of picked) {
    const position = index.get(code);
    if (!position) return { ok: false, reason: `Ghế ${code} không tồn tại.`, seat: code };
    if (position.seat.type === "blocked") {
      return { ok: false, reason: `Ghế ${code} không thể chọn.`, seat: code };
    }
    if (taken.has(code)) {
      return { ok: false, reason: `Ghế ${code} vừa có người chọn.`, seat: code };
    }
    const partner = sweetboxPartner(position.seat);
    if (partner && !pickedSet.has(partner)) {
      return {
        ok: false,
        reason: `Ghế đôi Sweetbox phải chọn cả cặp ${code} + ${partner}.`,
        seat: code,
      };
    }
  }

  if (picked.length !== ticketsNeeded) {
    return {
      ok: false,
      reason: `Cần chọn đúng ${ticketsNeeded} ghế (đang chọn ${picked.length}).`,
    };
  }

  const orphans = newOrphanSeats(layout, taken, picked);
  if (orphans.length === 0) return { ok: true, relaxed: false };

  const suggestion = findContiguousPlacement(layout, taken, ticketsNeeded, picked);
  if (!suggestion) return { ok: true, relaxed: true };
  return {
    ok: false,
    reason:
      `Cách chọn này để trống ghế lẻ ${orphans.join(", ")}. Cùng khu vẫn còn chỗ cho ` +
      `${ticketsNeeded} người ngồi liền mà không để ghế lẻ: ${formatSeats(suggestion)}.`,
    seat: orphans[0],
    suggestion,
  };
}

/** Khối ghế liền cùng hàng (kết quả findContiguousPlacement) -> "E10, E11" / "E10–E13". */
export function formatSeats(codes: string[]): string {
  const num = (code: string) => Number(code.replace(/^[A-Z]+/, ""));
  const sorted = [...codes].sort((a, b) => num(a) - num(b));
  if (sorted.length <= 2) return sorted.join(", ");
  return `${sorted[0]}–${sorted[sorted.length - 1]}`;
}
