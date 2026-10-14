// Truy vấn dùng chung cho 2 trang quản lý đơn: /admin/orders (toàn bộ) và
// /admin/events/[id]/orders (theo sự kiện). Truyền `eventId` để giới hạn phạm vi
// về các đơn có combo thuộc sự kiện đó; bỏ trống = mọi đơn.

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { GHTK_STATUS_GROUPS, type GhtkStatusGroup } from "@/lib/ghtk";
import { orderAmountDue, orderItemsQuantity, orderItemsTotal } from "@/lib/order-items";
import { VN_TIME_ZONE } from "@/lib/datetime";
import type { OrdersDailyPoint } from "@/components/orders-daily-chart";

const CHART_DAYS = 60;

export type OrderFilters = {
  q: string;
  payment: string;
  ship: string;
  checkin: string;
};

type SearchParams = Record<string, string | string[] | undefined> | undefined;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value ?? "").trim();
}

export function parseOrderFilters(sp: SearchParams): OrderFilters {
  return {
    q: first(sp?.q),
    payment: first(sp?.payment),
    ship: first(sp?.ship),
    checkin: first(sp?.checkin),
  };
}

export function parsePage(sp: SearchParams): number {
  return Number(first(sp?.page));
}

export function hasOrderFilter(f: OrderFilters): boolean {
  return Boolean(f.q || f.payment || f.ship || f.checkin);
}

/** Phạm vi gốc: mọi đơn, hoặc đơn có ít nhất 1 combo thuộc sự kiện. */
export function orderScope(eventId?: string): Prisma.OrderWhereInput {
  return eventId ? { items: { some: { comboType: { eventId } } } } : {};
}

/** Bộ lọc (tìm kiếm + 3 dropdown) -> Prisma where, đã gộp phạm vi sự kiện. */
export function buildOrdersWhere(
  f: OrderFilters,
  eventId?: string,
): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [];
  if (eventId) and.push(orderScope(eventId));

  if (f.q) {
    const q = f.q;
    and.push({
      OR: [
        { orderCode: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        { user: { phone: { contains: q, mode: "insensitive" } } },
        {
          items: {
            some: {
              OR: [
                { comboType: { name: { contains: q, mode: "insensitive" } } },
                {
                  comboType: {
                    event: { title: { contains: q, mode: "insensitive" } },
                  },
                },
              ],
            },
          },
        },
      ],
    });
  }

  if (f.payment === "paid" || f.payment === "pending" || f.payment === "expired") {
    and.push({ paymentStatus: f.payment });
  }

  if (f.checkin === "in") and.push({ paymentStatus: "paid", status: "checked_in" });
  if (f.checkin === "out") and.push({ status: "booked" });

  if (f.ship === "none") {
    and.push({ paymentStatus: "paid", ghtkLabel: null });
  } else if (f.ship && f.ship in GHTK_STATUS_GROUPS) {
    const ids = [...GHTK_STATUS_GROUPS[f.ship as GhtkStatusGroup]];
    if (f.ship === "processing") {
      and.push({
        ghtkLabel: { not: null },
        OR: [{ ghtkStatus: { in: ids } }, { ghtkStatus: null }],
      });
    } else {
      and.push({ ghtkStatus: { in: ids } });
    }
  }

  return and.length ? { AND: and } : {};
}

type RevenueOrder = {
  shipFee: number;
  discountAmount: number;
  items: { quantity: number; unitPrice: number; comboType: { eventId: string } }[];
};

/**
 * Doanh thu của đơn trong phạm vi. Không có eventId hoặc đơn chỉ gồm combo của
 * sự kiện này -> số tiền khách trả đủ (gồm ship, trừ giảm giá). Đơn gộp nhiều
 * sự kiện -> chỉ tính tiền combo của sự kiện này (ship/giảm giá thuộc cả đơn,
 * không chia được nên bỏ qua).
 */
function scopedRevenue(order: RevenueOrder, eventId?: string): number {
  if (!eventId) return orderAmountDue(order);
  const own = order.items.filter((i) => i.comboType.eventId === eventId);
  if (own.length === order.items.length) return orderAmountDue(order);
  return orderItemsTotal(own);
}

function scopedQuantity(order: RevenueOrder, eventId?: string): number {
  return orderItemsQuantity(
    eventId
      ? order.items.filter((i) => i.comboType.eventId === eventId)
      : order.items,
  );
}

/** Khoá ngày "YYYY-MM-DD" theo giờ Việt Nam (đơn lưu UTC). */
const vnDayKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: VN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const revenueSelect = {
  shipFee: true,
  discountAmount: true,
  items: {
    select: {
      quantity: true,
      unitPrice: true,
      comboType: { select: { eventId: true } },
    },
  },
} satisfies Prisma.OrderSelect;

export type OrdersStats = {
  totalOrders: number;
  paidCount: number;
  pendingCount: number;
  expiredCount: number;
  checkedInCount: number;
  ghtkMissingCount: number;
  revenue: number;
  comboSold: number;
  shipCollected: number;
};

/**
 * Thẻ thống kê + dữ liệu biểu đồ 60 ngày (giờ VN) trong phạm vi — không phụ
 * thuộc bộ lọc. Component biểu đồ tự cắt 14/30/60 ngày.
 */
export async function getOrdersOverview(eventId?: string): Promise<{
  stats: OrdersStats;
  chartData: OrdersDailyPoint[];
}> {
  const scope = orderScope(eventId);
  const paidScope: Prisma.OrderWhereInput = { ...scope, paymentStatus: "paid" };

  const todayKey = vnDayKey(new Date());
  const anchor = new Date(`${todayKey}T00:00:00Z`);
  const chartDays: string[] = [];
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    const d = new Date(anchor);
    d.setUTCDate(d.getUTCDate() - i);
    chartDays.push(d.toISOString().slice(0, 10));
  }
  const chartSince = new Date(`${chartDays[0]}T00:00:00+07:00`);

  const [
    totalOrders,
    paidCount,
    pendingCount,
    expiredCount,
    checkedInCount,
    ghtkMissingCount,
    paidOrders,
    createdRows,
  ] = await Promise.all([
    prisma.order.count({ where: scope }),
    prisma.order.count({ where: paidScope }),
    prisma.order.count({ where: { ...scope, paymentStatus: "pending" } }),
    prisma.order.count({ where: { ...scope, paymentStatus: "expired" } }),
    prisma.order.count({ where: { ...paidScope, status: "checked_in" } }),
    prisma.order.count({ where: { ...paidScope, ghtkLabel: null } }),
    prisma.order.findMany({
      where: paidScope,
      select: { ...revenueSelect, paidAt: true },
    }),
    prisma.order.findMany({
      where: { ...scope, createdAt: { gte: chartSince } },
      select: { createdAt: true },
    }),
  ]);

  let revenue = 0;
  let comboSold = 0;
  let shipCollected = 0;
  const byDay = new Map(chartDays.map((d) => [d, { orders: 0, revenue: 0 }]));

  for (const o of paidOrders) {
    const amount = scopedRevenue(o, eventId);
    revenue += amount;
    comboSold += scopedQuantity(o, eventId);
    if (!eventId || o.items.every((i) => i.comboType.eventId === eventId)) {
      shipCollected += o.shipFee;
    }
    if (o.paidAt && o.paidAt >= chartSince) {
      const bucket = byDay.get(vnDayKey(o.paidAt));
      if (bucket) bucket.revenue += amount;
    }
  }
  for (const r of createdRows) {
    const bucket = byDay.get(vnDayKey(r.createdAt));
    if (bucket) bucket.orders++;
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

  return {
    stats: {
      totalOrders,
      paidCount,
      pendingCount,
      expiredCount,
      checkedInCount,
      ghtkMissingCount,
      revenue,
      comboSold,
      shipCollected,
    },
    chartData,
  };
}
