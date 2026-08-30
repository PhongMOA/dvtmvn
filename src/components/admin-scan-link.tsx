import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Link "Quét QR check-in" trong header khu vực admin. Trước đây chỉ hiện trong
 * app Android (camera native); nay web cũng quét được (getUserMedia + @zxing,
 * xem src/app/admin/scan/page.tsx) nên hiện ở mọi nơi.
 */
export function AdminScanLink() {
  return (
    <Link
      href="/admin/scan"
      className={cn(
        buttonVariants({ size: "sm", variant: "outline" }),
        "shrink-0 whitespace-nowrap",
      )}
    >
      Quét QR check-in
    </Link>
  );
}
