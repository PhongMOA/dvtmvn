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
import { cn } from "@/lib/utils";

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

type Summary = Extract<PrepareCheckoutResult, { ok: true }>;

function isProfileComplete(p: CheckoutProfile): boolean {
  return Boolean(
    p.phone && p.province && p.district && p.ward && p.address,
  );
}

/**
 * UI 2 bước dùng chung cho việc chốt đơn combo trước khi thanh toán:
 *   1. Chọn địa chỉ nhận hàng — mặc định dùng địa chỉ trong hồ sơ, hoặc chọn
 *      "Giao địa chỉ khác" để nhập tay → gọi prepareCheckout (validate + tính
 *      phí ship GHTK + snapshot vào Order).
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
  const profileComplete = isProfileComplete(defaultProfile);
  const [mode, setMode] = useState<"profile" | "other">(
    profileComplete ? "profile" : "other",
  );
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (mode === "profile") {
      formData.set("name", defaultProfile.name);
      formData.set("phone", defaultProfile.phone);
      formData.set("province", defaultProfile.province);
      formData.set("district", defaultProfile.district);
      formData.set("ward", defaultProfile.ward);
      formData.set("address", defaultProfile.address);
    }
    startTransition(async () => {
      const result = await prepareCheckout(orderId, formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSummary(result);
    });
  }

  if (summary) {
    return (
      <div className="flex flex-col gap-4">
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

  const profileLine = [
    defaultProfile.address,
    defaultProfile.ward,
    defaultProfile.district,
    defaultProfile.province,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <form
      onSubmit={handleConfirm}
      className={cn(
        "flex flex-col text-left",
        variant === "page" ? "gap-4" : "gap-3",
      )}
    >
      <label
        className={cn(
          "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm",
          mode === "profile"
            ? "border-accent bg-accent/5"
            : "border-border",
          !profileComplete && "cursor-not-allowed opacity-60",
        )}
      >
        <input
          type="radio"
          name="ship-mode"
          value="profile"
          checked={mode === "profile"}
          disabled={!profileComplete}
          onChange={() => setMode("profile")}
          className="mt-0.5 accent-accent"
        />
        <span className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">
            Giao tới địa chỉ trong hồ sơ
          </span>
          {profileComplete ? (
            <span className="text-muted-foreground">
              {defaultProfile.name || "—"} · {defaultProfile.phone}
              <br />
              {profileLine}
            </span>
          ) : (
            <span className="text-muted-foreground">
              Hồ sơ chưa có đủ địa chỉ — chọn &quot;Giao địa chỉ khác&quot; để nhập.
            </span>
          )}
        </span>
      </label>

      <label
        className={cn(
          "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm",
          mode === "other" ? "border-accent bg-accent/5" : "border-border",
        )}
      >
        <input
          type="radio"
          name="ship-mode"
          value="other"
          checked={mode === "other"}
          onChange={() => setMode("other")}
          className="mt-0.5 accent-accent"
        />
        <span className="font-medium text-foreground">Giao địa chỉ khác</span>
      </label>

      {mode === "other" && (
        <div className="flex flex-col gap-4 rounded-lg border border-border p-3">
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
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending || (mode === "profile" && !profileComplete)}
        className="w-full"
      >
        {isPending ? "Đang tính phí ship..." : "Tiếp tục"}
      </Button>
    </form>
  );
}
