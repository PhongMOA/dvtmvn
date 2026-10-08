import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Áp migration prisma/migrations/20261008010000_sales_countdown qua connection
 * runtime (DATABASE_URL) — lý do giống scripts/apply-role-migration.ts (schema
 * engine bị treo qua Supavisor pooler).
 *
 * Thêm ShopSetting.salesStartAt (mặc định 04/11/2026 00:00 giờ VN = mốc hằng số
 * cũ trong src/lib/sales.ts) và ShopSetting.countdownTitle — để admin chỉnh
 * countdown trang chủ tại /admin/settings thay vì sửa code.
 *
 * Idempotent — chạy lại vô hại. Chạy TRƯỚC khi deploy code mới.
 *
 * Chạy:  npx tsx scripts/apply-sales-countdown-migration.ts
 */
const prisma = new PrismaClient();

const STATEMENTS = [
  `ALTER TABLE "ShopSetting" ADD COLUMN IF NOT EXISTS "salesStartAt" TIMESTAMP(3) NOT NULL DEFAULT '2026-11-03 17:00:00'::timestamp`,
  `ALTER TABLE "ShopSetting" ADD COLUMN IF NOT EXISTS "countdownTitle" TEXT NOT NULL DEFAULT 'Doomsday is coming'`,
];

async function main() {
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
  }
  console.log("Xong. ShopSetting.salesStartAt + countdownTitle đã sẵn sàng.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
