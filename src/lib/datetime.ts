// Mọi thời gian hiển thị/nhập liệu đều theo giờ Việt Nam (UTC+7). DB lưu UTC; server
// Vercel chạy UTC nên Intl.DateTimeFormat/Date.getHours() KHÔNG truyền timeZone sẽ
// ra giờ UTC (lệch 7 tiếng) — luôn đi qua các helper ở đây.
export const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";

/** Date -> "yyyy-MM-ddTHH:mm" theo giờ VN, cho <input type="datetime-local">. */
export function toVnDatetimeLocal(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: VN_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** "yyyy-MM-ddTHH:mm" (giờ VN, từ datetime-local) -> Date. */
export function fromVnDatetimeLocal(value: string): Date {
  return new Date(`${value}:00+07:00`);
}
