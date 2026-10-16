import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { checkInOrder, retryGhtkOrder } from "@/app/actions/admin-orders";
import { AdminCancelShipment } from "@/components/admin-cancel-shipment";
import { AdminDeleteOrderButton } from "@/components/admin-delete-order-button";
import { AdminOrderFilters } from "@/components/admin-order-filters";
import { AdminPagination } from "@/components/admin-pagination";
import { AdminSheetExport } from "@/components/admin-sheet-export";
import { OrdersDailyChart } from "@/components/orders-daily-chart";
import { UpgradeLinks } from "@/components/upgrade-links";
import {
  type OrderFilters,
  buildOrdersWhere,
  getOrdersOverview,
  hasOrderFilter,
} from "@/lib/admin-orders-data";
import { ghtkStatusColorClass } from "@/lib/ghtk";
import { formatShirtSizes } from "@/lib/shirt-sizes";
import { orderItemsQuantity } from "@/lib/order-items";
import { cn } from "@/lib/utils";
import { VN_TIME_ZONE } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 20;

/** Cột dính mép trái khi bảng cuộn ngang; nền đặc để che nội dung chạy bên dưới. */
const stickyLeft =
  "sticky left-0 bg-background shadow-[inset_-1px_0_0_var(--border)] group-hover:bg-muted";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: VN_TIME_ZONE,
  }).format(date);
}

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
      <span className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className={cn(
          "font-heading text-xl tabular-nums",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

/**
 * Nội dung trang quản lý đơn dùng chung cho /admin/orders và
 * /admin/events/[id]/orders: thẻ thống kê, biểu đồ theo ngày, bộ lọc, bảng đơn
 * và phân trang. `eventId` giới hạn mọi số liệu/bảng về một sự kiện.
 */
export async function AdminOrdersView({
  title,
  eventId,
  filters,
  pageRaw,
  pathname,
}: {
  title: React.ReactNode;
  eventId?: string;
  filters: OrderFilters;
  pageRaw: number;
  pathname: string;
}) {
  const where = buildOrdersWhere(filters, eventId);
  const filtered = hasOrderFilter(filters);

  const [{ stats, chartData }, matchCount] = await Promise.all([
    getOrdersOverview(eventId),
    prisma.order.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(matchCount / PAGE_SIZE));
  const page = Math.min(
    Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1),
    totalPages,
  );

  const orders = await prisma.order.findMany({
    where,
    include: {
      user: true,
      items: { include: { comboType: { include: { event: true } } } },
      upgradeFromOrder: { select: { id: true, orderCode: true } },
      upgrades: {
        where: { paymentStatus: "paid" },
        select: { id: true, orderCode: true },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  // Link xuất CSV giữ nguyên phạm vi sự kiện + bộ lọc đang chọn.
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const exportQuery = new URLSearchParams();
  if (eventId) exportQuery.set("event", eventId);
  for (const [key, value] of Object.entries(filters)) {
    if (value) exportQuery.set(key, value);
  }
  const exportToken = process.env.ORDERS_EXPORT_TOKEN;
  const sheetQuery = new URLSearchParams(exportQuery);
  if (exportToken) sheetQuery.set("token", exportToken);
  const downloadQuery = new URLSearchParams(exportQuery);
  downloadQuery.set("download", "1");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl tracking-wide text-primary">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {filtered ? `${matchCount} đơn khớp bộ lọc / ` : ""}
          {stats.totalOrders} đơn
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Doanh số đã thu"
          value={formatVnd(stats.revenue)}
          hint={`${stats.comboSold} combo · phí ship ${formatVnd(stats.shipCollected)}`}
          accent
        />
        <StatCard
          label="Đơn đã thanh toán"
          value={String(stats.paidCount)}
          hint={`${stats.pendingCount} chờ TT · ${stats.expiredCount} hết hạn`}
        />
        <StatCard
          label="Đã check-in"
          value={`${stats.checkedInCount}/${stats.paidCount}`}
          hint="trên số đơn đã thanh toán"
        />
        <StatCard
          label="Đơn ship chưa tạo"
          value={String(stats.ghtkMissingCount)}
          hint="đã TT nhưng chưa có mã GHTK"
        />
      </div>

      <OrdersDailyChart data={chartData} />

      <AdminOrderFilters
        {...filters}
        placeholder={
          eventId
            ? "Tìm theo tên, email, SĐT, mã đơn hoặc tên combo"
            : undefined
        }
      />

      <AdminSheetExport
        sheetUrl={
          exportToken ? `${origin}/api/admin/orders/export?${sheetQuery}` : null
        }
        downloadUrl={`/api/admin/orders/export?${downloadQuery}`}
      />

      {/* Bảng tự cuộn trong khung cao ~1 màn hình: thanh cuộn ngang luôn nằm
          trong tầm nhìn, header và cột "Mã đơn" dính khi cuộn. */}
      <div className="mt-6 overflow-hidden rounded-lg border border-border">
        <Table containerClassName="max-h-[calc(100dvh-8rem)] overflow-auto">
          <TableHeader className="sticky top-0 z-20 bg-background shadow-[0_1px_0_var(--border)]">
            <TableRow>
              <TableHead className={cn(stickyLeft, "z-30")}>Mã đơn</TableHead>
              <TableHead>Người đặt</TableHead>
              <TableHead>{eventId ? "Combo" : "Sự kiện / Combo"}</TableHead>
              <TableHead>SL</TableHead>
              <TableHead>Thời gian đặt</TableHead>
              <TableHead>Thanh toán</TableHead>
              <TableHead>Vận chuyển</TableHead>
              <TableHead>Check-in</TableHead>
              <TableHead className="text-right">
                Hành động
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const events = [
                ...new Map(
                  order.items.map((item) => [
                    item.comboType.eventId,
                    item.comboType.event,
                  ]),
                ).values(),
              ].filter((event) => event.id !== eventId);

              return (
                <TableRow key={order.id} className="group">
                  <TableCell className={cn(stickyLeft, "z-10 font-mono text-xs")}>
                    <Link
                      href={`/orders/${order.id}`}
                      className="hover:text-accent hover:underline"
                    >
                      {order.orderCode}
                    </Link>
                    <UpgradeLinks order={order} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {order.user.name ?? order.user.email}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {order.user.phone ?? order.user.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-56 max-w-sm whitespace-normal">
                    <div className="flex flex-col">
                      {events.map((event) => (
                        <Link
                          key={event.id}
                          href={`/admin/events/${event.id}/orders`}
                          className="text-sm font-medium text-foreground hover:text-accent hover:underline"
                        >
                          {event.title}
                        </Link>
                      ))}
                      {order.items.map((item) => (
                        <span
                          key={item.id}
                          className={cn(
                            events.length > 0 && "text-xs text-muted-foreground",
                          )}
                        >
                          {item.comboType.name} × {item.quantity}
                          {item.upgradedQuantity > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {" "}({item.upgradedQuantity} đã nâng cấp)
                            </span>
                          )}
                        </span>
                      ))}
                      {order.items.map((item) => {
                        // Chỉ hiện tên combo × SL cho gọn (không liệt kê thành phần
                        // combo); size áo là thông tin riêng của đơn nên vẫn giữ.
                        const sizes = formatShirtSizes(item.shirtSizes);
                        if (!sizes) return null;
                        return (
                          <span
                            key={`size-${item.id}`}
                            className="mt-0.5 text-xs font-medium"
                          >
                            {order.items.length > 1 && `${item.comboType.name}: `}
                            Size áo: {sizes}
                          </span>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {orderItemsQuantity(order.items)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(order.createdAt)}
                  </TableCell>
                  <TableCell>
                    {order.paymentStatus === "paid" && (
                      <Badge variant="default">Đã thanh toán</Badge>
                    )}
                    {order.paymentStatus === "pending" && (
                      <Badge variant="outline">Chờ thanh toán</Badge>
                    )}
                    {order.paymentStatus === "expired" && (
                      <Badge variant="outline" className="text-muted-foreground">
                        Hết hạn
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {order.paymentStatus !== "paid" ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : order.ghtkLabel ? (
                      <div className="flex flex-col items-start gap-1.5 text-sm">
                        <span className="font-mono font-medium text-foreground">
                          {order.ghtkLabel}
                        </span>
                        <span
                          className={cn(
                            "text-xs font-medium",
                            ghtkStatusColorClass(order.ghtkStatus),
                          )}
                        >
                          {order.ghtkStatusText ?? "Đã tạo đơn"}
                        </span>
                        {order.ghtkStatus !== "-1" && (
                          <AdminCancelShipment orderId={order.id} />
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-start gap-1.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            order.ghtkError &&
                              "border-destructive/40 text-destructive",
                          )}
                          title={order.ghtkError ?? undefined}
                        >
                          {order.ghtkError ? "Lỗi tạo đơn" : "Chưa tạo đơn"}
                        </Badge>
                        <form action={retryGhtkOrder.bind(null, order.id)}>
                          <Button type="submit" size="sm" variant="outline">
                            Tạo đơn ship
                          </Button>
                        </form>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        order.status === "checked_in" ? "default" : "outline"
                      }
                    >
                      {order.status === "checked_in"
                        ? "Đã check-in"
                        : "Chưa check-in"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {order.paymentStatus === "paid" &&
                    order.status === "booked" ? (
                      <form action={checkInOrder.bind(null, order.id)}>
                        <Button type="submit" size="sm">
                          Đánh dấu check-in
                        </Button>
                      </form>
                    ) : order.paymentStatus === "expired" ? (
                      <AdminDeleteOrderButton
                        orderId={order.id}
                        orderCode={order.orderCode}
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {orders.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {filtered
              ? "Không có đơn hàng nào khớp bộ lọc."
              : eventId
                ? "Chưa có đơn hàng nào cho sự kiện này."
                : "Chưa có đơn hàng nào."}
          </p>
        )}
      </div>

      <AdminPagination
        page={page}
        pageSize={PAGE_SIZE}
        total={matchCount}
        query={{
          q: filters.q || undefined,
          payment: filters.payment || undefined,
          ship: filters.ship || undefined,
          checkin: filters.checkin || undefined,
        }}
        pathname={pathname}
      />
    </div>
  );
}
