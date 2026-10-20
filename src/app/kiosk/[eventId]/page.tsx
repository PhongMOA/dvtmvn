import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { isStaff } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { Kiosk } from "@/components/kiosk/kiosk";

export const metadata: Metadata = { title: "Kiosk check-in" };

/** Màn hình kiosk tự check-in cho 1 suất chiếu — xem src/components/kiosk/kiosk.tsx. */
export default async function KioskPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/kiosk/${eventId}`)}`);
  }
  if (!(await isStaff(session.user))) redirect("/");

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) notFound();

  return <Kiosk eventId={eventId} />;
}
