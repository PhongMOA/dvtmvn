import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isStaff } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { formatEventStart } from "@/lib/datetime";

export const metadata: Metadata = { title: "Kiosk check-in" };

/** Nhân viên chọn suất chiếu để bật máy kiosk tự check-in. */
export default async function KioskPickPage() {
  const session = await auth();
  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent("/kiosk")}`);
  }
  if (!(await isStaff(session.user))) redirect("/");

  const events = await prisma.event.findMany({
    where: { status: { not: "draft" }, comboTypes: { some: { includesTicket: true } } },
    orderBy: { startAt: "asc" },
    select: { id: true, title: true, venue: true, startAt: true, startAtTentative: true },
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="font-heading text-2xl tracking-wide text-primary">KIOSK CHECK-IN</h1>
      <p className="mt-1 text-sm text-muted-foreground">Chọn suất chiếu cho máy này.</p>
      {events.length === 0 ? (
        <p className="mt-6 text-muted-foreground">Chưa có suất chiếu nào bán vé.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/kiosk/${e.id}`} className="block p-4 hover:bg-muted/50">
                <span className="font-medium">{e.title}</span>
                <span className="block text-sm text-muted-foreground">
                  {formatEventStart(e, "short")} · {e.venue}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
