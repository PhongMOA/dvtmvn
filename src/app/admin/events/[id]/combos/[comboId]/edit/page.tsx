import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateCombo } from "@/app/actions/admin-combos";
import { ComboForm } from "@/components/combo-form";
import { parseComboItems } from "@/lib/combo";

export default async function EditComboPage({
  params,
}: PageProps<"/admin/events/[id]/combos/[comboId]/edit">) {
  const { id, comboId } = await params;
  const combo = await prisma.comboType.findUnique({ where: { id: comboId } });
  if (!combo || combo.eventId !== id) notFound();

  const updateComboWithId = updateCombo.bind(null, id, combo.id);

  return (
    <div>
      <h1 className="font-heading text-3xl tracking-wide text-primary">
        SỬA COMBO
      </h1>
      <div className="mt-6">
        <ComboForm
          action={updateComboWithId}
          submitLabel="Lưu thay đổi"
          defaults={{
            name: combo.name,
            price: combo.price,
            originalPrice: combo.originalPrice,
            includesTicket: combo.includesTicket,
            items: parseComboItems(combo.items).join("\n"),
            totalQuantity: combo.totalQuantity,
          }}
        />
      </div>
    </div>
  );
}
