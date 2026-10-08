import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Thứ tự chọn ghế theo lượt (xem SeatAllowance trong schema.prisma).
 *
 * - Vé của user cho 1 event = Σ quantity các OrderItem thuộc combo
 *   includesTicket của event đó, đơn đã "paid".
 * - Thứ hạng: theo paidAt của đơn có vé đầu tiên (hoà thì theo orderCode).
 * - unlockAt = seatOpenAt + floor(rank / seatBatchSize) × seatTurnMinutes phút.
 *
 * Admin bấm "Chốt danh sách" để snapshot; sau đó đơn paid mới được nối cuối
 * hàng (syncSeatAllowanceForOrder). Người đã có trong danh sách giữ nguyên
 * rank/unlockAt, chỉ cập nhật số vé.
 */

type Tx = Prisma.TransactionClient;

type SeatEventConfig = {
  id: string;
  seatOpenAt: Date | null;
  seatTurnMinutes: number;
  seatBatchSize: number;
};

const SEAT_EVENT_SELECT = {
  id: true,
  seatOpenAt: true,
  seatTurnMinutes: true,
  seatBatchSize: true,
} as const;

/**
 * Khoá advisory theo event, nhả khi transaction kết thúc. Dùng chung cho chốt
 * danh sách, sync đơn mới, xác nhận ghế, admin huỷ ghế — mọi thay đổi trên ghế/
 * lượt của 1 event chạy tuần tự, nên re-validate luôn thấy state mới nhất.
 */
export async function lockEventSeats(tx: Tx, eventId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`seat:${eventId}`}::text))`;
}

export function unlockTimeFor(event: SeatEventConfig, rank: number): Date {
  if (!event.seatOpenAt) throw new Error("seatOpenAt chưa đặt");
  const turn = Math.floor(rank / Math.max(1, event.seatBatchSize));
  return new Date(event.seatOpenAt.getTime() + turn * event.seatTurnMinutes * 60_000);
}

type TicketTotal = { tickets: number; firstPaidAt: number; firstOrderCode: string };

async function ticketTotals(
  tx: Tx,
  eventId: string,
  userId?: string,
): Promise<Map<string, TicketTotal>> {
  const items = await tx.orderItem.findMany({
    where: {
      comboType: { eventId, includesTicket: true },
      order: { paymentStatus: "paid", ...(userId ? { userId } : {}) },
    },
    select: {
      quantity: true,
      order: { select: { userId: true, paidAt: true, orderCode: true } },
    },
  });

  const totals = new Map<string, TicketTotal>();
  for (const item of items) {
    const paidAt = item.order.paidAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const current = totals.get(item.order.userId);
    if (!current) {
      totals.set(item.order.userId, {
        tickets: item.quantity,
        firstPaidAt: paidAt,
        firstOrderCode: item.order.orderCode,
      });
      continue;
    }
    current.tickets += item.quantity;
    if (
      paidAt < current.firstPaidAt ||
      (paidAt === current.firstPaidAt && item.order.orderCode < current.firstOrderCode)
    ) {
      current.firstPaidAt = paidAt;
      current.firstOrderCode = item.order.orderCode;
    }
  }
  return totals;
}

/**
 * Đồng bộ allowance cho cả event (userId undefined) hoặc 1 user. Phải gọi trong
 * transaction đã lockEventSeats.
 */
async function syncAllowances(
  tx: Tx,
  event: SeatEventConfig,
  userId?: string,
): Promise<{ added: number; updated: number }> {
  const totals = await ticketTotals(tx, event.id, userId);
  const existing = await tx.seatAllowance.findMany({
    where: { eventId: event.id, ...(userId ? { userId } : {}) },
  });

  let updated = 0;
  const known = new Set<string>();
  for (const allowance of existing) {
    known.add(allowance.userId);
    const tickets = totals.get(allowance.userId)?.tickets ?? 0;
    if (tickets !== allowance.ticketCount) {
      await tx.seatAllowance.update({
        where: { id: allowance.id },
        data: { ticketCount: tickets },
      });
      updated++;
    }
  }

  const newcomers = [...totals.entries()]
    .filter(([id]) => !known.has(id))
    .sort(
      ([, a], [, b]) =>
        a.firstPaidAt - b.firstPaidAt || a.firstOrderCode.localeCompare(b.firstOrderCode),
    );
  if (newcomers.length === 0) return { added: 0, updated };

  const maxRank = await tx.seatAllowance.aggregate({
    where: { eventId: event.id },
    _max: { rank: true },
  });
  let rank = (maxRank._max.rank ?? -1) + 1;
  const now = Date.now();
  await tx.seatAllowance.createMany({
    data: newcomers.map(([id, total]) => {
      const unlockAt = new Date(Math.max(unlockTimeFor(event, rank).getTime(), now));
      return { eventId: event.id, userId: id, rank: rank++, ticketCount: total.tickets, unlockAt };
    }),
  });
  return { added: newcomers.length, updated };
}

export class SeatSetupError extends Error {}

/** Admin "Chốt danh sách" — chạy lại được, chỉ thêm người mới + cập nhật số vé. */
export async function finalizeSeatList(eventId: string) {
  return prisma.$transaction(async (tx) => {
    await lockEventSeats(tx, eventId);
    const event = await tx.event.findUnique({ where: { id: eventId }, select: SEAT_EVENT_SELECT });
    if (!event) throw new SeatSetupError("Không tìm thấy event.");
    if (!event.seatOpenAt) throw new SeatSetupError("Chưa đặt giờ mở chọn ghế.");
    return syncAllowances(tx, event);
  });
}

/** Tính lại unlockAt mọi allowance theo cấu hình mới của event (giữ nguyên rank). */
export async function recomputeUnlockTimes(eventId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockEventSeats(tx, eventId);
    const event = await tx.event.findUnique({ where: { id: eventId }, select: SEAT_EVENT_SELECT });
    if (!event?.seatOpenAt) return;
    const allowances = await tx.seatAllowance.findMany({
      where: { eventId },
      select: { id: true, rank: true },
    });
    for (const allowance of allowances) {
      await tx.seatAllowance.update({
        where: { id: allowance.id },
        data: { unlockAt: unlockTimeFor(event, allowance.rank) },
      });
    }
  });
}

/**
 * Sau khi 1 đơn chuyển "paid": nếu event của vé trong đơn đã chốt danh sách
 * (có ≥ 1 allowance) thì nối user vào cuối hàng / cập nhật số vé. Chưa chốt thì
 * bỏ qua — lần chốt sau sẽ gom. BEST-EFFORT, không throw (gọi từ webhook SePay).
 */
export async function syncSeatAllowanceForOrder(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        userId: true,
        paymentStatus: true,
        items: { select: { comboType: { select: { eventId: true, includesTicket: true } } } },
      },
    });
    if (!order || order.paymentStatus !== "paid") return;

    const eventIds = new Set(
      order.items.filter((i) => i.comboType.includesTicket).map((i) => i.comboType.eventId),
    );
    for (const eventId of eventIds) {
      await prisma.$transaction(async (tx) => {
        await lockEventSeats(tx, eventId);
        const event = await tx.event.findUnique({
          where: { id: eventId },
          select: SEAT_EVENT_SELECT,
        });
        if (!event?.seatOpenAt) return;
        const finalized = await tx.seatAllowance.count({ where: { eventId } });
        if (finalized === 0) return;
        await syncAllowances(tx, event, order.userId);
      });
    }
  } catch (err) {
    console.error("syncSeatAllowanceForOrder lỗi (bỏ qua)", orderId, err);
  }
}
