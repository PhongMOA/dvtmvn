"use client";

import { useEffect, useRef, useState } from "react";
import type { KioskCommand } from "@/app/actions/kiosk-uni";
import type { UniEventConfig } from "./event-config";

// Engine linh vật Uni là JS thuần trong public/kiosk-uni (vẽ canvas, tự dựng DOM
// bên trong 1 thẻ div). React chỉ nạp script, gắn engine vào div và đưa vào
// "host" — các hàm gọi server, camera, thoát kiosk.

/** Đổi số này mỗi khi sửa file trong public/kiosk-uni để máy kiosk không dùng bản cache cũ. */
const VER = "8";
const SCRIPTS = ["decor.js", "hero-decor.js", "face.js", "uni.js"];

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type UniHost = {
  mode: "kiosk" | "control";
  look: unknown;
  ev: UniEventConfig;
  checkinQr?: (code: string) => Promise<Result<unknown>>;
  lookupPhone?: (phone: string) => Promise<Result<unknown>>;
  confirmPhone?: (phone: string) => Promise<Result<unknown>>;
  exitPin?: (pin: string) => Promise<{ ok: boolean; error?: string }>;
  /** cam = ô camera trên sân khấu; state = 'loading' | 'ready' | 'error'. */
  startScan?: (
    cam: HTMLElement,
    onCode: (code: string) => void,
    onState: (state: "loading" | "ready" | "error", message?: string) => void,
    facing: "user" | "environment",
  ) => void;
  stopScan?: () => void;
  /** Gọi mỗi khi sân khấu co giãn lại (đổi kích thước màn). */
  onLayout?: () => void;
  send?: (cmd: KioskCommand) => void;
};

export type UniApi = { command: (cmd: KioskCommand) => void; destroy: () => void };

declare global {
  interface Window {
    UniApp?: { mount: (root: HTMLElement, host: UniHost) => UniApi };
  }
}

let loading: Promise<void> | null = null;

function loadEngine(): Promise<void> {
  if (loading) return loading;
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = `/kiosk-uni/uni.css?v=${VER}`;
  const font = document.createElement("link");
  font.rel = "stylesheet";
  font.href = "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap";
  document.head.append(css, font);
  // decor.js phải chạy trước hero-decor.js và face.js -> nạp lần lượt.
  loading = SCRIPTS.reduce(
    (p, src) =>
      p.then(
        () =>
          new Promise<void>((resolve, reject) => {
            const s = document.createElement("script");
            s.src = `/kiosk-uni/${src}?v=${VER}`;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error(src));
            document.head.append(s);
          }),
      ),
    Promise.resolve(),
  ).catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

/**
 * Gắn engine vào 1 div. `host` chỉ được đọc lúc gắn — các hàm trong đó nên đọc
 * giá trị mới qua ref nếu cần. `onReady` nhận api để gửi lệnh vào engine.
 */
export function UniStage({
  host,
  onReady,
  className,
}: {
  host: UniHost;
  onReady?: (api: UniApi | null) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef(host);
  const readyRef = useRef(onReady);
  const [error, setError] = useState(false);

  useEffect(() => {
    let api: UniApi | null = null;
    let dead = false;
    const ready = readyRef.current;
    loadEngine().then(
      () => {
        if (dead || !ref.current || !window.UniApp) return;
        api = window.UniApp.mount(ref.current, hostRef.current);
        ready?.(api);
      },
      () => {
        if (!dead) setError(true);
      },
    );
    return () => {
      dead = true;
      ready?.(null);
      api?.destroy();
    };
  }, []);

  if (error) {
    return (
      <div className="flex size-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Không tải được linh vật. Kiểm tra mạng rồi tải lại trang.
      </div>
    );
  }
  return <div ref={ref} className={className} />;
}
