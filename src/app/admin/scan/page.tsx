"use client";

import { useEffect, useRef, useState } from "react";
import {
  BarcodeScanner,
  BarcodeFormat,
} from "@capacitor-mlkit/barcode-scanning";
import { Flashlight, FlashlightOff } from "lucide-react";
import { toast } from "sonner";
import { getOrderByQrToken, checkInByQrToken } from "@/app/actions/admin-orders";
import { useIsNativeApp } from "@/lib/is-native-app";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ERROR_MESSAGE: Record<string, string> = {
  NOT_FOUND: "Không tìm thấy đơn hàng cho QR này.",
  NOT_PAID: "Đơn hàng chưa thanh toán — không thể check-in.",
  ALREADY_CHECKED_IN: "Đơn hàng này đã check-in trước đó.",
};

type OrderInfo = {
  qrToken: string;
  orderCode: string;
  comboName: string;
  userName: string;
  phone: string | null;
  quantity: number;
};

type ScanResult =
  | { kind: "info"; order: OrderInfo }
  | { kind: "error"; message: string };

/**
 * Trang quét QR check-in cho admin — chỉ có ý nghĩa trong app Android
 * (camera native), không hoạt động trên browser thường. Xem
 * plans/260826-1757-android-push-app/phase-02-camera-checkin.md.
 *
 * UI: camera preview native chiếm toàn màn hình phía sau (WebView trong
 * suốt, xem `body.barcode-scanner-active` trong globals.css), phía trên chỉ
 * "lộ" đúng 1 ô vuông ngắm (`.qr-viewfinder`) — phần còn lại bị phủ tối bằng
 * CSS để tách biệt khỏi chữ hướng dẫn/nút bấm đè lên trên. Ô vuông thuần là
 * UI dẫn hướng (ML Kit vẫn quét toàn khung hình phía sau như cũ, không có
 * chế độ khoanh vùng camera thật) — chớp viền sang màu accent ngay khi bắt
 * được QR hợp lệ để tạo cảm giác "khung bắt được mã" tức thì.
 *
 * Quy trình: bấm "Bắt đầu quét" -> quét được QR nào thì TRA CỨU thông tin
 * (chưa check-in) -> hiện thẻ "Thông tin người mua" + số vé + nút "Xác nhận"
 * -> admin bấm Xác nhận mới thật sự check-in -> nút đổi thành "Quét tiếp" để
 * quét mã kế tiếp. Cố ý không tự check-in ngay lúc quét để tránh check-in
 * nhầm chỉ vì camera lướt qua đúng QR trước khi admin kịp nhìn thông tin.
 */
export default function AdminScanPage() {
  const isNative = useIsNativeApp();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  // Chớp viền ô vuông sang accent ngay khi vừa nhận diện được QR hợp lệ,
  // trước cả khi tra cứu xong (xem JSDoc trên) — không liên quan tới
  // `result`, chỉ là hiệu ứng tức thời lúc phát hiện.
  const [locked, setLocked] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const scanningRef = useRef(false);
  // ML Kit bắn "barcodesScanned" liên tục cho mỗi frame khi QR còn trong khung
  // hình. `resultRef` (đọc trong closure của listener, khác `result` state chỉ
  // dùng để render) dùng để tạm khoá xử lý mã mới trong lúc đang hiện thẻ kết
  // quả chờ admin xác nhận — chỉ mở khoá lại khi admin bấm "Quét tiếp".
  const resultRef = useRef<ScanResult | null>(null);
  // Chặn xử lý trùng cùng 1 mã trong khoảnh khắc camera vẫn đang chĩa vào nó
  // (giữa lúc quét xong và lúc resultRef kịp khoá lại).
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
    const res = await getOrderByQrToken(qrToken);
    const next: ScanResult = res.ok
      ? {
          kind: "info",
          order: {
            qrToken,
            orderCode: res.orderCode,
            comboName: res.comboName,
            userName: res.userName,
            phone: res.phone,
            quantity: res.quantity,
          },
        }
      : {
          kind: "error",
          message: ERROR_MESSAGE[res.error] ?? "Có lỗi xảy ra, vui lòng thử lại.",
        };
    resultRef.current = next;
    setResult(next);
    setConfirmed(false);
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

    resultRef.current = null;
    setResult(null);
    setConfirmed(false);
    setLocked(false);
    scanningRef.current = true;
    setScanning(true);
    document.body.classList.add("barcode-scanner-active");

    BarcodeScanner.isTorchAvailable()
      .then(({ available }) => setTorchAvailable(available))
      .catch(() => setTorchAvailable(false));

    await BarcodeScanner.addListener("barcodesScanned", async (event) => {
      // Đang hiện thẻ kết quả chờ admin xử lý (xác nhận hoặc quét tiếp) ->
      // bỏ qua, không tra cứu mã mới đè lên.
      if (resultRef.current) return;

      const qrToken = event.barcodes[0]?.rawValue;
      if (!qrToken) return;

      const now = Date.now();
      const last = lastScannedRef.current;
      if (last && last.token === qrToken && now - last.at < RESCAN_COOLDOWN_MS) {
        return; // cùng 1 mã vừa xử lý trong khoảng cooldown -> bỏ qua
      }
      lastScannedRef.current = { token: qrToken, at: now };

      setLocked(true);
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

  async function toggleTorch() {
    await BarcodeScanner.toggleTorch();
    const { enabled } = await BarcodeScanner.isTorchEnabled();
    setTorchOn(enabled);
  }

  // Mở khoá cho camera xử lý mã tiếp theo — không dừng/khởi động lại camera,
  // chỉ xoá thẻ kết quả đang hiện.
  function scanNext() {
    resultRef.current = null;
    setResult(null);
    setConfirmed(false);
    setLocked(false);
  }

  async function handleConfirm() {
    if (result?.kind !== "info") return;
    const { order } = result;
    setIsConfirming(true);
    const res = await checkInByQrToken(order.qrToken);
    setIsConfirming(false);
    if (res.ok) {
      setConfirmed(true);
      toast.success(
        `Check-in thành công: ${order.comboName} × ${order.quantity} — ${order.userName}`,
      );
    } else {
      // Trạng thái đổi giữa lúc tra cứu và lúc xác nhận (vd đơn vừa được admin
      // khác check-in) -> báo lỗi, admin vẫn phải bấm "Quét tiếp" mới quét
      // được mã mới (không tự động quay lại quét).
      const message = ERROR_MESSAGE[res.error] ?? "Có lỗi xảy ra, vui lòng thử lại.";
      const next: ScanResult = { kind: "error", message };
      resultRef.current = next;
      setResult(next);
      toast.error(message);
    }
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
          <Button className="mt-6" size="lg" onClick={startScan}>
            Bắt đầu quét
          </Button>
        </>
      )}

      {scanning && (
        <div className="barcode-scanner-ui fixed inset-0 flex flex-col">
          {/* Thanh trên: chữ hướng dẫn + nút đèn flash (chỉ hiện khi máy hỗ
              trợ) — ẩn hẳn khi đã có kết quả để nhường chỗ cho thẻ thông tin. */}
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

          {/* Ô ngắm QR — chỉ hiện lúc chưa có kết quả, nhường chỗ cho thẻ
              thông tin/lỗi bên dưới ngay khi bắt được mã. Nút "Dừng quét" đặt
              ngay dưới khung ngắm (to, rõ, dạng viên thuốc) theo đúng mẫu
              tham khảo — thay vì chỉ có 1 nút nhỏ dồn chung với thẻ kết quả
              ở cuối màn hình như bản trước, dễ bấm nhầm/khó thấy. */}
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

          {/* Đã có kết quả -> phủ tối đều toàn màn hình (không còn ô ngắm)
              để làm nền cho thẻ thông tin/lỗi phía dưới. */}
          {result && <div className="flex-1 bg-black/60" />}

          <div className="flex flex-col items-center gap-3 p-6">
            {result?.kind === "info" && (
              <div className="w-full max-w-sm rounded-lg bg-black/80 p-4 text-white">
                <p className="text-xs uppercase tracking-wide text-white/60">
                  Thông tin người mua
                </p>
                <p className="mt-1 text-lg font-semibold">{result.order.userName}</p>
                {result.order.phone && (
                  <p className="text-sm text-white/80">{result.order.phone}</p>
                )}

                <div className="mt-3 border-t border-white/20 pt-3">
                  <p className="text-xs uppercase tracking-wide text-white/60">
                    Số vé
                  </p>
                  <p className="text-base">
                    {result.order.comboName} × {result.order.quantity}
                  </p>
                </div>
                <p className="mt-2 text-xs text-white/50">
                  Mã đơn: {result.order.orderCode}
                </p>

                {confirmed && (
                  <p className="mt-3 text-sm font-medium text-emerald-400">
                    Đã check-in thành công.
                  </p>
                )}

                {confirmed ? (
                  <Button className="mt-4 w-full" onClick={scanNext}>
                    Quét tiếp
                  </Button>
                ) : (
                  <Button
                    className="mt-4 w-full"
                    onClick={handleConfirm}
                    disabled={isConfirming}
                  >
                    {isConfirming ? "Đang xác nhận..." : "Xác nhận"}
                  </Button>
                )}
              </div>
            )}

            {result?.kind === "error" && (
              <div className="w-full max-w-sm rounded-lg bg-black/80 p-4 text-white">
                <p className="text-sm">{result.message}</p>
                <Button className="mt-3 w-full" onClick={scanNext}>
                  Quét tiếp
                </Button>
              </div>
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
