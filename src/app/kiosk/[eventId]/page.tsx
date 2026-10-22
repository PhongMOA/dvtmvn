import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { isStaff } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getKioskLook } from "@/app/actions/kiosk-uni";
import { UniKiosk } from "@/components/kiosk-uni/uni-kiosk";

export const metadata: Metadata = { title: "Kiosk check-in" };

/** Màn hình kiosk tự check-in cho 1 suất chiếu — linh vật Uni, xem src/components/kiosk-uni/uni-kiosk.tsx. */
export default async function KioskPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/kiosk/${eventId}`)}`);
  }
  if (!(await isStaff(session.user))) redirect("/");

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) notFound();

  return <UniKiosk eventId={eventId} initialLook={await getKioskLook()} />;
}
