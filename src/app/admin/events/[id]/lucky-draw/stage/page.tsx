import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDrawState } from "@/lib/lucky-draw";
import { LuckyDrawStage } from "@/components/lucky-draw/lucky-draw-stage";

export default async function LuckyDrawStagePage({
  params,
}: PageProps<"/admin/events/[id]/lucky-draw/stage">) {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id }, select: { id: true, title: true } });
  if (!event) notFound();

  const state = await getDrawState(id);
  if (!state.draw) redirect(`/admin/events/${id}/lucky-draw`);

  return (
    <div>
      <Link
        href={`/admin/events/${id}/lucky-draw`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Cài đặt quay số
      </Link>
      <div className="mt-3">
        <LuckyDrawStage
          eventId={id}
          eventTitle={event.title}
          totalRounds={state.draw.totalRounds}
          initialWinners={state.winners}
          initialEligible={state.eligible}
        />
      </div>
    </div>
  );
}
