import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { expireStaleOrdersForCombo } from "@/lib/order-expiry";
import { BookingForm } from "@/components/booking-form";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { parseComboItems } from "@/lib/combo";
import { SALES_START_AT, isSalesOpen } from "@/lib/sales";
import { SalesCountdown } from "@/components/sales-countdown";
import { FloatingParticles } from "@/components/floating-particles";
import { cn } from "@/lib/utils";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

export default async function Home() {
  const [event, session] = await Promise.all([
    prisma.event.findFirst({
      where: { status: "open" },
      include: { comboTypes: { orderBy: { createdAt: "asc" } } },
    }),
    auth(),
  ]);

  if (!event) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="font-heading text-4xl tracking-wide text-primary">
          CHƯA MỞ BÁN VÉ
        </h1>
        <p className="mt-4 max-w-md text-muted-foreground">
          Hiện chưa có sự kiện chiếu phim nào đang mở bán vé. Quay lại sau nhé!
        </p>
      </div>
    );
  }

  // Dọn các đơn "pending" đã quá hạn của MỌI combo thuộc event này trước khi
  // hiển thị tồn kho. Không có cron nên trước đây việc hoàn kho chỉ được kích
  // hoạt lúc user đặt lại ĐÚNG combo đó (xem expireStaleOrdersForCombo) hoặc
  // lúc trang thanh toán của ĐÚNG đơn đó đang mở tự poll — nếu user rời trang
  // thanh toán giữa chừng mà không ai đặt lại combo, đơn "treo" vô thời hạn,
  // trang chủ hiện thiếu hàng ảo. Trang chủ là nơi hiển thị tồn kho cho tất cả
  // user nên tận dụng làm điểm dọn dẹp chung, không cần đợi 1 trong 2 điều
  // kiện trên xảy ra.
  await Promise.all(
    event.comboTypes.map((combo) => expireStaleOrdersForCombo(combo.id)),
  );
  event.comboTypes = await prisma.comboType.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: "asc" },
  });

  const now = new Date();

  // App Android gắn thêm chuỗi "MarvelVNApp" vào User-Agent của WebView (xem
  // capacitor.config.ts) — dùng để user tự test được giao diện sau countdown
  // (combo, đặt vé...) ngay trên app thật trước ngày mở bán chính thức, mà
  // không ảnh hưởng khách xem qua web browser bình thường. Nhớ: build lại
  // APK (npx cap sync android) thì UA mới có chuỗi này, web/app cũ vẫn bị
  // khoá như thường.
  const isAndroidApp = (await headers())
    .get("user-agent")
    ?.includes("MarvelVNApp") ?? false;
  const salesOpen = isSalesOpen(now) || isAndroidApp;

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <section
        className={cn(
          "relative overflow-hidden bg-background",
          // Chỉ kẻ viền dưới khi đã có nội dung bên dưới (hết countdown) —
          // nếu không, viền lơ lửng dưới hero trông cụt.
          salesOpen
            ? "border-b border-border/60"
            : // Chưa mở bán: chưa có combo bên dưới nên cho hero chiếm hết
              // chiều cao còn lại và canh nội dung giữa màn hình cho đỡ hụt.
              "flex flex-1 flex-col justify-center",
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-card via-background to-background" />
        {event.posterUrl && (
          <>
            {/* Mobile (< sm): ảnh phủ toàn hero, làm nền cho chữ đè lên (không đủ
                chỗ chia đôi trái/phải như desktop) — tối bằng gradient dọc để
                chữ luôn đọc được bất kể vùng sáng/tối của ảnh gốc. */}
            <div className="absolute inset-0 sm:hidden">
              <Image
                src={event.posterUrl}
                alt={event.title}
                fill
                priority
                className="object-cover object-[50%_18%]"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/80 to-background" />
            </div>
            <div className="absolute inset-y-0 right-0 hidden w-3/5 sm:block lg:w-1/2 xl:w-[42%]">
              <Image
                src={event.posterUrl}
                alt={event.title}
                fill
                priority
                className="object-cover object-[50%_18%]"
              />
              {/* Phủ mờ bên trái + trên-dưới để trọng tâm ảnh (khuôn mặt) không chèn lên vùng chữ */}
              <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/50" />
            </div>
          </>
        )}
        {/* Đốm sáng nhỏ bay lơ lửng trong không khí */}
        <FloatingParticles className="pointer-events-none opacity-80 mix-blend-screen" />
        <div className="relative mx-auto flex max-w-5xl flex-col gap-6 px-4 py-16 sm:py-24">
          <Badge className="w-fit bg-primary/15 text-primary" variant="outline">
            {salesOpen ? "ĐANG MỞ BÁN" : "SẮP MỞ BÁN"}
          </Badge>
          <h1 className="font-heading text-5xl leading-none tracking-wide text-foreground sm:text-7xl">
            {event.title.toUpperCase()}
          </h1>
          {!salesOpen && (
            <div className="mt-2">
              <SalesCountdown
                targetIso={SALES_START_AT.toISOString()}
                serverNowMs={now.getTime()}
              />
            </div>
          )}
        </div>
      </section>

      {/* Phần bên dưới (địa điểm, suất chiếu, combo) chỉ hiện sau khi hết
          countdown — trước đó trang chủ chỉ có hero + đồng hồ đếm ngược. */}
      {salesOpen && (
        <>
      {/* Details */}
      <section className="mx-auto w-full max-w-5xl px-4 py-12">
        <div className="grid grid-cols-2 gap-6 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">Địa điểm</p>
            <p className="mt-1 font-medium text-foreground">{event.venue}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Suất chiếu</p>
            <p className="mt-1 font-medium text-foreground">
              {formatDateTime(event.startAt)}
            </p>
          </div>
        </div>
      </section>

      {/* Combo picker */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-16">
        <h2 className="font-heading text-3xl tracking-wide text-primary">
          CHỌN COMBO
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Đặt combo xong quét mã VietQR chuyển khoản trong 15 phút để giữ chỗ —
          hệ thống tự động xác nhận, không cần chờ duyệt thủ công.
        </p>

        {event.comboTypes.length === 0 ? (
          <p className="mt-8 text-muted-foreground">
            Sự kiện chưa mở bán combo nào.
          </p>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {event.comboTypes.map((combo) => {
              const soldOut = combo.remainingQuantity < 1;
              const discountPercent = combo.originalPrice
                ? Math.round((1 - combo.price / combo.originalPrice) * 100)
                : null;
              const items = [
                ...(combo.includesTicket ? ["1 Vé tham gia offline"] : []),
                ...parseComboItems(combo.items),
              ];

              return (
                <div
                  key={combo.id}
                  className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
                >
                  <div>
                    <h3 className="font-heading text-xl tracking-wide text-foreground">
                      {combo.name}
                    </h3>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-2xl font-semibold text-accent">
                        {formatVnd(combo.price)}
                      </span>
                      {combo.originalPrice && (
                        <span className="text-sm text-muted-foreground line-through">
                          {formatVnd(combo.originalPrice)}
                        </span>
                      )}
                      {discountPercent !== null && discountPercent > 0 && (
                        <Badge variant="outline" className="border-accent text-accent">
                          ĐÃ GIẢM {discountPercent}%
                        </Badge>
                      )}
                    </div>
                  </div>

                  <ul className="flex flex-1 flex-col gap-1 text-sm text-muted-foreground">
                    {items.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>

                  <p className="text-xs text-muted-foreground">
                    {soldOut
                      ? "Đã hết hàng"
                      : `Còn lại ${combo.remainingQuantity}/${combo.totalQuantity}`}
                  </p>

                  {session?.user ? (
                    <BookingForm
                      comboTypeId={combo.id}
                      remainingQuantity={combo.remainingQuantity}
                    />
                  ) : (
                    <Link
                      href={`/sign-in?callbackUrl=${encodeURIComponent("/")}`}
                      className={cn(buttonVariants(), "w-full")}
                    >
                      Đăng nhập để đặt
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
        </>
      )}
    </div>
  );
}
