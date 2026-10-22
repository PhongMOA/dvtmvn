import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { lockEventSeats } from "@/lib/seat-allowance";
import { currentRound, eligibleSeats, maskPhone } from "@/lib/lucky-draw-rules";

// Quay số may mắn trên sơ đồ ghế: server chọn ghế trúng + ghi DB NGAY khi bấm
// Quay, client chỉ diễn hiệu ứng tới ghế đã chọn — F5 giữa chừng không quay lại
// được và kết quả không mất. Gọi từ src/app/actions/lucky-draw.ts.

export type LuckyDrawWinnerView = {
  id: string;
  round: number;
  seatCode: string;
  displayName: string;
  maskedPhone: string | null;
  voided: boolean;
  createdAt: Date;
};

export type LuckyDrawState = {
  draw: { id: string; totalRounds: number } | null;
  winners: LuckyDrawWinnerView[]; // theo thứ tự quay
  bookedCount: number;
  eligible: string[];
  round: number; // lượt đang chờ quay
  done: boolean;
};

export class LuckyDrawError extends Error {}

const WINNER_SELECT = {
  id: true,
  round: true,
  seatCode: true,
  displayName: true,
  maskedPhone: true,
  voided: true,
  createdAt: true,
} as const;

export async function getDrawState(eventId: string): Promise<LuckyDrawState> {
  const [draw, bookings] = await Promise.all([
    prisma.luckyDraw.findUnique({
      where: { eventId },
      select: {
        id: true,
        totalRounds: true,
        winners: { select: WINNER_SELECT, orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.seatBooking.findMany({ where: { eventId }, select: { seatCode: true } }),
  ]);
  const winners = draw?.winners ?? [];
  const round = currentRound(winners);
  return {
    draw: draw ? { id: draw.id, totalRounds: draw.totalRounds } : null,
    winners,
    bookedCount: bookings.length,
    eligible: eligibleSeats(
      bookings.map((b) => b.seatCode),
      winners,
    ),
    round,
    done: !!draw && round > draw.totalRounds,
  };
}

/**
 * Quay 1 lượt. Khoá advisory chung với các thao tác ghế của event (xem
 * lockEventSeats) nên bấm đúp / 2 tab cùng quay vẫn chạy tuần tự; partial
 * unique (drawId, round) WHERE voided = false là chốt chặn cuối.
 * Trả kèm `pool` (ghế còn được quay TRƯỚC lượt này) để client chạy hiệu ứng.
 */
export async function drawNextRound(
  eventId: string,
  actorId: string,
): Promise<{ winner: LuckyDrawWinnerView; pool: string[]; totalRounds: number }> {
  return prisma.$transaction(async (tx) => {
    await lockEventSeats(tx, eventId);

    const draw = await tx.luckyDraw.findUnique({
      where: { eventId },
      select: { id: true, totalRounds: true, winners: { select: WINNER_SELECT } },
    });
    if (!draw) throw new LuckyDrawError("Chưa tạo phiên quay số.");
    const round = currentRound(draw.winners);
    if (round > draw.totalRounds) throw new LuckyDrawError("Đã quay đủ số lượt.");

    const bookings = await tx.seatBooking.findMany({
      where: { eventId },
      select: {
        seatCode: true,
        userId: true,
        user: { select: { name: true, email: true, phone: true } },
      },
    });
    const pool = eligibleSeats(
      bookings.map((b) => b.seatCode),
      draw.winners,
    );
    if (pool.length === 0) throw new LuckyDrawError("Hết ghế để quay.");

    const seatCode = pool[randomInt(pool.length)];
    const booking = bookings.find((b) => b.seatCode === seatCode)!;
    const winner = await tx.luckyDrawWinner.create({
      data: {
        drawId: draw.id,
        round,
        seatCode,
        userId: booking.userId,
        displayName: booking.user.name?.trim() || booking.user.email,
        maskedPhone: maskPhone(booking.user.phone),
        drawnBy: actorId,
      },
      select: WINNER_SELECT,
    });
    return { winner, pool, totalRounds: draw.totalRounds };
  });
}

/**
 * Người trúng vắng mặt → huỷ lượt để quay lại. Chỉ huỷ được lượt còn hiệu lực
 * mới nhất (huỷ lượt giữa chừng sẽ làm lệch số thứ tự các lượt sau). Ghế đó
 * vẫn bị loại khỏi pool.
 */
export async function voidLatestWinner(eventId: string, winnerId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockEventSeats(tx, eventId);
    const latest = await tx.luckyDrawWinner.findFirst({
      where: { draw: { eventId }, voided: false },
      orderBy: { round: "desc" },
      select: { id: true },
    });
    if (!latest || latest.id !== winnerId) {
      throw new LuckyDrawError("Chỉ huỷ được lượt vừa quay gần nhất.");
    }
    await tx.luckyDrawWinner.update({ where: { id: winnerId }, data: { voided: true } });
  });
}
