import "dotenv/config";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { parseCoupon } from "../src/lib/coupons";

/**
 * Cấp mã giảm giá vào ví của 1 user (User.coupons). Cùng mã + cùng mức giảm đã
 * có trong ví thì cộng thêm lượt; chưa có thì thêm phần tử mới.
 *
 * Chạy:
 *   npx tsx scripts/grant-coupon.ts <email> <code> --percent 10 [--quantity 2] [--label "..."]
 *   npx tsx scripts/grant-coupon.ts <email> <code> --amount 50000 [--quantity 1]
 *   npx tsx scripts/grant-coupon.ts <email> --list          # xem ví hiện tại
 */
const prisma = new PrismaClient();

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
}

async function main() {
  const args = process.argv.slice(2);
  const email = args[0]?.trim().toLowerCase();
  if (!email) throw new Error("Thiếu email. Xem hướng dẫn ở đầu file.");

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, coupons: true },
  });
  if (!user) throw new Error(`Không tìm thấy user ${email}`);

  if (args.includes("--list")) {
    console.log(JSON.stringify(user.coupons ?? [], null, 2));
    return;
  }

  const code = args[1]?.trim();
  const percent = flag(args, "percent");
  const amount = flag(args, "amount");
  const coupon = parseCoupon({
    code,
    percent: percent === undefined ? undefined : Number(percent),
    amount: amount === undefined ? undefined : Number(amount),
    quantity: Number(flag(args, "quantity") ?? 1),
    label: flag(args, "label"),
  });
  if (!coupon || coupon.quantity < 1 || (percent && amount)) {
    throw new Error("Mã không hợp lệ: cần <code> và đúng 1 trong --percent (1-100) / --amount (VND), --quantity ≥ 1.");
  }

  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ coupons: unknown }[]>`
      SELECT "coupons" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
    const list = Array.isArray(rows[0]?.coupons) ? [...(rows[0].coupons as unknown[])] : [];
    const index = list.findIndex((item) => parseCoupon(item)?.code === coupon.code);
    const existing = index === -1 ? null : parseCoupon(list[index])!;
    if (existing && (existing.percent !== coupon.percent || existing.amount !== coupon.amount)) {
      throw new Error(`Ví đã có mã ${coupon.code} với mức giảm khác — đặt tên mã khác.`);
    }
    if (index === -1) {
      list.push(coupon);
    } else {
      const current = parseCoupon(list[index])!;
      list[index] = {
        ...(list[index] as Record<string, unknown>),
        quantity: Math.max(0, current.quantity) + coupon.quantity,
        ...(coupon.label ? { label: coupon.label } : {}),
      };
    }
    await tx.user.update({
      where: { id: user.id },
      data: { coupons: list as Prisma.InputJsonValue },
    });
    console.log(`Đã cấp cho ${user.email}:`);
    console.log(JSON.stringify(list, null, 2));
  });
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
