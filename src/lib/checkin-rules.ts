// Logic thuần (không DB) của check-in — tách riêng để test bằng `npm test`.
// Phần đọc/ghi DB nằm ở src/lib/checkin.ts.

/**
 * Che bớt tên khi hiện trên kiosk sau khi tra bằng SĐT (SĐT dễ đoán — không
 * để người lạ dò ra họ tên đầy đủ): giữ tên gọi, viết tắt họ + đệm.
 * "Lê Quốc Bảo" → "L. Q. Bảo", "Bảo" → "Bảo".
 */
export function maskName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words[0] ?? "";
  const given = words[words.length - 1];
  const initials = words.slice(0, -1).map((w) => `${w[0].toUpperCase()}.`);
  return [...initials, given].join(" ");
}

/**
 * 9 số cuối của SĐT — khoá so khớp chung cho mọi cách nhập ("0912 345 678",
 * "+84912345678", "84912345678"). SĐT di động VN = 0 + 9 số. Trả null nếu
 * không đủ 9 chữ số. Phía DB so bằng right(regexp_replace(...), 9) tương ứng.
 */
export function phoneKey(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : null;
}

type TicketItem = {
  quantity: number;
  upgradedQuantity: number;
  comboType: { eventId: string; includesTicket: boolean };
};

/** Số vé còn hiệu lực của event trong 1 nhóm dòng combo (trừ phần đã nâng cấp đi). */
export function ticketCount(items: TicketItem[], eventId: string): number {
  return items.reduce(
    (sum, it) =>
      it.comboType.eventId === eventId && it.comboType.includesTicket
        ? sum + Math.max(0, it.quantity - it.upgradedQuantity)
        : sum,
    0,
  );
}

/** Sắp ghế theo hàng rồi số: F7, F8, F10, G5 (không phải F10 trước F7). */
export function sortSeats(codes: string[]): string[] {
  return [...codes].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}
