"use client";

import { SEAT_LAYOUT, type Seat } from "@/lib/seats/layout";
import { cn } from "@/lib/utils";

/**
 * Sơ đồ ghế (theo SEAT_LAYOUT). Thuần hiển thị — state chọn ghế do SeatPicker
 * (user) giữ; admin truyền occupants để hover xem ai ngồi.
 *
 * Hàng 3 khối: mỗi khối có độ rộng cố định = khối dài nhất cùng vị trí, khối
 * trái canh phải, khối phải canh trái — các cột ghế thẳng hàng như ảnh rạp.
 * Hàng 1 khối (Sweetbox) căn giữa, ghép cặp sát nhau.
 */

const SEAT_PX = 30; // size-7 (28px) + gap 2px

const SEGMENT_WIDTHS: number[] = (() => {
  const widths: number[] = [];
  for (const row of SEAT_LAYOUT) {
    if (row.segments.length < 2) continue;
    row.segments.forEach((segment, i) => {
      widths[i] = Math.max(widths[i] ?? 0, segment.length);
    });
  }
  return widths;
})();

export type SeatMapProps = {
  taken: Set<string>;
  mine?: Set<string>;
  picked?: Set<string>;
  highlight?: string | null; // ghế bị luật báo lỗi
  occupants?: Record<string, string>; // admin: mã ghế -> tên người ngồi
  onSeatClick?: (seat: Seat) => void;
};

export function SeatMap({
  taken,
  mine,
  picked,
  highlight,
  occupants,
  onSeatClick,
}: SeatMapProps) {
  function renderSeat(seat: Seat) {
    const isMine = mine?.has(seat.code) ?? false;
    const isPicked = picked?.has(seat.code) ?? false;
    const isTaken = taken.has(seat.code) && !isMine;
    const isBlocked = seat.type === "blocked";
    const clickable = !!onSeatClick && !isBlocked && !isTaken && !isMine;
    const occupant = occupants?.[seat.code];

    return (
      <button
        key={seat.code}
        type="button"
        disabled={!clickable}
        onClick={clickable ? () => onSeatClick?.(seat) : undefined}
        title={occupant ? `${seat.code} — ${occupant}` : seat.code}
        aria-pressed={isPicked}
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-sm border text-[9px] font-medium leading-none transition-colors",
          seat.type === "normal" && "border-primary/60 text-foreground",
          seat.type === "vip" && "border-red-500/70 text-foreground",
          seat.type === "sweetbox" && "border-pink-400 bg-pink-500/25 text-foreground",
          isBlocked && "border-border bg-muted text-muted-foreground line-through opacity-50",
          isTaken && "border-transparent bg-muted-foreground/30 text-muted-foreground",
          isMine && "border-accent bg-accent text-accent-foreground",
          isPicked && "border-primary bg-primary text-primary-foreground",
          highlight === seat.code && "ring-2 ring-destructive ring-offset-1 ring-offset-background",
          clickable && !isPicked && "hover:bg-primary/20",
          occupants && isTaken && "cursor-help",
        )}
      >
        {seat.code}
      </button>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="mx-auto flex w-max flex-col gap-0.5 px-1">
        <div className="mb-4 rounded-b-[50%] border-t-4 border-muted-foreground/40 pt-1 text-center text-xs tracking-[0.3em] text-muted-foreground">
          MÀN HÌNH
        </div>
        {SEAT_LAYOUT.map((row) => (
          <div
            key={row.label}
            className={cn("flex items-center gap-3", row.segments.length === 1 && "mt-3")}
          >
            <span className="w-4 shrink-0 text-center text-xs text-muted-foreground">
              {row.label}
            </span>
            {row.segments.length === 1 ? (
              <div className="flex flex-1 justify-center gap-1">
                {pairs(row.segments[0]).map((group) => (
                  <div key={group[0].code} className="flex gap-px">
                    {group.map(renderSeat)}
                  </div>
                ))}
              </div>
            ) : (
              row.segments.map((segment, i) => (
                <div
                  key={i}
                  style={{ width: SEGMENT_WIDTHS[i] * SEAT_PX }}
                  className={cn(
                    "flex gap-0.5",
                    i === 0 && "justify-end",
                    i === row.segments.length - 1 && "justify-start",
                  )}
                >
                  {segment.map(renderSeat)}
                </div>
              ))
            )}
            <span className="w-4 shrink-0 text-center text-xs text-muted-foreground">
              {row.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Ghế Sweetbox gom theo cặp (liền kề trong segment) để vẽ sát nhau.
function pairs(segment: Seat[]): Seat[][] {
  if (!segment.some((s) => s.type === "sweetbox")) return segment.map((s) => [s]);
  const groups: Seat[][] = [];
  for (let i = 0; i < segment.length; i += 2) groups.push(segment.slice(i, i + 2));
  return groups;
}

export function SeatLegend({ withPicked = true }: { withPicked?: boolean }) {
  const items: [string, string][] = [
    ["border-primary/60", "Thường"],
    ["border-red-500/70", "VIP"],
    ["border-pink-400 bg-pink-500/25", "Sweetbox (ghế đôi)"],
    ["border-transparent bg-muted-foreground/30", "Đã có người"],
    ["border-accent bg-accent", "Ghế của bạn"],
    ...(withPicked ? ([["border-primary bg-primary", "Đang chọn"]] as [string, string][]) : []),
    ["border-border bg-muted opacity-50", "Không thể chọn"],
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {items.map(([cls, label]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className={cn("size-3.5 rounded-sm border", cls)} />
          {label}
        </li>
      ))}
    </ul>
  );
}
