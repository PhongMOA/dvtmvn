import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Áp migration prisma/migrations/20261008020000_coupons qua connection runtime
 * (DATABASE_URL) — lý do giống scripts/apply-role-migration.ts (schema engine bị
 * treo qua Supavisor pooler).
 *
 * - User.coupons (JSONB): ví mã giảm giá cấp thẳng cho user.
 * - Order.coupon (JSONB) + Order.discountAmount: mã đã áp + số tiền giảm.
 *
 * Idempotent — chạy lại vô hại. Chạy TRƯỚC khi deploy code mới.
 *
 * Chạy:  npx tsx scripts/apply-coupons-migration.ts
 */
const prisma = new PrismaClient();

const STATEMENTS = [
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "coupons" JSONB`,
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "coupon" JSONB`,
  `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "discountAmount" INTEGER NOT NULL DEFAULT 0`,
];

async function main() {
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
  }
  console.log("Xong. User.coupons + Order.coupon/discountAmount đã sẵn sàng.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
