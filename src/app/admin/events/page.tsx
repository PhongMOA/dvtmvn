import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { openEvent, closeEvent } from "@/app/actions/admin-events";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  open: "Đang mở bán",
  closed: "Đã đóng",
};

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export default async function AdminEventsPage() {
  const events = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { comboTypes: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl tracking-wide text-primary">
          SỰ KIỆN
        </h1>
        <div className="flex gap-2">
          <Link
            href="/admin/users"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            Người dùng
          </Link>
          <Link href="/admin/events/new" className={cn(buttonVariants({ size: "sm" }))}>
            Tạo sự kiện mới
          </Link>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên sự kiện</TableHead>
              <TableHead>Suất chiếu</TableHead>
              <TableHead>Combo</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="font-medium">{event.title}</TableCell>
                <TableCell>{formatDateTime(event.startAt)}</TableCell>
                <TableCell>{event._count.comboTypes}</TableCell>
                <TableCell>
                  <Badge variant={event.status === "open" ? "default" : "outline"}>
                    {STATUS_LABEL[event.status] ?? event.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/admin/events/${event.id}/edit`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      Sửa
                    </Link>
                    <Link
                      href={`/admin/events/${event.id}/combos`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      Combo
                    </Link>
                    <Link
                      href={`/admin/events/${event.id}/orders`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      Đơn hàng
                    </Link>
                    {event.status === "open" ? (
                      <form action={closeEvent.bind(null, event.id)}>
                        <Button type="submit" variant="secondary" size="sm">
                          Đóng bán
                        </Button>
                      </form>
                    ) : (
                      <form action={openEvent.bind(null, event.id)}>
                        <Button type="submit" size="sm">
                          Mở bán
                        </Button>
                      </form>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {events.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Chưa có sự kiện nào.
          </p>
        )}
      </div>
    </div>
  );
}
