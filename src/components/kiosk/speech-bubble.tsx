import type { DoomLine } from "./doom-lines";

/**
 * Ô thoại kiểu comic phía trên linh vật: nền trắng, viền mực đen, đuôi chĩa
 * xuống đầu Doom, bóng đổ màu theo sắc thái. Đổi câu -> `key` mới -> bật lại
 * hiệu ứng "pop". `aria-live` để trình đọc màn hình đọc thông báo.
 */
export function SpeechBubble({ line }: { line: DoomLine }) {
  return (
    <div aria-live="polite" className="w-full max-w-sm">
      <p key={line.text} className="kiosk-bubble" data-tone={line.tone}>
        {line.text}
      </p>
    </div>
  );
}
