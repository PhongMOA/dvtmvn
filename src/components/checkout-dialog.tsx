"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CheckoutProfile } from "@/app/actions/booking";
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
 */
export function CheckoutDialog({
  checkout,
  onClose,
}: {
  checkout: PendingCheckout | null;
  onClose: () => void;
}) {
  const router = useRouter();

  return (
    <Dialog
      open={checkout !== null}
      onOpenChange={(next) => {
        // Đóng modal = bỏ ngang: đơn pending tự hết hạn sau 15' và hoàn kho
        // (expireStaleOrdersForCombos); khách vẫn có thể "Tiếp tục thanh toán"
        // từ /my-tickets trong thời gian đó.
        if (!next) onClose();
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
