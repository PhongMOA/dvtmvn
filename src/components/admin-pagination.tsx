import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Phân trang cho bảng quản trị (server-side, điều hướng bằng ?page= trong URL).
 * `query` là các tham số cần giữ lại khi đổi trang (vd { q }); `page` do component
 * này tự quản. Ẩn hẳn khi chỉ có 1 trang.
 */
export function AdminPagination({
  page,
  pageSize,
  total,
  query,
  pathname,
}: {
  page: number;
  pageSize: number;
  total: number;
  query: Record<string, string | undefined>;
  pathname: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const hrefFor = (target: number) => {
    const sp = new URLSearchParams();
    for (const [key, val] of Object.entries(query)) {
      if (val) sp.set(key, val);
    }
    if (target > 1) sp.set("page", String(target));
    const qs = sp.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <span className="tabular-nums">
        {from}–{to} / {total}
      </span>
      <div className="flex items-center gap-2">
        <PageLink href={hrefFor(page - 1)} disabled={page <= 1}>
          Trước
        </PageLink>
        <span className="tabular-nums">
          Trang {page}/{totalPages}
        </span>
        <PageLink href={hrefFor(page + 1)} disabled={page >= totalPages}>
          Sau
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <Button variant="outline" size="sm" disabled>
        {children}
      </Button>
    );
  }
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
    >
      {children}
    </Link>
  );
}
