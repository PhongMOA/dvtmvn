import { stagingPrisma } from "./staging-db";
import { SEAT_LAYOUT, sweetboxPartner } from "../../src/lib/seats/layout";

/**
 * Lấp kín mọi ghế còn trống của event seed trên DB STAGING bằng khách giả
 * (@staging.test) — để test quay số / sơ đồ ghế lúc rạp full. Mỗi khách 1–4
 * ghế liền nhau trong cùng dãy; cặp Sweetbox luôn về chung 1 người. Chạy lại
 * được (chỉ lấp ghế còn trống).
 *
 * Chạy: npx tsx scripts/staging/fill-seats.ts
 */
const EVENT_ID = "seed-avengers-doomsday";

const HO = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"];
const DEM = ["Văn", "Thị", "Minh", "Ngọc", "Thanh", "Quốc", "Gia", "Bảo", "Hữu", "Thu", "Đức", "Khánh"];
const TEN = ["An", "Bình", "Châu", "Dũng", "Giang", "Hà", "Hải", "Hiếu", "Hùng", "Hương", "Khoa", "Lan", "Linh", "Long", "Mai", "Nam", "Nhi", "Phúc", "Quân", "Sơn", "Tâm", "Thảo", "Trang", "Tuấn", "Uyên", "Vy", "Yến"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

async function main() {
  const prisma = stagingPrisma();
  try {
    const taken = new Set(
      (await prisma.seatBooking.findMany({ where: { eventId: EVENT_ID }, select: { seatCode: true } })).map((b) => b.seatCode),
    );

    // Gom ghế trống thành các nhóm sẽ giao cho 1 khách.
    const groups: string[][] = [];
    for (const row of SEAT_LAYOUT) {
      for (const segment of row.segments) {
        const run: string[] = [];
        const flush = () => {
          while (run.length > 0) groups.push(run.splice(0, 1 + Math.floor(Math.random() * 4)));
        };
        for (const seat of segment) {
          if (seat.type === "blocked" || taken.has(seat.code)) { flush(); continue; }
          const partner = sweetboxPartner(seat);
          if (partner) {
            // Ghế lẻ của cặp xử lý cả cặp; cặp đã có người 1 bên thì bỏ qua.
            if (Number(seat.code.slice(1)) % 2 === 0) continue;
            if (!taken.has(partner)) groups.push([seat.code, partner]);
            continue;
          }
          run.push(seat.code);
        }
        flush();
      }
    }

    const existing = await prisma.user.count({ where: { email: { endsWith: "@staging.test" } } });
    let rank = (await prisma.seatAllowance.count({ where: { eventId: EVENT_ID } }));
    let seatCount = 0;
    for (const [i, seats] of groups.entries()) {
      const n = existing + i + 1;
      const user = await prisma.user.create({
        data: {
          email: `khach${String(n).padStart(3, "0")}@staging.test`,
          name: `${pick(HO)} ${pick(DEM)} ${pick(TEN)}`,
          phone: `09${String(10000000 + n).slice(-8)}`,
        },
      });
      await prisma.seatAllowance.create({
        data: { eventId: EVENT_ID, userId: user.id, rank: rank++, ticketCount: seats.length, unlockAt: new Date(Date.now() - 3600_000) },
      });
      await prisma.seatBooking.createMany({
        data: seats.map((seatCode) => ({ eventId: EVENT_ID, seatCode, userId: user.id })),
      });
      seatCount += seats.length;
    }
    const total = await prisma.seatBooking.count({ where: { eventId: EVENT_ID } });
    console.log(`Đã thêm ${seatCount} ghế cho ${groups.length} khách giả. Tổng ghế đã đặt: ${total}.`);
  } finally {
    await prisma.$disconnect();
  }
}
main();
