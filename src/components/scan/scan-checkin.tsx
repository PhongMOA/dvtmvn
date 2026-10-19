"use client";

import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";
import { useIsNativeApp } from "@/lib/is-native-app";
import { CustomerSearch } from "./customer-search";

// Tách bundle + không SSR: 2 nhánh scanner đều là code chỉ chạy ở client (camera
// native Capacitor / getUserMedia + @zxing). Nhánh web kéo theo @zxing/library
// (~200KB) nên chỉ nạp khi thật sự vào trang này.
const NativeScanCheckin = dynamic(
  () => import("./native-scanner").then((m) => m.NativeScanCheckin),
  { ssr: false },
);
const WebScanCheckin = dynamic(
  () => import("./web-scanner").then((m) => m.WebScanCheckin),
  { ssr: false },
);

export type ScanEvent = { id: string; label: string };

// Nhớ suất chiếu đã chọn trên máy này (nhân viên mở lại trang không phải chọn lại).
const STORAGE_KEY = "scan-event-id";

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
const subscribe = () => () => {};

const selectClass =
  "h-9 w-full max-w-sm rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-background [&>option]:text-foreground";

export function ScanCheckin({
  events,
  defaultEventId,
}: {
  events: ScanEvent[];
  defaultEventId: string;
}) {
  const isNative = useIsNativeApp();
  const stored = useSyncExternalStore(subscribe, readStored, () => null);
  const [picked, setPicked] = useState<string | null>(null);
  const eventId =
    picked ?? (stored && events.some((e) => e.id === stored) ? stored : defaultEventId);

  function pick(id: string) {
    setPicked(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* không lưu được thì thôi */
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl tracking-wide text-primary">CHECK-IN</h1>
        <label className="mt-3 block text-xs uppercase tracking-wide text-muted-foreground">
          Suất chiếu
          <select
            value={eventId}
            onChange={(e) => pick(e.target.value)}
            className={`${selectClass} mt-1`}
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* key: đổi suất chiếu -> dựng lại hook, bỏ thẻ kết quả của suất cũ */}
      <section key={`scan-${eventId}`}>
        <h2 className="mb-2 font-medium">Quét QR</h2>
        {isNative ? <NativeScanCheckin eventId={eventId} /> : <WebScanCheckin eventId={eventId} />}
      </section>

      <section key={`search-${eventId}`}>
        <h2 className="mb-2 font-medium">Khách không có QR</h2>
        <CustomerSearch eventId={eventId} />
      </section>
    </div>
  );
}
