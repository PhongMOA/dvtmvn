import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSeatState } from "@/app/actions/seats";
import { SeatPicker } from "@/components/seat-picker";

export default async function SeatSelectionPage({
  params,
}: PageProps<"/my-tickets/seats/[eventId]">) {
  const { eventId } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/my-tickets/seats/${eventId}`)}`);
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true, venue: true },
  });
  if (!event) notFound();

  const initial = await getSeatState(eventId);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <Link href="/my-tickets" className="text-sm text-muted-foreground hover:text-foreground">
        ← Vé của tôi
      </Link>
      <h1 className="mt-2 font-heading text-3xl tracking-wide text-primary">CHỌN GHẾ</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {event.title} · {event.venue}
      </p>
      <div className="mt-6">
        <SeatPicker eventId={eventId} initial={initial} />
      </div>
    </main>
  );
}
