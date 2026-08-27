"use client";

import { useEffect } from "react";
import { PushNotifications } from "@capacitor/push-notifications";
import { useIsNativeApp } from "@/lib/is-native-app";
import { registerDeviceToken } from "@/app/actions/device-tokens";

/**
 * Mount ở root layout — chỉ chạy khi app native (Android). Tự xin quyền
 * push + đăng ký token FCM mỗi lần app mở (không chỉ ngay sau khi bấm nút
 * đăng nhập), để cả trường hợp user đã đăng nhập từ phiên trước (cookie
 * session còn hiệu lực) cũng được đăng ký token. registerDeviceToken() tự
 * throw UNAUTHORIZED nếu chưa đăng nhập — nuốt lỗi lặng lẽ trong trường hợp
 * đó là hành vi mong muốn (không có UI nào cần biết chuyện này thất bại).
 */
export function PushRegistrar() {
  const isNative = useIsNativeApp();

  useEffect(() => {
    if (!isNative) return;

    let cancelled = false;

    async function setup() {
      const perm = await PushNotifications.checkPermissions();
      if (perm.receive === "prompt") {
        await PushNotifications.requestPermissions();
      }
      if (cancelled) return;
      await PushNotifications.register();
    }

    PushNotifications.addListener("registration", (token) => {
      registerDeviceToken(token.value).catch(() => {});
    });

    setup().catch(() => {});

    return () => {
      cancelled = true;
      PushNotifications.removeAllListeners().catch(() => {});
    };
  }, [isNative]);

  return null;
}
