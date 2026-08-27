"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";

/**
 * Đăng ký (hoặc cập nhật) 1 token FCM cho user hiện tại — gọi từ app native
 * ngay sau khi PushNotifications.register() trả token (xem
 * src/components/push-registrar.tsx). Upsert theo token (không phải userId)
 * vì 1 user có thể cài trên nhiều thiết bị; nếu cùng token đăng nhập bởi user
 * khác trên cùng máy (đổi tài khoản) thì userId được ghi đè theo user mới nhất.
 */
export async function registerDeviceToken(token: string) {
  const user = await requireUser();
  await prisma.deviceToken.upsert({
    where: { token },
    update: { userId: user.id, lastSeenAt: new Date() },
    create: { token, userId: user.id, platform: "android" },
  });
}
