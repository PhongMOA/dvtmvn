"use client";

import { useSyncExternalStore, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus, Trash2 } from "lucide-react";
import { bookCombos } from "@/app/actions/booking";
import { CheckoutDialog, type PendingCheckout } from "@/components/checkout-dialog";
import {
  clearCart,
  removeFromCart,
  setCartQuantity,
  useCart,
} from "@/lib/cart";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CartCombo = {
  id: string;
  name: string;
  eventTitle: string;
  price: number;
  originalPrice: number | null;
  remainingQuantity: number;
  contents: string[];
};

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

const noopSubscribe = () => () => {};

export function CartView({ combos }: { combos: CartCombo[] }) {
  const cart = useCart();
  // Giỏ đọc từ localStorage — server render luôn thấy giỏ rỗng; chờ hydrate xong
  // mới hiện để không chớp "Giỏ hàng trống".
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [isPending, startTransition] = useTransition();
  const [checkout, setCheckout] = useState<PendingCheckout | null>(null);
  const router = useRouter();

  const comboById = new Map(combos.map((combo) => [combo.id, combo]));
  const lines = cart.map((line) => ({
    ...line,
    combo: comboById.get(line.comboTypeId) ?? null,
  }));
  const available = lines.filter(
    (line): line is typeof line & { combo: CartCombo } => line.combo !== null,
  );
  const unavailableCount = lines.length - available.length;
  const overStock = available.filter(
    (line) => line.quantity > line.combo.remainingQuantity,
  );
  const subtotal = available.reduce(
    (sum, line) => sum + line.combo.price * line.quantity,
    0,
  );
  const totalQuantity = available.reduce((sum, line) => sum + line.quantity, 0);

  function handleCheckout() {
    startTransition(async () => {
      const result = await bookCombos(
        available.map(({ comboTypeId, quantity }) => ({ comboTypeId, quantity })),
      );
      if (!result.ok) {
        if (result.error === "UNAUTHORIZED") {
          router.push(`/sign-in?callbackUrl=${encodeURIComponent("/cart")}`);
          return;
        }
        if (result.error === "MISSING_FACEBOOK") {
          toast.error("Vui lòng bổ sung link Facebook trước khi đặt combo.", {
            action: { label: "Cập nhật", onClick: () => router.push("/profile") },
          });
          return;
        }
        toast.error(result.error);
        router.refresh(); // lấy lại tồn kho mới nhất
        return;
      }
      // Đơn đã giữ chỗ -> làm trống giỏ (nếu khách đóng modal, đơn vẫn nằm ở
      // "Vé của tôi" để tiếp tục thanh toán; đặt lại từ giỏ sẽ giữ chỗ trùng).
      clearCart();
      setCheckout({ orderId: result.orderId, profile: result.profile });
    });
  }

  if (!hydrated) {
    return <div className="h-40 animate-pulse rounded-lg border border-border bg-card" />;
  }

  if (lines.length === 0) {
    return (
      <>
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">Giỏ hàng trống.</p>
          <Link href="/" className={cn(buttonVariants(), "mt-4")}>
            Chọn combo
          </Link>
        </div>
        <CheckoutDialog checkout={checkout} onClose={() => setCheckout(null)} />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-3">
        {lines.map((line) =>
          line.combo ? (
            <li
              key={line.comboTypeId}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  {line.combo.eventTitle}
                </p>
                <p className="font-heading text-lg tracking-wide text-foreground">
                  {line.combo.name}
                </p>
                <p className="text-sm">
                  <span className="font-medium text-accent">
                    {formatVnd(line.combo.price)}
                  </span>
                  {line.combo.originalPrice && (
                    <span className="ml-2 text-muted-foreground line-through">
                      {formatVnd(line.combo.originalPrice)}
                    </span>
                  )}
                </p>
                {line.combo.contents.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {line.combo.contents.join(" · ")}
                  </p>
                )}
                {line.quantity > line.combo.remainingQuantity && (
                  <p className="mt-1 text-xs font-medium text-destructive">
                    {line.combo.remainingQuantity < 1
                      ? "Combo đã hết hàng — xoá khỏi giỏ để tiếp tục."
                      : `Chỉ còn ${line.combo.remainingQuantity} — giảm số lượng để tiếp tục.`}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Giảm số lượng"
                    disabled={isPending || line.quantity <= 1}
                    onClick={() => setCartQuantity(line.comboTypeId, line.quantity - 1)}
                  >
                    <Minus />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={Math.max(line.combo.remainingQuantity, 1)}
                    value={line.quantity}
                    disabled={isPending}
                    aria-label={`Số lượng ${line.combo.name}`}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isNaN(v)) return;
                      setCartQuantity(
                        line.comboTypeId,
                        Math.min(Math.max(v, 1), Math.max(line.combo!.remainingQuantity, 1)),
                      );
                    }}
                    className="w-14 text-center"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Tăng số lượng"
                    disabled={
                      isPending || line.quantity >= line.combo.remainingQuantity
                    }
                    onClick={() => setCartQuantity(line.comboTypeId, line.quantity + 1)}
                  >
                    <Plus />
                  </Button>
                </div>
                <span className="w-28 text-right font-medium tabular-nums text-foreground">
                  {formatVnd(line.combo.price * line.quantity)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Xoá ${line.combo.name} khỏi giỏ`}
                  disabled={isPending}
                  onClick={() => removeFromCart(line.comboTypeId)}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ) : (
            <li
              key={line.comboTypeId}
              className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground"
            >
              Combo này không còn bán ({line.quantity}).
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => removeFromCart(line.comboTypeId)}
              >
                Xoá
              </Button>
            </li>
          ),
        )}
      </ul>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Tạm tính ({totalQuantity} combo)
          </span>
          <span className="text-lg font-semibold text-accent">
            {formatVnd(subtotal)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Phí ship GHTK được tính ở bước tiếp theo, sau khi xác nhận địa chỉ nhận hàng.
        </p>
        {unavailableCount > 0 && (
          <p className="text-xs text-muted-foreground">
            Combo không còn bán sẽ không được đặt.
          </p>
        )}
        <Button
          type="button"
          size="lg"
          disabled={isPending || available.length === 0 || overStock.length > 0}
          onClick={handleCheckout}
        >
          {isPending ? "Đang giữ chỗ..." : "Đặt hàng"}
        </Button>
      </div>

      <CheckoutDialog checkout={checkout} onClose={() => setCheckout(null)} />
    </div>
  );
}
