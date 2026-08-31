"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updatePickInfo } from "@/app/actions/shop-setting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PickInfoForm({
  defaultName,
  defaultTel,
  defaultAddress,
}: {
  defaultName: string;
  defaultTel: string;
  defaultAddress: string;
}) {
  const [state, formAction, isPending] = useActionState(updatePickInfo, {
    error: null,
  });

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.success) toast.success("Đã lưu thông tin kho lấy hàng.");
  }, [state]);

  return (
    // key remount như ProfileForm: sau khi lưu, server component cha revalidate và
    // truyền defaultValue mới xuống trong khi form còn mounted -> Input uncontrolled
    // sẽ báo lỗi "changing the default value". Đổi key buộc React remount.
    <form
      key={`${defaultName}-${defaultTel}-${defaultAddress}`}
      action={formAction}
      className="mt-4 flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pickName">Tên người gửi</Label>
        <Input
          id="pickName"
          name="pickName"
          defaultValue={defaultName}
          placeholder="VD: MarvelVN Store"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pickTel">Số điện thoại</Label>
        <Input
          id="pickTel"
          name="pickTel"
          type="tel"
          defaultValue={defaultTel}
          placeholder="09xxxxxxxx"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pickAddress">Địa chỉ lấy hàng</Label>
        <Input
          id="pickAddress"
          name="pickAddress"
          defaultValue={defaultAddress}
          placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
          required
        />
      </div>
      <Button type="submit" size="lg" disabled={isPending} className="w-fit">
        {isPending ? "Đang lưu..." : "Lưu thay đổi"}
      </Button>
    </form>
  );
}
