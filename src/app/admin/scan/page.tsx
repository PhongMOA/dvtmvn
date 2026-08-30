"use client";

import dynamic from "next/dynamic";
import { useIsNativeApp } from "@/lib/is-native-app";

// Tách bundle + không SSR: 2 nhánh scanner đều là code chỉ chạy ở client (camera
// native Capacitor / getUserMedia + @zxing). Nhánh web kéo theo @zxing/library
// (~200KB) nên chỉ nạp khi thật sự vào trang này.
const NativeScanCheckin = dynamic(
  () =>
    import("@/components/admin-scan/native-scanner").then(
      (m) => m.NativeScanCheckin,
    ),
  { ssr: false },
);
const WebScanCheckin = dynamic(
  () =>
    import("@/components/admin-scan/web-scanner").then((m) => m.WebScanCheckin),
  { ssr: false },
);

/**
 * Trang quét QR check-in cho admin. App Android dùng camera native (ML Kit),
 * web dùng getUserMedia + @zxing/browser. Xem 2 component tương ứng trong
 * src/components/admin-scan/ và hook chung useCheckinScan.
 */
export default function AdminScanPage() {
  const isNative = useIsNativeApp();
  return isNative ? <NativeScanCheckin /> : <WebScanCheckin />;
}
