"use client";

import { useEffect, useRef, useState } from "react";
import {
  BarcodeScanner,
  BarcodeFormat,
} from "@capacitor-mlkit/barcode-scanning";
import { toast } from "sonner";
import { checkInByQrToken } from "@/app/actions/admin-orders";
import { useIsNativeApp } from "@/lib/is-native-app";
import { Button } from "@/components/ui/button";

const ERROR_MESSAGE: Record<string, string> = {
  NOT_FOUND: "Không tìm thấy đơn hàng cho QR này.",
  NOT_PAID: "Đơn hàng chưa thanh toán — không thể check-in.",
  ALREADY_CHECKED_IN: "Đơn hàng này đã check-in trước đó.",
};

/**
 * Trang quét QR check-in cho admin — chỉ có ý nghĩa trong app Android
 * (camera native), không hoạt động trên browser thường. Xem
 * plans/260826-1757-android-push-app/phase-02-camera-checkin.md.
 *
 * Quy trình: bấm "Bắt đầu quét" -> WebView chuyển trong suốt (CSS
 * `body.barcode-scanner-active`, xem globals.css) để lộ camera preview native
 * -> quét được QR nào thì tự verify + check-in luôn, rồi tự quét tiếp (không
 * cần bấm lại) cho tới khi admin bấm "Dừng quét".
 */
export default function AdminScanPage() {
  const isNative = useIsNativeApp();
  const [scanning, setScanning] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const scanningRef = useRef(false);
  // ML Kit bắn "barcodesScanned" liên tục cho mỗi frame khi QR còn trong
  // khung hình (không tự dừng sau match đầu, cố ý để quét liên tiếp nhiều vé
  // không cần bấm lại nút) — chặn xử lý trùng cùng 1 mã trong lúc camera vẫn
  // đang chĩa vào nó, tránh gọi checkInByQrToken nhiều lần + nhiều toast trùng.
  const lastScannedRef = useRef<{ token: string; at: number } | null>(null);
  const RESCAN_COOLDOWN_MS = 2000;

  useEffect(() => {
    // Rời trang giữa lúc đang quét -> đảm bảo tắt camera + gỡ listener,
    // tránh camera treo chạy ngầm khi admin bấm Back.
    return () => {
      if (scanningRef.current) {
        document.body.classList.remove("barcode-scanner-active");
        BarcodeScanner.stopScan().catch(() => {});
        BarcodeScanner.removeAllListeners().catch(() => {});
      }
    };
  }, []);

  async function handleScanResult(qrToken: string) {
    const res = await checkInByQrToken(qrToken);
    if (res.ok) {
      const msg = `Check-in thành công: ${res.comboName} x${res.quantity} — ${res.userName}`;
      toast.success(msg);
      setLastMessage(msg);
    } else {
      const msg = ERROR_MESSAGE[res.error] ?? "Có lỗi xảy ra, vui lòng thử lại.";
      toast.error(msg);
      setLastMessage(msg);
    }
  }

  async function startScan() {
    const { camera } = await BarcodeScanner.checkPermissions();
    if (camera !== "granted" && camera !== "limited") {
      const req = await BarcodeScanner.requestPermissions();
      if (req.camera !== "granted" && req.camera !== "limited") {
        toast.error("Cần cấp quyền Camera để quét QR.");
        return;
      }
    }

    setLastMessage(null);
    scanningRef.current = true;
    setScanning(true);
    document.body.classList.add("barcode-scanner-active");

    await BarcodeScanner.addListener("barcodesScanned", async (event) => {
      const qrToken = event.barcodes[0]?.rawValue;
      if (!qrToken) return;

      const now = Date.now();
      const last = lastScannedRef.current;
      if (last && last.token === qrToken && now - last.at < RESCAN_COOLDOWN_MS) {
        return; // cùng 1 mã vừa xử lý trong khoảng cooldown -> bỏ qua
      }
      lastScannedRef.current = { token: qrToken, at: now };

      // Xử lý xong 1 mã thì báo kết quả rồi tiếp tục quét ngay (không dừng
      // camera) để admin quét liên tiếp nhiều vé mà không cần bấm lại nút.
      await handleScanResult(qrToken);
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

  if (!isNative) {
    return (
      <div>
        <h1 className="font-heading text-2xl tracking-wide text-primary">
          QUÉT QR CHECK-IN
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Tính năng này chỉ dùng được trong app Android MarvelVN (cần camera
          native). Vào app trên điện thoại để dùng.
        </p>
      </div>
    );
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
          {lastMessage && (
            <p className="mt-4 rounded-lg border border-border bg-card p-4 text-sm">
              {lastMessage}
            </p>
          )}
          <Button className="mt-6" size="lg" onClick={startScan}>
            Bắt đầu quét
          </Button>
        </>
      )}

      {scanning && (
        <div className="barcode-scanner-ui fixed inset-x-0 bottom-0 flex flex-col items-center gap-3 p-6">
          {lastMessage && (
            <p className="w-full max-w-sm rounded-lg bg-black/70 p-3 text-center text-sm text-white">
              {lastMessage}
            </p>
          )}
          <Button size="lg" variant="secondary" onClick={stopScan}>
            Dừng quét
          </Button>
        </div>
      )}
    </div>
  );
}
