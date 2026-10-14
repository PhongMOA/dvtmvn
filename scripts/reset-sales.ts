import "dotenv/config";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";

/**
 * Dọn sạch dữ liệu bán hàng để bắt đầu "chạy thật":
 *   - Xoá toàn bộ Order (mọi trạng thái pending/paid/expired)
 *   - Đặt lại remainingQuantity = totalQuantity cho mọi ComboType
 *   - Xoá log SepayTransaction
 *   - Xoá dữ liệu chọn ghế sinh ra từ đơn: SeatAllowance (quyền chọn ghế) +
 *     SeatBooking (ghế đã chọn). Cấu hình mở chọn ghế của Event giữ nguyên.
 *
 * KHÔNG đụng tới User (tài khoản, đăng nhập, profile, ví coupon) / Event /
 * ComboType (chỉ reset tồn kho). Đơn GHTK đã tạo bên GHTK không bị huỷ theo —
 * script chỉ liệt kê để huỷ tay.
 *
 * Chạy:
 *   npx tsx scripts/reset-sales.ts            # chỉ in ra sẽ xoá gì (dry-run)
 *   npx tsx scripts/reset-sales.ts --confirm  # thực thi
 *   thêm --clear-coupons                       # xoá luôn ví coupon (User.coupons) của mọi user
 *
 * Mặc định dùng DATABASE_URL trong .env. Muốn nhắm DB khác thì set biến môi
 * trường trước khi chạy.
 */
const prisma = new PrismaClient();

async function main() {
  const confirmed = process.argv.includes("--confirm");
  const clearCoupons = process.argv.includes("--clear-coupons");

  const [orders, byStatus, items, combos, txns, allowances, bookings, users, ghtk, couponOrders] =
    await Promise.all([
      prisma.order.count(),
      prisma.order.groupBy({ by: ["paymentStatus"], _count: true }),
      prisma.orderItem.count(),
      prisma.comboType.findMany({
        select: { name: true, totalQuantity: true, remainingQuantity: true },
        orderBy: [{ eventId: "asc" }, { sortOrder: "asc" }],
      }),
      prisma.sepayTransaction.count(),
      prisma.seatAllowance.count(),
      prisma.seatBooking.count(),
      prisma.user.count(),
      prisma.order.findMany({
        where: { ghtkLabel: { not: null } },
        select: { orderCode: true, ghtkLabel: true, ghtkStatusText: true },
      }),
      prisma.order.count({ where: { coupon: { not: { equals: null } } } }),
    ]);

  console.log("Sẽ thực hiện:");
  console.log(
    `  - Xoá ${orders} Order (${byStatus.map((s) => `${s.paymentStatus}: ${s._count}`).join(", ") || "trống"}) + ${items} OrderItem`,
  );
  console.log(`  - Xoá ${txns} SepayTransaction`);
  console.log(`  - Xoá ${allowances} SeatAllowance + ${bookings} SeatBooking`);
  console.log(`  - Reset tồn kho cho ${combos.length} ComboType:`);
  for (const c of combos) {
    console.log(`      ${c.name}: ${c.remainingQuantity} -> ${c.totalQuantity}`);
  }
  console.log(`  - Giữ nguyên ${users} User`);
  if (clearCoupons) {
    const holders = await prisma.user.count({
      where: { coupons: { not: Prisma.DbNull } },
    });
    console.log(`  - Xoá ví coupon của ${holders} User (User.coupons = null)`);
  }
  if (couponOrders > 0) {
    console.log(
      `  ! ${couponOrders} đơn có dùng coupon — lượt coupon đã trừ trong ví User KHÔNG được hoàn lại.`,
    );
  }
  if (ghtk.length > 0) {
    console.log(`  ! ${ghtk.length} đơn đã tạo vận đơn GHTK — cần huỷ tay bên GHTK:`);
    for (const o of ghtk) {
      console.log(`      ${o.orderCode}: ${o.ghtkLabel} (${o.ghtkStatusText ?? "?"})`);
    }
  }

  if (!confirmed) {
    console.log("\nDry-run (chưa xoá gì). Thêm --confirm để thực thi.");
    return;
  }

  const combosBefore = await prisma.comboType.findMany({
    select: { id: true, totalQuantity: true },
  });

  await prisma.$transaction([
    prisma.seatBooking.deleteMany({}),
    prisma.seatAllowance.deleteMany({}),
    prisma.order.deleteMany({}),
    prisma.sepayTransaction.deleteMany({}),
    ...(clearCoupons
      ? [
          prisma.user.updateMany({
            where: { coupons: { not: Prisma.DbNull } },
            data: { coupons: Prisma.DbNull },
          }),
        ]
      : []),
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
