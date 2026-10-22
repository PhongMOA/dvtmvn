import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stagingPrisma, stagingUrl } from "./staging-db";
import { seedStaging } from "./seed";

/**
 * XOÁ SẠCH DB staging rồi dựng lại theo prisma/schema.prisma hiện tại + seed.
 *
 * Schema áp bằng `prisma migrate diff --from-empty` → `prisma db execute`
 * (không qua schema engine của migrate — bị treo qua Supavisor pooler).
 * Chạy lại sau mỗi lần đổi schema: dữ liệu staging là seed, mất không sao.
 *
 * Chạy:  npx tsx scripts/staging/reset-db.ts --confirm
 */
async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error("Script XOÁ TOÀN BỘ DB staging. Thêm --confirm để chạy.");
    process.exit(1);
  }
  const url = stagingUrl(); // throw nếu không phải DB staging
  console.log("DB staging:", new URL(url).hostname);

  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const sql = execFileSync(
    npx,
    ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"],
    { encoding: "utf8", shell: process.platform === "win32" },
  );
  const sqlFile = join(mkdtempSync(join(tmpdir(), "staging-schema-")), "schema.sql");
  writeFileSync(
    sqlFile,
    `DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
${sql}`,
  );

  console.log("Xoá schema public + dựng lại bảng...");
  execFileSync(npx, ["prisma", "db", "execute", "--file", sqlFile, "--url", url], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  const prisma = stagingPrisma();
  try {
    await seedStaging(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
