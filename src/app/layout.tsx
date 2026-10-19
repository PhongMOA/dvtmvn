import type { Metadata } from "next";
import { Geist, Geist_Mono, Cal_Sans, Anton } from "next/font/google";
import localFont from "next/font/local";
import Link from "next/link";
import Script from "next/script";
import "./globals.css";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth-helpers";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";
import { ProfileModal } from "@/components/profile-modal";
import { PushRegistrar } from "@/components/push-registrar";
import { UpdateWatcher } from "@/components/update-watcher";
import { AppBottomNav } from "@/components/app-bottom-nav";
import { AgeNoticeModal } from "@/components/age-notice-modal";
import { MessengerButton } from "@/components/messenger-button";

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

const GA_ID = "G-0F1G6D17RJ";

// Staging = project Vercel dvtmvn (dvtmarvelvn.8ternal.com, nhánh `staging`),
// set NEXT_PUBLIC_APP_ENV=staging trên Vercel. Hiện banner, tắt GA, chặn index.
const IS_STAGING = process.env.NEXT_PUBLIC_APP_ENV === "staging";

export const metadata: Metadata = {
  title: "Đa vũ trụ Marvel VN - Đặt vé offline Avengers: Doomsday",
  description:
    "Đặt vé xem Avengers: Doomsday tại sự kiện chiếu phim offline. Thanh toán chuyển khoản VietQR, nhận vé QR check-in.",
  ...(IS_STAGING && { robots: { index: false, follow: false } }),
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  const admin = await isAdmin(session?.user);

  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} ${calSans.variable} ${anton.variable} ${marvelWordmark.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {IS_STAGING && (
          <div className="bg-amber-400 px-4 py-1 text-center text-xs font-semibold text-black">
            STAGING — bản thử nghiệm, không phải trang đặt vé thật. Đừng chuyển khoản.
          </div>
        )}
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
        <footer className="border-t border-border/60 px-4 py-6 text-center text-xs text-muted-foreground">
          © Đa Vũ Trụ Marvel VN ·{" "}
          <Link href="/dieu-khoan" className="underline-offset-2 hover:text-primary hover:underline">
            Điều khoản và điều kiện sử dụng
          </Link>
          {/* Mã bản build — khi báo lỗi biết đang chạy bản nào */}
          <span className="ml-2 opacity-50">· {process.env.NEXT_PUBLIC_BUILD_ID}</span>
        </footer>
        <Toaster richColors theme="dark" />
        <ProfileModal />
        <AgeNoticeModal />
        <PushRegistrar />
        <UpdateWatcher />
        <AppBottomNav isLoggedIn={!!session?.user} isAdmin={admin} />
        <MessengerButton isLoggedIn={!!session?.user} />
        {/* Google Analytics 4 — cùng mã với trang tĩnh public/dong-thoi-gian-mcu.html.
            Chuyển trang phía client (App Router) được GA4 tự ghi nhận qua
            "Enhanced measurement > Page changes based on browser history". */}
        {!IS_STAGING && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="gtag-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
