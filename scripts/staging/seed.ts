import type { PrismaClient } from "../../src/generated/prisma/client";

/**
 * Dữ liệu test cho DB staging — toàn bộ là người giả (@staging.test), không
 * đăng nhập được. Admin thật vào bằng Google với ADMIN_EMAIL (env Vercel);
 * KHÔNG tạo sẵn User cho email đó (Auth.js sẽ báo OAuthAccountNotLinked — xem
 * prisma/seed.ts).
 *
 * Event diễn ra HÔM NAY 19:30 để test kiosk check-in. Các ca đơn:
 *  - 1 đơn 2 vé, đã chọn ghế               - 2 đơn của cùng 1 người (gộp check-in)
 *  - đơn chỉ merch (không vé)              - đơn pending (chưa thanh toán)
 *  - đơn có vé nhưng chưa chọn ghế         - đơn có áo (shirtSizes)
 */
const EVENT_ID = "seed-avengers-doomsday";

function todayAt(hour: number, minute = 0): Date {
  const d = new Date(Date.now() + 7 * 3600_000); // ngày theo giờ VN
  const ymd = d.toISOString().slice(0, 10);
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return new Date(`${ymd}T${hh}:${mm}:00+07:00`);
}

type FakeOrder = {
  code: string;
  items: { combo: string; qty: number; shirtSizes?: Record<string, number> }[];
  paid: boolean;
};
type FakeUser = { name: string; phone: string; orders: FakeOrder[]; seats: string[] };

const COMBOS = [
  { id: "seed-combo-1-hang-a", name: "Combo 1 - Hàng A", price: 185000, originalPrice: 230000, includesTicket: true, includesShirt: false, items: ["1 Vé xem phim", "1 Dây đeo", "1 Bộ Sticker A6"] },
  { id: "seed-combo-3-ao", name: "Combo 3 - Vé + Áo", price: 350000, originalPrice: null, includesTicket: true, includesShirt: true, items: ["1 Vé xem phim", "1 Áo thun", "1 Dây đeo"] },
  { id: "seed-combo-2", name: "Combo 2", price: 100000, originalPrice: null, includesTicket: false, includesShirt: false, items: ["1 Dây đeo", "1 Bộ Sticker A6"] },
];

const USERS: FakeUser[] = [
  { name: "Lê Quốc Bảo", phone: "0900000001", seats: ["F7", "F8"], orders: [{ code: "STG001", paid: true, items: [{ combo: "seed-combo-1-hang-a", qty: 2 }] }] },
  { name: "Vũ Ngọc Linh", phone: "0900000002", seats: ["F9", "F10"], orders: [
    { code: "STG002", paid: true, items: [{ combo: "seed-combo-1-hang-a", qty: 1 }] },
    { code: "STG003", paid: true, items: [{ combo: "seed-combo-3-ao", qty: 1, shirtSizes: { M: 1 } }] },
  ] },
  { name: "Trần Minh Anh", phone: "0900000003", seats: ["G5"], orders: [{ code: "STG004", paid: true, items: [{ combo: "seed-combo-3-ao", qty: 1, shirtSizes: { L: 1 } }] }] },
  { name: "Hải Nguyễn", phone: "0900000004", seats: [], orders: [{ code: "STG005", paid: true, items: [{ combo: "seed-combo-2", qty: 1 }] }] },
  { name: "Phạm Thu Hà", phone: "0900000005", seats: [], orders: [{ code: "STG006", paid: false, items: [{ combo: "seed-combo-1-hang-a", qty: 2 }] }] },
  { name: "Đỗ Gia Huy", phone: "0900000006", seats: [], orders: [{ code: "STG007", paid: true, items: [{ combo: "seed-combo-1-hang-a", qty: 1 }] }] },
  { name: "Ngô Thanh Tâm", phone: "0900000007", seats: ["H11", "H12", "H13"], orders: [{ code: "STG008", paid: true, items: [{ combo: "seed-combo-1-hang-a", qty: 3 }] }] },
  { name: "Bùi Khánh Vy", phone: "0900000008", seats: ["E14", "E15"], orders: [{ code: "STG009", paid: true, items: [{ combo: "seed-combo-1-hang-a", qty: 1 }, { combo: "seed-combo-3-ao", qty: 1, shirtSizes: { S: 1 } }] }] },
  { name: "Hoàng Đức Minh", phone: "0900000009", seats: ["G6"], orders: [{ code: "STG010", paid: true, items: [{ combo: "seed-combo-1-hang-a", qty: 1 }, { combo: "seed-combo-2", qty: 2 }] }] },
  { name: "Lý Mai Phương", phone: "0900000010", seats: ["J1", "J2"], orders: [{ code: "STG011", paid: true, items: [{ combo: "seed-combo-3-ao", qty: 2, shirtSizes: { M: 1, XL: 1 } }] }] },
];

export async function seedStaging(prisma: PrismaClient) {
  const now = new Date();

  await prisma.shopSetting.create({
    data: { id: "default", salesStartAt: new Date("2026-01-01T00:00:00+07:00") }, // đã mở bán
  });

  await prisma.event.create({
    data: {
      id: EVENT_ID,
      title: "Avengers: Doomsday",
      description: "Suất chiếu TEST trên staging — dữ liệu giả để thử kiosk check-in.",
      posterUrl: "/posters/doctor-doom.webp",
      venue: "CGV Vạn Hạnh Mall (STAGING)",
      startAt: todayAt(19, 30),
      status: "open",
      seatOpenAt: new Date(now.getTime() - 24 * 3600_000),
    },
  });

  const sold = new Map<string, number>();
  for (const u of USERS) for (const o of u.orders) if (o.paid) for (const it of o.items) {
    sold.set(it.combo, (sold.get(it.combo) ?? 0) + it.qty);
  }
  for (const [i, c] of COMBOS.entries()) {
    const total = 100;
    await prisma.comboType.create({
      data: {
        id: c.id, eventId: EVENT_ID, name: c.name, price: c.price, originalPrice: c.originalPrice,
        includesTicket: c.includesTicket, includesShirt: c.includesShirt, sortOrder: i,
        items: JSON.stringify(c.items), totalQuantity: total, remainingQuantity: total - (sold.get(c.id) ?? 0),
      },
    });
  }
  const priceOf = new Map(COMBOS.map((c) => [c.id, c.price]));
  const hasTicket = new Set(COMBOS.filter((c) => c.includesTicket).map((c) => c.id));

  let rank = 0;
  for (const [i, u] of USERS.entries()) {
    const n = String(i + 1).padStart(2, "0");
    const user = await prisma.user.create({
      data: {
        email: `khach${n}@staging.test`, name: u.name, phone: u.phone,
        province: "TP. Hồ Chí Minh", ward: "Phường Hòa Hưng", address: `${i + 1} Sư Vạn Hạnh`,
      },
    });

    let tickets = 0;
    for (const [j, o] of u.orders.entries()) {
      const paidAt = new Date(now.getTime() - (USERS.length - i) * 3600_000 + j * 60_000);
      await prisma.order.create({
        data: {
          userId: user.id, orderCode: o.code,
          paymentStatus: o.paid ? "paid" : "pending",
          paidAt: o.paid ? paidAt : null,
          expiresAt: o.paid ? paidAt : new Date(now.getTime() + 30 * 60_000),
          shipName: u.name, shipPhone: u.phone, shipProvince: "TP. Hồ Chí Minh",
          shipWard: "Phường Hòa Hưng", shipAddress: `${i + 1} Sư Vạn Hạnh`,
          items: {
            create: o.items.map((it) => ({
              comboTypeId: it.combo, quantity: it.qty, unitPrice: priceOf.get(it.combo)!,
              shirtSizes: it.shirtSizes,
            })),
          },
        },
      });
      if (o.paid) for (const it of o.items) if (hasTicket.has(it.combo)) tickets += it.qty;
    }

    if (tickets > 0) {
      await prisma.seatAllowance.create({
        data: { eventId: EVENT_ID, userId: user.id, rank: rank++, ticketCount: tickets, unlockAt: new Date(now.getTime() - 3600_000) },
      });
      if (u.seats.length > 0) {
        await prisma.seatBooking.createMany({
          data: u.seats.map((seatCode) => ({ eventId: EVENT_ID, seatCode, userId: user.id })),
        });
      }
    }
  }

  console.log(`Seed xong: 1 event (hôm nay 19:30), ${COMBOS.length} combo, ${USERS.length} khách giả.`);
}
