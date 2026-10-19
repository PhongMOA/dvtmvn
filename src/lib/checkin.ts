import { prisma } from "@/lib/prisma";
import { mergeShirtSizes, parseShirtSizes, formatShirtSizes } from "@/lib/shirt-sizes";
import { maskName, phoneKey, sortSeats, ticketCount } from "@/lib/checkin-rules";

// Check-in theo NGƯỜI + EVENT (không theo từng đơn): khách mua nhiều đơn cho
// cùng 1 suất chiếu chỉ cần quét 1 QR bất kỳ (hoặc nhập SĐT) là check-in hết.
// Dùng cho kiosk (/kiosk) và nhân viên (/scan) — xem src/app/actions/checkin.ts.

export type CheckinTarget = { userId: string; eventId: string };

export type CheckinError =
  | "NOT_FOUND" // QR lạ / SĐT không khớp ai có vé
  | "NOT_PAID" // QR của đơn chưa thanh toán
  | "WRONG_EVENT" // QR của đơn thuộc suất chiếu khác
  | "AMBIGUOUS" // 1 SĐT khớp nhiều tài khoản — cần nhân viên
  | "NO_TICKET"; // có đơn paid nhưng chỉ có merch, không có vé

export type CheckinResult<T> = { ok: true; value: T } | { ok: false; error: CheckinError };

export type CheckinSummary = {
  userName: string;
  maskedName: string;
  tickets: number;
  seats: string[];
  /** Đã được mở chọn ghế (có SeatAllowance) nhưng chọn chưa đủ ghế cho số vé. */
  seatsPending: boolean;
  /** Mỗi dòng "Tên combo × SL" của event (gộp các đơn). */
  combos: string[];
  /** Size áo cần phát, vd "M×2, L×1" — "" nếu không có combo áo. */
  shirts: string;
  orderCodes: string[];
  alreadyCheckedIn: boolean;
  /** Giờ check-in gần nhất (null nếu chưa, hoặc check-in từ trước khi có cột này). */
  checkedInAt: Date | null;
  /** Lần check-in gần nhất qua "kiosk" hay "staff" (null nếu không rõ). */
  checkedInVia: string | null;
};

const fail = (error: CheckinError) => ({ ok: false as const, error });

export async function resolveByQrToken(
  qrToken: string,
  eventId: string,
): Promise<CheckinResult<CheckinTarget>> {
  const order = await prisma.order.findUnique({
    where: { qrToken },
    select: {
      userId: true,
      paymentStatus: true,
      items: { select: { comboType: { select: { eventId: true } } } },
    },
  });
  if (!order) return fail("NOT_FOUND");
  if (order.paymentStatus !== "paid") return fail("NOT_PAID");
  if (!order.items.some((it) => it.comboType.eventId === eventId)) return fail("WRONG_EVENT");
  return { ok: true, value: { userId: order.userId, eventId } };
}

/**
 * Tìm khách có vé của event theo SĐT tài khoản HOẶC SĐT nhận hàng của đơn
 * (so 9 số cuối, bỏ ký tự không phải số — xem phoneKey).
 */
export async function resolveByPhone(
  phone: string,
  eventId: string,
): Promise<CheckinResult<CheckinTarget>> {
  const key = phoneKey(phone);
  if (!key) return fail("NOT_FOUND");
  const rows = await prisma.$queryRaw<{ userId: string }[]>`
    SELECT DISTINCT o."userId"
    FROM "Order" o
    JOIN "User" u ON u.id = o."userId"
    JOIN "OrderItem" oi ON oi."orderId" = o.id
    JOIN "ComboType" c ON c.id = oi."comboTypeId"
    WHERE o."paymentStatus" = 'paid'
      AND c."eventId" = ${eventId}
      AND c."includesTicket"
      AND (
        right(regexp_replace(coalesce(u.phone, ''), '\\D', '', 'g'), 9) = ${key}
        OR right(regexp_replace(coalesce(o."shipPhone", ''), '\\D', '', 'g'), 9) = ${key}
      )
    LIMIT 2`;
  if (rows.length === 0) return fail("NOT_FOUND");
  if (rows.length > 1) return fail("AMBIGUOUS");
  return { ok: true, value: { userId: rows[0].userId, eventId } };
}

export type CustomerMatch = { userId: string; name: string; phone: string | null };

/**
 * Nhân viên tìm khách có vé của event theo tên / email / SĐT (khách không mang
 * QR, không nhớ SĐT đã đăng ký). Tối đa 10 kết quả. Tên so không phân biệt hoa
 * thường nhưng CÓ phân biệt dấu (ILIKE).
 */
export async function searchCustomers(q: string, eventId: string): Promise<CustomerMatch[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const digits = term.replace(/\D/g, "");
  const users = await prisma.user.findMany({
    where: {
      orders: {
        some: {
          paymentStatus: "paid",
          items: { some: { comboType: { eventId, includesTicket: true } } },
        },
      },
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
      ],
    },
    select: { id: true, name: true, email: true, phone: true },
    orderBy: { name: "asc" },
    take: 10,
  });
  return users.map((u) => ({ userId: u.id, name: u.name ?? u.email, phone: u.phone }));
}

/** Các đơn paid của khách có ít nhất 1 dòng combo thuộc event. */
function eventOrders({ userId, eventId }: CheckinTarget) {
  return prisma.order.findMany({
    where: { userId, paymentStatus: "paid", items: { some: { comboType: { eventId } } } },
    orderBy: { paidAt: "asc" },
    select: {
      id: true,
      orderCode: true,
      status: true,
      checkedInAt: true,
      checkedInVia: true,
      items: {
        select: {
          quantity: true,
          upgradedQuantity: true,
          shirtSizes: true,
          comboType: {
            select: { eventId: true, name: true, includesTicket: true, includesShirt: true },
          },
        },
      },
    },
  });
}

export async function getCheckinSummary(
  target: CheckinTarget,
): Promise<CheckinResult<CheckinSummary>> {
  const { userId, eventId } = target;
  const [user, orders, bookings, allowance] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    eventOrders(target),
    prisma.seatBooking.findMany({ where: { eventId, userId }, select: { seatCode: true } }),
    prisma.seatAllowance.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { id: true },
    }),
  ]);
  if (!user || orders.length === 0) return fail("NOT_FOUND");

  const items = orders.flatMap((o) => o.items).filter((it) => it.comboType.eventId === eventId);
  const tickets = ticketCount(items, eventId);
  if (tickets === 0) return fail("NO_TICKET");

  // Gộp theo tên combo, chỉ tính phần chưa nâng cấp đi.
  const comboQty = new Map<string, number>();
  let shirtSizes = {};
  for (const it of items) {
    const qty = it.quantity - it.upgradedQuantity;
    if (qty <= 0) continue;
    comboQty.set(it.comboType.name, (comboQty.get(it.comboType.name) ?? 0) + qty);
    if (it.comboType.includesShirt) {
      shirtSizes = mergeShirtSizes(shirtSizes, parseShirtSizes(it.shirtSizes));
    }
  }

  const seats = sortSeats(bookings.map((b) => b.seatCode));
  const latestCheckin = orders
    .filter((o) => o.checkedInAt)
    .sort((a, b) => b.checkedInAt!.getTime() - a.checkedInAt!.getTime())[0];
  const name = user.name?.trim() || "bạn";

  return {
    ok: true,
    value: {
      userName: name,
      maskedName: maskName(name),
      tickets,
      seats,
      seatsPending: allowance != null && seats.length < tickets,
      combos: [...comboQty].map(([n, q]) => `${n} × ${q}`),
      shirts: formatShirtSizes(shirtSizes),
      orderCodes: orders.map((o) => o.orderCode),
      alreadyCheckedIn: orders.every((o) => o.status === "checked_in"),
      checkedInAt: latestCheckin?.checkedInAt ?? null,
      checkedInVia: latestCheckin?.checkedInVia ?? null,
    },
  };
}

/**
 * Check-in mọi đơn paid của khách cho event. Idempotent: đơn đã checked_in giữ
 * nguyên giờ cũ (where status = "booked"), nên quét lại chỉ trả về summary với
 * alreadyCheckedIn = true. Kiểm tra NO_TICKET trước khi ghi.
 */
export async function performCheckin(
  target: CheckinTarget,
  via: "kiosk" | "staff",
  actorId: string,
): Promise<CheckinResult<CheckinSummary & { justCheckedIn: boolean }>> {
  const before = await getCheckinSummary(target);
  if (!before.ok) return before;
  if (before.value.alreadyCheckedIn) {
    return { ok: true, value: { ...before.value, justCheckedIn: false } };
  }

  const orders = await eventOrders(target);
  await prisma.order.updateMany({
    where: { id: { in: orders.map((o) => o.id) }, status: "booked" },
    data: { status: "checked_in", checkedInAt: new Date(), checkedInVia: via, checkedInBy: actorId },
  });

  const after = await getCheckinSummary(target);
  if (!after.ok) return after;
  return { ok: true, value: { ...after.value, justCheckedIn: true } };
}
