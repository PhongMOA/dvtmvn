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
    await prisma.comboType.create({
      data: {
        eventId,
        name: input.name,
        price: input.price,
        originalPrice: input.originalPrice,
        includesTicket: input.includesTicket,
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
