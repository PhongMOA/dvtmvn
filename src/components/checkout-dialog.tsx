"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelPendingOrder, type CheckoutProfile } from "@/app/actions/booking";
import { ShippingCheckout } from "@/components/shipping-checkout";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export type PendingCheckout = { orderId: string; profile: CheckoutProfile };

/**
 * Modal "xác nhận thông tin nhận hàng" sau khi bookCombos() giữ chỗ thành công
 * → bước tóm tắt phí ship → điều hướng sang trang thanh toán. Dùng chung cho nút
 * "Đặt ngay" (BookingForm) và nút "Đặt hàng" của giỏ hàng (CartView).
 *
 * Đóng modal trước khi bấm "Thanh toán ngay" = huỷ đặt: đơn pending bị nhả ngay
 * (hoàn kho), không nằm lại ở "Chờ thanh toán". `onPay` chỉ chạy khi khách bấm
 * "Thanh toán ngay" (giỏ hàng dùng để xoá giỏ đúng lúc đó).
 */
export function CheckoutDialog({
  checkout,
  onClose,
  onPay,
}: {
  checkout: PendingCheckout | null;
  onClose: () => void;
  onPay?: () => void;
}) {
  const router = useRouter();
  // Đã bấm "Thanh toán ngay" → đang điều hướng sang trang thanh toán; không huỷ
  // đơn nếu modal bị đóng trong lúc chuyển trang.
  const payingRef = useRef(false);

  return (
    <Dialog
      open={checkout !== null}
      onOpenChange={(next) => {
        if (next || !checkout) return;
        if (!payingRef.current) {
          void cancelPendingOrder(checkout.orderId).then(() => router.refresh());
        }
        onClose();
      }}
    >
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>XÁC NHẬN THÔNG TIN NHẬN HÀNG</DialogTitle>
          <DialogDescription>
            Kiểm tra/sửa địa chỉ nhận combo. Bấm &quot;Tiếp tục&quot; để xem phí
            ship và tổng tiền trước khi thanh toán. Đơn được giữ chỗ trong 15
            phút.
          </DialogDescription>
        </DialogHeader>
        {checkout && (
          <div className="mt-4">
            <ShippingCheckout
              orderId={checkout.orderId}
              variant="dialog"
              defaultProfile={checkout.profile}
              onProceed={() => {
                payingRef.current = true;
                onPay?.();
                toast.success(
                  "Đã giữ chỗ! Vui lòng chuyển khoản trong 15 phút để hoàn tất.",
                );
                router.push(`/orders/${checkout.orderId}/pay`);
              }}
            />
          </div>
        )}
      </DialogPopup>
    </Dialog>
  );
}
