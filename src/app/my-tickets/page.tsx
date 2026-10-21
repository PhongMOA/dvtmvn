import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { expireOrderIfPastDue } from "@/lib/order-expiry";
import { TicketQr } from "@/components/ticket-qr";
import { StagingTestTickets } from "@/components/staging-test-tickets";
import { isAdmin } from "@/lib/auth-helpers";
import { ShipmentStatus } from "@/components/shipment-status";
import { SeatTurnCard } from "@/components/seat-turn-card";
import {
  UpgradeComboButton,
  type UpgradeTarget,
} from "@/components/upgrade-combo-button";
import { isUpgradeTarget } from "@/lib/order-upgrade";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { parseComboItems } from "@/lib/combo";
import { formatShirtSizes } from "@/lib/shirt-sizes";
import { cn } from "@/lib/utils";
import { formatEventStart } from "@/lib/datetime";

export default async function MyTicketsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent("/my-tickets")}`);
  }

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    include: {
      items: { include: { comboType: { include: { event: true } } } },
      upgradeFromOrder: { select: { id: true, orderCode: true } },
      upgrades: {
        select: {
          id: true,
          orderCode: true,
          paymentStatus: true,
          expiresAt: true,
          upgradeFromItemId: true,
          items: { select: { quantity: true, comboType: { select: { name: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Combo có vé đang bán của các event user đã mua — làm lựa chọn nâng cấp.
  const eventIds = [
    ...new Set(orders.flatMap((o) => o.items.map((i) => i.comboType.eventId))),
  ];
  const ticketCombos = await prisma.comboType.findMany({
    where: { eventId: { in: eventIds }, includesTicket: true, event: { status: "open" } },
    orderBy: { price: "asc" },
  });

  // Hoàn kho thật ngay tại đây cho các đơn "pending" đã quá hạn hiển thị ở
  // trang này — trước đây trang này chỉ ĐỔI NHÃN để hiển thị cho đẹp, không
  // thật sự ghi DB/hoàn kho, nên nếu không có hành động nào khác (poll trang
  // thanh toán / đặt lại đúng combo) kích hoạt expireOrderIfPastDue thì kho bị
  // giữ "treo" vĩnh viễn dù UI đã báo "Đã hết hạn".
  const now = new Date();
  const staleOrderIds = orders
    .filter((order) => order.paymentStatus === "pending" && order.expiresAt < now)
    .map((order) => order.id);
  await Promise.all(staleOrderIds.map((id) => expireOrderIfPastDue(id)));

  // Lượt chọn ghế (chỉ có sau khi admin "Chốt danh sách" ở event).
  const [seatAllowances, seatBookings] = await Promise.all([
    prisma.seatAllowance.findMany({
      where: { userId: session.user.id, ticketCount: { gt: 0 } },
      include: { event: { select: { title: true } } },
      orderBy: { unlockAt: "asc" },
    }),
    prisma.seatBooking.findMany({
      where: { userId: session.user.id },
      select: { eventId: true, seatCode: true },
      orderBy: { seatCode: "asc" },
    }),
  ]);

  // Staging (dữ liệu seed): admin thấy thêm QR/SĐT khách khác để thử kiosk.
  const showTestTickets =
    process.env.NEXT_PUBLIC_APP_ENV === "staging" && (await isAdmin(session.user));

  const displayOrders = orders.map((order) =>
    staleOrderIds.includes(order.id)
      ? { ...order, paymentStatus: "expired" as const }
      : order,
  );

  /** Lựa chọn nâng cấp cho 1 dòng combo — null nếu dòng không nâng cấp được. */
  function upgradeOptions(
    order: (typeof orders)[number],
    item: (typeof orders)[number]["items"][number],
  ): { upgradable: number; targets: UpgradeTarget[] } | null {
    if (order.paymentStatus !== "paid" || order.status === "checked_in") return null;
    if (item.comboType.includesTicket) return null;
    const pending = order.upgrades
      .filter(
        (u) =>
          u.upgradeFromItemId === item.id &&
          u.paymentStatus === "pending" &&
          u.expiresAt > now,
      )
      .reduce((sum, u) => sum + u.items.reduce((s, i) => s + i.quantity, 0), 0);
    const upgradable = item.quantity - item.upgradedQuantity - pending;
    if (upgradable < 1) return null;
    const targets = ticketCombos
      .filter((combo) =>
        isUpgradeTarget(combo, { eventId: item.comboType.eventId, unitPrice: item.unitPrice }),
      )
      .map((combo) => ({
        id: combo.id,
        name: combo.name,
        price: combo.price,
        diff: combo.price - item.unitPrice,
        includesShirt: combo.includesShirt,
        remainingQuantity: combo.remainingQuantity,
        contents: parseComboItems(combo.items),
      }));
    return targets.length > 0 ? { upgradable, targets } : null;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="font-heading text-4xl tracking-wide text-primary">
        VÉ CỦA TÔI
      </h1>

      {seatAllowances.length > 0 && (
        <div className="mt-6 flex flex-col gap-3">
          {seatAllowances.map((allowance) => (
            <SeatTurnCard
              key={allowance.id}
              eventId={allowance.eventId}
              eventTitle={allowance.event.title}
              unlockAt={allowance.unlockAt.toISOString()}
              ticketCount={allowance.ticketCount}
              seats={seatBookings
                .filter((b) => b.eventId === allowance.eventId)
                .map((b) => b.seatCode)}
            />
          ))}
        </div>
      )}

      {displayOrders.length === 0 ? (
        <p className="mt-6 text-muted-foreground">
          Bạn chưa đặt combo nào. Quay lại trang chủ để đặt combo sự kiện đang mở bán.
        </p>
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          {displayOrders.map((order) => {
            // Combo trong 1 đơn thường cùng 1 event — lấy event của dòng đầu
            // làm tiêu đề thẻ.
            const event = order.items[0]?.comboType.event;

            return (
              <div
                key={order.id}
                className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
              >
               <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading text-2xl tracking-wide text-foreground">
                      {event?.title ?? "Đơn hàng"}
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
                  {event && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {event.venue} · {event.startAtTentative && "Dự kiến "}{formatEventStart(event, "long")}
                    </p>
                  )}
                  <Link
                    href={`/orders/${order.id}`}
                    className="mt-1 inline-block font-mono text-xs text-muted-foreground hover:text-accent hover:underline"
                  >
                    Mã đơn #{order.orderCode}
                  </Link>
                  {order.upgradeFromOrder && (
                    <p className="mt-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-foreground">
                      Combo nâng cấp từ đơn{" "}
                      <Link
                        href={`/orders/${order.upgradeFromOrder.id}`}
                        className="font-mono font-semibold text-accent underline-offset-2 hover:underline"
                      >
                        #{order.upgradeFromOrder.orderCode}
                      </Link>{" "}
                      — chỉ thanh toán phần chênh lệch.
                    </p>
                  )}
                  {order.items.map((item) => {
                    const upgrade = upgradeOptions(order, item);
                    const fullyUpgraded = item.upgradedQuantity >= item.quantity;
                    return (
                    <div key={item.id} className="mt-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={cn(
                            "text-sm font-medium text-foreground",
                            fullyUpgraded && "text-muted-foreground line-through",
                          )}
                        >
                          {item.comboType.name} × {item.quantity}
                        </p>
                        {item.upgradedQuantity > 0 && (
                          <Badge variant="outline" className="text-muted-foreground">
                            {fullyUpgraded
                              ? "Đã nâng cấp"
                              : `${item.upgradedQuantity} đã nâng cấp`}
                          </Badge>
                        )}
                        {upgrade && (
                          <UpgradeComboButton
                            orderItemId={item.id}
                            comboName={item.comboType.name}
                            upgradableQuantity={upgrade.upgradable}
                            targets={upgrade.targets}
                          />
                        )}
                      </div>
                      {formatShirtSizes(item.shirtSizes) && (
                        <p className="text-sm text-foreground">
                          Size áo: {formatShirtSizes(item.shirtSizes)}
                        </p>
                      )}
                      <ul className="mt-1 text-sm text-muted-foreground">
                        {parseComboItems(item.comboType.items).map((content) => (
                          <li key={content}>• {content}</li>
                        ))}
                      </ul>
                    </div>
                    );
                  })}
                  {order.upgrades
                    .filter((u) => u.paymentStatus === "paid" || u.paymentStatus === "pending")
                    .map((u) => (
                      <p key={u.id} className="mt-2 text-xs text-muted-foreground">
                        {u.paymentStatus === "paid"
                          ? "Đã nâng cấp"
                          : "Đang nâng cấp (chờ thanh toán)"}{" "}
                        sang {u.items.map((i) => `${i.comboType.name} × ${i.quantity}`).join(", ")}{" "}
                        — đơn{" "}
                        <Link
                          href={`/orders/${u.id}`}
                          className="font-mono font-semibold text-accent underline-offset-2 hover:underline"
                        >
                          #{u.orderCode}
                        </Link>
                      </p>
                    ))}
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
                      Đã huỷ
                    </span>
                  )}
                </div>
               </div>

                {order.paymentStatus === "paid" && (
                  <ShipmentStatus
                    orderId={order.id}
                    label={order.ghtkLabel}
                    status={order.ghtkStatus}
                    statusText={order.ghtkStatusText}
                    syncedAt={order.ghtkSyncedAt?.toISOString() ?? null}
                    error={order.ghtkError}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {showTestTickets && <StagingTestTickets excludeUserId={session.user.id} />}
    </div>
  );
}
