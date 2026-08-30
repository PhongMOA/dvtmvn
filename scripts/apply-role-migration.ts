import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Áp migration "thêm cột User.role" mà KHÔNG qua schema engine của Prisma —
 * `prisma db execute` / `prisma migrate *` bị treo vô thời hạn qua Supavisor
 * pooler (xem ghi chú trong prisma/schema.prisma). Script này chạy đúng 1 câu
 * ALTER qua chính connection runtime của app (DATABASE_URL), nên không bị treo.
 *
 * Idempotent (IF NOT EXISTS) — chạy lại nhiều lần vô hại.
 *
 * Chạy:  npx tsx scripts/apply-role-migration.ts
 */
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user'`,
  );
  const admins = await prisma.user.count({ where: { role: "admin" } });
  console.log(`Xong. Cột User.role đã sẵn sàng (hiện có ${admins} role-admin).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
