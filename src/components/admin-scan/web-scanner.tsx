"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScanResultCard, useCheckinScan } from "./checkin-scan";

/**
 * Nhánh quét QR check-in cho web (admin dùng laptop/điện thoại qua trình
 * duyệt) — đọc camera bằng getUserMedia + decode QR bằng @zxing/browser (chạy
 * mọi trình duyệt kể cả iOS Safari, khác `BarcodeDetector` chỉ có ở Chromium).
 * Cần HTTPS (hoặc localhost) để trình duyệt cho phép camera.
 *
 * Nghiệp vụ tra cứu -> xác nhận -> check-in nằm trong hook useCheckinScan
 * (dùng chung với nhánh app Android — xem native-scanner.tsx).
 */
export function WebScanCheckin() {
  const { result, confirmed, isConfirming, shouldIgnore, resolveToken, confirm, reset } =
    useCheckinScan();
  const [scanning, setScanning] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
  }, []);

  // Khởi động camera trong effect (KHÔNG trong handler click) — phải đợi
  // React render xong thẻ <video> thì `videoRef.current` mới có; gọi
  // decodeFromConstraints ngay trong handler thì ref còn null -> @zxing tự tạo
  // video ẩn, màn hình chỉ thấy nền đen.
  useEffect(() => {
    if (!scanning) return;

    let cancelled = false;
    const reader = new BrowserQRCodeReader(undefined, {
      delayBetweenScanAttempts: 120,
      delayBetweenScanSuccess: 800,
    });

    reader
      .decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current ?? undefined,
        (decoded) => {
          if (!decoded) return; // frame chưa bắt được mã
          const qrToken = decoded.getText();
          if (!qrToken || shouldIgnore(qrToken)) return;
          setLocked(true);
          void resolveToken(qrToken);
        },
      )
      .then((controls) => {
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : "";
        setScanning(false);
        setError(
          name === "NotAllowedError" || name === "SecurityError"
            ? "Bạn đã từ chối quyền camera. Vào cài đặt trình duyệt cấp lại quyền cho trang này rồi thử lại."
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "Không tìm thấy camera trên thiết bị này."
              : "Không mở được camera, vui lòng thử lại.",
        );
      });

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [scanning, shouldIgnore, resolveToken, stopCamera]);

  function startScan() {
    setError(null);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError(
        "Trình duyệt không hỗ trợ camera, hoặc trang không chạy qua HTTPS. Thử mở bằng Chrome/Safari bản mới trên kết nối https.",
      );
      return;
    }

    reset();
    setLocked(false);
    setScanning(true);
  }

  function stopScan() {
    setScanning(false);
    setLocked(false);
  }

  function scanNext() {
    reset();
    setLocked(false);
  }

  return (
    <div>
      {!scanning && (
        <>
          <h1 className="font-heading text-2xl tracking-wide text-primary">
            QUÉT QR CHECK-IN
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Bấm bắt đầu rồi hướng camera vào mã QR trên vé của khách. Cần cho
            phép trình duyệt dùng camera.
          </p>
          {error && (
            <p className="mt-3 max-w-sm text-sm text-destructive">{error}</p>
          )}
          <Button className="mt-6" size="lg" onClick={startScan}>
            Bắt đầu quét
          </Button>
        </>
      )}

      {scanning && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            playsInline
            muted
          />

          {!result && (
            <>
              <div className="relative flex items-start p-4 pt-6">
                <p className="max-w-[75%] text-sm font-medium text-white drop-shadow">
                  Hướng camera vào mã QR trên vé, canh mã vào trong khung.
                </p>
              </div>
              <div className="relative flex flex-1 flex-col items-center justify-center gap-10">
                <div className={cn("qr-viewfinder", locked && "qr-viewfinder-locked")}>
                  <span className="qr-viewfinder-corner qr-viewfinder-corner--tl" />
                  <span className="qr-viewfinder-corner qr-viewfinder-corner--tr" />
                  <span className="qr-viewfinder-corner qr-viewfinder-corner--bl" />
                  <span className="qr-viewfinder-corner qr-viewfinder-corner--br" />
                </div>
                <button type="button" onClick={stopScan} className="scan-stop-button">
                  Dừng quét
                </button>
              </div>
            </>
          )}

          {result && <div className="relative flex-1 bg-black/60" />}

          <div
            className={cn(
              "relative flex flex-col items-center gap-3 p-6",
              result && "bg-black/60",
            )}
          >
            {result && (
              <ScanResultCard
                result={result}
                confirmed={confirmed}
                isConfirming={isConfirming}
                onConfirm={confirm}
                onNext={scanNext}
              />
            )}
            {result && (
              <button type="button" onClick={stopScan} className="scan-stop-button">
                Dừng quét
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
