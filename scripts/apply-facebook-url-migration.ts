import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Áp migration "thêm cột User.facebookUrl" qua connection runtime (DATABASE_URL)
 * thay vì `prisma migrate` — lý do giống scripts/apply-role-migration.ts (schema
 * engine bị treo qua Supavisor pooler).
 *
 * Idempotent (IF NOT EXISTS) — chạy lại nhiều lần vô hại. Phải chạy TRƯỚC khi
 * deploy code mới (Prisma client mới select cột này).
 *
 * Chạy:  npx tsx scripts/apply-facebook-url-migration.ts
 */
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "facebookUrl" TEXT`,
  );
  console.log("Xong. Cột User.facebookUrl đã sẵn sàng.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
