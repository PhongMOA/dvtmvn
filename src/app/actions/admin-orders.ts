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

// Tra cứu đơn theo qrToken quét được từ camera — CHỈ đọc, không check-in.
// Dùng cho bước hiện thẻ "Thông tin người mua" trước khi admin bấm Xác nhận
// (xem src/app/admin/scan/page.tsx), tránh check-in nhầm chỉ vì camera lướt
// qua đúng QR trong lúc admin chưa kịp nhìn thông tin.
export async function getOrderByQrToken(qrToken: string) {
  await requireAdmin();
  const order = await prisma.order.findUnique({
    where: { qrToken },
    include: { comboType: true, user: true },
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
    comboName: order.comboType.name,
    userName: order.user.name ?? order.user.email,
    phone: order.user.phone,
    quantity: order.quantity,
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
    include: { comboType: true, user: true },
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
  revalidatePath(`/admin/events/${order.comboType.eventId}/orders`);
  return {
    ok: true as const,
    comboName: order.comboType.name,
    userName: order.user.name ?? order.user.email,
    quantity: order.quantity,
  };
}
