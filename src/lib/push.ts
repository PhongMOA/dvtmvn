import { getFirebaseMessaging } from "@/lib/firebase-admin";
import { prisma } from "@/lib/prisma";

const MAX_TOKENS_PER_CALL = 500; // giới hạn cứng của sendEachForMulticast

/**
 * Gửi push cho danh sách token FCM, tự chia batch 500 (giới hạn Admin SDK) và
 * tự xoá token "chết" (app đã gỡ cài đặt) khỏi DB. Dùng chung cho push thanh
 * toán thành công (Phase 3) và push broadcast admin (Phase 4).
 */
export async function sendPushToTokens(
  tokens: string[],
  notification: { title: string; body: string },
): Promise<{ sent: number; removed: number }> {
  if (tokens.length === 0) return { sent: 0, removed: 0 };

  const messaging = getFirebaseMessaging();
  let sent = 0;
  const deadTokens: string[] = [];

  for (let i = 0; i < tokens.length; i += MAX_TOKENS_PER_CALL) {
    const chunk = tokens.slice(i, i + MAX_TOKENS_PER_CALL);
    const res = await messaging.sendEachForMulticast({ tokens: chunk, notification });
    res.responses.forEach((r, idx) => {
      if (r.success) {
        sent++;
      } else if (r.error?.code === "messaging/registration-token-not-registered") {
        deadTokens.push(chunk[idx]);
      }
    });
  }

  if (deadTokens.length > 0) {
    await prisma.deviceToken.deleteMany({ where: { token: { in: deadTokens } } });
  }
  return { sent, removed: deadTokens.length };
}
