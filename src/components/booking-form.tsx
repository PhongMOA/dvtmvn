"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";
import { bookCombos } from "@/app/actions/booking";
import { CheckoutDialog, type PendingCheckout } from "@/components/checkout-dialog";
import { addToCart, useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Chọn số lượng 1 combo rồi:
 *   - "Thêm vào giỏ": cộng vào giỏ hàng (localStorage) để gom nhiều loại combo
 *     và thanh toán 1 lần ở /cart.
 *   - "Đặt ngay": giữ chỗ riêng combo này luôn (bỏ qua giỏ hàng).
 */
export function BookingForm({
  comboTypeId,
  comboName,
  remainingQuantity,
}: {
  comboTypeId: string;
  comboName: string;
  remainingQuantity: number;
}) {
  const [quantity, setQuantity] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [checkout, setCheckout] = useState<PendingCheckout | null>(null);
  const router = useRouter();
  const cart = useCart();

  const soldOut = remainingQuantity < 1;
  const inCart = cart.find((line) => line.comboTypeId === comboTypeId)?.quantity ?? 0;

  function handleAddToCart() {
    if (inCart >= remainingQuantity) {
      toast.error(`Giỏ hàng đã có ${inCart} — combo này chỉ còn ${remainingQuantity}.`);
      return;
    }
    const next = addToCart(comboTypeId, quantity, remainingQuantity);
    const added = next - inCart;
    toast.success(
      added < quantity
        ? `Chỉ thêm được ${added} "${comboName}" (còn ${remainingQuantity}).`
        : `Đã thêm ${added} "${comboName}" vào giỏ.`,
      { action: { label: "Xem giỏ", onClick: () => router.push("/cart") } },
    );
  }

  function handleBuyNow(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await bookCombos([{ comboTypeId, quantity }]);
      if (!result.ok) {
        if (result.error === "UNAUTHORIZED") {
          router.push(`/sign-in?callbackUrl=${encodeURIComponent("/")}`);
          return;
        }
        if (result.error === "MISSING_FACEBOOK") {
          toast.error("Vui lòng bổ sung link Facebook trước khi đặt combo.", {
            action: { label: "Cập nhật", onClick: () => router.push("/profile") },
          });
          return;
        }
        toast.error(result.error);
        return;
      }
      setCheckout({ orderId: result.orderId, profile: result.profile });
    });
  }

  return (
    <>
      <form onSubmit={handleBuyNow} className="flex flex-col gap-2">
        <div className="flex items-end gap-2">
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
              className="w-16"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={soldOut || isPending}
            onClick={handleAddToCart}
            className="flex-1"
          >
            <ShoppingCart />
            Thêm vào giỏ
          </Button>
          <Button type="submit" disabled={soldOut || isPending} className="flex-1">
            {soldOut ? "Hết hàng" : isPending ? "Đang đặt..." : "Đặt ngay"}
          </Button>
        </div>
        {inCart > 0 && (
          <p className="text-xs text-muted-foreground">
            Đã có {inCart} trong giỏ hàng.
          </p>
        )}
      </form>

      <CheckoutDialog checkout={checkout} onClose={() => setCheckout(null)} />
    </>
  );
}
