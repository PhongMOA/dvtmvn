"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { refreshShipmentStatus } from "@/app/actions/order-status";
import { ghtkStatusColorClass } from "@/lib/ghtk";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

/**
 * Khối "vận chuyển GHTK" dưới mỗi vé đã thanh toán ở /my-tickets. Hiện mã vận
 * đơn + trạng thái (có mã màu theo tiến độ: đỏ = huỷ/thất bại, xanh = đã giao,
 * vàng sáng dần theo tiến độ xử lý), nút "Cập nhật" gọi refreshShipmentStatus.
 *
 * Nếu đơn GHTK chưa tạo được (error && !label): chỉ báo chung chung, không lộ
 * chi tiết lỗi kỹ thuật cho khách — admin sẽ tạo lại ở trang quản lý.
 */
export function ShipmentStatus({
  orderId,
  label,
  status,
  statusText,
  syncedAt,
  error,
}: {
  orderId: string;
  label: string | null;
  status: string | null;
  statusText: string | null;
  syncedAt: string | null;
  error: string | null;
}) {
  const [current, setCurrent] = useState<{
    status: string | null;
    text: string | null;
  }>({ status, text: statusText });
  const [synced, setSynced] = useState(syncedAt);
  const [isPending, startTransition] = useTransition();

  if (!label) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        {error
          ? "Đang tạo đơn vận chuyển, vui lòng quay lại sau ít phút."
          : "Đơn vận chuyển sẽ được tạo sau khi thanh toán được xác nhận."}
      </div>
    );
  }

  function handleRefresh() {
    startTransition(async () => {
      const result = await refreshShipmentStatus(orderId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCurrent({ status: result.status, text: result.statusText });
      setSynced(new Date().toISOString());
      toast.success("Đã cập nhật trạng thái vận chuyển.");
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0 text-muted-foreground">Mã vận đơn</span>
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate font-mono font-semibold tracking-wide text-foreground">
            {label}
          </span>
          <CopyButton value={label} label="mã vận đơn" />
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">Trạng thái</span>
        <span
          className={cn("font-semibold", ghtkStatusColorClass(current.status))}
        >
          {current.text ?? "Đang cập nhật"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {synced ? `Cập nhật lúc ${formatDateTime(synced)}` : ""}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isPending}
        >
          {isPending ? "Đang cập nhật..." : "Cập nhật"}
        </Button>
      </div>
    </div>
  );
}
