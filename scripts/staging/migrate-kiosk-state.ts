import { readFileSync } from "node:fs";
import { stagingPrisma } from "./staging-db";

// Thêm bảng trạng thái kiosk Uni vào DB staging mà không reset dữ liệu (idempotent).
// Production áp qua prisma/migrations/20261022000000_kiosk_state khi deploy.
// Chạy: npx tsx scripts/staging/migrate-kiosk-state.ts
async function main() {
  const prisma = stagingPrisma();
  const exists = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM information_schema.tables WHERE table_name = 'KioskState'`;
  if (exists[0].n > 0) {
    console.log("Bảng KioskState đã có, bỏ qua.");
  } else {
    const sql = readFileSync("prisma/migrations/20261022000000_kiosk_state/migration.sql", "utf8");
    await prisma.$transaction(
      sql
        .split(/;\s*$/m)
        .map((s) => s.replace(/^--.*$/gm, "").trim())
        .filter(Boolean)
        .map((s) => prisma.$executeRawUnsafe(s)),
    );
    console.log("Đã tạo bảng KioskState.");
  }
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
