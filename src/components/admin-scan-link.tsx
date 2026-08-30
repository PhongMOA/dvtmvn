"use client";

import Link from "next/link";
import { useIsNativeApp } from "@/lib/is-native-app";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Link "Quét QR check-in" trong header khu vực admin — chỉ hiện khi chạy
 * trong app Android (Capacitor), vì camera scan không dùng được trên browser
 * thường. Ẩn hẳn (không chỉ disable) để admin không bấm nhầm trên web rồi
 * thấy trang báo lỗi không cần thiết.
 */
export function AdminScanLink() {
  const isNative = useIsNativeApp();
  if (!isNative) return null;

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
