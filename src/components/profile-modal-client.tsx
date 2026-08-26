"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/app/actions/profile";
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

export function ProfileModalClient({
  needsProfile,
  defaultPhone,
  defaultAddress,
}: {
  needsProfile: boolean;
  defaultPhone: string;
  defaultAddress: string;
}) {
  // Chỉ tự tắt tạm thời cho phiên hiện tại — không có gì được lưu khi tắt, nên
  // "open" luôn tính lại từ needsProfile (dữ liệu DB thật) kết hợp với dismissed
  // (local, mất khi reload). Nhờ vậy: user tắt modal thì nó biến mất ngay, nhưng
  // reload/đăng nhập phiên sau vẫn hiện lại cho tới khi hồ sơ thực sự đầy đủ.
  const [dismissed, setDismissed] = useState(false);
  const [state, formAction, isPending] = useActionState(updateProfile, { error: null });

  // Đặt trước early-return để không phá Rules of Hooks (hook phải chạy đều mỗi render).
  useEffect(() => {
    if (state.error) toast.error(state.error);
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
            Vui lòng bổ sung số điện thoại và địa chỉ để chúng tôi liên hệ khi
            giao vé/combo. Bạn có thể tắt hộp thoại này, nhưng nó sẽ tiếp tục
            hiện lại cho tới khi bạn điền đủ thông tin.
          </DialogDescription>
        </DialogHeader>
        {/* key theo defaultPhone/defaultAddress: cùng lý do với ProfileForm — tránh Base UI
            báo lỗi "changing the default value state ... after being initialized" khi
            server component cha truyền defaultValue mới xuống trong lúc modal vẫn mounted
            (vd chỉ 1 trong 2 trường được set trước đó). */}
        <form
          key={`${defaultPhone}-${defaultAddress}`}
          action={formAction}
          className="mt-4 flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="modal-phone">Số điện thoại</Label>
            <Input
              id="modal-phone"
              name="phone"
              type="tel"
              defaultValue={defaultPhone}
              placeholder="09xxxxxxxx"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="modal-address">Địa chỉ</Label>
            <Input
              id="modal-address"
              name="address"
              defaultValue={defaultAddress}
              placeholder="Số nhà, đường, quận/huyện, tỉnh/thành"
              required
            />
          </div>
          <Button type="submit" disabled={isPending} className="w-fit">
            {isPending ? "Đang lưu..." : "Lưu thông tin"}
          </Button>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
