"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  prepareCheckout,
  type CheckoutProfile,
  type PrepareCheckoutResult,
} from "@/app/actions/booking";
import { AddressFields } from "@/components/address-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

type Summary = Extract<PrepareCheckoutResult, { ok: true }>;

/**
 * UI 2 bước dùng chung cho việc chốt đơn combo trước khi thanh toán:
 *   1. Xác nhận thông tin nhận hàng (sửa được địa chỉ) → gọi prepareCheckout
 *      (validate + tính phí ship GHTK + snapshot vào Order).
 *   2. Tóm tắt: tiền combo + phí ship + tổng cộng → bấm "Thanh toán ngay".
 *
 * Dùng ở 2 nơi:
 *   - modal trong BookingForm (variant="dialog") — onProceed điều hướng sang
 *     /orders/[id]/pay.
 *   - inline trên pay page (variant="page") khi đơn pending chưa có snapshot —
 *     onProceed gọi router.refresh() để hiện khối QR.
 */
export function ShippingCheckout({
  orderId,
  variant,
  defaultProfile,
  onProceed,
}: {
  orderId: string;
  variant: "dialog" | "page";
  defaultProfile: CheckoutProfile;
  onProceed: () => void;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await prepareCheckout(orderId, formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSummary(result);
    });
  }

  const gap = variant === "page" ? "gap-4" : "gap-4";

  if (summary) {
    return (
      <div className={`flex flex-col ${gap}`}>
        <dl className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-left text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Tiền combo</dt>
            <dd className="font-medium text-foreground">
              {formatVnd(summary.comboTotal)}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Phí ship (GHTK)</dt>
            <dd className="font-medium text-foreground">
              {formatVnd(summary.shipFee)}
            </dd>
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
            <dt className="font-semibold text-foreground">Tổng cộng</dt>
            <dd className="text-base font-semibold text-accent">
              {formatVnd(summary.total)}
            </dd>
          </div>
        </dl>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setSummary(null)}
            disabled={isPending}
          >
            Quay lại
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={onProceed}
            disabled={isPending}
          >
            Thanh toán ngay
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      key={[
        defaultProfile.name,
        defaultProfile.phone,
        defaultProfile.province,
        defaultProfile.district,
        defaultProfile.ward,
        defaultProfile.address,
      ].join("|")}
      onSubmit={handleConfirm}
      className={`flex flex-col ${gap} text-left`}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`checkout-name-${orderId}`}>Người nhận</Label>
        <Input
          id={`checkout-name-${orderId}`}
          name="name"
          defaultValue={defaultProfile.name}
          placeholder="Họ tên người nhận hàng"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`checkout-phone-${orderId}`}>Số điện thoại</Label>
        <Input
          id={`checkout-phone-${orderId}`}
          name="phone"
          type="tel"
          defaultValue={defaultProfile.phone}
          placeholder="09xxxxxxxx"
          required
        />
      </div>
      <AddressFields
        idPrefix={`checkout-${orderId}`}
        defaultProvince={defaultProfile.province}
        defaultDistrict={defaultProfile.district}
        defaultWard={defaultProfile.ward}
        defaultAddress={defaultProfile.address}
      />
      <p className="text-xs text-muted-foreground">
        Tên Tỉnh/Thành cần khớp cách gọi của GHTK (vd &quot;Hà Nội&quot;, &quot;TP.
        Hồ Chí Minh&quot;). Hệ thống sẽ tính phí ship theo địa chỉ này.
      </p>
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Đang tính phí ship..." : "Tiếp tục"}
      </Button>
    </form>
  );
}
