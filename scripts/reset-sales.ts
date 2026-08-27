import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Dọn sạch dữ liệu bán hàng để bắt đầu "chạy thật":
 *   - Xoá toàn bộ Order (mọi trạng thái pending/paid/expired)
 *   - Đặt lại remainingQuantity = totalQuantity cho mọi ComboType
 *   - Xoá log SepayTransaction
 *
 * KHÔNG đụng tới User / Event / ComboType (chỉ reset tồn kho).
 *
 * Chạy:
 *   npx tsx scripts/reset-sales.ts            # chỉ in ra sẽ xoá gì (dry-run)
 *   npx tsx scripts/reset-sales.ts --confirm  # thực thi
 *
 * Mặc định dùng DATABASE_URL trong .env. Muốn nhắm DB khác thì set biến môi
 * trường trước khi chạy.
 */
const prisma = new PrismaClient();

async function main() {
  const confirmed = process.argv.includes("--confirm");

  const [orders, combos, txns] = await Promise.all([
    prisma.order.count(),
    prisma.comboType.count(),
    prisma.sepayTransaction.count(),
  ]);

  console.log("Sẽ thực hiện:");
  console.log(`  - Xoá ${orders} Order`);
  console.log(`  - Reset tồn kho cho ${combos} ComboType (remainingQuantity = totalQuantity)`);
  console.log(`  - Xoá ${txns} SepayTransaction`);

  if (!confirmed) {
    console.log("\nDry-run (chưa xoá gì). Thêm --confirm để thực thi.");
    return;
  }

  const combosBefore = await prisma.comboType.findMany({
    select: { id: true, totalQuantity: true },
  });

  await prisma.$transaction([
    prisma.order.deleteMany({}),
    prisma.sepayTransaction.deleteMany({}),
    ...combosBefore.map((combo) =>
      prisma.comboType.update({
        where: { id: combo.id },
        data: { remainingQuantity: combo.totalQuantity },
      }),
    ),
  ]);

  console.log("\nXong. Dữ liệu bán hàng đã được dọn sạch.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
