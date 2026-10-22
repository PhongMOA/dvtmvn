// Logic thuần (không DB) của quay số may mắn — tách riêng để test bằng `npm test`.
// Phần đọc/ghi DB nằm ở src/lib/lucky-draw.ts, màn quay ở components/lucky-draw.

type WinnerLike = { round: number; seatCode: string; voided: boolean };

/** Ghế còn được quay = ghế đã đặt − ghế đã từng trúng (kể cả lượt bị huỷ vì vắng). */
export function eligibleSeats(bookedSeats: string[], winners: WinnerLike[]): string[] {
  const used = new Set(winners.map((w) => w.seatCode));
  return bookedSeats.filter((code) => !used.has(code));
}

/** Lượt đang chờ quay (1-based). Lượt bị huỷ không tính nên được quay lại. */
export function currentRound(winners: WinnerLike[]): number {
  return winners.filter((w) => !w.voided).length + 1;
}

/** "0912345678" → "09•• ••• 678". Không đủ số thì trả null. */
export function maskPhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 9) return null;
  return `${digits.slice(0, 2)}•• ••• ${digits.slice(-3)}`;
}

/**
 * Nhịp hiệu ứng quay (user chốt 21/10): nhanh → chậm dần → thật chậm, mỗi bước
 * sáng đúng 1 ô random. Chỉnh ở đây khi tập dượt.
 * - fast: chạy đều fastStepMs ít nhất fastMinMs (và tới khi server trả kết quả).
 * - slow: slowSteps bước, khoảng cách tăng dần fastStepMs → slowEndMs.
 * - crawl: mỗi phần tử là thời gian giữ 1 ô ở chặng cuối; sau đó dừng ở ghế thắng.
 */
export const SPIN_TIMING = {
  fastMinMs: 3000,
  fastStepMs: 50,
  slowSteps: 16,
  slowEndMs: 420,
  crawlMs: [650, 900, 1200, 1550],
} as const;

export type SpinStep = { code: string; holdMs: number };

/**
 * Chọn ô kế tiếp: random trong pool, tránh `recent` (các ô vừa sáng) và
 * `exclude`. Pool nhỏ không đủ để tránh hết thì nới dần từ ô cũ nhất.
 */
export function pickNext(
  pool: string[],
  recent: string[],
  rand: () => number = Math.random,
  exclude?: string,
): string {
  const base = exclude && pool.length > 1 ? pool.filter((c) => c !== exclude) : pool;
  for (let skip = 0; skip <= recent.length; skip++) {
    const avoid = new Set(recent.slice(skip));
    const options = base.filter((c) => !avoid.has(c));
    if (options.length > 0) return options[Math.floor(rand() * options.length)];
  }
  return base[0];
}

export const RECENT_WINDOW = 5;

/**
 * Chặng chậm dần + thật chậm sau khi đã biết ghế thắng. Bước cuối luôn là
 * `winner` (holdMs 0 — màn quay tự giữ sáng + nhấp nháy). Ghế thắng không
 * xuất hiện trước bước cuối để khán giả không đoán được.
 */
export function buildFinale(
  pool: string[],
  winner: string,
  recent: string[] = [],
  rand: () => number = Math.random,
): SpinStep[] {
  const { fastStepMs, slowSteps, slowEndMs, crawlMs } = SPIN_TIMING;
  const holds: number[] = [];
  for (let i = 1; i <= slowSteps; i++) {
    const t = i / slowSteps;
    holds.push(Math.round(fastStepMs + (slowEndMs - fastStepMs) * t * t));
  }
  holds.push(...crawlMs);

  const steps: SpinStep[] = [];
  const window = [...recent];
  for (const holdMs of holds) {
    const code = pickNext(pool, window.slice(-RECENT_WINDOW), rand, winner);
    steps.push({ code, holdMs });
    window.push(code);
  }
  steps.push({ code: winner, holdMs: 0 });
  return steps;
}
