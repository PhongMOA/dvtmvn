import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isStaff } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { formatEventStart } from "@/lib/datetime";
import { ScanCheckin } from "@/components/scan/scan-checkin";

export const metadata: Metadata = { title: "Check-in" };

// Suất chiếu đã bắt đầu quá mốc này vẫn coi là "đang diễn ra" khi chọn mặc định.
const RUNNING_WINDOW_MS = 6 * 60 * 60 * 1000;

/** Mặc định: suất gần nhất chưa kết thúc, hết thì suất cuối cùng. */
function pickCurrentEvent<T extends { startAt: Date }>(events: T[]): T {
  const now = Date.now();
  return (
    events.find((e) => e.startAt.getTime() + RUNNING_WINDOW_MS >= now) ?? events[events.length - 1]
  );
}

/**
 * Trang check-in cho nhân viên (role staff) + admin: quét QR (camera native
 * trong app Android, getUserMedia trên web) hoặc tìm khách theo tên/SĐT.
 * Check-in theo người + suất chiếu — xem src/lib/checkin.ts.
 */
export default async function ScanPage() {
  const session = await auth();
  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent("/scan")}`);
  }
  if (!(await isStaff(session.user))) redirect("/");

  const events = await prisma.event.findMany({
    where: { status: { not: "draft" }, comboTypes: { some: { includesTicket: true } } },
    orderBy: { startAt: "asc" },
    select: { id: true, title: true, venue: true, startAt: true, startAtTentative: true },
  });

  if (events.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-12 text-muted-foreground">
        Chưa có suất chiếu nào bán vé.
      </div>
    );
  }

  const current = pickCurrentEvent(events);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <ScanCheckin
        events={events.map((e) => ({
          id: e.id,
          label: `${e.title} — ${formatEventStart(e, "short")} · ${e.venue}`,
        }))}
        defaultEventId={current.id}
      />
    </div>
  );
}
