"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

export async function checkInOrder(orderId: string) {
  await requireAdmin();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { comboType: true },
  });
  if (!order) return;

  // Chỉ check-in đơn đã thanh toán — phòng khi action bị gọi trực tiếp ngoài
  // UI (UI đã ẩn nút này cho đơn pending/expired).
  if (order.paymentStatus === "paid") {
    await prisma.order.update({ where: { id: orderId }, data: { status: "checked_in" } });
  }
  revalidatePath(`/admin/events/${order.comboType.eventId}/orders`);
}
