import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/auth-helpers";
import { expireOrderIfPastDue } from "@/lib/order-expiry";
import { buildVietQrUrl } from "@/lib/sepay";
import { PaymentPendingClient } from "@/components/payment-pending-client";
import { buttonVariants } from "@/components/ui/button";

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

export default async function OrderPaymentPage({
  params,
}: PageProps<"/orders/[id]/pay">) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/orders/${id}/pay`)}`);
  }

  // Tự dọn trước nếu đơn đã quá hạn — để trang hiển thị đúng ngay lần load đầu,
  // không phải chờ tới lượt poll đầu tiên từ client.
  await expireOrderIfPastDue(id);

  const order = await prisma.order.findUnique({
    where: { id },
    include: { comboType: true },
  });
  if (!order || order.userId !== session.user.id) notFound();

  if (order.paymentStatus === "paid") {
    redirect("/my-tickets");
  }

  const amount = order.comboType.price * order.quantity;

  if (order.paymentStatus === "expired") {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <h1 className="font-heading text-3xl tracking-wide text-primary">
          ĐƠN ĐÃ HẾT HẠN
        </h1>
        <p className="mt-4 text-muted-foreground">
          Đơn {order.comboType.name} × {order.quantity} đã quá hạn chuyển khoản
          và bị huỷ. Vui lòng đặt lại combo.
        </p>
        <Link href="/" className={`${buttonVariants()} mt-6`}>
          Về trang chủ
        </Link>
      </div>
    );
  }

  const qrUrl = buildVietQrUrl({ amount, orderCode: order.orderCode });

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 text-center">
      <h1 className="font-heading text-3xl tracking-wide text-primary">
        QUÉT MÃ ĐỂ THANH TOÁN
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {order.comboType.name} × {order.quantity} — giữ nguyên nội dung chuyển
        khoản để hệ thống tự động xác nhận.
      </p>

      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh QR từ vietqr.app, dựng URL động theo đơn */}
      <img
        src={qrUrl}
        alt="Mã VietQR thanh toán"
        className="mx-auto mt-6 w-full max-w-xs rounded-lg border border-border bg-white p-3"
      />

      <dl className="mt-6 flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-left text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Số tiền</dt>
          <dd className="font-semibold text-accent">{formatVnd(amount)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Nội dung chuyển khoản</dt>
          <dd className="font-mono font-semibold tracking-wide text-foreground">
            {order.orderCode}
          </dd>
        </div>
      </dl>

      <PaymentPendingClient
        orderId={order.id}
        expiresAt={order.expiresAt.toISOString()}
        isAdmin={isAdminEmail(session.user.email)}
      />
    </div>
  );
}
