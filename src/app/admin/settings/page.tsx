import { getShopSetting } from "@/lib/shop-setting";
import { PickInfoForm } from "@/components/pick-info-form";

export default async function AdminSettingsPage() {
  const setting = await getShopSetting();

  return (
    <div>
      <h1 className="font-heading text-3xl tracking-wide text-primary">
        CẤU HÌNH
      </h1>

      <section className="mt-8 max-w-md">
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
          defaultAddress={setting.pickAddress}
        />
      </section>
    </div>
  );
}
