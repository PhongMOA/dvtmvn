import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Khung tìm kiếm dùng chung cho các bảng quản trị. Là <form method="get"> thuần
 * — submit sẽ nạp lại trang với ?q=... và bỏ mọi query khác (đáng chú ý là
 * ?page), tức mỗi lần tìm mới đều quay về trang 1.
 */
export function AdminSearchForm({
  pathname,
  value,
  placeholder,
}: {
  pathname: string;
  value: string;
  placeholder: string;
}) {
  return (
    <form className="mt-6 flex flex-wrap gap-2" method="get">
      <Input
        name="q"
        defaultValue={value}
        placeholder={placeholder}
        className="max-w-sm"
      />
      <Button type="submit" variant="outline" size="sm">
        Tìm
      </Button>
      {value && (
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
