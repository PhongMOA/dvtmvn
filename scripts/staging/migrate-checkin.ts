import { stagingPrisma } from "./staging-db";

// Thêm cột check-in vào DB staging mà không reset dữ liệu (idempotent).
// Production áp qua prisma/migrations/20261019010000_order_checkin khi deploy.
// Chạy: npx tsx scripts/staging/migrate-checkin.ts
async function main() {
  const prisma = stagingPrisma();
  await prisma.$executeRawUnsafe(`ALTER TABLE "Order"
    ADD COLUMN IF NOT EXISTS "checkedInAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "checkedInBy" TEXT,
    ADD COLUMN IF NOT EXISTS "checkedInVia" TEXT`);
  const cols = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'Order' AND column_name LIKE 'checkedIn%'`;
  console.log("Cột check-in:", cols.map((c) => c.column_name).join(", "));
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
