"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm({
  name,
  email,
  defaultPhone,
  defaultAddress,
}: {
  name: string;
  email: string;
  defaultPhone: string;
  defaultAddress: string;
}) {
  const [state, formAction, isPending] = useActionState(updateProfile, { error: null });

  // state là object mới mỗi lần action chạy xong (kể cả khi giá trị giống lần trước),
  // nên effect này luôn bắt được lần submit mới nhất — không fire ở lần mount đầu vì
  // state khởi tạo {error: null} không có success.
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.success) toast.success("Đã lưu thông tin tài khoản.");
  }, [state]);

  return (
    // key theo defaultPhone/defaultAddress: sau khi lưu thành công, action revalidate
    // path khiến server component cha fetch lại user và truyền defaultValue mới xuống
    // trong khi form vẫn đang mounted — Input (uncontrolled, dùng defaultValue) sẽ báo
    // lỗi "changing the default value state ... after being initialized" nếu re-render
    // tại chỗ. Đổi key buộc React remount lại toàn bộ form như một lần init mới, tránh lỗi.
    <form
      key={`${defaultPhone}-${defaultAddress}`}
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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="address">Địa chỉ</Label>
        <Input
          id="address"
          name="address"
          defaultValue={defaultAddress}
          placeholder="Số nhà, đường, quận/huyện, tỉnh/thành"
          required
        />
      </div>
      <Button type="submit" size="lg" disabled={isPending} className="w-fit">
        {isPending ? "Đang lưu..." : "Lưu thay đổi"}
      </Button>
    </form>
  );
}
