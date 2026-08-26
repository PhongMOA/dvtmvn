"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";

// success là optional (không phải boolean thường): state khởi tạo {error: null} phải
// phân biệt được với state sau khi lưu thành công {error: null, success: true} — nếu
// không client (useEffect toast) sẽ không biết được là mới submit xong hay là state ban đầu.
export type ProfileFormState = { error: string | null; success?: boolean };

export async function updateProfile(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser();

  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();

  if (!phone) return { error: "Thiếu số điện thoại." };
  if (!/^[0-9+ ]{8,15}$/.test(phone)) return { error: "Số điện thoại không hợp lệ." };
  if (!address) return { error: "Thiếu địa chỉ." };

  try {
    await prisma.user.update({ where: { id: user.id }, data: { phone, address } });
  } catch {
    return { error: "Cập nhật thông tin thất bại, vui lòng thử lại." };
  }

  // Revalidate "/" vì ProfileModal (kiểm tra needsProfile) render trong layout ở đó —
  // sau khi lưu thành công, modal phải biến mất ngay mà không cần chờ điều hướng.
  revalidatePath("/");
  revalidatePath("/profile");
  return { error: null, success: true };
}
