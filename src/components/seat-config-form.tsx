"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import type { SeatConfigFormState } from "@/app/actions/seat-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SeatConfigForm({
  action,
  defaultOpenAt,
  defaultTurnMinutes,
  defaultBatchSize,
}: {
  action: (state: SeatConfigFormState, formData: FormData) => Promise<SeatConfigFormState>;
  defaultOpenAt: string; // yyyy-MM-ddTHH:mm giờ VN, "" nếu chưa đặt
  defaultTurnMinutes: number;
  defaultBatchSize: number;
}) {
  const [state, formAction, isPending] = useActionState(action, { error: null });

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.success) toast.success("Đã lưu cấu hình chọn ghế.");
  }, [state]);

  return (
    // key remount như SalesCountdownForm — giá trị mới sau khi lưu hiện đúng.
    <form
      key={[defaultOpenAt, defaultTurnMinutes, defaultBatchSize].join("|")}
      action={formAction}
      className="mt-4 flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="seatOpenAt">Giờ mở chọn ghế (giờ Việt Nam)</Label>
        <Input
          id="seatOpenAt"
          name="seatOpenAt"
          type="datetime-local"
          defaultValue={defaultOpenAt}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="seatTurnMinutes">Phút mỗi lượt</Label>
          <Input
            id="seatTurnMinutes"
            name="seatTurnMinutes"
            type="number"
            min={1}
            max={120}
            defaultValue={defaultTurnMinutes}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="seatBatchSize">Người mỗi lượt</Label>
          <Input
            id="seatBatchSize"
            name="seatBatchSize"
            type="number"
            min={1}
            max={50}
            defaultValue={defaultBatchSize}
            required
          />
        </div>
      </div>
      <Button type="submit" size="lg" disabled={isPending} className="w-fit">
        {isPending ? "Đang lưu..." : "Lưu cấu hình"}
      </Button>
    </form>
  );
}
