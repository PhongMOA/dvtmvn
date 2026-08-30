import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { extractOrderCodeFromContent } from "../src/lib/sepay";

/**
 * Soi luồng thanh toán SePay: in ra các Order gần đây + các SepayTransaction
 * webhook đã ghi, và thử khớp thủ công để biết vì sao đơn chưa "paid".
 *
 * Chạy:  npx tsx scripts/debug-payments.ts
 */
const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { comboType: true },
  });

  console.log("=== 10 ĐƠN GẦN NHẤT ===");
  for (const o of orders) {
    console.log(
      [
        `code=${o.orderCode}`,
        `status=${o.paymentStatus}`,
        `qty=${o.quantity}`,
        `expect=${o.comboType.price * o.quantity}đ`,
        `combo=${o.comboType.name}`,
        `expiresAt=${o.expiresAt.toISOString()}`,
        `expired?=${o.paymentStatus === "pending" && o.expiresAt < new Date()}`,
        `createdAt=${o.createdAt.toISOString()}`,
      ].join("  "),
    );
  }

  const txns = await prisma.sepayTransaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  console.log(`\n=== ${txns.length} GIAO DỊCH WEBHOOK ĐÃ GHI (SepayTransaction) ===`);
  if (txns.length === 0) {
    console.log(
      "  (TRỐNG) — webhook chưa từng chạy tới bước ghi log. Nguyên nhân thường gặp:\n" +
        "   - SEPAY_WEBHOOK_SECRET sai/thiếu trên deployment -> route trả 401\n" +
        "   - Webhook trên dashboard SePay cấu hình sai URL, hoặc chọn kiểu xác thực\n" +
        "     KHÁC 'HMAC-SHA256' (code chỉ hỗ trợ HMAC-SHA256 qua header X-SePay-Signature)\n" +
        "   - Deployment chưa có domain public / chưa deploy bản có route",
    );
  }
  for (const t of txns) {
    const code = extractOrderCodeFromContent(t.content);
    console.log(
      [
        `id=${t.id}`,
        `amount=${t.transferAmount}đ`,
        `matchedOrderId=${t.orderId ?? "null"}`,
        `codeInContent=${code ?? "KHÔNG THẤY"}`,
        `content="${t.content}"`,
      ].join("  "),
    );
  }

  console.log("\n=== KHỚP THỦ CÔNG ===");
  for (const t of txns) {
    const code = extractOrderCodeFromContent(t.content);
    if (!code) continue;
    const order = orders.find((o) => o.orderCode === code);
    if (!order) {
      console.log(`  ${code}: không thấy trong 10 đơn gần nhất`);
      continue;
    }
    const expect = order.comboType.price * order.quantity;
    console.log(
      `  ${code}: order.status=${order.paymentStatus}, ` +
        `số tiền webhook=${t.transferAmount}đ vs cần=${expect}đ -> ` +
        (t.transferAmount === expect ? "KHỚP" : "LỆCH (webhook bỏ qua, không xác nhận)"),
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
