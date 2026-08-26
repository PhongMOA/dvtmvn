"use client";

import { useActionState } from "react";
import type { ComboFormState } from "@/app/actions/admin-combos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ComboDefaults = {
  name: string;
  price: number;
  originalPrice: number | null;
  includesTicket: boolean;
  items: string; // mỗi dòng 1 item, đã join từ mảng để hiển thị trong textarea
  totalQuantity: number;
};

export function ComboForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prevState: ComboFormState, formData: FormData) => Promise<ComboFormState>;
  defaults?: Partial<ComboDefaults>;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState<ComboFormState, FormData>(
    action,
    { error: null },
  );

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Tên combo</Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaults?.name}
          placeholder="Combo 1 - Hàng A"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="price">Giá bán (VNĐ)</Label>
          <Input
            id="price"
            name="price"
            type="number"
            min={0}
            defaultValue={defaults?.price ?? 0}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="originalPrice">Giá gốc (tuỳ chọn, để trống nếu không giảm giá)</Label>
          <Input
            id="originalPrice"
            name="originalPrice"
            type="number"
            min={0}
            defaultValue={defaults?.originalPrice ?? ""}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="includesTicket"
          name="includesTicket"
          type="checkbox"
          defaultChecked={defaults?.includesTicket ?? true}
          className="h-4 w-4 rounded border-border"
        />
        <Label htmlFor="includesTicket" className="font-normal">
          Combo có kèm vé tham gia offline
        </Label>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="items">Các item kèm theo (mỗi dòng 1 item)</Label>
        <Textarea
          id="items"
          name="items"
          defaultValue={defaults?.items}
          rows={4}
          placeholder={"1 Dây đeo\n1 Bộ Sticker A6"}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="totalQuantity">Tổng số lượng combo</Label>
        <Input
          id="totalQuantity"
          name="totalQuantity"
          type="number"
          min={1}
          defaultValue={defaults?.totalQuantity ?? 50}
          required
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" size="lg" disabled={isPending} className="w-fit">
        {isPending ? "Đang lưu..." : submitLabel}
      </Button>
    </form>
  );
}
