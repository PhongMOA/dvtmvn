import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminOrdersView } from "@/components/admin-orders-view";
import { parseOrderFilters, parsePage } from "@/lib/admin-orders-data";

export default async function EventOrdersPage({
  params,
  searchParams,
}: PageProps<"/admin/events/[id]/orders">) {
  const { id } = await params;
  const sp = await searchParams;

  const event = await prisma.event.findUnique({
    where: { id },
    select: { title: true },
  });
  if (!event) notFound();

  return (
    <AdminOrdersView
      title={`ĐƠN HÀNG — ${event.title.toUpperCase()}`}
      eventId={id}
      filters={parseOrderFilters(sp)}
      pageRaw={parsePage(sp)}
      pathname={`/admin/events/${id}/orders`}
    />
  );
}
