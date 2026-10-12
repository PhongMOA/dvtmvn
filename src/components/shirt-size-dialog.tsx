"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  SHIRT_SIZE_CHART,
  SHIRT_SIZES,
  shirtSizesTotal,
  type ShirtSize,
  type ShirtSizes,
} from "@/lib/shirt-sizes";

export type ShirtSizeRequest = {
  comboName: string;
  quantity: number; // số combo = số áo phải chọn
  initialSizes?: ShirtSizes;
  confirmLabel: string;
  onConfirm: (sizes: ShirtSizes) => void;
};

/**
 * Modal chọn size áo cho combo có áo: nhập số lượng từng size, chỉ cho xác nhận
 * khi tổng số áo = số combo. Dùng chung cho "Thêm vào giỏ", "Đặt ngay" và sửa
 * size trong giỏ hàng.
 */
export function ShirtSizeDialog({
  request,
  pending = false,
  onClose,
}: {
  request: ShirtSizeRequest | null;
  pending?: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      <DialogPopup className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {request && (
          // key: mở lại modal (combo/số lượng khác) -> reset state nhập size.
          <ShirtSizeForm
            key={`${request.comboName}-${request.quantity}`}
            request={request}
            pending={pending}
          />
        )}
      </DialogPopup>
    </Dialog>
  );
}

function ShirtSizeForm({
  request,
  pending,
}: {
  request: ShirtSizeRequest;
  pending: boolean;
}) {
  const { quantity } = request;
  // Giữ size cũ kể cả khi thừa (giảm số lượng trong giỏ) — khách tự bớt size nào.
  const [sizes, setSizes] = useState<ShirtSizes>(() =>
    quantity === 1 && shirtSizesTotal(request.initialSizes ?? {}) > 1
      ? {}
      : (request.initialSizes ?? {}),
  );
  const total = shirtSizesTotal(sizes);
  const remaining = quantity - total;

  function setSize(size: ShirtSize, qty: number) {
    const current = sizes[size] ?? 0;
    // Bớt luôn được; thêm thì không vượt số áo còn thiếu.
    const next = qty <= current ? Math.max(qty, 0) : Math.min(qty, quantity - (total - current));
    setSizes((prev) => {
      const copy = { ...prev };
      if (next > 0) copy[size] = next;
      else delete copy[size];
      return copy;
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (total === quantity) request.onConfirm(sizes);
      }}
    >
      <DialogHeader>
        <DialogTitle>CHỌN SIZE ÁO</DialogTitle>
        <DialogDescription>
          {request.comboName} × {quantity} —{" "}
          {quantity === 1
            ? "chọn size áo của bạn."
            : `chia ${quantity} áo theo size (tổng phải đủ ${quantity}).`}
        </DialogDescription>
      </DialogHeader>

      <SizeChart selected={sizes} />

      {quantity === 1 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {SHIRT_SIZES.map((size) => (
            <Button
              key={size}
              type="button"
              variant={sizes[size] ? "default" : "outline"}
              disabled={pending}
              onClick={() => setSizes({ [size]: 1 })}
              className="min-w-14"
            >
              {size}
            </Button>
          ))}
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {SHIRT_SIZES.map((size) => {
            const qty = sizes[size] ?? 0;
            return (
              <li key={size} className="flex items-center justify-between gap-3">
                <span className="w-12 font-medium text-foreground">{size}</span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Bớt 1 áo size ${size}`}
                    disabled={pending || qty <= 0}
                    onClick={() => setSize(size, qty - 1)}
                  >
                    <Minus />
                  </Button>
                  <Input
                    type="number"
                    min={0}
                    max={quantity}
                    value={qty}
                    disabled={pending}
                    aria-label={`Số áo size ${size}`}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setSize(size, Number.isNaN(v) ? 0 : v);
                    }}
                    className="w-14 text-center"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Thêm 1 áo size ${size}`}
                    disabled={pending || remaining <= 0}
                    onClick={() => setSize(size, qty + 1)}
                  >
                    <Plus />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p
        className={cn(
          "mt-4 text-sm",
          remaining === 0 ? "text-accent" : "text-muted-foreground",
        )}
      >
        Đã chọn {total}/{quantity} áo
        {remaining > 0 && ` — còn thiếu ${remaining}`}
        {remaining < 0 && ` — thừa ${-remaining}, vui lòng bớt`}
      </p>

      <Button
        type="submit"
        size="lg"
        disabled={pending || total !== quantity}
        className="mt-4 w-full"
      >
        {request.confirmLabel}
      </Button>
    </form>
  );
}

/** Bảng thông số size — cột của size đang chọn được tô nổi bật. */
function SizeChart({ selected }: { selected: ShirtSizes }) {
  return (
    <details open className="group mt-4 rounded-md border border-border">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-foreground">
        Bảng thông số size
      </summary>
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full text-center text-xs tabular-nums">
          <thead>
            <tr className="bg-muted/40">
              <th className="sticky left-0 bg-card px-2 py-1.5 text-left font-medium text-muted-foreground">
                Size
              </th>
              {SHIRT_SIZES.map((size) => (
                <th
                  key={size}
                  className={cn(
                    "px-2 py-1.5 font-semibold text-foreground",
                    selected[size] && "bg-accent/20 text-accent",
                  )}
                >
                  {size}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SHIRT_SIZE_CHART.map((row) => (
              <tr key={row.label} className="border-t border-border">
                <th className="sticky left-0 whitespace-nowrap bg-card px-2 py-1.5 text-left font-normal text-muted-foreground">
                  {row.label}
                </th>
                {SHIRT_SIZES.map((size) => (
                  <td
                    key={size}
                    className={cn(
                      "whitespace-nowrap px-2 py-1.5 text-foreground",
                      selected[size] && "bg-accent/10",
                    )}
                  >
                    {row.values[size]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
