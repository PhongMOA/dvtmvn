import type { Metadata } from "next";
import { Geist, Geist_Mono, Cal_Sans, Anton } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";
import { ProfileModal } from "@/components/profile-modal";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Bebas Neue trước đây chỉ có subset "latin" nên chữ có dấu tiếng Việt
// (Đặt vé, Số lượng...) bị fallback sang font khác, lệch phong cách so với
// chữ không dấu. Cal Sans hỗ trợ subset "vietnamese" nên hiển thị đúng dấu.
const calSans = Cal_Sans({
  variable: "--font-heading",
  weight: "400",
  subsets: ["latin", "vietnamese"],
});

// Font cho dòng "ĐA VŨ TRỤ" trong logo — tạm dùng Anton (chờ xác nhận font
// đúng, vì font MarvelRegular không có dấu tiếng Việt nên không dùng được ở
// dòng này — xem font marvelWordmark bên dưới).
const anton = Anton({
  variable: "--font-logo",
  weight: "400",
  subsets: ["latin", "vietnamese"],
});

// Font gốc "Marvel Regular" — chỉ có A-Z không dấu (đã kiểm tra bảng glyph),
// dùng đúng cho dòng "MARVEL VN" (không có ký tự có dấu).
const marvelWordmark = localFont({
  src: "../fonts/MarvelRegular-Dj83.ttf",
  variable: "--font-marvel",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Đa vũ trụ Marvel VN - Đặt vé offline Avengers: Doomsday",
  description:
    "Đặt vé xem Avengers: Doomsday tại sự kiện chiếu phim offline. Thanh toán chuyển khoản VietQR, nhận vé QR check-in.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} ${calSans.variable} ${anton.variable} ${marvelWordmark.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
        <Toaster richColors theme="dark" />
        <ProfileModal />
      </body>
    </html>
  );
}
