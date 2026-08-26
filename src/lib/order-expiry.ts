import { prisma } from "@/lib/prisma";

/**
 * Kiểm tra 1 đơn cụ thể: nếu đang "pending" mà đã quá expiresAt thì chuyển
 * "expired" + hoàn lại remainingQuantity cho combo. Dùng updateMany với where
 * paymentStatus:"pending" để atomic — tránh hoàn kho 2 lần nếu gọi trùng lúc
 * (vd webhook vừa đánh dấu "paid" đúng lúc poll page cũng đang check).
 */
export async function expireOrderIfPastDue(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.paymentStatus !== "pending") return;
  if (order.expiresAt > new Date()) return;

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, paymentStatus: "pending" },
      data: { paymentStatus: "expired" },
    });
    if (count === 1) {
      await tx.comboType.update({
        where: { id: order.comboTypeId },
        data: { remainingQuantity: { increment: order.quantity } },
      });
    }
  });
}

/**
 * Quét toàn bộ đơn "pending" đã quá hạn của 1 combo và hoàn kho. Gọi ở đầu
 * bookCombo — không có cron nên tận dụng thời điểm có người đặt combo mới để
 * dọn lại tồn kho bị "treo" bởi các đơn bỏ ngang không chuyển khoản.
 */
export async function expireStaleOrdersForCombo(comboTypeId: string): Promise<void> {
  const stale = await prisma.order.findMany({
    where: { comboTypeId, paymentStatus: "pending", expiresAt: { lt: new Date() } },
    select: { id: true },
  });
  for (const order of stale) {
    await expireOrderIfPastDue(order.id);
  }
}
