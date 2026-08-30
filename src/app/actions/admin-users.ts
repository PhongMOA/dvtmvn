"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAdminEmail, requireAdmin } from "@/lib/auth-helpers";

export type DeleteUserResult =
  | { ok: true }
  | { ok: false; error: "NOT_FOUND" | "SELF" | "IS_ADMIN" | "HAS_ORDERS" };

// Xoá 1 user khỏi hệ thống. Chỉ cho xoá tài khoản "sạch" (không có đơn hàng) —
// user có đơn thì FK Order.userId chặn xoá, và ta cũng muốn giữ lịch sử bán vé.
// accounts / sessions / deviceTokens có onDelete: Cascade nên tự xoá theo.
export async function deleteUser(userId: string): Promise<DeleteUserResult> {
  const admin = await requireAdmin();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { _count: { select: { orders: true } } },
  });
  if (!user) return { ok: false, error: "NOT_FOUND" };
  if (user.id === admin.id) return { ok: false, error: "SELF" };
  if (user.role === "admin" || isAdminEmail(user.email)) {
    return { ok: false, error: "IS_ADMIN" };
  }
  if (user._count.orders > 0) return { ok: false, error: "HAS_ORDERS" };

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
  return { ok: true };
}

export type SetUserAdminResult =
  | { ok: true }
  | { ok: false; error: "NOT_FOUND" | "SELF" | "ENV_ADMIN" };

// Set/gỡ quyền admin cho 1 user bằng cột User.role. Nguồn sự thật là DB nên có
// hiệu lực ngay (xem isAdmin trong auth-helpers.ts) — user không cần đăng nhập lại.
// - SELF: không cho tự đổi quyền của chính mình (tránh admin tự khoá mình ra ngoài).
// - ENV_ADMIN: email khớp ADMIN_EMAIL luôn là admin, không set/gỡ qua UI được.
export async function setUserAdmin(
  userId: string,
  makeAdmin: boolean,
): Promise<SetUserAdminResult> {
  const admin = await requireAdmin();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });
  if (!user) return { ok: false, error: "NOT_FOUND" };
  if (user.id === admin.id) return { ok: false, error: "SELF" };
  if (isAdminEmail(user.email)) return { ok: false, error: "ENV_ADMIN" };

  await prisma.user.update({
    where: { id: userId },
    data: { role: makeAdmin ? "admin" : "user" },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}
