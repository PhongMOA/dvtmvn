"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirmSeats, getSeatState, type SeatState } from "@/app/actions/seats";
import { SeatLegend, SeatMap } from "@/components/seat-map";
import { SEAT_LAYOUT, sweetboxPartner, type Seat } from "@/lib/seats/layout";
import { validateSelection } from "@/lib/seats/rules";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { VN_TIME_ZONE } from "@/lib/datetime";

const POLL_MS = 5000;

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: VN_TIME_ZONE,
  }).format(new Date(iso));
}

export function SeatPicker({ eventId, initial }: { eventId: string; initial: SeatState }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [picked, setPicked] = useState<string[]>([]);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [isPending, startTransition] = useTransition();
  const pickedRef = useRef(picked);
  useEffect(() => {
    pickedRef.current = picked;
  }, [picked]);

  const taken = useMemo(() => new Set(state.taken), [state.taken]);
  const mine = useMemo(() => new Set(state.mine), [state.mine]);
  const pickedSet = useMemo(() => new Set(picked), [picked]);
  const unlockAt = state.unlockAt ? new Date(state.unlockAt).getTime() : null;
  const unlocked = unlockAt !== null && now >= unlockAt;

  const refresh = useCallback(async () => {
    try {
      const next = await getSeatState(eventId);
      setState(next);
      // Ghế đang chọn mà vừa bị người khác lấy -> bỏ toàn bộ lựa chọn để chọn lại.
      const lost = pickedRef.current.filter((code) => next.taken.includes(code));
      if (lost.length > 0) {
        toast.error(`Ghế ${lost.join(", ")} vừa có người chọn, vui lòng chọn lại.`);
        setPicked([]);
      }
    } catch {
      // Lỗi mạng tạm thời — lần poll sau thử lại.
    }
  }, [eventId]);

  // Poll sơ đồ khi tab đang hiển thị; quay lại tab thì cập nhật ngay.
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const check =
    picked.length === state.ticketsLeft && picked.length > 0
      ? validateSelection(SEAT_LAYOUT, { taken, picked, ticketsNeeded: state.ticketsLeft })
      : null;

  function handleSeatClick(seat: Seat) {
    if (!unlocked || state.ticketsLeft === 0) return;
    setHighlight(null);
    const partner = sweetboxPartner(seat);
    const group = partner ? [seat.code, partner] : [seat.code];

    if (pickedSet.has(seat.code)) {
      setPicked((prev) => prev.filter((code) => !group.includes(code)));
      return;
    }
    if (partner && taken.has(partner)) {
      toast.error(`Ghế đôi ${seat.code} + ${partner} đã có người chọn.`);
      return;
    }
    if (picked.length + group.length > state.ticketsLeft) {
      toast.error(
        partner && state.ticketsLeft - picked.length === 1
          ? "Ghế Sweetbox là ghế đôi, cần còn ít nhất 2 vé."
          : `Bạn chỉ còn ${state.ticketsLeft} vé — bỏ chọn bớt ghế để đổi.`,
      );
      return;
    }
    setPicked((prev) => [...prev, ...group]);
  }

  function handleConfirm() {
    setConfirmOpen(false);
    startTransition(async () => {
      const result = await confirmSeats(eventId, picked);
      if (!result.ok) {
        toast.error(result.error);
        setHighlight(result.seat ?? null);
        await refresh();
        return;
      }
      toast.success(`Đã chọn ghế ${result.seats.join(", ")}.`);
      setPicked([]);
      await refresh();
      router.refresh();
    });
  }

  if (state.unlockAt === null) {
    return <p className="text-muted-foreground">Bạn chưa có lượt chọn ghế ở sự kiện này.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border p-4 text-sm">
        {state.ticketsLeft === 0 ? (
          <p className="text-foreground">
            Bạn đã chọn đủ {state.ticketCount} ghế:{" "}
            <span className="font-medium text-accent">{state.mine.join(", ")}</span>
          </p>
        ) : !unlocked ? (
          <p className="text-foreground">
            Chưa tới lượt — bạn được chọn ghế từ{" "}
            <span className="font-medium text-primary">{formatTime(state.unlockAt)}</span>.
          </p>
        ) : (
          <p className="text-foreground">
            Chọn <span className="font-medium text-primary">{state.ticketsLeft}</span> ghế
            {state.mine.length > 0 && ` (đã có: ${state.mine.join(", ")})`}. Đang chọn{" "}
            {picked.length}/{state.ticketsLeft}. Chọn xong là chốt, không đổi được.
          </p>
        )}
      </div>

      <SeatMap
        taken={taken}
        mine={mine}
        picked={pickedSet}
        highlight={highlight ?? (check && !check.ok ? (check.seat ?? null) : null)}
        onSeatClick={unlocked && state.ticketsLeft > 0 ? handleSeatClick : undefined}
      />
      <SeatLegend />

      {unlocked && state.ticketsLeft > 0 && (
        <div className="flex flex-col gap-2">
          {check && !check.ok && <p className="text-sm text-destructive">{check.reason}</p>}
          <Button
            size="lg"
            className="w-fit"
            disabled={isPending || !check?.ok}
            onClick={() => setConfirmOpen(true)}
          >
            {isPending ? "Đang xác nhận..." : `Xác nhận ${picked.length} ghế`}
          </Button>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Xác nhận chọn ghế</DialogTitle>
            <DialogDescription>
              Ghế {picked.join(", ")}. Sau khi xác nhận sẽ không đổi được ghế.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Chọn lại
            </Button>
            <Button onClick={handleConfirm}>Xác nhận</Button>
          </div>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
