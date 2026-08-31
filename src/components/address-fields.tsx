"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Các ô địa chỉ giao hàng dùng chung cho form hồ sơ, modal bổ sung liên hệ và
 * bước xác nhận lúc đặt combo. Chỉ là fragment (không phải <form>) — component
 * cha bọc <form> và xử lý submit. Tên field: province / district / ward / address.
 *
 * MVP: khi lưu, server chỉ validate được cấp Tỉnh/Thành qua GHTK (xem
 * src/lib/ghtk.ts). Quận/Huyện + Phường/Xã thu dạng text tự do — cần để tính phí
 * và tạo đơn ship GHTK (GHTK bắt buộc có Phường/Xã khi tạo đơn).
 */
export function AddressFields({
  idPrefix,
  defaultProvince,
  defaultDistrict,
  defaultWard,
  defaultAddress,
}: {
  idPrefix: string;
  defaultProvince: string;
  defaultDistrict: string;
  defaultWard: string;
  defaultAddress: string;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-province`}>Tỉnh/Thành</Label>
          <Input
            id={`${idPrefix}-province`}
            name="province"
            defaultValue={defaultProvince}
            placeholder="VD: TP. Hồ Chí Minh"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-district`}>Quận/Huyện</Label>
          <Input
            id={`${idPrefix}-district`}
            name="district"
            defaultValue={defaultDistrict}
            placeholder="VD: Quận Gò Vấp"
            required
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-ward`}>Phường/Xã</Label>
        <Input
          id={`${idPrefix}-ward`}
          name="ward"
          defaultValue={defaultWard}
          placeholder="VD: Phường 5"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-address`}>Địa chỉ chi tiết</Label>
        <Input
          id={`${idPrefix}-address`}
          name="address"
          defaultValue={defaultAddress}
          placeholder="Số nhà, tên đường"
          required
        />
      </div>
    </>
  );
}
