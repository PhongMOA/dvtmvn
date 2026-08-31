"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { cancelGhtkShipment } from "@/app/actions/admin-orders";
import { Button } from "@/components/ui/button";

/**
 * Nút "Huỷ đơn GHTK" ở bảng đơn hàng admin. Dùng client component (không phải
 * <form action>) để confirm trước + hiện toast lý do khi GHTK từ chối huỷ
 * (vd "Đơn đã lấy hàng, không thể hủy").
 */
export function AdminCancelShipment({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    if (!window.confirm("Huỷ đơn vận chuyển GHTK của đơn này?")) return;
    startTransition(async () => {
      const result = await cancelGhtkShipment(orderId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Đã huỷ đơn GHTK.");
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="destructive"
      onClick={handleCancel}
      disabled={isPending}
    >
      {isPending ? "Đang huỷ..." : "Huỷ đơn GHTK"}
    </Button>
  );
}
