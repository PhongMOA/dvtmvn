import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { expireOrderIfPastDue } from "@/lib/order-expiry";
import { buildVietQrUrl, getBankTransferInfo } from "@/lib/sepay";
import { PaymentPendingClient } from "@/components/payment-pending-client";
import { PayCheckoutGate } from "@/components/pay-checkout-gate";
import { CopyButton } from "@/components/copy-button";
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
    include: { comboType: true, user: true },
  });
  if (!order || order.userId !== session.user.id) notFound();

  if (order.paymentStatus === "paid") {
    redirect("/my-tickets");
  }

  const comboTotal = order.comboType.price * order.quantity;
  const amount = comboTotal + order.shipFee;

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

  // Đơn pending chưa qua bước xác nhận thông tin nhận hàng (mở URL trực tiếp,
  // hoặc "Tiếp tục thanh toán" từ /my-tickets với đơn cũ) — bắt xác nhận địa chỉ
  // + tính phí ship tại chỗ trước khi hiện QR.
  if (!order.shipProvince) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-12">
        <h1 className="text-center font-heading text-3xl tracking-wide text-primary">
          XÁC NHẬN THÔNG TIN NHẬN HÀNG
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {order.comboType.name} × {order.quantity} — kiểm tra địa chỉ để tính phí
          ship trước khi thanh toán.
        </p>
        <div className="mt-6">
          <PayCheckoutGate
            orderId={order.id}
            defaultProfile={{
              name: order.user.name ?? "",
              phone: order.user.phone ?? "",
              province: order.user.province ?? "",
              district: order.user.district ?? "",
              ward: order.user.ward ?? "",
              address: order.user.address ?? "",
            }}
          />
        </div>
      </div>
    );
  }

  const qrUrl = buildVietQrUrl({ amount, orderCode: order.orderCode });
  const { account, bank } = getBankTransferInfo();

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
          <dt className="text-muted-foreground">Tiền combo</dt>
          <dd className="font-medium text-foreground">{formatVnd(comboTotal)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Phí ship (GHTK)</dt>
          <dd className="font-medium text-foreground">
            {formatVnd(order.shipFee)}
          </dd>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2">
          <dt className="font-semibold text-foreground">Số tiền chuyển khoản</dt>
          <dd className="font-semibold text-accent">{formatVnd(amount)}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="shrink-0 text-muted-foreground">
            Nội dung chuyển khoản
          </dt>
          <dd className="flex min-w-0 items-center gap-1">
            <span className="truncate font-mono font-semibold tracking-wide text-foreground">
              {order.orderCode}
            </span>
            <CopyButton value={order.orderCode} label="nội dung chuyển khoản" />
          </dd>
        </div>
      </dl>

      {/* Không phải ai cũng mở trang này trên máy khác rồi lấy điện thoại quét
          — nếu đang mở ngay trên điện thoại dùng để chuyển khoản (đặc biệt
          trong app Android) thì không tự quét camera vào màn hình chính nó
          được, cần thông tin để chuyển khoản thủ công trong app ngân hàng. */}
      <details className="mt-4 rounded-lg border border-border bg-card text-left text-sm">
        <summary className="cursor-pointer px-4 py-3 font-medium text-foreground">
          Không quét được mã? Chuyển khoản thủ công
        </summary>
        <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Đang mở trang này ngay trên điện thoại dùng để chuyển khoản? Mở
            app ngân hàng, chuyển khoản thủ công theo thông tin bên dưới (giữ
            đúng nội dung chuyển khoản để hệ thống tự xác nhận).
          </p>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Ngân hàng</dt>
            <dd className="font-semibold text-foreground">{bank}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="shrink-0 text-muted-foreground">Số tài khoản</dt>
            <dd className="flex min-w-0 items-center gap-1">
              <span className="truncate font-mono font-semibold tracking-wide text-foreground">
                {account}
              </span>
              <CopyButton value={account} label="số tài khoản" />
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Số tiền</dt>
            <dd className="font-semibold text-accent">{formatVnd(amount)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="shrink-0 text-muted-foreground">
              Nội dung chuyển khoản
            </dt>
            <dd className="flex min-w-0 items-center gap-1">
              <span className="truncate font-mono font-semibold tracking-wide text-foreground">
                {order.orderCode}
              </span>
              <CopyButton value={order.orderCode} label="nội dung chuyển khoản" />
            </dd>
          </div>
        </div>
      </details>

      <PaymentPendingClient
        orderId={order.id}
        expiresAt={order.expiresAt.toISOString()}
      />
    </div>
  );
}
