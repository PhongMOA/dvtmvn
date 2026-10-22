"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { staffConfirm, staffLookup, type StaffQuery } from "@/app/actions/checkin";
import type { CheckinSummary } from "@/lib/checkin";
import { VN_TIME_ZONE } from "@/lib/datetime";
import { Button } from "@/components/ui/button";

// Phần dùng chung của trang quét check-in cho nhân viên (/scan): camera native
// (native-scanner.tsx), camera web (web-scanner.tsx) và ô tìm khách
// (customer-search.tsx). Check-in theo NGƯỜI + suất chiếu (xem
// src/lib/checkin.ts): tra cứu -> hiện thẻ -> nhân viên bấm Xác nhận.

export const ERROR_MESSAGE: Record<string, string> = {
  FORBIDDEN: "Tài khoản không có quyền check-in.",
  NOT_FOUND: "Không tìm thấy khách có vé cho suất chiếu này.",
  NOT_PAID: "Đơn hàng chưa thanh toán — không thể check-in.",
  WRONG_EVENT: "QR thuộc suất chiếu khác — kiểm tra lại suất đang chọn.",
  AMBIGUOUS: "SĐT khớp nhiều tài khoản — tìm theo tên.",
  NO_TICKET: "Khách chỉ mua quà, không có vé cho suất chiếu này.",
};

const errorMessage = (code: string) => ERROR_MESSAGE[code] ?? "Có lỗi xảy ra, vui lòng thử lại.";

export type ScanResult =
  | { kind: "info"; query: StaffQuery; summary: CheckinSummary }
  | { kind: "error"; message: string };

// Cùng 1 mã QR còn nằm trong khung hình -> callback decode bắn liên tục mỗi
// frame; chặn xử lý lại trong khoảng này.
const RESCAN_COOLDOWN_MS = 2000;

export function useCheckinScan(eventId: string) {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Đọc trong closure của callback decode (khác `result` state chỉ để render):
  // true khi đang hiện thẻ kết quả chờ nhân viên xử lý -> bỏ qua mọi mã mới
  // cho tới khi bấm "Quét tiếp".
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

  const lookup = useCallback(
    async (query: StaffQuery) => {
      busyRef.current = true; // khoá ngay, trước round-trip server
      const res = await staffLookup(query, eventId);
      applyResult(
        res.ok
          ? { kind: "info", query, summary: res.value }
          : { kind: "error", message: errorMessage(res.error) },
      );
      setConfirmed(false);
    },
    [applyResult, eventId],
  );

  const resolveToken = useCallback(
    (qrToken: string) => lookup({ qrToken }),
    [lookup],
  );

  const confirm = useCallback(async () => {
    const current = result;
    if (current?.kind !== "info") return;
    setIsConfirming(true);
    const res = await staffConfirm(current.query, eventId);
    setIsConfirming(false);
    if (res.ok) {
      applyResult({ ...current, summary: res.value });
      setConfirmed(true);
      toast.success(`Check-in thành công: ${res.value.userName} — ${res.value.tickets} vé`);
    } else {
      const message = errorMessage(res.error);
      applyResult({ kind: "error", message });
      toast.error(message);
    }
  }, [result, applyResult, eventId]);

  /** "Quét tiếp" — xoá thẻ kết quả, mở khoá cho mã tiếp theo. */
  const reset = useCallback(() => {
    applyResult(null);
    setConfirmed(false);
  }, [applyResult]);

  return { result, confirmed, isConfirming, shouldIgnore, lookup, resolveToken, confirm, reset };
}

export function formatCheckinTime(date: Date | null, via: string | null): string {
  const time = date
    ? date.toLocaleTimeString("vi-VN", { timeZone: VN_TIME_ZONE, hour: "2-digit", minute: "2-digit" })
    : null;
  const by = via === "kiosk" ? "tại kiosk" : via === "staff" ? "bởi nhân viên" : null;
  return [time && `lúc ${time}`, by].filter(Boolean).join(" ");
}

/** Thẻ thông tin khách / lỗi sau khi quét hoặc chọn khách. */
export function ScanResultCard({
  result,
  confirmed,
  isConfirming,
  onConfirm,
  onNext,
  nextLabel = "Quét tiếp",
}: {
  result: ScanResult;
  confirmed: boolean;
  isConfirming: boolean;
  onConfirm: () => void;
  onNext: () => void;
  nextLabel?: string;
}) {
  if (result.kind === "error") {
    return (
      <div className="w-full max-w-sm rounded-lg bg-black/80 p-4 text-white">
        <p className="text-sm">{result.message}</p>
        <Button className="mt-3 w-full" onClick={onNext}>
          {nextLabel}
        </Button>
      </div>
    );
  }

  const s = result.summary;
  const wasCheckedIn = s.alreadyCheckedIn && !confirmed;

  return (
    <div className="w-full max-w-sm rounded-lg bg-black/80 p-4 text-white">
      {wasCheckedIn && (
        <p className="mb-3 rounded-md bg-amber-400 px-3 py-2 text-sm font-semibold text-black">
          Đã check-in {formatCheckinTime(s.checkedInAt, s.checkedInVia)}
        </p>
      )}

      <p className="text-xs uppercase tracking-wide text-white/60">Khách</p>
      <p className="mt-1 text-lg font-semibold">{s.userName}</p>

      <div className="mt-3 border-t border-white/20 pt-3">
        <p className="text-xs uppercase tracking-wide text-white/60">{s.tickets} vé · Ghế</p>
        {s.seats.length > 0 ? (
          <p className="font-heading text-2xl tracking-wide">{s.seats.join(" · ")}</p>
        ) : (
          <p className="text-sm text-white/70">Chưa có ghế</p>
        )}
        {s.seatsPending && (
          <p className="mt-1 text-sm text-amber-300">
            Chưa chọn đủ ghế ({s.seats.length}/{s.tickets}).
          </p>
        )}
      </div>

      <div className="mt-3 border-t border-white/20 pt-3 text-sm">
        {s.combos.map((c) => (
          <p key={c}>{c}</p>
        ))}
        {s.shirts && <p className="mt-1 text-amber-300">Áo: {s.shirts}</p>}
      </div>
      <p className="mt-2 text-xs text-white/50">Mã đơn: {s.orderCodes.join(", ")}</p>

      {confirmed && (
        <p className="mt-3 text-sm font-medium text-emerald-400">Đã check-in thành công.</p>
      )}

      {confirmed || wasCheckedIn ? (
        <Button className="mt-4 w-full" onClick={onNext}>
          {nextLabel}
        </Button>
      ) : (
        <Button className="mt-4 w-full" onClick={onConfirm} disabled={isConfirming}>
          {isConfirming ? "Đang xác nhận..." : "Xác nhận check-in"}
        </Button>
      )}
    </div>
  );
}
