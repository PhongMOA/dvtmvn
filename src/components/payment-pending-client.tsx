"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getOrderPaymentStatus } from "@/app/actions/order-status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";

/** Số giây popup "hết hạn" hiện trước khi tự chuyển về trang chủ. */
const EXPIRED_REDIRECT_SECONDS = 5;

function secondsUntil(iso: string): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));
}

export function PaymentPendingClient({
  orderId,
  expiresAt,
}: {
  orderId: string;
  expiresAt: string;
}) {
  const router = useRouter();
  const [remainingSec, setRemainingSec] = useState(() => secondsUntil(expiresAt));
  // remoteExpired: chỉ được set bên trong callback bất đồng bộ của setInterval
  // (không phải đồng bộ trong thân effect) nên không phạm rule
  // react-hooks/set-state-in-effect. timedOut là giá trị suy ra (derived), không
  // cần state riêng.
  const [remoteExpired, setRemoteExpired] = useState(false);
  const [redirectSec, setRedirectSec] = useState(EXPIRED_REDIRECT_SECONDS);
  const timedOut = remainingSec <= 0;
  const expired = timedOut || remoteExpired;

  useEffect(() => {
    if (expired) return;
    const timer = setInterval(() => setRemainingSec(secondsUntil(expiresAt)), 1000);
    return () => clearInterval(timer);
  }, [expiresAt, expired]);

  useEffect(() => {
    if (expired) return;
    let cancelled = false;
    const poll = setInterval(async () => {
      const result = await getOrderPaymentStatus(orderId);
      if (cancelled || !result.ok) return;
      if (result.status === "paid") {
        toast.success("Thanh toán thành công! Combo của bạn đã sẵn sàng.");
        router.push("/my-tickets");
      } else if (result.status === "expired") {
        setRemoteExpired(true);
      }
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [orderId, expired, router]);

  // Hết hạn -> popup chặn màn hình + đếm ngược rồi tự về trang chủ. Dùng
  // router.replace (không phải push) để nút Back không quay lại trang QR cũ —
  // tránh user quét lại mã của đơn đã huỷ (chuyển tiền vào sẽ không khớp đơn nào).
  useEffect(() => {
    if (!expired) return;
    const timer = setInterval(() => setRedirectSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [expired]);

  useEffect(() => {
    if (expired && redirectSec <= 0) router.replace("/");
  }, [expired, redirectSec, router]);

  const mm = String(Math.floor(remainingSec / 60)).padStart(2, "0");
  const ss = String(remainingSec % 60).padStart(2, "0");

  return (
    <div className="mt-6 flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Còn{" "}
        <span className="font-semibold tabular-nums text-foreground">
          {expired ? "00:00" : `${mm}:${ss}`}
        </span>{" "}
        để hoàn tất chuyển khoản — trang sẽ tự chuyển khi hệ thống nhận được tiền.
      </p>

      {/* Không cho đóng (bỏ qua onOpenChange, tắt click ra ngoài, không nút X) và
          nền gần như đặc + blur để mã QR phía sau không quét được nữa. */}
      <Dialog open={expired} onOpenChange={() => {}} disablePointerDismissal>
        <DialogPopup
          showClose={false}
          backdropClassName="bg-black/90 backdrop-blur-md"
          className="text-center"
        >
          <DialogHeader>
            <DialogTitle>ĐƠN ĐÃ HẾT HẠN</DialogTitle>
            <DialogDescription>
              Đã quá 15 phút mà chưa nhận được chuyển khoản nên đơn đã bị huỷ.
              Vui lòng <strong>không chuyển khoản</strong> theo mã QR này nữa —
              hãy đặt lại combo.
            </DialogDescription>
          </DialogHeader>
          <p className="mt-4 text-sm text-muted-foreground">
            Tự động về trang chủ sau{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {redirectSec}s
            </span>
          </p>
          <Button className="mt-4 w-full" onClick={() => router.replace("/")}>
            Về trang chủ ngay
          </Button>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
