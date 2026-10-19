"use client";

import { useEffect, useRef } from "react";
import { BarcodeFormat, BarcodeScanner, LensFacing } from "@capacitor-mlkit/barcode-scanning";
import { BrowserQRCodeReader } from "@zxing/browser";
import { useIsNativeApp } from "@/lib/is-native-app";

/**
 * Camera TRƯỚC cho kiosk (khách đứng trước máy giơ QR). Mount = bật camera,
 * unmount = tắt. Mỗi mã đọc được gọi `onCode` (bên gọi tự chống lặp).
 *
 * - App Android: ML Kit vẽ preview native PHÍA SAU WebView — body được gắn
 *   `barcode-scanner-active` (nền trong suốt, xem globals.css), màn kiosk phải
 *   có class `barcode-scanner-ui` và chừa 1 ô trong suốt để lộ camera. Component
 *   này chỉ render ô đó (`.kiosk-camera-hole`).
 * - Web (dev trên laptop): getUserMedia + @zxing, video nằm trong ô.
 */
export function KioskCamera({
  onCode,
  onError,
}: {
  onCode: (code: string) => void;
  onError: (message: string) => void;
}) {
  const isNative = useIsNativeApp();
  // Ref để effect không phải khởi động lại camera mỗi khi cha đổi callback.
  const onCodeRef = useRef(onCode);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onCodeRef.current = onCode;
    onErrorRef.current = onError;
  });

  return isNative ? (
    <NativeCamera onCodeRef={onCodeRef} onErrorRef={onErrorRef} />
  ) : (
    <WebCamera onCodeRef={onCodeRef} onErrorRef={onErrorRef} />
  );
}

type Refs = {
  onCodeRef: React.RefObject<(code: string) => void>;
  onErrorRef: React.RefObject<(message: string) => void>;
};

function NativeCamera({ onCodeRef, onErrorRef }: Refs) {
  useEffect(() => {
    let stopped = false;

    async function start() {
      const perm = await BarcodeScanner.checkPermissions();
      if (perm.camera !== "granted" && perm.camera !== "limited") {
        const req = await BarcodeScanner.requestPermissions();
        if (req.camera !== "granted" && req.camera !== "limited") {
          onErrorRef.current("Chưa cấp quyền camera cho app.");
          return;
        }
      }
      if (stopped) return;
      document.body.classList.add("barcode-scanner-active");
      await BarcodeScanner.addListener("barcodesScanned", (event) => {
        const code = event.barcodes[0]?.rawValue;
        if (code) onCodeRef.current(code);
      });
      await BarcodeScanner.startScan({
        formats: [BarcodeFormat.QrCode],
        lensFacing: LensFacing.Front,
      });
      // Unmount trong lúc đang khởi động -> tắt ngay.
      if (stopped) await stop();
    }

    async function stop() {
      document.body.classList.remove("barcode-scanner-active");
      await BarcodeScanner.stopScan().catch(() => {});
      await BarcodeScanner.removeAllListeners().catch(() => {});
    }

    start().catch(() => onErrorRef.current("Không mở được camera."));
    return () => {
      stopped = true;
      void stop();
    };
  }, [onCodeRef, onErrorRef]);

  return <div className="kiosk-camera-hole" />;
}

function WebCamera({ onCodeRef, onErrorRef }: Refs) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    const reader = new BrowserQRCodeReader(undefined, {
      delayBetweenScanAttempts: 120,
      delayBetweenScanSuccess: 800,
    });
    reader
      .decodeFromConstraints({ video: { facingMode: "user" } }, videoRef.current ?? undefined, (res) => {
        const code = res?.getText();
        if (code) onCodeRef.current(code);
      })
      .then((controls) => {
        if (cancelled) controls.stop();
        else stop = () => controls.stop();
      })
      .catch(() => {
        if (!cancelled) onErrorRef.current("Không mở được camera.");
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [onCodeRef, onErrorRef]);

  return (
    <div className="kiosk-camera-hole overflow-hidden">
      {/* Lật ngang như gương — khách dễ canh QR hơn */}
      <video ref={videoRef} className="size-full -scale-x-100 object-cover" autoPlay playsInline muted />
    </div>
  );
}
