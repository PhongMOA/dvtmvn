"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";
import { bookCombos } from "@/app/actions/booking";
import { CheckoutDialog, type PendingCheckout } from "@/components/checkout-dialog";
import { ShirtSizeDialog, type ShirtSizeRequest } from "@/components/shirt-size-dialog";
import { addToCart, useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ShirtSizes } from "@/lib/shirt-sizes";

/**
 * Chọn số lượng 1 combo rồi:
 *   - "Thêm vào giỏ": cộng vào giỏ hàng (localStorage) để gom nhiều loại combo
 *     và thanh toán 1 lần ở /cart.
 *   - "Đặt ngay": giữ chỗ riêng combo này luôn (bỏ qua giỏ hàng).
 * Combo không kèm vé: cả 2 nút hiện modal cảnh báo trước, khách xác nhận mới đi tiếp.
 * Combo có áo: cả 2 nút mở modal chọn size trước (tổng áo = số lượng).
 */
export function BookingForm({
  comboTypeId,
  comboName,
  remainingQuantity,
  includesShirt = false,
  includesTicket = true,
}: {
  comboTypeId: string;
  comboName: string;
  remainingQuantity: number;
  includesShirt?: boolean;
  includesTicket?: boolean;
}) {
  const [quantity, setQuantity] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [checkout, setCheckout] = useState<PendingCheckout | null>(null);
  const [sizeRequest, setSizeRequest] = useState<ShirtSizeRequest | null>(null);
  // Bước tiếp theo sau khi khách xác nhận cảnh báo "combo không kèm vé".
  const [noTicketNext, setNoTicketNext] = useState<(() => void) | null>(null);
  const router = useRouter();
  const cart = useCart();

  const soldOut = remainingQuantity < 1;
  const inCart = cart.find((line) => line.comboTypeId === comboTypeId)?.quantity ?? 0;

  function handleAddToCart() {
    if (inCart >= remainingQuantity) {
      toast.error(`Giỏ hàng đã có ${inCart} — combo này chỉ còn ${remainingQuantity}.`);
      return;
    }
    withNoTicketNotice(continueAddToCart);
  }

  function continueAddToCart() {
    if (!includesShirt) {
      addLineToCart();
      return;
    }
    // Combo có áo không cắt bớt số lượng được (lệch tổng size) -> chặn trước.
    if (inCart + quantity > remainingQuantity) {
      toast.error(
        `Giỏ hàng đã có ${inCart} — chỉ thêm được tối đa ${remainingQuantity - inCart}.`,
      );
      return;
    }
    setSizeRequest({
      comboName,
      quantity,
      confirmLabel: "Thêm vào giỏ",
      onConfirm: (sizes) => {
        setSizeRequest(null);
        addLineToCart(sizes);
      },
    });
  }

  function addLineToCart(sizes?: ShirtSizes) {
    const next = addToCart(comboTypeId, quantity, remainingQuantity, sizes);
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
    withNoTicketNotice(continueBuyNow);
  }

  function withNoTicketNotice(next: () => void) {
    if (includesTicket) next();
    else setNoTicketNext(() => next);
  }

  function continueBuyNow() {
    if (!includesShirt) {
      buyNow();
      return;
    }
    setSizeRequest({
      comboName,
      quantity,
      confirmLabel: "Đặt ngay",
      onConfirm: buyNow,
    });
  }

  function buyNow(sizes?: ShirtSizes) {
    startTransition(async () => {
      const result = await bookCombos([{ comboTypeId, quantity, sizes }]);
      setSizeRequest(null);
      if (!result.ok) {
        if (result.error === "UNAUTHORIZED") {
          router.push(`/sign-in?callbackUrl=${encodeURIComponent("/")}`);
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
      </form>

      <Dialog
        open={noTicketNext !== null}
        onOpenChange={(open) => {
          if (!open) setNoTicketNext(null);
        }}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>LƯU Ý TRƯỚC KHI MUA</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Combo này <strong className="text-foreground">không bao gồm vé offline xem phim</strong>{" "}
              - Cân nhắc kỹ trước khi mua combo này.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setNoTicketNext(null)}
            >
              Để tôi xem lại
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={() => {
                const next = noTicketNext;
                setNoTicketNext(null);
                next?.();
              }}
            >
              Tôi đã hiểu, tiếp tục
            </Button>
          </div>
        </DialogPopup>
      </Dialog>
      <ShirtSizeDialog
        request={sizeRequest}
        pending={isPending}
        onClose={() => setSizeRequest(null)}
      />
      <CheckoutDialog checkout={checkout} onClose={() => setCheckout(null)} />
    </>
  );
}
