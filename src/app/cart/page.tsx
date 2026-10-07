import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth-helpers";
import { expireStaleOrdersForCombos } from "@/lib/order-expiry";
import { parseComboItems } from "@/lib/combo";
import { isSalesOpen } from "@/lib/sales";
import { CartView, type CartCombo } from "@/components/cart-view";
import { buttonVariants } from "@/components/ui/button";

export default async function CartPage() {
  const session = await auth();
  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent("/cart")}`);
  }

  // Cùng quy tắc trang chủ: chưa tới giờ mở bán công khai thì chỉ admin đặt được.
  const salesOpen = isSalesOpen() || (await isAdmin(session.user));
  if (!salesOpen) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <h1 className="font-heading text-3xl tracking-wide text-primary">
          CHƯA MỞ BÁN
        </h1>
        <p className="mt-4 text-muted-foreground">
          Combo chưa mở bán, quay lại khi hết đếm ngược nhé.
        </p>
        <Link href="/" className={`${buttonVariants()} mt-6`}>
          Về trang chủ
        </Link>
      </div>
    );
  }

  // Giỏ hàng nằm ở localStorage nên server không biết khách bỏ combo nào —
  // gửi xuống toàn bộ combo đang bán (event "open") với tồn kho mới nhất, client
  // tự ghép với giỏ. Combo trong giỏ mà không còn trong danh sách này = ngừng bán.
  const openComboIds = await prisma.comboType.findMany({
    where: { event: { status: "open" } },
    select: { id: true },
  });
  await expireStaleOrdersForCombos(openComboIds.map((combo) => combo.id));

  const combos = await prisma.comboType.findMany({
    where: { event: { status: "open" } },
    include: { event: { select: { title: true } } },
    orderBy: { createdAt: "asc" },
  });

  const cartCombos: CartCombo[] = combos.map((combo) => ({
    id: combo.id,
    name: combo.name,
    eventTitle: combo.event.title,
    price: combo.price,
    originalPrice: combo.originalPrice,
    remainingQuantity: combo.remainingQuantity,
    contents: [
      ...(combo.includesTicket ? ["1 Vé tham gia offline"] : []),
      ...parseComboItems(combo.items),
    ],
  }));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="font-heading text-4xl tracking-wide text-primary">
        GIỎ HÀNG
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Thanh toán tất cả combo trong giỏ bằng 1 lần chuyển khoản. Đặt xong đơn
        được giữ chỗ 15 phút.
      </p>
      <div className="mt-8">
        <CartView combos={cartCombos} />
      </div>
    </div>
  );
}
