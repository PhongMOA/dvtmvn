import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Soi vì sao 1 user không đăng nhập được: in ra User + Account (OAuth link) +
 * Session + Order. Nguyên nhân hay gặp nhất với Auth.js + PrismaAdapter:
 * User tồn tại (email khớp) nhưng KHÔNG có Account provider=google -> đăng nhập
 * Google trả về lỗi "OAuthAccountNotLinked".
 *
 * Chạy:  npx tsx scripts/debug-user-login.ts luvtk1905@gmail.com
 */
const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] ?? "").toLowerCase().trim();
  if (!email) {
    console.error("Thiếu email. Ví dụ: npx tsx scripts/debug-user-login.ts a@gmail.com");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { accounts: true, sessions: true, orders: true, deviceTokens: true },
  });

  if (!user) {
    console.log(`Không có User nào với email = ${email}`);
    // Có thể bị lệch hoa/thường
    const like = await prisma.user.findMany({
      where: { email: { contains: email.split("@")[0], mode: "insensitive" } },
      select: { id: true, email: true },
    });
    if (like.length) console.log("Gần giống:", like);
    return;
  }

  console.log("=== USER ===");
  console.log({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone,
    address: user.address,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  });

  console.log(`\n=== ACCOUNTS (${user.accounts.length}) ===`);
  for (const a of user.accounts) {
    console.log({
      provider: a.provider,
      type: a.type,
      providerAccountId: a.providerAccountId,
      hasRefresh: !!a.refresh_token,
      hasAccess: !!a.access_token,
      expires_at: a.expires_at,
    });
  }
  if (user.accounts.length === 0) {
    console.log(
      "  (TRỐNG) -> đây gần như chắc chắn là lý do: đăng nhập Google sẽ báo\n" +
        "  'OAuthAccountNotLinked' vì có User cùng email nhưng chưa liên kết Account.\n" +
        "  User này có thể được tạo qua Credentials provider 'mobile-google'\n" +
        "  (app Android) — provider đó upsert thẳng User, không tạo Account row.",
    );
  }

  console.log(`\n=== SESSIONS (${user.sessions.length}) ===`);
  for (const s of user.sessions) {
    console.log({ expires: s.expires, expired: s.expires < new Date() });
  }

  console.log(`\n=== ORDERS (${user.orders.length}) ===`);
  for (const o of user.orders) {
    console.log({
      orderCode: o.orderCode,
      paymentStatus: o.paymentStatus,
      quantity: o.quantity,
      createdAt: o.createdAt,
    });
  }

  console.log(`\n=== DEVICE TOKENS (${user.deviceTokens.length}) ===`);
  for (const d of user.deviceTokens) {
    console.log({ platform: d.platform, lastSeenAt: d.lastSeenAt });
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
