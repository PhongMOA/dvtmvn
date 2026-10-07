"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { createGhtkShipmentForOrder } from "@/lib/order-fulfillment";
import { cancelGhtkOrder } from "@/lib/ghtk";
import { describeOrderItems, orderItemsQuantity } from "@/lib/order-items";

// Đơn có thể gồm combo của nhiều event -> revalidate trang đơn của từng event.
function revalidateEventOrderPages(items: { comboType: { eventId: string } }[]) {
  for (const eventId of new Set(items.map((item) => item.comboType.eventId))) {
    revalidatePath(`/admin/events/${eventId}/orders`);
  }
}

export async function checkInOrder(orderId: string) {
  await requireAdmin();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { comboType: true } } },
  });
  if (!order) return;

  // Chỉ check-in đơn đã thanh toán — phòng khi action bị gọi trực tiếp ngoài
  // UI (UI đã ẩn nút này cho đơn pending/expired).
  if (order.paymentStatus === "paid") {
    await prisma.order.update({ where: { id: orderId }, data: { status: "checked_in" } });
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

// Tra cứu đơn theo qrToken quét được từ camera — CHỈ đọc, không check-in.
// Dùng cho bước hiện thẻ "Thông tin người mua" trước khi admin bấm Xác nhận
// (xem src/app/admin/scan/page.tsx), tránh check-in nhầm chỉ vì camera lướt
// qua đúng QR trong lúc admin chưa kịp nhìn thông tin.
export async function getOrderByQrToken(qrToken: string) {
  await requireAdmin();
  const order = await prisma.order.findUnique({
    where: { qrToken },
    include: { items: { include: { comboType: true } }, user: true },
  });
  if (!order) return { ok: false as const, error: "NOT_FOUND" as const };
  if (order.paymentStatus !== "paid") {
    return { ok: false as const, error: "NOT_PAID" as const };
  }
  if (order.status === "checked_in") {
    return { ok: false as const, error: "ALREADY_CHECKED_IN" as const };
  }
  return {
    ok: true as const,
    orderCode: order.orderCode,
    comboName: describeOrderItems(order.items),
    userName: order.user.name ?? order.user.email,
    phone: order.user.phone,
    quantity: orderItemsQuantity(order.items),
  };
}

// Check-in bằng qrToken — bước XÁC NHẬN thật sự sau khi admin đã xem thông tin
// từ getOrderByQrToken ở trên và bấm "Xác nhận". Cùng nghiệp vụ với
// checkInOrder, chỉ khác cách tra order (theo qrToken thay vì id) và trả về
// kết quả có cấu trúc để UI hiển thị toast phù hợp. Không dùng updateMany
// atomic guard như webhook SePay vì 2 admin quét trùng 1 QR gần như không xảy
// ra thực tế — check tuần tự đơn giản, đúng KISS. Vẫn tự re-check paymentStatus
// + status ở đây (không tin vào kết quả getOrderByQrToken đã cũ) đề phòng
// trạng thái đổi giữa lúc tra cứu và lúc admin bấm xác nhận.
export async function checkInByQrToken(qrToken: string) {
  await requireAdmin();
  const order = await prisma.order.findUnique({
    where: { qrToken },
    include: { items: { include: { comboType: true } }, user: true },
  });
  if (!order) return { ok: false as const, error: "NOT_FOUND" as const };
  if (order.paymentStatus !== "paid") {
    return { ok: false as const, error: "NOT_PAID" as const };
  }
  if (order.status === "checked_in") {
    return { ok: false as const, error: "ALREADY_CHECKED_IN" as const };
  }
  await prisma.order.update({
    where: { id: order.id },
    data: { status: "checked_in" },
  });
  revalidateEventOrderPages(order.items);
  return {
    ok: true as const,
    comboName: describeOrderItems(order.items),
    userName: order.user.name ?? order.user.email,
    quantity: orderItemsQuantity(order.items),
  };
}
