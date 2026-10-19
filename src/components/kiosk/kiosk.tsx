"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { kioskCheckinQr, type KioskView } from "@/app/actions/checkin";
import { formatCheckinTime } from "@/components/scan/checkin-scan";
import { useIsNativeApp } from "@/lib/is-native-app";
import { cn } from "@/lib/utils";
import { DoomMascot, type MascotMood } from "./mascot";

// Camera chỉ chạy ở client + kéo theo @zxing -> tách bundle, không SSR.
const KioskCamera = dynamic(() => import("./kiosk-camera").then((m) => m.KioskCamera), {
  ssr: false,
});

// Câu ngắn cho khách — mọi lỗi đều kèm "Vui lòng gặp nhân viên".
const KIOSK_ERROR: Record<string, string> = {
  FORBIDDEN: "Máy kiosk chưa đăng nhập tài khoản nhân viên.",
  NOT_FOUND: "Không tìm thấy vé cho suất chiếu này.",
  NOT_PAID: "Đơn hàng chưa được thanh toán.",
  WRONG_EVENT: "Vé này thuộc suất chiếu khác.",
  NO_TICKET: "Đơn hàng không có vé xem phim cho suất này.",
};

type Screen =
  | { name: "home" }
  | { name: "scanning" }
  | { name: "checking" }
  | { name: "done"; view: KioskView }
  | { name: "error"; message: string };

// Màn kết quả tự quay về màn chính sau khoảng này.
const RESULT_TIMEOUT_MS = 8000;
// Cùng 1 mã còn trong khung hình -> bỏ qua trong khoảng này.
const RESCAN_COOLDOWN_MS = 4000;

/**
 * Màn hình kiosk tự check-in (máy tính bảng đặt ở cửa rạp, đăng nhập tài
 * khoản staff). Khách chạm "Check-in bằng QR" -> giơ QR vé (/my-tickets) trước
 * camera TRƯỚC -> check-in luôn + hiện tên, ghế, combo. Phủ toàn màn hình đè
 * lên header/footer của layout gốc.
 */
export function Kiosk({ eventId, title, subtitle }: { eventId: string; title: string; subtitle: string }) {
  const isNative = useIsNativeApp();
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [look, setLook] = useState<{ x: number; y: number } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const busyRef = useRef(false);
  const lastRef = useRef<{ code: string; at: number } | null>(null);

  const onCode = useCallback(
    async (code: string) => {
      if (busyRef.current || isRecent(lastRef.current, code)) return;
      busyRef.current = true;
      lastRef.current = { code, at: Date.now() };
      setScreen({ name: "checking" });
      try {
        const res = await kioskCheckinQr(code, eventId);
        if (res.ok) {
          if (res.value.justCheckedIn) celebrate();
          setScreen({ name: "done", view: res.value });
        } else {
          setScreen({ name: "error", message: KIOSK_ERROR[res.error] ?? "Mã QR không hợp lệ." });
        }
      } catch {
        setScreen({ name: "error", message: "Mất kết nối máy chủ." });
      } finally {
        busyRef.current = false;
      }
    },
    [eventId],
  );

  const goHome = useCallback(() => {
    setCameraError(null);
    setScreen({ name: "home" });
  }, []);

  // Kết quả / lỗi tự đóng sau vài giây cho khách sau.
  const showingResult = screen.name === "done" || screen.name === "error";
  useEffect(() => {
    if (!showingResult) return;
    const t = setTimeout(goHome, RESULT_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [showingResult, screen, goHome]);

  // Mắt linh vật liếc theo điểm chạm rồi trở về giữa.
  useEffect(() => {
    if (!look) return;
    const t = setTimeout(() => setLook(null), 1500);
    return () => clearTimeout(t);
  }, [look]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setLook({
      x: ((e.clientX - r.left) / r.width) * 2 - 1,
      y: ((e.clientY - r.top) / r.height) * 2 - 1,
    });
  }

  const scanning = screen.name === "scanning";
  const mood: MascotMood =
    scanning || screen.name === "checking"
      ? "scanning"
      : screen.name === "error"
        ? "error"
        : screen.name === "done"
          ? screen.view.justCheckedIn
            ? "success"
            : "idle"
          : "idle";
  const glow = screen.name === "done" && screen.view.shirts ? "#ffd23f" : undefined;

  return (
    <div
      onPointerDown={onPointerDown}
      className={cn(
        "kiosk barcode-scanner-ui fixed inset-0 z-[70] flex touch-none select-none flex-col text-white",
        // Đang quét trên app: camera native nằm sau WebView -> nền phải trong suốt.
        scanning && isNative ? "bg-transparent" : "bg-[var(--kiosk-bg)]",
      )}
    >
      <header className="flex items-center justify-between gap-4 bg-[var(--kiosk-bg)] px-6 py-4">
        <div className="min-w-0">
          <p className="font-heading text-xl tracking-wide text-primary">MARVELVN · CHECK-IN</p>
          <p className="truncate text-sm text-white/70">
            {title} · {subtitle}
          </p>
        </div>
        {/* Phase 4 thay bằng thoát có PIN */}
        <Link href="/kiosk" className="shrink-0 text-xs text-white/30">
          Thoát
        </Link>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex items-center justify-center bg-[var(--kiosk-bg)] p-4 md:w-2/5">
          <DoomMascot mood={mood} glow={glow} look={look} className="size-48 md:size-80" />
        </div>

        <div
          className={cn(
            "relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden p-6",
            !scanning && "bg-[var(--kiosk-bg)]",
          )}
        >
          {screen.name === "home" && (
            <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
              <p className="text-2xl font-semibold">Xin chào! Mời bạn check-in</p>
              <button
                type="button"
                onClick={() => setScreen({ name: "scanning" })}
                className="w-full rounded-2xl bg-primary px-8 py-6 text-2xl font-bold text-primary-foreground shadow-lg active:scale-95"
              >
                Check-in bằng QR
              </button>
              <p className="text-sm text-white/60">
                Mở “Vé của tôi” trên điện thoại để lấy mã QR.
              </p>
            </div>
          )}

          {scanning && (
            <>
              {cameraError ? (
                <p className="max-w-md text-center text-lg">{cameraError} Vui lòng gặp nhân viên.</p>
              ) : (
                <KioskCamera onCode={onCode} onError={setCameraError} />
              )}
              <div className="relative mt-auto flex w-full items-center justify-between gap-4">
                <p className="rounded-xl bg-black/60 px-4 py-2 text-lg">Đưa mã QR vào camera</p>
                <button
                  type="button"
                  onClick={goHome}
                  className="rounded-xl bg-white/15 px-6 py-3 text-lg font-medium active:scale-95"
                >
                  Quay lại
                </button>
              </div>
            </>
          )}

          {screen.name === "checking" && <p className="text-2xl">Đang kiểm tra vé...</p>}

          {screen.name === "done" && <ResultPanel view={screen.view} onDone={goHome} />}

          {screen.name === "error" && (
            <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
              <p className="text-2xl font-semibold text-red-400">{screen.message}</p>
              <p className="text-xl">Vui lòng gặp nhân viên để được hỗ trợ.</p>
              <DoneButton onClick={goHome} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultPanel({ view, onDone }: { view: KioskView; onDone: () => void }) {
  return (
    <div className="flex w-full max-w-lg flex-col items-center gap-4 text-center">
      {view.justCheckedIn ? (
        <p className="text-3xl font-bold">Xin chào, {view.userName}!</p>
      ) : (
        <>
          <p className="text-2xl font-semibold">{view.userName}</p>
          <p className="rounded-xl bg-amber-400 px-4 py-2 text-lg font-semibold text-black">
            Bạn đã check-in {formatCheckinTime(view.checkedInAt, view.checkedInVia)}
          </p>
        </>
      )}

      <div>
        <p className="text-sm uppercase tracking-widest text-white/60">{view.tickets} vé · Ghế của bạn</p>
        {view.seats.length > 0 ? (
          <p className="font-heading text-5xl tracking-wide text-primary md:text-6xl">
            {view.seats.join(" · ")}
          </p>
        ) : (
          <p className="text-xl text-white/70">Chưa có ghế</p>
        )}
      </div>

      {view.seatsPending && (
        <p className="text-lg text-amber-300">
          Bạn chưa chọn đủ ghế ({view.seats.length}/{view.tickets}) — vui lòng gặp nhân viên.
        </p>
      )}
      {view.combos.length > 0 && <p className="text-lg text-white/80">{view.combos.join(" · ")}</p>}
      {view.shirts && (
        <p className="rounded-xl border border-amber-300/60 px-4 py-2 text-lg text-amber-300">
          Nhớ nhận áo tại quầy: {view.shirts}
        </p>
      )}

      <DoneButton onClick={onDone} />
    </div>
  );
}

function DoneButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 rounded-xl bg-white/15 px-10 py-3 text-xl font-medium active:scale-95"
    >
      Xong
    </button>
  );
}

function isRecent(last: { code: string; at: number } | null, code: string): boolean {
  return !!last && last.code === code && Date.now() - last.at < RESCAN_COOLDOWN_MS;
}

/** Âm "ting" (WebAudio, không cần file) + rung nhẹ nếu máy hỗ trợ. */
function celebrate() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    for (const [freq, at] of [
      [1318.5, 0],
      [1760, 0.12],
    ] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.3, now + at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.55);
    }
    setTimeout(() => void ctx.close(), 1000);
  } catch {
    /* không có âm thanh thì thôi */
  }
  navigator.vibrate?.(80);
}
