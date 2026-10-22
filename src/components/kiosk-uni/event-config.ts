// Nội dung 3 mục Lịch trình / Sơ đồ / Hỏi đáp của kiosk linh vật Uni.
// Hiện là nội dung mẫu cho buổi Offline Avengers: Doomsday — sửa trực tiếp ở đây.

export type UniSide = "left" | "right";

export type UniEventConfig = {
  name: string;
  theme: string;
  /** Giờ "HH:MM" theo giờ máy kiosk; phiên đang diễn ra được tô sáng. */
  agenda: { start: string; end: string; title: string }[];
  /** a = "__NEXT__" -> engine tự trả lời phiên kế tiếp theo lịch trình. */
  faq: { q: string; a: string }[];
  directions: {
    hall: { name: string; label: string; note?: string; side: UniSide };
    help: { name: string; label: string; note?: string; side: UniSide };
  };
  help: string;
  /** Check-in xong bao nhiêu giây thì tự về màn quét. */
  backSec: number;
};

export const UNI_EVENT: UniEventConfig = {
  name: "Đa vũ trụ MarvelVN",
  theme: "Offline Avengers: Doomsday",
  agenda: [
    { start: "18:00", end: "18:45", title: "Check-in" },
    { start: "18:45", end: "19:00", title: "Vào rạp" },
    { start: "19:00", end: "21:30", title: "Chiếu phim" },
    { start: "21:30", end: "22:00", title: "Bốc thăm may mắn" },
  ],
  faq: [
    { q: "Mấy giờ vào rạp?", a: "Rạp mở cửa lúc 18:45, phim chiếu lúc 19:00." },
    { q: "Tiếp theo là gì?", a: "__NEXT__" },
    { q: "Nhận combo bắp nước ở đâu?", a: "Bạn nhận combo và áo tại quầy hỗ trợ sau khi check-in." },
    { q: "Quên mã QR thì sao?", a: "Bấm Check-in rồi chọn Nhập số điện thoại đã đặt vé." },
    { q: "Ghế của tôi ở đâu?", a: "Số ghế hiện trên màn check-in và trong mục Vé của tôi." },
  ],
  directions: {
    hall: { name: "Phòng chiếu", label: "Phòng chiếu: rẽ phải", note: "Đi thẳng qua sảnh rồi rẽ phải.", side: "right" },
    help: { name: "Quầy hỗ trợ", label: "Quầy hỗ trợ: bên trái", note: "Ngay cạnh lối vào.", side: "left" },
  },
  help: "Cần hỗ trợ, bạn ghé quầy hỗ trợ cạnh lối vào nhé.",
  backSec: 8,
};
