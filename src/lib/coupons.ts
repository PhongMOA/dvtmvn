import type { Prisma } from "@/generated/prisma/client";

// Mã giảm giá cấp thẳng vào tài khoản user — lưu dạng JSON ở User.coupons, cấp
// bằng scripts/grant-coupon.ts (không có UI admin). Ví dụ:
//   [{ "code": "GIAM10", "percent": 10, "quantity": 1 },
//    { "code": "GIAM5",  "percent": 5,  "quantity": 2 },
//    { "code": "BOT50K", "amount": 50000, "quantity": 1, "label": "Quà sinh nhật" }]
// - percent (1–100) HOẶC amount (VND) — chỉ giảm trên tiền combo, KHÔNG giảm
//   phí ship: tổng = (tiền combo − giảm) + phí ship.
// - quantity = số lượt còn lại. Áp mã vào đơn -> trừ 1 lượt ngay (giữ lượt cho
//   đơn đang chờ thanh toán); đơn hết hạn -> hoàn lại lượt. Hết lượt thì xoá
//   phần tử khỏi mảng. Đơn lưu snapshot mã ở Order.coupon để hoàn đúng mã.

export type Coupon = {
  code: string;
  percent?: number;
  amount?: number;
  quantity: number;
  label?: string;
};

/** Mã đang hiển thị cho user chọn (đã tính sẵn mô tả + số tiền giảm). */
export type CouponOption = {
  code: string;
  description: string;
  quantity: number;
  discount: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Đọc 1 phần tử coupon; sai định dạng -> null (bị bỏ qua, không làm vỡ checkout). */
export function parseCoupon(value: unknown): Coupon | null {
  if (!isRecord(value)) return null;
  const code = typeof value.code === "string" ? value.code.trim() : "";
  if (!code) return null;
  const quantity = value.quantity === undefined ? 1 : value.quantity;
  if (typeof quantity !== "number" || !Number.isInteger(quantity)) return null;

  const coupon: Coupon = { code, quantity };
  if (
    typeof value.percent === "number" &&
    value.percent > 0 &&
    value.percent <= 100
  ) {
    coupon.percent = value.percent;
  } else if (
    typeof value.amount === "number" &&
    Number.isInteger(value.amount) &&
    value.amount > 0
  ) {
    coupon.amount = value.amount;
  } else {
    return null;
  }
  if (typeof value.label === "string" && value.label.trim()) {
    coupon.label = value.label.trim();
  }
  return coupon;
}

function rawList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Các mã còn lượt dùng trong ví của user. */
export function parseCoupons(value: unknown): Coupon[] {
  return rawList(value)
    .map(parseCoupon)
    .filter((c): c is Coupon => c !== null && c.quantity > 0);
}

/** Số tiền giảm trên tiền combo (không bao giờ vượt quá tiền combo). */
export function couponDiscount(coupon: Coupon, comboTotal: number): number {
  const raw = coupon.percent
    ? Math.floor((comboTotal * coupon.percent) / 100)
    : (coupon.amount ?? 0);
  return Math.max(0, Math.min(raw, comboTotal));
}

export function describeCoupon(coupon: Coupon): string {
  const value = coupon.percent
    ? `Giảm ${coupon.percent}%`
    : `Giảm ${new Intl.NumberFormat("vi-VN").format(coupon.amount ?? 0)}đ`;
  return coupon.label ? `${value} — ${coupon.label}` : value;
}

/**
 * Trừ 1 lượt của mã `code` trong ví. Trả về ví mới + snapshot mã (quantity 1)
 * để lưu vào đơn, hoặc null nếu không có/hết lượt. Giữ nguyên các phần tử khác
 * (kể cả phần tử sai định dạng) để không làm mất dữ liệu admin nhập tay.
 */
export function takeCoupon(
  wallet: unknown,
  code: string,
): { wallet: unknown[]; coupon: Coupon } | null {
  const list = rawList(wallet);
  const index = list.findIndex((item) => {
    const c = parseCoupon(item);
    return c !== null && c.code === code && c.quantity > 0;
  });
  if (index === -1) return null;

  const coupon = parseCoupon(list[index])!;
  const next = [...list];
  if (coupon.quantity <= 1) next.splice(index, 1);
  else next[index] = { ...(list[index] as Record<string, unknown>), quantity: coupon.quantity - 1 };
  return { wallet: next, coupon: { ...coupon, quantity: 1 } };
}

/** Hoàn 1 lượt mã (đơn hết hạn / đổi mã khác). Không còn phần tử cùng mã thì thêm lại. */
export function returnCoupon(wallet: unknown, coupon: Coupon): unknown[] {
  const list = rawList(wallet);
  const index = list.findIndex((item) => parseCoupon(item)?.code === coupon.code);
  const next = [...list];
  if (index === -1) {
    next.push({ ...coupon, quantity: 1 });
  } else {
    const current = parseCoupon(list[index])!;
    next[index] = {
      ...(list[index] as Record<string, unknown>),
      quantity: Math.max(0, current.quantity) + 1,
    };
  }
  return next;
}

/**
 * Đọc ví coupon của user với khoá dòng (SELECT ... FOR UPDATE) — gọi trong
 * transaction trước khi sửa ví, để 2 request song song (áp mã ở 2 đơn cùng lúc,
 * hoặc đơn hết hạn đúng lúc đang áp mã) không ghi đè lượt của nhau.
 *
 * Thứ tự khoá luôn là Order trước, User sau (xem applyCoupon, expireOrderIfPastDue)
 * để không deadlock.
 */
export async function lockUserCoupons(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<unknown> {
  const rows = await tx.$queryRaw<{ coupons: unknown }[]>`
    SELECT "coupons" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
  return rows[0]?.coupons ?? null;
}

/** Ví -> danh sách lựa chọn cho 1 đơn (đã cộng lại lượt của mã đơn đang dùng). */
export function couponOptions(
  wallet: unknown,
  applied: Coupon | null,
  comboTotal: number,
): CouponOption[] {
  const list = parseCoupons(applied ? returnCoupon(wallet, applied) : wallet);
  return list.map((c) => ({
    code: c.code,
    description: describeCoupon(c),
    quantity: c.quantity,
    discount: couponDiscount(c, comboTotal),
  }));
}
