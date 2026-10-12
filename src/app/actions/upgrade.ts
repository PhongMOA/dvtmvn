"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { expireStaleOrdersForCombos } from "@/lib/order-expiry";
import { isUpgradeTarget, pendingUpgradeQuantity } from "@/lib/order-upgrade";
import { generateOrderCode, PAYMENT_WINDOW_MINUTES } from "@/lib/sepay";
import {
  hasInvalidShirtSizes,
  parseShirtSizes,
  shirtSizesTotal,
  type ShirtSizes,
} from "@/lib/shirt-sizes";

export type UpgradeResult = { ok: true; orderId: string } | { ok: false; error: string };

class UpgradeError extends Error {}

/**
 * Tạo đơn nâng cấp (pending) cho `quantity` combo của dòng `orderItemId` sang
 * combo `targetComboId`. Khách chuyển khoản phần chênh lệch ở /orders/[id]/pay;
 * webhook xác nhận -> finalizePaidUpgrade huỷ phần combo cũ + hoàn kho.
 */
export async function createUpgradeOrder(input: {
  orderItemId: string;
  targetComboId: string;
  quantity: number;
  sizes?: ShirtSizes;
}): Promise<UpgradeResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "UNAUTHORIZED" };
  }

  const { orderItemId, targetComboId, quantity } = input;
  if (
    typeof orderItemId !== "string" ||
    typeof targetComboId !== "string" ||
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    return { ok: false, error: "Dữ liệu nâng cấp không hợp lệ." };
  }
  if (hasInvalidShirtSizes(input.sizes)) {
    return { ok: false, error: "Size áo không hợp lệ." };
  }
  const sizes = parseShirtSizes(input.sizes);

  await expireStaleOrdersForCombos([targetComboId]);

  let orderId: string;
  try {
    const order = await prisma.$transaction(async (tx) => {
      // Khoá dòng combo cũ: 2 request nâng cấp song song trên cùng dòng chạy
      // tuần tự, phép đếm "còn nâng cấp được" bên dưới luôn đúng.
      await tx.$queryRaw`SELECT "id" FROM "OrderItem" WHERE "id" = ${orderItemId} FOR UPDATE`;

      const source = await tx.orderItem.findUnique({
        where: { id: orderItemId },
        include: { order: true, comboType: true },
      });
      if (!source || source.order.userId !== user.id) {
        throw new UpgradeError("Không tìm thấy đơn hàng.");
      }
      if (source.order.paymentStatus !== "paid") {
        throw new UpgradeError("Chỉ nâng cấp được đơn đã thanh toán.");
      }
      if (source.order.status === "checked_in") {
        throw new UpgradeError("Đơn đã check-in, không nâng cấp được.");
      }
      if (source.comboType.includesTicket) {
        throw new UpgradeError("Combo này đã có vé, không cần nâng cấp.");
      }

      const upgradable =
        source.quantity -
        source.upgradedQuantity -
        (await pendingUpgradeQuantity(source.id, tx));
      if (quantity > upgradable) {
        throw new UpgradeError(
          upgradable < 1
            ? "Combo này đã được nâng cấp hoặc đang chờ thanh toán nâng cấp."
            : `Chỉ còn ${upgradable} combo có thể nâng cấp.`,
        );
      }

      const target = await tx.comboType.findUnique({
        where: { id: targetComboId },
        include: { event: true },
      });
      if (
        !target ||
        !isUpgradeTarget(target, {
          eventId: source.comboType.eventId,
          unitPrice: source.unitPrice,
        })
      ) {
        throw new UpgradeError("Combo nâng cấp không hợp lệ.");
      }
      if (target.includesShirt && shirtSizesTotal(sizes) !== quantity) {
        throw new UpgradeError(`Số áo theo size phải bằng số combo (${quantity}).`);
      }

      // Trừ kho combo mới — cùng điều kiện với bookCombos (còn hàng + đang bán).
      const { count } = await tx.comboType.updateMany({
        where: {
          id: target.id,
          remainingQuantity: { gte: quantity },
          event: { status: "open" },
        },
        data: { remainingQuantity: { decrement: quantity } },
      });
      if (count === 0) {
        if (target.event.status !== "open") throw new UpgradeError("Sự kiện đã ngừng bán.");
        throw new UpgradeError(
          target.remainingQuantity < 1
            ? `Combo "${target.name}" đã hết hàng.`
            : `Combo "${target.name}" chỉ còn ${target.remainingQuantity}.`,
        );
      }

      const old = source.order;
      return tx.order.create({
        data: {
          userId: user.id,
          orderCode: generateOrderCode(),
          paymentStatus: "pending",
          expiresAt: new Date(Date.now() + PAYMENT_WINDOW_MINUTES * 60 * 1000),
          upgradeFromOrderId: old.id,
          upgradeFromItemId: source.id,
          // Giao về địa chỉ đơn cũ, không thu thêm phí ship.
          shipName: old.shipName,
          shipPhone: old.shipPhone,
          shipProvince: old.shipProvince,
          shipDistrict: old.shipDistrict,
          shipWard: old.shipWard,
          shipAddress: old.shipAddress,
          shipFee: 0,
          items: {
            create: {
              comboTypeId: target.id,
              quantity,
              unitPrice: target.price - source.unitPrice,
              ...(target.includesShirt && { shirtSizes: sizes as Prisma.InputJsonValue }),
            },
          },
        },
      });
    });
    orderId = order.id;
  } catch (err) {
    if (err instanceof UpgradeError) return { ok: false, error: err.message };
    return { ok: false, error: "Nâng cấp thất bại, vui lòng thử lại." };
  }

  revalidatePath("/");
  revalidatePath("/my-tickets");
  return { ok: true, orderId };
}
