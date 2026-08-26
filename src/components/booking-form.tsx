"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { bookCombo } from "@/app/actions/booking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BookingForm({
  comboTypeId,
  remainingQuantity,
}: {
  comboTypeId: string;
  remainingQuantity: number;
}) {
  const [quantity, setQuantity] = useState(1);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const soldOut = remainingQuantity < 1;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await bookCombo(comboTypeId, quantity);
      if (!result.ok) {
        if (result.error === "UNAUTHORIZED") {
          router.push(`/sign-in?callbackUrl=${encodeURIComponent("/")}`);
          return;
        }
        toast.error(result.error);
        return;
      }
      toast.success("Đã giữ chỗ! Vui lòng chuyển khoản trong 15 phút để hoàn tất.");
      router.push(`/orders/${result.orderId}/pay`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`quantity-${comboTypeId}`} className="sr-only">
          Số lượng
        </Label>
        <Input
          id={`quantity-${comboTypeId}`}
          type="number"
          min={1}
          max={Math.max(remainingQuantity, 1)}
          value={quantity}
          disabled={soldOut || isPending}
          onChange={(e) => {
            const v = Number(e.target.value);
            setQuantity(
              Number.isNaN(v) ? 1 : Math.min(Math.max(v, 1), remainingQuantity),
            );
          }}
          className="w-20"
        />
      </div>
      <Button type="submit" disabled={soldOut || isPending} className="flex-1">
        {soldOut ? "Hết hàng" : isPending ? "Đang đặt..." : "Đặt combo"}
      </Button>
    </form>
  );
}
