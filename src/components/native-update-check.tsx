"use client";

import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useIsNativeApp } from "@/lib/is-native-app";
import type { AppVersion } from "@/app/api/app-version/route";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// versionCode của APK đang cài. APK cũ build trước khi có plugin App thì
// không đọc được → coi là 0 (luôn cũ hơn) để nhắc cài bản mới có plugin.
async function installedVersionCode(): Promise<number> {
  if (!Capacitor.isPluginAvailable("App")) return 0;
  return Number((await App.getInfo()).build) || 0;
}

/**
 * Mount ở root layout, chỉ chạy trong app Android. Lúc mở app và mỗi lần quay
 * lại foreground: so versionCode đang cài với bản APK mới nhất
 * (/api/app-version ← GitHub Releases). Có bản mới → hộp thoại "Cập nhật":
 * mở link APK, WebView chuyển link khác domain ra trình duyệt hệ thống →
 * Android tải về → bấm cài đè (cùng chữ ký, không mất đăng nhập).
 */
export function NativeUpdateCheck() {
  const isNative = useIsNativeApp();
  const [update, setUpdate] = useState<{ latest: NonNullable<AppVersion>; current: number } | null>(null);
  const [dismissed, setDismissed] = useState<number | null>(null);

  useEffect(() => {
    if (!isNative) return;

    async function check() {
      try {
        const [current, res] = await Promise.all([
          installedVersionCode(),
          fetch("/api/app-version", { cache: "no-store" }),
        ]);
        const latest = (await res.json()) as AppVersion;
        if (latest && latest.versionCode > current) setUpdate({ latest, current });
      } catch {
        // mất mạng — lần mở app sau hỏi lại
      }
    }
    function onVisibility() {
      if (document.visibilityState === "visible") check();
    }

    check();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [isNative]);

  if (!update) return null;
  const { latest, current } = update;
  if (!latest.mandatory && dismissed === latest.versionCode) return null;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !latest.mandatory) setDismissed(latest.versionCode);
      }}
      disablePointerDismissal={latest.mandatory}
    >
      <DialogPopup showClose={!latest.mandatory} className="w-[calc(100%-2rem)]">
        <DialogHeader>
          <DialogTitle>Có bản app mới</DialogTitle>
          <DialogDescription>
            Bản {latest.versionCode}
            {current > 0 && ` (máy đang dùng bản ${current})`}.
            {latest.mandatory && " Cần cập nhật để tiếp tục sử dụng."}
          </DialogDescription>
        </DialogHeader>
        {latest.notes && (
          <p className="mt-3 max-h-40 overflow-y-auto whitespace-pre-line text-sm text-muted-foreground">
            {latest.notes}
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Bấm Cập nhật → tải file về → mở file và chọn Cài đặt.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button className="w-full" onClick={() => (location.href = latest.url)}>
            Cập nhật
          </Button>
          {!latest.mandatory && (
            <Button variant="ghost" className="w-full" onClick={() => setDismissed(latest.versionCode)}>
              Để sau
            </Button>
          )}
        </div>
      </DialogPopup>
    </Dialog>
  );
}
