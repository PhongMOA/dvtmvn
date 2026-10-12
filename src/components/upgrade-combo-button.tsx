"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUpCircle } from "lucide-react";
import { createUpgradeOrder } from "@/app/actions/upgrade";
import { ShirtSizeDialog, type ShirtSizeRequest } from "@/components/shirt-size-dialog";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ShirtSizes } from "@/lib/shirt-sizes";

export type UpgradeTarget = {
  id: string;
  name: string;
  price: number;
  diff: number; // tiền chênh lệch / combo
  includesShirt: boolean;
  remainingQuantity: number;
  contents: string[];
};

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

/**
 * Nút "Nâng cấp" ở /my-tickets cho dòng combo không kèm vé: chọn combo có vé
 * để đổi + số lượng, (combo có áo -> chọn size), rồi tạo đơn nâng cấp và chuyển
 * sang trang thanh toán phần chênh lệch.
 */
export function UpgradeComboButton({
  orderItemId,
  comboName,
  upgradableQuantity,
  targets,
}: {
  orderItemId: string;
  comboName: string;
  upgradableQuantity: number;
  targets: UpgradeTarget[];
}) {
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(upgradableQuantity);
  const [sizeRequest, setSizeRequest] = useState<ShirtSizeRequest | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const target = targets.find((t) => t.id === targetId) ?? null;
  const maxQuantity = Math.min(upgradableQuantity, target?.remainingQuantity ?? upgradableQuantity);

  function submit(sizes?: ShirtSizes) {
    if (!target) return;
    startTransition(async () => {
      const result = await createUpgradeOrder({
        orderItemId,
        targetComboId: target.id,
        quantity,
        sizes,
      });
      if (!result.ok) {
        toast.error(result.error);
        router.refresh();
        return;
      }
      setSizeRequest(null);
      setOpen(false);
      toast.success("Đã tạo đơn nâng cấp — vui lòng chuyển khoản phần chênh lệch trong 15 phút.");
      router.push(`/orders/${result.orderId}/pay`);
    });
  }

  function handleConfirm() {
    if (!target) return;
    if (!target.includesShirt) {
      submit();
      return;
    }
    setSizeRequest({
      comboName: target.name,
      quantity,
      confirmLabel: "Tiếp tục thanh toán",
      onConfirm: submit,
    });
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <ArrowUpCircle />
        Nâng cấp
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !isPending) setOpen(false);
        }}
      >
        <DialogPopup className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>NÂNG CẤP COMBO</DialogTitle>
            <DialogDescription>
              Đổi &quot;{comboName}&quot; sang combo có vé xem phim, chỉ trả phần chênh lệch.
              Combo cũ sẽ bị huỷ và thay bằng combo mới sau khi thanh toán.
            </DialogDescription>
          </DialogHeader>

          {targets.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Hiện chưa có combo có vé nào để nâng cấp.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-2" role="radiogroup" aria-label="Combo nâng cấp">
                {targets.map((t) => {
                  const soldOut = t.remainingQuantity < 1;
                  const selected = t.id === targetId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={soldOut || isPending}
                      onClick={() => {
                        setTargetId(t.id);
                        setQuantity((q) => Math.min(q, upgradableQuantity, t.remainingQuantity));
                      }}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors disabled:opacity-50",
                        selected
                          ? "border-accent bg-accent/10"
                          : "border-border hover:border-accent/60",
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium text-foreground">{t.name}</span>
                        <span className="shrink-0 text-sm font-semibold text-accent">
                          {soldOut ? "Hết hàng" : `+${formatVnd(t.diff)}`}
                        </span>
                      </div>
                      {t.contents.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t.contents.join(" · ")}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              {upgradableQuantity > 1 && (
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor={`upgrade-qty-${orderItemId}`}>
                    Số combo nâng cấp (tối đa {maxQuantity})
                  </Label>
                  <Input
                    id={`upgrade-qty-${orderItemId}`}
                    type="number"
                    min={1}
                    max={Math.max(maxQuantity, 1)}
                    value={quantity}
                    disabled={isPending}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setQuantity(Number.isNaN(v) ? 1 : Math.min(Math.max(v, 1), maxQuantity));
                    }}
                    className="w-16 text-center"
                  />
                </div>
              )}

              {target && (
                <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                  <span className="text-muted-foreground">Cần trả thêm</span>
                  <span className="text-lg font-semibold text-accent">
                    {formatVnd(target.diff * quantity)}
                  </span>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Lượt chọn ghế được tính theo thời điểm thanh toán nâng cấp.
              </p>

              <Button
                type="button"
                size="lg"
                disabled={!target || isPending || maxQuantity < 1}
                onClick={handleConfirm}
              >
                {isPending ? "Đang tạo đơn..." : "Nâng cấp & thanh toán"}
              </Button>
            </div>
          )}
        </DialogPopup>
      </Dialog>

      <ShirtSizeDialog
        request={sizeRequest}
        pending={isPending}
        onClose={() => setSizeRequest(null)}
      />
    </>
  );
}
