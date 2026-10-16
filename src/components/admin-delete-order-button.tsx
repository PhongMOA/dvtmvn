"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deleteExpiredOrder } from "@/app/actions/admin-orders";
import { Button } from "@/components/ui/button";

/**
 * Nút "Xoá" cho đơn đã hết hạn ở bảng đơn hàng admin. Client component để
 * confirm trước + hiện toast lý do khi server từ chối xoá.
 */
export function AdminDeleteOrderButton({
  orderId,
  orderCode,
}: {
  orderId: string;
  orderCode: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm(`Xoá đơn hết hạn ${orderCode}? Hành động không thể hoàn tác.`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteExpiredOrder(orderId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Đã xoá đơn.");
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? "Đang xoá..." : "Xoá"}
    </Button>
  );
}
