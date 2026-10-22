"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import type { LuckyDrawFormState } from "@/app/actions/lucky-draw";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Tạo phiên quay số / sửa số lượt. */
export function LuckyDrawForm({
  action,
  defaultRounds,
  isNew,
}: {
  action: (state: LuckyDrawFormState, formData: FormData) => Promise<LuckyDrawFormState>;
  defaultRounds: number;
  isNew: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, { error: null });

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.success) toast.success("Đã lưu phiên quay số.");
  }, [state]);

  return (
    <form key={defaultRounds} action={formAction} className="mt-4 flex items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="totalRounds">Số lượt quay</Label>
        <Input
          id="totalRounds"
          name="totalRounds"
          type="number"
          min={1}
          max={500}
          defaultValue={defaultRounds}
          className="w-32"
          required
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Đang lưu..." : isNew ? "Tạo phiên" : "Lưu"}
      </Button>
    </form>
  );
}

/** Copy danh sách trúng thưởng dạng tab-separated để dán vào Sheet/Zalo. */
export function CopyWinnersButton({ text }: { text: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast.success("Đã copy danh sách.");
        } catch {
          toast.error("Trình duyệt chặn copy.");
        }
      }}
    >
      Copy danh sách
    </Button>
  );
}
