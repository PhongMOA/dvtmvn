import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProfileModalClient } from "@/components/profile-modal-client";

/**
 * Server wrapper: tính needsProfile (thiếu phone / tỉnh / quận / địa chỉ) từ DB mỗi lần
 * layout render, rồi giao cho client component xử lý hiển thị/tắt modal.
 * Đặt trong root layout nên áp dụng cho mọi trang sau khi đăng nhập.
 */
export async function ProfileModal() {
  const session = await auth();
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true, province: true, district: true, address: true },
  });
  if (!user) return null;

  const needsProfile =
    !user.phone || !user.province || !user.district || !user.address;

  return (
    <ProfileModalClient
      needsProfile={needsProfile}
      defaultPhone={user.phone ?? ""}
      defaultProvince={user.province ?? ""}
      defaultDistrict={user.district ?? ""}
      defaultAddress={user.address ?? ""}
    />
  );
}
