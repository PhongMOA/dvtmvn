import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getShopSetting } from "@/lib/shop-setting";
import { sendPushToTokens } from "@/lib/push";
import { createGhtkOrder, GHTK_STATUS_TEXT } from "@/lib/ghtk";

/**
 * Chạy toàn bộ side-effect sau khi 1 đơn chuyển sang "paid": gửi push + tạo đơn
 * vận chuyển GHTK. Gọi từ webhook SePay (route.ts) và từ skipPayment (admin).
 *
 * BEST-EFFORT — không bao giờ throw: webhook SePay retry dựa trên HTTP status,
 * lỗi push/GHTK không được làm hỏng response webhook. Idempotent: SePay có thể
 * gửi lại cùng 1 giao dịch tới 7 lần, và admin có thể bấm "tạo lại đơn ship".
 */
export async function fulfillPaidOrder(orderId: string): Promise<void> {
  let order;
  try {
    order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { comboType: true, user: true },
    });
  } catch (err) {
    console.error("fulfillPaidOrder: không load được đơn", orderId, err);
    return;
  }
  if (!order || order.paymentStatus !== "paid") return;

  // 1. Push "thanh toán thành công"
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
    console.error("fulfillPaidOrder: push thất bại (bỏ qua)", orderId, err);
  }

  // 2. Tạo đơn GHTK — bỏ qua nếu đã có label (idempotent)
  if (order.ghtkLabel) return;

  try {
    const shop = await getShopSetting();

    if (
      !shop.pickName ||
      !shop.pickTel ||
      !shop.pickProvince ||
      !shop.pickWard ||
      !shop.pickAddress
    ) {
      await prisma.order.update({
        where: { id: order.id },
        data: { ghtkError: "Shop chưa cấu hình đủ thông tin kho lấy hàng (thiếu Phường/Xã?)." },
      });
      return;
    }

    if (
      !order.shipPhone ||
      !order.shipProvince ||
      !order.shipWard ||
      !order.shipAddress
    ) {
      await prisma.order.update({
        where: { id: order.id },
        data: { ghtkError: "Đơn thiếu thông tin giao hàng (đơn tạo trước khi có bước xác nhận?)." },
      });
      return;
    }

    const result = await createGhtkOrder({
      orderCode: order.orderCode,
      pick: {
        name: shop.pickName,
        tel: shop.pickTel,
        province: shop.pickProvince,
        district: shop.pickDistrict,
        ward: shop.pickWard,
        address: shop.pickAddress,
      },
      to: {
        name: order.shipName || order.user.name || order.user.email,
        tel: order.shipPhone,
        province: order.shipProvince,
        district: order.shipDistrict ?? "",
        ward: order.shipWard,
        address: order.shipAddress,
      },
      productName: `${order.comboType.name} x${order.quantity}`,
      quantity: order.quantity,
      value: order.comboType.price * order.quantity,
      note: `Đơn ${order.orderCode}`,
    });

    if (result.ok) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          ghtkLabel: result.label,
          ghtkTrackingId: result.trackingId || null,
          ghtkStatus: result.statusId,
          ghtkStatusText: result.statusId
            ? GHTK_STATUS_TEXT[result.statusId] ?? `Trạng thái ${result.statusId}`
            : "Đã tạo đơn",
          ghtkError: null,
          ghtkSyncedAt: new Date(),
        },
      });
    } else {
      await prisma.order.update({
        where: { id: order.id },
        data: { ghtkError: result.error },
      });
    }
  } catch (err) {
    console.error("fulfillPaidOrder: tạo đơn GHTK lỗi", orderId, err);
    try {
      await prisma.order.update({
        where: { id: orderId },
        data: { ghtkError: err instanceof Error ? err.message : String(err) },
      });
    } catch {
      /* nuốt lỗi — không được throw ra webhook */
    }
  }

  revalidatePath("/my-tickets");
}
