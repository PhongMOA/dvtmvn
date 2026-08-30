"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ticket, UserRound, QrCode, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

const USER_LINKS = [
  { href: "/my-tickets", label: "Vé của tôi", icon: Ticket },
  { href: "/profile", label: "Thông tin tài khoản", icon: UserRound },
] as const;

// Admin không cần "Vé của tôi"/"Thông tin tài khoản" ở tầm với nhanh — thay
// bằng 2 tác vụ hay dùng nhất tại sự kiện. "Đơn hàng" trỏ về danh sách sự
// kiện (đơn hàng phân theo từng sự kiện: /admin/events/[id]/orders).
const ADMIN_LINKS = [
  { href: "/admin/scan", label: "Quét QR", icon: QrCode },
  { href: "/admin/events", label: "Đơn hàng", icon: ClipboardList },
] as const;

/**
 * Thanh điều hướng nhanh cố định dưới đáy màn hình, hiện khi:
 * - Màn hình cỡ mobile (`sm:hidden` — ẩn từ ≥640px). Áp dụng cho cả app
 *   Android (WebView luôn cỡ mobile) lẫn web mở trên điện thoại. Desktop web
 *   vẫn dùng menu avatar trên header (xem UserNav).
 * - User đã đăng nhập (`isLoggedIn` truyền từ RootLayout — server component
 *   gọi auth() sẵn, tránh phải tự fetch session ở client).
 *
 * Admin (`isAdmin` cũng do RootLayout tính qua isAdmin()): 2 nút đổi thành
 * "Quét QR" + "Đơn hàng" thay cho "Vé của tôi"/"Thông tin tài khoản".
 *
 * Render kèm 1 div đệm cùng chiều cao ngay trước thanh fixed: vì <body> là
 * flex-col nên div đệm chiếm chỗ trong flow, thu hẹp phần không gian còn lại
 * của <main> (flex-1) đúng bằng chiều cao thanh — nội dung cuối trang không
 * bị thanh fixed che mà không cần sửa padding ở từng trang riêng lẻ. Div đệm
 * cũng `sm:hidden` để desktop không bị chừa khoảng trống thừa dưới đáy.
 */
export function AppBottomNav({
  isLoggedIn,
  isAdmin = false,
}: {
  isLoggedIn: boolean;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();

  if (!isLoggedIn) return null;

  const links = isAdmin ? ADMIN_LINKS : USER_LINKS;

  return (
    <>
      <div className="h-14 shrink-0 sm:hidden" aria-hidden />
      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-card/95 backdrop-blur-sm sm:hidden">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
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
