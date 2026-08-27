"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Đồng hồ đếm ngược tới lúc mở bán combo. Nhận `serverNowMs` từ server component
// để lần render đầu ở client khớp SSR (tránh hydration mismatch ở chữ số giây);
// sau khi mount mới bắt đầu tick theo Date.now() thật. Hết giờ -> router.refresh()
// để server render lại trang chủ ở trạng thái "đã mở bán".
export function SalesCountdown({
  targetIso,
  serverNowMs,
}: {
  targetIso: string;
  serverNowMs: number;
}) {
  const router = useRouter();
  const targetMs = new Date(targetIso).getTime();
  const [nowMs, setNowMs] = useState(serverNowMs);

  useEffect(() => {
    const id = setInterval(() => {
      const current = Date.now();
      setNowMs(current);
      if (current >= targetMs) {
        clearInterval(id);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [targetMs, router]);

  const totalSeconds = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  const cells = [
    { label: "Ngày", value: Math.floor(totalSeconds / 86400) },
    { label: "Giờ", value: Math.floor((totalSeconds % 86400) / 3600) },
    { label: "Phút", value: Math.floor((totalSeconds % 3600) / 60) },
    { label: "Giây", value: totalSeconds % 60 },
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="font-heading text-2xl leading-none tracking-wide text-foreground sm:text-3xl">
        Doomsday is coming
      </p>
      <div className="flex gap-2 sm:gap-3">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className="flex min-w-[64px] flex-col items-center rounded-lg border border-border bg-card/80 px-3 py-2 backdrop-blur sm:min-w-[84px] sm:px-4 sm:py-3"
          >
            <span className="font-heading text-3xl tabular-nums leading-none text-primary sm:text-4xl">
              {String(cell.value).padStart(2, "0")}
            </span>
            <span className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">
              {cell.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
