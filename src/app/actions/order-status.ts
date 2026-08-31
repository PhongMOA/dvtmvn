"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth-helpers";
import { expireOrderIfPastDue } from "@/lib/order-expiry";
import { sendPushToTokens } from "@/lib/push";

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
 * "Bỏ qua thanh toán" — đánh dấu đơn là đã thanh toán thành công mà không cần
 * chuyển khoản thật, để test các tiến trình phía sau (vé, check-in, push...).
 * CHỈ admin (ADMIN_EMAIL hoặc User.role == "admin") mới gọi được — bỏ qua bước
 * chuyển khoản là hành vi nguy hiểm nếu lộ cho khách thật (lấy combo miễn phí),
 * nên chặn ở tầng server action bằng requireAdmin() chứ không chỉ ẩn nút ở UI.
 */
export async function skipPayment(orderId: string): Promise<OrderStatusResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "FORBIDDEN" };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { comboType: true },
  });
  if (!order) {
    return { ok: false, error: "NOT_FOUND" };
  }
  if (order.paymentStatus !== "pending") {
    return { ok: true, status: order.paymentStatus as OrderPaymentStatus };
  }

  // updateMany + where paymentStatus:"pending": giống hệt cách webhook SePay thật
  // xác nhận đơn (route.ts) — tránh xử lý trùng nếu bấm 2 lần liền hoặc trùng lúc
  // webhook thật / poll expiry cũng đang chạy.
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: "pending" },
    data: { paymentStatus: "paid", paidAt: new Date() },
  });

  if (count === 0) {
    const latest = await prisma.order.findUnique({ where: { id: orderId } });
    return { ok: true, status: (latest?.paymentStatus ?? "expired") as OrderPaymentStatus };
  }

  // Best-effort: gửi push "thanh toán thành công" y như webhook thật, để tiến
  // trình phía sau được test đầy đủ. Lỗi push không được làm hỏng kết quả.
  try {
    const tokens = await prisma.deviceToken.findMany({
      where: { userId: order.userId },
      select: { token: true },
    });
    if (tokens.length > 0) {
      await sendPushToTokens(
        tokens.map((t) => t.token),
        {
          title: "Thanh toán thành công",
          body: `${order.comboType.name} x${order.quantity} đã sẵn sàng — xem vé trong "Vé của tôi".`,
        },
      );
    }
  } catch (err) {
    console.error("Push bỏ qua thanh toán thất bại (không ảnh hưởng đơn):", err);
  }

  return { ok: true, status: "paid" };
}
