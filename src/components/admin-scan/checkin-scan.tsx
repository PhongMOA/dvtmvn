"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { getOrderByQrToken, checkInByQrToken } from "@/app/actions/admin-orders";
import { Button } from "@/components/ui/button";

// Phần dùng chung giữa 2 nhánh quét QR check-in: app Android (camera native, ML
// Kit — xem native-scanner.tsx) và web (getUserMedia + @zxing/browser — xem
// web-scanner.tsx). Chỉ khác nhau ở lớp đọc camera/decode QR; toàn bộ nghiệp vụ
// tra cứu đơn -> hiện thẻ thông tin -> admin bấm Xác nhận -> check-in là như nhau.

export const ERROR_MESSAGE: Record<string, string> = {
  NOT_FOUND: "Không tìm thấy đơn hàng cho QR này.",
  NOT_PAID: "Đơn hàng chưa thanh toán — không thể check-in.",
  ALREADY_CHECKED_IN: "Đơn hàng này đã check-in trước đó.",
};

export type OrderInfo = {
  qrToken: string;
  orderCode: string;
  comboName: string;
  userName: string;
  phone: string | null;
  quantity: number;
};

export type ScanResult =
  | { kind: "info"; order: OrderInfo }
  | { kind: "error"; message: string };

// Cùng 1 mã QR còn nằm trong khung hình -> callback decode bắn liên tục mỗi
// frame; chặn xử lý lại trong khoảng này.
const RESCAN_COOLDOWN_MS = 2000;

export function useCheckinScan() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Đọc trong closure của callback decode (khác `result` state chỉ để render):
  // true khi đang hiện thẻ kết quả chờ admin xử lý -> bỏ qua mọi mã mới cho tới
  // khi admin bấm "Quét tiếp".
  const busyRef = useRef(false);
  const lastScannedRef = useRef<{ token: string; at: number } | null>(null);

  const applyResult = useCallback((next: ScanResult | null) => {
    busyRef.current = next !== null;
    setResult(next);
  }, []);

  /** Gọi ở đầu callback decode — true nghĩa là bỏ qua mã lần này. */
  const shouldIgnore = useCallback((token: string): boolean => {
    if (busyRef.current) return true;
    const now = Date.now();
    const last = lastScannedRef.current;
    if (last && last.token === token && now - last.at < RESCAN_COOLDOWN_MS) {
      return true;
    }
    lastScannedRef.current = { token, at: now };
    return false;
  }, []);

  const resolveToken = useCallback(
    async (qrToken: string) => {
      busyRef.current = true; // khoá ngay, trước round-trip server
      const res = await getOrderByQrToken(qrToken);
      applyResult(
        res.ok
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
              message:
                ERROR_MESSAGE[res.error] ?? "Có lỗi xảy ra, vui lòng thử lại.",
            },
      );
      setConfirmed(false);
    },
    [applyResult],
  );

  const confirm = useCallback(async () => {
    const current = result;
    if (current?.kind !== "info") return;
    const { order } = current;
    setIsConfirming(true);
    const res = await checkInByQrToken(order.qrToken);
    setIsConfirming(false);
    if (res.ok) {
      setConfirmed(true);
      toast.success(
        `Check-in thành công: ${order.comboName} × ${order.quantity} — ${order.userName}`,
      );
    } else {
      // Trạng thái đổi giữa lúc tra cứu và lúc xác nhận (vd admin khác vừa
      // check-in) -> báo lỗi, admin vẫn phải bấm "Quét tiếp" mới quét mã mới.
      const message =
        ERROR_MESSAGE[res.error] ?? "Có lỗi xảy ra, vui lòng thử lại.";
      applyResult({ kind: "error", message });
      toast.error(message);
    }
  }, [result, applyResult]);

  /** "Quét tiếp" — xoá thẻ kết quả, mở khoá cho mã tiếp theo. */
  const reset = useCallback(() => {
    applyResult(null);
    setConfirmed(false);
  }, [applyResult]);

  return {
    result,
    confirmed,
    isConfirming,
    shouldIgnore,
    resolveToken,
    confirm,
    reset,
  };
}

/** Thẻ "Thông tin người mua" / lỗi hiện sau khi quét được 1 mã — chung cho cả 2 nhánh. */
export function ScanResultCard({
  result,
  confirmed,
  isConfirming,
  onConfirm,
  onNext,
}: {
  result: ScanResult;
  confirmed: boolean;
  isConfirming: boolean;
  onConfirm: () => void;
  onNext: () => void;
}) {
  if (result.kind === "error") {
    return (
      <div className="w-full max-w-sm rounded-lg bg-black/80 p-4 text-white">
        <p className="text-sm">{result.message}</p>
        <Button className="mt-3 w-full" onClick={onNext}>
          Quét tiếp
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-lg bg-black/80 p-4 text-white">
      <p className="text-xs uppercase tracking-wide text-white/60">
        Thông tin người mua
      </p>
      <p className="mt-1 text-lg font-semibold">{result.order.userName}</p>
      {result.order.phone && (
        <p className="text-sm text-white/80">{result.order.phone}</p>
      )}

      <div className="mt-3 border-t border-white/20 pt-3">
        <p className="text-xs uppercase tracking-wide text-white/60">Số vé</p>
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
        <Button className="mt-4 w-full" onClick={onNext}>
          Quét tiếp
        </Button>
      ) : (
        <Button
          className="mt-4 w-full"
          onClick={onConfirm}
          disabled={isConfirming}
        >
          {isConfirming ? "Đang xác nhận..." : "Xác nhận"}
        </Button>
      )}
    </div>
  );
}
