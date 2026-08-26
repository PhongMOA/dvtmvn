import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TicketQr } from "@/components/ticket-qr";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { parseComboItems } from "@/lib/combo";
import { cn } from "@/lib/utils";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export default async function MyTicketsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent("/my-tickets")}`);
  }

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    include: { comboType: { include: { event: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Chỉ để hiển thị đúng ngay lần load này — việc hoàn kho thật sự (DB) do
  // expireOrderIfPastDue tự xử lý ở nơi khác (poll page / lượt đặt combo tiếp
  // theo, xem lib/order-expiry.ts), tránh phải chờ round-trip DB thứ 2 ở đây.
  const now = new Date();
  const displayOrders = orders.map((order) =>
    order.paymentStatus === "pending" && order.expiresAt < now
      ? { ...order, paymentStatus: "expired" as const }
      : order,
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="font-heading text-4xl tracking-wide text-primary">
        VÉ CỦA TÔI
      </h1>

      {displayOrders.length === 0 ? (
        <p className="mt-6 text-muted-foreground">
          Bạn chưa đặt combo nào. Quay lại trang chủ để đặt combo sự kiện đang mở bán.
        </p>
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          {displayOrders.map((order) => {
            const items = [
              ...(order.comboType.includesTicket ? ["1 Vé tham gia offline"] : []),
              ...parseComboItems(order.comboType.items),
            ];

            return (
              <div
                key={order.id}
                className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading text-2xl tracking-wide text-foreground">
                      {order.comboType.event.title}
                    </h2>
                    {order.paymentStatus === "pending" && (
                      <Badge variant="outline" className="border-accent text-accent">
                        Chờ thanh toán
                      </Badge>
                    )}
                    {order.paymentStatus === "expired" && (
                      <Badge variant="outline" className="text-muted-foreground">
                        Đã hết hạn
                      </Badge>
                    )}
                    {order.paymentStatus === "paid" && (
                      <Badge variant={order.status === "checked_in" ? "secondary" : "outline"}>
                        {order.status === "checked_in" ? "Đã check-in" : "Đã đặt"}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {order.comboType.event.venue} ·{" "}
                    {formatDateTime(order.comboType.event.startAt)}
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {order.comboType.name} × {order.quantity}
                  </p>
                  <ul className="mt-1 text-sm text-muted-foreground">
                    {items.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex justify-center">
                  {order.paymentStatus === "paid" && (
                    <TicketQr qrToken={order.qrToken} />
                  )}
                  {order.paymentStatus === "pending" && (
                    <Link
                      href={`/orders/${order.id}/pay`}
                      className={cn(buttonVariants(), "w-full sm:w-auto")}
                    >
                      Tiếp tục thanh toán
                    </Link>
                  )}
                  {order.paymentStatus === "expired" && (
                    <span className="text-sm text-muted-foreground">
                      Đã huỷ, kho đã hoàn lại
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
