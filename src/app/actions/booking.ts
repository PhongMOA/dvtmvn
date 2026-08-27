"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { expireStaleOrdersForCombo } from "@/lib/order-expiry";
import { generateOrderCode, PAYMENT_WINDOW_MINUTES } from "@/lib/sepay";

export type BookComboResult =
  | { ok: true; orderId: string }
  | {
      ok: false;
      error: string;
      // Chỉ có khi error === "MISSING_PROFILE" — giá trị hiện có (có thể đã
      // điền 1 trong 2 trường) để client hiện sẵn trong modal bắt buộc bổ
      // sung, không bắt user gõ lại từ đầu.
      profile?: { phone: string; address: string };
    };

export async function bookCombo(
  comboTypeId: string,
  quantity: number,
): Promise<BookComboResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "UNAUTHORIZED" };
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, error: "Số lượng không hợp lệ." };
  }

  // Bắt buộc có SĐT + địa chỉ trước khi giữ chỗ — cần để giao vé/combo sau
  // này. ProfileModal ở layout chỉ nhắc nhẹ (dismiss được), nên phải chặn
  // thật ở đây (nguồn dữ liệu DB, không tin trạng thái client) chứ không chỉ
  // dựa vào việc modal đó có đang hiện hay không.
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { phone: true, address: true },
  });
  if (!profile?.phone || !profile?.address) {
    return {
      ok: false,
      error: "MISSING_PROFILE",
      profile: { phone: profile?.phone ?? "", address: profile?.address ?? "" },
    };
  }

  // Dọn trước các đơn "pending" đã quá hạn của combo này để hoàn lại kho — không
  // có cron nên tận dụng ngay lúc có người đặt mới (xem lib/order-expiry.ts).
  await expireStaleOrdersForCombo(comboTypeId);

  let orderId: string;
  try {
    const order = await prisma.$transaction(async (tx) => {
      // Conditional atomic update: DB chỉ decrement nếu WHERE khớp (còn đủ hàng
      // VÀ event của combo đang "open") trong CÙNG 1 câu lệnh — an toàn chống
      // oversell kể cả khi đổi sang DB có connection pool thật, không chỉ nhờ
      // SQLite tự serialize transaction.
      const { count } = await tx.comboType.updateMany({
        where: {
          id: comboTypeId,
          remainingQuantity: { gte: quantity },
          event: { status: "open" },
        },
        data: { remainingQuantity: { decrement: quantity } },
      });

      if (count === 0) {
        const combo = await tx.comboType.findUnique({
          where: { id: comboTypeId },
          include: { event: true },
        });
        if (!combo) throw new Error("COMBO_NOT_FOUND");
        if (combo.event.status !== "open") throw new Error("EVENT_NOT_OPEN");
        throw new Error("NOT_ENOUGH_STOCK");
      }

      // Đơn tạo ra ở trạng thái "pending" — chỉ thành "paid" khi webhook SePay
      // xác nhận đã nhận đúng số tiền + đúng orderCode (xem api/webhooks/sepay).
      return tx.order.create({
        data: {
          comboTypeId,
          userId: user.id,
          quantity,
          orderCode: generateOrderCode(),
          paymentStatus: "pending",
          expiresAt: new Date(Date.now() + PAYMENT_WINDOW_MINUTES * 60 * 1000),
        },
      });
    });
    orderId = order.id;
  } catch (err) {
    if (err instanceof Error && err.message === "EVENT_NOT_OPEN") {
      return { ok: false, error: "Sự kiện đã ngừng bán." };
    }
    if (err instanceof Error && err.message === "NOT_ENOUGH_STOCK") {
      return { ok: false, error: "Combo đã hết hàng." };
    }
    if (err instanceof Error && err.message === "COMBO_NOT_FOUND") {
      return { ok: false, error: "Combo không tồn tại." };
    }
    return { ok: false, error: "Đặt combo thất bại, vui lòng thử lại." };
  }

  revalidatePath("/");
  revalidatePath("/my-tickets");
  return { ok: true, orderId };
}
