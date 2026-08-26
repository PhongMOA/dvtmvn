import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createCombo } from "@/app/actions/admin-combos";
import { ComboForm } from "@/components/combo-form";

export default async function NewComboPage({
  params,
}: PageProps<"/admin/events/[id]/combos/new">) {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) notFound();

  const createComboForEvent = createCombo.bind(null, id);

  return (
    <div>
      <h1 className="font-heading text-3xl tracking-wide text-primary">
        TẠO COMBO MỚI — {event.title.toUpperCase()}
      </h1>
      <div className="mt-6">
        <ComboForm action={createComboForEvent} submitLabel="Tạo combo" />
      </div>
    </div>
  );
}
