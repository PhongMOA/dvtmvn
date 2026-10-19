import { stagingPrisma } from "./staging-db";

/**
 * Xem nhanh DB staging: danh sách bảng + số dòng. CHỈ ĐỌC.
 *
 * Chạy:  npx tsx scripts/staging/inspect-db.ts
 */
async function main() {
  const prisma = stagingPrisma();
  try {
    const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
    );
    for (const { table_name } of tables) {
      const [{ n }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT count(*) AS n FROM "${table_name}"`,
      );
      console.log(`${table_name.padEnd(28)} ${n}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
