import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { orderItemsQuantity } from "@/lib/order-items";
import { isAdminEmail } from "@/lib/auth-helpers";
import { AdminDeleteUserButton } from "@/components/admin-delete-user-button";
import { AdminSetTesterButton } from "@/components/admin-set-tester-button";
import { AdminSetAdminButton } from "@/components/admin-set-admin-button";
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
import { VN_TIME_ZONE } from "@/lib/datetime";

// facebookUrl do user tự nhập — chỉ nhận http(s) để không render được link
// "javascript:..." vào trang admin.
function safeFacebookHref(url: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

// lucide-react bản mới đã bỏ icon thương hiệu nên vẽ logo Facebook bằng SVG.
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07" />
    </svg>
  );
}

const PAGE_SIZE = 20;

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: VN_TIME_ZONE,
  }).format(date);
}

export default async function AdminUsersPage({
  searchParams,
}: PageProps<"/admin/users">) {
  const params = await searchParams;
  const session = await auth();
  const currentUserId = session?.user?.id;
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
        select: { items: { select: { quantity: true } } },
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
                (sum, order) => sum + orderItemsQuantity(order.items),
                0,
              );
              const envAdmin = isAdminEmail(user.email);
              const admin = envAdmin || user.role === "admin";
              const isSelf = user.id === currentUserId;
              const displayName = user.name ?? user.email;
              const facebookHref = safeFacebookHref(user.facebookUrl);
              const canToggleAdmin = !envAdmin && !isSelf;
              const tester = !admin && user.role === "tester";
              const canToggleTester = !admin;
              const canDelete = !admin && user._count.orders === 0;

              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="flex items-center gap-2 font-medium">
                        {user.name ?? "—"}
                        {facebookHref && (
                          <a
                            href={facebookHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Mở Facebook"
                            aria-label={`Facebook của ${displayName}`}
                            className="text-[#1877F2] transition-opacity hover:opacity-80"
                          >
                            <FacebookIcon className="size-4" />
                          </a>
                        )}
                        {admin && (
                          <Badge variant="outline" className="border-accent text-accent">
                            Admin
                          </Badge>
                        )}
                        {tester && (
                          <Badge variant="outline" className="border-primary text-primary">
                            Tester
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
                  <TableCell className="min-w-[200px] max-w-[280px] text-sm whitespace-normal break-words text-muted-foreground">
                    {[user.address, user.ward, user.district, user.province]
                      .filter(Boolean)
                      .join(", ") || "—"}
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
                    {canToggleAdmin || canToggleTester || canDelete ? (
                      <div className="flex justify-end gap-2">
                        {canToggleTester && (
                          <AdminSetTesterButton
                            userId={user.id}
                            label={displayName}
                            isTester={tester}
                          />
                        )}
                        {canToggleAdmin && (
                          <AdminSetAdminButton
                            userId={user.id}
                            label={displayName}
                            isAdmin={user.role === "admin"}
                          />
                        )}
                        {canDelete && (
                          <AdminDeleteUserButton
                            userId={user.id}
                            label={displayName}
                          />
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
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
