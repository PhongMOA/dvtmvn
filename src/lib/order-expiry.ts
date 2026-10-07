import { prisma } from "@/lib/prisma";

/**
 * Kiểm tra 1 đơn cụ thể: nếu đang "pending" mà đã quá expiresAt thì chuyển
 * "expired" + hoàn lại remainingQuantity cho từng combo trong đơn. Dùng updateMany
 * với where paymentStatus:"pending" để atomic — tránh hoàn kho 2 lần nếu gọi trùng
 * lúc (vd webhook vừa đánh dấu "paid" đúng lúc poll page cũng đang check).
 */
export async function expireOrderIfPastDue(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order || order.paymentStatus !== "pending") return;
  if (order.expiresAt > new Date()) return;

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, paymentStatus: "pending" },
      data: { paymentStatus: "expired" },
    });
    if (count === 1) {
      for (const item of order.items) {
        await tx.comboType.update({
          where: { id: item.comboTypeId },
          data: { remainingQuantity: { increment: item.quantity } },
        });
      }
    }
  });
}

/**
 * Quét toàn bộ đơn "pending" đã quá hạn có chứa 1 trong các combo và hoàn kho.
 * Gọi ở đầu bookCombos / trang chủ / giỏ hàng — không có cron nên tận dụng các
 * thời điểm đó để dọn tồn kho bị "treo" bởi các đơn bỏ ngang không chuyển khoản.
 */
export async function expireStaleOrdersForCombos(
  comboTypeIds: string[],
): Promise<void> {
  if (comboTypeIds.length === 0) return;
  const stale = await prisma.order.findMany({
    where: {
      paymentStatus: "pending",
      expiresAt: { lt: new Date() },
      items: { some: { comboTypeId: { in: comboTypeIds } } },
    },
    select: { id: true },
  });
  for (const order of stale) {
    await expireOrderIfPastDue(order.id);
  }
}
