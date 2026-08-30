import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/auth-helpers";
import { AdminDeleteUserButton } from "@/components/admin-delete-user-button";
import { AdminSearchForm } from "@/components/admin-search-form";
import { AdminPagination } from "@/components/admin-pagination";
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
  const pageRaw = Number(Array.isArray(params?.page) ? params?.page[0] : params?.page);

  const where: Prisma.UserWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [grandTotal, matchCount] = await Promise.all([
    prisma.user.count(),
    q ? prisma.user.count({ where }) : prisma.user.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(matchCount / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1), totalPages);

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      _count: { select: { orders: true } },
      orders: {
        where: { paymentStatus: "paid" },
        select: { quantity: true },
      },
    },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl tracking-wide text-primary">
          NGƯỜI DÙNG
        </h1>
        <p className="text-sm text-muted-foreground">
          {q ? `${matchCount} kết quả / ` : ""}
          {grandTotal} tài khoản đã đăng nhập
        </p>
      </div>

      <AdminSearchForm
        pathname="/admin/users"
        value={q}
        placeholder="Tìm theo tên, email hoặc số điện thoại"
      />

      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Người dùng</TableHead>
              <TableHead>Liên hệ</TableHead>
              <TableHead>Địa chỉ</TableHead>
              <TableHead className="text-right">Đơn (đã TT)</TableHead>
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

      <AdminPagination
        page={page}
        pageSize={PAGE_SIZE}
        total={matchCount}
        query={{ q: q || undefined }}
        pathname="/admin/users"
      />
    </div>
  );
}
