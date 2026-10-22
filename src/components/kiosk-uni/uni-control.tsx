"use client";

import { useState } from "react";
import { sendKioskCommand, type KioskCommand } from "@/app/actions/kiosk-uni";
import { UNI_EVENT } from "./event-config";
import { UniStage, type UniHost } from "./uni-stage";

/**
 * Bảng điều khiển linh vật Uni: xem trước màn kiosk và gửi lệnh (đổi màn,
 * biểu cảm, hero, lời nhắn...) tới máy kiosk đang mở qua bảng KioskState.
 */
export function UniControl({ initialLook }: { initialLook: unknown }) {
  const [failed, setFailed] = useState(false);
  const [host] = useState<UniHost>(() => ({
    mode: "control",
    look: initialLook,
    ev: UNI_EVENT,
    send: (cmd: KioskCommand) => {
      sendKioskCommand(cmd).then(
        (r) => setFailed(!r.ok),
        () => setFailed(true),
      );
    },
  }));

  return (
    <div className="space-y-3">
      {failed && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Lệnh vừa rồi chưa gửi được tới kiosk. Kiểm tra mạng rồi thử lại.
        </p>
      )}
      <UniStage host={host} className="rounded-2xl" />
    </div>
  );
}
