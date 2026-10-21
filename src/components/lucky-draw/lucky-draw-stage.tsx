"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Maximize, Minimize, Trophy, Volume2, VolumeX } from "lucide-react";
import { spinLuckyDraw, voidLuckyDrawWinner, type SpinResult } from "@/app/actions/lucky-draw";
import type { LuckyDrawWinnerView } from "@/lib/lucky-draw";
import { RECENT_WINDOW, SPIN_TIMING, buildFinale, pickNext } from "@/lib/lucky-draw-rules";
import { SeatMap } from "@/components/seat-map";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Confetti } from "./confetti";
import { playTick, playWin, unlockAudio } from "./sound";

/**
 * Màn quay số chiếu lên màn rạp. Server chọn ghế trúng (spinLuckyDraw) ngay khi
 * bấm Quay; trong lúc chờ, ô sáng đã chạy nhanh (chặng 1), có kết quả thì chạy
 * buildFinale (chậm dần → thật chậm) và dừng đúng ghế đó.
 *
 * State giữ ở client từ props ban đầu — refresh RSC không làm lệch hiệu ứng
 * đang chạy; F5 thì đọc lại từ DB nên vẫn đúng lượt.
 */

type Phase = "idle" | "spinning" | "popup";

const BLINK_MS = 1400;

export function LuckyDrawStage({
  eventId,
  eventTitle,
  totalRounds,
  initialWinners,
  initialEligible,
}: {
  eventId: string;
  eventTitle: string;
  totalRounds: number;
  initialWinners: LuckyDrawWinnerView[];
  initialEligible: string[];
}) {
  const [winners, setWinners] = useState(initialWinners);
  const [eligible, setEligible] = useState(initialEligible);
  const [phase, setPhase] = useState<Phase>("idle");
  const [active, setActive] = useState<string | null>(null);
  const [blink, setBlink] = useState(false);
  const [bigCode, setBigCode] = useState<string | null>(null);
  const [popup, setPopup] = useState<LuckyDrawWinnerView | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [scale, setScale] = useState(1);

  const stageRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const alive = useRef(true);
  const mutedRef = useRef(muted);

  const valid = winners.filter((w) => !w.voided);
  const round = valid.length + 1;
  const done = round > totalRounds;

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    alive.current = true;
    const pending = timers.current;
    return () => {
      alive.current = false;
      pending.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  // Phóng sơ đồ vừa khung (offsetWidth/Height không bị transform ảnh hưởng).
  useEffect(() => {
    const area = areaRef.current;
    const map = mapRef.current;
    if (!area || !map) return;
    const fit = () => {
      const s = Math.min(
        area.clientWidth / map.offsetWidth,
        area.clientHeight / map.offsetHeight,
        3,
      );
      setScale(Number.isFinite(s) && s > 0 ? s : 1);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(area);
    fit();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function wait(ms: number) {
    return new Promise<void>((resolve) => {
      timers.current.push(window.setTimeout(resolve, ms));
    });
  }

  function light(code: string, heavy: boolean) {
    setActive(code);
    if (!mutedRef.current) playTick(heavy);
  }

  async function spin() {
    if (phase !== "idle" || done || eligible.length === 0) return;
    unlockAudio();
    setPhase("spinning");
    setShowSummary(false);
    setBigCode(null);

    const box: { result?: SpinResult } = {};
    spinLuckyDraw(eventId).then(
      (r) => (box.result = r),
      () => (box.result = { ok: false, error: "Mất kết nối, vui lòng thử lại." }),
    );

    // Chặng 1: chạy nhanh tới khi đủ fastMinMs VÀ đã có kết quả.
    const recent: string[] = [];
    const startedAt = performance.now();
    while (!box.result || performance.now() - startedAt < SPIN_TIMING.fastMinMs) {
      if (!alive.current) return;
      const code = pickNext(eligible, recent.slice(-RECENT_WINDOW));
      recent.push(code);
      light(code, false);
      await wait(SPIN_TIMING.fastStepMs);
    }
    if (!alive.current) return;

    const result = box.result;
    if (!result.ok) {
      toast.error(result.error);
      setActive(null);
      setPhase("idle");
      return;
    }

    // Chặng 2 + 3: chậm dần → thật chậm → dừng ở ghế thắng.
    const steps = buildFinale(result.pool, result.winner.seatCode, recent.slice(-RECENT_WINDOW));
    for (let i = 0; i < steps.length; i++) {
      if (!alive.current) return;
      const step = steps[i];
      const heavy = step.holdMs >= SPIN_TIMING.crawlMs[0] || i === steps.length - 1;
      light(step.code, heavy);
      if (heavy) setBigCode(step.code);
      if (step.holdMs > 0) await wait(step.holdMs);
    }

    setBlink(true);
    if (!mutedRef.current) playWin();
    await wait(BLINK_MS);
    if (!alive.current) return;
    setBlink(false);

    const winner = result.winner;
    setWinners((list) => [...list, winner]);
    setEligible((list) => list.filter((code) => code !== winner.seatCode));
    setPopup(winner);
    setPhase("popup");
  }

  function closePopup() {
    setPopup(null);
    setActive(null);
    setBigCode(null);
    setPhase("idle");
    if (popup && popup.round >= totalRounds) setShowSummary(true);
  }

  async function markAbsent() {
    if (!popup) return;
    if (!window.confirm(`Ghế ${popup.seatCode} vắng mặt? Lượt ${popup.round} sẽ được quay lại.`)) {
      return;
    }
    const target = popup;
    const result = await voidLuckyDrawWinner(eventId, target.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setWinners((list) => list.map((w) => (w.id === target.id ? { ...w, voided: true } : w)));
    setPopup(null);
    setActive(null);
    setBigCode(null);
    setPhase("idle");
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stageRef.current?.requestFullscreen();
  }

  // Phím tắt: Space/Enter = Quay (hoặc Tiếp tục khi đang hiện popup), F = toàn màn hình.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat || e.target instanceof HTMLInputElement) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (phase === "popup") closePopup();
        else void spin();
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div
      ref={stageRef}
      className={cn(
        "relative flex flex-col overflow-hidden bg-zinc-950 text-white",
        fullscreen ? "h-screen w-screen p-6" : "h-[85vh] rounded-xl border border-border p-4",
      )}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-heading text-sm tracking-[0.3em] text-amber-300">QUAY SỐ MAY MẮN</p>
          <h1 className="truncate font-heading text-2xl tracking-wide sm:text-3xl">{eventTitle}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <div className="text-right">
            <p className="font-heading text-3xl tabular-nums sm:text-4xl">
              {done ? "XONG" : `LƯỢT ${round}/${totalRounds}`}
            </p>
            <p className="text-sm text-white/60">Còn {eligible.length} ghế</p>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 hover:text-white"
              onClick={() => setShowSummary((v) => !v)}
              aria-label="Danh sách trúng thưởng"
            >
              <Trophy />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 hover:text-white"
              onClick={() => setMuted((v) => !v)}
              aria-label={muted ? "Bật âm thanh" : "Tắt âm thanh"}
            >
              {muted ? <VolumeX /> : <Volume2 />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 hover:text-white"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
            >
              {fullscreen ? <Minimize /> : <Maximize />}
            </Button>
          </div>
        </div>
      </header>

      <div ref={areaRef} className="relative my-4 min-h-0 flex-1">
        <div
          ref={mapRef}
          className="absolute top-1/2 left-1/2 w-max"
          style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
        >
          <SeatMap
            taken={new Set()}
            drawMode={{
              eligible: new Set(eligible),
              winners: new Set(valid.map((w) => w.seatCode)),
              voided: new Set(winners.filter((w) => w.voided).map((w) => w.seatCode)),
              active,
              blink,
            }}
          />
        </div>
        {bigCode && phase === "spinning" && (
          <p
            key={bigCode}
            className="pointer-events-none absolute top-0 right-0 font-heading text-7xl text-white drop-shadow-[0_0_24px_rgba(255,255,255,0.6)] sm:text-8xl"
          >
            {bigCode}
          </p>
        )}
      </div>

      <footer className="flex flex-col items-center gap-3">
        <Button
          size="lg"
          onClick={() => void spin()}
          disabled={phase !== "idle" || done || eligible.length === 0}
          className="h-14 min-w-56 bg-amber-400 font-heading text-2xl tracking-widest text-amber-950 hover:bg-amber-300"
        >
          {phase === "spinning" ? "ĐANG QUAY..." : done ? "ĐÃ QUAY XONG" : "QUAY"}
        </Button>
        {!done && eligible.length === 0 && (
          <p className="text-sm text-red-300">Hết ghế để quay.</p>
        )}
        {valid.length > 0 && (
          <ul className="flex max-w-full flex-wrap justify-center gap-1.5">
            {valid.map((w) => (
              <li
                key={w.id}
                className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-xs text-amber-200"
                title={w.displayName}
              >
                {w.round}. {w.seatCode}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-white/40">Space: quay · F: toàn màn hình</p>
      </footer>

      {popup && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 p-4">
          <Confetti />
          <div className="relative w-full max-w-2xl rounded-2xl border-2 border-amber-300 bg-gradient-to-b from-amber-500/30 to-zinc-950 p-8 text-center shadow-[0_0_60px_rgba(251,191,36,0.4)]">
            <p className="font-heading text-xl tracking-[0.3em] text-amber-300">
              LƯỢT {popup.round}/{totalRounds} — TRÚNG THƯỞNG
            </p>
            <p className="mt-4 font-heading text-8xl leading-none text-white sm:text-[10rem]">
              {popup.seatCode}
            </p>
            <p className="mt-6 text-3xl font-semibold sm:text-4xl">{popup.displayName}</p>
            {popup.maskedPhone && (
              <p className="mt-2 text-lg text-white/70 tabular-nums">{popup.maskedPhone}</p>
            )}
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={closePopup}
                className="bg-amber-400 text-amber-950 hover:bg-amber-300"
              >
                Tiếp tục
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={() => void markAbsent()}
                className="text-white/70 hover:bg-white/10 hover:text-white"
              >
                Vắng mặt — quay lại lượt này
              </Button>
            </div>
          </div>
        </div>
      )}

      {showSummary && !popup && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/85 p-4">
          <div className="max-h-full w-full max-w-3xl overflow-y-auto rounded-2xl border border-amber-300/60 bg-zinc-950 p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-2xl tracking-widest text-amber-300">
                DANH SÁCH TRÚNG THƯỞNG
              </h2>
              <Button
                variant="ghost"
                onClick={() => setShowSummary(false)}
                className="text-white/70 hover:bg-white/10 hover:text-white"
              >
                Đóng
              </Button>
            </div>
            {valid.length === 0 ? (
              <p className="mt-6 text-white/60">Chưa có lượt nào.</p>
            ) : (
              <ol className="mt-4 grid gap-2 sm:grid-cols-2">
                {valid.map((w) => (
                  <li key={w.id} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
                    <span className="w-8 text-right text-white/50 tabular-nums">{w.round}.</span>
                    <span className="w-14 font-heading text-2xl text-amber-300">{w.seatCode}</span>
                    <span className="truncate text-lg">{w.displayName}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
