import { useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * true khi code đang chạy trong app Android (Capacitor WebView), false khi
 * chạy trên browser bình thường. Dùng để rẽ nhánh UI/luồng chỉ có ý nghĩa ở
 * 1 trong 2 môi trường (đăng nhập native, camera scan, đăng ký push token).
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

function subscribe() {
  return () => {};
}
function getServerSnapshot() {
  return false;
}

/**
 * Bản hook của `isNativeApp()` cho client component. Giá trị không đổi trong
 * vòng đời app nên không cần subscribe thật — chỉ dùng `useSyncExternalStore`
 * để lấy đúng giá trị mà không lệch hydration: server (và lần render đầu ở
 * client, trước khi hydrate) luôn trả `false` (web) qua `getServerSnapshot`,
 * sau đó React tự re-render đồng bộ với giá trị thật ngay sau hydrate —
 * không cần state/effect thủ công (tránh lỗi lint
 * react-hooks/set-state-in-effect).
 */
export function useIsNativeApp(): boolean {
  return useSyncExternalStore(subscribe, isNativeApp, getServerSnapshot);
}
