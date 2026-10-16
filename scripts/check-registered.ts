import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Kiểm tra danh sách SĐT / email đã có tài khoản trong hệ thống chưa (CHỈ ĐỌC DB).
 * Mỗi dòng input là 1 SĐT hoặc email (có "@"); có thể ghi "sđt,email" trên cùng dòng.
 * In ra theo đúng thứ tự input, mỗi dòng: <input>\t<Đã đăng ký|Chưa>\t<email tk khớp>
 * — cột 2 dán thẳng vào Google Sheet được.
 *
 * Chạy (trên server, nơi DB nghe 127.0.0.1):
 *   npx tsx scripts/check-registered.ts danh-sach.txt
 *   npx tsx scripts/check-registered.ts 0934590846 0334718627 abc@gmail.com
 */
const prisma = new PrismaClient();

// Chuẩn hoá SĐT về dạng 0xxxxxxxxx: bỏ ký tự không phải số, +84/84 -> 0.
function normPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("84") && d.length === 11) d = "0" + d.slice(2);
  if (d.length === 9) d = "0" + d;
  return d;
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) throw new Error("Thiếu input. Xem hướng dẫn ở đầu file.");
  const lines =
    args.length === 1 && existsSync(args[0])
      ? readFileSync(args[0], "utf8").split(/\r?\n/)
      : args;
  const items = lines.map((l) => l.trim()).filter(Boolean);

  const users = await prisma.user.findMany({ select: { email: true, phone: true } });
  const byPhone = new Map<string, string>();
  const byEmail = new Map<string, string>();
  for (const u of users) {
    if (u.phone) byPhone.set(normPhone(u.phone), u.email);
    byEmail.set(u.email.trim().toLowerCase(), u.email);
  }

  let hit = 0;
  for (const item of items) {
    let match: string | undefined;
    for (const part of item.split(/[,;\s]+/).filter(Boolean)) {
      match = part.includes("@")
        ? byEmail.get(part.toLowerCase())
        : byPhone.get(normPhone(part));
      if (match) break;
    }
    if (match) hit++;
    console.log(`${item}\t${match ? "Đã đăng ký" : "Chưa"}\t${match ?? ""}`);
  }
  console.error(`\n${hit}/${items.length} đã đăng ký (tổng ${users.length} user trong DB).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
