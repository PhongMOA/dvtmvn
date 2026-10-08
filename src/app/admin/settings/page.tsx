import { getShopSetting } from "@/lib/shop-setting";
import { PickInfoForm } from "@/components/pick-info-form";
import { SalesCountdownForm } from "@/components/sales-countdown-form";
import { toVnDatetimeLocal } from "@/lib/datetime";

export default async function AdminSettingsPage() {
  const setting = await getShopSetting();

  return (
    <div>
      <h1 className="font-heading text-3xl tracking-wide text-primary">
        CẤU HÌNH
      </h1>

      <section className="mt-8 max-w-md">
        <h2 className="font-heading text-lg tracking-wide text-accent">
          Đếm ngược mở bán
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Trước giờ mở bán, trang chủ chỉ hiện đồng hồ đếm ngược và khoá đặt combo
          (admin vẫn xem trước được). Đặt giờ ở quá khứ để mở bán ngay.
        </p>
        <SalesCountdownForm
          defaultStartAt={toVnDatetimeLocal(setting.salesStartAt)}
          defaultTitle={setting.countdownTitle}
        />
      </section>

      <section className="mt-12 max-w-md">
        <h2 className="font-heading text-lg tracking-wide text-accent">
          Kho lấy hàng (GHTK)
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Thông tin người gửi và địa chỉ để GHTK đến lấy các combo có giao hàng.
          Dùng làm pick_name / pick_tel / pick_province / pick_district /
          pick_address khi tạo đơn ship.
        </p>
        <PickInfoForm
          defaultName={setting.pickName}
          defaultTel={setting.pickTel}
          defaultProvince={setting.pickProvince}
          defaultDistrict={setting.pickDistrict}
          defaultWard={setting.pickWard}
          defaultAddress={setting.pickAddress}
        />
      </section>
    </div>
  );
}
