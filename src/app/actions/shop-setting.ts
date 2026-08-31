"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { SHOP_SETTING_ID } from "@/lib/shop-setting";
import { checkPickLocation } from "@/lib/ghtk";

// success/warning optional để phân biệt state khởi tạo {error: null} với state sau
// khi lưu — xem ProfileFormState. warning: lưu được nhưng chưa xác thực với GHTK.
export type ShopSettingFormState = {
  error: string | null;
  success?: boolean;
  warning?: string;
};

/**
 * Lưu thông tin kho lấy hàng (pick_name / pick_tel / pick_province / pick_district
 * / pick_address) dùng để tạo đơn ship GHTK. Chỉ admin.
 *
 * Trước khi lưu: gọi GHTK kiểm tra tỉnh/quận có giao được không (endpoint fee).
 * GHTK từ chối -> chặn lưu. GHTK không phản hồi -> vẫn lưu nhưng kèm cảnh báo.
 */
export async function updatePickInfo(
  _prevState: ShopSettingFormState,
  formData: FormData,
): Promise<ShopSettingFormState> {
  await requireAdmin();

  const pickName = String(formData.get("pickName") ?? "").trim();
  const pickTel = String(formData.get("pickTel") ?? "").trim();
  const pickProvince = String(formData.get("pickProvince") ?? "").trim();
  const pickDistrict = String(formData.get("pickDistrict") ?? "").trim();
  const pickWard = String(formData.get("pickWard") ?? "").trim();
  const pickAddress = String(formData.get("pickAddress") ?? "").trim();

  if (!pickName) return { error: "Thiếu tên người gửi." };
  if (!pickTel) return { error: "Thiếu số điện thoại." };
  if (!/^[0-9+ ]{8,15}$/.test(pickTel)) return { error: "Số điện thoại không hợp lệ." };
  if (!pickProvince) return { error: "Thiếu tỉnh/thành." };
  if (!pickDistrict) return { error: "Thiếu quận/huyện." };
  if (!pickWard) return { error: "Thiếu phường/xã." };
  if (!pickAddress) return { error: "Thiếu địa chỉ chi tiết." };

  const check = await checkPickLocation({
    province: pickProvince,
    district: pickDistrict,
    address: pickAddress,
  });

  if (check.status === "rejected") {
    return {
      error:
        'GHTK không nhận diện được địa chỉ này. Kiểm tra lại tên Tỉnh/Thành và ' +
        'Quận/Huyện đúng theo GHTK (vd "Hà Nội", "TP. Hồ Chí Minh", "Quận Ba Đình").',
    };
  }

  try {
    await prisma.shopSetting.upsert({
      where: { id: SHOP_SETTING_ID },
      create: {
        id: SHOP_SETTING_ID,
        pickName,
        pickTel,
        pickProvince,
        pickDistrict,
        pickWard,
        pickAddress,
      },
      update: {
        pickName,
        pickTel,
        pickProvince,
        pickDistrict,
        pickWard,
        pickAddress,
      },
    });
  } catch {
    return { error: "Lưu cấu hình thất bại, vui lòng thử lại." };
  }

  revalidatePath("/admin/settings");

  if (check.status === "unavailable") {
    return {
      error: null,
      success: true,
      warning:
        check.detail === "NOT_CONFIGURED"
          ? "Đã lưu, nhưng chưa cấu hình GHTK_TOKEN nên chưa xác thực được địa chỉ."
          : "Đã lưu, nhưng dịch vụ GHTK tạm thời không phản hồi — địa chỉ chưa được xác thực.",
    };
  }

  return { error: null, success: true };
}
