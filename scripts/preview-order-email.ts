import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { sendEmail } from "../src/lib/email";
import {
  buildOrderConfirmationEmail,
  type OrderEmailData,
} from "../src/lib/emails/order-confirmation";

/**
 * Xem trước / gửi thử email "Xác nhận thanh toán" (src/lib/emails/order-confirmation.ts).
 * Ghi HTML ra tmp/order-email-preview.html để mở bằng trình duyệt.
 *
 * Chạy:
 *   npx tsx scripts/preview-order-email.ts --mock                     # dữ liệu mẫu, không cần DB
 *   npx tsx scripts/preview-order-email.ts --order <orderCode>        # đơn thật trong DB
 *   npx tsx scripts/preview-order-email.ts --mock --send --to ban@gmail.com
 *   npx tsx scripts/preview-order-email.ts --order <orderCode> --send [--to ...]  # mặc định gửi tới email chủ đơn
 */

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const MOCK: OrderEmailData = {
  id: "mock",
  orderCode: "MVN8K2QX",
  qrToken: "00000000-0000-4000-8000-000000000000",
  paidAt: new Date(),
  upgradeFromOrderId: null,
  shipName: "Nguyễn Văn A",
  shipPhone: "0901234567",
  shipProvince: "TP. Hồ Chí Minh",
  shipDistrict: null,
  shipWard: "Phường Bến Thành",
  shipAddress: "123 Lê Lợi",
  shipFee: 30000,
  discountAmount: 25000,
  coupon: { code: "GIAM10", percent: 10, quantity: 1 },
  user: { name: "Nguyễn Văn A", email: "khach@example.com" },
  items: [
    {
      quantity: 2,
      unitPrice: 199000,
      shirtSizes: null,
      comboType: {
        name: "Combo 1 – Vé + Bắp nước",
        includesTicket: true,
        event: {
          title: "Avengers: Doomsday – Suất chiếu fan",
          venue: "CGV Vincom Đồng Khởi, TP.HCM",
          startAt: new Date("2026-12-18T12:00:00Z"),
          startAtTentative: false,
          posterUrl: "/posters/avengers-doomsday.jpg",
        },
      },
    },
    {
      quantity: 1,
      unitPrice: 250000,
      shirtSizes: { M: 1 },
      comboType: {
        name: "Combo Áo Doomsday",
        includesTicket: false,
        event: {
          title: "Avengers: Doomsday – Suất chiếu fan",
          venue: "CGV Vincom Đồng Khởi, TP.HCM",
          startAt: new Date("2026-12-18T12:00:00Z"),
          startAtTentative: false,
          posterUrl: "/posters/avengers-doomsday.jpg",
        },
      },
    },
  ],
};

async function loadOrder(orderCode: string): Promise<OrderEmailData> {
  const { prisma } = await import("../src/lib/prisma");
  const order = await prisma.order.findUnique({
    where: { orderCode },
    include: {
      items: { include: { comboType: { include: { event: true } } } },
      user: { select: { name: true, email: true } },
    },
  });
  await prisma.$disconnect();
  if (!order) throw new Error(`Không tìm thấy đơn ${orderCode}`);
  return order;
}

async function main() {
  const orderCode = argValue("--order");
  if (!orderCode && !process.argv.includes("--mock")) {
    console.error("Cần --mock hoặc --order <orderCode>");
    process.exit(1);
  }

  const data = orderCode ? await loadOrder(orderCode) : MOCK;
  const email = await buildOrderConfirmationEmail(data);

  const outDir = join(process.cwd(), "tmp");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "order-email-preview.html");
  // Trình duyệt không hiểu cid: -> thay ảnh nhúng bằng data URI cho file xem trước.
  let previewHtml = email.html;
  for (const a of email.attachments ?? []) {
    if (!a.contentId) continue;
    const dataUri = `data:${a.contentType ?? "image/png"};base64,${a.content.toString("base64")}`;
    previewHtml = previewHtml.replaceAll(`cid:${a.contentId}`, dataUri);
  }
  writeFileSync(outFile, previewHtml, "utf-8");
  console.log(`Tiêu đề: ${email.subject}`);
  console.log(`Đã ghi HTML: ${outFile}`);

  if (process.argv.includes("--send")) {
    const to = argValue("--to") ?? email.to;
    const result = await sendEmail({ ...email, to });
    if (!result.ok) {
      console.error("Gửi thất bại:", result.error);
      process.exit(1);
    }
    console.log(`Đã gửi tới ${to} — id: ${result.id}`);
  }
}

main();
