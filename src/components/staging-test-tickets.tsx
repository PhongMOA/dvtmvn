import { prisma } from "@/lib/prisma";
import { TicketQr } from "@/components/ticket-qr";

/**
 * CHỈ STAGING (dữ liệu seed giả), chỉ admin — my-tickets kiểm tra cả 2: QR +
 * SĐT của 10 khách khác nhau có vé, chưa check-in, để thử quét QR / nhập SĐT
 * trên kiosk.
 */
export async function StagingTestTickets({ excludeUserId }: { excludeUserId: string }) {
  const orders = await prisma.order.findMany({
    where: {
      userId: { not: excludeUserId },
      paymentStatus: "paid",
      status: "booked",
      items: { some: { comboType: { includesTicket: true } } },
    },
    distinct: ["userId"],
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      orderCode: true,
      qrToken: true,
      shipPhone: true,
      user: { select: { name: true, email: true, phone: true } },
      items: { take: 1, select: { comboType: { select: { event: { select: { title: true } } } } } },
    },
  });

  return (
    <section className="mt-10 rounded-lg border border-dashed border-amber-400/60 p-6">
      <h2 className="font-heading text-2xl tracking-wide text-amber-400">QR thử kiosk (staging)</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {orders.length} khách khác nhau, chưa check-in. Quét QR hoặc nhập SĐT trên kiosk đúng suất chiếu.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {orders.map((o) => (
          <div key={o.id} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
            <TicketQr qrToken={o.qrToken} />
            <div className="min-w-0 text-sm">
              <p className="truncate font-semibold">{o.user.name ?? o.user.email}</p>
              <p className="font-mono text-lg">{o.user.phone ?? o.shipPhone ?? "—"}</p>
              <p className="truncate text-muted-foreground">{o.items[0]?.comboType.event.title}</p>
              <p className="font-mono text-xs text-muted-foreground">#{o.orderCode}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
