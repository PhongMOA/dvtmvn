import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Lưu ý: KHÔNG pre-seed User cho admin ở đây. Quyền admin chỉ dựa vào so khớp
  // session.user.email với ADMIN_EMAIL (xem isAdminEmail trong auth-helpers.ts),
  // không dựa vào record User nào trong DB. Nếu tạo sẵn User bằng email admin mà
  // không có Account liên kết, lần đăng nhập Google đầu tiên bằng email đó sẽ bị
  // Auth.js từ chối với lỗi OAuthAccountNotLinked (đã gặp thực tế — xem journal).
  if (!process.env.ADMIN_EMAIL) {
    console.warn(
      "ADMIN_EMAIL chưa được set trong .env — trang /admin sẽ chặn mọi user cho tới khi set."
    );
  }

  const eventId = "seed-avengers-doomsday";

  // Bọc trong transaction + đóng mọi event "open" khác trước, để giữ đúng invariant
  // "chỉ 1 event open tại 1 thời điểm" (giống hệt logic `openEvent` ở admin panel) —
  // tránh seed script tạo ra 2 event cùng open nếu chạy lại trên DB đã có event khác.
  await prisma.$transaction([
    prisma.event.updateMany({
      where: { status: "open", NOT: { id: eventId } },
      data: { status: "closed" },
    }),
    prisma.event.upsert({
      where: { id: eventId },
      update: { status: "open", posterUrl: "/posters/doctor-doom.webp" },
      create: {
        id: eventId,
        title: "Avengers: Doomsday",
        description:
          "Suất chiếu đặc biệt offline — cùng hội tụ những siêu anh hùng mạnh nhất vũ trụ Marvel trong trận chiến định mệnh chống lại Doctor Doom. Đặt combo xong quét mã VietQR chuyển khoản để giữ chỗ, hệ thống tự xác nhận và trả về QR code check-in.",
        posterUrl: "/posters/doctor-doom.webp",
        venue: "Rạp chiếu phim cộng đồng — địa điểm sẽ thông báo sau",
        startAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // +14 ngày
        status: "open",
      },
    }),
  ]);

  // 2 combo demo theo đúng 2 ảnh mẫu user gửi: Combo 1 có kèm vé + giảm giá,
  // Combo 2 chỉ merchandise không kèm vé.
  await prisma.comboType.upsert({
    where: { id: "seed-combo-1-hang-a" },
    update: {},
    create: {
      id: "seed-combo-1-hang-a",
      eventId,
      name: "Combo 1 - Hàng A",
      price: 185000,
      originalPrice: 230000,
      includesTicket: true,
      items: JSON.stringify(["1 Dây đeo", "1 Bộ Sticker A6"]),
      totalQuantity: 100,
      remainingQuantity: 100,
    },
  });

  await prisma.comboType.upsert({
    where: { id: "seed-combo-2" },
    update: {},
    create: {
      id: "seed-combo-2",
      eventId,
      name: "Combo 2",
      price: 100000,
      originalPrice: null,
      includesTicket: false,
      items: JSON.stringify(["1 Dây đeo", "1 Bộ Sticker A6"]),
      totalQuantity: 200,
      remainingQuantity: 200,
    },
  });

  console.log("Seeded event: Avengers: Doomsday (status=open) + 2 combo");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
