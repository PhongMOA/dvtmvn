"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { registerPlugin } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  kioskCheckinQr,
  kioskConfirmPhone,
  kioskLookupPhone,
  type KioskPhonePreview,
  type KioskView,
} from "@/app/actions/checkin";
import { Logo } from "@/components/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCheckinTime } from "@/components/scan/checkin-scan";
import { useIsNativeApp } from "@/lib/is-native-app";
import { cn } from "@/lib/utils";
import { DoomMascot, type MascotMood } from "./mascot";
import { doomLine, type DoomMoment } from "./doom-lines";
import { PhoneKeypad } from "./phone-keypad";
import { ScanBeams } from "./scan-beams";
import { SpeechBubble } from "./speech-bubble";

// Camera chỉ chạy ở client + kéo theo @zxing -> tách bundle, không SSR.
const KioskCamera = dynamic(() => import("./kiosk-camera").then((m) => m.KioskCamera), {
  ssr: false,
});

// Plugin native trong app (android/.../ImmersivePlugin.java).
const Immersive = registerPlugin<{ enter(): Promise<void>; exit(): Promise<void> }>("Immersive");

// Câu ngắn cho khách — mọi lỗi đều kèm "Vui lòng gặp nhân viên".
const KIOSK_ERROR: Record<string, string> = {
  FORBIDDEN: "Máy kiosk chưa đăng nhập tài khoản nhân viên.",
  NOT_FOUND: "Không tìm thấy vé cho suất chiếu này.",
  NOT_PAID: "Đơn hàng chưa được thanh toán.",
  WRONG_EVENT: "Vé này thuộc suất chiếu khác.",
  NO_TICKET: "Đơn hàng không có vé xem phim cho suất này.",
  AMBIGUOUS: "Số điện thoại này khớp nhiều tài khoản.",
};

type Screen =
  | { name: "home" }
  | { name: "scanning" }
  | { name: "phone" }
  | { name: "phone-confirm"; phone: string; preview: KioskPhonePreview }
  | { name: "checking" }
  | { name: "done"; view: KioskView }
  | { name: "error"; code: string; message: string };

// Màn chờ: Doom đổi câu thoại sau mỗi khoảng này.
const HOME_LINE_MS = 7000;

// Màn kết quả tự quay về màn chính sau khoảng này.
const RESULT_TIMEOUT_MS = 8000;
// Cùng 1 mã còn trong khung hình -> bỏ qua trong khoảng này.
const RESCAN_COOLDOWN_MS = 4000;

/**
 * Màn hình kiosk tự check-in (máy tính bảng đặt ở cửa rạp, đăng nhập tài
 * khoản staff). Khách chọn:
 * - "Quét mã QR" -> giơ QR vé (/my-tickets) trước camera TRƯỚC -> check-in luôn.
 * - "Nhập số điện thoại" -> bàn phím số -> xác nhận tên đã che -> check-in.
 * Xong hiện tên, ghế, combo. Phủ toàn màn hình đè lên header/footer gốc.
 */
export function Kiosk({ eventId }: { eventId: string }) {
  const isNative = useIsNativeApp();
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [look, setLook] = useState<{ x: number; y: number } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const mascotRef = useRef<SVGSVGElement | null>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ code: string; at: number } | null>(null);

  // Kiosk luôn đặt máy nằm ngang: khoá xoay khi vào, mở khoá khi rời.
  // Trình duyệt thường từ chối (cần fullscreen) -> bỏ qua, đã có lớp nhắc xoay.
  useEffect(() => {
    ScreenOrientation.lock({ orientation: "landscape" }).catch(() => {});
    return () => {
      ScreenOrientation.unlock().catch(() => {});
    };
  }, []);

  // App: ẩn thanh trạng thái + thanh điều hướng/taskbar khi ở kiosk.
  // APK cũ chưa có plugin -> lời gọi bị từ chối, bỏ qua.
  useEffect(() => {
    if (!isNative) return;
    Immersive.enter().catch(() => {});
    return () => {
      Immersive.exit().catch(() => {});
    };
  }, [isNative]);

  // Kiosk đứng cả buổi: giữ màn hình luôn sáng (Screen Wake Lock, chạy cả
  // trong WebView app). Hệ thống tự nhả khóa khi app/tab ẩn -> xin lại khi hiện.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let released = false;
    const acquire = async () => {
      if (document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
      try {
        const l = await navigator.wakeLock.request("screen");
        if (released) void l.release();
        else lock = l;
      } catch {
        /* máy từ chối (pin yếu...) thì thôi */
      }
    };
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release();
    };
  }, []);

  // Gọi server, hiện "đang kiểm tra" trong lúc chờ; lỗi -> màn lỗi chung.
  const run = useCallback(
    async <T,>(
      call: () => Promise<{ ok: true; value: T } | { ok: false; error: string }>,
      onOk: (value: T) => void,
    ) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setScreen({ name: "checking" });
      try {
        const res = await call();
        if (res.ok) onOk(res.value);
        else {
          setScreen({
            name: "error",
            code: res.error,
            message: KIOSK_ERROR[res.error] ?? "Mã QR không hợp lệ.",
          });
        }
      } catch {
        setScreen({ name: "error", code: "NETWORK", message: "Mất kết nối máy chủ." });
      } finally {
        busyRef.current = false;
      }
    },
    [],
  );

  const showDone = useCallback((view: KioskView) => {
    if (view.justCheckedIn) celebrate();
    setScreen({ name: "done", view });
  }, []);

  const onCode = useCallback(
    (code: string) => {
      if (busyRef.current || isRecent(lastRef.current, code)) return;
      lastRef.current = { code, at: Date.now() };
      void run(() => kioskCheckinQr(code, eventId), showDone);
    },
    [eventId, run, showDone],
  );

  const onPhone = (phone: string) =>
    void run(
      () => kioskLookupPhone(phone, eventId),
      (preview) => setScreen({ name: "phone-confirm", phone, preview }),
    );

  const onConfirmPhone = (phone: string) => void run(() => kioskConfirmPhone(phone, eventId), showDone);

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

  // Màn chờ: xoay vòng câu thoại.
  const [homeTick, setHomeTick] = useState(0);
  const onHome = screen.name === "home";
  useEffect(() => {
    if (!onHome) return;
    const t = setInterval(() => setHomeTick((n) => n + 1), HOME_LINE_MS);
    return () => clearInterval(t);
  }, [onHome]);

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
  const line = doomLine(doomMoment(screen, homeTick, cameraError));

  return (
    <div
      ref={rootRef}
      onPointerDown={onPointerDown}
      className={cn(
        "kiosk barcode-scanner-ui fixed inset-0 z-[70] flex touch-none select-none flex-col text-foreground",
        // Đang quét trên app: camera native nằm sau WebView -> nền phải trong suốt.
        scanning && isNative ? "bg-transparent" : "bg-[var(--kiosk-bg)]",
      )}
    >
      {/* Logo góc trái, nút thoát mờ góc phải (Phase 4 thay bằng thoát có PIN) */}
      <Logo className="pointer-events-none absolute left-5 top-4 z-20 h-11" />
      <Link href="/kiosk" className="absolute right-5 top-4 z-20 text-xs text-muted-foreground/50">
        Thoát
      </Link>

      <div className="flex min-h-0 flex-1 flex-col landscape:flex-row">
        <div className="flex min-h-0 flex-col items-center justify-center gap-0 bg-[var(--kiosk-bg)] px-4 pb-4 pt-14 landscape:w-2/5">
          <SpeechBubble line={line} />
          <DoomMascot
            ref={mascotRef}
            mood={mood}
            look={look}
            className="h-48 min-h-0 w-full landscape:h-auto landscape:flex-1"
          />
        </div>

        <div
          className={cn(
            "relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden p-6",
            !scanning && "bg-[var(--kiosk-bg)]",
          )}
        >
          {screen.name === "home" && (
            <div className="flex w-full max-w-xs flex-col items-stretch gap-3 text-center">
              <p className="mb-2 font-heading text-3xl tracking-wide">Mời bạn check-in</p>
              <button
                type="button"
                onClick={() => setScreen({ name: "scanning" })}
                className="kiosk-btn kiosk-btn-primary"
              >
                <QrIcon /> Quét mã QR
              </button>
              <button
                type="button"
                onClick={() => setScreen({ name: "phone" })}
                className="kiosk-btn kiosk-btn-outline"
              >
                <PhoneIcon /> Nhập số điện thoại
              </button>
              <p className="mt-2 text-sm text-muted-foreground">
                Mã QR nằm trong mục “Vé của tôi” trên điện thoại.
              </p>
            </div>
          )}

          {screen.name === "phone" && <PhoneKeypad onSubmit={onPhone} onCancel={goHome} />}

          {screen.name === "phone-confirm" && (
            <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center">
              <p className="text-sm uppercase tracking-widest text-muted-foreground">Có phải bạn là</p>
              <Avatar className="size-24 ring-2 ring-primary/60">
                {screen.preview.image && (
                  <AvatarImage
                    src={screen.preview.image}
                    alt={screen.preview.maskedName}
                    referrerPolicy="no-referrer"
                  />
                )}
                <AvatarFallback className="font-heading text-4xl text-primary">
                  {screen.preview.maskedName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p className="font-heading text-4xl tracking-wide text-primary">{screen.preview.maskedName}</p>
              <p className="text-muted-foreground">
                {screen.preview.tickets} vé
                {screen.preview.seats.length > 0 ? " · Ghế" : " · Chưa chọn ghế"}
              </p>
              {screen.preview.seats.length > 0 && (
                <p className="font-heading text-3xl tracking-wide">{screen.preview.seats.join(" · ")}</p>
              )}
              <div className="mt-3 flex w-full gap-2">
                <button type="button" onClick={goHome} className="kiosk-btn kiosk-btn-ghost flex-1">
                  Không phải
                </button>
                <button
                  type="button"
                  onClick={() => onConfirmPhone(screen.phone)}
                  className="kiosk-btn kiosk-btn-primary flex-[2]"
                >
                  Đúng, check-in
                </button>
              </div>
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
                <p className="rounded-xl border border-border bg-background/80 px-4 py-2">Đưa mã QR vào camera</p>
                <button type="button" onClick={goHome} className="kiosk-btn kiosk-btn-ghost">
                  Quay lại
                </button>
              </div>
            </>
          )}

          {screen.name === "checking" && <p className="text-xl text-muted-foreground">Đang kiểm tra vé...</p>}

          {screen.name === "done" && <ResultPanel view={screen.view} onDone={goHome} />}

          {screen.name === "error" && (
            <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
              <p className="text-2xl font-semibold text-destructive">{screen.message}</p>
              <p className="text-lg text-muted-foreground">Vui lòng gặp nhân viên để được hỗ trợ.</p>
              <DoneButton onClick={goHome} />
            </div>
          )}
        </div>
      </div>

      {scanning && !cameraError && <ScanBeams rootRef={rootRef} mascotRef={mascotRef} color="var(--primary)" />}

      {/* Máy đang dựng đứng (khoá xoay không được, vd. trình duyệt) -> nhắc xoay ngang */}
      <div className="absolute inset-0 z-10 hidden flex-col items-center justify-center gap-4 bg-[var(--kiosk-bg)] p-8 text-center portrait:flex">
        <span aria-hidden className="text-6xl">⟲</span>
        <p className="text-2xl font-semibold">Xoay ngang màn hình để dùng kiosk</p>
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
        <p className="text-sm uppercase tracking-widest text-muted-foreground">{view.tickets} vé · Ghế của bạn</p>
        {view.seats.length > 0 ? (
          <p className="font-heading text-5xl tracking-wide text-primary md:text-6xl">
            {view.seats.join(" · ")}
          </p>
        ) : (
          <p className="text-xl text-muted-foreground">Chưa có ghế</p>
        )}
      </div>

      {view.seatsPending && (
        <p className="text-lg text-amber-300">
          Bạn chưa chọn đủ ghế ({view.seats.length}/{view.tickets}) — vui lòng gặp nhân viên.
        </p>
      )}
      {view.combos.length > 0 && <p className="text-lg text-foreground/80">{view.combos.join(" · ")}</p>}

      <DoneButton onClick={onDone} />
    </div>
  );
}

function DoneButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="kiosk-btn kiosk-btn-ghost mt-2 min-w-36">
      Xong
    </button>
  );
}

function doomMoment(screen: Screen, homeTick: number, cameraError: string | null): DoomMoment {
  switch (screen.name) {
    case "home":
      return { kind: "home", tick: homeTick };
    case "scanning":
      return { kind: cameraError ? "camera-error" : "scanning" };
    case "phone":
      return { kind: "phone" };
    case "phone-confirm":
      return {
        kind: "phone-confirm",
        name: screen.preview.maskedName,
        alreadyCheckedIn: screen.preview.alreadyCheckedIn,
      };
    case "checking":
      return { kind: "checking" };
    case "done":
      return { kind: "done", view: screen.view };
    case "error":
      return { kind: "error", code: screen.code };
  }
}

function QrIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M10.5 18h3" />
    </svg>
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
