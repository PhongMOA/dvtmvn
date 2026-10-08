import { getShopSetting } from "@/lib/shop-setting";

// Thời điểm mở bán combo + tiêu đề đồng hồ đếm ngược ở trang chủ. Lưu trong
// ShopSetting (salesStartAt / countdownTitle), admin sửa tại /admin/settings.
// Trước mốc này: trang chủ chỉ hiện hero + countdown và khoá phần đặt combo
// (admin vẫn xem trước được).
export async function getSalesConfig(now: Date = new Date()) {
  const setting = await getShopSetting();
  return {
    salesStartAt: setting.salesStartAt,
    countdownTitle: setting.countdownTitle,
    salesOpen: now.getTime() >= setting.salesStartAt.getTime(),
  };
}

export async function isSalesOpen(now: Date = new Date()): Promise<boolean> {
  return (await getSalesConfig(now)).salesOpen;
}
