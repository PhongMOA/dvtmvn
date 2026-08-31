"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { bookCombo } from "@/app/actions/booking";
import { updateProfile } from "@/app/actions/profile";
import { AddressFields } from "@/components/address-fields";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BookingForm({
  comboTypeId,
  remainingQuantity,
}: {
  comboTypeId: string;
  remainingQuantity: number;
}) {
  const [quantity, setQuantity] = useState(1);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Khác với ProfileModal toàn cục (chỉ nhắc nhẹ, tắt được) — modal này chặn
  // thật: chỉ xuất hiện khi bookCombo() từ chối vì thiếu SĐT/địa chỉ, và giữ
  // nguyên giá trị đã điền (nếu có) để user không phải gõ lại từ đầu.
  const [missingProfile, setMissingProfile] = useState<{
    phone: string;
    province: string;
    district: string;
    address: string;
  } | null>(null);
  const [isSavingProfile, startSavingProfile] = useTransition();

  const soldOut = remainingQuantity < 1;

  function submitBooking() {
    startTransition(async () => {
      const result = await bookCombo(comboTypeId, quantity);
      if (!result.ok) {
        if (result.error === "UNAUTHORIZED") {
          router.push(`/sign-in?callbackUrl=${encodeURIComponent("/")}`);
          return;
        }
        if (result.error === "MISSING_PROFILE") {
          setMissingProfile(
            result.profile ?? {
              phone: "",
              province: "",
              district: "",
              address: "",
            },
          );
          return;
        }
        toast.error(result.error);
        return;
      }
      toast.success("Đã giữ chỗ! Vui lòng chuyển khoản trong 15 phút để hoàn tất.");
      router.push(`/orders/${result.orderId}/pay`);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitBooking();
  }

  // Gọi trực tiếp server action updateProfile() (không qua useActionState) để
  // xử lý kết quả ngay trong sự kiện submit — tự đặt combo lại luôn sau khi
  // lưu hồ sơ thành công, user không phải bấm "Đặt combo" thêm lần nữa.
  function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startSavingProfile(async () => {
      const result = await updateProfile({ error: null }, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.warning) toast.warning(result.warning);
      else toast.success("Đã lưu thông tin liên hệ.");
      setMissingProfile(null);
      submitBooking();
    });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
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
            className="w-20"
          />
        </div>
        <Button type="submit" disabled={soldOut || isPending} className="flex-1">
          {soldOut ? "Hết hàng" : isPending ? "Đang đặt..." : "Đặt combo"}
        </Button>
      </form>

      <Dialog
        open={missingProfile !== null}
        onOpenChange={(next) => {
          if (!next) setMissingProfile(null);
        }}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>BỔ SUNG THÔNG TIN LIÊN HỆ</DialogTitle>
            <DialogDescription>
              Cần số điện thoại và địa chỉ để giao vé/combo mới đặt được. Điền
              xong hệ thống sẽ tự đặt lại combo này giúp bạn.
            </DialogDescription>
          </DialogHeader>
          {missingProfile && (
            // key theo các trường: tránh Base UI báo lỗi đổi defaultValue sau
            // khi Input đã init (cùng lý do với ProfileModalClient).
            <form
              key={[
                missingProfile.phone,
                missingProfile.province,
                missingProfile.district,
                missingProfile.address,
              ].join("|")}
              onSubmit={handleProfileSubmit}
              className="mt-4 flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`booking-phone-${comboTypeId}`}>
                  Số điện thoại
                </Label>
                <Input
                  id={`booking-phone-${comboTypeId}`}
                  name="phone"
                  type="tel"
                  defaultValue={missingProfile.phone}
                  placeholder="09xxxxxxxx"
                  required
                />
              </div>
              <AddressFields
                idPrefix={`booking-${comboTypeId}`}
                defaultProvince={missingProfile.province}
                defaultDistrict={missingProfile.district}
                defaultAddress={missingProfile.address}
              />
              <Button type="submit" disabled={isSavingProfile} className="w-fit">
                {isSavingProfile ? "Đang lưu..." : "Lưu & tiếp tục đặt combo"}
              </Button>
            </form>
          )}
        </DialogPopup>
      </Dialog>
    </>
  );
}
