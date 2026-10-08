import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  deleteSeatBookings,
  finalizeSeatListAction,
  updateSeatConfig,
} from "@/app/actions/seat-admin";
import { SeatConfigForm } from "@/components/seat-config-form";
import { SeatAdminButton } from "@/components/seat-admin-button";
import { SeatLegend, SeatMap } from "@/components/seat-map";
import { SEAT_LAYOUT } from "@/lib/seats/layout";
import { toVnDatetimeLocal, VN_TIME_ZONE } from "@/lib/datetime";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: VN_TIME_ZONE,
  }).format(date);
}

const SELECTABLE_SEATS = SEAT_LAYOUT.flatMap((r) => r.segments.flat()).filter(
  (s) => s.type !== "blocked",
).length;

export default async function EventSeatsPage({ params }: PageProps<"/admin/events/[id]/seats">) {
  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, title: true, seatOpenAt: true, seatTurnMinutes: true, seatBatchSize: true },
  });
  if (!event) notFound();

  const [allowances, bookings] = await Promise.all([
    prisma.seatAllowance.findMany({
      where: { eventId: id },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { rank: "asc" },
    }),
    prisma.seatBooking.findMany({
      where: { eventId: id },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { seatCode: "asc" },
    }),
  ]);

  const occupants: Record<string, string> = {};
  const seatsByUser = new Map<string, string[]>();
  for (const booking of bookings) {
    occupants[booking.seatCode] = booking.user.name ?? booking.user.email;
    seatsByUser.set(booking.userId, [...(seatsByUser.get(booking.userId) ?? []), booking.seatCode]);
  }
  const totalTickets = allowances.reduce((sum, a) => sum + a.ticketCount, 0);
  const lastUnlock = allowances.at(-1)?.unlockAt;

  return (
    <div>
      <Link href="/admin/events" className="text-sm text-muted-foreground hover:text-foreground">
        ← Sự kiện
      </Link>
      <h1 className="mt-2 font-heading text-3xl tracking-wide text-primary">CHỌN GHẾ</h1>
      <p className="mt-1 text-sm text-muted-foreground">{event.title}</p>

      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <section className="max-w-md">
          <h2 className="font-heading text-lg tracking-wide text-accent">Cấu hình lượt</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Người mua vé trước chọn trước. Mỗi lượt mở thêm cho “người mỗi lượt” người,
            cách nhau “phút mỗi lượt”; đã mở thì giữ luôn tới khi chọn xong. Lưu cấu hình sẽ
            tính lại giờ của danh sách đã chốt.
          </p>
          <SeatConfigForm
            action={updateSeatConfig.bind(null, id)}
            defaultOpenAt={event.seatOpenAt ? toVnDatetimeLocal(event.seatOpenAt) : ""}
            defaultTurnMinutes={event.seatTurnMinutes}
            defaultBatchSize={event.seatBatchSize}
          />
        </section>

        <section className="max-w-md">
          <h2 className="font-heading text-lg tracking-wide text-accent">Chốt danh sách</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Lấy mọi người đã thanh toán đơn có vé, xếp theo giờ thanh toán. Bấm lại được: người
            cũ giữ nguyên lượt, chỉ cập nhật số vé; người mới nối cuối. Sau khi chốt, đơn thanh
            toán mới tự được nối cuối.
          </p>
          <div className="mt-4">
            <SeatAdminButton
              action={finalizeSeatListAction.bind(null, id)}
              label={allowances.length > 0 ? "Chốt lại danh sách" : "Chốt danh sách"}
            />
          </div>
          <dl className="mt-4 flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Người trong danh sách</dt>
              <dd className="text-foreground">{allowances.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Vé / ghế đã chọn / ghế khả dụng</dt>
              <dd className="text-foreground">
                {totalTickets} / {bookings.length} / {SELECTABLE_SEATS}
              </dd>
            </div>
            {lastUnlock && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Người cuối mở lúc</dt>
                <dd className="text-foreground">{formatDateTime(lastUnlock)}</dd>
              </div>
            )}
          </dl>
          {totalTickets > SELECTABLE_SEATS && (
            <p className="mt-2 text-sm text-destructive">
              Số vé vượt số ghế khả dụng — người cuối sẽ không đủ ghế.
            </p>
          )}
        </section>
      </div>

      <section className="mt-12">
        <h2 className="font-heading text-lg tracking-wide text-accent">Sơ đồ</h2>
        <p className="mt-1 text-sm text-muted-foreground">Rê chuột vào ghế để xem người ngồi.</p>
        <div className="mt-4 flex flex-col gap-3">
          <SeatMap taken={new Set(Object.keys(occupants))} occupants={occupants} />
          <SeatLegend withPicked={false} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-lg tracking-wide text-accent">Danh sách lượt</h2>
        {allowances.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Chưa chốt danh sách.</p>
        ) : (
          <div className="mt-4 rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Người mua</TableHead>
                  <TableHead>Vé</TableHead>
                  <TableHead>Ghế đã chọn</TableHead>
                  <TableHead>Mở lúc</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allowances.map((allowance) => {
                  const seats = seatsByUser.get(allowance.userId) ?? [];
                  return (
                    <TableRow key={allowance.id}>
                      <TableCell>{allowance.rank + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium">{allowance.user.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{allowance.user.email}</div>
                      </TableCell>
                      <TableCell>{allowance.ticketCount}</TableCell>
                      <TableCell>{seats.length > 0 ? seats.join(", ") : "—"}</TableCell>
                      <TableCell>{formatDateTime(allowance.unlockAt)}</TableCell>
                      <TableCell className="text-right">
                        {seats.length > 0 && (
                          <SeatAdminButton
                            action={deleteSeatBookings.bind(null, id, allowance.userId)}
                            label="Huỷ ghế"
                            confirmText={`Huỷ ${seats.length} ghế của ${allowance.user.name ?? allowance.user.email}? Người này sẽ được chọn lại.`}
                            variant="outline"
                            size="sm"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
