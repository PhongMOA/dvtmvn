"use server";

import type { Prisma } from "@/generated/prisma/client";
import { requireAdmin, requireStaff } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

// Đồng bộ trang điều khiển /admin/kiosk -> máy kiosk linh vật Uni qua bảng
// KioskState (singleton). Admin gửi lệnh, kiosk (tài khoản staff) hỏi định kỳ
// và chạy các lệnh có seq mới hơn lần hỏi trước.

/** Lệnh engine Uni hiểu — xem public/kiosk-uni/uni.js (onCommand). */
export type KioskCommand = {
  t: "look" | "go" | "expr" | "say" | "conf" | "auto" | "scn";
  v?: unknown;
  kind?: string;
};
export type KioskCommandEntry = KioskCommand & { seq: number; at: number };

const KINDS = new Set(["look", "go", "expr", "say", "conf", "auto", "scn"]);
// Chỉ giữ ngần này lệnh cuối — kiosk hỏi mỗi ~1,5 giây nên không bao giờ hụt.
const KEEP = 30;
const ID = "default";

async function can(check: () => Promise<unknown>): Promise<boolean> {
  try {
    await check();
    return true;
  } catch {
    return false;
  }
}

/** Kiosk hỏi trạng thái: since < 0 (lần đầu) -> chỉ lấy look + seq hiện tại, không phát lại lệnh cũ. */
export async function getKioskState(since: number): Promise<
  | { ok: true; value: { seq: number; look: unknown; cmds: KioskCommandEntry[]; now: number } }
  | { ok: false; error: "FORBIDDEN" }
> {
  if (!(await can(requireStaff))) return { ok: false, error: "FORBIDDEN" };
  const row = await prisma.kioskState.findUnique({ where: { id: ID } });
  const all = (row?.cmds ?? []) as KioskCommandEntry[];
  return {
    ok: true,
    value: {
      seq: row?.seq ?? 0,
      look: row?.look ?? null,
      cmds: since < 0 ? [] : all.filter((c) => c.seq > since),
      now: Date.now(),
    },
  };
}

/** Bộ mặt đang lưu — trang điều khiển mở lại thấy đúng bộ kiosk đang dùng. */
export async function getKioskLook(): Promise<unknown> {
  if (!(await can(requireStaff))) return null;
  const row = await prisma.kioskState.findUnique({ where: { id: ID }, select: { look: true } });
  return row?.look ?? null;
}

export async function sendKioskCommand(cmd: KioskCommand): Promise<{ ok: boolean }> {
  if (!(await can(requireAdmin))) return { ok: false };
  if (!cmd || !KINDS.has(cmd.t) || JSON.stringify(cmd).length > 20_000) return { ok: false };
  const clean: KioskCommand = { t: cmd.t, v: cmd.v, kind: typeof cmd.kind === "string" ? cmd.kind : undefined };
  await prisma.$transaction(async (tx) => {
    const row = await tx.kioskState.findUnique({ where: { id: ID } });
    const seq = (row?.seq ?? 0) + 1;
    const cmds = [...((row?.cmds ?? []) as KioskCommandEntry[]), { ...clean, seq, at: Date.now() }].slice(-KEEP);
    const data = {
      seq,
      cmds: cmds as unknown as Prisma.InputJsonValue,
      ...(clean.t === "look" ? { look: clean.v as Prisma.InputJsonValue } : {}),
    };
    await tx.kioskState.upsert({ where: { id: ID }, create: { id: ID, ...data }, update: data });
  });
  return { ok: true };
}
