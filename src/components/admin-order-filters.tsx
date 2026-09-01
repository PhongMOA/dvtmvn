"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-background [&>option]:text-foreground";

/**
 * Bộ lọc cho bảng "Tất cả đơn hàng" (/admin/orders): ô tìm kiếm + 3 dropdown
 * (trạng thái thanh toán / vận chuyển / check-in). Là <form method="get"> thuần
 * — thay đổi dropdown tự submit, submit sẽ nạp lại trang với query mới và bỏ
 * ?page (mỗi lần lọc quay về trang 1).
 */
export function AdminOrderFilters({
  q,
  payment,
  ship,
  checkin,
}: {
  q: string;
  payment: string;
  ship: string;
  checkin: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    const sp = new URLSearchParams();
    for (const key of ["q", "payment", "ship", "checkin"]) {
      const value = String(data.get(key) ?? "").trim();
      if (value) sp.set(key, value);
    }
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const hasFilter = Boolean(q || payment || ship || checkin);

  return (
    <form
      className="mt-6 flex flex-wrap items-center gap-2"
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        submit(e.currentTarget);
      }}
    >
      <Input
        name="q"
        defaultValue={q}
        placeholder="Tìm theo tên, email, SĐT, mã đơn, combo, sự kiện"
        className="max-w-xs"
      />
      <select
        name="payment"
        defaultValue={payment}
        className={selectClass}
        onChange={(e) => submit(e.currentTarget.form!)}
      >
        <option value="">Thanh toán: tất cả</option>
        <option value="paid">Đã thanh toán</option>
        <option value="pending">Chờ thanh toán</option>
        <option value="expired">Hết hạn</option>
      </select>
      <select
        name="ship"
        defaultValue={ship}
        className={selectClass}
        onChange={(e) => submit(e.currentTarget.form!)}
      >
        <option value="">Vận chuyển: tất cả</option>
        <option value="none">Chưa tạo đơn</option>
        <option value="processing">Đang xử lý</option>
        <option value="delivering">Đang giao</option>
        <option value="delivered">Đã giao</option>
        <option value="cancelled">Đã huỷ</option>
        <option value="returned">Trả hàng / sự cố</option>
      </select>
      <select
        name="checkin"
        defaultValue={checkin}
        className={selectClass}
        onChange={(e) => submit(e.currentTarget.form!)}
      >
        <option value="">Check-in: tất cả</option>
        <option value="in">Đã check-in</option>
        <option value="out">Chưa check-in</option>
      </select>
      <Button type="submit" variant="outline" size="sm">
        Lọc
      </Button>
      {hasFilter && (
        <Link
          href={pathname}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Xoá lọc
        </Link>
      )}
    </form>
  );
}
