"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { lockEventSeats } from "@/lib/seat-allowance";
import { SEAT_LAYOUT } from "@/lib/seats/layout";
import { validateSelection } from "@/lib/seats/rules";

export type SeatState = {
  taken: string[]; // mọi ghế đã có người (kể cả của mình) — không lộ ai ngồi
  mine: string[];
  ticketCount: number;
  ticketsLeft: number;
  unlockAt: string | null; // ISO; null = user không có quyền chọn ghế ở event này
};

/** Trạng thái sơ đồ cho user hiện tại — client poll mỗi vài giây. */
export async function getSeatState(eventId: string): Promise<SeatState> {
  const user = await requireUser();
  const [allowance, bookings] = await Promise.all([
    prisma.seatAllowance.findUnique({
      where: { eventId_userId: { eventId, userId: user.id! } },
    }),
    prisma.seatBooking.findMany({
      where: { eventId },
      select: { seatCode: true, userId: true },
    }),
  ]);
  const mine = bookings.filter((b) => b.userId === user.id).map((b) => b.seatCode);
  const ticketCount = allowance?.ticketCount ?? 0;
  return {
    taken: bookings.map((b) => b.seatCode),
    mine,
    ticketCount,
    ticketsLeft: Math.max(0, ticketCount - mine.length),
    unlockAt: allowance?.unlockAt.toISOString() ?? null,
  };
}

export type ConfirmSeatsResult =
  | { ok: true; seats: string[] }
  | { ok: false; error: string; seat?: string };

class SeatError extends Error {
  constructor(
    message: string,
    readonly seat?: string,
  ) {
    super(message);
  }
}

/**
 * Xác nhận chọn ghế — all-or-nothing, chọn xong là chốt.
 *
 * Chống trùng ghế: khoá advisory theo event (mọi lần xác nhận của event chạy
 * tuần tự) rồi re-validate toàn bộ trên state mới nhất: tới giờ chưa, đủ vé
 * không, ghế còn trống không, có để ghế lẻ không. Unique (eventId, seatCode)
 * là chốt chặn cuối nếu có đường ghi nào khác lọt qua lock.
 */
export async function confirmSeats(
  eventId: string,
  picked: string[],
): Promise<ConfirmSeatsResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "Vui lòng đăng nhập lại." };
  }
  const userId = user.id!;
  if (!Array.isArray(picked) || picked.length === 0 || picked.length > 50) {
    return { ok: false, error: "Danh sách ghế không hợp lệ." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await lockEventSeats(tx, eventId);

      const allowance = await tx.seatAllowance.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });
      if (!allowance) throw new SeatError("Bạn không có quyền chọn ghế ở sự kiện này.");
      if (Date.now() < allowance.unlockAt.getTime()) {
        throw new SeatError("Chưa tới lượt chọn ghế của bạn.");
      }

      const bookings = await tx.seatBooking.findMany({
        where: { eventId },
        select: { seatCode: true, userId: true },
      });
      const mineCount = bookings.filter((b) => b.userId === userId).length;
      const ticketsLeft = allowance.ticketCount - mineCount;
      if (ticketsLeft <= 0) throw new SeatError("Bạn đã chọn đủ ghế.");

      const check = validateSelection(SEAT_LAYOUT, {
        taken: new Set(bookings.map((b) => b.seatCode)),
        picked,
        ticketsNeeded: ticketsLeft,
      });
      if (!check.ok) throw new SeatError(check.reason, check.seat);

      await tx.seatBooking.createMany({
        data: picked.map((seatCode) => ({ eventId, seatCode, userId })),
      });
    });
  } catch (err) {
    if (err instanceof SeatError) return { ok: false, error: err.message, seat: err.seat };
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "Có ghế vừa có người chọn, vui lòng chọn lại." };
    }
    console.error("confirmSeats lỗi", eventId, err);
    return { ok: false, error: "Không xác nhận được ghế, vui lòng thử lại." };
  }

  revalidatePath("/my-tickets");
  revalidatePath(`/my-tickets/seats/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/seats`);
  return { ok: true, seats: picked };
}
