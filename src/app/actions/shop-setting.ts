"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { SHOP_SETTING_ID } from "@/lib/shop-setting";

// success optional để phân biệt state khởi tạo {error: null} với state sau khi
// lưu thành công {error: null, success: true} — xem ProfileFormState.
export type ShopSettingFormState = { error: string | null; success?: boolean };

/**
 * Lưu thông tin kho lấy hàng (pick_name / pick_tel / pick_address) dùng để tạo
 * đơn ship GHTK. Chỉ admin. Ghi vào bản ghi ShopSetting singleton.
 */
export async function updatePickInfo(
  _prevState: ShopSettingFormState,
  formData: FormData,
): Promise<ShopSettingFormState> {
  await requireAdmin();

  const pickName = String(formData.get("pickName") ?? "").trim();
  const pickTel = String(formData.get("pickTel") ?? "").trim();
  const pickAddress = String(formData.get("pickAddress") ?? "").trim();

  if (!pickName) return { error: "Thiếu tên người gửi." };
  if (!pickTel) return { error: "Thiếu số điện thoại." };
  if (!/^[0-9+ ]{8,15}$/.test(pickTel)) return { error: "Số điện thoại không hợp lệ." };
  if (!pickAddress) return { error: "Thiếu địa chỉ lấy hàng." };

  try {
    await prisma.shopSetting.upsert({
      where: { id: SHOP_SETTING_ID },
      create: { id: SHOP_SETTING_ID, pickName, pickTel, pickAddress },
      update: { pickName, pickTel, pickAddress },
    });
  } catch {
    return { error: "Lưu cấu hình thất bại, vui lòng thử lại." };
  }

  revalidatePath("/admin/settings");
  return { error: null, success: true };
}
