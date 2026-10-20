import type { KioskView } from "@/app/actions/checkin";

/** Sắc thái ô thoại -> màu chấm halftone (xem .kiosk-bubble trong globals.css). */
export type BubbleTone = "neutral" | "success" | "warn" | "error";
/** speech = bóng nói có đuôi, think = mây suy nghĩ, shout = nổ gai khi quát. */
export type BubbleShape = "speech" | "think" | "shout";
export type DoomLine = { text: string; tone: BubbleTone; shape: BubbleShape };

export type DoomMoment =
  | { kind: "home"; tick: number }
  | { kind: "scanning" }
  | { kind: "camera-error" }
  | { kind: "phone" }
  | { kind: "phone-confirm"; name: string; alreadyCheckedIn: boolean }
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
  AMBIGUOUS: "Số này dính tới nhiều kẻ cùng lúc! Quét QR hoặc gặp nhân viên.",
  FORBIDDEN: "Cỗ máy này chưa được Doom trao quyền. Gọi nhân viên tới đây!",
  NETWORK: "Ma thuật liên lạc bị gián đoạn… Gọi nhân viên, nhanh!",
};

/** Câu Doom nói cho từng thời điểm của kiosk. */
export function doomLine(m: DoomMoment): DoomLine {
  switch (m.kind) {
    case "home":
      return { text: HOME_LINES[m.tick % HOME_LINES.length], tone: "neutral", shape: "speech" };
    case "scanning":
      return { text: "Giơ mã QR vào tầm mắt của Doom. Đừng run tay!", tone: "neutral", shape: "speech" };
    case "camera-error":
      return {
        text: "Hừ! Mắt thần của Doom bị che khuất. Gọi nhân viên tới đây!",
        tone: "error",
        shape: "shout",
      };
    case "phone":
      return { text: "Khai số điện thoại của ngươi. Doom biết hết đấy!", tone: "neutral", shape: "speech" };
    case "phone-confirm":
      return m.alreadyCheckedIn
        ? { text: `${m.name}… kẻ này đã qua cửa rồi. Có phải ngươi không?`, tone: "warn", shape: "think" }
        : { text: `${m.name}… có phải ngươi không? Khai thật đi!`, tone: "neutral", shape: "think" };
    case "checking":
      return { text: "Doom đang thẩm định… im lặng!", tone: "neutral", shape: "think" };
    case "error":
      return {
        text: ERROR_LINES[m.code] ?? "Mã QR vô dụng! Doom không đọc nổi thứ này.",
        tone: "error",
        shape: "shout",
      };
    case "done": {
      const { view } = m;
      if (!view.justCheckedIn) {
        return {
          text: `Ngươi đã qua cửa rồi, ${view.userName}. Định lừa Doom sao?`,
          tone: "warn",
          shape: "shout",
        };
      }
      if (view.seatsPending) {
        return {
          text: `Ngươi chưa chọn đủ ghế, ${view.userName}. Doom không dung thứ sự cẩu thả — gặp nhân viên!`,
          tone: "warn",
          shape: "shout",
        };
      }
      return {
        text: `Được lắm, ${view.userName}. Doom chấp thuận — vào đi trước khi ta đổi ý!`,
        tone: "success",
        shape: "speech",
      };
    }
  }
}
