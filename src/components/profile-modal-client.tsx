"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/app/actions/profile";
import {
  AddressFields,
  MISSING_INPUT_CLASS,
  MissingHint,
} from "@/components/address-fields";
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

const REQUIRED_FIELDS = [
  ["name", "Họ tên"],
  ["phone", "Số điện thoại"],
  ["province", "Tỉnh/Thành phố"],
  ["ward", "Phường/Xã"],
  ["address", "Địa chỉ chi tiết"],
] as const;
type RequiredField = (typeof REQUIRED_FIELDS)[number][0];

export function ProfileModalClient({
  needsProfile,
  defaultName,
  defaultFacebookUrl,
  defaultPhone,
  defaultProvince,
  defaultDistrict,
  defaultWard,
  defaultAddress,
}: {
  needsProfile: boolean;
  defaultName: string;
  defaultFacebookUrl: string;
  defaultPhone: string;
  defaultProvince: string;
  defaultDistrict: string;
  defaultWard: string;
  defaultAddress: string;
}) {
  // Chỉ tự tắt tạm thời cho phiên hiện tại — không có gì được lưu khi tắt, nên
  // "open" luôn tính lại từ needsProfile (dữ liệu DB thật) kết hợp với dismissed
  // (local, mất khi reload). Nhờ vậy: user tắt modal thì nó biến mất ngay, nhưng
  // reload/đăng nhập phiên sau vẫn hiện lại cho tới khi hồ sơ thực sự đầy đủ.
  const [dismissed, setDismissed] = useState(false);
  const [state, formAction, isPending] = useActionState(updateProfile, { error: null });
  // Ô bắt buộc nào đang trống -> highlight nhẹ để user biết cần điền gì cho modal
  // thôi hiện. Khởi tạo từ dữ liệu DB, cập nhật live khi gõ (onChange của form).
  // Quận/Huyện tuỳ chọn nên không có ở đây.
  const [values, setValues] = useState<Record<RequiredField, string>>({
    name: defaultName,
    phone: defaultPhone,
    province: defaultProvince,
    ward: defaultWard,
    address: defaultAddress,
  });
  const missing = Object.fromEntries(
    REQUIRED_FIELDS.map(([field]) => [field, !values[field].trim()]),
  ) as Record<RequiredField, boolean>;
  const missingLabels = REQUIRED_FIELDS.filter(([field]) => missing[field]).map(
    ([, label]) => label,
  );

  // Đặt trước early-return để không phá Rules of Hooks (hook phải chạy đều mỗi render).
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.warning) toast.warning(state.warning);
    else if (state.success) toast.success("Cảm ơn bạn! Thông tin liên hệ đã được lưu.");
  }, [state]);

  if (!needsProfile) return null;

  const open = !dismissed;

  return (
    <Dialog open={open} onOpenChange={(next) => setDismissed(!next)}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>BỔ SUNG THÔNG TIN LIÊN HỆ</DialogTitle>
          <DialogDescription>
            Vui lòng bổ sung số điện thoại và địa chỉ giao hàng để chúng tôi liên
            hệ khi giao vé/combo. Bạn có thể tắt hộp thoại này, nhưng nó sẽ tiếp
            tục hiện lại cho tới khi bạn điền đủ thông tin.
          </DialogDescription>
        </DialogHeader>
        {/* key theo các default*: cùng lý do với ProfileForm — tránh Base UI báo lỗi
            "changing the default value state ... after being initialized" khi server
            component cha truyền defaultValue mới xuống trong lúc modal vẫn mounted. */}
        <form
          key={[defaultName, defaultFacebookUrl, defaultPhone, defaultProvince, defaultDistrict, defaultWard, defaultAddress].join("|")}
          action={formAction}
          onChange={(e) => {
            const target = e.target;
            if (
              target instanceof HTMLInputElement &&
              REQUIRED_FIELDS.some(([field]) => field === target.name)
            ) {
              setValues((prev) => ({ ...prev, [target.name]: target.value }));
            }
          }}
          className="mt-4 flex flex-col gap-4"
        >
          {missingLabels.length > 0 && (
            <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
              Còn thiếu:{" "}
              <span className="font-medium text-primary">{missingLabels.join(", ")}</span>
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="modal-name">
              Họ tên <MissingHint show={missing.name} />
            </Label>
            <Input
              id="modal-name"
              name="name"
              defaultValue={defaultName}
              maxLength={100}
              className={missing.name ? MISSING_INPUT_CLASS : undefined}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="modal-phone">
              Số điện thoại <MissingHint show={missing.phone} />
            </Label>
            <Input
              id="modal-phone"
              name="phone"
              type="tel"
              defaultValue={defaultPhone}
              placeholder="09xxxxxxxx"
              className={missing.phone ? MISSING_INPUT_CLASS : undefined}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="modal-facebookUrl">
              Link Facebook{" "}
              <span className="font-normal text-muted-foreground">(tuỳ chọn)</span>
            </Label>
            <Input
              id="modal-facebookUrl"
              name="facebookUrl"
              inputMode="url"
              defaultValue={defaultFacebookUrl}
              placeholder="https://facebook.com/ten.cua.ban"
              maxLength={200}
            />
          </div>
          <AddressFields
            idPrefix="modal"
            defaultProvince={defaultProvince}
            defaultDistrict={defaultDistrict}
            defaultWard={defaultWard}
            defaultAddress={defaultAddress}
            highlight={missing}
          />
          <Button type="submit" disabled={isPending} className="w-fit">
            {isPending ? "Đang lưu..." : "Lưu thông tin"}
          </Button>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
