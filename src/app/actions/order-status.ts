"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth-helpers";
import { expireOrderIfPastDue } from "@/lib/order-expiry";
import { fulfillPaidOrder } from "@/lib/order-fulfillment";
import { getGhtkShipmentStatus } from "@/lib/ghtk";

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

  // Best-effort: push + tạo đơn GHTK y như webhook thật, để tiến trình phía sau
  // được test đầy đủ. fulfillPaidOrder không throw; vẫn bọc try/catch.
  try {
    await fulfillPaidOrder(orderId);
  } catch (err) {
    console.error("fulfillPaidOrder (skipPayment) lỗi:", err);
  }

  return { ok: true, status: "paid" };
}

export type RefreshShipmentResult =
  | { ok: true; status: string; statusText: string }
  | { ok: false; error: string };

/**
 * Khách bấm "Cập nhật" ở /my-tickets để tra trạng thái vận chuyển GHTK mới nhất
 * cho đơn của mình. Cần đơn có ghtkLabel (đã tạo đơn ship thành công).
 */
export async function refreshShipmentStatus(
  orderId: string,
): Promise<RefreshShipmentResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "Vui lòng đăng nhập lại." };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== user.id) {
    return { ok: false, error: "Không tìm thấy đơn hàng." };
  }
  if (!order.ghtkLabel) {
    return { ok: false, error: "Đơn chưa có mã vận chuyển." };
  }

  const result = await getGhtkShipmentStatus(order.ghtkLabel);
  if (!result.ok) {
    return { ok: false, error: "Chưa lấy được trạng thái, thử lại sau ít phút." };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      ghtkStatus: result.status,
      ghtkStatusText: result.statusText,
      ghtkSyncedAt: new Date(),
    },
  });

  revalidatePath("/my-tickets");
  return { ok: true, status: result.status, statusText: result.statusText };
}
