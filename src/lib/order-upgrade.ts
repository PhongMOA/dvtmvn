import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Nâng cấp combo: đơn cũ đã thanh toán có combo KHÔNG kèm vé -> khách đổi sang
 * combo có vé cùng event, chỉ trả chênh lệch. Đơn nâng cấp là 1 Order riêng
 * (upgradeFromOrderId/upgradeFromItemId) với 1 OrderItem có unitPrice = giá mới
 * − giá đã trả, phí ship 0 (giao về địa chỉ đơn cũ).
 *
 * Phần combo cũ chỉ bị huỷ khi đơn nâng cấp ĐÃ THANH TOÁN (finalizePaidUpgrade):
 * đơn nâng cấp hết hạn thì combo cũ giữ nguyên, không cần hoàn gì.
 */

/** Combo đích hợp lệ: cùng event, có vé, đắt hơn giá đã trả. */
export function isUpgradeTarget(
  target: { eventId: string; includesTicket: boolean; price: number },
  source: { eventId: string; unitPrice: number },
): boolean {
  return (
    target.eventId === source.eventId &&
    target.includesTicket &&
    target.price > source.unitPrice
  );
}

/**
 * Số combo của 1 dòng đang bị giữ bởi các đơn nâng cấp chờ thanh toán (còn hạn)
 * — không cho mở thêm đơn nâng cấp trùng trên cùng số combo đó.
 */
export async function pendingUpgradeQuantity(
  orderItemId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<number> {
  const rows = await db.orderItem.findMany({
    where: {
      order: {
        upgradeFromItemId: orderItemId,
        paymentStatus: "pending",
        expiresAt: { gt: new Date() },
      },
    },
    select: { quantity: true },
  });
  return rows.reduce((sum, row) => sum + row.quantity, 0);
}

/**
 * Gọi ngay sau khi 1 đơn chuyển "paid" (webhook SePay / skipPayment) — chỉ gọi
 * khi updateMany pending->paid trả count 1 nên không chạy trùng. Nếu đơn là đơn
 * nâng cấp: đánh dấu số combo cũ đã nâng cấp + hoàn kho combo cũ. Best-effort,
 * không throw (không được làm hỏng response webhook).
 */
export async function finalizePaidUpgrade(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { upgradeFromItemId: true, items: { select: { quantity: true } } },
    });
    if (!order?.upgradeFromItemId) return;
    const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0);

    await prisma.$transaction(async (tx) => {
      const source = await tx.orderItem.update({
        where: { id: order.upgradeFromItemId! },
        data: { upgradedQuantity: { increment: quantity } },
      });
      await tx.comboType.update({
        where: { id: source.comboTypeId },
        data: { remainingQuantity: { increment: quantity } },
      });
    });
  } catch (err) {
    console.error("finalizePaidUpgrade lỗi (bỏ qua)", orderId, err);
  }
}
