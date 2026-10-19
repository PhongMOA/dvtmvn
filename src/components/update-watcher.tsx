"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const MY_BUILD = process.env.NEXT_PUBLIC_BUILD_ID;
const IS_STAGING = process.env.NEXT_PUBLIC_APP_ENV === "staging";
const POLL_MS = 60_000;
const CHUNK_RELOAD_KEY = "chunk-reload-for";

// Đang gõ dở form thì không tự reload (mất dữ liệu đã nhập).
function isTyping(): boolean {
  const el = document.activeElement;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable);
}

/**
 * Mount ở root layout. Phát hiện server đã deploy bản mới khi người dùng
 * đứng yên trên một trang (chuyển trang thì `deploymentId` của Next tự lo):
 * hỏi /api/version mỗi 60 giây + mỗi lần tab/app quay lại foreground.
 *
 * - Staging: tự reload luôn (test trên máy thật không phải mở lại app).
 * - Production: toast "Đã có bản mới" + nút Tải lại, để người dùng tự chọn.
 * - ChunkLoadError (file JS bản cũ đã bị xoá sau deploy): reload 1 lần.
 */
export function UpdateWatcher() {
  useEffect(() => {
    if (!MY_BUILD) return;
    let notified = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    function onNewBuild() {
      if (IS_STAGING && !isTyping()) {
        location.reload();
        return;
      }
      if (notified) return;
      notified = true;
      toast("Đã có bản mới của trang", {
        description: "Tải lại để dùng phiên bản mới nhất.",
        duration: Infinity,
        action: { label: "Tải lại", onClick: () => location.reload() },
      });
    }

    async function check() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { buildId } = (await res.json()) as { buildId?: string };
        if (buildId && buildId !== MY_BUILD) onNewBuild();
      } catch {
        // mất mạng / server đang restart giữa deploy — lần sau hỏi lại
      }
    }

    function start() {
      clearInterval(timer);
      timer = setInterval(check, POLL_MS);
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        check();
        start();
      } else {
        clearInterval(timer); // nền thì không hỏi, đỡ tốn pin
      }
    }

    function isChunkError(reason: unknown): boolean {
      const r = reason as { name?: string; message?: string } | null;
      return r?.name === "ChunkLoadError" || /Loading chunk [\w-]+ failed/i.test(r?.message ?? "");
    }
    function onChunkError(reason: unknown) {
      if (!isChunkError(reason)) return;
      // Chỉ reload 1 lần cho mỗi bản, tránh vòng lặp reload nếu lỗi do mạng.
      if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === MY_BUILD) return;
      sessionStorage.setItem(CHUNK_RELOAD_KEY, MY_BUILD!);
      location.reload();
    }
    const onError = (e: ErrorEvent) => onChunkError(e.error);
    const onRejection = (e: PromiseRejectionEvent) => onChunkError(e.reason);

    start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
