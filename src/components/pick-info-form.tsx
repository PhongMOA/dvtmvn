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
  defaultProvince,
  defaultDistrict,
  defaultWard,
  defaultAddress,
}: {
  defaultName: string;
  defaultTel: string;
  defaultProvince: string;
  defaultDistrict: string;
  defaultWard: string;
  defaultAddress: string;
}) {
  const [state, formAction, isPending] = useActionState(updatePickInfo, {
    error: null,
  });

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.warning) toast.warning(state.warning);
    else if (state.success) toast.success("Đã lưu — GHTK xác nhận địa chỉ hợp lệ.");
  }, [state]);

  return (
    // key remount như ProfileForm: sau khi lưu, server component cha revalidate và
    // truyền defaultValue mới xuống trong khi form còn mounted -> Input uncontrolled
    // sẽ báo lỗi "changing the default value". Đổi key buộc React remount.
    <form
      key={[defaultName, defaultTel, defaultProvince, defaultDistrict, defaultWard, defaultAddress].join("|")}
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pickProvince">Tỉnh/Thành</Label>
          <Input
            id="pickProvince"
            name="pickProvince"
            defaultValue={defaultProvince}
            placeholder="VD: TP. Hồ Chí Minh"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pickDistrict">Quận/Huyện</Label>
          <Input
            id="pickDistrict"
            name="pickDistrict"
            defaultValue={defaultDistrict}
            placeholder="VD: Quận Ba Đình"
            required
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pickWard">Phường/Xã</Label>
        <Input
          id="pickWard"
          name="pickWard"
          defaultValue={defaultWard}
          placeholder="VD: Phường Gò Vấp"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pickAddress">Địa chỉ chi tiết</Label>
        <Input
          id="pickAddress"
          name="pickAddress"
          defaultValue={defaultAddress}
          placeholder="Số nhà, tên đường"
          required
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Tên Tỉnh/Thành và Quận/Huyện phải khớp cách gọi của GHTK (vd &quot;Hà Nội&quot;,
        &quot;TP. Hồ Chí Minh&quot;, &quot;Quận Ba Đình&quot;). Khi bấm lưu, hệ thống
        gọi GHTK kiểm tra địa chỉ có giao được không.
      </p>
      <Button type="submit" size="lg" disabled={isPending} className="w-fit">
        {isPending ? "Đang kiểm tra & lưu..." : "Lưu thay đổi"}
      </Button>
    </form>
  );
}
