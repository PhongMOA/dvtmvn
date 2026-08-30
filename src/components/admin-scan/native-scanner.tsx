"use client";

import { useEffect, useRef, useState } from "react";
import {
  BarcodeScanner,
  BarcodeFormat,
} from "@capacitor-mlkit/barcode-scanning";
import { Flashlight, FlashlightOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScanResultCard, useCheckinScan } from "./checkin-scan";

/**
 * Nhánh quét QR check-in cho app Android — camera preview native (ML Kit) nằm
 * sau WebView trong suốt (xem `body.barcode-scanner-active` trong globals.css),
 * phía trên chỉ "lộ" đúng 1 ô vuông ngắm (`.qr-viewfinder`). Xem
 * plans/260826-1757-android-push-app/phase-02-camera-checkin.md.
 *
 * Nghiệp vụ tra cứu -> xác nhận -> check-in nằm trong hook useCheckinScan
 * (dùng chung với nhánh web). Component này chỉ lo phần camera native + UI.
 */
export function NativeScanCheckin() {
  const { result, confirmed, isConfirming, shouldIgnore, resolveToken, confirm, reset } =
    useCheckinScan();
  const [scanning, setScanning] = useState(false);
  // Chớp viền ô vuông sang accent ngay khi vừa nhận diện được QR, trước cả khi
  // tra cứu xong — phản hồi tức thời, không liên quan tới `result`.
  const [locked, setLocked] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const scanningRef = useRef(false);

  useEffect(() => {
    // Rời trang giữa lúc đang quét -> tắt camera + gỡ listener, tránh camera
    // treo chạy ngầm khi admin bấm Back.
    return () => {
      if (scanningRef.current) {
        document.body.classList.remove("barcode-scanner-active");
        BarcodeScanner.stopScan().catch(() => {});
        BarcodeScanner.removeAllListeners().catch(() => {});
      }
    };
  }, []);

  async function startScan() {
    const { camera } = await BarcodeScanner.checkPermissions();
    if (camera !== "granted" && camera !== "limited") {
      const req = await BarcodeScanner.requestPermissions();
      if (req.camera !== "granted" && req.camera !== "limited") {
        toast.error("Cần cấp quyền Camera để quét QR.");
        return;
      }
    }

    reset();
    setLocked(false);
    scanningRef.current = true;
    setScanning(true);
    document.body.classList.add("barcode-scanner-active");

    BarcodeScanner.isTorchAvailable()
      .then(({ available }) => setTorchAvailable(available))
      .catch(() => setTorchAvailable(false));

    await BarcodeScanner.addListener("barcodesScanned", async (event) => {
      const qrToken = event.barcodes[0]?.rawValue;
      if (!qrToken) return;
      if (shouldIgnore(qrToken)) return;
      setLocked(true);
      await resolveToken(qrToken);
    });
    await BarcodeScanner.startScan({ formats: [BarcodeFormat.QrCode] });
  }

  async function stopScan() {
    scanningRef.current = false;
    setScanning(false);
    document.body.classList.remove("barcode-scanner-active");
    await BarcodeScanner.stopScan();
    await BarcodeScanner.removeAllListeners();
  }

  async function toggleTorch() {
    await BarcodeScanner.toggleTorch();
    const { enabled } = await BarcodeScanner.isTorchEnabled();
    setTorchOn(enabled);
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
            Bấm bắt đầu rồi hướng camera vào mã QR trên vé của khách.
          </p>
          <Button className="mt-6" size="lg" onClick={startScan}>
            Bắt đầu quét
          </Button>
        </>
      )}

      {scanning && (
        <div className="barcode-scanner-ui fixed inset-0 flex flex-col">
          {!result && (
            <div className="flex items-start justify-between gap-3 p-4 pt-6">
              <p className="max-w-[75%] text-sm font-medium text-white">
                Hướng camera vào mã QR trên vé, canh mã vào trong khung.
              </p>
              {torchAvailable && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  aria-label={torchOn ? "Tắt đèn flash" : "Bật đèn flash"}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  {torchOn ? <FlashlightOff size={20} /> : <Flashlight size={20} />}
                </button>
              )}
            </div>
          )}

          {!result && (
            <div className="flex flex-1 flex-col items-center justify-center gap-10">
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
          )}

          {result && <div className="flex-1 bg-black/60" />}

          <div className={cn("flex flex-col items-center gap-3 p-6", result && "bg-black/60")}>
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
