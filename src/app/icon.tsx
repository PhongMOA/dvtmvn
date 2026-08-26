import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Favicon hình vuông, rút gọn từ logo chính (src/components/logo.tsx): 2 khối
// dính nhau — khối trên "ĐVT" (Đa Vũ Trụ), khối dưới "MVN" (Marvel VN), theo
// yêu cầu user viết tắt để vừa vào icon vuông nhỏ. Không dùng lại
// src/components/logo.tsx trực tiếp vì đó là SVG ăn theo CSS custom
// properties của theme (--card, --primary...) — favicon được satori render
// độc lập, không có globals.css, nên phải hard-code màu thật (đã tính từ
// oklch trong globals.css: --card, --card-foreground, --primary,
// --primary-foreground ở chế độ dark, theme duy nhất app đang dùng).
// Font: cần glyph "Đ" (Vietnamese) nên không dùng font hệ thống mặc định của
// satori (chỉ có Latin cơ bản) — nhúng bản Anton đã subset sẵn chỉ đúng các
// ký tự ĐVTMVN (src/fonts/anton-icon-subset.ttf, cùng font family dùng cho
// dòng "ĐA VŨ TRỤ" trong logo chính).
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  const fontData = await readFile(
    join(process.cwd(), "src/fonts/anton-icon-subset.ttf"),
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            width: "100%",
            flex: "0 0 36%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#080c09",
            border: "2px solid #ffffff",
            color: "#eaf0eb",
            fontFamily: "Anton",
            fontSize: 15,
            letterSpacing: 1,
          }}
        >
          ĐVT
        </div>
        <div
          style={{
            width: "100%",
            flex: "1 1 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0fbd59",
            borderLeft: "2px solid #ffffff",
            borderRight: "2px solid #ffffff",
            borderBottom: "2px solid #ffffff",
            color: "#010201",
            fontFamily: "Anton",
            fontSize: 24,
            letterSpacing: 1,
          }}
        >
          MVN
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Anton", data: fontData, style: "normal", weight: 400 }],
    },
  );
}
