"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Nút chat Messenger nổi góc dưới phải. Meta đã ngừng Customer Chat Plugin
// (05/2024) nên chỉ mở link m.me — không cần app Facebook.
const MESSENGER_URL = "https://m.me/DaVuTruMarvelVN";

export function MessengerButton({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;

  return (
    <a
      href={MESSENGER_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat với fanpage Đa Vũ Trụ Marvel VN qua Messenger"
      title="Chat với fanpage qua Messenger"
      className={cn(
        "fixed right-4 z-40 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-1 ring-accent/40 transition hover:scale-105 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:bottom-6 sm:right-6 sm:size-14",
        // Thanh điều hướng dưới (h-14, chỉ mobile + đã đăng nhập) -> đẩy nút lên trên nó.
        isLoggedIn ? "bottom-[4.5rem]" : "bottom-4",
      )}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-6 sm:size-7">
        <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.14.26.35.27.57l.05 1.78a.8.8 0 0 0 1.12.71l1.98-.87a.8.8 0 0 1 .53-.04c.91.25 1.88.38 2.91.38 5.64 0 10-4.13 10-9.7S17.64 2 12 2Zm6 7.46-2.94 4.66a1.5 1.5 0 0 1-2.17.4l-2.34-1.75a.6.6 0 0 0-.72 0l-3.16 2.4c-.42.32-.97-.18-.69-.63l2.94-4.66a1.5 1.5 0 0 1 2.17-.4l2.34 1.75a.6.6 0 0 0 .72 0l3.16-2.4c.42-.32.97.18.69.63Z" />
      </svg>
    </a>
  );
}
