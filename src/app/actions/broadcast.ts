"use server";

import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { sendPushToTokens } from "@/lib/push";

/**
 * Gửi 1 thông báo tự do tới TẤT CẢ thiết bị đã đăng ký (`DeviceToken`) — push
 * OS thật, không phải in-app banner, kể cả app đang đóng. Tái dùng
 * `sendPushToTokens` (batch 500 + tự dọn token chết) từ Phase 3.
 */
export async function sendBroadcastNotification(title: string, body: string) {
  await requireAdmin();
  if (!title.trim() || !body.trim()) {
    return { ok: false as const, error: "EMPTY" as const };
  }

  const tokens = await prisma.deviceToken.findMany({ select: { token: true } });

  // Khác webhook/simulatePayment (push chỉ best-effort, không được throw) —
  // ở đây gửi push CHÍNH là mục đích của action, nhưng vẫn bọc try/catch để
  // trả lỗi có cấu trúc cho UI thay vì để throw trần (client mất luôn state
  // "đang gửi" nếu action reject — vd chưa cấu hình FIREBASE_SERVICE_ACCOUNT_JSON).
  try {
    const { sent, removed } = await sendPushToTokens(
      tokens.map((t) => t.token),
      { title: title.trim(), body: body.trim() },
    );
    return { ok: true as const, sent, removed, total: tokens.length };
  } catch (err) {
    console.error("Gửi broadcast thất bại:", err);
    return { ok: false as const, error: "SEND_FAILED" as const };
  }
}
