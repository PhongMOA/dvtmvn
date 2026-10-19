"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth-helpers";
import {
  getCheckinSummary,
  performCheckin,
  resolveByPhone,
  resolveByQrToken,
  type CheckinError,
  type CheckinSummary,
  type CheckinTarget,
} from "@/lib/checkin";

// Server actions check-in cho kiosk (/kiosk, khách tự thao tác) và nhân viên
// (/scan). Tất cả cần quyền staff (admin hoặc role "staff" — máy kiosk đăng
// nhập bằng tài khoản staff). Chỉ trả field cần hiển thị — không email/địa chỉ.
// Kiosk tra bằng SĐT chỉ thấy tên đã che (maskName) vì SĐT dễ đoán.

type Fail = { ok: false; error: CheckinError | "FORBIDDEN" };

/** Thông tin kiosk hiện cho khách — bỏ mã đơn, tên đầy đủ chỉ khi quét QR. */
export type KioskView = Omit<CheckinSummary, "orderCodes" | "maskedName"> & {
  justCheckedIn: boolean;
};

export type StaffView = CheckinSummary & { justCheckedIn: boolean };

/** Xem trước khi xác nhận SĐT trên kiosk: chỉ tên che + số vé. */
export type KioskPhonePreview = { maskedName: string; tickets: number; alreadyCheckedIn: boolean };

async function staffId(): Promise<string | null> {
  try {
    const user = await requireStaff();
    return user.id ?? null;
  } catch {
    return null;
  }
}

const forbidden: Fail = { ok: false, error: "FORBIDDEN" };

function toKioskView(s: StaffView, name: string): KioskView {
  return {
    userName: name,
    tickets: s.tickets,
    seats: s.seats,
    seatsPending: s.seatsPending,
    combos: s.combos,
    shirts: s.shirts,
    alreadyCheckedIn: s.alreadyCheckedIn,
    checkedInAt: s.checkedInAt,
    justCheckedIn: s.justCheckedIn,
  };
}

function revalidateEvent(eventId: string) {
  revalidatePath(`/admin/events/${eventId}/orders`);
  revalidatePath("/admin/orders");
}

// --- Kiosk -----------------------------------------------------------------

/** Quét QR trên kiosk = check-in luôn (khách đang cầm vé của chính mình). */
export async function kioskCheckinQr(
  qrToken: string,
  eventId: string,
): Promise<{ ok: true; value: KioskView } | Fail> {
  const actor = await staffId();
  if (!actor) return forbidden;
  const target = await resolveByQrToken(qrToken, eventId);
  if (!target.ok) return target;
  const res = await performCheckin(target.value, "kiosk", actor);
  if (!res.ok) return res;
  if (res.value.justCheckedIn) revalidateEvent(eventId);
  return { ok: true, value: toKioskView(res.value, res.value.userName) };
}

/** Bước 1 nhập SĐT trên kiosk: hiện tên che để khách xác nhận "Đúng là tôi". */
export async function kioskLookupPhone(
  phone: string,
  eventId: string,
): Promise<{ ok: true; value: KioskPhonePreview } | Fail> {
  if (!(await staffId())) return forbidden;
  const target = await resolveByPhone(phone, eventId);
  if (!target.ok) return target;
  const summary = await getCheckinSummary(target.value);
  if (!summary.ok) return summary;
  const { maskedName, tickets, alreadyCheckedIn } = summary.value;
  return { ok: true, value: { maskedName, tickets, alreadyCheckedIn } };
}

/** Bước 2: khách bấm xác nhận — tra lại theo SĐT (không tin userId từ client). */
export async function kioskConfirmPhone(
  phone: string,
  eventId: string,
): Promise<{ ok: true; value: KioskView } | Fail> {
  const actor = await staffId();
  if (!actor) return forbidden;
  const target = await resolveByPhone(phone, eventId);
  if (!target.ok) return target;
  const res = await performCheckin(target.value, "kiosk", actor);
  if (!res.ok) return res;
  if (res.value.justCheckedIn) revalidateEvent(eventId);
  // Tra bằng SĐT → chỉ hiện tên đã che.
  return { ok: true, value: toKioskView(res.value, res.value.maskedName) };
}

// --- Nhân viên -------------------------------------------------------------

export type StaffQuery = { qrToken: string } | { phone: string };

async function resolveStaffQuery(
  query: StaffQuery,
  eventId: string,
): Promise<{ ok: true; value: CheckinTarget } | { ok: false; error: CheckinError }> {
  return "qrToken" in query
    ? resolveByQrToken(query.qrToken, eventId)
    : resolveByPhone(query.phone, eventId);
}

/** Nhân viên tra cứu (chưa check-in) — thấy đủ tên + mã đơn để đối chiếu. */
export async function staffLookup(
  query: StaffQuery,
  eventId: string,
): Promise<{ ok: true; value: CheckinSummary } | Fail> {
  if (!(await staffId())) return forbidden;
  const target = await resolveStaffQuery(query, eventId);
  if (!target.ok) return target;
  return getCheckinSummary(target.value);
}

/** Nhân viên bấm "Xác nhận check-in" sau khi xem staffLookup. */
export async function staffConfirm(
  query: StaffQuery,
  eventId: string,
): Promise<{ ok: true; value: StaffView } | Fail> {
  const actor = await staffId();
  if (!actor) return forbidden;
  const target = await resolveStaffQuery(query, eventId);
  if (!target.ok) return target;
  const res = await performCheckin(target.value, "staff", actor);
  if (res.ok && res.value.justCheckedIn) revalidateEvent(eventId);
  return res;
}
