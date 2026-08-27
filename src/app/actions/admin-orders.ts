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

// Check-in bằng qrToken quét được từ camera (xem src/app/admin/scan/page.tsx)
// — cùng nghiệp vụ với checkInOrder ở trên, chỉ khác cách tra order (theo
// qrToken thay vì id) và trả về kết quả có cấu trúc để UI hiển thị toast phù
// hợp (thay vì chỉ revalidate 1 trang danh sách). Không dùng updateMany atomic
// guard như webhook SePay vì 2 admin quét trùng 1 QR gần như không xảy ra
// thực tế — check tuần tự đơn giản, đúng KISS.
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
