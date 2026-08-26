import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { checkInOrder } from "@/app/actions/admin-orders";
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

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export default async function EventOrdersPage({
  params,
}: PageProps<"/admin/events/[id]/orders">) {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) notFound();

  const orders = await prisma.order.findMany({
    where: { comboType: { eventId: id } },
    include: { user: true, comboType: true },
    orderBy: { createdAt: "asc" },
  });

  const totalSold = orders.reduce((sum, order) => sum + order.quantity, 0);

  return (
    <div>
      <h1 className="font-heading text-3xl tracking-wide text-primary">
        ĐƠN HÀNG — {event.title.toUpperCase()}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Đã bán {totalSold} combo</p>

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
            Chưa có đơn hàng nào cho sự kiện này.
          </p>
        )}
      </div>
    </div>
  );
}
