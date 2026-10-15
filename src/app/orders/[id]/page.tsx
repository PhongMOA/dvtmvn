import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth-helpers";
import { expireOrderIfPastDue } from "@/lib/order-expiry";
import { orderAmountDue, orderItemsTotal } from "@/lib/order-items";
import { parseCoupon } from "@/lib/coupons";
import { parseComboItems } from "@/lib/combo";
import { formatShirtSizes } from "@/lib/shirt-sizes";
import { VN_TIME_ZONE, formatEventStart } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: VN_TIME_ZONE,
  }).format(date);
}

const PAYMENT_LABEL: Record<string, string> = {
  paid: "Đã thanh toán",
  pending: "Chờ thanh toán",
  expired: "Đã hết hạn",
};

/** Chi tiết 1 đơn — chủ đơn hoặc admin xem được. */
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/orders/${id}`)}`);
  }

  await expireOrderIfPastDue(id);

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      items: { include: { comboType: { include: { event: true } } } },
      upgradeFromOrder: { select: { id: true, orderCode: true } },
      upgrades: {
        select: {
          id: true,
          orderCode: true,
          paymentStatus: true,
          createdAt: true,
          items: { select: { quantity: true, comboType: { select: { name: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!order) notFound();
  const viewerIsAdmin = await isAdmin(session.user);
  if (order.userId !== session.user.id && !viewerIsAdmin) notFound();

  const upgradeFromItem = order.upgradeFromItemId
    ? await prisma.orderItem.findUnique({
        where: { id: order.upgradeFromItemId },
        select: { comboType: { select: { name: true } } },
      })
    : null;
  const event = order.items[0]?.comboType.event;
  const isUpgrade = Boolean(order.upgradeFromOrder);
  const couponCode = parseCoupon(order.coupon)?.code;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <Link
        href={viewerIsAdmin && order.userId !== session.user.id ? "/admin/orders" : "/my-tickets"}
        className="text-sm text-muted-foreground hover:text-accent"
      >
        ← Quay lại
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-3xl tracking-wide text-primary">
          ĐƠN #{order.orderCode}
        </h1>
        <Badge
          variant={order.paymentStatus === "paid" ? "default" : "outline"}
          className={cn(order.paymentStatus === "expired" && "text-muted-foreground")}
        >
          {PAYMENT_LABEL[order.paymentStatus]}
        </Badge>
        {order.status === "checked_in" && <Badge variant="secondary">Đã check-in</Badge>}
        {isUpgrade && (
          <Badge variant="outline" className="border-accent text-accent">
            Combo nâng cấp
          </Badge>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Đặt lúc {formatDateTime(order.createdAt)}
        {order.paidAt && ` · Thanh toán lúc ${formatDateTime(order.paidAt)}`}
        {viewerIsAdmin && ` · ${order.user.name ?? order.user.email}`}
      </p>

      {order.upgradeFromOrder && (
        <div className="mt-4 rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-foreground">
          <p className="font-semibold">Ghi chú: Combo nâng cấp</p>
          <p className="mt-1">
            Nâng cấp từ đơn{" "}
            <Link
              href={`/orders/${order.upgradeFromOrder.id}`}
              className="font-mono font-semibold text-accent underline-offset-2 hover:underline"
            >
              #{order.upgradeFromOrder.orderCode}
            </Link>
            {upgradeFromItem && ` (combo cũ: ${upgradeFromItem.comboType.name})`}.
            Đơn này chỉ thu phần chênh lệch; combo cũ được huỷ và thay bằng combo
            mới sau khi thanh toán.
          </p>
        </div>
      )}

      {event && (
        <p className="mt-6 font-medium text-foreground">
          {event.title}
          <span className="font-normal text-muted-foreground">
            {" "}· {event.venue} · {event.startAtTentative && "Dự kiến "}{formatEventStart(event, "medium")}
          </span>
        </p>
      )}

      <div className="mt-3 flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        {order.items.map((item) => {
          const fullyUpgraded = item.upgradedQuantity >= item.quantity;
          return (
            <div key={item.id}>
              <div className="flex items-baseline justify-between gap-3">
                <p
                  className={cn(
                    "font-medium text-foreground",
                    fullyUpgraded && "text-muted-foreground line-through",
                  )}
                >
                  {item.comboType.name} × {item.quantity}
                </p>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {formatVnd(item.unitPrice * item.quantity)}
                </span>
              </div>
              {item.upgradedQuantity > 0 && (
                <p className="text-xs text-muted-foreground">
                  {fullyUpgraded ? "Đã nâng cấp toàn bộ" : `${item.upgradedQuantity} combo đã nâng cấp`}
                </p>
              )}
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

        <dl className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              {isUpgrade ? "Chênh lệch nâng cấp" : "Tiền combo"}
            </dt>
            <dd className="text-foreground">{formatVnd(orderItemsTotal(order.items))}</dd>
          </div>
          {order.discountAmount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                Giảm giá{couponCode ? ` (${couponCode})` : ""}
              </dt>
              <dd className="text-primary">−{formatVnd(order.discountAmount)}</dd>
            </div>
          )}
          {!isUpgrade && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Phí ship</dt>
              <dd className="text-foreground">{formatVnd(order.shipFee)}</dd>
            </div>
          )}
          <div className="flex justify-between font-semibold">
            <dt className="text-foreground">Tổng</dt>
            <dd className="text-accent">{formatVnd(orderAmountDue(order))}</dd>
          </div>
        </dl>
      </div>

      {order.upgrades.length > 0 && (
        <div className="mt-6">
          <h2 className="font-heading text-xl tracking-wide text-foreground">NÂNG CẤP</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {order.upgrades.map((u) => (
              <li key={u.id} className="text-muted-foreground">
                <Link
                  href={`/orders/${u.id}`}
                  className="font-mono font-semibold text-accent underline-offset-2 hover:underline"
                >
                  #{u.orderCode}
                </Link>{" "}
                — {u.items.map((i) => `${i.comboType.name} × ${i.quantity}`).join(", ")} ·{" "}
                {PAYMENT_LABEL[u.paymentStatus]}
              </li>
            ))}
          </ul>
        </div>
      )}

      {order.shipProvince && (
        <div className="mt-6 text-sm">
          <h2 className="font-heading text-xl tracking-wide text-foreground">NHẬN HÀNG</h2>
          <p className="mt-2 text-foreground">
            {order.shipName} · {order.shipPhone}
          </p>
          <p className="text-muted-foreground">
            {[order.shipAddress, order.shipWard, order.shipDistrict, order.shipProvince]
              .filter(Boolean)
              .join(", ")}
          </p>
          {order.ghtkLabel && (
            <p className="mt-1 text-muted-foreground">
              GHTK: <span className="font-mono">{order.ghtkLabel}</span>
              {order.ghtkStatusText && ` · ${order.ghtkStatusText}`}
            </p>
          )}
        </div>
      )}

      {order.paymentStatus === "pending" && order.userId === session.user.id && (
        <Link href={`/orders/${order.id}/pay`} className={cn(buttonVariants(), "mt-6")}>
          Tiếp tục thanh toán
        </Link>
      )}
    </div>
  );
}
