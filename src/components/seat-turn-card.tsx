"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VN_TIME_ZONE } from "@/lib/datetime";

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Lượt chọn ghế của user ở 1 event (trang Vé của tôi). Chưa tới unlockAt: nút
 * disabled + đếm ngược, tới giờ tự bật (không cần tải lại). Server vẫn chặn
 * độc lập trong confirmSeats — nút chỉ là UX.
 */
export function SeatTurnCard({
  eventId,
  eventTitle,
  unlockAt,
  ticketCount,
  seats,
}: {
  eventId: string;
  eventTitle: string;
  unlockAt: string; // ISO
  ticketCount: number;
  seats: string[];
}) {
  const unlockMs = new Date(unlockAt).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // now null ở SSR/lần render đầu (tránh lệch hydration), lấy giờ client ngay sau mount.
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  const ticketsLeft = Math.max(0, ticketCount - seats.length);
  const unlocked = now !== null && now >= unlockMs;
  const unlockLabel = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: VN_TIME_ZONE,
  }).format(new Date(unlockAt));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm">
        <p className="font-medium text-foreground">Chọn ghế · {eventTitle}</p>
        {ticketsLeft === 0 ? (
          <p className="mt-1 text-muted-foreground">
            Ghế của bạn: <span className="font-medium text-accent">{seats.join(", ")}</span>
          </p>
        ) : (
          <p className="mt-1 text-muted-foreground">
            {ticketsLeft} vé chưa chọn ghế · Lượt của bạn: {unlockLabel}
            {now !== null && !unlocked && ` (còn ${formatCountdown(unlockMs - now)})`}
            {seats.length > 0 && ` · Đã có: ${seats.join(", ")}`}
          </p>
        )}
      </div>
      {ticketsLeft > 0 &&
        (unlocked ? (
          <Link href={`/my-tickets/seats/${eventId}`} className={cn(buttonVariants(), "w-fit")}>
            Chọn ghế
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className={cn(buttonVariants(), "pointer-events-none w-fit opacity-50")}
          >
            Chọn ghế
          </span>
        ))}
    </div>
  );
}
