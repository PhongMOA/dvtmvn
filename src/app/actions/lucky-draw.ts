"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  LuckyDrawError,
  drawNextRound,
  voidLatestWinner,
  type LuckyDrawWinnerView,
} from "@/lib/lucky-draw";

export type LuckyDrawFormState = { error: string | null; success?: boolean };
export type LuckyDrawResult = { ok: true; message: string } | { ok: false; error: string };
export type SpinResult =
  | { ok: true; winner: LuckyDrawWinnerView; pool: string[]; totalRounds: number }
  | { ok: false; error: string };

function revalidateDrawPages(eventId: string) {
  revalidatePath(`/admin/events/${eventId}/lucky-draw`);
  revalidatePath(`/admin/events/${eventId}/lucky-draw/stage`);
}

/** Tạo phiên quay (1 event 1 phiên) hoặc sửa số lượt. Không giảm dưới số lượt đã quay. */
export async function saveLuckyDraw(
  eventId: string,
  _prevState: LuckyDrawFormState,
  formData: FormData,
): Promise<LuckyDrawFormState> {
  const admin = await requireAdmin();
  const totalRounds = Number(formData.get("totalRounds"));
  if (!Number.isInteger(totalRounds) || totalRounds < 1 || totalRounds > 500) {
    return { error: "Số lượt phải từ 1 đến 500." };
  }

  try {
    const done = await prisma.luckyDrawWinner.count({
      where: { draw: { eventId }, voided: false },
    });
    if (totalRounds < done) return { error: `Đã quay ${done} lượt, không thể đặt ít hơn.` };
    await prisma.luckyDraw.upsert({
      where: { eventId },
      create: { eventId, totalRounds, createdBy: admin.id! },
      update: { totalRounds },
    });
  } catch (err) {
    console.error("saveLuckyDraw lỗi", eventId, err);
    return { error: "Lưu thất bại, vui lòng thử lại." };
  }

  revalidateDrawPages(eventId);
  return { error: null, success: true };
}

/**
 * Không revalidatePath: màn quay tự giữ state, refresh RSC giữa lúc chạy hiệu
 * ứng chỉ tốn thêm 1 lượt render. Trang admin đều dynamic nên vẫn thấy kết quả mới.
 */
export async function spinLuckyDraw(eventId: string): Promise<SpinResult> {
  const admin = await requireAdmin();
  try {
    const result = await drawNextRound(eventId, admin.id!);
    return { ok: true, ...result };
  } catch (err) {
    if (err instanceof LuckyDrawError) return { ok: false, error: err.message };
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "Lượt này vừa được quay ở nơi khác, tải lại trang." };
    }
    console.error("spinLuckyDraw lỗi", eventId, err);
    return { ok: false, error: "Không quay được, vui lòng thử lại." };
  }
}

export async function voidLuckyDrawWinner(
  eventId: string,
  winnerId: string,
): Promise<LuckyDrawResult> {
  await requireAdmin();
  try {
    await voidLatestWinner(eventId, winnerId);
  } catch (err) {
    if (err instanceof LuckyDrawError) return { ok: false, error: err.message };
    console.error("voidLuckyDrawWinner lỗi", eventId, err);
    return { ok: false, error: "Không huỷ được lượt, vui lòng thử lại." };
  }
  revalidateDrawPages(eventId);
  return { ok: true, message: "Đã huỷ lượt, quay lại lượt này." };
}

/** Xoá phiên + toàn bộ kết quả (cascade) để quay lại từ đầu. */
export async function resetLuckyDraw(eventId: string): Promise<LuckyDrawResult> {
  await requireAdmin();
  try {
    await prisma.luckyDraw.deleteMany({ where: { eventId } });
  } catch (err) {
    console.error("resetLuckyDraw lỗi", eventId, err);
    return { ok: false, error: "Không xoá được phiên, vui lòng thử lại." };
  }
  revalidateDrawPages(eventId);
  return { ok: true, message: "Đã xoá phiên quay số." };
}
