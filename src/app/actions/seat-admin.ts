"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { fromVnDatetimeLocal } from "@/lib/datetime";
import {
  SeatSetupError,
  finalizeSeatList,
  lockEventSeats,
  recomputeUnlockTimes,
} from "@/lib/seat-allowance";

export type SeatConfigFormState = { error: string | null; success?: boolean };

function revalidateSeatPages(eventId: string) {
  revalidatePath(`/admin/events/${eventId}/seats`);
  revalidatePath("/my-tickets");
  revalidatePath(`/my-tickets/seats/${eventId}`);
}

/**
 * Lưu cấu hình chọn ghế của 1 event (giờ mở theo giờ VN, phút/lượt, người/lượt)
 * rồi tính lại unlockAt của danh sách đã chốt theo cấu hình mới. Chỉ admin.
 */
export async function updateSeatConfig(
  eventId: string,
  _prevState: SeatConfigFormState,
  formData: FormData,
): Promise<SeatConfigFormState> {
  await requireAdmin();

  const rawOpenAt = String(formData.get("seatOpenAt") ?? "").trim();
  const turnMinutes = Number(formData.get("seatTurnMinutes"));
  const batchSize = Number(formData.get("seatBatchSize"));

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(rawOpenAt)) {
    return { error: "Giờ mở chọn ghế không hợp lệ." };
  }
  const seatOpenAt = fromVnDatetimeLocal(rawOpenAt);
  if (Number.isNaN(seatOpenAt.getTime())) return { error: "Giờ mở chọn ghế không hợp lệ." };
  if (!Number.isInteger(turnMinutes) || turnMinutes < 1 || turnMinutes > 120) {
    return { error: "Số phút mỗi lượt phải từ 1 đến 120." };
  }
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 50) {
    return { error: "Số người mỗi lượt phải từ 1 đến 50." };
  }

  try {
    await prisma.event.update({
      where: { id: eventId },
      data: { seatOpenAt, seatTurnMinutes: turnMinutes, seatBatchSize: batchSize },
    });
    await recomputeUnlockTimes(eventId);
  } catch {
    return { error: "Lưu cấu hình thất bại, vui lòng thử lại." };
  }

  revalidateSeatPages(eventId);
  return { error: null, success: true };
}

export type SeatAdminResult = { ok: true; message: string } | { ok: false; error: string };

/** "Chốt danh sách" — snapshot thứ tự chọn ghế; chạy lại chỉ thêm người mua mới. */
export async function finalizeSeatListAction(eventId: string): Promise<SeatAdminResult> {
  await requireAdmin();
  try {
    const { added, updated } = await finalizeSeatList(eventId);
    revalidateSeatPages(eventId);
    return {
      ok: true,
      message: `Đã chốt: thêm ${added} người, cập nhật số vé ${updated} người.`,
    };
  } catch (err) {
    if (err instanceof SeatSetupError) return { ok: false, error: err.message };
    console.error("finalizeSeatListAction lỗi", eventId, err);
    return { ok: false, error: "Chốt danh sách thất bại, vui lòng thử lại." };
  }
}

/** Huỷ toàn bộ ghế 1 user đã chọn ở event — user được chọn lại (khi tới lượt). */
export async function deleteSeatBookings(
  eventId: string,
  userId: string,
): Promise<SeatAdminResult> {
  await requireAdmin();
  try {
    const { count } = await prisma.$transaction(async (tx) => {
      await lockEventSeats(tx, eventId);
      return tx.seatBooking.deleteMany({ where: { eventId, userId } });
    });
    revalidateSeatPages(eventId);
    return { ok: true, message: `Đã huỷ ${count} ghế.` };
  } catch (err) {
    console.error("deleteSeatBookings lỗi", eventId, userId, err);
    return { ok: false, error: "Huỷ ghế thất bại, vui lòng thử lại." };
  }
}
