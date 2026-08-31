"use client";

import { useRouter } from "next/navigation";
import { ShippingCheckout } from "@/components/shipping-checkout";
import type { CheckoutProfile } from "@/app/actions/booking";

/**
 * Bọc <ShippingCheckout> cho pay page (server component): khi đơn pending chưa
 * có snapshot địa chỉ/phí ship, bắt khách xác nhận tại chỗ rồi router.refresh()
 * để trang hiện lại khối QR với số tiền đã gồm phí ship.
 */
export function PayCheckoutGate({
  orderId,
  defaultProfile,
}: {
  orderId: string;
  defaultProfile: CheckoutProfile;
}) {
  const router = useRouter();
  return (
    <ShippingCheckout
      orderId={orderId}
      variant="page"
      defaultProfile={defaultProfile}
      onProceed={() => router.refresh()}
    />
  );
}
