import { createEvent } from "@/app/actions/admin-events";
import { EventForm } from "@/components/event-form";

export default function NewEventPage() {
  return (
    <div>
      <h1 className="font-heading text-3xl tracking-wide text-primary">
        TẠO SỰ KIỆN MỚI
      </h1>
      <div className="mt-6">
        <EventForm action={createEvent} submitLabel="Tạo sự kiện" />
      </div>
    </div>
  );
}
