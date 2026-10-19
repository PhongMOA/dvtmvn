"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { createGhtkShipmentForOrder } from "@/lib/order-fulfillment";
import { cancelGhtkOrder } from "@/lib/ghtk";

// Đơn có thể gồm combo của nhiều event -> revalidate trang đơn của từng event.
function revalidateEventOrderPages(items: { comboType: { eventId: string } }[]) {
  for (const eventId of new Set(items.map((item) => item.comboType.eventId))) {
    revalidatePath(`/admin/events/${eventId}/orders`);
  }
}

// Check-in 1 đơn lẻ từ trang đơn hàng admin. Quét QR / kiosk thì check-in theo
// người + suất chiếu — xem src/lib/checkin.ts.
export async function checkInOrder(orderId: string) {
  const admin = await requireAdmin();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { comboType: true } } },
  });
  if (!order) return;

  // Chỉ check-in đơn đã thanh toán — phòng khi action bị gọi trực tiếp ngoài
  // UI (UI đã ẩn nút này cho đơn pending/expired).
  if (order.paymentStatus === "paid" && order.status !== "checked_in") {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "checked_in",
        checkedInAt: new Date(),
        checkedInVia: "staff",
        checkedInBy: admin.id,
      },
    });
  }
  revalidateEventOrderPages(order.items);
  revalidatePath("/admin/orders");
}

/**
 * Admin tạo (hoặc tạo lại khi lỗi) đơn vận chuyển GHTK cho đơn đã thanh toán
 * (chưa có ghtkLabel). createGhtkShipmentForOrder idempotent — nếu đã có label
 * thì không tạo trùng.
 */
export async function retryGhtkOrder(orderId: string) {
  await requireAdmin();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { comboType: true } } },
  });
  if (!order || order.paymentStatus !== "paid") return;

  await createGhtkShipmentForOrder(orderId);
  revalidateEventOrderPages(order.items);
  revalidatePath("/admin/orders");
}

export type CancelShipmentResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Huỷ đơn vận chuyển GHTK (chỉ admin). GHTK chỉ cho huỷ khi shipper chưa lấy
 * hàng — nếu không sẽ trả lỗi kèm lý do. Huỷ xong đánh dấu ghtkStatus = -1
 * (giữ nguyên label để tra cứu lịch sử).
 */
export async function cancelGhtkShipment(
  orderId: string,
): Promise<CancelShipmentResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Không có quyền." };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { comboType: true } } },
  });
  if (!order) return { ok: false, error: "Không tìm thấy đơn." };
  if (!order.ghtkLabel) return { ok: false, error: "Đơn chưa có mã vận chuyển." };

  const result = await cancelGhtkOrder(order.ghtkLabel);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "NOT_CONFIGURED"
          ? "Chưa cấu hình GHTK."
          : result.error,
    };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      ghtkStatus: "-1",
      ghtkStatusText: "Đã huỷ",
      ghtkSyncedAt: new Date(),
    },
  });

  revalidateEventOrderPages(order.items);
  revalidatePath("/admin/orders");
  revalidatePath("/my-tickets");
  return { ok: true };
}

export type DeleteExpiredOrderResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Xoá đơn đã hết hạn (chỉ admin). Kho + lượt mã giảm giá đã hoàn lúc đơn chuyển
 * sang "expired" (xem lib/order-expiry.ts) nên xoá không cần hoàn gì thêm;
 * OrderItem xoá theo cascade. Chặn xoá khi có giao dịch SePay nhắc mã đơn (khách
 * chuyển khoản trễ — cần giữ đơn để đối soát) hoặc có đơn nâng cấp trỏ tới đơn này.
 */
export async function deleteExpiredOrder(
  orderId: string,
): Promise<DeleteExpiredOrderResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Không có quyền." };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { comboType: true } },
      _count: { select: { upgrades: true } },
    },
  });
  if (!order) return { ok: false, error: "Không tìm thấy đơn." };
  if (order.paymentStatus !== "expired") {
    return { ok: false, error: "Chỉ xoá được đơn đã hết hạn." };
  }
  if (order._count.upgrades > 0) {
    return { ok: false, error: "Đơn có đơn nâng cấp liên quan — không thể xoá." };
  }
  const lateTransfers = await prisma.sepayTransaction.count({
    where: { content: { contains: order.orderCode, mode: "insensitive" } },
  });
  if (lateTransfers > 0) {
    return {
      ok: false,
      error: "Đơn đã có giao dịch chuyển khoản — cần đối soát, không thể xoá.",
    };
  }

  // deleteMany + where paymentStatus: phòng trạng thái đổi giữa lúc kiểm tra và xoá.
  const { count } = await prisma.order.deleteMany({
    where: { id: orderId, paymentStatus: "expired" },
  });
  if (count === 0) return { ok: false, error: "Đơn đã thay đổi, tải lại trang." };

  revalidateEventOrderPages(order.items);
  revalidatePath("/admin/orders");
  revalidatePath("/my-tickets");
  return { ok: true };
}
