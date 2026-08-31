import { prisma } from "@/lib/prisma";

/** id cố định của bản ghi singleton ShopSetting. */
export const SHOP_SETTING_ID = "default";

/**
 * Đọc cấu hình cửa hàng dùng chung (singleton). Tự tạo bản ghi rỗng nếu chưa có,
 * nên caller luôn nhận về object đầy đủ field (chuỗi rỗng khi admin chưa điền).
 */
export async function getShopSetting() {
  return prisma.shopSetting.upsert({
    where: { id: SHOP_SETTING_ID },
    create: { id: SHOP_SETTING_ID },
    update: {},
  });
}
