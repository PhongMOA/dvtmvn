import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { maskPhone } from "@/lib/lucky-draw-rules";
import { LuckyDrawStage } from "@/components/lucky-draw/lucky-draw-stage";

// TẠM THỜI, CHỈ CÓ TRÊN NHÁNH STAGING: màn quay thử công khai — ai cũng xem và
// bấm Quay được, ghế trúng chọn ngay ở client, KHÔNG ghi DB. Số lượt: ?luot=N.
// Không merge route này sang main (lộ tên người mua ra ngoài không cần đăng nhập).
export const dynamic = "force-dynamic";

export default async function QuayThuPage({
  params,
  searchParams,
}: PageProps<"/quay-thu/[id]">) {
  const { id } = await params;
  const { luot } = await searchParams;
  const event = await prisma.event.findUnique({ where: { id }, select: { title: true } });
  if (!event) notFound();

  const bookings = await prisma.seatBooking.findMany({
    where: { eventId: id },
    select: { seatCode: true, user: { select: { name: true, email: true, phone: true } } },
  });
  const seats = Object.fromEntries(
    bookings.map((b) => [
      b.seatCode,
      { displayName: b.user.name?.trim() || b.user.email, maskedPhone: maskPhone(b.user.phone) },
    ]),
  );
  const rounds = Math.min(Math.max(Number(luot) || 10, 1), 500);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <LuckyDrawStage
        eventId={id}
        eventTitle={event.title}
        totalRounds={rounds}
        initialWinners={[]}
        initialEligible={bookings.map((b) => b.seatCode)}
        demo={seats}
      />
    </div>
  );
}
