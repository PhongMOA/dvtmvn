import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { checkInOrder, retryGhtkOrder } from "@/app/actions/admin-orders";
import { AdminCancelShipment } from "@/components/admin-cancel-shipment";
import { parseComboItems } from "@/lib/combo";
import { AdminSearchForm } from "@/components/admin-search-form";
import { AdminPagination } from "@/components/admin-pagination";
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

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export default async function EventOrdersPage({
  params,
  searchParams,
}: PageProps<"/admin/events/[id]/orders">) {
  const { id } = await params;
  const sp = await searchParams;
  const qRaw = sp?.q;
  const q = (typeof qRaw === "string" ? qRaw : "").trim();
  const pageRaw = Number(Array.isArray(sp?.page) ? sp?.page[0] : sp?.page);

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) notFound();

  const where: Prisma.OrderWhereInput = {
    comboType: { eventId: id },
    ...(q
      ? {
          OR: [
            { orderCode: { contains: q, mode: "insensitive" } },
            { user: { name: { contains: q, mode: "insensitive" } } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { user: { phone: { contains: q, mode: "insensitive" } } },
            { comboType: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [matchCount, soldAgg] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.aggregate({
      _sum: { quantity: true },
      where: { comboType: { eventId: id } },
    }),
  ]);
  const totalSold = soldAgg._sum.quantity ?? 0;

  const totalPages = Math.max(1, Math.ceil(matchCount / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1), totalPages);

  const orders = await prisma.order.findMany({
    where,
    include: { user: true, comboType: true },
    orderBy: { createdAt: "asc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return (
    <div>
      <h1 className="font-heading text-3xl tracking-wide text-primary">
        ĐƠN HÀNG — {event.title.toUpperCase()}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Đã bán {totalSold} combo
        {q ? ` — ${matchCount} đơn khớp tìm kiếm` : ""}
      </p>

      <AdminSearchForm
        pathname={`/admin/events/${id}/orders`}
        value={q}
        placeholder="Tìm theo tên, email, SĐT, mã đơn hoặc tên combo"
      />

      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Người đặt</TableHead>
              <TableHead>Combo</TableHead>
              <TableHead>Items kèm theo</TableHead>
              <TableHead>Số lượng</TableHead>
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
                <TableCell className="font-medium">
                  {order.user.name ?? order.user.email}
                </TableCell>
                <TableCell>{order.comboType.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {[
                    ...(order.comboType.includesTicket ? ["Vé tham gia offline"] : []),
                    ...parseComboItems(order.comboType.items),
                  ].join(", ") || "—"}
                </TableCell>
                <TableCell>{order.quantity}</TableCell>
                <TableCell>{formatDateTime(order.createdAt)}</TableCell>
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
                      <span className="text-xs text-muted-foreground">
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
                  <Badge variant={order.status === "checked_in" ? "default" : "outline"}>
                    {order.status === "checked_in" ? "Đã check-in" : "Chưa check-in"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {order.paymentStatus === "paid" && order.status === "booked" ? (
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
            {q
              ? "Không tìm thấy đơn hàng phù hợp."
              : "Chưa có đơn hàng nào cho sự kiện này."}
          </p>
        )}
      </div>

      <AdminPagination
        page={page}
        pageSize={PAGE_SIZE}
        total={matchCount}
        query={{ q: q || undefined }}
        pathname={`/admin/events/${id}/orders`}
      />
    </div>
  );
}
