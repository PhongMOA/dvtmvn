"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { SeatAdminResult } from "@/app/actions/seat-admin";
import { Button } from "@/components/ui/button";

/** Nút gọi 1 server action admin chọn ghế (chốt danh sách / huỷ ghế) + toast kết quả. */
export function SeatAdminButton({
  action,
  label,
  confirmText,
  variant = "default",
  size = "default",
}: {
  action: () => Promise<SeatAdminResult>;
  label: string;
  confirmText?: string;
  variant?: "default" | "outline" | "destructive";
  size?: "default" | "sm";
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (confirmText && !window.confirm(confirmText)) return;
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <Button variant={variant} size={size} disabled={isPending} onClick={handleClick}>
      {isPending ? "Đang xử lý..." : label}
    </Button>
  );
}
