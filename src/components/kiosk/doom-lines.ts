import type { KioskView } from "@/app/actions/checkin";

/** Sắc thái ô thoại -> màu bóng đổ (xem .kiosk-bubble trong globals.css). */
export type BubbleTone = "neutral" | "success" | "warn" | "error";
export type DoomLine = { text: string; tone: BubbleTone };

export type DoomMoment =
  | { kind: "home"; tick: number }
  | { kind: "scanning" }
  | { kind: "camera-error" }
  | { kind: "checking" }
  | { kind: "done"; view: KioskView }
  | { kind: "error"; code: string };

// Màn chờ: xoay vòng để kiosk không nói mãi 1 câu.
const HOME_LINES = [
  "Hỡi kẻ phàm trần! Trình vé lên để Doom xét duyệt.",
  "Không ai bước qua cánh cửa này mà Doom chưa cho phép.",
  "Rạp chiếu này thuộc quyền cai trị của Doom. Check-in đi!",
];

// Lời thoại phản diện nhưng vẫn phải rõ khách cần làm gì (gặp nhân viên...).
const ERROR_LINES: Record<string, string> = {
  NOT_FOUND: "Vé này không có trong sổ sách của Doom! Gặp nhân viên ngay.",
  NOT_PAID: "Chưa thanh toán mà dám đứng trước mặt Doom? Gặp nhân viên!",
  WRONG_EVENT: "Sai suất chiếu! Doom không bao giờ nhầm — là ngươi nhầm.",
  NO_TICKET: "Đơn này không có vé. Doom không mở cửa cho kẻ tay trắng!",
  FORBIDDEN: "Cỗ máy này chưa được Doom trao quyền. Gọi nhân viên tới đây!",
  NETWORK: "Ma thuật liên lạc bị gián đoạn… Gọi nhân viên, nhanh!",
};

/** Câu Doom nói cho từng thời điểm của kiosk. */
export function doomLine(m: DoomMoment): DoomLine {
  switch (m.kind) {
    case "home":
      return { text: HOME_LINES[m.tick % HOME_LINES.length], tone: "neutral" };
    case "scanning":
      return { text: "Giơ mã QR vào tầm mắt của Doom. Đừng run tay!", tone: "neutral" };
    case "camera-error":
      return { text: "Hừ! Mắt thần của Doom bị che khuất. Gọi nhân viên tới đây!", tone: "error" };
    case "checking":
      return { text: "Doom đang thẩm định… im lặng!", tone: "neutral" };
    case "error":
      return {
        text: ERROR_LINES[m.code] ?? "Mã QR vô dụng! Doom không đọc nổi thứ này.",
        tone: "error",
      };
    case "done": {
      const { view } = m;
      if (!view.justCheckedIn) {
        return { text: `Ngươi đã qua cửa rồi, ${view.userName}. Định lừa Doom sao?`, tone: "warn" };
      }
      if (view.seatsPending) {
        return {
          text: `Ngươi chưa chọn đủ ghế, ${view.userName}. Doom không dung thứ sự cẩu thả — gặp nhân viên!`,
          tone: "warn",
        };
      }
      return { text: `Được lắm, ${view.userName}. Doom chấp thuận — vào đi trước khi ta đổi ý!`, tone: "success" };
    }
  }
}
