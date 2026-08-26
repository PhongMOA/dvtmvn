"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

export type EventFormState = { error: string | null };

type EventInput = {
  title: string;
  description: string;
  posterUrl: string;
  venue: string;
  startAt: string; // datetime-local string
};

function parseEventForm(formData: FormData): EventInput {
  return {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    posterUrl: String(formData.get("posterUrl") ?? "").trim(),
    venue: String(formData.get("venue") ?? "").trim(),
    startAt: String(formData.get("startAt") ?? ""),
  };
}

function validateEventInput(input: EventInput): string | null {
  if (!input.title) return "Thiếu tên sự kiện.";
  if (!input.venue) return "Thiếu địa điểm.";
  if (!input.startAt || Number.isNaN(Date.parse(input.startAt)))
    return "Thời gian bắt đầu không hợp lệ.";
  return null;
}

export async function createEvent(
  _prevState: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  await requireAdmin();
  const input = parseEventForm(formData);
  const error = validateEventInput(input);
  if (error) return { error };

  let eventId: string;
  try {
    const event = await prisma.event.create({
      data: {
        title: input.title,
        description: input.description || null,
        posterUrl: input.posterUrl || null,
        venue: input.venue,
        startAt: new Date(input.startAt),
        status: "draft",
      },
    });
    eventId = event.id;
  } catch {
    return { error: "Tạo sự kiện thất bại, vui lòng thử lại." };
  }

  revalidatePath("/admin/events");
  redirect(`/admin/events/${eventId}/edit`);
}

export async function updateEvent(
  eventId: string,
  _prevState: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  await requireAdmin();
  const input = parseEventForm(formData);
  const error = validateEventInput(input);
  if (error) return { error };

  try {
    await prisma.event.update({
      where: { id: eventId },
      data: {
        title: input.title,
        description: input.description || null,
        posterUrl: input.posterUrl || null,
        venue: input.venue,
        startAt: new Date(input.startAt),
      },
    });
  } catch {
    return { error: "Cập nhật sự kiện thất bại, vui lòng thử lại." };
  }

  revalidatePath("/admin/events");
  revalidatePath("/");
  return { error: null };
}

export async function openEvent(eventId: string) {
  await requireAdmin();
  await prisma.$transaction([
    prisma.event.updateMany({
      where: { status: "open", NOT: { id: eventId } },
      data: { status: "closed" },
    }),
    prisma.event.update({ where: { id: eventId }, data: { status: "open" } }),
  ]);
  revalidatePath("/admin/events");
  revalidatePath("/");
}

export async function closeEvent(eventId: string) {
  await requireAdmin();
  await prisma.event.update({ where: { id: eventId }, data: { status: "closed" } });
  revalidatePath("/admin/events");
  revalidatePath("/");
}
