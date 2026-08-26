import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateEvent } from "@/app/actions/admin-events";
import { EventForm } from "@/components/event-form";

function toDatetimeLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function EditEventPage({
  params,
}: PageProps<"/admin/events/[id]/edit">) {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) notFound();

  const updateEventWithId = updateEvent.bind(null, event.id);

  return (
    <div>
      <h1 className="font-heading text-3xl tracking-wide text-primary">
        SỬA SỰ KIỆN
      </h1>
      <div className="mt-6">
        <EventForm
          action={updateEventWithId}
          submitLabel="Lưu thay đổi"
          defaults={{
            title: event.title,
            description: event.description ?? "",
            posterUrl: event.posterUrl ?? "",
            venue: event.venue,
            startAt: toDatetimeLocal(event.startAt),
          }}
        />
      </div>
    </div>
  );
}
