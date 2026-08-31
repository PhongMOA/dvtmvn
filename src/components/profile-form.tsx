"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/app/actions/profile";
import { AddressFields } from "@/components/address-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm({
  name,
  email,
  defaultPhone,
  defaultProvince,
  defaultDistrict,
  defaultAddress,
}: {
  name: string;
  email: string;
  defaultPhone: string;
  defaultProvince: string;
  defaultDistrict: string;
  defaultAddress: string;
}) {
  const [state, formAction, isPending] = useActionState(updateProfile, { error: null });

  // state là object mới mỗi lần action chạy xong (kể cả khi giá trị giống lần trước),
  // nên effect này luôn bắt được lần submit mới nhất — không fire ở lần mount đầu vì
  // state khởi tạo {error: null} không có success/warning.
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.warning) toast.warning(state.warning);
    else if (state.success) toast.success("Đã lưu thông tin tài khoản.");
  }, [state]);

  return (
    // key theo các default*: sau khi lưu thành công, action revalidate path khiến
    // server component cha fetch lại user và truyền defaultValue mới xuống trong khi
    // form vẫn đang mounted — Input (uncontrolled) sẽ báo lỗi "changing the default
    // value ... after being initialized". Đổi key buộc React remount lại như init mới.
    <form
      key={[defaultPhone, defaultProvince, defaultDistrict, defaultAddress].join("|")}
      action={formAction}
      className="mt-8 flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Họ tên</Label>
        <Input id="name" defaultValue={name} disabled />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" defaultValue={email} disabled />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">Số điện thoại</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={defaultPhone}
          placeholder="09xxxxxxxx"
          required
        />
      </div>
      <AddressFields
        idPrefix="profile"
        defaultProvince={defaultProvince}
        defaultDistrict={defaultDistrict}
        defaultAddress={defaultAddress}
      />
      <Button type="submit" size="lg" disabled={isPending} className="w-fit">
        {isPending ? "Đang lưu..." : "Lưu thay đổi"}
      </Button>
    </form>
  );
}
