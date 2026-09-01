import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { checkInOrder, retryGhtkOrder } from "@/app/actions/admin-orders";
import { AdminCancelShipment } from "@/components/admin-cancel-shipment";
import { AdminOrderFilters } from "@/components/admin-order-filters";
import { AdminPagination } from "@/components/admin-pagination";
import {
  OrdersDailyChart,
  type OrdersDailyPoint,
} from "@/components/orders-daily-chart";
import {
  GHTK_STATUS_GROUPS,
  type GhtkStatusGroup,
  ghtkStatusColorClass,
} from "@/lib/ghtk";
import { cn } from "@/lib/utils";
import { parseComboItems } from "@/lib/combo";
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
const CHART_DAYS = 14;

/** Khoá ngày "YYYY-MM-DD" theo giờ Việt Nam (đơn lưu UTC). */
const vnDayKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value ?? "").trim();
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

export default async function AdminAllOrdersPage({
  searchParams,
}: PageProps<"/admin/orders">) {
  const sp = await searchParams;
  const q = first(sp?.q);
  const payment = first(sp?.payment);
  const ship = first(sp?.ship);
  const checkin = first(sp?.checkin);
  const pageRaw = Number(first(sp?.page));

  // --- Bộ lọc -> Prisma where ---------------------------------------------------
  const and: Prisma.OrderWhereInput[] = [];

  if (q) {
    and.push({
      OR: [
        { orderCode: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        { user: { phone: { contains: q, mode: "insensitive" } } },
        { comboType: { name: { contains: q, mode: "insensitive" } } },
        { comboType: { event: { title: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }

  if (payment === "paid" || payment === "pending" || payment === "expired") {
    and.push({ paymentStatus: payment });
  }

  if (checkin === "in") and.push({ paymentStatus: "paid", status: "checked_in" });
  if (checkin === "out") and.push({ status: "booked" });

  if (ship === "none") {
    and.push({ paymentStatus: "paid", ghtkLabel: null });
  } else if (ship && ship in GHTK_STATUS_GROUPS) {
    const ids = [...GHTK_STATUS_GROUPS[ship as GhtkStatusGroup]];
    if (ship === "processing") {
      and.push({
        ghtkLabel: { not: null },
        OR: [{ ghtkStatus: { in: ids } }, { ghtkStatus: null }],
      });
    } else {
      and.push({ ghtkStatus: { in: ids } });
    }
  }

  const where: Prisma.OrderWhereInput = and.length ? { AND: and } : {};

  // --- Thống kê (toàn bộ đơn, không phụ thuộc bộ lọc) --------------------------
  const [
    totalOrders,
    paidCount,
    pendingCount,
    expiredCount,
    checkedInCount,
    ghtkMissingCount,
    paidOrders,
    matchCount,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { paymentStatus: "paid" } }),
    prisma.order.count({ where: { paymentStatus: "pending" } }),
    prisma.order.count({ where: { paymentStatus: "expired" } }),
    prisma.order.count({
      where: { paymentStatus: "paid", status: "checked_in" },
    }),
    prisma.order.count({ where: { paymentStatus: "paid", ghtkLabel: null } }),
    prisma.order.findMany({
      where: { paymentStatus: "paid" },
      select: {
        quantity: true,
        shipFee: true,
        comboType: { select: { price: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  const revenue = paidOrders.reduce(
    (sum, o) => sum + o.comboType.price * o.quantity + o.shipFee,
    0,
  );
  const comboSold = paidOrders.reduce((sum, o) => sum + o.quantity, 0);
  const shipCollected = paidOrders.reduce((sum, o) => sum + o.shipFee, 0);

  // --- Dữ liệu biểu đồ: 14 ngày gần nhất (giờ VN) -----------------------------
  const todayKey = vnDayKey(new Date());
  const anchor = new Date(`${todayKey}T00:00:00Z`);
  const chartDays: string[] = [];
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    const d = new Date(anchor);
    d.setUTCDate(d.getUTCDate() - i);
    chartDays.push(d.toISOString().slice(0, 10));
  }
  const chartSince = new Date(`${chartDays[0]}T00:00:00+07:00`);

  const [createdRows, paidRows] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: chartSince } },
      select: { createdAt: true },
    }),
    prisma.order.findMany({
      where: { paymentStatus: "paid", paidAt: { gte: chartSince } },
      select: {
        paidAt: true,
        quantity: true,
        shipFee: true,
        comboType: { select: { price: true } },
      },
    }),
  ]);

  const byDay = new Map(
    chartDays.map((d) => [d, { orders: 0, revenue: 0 }]),
  );
  for (const r of createdRows) {
    const bucket = byDay.get(vnDayKey(r.createdAt));
    if (bucket) bucket.orders++;
  }
  for (const r of paidRows) {
    if (!r.paidAt) continue;
    const bucket = byDay.get(vnDayKey(r.paidAt));
    if (bucket) bucket.revenue += r.comboType.price * r.quantity + r.shipFee;
  }

  const chartData: OrdersDailyPoint[] = chartDays.map((d) => {
    const [y, m, day] = d.split("-");
    const bucket = byDay.get(d)!;
    return {
      day: d,
      label: `${day}/${m}/${y}`,
      shortLabel: `${day}/${m}`,
      orders: bucket.orders,
      revenue: bucket.revenue,
    };
  });

  const totalPages = Math.max(1, Math.ceil(matchCount / PAGE_SIZE));
  const page = Math.min(
    Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1),
    totalPages,
  );

  const orders = await prisma.order.findMany({
    where,
    include: { user: true, comboType: { include: { event: true } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const paginationQuery = {
    q: q || undefined,
    payment: payment || undefined,
    ship: ship || undefined,
    checkin: checkin || undefined,
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl tracking-wide text-primary">
          TẤT CẢ ĐƠN HÀNG
        </h1>
        <p className="text-sm text-muted-foreground">
          {q || payment || ship || checkin
            ? `${matchCount} đơn khớp bộ lọc / `
            : ""}
          {totalOrders} đơn
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Doanh số đã thu"
          value={formatVnd(revenue)}
          hint={`${comboSold} combo · phí ship ${formatVnd(shipCollected)}`}
          accent
        />
        <StatCard
          label="Đơn đã thanh toán"
          value={String(paidCount)}
          hint={`${pendingCount} chờ TT · ${expiredCount} hết hạn`}
        />
        <StatCard
          label="Đã check-in"
          value={`${checkedInCount}/${paidCount}`}
          hint="trên số đơn đã thanh toán"
        />
        <StatCard
          label="Đơn ship chưa tạo"
          value={String(ghtkMissingCount)}
          hint="đã TT nhưng chưa có mã GHTK"
        />
      </div>

      <OrdersDailyChart data={chartData} />

      <AdminOrderFilters q={q} payment={payment} ship={ship} checkin={checkin} />

      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã đơn</TableHead>
              <TableHead>Người đặt</TableHead>
              <TableHead>Sự kiện / Combo</TableHead>
              <TableHead>SL</TableHead>
              <TableHead>Thời gian đặt</TableHead>
              <TableHead>Thanh toán</TableHead>
              <TableHead>Vận chuyển</TableHead>
              <TableHead>Check-in</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-xs">
                  {order.orderCode}
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
                <TableCell>
                  <div className="flex flex-col">
                    <Link
                      href={`/admin/events/${order.comboType.eventId}/orders`}
                      className="text-sm font-medium text-foreground hover:text-accent hover:underline"
                    >
                      {order.comboType.event.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {[
                        order.comboType.name,
                        ...(order.comboType.includesTicket
                          ? ["Vé offline"]
                          : []),
                        ...parseComboItems(order.comboType.items),
                      ].join(" · ")}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="tabular-nums">{order.quantity}</TableCell>
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
                        className="border-destructive/40 text-destructive"
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
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {orders.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {q || payment || ship || checkin
              ? "Không có đơn hàng nào khớp bộ lọc."
              : "Chưa có đơn hàng nào."}
          </p>
        )}
      </div>

      <AdminPagination
        page={page}
        pageSize={PAGE_SIZE}
        total={matchCount}
        query={paginationQuery}
        pathname="/admin/orders"
      />
    </div>
  );
}
