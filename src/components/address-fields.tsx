"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AddressHighlight = Partial<Record<"province" | "ward" | "address", boolean>>;

/** Highlight nhẹ (màu theme) cho ô bắt buộc còn trống — không dùng đỏ vì đây là
 *  gợi ý cần điền, chưa phải lỗi. */
export const MISSING_INPUT_CLASS =
  "border-primary/60 bg-primary/5 ring-2 ring-primary/15 dark:bg-primary/10";

/** Chữ "Cần điền" cạnh nhãn ô bắt buộc đang trống (ProfileModal). */
export function MissingHint({ show }: { show?: boolean }) {
  if (!show) return null;
  return <span className="text-xs font-normal text-primary">Cần điền</span>;
}

/**
 * Các ô địa chỉ giao hàng dùng chung cho form hồ sơ, modal bổ sung liên hệ và
 * bước xác nhận lúc đặt combo. Chỉ là fragment (không phải <form>) — component
 * cha bọc <form> và xử lý submit. Tên field: province / district / ward / address.
 *
 * Khi lưu, server kiểm tra địa chỉ qua API tính phí GHTK (xem src/lib/ghtk.ts).
 * GHTK chỉ bắt buộc Tỉnh + Phường; Quận/Huyện tuỳ chọn cho địa chỉ 2 cấp sau sáp
 * nhập 7/2025.
 */
export function AddressFields({
  idPrefix,
  defaultProvince,
  defaultDistrict,
  defaultWard,
  defaultAddress,
  highlight,
}: {
  idPrefix: string;
  /** Ô bắt buộc còn trống cần tô đỏ — chỉ ProfileModal dùng. */
  highlight?: AddressHighlight;
  defaultProvince: string;
  defaultDistrict: string;
  defaultWard: string;
  defaultAddress: string;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-province`}>
            Tỉnh/Thành <MissingHint show={highlight?.province} />
          </Label>
          <Input
            id={`${idPrefix}-province`}
            name="province"
            defaultValue={defaultProvince}
            placeholder="VD: TP. Hồ Chí Minh"
            className={highlight?.province ? MISSING_INPUT_CLASS : undefined}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-district`}>
            Quận/Huyện{" "}
            <span className="text-muted-foreground">(bỏ trống nếu đã sáp nhập)</span>
          </Label>
          <Input
            id={`${idPrefix}-district`}
            name="district"
            defaultValue={defaultDistrict}
            placeholder="VD: Quận Gò Vấp"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-ward`}>
          Phường/Xã <MissingHint show={highlight?.ward} />
        </Label>
        <Input
          id={`${idPrefix}-ward`}
          name="ward"
          defaultValue={defaultWard}
          placeholder="VD: Phường Hạnh Thông"
          className={highlight?.ward ? MISSING_INPUT_CLASS : undefined}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-address`}>
          Địa chỉ chi tiết <MissingHint show={highlight?.address} />
        </Label>
        <Input
          id={`${idPrefix}-address`}
          name="address"
          defaultValue={defaultAddress}
          placeholder="Số nhà, tên đường"
          className={highlight?.address ? MISSING_INPUT_CLASS : undefined}
          required
        />
      </div>
    </>
  );
}
