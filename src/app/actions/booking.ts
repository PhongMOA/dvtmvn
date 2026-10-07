"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import {
  expireOrderIfPastDue,
  expireStaleOrdersForCombos,
} from "@/lib/order-expiry";
import { orderItemsQuantity, orderItemsTotal } from "@/lib/order-items";
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
      orderCode: string;
      // Giá trị hồ sơ hiện có (có thể rỗng/điền một phần) để hiện sẵn trong
      // bước xác nhận thông tin nhận hàng — không bắt user gõ lại từ đầu.
      profile: CheckoutProfile;
    }
  | { ok: false; error: string };

export type BookingLine = { comboTypeId: string; quantity: number };

// Giới hạn số dòng combo khác nhau trong 1 đơn — chặn payload bất thường.
const MAX_LINES = 20;

class BookingError extends Error {}

/**
 * Giữ chỗ 1 đơn gồm 1 hoặc nhiều dòng combo ("Đặt ngay" = 1 dòng; giỏ hàng =
 * nhiều dòng). Trừ kho TẤT CẢ các dòng trong cùng 1 transaction — thiếu hàng ở
 * bất kỳ dòng nào thì huỷ cả đơn, không giữ chỗ lưng chừng.
 */
export async function bookCombos(lines: BookingLine[]): Promise<BookComboResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "UNAUTHORIZED" };
  }

  if (!Array.isArray(lines) || lines.length === 0) {
    return { ok: false, error: "Chưa chọn combo nào." };
  }
  // Gộp các dòng trùng combo (phòng client gửi lặp).
  const merged = new Map<string, number>();
  for (const line of lines) {
    if (
      typeof line?.comboTypeId !== "string" ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1
    ) {
      return { ok: false, error: "Số lượng không hợp lệ." };
    }
    merged.set(line.comboTypeId, (merged.get(line.comboTypeId) ?? 0) + line.quantity);
  }
  if (merged.size > MAX_LINES) {
    return { ok: false, error: "Đơn có quá nhiều loại combo." };
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

  // Dọn trước các đơn "pending" đã quá hạn của các combo này để hoàn lại kho —
  // không có cron nên tận dụng ngay lúc có người đặt mới (xem lib/order-expiry.ts).
  await expireStaleOrdersForCombos([...merged.keys()]);

  let orderId: string;
  let orderCode: string;
  try {
    const order = await prisma.$transaction(async (tx) => {
      const items: { comboTypeId: string; quantity: number; unitPrice: number }[] = [];

      for (const [comboTypeId, quantity] of merged) {
        // Conditional atomic update: DB chỉ decrement nếu WHERE khớp (còn đủ
        // hàng VÀ event của combo đang "open") trong CÙNG 1 câu lệnh — an toàn
        // chống oversell. Lỗi ở dòng nào thì throw -> rollback cả transaction.
        const { count } = await tx.comboType.updateMany({
          where: {
            id: comboTypeId,
            remainingQuantity: { gte: quantity },
            event: { status: "open" },
          },
          data: { remainingQuantity: { decrement: quantity } },
        });

        const combo = await tx.comboType.findUnique({
          where: { id: comboTypeId },
          include: { event: true },
        });
        if (!combo) throw new BookingError("Có combo không còn tồn tại, vui lòng tải lại trang.");
        if (count === 0) {
          if (combo.event.status !== "open") throw new BookingError("Sự kiện đã ngừng bán.");
          throw new BookingError(
            combo.remainingQuantity < 1
              ? `Combo "${combo.name}" đã hết hàng.`
              : `Combo "${combo.name}" chỉ còn ${combo.remainingQuantity}.`,
          );
        }
        items.push({ comboTypeId, quantity, unitPrice: combo.price });
      }

      // Đơn tạo ra ở trạng thái "pending" — chỉ thành "paid" khi webhook SePay
      // xác nhận đã nhận đúng số tiền + đúng orderCode (xem api/webhooks/sepay).
      return tx.order.create({
        data: {
          userId: user.id,
          orderCode: generateOrderCode(),
          paymentStatus: "pending",
          expiresAt: new Date(Date.now() + PAYMENT_WINDOW_MINUTES * 60 * 1000),
          items: { create: items },
        },
      });
    });
    orderId = order.id;
    orderCode = order.orderCode;
  } catch (err) {
    if (err instanceof BookingError) return { ok: false, error: err.message };
    return { ok: false, error: "Đặt combo thất bại, vui lòng thử lại." };
  }

  revalidatePath("/");
  revalidatePath("/my-tickets");
  return { ok: true, orderId, orderCode, profile };
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
    include: { items: true },
  });
  if (!order || order.userId !== user.id || order.items.length === 0) {
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
    weightGram: COMBO_WEIGHT_GRAM * orderItemsQuantity(order.items),
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

  const comboTotal = orderItemsTotal(order.items);
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
