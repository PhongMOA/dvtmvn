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

type SeatPosition = {
  seat: Seat;
  segment: Seat[];
  rowIndex: number;
  zone: SeatZone;
};

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
        for (const seat of segment)
          map.set(seat.code, { seat, segment, rowIndex, zone });
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
  picked: string[]
): string[] {
  const index = seatIndex(layout);
  const after = new Set([...taken, ...picked]);
  const segments = new Set(
    picked
      .map((code) => index.get(code)?.segment)
      .filter((s): s is Seat[] => !!s)
  );
  const out: string[] = [];
  for (const segment of segments) {
    if (isSweetboxSegment(segment)) continue;
    const before = new Set(orphanSeats(segment, taken));
    for (const code of orphanSeats(segment, after))
      if (!before.has(code)) out.push(code);
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
  near: string[] = []
): string[] | null {
  if (count <= 0) return null;
  const index = seatIndex(layout);
  const nearPositions = near
    .map((code) => index.get(code))
    .filter((p): p is SeatPosition => !!p);
  const zones = new Set(nearPositions.map((p) => p.zone));
  const nearRows = nearPositions.map((p) => p.rowIndex);
  const rowDistance = (rowIndex: number) =>
    nearRows.length
      ? Math.min(...nearRows.map((r) => Math.abs(r - rowIndex)))
      : 0;

  let best: { seats: string[]; distance: number; leftover: number } | null =
    null;
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
      if (zones.size > 0 && !zones.has(segmentZone(row.segments, segIndex)))
        continue;
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
          const seats = run
            .slice(start, start + count)
            .map((seat) => seat.code);
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

/** Hàng lấy làm tâm rạp khi gợi ý ghế tốt nhất. */
export const CENTER_ROW = "G";
// Lệch 1 hàng so với hàng tâm "đắt" hơn lệch 1 ghế sang ngang.
const ROW_WEIGHT = 1.5;
// Lối đi giữa 2 khối, tính theo bề rộng 1 ghế.
const AISLE_WIDTH = 0.5;

const offsetCache = new WeakMap<SeatLayout, Map<string, number>>();

/**
 * Hoành độ tâm mỗi ghế so với trục giữa rạp (đơn vị: 1 ghế, âm = bên trái).
 * Trục giữa = tâm khối chính giữa (hàng số khối lẻ) hoặc tâm cả hàng.
 */
export function seatOffsets(layout: SeatLayout): Map<string, number> {
  let offsets = offsetCache.get(layout);
  if (!offsets) {
    const map = new Map<string, number>();
    offsets = map;
    for (const row of layout) {
      const count = row.segments.length;
      const xs: number[][] = [];
      let pos = 0;
      let center = 0;
      row.segments.forEach((segment, i) => {
        if (count % 2 === 1 && i === (count - 1) / 2)
          center = pos + segment.length / 2;
        xs.push(segment.map((_, k) => pos + k + 0.5));
        pos += segment.length + AISLE_WIDTH;
      });
      if (count % 2 === 0) center = (pos - AISLE_WIDTH) / 2;
      row.segments.forEach((segment, i) =>
        segment.forEach((seat, k) => map.set(seat.code, xs[i][k] - center))
      );
    }
    offsetCache.set(layout, offsets);
  }
  return offsets;
}

/**
 * Độ "khó lấp" của 1 dãy trống dài `length` ghế với người chọn sau (nhóm 2
 * người là phổ biến nhất):
 * - 1 ghế: ghế lẻ, gần như bỏ phí.
 * - 3 ghế: nhóm 2 người không chen vào được (luôn để lại 1 ghế lẻ).
 * - 2 ghế: chỉ vừa 1 cặp.
 * - Dãy dài hơn: lấp thoải mái, nhưng mỗi dãy vẫn tính 1 — chia 1 dãy thành 2
 *   (chọn lọt giữa thay vì sát ghế có người/lối đi) là thêm 1 mảnh vụn.
 */
function gapAwkwardness(length: number): number {
  if (length === 1) return 10;
  if (length === 3) return 4;
  if (length === 2) return 2.5;
  return 1;
}

/**
 * Chênh độ "khó lấp" của các dãy trống trước/sau khi chọn `seats`. Âm = lựa chọn
 * làm sơ đồ gọn hơn (lấp khe 2–3 ghế, ngồi sát ghế có người); dương = để lại
 * mảnh vụn cho người sau. Sweetbox ghép cặp cố định nên không tính.
 */
export function gapCost(
  layout: SeatLayout,
  taken: Set<string>,
  seats: string[]
): number {
  const index = seatIndex(layout);
  const after = new Set([...taken, ...seats]);
  const segments = new Set(
    seats
      .map((code) => index.get(code)?.segment)
      .filter((s): s is Seat[] => !!s)
  );
  const cost = (segment: Seat[], occupied: Set<string>) =>
    freeRuns(segment, occupied).reduce(
      (sum, run) => sum + gapAwkwardness(run.length),
      0
    );
  let delta = 0;
  for (const segment of segments) {
    if (isSweetboxSegment(segment)) continue;
    delta += cost(segment, after) - cost(segment, taken);
  }
  return delta;
}

// Mỗi điểm "khó lấp" đổi ra bao nhiêu điểm vị trí: 1 mảnh vụn mới (= 1) bằng
// lệch 2 ghế sang ngang; khe 3 ghế (= 4) bằng lệch 8 ghế / hơn 5 hàng.
export const GAP_WEIGHT = 2;

/** Điểm tổng (thấp = tốt): vị trí đẹp + không để mảnh trống khó lấp cho người sau. */
export function placementScore(
  layout: SeatLayout,
  taken: Set<string>,
  seats: string[]
): number {
  return (
    seatBlockScore(layout, seats) + GAP_WEIGHT * gapCost(layout, taken, seats)
  );
}

/**
 * Gợi ý khối `count` ghế liền nhau tốt nhất khi vừa vào chọn ghế (placementScore
 * thấp nhất): gần trục giữa rạp, quanh hàng CENTER_ROW, ưu tiên ngồi sát ghế đã
 * có người/lấp khe thay vì xé lẻ dãy trống; không làm tăng số ghế lẻ. Nếu không
 * còn khối nào như vậy thì nới luật ghế lẻ (validateSelection cũng sẽ relaxed).
 * null nếu không còn dãy trống nào đủ dài.
 */
export function recommendSeats(
  layout: SeatLayout,
  taken: Set<string>,
  count: number
): string[] | null {
  const pickBest = (blocks: string[][]) => {
    let best: { seats: string[]; score: number } | null = null;
    for (const seats of blocks) {
      const score = placementScore(layout, taken, seats);
      if (!best || score < best.score) best = { seats, score };
    }
    return best ? (best as { seats: string[] }).seats : null;
  };
  return (
    pickBest(listPlacements(layout, taken, count)) ??
    pickBest(listPlacements(layout, taken, count, true))
  );
}

/**
 * Điểm "tệ" của 1 nhóm ghế (thấp = đẹp): độ lệch tâm nhóm so với trục giữa rạp
 * + ROW_WEIGHT × số hàng cách CENTER_ROW (hàng tính theo trung bình các ghế).
 */
export function seatBlockScore(layout: SeatLayout, seats: string[]): number {
  if (seats.length === 0) return Infinity;
  const offsets = seatOffsets(layout);
  const index = seatIndex(layout);
  const found = layout.findIndex((row) => row.label === CENTER_ROW);
  const centerRow = found >= 0 ? found : Math.floor(layout.length / 2);
  const dx =
    seats.reduce((sum, code) => sum + (offsets.get(code) ?? 0), 0) /
    seats.length;
  const row =
    seats.reduce(
      (sum, code) => sum + (index.get(code)?.rowIndex ?? centerRow),
      0
    ) / seats.length;
  return Math.abs(dx) + ROW_WEIGHT * Math.abs(row - centerRow);
}

/**
 * Mọi khối `count` ghế liền nhau còn trống (cùng 1 dãy). Mặc định chỉ lấy khối
 * không làm tăng số ghế lẻ; `allowOrphans` bỏ điều kiện đó. Sweetbox: count
 * chẵn, bắt đầu ở đầu cặp (M26,M25), (M24,M23)…
 */
export function listPlacements(
  layout: SeatLayout,
  taken: Set<string>,
  count: number,
  allowOrphans = false
): string[][] {
  const out: string[][] = [];
  if (count <= 0) return out;
  for (const row of layout) {
    for (const segment of row.segments) {
      if (isSweetboxSegment(segment)) {
        if (count % 2 !== 0) continue;
        for (let i = 0; i + count <= segment.length; i += 2) {
          const seats = segment.slice(i, i + count).map((seat) => seat.code);
          if (seats.every((code) => !taken.has(code))) out.push(seats);
        }
        continue;
      }
      const orphansBefore = orphanSeats(segment, taken).length;
      for (const run of freeRuns(segment, taken)) {
        for (let start = 0; start + count <= run.length; start++) {
          const seats = run
            .slice(start, start + count)
            .map((seat) => seat.code);
          if (
            allowOrphans ||
            orphanSeats(segment, new Set([...taken, ...seats])).length <=
              orphansBefore
          ) {
            out.push(seats);
          }
        }
      }
    }
  }
  return out;
}

/**
 * Ảnh hưởng của `picked` tới các dãy trống trong segment chứa nó:
 * - newOrphans: ghế lẻ mới.
 * - awkwardGaps: khe 2–3 ghế MỚI tạo ra (khe 3 ghế: nhóm 2 người không chen
 *   được), kèm mã ghế trong khe.
 * - splitRuns: số dãy trống bị xé đôi (chọn lọt giữa thay vì sát ghế có
 *   người/lối đi).
 * - touchesTaken: có ghế nào sát ghế đã có người không.
 */
export function selectionImpact(
  layout: SeatLayout,
  taken: Set<string>,
  picked: string[]
) {
  const index = seatIndex(layout);
  const after = new Set([...taken, ...picked]);
  const segments = new Set(
    picked
      .map((code) => index.get(code)?.segment)
      .filter((s): s is Seat[] => !!s)
  );
  const awkwardGaps: string[][] = [];
  let splitRuns = 0;
  const runsAfter: number[] = [];
  for (const segment of segments) {
    if (isSweetboxSegment(segment)) continue;
    const before = freeRuns(segment, taken);
    const runs = freeRuns(segment, after);
    const existed = new Set(
      before.map((run) => run.map((s) => s.code).join(","))
    );
    for (const run of runs) {
      if (
        (run.length === 2 || run.length === 3) &&
        !existed.has(run.map((s) => s.code).join(","))
      ) {
        awkwardGaps.push(run.map((s) => s.code));
      }
    }
    splitRuns += Math.max(0, runs.length - before.length);
    runsAfter.push(...runs.map((run) => run.length));
  }
  const touchesTaken = picked.some((code) => {
    const position = index.get(code);
    if (!position) return false;
    const i = position.segment.findIndex((s) => s.code === code);
    return [i - 1, i + 1].some((j) => {
      const neighbor = position.segment[j]?.code;
      return !!neighbor && taken.has(neighbor);
    });
  });
  const rows = [...new Set(picked.map((code) => index.get(code)?.rowIndex))]
    .filter((r): r is number => r !== undefined)
    .map((r) => layout[r].label);
  const zones = [
    ...new Set(picked.map((code) => index.get(code)?.zone)),
  ].filter((z): z is SeatZone => !!z);
  const contiguous =
    segments.size === 1 &&
    listPlacements(layout, taken, picked.length, true).some(
      (block) =>
        block.length === picked.length &&
        block.every((code) => picked.includes(code))
    );
  return {
    rows,
    zones,
    contiguous,
    newOrphans: newOrphanSeats(layout, taken, picked),
    awkwardGaps,
    splitRuns,
    touchesTaken,
    gapCost: gapCost(layout, taken, picked),
    freeRunsAfter: runsAfter.sort((a, b) => a - b),
  };
}

export type SelectionCheck =
  | { ok: true; relaxed: boolean }
  | { ok: false; reason: string; seat?: string; suggestion?: string[] };

export function validateSelection(
  layout: SeatLayout,
  input: { taken: Set<string>; picked: string[]; ticketsNeeded: number }
): SelectionCheck {
  const { taken, picked, ticketsNeeded } = input;
  const index = seatIndex(layout);
  const pickedSet = new Set(picked);

  if (pickedSet.size !== picked.length)
    return { ok: false, reason: "Danh sách ghế bị trùng." };

  for (const code of picked) {
    const position = index.get(code);
    if (!position)
      return { ok: false, reason: `Ghế ${code} không tồn tại.`, seat: code };
    if (position.seat.type === "blocked") {
      return { ok: false, reason: `Ghế ${code} không thể chọn.`, seat: code };
    }
    if (taken.has(code)) {
      return {
        ok: false,
        reason: `Ghế ${code} vừa có người chọn.`,
        seat: code,
      };
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

  const suggestion = findContiguousPlacement(
    layout,
    taken,
    ticketsNeeded,
    picked
  );
  if (!suggestion) return { ok: true, relaxed: true };
  return {
    ok: false,
    reason:
      `Cách chọn này để trống ghế lẻ ${orphans.join(
        ", "
      )}. Cùng khu vẫn còn chỗ cho ` +
      `${ticketsNeeded} người ngồi liền mà không để ghế lẻ: ${formatSeats(
        suggestion
      )}.`,
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
