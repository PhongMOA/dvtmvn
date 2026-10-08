"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateSalesCountdown } from "@/app/actions/shop-setting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SalesCountdownForm({
  defaultStartAt,
  defaultTitle,
}: {
  defaultStartAt: string; // yyyy-MM-ddTHH:mm giờ VN
  defaultTitle: string;
}) {
  const [state, formAction, isPending] = useActionState(updateSalesCountdown, {
    error: null,
  });

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.success) toast.success("Đã lưu cấu hình đếm ngược.");
  }, [state]);

  return (
    // key remount như PickInfoForm — xem chú thích ở đó.
    <form
      key={[defaultStartAt, defaultTitle].join("|")}
      action={formAction}
      className="mt-4 flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="salesStartAt">Giờ mở bán (giờ Việt Nam)</Label>
        <Input
          id="salesStartAt"
          name="salesStartAt"
          type="datetime-local"
          defaultValue={defaultStartAt}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="countdownTitle">
          Tiêu đề trên đồng hồ{" "}
          <span className="text-muted-foreground">(bỏ trống để ẩn)</span>
        </Label>
        <Input
          id="countdownTitle"
          name="countdownTitle"
          defaultValue={defaultTitle}
          placeholder="VD: Doomsday is coming"
          maxLength={100}
        />
      </div>
      <Button type="submit" size="lg" disabled={isPending} className="w-fit">
        {isPending ? "Đang lưu..." : "Lưu thay đổi"}
      </Button>
    </form>
  );
}
