"use client";

import { useId, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type MascotMood = "idle" | "scanning" | "success" | "error" | "sleep";

// Toạ độ x của mắt trái / phải (đối xứng qua x=120).
const EYES = [95, 145] as const;
const EYE_Y = 129;

// Hình học nửa trái của mặt nạ; nửa phải lật qua x=120 bằng `mirror`.
const EYE_FRAME = "M62 106 116 120 114 146C96 150 76 146 64 132Z";
const SOCKET = "M68 112 112 124 110 141C95 144 79 141 70 130Z";
const SCLERA = "M75 124C90 119 104 122 110 129 102 140 85 140 77 133Z";
const mirror = "translate(240 0) scale(-1 1)";

/**
 * Linh vật kiosk: đầu Doctor Doom chibi (mũ trùm vải xanh lá, mặt nạ thép có
 * đinh tán, mắt tròng cam sau khe mặt nạ, cổ giáp + khuy vàng) — vẽ lại bằng
 * SVG theo ảnh mẫu plans/261019-kiosk-checkin/assets/mascot-reference-doom.png.
 *
 * Mặt nạ kim loại không cử động nên biểu cảm nằm ở MẮT + chuyển động đầu, điều
 * khiển bằng class `doom--<mood>` (keyframes trong globals.css, mục "Kiosk
 * mascot"). `glow` đổi màu tròng mắt; `look` (-1..1) cho mắt liếc theo điểm chạm.
 */
export function DoomMascot({
  mood = "idle",
  glow = "#ff8a1f",
  look,
  className,
}: {
  mood?: MascotMood;
  glow?: string;
  look?: { x: number; y: number } | null;
  className?: string;
}) {
  // id gradient/filter phải duy nhất nếu trang có nhiều linh vật.
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${name}-${uid}`;
  const url = (name: string) => `url(#${id(name)})`;

  const eyeColor = mood === "error" ? "#ff3b30" : glow;
  const lookX = mood === "scanning" ? 3 : (look?.x ?? 0) * 3;
  const lookY = mood === "scanning" ? 0 : (look?.y ?? 0) * 1.5;
  const style = {
    "--doom-eye": eyeColor,
    "--doom-look-x": `${lookX}px`,
    "--doom-look-y": `${lookY}px`,
  } as CSSProperties;

  const happy = mood === "success";

  return (
    <svg
      viewBox="0 0 240 240"
      role="img"
      aria-label="Doctor Doom"
      className={cn("doom", `doom--${mood}`, className)}
      style={style}
    >
      <defs>
        <radialGradient id={id("hood")} cx="0.4" cy="0.2" r="0.9">
          <stop offset="0" stopColor="#8cc070" />
          <stop offset="0.4" stopColor="#4a8740" />
          <stop offset="1" stopColor="#1b3f18" />
        </radialGradient>
        <linearGradient id={id("rim")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#74ad5c" />
          <stop offset="1" stopColor="#24521f" />
        </linearGradient>
        <radialGradient id={id("metal")} cx="0.38" cy="0.28" r="0.85">
          <stop offset="0" stopColor="#e9ecee" />
          <stop offset="0.3" stopColor="#959ca2" />
          <stop offset="0.7" stopColor="#525a61" />
          <stop offset="1" stopColor="#25292d" />
        </radialGradient>
        <linearGradient id={id("plate")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dfe3e6" />
          <stop offset="1" stopColor="#6a7279" />
        </linearGradient>
        <linearGradient id={id("armor")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c3c9ce" />
          <stop offset="1" stopColor="#555c63" />
        </linearGradient>
        <radialGradient id={id("gold")} cx="0.35" cy="0.3" r="0.7">
          <stop offset="0" stopColor="#fff1a8" />
          <stop offset="0.5" stopColor="#e0a92a" />
          <stop offset="1" stopColor="#7a5208" />
        </radialGradient>
        <radialGradient id={id("iris")} cx="0.45" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#ffe3a3" />
          <stop offset="0.5" style={{ stopColor: "var(--doom-eye)" }} />
          <stop offset="1" stopColor="#7a2400" />
        </radialGradient>
        <linearGradient id={id("beam")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--doom-eye)" }} stopOpacity="0.55" />
          <stop offset="1" style={{ stopColor: "var(--doom-eye)" }} stopOpacity="0" />
        </linearGradient>
        <filter id={id("blur")} x="-1" y="-1" width="3" height="3">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      <g className="doom-head">
        {/* Cổ giáp + khuy vàng giữ áo choàng */}
        <path d="M74 204c12 18 80 18 92 0l18 36H56Z" fill={url("armor")} />
        <g fill={url("gold")} stroke="#5c3d05" strokeWidth="1">
          <circle cx="94" cy="231" r="9" />
          <circle cx="146" cy="231" r="9" />
        </g>

        {/* Mũ trùm: vòm tròn ôm đầu, vải gom lại rủ xuống vai */}
        <path
          d="M120 8C56 8 16 54 16 116c0 40 12 70 30 92-14 12-30 22-42 32h56c10-14 30-26 60-26s50 12 60 26h56c-12-10-28-20-42-32 18-22 30-52 30-92C224 54 184 8 120 8Z"
          fill={url("hood")}
        />
        <g fill="none" stroke="#1d461a" strokeLinecap="round" strokeOpacity="0.55" strokeWidth="2.5">
          <path d="M70 22c-26 16-42 44-44 80" />
          <path d="M170 22c26 16 42 44 44 80" />
          <path d="M104 12c-6 4-8 10-6 16M138 12c6 4 8 10 6 16" />
          <path d="M30 178c6 12 12 22 18 30M210 178c-6 12-12 22-18 30" />
          <path d="M22 232c10-8 22-14 34-18M218 232c-10-8-22-14-34-18" />
        </g>
        <ellipse cx="94" cy="28" rx="32" ry="10" fill="#fff" opacity="0.15" />

        {/* Mép mũ trùm cuộn quanh mặt + lòng mũ tối */}
        <path
          d="M120 32C68 32 40 70 40 118c0 52 34 92 80 98 46-6 80-46 80-98 0-48-28-86-80-86Z"
          fill={url("rim")}
        />
        <path
          d="M120 42C74 42 50 76 50 118c0 48 30 84 70 88 40-4 70-40 70-88 0-42-24-76-70-76Z"
          fill="#0c180b"
        />

        {/* Mặt nạ: tròn bè kiểu chibi, hàm vuông */}
        <path
          d="M120 54C80 54 56 80 56 116c0 28 6 50 20 68 8 12 22 20 44 20s36-8 44-20c14-18 20-40 20-68 0-36-24-62-64-62Z"
          fill={url("metal")}
          stroke="#22272b"
          strokeWidth="1.5"
        />
        {/* Đường ghép tấm thép: trán (giữa + ngang), má, hàm */}
        <g fill="none" stroke="#3a4046" strokeWidth="1.4" strokeLinecap="round">
          <path d="M120 56v34" />
          <path d="M68 92c32-10 72-10 104 0" />
          <path d="M66 150c10 4 24 4 36 0M174 150c-10 4-24 4-36 0" />
          <path d="M78 176c12 6 24 6 34 4M162 176c-12 6-24 6-34 4" />
        </g>
        <Rivets
          points={[
            ...Array.from({ length: 10 }, (_, i) => {
              const x = 84 + i * 8;
              return [x, 68 + ((x - 120) / 40) ** 2 * 8] as const;
            }),
            ...[70, 78, 86, 94].flatMap((x) => [[x, 156] as const, [240 - x, 156] as const]),
            ...[104, 112, 120, 128, 136].map((x) => [x, 196] as const),
          ]}
        />

        {/* Khung mắt thép nổi + hốc mắt */}
        <path d={EYE_FRAME} fill={url("plate")} stroke="#2a2f34" strokeWidth="1" />
        <path d={EYE_FRAME} fill={url("plate")} stroke="#2a2f34" strokeWidth="1" transform={mirror} />
        <path d={SOCKET} fill="#121518" />
        <path d={SOCKET} fill="#121518" transform={mirror} />

        {/* Mắt: lòng trắng + tròng cam (liếc theo --doom-look-*) */}
        <g className="doom-eyes">
          {EYES.map((cx) => (
            <ellipse
              key={cx}
              className="doom-eye-glow"
              cx={cx}
              cy={EYE_Y}
              rx="14"
              ry="9"
              style={{ fill: "var(--doom-eye)" }}
              filter={url("blur")}
            />
          ))}
          {happy ? (
            <g fill="none" style={{ stroke: "var(--doom-eye)" }} strokeWidth="4" strokeLinecap="round">
              <path d="M84 133q11-13 22 0" />
              <path d="M134 133q11-13 22 0" />
            </g>
          ) : (
            <>
              <path d={SCLERA} fill="#efe4d4" />
              <path d={SCLERA} fill="#efe4d4" transform={mirror} />
              <g className="doom-pupils">
                {EYES.map((cx) => (
                  <g key={cx}>
                    <circle cx={cx} cy={EYE_Y} r="7" fill={url("iris")} />
                    <circle cx={cx} cy={EYE_Y} r="2.8" fill="#1a0a00" />
                    <circle cx={cx - 2.2} cy={EYE_Y - 2.4} r="1.4" fill="#fff" />
                  </g>
                ))}
              </g>
            </>
          )}
          {/* Mí kim loại — sập xuống khi chớp mắt */}
          <path className="doom-lid" d={SOCKET} fill="#7d858c" />
          <path className="doom-lid" d={SOCKET} fill="#7d858c" transform={mirror} />
        </g>

        {/* Mày thép dày nhíu chữ V */}
        <path
          d="M60 98l54 14 6 5 6-5 54-14 2 11-56 17-6 5-6-5-56-17Z"
          fill={url("plate")}
          stroke="#2a2f34"
          strokeWidth="1.2"
        />

        {/* Mũi dài */}
        <path d="M113 121h14l4 36-11 8-11-8Z" fill={url("plate")} stroke="#2a2f34" strokeWidth="1.2" />

        {/* Miệng lưới hình thang trên tấm hàm */}
        <path d="M84 164h72l-8 26H92Z" fill="#4a5157" stroke="#22272b" strokeWidth="1.2" />
        <path d="M92 168h56l-5 16H97Z" fill="#111417" />
        {Array.from({ length: 6 }, (_, i) => (
          <rect key={i} x={99.5 + i * 7.5} y="169" width="3" height="14" rx="1" fill="#7c848b" />
        ))}

        {/* Tia quét khi đang đọc QR */}
        <path className="doom-beam" d="M152 122 240 98v60l-88-24Z" fill={url("beam")} />
      </g>

      {/* "z z z" khi ngủ */}
      <g className="doom-zzz" fill="#cfe9ff" fontWeight="700" fontFamily="sans-serif">
        <text x="182" y="60" fontSize="18">z</text>
        <text x="196" y="40" fontSize="14">z</text>
        <text x="206" y="24" fontSize="11">z</text>
      </g>
    </svg>
  );
}

function Rivets({ points }: { points: readonly (readonly [number, number])[] }) {
  return (
    <g>
      {points.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="2.6" fill="#24282c" />
          <circle cx={x - 0.6} cy={y - 0.7} r="0.9" fill="#fff" opacity="0.75" />
        </g>
      ))}
    </g>
  );
}
