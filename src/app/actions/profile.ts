"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { checkLocationServiceable } from "@/lib/ghtk";

// success là optional (không phải boolean thường): state khởi tạo {error: null} phải
// phân biệt được với state sau khi lưu thành công {error: null, success: true} — nếu
// không client (useEffect toast) sẽ không biết được là mới submit xong hay là state ban đầu.
// warning: lưu được nhưng chưa xác thực được địa chỉ với GHTK.
export type ProfileFormState = {
  error: string | null;
  success?: boolean;
  warning?: string;
};

export async function updateProfile(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser();

  const phone = String(formData.get("phone") ?? "").trim();
  const province = String(formData.get("province") ?? "").trim();
  const district = String(formData.get("district") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();

  if (!phone) return { error: "Thiếu số điện thoại." };
  if (!/^[0-9+ ]{8,15}$/.test(phone)) return { error: "Số điện thoại không hợp lệ." };
  if (!province) return { error: "Thiếu tỉnh/thành." };
  if (!district) return { error: "Thiếu quận/huyện." };
  if (!address) return { error: "Thiếu địa chỉ chi tiết." };

  // MVP: GHTK fee chỉ xác thực được cấp tỉnh/thành — đủ để sau này tính phí ship.
  const check = await checkLocationServiceable({ province, district, address });
  if (check.status === "rejected") {
    return {
      error:
        'GHTK không nhận diện được Tỉnh/Thành này. Kiểm tra lại chính tả ' +
        '(vd "Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng").',
    };
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { phone, province, district, address },
    });
  } catch {
    return { error: "Cập nhật thông tin thất bại, vui lòng thử lại." };
  }

  // Revalidate "/" vì ProfileModal (kiểm tra needsProfile) render trong layout ở đó —
  // sau khi lưu thành công, modal phải biến mất ngay mà không cần chờ điều hướng.
  revalidatePath("/");
  revalidatePath("/profile");

  if (check.status === "unavailable") {
    return {
      error: null,
      success: true,
      warning:
        check.detail === "NOT_CONFIGURED"
          ? "Đã lưu, nhưng chưa cấu hình GHTK nên chưa xác thực được địa chỉ."
          : "Đã lưu, nhưng dịch vụ GHTK tạm thời không phản hồi — địa chỉ chưa được xác thực.",
    };
  }

  return { error: null, success: true };
}
