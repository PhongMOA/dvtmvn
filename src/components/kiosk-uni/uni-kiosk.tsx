"use client";

import { useRouter } from "next/navigation";
import { App } from "@capacitor/app";
import { registerPlugin } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { BarcodeFormat, BarcodeScanner, LensFacing } from "@capacitor-mlkit/barcode-scanning";
import type { IScannerControls } from "@zxing/browser";
import { useEffect, useState } from "react";
import {
  kioskCheckinQr,
  kioskConfirmPhone,
  kioskLookupPhone,
  verifyKioskExitPin,
} from "@/app/actions/checkin";
import { getKioskState } from "@/app/actions/kiosk-uni";
import { isNativeApp } from "@/lib/is-native-app";
import { UNI_EVENT } from "./event-config";
import { UniStage, type UniApi, type UniHost } from "./uni-stage";

// Plugin native trong app (android/.../ImmersivePlugin.java).
const Immersive = registerPlugin<{ enter(): Promise<void>; exit(): Promise<void> }>("Immersive");

// Hỏi trang điều khiển (/admin/kiosk) có lệnh mới không sau mỗi khoảng này.
const POLL_MS = 1500;
// Lệnh cũ hơn thế này (kiosk vừa mất mạng rồi có lại) thì bỏ, không chạy dồn.
const STALE_MS = 15_000;
// Ô camera bật lên có hiệu ứng phóng to ~0,22 giây -> đo vị trí sau khoảng này.
const HOLE_DELAY_MS = 350;

/**
 * Kiosk tự check-in kiểu linh vật Uni (máy tính bảng nằm ngang ở cửa rạp,
 * đăng nhập tài khoản staff). Màn hình do engine public/kiosk-uni/uni.js vẽ;
 * file này lo phần thiết bị: camera quét QR, khóa xoay, giữ màn sáng, chặn
 * nút Back và nhận lệnh từ trang điều khiển.
 */
export function UniKiosk({ eventId, initialLook }: { eventId: string; initialLook: unknown }) {
  const router = useRouter();
  const [api, setApi] = useState<UniApi | null>(null);

  // Kiosk luôn đặt máy nằm ngang: khoá xoay khi vào, mở khoá khi rời.
  useEffect(() => {
    ScreenOrientation.lock({ orientation: "landscape" }).catch(() => {});
    return () => {
      ScreenOrientation.unlock().catch(() => {});
    };
  }, []);

  // App: ẩn thanh trạng thái/điều hướng; có listener backButton thì nút Back
  // không rời được kiosk, chỉ thoát bằng PIN.
  useEffect(() => {
    if (!isNativeApp()) return;
    Immersive.enter().catch(() => {});
    const back = App.addListener("backButton", () => {});
    return () => {
      Immersive.exit().catch(() => {});
      void back.then((l) => l.remove());
    };
  }, []);

  // Giữ màn hình luôn sáng; hệ thống tự nhả khóa khi app ẩn -> xin lại khi hiện.
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

  // Nhận lệnh từ trang điều khiển: lần đầu chỉ lấy mốc seq, sau đó chạy lệnh mới.
  useEffect(() => {
    if (!api) return;
    let since = -1;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let dead = false;
    const poll = async () => {
      if (document.visibilityState === "visible") {
        try {
          const res = await getKioskState(since);
          if (dead) return;
          if (res.ok) {
            const { seq, cmds, now } = res.value;
            for (const c of cmds) if (c.at >= now - STALE_MS) api.command(c);
            since = seq;
          }
        } catch {
          /* mất mạng: thử lại lượt sau */
        }
      }
      if (!dead) timer = setTimeout(poll, POLL_MS);
    };
    void poll();
    return () => {
      dead = true;
      clearTimeout(timer);
    };
  }, [api]);

  // host chỉ được engine đọc 1 lần lúc gắn.
  const [host] = useState<UniHost>(() => {
    const scanner = createScanner();
    return {
      mode: "kiosk",
      look: initialLook,
      ev: UNI_EVENT,
      checkinQr: (code) => kioskCheckinQr(code, eventId),
      lookupPhone: (phone) => kioskLookupPhone(phone, eventId),
      confirmPhone: (phone) => kioskConfirmPhone(phone, eventId),
      exitPin: async (pin) => {
        const res = await verifyKioskExitPin(pin);
        if (res.ok) router.push("/kiosk");
        return res;
      },
      startScan: scanner.start,
      stopScan: scanner.stop,
      onLayout: scanner.placeHole,
    };
  });

  // Rời trang khi đang quét: tắt camera.
  useEffect(() => () => host.stopScan?.(), [host]);

  return (
    <div
      className="uni-kiosk barcode-scanner-ui fixed inset-0 z-[70] touch-none bg-black select-none"
    >
      <UniStage
        host={host}
        className="size-full"
        onReady={(a) => setApi(a)}
      />
    </div>
  );
}

/**
 * Camera quét QR — engine gọi start khi vào màn quét, stop khi rời.
 * - App Android: ML Kit vẽ preview native PHÍA SAU WebView (body gắn
 *   `barcode-scanner-active`, xem globals.css). Khoét 1 lỗ đúng ô camera trên
 *   lớp kiosk bằng clip-path để lộ preview ra.
 * - Web: getUserMedia + @zxing, video nằm trong ô camera.
 */
function createScanner() {
  let cam: HTMLElement | null = null;
  let stopCurrent = () => {};

  const placeHole = () => {
    const root = document.querySelector<HTMLElement>(".uni-kiosk");
    if (!root) return;
    if (!cam || !document.body.classList.contains("barcode-scanner-active")) {
      root.style.clipPath = "";
      return;
    }
    const W = root.clientWidth;
    const H = root.clientHeight;
    const { left: x, top: y, width: w, height: h } = cam.getBoundingClientRect();
    const rad = (22 * w) / 236;
    root.style.clipPath =
      `path(evenodd, "M0 0H${W}V${H}H0Z ` +
      `M${x + rad} ${y}H${x + w - rad}A${rad} ${rad} 0 0 1 ${x + w} ${y + rad}` +
      `V${y + h - rad}A${rad} ${rad} 0 0 1 ${x + w - rad} ${y + h}` +
      `H${x + rad}A${rad} ${rad} 0 0 1 ${x} ${y + h - rad}` +
      `V${y + rad}A${rad} ${rad} 0 0 1 ${x + rad} ${y}Z")`;
  };

  const start: NonNullable<UniHost["startScan"]> = (el, onCode, onState, facing) => {
    stopCurrent();
    let stopped = false;
    cam = el;

    if (isNativeApp()) {
      const stop = async () => {
        document.body.classList.remove("barcode-scanner-active");
        placeHole();
        await BarcodeScanner.stopScan().catch(() => {});
        await BarcodeScanner.removeAllListeners().catch(() => {});
      };
      stopCurrent = () => {
        stopped = true;
        cam = null;
        void stop();
      };
      (async () => {
        const perm = await BarcodeScanner.checkPermissions();
        if (perm.camera !== "granted" && perm.camera !== "limited") {
          const req = await BarcodeScanner.requestPermissions();
          if (req.camera !== "granted" && req.camera !== "limited") {
            onState("error", "Chưa cấp quyền camera cho app.");
            return;
          }
        }
        if (stopped) return;
        await BarcodeScanner.addListener("barcodesScanned", (event) => {
          const code = event.barcodes[0]?.rawValue;
          if (code) onCode(code);
        });
        await BarcodeScanner.startScan({
          formats: [BarcodeFormat.QrCode],
          lensFacing: facing === "user" ? LensFacing.Front : LensFacing.Back,
        });
        if (stopped) return void stop();
        document.body.classList.add("barcode-scanner-active");
        onState("ready");
        setTimeout(placeHole, HOLE_DELAY_MS);
      })().catch(() => {
        if (!stopped) onState("error");
      });
      return;
    }

    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    el.prepend(video);
    let controls: IScannerControls | null = null;
    stopCurrent = () => {
      stopped = true;
      cam = null;
      controls?.stop();
      video.remove();
    };
    import("@zxing/browser")
      .then(({ BrowserQRCodeReader }) => {
        if (stopped) return;
        const reader = new BrowserQRCodeReader(undefined, {
          delayBetweenScanAttempts: 120,
          delayBetweenScanSuccess: 800,
        });
        return reader.decodeFromConstraints({ video: { facingMode: facing } }, video, (res) => {
          const code = res?.getText();
          if (code) onCode(code);
        });
      })
      .then((c) => {
        if (!c) return;
        if (stopped) c.stop();
        else {
          controls = c;
          onState("ready");
        }
      })
      .catch(() => {
        if (!stopped) onState("error");
      });
  };

  return { start, stop: () => stopCurrent(), placeHole };
}
