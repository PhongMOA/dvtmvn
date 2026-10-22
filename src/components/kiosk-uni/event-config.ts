// Nội dung 3 mục Lịch trình / Sơ đồ / Hỏi đáp của kiosk linh vật Uni.
// Hiện là nội dung mẫu cho buổi Offline Avengers: Doomsday — sửa trực tiếp ở đây.
// Mục Sơ đồ vẽ sơ đồ ghế của rạp (src/lib/seats/layout.ts).

import { SEAT_LAYOUT, type SeatLayout } from "@/lib/seats/layout";

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
  /** Sơ đồ ghế phòng chiếu cho mục Sơ đồ; bỏ trống thì vẽ sơ đồ khu vực. */
  seats?: SeatLayout;
  help: string;
  /** Check-in xong bao nhiêu giây thì tự về màn quét. */
  backSec: number;
};

export const UNI_EVENT: UniEventConfig = {
  name: "Đa vũ trụ MarvelVN",
  theme: "Offline Avengers: Doomsday",
  agenda: [
    { start: "18:00", end: "18:45", title: "Check-in" },
    { start: "18:45", end: "18:50", title: "Vào rạp" },
    { start: "18:50", end: "19:10", title: "Giao lưu trúng thưởng" },
    { start: "19:10", end: "21:40", title: "Bắt đầu chiếu phim" },
  ],
  faq: [
    { q: "Mấy giờ vào rạp?", a: "Rạp mở cửa lúc 18:45. Bạn vào chỗ sớm để kịp giao lưu trúng thưởng lúc 18:50 nhé." },
    { q: "Mấy giờ chiếu phim?", a: "Phim bắt đầu chiếu lúc 19:10, ngay sau phần giao lưu trúng thưởng." },
    { q: "Giao lưu trúng thưởng lúc nào?", a: "Từ 18:50 đến 19:10 ngay trong phòng chiếu. Có mặt đúng giờ để không lỡ quà nhé." },
    { q: "Quên mã QR thì sao?", a: "Bấm Check-in rồi chọn Nhập số điện thoại đã đặt vé." },
    { q: "Ghế của tôi ở đâu?", a: "Số ghế hiện trên màn check-in và trong mục Vé của tôi." },
  ],
  directions: {
    hall: { name: "Phòng chiếu", label: "Phòng chiếu: rẽ phải", note: "Đi thẳng qua sảnh rồi rẽ phải.", side: "right" },
    help: { name: "Quầy hỗ trợ", label: "Quầy hỗ trợ: bên trái", note: "Ngay cạnh lối vào.", side: "left" },
  },
  seats: SEAT_LAYOUT,
  help: "Cần hỗ trợ, bạn ghé quầy hỗ trợ cạnh lối vào nhé.",
  backSec: 8,
};
