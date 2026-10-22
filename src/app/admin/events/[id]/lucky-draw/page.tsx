import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDrawState } from "@/lib/lucky-draw";
import { resetLuckyDraw, saveLuckyDraw, voidLuckyDrawWinner } from "@/app/actions/lucky-draw";
import { CopyWinnersButton, LuckyDrawForm } from "@/components/lucky-draw/lucky-draw-form";
import { SeatAdminButton } from "@/components/seat-admin-button";
import { buttonVariants } from "@/components/ui/button";
import { VN_TIME_ZONE } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeStyle: "medium",
    dateStyle: "short",
    timeZone: VN_TIME_ZONE,
  }).format(date);
}

export default async function LuckyDrawPage({ params }: PageProps<"/admin/events/[id]/lucky-draw">) {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id }, select: { id: true, title: true } });
  if (!event) notFound();

  const state = await getDrawState(id);
  const winnerRows = state.draw
    ? await prisma.luckyDrawWinner.findMany({
        where: { drawId: state.draw.id },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(winnerRows.map((w) => w.userId))] } },
    select: { id: true, email: true, phone: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));
  const latestValidId = winnerRows.filter((w) => !w.voided).at(-1)?.id;
  const copyText = winnerRows
    .filter((w) => !w.voided)
    .map((w) => [w.round, w.seatCode, w.displayName, userById.get(w.userId)?.phone ?? ""].join("\t"))
    .join("\n");

  return (
    <div>
      <Link href="/admin/events" className="text-sm text-muted-foreground hover:text-foreground">
        ← Sự kiện
      </Link>
      <h1 className="mt-2 font-heading text-3xl tracking-wide text-primary">QUAY SỐ MAY MẮN</h1>
      <p className="mt-1 text-sm text-muted-foreground">{event.title}</p>

      <section className="mt-8 max-w-xl">
        <h2 className="font-heading text-lg tracking-wide text-accent">Phiên quay</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Quay ngẫu nhiên trong mọi ghế đã đặt ({state.bookedCount} ghế). Ghế đã trúng không quay
          lại; người trúng vắng mặt thì huỷ lượt để quay lại, ghế đó vẫn bị loại.
        </p>
        <LuckyDrawForm
          action={saveLuckyDraw.bind(null, id)}
          defaultRounds={state.draw?.totalRounds ?? Math.min(10, Math.max(1, state.bookedCount))}
          isNew={!state.draw}
        />
        {state.draw && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href={`/admin/events/${id}/lucky-draw/stage`}
              className={cn(buttonVariants({ size: "lg" }))}
            >
              Mở màn quay
            </Link>
            <span className="text-sm text-muted-foreground">
              Đã quay {Math.min(state.round - 1, state.draw.totalRounds)}/{state.draw.totalRounds}{" "}
              lượt · còn {state.eligible.length} ghế
            </span>
            <SeatAdminButton
              action={resetLuckyDraw.bind(null, id)}
              label="Quay lại từ đầu"
              confirmText="Xoá phiên và TOÀN BỘ kết quả đã quay? Không hoàn tác được."
              variant="destructive"
              size="sm"
            />
          </div>
        )}
      </section>

      {winnerRows.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-heading text-lg tracking-wide text-accent">Kết quả</h2>
            <CopyWinnersButton text={copyText} />
          </div>
          <div className="mt-4 rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lượt</TableHead>
                  <TableHead>Ghế</TableHead>
                  <TableHead>Người mua</TableHead>
                  <TableHead>SĐT</TableHead>
                  <TableHead>Giờ quay</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {winnerRows.map((w) => {
                  const user = userById.get(w.userId);
                  return (
                    <TableRow key={w.id} className={cn(w.voided && "text-muted-foreground")}>
                      <TableCell>{w.round}</TableCell>
                      <TableCell className={cn("font-semibold", w.voided && "line-through")}>
                        {w.seatCode}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{w.displayName}</div>
                        <div className="text-xs text-muted-foreground">{user?.email}</div>
                      </TableCell>
                      <TableCell>{user?.phone ?? "—"}</TableCell>
                      <TableCell>{formatTime(w.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        {w.voided ? (
                          <span className="text-xs">Vắng mặt</span>
                        ) : (
                          w.id === latestValidId && (
                            <SeatAdminButton
                              action={voidLuckyDrawWinner.bind(null, id, w.id)}
                              label="Vắng mặt"
                              confirmText={`Ghế ${w.seatCode} vắng mặt? Lượt ${w.round} sẽ được quay lại.`}
                              variant="outline"
                              size="sm"
                            />
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}
