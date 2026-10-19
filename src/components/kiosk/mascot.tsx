"use client";

import { useId, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type MascotMood = "idle" | "scanning" | "success" | "error" | "sleep";

/**
 * Linh vật kiosk: đầu Doctor Doom chibi (mũ trùm xanh lá, mặt nạ kim loại có
 * đinh tán, mắt cam phát sáng) — vẽ lại bằng SVG theo ảnh mẫu
 * plans/261019-kiosk-checkin/assets/mascot-reference-doom.png.
 *
 * Mặt nạ kim loại không cử động nên biểu cảm nằm ở MẮT + chuyển động đầu, điều
 * khiển bằng class `doom--<mood>` (keyframes trong globals.css, mục "Kiosk
 * mascot"). `glow` đổi màu ánh mắt; `look` (-1..1) cho mắt liếc theo điểm chạm.
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
  const lookX = mood === "scanning" ? 3.5 : (look?.x ?? 0) * 3;
  const lookY = mood === "scanning" ? 0 : (look?.y ?? 0) * 2;
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
        <radialGradient id={id("hood")} cx="0.45" cy="0.25" r="0.85">
          <stop offset="0" stopColor="#7cc35e" />
          <stop offset="0.45" stopColor="#3f8a35" />
          <stop offset="1" stopColor="#173d16" />
        </radialGradient>
        <radialGradient id={id("hood-in")} cx="0.5" cy="0.45" r="0.6">
          <stop offset="0.6" stopColor="#0a1609" />
          <stop offset="1" stopColor="#1c3f19" />
        </radialGradient>
        <linearGradient id={id("metal")} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#f4f6f8" />
          <stop offset="0.35" stopColor="#b8c0c8" />
          <stop offset="0.7" stopColor="#7d8791" />
          <stop offset="1" stopColor="#4a525a" />
        </linearGradient>
        <radialGradient id={id("shine")} cx="0.35" cy="0.25" r="0.5">
          <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("brow")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9dee3" />
          <stop offset="1" stopColor="#6b747d" />
        </linearGradient>
        <radialGradient id={id("eye")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff6d6" />
          <stop offset="0.45" style={{ stopColor: "var(--doom-eye)" }} />
          <stop offset="1" stopColor="#3a1400" />
        </radialGradient>
        <linearGradient id={id("beam")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--doom-eye)" }} stopOpacity="0.55" />
          <stop offset="1" style={{ stopColor: "var(--doom-eye)" }} stopOpacity="0" />
        </linearGradient>
        <filter id={id("blur")} x="-1" y="-1" width="3" height="3">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      <g className="doom-head">
        {/* Mũ trùm */}
        <path
          d="M120 8C52 8 10 58 12 128c2 58 34 94 62 108h92c28-14 60-50 62-108 2-70-40-120-108-120Z"
          fill={url("hood")}
        />
        <path
          d="M64 36c-24 20-36 50-36 86M176 36c24 20 36 50 36 86M40 190c10 18 22 30 36 38M200 190c-10 18-22 30-36 38"
          fill="none"
          stroke="#173d16"
          strokeOpacity="0.55"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <ellipse cx="96" cy="34" rx="34" ry="12" fill="#fff" opacity="0.12" />
        <path
          d="M120 40C72 40 46 74 46 120c0 52 30 88 74 90 44-2 74-38 74-90 0-46-26-80-74-80Z"
          fill={url("hood-in")}
        />

        {/* Mặt nạ */}
        <path
          d="M120 58C84 58 62 80 62 112c0 30 8 54 26 72 10 10 20 14 32 14s22-4 32-14c18-18 26-42 26-72 0-32-22-54-58-54Z"
          fill={url("metal")}
          stroke="#3a4148"
          strokeWidth="1.5"
        />
        <path
          d="M120 58C84 58 62 80 62 112c0 30 8 54 26 72 10 10 20 14 32 14s22-4 32-14c18-18 26-42 26-72 0-32-22-54-58-54Z"
          fill={url("shine")}
        />
        {/* Bóng hai bên má cho cảm giác khối */}
        <path d="M62 112c0 30 8 54 26 72l8-12c-14-16-20-36-20-56Z" fill="#000" opacity="0.18" />
        <path d="M178 112c0 30-8 54-26 72l-8-12c14-16 20-36 20-56Z" fill="#000" opacity="0.18" />
        {/* Đường viền trán + đinh tán */}
        <path d="M70 90c30-11 70-11 100 0" fill="none" stroke="#4d555d" strokeWidth="1.5" />
        {Array.from({ length: 9 }, (_, i) => {
          const x = 84 + i * 9;
          const y = 78 + Math.abs(i - 4) * 1.4;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="2.4" fill="#3d444b" />
              <circle cx={x - 0.6} cy={y - 0.7} r="0.9" fill="#fff" opacity="0.8" />
            </g>
          );
        })}

        {/* Hốc mắt */}
        <path d="M74 110l38 10-2 16-28-4Z" fill="#111417" />
        <path d="M166 110l-38 10 2 16 28-4Z" fill="#111417" />

        {/* Mắt */}
        <g className="doom-eyes">
          <ellipse cx="95" cy="126" rx="16" ry="11" style={{ fill: "var(--doom-eye)" }} filter={url("blur")} className="doom-eye-glow" />
          <ellipse cx="145" cy="126" rx="16" ry="11" style={{ fill: "var(--doom-eye)" }} filter={url("blur")} className="doom-eye-glow" />
          {happy ? (
            <g fill="none" style={{ stroke: "var(--doom-eye)" }} strokeWidth="4" strokeLinecap="round">
              <path d="M86 130q9-12 18 0" />
              <path d="M136 130q9-12 18 0" />
            </g>
          ) : (
            <g className="doom-pupils">
              <ellipse cx="95" cy="126" rx="9" ry="5.5" fill={url("eye")} />
              <ellipse cx="145" cy="126" rx="9" ry="5.5" fill={url("eye")} />
            </g>
          )}
          {/* Mí kim loại — sập xuống khi chớp mắt */}
          <path className="doom-lid" d="M74 110l38 10-2 16-28-4Z" fill="#8c959e" />
          <path className="doom-lid" d="M166 110l-38 10 2 16 28-4Z" fill="#8c959e" />
        </g>

        {/* Mày nhíu chữ V */}
        <path
          d="M68 99l46 11 6-4 6 4 46-11v9l-46 13-6-4-6 4-46-13Z"
          fill={url("brow")}
          stroke="#3a4148"
          strokeWidth="1"
        />

        {/* Mũi + rãnh má */}
        <path d="M114 121h12l3 30-9 7-9-7Z" fill={url("brow")} stroke="#3a4148" strokeWidth="1" />
        <path d="M74 140l16 26M166 140l-16 26" stroke="#3d444b" strokeWidth="2.2" strokeLinecap="round" />
        
        {/* Miệng lưới */}
        <rect x="99" y="166" width="42" height="22" rx="4" fill="#262b30" stroke="#596169" strokeWidth="1.5" />
        {Array.from({ length: 5 }, (_, i) => (
          <line key={i} x1={106 + i * 7} y1="169" x2={106 + i * 7} y2="185" stroke="#0c0e10" strokeWidth="3" />
        ))}
        <path d="M86 176c12 14 56 14 68 0" fill="none" stroke="#4d555d" strokeWidth="1.5" />

        {/* Tia quét khi đang đọc QR */}
        <path className="doom-beam" d="M153 120L240 96v60L153 132Z" fill={url("beam")} />
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
