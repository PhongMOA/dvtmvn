import { readFileSync } from "node:fs";
import { stagingPrisma } from "./staging-db";

// Thêm bảng quay số may mắn vào DB staging mà không reset dữ liệu (idempotent).
// Production áp qua prisma/migrations/20261021000000_lucky_draw khi deploy.
// Chạy: npx tsx scripts/staging/migrate-lucky-draw.ts
async function main() {
  const prisma = stagingPrisma();
  const exists = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM information_schema.tables WHERE table_name = 'LuckyDraw'`;
  if (exists[0].n > 0) {
    console.log("Bảng LuckyDraw đã có, bỏ qua.");
  } else {
    const sql = readFileSync("prisma/migrations/20261021000000_lucky_draw/migration.sql", "utf8");
    await prisma.$transaction(
      sql
        .split(/;\s*$/m)
        .map((s) => s.replace(/^--.*$/gm, "").trim())
        .filter(Boolean)
        .map((s) => prisma.$executeRawUnsafe(s)),
    );
    console.log("Đã tạo bảng LuckyDraw/LuckyDrawWinner.");
  }
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
