"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { stringifyComboItems } from "@/lib/combo";

export type ComboFormState = { error: string | null };

type ComboInput = {
  name: string;
  price: number;
  originalPrice: number | null;
  includesTicket: boolean;
  includesShirt: boolean;
  isRecommended: boolean;
  wideCard: boolean;
  items: string; // JSON string, đã convert từ textarea
  totalQuantity: number;
};

function parseComboForm(formData: FormData): ComboInput {
  const originalPriceRaw = String(formData.get("originalPrice") ?? "").trim();
  return {
    name: String(formData.get("name") ?? "").trim(),
    price: Number(formData.get("price") ?? 0),
    originalPrice: originalPriceRaw ? Number(originalPriceRaw) : null,
    includesTicket: formData.get("includesTicket") === "on",
    includesShirt: formData.get("includesShirt") === "on",
    isRecommended: formData.get("isRecommended") === "on",
    wideCard: formData.get("wideCard") === "on",
    items: stringifyComboItems(String(formData.get("items") ?? "")),
    totalQuantity: Number(formData.get("totalQuantity") ?? 0),
  };
}

function validateComboInput(input: ComboInput): string | null {
  if (!input.name) return "Thiếu tên combo.";
  if (!Number.isInteger(input.price) || input.price < 0) return "Giá combo không hợp lệ.";
  if (
    input.originalPrice !== null &&
    (!Number.isInteger(input.originalPrice) || input.originalPrice < input.price)
  )
    return "Giá gốc phải là số nguyên và không nhỏ hơn giá bán.";
  if (!Number.isInteger(input.totalQuantity) || input.totalQuantity < 1)
    return "Số lượng combo phải là số nguyên dương.";
  return null;
}

export async function createCombo(
  eventId: string,
  _prevState: ComboFormState,
  formData: FormData,
): Promise<ComboFormState> {
  await requireAdmin();
  const input = parseComboForm(formData);
  const error = validateComboInput(input);
  if (error) return { error };

  try {
    // Combo mới nằm cuối danh sách.
    const { _max } = await prisma.comboType.aggregate({
      where: { eventId },
      _max: { sortOrder: true },
    });
    await prisma.comboType.create({
      data: {
        sortOrder: (_max.sortOrder ?? -1) + 1,
        eventId,
        name: input.name,
        price: input.price,
        originalPrice: input.originalPrice,
        includesTicket: input.includesTicket,
        includesShirt: input.includesShirt,
        isRecommended: input.isRecommended,
        wideCard: input.wideCard,
        items: input.items,
        totalQuantity: input.totalQuantity,
        remainingQuantity: input.totalQuantity,
      },
    });
  } catch {
    return { error: "Tạo combo thất bại, vui lòng thử lại." };
  }

  revalidatePath(`/admin/events/${eventId}/combos`);
  revalidatePath("/");
  redirect(`/admin/events/${eventId}/combos`);
}

export async function updateCombo(
  eventId: string,
  comboId: string,
  _prevState: ComboFormState,
  formData: FormData,
): Promise<ComboFormState> {
  await requireAdmin();
  const input = parseComboForm(formData);
  const error = validateComboInput(input);
  if (error) return { error };

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.comboType.findUniqueOrThrow({ where: { id: comboId } });
      const sold = existing.totalQuantity - existing.remainingQuantity;
      if (input.totalQuantity < sold) {
        throw new Error(`Không thể đặt tổng số lượng thấp hơn số đã bán (${sold}).`);
      }

      await tx.comboType.update({
        where: { id: comboId },
        data: {
          name: input.name,
          price: input.price,
          originalPrice: input.originalPrice,
          includesTicket: input.includesTicket,
          includesShirt: input.includesShirt,
          isRecommended: input.isRecommended,
          wideCard: input.wideCard,
          items: input.items,
          totalQuantity: input.totalQuantity,
          // Delta atomic — cộng/trừ chênh lệch vào remainingQuantity hiện tại thay
          // vì ghi đè bằng giá trị tuyệt đối, để không "xoá mất" phần đã bị trừ bởi
          // 1 booking xảy ra đồng thời (cùng pattern với Event.remainingSeats cũ).
          remainingQuantity: { increment: input.totalQuantity - existing.totalQuantity },
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Không thể")) {
      return { error: err.message };
    }
    return { error: "Cập nhật combo thất bại, vui lòng thử lại." };
  }

  revalidatePath(`/admin/events/${eventId}/combos`);
  revalidatePath("/");
  return { error: null };
}

export async function deleteCombo(eventId: string, comboId: string) {
  await requireAdmin();
  await prisma.comboType.delete({ where: { id: comboId } });
  revalidatePath(`/admin/events/${eventId}/combos`);
  revalidatePath("/");
}

/** Đổi thứ tự hiển thị: đổi chỗ với combo liền trên/dưới, đánh lại sortOrder 0..n-1. */
export async function moveCombo(eventId: string, comboId: string, direction: "up" | "down") {
  await requireAdmin();
  const combos = await prisma.comboType.findMany({
    where: { eventId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const index = combos.findIndex((c) => c.id === comboId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= combos.length) return;
  [combos[index], combos[swapWith]] = [combos[swapWith], combos[index]];
  await prisma.$transaction(
    combos.map((c, i) =>
      prisma.comboType.update({ where: { id: c.id }, data: { sortOrder: i } }),
    ),
  );
  revalidatePath(`/admin/events/${eventId}/combos`);
  revalidatePath("/");
}
