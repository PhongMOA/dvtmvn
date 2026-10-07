import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Áp 2 migration giỏ hàng + đăng ký tài khoản bằng mật khẩu
 * (prisma/migrations/20261007010000_order_items, 20261007020000_user_password)
 * qua connection runtime (DATABASE_URL) thay vì `prisma migrate` — lý do giống
 * scripts/apply-role-migration.ts (schema engine bị treo qua Supavisor pooler).
 *
 * - Tạo bảng OrderItem + index + FK.
 * - Bỏ NOT NULL ở Order.comboTypeId/quantity (giữ cột để bản deploy cũ không vỡ).
 * - Backfill: mỗi đơn cũ chưa có OrderItem -> 1 dòng, unitPrice = giá combo hiện tại.
 * - Thêm cột User.passwordHash (đăng ký thủ công email + mật khẩu).
 *
 * Idempotent — chạy lại nhiều lần vô hại. Chạy TRƯỚC khi deploy code mới, và
 * chạy lại 1 lần SAU khi deploy để backfill các đơn do bản cũ tạo ra trong lúc
 * chuyển đổi (nếu có).
 *
 * Chạy:  npx tsx scripts/apply-cart-checkout-migration.ts
 */
const prisma = new PrismaClient();

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "comboTypeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId")`,
  `CREATE INDEX IF NOT EXISTS "OrderItem_comboTypeId_idx" ON "OrderItem"("comboTypeId")`,
  `DO $$ BEGIN
    ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_comboTypeId_fkey" FOREIGN KEY ("comboTypeId") REFERENCES "ComboType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `ALTER TABLE "Order" ALTER COLUMN "comboTypeId" DROP NOT NULL`,
  `ALTER TABLE "Order" ALTER COLUMN "quantity" DROP NOT NULL`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT`,
];

const BACKFILL = `INSERT INTO "OrderItem" ("id", "orderId", "comboTypeId", "quantity", "unitPrice")
  SELECT gen_random_uuid()::text, o."id", o."comboTypeId", o."quantity", c."price"
  FROM "Order" o
  JOIN "ComboType" c ON c."id" = o."comboTypeId"
  WHERE o."comboTypeId" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "OrderItem" i WHERE i."orderId" = o."id")`;

async function main() {
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
  }
  const inserted = await prisma.$executeRawUnsafe(BACKFILL);
  console.log(
    `Xong. Bảng OrderItem + cột User.passwordHash đã sẵn sàng, backfill ${inserted} đơn cũ.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
