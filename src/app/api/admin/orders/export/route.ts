import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth-helpers";
import { buildOrdersWhere } from "@/lib/admin-orders-data";
import { formatShirtSizes } from "@/lib/shirt-sizes";
import { orderItemsQuantity } from "@/lib/order-items";
import { VN_TIME_ZONE } from "@/lib/datetime";

// Xuất danh sách đơn ra CSV cho Google Sheets. 2 cách truy cập:
//  - Admin đang đăng nhập (nút "Tải CSV" trên trang đơn hàng, ?download=1).
//  - ?token=ORDERS_EXPORT_TOKEN — để Google Sheets tự kéo dữ liệu bằng
//    =IMPORTDATA("<url>") (Google fetch không có cookie đăng nhập). Ai có link
//    là xem được dữ liệu khách -> lộ link thì đổi token trong .env.
// Nhận cùng query lọc với trang admin: event, q, payment, ship, checkin.

function isValidToken(token: string | null): boolean {
  const secret = process.env.ORDERS_EXPORT_TOKEN;
  if (!secret || !token) return false; // chưa cấu hình -> chỉ admin đăng nhập
  // So sánh băm cố định độ dài để dùng được timingSafeEqual.
  const a = createHash("sha256").update(token).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

/** Bọc ô CSV; chặn công thức (= / @) để tên khách không chạy được trong Sheets. */
function csvCell(value: string | number): string {
  let s = String(value);
  if (/^[=@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: VN_TIME_ZONE,
  }).format(date);
}

const PAYMENT_LABEL: Record<string, string> = {
  paid: "Đã thanh toán",
  pending: "Chờ thanh toán",
  expired: "Hết hạn",
};

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  if (!isValidToken(sp.get("token"))) {
    const session = await auth();
    if (!(await isAdmin(session?.user))) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const get = (key: string) => (sp.get(key) ?? "").trim();
  const eventId = get("event") || undefined;
  const where = buildOrdersWhere(
    {
      q: get("q"),
      payment: get("payment"),
      ship: get("ship"),
      checkin: get("checkin"),
    },
    eventId,
  );

  const orders = await prisma.order.findMany({
    where,
    include: {
      user: { select: { name: true, email: true, phone: true } },
      items: {
        select: {
          quantity: true,
          shirtSizes: true,
          comboType: {
            select: { name: true, event: { select: { id: true, title: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const header = [
    "Mã đơn",
    "Người đặt",
    "Email",
    "SĐT",
    "Sự kiện",
    "Combo",
    "SL",
    "Thời gian đặt",
    "Thanh toán",
    "Vận chuyển",
    "Check-in",
  ];

  const rows = orders.map((order) => {
    const events = [
      ...new Map(
        order.items.map((i) => [i.comboType.event.id, i.comboType.event.title]),
      ).values(),
    ];
    const combos = order.items.map((i) => {
      const sizes = formatShirtSizes(i.shirtSizes);
      return `${i.comboType.name} × ${i.quantity}${sizes ? ` (Size áo: ${sizes})` : ""}`;
    });
    const ship =
      order.paymentStatus !== "paid"
        ? ""
        : order.ghtkLabel
          ? `${order.ghtkLabel} - ${order.ghtkStatusText ?? "Đã tạo đơn"}`
          : order.ghtkError
            ? "Lỗi tạo đơn"
            : "Chưa tạo đơn";

    return [
      order.orderCode,
      order.user.name ?? "",
      order.user.email ?? "",
      order.user.phone ?? "",
      events.join("; "),
      combos.join("; "),
      orderItemsQuantity(order.items),
      formatDateTime(order.createdAt),
      PAYMENT_LABEL[order.paymentStatus] ?? order.paymentStatus,
      ship,
      order.status === "checked_in" ? "Đã check-in" : "Chưa check-in",
    ];
  });

  const csv = [header, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");

  const download = sp.get("download") === "1";
  const filename = `don-hang-${new Date().toISOString().slice(0, 10)}.csv`;

  // BOM chỉ cho file tải về (Excel cần để đọc đúng UTF-8); IMPORTDATA thì
  // không cần, thêm vào sẽ dính ký tự lạ ở ô đầu tiên.
  return new Response(download ? `﻿${csv}` : csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      ...(download
        ? { "Content-Disposition": `attachment; filename="${filename}"` }
        : {}),
    },
  });
}
