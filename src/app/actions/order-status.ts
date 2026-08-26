"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { expireOrderIfPastDue } from "@/lib/order-expiry";

export type OrderPaymentStatus = "pending" | "paid" | "expired";

export type OrderStatusResult =
  | { ok: true; status: OrderPaymentStatus }
  | { ok: false; error: string };

/** Dùng cho trang chờ thanh toán (poll định kỳ) — trả về trạng thái mới nhất. */
export async function getOrderPaymentStatus(orderId: string): Promise<OrderStatusResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "UNAUTHORIZED" };
  }

  await expireOrderIfPastDue(orderId);

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== user.id) {
    return { ok: false, error: "NOT_FOUND" };
  }

  return { ok: true, status: order.paymentStatus as OrderPaymentStatus };
}
