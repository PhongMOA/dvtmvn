"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getOrderPaymentStatus } from "@/app/actions/order-status";

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

  if (expired) {
    return (
      <p className="mt-6 text-sm text-destructive">
        Đơn đã hết hạn thanh toán và được huỷ. Vui lòng quay về trang chủ để đặt
        lại combo.
      </p>
    );
  }

  const mm = String(Math.floor(remainingSec / 60)).padStart(2, "0");
  const ss = String(remainingSec % 60).padStart(2, "0");

  return (
    <p className="mt-6 text-sm text-muted-foreground">
      Còn{" "}
      <span className="font-semibold tabular-nums text-foreground">
        {mm}:{ss}
      </span>{" "}
      để hoàn tất chuyển khoản — trang sẽ tự chuyển khi hệ thống nhận được tiền.
    </p>
  );
}
