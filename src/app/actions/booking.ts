"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import {
  expireOrderIfPastDue,
  expireStaleOrdersForCombo,
} from "@/lib/order-expiry";
import { generateOrderCode, PAYMENT_WINDOW_MINUTES } from "@/lib/sepay";
import { getShopSetting } from "@/lib/shop-setting";
import { COMBO_WEIGHT_GRAM, estimateShippingFee } from "@/lib/ghtk";

export type CheckoutProfile = {
  name: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  address: string;
};

export type BookComboResult =
  | {
      ok: true;
      orderId: string;
      // Giá trị hồ sơ hiện có (có thể rỗng/điền một phần) để hiện sẵn trong
      // bước xác nhận thông tin nhận hàng — không bắt user gõ lại từ đầu.
      profile: CheckoutProfile;
    }
  | { ok: false; error: string };

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

  // Hồ sơ giao hàng KHÔNG còn chặn cứng ở đây — bước "xác nhận thông tin nhận
  // hàng" (ShippingCheckout → prepareCheckout) sau khi giữ chỗ sẽ bắt user điền
  // đủ trước khi tính phí ship + sang thanh toán. Ở đây chỉ đọc để hiện sẵn.
  const profileRow = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      name: true,
      phone: true,
      province: true,
      district: true,
      ward: true,
      address: true,
    },
  });
  const profile: CheckoutProfile = {
    name: profileRow?.name ?? "",
    phone: profileRow?.phone ?? "",
    province: profileRow?.province ?? "",
    district: profileRow?.district ?? "",
    ward: profileRow?.ward ?? "",
    address: profileRow?.address ?? "",
  };

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
  return { ok: true, orderId, profile };
}

export type PrepareCheckoutResult =
  | { ok: true; comboTotal: number; shipFee: number; total: number }
  | { ok: false; error: string };

const PHONE_RE = /^[0-9+ ]{8,15}$/;

/**
 * Bước "tóm tắt đơn hàng" trước khi thanh toán: chốt địa chỉ nhận hàng, tính phí
 * ship GHTK thật (kho lấy hàng → địa chỉ khách) và snapshot toàn bộ vào Order.
 * Số tiền chuyển khoản sau đó = giá combo + shipFee (xem pay page + webhook).
 *
 * Chặn thanh toán nếu GHTK không tính được phí (chưa cấu hình / tỉnh bị từ chối /
 * lỗi mạng) — quyết định đã chốt với user.
 */
export async function prepareCheckout(
  orderId: string,
  formData: FormData,
): Promise<PrepareCheckoutResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "Vui lòng đăng nhập lại." };
  }

  await expireOrderIfPastDue(orderId);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { comboType: true },
  });
  if (!order || order.userId !== user.id) {
    return { ok: false, error: "Không tìm thấy đơn hàng." };
  }
  if (order.paymentStatus === "paid") {
    return { ok: false, error: "Đơn đã được thanh toán." };
  }
  if (order.paymentStatus !== "pending") {
    return { ok: false, error: "Đơn đã hết hạn, vui lòng đặt lại." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const province = String(formData.get("province") ?? "").trim();
  const district = String(formData.get("district") ?? "").trim();
  const ward = String(formData.get("ward") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();

  if (!phone) return { ok: false, error: "Thiếu số điện thoại." };
  if (!PHONE_RE.test(phone)) return { ok: false, error: "Số điện thoại không hợp lệ." };
  if (!province) return { ok: false, error: "Thiếu tỉnh/thành." };
  if (!district) return { ok: false, error: "Thiếu quận/huyện." };
  if (!ward) return { ok: false, error: "Thiếu phường/xã." };
  if (!address) return { ok: false, error: "Thiếu địa chỉ chi tiết." };

  const shop = await getShopSetting();
  if (
    !shop.pickName ||
    !shop.pickTel ||
    !shop.pickProvince ||
    !shop.pickWard ||
    !shop.pickAddress
  ) {
    return {
      ok: false,
      error: "Shop chưa cấu hình kho lấy hàng, vui lòng liên hệ ban tổ chức.",
    };
  }

  // Chỉ ghi địa chỉ vào hồ sơ user khi hồ sơ CHƯA đầy đủ (lần đầu điền) — để
  // ProfileModal thôi nhắc. Nếu hồ sơ đã đủ mà khách chọn "Giao địa chỉ khác"
  // thì đây là địa chỉ dùng 1 lần, không được ghi đè hồ sơ. Địa chỉ của đơn
  // luôn được snapshot vào Order bên dưới.
  const profileRow = await prisma.user.findUnique({
    where: { id: user.id },
    select: { province: true, district: true, ward: true, address: true },
  });
  const profileWasComplete = Boolean(
    profileRow?.province &&
      profileRow?.district &&
      profileRow?.ward &&
      profileRow?.address,
  );
  if (!profileWasComplete) {
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { phone, province, district, ward, address },
      });
    } catch {
      /* không critical */
    }
  }

  const estimate = await estimateShippingFee({
    pickProvince: shop.pickProvince,
    pickDistrict: shop.pickDistrict,
    toProvince: province,
    toDistrict: district,
    toAddress: address,
    weightGram: COMBO_WEIGHT_GRAM * order.quantity,
  });

  if (estimate.status === "rejected") {
    return {
      ok: false,
      error:
        'GHTK không giao tới địa chỉ này. Kiểm tra lại tên Tỉnh/Thành đúng theo ' +
        'GHTK (vd "Hà Nội", "TP. Hồ Chí Minh").',
    };
  }
  if (estimate.status !== "ok") {
    return {
      ok: false,
      error: "Chưa tính được phí ship, vui lòng thử lại sau ít phút.",
    };
  }

  const comboTotal = order.comboType.price * order.quantity;
  const shipFee = estimate.fee;

  await prisma.order.update({
    where: { id: order.id },
    data: {
      shipName: name || user.name || user.email || null,
      shipPhone: phone,
      shipProvince: province,
      shipDistrict: district,
      shipWard: ward,
      shipAddress: address,
      shipFee,
    },
  });

  revalidatePath(`/orders/${order.id}/pay`);
  revalidatePath("/my-tickets");

  return { ok: true, comboTotal, shipFee, total: comboTotal + shipFee };
}
