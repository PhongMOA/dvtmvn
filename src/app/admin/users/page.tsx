import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/auth-helpers";
import { AdminDeleteUserButton } from "@/components/admin-delete-user-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default async function AdminUsersPage({
  searchParams,
}: PageProps<"/admin/users">) {
  const params = await searchParams;
  const qRaw = params?.q;
  const q = (typeof qRaw === "string" ? qRaw : "").trim();

  const where: Prisma.UserWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { orders: true, deviceTokens: true } },
        orders: {
          where: { paymentStatus: "paid" },
          select: { quantity: true },
        },
      },
    }),
    prisma.user.count(),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl tracking-wide text-primary">
          NGƯỜI DÙNG
        </h1>
        <p className="text-sm text-muted-foreground">
          {q ? `${users.length} kết quả / ` : ""}
          {total} tài khoản đã đăng nhập
        </p>
      </div>

      <form className="mt-6 flex gap-2" method="get">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Tìm theo tên, email hoặc số điện thoại"
          className="max-w-sm"
        />
        <Button type="submit" variant="outline" size="sm">
          Tìm
        </Button>
        {q && (
          <Link
            href="/admin/users"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Xoá lọc
          </Link>
        )}
      </form>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Người dùng</TableHead>
              <TableHead>Liên hệ</TableHead>
              <TableHead>Địa chỉ</TableHead>
              <TableHead className="text-right">Đơn (đã TT)</TableHead>
              <TableHead className="text-right">Thiết bị</TableHead>
              <TableHead>Đăng ký</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const paidQuantity = user.orders.reduce(
                (sum, order) => sum + order.quantity,
                0,
              );
              const admin = isAdminEmail(user.email);
              const displayName = user.name ?? user.email;

              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="flex items-center gap-2 font-medium">
                        {user.name ?? "—"}
                        {admin && (
                          <Badge variant="outline" className="border-accent text-accent">
                            Admin
                          </Badge>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.phone ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[220px] text-sm text-muted-foreground">
                    {user.address ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {user._count.orders}
                    <span className="text-muted-foreground">
                      {" "}
                      ({paidQuantity})
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {user._count.deviceTokens}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {admin || user._count.orders > 0 ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : (
                      <AdminDeleteUserButton
                        userId={user.id}
                        label={displayName}
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {users.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {q ? "Không tìm thấy tài khoản phù hợp." : "Chưa có người dùng nào."}
          </p>
        )}
      </div>
    </div>
  );
}
