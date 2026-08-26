"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth-helpers";
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

/**
 * Giả lập webhook SePay báo "đã nhận tiền" cho 1 đơn — dùng để test luồng
 * thanh toán ở màn QR mà không cần chuyển khoản thật. CHỈ admin (ADMIN_EMAIL)
 * mới gọi được — bỏ qua bước chuyển khoản là hành vi nguy hiểm nếu lộ ra cho
 * khách thật (lấy combo miễn phí), nên chặn ở tầng server action bằng
 * requireAdmin() thay vì chỉ ẩn nút ở UI.
 */
export async function simulatePayment(orderId: string): Promise<OrderStatusResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "FORBIDDEN" };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    return { ok: false, error: "NOT_FOUND" };
  }
  if (order.paymentStatus !== "pending") {
    return { ok: true, status: order.paymentStatus as OrderPaymentStatus };
  }

  // updateMany + where paymentStatus:"pending": giống hệt cách webhook thật xác
  // nhận đơn (route.ts) — tránh xử lý trùng nếu bấm 2 lần liền hoặc trùng lúc
  // webhook thật/poll expiry cũng đang chạy.
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: "pending" },
    data: { paymentStatus: "paid", paidAt: new Date() },
  });

  if (count === 0) {
    const latest = await prisma.order.findUnique({ where: { id: orderId } });
    return { ok: true, status: (latest?.paymentStatus ?? "expired") as OrderPaymentStatus };
  }

  return { ok: true, status: "paid" };
}
