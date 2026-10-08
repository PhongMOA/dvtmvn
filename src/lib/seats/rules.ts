import { sweetboxPartner, type Seat, type SeatLayout } from "./layout";

/**
 * Luật chọn ghế — hàm thuần, dùng chung client (báo lỗi trước khi gửi) và
 * server (confirmSeats re-validate trong transaction). KHÔNG import server-only.
 *
 * - Mỗi ghế = 1 vé; Sweetbox là ghế đôi, phải chọn cả cặp (= 2 vé).
 * - Chọn đủ đúng số vé còn lại trong 1 lần.
 * - Không để ghế lẻ: trong mỗi segment ghế thường, lựa chọn không được làm TĂNG
 *   số khoảng trống dài đúng 1 ghế (ghế lẻ có sẵn không tính; lấp ghế lẻ thì tốt).
 * - Lối thoát: nếu với số vé của user KHÔNG tồn tại cách xếp nào qua được luật
 *   ghế lẻ thì bỏ qua luật đó (relaxed) — tránh kẹt user không chọn được gì.
 */

type SeatPosition = { seat: Seat; segment: Seat[] };

const indexCache = new WeakMap<SeatLayout, Map<string, SeatPosition>>();

export function seatIndex(layout: SeatLayout): Map<string, SeatPosition> {
  let index = indexCache.get(layout);
  if (!index) {
    index = new Map();
    for (const row of layout) {
      for (const segment of row.segments) {
        for (const seat of segment) index.set(seat.code, { seat, segment });
      }
    }
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

/**
 * Các số ghế k (0..max) chọn được trong 1 segment mà không làm tăng số ghế lẻ.
 * Trong 1 dãy trống dài L, chọn k ghế dồn về 1 đầu để phần còn lại liền nhau →
 * ghế lẻ tối thiểu = (L − k === 1 ? 1 : 0). DP cộng dồn qua các dãy của segment.
 */
function segmentFeasibleCounts(segment: Seat[], taken: Set<string>, max: number): boolean[] {
  const feasible = new Array<boolean>(max + 1).fill(false);

  if (isSweetboxSegment(segment)) {
    let freePairs = 0;
    for (const seat of segment) {
      const partner = sweetboxPartner(seat);
      if (!partner || seat.code > partner) continue; // đếm mỗi cặp 1 lần
      if (!taken.has(seat.code) && !taken.has(partner)) freePairs++;
    }
    for (let k = 0; k <= max && k <= freePairs * 2; k += 2) feasible[k] = true;
    return feasible;
  }

  // dp[k] = thay đổi số ghế lẻ nhỏ nhất khi chọn k ghế (≤ 0 là hợp lệ).
  let dp = new Array<number>(max + 1).fill(Infinity);
  dp[0] = 0;
  for (const run of freeRuns(segment, taken)) {
    const length = run.length;
    const before = length === 1 ? 1 : 0;
    const next = new Array<number>(max + 1).fill(Infinity);
    for (let used = 0; used <= max; used++) {
      if (dp[used] === Infinity) continue;
      for (let k = 0; k <= length && used + k <= max; k++) {
        const after = length - k === 1 ? 1 : 0;
        next[used + k] = Math.min(next[used + k], dp[used] + after - before);
      }
    }
    dp = next;
  }
  for (let k = 0; k <= max; k++) feasible[k] = dp[k] <= 0;
  return feasible;
}

/** Có tồn tại cách chọn đúng `count` ghế mà không tạo thêm ghế lẻ không. */
export function existsValidPlacement(
  layout: SeatLayout,
  taken: Set<string>,
  count: number,
): boolean {
  let reachable = new Array<boolean>(count + 1).fill(false);
  reachable[0] = true;
  for (const row of layout) {
    for (const segment of row.segments) {
      const feasible = segmentFeasibleCounts(segment, taken, count);
      const next = [...reachable];
      for (let used = 0; used <= count; used++) {
        if (!reachable[used]) continue;
        for (let k = 1; used + k <= count; k++) {
          if (feasible[k]) next[used + k] = true;
        }
      }
      reachable = next;
      if (reachable[count]) return true;
    }
  }
  return reachable[count];
}

export type SelectionCheck =
  | { ok: true; relaxed: boolean }
  | { ok: false; reason: string; seat?: string };

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

  const after = new Set([...taken, ...picked]);
  const segments = new Set(picked.map((code) => index.get(code)!.segment));
  for (const segment of segments) {
    if (isSweetboxSegment(segment)) continue;
    const orphansBefore = orphanSeats(segment, taken);
    const orphansAfter = orphanSeats(segment, after);
    if (orphansAfter.length <= orphansBefore.length) continue;

    if (!existsValidPlacement(layout, taken, ticketsNeeded)) return { ok: true, relaxed: true };
    const orphan = orphansAfter.find((code) => !orphansBefore.includes(code));
    return {
      ok: false,
      reason:
        `Cách chọn này để trống 1 ghế lẻ (${orphan}). Hãy chọn sát lối đi/ghế đã có ` +
        `người, hoặc chừa ít nhất 2 ghế trống cạnh nhau.`,
      seat: orphan,
    };
  }

  return { ok: true, relaxed: false };
}
