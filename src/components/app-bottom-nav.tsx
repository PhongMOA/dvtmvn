"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ticket, UserRound } from "lucide-react";
import { useIsNativeApp } from "@/lib/is-native-app";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/my-tickets", label: "Vé của tôi", icon: Ticket },
  { href: "/profile", label: "Thông tin tài khoản", icon: UserRound },
] as const;

/**
 * Thanh điều hướng nhanh cố định dưới đáy màn hình, chỉ hiện khi:
 * - Chạy trong app Android (Capacitor) — web browser vẫn dùng menu avatar
 *   trên header như cũ (xem UserNav).
 * - User đã đăng nhập (`isLoggedIn` truyền từ RootLayout — server component
 *   gọi auth() sẵn, tránh phải tự fetch session ở client).
 *
 * Render kèm 1 div đệm cùng chiều cao ngay trước thanh fixed: vì <body> là
 * flex-col nên div đệm chiếm chỗ trong flow, thu hẹp phần không gian còn lại
 * của <main> (flex-1) đúng bằng chiều cao thanh — nội dung cuối trang không
 * bị thanh fixed che mà không cần sửa padding ở từng trang riêng lẻ.
 */
export function AppBottomNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  const isNative = useIsNativeApp();
  const pathname = usePathname();

  if (!isNative || !isLoggedIn) return null;

  return (
    <>
      <div className="h-14 shrink-0" aria-hidden />
      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-card/95 backdrop-blur-sm">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
