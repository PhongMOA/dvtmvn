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
  if (isAdminEmail(user.email)) return { ok: false, error: "IS_ADMIN" };
  if (user._count.orders > 0) return { ok: false, error: "HAS_ORDERS" };

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
  return { ok: true };
}
